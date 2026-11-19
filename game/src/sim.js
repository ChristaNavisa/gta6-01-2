// VERDE BAY 3D v7 — the simulation: driving, wanted police, combat, traffic, missions.
// Pure logic over the state S: no DOM, no THREE, safe to import from Node.
// The headless smoke test drives createGame / update / applySave / makeCar.

import { clamp, dist, dist2, angleTo, angleDiff, mulberry32, pick } from './util.js';
import { MAP, CAR_TYPES, NITRO, WEAPONS, WANTED, PLAYER, PLACES } from './config.js';
import { generateCity, districtAt } from './city.js';
import { MISSIONS, startMission, updateMission, commitCrime } from './missions.js';

let nextCarId = 1;

export function makeCar(type, x, y, angle, color, kind) {
  const def = CAR_TYPES[type] || CAR_TYPES.sedan;
  return {
    id: nextCarId++, type, x, y, angle, speed: 0,
    maxSpeed: def.maxSpeed, accel: def.accel,
    color: color || def.color, kind: kind || 'parked',
    nitro: NITRO.max, nitroMax: NITRO.max, health: 100,
  };
}

const HEAT_LEVEL = [0, 12, 35, 60, 80, 95];
function levelFromHeat(heat) {
  if (heat >= 95) return 5;
  if (heat >= 80) return 4;
  if (heat >= 60) return 3;
  if (heat >= 35) return 2;
  if (heat >= 12) return 1;
  return 0;
}

function addHeat(S, n) {
  S.wanted.heat = clamp(S.wanted.heat + n, 0, 100);
  S.wanted.level = levelFromHeat(S.wanted.heat);
  S.wanted.calmT = 0;
}

