// Verde Bay simulation: the whole game loop in pure JS, no DOM.
// createGame builds a state, update steps it, and the renderer/HUD read it.
// The headless smoke test drives exactly these functions.

import { WORLD, PLAYER, VEHICLES, VEHICLE_COLORS, WANTED, TRAFFIC_COUNT, PED_COUNT, MAX_COPS, PACKAGE_REWARD } from './config.js';
import { generateCity, districtAt, isLand } from './city.js';
import { MISSIONS, beginStage } from './missions.js';
import { writeSave } from './save.js';
import { clamp, dist, turnToward, circleRectResolve, mulberry32, randInt, randRange, pick } from './util.js';
import { burst } from './effects.js';

/** Build one car. `owner`: 'player' | 'traffic' | 'parked' | 'cop'. */
export function makeCar(type, x, y, angle, color, owner) {
  const spec = VEHICLES[type] ?? VEHICLES.sedan;
  return {
    type,
    x, y, angle,
    speed: 0,
    color,
    owner,
    maxSpeed: spec.maxSpeed,
    accel: spec.accel,
    reverse: spec.reverse,
    turn: spec.turn,
    nitro: spec.nitroMax,
    nitroMax: spec.nitroMax,
    hp: 100,
    bustTimer: 0,
    length: 56,
    width: 34,
  };
}

/** A point on land, outside buildings and water, for spawning. */
function freePoint(rng, city) {
  for (let tries = 0; tries < 60; tries++) {
    const x = randRange(rng, 60, WORLD.width - 60);
    const y = randRange(rng, 60, WORLD.height - 60);
    if (!isLand(x, y)) continue;
    if (pointInBuilding(city, x, y, 30)) continue;
    return { x, y };
  }
  return { x: 1100, y: 800 };
}

export function pointInBuilding(city, x, y, pad = 0) {
  for (const b of city.buildings) {
    if (x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.d + pad) return true;
  }
  return false;
}

/** Resolve a circle against every building; returns true on any hit. */
function collideBuildings(city, p, r) {
  let hit = false;
  for (const b of city.buildings) {
    if (circleRectResolve(p, r, b)) hit = true;
  }
  return hit;
}

/** Road grid lines the traffic follows (vertical x, horizontal y). */
const V_LINES = [200, 400, 600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 3000, 3200];
const H_LINES = [200, 400, 600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 800, 1000, 1200, 1400];

function spawnTrafficCar(rng, city) {
  const vertical = rng() < 0.5;
  const type = pick(rng, ['sedan', 'sedan', 'taxi', 'sport', 'truck']);
  let car;
  if (vertical) {
    const x = pick(rng, V_LINES);
    const y = randRange(rng, 100, WORLD.height - 100);
    car = makeCar(type, x, y, rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2, pick(rng, VEHICLE_COLORS), 'traffic');
    car.axis = 'y';
    car.line = x;
  } else {
    const y = pick(rng, H_LINES);
    const x = randRange(rng, 100, WORLD.width - 100);
    car = makeCar(type, x, y, rng() < 0.5 ? 0 : Math.PI, pick(rng, VEHICLE_COLORS), 'traffic');
    car.axis = 'x';
    car.line = y;
  }
  car.dir = rng() < 0.5 ? 1 : -1;
  car.cruise = randRange(rng, 60, 100);
  if (!isLand(car.x, car.y) || pointInBuilding(city, car.x, car.y, 10)) {
    const p = freePoint(rng, city);
    car.x = p.x;
    car.y = p.y;
  }
  return car;
}

function spawnPed(rng, city) {
  const p = freePoint(rng, city);
  return {
    x: p.x, y: p.y,
    angle: randRange(rng, 0, Math.PI * 2),
    speed: randRange(rng, 30, 55),
    color: pick(rng, ['#e63946', '#f4a261', '#2a9d8f', '#e9c46a', '#9b5de5', '#f15bb5', '#00bbf9', '#fee440']),
    tx: p.x, ty: p.y,
    wait: 0,
  };
}

