// VERDE BAY 3D — simulation: the player, cars, pedestrians, police,
// wanted heat, missions, the taxi side job, combat and particles.
// The world is 2D (x east, y south); the renderer maps (x, y) to
// three.js (x, 0, -y). A heading of 0 points east.
import {
  WORLD_W, WORLD_H, ROAD_X, ROAD_Y, ROAD_W, BEACH_Y, WATER_Y,
  CAR_MODELS, PLAYER, WANTED, KEYS, PLACES,
} from './config.js';
import {
  generateCity, isOnRoad, nearestRoadPoint, randomRoadPoint,
  randomSidewalkPoint, pointInBuilding, hasLineOfSight,
} from './city.js';
import { makeRng, range, rangeInt, pick, chance, clamp, dist, angleTo, angleDiff } from './util.js';
import { createMissionState, startMission, updateMission, updateTaxi } from './missions.js';
import { sfx, startSiren, stopSiren, setEngine } from './audio.js';
import { writeSave } from './save.js';
import { keyDown, keyPressed } from './input.js';

// --- Factories -------------------------------------------------------------
// A car is a plain data object; the renderer builds its mesh from it.
export function makeCar(model, x, y, angle, color, kind) {
  const def = CAR_MODELS[model] || CAR_MODELS.sedan;
  return {
    model, name: def.name, w: def.w, h: def.h, top: def.top, accel: def.accel, grip: def.grip,
    x, y, angle: angle || 0, speed: 0,
    color: color || def.colors[0],
    kind: kind || 'traffic',
    driver: kind === 'traffic' || kind === 'police',
    hp: 100,
    // Traffic road-following state; police and player cars leave it null.
    road: null, turnCd: 0,
    // Stuck detection for police (reverse out and try again).
    stuckT: 0, lastX: x, lastY: y, reverseT: 0,
    // How long a police car has sat next to the on-foot player before its
    // driver gets out on foot.
    deployT: 0, leaveT: 0, brake: false,
  };
}

// A pedestrian: civilian, gang member or (via S.cops) a foot cop.
// The optional rng keeps spawned peds deterministic per seed; callers
// outside the sim (missions, shots) get Math.random as a fallback.
export function makePed(x, y, kind, rng) {
  const R = rng || Math.random;
  const k = kind || 'civilian';
  return {
    x, y, angle: range(R, 0, Math.PI * 2),
    kind: k,
    hp: 100, speed: 0,
    color: k === 'gang' ? '#7f1d1d' : k === 'cop' ? '#1d3557'
      : pick(R, ['#e07a5f', '#81b29a', '#f2cc8f', '#a8dadc', '#e76f51', '#b5838d', '#f4a261']),
    target: null, targetT: 0,
    state: 'walk', stateT: 0,
    shootCd: range(R, 0.3, 1.2),
    fleeX: 0, fleeY: 0,
    walkPhase: R() * Math.PI * 2,
    armorDrop: false,
  };
}

// --- Small world queries ----------------------------------------------------
function buildingAt(S, x, y, pad) {
  return pointInBuilding(S.city, x, y, pad || 0);
}

function clampToWorld(S, x, y) {
  return {
    x: clamp(x, 24, WORLD_W - 24),
    y: clamp(y, 24, WATER_Y - 10),
  };
}

// Move a circle (radius r) through the city, sliding along walls:
// try the full step, then x-only, then y-only.
function moveCircle(S, x, y, dx, dy, r) {
  if (!buildingAt(S, x + dx, y + dy, r)) return { x: x + dx, y: y + dy, hit: false };
  if (!buildingAt(S, x + dx, y, r)) return { x: x + dx, y, hit: true };
  if (!buildingAt(S, x, y + dy, r)) return { x, y: y + dy, hit: true };
  return { x, y, hit: true };
}

// --- Crime and police -------------------------------------------------------
function anyCopSeesPlayer(S) {
  const px = S.player.car ? S.player.car.x : S.player.x;
  const py = S.player.car ? S.player.car.y : S.player.y;
  for (const c of S.cars) {
    if (c.kind !== 'police') continue;
    if (dist(c.x, c.y, px, py) < WANTED.copSightRange && hasLineOfSight(S.city, c.x, c.y, px, py)) return true;
  }
  for (const cop of S.cops) {
    if (dist(cop.x, cop.y, px, py) < WANTED.copSightRange && hasLineOfSight(S.city, cop.x, cop.y, px, py)) return true;
  }
  return false;
}

