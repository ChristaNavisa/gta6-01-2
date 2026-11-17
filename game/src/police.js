// Wanted level: heat decays, police spawn, chase, ram, and arrest on foot.
import { WANTED, ROAD_X, ROAD_Y, ROAD_W, BEACH_Y, WORLD_W } from './config.js';
import { range, pick, chance, clamp, dist, angleDiff, angleTo } from './random.js';
import { makeCar, driveCar } from './vehicles.js';
import { makePed } from './pedestrians.js';
import { hurtPlayer, wantedText } from './player.js';
import { sfx, stopSiren } from './audio.js';
import { spawnBurst, spawnSmoke } from './effects.js';
import { nearestRoadPoint, hasLineOfSight } from './city.js';

export function updateWanted(S, dt) {
  const w = S.wanted;
  const p = S.player;
  // A cop that can see the player keeps the heat alive. Sight needs a clear
  // line past the buildings — a unit stuck behind a tower block loses you.
  let seen = false;
  for (const c of S.cops) {
    if (dist(p.x, p.y, c.x, c.y) < WANTED.copSightRange && hasLineOfSight(S.city, p.x, p.y, c.x, c.y)) seen = true;
  }
  for (const car of S.cars) {
    if (car.kind === 'police' && dist(p.x, p.y, car.x, car.y) < WANTED.copSightRange && hasLineOfSight(S.city, p.x, p.y, car.x, car.y)) seen = true;
  }
  w.seenByCop = seen;
  if (seen) w.noSeeT = 0;
  else w.noSeeT = (w.noSeeT || 0) + dt;
  // Break contact for 10 seconds and the units lose your trail entirely.
  if (w.level > 0 && w.noSeeT > 10) {
    despawnCops(S);
    w.noSeeT = 0;
  }

  if (w.level > 0 && !seen && S.time > w.decayAt) {
    // Cooling off: heat falls, then stars drop one at a time.
    w.heat = Math.max(0, w.heat - dt / WANTED.starDropTime);
    const level = Math.ceil(w.heat);
    if (level < w.level) {
      w.level = level;
      if (level === 0) {
        S.message = 'You lost them. Clean — for now.';
        S.messageT = 2.5;
        stopSiren();
        despawnCops(S);
      }
    }
  }
  if (w.level === 0) w.heat = 0;

  // Spawn police to match the wanted level.
  const wantCops = w.level === 0 ? 0 : Math.min(WANTED.maxCops, w.level + 1);
  const haveCars = S.cars.filter((c) => c.kind === 'police').length;
  const haveFoot = S.cops.length;
  if (haveCars + haveFoot < wantCops && S.time - (w.lastSpawn || 0) > 1.6) {
    w.lastSpawn = S.time;
    spawnPolice(S);
  }
  updatePoliceCars(S, dt);
  updateFootCops(S, dt);
}

function spawnPointNear(S, minD, maxD) {
  const p = S.player;
  for (let i = 0; i < 14; i++) {
    const a = S.rng() * Math.PI * 2;
    const d = range(S.rng, minD, maxD);
    const x = clamp(p.x + Math.cos(a) * d, 80, WORLD_W - 80);
    const y = clamp(p.y + Math.sin(a) * d, 80, BEACH_Y - 80);
    const rp = nearestRoadPoint(S.rng, x, y);
    if (rp && dist(p.x, p.y, rp.x, rp.y) > minD * 0.7) return rp;
  }
  return nearestRoadPoint(S.rng, p.x + 500, p.y);
}

function spawnPolice(S) {
  const p = S.player;
  const spawn = spawnPointNear(S, 620, 1000);
  if (!spawn) return;
  if (p.onFoot && S.wanted.level <= 2 && chance(S.rng, 0.5)) {
    // Foot cop on a low wanted level.
    const cop = makePed(S.rng, S.city, spawn.x, spawn.y, 'cop');
    S.cops.push(cop);
    return;
  }
  const car = makeCar('police', spawn.x, spawn.y, angleTo(spawn.x, spawn.y, p.x, p.y), '#1a1a2e', 'police');
  car.driver = true;
  S.cars.push(car);
  sfx.honk();
}

