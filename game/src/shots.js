// Screenshot staging for Verde Bay: ?shot=start|drive|chase|mission&seed=N
// puts the game in a fixed, readable state so the shots script can capture
// the city, the driving, the chase and a mission in progress. The main loop
// sets window.__ready once a few frames have rendered.

import { startMission, beginStage } from './missions.js';
import { makeCar } from './sim.js';

/** Stage the game state for one named shot. Returns the camera preset name. */
export function setupShot(S, shot) {
  const p = S.player;
  S.flags.menu = false;
  S.flags.started = true;

  // Clear the streets of random traffic near the shot, then re-place it.
  S.cops.length = 0;
  S.wanted.heat = 0;
  S.wanted.level = 0;

  if (shot === 'start') {
    // On foot in downtown, mission 1 live, the Strip glowing behind.
    p.onFoot = true;
    p.car = null;
    p.x = 1100;
    p.y = 950;
    p.angle = Math.PI / 2;
    startMission(S, 0);
    return 'start';
  }

  if (shot === 'drive') {
    // A sport car cruising the Strip at dusk, traffic around it.
    const car = makeCar('sport', 2100, 1620, -Math.PI / 2, '#d7263d', 'player');
    S.cars.push(car);
    p.car = car;
    p.onFoot = false;
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    car.speed = 200;
    startMission(S, 8);
    // Park the race's first checkpoint marker on the casino.
    S.mission.stage = 0;
    return 'drive';
  }

  if (shot === 'chase') {
    // Wanted 3 on the bridge to Isla Verde, three cop cars closing in.
    const car = makeCar('sport', 2720, 1100, 0, '#d7263d', 'player');
    S.cars.push(car);
    p.car = car;
    p.onFoot = false;
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    car.speed = 260;
    S.wanted.heat = 210;
    S.wanted.level = 3;
    for (let i = 0; i < 3; i++) {
      const cop = makeCar('sedan', 2520 - i * 90, 1000 + i * 60, 0, '#1a1a2e', 'cop');
      cop.isCop = true;
      cop.speed = 240;
      S.cops.push(cop);
    }
    startMission(S, 7);
    return 'chase';
  }

  // mission: The Vault in progress — on foot at the bank, guards out, wanted 2.
  p.onFoot = true;
  p.car = null;
  p.x = 1150;
  p.y = 1010;
  p.angle = Math.PI / 4;
  startMission(S, 9);
  // Jump straight to the eliminate stage so the guards and the beam show.
  S.mission.stage = 1;
  beginStage(S);
  S.wanted.heat = 120;
  S.wanted.level = 2;
  return 'mission';
}