function spawnCops(S, radius) {
  const px = S.player.car ? S.player.car.x : S.player.x;
  const py = S.player.car ? S.player.car.y : S.player.y;
  const have = S.cars.filter((c) => c.kind === 'police').length;
  const want = Math.min(WANTED.maxCops, Math.max(S.wanted.level, have));
  for (let i = have; i < want; i++) {
    // A road point roughly `radius` away, so the sirens arrive over a
    // couple of seconds instead of on top of the player.
    let spot = null;
    for (let tries = 0; tries < 12; tries++) {
      const cand = randomRoadPoint(S.rng);
      const d = dist(cand.x, cand.y, px, py);
      if (d > radius * 0.55 && d < radius * 1.4) { spot = cand; break; }
    }
    if (!spot) spot = nearestRoadPoint(S.rng, px + radius, py);
    const car = makeCar('police', spot.x, spot.y, angleTo(spot.x, spot.y, px, py), '#1a1a2e', 'police');
    car.speed = car.top * 0.7;
    S.cars.push(car);
  }
}

function commitCrime(S, stars, radius) {
  S.wanted.heat = Math.min(WANTED.maxStars, S.wanted.heat + stars);
  S.wanted.level = Math.min(WANTED.maxStars, Math.ceil(S.wanted.heat));
  S.wanted.decayAt = S.time + WANTED.decayDelay;
  spawnCops(S, radius || 600);
  if (S.wanted.level > 0) startSiren();
}

// --- Feedback: floating text and particle bursts ---------------------------
function addFloater(S, x, y, text, color) {
  S.floaters.push({ x, y, text, color: color || '#ffffff', life: 1.2 });
  if (S.floaters.length > 24) S.floaters.shift();
}

function spawnBurst(S, x, y, color, n, speed) {
  for (let i = 0; i < n; i++) {
    const a = S.rng() * Math.PI * 2;
    const v = (speed || 140) * (0.35 + S.rng() * 0.65);
    S.particles.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      life: 0.45 + S.rng() * 0.35, maxLife: 0.8,
      color: color || '#ffd166', size: 3 + S.rng() * 4,
    });
  }
  if (S.particles.length > 600) S.particles.splice(0, S.particles.length - 600);
  // A big hot burst also flashes a light (the renderer owns the pool).
  if (n >= 14) S.flash = { x, y, color: color || '#ff9a3c', life: 0.45 };
}

// --- Traffic and pedestrians -------------------------------------------------
function spawnTraffic(S) {
  const models = ['sedan', 'sedan', 'sport', 'taxi', 'van', 'truck', 'muscle', 'sedan'];
  for (let i = 0; i < 14; i++) {
    const spot = randomRoadPoint(S.rng);
    const model = pick(S.rng, models);
    const def = CAR_MODELS[model];
    const dir = chance(S.rng, 0.5) ? 1 : -1;
    // Heading matches the road direction so the car never has to turn at spawn.
    const angle = spot.horizontal ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    const car = makeCar(model, spot.x, spot.y, angle, pick(S.rng, def.colors), 'traffic');
    // Put the car on its road: vertical roads run north-south, horizontal east-west.
    car.road = spot.horizontal
      ? { axis: 'y', line: spot.y, dir, turnCd: 2 }
      : { axis: 'x', line: spot.x, dir, turnCd: 2 };
    car.speed = def.top * range(S.rng, 0.3, 0.5);
    S.cars.push(car);
  }
}

function spawnPeds(S) {
  for (let i = 0; i < 24; i++) {
    const spot = randomSidewalkPoint(S.rng);
    const ped = makePed(spot.x, spot.y, 'civilian', S.rng);
    ped.target = randomSidewalkPoint(S.rng);
    S.peds.push(ped);
  }
}

// --- Game state ---------------------------------------------------------------
export function createGame(seed) {
  const rng = makeRng(seed);
  const city = generateCity(seed);
  const S = {
    seed, rng, time: 0,
    city,
    player: {
      x: PLACES.garage.x, y: PLACES.garage.y + 40,
      angle: -Math.PI / 2, aimX: PLACES.garage.x, aimY: PLACES.garage.y,
      onFoot: true, car: null,
      hp: PLAYER.maxHp, armor: 0, ammo: PLAYER.startAmmo, cash: 0,
      speed: 0, moving: false, shootCd: 0, hurtT: 0, regenT: 0, reloadCd: 0,
    },
    cars: [], peds: [], cops: [],
    wanted: { level: 0, heat: 0, decayAt: 0 },
    mission: createMissionState(),
    taxi: { active: false, marker: null, stage: '', fare: 0 },
    stats: { missionsDone: 0, bestCash: 0, carsStolen: 0 },
    message: '', messageT: 0,
    floaters: [], particles: [], tracers: [], pickups: [],
    flash: null, shake: 0,
    flags: { menu: true, started: false, paused: false, wasted: false, wastedT: 0, busted: false, bustedT: 0 },
    input: null, hud: null, renderer: null,
    cameraSnap: false, aimReady: false,
    saveT: 0,
  };
  S.makeCar = makeCar;
  S.makePed = makePed;
  S.commitCrime = (stars, radius) => commitCrime(S, stars, radius);
  S.spawnBurst = (x, y, color, n, speed) => spawnBurst(S, x, y, color, n, speed);
  S.addFloater = (x, y, text, color) => addFloater(S, x, y, text, color);
  spawnTraffic(S);
  spawnPeds(S);
  return S;
}

