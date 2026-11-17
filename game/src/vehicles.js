// Cars: arcade physics for the player, lane-following AI for traffic,
// and the shared helpers every system uses to find and move cars.
import { CAR_MODELS, ROAD_X, ROAD_Y, ROAD_W, BEACH_Y, WORLD_W, WORLD_H } from './config.js';
import { makeRng, range, pick, chance, clamp, angleDiff, dist } from './random.js';
import { pointInBuilding } from './city.js';

let nextId = 1;

export function makeCar(modelKey, x, y, angle, color, kind) {
  const m = CAR_MODELS[modelKey];
  return {
    id: nextId++,
    model: modelKey,
    name: m.name,
    x, y, angle,
    speed: 0,
    w: m.w, h: m.h,
    top: m.top, accel: m.accel, grip: m.grip,
    color: color || pick(Math.random, m.colors),
    kind: kind || 'traffic',   // traffic | parked | police | mission | player
    driver: kind === 'traffic',
    hp: 100,
    stuck: 0,
    crashT: 0,               // cooldown between building-impact damage ticks
    honkT: 0,
    lane: null,                // traffic AI: {road, dir, horizontal}
    targetSpeed: 0,
    brakeLight: false,
  };
}

export function randomTrafficCar(rng, city, nearX, nearY) {
  const models = ['sedan', 'sedan', 'taxi', 'van', 'sedan', 'muscle', 'truck', 'sedan'];
  const model = pick(rng, models);
  // Spawn on a road within ~700px of the player, or anywhere if none found.
  for (let tries = 0; tries < 12; tries++) {
    const horizontal = chance(rng, 0.5);
    let x, y, angle;
    if (horizontal) {
      const ry = pick(rng, ROAD_Y);
      x = clamp(nearX + range(rng, -700, 700), 90, WORLD_W - 90);
      y = ry + (chance(rng, 0.5) ? -ROAD_W / 4 : ROAD_W / 4);
      angle = chance(rng, 0.5) ? 0 : Math.PI;
    } else {
      const rx = pick(rng, ROAD_X);
      x = rx + (chance(rng, 0.5) ? -ROAD_W / 4 : ROAD_W / 4);
      y = clamp(nearY + range(rng, -700, 700), 90, BEACH_Y - 90);
      angle = chance(rng, 0.5) ? Math.PI / 2 : -Math.PI / 2;
    }
    if (pointInBuilding(city, x, y, 4)) continue;
    const car = makeCar(model, x, y, angle, null, 'traffic');
    car.speed = range(rng, 90, 170);
    car.targetSpeed = car.speed;
    car.lane = { horizontal, road: horizontal ? y : x, dir: angle };
    return car;
  }
  return null;
}

export function randomParkedCar(rng, city) {
  const models = ['sedan', 'muscle', 'van', 'sedan', 'sport'];
  const model = pick(rng, models);
  for (let tries = 0; tries < 16; tries++) {
    const horizontal = chance(rng, 0.5);
    let x, y, angle;
    if (horizontal) {
      x = range(rng, 90, WORLD_W - 90);
      y = pick(rng, ROAD_Y) + (chance(rng, 0.5) ? 1 : -1) * (ROAD_W / 2 + 14);
      angle = chance(rng, 0.5) ? 0 : Math.PI;
    } else {
      x = pick(rng, ROAD_X) + (chance(rng, 0.5) ? 1 : -1) * (ROAD_W / 2 + 14);
      y = range(rng, 90, BEACH_Y - 90);
      angle = chance(rng, 0.5) ? Math.PI / 2 : -Math.PI / 2;
    }
    if (y > BEACH_Y - 40 || pointInBuilding(city, x, y, 6)) continue;
    const car = makeCar(model, x, y, angle, null, 'parked');
    return car;
  }
  return null;
}

