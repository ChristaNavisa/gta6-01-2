// Game state and the per-frame update: the one place every system meets.
import { WORLD_W, WORLD_H, ROAD_X, ROAD_Y, BEACH_Y, PLAYER } from './config.js';
import { makeRng, range, clamp, dist } from './random.js';
import { generateCity } from './city.js';
import { createPlayer, updatePlayer, exitCar, hurtPlayer, commitCrime } from './player.js';
import { pointInBuilding } from './city.js';
import { makeCar, randomTrafficCar, randomParkedCar, driveCar, updateTraffic } from './vehicles.js';
import { makePed, updatePed } from './pedestrians.js';
import { updateWanted } from './police.js';
import { createMissionState, startMission, updateMission, updateTaxi } from './missions.js';
import { updateEffects, spawnBurst, spawnExplosion, addSkid } from './effects.js';
import { sfx, setEngine, stopSiren, startSiren } from './audio.js';
import { loadSave, writeSave } from './save.js';

export function createGame(seed) {
  const rng = makeRng(seed);
  const city = generateCity(seed);
  const S = {
    seed, rng, city,
    time: 0,
    view: { w: 1280, h: 800 },
    ctx: null, hud: null, input: null,
    camera: { x: 500, y: 800, zoom: 1, snap: true },
    player: createPlayer(500, 830),
    cars: [], peds: [], cops: [],
    bullets: [], particles: [], skids: [], floaters: [],
    wanted: { level: 0, heat: 0, lastCrime: -999, decayAt: 0, seenByCop: false, lastSpawn: 0 },
    mission: createMissionState(),
    taxi: { active: false, stage: '', marker: null, fare: 0 },
    stats: { missionsDone: 0, carsStolen: 0, bestCash: 0 },
    flags: { menu: true, started: false, paused: false, wasted: false, wastedT: 0, busted: false, shotsFired: 0 },
    message: '', messageT: 0,
    saveT: 0,
    audio: {
      door: () => sfx.door(),
      startSiren: () => startSiren(),
      enemyShoot: () => sfx.enemyShoot(),
    },
  };
  // Parked cars and walkers scattered through the city.
  for (let i = 0; i < 12; i++) {
    const c = randomParkedCar(rng, city);
    if (c) S.cars.push(c);
  }
  for (let i = 0; i < 10; i++) {
    const c = randomTrafficCar(rng, city, 1100, 800);
    if (c) S.cars.push(c);
  }
  for (let i = 0; i < 18; i++) S.peds.push(makePed(rng, city));
  // The player's own starter car outside the garage.
  const starter = makeCar('sedan', 560, 830, 0, '#2e5fa3', 'parked');
  S.cars.push(starter);
  return S;
}

export function applySave(S, save) {
  if (!save) return;
  S.player.cash = save.cash;
  S.stats.missionsDone = save.missionsDone;
  S.stats.carsStolen = save.carsStolen;
  S.stats.bestCash = save.bestCash;
  S.mission.index = save.missionIndex;
}

