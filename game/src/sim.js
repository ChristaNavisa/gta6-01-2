// VERDE BAY 3D v8 — the simulation: driving, on-foot play, traffic, peds, cops,
// police helicopter, roadblocks, military jeeps, 5-star wanted, weapons, shop,
// safehouse, packages, day/night. No DOM, no THREE — the Node smoke test imports it.
import {
  CAR_TYPES, NITRO_MULT, NITRO_DRAIN, NITRO_REGEN, WEAPONS, SHOP,
  WANTED_HEAT, WANTED_DECAY, WANTED_QUIET_TIME, DAY_LENGTH, PACKAGE_REWARD,
} from './config.js';
import { generateCity, districtAt } from './city.js';
import {
  MISSIONS, startMission, updateMission, commitCrime, failMission,
} from './missions.js';
import { clamp, dist2, angleDiff, mulberry32, pick } from './util.js';
import { writeSave } from './save.js';

export { startMission, commitCrime, failMission };

export function makeCar(type, x, y, angle, color, role) {
  const t = CAR_TYPES[type] || CAR_TYPES.sedan;
  return {
    type, x, y, angle, speed: 0,
    maxSpeed: t.maxSpeed, accel: t.accel,
    nitro: t.nitroMax, nitroMax: t.nitroMax,
    color, role: role || 'traffic', hp: 100, dead: false,
    tx: x, ty: y, wait: 0,
  };
}

export function createGame(seed) {
  const rng = mulberry32(seed * 31 + 7);
  const city = generateCity(seed);
  const S = {
    seed, time: 0, dayTime: 0.35,
    city,
    player: {
      x: 1150, y: 850, angle: 0, onFoot: true, car: null,
      cash: 0, health: 100, armor: 0,
      weapon: 0, weapons: [true, false, false],
      ammo: [WEAPONS[0].mag, 0, 0],
      reserve: [WEAPONS[0].reserve, 0, 0],
      aim: 0,
    },
    cars: [], peds: [], cops: [], military: [], roadblocks: [],
    heli: null,
    wanted: { level: 0, heat: 0, quiet: 0, maxLevel: 0 },
    mission: { active: false, index: 0, stage: 0, data: {}, def: null, failed: false },
    stats: { missionsDone: 0, packagesFound: 0, kills: 0, shotsFired: 0 },
    flags: { menu: true, started: false, paused: false },
    input: { keys: new Set(), justPressed: new Set(), mouse: { x: 0, y: 0, down: false } },
    packages: city.packages.map((p) => ({ ...p })),
    radio: { station: 0, on: true },
    shop: { near: false, open: false },
    safehouse: { near: false },
    effects: [], shake: 0, fanfare: null, autosave: false,
    bust: 0, lastDamage: -99, shotMode: null,
    rng,
  };
  // 22 traffic cars, snapped onto roads.
  const types = ['sedan', 'sport', 'taxi', 'truck'];
  const colors = ['#2e5fa3', '#d7263d', '#f4b400', '#6c757d', '#3a7d44', '#7a4a8a', '#c0c0c0'];
  for (let i = 0; i < 22; i++) {
    const seg = city.roads[Math.floor(rng() * city.roads.length)];
    const t = rng();
    const x = seg.x0 + (seg.x1 - seg.x0) * t;
    const y = seg.y0 + (seg.y1 - seg.y0) * t;
    const car = makeCar(types[i % types.length], x, y, rng() * Math.PI * 2,
      pick(rng, colors), 'traffic');
    car.speed = 40 + rng() * 35;
    pickRoadTarget(S, car);
    S.cars.push(car);
  }
  // 36 pedestrians on land, near the streets.
  for (let i = 0; i < 36; i++) {
    let x = 200 + rng() * 2400, y = 200 + rng() * 1700;
    if (districtAt(x, y) === 'water') { x = 1000 + rng() * 400; y = 800 + rng() * 300; }
    S.peds.push({
      x, y, angle: rng() * Math.PI * 2, speed: 12 + rng() * 10,
      hp: 100, dead: false, flee: 0, wait: rng() * 2,
    });
  }
  return S;
}