// Arcade driving: throttle/steer inputs in [-1, 1].
export function driveCar(car, throttle, steer, brake, dt, city) {
  const m = car;
  const forward = Math.cos(m.angle);
  const side = Math.sin(m.angle);
  const speedAlong = m.speed;
  if (throttle > 0) m.speed += m.accel * throttle * dt;
  if (throttle < 0) m.speed += m.accel * throttle * 0.7 * dt; // reverse is weaker
  if (brake) m.speed -= Math.sign(m.speed) * Math.min(Math.abs(m.speed), 520 * dt);
  // Drag + rolling resistance.
  m.speed -= m.speed * 0.55 * dt;
  if (Math.abs(m.speed) < 4 && throttle === 0) m.speed = 0;
  m.speed = clamp(m.speed, -m.top * 0.45, m.top);
  // Steering scales with speed, weaker at very low speed.
  const steerAuthority = clamp(Math.abs(m.speed) / 90, 0, 1) * (m.speed >= 0 ? 1 : -1);
  m.angle += steer * m.grip * 0.42 * steerAuthority * dt * (brake ? 1.5 : 1);
  const nx = m.x + Math.cos(m.angle) * m.speed * dt;
  const ny = m.y + Math.sin(m.angle) * m.speed * dt;
  // Buildings block cars; the beach and water slow them hard.
  if (m.crashT > 0) m.crashT -= dt;
  const hit = pointInBuilding(city, nx, ny, m.w / 2 - 4);
  if (hit) {
    m.speed *= -0.25;
    // Damage once per scrape, scaled by impact speed — never a per-frame drain.
    if (m.crashT <= 0 && Math.abs(m.speed) > 40) {
      m.hp -= Math.min(14, Math.abs(m.speed) * 0.05 + 3);
      m.crashT = 0.6;
      return { crashed: true, x: m.x, y: m.y };
    }
    return { crashed: false };
  }
  m.x = clamp(nx, 40, WORLD_W - 40);
  m.y = clamp(ny, 40, WORLD_H - 40);
  if (m.y > BEACH_Y + 40) m.speed *= (1 - 1.6 * dt);
  if (m.y >= WORLD_H - 46) { m.y = WORLD_H - 46; m.speed *= 0.4; }
  m.brakeLight = brake || throttle < 0;
  return { crashed: false };
}

// Traffic AI: follow the lane, slow for the car ahead, turn at intersections.
export function updateTraffic(car, S, dt) {
  const lane = car.lane;
  if (!lane) return;
  // Car ahead on the same lane?
  let ahead = null;
  for (const o of S.cars) {
    if (o === car || o.kind === 'parked') continue;
    const d = dist(car.x, car.y, o.x, o.y);
    if (d < 70) {
      const ang = Math.atan2(o.y - car.y, o.x - car.x);
      if (Math.abs(angleDiff(car.angle, ang)) < 0.6) { ahead = o; break; }
    }
  }
  const want = ahead ? Math.max(0, ahead.speed * 0.8) : car.targetSpeed;
  car.speed += clamp(want - car.speed, -260 * dt, 150 * dt);
  // Steer back onto the lane centre.
  const lateral = lane.horizontal ? (car.y - lane.road) : (car.x - lane.road);
  const desired = lane.dir;
  car.angle += angleDiff(car.angle, desired) * Math.min(1, 2.2 * dt);
  car.angle += clamp(-lateral * 0.002, -0.5, 0.5) * dt * 2;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  // At an intersection, sometimes turn onto the crossing road.
  const atX = ROAD_X.some((rx) => Math.abs(car.x - rx) < 26);
  const atY = ROAD_Y.some((ry) => Math.abs(car.y - ry) < 26);
  if ((atX || atY) && Math.random() < dt * 0.12) {
    if (lane.horizontal && atX) {
      const rx = ROAD_X.reduce((a, b) => Math.abs(b - car.x) < Math.abs(a - car.x) ? b : a);
      car.lane = { horizontal: false, road: rx, dir: Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2 };
      car.x = rx + (car.speed > 0 ? -ROAD_W / 4 : ROAD_W / 4);
    } else if (!lane.horizontal && atY) {
      const ry = ROAD_Y.reduce((a, b) => Math.abs(b - car.y) < Math.abs(a - car.y) ? b : a);
      car.lane = { horizontal: true, road: ry, dir: Math.random() < 0.5 ? 0 : Math.PI };
      car.y = ry + (car.speed > 0 ? -ROAD_W / 4 : ROAD_W / 4);
    }
  }
  // Wrap around the map edges so traffic never runs out.
  if (car.x < 50) { car.x = WORLD_W - 60; }
  if (car.x > WORLD_W - 50) { car.x = 60; }
  if (car.y < 50) { car.y = BEACH_Y - 60; }
  if (car.y > BEACH_Y - 40) { car.y = 60; }
}

export function carOverlaps(a, b) {
  return Math.abs(a.x - b.x) < (a.w + b.w) / 2 - 6 && Math.abs(a.y - b.y) < (a.h + b.h) / 2 - 6;
}
