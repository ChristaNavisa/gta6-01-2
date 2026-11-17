// VERDE BAY — the simulation. Pure game logic, no DOM: createGame builds
// the state, update() steps it, and the smoke test drives it headless.
// The renderer (render3d.js) only reads this state; the HUD reads it too.

import { WORLD, CAR_TYPES, PLAYER, WANTED, GUN_DAMAGE, GUN_RANGE } from './config.js';
import { makeRng, clamp, dist, angleTo, angleDiff, turnToward, pushOutCircleBox } from './util.js';
import { generateCity } from './city.js';
import { MISSIONS, startMission, updateMission, failMission } from './missions.js';
import { writeSave } from './save.js';
import { createEffects, burst, tracer, floater, updateEffects } from './effects.js';

/** A car: traffic, the player's, a mission target, or a police interceptor. */
export function makeCar(type, x, y, angle, color, owner) {
  const spec = CAR_TYPES[type] || CAR_TYPES.sedan;
  return {
    type,
    name: spec.name,
    x, y, angle, speed: 0,
    color: color || (type === 'sports' ? '#d23b2e' : type === 'taxi' ? '#f2c230' : type === 'police' ? '#1e3a5f' : '#7a8a99'),
    owner: owner || 'traffic',
    maxSpeed: spec.maxSpeed, accel: spec.accel, turn: spec.turn,
    length: spec.length, width: spec.width,
    hp: 100, wheelSpin: 0, brakeLight: false,
  };
}

// --- building spatial index (road-block grid, 260u cells) -----------------
function buildBuildingIndex(buildings) {
  const map = new Map();
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    const x0 = Math.floor((b.x - b.w / 2 - 130) / 260);
    const x1 = Math.floor((b.x + b.w / 2 - 130) / 260);
    const y0 = Math.floor((b.y - b.d / 2 - 130) / 260);
    const y1 = Math.floor((b.y + b.d / 2 - 130) / 260);
    for (let bx = x0; bx <= x1; bx++) {
      for (let by = y0; by <= y1; by++) {
        const k = bx + ',' + by;
        let arr = map.get(k);
        if (!arr) { arr = []; map.set(k, arr); }
        arr.push(i);
      }
    }
  }
  return map;
}

function collideBuildings(S, x, y, r, out) {
  out.x = 0; out.y = 0;
  const x0 = Math.floor((x - r - 130) / 260);
  const x1 = Math.floor((x + r - 130) / 260);
  const y0 = Math.floor((y - r - 130) / 260);
  const y1 = Math.floor((y + r - 130) / 260);
  let hit = false;
  const tmp = { x: 0, y: 0 };
  for (let bx = x0; bx <= x1; bx++) {
    for (let by = y0; by <= y1; by++) {
      const arr = S.buildingIndex.get(bx + ',' + by);
      if (!arr) continue;
      for (const i of arr) {
        const b = S.city.buildings[i];
        if (pushOutCircleBox(x, y, r, b.x, b.y, b.w, b.d, tmp)) {
          out.x += tmp.x; out.y += tmp.y;
          hit = true;
        }
      }
    }
  }
  return hit;
}