/** Create a fresh game state for a seed. */
export function createGame(seed = 1) {
  const rng = mulberry32(seed * 7919 + 13);
  const city = generateCity(seed);
  const S = {
    seed,
    time: 0,
    rng,
    city,
    player: {
      x: 950, y: 1150, angle: -Math.PI / 2,
      speed: 0, onFoot: true, car: null,
      cash: 0, hp: PLAYER.hp, lastHurt: -99,
    },
    cars: [],
    peds: [],
    cops: [],
    gang: [],
    wanted: { level: 0, heat: 0, lastCrime: -99 },
    mission: { active: false, index: 0, stage: 0, data: {}, grabTimer: 0, text: '', title: '' },
    stats: { missionsDone: 0, packagesFound: 0, shotsFired: 0, carsStolen: 0, missionAttempts: 0 },
    flags: { menu: true, started: false, paused: false, busted: false, wasted: false },
    input: { keys: new Set(), justPressed: new Set() },
    events: [],
    shootCooldown: 0,
    packages: city.packages,
  };

  // Parked cars: a few near the garage, the rest spread over the map.
  const parkedSpots = [
    [900, 1180], [1010, 1180], [1200, 820], [350, 950], [2050, 1620],
    [1250, 1700], [2200, 1900], [3100, 1250], [1200, 250], [2300, 900],
    [1500, 620], [700, 300], [1650, 1050], [3300, 900],
  ];
  for (const [x, y] of parkedSpots) {
    const type = pick(rng, ['sedan', 'sedan', 'sport', 'taxi', 'truck']);
    S.cars.push(makeCar(type, x, y, pick(rng, [0, Math.PI / 2, Math.PI, -Math.PI / 2]), pick(rng, VEHICLE_COLORS), 'parked'));
  }
  for (let i = 0; i < TRAFFIC_COUNT; i++) S.cars.push(spawnTrafficCar(rng, city));
  for (let i = 0; i < PED_COUNT; i++) S.peds.push(spawnPed(rng, city));
  return S;
}

/** Restore progress from a save object (see save.js). */
export function applySave(S, save) {
  if (!save) return;
  S.player.cash = save.cash ?? 0;
  S.stats.missionsDone = save.missionIndex ?? 0;
  S.mission.index = save.missionIndex ?? 0;
  S.stats.packagesFound = save.packagesFound ?? 0;
  if (Array.isArray(save.packages)) {
    save.packages.forEach((found, i) => {
      if (S.packages[i]) S.packages[i].found = !!found;
    });
  }
}

function commitCrime(S, heat) {
  S.wanted.heat = Math.min(400, S.wanted.heat + heat);
  S.wanted.lastCrime = S.time;
  updateWantedLevel(S);
}

function updateWantedLevel(S) {
  let level = 0;
  for (let i = 0; i < WANTED.thresholds.length; i++) {
    if (S.wanted.heat >= WANTED.thresholds[i]) level = i + 1;
  }
  S.wanted.level = level;
}

function advanceStage(S) {
  const def = MISSIONS[S.mission.index];
  S.mission.stage += 1;
  if (S.mission.stage >= def.stages.length) {
    completeMission(S);
  } else {
    beginStage(S);
  }
}

function completeMission(S) {
  const def = MISSIONS[S.mission.index];
  S.player.cash += def.reward;
  S.stats.missionsDone += 1;
  S.mission.active = false;
  S.mission.index += 1;
  S.mission.stage = 0;
  S.mission.data = {};
  S.events.push({ type: 'missionComplete', title: def.title, reward: def.reward });
  burst(S.player.x, S.player.y, 30, { color: '#ffd60a', count: 40, speed: 160 });
  writeSave(S);
}

function checkStage(S, dt) {
  if (!S.mission.active) return;
  const def = MISSIONS[S.mission.index];
  const stage = def.stages[S.mission.stage];
  if (!stage) return;
  const p = S.player;
  const place = stage.target ? S.city.places[stage.target] : null;
  const d = place ? dist(p.x, p.y, place.x, place.y) : Infinity;

  if (stage.type === 'goto' || stage.type === 'pickup' || stage.type === 'deliver' || stage.type === 'driveTo') {
    if (d < 90) advanceStage(S);
  } else if (stage.type === 'grab') {
    if (d < 70) {
      S.mission.grabTimer += dt;
      if (S.mission.grabTimer >= 1.5) advanceStage(S);
    } else {
      S.mission.grabTimer = 0;
    }
  } else if (stage.type === 'steal') {
    const garage = S.city.places.garage;
    if (p.car === S.mission.data.targetCar && dist(p.x, p.y, garage.x, garage.y) < 90) advanceStage(S);
  } else if (stage.type === 'eliminate') {
    const gang = S.mission.data.gang || [];
    if (gang.length > 0 && gang.every((g) => g.hp <= 0)) advanceStage(S);
  } else if (stage.type === 'escape') {
    if (d < 110 && S.wanted.level === 0) advanceStage(S);
  } else if (stage.type === 'escapeArea') {
    if (d > 250) advanceStage(S);
  }
}