export function createGame(seed) {
  const city = generateCity(seed);
  const rng = mulberry32(seed * 7 + 3);
  const S = {
    seed, time: 0, rng,
    input: { keys: new Set(), justPressed: new Set(), mouseDown: false, aimAngle: 0 },
    flags: { menu: true, started: false, paused: false, busted: false, wasted: false },
    player: {
      x: PLACES.garage.x, y: PLACES.garage.y, angle: Math.PI / 2, aimAngle: Math.PI / 2,
      speed: 0, onFoot: true, car: null, cash: 0, health: PLAYER.health, armor: 0,
      weapon: 'pistol',
      weapons: {
        pistol: { owned: true, inMag: 12, reserve: 96 },
        smg: { owned: false, inMag: 0, reserve: 0 },
        shotgun: { owned: false, inMag: 0, reserve: 0 },
      },
      fireT: 0, reloadT: 0, hurtT: 0,
    },
    cars: [], cops: [], footCops: [], peds: [],
    heli: { active: false, x: 0, y: 0, angle: 0, height: 50, rotor: 0 },
    roadblocks: [],
    wanted: { level: 0, heat: 0, calmT: 0 },
    city,
    packages: city.packages,
    stats: { missionsDone: 0, packagesFound: 0, carsStolen: 0, shotsFired: 0, kills: 0, playTime: 0 },
    mission: { active: false, index: 0, stage: 0, data: {}, def: null },
    events: [],
    radio: { station: 0 },
    near: { shop: false, safehouse: false, car: null },
    cityIndex: new Map(),
    spawnCar: (type, x, y, angle, color, kind) => makeCar(type, x, y, angle, color, kind),
  };

  // Spatial index of buildings for cheap collision checks.
  for (const b of city.buildings) {
    const key = Math.floor(b.x / 200) + ',' + Math.floor(b.y / 200);
    if (!S.cityIndex.has(key)) S.cityIndex.set(key, []);
    S.cityIndex.get(key).push(b);
  }

  // Traffic: 22 cars cruising the avenues.
  const trafficTypes = ['sedan', 'sedan', 'taxi', 'truck', 'van', 'sport', 'sedan', 'taxi'];
  for (let i = 0; i < PLAYER.trafficCars; i++) {
    const horizontal = rng() < 0.5;
    const car = makeCar(pick(rng, trafficTypes), 0, 0, 0, pick(rng, ['#2e5fa3', '#d7263d', '#f4b400', '#6c757d', '#e9ecef', '#3a7d44', '#7b2fbe']), 'traffic');
    if (horizontal) {
      car.road = 'h';
      car.line = pick(rng, [300, 700, 1100, 1500, 1900]);
      car.x = 100 + rng() * 3200;
      car.y = car.line;
      car.dir = rng() < 0.5 ? 1 : -1;
      car.angle = car.dir > 0 ? 0 : Math.PI;
    } else {
      car.road = 'v';
      car.line = pick(rng, [300, 700, 1100, 1500, 1900, 2300]);
      car.x = car.line;
      car.y = 100 + rng() * 1900;
      car.dir = rng() < 0.5 ? 1 : -1;
      car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    car.speed = 90 + rng() * 50;
    car.targetSpeed = 100 + rng() * 40;
    S.cars.push(car);
  }

  // Parked cars near places and roads.
  for (let i = 0; i < PLAYER.parkedCars; i++) {
    const road = pick(rng, [300, 700, 1100, 1500, 1900]);
    const along = 120 + rng() * 3000;
    const car = makeCar(pick(rng, ['sedan', 'sport', 'van', 'taxi']), 0, 0, 0, pick(rng, ['#2e5fa3', '#d7263d', '#f4b400', '#e9ecef', '#3a7d44']), 'parked');
    if (rng() < 0.5) {
      car.x = along;
      car.y = road + (rng() < 0.5 ? 26 : -26);
      car.angle = rng() < 0.5 ? 0 : Math.PI;
    } else {
      car.x = road + (rng() < 0.5 ? 26 : -26);
      car.y = 120 + rng() * 1800;
      car.angle = rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    }
    if (districtAt(car.x, car.y) === 'water') continue;
    S.cars.push(car);
  }

  // Pedestrians wandering the sidewalks.
  for (let i = 0; i < PLAYER.pedestrians; i++) {
    const x = 100 + rng() * 3100;
    const y = 100 + rng() * 1900;
    if (districtAt(x, y) === 'water') continue;
    S.peds.push({
      x, y, angle: rng() * Math.PI * 2, speed: 45 + rng() * 25,
      tx: x, ty: y, state: 'walk', downT: 0, color: pick(rng, ['#e63946', '#457b9d', '#f4a261', '#2a9d8f', '#e9c46a', '#6d6875']),
    });
  }
  return S;
}

export function applySave(S, save) {
  if (!save) return;
  S.player.cash = save.cash ?? 0;
  S.mission.index = save.missionIndex ?? 0;
  S.stats.missionsDone = save.missionsDone ?? save.missionIndex ?? 0;
  S.stats.packagesFound = save.packagesFound ?? 0;
  S.player.health = save.health ?? PLAYER.health;
  if (save.weapons) {
    for (const k of Object.keys(save.weapons)) {
      if (S.player.weapons[k]) S.player.weapons[k] = { ...S.player.weapons[k], ...save.weapons[k] };
    }
  }
  if (save.weapon && S.player.weapons[save.weapon]) S.player.weapon = save.weapon;
  if (Number.isFinite(save.x) && Number.isFinite(save.y)) {
    S.player.x = save.x;
    S.player.y = save.y;
  }
}

// --- collisions ---------------------------------------------------------------

function buildingsNear(S, x, y) {
  const out = [];
  const cx = Math.floor(x / 200);
  const cy = Math.floor(y / 200);
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const list = S.cityIndex.get((cx + dx) + ',' + (cy + dy));
      if (list) out.push(...list);
    }
  }
  return out;
}

function hitsBuilding(S, x, y, r) {
  for (const b of buildingsNear(S, x, y)) {
    if (x > b.x - b.w / 2 - r && x < b.x + b.w / 2 + r && y > b.y - b.d / 2 - r && y < b.y + b.d / 2 + r) return true;
  }
  return false;
}

function inWater(S, x, y) {
  if (districtAt(x, y) !== 'water') return false;
  // The y=1100 bridge crosses the channel.
  if (Math.abs(y - 1100) < 26 && x >= 2600 && x <= 2920) return false;
  return true;
}