// --- game construction -----------------------------------------------------
export function createGame(seed) {
  const rng = makeRng(seed || 1);
  const city = generateCity(seed || 1);
  const S = {
    seed: seed || 1,
    rng,
    time: 0,
    city,
    buildingIndex: buildBuildingIndex(city.buildings),
    player: {
      x: city.places.apartment.x, y: city.places.apartment.y,
      angle: 0, speed: 0, hp: PLAYER.hp, cash: 0,
      car: null, onFoot: true,
    },
    cars: [],
    peds: [],
    cops: [],
    wanted: { level: 0, heat: 0 },
    lastCrimeAt: -100,
    mission: { active: false, index: 0, stage: 0, data: {} },
    stats: { missionsDone: 0, shotsFired: 0, carsStolen: 0 },
    flags: { menu: true, started: false, paused: false, wasted: false, busted: false },
    input: { keys: new Set(), justPressed: new Set() },
    aimAngle: 0,
    effects: createEffects(),
    events: [],
    taxi: { state: 'idle', timer: 6, customer: null, dest: null, fare: 0 },
    lastShotAt: -100,
    respawnTimer: 0,
  };

  // Traffic: ten cars cruising the road grid.
  const colors = ['#7a8a99', '#a03a2e', '#3a6ea0', '#c9a227', '#5a7d5a', '#8a6a9a', '#b0b0b0'];
  for (let i = 0; i < 10; i++) {
    const vertical = rng.chance(0.5);
    const roads = vertical ? city.roads.vertical : city.roads.horizontal;
    const line = roads[Math.floor(rng.next() * roads.length)];
    const along = rng.range(80, 1920);
    const dir = rng.chance(0.5) ? 1 : -1;
    const car = makeCar(rng.pick(['sedan', 'sedan', 'taxi']), vertical ? line : along, vertical ? along : line, vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI), colors[Math.floor(rng.next() * colors.length)], 'traffic');
    car.speed = rng.range(110, 175);
    car.road = vertical ? 'v' : 'h';
    car.line = line;
    car.dir = dir;
    S.cars.push(car);
  }

  // Pedestrians strolling the sidewalks.
  const pedColors = ['#c9a227', '#7a8a99', '#a03a2e', '#5a7d5a', '#8a6a9a', '#d9c7a7', '#3a6ea0'];
  for (let i = 0; i < 24; i++) {
    S.peds.push({
      x: rng.range(80, 2520), y: rng.range(80, 1980),
      angle: rng.next() * Math.PI * 2, speed: rng.range(35, 65),
      kind: 'civilian', color: pedColors[Math.floor(rng.next() * pedColors.length)],
      state: 'walk', timer: rng.range(1, 4),
    });
  }

  return S;
}

/** Restore a save blob (from loadSave) into a fresh game. */
export function applySave(S, save) {
  if (!save) return;
  S.player.cash = save.cash || 0;
  S.stats.missionsDone = save.missionIndex || 0;
  S.mission.index = save.missionIndex || 0;
}

// --- crime / wanted --------------------------------------------------------
function addCrime(S, kind) {
  const heat = WANTED.crimeHeat[kind] || 10;
  S.wanted.heat = Math.min(150, S.wanted.heat + heat);
  S.wanted.level = Math.min(WANTED.maxLevel, Math.floor(S.wanted.heat / WANTED.heatPerLevel));
  S.lastCrimeAt = S.time;
  S.events.push({ type: 'crime', level: S.wanted.level });
}

function pushEvent(S, e) {
  S.events.push(e);
  if (S.events.length > 60) S.events.shift();
}

