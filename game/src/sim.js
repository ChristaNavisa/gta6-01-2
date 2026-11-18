// The simulation: everything the game is, without any DOM or WebGL. The
// browser modules (main.js, render3d.js, hud.js) read this state and draw
// it; the headless smoke test drives it directly through createGame/update.

import { CONFIG } from './config.js';
import { generateCity, isWater, districtAt } from './city.js';
import { MISSIONS, startMission, nextStage, stagePlace } from './missions.js';
import { clamp, dist, dist2, angleTo, angleDiff, turnToward, lerp, mulberry32, randInt, randRange, pick, TAU } from './util.js';

let carSeq = 0;

/** Make a car object. Owner: 'player' | 'traffic' | 'parked' | 'cop' | 'target'. */
export function makeCar(type, x, y, angle, color, owner) {
  carSeq += 1;
  const spec = CONFIG.cars[type] ?? CONFIG.cars.sedan;
  return {
    id: `car-${carSeq}`,
    type,
    x, y, angle,
    speed: 0,
    color,
    owner,
    driver: owner === 'cop' ? 'cop' : owner === 'player' ? 'player' : 'traffic',
    hp: 100,
    topSpeed: spec.topSpeed,
    accel: spec.accel,
    brake: spec.brake,
    turn: spec.turn,
  };
}

const CAR_COLORS = ['#2e5fa3', '#c1121f', '#e9c46a', '#6c757d', '#2a9d8f', '#f4a261', '#7b2cbf', '#adb5bd'];
const PED_COLORS = ['#e63946', '#457b9d', '#2a9d8f', '#e9c46a', '#6d6875', '#f4a261', '#90be6d'];

/** Create a fresh game state from a seed. Deterministic: same seed, same city. */
export function createGame(seed) {
  const rng = mulberry32(seed * 7919 + 13);
  const city = generateCity(seed);
  const S = {
    seed,
    rng,
    time: 0,
    city,
    player: {
      x: 1100, y: 1000, angle: -Math.PI / 2, aimAngle: -Math.PI / 2,
      speed: 0, health: CONFIG.player.health, cash: 0,
      onFoot: true, car: null, fireCooldown: 0,
    },
    cars: [],
    peds: [],
    cops: [],
    wanted: { level: 0, heat: 0 },
    mission: { active: false, index: 0, stage: 0, data: {}, timer: 0, holdTimer: 0 },
    stats: { missionsDone: 0, carsStolen: 0, shotsFired: 0, kills: 0 },
    flags: { menu: true, started: false, paused: false, shot: null },
    input: { keys: new Set(), justPressed: new Set(), mouse: { x: 0, y: 0, down: false } },
    events: [],
    particles: [],
    copSpawnTimer: 0,
    lastCrimeAt: -100,
    message: '',
    messageTimer: 0,
  };

  // Traffic: cars cruising the road network.
  for (let i = 0; i < CONFIG.traffic.count; i++) {
    const road = city.roads[Math.floor(rng() * city.roads.length)];
    const horizontal = road.y0 === road.y1;
    const x = horizontal ? randRange(rng, road.x0 + 40, road.x1 - 40) : road.x0;
    const y = horizontal ? road.y0 : randRange(rng, road.y0 + 40, road.y1 - 40);
    const car = makeCar(pick(rng, ['sedan', 'sedan', 'taxi', 'truck']), x, y, horizontal ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2), pick(rng, CAR_COLORS), 'traffic');
    car.driver = 'traffic';
    car.road = road;
    car.cruise = randRange(rng, 180, 280);
    S.cars.push(car);
  }

  // Parked cars near the garage and the plaza for the player to take.
  const parkedSpots = [
    [960, 860, '#2e5fa3'], [1040, 860, '#c1121f'], [960, 940, '#e9c46a'],
    [1140, 960, '#2a9d8f'], [1060, 1080, '#6c757d'], [900, 1040, '#7b2cbf'],
  ];
  for (const [x, y, color] of parkedSpots) {
    const car = makeCar('sedan', x, y, randRange(rng, 0, TAU), color, 'parked');
    car.driver = 'parked';
    S.cars.push(car);
  }

  // Pedestrians wandering the sidewalks.
  for (let i = 0; i < CONFIG.peds.count; i++) {
    const road = city.roads[Math.floor(rng() * city.roads.length)];
    const horizontal = road.y0 === road.y1;
    const x = horizontal ? randRange(rng, road.x0, road.x1) : road.x0 + (rng() < 0.5 ? -34 : 34);
    const y = horizontal ? road.y0 + (rng() < 0.5 ? -34 : 34) : randRange(rng, road.y0, road.y1);
    S.peds.push({
      x, y, angle: randRange(rng, 0, TAU), speed: randRange(rng, 40, 70),
      color: pick(rng, PED_COLORS), tx: x, ty: y, wait: 0,
    });
  }

  return S;
}