function moveWithCollision(S, ent, nx, ny, r) {
  // Try x then y separately so the entity slides along walls.
  if (!hitsBuilding(S, nx, ent.y, r) && !inWater(S, nx, ent.y)) ent.x = clamp(nx, MAP.minX, MAP.maxX);
  if (!hitsBuilding(S, ent.x, ny, r) && !inWater(S, ent.x, ny)) ent.y = clamp(ny, MAP.minY, MAP.maxY);
}

// --- cars ---------------------------------------------------------------------

function driveCar(S, car, input, dt, isPlayer) {
  const keys = input.keys;
  const throttle = keys.has('KeyW') || keys.has('ArrowUp');
  const brake = keys.has('KeyS') || keys.has('ArrowDown');
  const steer = (keys.has('KeyA') || keys.has('ArrowLeft') ? -1 : 0) + (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0);
  const boosting = isPlayer && (keys.has('ShiftLeft') || keys.has('ShiftRight')) && throttle && car.nitro > 0;
  const top = boosting ? car.maxSpeed * NITRO.boost : car.maxSpeed;
  if (throttle) car.speed = Math.min(car.speed + car.accel * dt, top);
  else if (brake) car.speed = Math.max(car.speed - car.accel * 1.5 * dt, -car.maxSpeed * 0.35);
  else {
    const drag = 55 * dt;
    car.speed = Math.abs(car.speed) <= drag ? 0 : car.speed - Math.sign(car.speed) * drag;
  }
  if (boosting) car.nitro = Math.max(0, car.nitro - NITRO.drain * dt);
  else car.nitro = Math.min(car.nitroMax, car.nitro + NITRO.regen * dt);
  const spd = Math.abs(car.speed);
  if (spd > 1) {
    car.angle += steer * dt * 2.1 * clamp(spd / 70, 0, 1) * (car.speed >= 0 ? 1 : -1);
  }
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  moveWithCollision(S, car, nx, ny, 13);
  // Bumping other cars: the faster car matches the slower one's speed
  // (a rear-end slows you to traffic speed instead of stopping you dead).
  for (const other of S.cars) {
    if (other === car) continue;
    if (dist2(car.x, car.y, other.x, other.y) < 30 * 30) {
      if (Math.abs(car.speed) > Math.abs(other.speed)) car.speed = other.speed * 0.9;
      else other.speed = car.speed * 0.9;
    }
  }
  // Screenshot cruise control: hold a steady speed for the photos.
  if (isPlayer && S.shot && S.shotSpeed) car.speed = S.shotSpeed;
}

// --- the main update -----------------------------------------------------------

