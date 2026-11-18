// Boot: build the game, wire input/audio/HUD/renderer, run the loop.
// URL params: ?seed=N (default 1), ?shot=start|drive|chase|mission for the
// screenshot modes (they skip the menu and start playing at once).

import { createGame, update, applySave } from './sim.js';
import { createRenderer } from './render3d.js';
import { createHUD } from './hud.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { loadSave, writeSave } from './save.js';
import { applyShot } from './shots.js';
import { MISSIONS } from './missions.js';

const params = new URLSearchParams(window.location.search);
const seed = parseInt(params.get('seed') ?? '1', 10) || 1;
const shotMode = params.get('shot');

const S = createGame(seed);
const container = document.getElementById('game');
const renderer = createRenderer(container, S.city);
const hud = createHUD(S);
const input = createInput(renderer.domElement ?? container);
S.input = input;
const audio = createAudio();

// Restore progress when there is a save.
const save = loadSave();
if (save && save.missionIndex > 0) {
  applySave(S, save);
  hud.showBanner(`Welcome back — ${save.missionIndex} mission${save.missionIndex === 1 ? '' : 's'} done, $${save.cash.toLocaleString('en-US')} in the bank.`, 5);
}

// --- start menu ------------------------------------------------------------
const menu = document.getElementById('menu');
const missionList = document.getElementById('menu-missions');
missionList.innerHTML = MISSIONS.map((m, i) => `
  <li><strong>${i + 1}. ${m.title}</strong> — ${m.contact} · $${m.reward.toLocaleString('en-US')}</li>
`).join('');

function startGame() {
  if (S.flags.started) return;
  menu.classList.add('hidden');
  S.flags.menu = false;
  S.flags.started = true;
  audio.resume();
  hud.showBanner('Verde Bay is yours. Press M to start the first mission.', 5);
}
document.getElementById('start-btn').addEventListener('click', startGame);
window.addEventListener('keydown', (e) => {
  if (!S.flags.started && (e.code === 'Enter' || e.code === 'Space')) startGame();
});

if (shotMode) {
  // Screenshot modes skip the menu entirely.
  menu.classList.add('hidden');
  applyShot(S, shotMode);
}

window.addEventListener('resize', () => {
  renderer.resize(container.clientWidth, container.clientHeight);
});

// --- main loop --------------------------------------------------------------
let last = performance.now();
let frames = 0;
let lastMissionsDone = S.stats.missionsDone;
let saveTimer = 0;

function frame(now) {
  const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
  last = now;
  if (S.flags.started) {
    update(S, dt);
    audio.update(S);
    if (S.stats.missionsDone !== lastMissionsDone) {
      lastMissionsDone = S.stats.missionsDone;
      writeSave(S);
      audio.jingle();
    }
    saveTimer += dt;
    if (saveTimer > 10) {
      saveTimer = 0;
      writeSave(S);
    }
  }
  renderer.update(S, dt);
  hud.update();
  frames += 1;
  if (frames === 3) window.__ready = true;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
