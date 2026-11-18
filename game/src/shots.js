// Screenshot modes for ?shot=start|drive|chase|mission&seed=N. Each one puts
// the game in a readable state for the cover sheet: the city on foot, a car
// on the road, a police chase with wanted stars, and a mission in progress
// with the gold marker beam. main.js calls applyShot after the game boots.

import { startMission } from './missions.js';
import { makeCar } from './sim.js';

/** Put the game in the state a screenshot mode wants. */
export function applyShot(S, mode) {
  const p = S.player;
  S.flags.menu = false;
  S.flags.started = true;
  S.flags.shot = mode;

  if (mode === 'start') {
    // On foot at Liberty Plaza, downtown skyline behind.
    p.x = 1100;
    p.y = 1000;
    p.angle = -Math.PI / 2;
    p.aimAngle = p.angle;
  } else if (mode === 'drive') {
    // Driving a sportscar down the downtown avenue.
    const car = makeCar('sport', 1100, 900, -Math.PI / 2, '#d90429', 'player');
    S.cars.push(car);
    p.car = car;
    p.onFoot = false;
    car.speed = 420;
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
  } else if (mode === 'chase') {
    // Wanted 3, two cop cars closing in, player driving east down the
    // y=1050 avenue toward the bridge — a clear run so the camera, the
    // player car and the cops all read in one frame.
    const car = makeCar('sport', 2050, 1050, 0, '#d90429', 'player');
    S.cars.push(car);
    p.car = car;
    p.onFoot = false;
    car.speed = 520;
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    S.wanted.level = 3;
    S.wanted.heat = 100;
    S.lastCrimeAt = S.time;
    for (const [cx, cy] of [[1850, 1050], [1750, 1085]]) {
      const cop = makeCar('cop', cx, cy, 0, '#1b263b', 'cop');
      cop.driver = 'cop';
      cop.speed = 500;
      S.cops.push(cop);
      S.cars.push(cop);
    }
  } else if (mode === 'mission') {
    // Mission 7 (Island Run) mid-delivery: the bridge chase, beam on the depot.
    startMission(S, 6);
    S.mission.stage = 2;
    const car = makeCar('sport', 2500, 1050, 0, '#d90429', 'player');
    S.cars.push(car);
    p.car = car;
    p.onFoot = false;
    car.speed = 480;
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    S.wanted.level = 2;
    S.wanted.heat = 100;
    S.lastCrimeAt = S.time;
    const cop = makeCar('cop', 2100, 980, 0, '#1b263b', 'cop');
    cop.driver = 'cop';
    cop.speed = 500;
    S.cops.push(cop);
    S.cars.push(cop);
    // The stage was forced to the delivery leg: show its text, not the pickup's.
    S.events.push('Island Run: Deliver the cargo to Isla Verde Depot');
  }
}