export function update(S, dt) {
  S.time += dt;
  const input = S.input;
  const p = S.player;
  const playing = S.flags.started && !S.flags.menu && !S.flags.paused;
  if (playing) S.stats.playTime += dt;

  // One-shot actions.
  if (playing) {
    const jp = input.justPressed;
    if (jp.has('KeyF')) enterExitCar(S);
    if (jp.has('KeyM') && !S.mission.active && S.mission.index < MISSIONS.length) startMission(S, S.mission.index);
    if (jp.has('KeyC')) {
      S.radio.station = (S.radio.station + 1) % 3;
      S.events.push({ type: 'radio', station: S.radio.station, t: S.time });
    }
    if (jp.has('Digit1') && p.weapons.pistol.owned) p.weapon = 'pistol';
    if (jp.has('Digit2') && p.weapons.smg.owned) p.weapon = 'smg';
    if (jp.has('Digit3') && p.weapons.shotgun.owned) p.weapon = 'shotgun';
    if (jp.has('KeyR')) startReload(S);
    if (p.reloadT > 0) {
      p.reloadT -= dt;
      if (p.reloadT <= 0) finishReload(S);
    }
    if (p.fireT > 0) p.fireT -= dt;
    if (p.hurtT > 0) p.hurtT -= dt;
  }

  // Player movement.
  if (playing) {
    if (p.onFoot) {
      const keys = input.keys;
      let mx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      let my = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
      const running = keys.has('ShiftLeft') || keys.has('ShiftRight');
      if (mx !== 0 || my !== 0) {
        const len = Math.hypot(mx, my);
        mx /= len;
        my /= len;
        const spd = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
        p.angle = Math.atan2(my, mx);
        moveWithCollision(S, p, p.x + mx * spd * dt, p.y + my * spd * dt, 10);
        p.speed = spd;
      } else {
        p.speed = 0;
      }
      p.aimAngle = input.aimAngle || p.angle;
    } else if (p.car) {
      driveCar(S, p.car, input, dt, true);
      p.x = p.car.x;
      p.y = p.car.y;
      p.angle = p.car.angle;
      p.aimAngle = p.car.angle;
      // Running over pedestrians is a crime.
      for (const ped of S.peds) {
        if (ped.state === 'walk' && Math.abs(p.car.speed) > 60 && dist2(p.x, p.y, ped.x, ped.y) < 15 * 15) {
          ped.state = 'down';
          ped.downT = 5;
          addHeat(S, 30);
          S.events.push({ type: 'pedHit', t: S.time });
        }
      }
    }
  }

  // Shooting.
  if (playing && input.mouseDown && p.fireT <= 0 && p.reloadT <= 0) fireWeapon(S);

  // Traffic.
  for (const car of S.cars) {
    if (car.kind !== 'traffic') continue;
    let blocked = false;
    for (const other of S.cars) {
      if (other === car || other.kind !== 'traffic') continue;
      const ahead = car.road === 'h'
        ? (other.road === 'h' && Math.abs(other.y - car.y) < 20 && (other.x - car.x) * car.dir > 0 && (other.x - car.x) * car.dir < 60)
        : (other.road === 'v' && Math.abs(other.x - car.x) < 20 && (other.y - car.y) * car.dir > 0 && (other.y - car.y) * car.dir < 60);
      if (ahead) { blocked = true; break; }
    }
    const target = blocked ? 0 : car.targetSpeed;
    car.speed += clamp(target - car.speed, -120 * dt, 80 * dt);
    if (car.road === 'h') {
      car.x += car.dir * car.speed * dt;
      if (car.x < 80) { car.x = 80; car.dir = 1; car.angle = 0; }
      if (car.x > 3340) { car.x = 3340; car.dir = -1; car.angle = Math.PI; }
      if (Math.abs(car.x - 1100) < 24 || Math.abs(car.x - 1900) < 24) {
        if (S.rng() < 0.004) turnTraffic(S, car);
      }
    } else {
      car.y += car.dir * car.speed * dt;
      if (car.y < 80) { car.y = 80; car.dir = 1; car.angle = Math.PI / 2; }
      if (car.y > 2040) { car.y = 2040; car.dir = -1; car.angle = -Math.PI / 2; }
      if (Math.abs(car.y - 1100) < 24 || Math.abs(car.y - 700) < 24) {
        if (S.rng() < 0.004) turnTraffic(S, car);
      }
    }
  }

  // Pedestrians.
  for (const ped of S.peds) {
    if (ped.state === 'down') {
      ped.downT -= dt;
      if (ped.downT <= 0) ped.state = 'walk';
      continue;
    }
    const d = dist(ped.x, ped.y, ped.tx, ped.ty);
    if (d < 12) {
      ped.tx = clamp(ped.x + (S.rng() - 0.5) * 600, 90, 3330);
      ped.ty = clamp(ped.y + (S.rng() - 0.5) * 600, 90, 2050);
      if (districtAt(ped.tx, ped.ty) === 'water') { ped.tx = ped.x; ped.ty = ped.y; }
    } else {
      ped.angle = angleTo(ped.x, ped.y, ped.tx, ped.ty);
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
    }
  }

  // Wanted: decay, cops, helicopter, roadblocks.
  updateWanted(S, dt);
  updateCops(S, dt);
  updateGang(S, dt);
  updateMission(S, dt);

  // Hidden packages.
  for (const pkg of S.packages) {
    if (!pkg.taken && dist2(p.x, p.y, pkg.x, pkg.y) < 26 * 26) {
      pkg.taken = true;
      S.stats.packagesFound += 1;
      p.cash += PLAYER.packageReward;
      S.events.push({ type: 'package', found: S.stats.packagesFound, t: S.time });
    }
  }

  // Health regen when calm; wasted respawn.
  if (p.health < PLAYER.health && S.wanted.level === 0) p.health = Math.min(PLAYER.health, p.health + 2 * dt);
  if (p.health <= 0) {
    p.health = PLAYER.health;
    p.cash = Math.max(0, p.cash - 200);
    S.wanted.level = 0;
    S.wanted.heat = 0;
    p.x = PLACES.hospital.x;
    p.y = PLACES.hospital.y;
    if (p.car) { p.car = null; p.onFoot = true; }
    S.events.push({ type: 'wasted', t: S.time });
  }

  // Proximity flags for prompts and panels.
  S.near.shop = dist(p.x, p.y, PLACES.shop.x, PLACES.shop.y) < 70;
  S.near.safehouse = dist(p.x, p.y, PLACES.safehouse.x, PLACES.safehouse.y) < 70;
  S.near.car = null;
  let bestD = 48;
  for (const car of S.cars) {
    if (car === p.car) continue;
    const d = dist(p.x, p.y, car.x, car.y);
    if (d < bestD) { bestD = d; S.near.car = car; }
  }

  input.justPressed.clear();
}