/** Restore progress from a save object (see save.js). */
export function applySave(S, save) {
  if (!save) return;
  S.stats.missionsDone = save.missionIndex ?? 0;
  S.mission.index = S.stats.missionsDone;
  S.player.cash = save.cash ?? 0;
  if (typeof save.x === 'number' && typeof save.y === 'number') {
    S.player.x = save.x;
    S.player.y = save.y;
  }
}

/** Raise the wanted level and reset the heat clock. */
export function commitCrime(S, level) {
  S.wanted.level = Math.max(S.wanted.level, Math.min(level, CONFIG.wanted.maxLevel));
  S.wanted.heat = 100;
  S.lastCrimeAt = S.time;
}

function pushOutOfBuildings(S, obj, radius) {
  for (const b of S.city.buildings) {
    const hw = b.w / 2 + radius;
    const hd = b.d / 2 + radius;
    const dx = obj.x - b.x;
    const dy = obj.y - b.y;
    if (Math.abs(dx) < hw && Math.abs(dy) < hd) {
      const px = hw - Math.abs(dx);
      const py = hd - Math.abs(dy);
      if (px < py) obj.x += dx >= 0 ? px : -px;
      else obj.y += dy >= 0 ? py : -py;
      return true;
    }
  }
  return false;
}

function spawnParticle(S, kind, x, y, z, count, color) {
  for (let i = 0; i < count; i++) {
    S.particles.push({
      kind, x, y, z,
      vx: (S.rng() - 0.5) * 60,
      vy: (S.rng() - 0.5) * 60,
      vz: S.rng() * 40 + 10,
      life: 0,
      maxLife: 0.5 + S.rng() * 0.7,
      size: 6 + S.rng() * 10,
      color,
    });
  }
  if (S.particles.length > 400) S.particles.splice(0, S.particles.length - 400);
}

function tryEnterCar(S) {
  const p = S.player;
  if (!p.onFoot) {
    // Get out: leave the car parked where it is.
    p.car.driver = 'parked';
    p.car = null;
    p.onFoot = true;
    p.x += Math.cos(p.angle + Math.PI / 2) * 30;
    p.y += Math.sin(p.angle + Math.PI / 2) * 30;
    return;
  }
  let best = null;
  let bestD = 70 * 70;
  for (const car of S.cars) {
    const d = dist2(p.x, p.y, car.x, car.y);
    if (d < bestD) { best = car; bestD = d; }
  }
  if (!best) return;
  const isTarget = S.mission.active
    && MISSIONS[S.mission.index].stages[S.mission.stage].type === 'steal'
    && S.mission.data.targetCar === best;
  p.car = best;
  p.onFoot = false;
  best.driver = 'player';
  p.x = best.x;
  p.y = best.y;
  if (!isTarget) {
    commitCrime(S, 1);
    S.stats.carsStolen += 1;
    S.events.push('You stole a car — wanted level 1!');
  } else {
    S.events.push('Getaway car secured — go!');
  }
}

function firePistol(S) {
  const p = S.player;
  if (p.fireCooldown > 0 || !p.onFoot) return;
  p.fireCooldown = CONFIG.player.fireCooldown;
  S.stats.shotsFired += 1;
  const aim = p.aimAngle;
  const range = CONFIG.player.pistolRange;
  let best = null;
  let bestD = range * range;
  const targets = [];
  if (S.mission.active && S.mission.data.gang) {
    for (const g of S.mission.data.gang) if (g.hp > 0) targets.push(g);
  }
  for (const c of S.cops) targets.push(c);
  for (const t of targets) {
    const d = dist2(p.x, p.y, t.x, t.y);
    if (d > bestD) continue;
    const a = angleTo(p.x, p.y, t.x, t.y);
    if (Math.abs(angleDiff(aim, a)) > 0.35) continue;
    best = t;
    bestD = d;
  }
  spawnParticle(S, 'spark', p.x + Math.cos(aim) * 24, p.y + Math.sin(aim) * 24, 14, 3, '#ffd166');
  if (best) {
    best.hp -= CONFIG.player.pistolDamage;
    spawnParticle(S, 'spark', best.x, best.y, 14, 6, '#ff595e');
    if (best.hp <= 0) {
      S.stats.kills += 1;
      S.events.push('Target down.');
      if (S.cops.includes(best)) {
        S.cops.splice(S.cops.indexOf(best), 1);
        commitCrime(S, Math.min(S.wanted.level + 1, CONFIG.wanted.maxLevel));
      }
    }
  }
}

