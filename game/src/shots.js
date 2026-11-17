// VERDE BAY — screenshot poses. The shots script loads index.html with
// ?shot=<mode>&seed=1; main.js calls poseShot() once, then renders.
// Each pose puts the game in a state that shows a different system:
// the menu over the city, driving, a police chase, a mission on foot.

import { makeCar, update } from './sim.js';
import { startMission } from './missions.js';
import { angleTo, dist } from './util.js';

const STEP = 1 / 60;

function stepN(S, n) { for (let i = 0; i < n; i++) update(S, STEP); }

function putInCar(S, car) {
  const p = S.player;
  p.car = car;
  p.onFoot = false;
  p.x = car.x; p.y = car.y; p.angle = car.angle;
  car.owner = 'player';
}

/** Pose the game for one of the four screenshots. */
export function poseShot(S, mode) {
  const p = S.player;
  if (mode === 'start') {
    // Menu over a living city: traffic and peds move behind the panel.
    S.flags.menu = true;
    S.flags.started = false;
    return;
  }

  S.flags.menu = false;
  S.flags.started = true;

  if (mode === 'drive') {
    startMission(S, 1); // Courier Run: "Pick up the package at Sunset Diner"
    const car = makeCar('sports', 1170, 650, Math.PI / 2, '#d23b2e', 'player');
    car.speed = 130;
    S.cars.push(car);
    putInCar(S, car);
    return;
  }

  if (mode === 'chase') {
    startMission(S, 4); // Getaway Driver: "Drive to Verde Bowl"
    const car = makeCar('sports', 1170, 910, -Math.PI / 2, '#d23b2e', 'player');
    car.speed = 210;
    S.cars.push(car);
    putInCar(S, car);
    S.wanted.heat = 90;
    S.wanted.level = 3;
    // Two interceptors closing in from behind.
    for (const [x, y] of [[1170, 910 + 190], [1130, 910 + 280]]) {
      const cop = makeCar('police', x, y, -Math.PI / 2, '#1e3a5f', 'police');
      cop.speed = 260;
      S.cars.push(cop);
      S.cops.push({ car: cop, kind: 'cop', catchTimer: 0 });
    }
    return;
  }

  if (mode === 'mission') {
    startMission(S, 2); // Payback: goto the club, then the gang shows up
    const club = S.city.places.club;
    p.x = club.x; p.y = club.y + 60;
    p.onFoot = true; p.car = null;
    stepN(S, 90); // walk the goto stage forward so the gang spawns
    const gang = (S.mission.data && S.mission.data.gang) || [];
    if (gang.length > 0) {
      const g0 = gang[0];
      p.x = g0.x - 130; p.y = g0.y + 40;
      p.angle = angleTo(p.x, p.y, g0.x, g0.y);
      S.aimAngle = p.angle;
    }
    return;
  }

  // Unknown mode: just start the game.
  S.flags.menu = false;
  S.flags.started = true;
}