function turnTraffic(S, car) {
  if (car.road === 'h') {
    const vRoads = [300, 700, 1100, 1500, 1900, 2300];
    const rx = vRoads.find((r) => Math.abs(car.x - r) < 30);
    if (rx === undefined) return;
    car.road = 'v';
    car.line = rx;
    car.x = rx;
    car.dir = S.rng() < 0.5 ? 1 : -1;
    car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    const hRoads = [300, 700, 1100, 1500, 1900];
    const ry = hRoads.find((r) => Math.abs(car.y - r) < 30);
    if (ry === undefined) return;
    car.road = 'h';
    car.line = ry;
    car.y = ry;
    car.dir = S.rng() < 0.5 ? 1 : -1;
    car.angle = car.dir > 0 ? 0 : Math.PI;
  }
}

function enterExitCar(S) {
  const p = S.player;
  if (p.onFoot) {
    const car = S.near.car;
    if (!car) return;
    p.car = car;
    p.onFoot = false;
    if (car.kind === 'traffic' || car.kind === 'parked') {
      car.kind = 'player';
      S.stats.carsStolen += 1;
      addHeat(S, 12);
    } else if (car.kind === 'cop') {
      car.kind = 'player';
      addHeat(S, 20);
    }
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    S.events.push({ type: 'enterCar', carType: car.type, t: S.time });
  } else if (p.car) {
    const car = p.car;
    p.car = null;
    p.onFoot = true;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 26;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 26;
    car.speed = 0;
    S.events.push({ type: 'exitCar', t: S.time });
  }
}

function startReload(S) {
  const p = S.player;
  const w = WEAPONS[p.weapon];
  const slot = p.weapons[p.weapon];
  if (!slot || !slot.owned || slot.inMag >= w.mag || slot.reserve <= 0 || p.reloadT > 0) return;
  p.reloadT = 1.2;
}

function finishReload(S) {
  const p = S.player;
  const w = WEAPONS[p.weapon];
  const slot = p.weapons[p.weapon];
  const need = w.mag - slot.inMag;
  const take = Math.min(need, slot.reserve);
  slot.inMag += take;
  slot.reserve -= take;
}