export function update(S, dt) {
  S.time += dt;
  if (S.messageT > 0) S.messageT -= dt;

  if (S.flags.menu) {
    // Attract mode: traffic drifts, camera slowly pans over downtown.
    S.camera.x = 1100 + Math.sin(S.time * 0.05) * 260;
    S.camera.y = 800 + Math.cos(S.time * 0.04) * 160;
    S.camera.zoom = 0.9;
    for (const c of S.cars) if (c.kind === 'traffic') updateTraffic(c, S, dt);
    for (const p of S.peds) updatePed(p, S, dt);
    updateEffects(S, dt);
    return;
  }
  if (S.flags.paused) { setEngine(0, false); return; }

  // Busted overlay clears after a few seconds.
  if (S.flags.busted) {
    S.flags.bustedT = (S.flags.bustedT || 0) + dt;
    if (S.flags.bustedT > 3) S.flags.busted = false;
  }

  // Wasted: show the overlay, then respawn at the hospital.
  if (S.flags.wasted) {
    S.flags.wastedT += dt;
    updateEffects(S, dt);
    if (S.flags.wastedT > 2.5) {
      const p = S.player;
      const h = S.city.places.hospital;
      p.hp = 50; p.cash = Math.max(0, p.cash - 200);
      p.x = h.x + 40; p.y = h.y + 60;
      p.onFoot = true; p.car = null;
      S.wanted.level = 0; S.wanted.heat = 0;
      stopSiren();
      S.flags.wasted = false;
      S.flags.wastedT = 0;
      S.camera.snap = true;
      S.message = 'You woke up at St. Alba. The city moves on.';
      S.messageT = 3;
    }
    return;
  }

  const p = S.player;
  const input = S.input;

  // Auto-start the next mission a few seconds after the last one.
  if (!S.mission.active && S.mission.index < 5 && S.time > (S.mission.nextAt || 0.6)) {
    startMission(S, S.mission.index);
  }

  // Player on foot or driving.
  if (p.onFoot) {
    updatePlayer(S, dt);
  } else if (p.car) {
    const car = p.car;
    let throttle = 0, steer = 0;
    if (input.keys.has('KeyW') || input.keys.has('ArrowUp')) throttle += 1;
    if (input.keys.has('KeyS') || input.keys.has('ArrowDown')) throttle -= 1;
    if (input.keys.has('KeyA') || input.keys.has('ArrowLeft')) steer -= 1;
    if (input.keys.has('KeyD') || input.keys.has('ArrowRight')) steer += 1;
    const brake = input.keys.has('Space');
    const res = driveCar(car, throttle, steer, brake, dt, S.city);
    if (res.crashed) {
      sfx.crash();
      spawnBurst(S, res.x, res.y, '#ffb703', 5, 140);
      if (car.hp <= 0) {
        spawnExplosion(S, car.x, car.y);
        S.cars.splice(S.cars.indexOf(car), 1);
        p.car = null; p.onFoot = true;
        hurtPlayer(S, 15);
      }
    }
    // Skid marks on hard steering at speed.
    if (Math.abs(car.speed) > 240 && steer !== 0) addSkid(S, car.x, car.y, car.angle);
    if (brake && Math.abs(car.speed) > 120) addSkid(S, car.x, car.y, car.angle);
    // Hitting a pedestrian while driving is a crime.
    for (const ped of S.peds) {
      if (ped.state === 'down') continue;
      if (Math.abs(car.speed) > 140 && dist(car.x, car.y, ped.x, ped.y) < 30) {
        ped.hp = 0; ped.state = 'down';
        commitCrime(S, 1, 400);
        sfx.crash();
        spawnBurst(S, ped.x, ped.y, '#ff595e', 8, 160);
      }
    }
    // Exit the car.
    if (input.justPressed.has('KeyE')) exitCar(S);
    // Engine hum follows speed.
    setEngine(Math.abs(car.speed) / car.top, true);
    p.x = car.x; p.y = car.y;
    p.angle = car.angle;
  } else {
    setEngine(0, false);
  }

  // Traffic: keep the streets alive near the player.
  maintainTraffic(S, dt);
  maintainPeds(S, dt);
  for (const c of S.cars) if (c.kind === 'traffic') updateTraffic(c, S, dt);
  for (const ped of S.peds) updatePed(ped, S, dt);
  updateBullets(S, dt);
  updateWanted(S, dt);
  updateMission(S, dt);
  updateTaxi(S, dt);
  updateEffects(S, dt);
  updateCamera(S, dt);

  // Autosave every 12 seconds once playing.
  S.saveT += dt;
  if (S.saveT > 12) { S.saveT = 0; writeSave(S); }
}

function maintainTraffic(S, dt) {
  const p = S.player;
  // Remove traffic far from the player; top up near the player.
  for (let i = S.cars.length - 1; i >= 0; i--) {
    const c = S.cars[i];
    if (c.kind === 'traffic' && dist(c.x, c.y, p.x, p.y) > 1500) S.cars.splice(i, 1);
  }
  const traffic = S.cars.filter((c) => c.kind === 'traffic').length;
  if (traffic < 14) {
    const c = randomTrafficCar(S.rng, S.city, p.x, p.y);
    if (c) S.cars.push(c);
  }
}