// --- player ----------------------------------------------------------------
function updatePlayer(S, dt) {
  const p = S.player;
  const keys = S.input.keys;
  const out = { x: 0, y: 0 };

  if (p.onFoot) {
    let mx = 0; let my = 0;
    if (keys.has('up')) my -= 1;
    if (keys.has('down')) my += 1;
    if (keys.has('left')) mx -= 1;
    if (keys.has('right')) mx += 1;
    if (mx !== 0 || my !== 0) {
      const len = Math.hypot(mx, my);
      mx /= len; my /= len;
      p.angle = Math.atan2(my, mx);
      p.x += mx * PLAYER.walkSpeed * dt;
      p.y += my * PLAYER.walkSpeed * dt;
      p.speed = PLAYER.walkSpeed;
    } else {
      p.speed = 0;
    }
    if (collideBuildings(S, p.x, p.y, PLAYER.radius, out)) { p.x += out.x; p.y += out.y; }
    p.x = clamp(p.x, 24, WORLD.w - 24);
    p.y = clamp(p.y, 24, WORLD.h - 24);

    if (S.input.justPressed.has('enter')) {
      let best = null; let bestD = PLAYER.enterRange * PLAYER.enterRange;
      for (const car of S.cars) {
        const d2 = (car.x - p.x) ** 2 + (car.y - p.y) ** 2;
        if (d2 < bestD) { best = car; bestD = d2; }
      }
      if (best) {
        if (best.owner === 'traffic') { addCrime(S, 'steal'); S.stats.carsStolen += 1; }
        best.owner = 'player';
        p.car = best; p.onFoot = false;
        pushEvent(S, { type: 'enter-car' });
      }
    }
    return;
  }

  // Driving.
  const car = p.car;
  if (!car) { p.onFoot = true; return; }
  const spec = car;
  if (keys.has('up')) car.speed += spec.accel * dt;
  if (keys.has('down')) car.speed -= spec.accel * 0.6 * dt;
  if (keys.has('brake')) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 420 * dt);
  car.speed -= car.speed * 0.35 * dt; // rolling resistance
  car.speed = clamp(car.speed, -70, spec.maxSpeed);
  const steer = clamp(car.speed / 130, -1, 1);
  if (keys.has('left')) car.angle -= spec.turn * steer * dt;
  if (keys.has('right')) car.angle += spec.turn * steer * dt;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.wheelSpin += car.speed * dt * 0.12;
  car.brakeLight = keys.has('brake') || keys.has('down');
  if (collideBuildings(S, car.x, car.y, 26, out)) {
    car.x += out.x; car.y += out.y;
    if (Math.abs(car.speed) > 120) {
      pushEvent(S, { type: 'crash' });
      burst(S.effects, car.x, car.y, 6, '#ffb347', 10, 90);
    }
    car.speed *= 0.45;
  }
  car.x = clamp(car.x, 24, WORLD.w - 24);
  car.y = clamp(car.y, 24, WORLD.h - 24);
  p.x = car.x; p.y = car.y; p.angle = car.angle; p.speed = Math.abs(car.speed);

  if (S.input.justPressed.has('enter')) {
    p.onFoot = true;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 42;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 42;
    car.speed = 0;
    p.car = null;
    pushEvent(S, { type: 'exit-car' });
  }
}

// --- traffic + pedestrians (ambient, always alive) -------------------------
function updateTraffic(S, dt) {
  const roads = S.city.roads;
  for (const car of S.cars) {
    if (car.owner !== 'traffic') continue;
    // Drive along its road; at a crossing, sometimes turn onto it.
    const along = car.road === 'v' ? car.y : car.x;
    const lines = car.road === 'v' ? roads.horizontal : roads.vertical;
    for (const line of lines) {
      if (Math.abs(along - line) < 12 && S.rng.chance(0.004)) {
        car.road = car.road === 'v' ? 'h' : 'v';
        car.line = line;
        car.dir = S.rng.chance(0.5) ? 1 : -1;
        break;
      }
    }
    if (car.road === 'v') {
      car.y += car.dir * car.speed * dt;
      car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      car.x = car.line - 18 * car.dir;
      if (car.y < 60) car.dir = 1;
      if (car.y > WORLD.h - 60) car.dir = -1;
    } else {
      car.x += car.dir * car.speed * dt;
      car.angle = car.dir > 0 ? 0 : Math.PI;
      car.y = car.line - 18 * car.dir;
      if (car.x < 60) car.dir = 1;
      if (car.x > WORLD.w - 60) car.dir = -1;
    }
    car.wheelSpin += car.speed * dt * 0.12;
  }
}

function updatePeds(S, dt) {
  const out = { x: 0, y: 0 };
  for (const ped of S.peds) {
    if (ped.kind === 'taxi') continue; // taxi customer waits for a ride
    ped.timer -= dt;
    if (ped.state === 'flee') {
      if (ped.timer <= 0) { ped.state = 'walk'; ped.timer = 2 + S.rng.next() * 3; }
    } else if (ped.timer <= 0) {
      ped.angle = S.rng.next() * Math.PI * 2;
      ped.timer = 2 + S.rng.next() * 3;
    }
    const sp = ped.state === 'flee' ? 130 : ped.speed;
    ped.x += Math.cos(ped.angle) * sp * dt;
    ped.y += Math.sin(ped.angle) * sp * dt;
    if (collideBuildings(S, ped.x, ped.y, 10, out)) { ped.x += out.x; ped.y += out.y; ped.angle += Math.PI / 2; }
    if (ped.x < 30 || ped.x > WORLD.w - 30) ped.angle = Math.PI - ped.angle;
    if (ped.y < 30 || ped.y > WORLD.h - 30) ped.angle = -ped.angle;
    ped.x = clamp(ped.x, 24, WORLD.w - 24);
    ped.y = clamp(ped.y, 24, WORLD.h - 24);
  }
  // A recent gunshot sends nearby civilians running.
  if (S.time - S.lastShotAt < 1.5) {
    for (const ped of S.peds) {
      if (ped.kind !== 'civilian') continue;
      const d = dist(ped.x, ped.y, S.player.x, S.player.y);
      if (d < 320 && ped.state !== 'flee') {
        ped.state = 'flee';
        ped.timer = 2;
        ped.angle = angleTo(S.player.x, S.player.y, ped.x, ped.y);
      }
    }
  }
}