export function applySave(S, save) {
  if (!save) return;
  S.player.cash = save.cash || 0;
  S.mission.index = clamp(save.missionIndex || 0, 0, 6);
  S.mission.active = false;
  S.mission.stage = 0;
  S.mission.objective = '';
  S.mission.marker = null;
  S.stats.missionsDone = save.missionsDone || 0;
  S.stats.carsStolen = save.carsStolen || 0;
  S.stats.bestCash = Math.max(save.bestCash || 0, S.player.cash);
  // Continue on foot at the garage, ready for the next job.
  const p = S.player;
  p.x = PLACES.garage.x; p.y = PLACES.garage.y + 40;
  p.car = null; p.onFoot = true;
  p.hp = PLAYER.maxHp; p.ammo = PLAYER.startAmmo;
  S.mission.nextAt = S.time + 1;
}

// --- Main loop ----------------------------------------------------------------
export function update(S, dt) {
  if (S.flags.paused) return;
  dt = Math.min(dt, 0.05);
  S.time += dt;
  const p = S.player;
  const playing = S.flags.started && !S.flags.menu;
  const dead = S.flags.wasted || S.flags.busted;

  // Timers and ambience always advance (the menu shows a living city).
  if (S.messageT > 0) S.messageT -= dt;
  if (S.shake > 0) S.shake = Math.max(0, S.shake - dt * 1.6);
  updateParticles(S, dt);
  updateFloaters(S, dt);
  updateTracers(S, dt);
  updateTraffic(S, dt);
  updatePolice(S, dt);
  updatePeds(S, dt);
  updateCops(S, dt);
  updateCarCollisions(S, dt);

  if (playing && !dead) {
    if (p.onFoot) updatePlayerOnFoot(S, dt);
    else updatePlayerDriving(S, dt);
    updateMission(S, dt);
    updateTaxi(S, dt);
    updateWanted(S, dt);
    // The next job starts at the garage, or after a breather anywhere.
    if (!S.mission.active && S.mission.index < 6 && S.time >= S.mission.nextAt) {
      const g = S.city.places.garage;
      const px = p.car ? p.car.x : p.x, py = p.car ? p.car.y : p.y;
      if (dist(px, py, g.x, g.y) < 130 || S.time >= S.mission.nextAt + 25) {
        startMission(S, S.mission.index);
      }
    }
    S.saveT += dt;
    if (S.saveT > 5) { S.saveT = 0; writeSave(S); }
    setEngine(p.car ? Math.abs(p.car.speed) / p.car.top : 0, !!p.car);
  }

  if (S.flags.wasted) {
    S.flags.wastedT += dt;
    if (S.flags.wastedT >= 2.5) respawn(S, S.city.places.hospital, 'wasted');
  }
  if (S.flags.busted) {
    S.flags.bustedT += dt;
    if (S.flags.bustedT >= 3) respawn(S, S.city.places.policeHQ, 'busted');
  }
}

function respawn(S, place, why) {
  const p = S.player;
  p.x = place.x; p.y = place.y + 40;
  p.car = null; p.onFoot = true;
  p.hp = PLAYER.maxHp; p.armor = 0; p.ammo = PLAYER.startAmmo;
  p.angle = -Math.PI / 2;
  S.wanted.level = 0; S.wanted.heat = 0; S.wanted.decayAt = 0;
  S.cops.length = 0;
  for (const c of S.cars) if (c.kind === 'police') c.leaveT = 0.01;
  S.flags.wasted = false; S.flags.wastedT = 0;
  S.flags.busted = false; S.flags.bustedT = 0;
  S.message = why === 'wasted'
    ? 'You woke up at St. Alba Hospital, $200 lighter.'
    : 'The VBPD took their cut. Stay out of sight for a while.';
  S.messageT = 4;
}

