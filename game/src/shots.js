// VERDE BAY 3D v7 — screenshot modes: the game stages itself for its own photos.
// ?shot=start shows the menu over the orbiting city; drive / chase / mission drop
// the player straight into the action so the screenshots show the systems.

import { startMission } from './missions.js';
import { makeCar } from './sim.js';

export function setupShot(S, mode) {
  const p = S.player;
  if (mode === 'start') {
    S.flags.menu = true;
    S.flags.started = false;
    return;
  }
  S.flags.menu = false;
  S.flags.started = true;

  if (mode === 'drive') {
    S.shot = 'drive';
    S.shotSpeed = 185;
    const car = makeCar('sport', 2050, 1500, 0, '#d7263d', 'player');
    S.cars.push(car);
    p.car = car;
    p.onFoot = false;
    p.x = car.x;
    p.y = car.y;
    p.angle = 0;
    car.speed = 185;
    car.nitro = 80;
  } else if (mode === 'chase') {
    S.shot = 'chase';
    S.shotSpeed = 205;
    const car = makeCar('sport', 1500, 1500, 0, '#d7263d', 'player');
    S.cars.push(car);
    p.car = car;
    p.onFoot = false;
    p.x = car.x;
    p.y = car.y;
    p.angle = 0;
    car.speed = 205;
    p.cash = 12450;
    S.wanted.heat = 80;
    S.wanted.level = 3;
    S.wanted.calmT = 0;
    // Two cruisers flanking the player, in frame for the photo.
    for (const [dx, dy] of [[-10, 45], [60, -40]]) {
      const cop = makeCar('cop', p.x + dx, p.y + dy, 0, '#212529', 'cop');
      cop.speed = 190;
      S.cops.push(cop);
      S.cars.push(cop);
    }
    // Helicopter ahead-right, low enough to be in frame.
    S.heli.angle = -0.6;
    S.heli.active = true;
    // A roadblock waiting up the Strip.
    S.roadblocks.push({ x: 1980, y: 1500, angle: Math.PI / 2, t: S.time });
  } else if (mode === 'mission') {
    startMission(S, 0);
    p.x = 1465;
    p.y = 905;
    p.angle = Math.atan2(900 - 905, 1500 - 1465);
    p.cash = 500;
  }
}
