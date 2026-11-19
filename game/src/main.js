// VERDE BAY 3D v8 — game entry: boot, loop, menu, pause, mouse aim, shot modes.
import { createGame, update, applySave } from './sim.js';
import { initRender, render } from './render3d.js';
import { attachInput } from './input.js';
import { initHud, updateHud } from './hud.js';
import { setupShot } from './shots.js';
import { loadSave } from './save.js';
import { MISSIONS, startMission } from './missions.js';
import {
  ensureAudio, setRadioStation, updateRadio, updateEngine, updateSiren,
  playShot, playFanfare, playPickup, playBusted,
} from './audio.js';

const params = new URLSearchParams(window.location.search);
const shotMode = params.get('shot');
const seed = parseInt(params.get('seed') || '1', 10) || 1;

const S = createGame(seed);
const saved = loadSave();
if (saved && !shotMode) applySave(S, saved);

const canvas = document.getElementById('game');
initRender(S, canvas);
initHud(S);
attachInput(S, canvas);
if (shotMode) setupShot(S, shotMode);

let lastFanfare = null;
let lastStation = -1;
let lastShots = 0;
let last = performance.now();

function aimFromMouse() {
  if (S.player.car) return;
  const rect = canvas.getBoundingClientRect();
  const cx = rect.width / 2, cy = rect.height / 2;
  const dx = S.input.mouse.x - cx, dy = S.input.mouse.y - cy;
  if (dx || dy) S.player.aim = Math.atan2(dy, dx);
}

function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  // Menu / pause keys.
  if (S.input.justPressed.has('Enter') && S.flags.menu) {
    ensureAudio();
    S.flags.menu = false;
    S.flags.started = true;
    S.time = 1;
  }
  if (S.input.justPressed.has('KeyM') && S.flags.started && !S.mission.active) {
    if (S.mission.index < MISSIONS.length) startMission(S, S.mission.index);
  }
  if (S.input.justPressed.has('Escape') && S.flags.started) {
    S.flags.paused = !S.flags.paused;
  }
  if (S.input.justPressed.has('KeyE') && S.shop.near && S.flags.started) {
    S.shop.open = !S.shop.open;
  }
  aimFromMouse();
  update(S, dt);
  // Audio follows the sim.
  const car = S.player.car;
  updateEngine(car ? car.speed : 0, car ? car.maxSpeed : 0, !!car && S.flags.started);
  if (S.radio.on && S.radio.station !== lastStation) {
    setRadioStation(S.radio.station, true);
    lastStation = S.radio.station;
  }
  if (!S.radio.on && lastStation !== -1) {
    setRadioStation(0, false);
    lastStation = -1;
  }
  updateRadio();
  updateSiren(dt, S.wanted.level);
  // One-shot sounds on state changes.
  if (S.fanfare && S.fanfare !== lastFanfare) {
    if (S.fanfare.text.startsWith('MISSION COMPLETE') || S.fanfare.text.startsWith('HIDDEN PACKAGE')) playFanfare();
    else playBusted();
    lastFanfare = S.fanfare;
  }
  if (!S.fanfare) lastFanfare = null;
  if (S.stats.shotsFired > lastShots) {
    playShot();
    lastShots = S.stats.shotsFired;
  }
  render(S, dt);
  updateHud(S);
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