// --- The player on foot ---------------------------------------------------------
function updatePlayerOnFoot(S, dt) {
  const p = S.player;
  const input = S.input;
  if (!input) return;
  let mx = 0, my = 0;
  if (keyDown(input, KEYS.up)) my -= 1;
  if (keyDown(input, KEYS.down)) my += 1;
  if (keyDown(input, KEYS.left)) mx -= 1;
  if (keyDown(input, KEYS.right)) mx += 1;
  const len = Math.hypot(mx, my);
  const sprint = keyDown(input, KEYS.sprint);
  const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  p.moving = len > 0;
  if (len > 0) {
    p.speed = speed;
    const nx = p.x + (mx / len) * speed * dt;
    const ny = p.y + (my / len) * speed * dt;
    const moved = moveCircle(S, p.x, p.y, nx - p.x, ny - p.y, PLAYER.radius);
    p.x = moved.x; p.y = moved.y;
    if (!S.aimReady) p.angle = Math.atan2(my, mx);
  } else {
    p.speed = 0;
  }
  // Face the mouse aim point once the mouse has been used.
  if (S.aimReady && typeof p.aimX === 'number' && typeof p.aimY === 'number'
    && dist(p.x, p.y, p.aimX, p.aimY) > 4) {
    p.angle = angleTo(p.x, p.y, p.aimX, p.aimY);
  }
  const c = clampToWorld(S, p.x, p.y);
  p.x = c.x; p.y = c.y;

  p.shootCd -= dt;
  if ((input.mouseDown || input.clicked) && p.shootCd <= 0) firePistol(S);
  p.reloadCd -= dt;
  if (keyPressed(input, KEYS.reload) && p.ammo < PLAYER.startAmmo && p.reloadCd <= 0) {
    p.ammo = PLAYER.startAmmo;
    p.reloadCd = 0.6;
    sfx.click();
  }
  if (keyPressed(input, KEYS.enter)) tryEnterCar(S);

  // Armor pickups dropped by fallen gang members.
  for (let i = S.pickups.length - 1; i >= 0; i--) {
    const pk = S.pickups[i];
    if (dist(p.x, p.y, pk.x, pk.y) < 30) {
      p.armor = Math.min(100, p.armor + 30);
      S.pickups.splice(i, 1);
      addFloater(S, p.x, p.y - 20, '+Armor', '#4cc9f0');
      sfx.pickup();
    }
  }

  p.hurtT += dt;
  if (p.hurtT > 4 && p.hp < PLAYER.maxHp) p.hp = Math.min(PLAYER.maxHp, p.hp + 3 * dt);
}

function firePistol(S) {
  const p = S.player;
  if (p.ammo <= 0) { sfx.click(); p.shootCd = 0.25; return; }
  p.ammo -= 1;
  p.shootCd = PLAYER.pistolCooldown;
  const hasAim = S.aimReady && typeof p.aimX === 'number' && typeof p.aimY === 'number';
  const ax = hasAim ? p.aimX : p.x + Math.cos(p.angle) * 100;
  const ay = hasAim ? p.aimY : p.y + Math.sin(p.angle) * 100;
  const dir = angleTo(p.x, p.y, ax, ay);
  const endX = p.x + Math.cos(dir) * PLAYER.pistolRange;
  const endY = p.y + Math.sin(dir) * PLAYER.pistolRange;
  // Nearest ped or foot cop near the shot line.
  let best = null, bestD = Infinity;
  const consider = (t) => {
    if (!t || t.hp <= 0) return;
    const d = dist(p.x, p.y, t.x, t.y);
    if (d > PLAYER.pistolRange) return;
    const along = (t.x - p.x) * Math.cos(dir) + (t.y - p.y) * Math.sin(dir);
    if (along < 0) return;
    const perp = Math.abs((t.x - p.x) * Math.sin(dir) - (t.y - p.y) * Math.cos(dir));
    if (perp < 22 && d < bestD) { best = t; bestD = d; }
  };
  for (const ped of S.peds) consider(ped);
  for (const cop of S.cops) consider(cop);
  const hx = best ? best.x : endX, hy = best ? best.y : endY;
  S.tracers.push({ x1: p.x, y1: p.y, x2: hx, y2: hy, life: 0.12 });
  if (S.tracers.length > 12) S.tracers.shift();
  sfx.shoot();
  if (best) {
    damagePed(S, best, PLAYER.pistolDamage, 'player');
    spawnBurst(S, best.x, best.y, '#ff595e', 6, 120);
  }
  // Firing where the law can see it is a crime.
  if (anyCopSeesPlayer(S)) commitCrime(S, 0.5, 400);
  // Nearby civilians run from the shot.
  for (const ped of S.peds) {
    if (ped.kind === 'civilian' && dist(ped.x, ped.y, p.x, p.y) < 320) {
      ped.state = 'flee'; ped.stateT = 3;
      ped.fleeX = ped.x - p.x; ped.fleeY = ped.y - p.y;
    }
  }
}

function tryEnterCar(S) {
  const p = S.player;
  let best = null, bestD = 60;
  for (const car of S.cars) {
    const d = dist(p.x, p.y, car.x, car.y);
    if (d < bestD) { best = car; bestD = d; }
  }
  if (!best) return;
  // Taking a car the law can see is a crime.
  if (best.kind !== 'player' && anyCopSeesPlayer(S)) commitCrime(S, 1, 500);
  if (best.driver) best.driver = false;
  if (best.kind !== 'player') S.stats.carsStolen += 1;
  p.car = best; p.onFoot = false;
  p.x = best.x; p.y = best.y; p.angle = best.angle;
  sfx.door();
}

function exitCar(S) {
  const p = S.player;
  const car = p.car;
  if (!car) return;
  const sx = Math.cos(car.angle + Math.PI / 2), sy = Math.sin(car.angle + Math.PI / 2);
  let px = car.x + sx * 32, py = car.y + sy * 32;
  if (buildingAt(S, px, py, PLAYER.radius)) { px = car.x - sx * 32; py = car.y - sy * 32; }
  const c = clampToWorld(S, px, py);
  p.x = c.x; p.y = c.y;
  p.car = null; p.onFoot = true; p.angle = car.angle;
  car.speed *= 0.3;
  sfx.door();
}