function enterExitCar(S) {
  const p = S.player;
  if (p.onFoot) {
    let best = null;
    let bestD = 55;
    for (const car of [...S.cars, ...S.cops]) {
      const d = dist(p.x, p.y, car.x, car.y);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    if (best) {
      const wasParked = best.owner === 'parked' || best.owner === 'traffic';
      p.car = best;
      p.onFoot = false;
      p.x = best.x;
      p.y = best.y;
      p.angle = best.angle;
      if (wasParked) {
        best.owner = 'player';
        S.stats.carsStolen += 1;
        // Stealing in front of a cop is a crime; unnoticed, it is free.
        if (S.cops.some((c) => dist(p.x, p.y, c.x, c.y) < 250)) commitCrime(S, 25);
        S.events.push({ type: 'steal' });
      }
    }
  } else if (p.car) {
    const car = p.car;
    car.owner = 'parked';
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
    p.angle = car.angle;
    p.speed = 0;
    p.car = null;
    p.onFoot = true;
  }
}

function shoot(S) {
  const p = S.player;
  if (!p.onFoot || S.shootCooldown > 0) return;
  S.shootCooldown = 0.25;
  S.stats.shotsFired += 1;
  const range = 340;
  let best = null;
  let bestD = range;
  for (const target of [...S.cops, ...S.gang]) {
    const d = dist(p.x, p.y, target.x, target.y);
    if (d >= bestD) continue;
    const ang = Math.atan2(target.y - p.y, target.x - p.x);
    let diff = Math.abs(ang - p.angle) % (Math.PI * 2);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    if (diff > 0.6) continue;
    bestD = d;
    best = target;
  }
  const mx = p.x + Math.cos(p.angle) * 26;
  const my = p.y + Math.sin(p.angle) * 26;
  burst(mx, my, 24, { color: '#ffd60a', count: 8, speed: 120 });
  S.events.push({ type: 'shot', x: mx, y: my });
  if (best) {
    best.hp -= 34;
    burst(best.x, best.y, 24, { color: '#ff3b30', count: 10, speed: 90 });
    if (best.hp <= 0) {
      if (S.cops.includes(best)) {
        S.cops.splice(S.cops.indexOf(best), 1);
        commitCrime(S, 30);
        burst(best.x, best.y, 30, { color: '#ff6b35', count: 30, speed: 200 });
        S.events.push({ type: 'copDown' });
      }
    }
  }
}

function updatePlayer(S, dt) {
  const p = S.player;
  const keys = S.input.keys;
  S.shootCooldown = Math.max(0, S.shootCooldown - dt);

  if (keys.has('KeyE') && S.input.justPressed.has('KeyE')) enterExitCar(S);
  if ((keys.has('Space') && S.input.justPressed.has('Space')) || S.input.justPressed.has('Mouse0')) shoot(S);

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
      const speed = run ? PLAYER.runSpeed : PLAYER.walkSpeed;
      const nx = p.x + (mx / len) * speed * dt;
      const ny = p.y + (my / len) * speed * dt;
      p.angle = Math.atan2(my, mx);
      const oldX = p.x;
      const oldY = p.y;
      p.x = nx;
      p.y = ny;
      if (!isLand(p.x, p.y) || collideBuildings(S.city, p, PLAYER.radius)) {
        p.x = oldX;
        p.y = oldY;
      }
      p.x = clamp(p.x, 20, WORLD.width - 20);
      p.y = clamp(p.y, 20, WORLD.height - 20);
    }
    p.speed = 0;
  } else if (p.car) {
    const car = p.car;
    const boosting = (keys.has('ShiftLeft') || keys.has('ShiftRight')) && car.nitro > 0;
    const top = boosting ? car.maxSpeed * 1.55 : car.maxSpeed;
    const accel = boosting ? car.accel * 1.8 : car.accel;
    if (boosting) {
      car.nitro = Math.max(0, car.nitro - 40 * dt);
      if (Math.random() < 0.5) {
        burst(car.x - Math.cos(car.angle) * 30, car.y - Math.sin(car.angle) * 30, 14, { color: '#00e5ff', count: 2, speed: 60 });
      }
    } else {
      car.nitro = Math.min(car.nitroMax, car.nitro + 12 * dt);
    }
    if (keys.has('KeyW') || keys.has('ArrowUp')) {
      car.speed = Math.min(top, car.speed + accel * dt);
    } else if (keys.has('KeyS') || keys.has('ArrowDown')) {
      if (car.speed > 5) car.speed = Math.max(0, car.speed - accel * 1.6 * dt);
      else car.speed = Math.max(-car.reverse, car.speed - accel * 0.7 * dt);
    } else {
      car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 220 * dt);
      if (Math.abs(car.speed) < 2) car.speed = 0;
    }
    if (keys.has('Space')) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 500 * dt);
    let steer = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) steer -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) steer += 1;
    if (steer !== 0 && Math.abs(car.speed) > 5) {
      car.angle += steer * car.turn * dt * clamp(car.speed / 120, -1, 1);
    }
    const oldX = car.x;
    const oldY = car.y;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // Collide the nose and the tail against buildings.
    const fx = car.x + Math.cos(car.angle) * 20;
    const fy = car.y + Math.sin(car.angle) * 20;
    const bx = car.x - Math.cos(car.angle) * 20;
    const by = car.y - Math.sin(car.angle) * 20;
    const probe = { x: fx, y: fy };
    const probe2 = { x: bx, y: by };
    if (collideBuildings(S.city, probe, 15) || collideBuildings(S.city, probe2, 15) || !isLand(car.x, car.y)) {
      car.x = oldX;
      car.y = oldY;
      car.speed *= 0.35;
    }
    car.x = clamp(car.x, 24, WORLD.width - 24);
    car.y = clamp(car.y, 24, WORLD.height - 24);
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    p.speed = car.speed;
  }
}

