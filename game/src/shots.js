// Screenshot director for VERDE BAY 3D v8. Reads ?shot=start|drive|chase|mission
// and stages a deterministic scene for the Playwright shots script, then sets
// window.__ready once the first frames have rendered.
import { createGame, startMission, commitCrime, makeCar } from './sim.js';

export function setupShot(S, mode) {
  S.shotMode = mode;
  const p = S.player;
  if (mode === 'start') {
    S.flags.menu = true;
    S.flags.started = false;
    p.x = 1150; p.y = 850; p.angle = Math.PI / 4;
    return;
  }
  S.flags.menu = false;
  S.flags.started = true;
  S.time = 1;
  if (mode === 'drive') {
    const car = makeCar('sport', 1050, 750, 0, '#d7263d', 'player');
    S.cars.push(car);
    p.car = car; p.onFoot = false;
    p.x = 1050; p.y = 750; p.angle = 0;
    car.speed = 120;
    return;
  }
  if (mode === 'chase') {
    // Wanted 3 chase with the helicopter IN FRAME: heli ahead of the player,
    // low orbit, searchlight on. The render frames the camera up toward it.
    const car = makeCar('sport', 1050, 750, 0, '#d7263d', 'player');
    S.cars.push(car);
    p.car = car; p.onFoot = false;
    p.x = 1050; p.y = 750; p.angle = 0;
    p.cash = 12450;
    car.speed = 170;
    commitCrime(S, 3);
    // Park the helicopter ahead of the car, low and big in the frame.
    if (S.heli) {
      S.heli.angle = 0; // straight ahead on the +x axis from the player
      S.heli.orbitR = 90;
      S.heli.z = 30;
      S.heli.x = p.x + 90;
      S.heli.y = p.y + 10;
    }
    return;
  }
  if (mode === 'mission') {
    // Mission 11, Neon Crown, at night on The Strip: race + shootout.
    const car = makeCar('sport', 2050, 1500, Math.PI / 2, '#d7263d', 'player');
    S.cars.push(car);
    p.car = car; p.onFoot = false;
    p.x = 2050; p.y = 1500; p.angle = Math.PI / 2;
    p.cash = 18200;
    car.speed = 60;
    startMission(S, 10);
    return;
  }
}