// --- The player driving ---------------------------------------------------------
function updatePlayerDriving(S, dt) {
  const p = S.player;
  const car = p.car;
  const input = S.input;
  if (!input) return;
  const fwd = keyDown(input, KEYS.up) ? 1 : 0;
  const back = keyDown(input, KEYS.down) ? 1 : 0;
  const left = keyDown(input, KEYS.left) ? 1 : 0;
  const right = keyDown(input, KEYS.right) ? 1 : 0;
  const brake = keyDown(input, KEYS.brake);
  if (fwd) car.speed += car.accel * dt;
  if (back) {
    if (car.speed > 20) car.speed -= car.accel * 1.2 * dt;
    else car.speed -= car.accel * 0.55 * dt;
  }
  if (brake) car.speed -= Math.sign(car.speed) * 520 * dt;
  if (!fwd && !back) car.speed -= car.speed * 0.7 * dt;
  car.speed = clamp(car.speed, -140, car.top);
  if (Math.abs(car.speed) < 4 && !fwd && !back) car.speed = 0;
  const steer = (left ? -1 : 0) + (right ? 1 : 0);
  const spdF = clamp(Math.abs(car.speed) / car.top, 0, 1);
  car.angle += steer * car.grip * 0.75 * spdF * dt * (brake ? 1.7 : 1) * (car.speed < 0 ? -1 : 1);
  car.brake = brake || back;
  const dx = Math.cos(car.angle) * car.speed * dt;
  const dy = Math.sin(car.angle) * car.speed * dt;
  const moved = moveCircle(S, car.x, car.y, dx, dy, 17);
  if (moved.hit && Math.abs(car.speed) > 160) { sfx.crash(); S.shake = 0.35; }
  if (moved.hit) car.speed *= 0.55;
  car.x = moved.x; car.y = moved.y;
  const c = clampToWorld(S, car.x, car.y);
  car.x = c.x; car.y = c.y;
  p.x = car.x; p.y = car.y; p.angle = car.angle;
  p.speed = Math.abs(car.speed);
  if (keyPressed(input, KEYS.enter)) exitCar(S);
  // Running over pedestrians is a crime when the law sees it.
  for (const ped of [...S.peds]) {
    if (ped.hp <= 0) continue;
    if (dist(car.x, car.y, ped.x, ped.y) < 26 && Math.abs(car.speed) > 60) {
      damagePed(S, ped, 70, 'car');
      ped.x += Math.cos(car.angle) * 30;
      ped.y += Math.sin(car.angle) * 30;
      if (anyCopSeesPlayer(S)) commitCrime(S, 1, 400);
      car.speed *= 0.8;
    }
  }
  p.hurtT += dt;
  if (p.hurtT > 4 && p.hp < PLAYER.maxHp) p.hp = Math.min(PLAYER.maxHp, p.hp + 3 * dt);
}

// --- Traffic ------------------------------------------------------------------
// Traffic cars follow the road grid: a vertical road (constant x) runs
// north-south, a horizontal road (constant y) runs east-west. At an
// intersection a car sometimes turns onto the crossing road.
function carAhead(S, car, range) {
  let best = null, bestD = range;
  for (const o of S.cars) {
    if (o === car) continue;
    const d = dist(car.x, car.y, o.x, o.y);
    if (d > range) continue;
    const along = (o.x - car.x) * Math.cos(car.angle) + (o.y - car.y) * Math.sin(car.angle);
    if (along < 0 || along > range) continue;
    const perp = Math.abs((o.x - car.x) * Math.sin(car.angle) - (o.y - car.y) * Math.cos(car.angle));
    if (perp < 30 && d < bestD) { best = o; bestD = d; }
  }
  return best;
}