function pickRoadTarget(S, car) {
  const seg = S.city.roads[Math.floor(S.rng() * S.city.roads.length)];
  const t = S.rng();
  car.tx = seg.x0 + (seg.x1 - seg.x0) * t;
  car.ty = seg.y0 + (seg.y1 - seg.y0) * t;
  car.wait = 0;
}

function driveCar(S, car, dt, targetX, targetY, topSpeed) {
  const want = Math.atan2(targetY - car.y, targetX - car.x);
  const diff = angleDiff(car.angle, want);
  car.angle += clamp(diff, -1.6 * dt, 1.6 * dt);
  const target = Math.min(topSpeed, Math.abs(diff) > 1.2 ? topSpeed * 0.4 : topSpeed);
  car.speed += (target - car.speed) * Math.min(1, dt * 1.2);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
}

export function applySave(S, data) {
  if (!data) return;
  S.mission.index = clamp(data.missionIndex || 0, 0, MISSIONS.length);
  S.player.cash = data.cash || 0;
  S.stats.missionsDone = data.missionIndex || 0;
  S.stats.packagesFound = data.packagesFound || 0;
  S.player.health = data.health || 100;
  if (Array.isArray(data.weapons)) S.player.weapons = data.weapons.slice(0, 3);
  if (Array.isArray(data.ammo)) S.player.ammo = data.ammo.slice(0, 3);
  if (typeof data.dayTime === 'number') S.dayTime = data.dayTime;
  S.packages.forEach((p, i) => { if (i < S.stats.packagesFound) p.found = true; });
}

export function buyShopItem(S, key) {
  const item = SHOP[key];
  if (!item || S.player.cash < item.price) return false;
  const p = S.player;
  if (key === 'smg') {
    if (p.weapons[1]) return false;
    p.weapons[1] = true; p.ammo[1] = WEAPONS[1].mag; p.reserve[1] = WEAPONS[1].reserve;
  } else if (key === 'scattergun') {
    if (p.weapons[2]) return false;
    p.weapons[2] = true; p.ammo[2] = WEAPONS[2].mag; p.reserve[2] = WEAPONS[2].reserve;
  } else if (key === 'ammo') {
    for (let i = 0; i < 3; i++) if (p.weapons[i]) p.reserve[i] = WEAPONS[i].reserve;
  } else if (key === 'armor') {
    p.armor = Math.min(100, p.armor + 50);
  } else if (key === 'medkit') {
    p.health = Math.min(100, p.health + 50);
  }
  p.cash -= item.price;
  return true;
}

function damagePlayer(S, amount) {
  const p = S.player;
  let rest = amount;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, rest);
    p.armor -= absorbed; rest -= absorbed;
  }
  p.health -= rest;
  S.lastDamage = S.time;
  S.shake = Math.min(1, S.shake + 0.3);
  if (p.health <= 0) {
    p.health = 0;
    if (S.mission.active) failMission(S, 'Wasted');
    else {
      const h = S.city.places.hospital;
      p.x = h.x; p.y = h.y; p.health = 50;
      if (p.car) { p.car = null; p.onFoot = true; }
      S.wanted.level = 0; S.wanted.heat = 0;
    }
  }
}

