// Screenshot poses: ?shot=start|drive|chase|garage&seed=N
// Each pose sets the game up deterministically and signals window.__shotReady
// once the frame is drawn, so a headless browser can capture real renders.
import { makeCar } from './vehicles.js';
import { startMission } from './missions.js';
import { startRace } from './race.js';
import { raiseWanted } from './weapons.js';

export function applyShot(G, params) {
  const shot = params.get('shot') || 'start';
  window.__shotReady = false;
  const finish = () => {
    window.__shotReady = true;
    document.title = 'VERDE BAY — shot ' + shot;
  };
  if (shot === 'start') {
    G.mode = 'title';
    setTimeout(finish, 400);
    return;
  }
  G.mode = 'play';
  G.money = 24800;
  G.player.health = 100; G.player.armor = 60;
  if (shot === 'drive') {
    const car = makeCar('sport', 960, 600, 0, 'player');
    car.upgrades = { engine: 2, armor: 1, nos: 2 };
    car.speed = 260;
    G.cars.push(car);
    G.player.car = car; G.player.onFoot = false;
    G.player.x = car.x; G.player.y = car.y;
    startMission(G, 2);
    setTimeout(finish, 900);
  } else if (shot === 'chase') {
    const car = makeCar('muscle', 1560, 900, 0, 'player');
    car.upgrades = { engine: 1, armor: 1, nos: 1 };
    car.speed = 320;
    G.cars.push(car);
    G.player.car = car; G.player.onFoot = false;
    G.player.x = car.x; G.player.y = car.y;
    G.wanted = 4; G.heat = 100;
    for (let i = 0; i < 3; i++) {
      const pc = makeCar('sedan', car.x - 260 - i * 100, car.y + (i % 2 ? 30 : -30), 0, 'police');
      pc.color = '#222831'; pc.speed = 300;
      G.cars.push(pc);
    }
    G.heli = { angle: 0.6, r: 240, x: car.x + 150, y: car.y - 150 };
    startRace(G);
    setTimeout(finish, 900);
  } else if (shot === 'garage') {
    G.garage.owned = ['sedan', 'taxi', 'coupe', 'muscle'];
    G.garage.upgrades = {
      sedan: { engine: 1, armor: 0, nos: 0 },
      taxi: { engine: 0, armor: 1, nos: 0 },
      coupe: { engine: 2, armor: 1, nos: 1 },
      muscle: { engine: 1, armor: 2, nos: 1 },
    };
    G.mode = 'garage';
    setTimeout(finish, 600);
  } else {
    setTimeout(finish, 400);
  }
}
