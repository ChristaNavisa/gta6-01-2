// VERDE BAY v9 — entrypoint: boots the renderer, the sim and the HUD, runs
// the frame loop, and owns the menu / playing / paused state machine plus
// every key binding (E interact, Q weapon wheel, M missions, R radio, F save).
import { Sim } from './sim.js';
import { Input } from './input.js';
import { HUD } from './hud.js';
import { MissionRunner } from './missions.js';
import { Vehicle } from './vehicles.js';
import { createRenderer } from './render3d.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { shotKind, applyShot } from './shots.js';
import { dist2d } from './util.js';

const THREE = window.THREE;

const canvas = document.getElementById('game');
const renderer = createRenderer(canvas);
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 90, 190);
camera.lookAt(0, 0, 0);

const sim = new Sim(canvas);
sim.vehicleClass = Vehicle;
sim.missions = new MissionRunner(sim);
const input = new Input();
const hud = new HUD(sim);
sim.hud = hud;

let state = 'menu'; // menu | playing | paused
let lastCompleted = 0;
let menuAngle = 0;
let frames = 0;

window.__verde = { sim, hud, input, version: 9, ready: false, state: () => state };

function startGame(continueSave) {
  sim.audio.init();
  sim.audio.resume();
  if (continueSave) {
    const loaded = loadGame(sim);
    sim.say(loaded ? 'Welcome back to Verde Bay.' : 'No save found — fresh start.');
  }
  hud.hideStart();
  state = 'playing';
  sim.say('Verde Bay — press M for the next mission, E to enter a car.');
}

function togglePause() {
  if (state === 'playing') { state = 'paused'; sim.say('PAUSED — Esc to resume, F to save.'); }
  else if (state === 'paused') { state = 'playing'; sim.say(''); }
}

function nearGarage() {
  const p = sim.playerPos();
  return dist2d(p.x, p.z, sim.city.garagePos.x, sim.city.garagePos.z) < 14;
}
// Right at the garage door (under 7m) the garage always wins over a nearby
// car: the door is the shop, the cars parked outside are the stock.
function nearGarageDoor() {
  const p = sim.playerPos();
  return dist2d(p.x, p.z, sim.city.garagePos.x, sim.city.garagePos.z) < 7;
}
function nearShop() {
  const p = sim.playerPos();
  return sim.city.shopPositions.find(([x, z]) => dist2d(p.x, p.z, x, z) < 9) || null;
}
function interact() {
  if (sim.garage.open) { hud.closeGarage(); return; }
  if (state !== 'playing') return;
  if (!sim.player.onFoot) { sim.exitVehicle(); return; }
  // At the garage door the shop wins; a few steps away the nearest car does.
  if (nearGarageDoor()) { sim.garage.open = true; hud.openGarage(); sim.audio.click(); return; }
  const v = sim.nearestVehicle(6);
  if (v) { sim.enterVehicle(v); return; }
  if (nearGarage()) { sim.garage.open = true; hud.openGarage(); sim.audio.click(); return; }
  const shop = nearShop();
  if (shop) {
    const next = sim.weapons.owned.findIndex((o) => !o);
    if (next === -1) { sim.say('You own every weapon. Ammo restocked.'); sim.weapons.ammo = sim.weapons.ammo.map((a) => a + 60); return; }
    const res = sim.weapons.buy(next, sim.money);
    if (res.ok) { sim.money -= res.cost; sim.say('Bought ' + sim.weapons.def().name + ' — press Q for the weapon wheel.'); }
    else sim.say(res.reason + ' — this weapon costs $' + [0, 1200, 2200, 3500, 5000][next] + '.');
    return;
  }
  const next = sim.missions.nextDef();
  if (next) sim.say('Next mission: ' + next.title + ' — press M to start it.');
}

function handleKeys() {
  if (input.hit('Enter') && state === 'menu') { startGame(hasSave()); return; }
  if (state === 'menu') return;
  if (input.hit('Escape') || input.hit('KeyP')) { togglePause(); return; }
  if (state !== 'playing') return;
  if (input.hit('KeyE')) interact();
  if (input.hit('KeyM')) {
    if (!sim.missions.active) sim.missions.start();
    else sim.say(sim.missions.statusLine());
  }
  if (input.hit('KeyR')) sim.say('Radio: ' + sim.audio.nextStation());
  if (input.hit('KeyF')) { saveGame(sim); sim.say('Game saved.'); }
  if (input.hit('KeyQ')) hud.openWheel();
  if (input.hit('Digit1')) sim.weapons.select(0);
  if (input.hit('Digit2')) sim.weapons.select(1);
  if (input.hit('Digit3')) sim.weapons.select(2);
  if (input.hit('Digit4')) sim.weapons.select(3);
  if (input.hit('Digit5')) sim.weapons.select(4);
  if (input.hit('KeyH')) {
    const help = document.getElementById('help');
    if (help) help.style.display = help.style.display === 'none' ? 'block' : 'none';
  }
  if (input.mousePressed) {
    if (state === 'playing' && sim.player.onFoot) sim.shootAt(input.mouseX, input.mouseY, camera);
  }
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clockDelta());
  if (state === 'menu') {
    // Slow orbit over the city behind the title screen.
    menuAngle += dt * 0.05;
    camera.position.set(Math.sin(menuAngle) * 170, 95, Math.cos(menuAngle) * 170);
    camera.lookAt(0, 0, 0);
    sim.timeOfDay += (dt * 24) / 300;
    if (sim.timeOfDay >= 24) sim.timeOfDay -= 24;
  } else if (state === 'playing') {
    handleKeys();
    if (sim.garage.open) {
      // The world waits while you shop; the renderer keeps drawing.
      sim.effects.update(dt);
    } else {
      sim.update(dt, input, camera);
    }
    if (input.down('KeyQ') && !hud.wheelVisible) hud.openWheel();
    if (!input.down('KeyQ') && hud.wheelVisible && !input.mouseDown) hud.closeWheel();
    if (sim.missions.completed !== lastCompleted) {
      lastCompleted = sim.missions.completed;
      saveGame(sim);
    }
    hud.update();
  }
  input.endFrame();
  renderer.render(sim.scene, camera);
  frames += 1;
  if (frames === 3) window.__verde.ready = true;
}

let lastT = performance.now();
function clockDelta() {
  const now = performance.now();
  const d = (now - lastT) / 1000;
  lastT = now;
  return d;
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

document.getElementById('start-btn').addEventListener('click', () => startGame(hasSave()));
document.getElementById('new-btn').addEventListener('click', () => {
  try { localStorage.removeItem('verde-bay-v9-save'); } catch (e) { /* no storage */ }
  startGame(false);
});

// Screenshot scenes (?shot=...) pose the game before the first frame.
const kind = shotKind();
if (kind) {
  applyShot(sim, hud, kind);
  if (kind !== 'start') state = 'playing';
}

hud.showStart();
if (kind && kind !== 'start') hud.hideStart();
animate();