function fireWeapon(S) {
  const p = S.player;
  const w = WEAPONS[p.weapon];
  if (!p.weapons[p.weapon] || p.ammo[p.weapon] <= 0) return;
  p.ammo[p.weapon] -= 1;
  S.stats.shotsFired += 1;
  const pellets = w.pellets || 1;
  const aim = p.aim || p.angle;
  const targets = [];
  for (const c of S.cops) if (!c.dead) targets.push({ x: c.x, y: c.y, kind: 'cop', ref: c, hp: c.hp });
  const gang = (S.mission.active && S.mission.data.gang) || [];
  for (const g of gang) if (g.hp > 0) targets.push({ x: g.x, y: g.y, kind: 'gang', ref: g, hp: g.hp });
  for (const pd of S.peds) if (!pd.dead) targets.push({ x: pd.x, y: pd.y, kind: 'ped', ref: pd, hp: pd.hp });
  let best = null, bestD = Infinity;
  for (const t of targets) {
    const d = dist2(p.x, p.y, t.x, t.y);
    if (d > w.range) continue;
    const ang = Math.atan2(t.y - p.y, t.x - p.x);
    if (Math.abs(angleDiff(aim, ang)) > w.spread + 0.12) continue;
    if (d < bestD) { best = t; bestD = d; }
  }
  S.effects.push({ x: p.x + Math.cos(aim) * 18, y: p.y + Math.sin(aim) * 18, vx: 0, vy: 0, life: 0.12, max: 0.12, kind: 'flash' });
  if (best) {
    for (let i = 0; i < pellets; i++) {
      best.ref.hp -= w.damage;
      if (best.kind === 'cop' && best.ref.hp <= 0 && !best.ref.dead) {
        best.ref.dead = true; S.stats.kills += 1;
        commitCrime(S, Math.min(5, S.wanted.level + 1));
      }
      if (best.kind === 'gang' && best.ref.hp <= 0) S.stats.kills += 1;
      if (best.kind === 'ped' && best.ref.hp <= 0 && !best.ref.dead) {
        best.ref.dead = true; commitCrime(S, 1);
      }
    }
    S.effects.push({ x: best.x, y: best.y, vx: 0, vy: 0, life: 0.3, max: 0.3, kind: 'hit' });
  }
}

function updateWanted(S, dt) {
  const w = S.wanted;
  w.quiet += dt;
  if (w.quiet > WANTED_QUIET_TIME && !S.heli && w.heat > 0) {
    w.heat = Math.max(0, w.heat - WANTED_DECAY * dt);
  }
  let level = 0;
  for (let i = 5; i >= 1; i--) if (w.heat >= WANTED_HEAT[i]) { level = i; break; }
  w.level = level;
}

function updateCops(S, dt) {
  const p = S.player;
  const want = S.wanted.level > 0 ? Math.min(6, S.wanted.level + 1) : 0;
  // Spawn cops near (but not on top of) the player.
  while (S.cops.length < want) {
    const a = S.rng() * Math.PI * 2;
    const d = 380 + S.rng() * 200;
    const car = makeCar('cop', p.x + Math.cos(a) * d, p.y + Math.sin(a) * d,
      0, '#1a1a2e', 'cop');
    S.cops.push(car);
  }
  while (S.cops.length > want) S.cops.pop();
  let nearest = Infinity;
  for (const cop of S.cops) {
    if (cop.dead) continue;
    driveCar(S, cop, dt, p.x, p.y, cop.maxSpeed);
    const d = dist2(cop.x, cop.y, p.x, p.y);
    if (d < nearest) nearest = d;
    if (d < 30 && p.car && Math.abs(p.car.speed) > 30) {
      cop.hp -= 5; // ramming a cop car hurts it
    }
  }
  S.cops = S.cops.filter((c) => !c.dead);
  // Bust: a cop sitting on the player.
  if (S.wanted.level > 0 && nearest < 26) {
    S.bust += dt / 1.2;
    if (S.bust >= 1) {
      S.bust = 0;
      if (S.mission.active) failMission(S, 'Busted');
      else { S.wanted.level = 0; S.wanted.heat = 0; }
    }
  } else {
    S.bust = Math.max(0, S.bust - dt / 2);
  }
}