function updateTraffic(S, dt) {
  const p = S.player;
  const px = p.car ? p.car.x : p.x, py = p.car ? p.car.y : p.y;
  for (const car of S.cars) {
    if (car.kind !== 'traffic' || !car.driver || !car.road) continue;
    const road = car.road;
    // Desired heading along the road (axis 'x' = vertical road, travel north/south).
    const desired = road.axis === 'x'
      ? (road.dir > 0 ? Math.PI / 2 : -Math.PI / 2)
      : (road.dir > 0 ? 0 : Math.PI);
    car.angle += clamp(angleDiff(car.angle, desired), -2.4 * dt, 2.4 * dt);
    // Ease back onto the road centreline.
    if (road.axis === 'x') car.x += clamp(road.line - car.x, -90 * dt, 90 * dt);
    else car.y += clamp(road.line - car.y, -90 * dt, 90 * dt);
    // Brake for the car ahead, or for the player in the way.
    let targetSpeed = car.top * 0.45;
    const ahead = carAhead(S, car, 60);
    if (ahead) targetSpeed = Math.min(targetSpeed, Math.max(0, ahead.speed));
    if (dist(car.x, car.y, px, py) < 70) {
      const toPlayer = angleTo(car.x, car.y, px, py);
      if (Math.abs(angleDiff(car.angle, toPlayer)) < 0.6) targetSpeed = 0;
    }
    car.speed += clamp(targetSpeed - car.speed, -300 * dt, 160 * dt);
    const dx = Math.cos(car.angle) * car.speed * dt;
    const dy = Math.sin(car.angle) * car.speed * dt;
    const moved = moveCircle(S, car.x, car.y, dx, dy, 16);
    if (moved.hit) car.speed *= 0.5;
    car.x = moved.x; car.y = moved.y;
    const c = clampToWorld(S, car.x, car.y);
    car.x = c.x; car.y = c.y;
    // Turn at intersections.
    road.turnCd -= dt;
    if (road.turnCd <= 0) {
      const cross = road.axis === 'x'
        ? ROAD_Y.find((ry) => Math.abs(car.y - ry) < 34)
        : ROAD_X.find((rx) => Math.abs(car.x - rx) < 34);
      if (cross !== undefined && chance(S.rng, 0.35)) {
        car.road = road.axis === 'x'
          ? { axis: 'y', line: cross, dir: chance(S.rng, 0.5) ? 1 : -1, turnCd: 2.5 }
          : { axis: 'x', line: cross, dir: chance(S.rng, 0.5) ? 1 : -1, turnCd: 2.5 };
      } else {
        road.turnCd = 0.4;
      }
    }
  }
}

// --- Police cars ---------------------------------------------------------------
function updatePolice(S, dt) {
  const p = S.player;
  const px = p.car ? p.car.x : p.x, py = p.car ? p.car.y : p.y;
  for (const car of [...S.cars]) {
    if (car.kind !== 'police') continue;
    car.ramCd = Math.max(0, (car.ramCd || 0) - dt);
    if (S.wanted.level <= 0) {
      // Give up: slow down and leave the scene.
      car.leaveT += dt;
      car.speed = Math.max(0, car.speed - 200 * dt);
      const dx = Math.cos(car.angle) * car.speed * dt;
      const dy = Math.sin(car.angle) * car.speed * dt;
      const moved = moveCircle(S, car.x, car.y, dx, dy, 16);
      car.x = moved.x; car.y = moved.y;
      if (car.leaveT > 4 || dist(car.x, car.y, px, py) > 1200) {
        S.cars.splice(S.cars.indexOf(car), 1);
      }
      continue;
    }
    car.leaveT = 0;
    const d = dist(car.x, car.y, px, py);
    const want = angleTo(car.x, car.y, px, py);
    car.angle += clamp(angleDiff(car.angle, want), -3.2 * dt, 3.2 * dt);
    // Stop short of an on-foot player: the driver gets out instead of
    // running them over.
    let targetSpeed = d > 120 ? car.top : car.top * 0.55;
    if (p.onFoot && d < 48) targetSpeed = 0;
    car.speed += clamp(targetSpeed - car.speed, -400 * dt, 320 * dt);
    const dx = Math.cos(car.angle) * car.speed * dt;
    const dy = Math.sin(car.angle) * car.speed * dt;
    const moved = moveCircle(S, car.x, car.y, dx, dy, 16);
    if (moved.hit) car.speed *= 0.6;
    car.x = moved.x; car.y = moved.y;
    const c = clampToWorld(S, car.x, car.y);
    car.x = c.x; car.y = c.y;
    // Stuck against a building? Reverse out and try a different line.
    if (Math.abs(car.x - car.lastX) < 2 && Math.abs(car.y - car.lastY) < 2 && car.speed > 50) car.stuckT += dt;
    else car.stuckT = 0;
    car.lastX = car.x; car.lastY = car.y;
    if (car.stuckT > 1.2) { car.reverseT = 0.7; car.stuckT = 0; }
    if (car.reverseT > 0) {
      car.reverseT -= dt;
      car.x -= Math.cos(car.angle) * 120 * dt;
      car.y -= Math.sin(car.angle) * 120 * dt;
      car.angle += 1.4 * dt;
    }
    // Ramming the player's car.
    if (p.car && d < 46 && car.speed > 60) {
      p.car.speed *= 0.94;
      S.shake = Math.max(S.shake, 0.25);
      if (car.ramCd <= 0) { sfx.crash(); car.ramCd = 0.8; }
    }
    // On foot and close for a while: the driver gets out to make the arrest.
    if (p.onFoot && d < 95) {
      car.deployT += dt;
      if (car.deployT > 1.5 && S.cops.length < 6) {
        car.deployT = 0;
        const cop = makePed(car.x + 30, car.y, 'cop', S.rng);
        S.cops.push(cop);
      }
    } else {
      car.deployT = 0;
    }
  }
}