// ---------------------------------------------------------------- update

function updatePlayer(S, dt) {
  const p = S.player;
  const keys = S.input.keys;
  p.fireCooldown = Math.max(0, p.fireCooldown - dt);
  const prevX = p.x;
  const prevY = p.y;

  if (p.onFoot) {
    let mx = 0;
    let my = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) my -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) my += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
    if (mx !== 0 || my !== 0) {
      const len = Math.hypot(mx, my);
      const run = keys.has('ShiftLeft') || keys.has('ShiftRight');
      const speed = run ? CONFIG.player.runSpeed : CONFIG.player.walkSpeed;
      p.x += (mx / len) * speed * dt;
      p.y += (my / len) * speed * dt;
      p.angle = Math.atan2(my, mx);
      p.speed = speed;
    } else {
      p.speed = 0;
    }
    p.aimAngle = p.angle;
    if (S.input.mouse) {
      // Aim follows the mouse when it has moved away from the player.
      const m = S.input.mouse;
      if (m.screenDx !== undefined && Math.hypot(m.screenDx, m.screenDy) > 40) {
        p.aimAngle = Math.atan2(m.screenDy, m.screenDx);
      }
    }
    if ((S.input.mouse && S.input.mouse.down) || keys.has('Space')) firePistol(S);
  } else if (p.car) {
    const car = p.car;
    const spec = CONFIG.cars[car.type] ?? CONFIG.cars.sedan;
    const forward = keys.has('KeyW') || keys.has('ArrowUp');
    const back = keys.has('KeyS') || keys.has('ArrowDown');
    if (forward) car.speed += spec.accel * dt;
    else if (back) car.speed -= (car.speed > 0 ? spec.brake : spec.accel * 0.6) * dt;
    else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 240 * dt);
    car.speed = clamp(car.speed, -160, spec.topSpeed);
    const steer = (keys.has('KeyA') || keys.has('ArrowLeft') ? -1 : 0)
      + (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0);
    if (steer !== 0 && Math.abs(car.speed) > 20) {
      car.angle += steer * spec.turn * (car.speed / spec.topSpeed) * dt * (car.speed >= 0 ? 1 : -1);
    }
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    p.speed = car.speed;
    if (Math.abs(car.speed) > 380 && S.rng() < 0.35) {
      spawnParticle(S, 'dust', car.x - Math.cos(car.angle) * 22, car.y - Math.sin(car.angle) * 22, 2, 1, '#c9b8a3');
    }
    if (car.hp < 40 && S.rng() < 0.3) {
      spawnParticle(S, 'smoke', car.x, car.y, 16, 1, '#555555');
    }
  }

  if (pushOutOfBuildings(S, p, CONFIG.player.radius)) {
    if (p.car) p.car.speed *= 0.4;
  }
  if (isWater(p.x, p.y)) {
    p.x = prevX;
    p.y = prevY;
    if (p.car) {
      p.car.x = prevX;
      p.car.y = prevY;
      p.car.speed *= 0.3;
    }
  }
  p.x = clamp(p.x, 10, CONFIG.world.w - 10);
  p.y = clamp(p.y, 10, CONFIG.world.h - 10);
}

function updateTraffic(S, dt) {
  for (const car of S.cars) {
    if (car.driver !== 'traffic') continue;
    const road = car.road ?? S.city.roads[0];
    const horizontal = road.y0 === road.y1;
    const targetX = horizontal ? (Math.cos(car.angle) >= 0 ? road.x1 - 20 : road.x0 + 20) : road.x0;
    const targetY = horizontal ? road.y0 : (Math.sin(car.angle) >= 0 ? road.y1 - 20 : road.y0 + 20);
    const want = angleTo(car.x, car.y, targetX, targetY);
    car.angle = turnToward(car.angle, want, 1.6 * dt);
    car.speed = lerp(car.speed, car.cruise, Math.min(1, 2 * dt));
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    if (dist(car.x, car.y, targetX, targetY) < 30) {
      // Reached the end of the street: pick a road whose end is nearby.
      const near = S.city.roads.filter((r) => {
        const d1 = Math.min(dist(car.x, car.y, r.x0, r.y0), dist(car.x, car.y, r.x1, r.y1));
        return d1 < 260;
      });
      car.road = near.length > 0
        ? near[Math.floor(S.rng() * near.length)]
        : S.city.roads[Math.floor(S.rng() * S.city.roads.length)];
    }
    pushOutOfBuildings(S, car, 16);
  }
}