function fireWeapon(S) {
  const p = S.player;
  const w = WEAPONS[p.weapon];
  const slot = p.weapons[p.weapon];
  if (!slot || !slot.owned) return;
  if (slot.inMag <= 0) {
    startReload(S);
    return;
  }
  p.fireT = w.rate;
  slot.inMag -= 1;
  S.stats.shotsFired += 1;
  S.events.push({ type: 'shot', weapon: p.weapon, t: S.time });
  // Firing near the law draws heat.
  let nearLaw = false;
  for (const c of S.footCops) if (dist2(p.x, p.y, c.x, c.y) < 400 * 400) nearLaw = true;
  for (const c of S.cops) if (dist2(p.x, p.y, c.x, c.y) < 400 * 400) nearLaw = true;
  if (nearLaw) addHeat(S, 6);
  // Hitscan: nearest hostile in the aim cone takes the pellets.
  const targets = [];
  for (const g of (S.mission.data.gang || [])) if (g.hp > 0) targets.push({ x: g.x, y: g.y, ref: g, kind: 'gang' });
  for (const c of S.footCops) if (c.hp > 0) targets.push({ x: c.x, y: c.y, ref: c, kind: 'cop' });
  for (const ped of S.peds) if (ped.state === 'walk') targets.push({ x: ped.x, y: ped.y, ref: ped, kind: 'ped' });
  for (let pellet = 0; pellet < w.pellets; pellet++) {
    let best = null;
    let bestD = w.range * w.range;
    for (const t of targets) {
      const d2 = dist2(p.x, p.y, t.x, t.y);
      if (d2 > bestD) continue;
      const aim = angleDiff(angleTo(p.x, p.y, t.x, t.y), p.aimAngle);
      if (Math.abs(aim) > 0.28 + w.spread) continue;
      best = t;
      bestD = d2;
    }
    if (!best) continue;
    if (best.kind === 'ped') {
      best.ref.state = 'down';
      best.ref.downT = 6;
      addHeat(S, 40);
    } else {
      best.ref.hp -= w.damage;
      if (best.ref.hp <= 0) {
        S.stats.kills += 1;
        if (best.kind === 'cop') addHeat(S, 25);
        S.events.push({ type: 'kill', kind: best.kind, t: S.time });
      }
    }
  }
  if (slot.inMag <= 0) startReload(S);
}

function updateWanted(S, dt) {
  const w = S.wanted;
  if (w.heat > 0) {
    w.calmT += dt;
    if (w.calmT > 5) {
      w.heat = Math.max(0, w.heat - 5 * dt);
      w.level = levelFromHeat(w.heat);
    }
  }
  if (w.level === 0) {
    if (S.cops.length || S.footCops.length || S.roadblocks.length || S.heli.active) {
      S.cops = [];
      S.footCops = [];
      S.roadblocks = [];
      S.heli.active = false;
      S.cars = S.cars.filter((c) => c.kind !== 'cop');
    }
  }
}

