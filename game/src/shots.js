// Deterministic screenshot staging: ?shot=start|drive|chase|mission&seed=1
// Each shot places the world in a readable, system-rich pose and then lets
// the normal loop run, so the frame is a real render of the game in motion.
// The 3D camera follows the player, so the staged pose must start with the
// player where the camera will find them — no long pre-roll coast needed.
import { startMission } from './missions.js';

export function applyShot(S, name) {
  const p = S.player;
  if (name === 'start') {
    S.flags.menu = true;
    return;
  }
  S.flags.menu = false;
  S.flags.started = true;

  if (name === 'drive') {
    // Cole in a Comet GT on the main avenue, traffic and pedestrians around.
    const car = S.makeCar('sport', 500, 800, 0, '#e74c3c', 'player');
    car.speed = 300;
    S.cars.push(car);
    p.car = car; p.onFoot = false; p.x = car.x; p.y = car.y;
    startMission(S, 0);
    S.mission.objective = 'Deliver the package to the Palmera Diner';
    S.mission.marker = { x: 800, y: 1430, label: 'Palmera Diner' };
    S.cameraSnap = true;
  }

  if (name === 'chase') {
    // Wanted 3 stars, two interceptors closing in, mission objective on the HUD.
    const car = S.makeCar('muscle', 600, 800, 0, '#922b21', 'player');
    car.speed = 380;
    S.cars.push(car);
    p.car = car; p.onFoot = false; p.x = car.x; p.y = car.y;
    S.wanted.level = 3;
    S.wanted.heat = 3;
    S.wanted.decayAt = S.time + 9999;
    const cop1 = S.makeCar('police', 600 - 260, 800 - 16, 0, '#1a1a2e', 'police');
    cop1.speed = 400; cop1.driver = true;
    const cop2 = S.makeCar('police', 600 - 420, 800 + 16, 0, '#1a1a2e', 'police');
    cop2.speed = 410; cop2.driver = true;
    S.cars.push(cop1, cop2);
    S.mission.active = true;
    S.mission.index = 1;
    S.mission.stage = 1;
    S.mission.objective = 'Drive the client to the Verde Bowl — lose the cops';
    S.mission.marker = { x: 2300, y: 500, label: 'Verde Bowl' };
    S.cameraSnap = true;
  }

  if (name === 'mission') {
    // On foot at the Old Cannery: the Harbor Heist safe-crack, Vipers guarding,
    // wanted stars up, objective on the HUD.
    // Cole stands ON the 2000 avenue facing north toward the cannery — the
    // old pose (1900, 1030) was inside the warehouse footprint, so the
    // camera saw him standing "on" its roof. Gang members guard the avenue.
    p.onFoot = true;
    p.car = null;
    p.x = 2000; p.y = 1200;
    p.angle = -Math.PI / 2;
    p.ammo = 48;
    const wh = S.city.places.warehouse;
    for (let i = 0; i < 2; i++) {
      S.peds.push(S.makePed(i === 0 ? 1978 : 2022, 1160, 'gang'));
    }
    S.wanted.level = 2;
    S.wanted.heat = 2;
    S.wanted.decayAt = S.time + 9999;
    S.mission.active = true;
    S.mission.index = 5;
    S.mission.stage = 1;
    S.mission.objective = 'Crack the safe — stay by the vault';
    S.mission.marker = { x: wh.x, y: wh.y, label: 'Old Cannery' };
    S.mission.data = {};
    S.cameraSnap = true;
  }

  if (name === 'end') {
    // Game-over screen pose: wasted at the hospital steps.
    p.hp = 0;
    S.flags.wasted = true;
    S.flags.wastedT = 0;
    S.flags.menu = false;
    S.flags.started = true;
  }
}