// --- Pedestrians -----------------------------------------------------------------
function wanderPed(S, ped, dt) {
  if (!ped.target || dist(ped.x, ped.y, ped.target.x, ped.target.y) < 24) {
    ped.target = randomSidewalkPoint(S.rng);
  }
  const a = angleTo(ped.x, ped.y, ped.target.x, ped.target.y);
  ped.angle += clamp(angleDiff(ped.angle, a), -3 * dt, 3 * dt);
  ped.speed = 45;
  const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt;
  const ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
  const moved = moveCircle(S, ped.x, ped.y, nx - ped.x, ny - ped.y, 11);
  if (moved.hit) ped.target = randomSidewalkPoint(S.rng);
  ped.x = moved.x; ped.y = moved.y;
}

function gangShoot(S, ped, px, py) {
  S.tracers.push({ x1: ped.x, y1: ped.y, x2: px, y2: py, life: 0.1 });
  if (S.tracers.length > 12) S.tracers.shift();
  sfx.enemyShoot();
  if (S.rng() < 0.65) hurtPlayer(S, 7);
  else spawnBurst(S, px + (S.rng() - 0.5) * 40, py + (S.rng() - 0.5) * 40, '#c9c9c9', 3, 60);
}

function updatePeds(S, dt) {
  const p = S.player;
  const px = p.car ? p.car.x : p.x, py = p.car ? p.car.y : p.y;
  for (let i = S.peds.length - 1; i >= 0; i--) {
    const ped = S.peds[i];
    if (ped.hp <= 0) { S.peds.splice(i, 1); continue; }
    ped.stateT -= dt;
    ped.shootCd -= dt;
    if (ped.kind === 'gang') {
      const d = dist(ped.x, ped.y, px, py);
      if (d < 420 && hasLineOfSight(S.city, ped.x, ped.y, px, py)) {
        ped.angle = angleTo(ped.x, ped.y, px, py);
        if (d > 260) {
          ped.speed = 95;
          const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt;
          const ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
          const moved = moveCircle(S, ped.x, ped.y, nx - ped.x, ny - ped.y, 11);
          ped.x = moved.x; ped.y = moved.y;
        } else {
          ped.speed = 0;
        }
        if (ped.shootCd <= 0) {
          ped.shootCd = 0.9 + S.rng() * 0.5;
          gangShoot(S, ped, px, py);
        }
      } else {
        wanderPed(S, ped, dt);
      }
    } else if (ped.state === 'flee') {
      const fl = Math.hypot(ped.fleeX, ped.fleeY) || 1;
      const nx = ped.x + (ped.fleeX / fl) * 135 * dt;
      const ny = ped.y + (ped.fleeY / fl) * 135 * dt;
      const moved = moveCircle(S, ped.x, ped.y, nx - ped.x, ny - ped.y, 11);
      ped.x = moved.x; ped.y = moved.y;
      ped.angle = Math.atan2(ped.fleeY, ped.fleeX);
      ped.speed = 135;
      if (ped.stateT <= 0) { ped.state = 'walk'; ped.target = null; }
    } else {
      wanderPed(S, ped, dt);
    }
    ped.walkPhase += dt * (ped.speed > 10 ? 9 : 2);
  }
}

// --- Foot police ------------------------------------------------------------------
function updateCops(S, dt) {
  const p = S.player;
  const px = p.car ? p.car.x : p.x, py = p.car ? p.car.y : p.y;
  for (let i = S.cops.length - 1; i >= 0; i--) {
    const cop = S.cops[i];
    if (cop.hp <= 0) { S.cops.splice(i, 1); continue; }
    if (S.wanted.level <= 0) {
      cop.leaveT = (cop.leaveT || 0) + dt;
      if (cop.leaveT > 3) { S.cops.splice(i, 1); continue; }
    } else {
      cop.leaveT = 0;
    }
    const d = dist(cop.x, cop.y, px, py);
    const a = angleTo(cop.x, cop.y, px, py);
    cop.angle += clamp(angleDiff(cop.angle, a), -4 * dt, 4 * dt);
    if (p.onFoot && d < 26) {
      // An arrest takes a hold of 1.2s — the player can still break away.
      cop.arrestT = (cop.arrestT || 0) + dt;
      if (cop.arrestT >= 1.2) { bustPlayer(S); return; }
    } else {
      cop.arrestT = Math.max(0, (cop.arrestT || 0) - dt);
      cop.speed = 210;
      const nx = cop.x + Math.cos(cop.angle) * cop.speed * dt;
      const ny = cop.y + Math.sin(cop.angle) * cop.speed * dt;
      const moved = moveCircle(S, cop.x, cop.y, nx - cop.x, ny - cop.y, 11);
      cop.x = moved.x; cop.y = moved.y;
    }
    cop.walkPhase += dt * 9;
  }
}