function updateHeli(S, dt) {
  const p = S.player;
  if (S.wanted.level >= 3) {
    if (!S.heli) {
      S.heli = { x: p.x + 120, y: p.y, z: 35, angle: 0, rotor: 0, orbitR: 120, despawn: 0 };
    }
    const h = S.heli;
    h.angle += dt * 0.45;
    h.x = p.x + Math.cos(h.angle) * h.orbitR;
    h.y = p.y + Math.sin(h.angle) * h.orbitR;
    h.z = 35;
    h.rotor += dt * 28;
    h.despawn = 0;
  } else if (S.heli) {
    S.heli.despawn += dt;
    if (S.heli.despawn > 3) S.heli = null;
  }
}

function updateRoadblocks(S, dt) {
  const p = S.player;
  if (S.wanted.level >= 2) {
    const cruisers = S.wanted.level >= 5 ? 3 : 2;
    if (S.roadblocks.length === 0) {
      const fwd = p.car ? p.angle : p.aim || p.angle;
      for (let i = 0; i < 2; i++) {
        const side = i === 0 ? 1 : -1;
        S.roadblocks.push({
          x: p.x + Math.cos(fwd) * 200 + Math.cos(fwd + Math.PI / 2) * side * 46,
          y: p.y + Math.sin(fwd) * 200 + Math.sin(fwd + Math.PI / 2) * side * 46,
          angle: fwd + Math.PI / 2, cruisers,
        });
      }
    }
    for (const rb of S.roadblocks) rb.cruisers = cruisers;
    // Keep them ahead of the player.
    const fwd = p.car ? p.angle : p.aim || p.angle;
    S.roadblocks.forEach((rb, i) => {
      const side = i === 0 ? 1 : -1;
      const tx = p.x + Math.cos(fwd) * 200 + Math.cos(fwd + Math.PI / 2) * side * 46;
      const ty = p.y + Math.sin(fwd) * 200 + Math.sin(fwd + Math.PI / 2) * side * 46;
      rb.x += (tx - rb.x) * Math.min(1, dt * 0.5);
      rb.y += (ty - rb.y) * Math.min(1, dt * 0.5);
    });
    // Collision with the player's car.
    if (p.car) {
      for (const rb of S.roadblocks) {
        if (dist2(p.x, p.y, rb.x, rb.y) < 34) {
          if (Math.abs(p.car.speed) > 40) {
            p.car.speed = -p.car.speed * 0.45;
            damagePlayer(S, 5);
          } else {
            p.car.speed *= 0.2;
          }
        }
      }
    }
  } else if (S.roadblocks.length > 0) {
    S.roadblocks = [];
  }
}

function updateMilitary(S, dt) {
  const p = S.player;
  if (S.wanted.level >= 5) {
    while (S.military.length < 2) {
      const a = S.rng() * Math.PI * 2;
      const car = makeCar('jeep', p.x + Math.cos(a) * 320, p.y + Math.sin(a) * 320,
        0, '#3a4a2a', 'military');
      S.military.push(car);
    }
    for (const jeep of S.military) {
      driveCar(S, jeep, dt, p.x, p.y, jeep.maxSpeed);
      if (dist2(jeep.x, jeep.y, p.x, p.y) < 34) {
        if (p.car) p.car.speed *= 0.5;
        damagePlayer(S, 8);
        jeep.x += Math.cos(jeep.angle) * -20;
        jeep.y += Math.sin(jeep.angle) * -20;
      }
    }
  } else if (S.military.length > 0) {
    S.military = [];
  }
}