function updateTraffic(S, dt) {
  for (const car of S.cars) {
    if (car.owner !== 'traffic') continue;
    car.speed = car.cruise;
    let nx = car.x;
    let ny = car.y;
    if (car.axis === 'x') {
      nx += car.dir * car.speed * dt;
      car.angle = car.dir > 0 ? 0 : Math.PI;
    } else {
      ny += car.dir * car.speed * dt;
      car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    // Water or the map edge: turn around.
    if (!isLand(nx, ny) || nx < 30 || nx > WORLD.width - 30 || ny < 30 || ny > WORLD.height - 30) {
      car.dir *= -1;
      continue;
    }
    car.x = nx;
    car.y = ny;
    // At an intersection, sometimes turn onto the crossing road.
    const onV = Math.abs(car.x % 200) < 3;
    const onH = Math.abs(car.y % 200) < 3;
    if (car.axis === 'x' && onV && S.rng() < 0.02) {
      car.axis = 'y';
      car.line = car.x;
      car.dir = S.rng() < 0.5 ? 1 : -1;
    } else if (car.axis === 'y' && onH && S.rng() < 0.02) {
      car.axis = 'x';
      car.line = car.y;
      car.dir = S.rng() < 0.5 ? 1 : -1;
    }
    // Stay glued to the road line.
    if (car.axis === 'x') car.y = car.line;
    else car.x = car.line;
  }
}

function updatePeds(S, dt) {
  for (const ped of S.peds) {
    if (ped.wait > 0) {
      ped.wait -= dt;
      continue;
    }
    const d = dist(ped.x, ped.y, ped.tx, ped.ty);
    if (d < 8) {
      const target = freePoint(S.rng, S.city);
      ped.tx = target.x;
      ped.ty = target.y;
      if (S.rng() < 0.25) ped.wait = randRange(S.rng, 0.5, 2);
      continue;
    }
    const ang = Math.atan2(ped.ty - ped.y, ped.tx - ped.x);
    ped.angle = ang;
    const nx = ped.x + Math.cos(ang) * ped.speed * dt;
    const ny = ped.y + Math.sin(ang) * ped.speed * dt;
    if (!isLand(nx, ny) || pointInBuilding(S.city, nx, ny, 6)) {
      const target = freePoint(S.rng, S.city);
      ped.tx = target.x;
      ped.ty = target.y;
      continue;
    }
    ped.x = nx;
    ped.y = ny;
  }
}

function updateWanted(S, dt) {
  if (S.time - S.wanted.lastCrime > 8) {
    S.wanted.heat = Math.max(0, S.wanted.heat - WANTED.decayPerSecond * dt);
    updateWantedLevel(S);
  }
  const want = Math.min(S.wanted.level + 1, MAX_COPS);
  // Spawn cops up to the wanted count, at road points away from the player.
  let tries = 0;
  while (S.cops.length < want && S.wanted.level > 0 && tries < 8) {
    tries += 1;
    const a = S.rng() * Math.PI * 2;
    const x = clamp(S.player.x + Math.cos(a) * 520, 40, WORLD.width - 40);
    const y = clamp(S.player.y + Math.sin(a) * 520, 40, WORLD.height - 40);
    if (!isLand(x, y)) continue;
    const cop = makeCar('sedan', x, y, a, '#1a1a2e', 'cop');
    cop.isCop = true;
    cop.hp = 100;
    S.cops.push(cop);
  }
  // Cops leave when the heat is gone.
  if (S.wanted.level === 0) {
    S.cops = S.cops.filter((c) => dist(c.x, c.y, S.player.x, S.player.y) < 900);
  }
  for (const cop of S.cops) {
    const p = S.player;
    const d = dist(cop.x, cop.y, p.x, p.y);
    const ang = Math.atan2(p.y - cop.y, p.x - cop.x);
    cop.angle = turnToward(cop.angle, ang, 2.8 * dt);
    const speed = Math.min(WANTED.copSpeed + S.wanted.level * 8, d * 1.4 + 60);
    const oldX = cop.x;
    const oldY = cop.y;
    cop.x += Math.cos(cop.angle) * speed * dt;
    cop.y += Math.sin(cop.angle) * speed * dt;
    const probe = { x: cop.x, y: cop.y };
    if (collideBuildings(S.city, probe, 15) || !isLand(cop.x, cop.y)) {
      cop.x = oldX;
      cop.y = oldY;
      cop.angle += 0.9 * dt;
    }
    cop.speed = speed;
    if (p.onFoot && d < WANTED.copCatchRadius) {
      cop.bustTimer += dt;
      if (cop.bustTimer > 1) {
        // Busted: fine, wanted cleared, dropped at the police station.
        S.player.cash = Math.max(0, S.player.cash - WANTED.bustFine);
        S.wanted.heat = 0;
        updateWantedLevel(S);
        S.cops.length = 0;
        const station = S.city.places.police;
        S.player.x = station.x;
        S.player.y = station.y;
        S.events.push({ type: 'busted' });
        S.flags.busted = true;
      }
    } else {
      cop.bustTimer = 0;
    }
    if (!p.onFoot && d < 44) {
      // A ram: the cop shoves the player's car.
      p.car.speed *= 0.86;
      cop.speed *= 0.5;
    }
  }
}

function updateGang(S, dt) {
  const p = S.player;
  for (const g of S.gang) {
    if (g.hp <= 0) continue;
    const d = dist(g.x, g.y, p.x, p.y);
    g.angle = Math.atan2(p.y - g.y, p.x - g.x);
    if (d < 340 && d > 40) {
      g.shootTimer -= dt;
      if (g.shootTimer <= 0) {
        g.shootTimer = 0.9;
        if (S.rng() < 0.6) {
          p.hp -= 5;
          p.lastHurt = S.time;
          burst(p.x, p.y, 24, { color: '#ff3b30', count: 4, speed: 70 });
          if (p.hp <= 0) {
            // Wasted: fined, wanted cleared, wake up at the hospital.
            p.hp = PLAYER.hp;
            S.player.cash = Math.max(0, S.player.cash - WANTED.bustFine);
            S.wanted.heat = 0;
            updateWantedLevel(S);
            const hospital = S.city.places.hospital;
            p.x = hospital.x;
            p.y = hospital.y;
            if (p.car) {
              p.car.owner = 'parked';
              p.car = null;
              p.onFoot = true;
            }
            S.events.push({ type: 'wasted' });
            S.flags.wasted = true;
          }
        }
      }
    }
  }
  // Health comes back after a quiet stretch.
  if (S.time - p.lastHurt > 5 && p.hp < PLAYER.hp) {
    p.hp = Math.min(PLAYER.hp, p.hp + 5 * dt);
  }
}

function updatePackages(S) {
  const p = S.player;
  for (const pkg of S.packages) {
    if (pkg.found) continue;
    if (dist(p.x, p.y, pkg.x, pkg.y) < 42) {
      pkg.found = true;
      S.stats.packagesFound += 1;
      S.player.cash += PACKAGE_REWARD;
      burst(pkg.x, pkg.y, 20, { color: '#ffd60a', count: 24, speed: 120 });
      S.events.push({ type: 'package', x: pkg.x, y: pkg.y });
    }
  }
}

/** Step the whole game by `dt` seconds. */
export function update(S, dt) {
  if (!S.flags.started || S.flags.paused) {
    S.input.justPressed.clear();
    return;
  }
  S.time += dt;
  updatePlayer(S, dt);
  updateTraffic(S, dt);
  updatePeds(S, dt);
  updateWanted(S, dt);
  updateGang(S, dt);
  updatePackages(S);
  checkStage(S, dt);
  S.input.justPressed.clear();
}