// --- police ------------------------------------------------------------------
function updateCops(S, dt) {
  const p = S.player;
  const level = S.wanted.level;
  const wantCars = level > 0 ? Math.min(level, 3) : 0;
  const copCars = S.cops.filter((c) => c.car);
  const footCops = S.cops.filter((c) => !c.car);

  // Spawn interceptor cars up to the wanted level.
  if (copCars.length < wantCars) {
    const a = S.rng.next() * Math.PI * 2;
    const x = clamp(p.x + Math.cos(a) * 420, 60, WORLD.w - 60);
    const y = clamp(p.y + Math.sin(a) * 420, 60, WORLD.h - 60);
    const car = makeCar('police', x, y, angleTo(x, y, p.x, p.y), '#1e3a5f', 'police');
    car.speed = 200;
    S.cars.push(car);
    S.cops.push({ car, kind: 'cop', catchTimer: 0 });
  }
  // Too many cops: the farthest one gives up.
  if (copCars.length > wantCars && S.rng.chance(dt)) {
    let far = null; let farD = -1;
    for (const c of S.cops) {
      if (!c.car) continue;
      const d = dist(c.car.x, c.car.y, p.x, p.y);
      if (d > farD) { farD = d; far = c; }
    }
    if (far) {
      S.cops.splice(S.cops.indexOf(far), 1);
      const i = S.cars.indexOf(far.car);
      if (i >= 0) S.cars.splice(i, 1);
    }
  }

  const out = { x: 0, y: 0 };
  for (const cop of [...S.cops]) {
    if (cop.car) {
      const car = cop.car;
      const target = angleTo(car.x, car.y, p.x, p.y);
      car.angle = turnToward(car.angle, target, 3.4 * dt);
      car.speed = Math.min(car.speed + 130 * dt, 300);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      car.wheelSpin += car.speed * dt * 0.12;
      if (collideBuildings(S, car.x, car.y, 26, out)) { car.x += out.x; car.y += out.y; car.speed *= 0.6; }
      const d = dist(car.x, car.y, p.x, p.y);
      if (d < 64) {
        // Ram the player's car, or deploy a foot cop when on foot.
        if (p.car) {
          p.car.x += Math.cos(car.angle) * 60 * dt;
          p.car.y += Math.sin(car.angle) * 60 * dt;
          if (S.rng.chance(dt * 2)) pushEvent(S, { type: 'crash' });
        } else if (footCops.length < Math.min(level, 3)) {
          const foot = {
            x: car.x, y: car.y, angle: car.angle, speed: 175,
            kind: 'cop', color: '#1e3a5f', catchTimer: 0, state: 'chase',
          };
          S.cops.push({ car: null, ped: foot, kind: 'cop', catchTimer: 0 });
          S.peds.push(foot);
        }
      }
    } else if (cop.ped) {
      const foot = cop.ped;
      const d = dist(foot.x, foot.y, p.x, p.y);
      foot.angle = angleTo(foot.x, foot.y, p.x, p.y);
      foot.x += Math.cos(foot.angle) * foot.speed * dt;
      foot.y += Math.sin(foot.angle) * foot.speed * dt;
      if (collideBuildings(S, foot.x, foot.y, 12, out)) { foot.x += out.x; foot.y += out.y; }
      if (d < 26) {
        cop.catchTimer += dt;
        if (cop.catchTimer > WANTED.bustTime) {
          bustPlayer(S);
          return;
        }
      } else {
        cop.catchTimer = Math.max(0, cop.catchTimer - dt * 2);
      }
      if (d > 700) {
        // Lost the trail: the foot cop gives up.
        S.cops.splice(S.cops.indexOf(cop), 1);
        const i = S.peds.indexOf(foot);
        if (i >= 0) S.peds.splice(i, 1);
      }
    }
  }
}