function updateCops(S, dt) {
  const level = S.wanted.level;
  const p = S.player;
  if (level === 0) return;
  // Keep the right number of cop cars.
  const wantCars = WANTED.copCarCount[level];
  while (S.cops.length < wantCars) {
    const a = S.rng() * Math.PI * 2;
    const r = 380 + S.rng() * 160;
    const x = clamp(p.x + Math.cos(a) * r, 90, 3310);
    const y = clamp(p.y + Math.sin(a) * r, 90, 2030);
    if (districtAt(x, y) === 'water') continue;
    const car = makeCar('cop', x, y, 0, '#212529', 'cop');
    car.speed = 120;
    S.cops.push(car);
    S.cars.push(car);
  }
  // Foot cops.
  const wantFoot = WANTED.footCopCount[level];
  while (S.footCops.length < wantFoot) {
    const a = S.rng() * Math.PI * 2;
    S.footCops.push({
      x: clamp(p.x + Math.cos(a) * 260, 90, 3310),
      y: clamp(p.y + Math.sin(a) * 260, 90, 2030),
      hp: 100, angle: a, bustT: 0, speed: 150, kind: 'cop',
    });
  }
  // Cop cars chase.
  for (let i = S.cops.length - 1; i >= 0; i--) {
    const car = S.cops[i];
    const targetAngle = angleTo(car.x, car.y, p.x, p.y);
    car.angle += clamp(angleDiff(targetAngle, car.angle), -2.4 * dt, 2.4 * dt);
    car.speed = Math.min(car.speed + 90 * dt, car.maxSpeed);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    moveWithCollision(S, car, nx, ny, 13);
    const d = dist(car.x, car.y, p.x, p.y);
    if (p.onFoot && d < 42) {
      // The cop gets out and chases on foot.
      S.cops.splice(i, 1);
      const idx = S.cars.indexOf(car);
      if (idx >= 0) S.cars.splice(idx, 1);
      S.footCops.push({ x: car.x, y: car.y, hp: 100, angle: car.angle, bustT: 0, speed: 150, kind: 'cop' });
    } else if (!p.onFoot && d < 52 && p.hurtT <= 0) {
      p.health -= 4;
      p.hurtT = 0.8;
      car.speed *= 0.5;
      S.events.push({ type: 'rammed', t: S.time });
    }
  }
  // Foot cops chase; a long grab busts the player.
  for (const cop of S.footCops) {
    const d = dist(cop.x, cop.y, p.x, p.y);
    if (p.onFoot && d < 24) {
      cop.bustT += dt;
      if (cop.bustT >= WANTED.bustSeconds) {
        p.cash = Math.max(0, p.cash - WANTED.bustFine);
        S.wanted.level = 0;
        S.wanted.heat = 0;
        p.x = PLACES.station.x;
        p.y = PLACES.station.y;
        if (p.car) { p.car = null; p.onFoot = true; }
        S.events.push({ type: 'busted', t: S.time });
        S.cops = [];
        S.footCops = [];
        S.roadblocks = [];
        S.heli.active = false;
        S.cars = S.cars.filter((c) => c.kind !== 'cop');
        return;
      }
    } else {
      cop.bustT = 0;
      const a = angleTo(cop.x, cop.y, p.x, p.y);
      cop.angle = a;
      cop.x += Math.cos(a) * cop.speed * dt;
      cop.y += Math.sin(a) * cop.speed * dt;
    }
  }
  // Police helicopter at 3 stars and up: circles, keeps the heat on.
  if (level >= 3) {
    S.heli.active = true;
    S.heli.angle += dt * 0.45;
    S.heli.rotor += dt * 22;
    S.heli.x = p.x + Math.cos(S.heli.angle) * 150;
    S.heli.y = p.y + Math.sin(S.heli.angle) * 150;
    S.wanted.calmT = 0;
  } else {
    S.heli.active = false;
  }
  // Roadblocks at 2 stars and up: two cruiser walls on the roads ahead.
  if (level >= 2 && S.roadblocks.length < 2) {
    const ahead = p.angle;
    for (let i = 0; i < 2; i++) {
      const bx = clamp(p.x + Math.cos(ahead + (i === 0 ? 0.3 : -0.4)) * 420, 120, 3280);
      const by = clamp(p.y + Math.sin(ahead + (i === 0 ? 0.3 : -0.4)) * 420, 120, 2000);
      if (districtAt(bx, by) === 'water') continue;
      S.roadblocks.push({ x: bx, y: by, angle: ahead + Math.PI / 2, t: S.time });
    }
  }
  if (level >= 2 && p.car) {
    for (const rb of S.roadblocks) {
      if (dist2(p.car.x, p.car.y, rb.x, rb.y) < 30 * 30 && Math.abs(p.car.speed) > 40) {
        p.car.speed *= -0.25;
        p.health -= 5;
        p.hurtT = 0.8;
        S.events.push({ type: 'roadblockHit', t: S.time });
      }
    }
  }
}

function updateGang(S, dt) {
  const gang = S.mission.data.gang;
  if (!gang) return;
  const p = S.player;
  for (const g of gang) {
    if (g.hp <= 0) continue;
    const d = dist(g.x, g.y, p.x, p.y);
    if (d > 60) {
      const a = angleTo(g.x, g.y, p.x, p.y);
      g.angle = a;
      g.x += Math.cos(a) * g.speed * dt;
      g.y += Math.sin(a) * g.speed * dt;
    }
    g.shootT -= dt;
    if (g.shootT <= 0 && d < 320) {
      g.shootT = 1.1 + S.rng() * 0.5;
      let dmg = 8;
      if (p.armor > 0) {
        const absorbed = Math.min(p.armor, dmg);
        p.armor -= absorbed;
        dmg -= absorbed;
      }
      p.health -= dmg;
      p.hurtT = 0.4;
      S.events.push({ type: 'shotAt', t: S.time });
    }
  }
}

export { startMission, commitCrime, MISSIONS };