function updatePeds(S, dt) {
  for (const ped of S.peds) {
    if (ped.wait > 0) {
      ped.wait -= dt;
      continue;
    }
    const d = dist(ped.x, ped.y, ped.tx, ped.ty);
    if (d < 12) {
      const road = S.city.roads[Math.floor(S.rng() * S.city.roads.length)];
      const horizontal = road.y0 === road.y1;
      ped.tx = horizontal ? randRange(S.rng, road.x0 + 20, road.x1 - 20) : road.x0 + (S.rng() < 0.5 ? -34 : 34);
      ped.ty = horizontal ? road.y0 + (S.rng() < 0.5 ? -34 : 34) : randRange(S.rng, road.y0 + 20, road.y1 - 20);
      ped.wait = S.rng() * 2;
      continue;
    }
    ped.angle = angleTo(ped.x, ped.y, ped.tx, ped.ty);
    ped.x += Math.cos(ped.angle) * ped.speed * dt;
    ped.y += Math.sin(ped.angle) * ped.speed * dt;
    if (isWater(ped.x, ped.y)) {
      ped.x -= Math.cos(ped.angle) * ped.speed * dt;
      ped.y -= Math.sin(ped.angle) * ped.speed * dt;
      ped.tx = ped.x;
      ped.ty = ped.y;
    }
  }
}

function updateCops(S, dt) {
  const p = S.player;
  if (S.wanted.level > 0) {
    S.copSpawnTimer += dt;
    const want = Math.min(S.wanted.level + 1, 5);
    if (S.cops.length < want && S.copSpawnTimer > CONFIG.wanted.copSpawnInterval) {
      S.copSpawnTimer = 0;
      const a = S.rng() * TAU;
      const cx = clamp(p.x + Math.cos(a) * 420, 20, CONFIG.world.w - 20);
      const cy = clamp(p.y + Math.sin(a) * 420, 20, CONFIG.world.h - 20);
      const cop = makeCar('cop', cx, cy, angleTo(cx, cy, p.x, p.y), '#1b263b', 'cop');
      cop.driver = 'cop';
      cop.hp = 100;
      cop.bustTimer = 0;
      S.cops.push(cop);
      S.cars.push(cop);
      S.events.push('Police on your tail!');
    }
  }
  for (const cop of [...S.cops]) {
    const spec = CONFIG.cars.cop;
    const want = angleTo(cop.x, cop.y, p.x, p.y);
    cop.angle = turnToward(cop.angle, want, spec.turn * dt);
    cop.speed = lerp(cop.speed, spec.topSpeed * 0.92, Math.min(1, 2 * dt));
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
    pushOutOfBuildings(S, cop, 16);
    const d = dist(cop.x, cop.y, p.x, p.y);
    if (d < CONFIG.wanted.bustDistance) {
      cop.bustTimer += dt;
      if (cop.bustTimer >= CONFIG.wanted.bustHoldSeconds) {
        // Busted: heat gone, a fine, the cops leave. The mission goes on.
        S.wanted.level = 0;
        S.wanted.heat = 0;
        p.cash = Math.max(0, p.cash - CONFIG.wanted.bustFine);
        S.cops.length = 0;
        S.cars = S.cars.filter((c) => c.owner !== 'cop');
        S.events.push(`Busted! Fine $${CONFIG.wanted.bustFine} — the heat is off.`);
        return;
      }
    } else {
      cop.bustTimer = Math.max(0, cop.bustTimer - dt);
    }
  }
  if (S.wanted.level === 0 && S.cops.length > 0) {
    // Heat off: the cops drift away and despawn.
    S.cops.length = 0;
    S.cars = S.cars.filter((c) => c.owner !== 'cop');
  }
}

function updateGang(S, dt) {
  if (!S.mission.active || !S.mission.data.gang) return;
  const p = S.player;
  for (const g of S.mission.data.gang) {
    if (g.hp <= 0) continue;
    const d = dist(g.x, g.y, p.x, p.y);
    if (d > 60 && d < 400) {
      g.angle = angleTo(g.x, g.y, p.x, p.y);
      g.x += Math.cos(g.angle) * g.speed * dt;
      g.y += Math.sin(g.angle) * g.speed * dt;
    }
    g.shootTimer -= dt;
    if (g.shootTimer <= 0 && d < 280) {
      g.shootTimer = 1.4 + S.rng() * 0.8;
      p.health -= 6;
      spawnParticle(S, 'spark', p.x, p.y, 14, 2, '#ff595e');
      if (p.health <= 0) {
        p.health = CONFIG.player.health;
        p.x = S.city.places.stadium.x;
        p.y = S.city.places.stadium.y;
        if (p.car) { p.car.driver = 'parked'; p.car = null; p.onFoot = true; }
        S.events.push('You were taken down — waking up at the stadium.');
      }
    }
  }
}