function maintainPeds(S, dt) {
  const p = S.player;
  for (let i = S.peds.length - 1; i >= 0; i--) {
    const ped = S.peds[i];
    if (ped.state === 'down') continue;
    if (dist(ped.x, ped.y, p.x, p.y) > 1200) S.peds.splice(i, 1);
  }
  const walkers = S.peds.filter((x) => x.kind === 'walker' && x.state !== 'down').length;
  if (walkers < 16) S.peds.push(makePed(S.rng, S.city));
}

function updateBullets(S, dt) {
  for (let i = S.bullets.length - 1; i >= 0; i--) {
    const b = S.bullets[i];
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    let dead = b.life <= 0;
    if (!dead && pointInBuilding(S.city, b.x, b.y, 0)) { spawnBurst(S, b.x, b.y, '#ffd166', 2, 80); dead = true; }
    if (!dead && b.from === 'player') {
      for (const ped of S.peds) {
        if (ped.state === 'down' || ped.hp <= 0) continue;
        if (dist(b.x, b.y, ped.x, ped.y) < 15) {
          ped.hp -= b.damage;
          spawnBurst(S, ped.x, ped.y, '#ff595e', 6, 140);
          if (ped.hp <= 0) {
            ped.state = 'down';
            if (ped.kind === 'gang') { S.player.cash += 25; }
          }
          if (ped.kind === 'cop') commitCrime(S, 0.5, 500);
          dead = true;
          break;
        }
      }
      if (!dead) {
        for (const car of S.cars) {
          if (car.kind === 'player') continue;
          if (Math.abs(b.x - car.x) < car.w / 2 && Math.abs(b.y - car.y) < car.h / 2) {
            car.hp -= b.damage;
            spawnBurst(S, b.x, b.y, '#ffffff', 3, 120);
            if (car.kind === 'police') commitCrime(S, 0.5, 500);
            if (car.hp <= 0) {
              spawnExplosion(S, car.x, car.y);
              S.cars.splice(S.cars.indexOf(car), 1);
            }
            dead = true;
            break;
          }
        }
      }
    }
    if (!dead && (b.from === 'gang' || b.from === 'cop')) {
      const p = S.player;
      if (p.onFoot && dist(b.x, b.y, p.x, p.y) < 14) {
        hurtPlayer(S, b.damage);
        dead = true;
      } else if (p.car && Math.abs(b.x - p.car.x) < p.car.w / 2 && Math.abs(b.y - p.car.y) < p.car.h / 2) {
        p.car.hp -= b.damage;
        dead = true;
      }
    }
    if (dead) S.bullets.splice(i, 1);
  }
}

function updateCamera(S, dt) {
  const p = S.player;
  const tx = p.car ? p.car.x : p.x;
  const ty = p.car ? p.car.y : p.y;
  const targetZoom = p.car ? 0.82 : 1.0;
  if (S.camera.snap) {
    S.camera.x = tx; S.camera.y = ty;
    S.camera.zoom = targetZoom;
    S.camera.snap = false;
  } else {
    const k = 1 - Math.exp(-5 * dt);
    S.camera.x += (tx - S.camera.x) * k;
    S.camera.y += (ty - S.camera.y) * k;
    S.camera.zoom += (targetZoom - S.camera.zoom) * k;
  }
  // Never show the void past the city's edge.
  const hw = S.view.w / 2 / S.camera.zoom;
  const hh = S.view.h / 2 / S.camera.zoom;
  S.camera.x = clamp(S.camera.x, Math.min(hw, WORLD_W - hw), Math.max(hw, WORLD_W - hw));
  S.camera.y = clamp(S.camera.y, Math.min(hh, WORLD_H - hh), Math.max(hh, WORLD_H - hh));
}