export function update(S, dt) {
  dt = Math.min(dt, 0.05);
  S.time += dt;
  S.dayTime = (S.dayTime + dt / DAY_LENGTH) % 1;
  if (S.fanfare) {
    S.fanfare.t += dt;
    if (S.fanfare.t > 3.5) S.fanfare = null;
  }
  S.shake = Math.max(0, S.shake - dt * 1.5);
  for (const e of S.effects) { e.life -= dt; e.x += (e.vx || 0) * dt; e.y += (e.vy || 0) * dt; }
  S.effects = S.effects.filter((e) => e.life > 0);
  if (S.flags.menu || !S.flags.started || S.flags.paused) return;

  const p = S.player;
  const keys = S.input.keys;
  const jp = S.input.justPressed;

  // --- Player movement ------------------------------------------------------
  if (p.car) {
    const car = p.car;
    const boosting = keys.has('ShiftLeft') && car.nitro > 0 && keys.has('KeyW');
    const top = car.maxSpeed * (boosting ? NITRO_MULT : 1);
    if (keys.has('KeyW')) car.speed += car.accel * dt;
    if (keys.has('KeyS')) car.speed -= car.accel * 1.2 * dt;
    car.speed -= car.speed * 0.6 * dt;
    car.speed = clamp(car.speed, -40, top);
    if (boosting) car.nitro = Math.max(0, car.nitro - NITRO_DRAIN * dt);
    else car.nitro = Math.min(car.nitroMax, car.nitro + NITRO_REGEN * dt);
    const steer = (keys.has('KeyA') ? -1 : 0) + (keys.has('KeyD') ? 1 : 0);
    const grip = clamp(Math.abs(car.speed) / 60, 0, 1);
    car.angle += steer * 1.9 * grip * dt * (car.speed >= 0 ? 1 : -1);
    p.angle = car.angle;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.x = clamp(car.x, 20, 3380); car.y = clamp(car.y, 20, 2080);
    p.x = car.x; p.y = car.y;
    if (jp.has('KeyE')) { p.car = null; p.onFoot = true; p.x = car.x + 30; p.y = car.y; }
  } else {
    const run = keys.has('ShiftLeft') ? 1.55 : 1;
    const sp = 90 * run;
    let mx = 0, my = 0;
    if (keys.has('KeyW')) my -= 1;
    if (keys.has('KeyS')) my += 1;
    if (keys.has('KeyA')) mx -= 1;
    if (keys.has('KeyD')) mx += 1;
    if (mx || my) {
      const len = Math.hypot(mx, my);
      p.x += (mx / len) * sp * dt;
      p.y += (my / len) * sp * dt;
      p.angle = Math.atan2(my / len, mx / len);
    }
    p.x = clamp(p.x, 20, 3380); p.y = clamp(p.y, 20, 2080);
    if (jp.has('KeyE')) {
      let best = null, bestD = 60;
      for (const car of S.cars) {
        if (car.role === 'cop' || car.role === 'military') continue;
        const d = dist2(p.x, p.y, car.x, car.y);
        if (d < bestD) { best = car; bestD = d; }
      }
      if (best) { p.car = best; p.onFoot = false; best.role = 'player'; }
    }
  }
  p.aim = p.angle;

  // --- Combat ---------------------------------------------------------------
  if (jp.has('Mouse0') || jp.has('KeyF')) fireWeapon(S);
  if (jp.has('KeyR')) {
    const w = WEAPONS[p.weapon];
    if (p.weapons[p.weapon]) {
      const need = w.mag - p.ammo[p.weapon];
      const take = Math.min(need, p.reserve[p.weapon]);
      p.ammo[p.weapon] += take; p.reserve[p.weapon] -= take;
    }
  }
  if (jp.has('Digit1')) p.weapon = 0;
  if (jp.has('Digit2') && p.weapons[1]) p.weapon = 1;
  if (jp.has('Digit3') && p.weapons[2]) p.weapon = 2;
  if (jp.has('KeyC')) S.radio.station = (S.radio.station + 1) % 3;

  // --- Shop / safehouse -----------------------------------------------------
  const shop = S.city.places.shop;
  S.shop.near = dist2(p.x, p.y, shop.x, shop.y) < 90;
  const safe = S.city.places.safehouse;
  S.safehouse.near = dist2(p.x, p.y, safe.x, safe.y) < 90;
  if (S.safehouse.near && jp.has('KeyE') && !p.car) {
    writeSave(S);
    p.health = 100;
    S.fanfare = { text: 'SAFEHOUSE — game saved, health restored', t: 0 };
  }

  // --- Packages -------------------------------------------------------------
  for (const pkg of S.packages) {
    if (!pkg.found && dist2(p.x, p.y, pkg.x, pkg.y) < 32) {
      pkg.found = true;
      S.stats.packagesFound += 1;
      p.cash += PACKAGE_REWARD;
      S.fanfare = { text: `HIDDEN PACKAGE FOUND  +$${PACKAGE_REWARD}`, t: 0 };
    }
  }

  // --- Traffic --------------------------------------------------------------
  for (const car of S.cars) {
    if (car.role === 'player' || car.role === 'target') continue;
    if (dist2(car.x, car.y, car.tx, car.ty) < 40 || car.wait > 0) {
      car.wait += dt;
      if (car.wait > 1.5) pickRoadTarget(S, car);
      continue;
    }
    driveCar(S, car, dt, car.tx, car.ty, 55 + (car.type === 'truck' ? -12 : 8));
  }
  // --- Pedestrians ----------------------------------------------------------
  for (const pd of S.peds) {
    if (pd.dead) continue;
    const dPlayer = dist2(pd.x, pd.y, p.x, p.y);
    if (p.car && dPlayer < 70) pd.flee = 2; // run from the car
    if (pd.flee > 0) {
      pd.flee -= dt;
      const a = Math.atan2(pd.y - p.y, pd.x - p.x);
      pd.x += Math.cos(a) * pd.speed * 2.2 * dt;
      pd.y += Math.sin(a) * pd.speed * 2.2 * dt;
    } else {
      pd.wait -= dt;
      if (pd.wait <= 0) { pd.angle = S.rng() * Math.PI * 2; pd.wait = 1 + S.rng() * 3; }
      pd.x += Math.cos(pd.angle) * pd.speed * dt;
      pd.y += Math.sin(pd.angle) * pd.speed * dt;
    }
    pd.x = clamp(pd.x, 20, 3380); pd.y = clamp(pd.y, 20, 2080);
    if (p.car && dPlayer < 22 && Math.abs(p.car.speed) > 25) {
      pd.dead = true;
      commitCrime(S, 1);
      S.effects.push({ x: pd.x, y: pd.y, vx: 0, vy: 0, life: 0.5, max: 0.5, kind: 'hit' });
    }
  }

  // --- Wanted / police ------------------------------------------------------
  updateWanted(S, dt);
  updateCops(S, dt);
  updateHeli(S, dt);
  updateRoadblocks(S, dt);
  updateMilitary(S, dt);

  // --- Gang (mission) -------------------------------------------------------
  const gang = (S.mission.active && S.mission.data.gang) || [];
  for (const g of gang) {
    if (g.hp <= 0) continue;
    const d = dist2(g.x, g.y, p.x, p.y);
    if (d > 40) {
      const a = Math.atan2(p.y - g.y, p.x - g.x);
      g.x += Math.cos(a) * 55 * dt;
      g.y += Math.sin(a) * 55 * dt;
    }
    g.shootTimer -= dt;
    if (g.shootTimer <= 0 && d < 320) {
      g.shootTimer = 1.5;
      damagePlayer(S, 4);
      S.effects.push({ x: g.x, y: g.y, vx: 0, vy: 0, life: 0.12, max: 0.12, kind: 'flash' });
    }
  }

  // --- Mission --------------------------------------------------------------
  updateMission(S, dt);

  // --- Health regen ---------------------------------------------------------
  if (S.time - S.lastDamage > 8 && p.health > 0 && p.health < 100) {
    p.health = Math.min(100, p.health + 2 * dt);
  }

  if (S.autosave) { writeSave(S); S.autosave = false; }
  jp.clear();
}