function updateWanted(S, dt) {
  if (S.wanted.level === 0) return;
  if (S.time - S.lastCrimeAt < 8) return; // fresh crime keeps the heat up
  S.wanted.heat -= CONFIG.wanted.decayPerSecond * dt;
  if (S.wanted.heat <= 0) {
    S.wanted.level -= 1;
    S.wanted.heat = S.wanted.level > 0 ? 45 : 0;
    if (S.wanted.level === 0) S.events.push('The heat is off.');
  }
}

function updateMission(S, dt) {
  if (!S.mission.active) return;
  const def = MISSIONS[S.mission.index];
  const stage = def.stages[S.mission.stage];
  const place = stagePlace(S, stage);
  const p = S.player;
  const R = CONFIG.mission.targetRadius;
  switch (stage.type) {
    case 'goto':
    case 'pickup':
    case 'deliver': {
      if (place && dist(p.x, p.y, place.x, place.y) < R) nextStage(S);
      break;
    }
    case 'driveTo': {
      if (p.car && place && dist(p.x, p.y, place.x, place.y) < R) nextStage(S);
      break;
    }
    case 'grab': {
      if (place && dist(p.x, p.y, place.x, place.y) < R) {
        S.mission.holdTimer += dt;
        if (S.rng() < 0.06) spawnParticle(S, 'dust', p.x, p.y, 4, 1, '#ffd166');
        if (S.mission.holdTimer >= (stage.hold ?? CONFIG.mission.grabHoldSeconds)) nextStage(S);
      } else {
        S.mission.holdTimer = Math.max(0, S.mission.holdTimer - dt);
      }
      break;
    }
    case 'steal': {
      const car = S.mission.data.targetCar;
      if (car && p.car === car && place && dist(p.x, p.y, place.x, place.y) < R) nextStage(S);
      break;
    }
    case 'eliminate': {
      const gang = S.mission.data.gang ?? [];
      if (gang.length > 0 && gang.every((g) => g.hp <= 0)) nextStage(S);
      break;
    }
    case 'escape': {
      if (S.wanted.level === 0 && place && dist(p.x, p.y, place.x, place.y) < R) nextStage(S);
      break;
    }
    case 'escapeArea': {
      if (place && dist(p.x, p.y, place.x, place.y) > CONFIG.mission.escapeRadius) nextStage(S);
      break;
    }
    default:
      break;
  }
}

/** Advance the whole simulation by dt seconds (dt is 1/60 in normal play). */
export function update(S, dt) {
  S.time += dt;
  if (S.flags.paused) return;
  if (!S.flags.started) {
    updateTraffic(S, dt);
    updatePeds(S, dt);
    return;
  }

  // One-shot keys.
  if (S.input.justPressed.has('KeyE')) tryEnterCar(S);
  if (S.input.justPressed.has('KeyM') && !S.mission.active && S.stats.missionsDone < MISSIONS.length) {
    startMission(S, S.stats.missionsDone);
  }
  S.input.justPressed.clear();

  updatePlayer(S, dt);
  updateTraffic(S, dt);
  updatePeds(S, dt);
  updateCops(S, dt);
  updateGang(S, dt);
  updateWanted(S, dt);
  updateMission(S, dt);

  // Particles age out.
  for (let i = S.particles.length - 1; i >= 0; i--) {
    const pt = S.particles[i];
    pt.life += dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.z += pt.vz * dt;
    pt.vz -= 60 * dt;
    if (pt.life >= pt.maxLife || pt.z < 0) S.particles.splice(i, 1);
  }

  // Banner message timer.
  if (S.messageTimer > 0) S.messageTimer -= dt;
  while (S.events.length > 0) {
    S.message = S.events.shift();
    S.messageTimer = 4;
  }

  // Keep the player in the known world.
  if (S.player.health < 0) S.player.health = 0;
}

/** The district the player is standing in right now (for the HUD). */
export function playerDistrict(S) {
  return districtAt(S.player.x, S.player.y);
}