function updatePoliceCars(S, dt) {
  const p = S.player;
  for (let i = S.cars.length - 1; i >= 0; i--) {
    const car = S.cars[i];
    if (car.kind !== 'police') continue;
    const d = dist(car.x, car.y, p.x, p.y);
    if (S.wanted.level === 0) { car.kind = 'traffic'; car.lane = null; continue; }
    // Chase: steer at the player, full throttle, ram on contact.
    const want = angleTo(car.x, car.y, p.x, p.y);
    const steer = clamp(angleDiff(car.angle, want) * 1.6, -1, 1);
    const res = driveCar(car, 1, steer, false, dt, S.city);
    // A unit that makes no progress toward the player for 8 s has lost the
    // trail (wedged on a building, circling a block): it gives up and leaves,
    // so a fresh unit can try a new approach.
    if (car.chaseD === undefined || d < car.chaseD - 20) { car.chaseD = d; car.chaseT = 0; }
    else { car.chaseT = (car.chaseT || 0) + dt; }
    if (car.chaseT > 8) { S.cars.splice(i, 1); continue; }
    if (res.crashed) {
      spawnBurst(S, car.x, car.y, '#ffb703', 6, 160);
      sfx.crash();
    }
    if (car.hp < 55 && Math.random() < dt * 0.5) spawnSmoke(S, car.x, car.y - 8);
    if (car.hp <= 0) {
      spawnBurst(S, car.x, car.y, '#ff9f1c', 20, 260);
      S.cars.splice(i, 1);
      continue;
    }
    // Ramming the player's car hurts it; touching the player on foot hurts them.
    if (p.car === car) continue;
    if (p.car && dist(car.x, car.y, p.car.x, p.car.y) < 44) {
      p.car.hp -= 26 * dt * 4;
      p.car.speed *= (1 - 1.4 * dt);
      if (Math.random() < dt * 2) { spawnBurst(S, car.x, car.y, '#ffffff', 4, 140); sfx.crash(); }
      if (p.car.hp <= 0) {
        S.cars.splice(S.cars.indexOf(p.car), 1);
        p.car = null; p.onFoot = true;
        p.x = car.x + 40; p.y = car.y + 40;
        hurtPlayer(S, 20);
      }
    }
    if (p.onFoot && d < 26) {
      // A police car nudging the player on foot: shove + damage, and a chance to arrest.
      hurtPlayer(S, 8 * dt * 4);
    }
    // Too far away for too long: the unit gives up and respawns closer later.
    if (d > 1100) { S.cars.splice(i, 1); }
  }
}

function updateFootCops(S, dt) {
  const p = S.player;
  for (let i = S.cops.length - 1; i >= 0; i--) {
    const cop = S.cops[i];
    const d = dist(cop.x, cop.y, p.x, p.y);
    if (S.wanted.level === 0) { S.cops.splice(i, 1); continue; }
    if (d > 1300) { S.cops.splice(i, 1); continue; }
    // Foot cops chase on foot; catching the player starts an arrest.
    cop.angle = angleTo(cop.x, cop.y, p.x, p.y);
    if (d > 30) {
      cop.x += Math.cos(cop.angle) * 175 * dt;
      cop.y += Math.sin(cop.angle) * 175 * dt;
      // A foot cop wedged on a building for 8 s gives up too.
      if (cop.chaseD === undefined || d < cop.chaseD - 20) { cop.chaseD = d; cop.chaseT = 0; }
      else { cop.chaseT = (cop.chaseT || 0) + dt; }
      if (cop.chaseT > 8) { S.cops.splice(i, 1); continue; }
    } else if (p.onFoot) {
      cop.arrestT = (cop.arrestT || 0) + dt;
      if (cop.arrestT > 1.6) {
        bustPlayer(S);
        return;
      }
    }
    if (d > 60) cop.arrestT = 0;
  }
}

function despawnCops(S) {
  S.cops.length = 0;
  for (let i = S.cars.length - 1; i >= 0; i--) {
    if (S.cars[i].kind === 'police') S.cars.splice(i, 1);
  }
}

export function bustPlayer(S) {
  const p = S.player;
  S.flags.busted = true;
  S.flags.bustedT = 0;
  S.stats.busted += 1;
  const fine = Math.min(p.cash, 150 + S.wanted.level * 100);
  p.cash -= fine;
  S.wanted.level = 0;
  S.wanted.heat = 0;
  stopSiren();
  despawnCops(S);
  sfx.busted();
  S.message = `BUSTED — the VBPD took $${fine} in fines.`;
  S.messageT = 4;
  // Respawn at the police HQ, on foot.
  const hq = S.city.places.policeHQ;
  p.x = hq.x + 40; p.y = hq.y + 60;
  p.hp = Math.max(p.hp, 50);
  if (p.car) { p.car = null; p.onFoot = true; }
  S.camera.snap = true;
}