function clearCops(S) {
  for (const cop of S.cops) {
    if (cop.car) {
      const i = S.cars.indexOf(cop.car);
      if (i >= 0) S.cars.splice(i, 1);
    }
    if (cop.ped) {
      const i = S.peds.indexOf(cop.ped);
      if (i >= 0) S.peds.splice(i, 1);
    }
  }
  S.cops = [];
}

function bustPlayer(S) {
  const p = S.player;
  p.cash = Math.max(0, p.cash - 100);
  p.hp = PLAYER.hp;
  S.wanted.level = 0; S.wanted.heat = 0;
  clearCops(S);
  failMission(S);
  S.flags.busted = true;
  S.respawnTimer = 2.5;
  pushEvent(S, { type: 'busted' });
}

function wastePlayer(S) {
  const p = S.player;
  p.cash = Math.max(0, p.cash - 100);
  p.hp = PLAYER.hp;
  S.wanted.level = 0; S.wanted.heat = 0;
  clearCops(S);
  failMission(S);
  S.flags.wasted = true;
  S.respawnTimer = 2.5;
  pushEvent(S, { type: 'wasted' });
}

// --- gang (mission enemies) --------------------------------------------------
function updateGang(S, dt) {
  const gang = (S.mission.data && S.mission.data.gang) || [];
  const p = S.player;
  for (const g of gang) {
    if (g.hp <= 0) continue;
    const d = dist(g.x, g.y, p.x, p.y);
    if (d < 380) {
      g.state = 'attack';
      g.angle = angleTo(g.x, g.y, p.x, p.y);
      g.shootTimer -= dt;
      if (g.shootTimer <= 0) {
        g.shootTimer = 1.6;
        // A gang member's shot: hurts on foot, dents the car.
        tracer(S.effects, g.x, g.y, 14, p.x, p.y, 10, '#ff6a5e');
        if (p.onFoot) {
          p.hp -= 8;
          if (p.hp <= 0) { wastePlayer(S); return; }
        } else if (p.car) {
          p.car.hp -= 4;
        }
      }
      if (d > 170) {
        g.x += Math.cos(g.angle) * 55 * dt;
        g.y += Math.sin(g.angle) * 55 * dt;
      }
    } else {
      g.state = 'guard';
    }
  }
}

// --- shooting ------------------------------------------------------------------
function updateShooting(S) {
  if (!S.input.justPressed.has('shoot')) return;
  if (!S.flags.started || S.flags.menu || S.flags.paused) return;
  const p = S.player;
  const ox = p.x; const oy = p.y;
  const aim = S.aimAngle;
  S.stats.shotsFired += 1;
  S.lastShotAt = S.time;
  addCrime(S, 'shoot');

  let best = null; let bestD = GUN_RANGE;
  const targets = [];
  const gang = (S.mission.data && S.mission.data.gang) || [];
  for (const g of gang) if (g.hp > 0) targets.push(g);
  for (const cop of S.cops) if (cop.ped) targets.push(cop.ped);
  for (const ped of S.peds) if (ped.kind === 'civilian') targets.push(ped);
  for (const t of targets) {
    const d = dist(ox, oy, t.x, t.y);
    if (d > GUN_RANGE) continue;
    const ad = Math.abs(angleDiff(aim, angleTo(ox, oy, t.x, t.y)));
    if (ad < 0.3 && d < bestD) { best = t; bestD = d; }
  }
  if (best) {
    best.hp -= GUN_DAMAGE;
    tracer(S.effects, ox, oy, 14, best.x, best.y, 12, '#ffd76a');
    burst(S.effects, best.x, best.y, 10, '#ff6a5e', 8, 80);
    if (best.hp <= 0 && best.kind === 'civilian') {
      addCrime(S, 'kill');
      const i = S.peds.indexOf(best);
      if (i >= 0) S.peds.splice(i, 1);
      floater(S.effects, best.x, best.y, 'VBPD alerted', '#ff6a5e');
    }
  } else {
    const tx = ox + Math.cos(aim) * 300;
    const ty = oy + Math.sin(aim) * 300;
    tracer(S.effects, ox, oy, 14, tx, ty, 12, '#ffd76a');
    burst(S.effects, tx, ty, 6, '#ffd76a', 4, 50);
  }
  pushEvent(S, { type: 'shot' });
}