// --- Car-to-car contact --------------------------------------------------------------
function updateCarCollisions(S, dt) {
  void dt;
  const cars = S.cars;
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i], b = cars[j];
      const d = dist(a.x, a.y, b.x, b.y);
      const minD = 34;
      if (d >= minD || d === 0) continue;
      const nx = (b.x - a.x) / d, ny = (b.y - a.y) / d;
      const push = (minD - d) / 2;
      a.x -= nx * push; a.y -= ny * push;
      b.x += nx * push; b.y += ny * push;
      const rel = Math.abs(a.speed - b.speed);
      if (rel > 120) {
        a.speed *= 0.8; b.speed *= 0.8;
        if (a === S.player.car || b === S.player.car) { sfx.crash(); S.shake = Math.max(S.shake, 0.2); }
      }
    }
  }
}

// --- Wanted ----------------------------------------------------------------------
// Only commitCrime raises the level. It decays only after a quiet window
// (decayDelay) with no crime and no cop sighting; a sighting pushes the
// window out. That is what lets a player hide long enough to lose the law.
function updateWanted(S, dt) {
  const w = S.wanted;
  if (w.level <= 0) { stopSiren(); return; }
  if (S.time < w.decayAt) return;
  if (anyCopSeesPlayer(S)) { w.decayAt = S.time + 2; return; }
  w.heat = Math.max(0, w.heat - dt / WANTED.starDropTime);
  w.level = w.heat <= 0 ? 0 : Math.min(WANTED.maxStars, Math.ceil(w.heat));
  if (w.level <= 0) stopSiren();
}

// --- Damage ------------------------------------------------------------------------
function hurtPlayer(S, dmg) {
  const p = S.player;
  if (S.flags.wasted || S.flags.busted) return;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, dmg);
    p.armor -= absorbed;
    dmg -= absorbed;
  }
  if (dmg <= 0) { p.hurtT = 0; return; }
  p.hp -= dmg;
  p.hurtT = 0;
  S.shake = Math.max(S.shake, 0.2);
  if (p.hp <= 0) {
    p.hp = 0;
    S.flags.wasted = true;
    S.flags.wastedT = 0;
    p.cash = Math.max(0, p.cash - 200);
    sfx.busted();
    spawnBurst(S, p.x, p.y, '#ff595e', 18, 200);
    S.message = 'WASTED — the hospital patched you up, minus $200.';
    S.messageT = 4;
  }
}

function bustPlayer(S) {
  const p = S.player;
  if (S.flags.busted || S.flags.wasted) return;
  S.flags.busted = true;
  S.flags.bustedT = 0;
  p.cash = Math.max(0, p.cash - 200);
  S.wanted.level = 0; S.wanted.heat = 0; S.wanted.decayAt = 0;
  stopSiren();
  sfx.busted();
  S.message = 'BUSTED — the VBPD took their cut, $200.';
  S.messageT = 3;
}

function damagePed(S, ped, dmg, source) {
  if (!ped || ped.hp <= 0) return;
  ped.hp -= dmg;
  if (ped.hp <= 0) killPed(S, ped, source);
}

function killPed(S, ped, source) {
  void source;
  ped.hp = 0;
  spawnBurst(S, ped.x, ped.y, '#ff595e', 12, 170);
  const inPeds = S.peds.indexOf(ped);
  if (inPeds >= 0) S.peds.splice(inPeds, 1);
  const inCops = S.cops.indexOf(ped);
  if (inCops >= 0) S.cops.splice(inCops, 1);
  // Fallen gang members sometimes drop armor.
  if (ped.kind === 'gang' && S.rng() < 0.25) {
    S.pickups.push({ x: ped.x, y: ped.y, kind: 'armor' });
  }
  // Downing a cop is a crime; gang members are the job.
  if (ped.kind === 'cop') commitCrime(S, 1, 500);
  else if (ped.kind === 'civilian' && anyCopSeesPlayer(S)) commitCrime(S, 1, 400);
}

// --- Particles, floaters, tracers ----------------------------------------------------
function updateParticles(S, dt) {
  for (let i = S.particles.length - 1; i >= 0; i--) {
    const pt = S.particles[i];
    pt.x += pt.vx * dt; pt.y += pt.vy * dt;
    pt.vx *= (1 - 2.2 * dt); pt.vy *= (1 - 2.2 * dt);
    pt.life -= dt;
    if (pt.life <= 0) S.particles.splice(i, 1);
  }
  if (S.flash) {
    S.flash.life -= dt;
    if (S.flash.life <= 0) S.flash = null;
  }
}

function updateFloaters(S, dt) {
  for (let i = S.floaters.length - 1; i >= 0; i--) {
    const f = S.floaters[i];
    f.y -= 22 * dt;
    f.life -= dt;
    if (f.life <= 0) S.floaters.splice(i, 1);
  }
}

function updateTracers(S, dt) {
  for (let i = S.tracers.length - 1; i >= 0; i--) {
    S.tracers[i].life -= dt;
    if (S.tracers[i].life <= 0) S.tracers.splice(i, 1);
  }
}