// --- taxi side job -------------------------------------------------------------
function updateTaxi(S, dt) {
  const t = S.taxi;
  const p = S.player;
  if (t.state === 'idle') {
    if (p.car) {
      t.timer -= dt;
      if (t.timer <= 0) {
        const keys = Object.keys(S.city.places);
        const spot = S.city.places[keys[Math.floor(S.rng.next() * keys.length)]];
        const customer = {
          x: spot.x + 20, y: spot.y + 20, angle: 0, speed: 0,
          kind: 'taxi', color: '#f2c230', state: 'wait', timer: 0,
        };
        S.peds.push(customer);
        t.customer = customer;
        t.state = 'waiting';
        pushEvent(S, { type: 'taxi-waiting' });
      }
    }
    return;
  }
  if (t.state === 'waiting') {
    const c = t.customer;
    if (!c || !p.car) { t.state = 'idle'; t.timer = 6; return; }
    if (dist(p.car.x, p.car.y, c.x, c.y) < 45 && Math.abs(p.car.speed) < 40) {
      const i = S.peds.indexOf(c);
      if (i >= 0) S.peds.splice(i, 1);
      const keys = Object.keys(S.city.places);
      t.dest = S.city.places[keys[Math.floor(S.rng.next() * keys.length)]];
      t.fare = 50 + Math.round(dist(c.x, c.y, t.dest.x, t.dest.y) / 15);
      t.state = 'riding';
      pushEvent(S, { type: 'taxi-pickup' });
    }
    return;
  }
  // riding
  if (!p.car) { t.state = 'idle'; t.timer = 6; t.customer = null; return; }
  if (dist(p.car.x, p.car.y, t.dest.x, t.dest.y) < 60) {
    p.cash += t.fare;
    floater(S.effects, p.car.x, p.car.y, `+$${t.fare}`, '#7dff8a');
    pushEvent(S, { type: 'taxi-fare', fare: t.fare });
    t.state = 'idle'; t.timer = 8; t.customer = null; t.dest = null;
  }
}

// --- main step -------------------------------------------------------------------
export function update(S, dt) {
  S.time += dt;
  updateEffects(S.effects, dt);
  updateTraffic(S, dt);
  updatePeds(S, dt);

  // Busted / wasted: wait out the respawn timer, then drop the player
  // back into the city.
  if (S.flags.busted || S.flags.wasted) {
    S.respawnTimer -= dt;
    if (S.respawnTimer <= 0) {
      const spot = S.flags.busted ? S.city.places.station : S.city.places.hospital;
      const p = S.player;
      p.x = spot.x; p.y = spot.y; p.angle = 0; p.speed = 0;
      p.car = null; p.onFoot = true; p.hp = PLAYER.hp;
      S.flags.busted = false; S.flags.wasted = false;
    }
    return;
  }
  if (!S.flags.started || S.flags.paused || S.flags.menu) return;

  updatePlayer(S, dt);
  updateShooting(S);
  updateCops(S, dt);
  updateGang(S, dt);
  updateTaxi(S, dt);

  // Wanted heat cools off when the player keeps clean for a while.
  if (S.time - S.lastCrimeAt > 5 && S.wanted.heat > 0) {
    S.wanted.heat = Math.max(0, S.wanted.heat - WANTED.decayPerSecond * dt);
    S.wanted.level = Math.min(WANTED.maxLevel, Math.floor(S.wanted.heat / WANTED.heatPerLevel));
  }

  updateMission(S, dt);
}
