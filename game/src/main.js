// VERDE BAY — boot + game loop. Builds the sim, the renderer, input,
// audio and HUD, then runs requestAnimationFrame: sim step, event drain
// (sounds), HUD, render. Shot mode (?shot=start|drive|chase|mission)
// poses the game once and flags window.__ready for the screenshot tool.

import { createGame, update } from './sim.js';
import { createRenderer } from './render3d.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { initHUD, updateHUD } from './hud.js';
import { poseShot } from './shots.js';
import { startMission, MISSIONS } from './missions.js';
import { loadSave, writeSave } from './save.js';
import { floater } from './effects.js';

const params = new URLSearchParams(location.search);
const seedParam = parseInt(params.get('seed') || '', 10);
const seed = Number.isFinite(seedParam) && seedParam > 0
  ? seedParam
  : (Math.floor(Math.random() * 1000000000) + 1);
const shotMode = params.get('shot');

const S = createGame(seed);
const input = createInput();
input.attach();
S.input = input;

const canvas = document.getElementById('game-canvas');
const R = createRenderer(canvas, S);
const audio = createAudio();
initHUD();

let viewMode = 'chase';
let frames = 0;
let paused = false;

const $ = (id) => document.getElementById(id);

function showOverlay(id) {
  for (const o of ['menu', 'pause', 'wasted', 'busted', 'help']) {
    const e = $(o);
    if (e) e.classList.toggle('hidden', o !== id);
  }
}

function startGame(continueSave) {
  audio.ensure();
  if (continueSave) {
    const save = loadSave();
    if (save) {
      S.player.cash = save.cash || 0;
      S.stats.missionsDone = save.missionIndex || 0;
      S.mission.index = save.missionIndex || 0;
    }
  }
  S.flags.menu = false;
  S.flags.started = true;
  showOverlay(null);
}

function wireButtons() {
  const save = loadSave();
  const btnContinue = $('btn-continue');
  if (btnContinue) {
    if (save && save.missionIndex > 0) {
      btnContinue.classList.remove('hidden');
      btnContinue.textContent = `Continue — Job ${save.missionIndex + 1} ($${save.cash})`;
    } else {
      btnContinue.classList.add('hidden');
    }
  }
  $('btn-new')?.addEventListener('click', () => startGame(false));
  btnContinue?.addEventListener('click', () => startGame(true));
  $('btn-how')?.addEventListener('click', () => showOverlay('help'));
  $('btn-help-back')?.addEventListener('click', () => showOverlay('menu'));
  $('btn-resume')?.addEventListener('click', () => { paused = false; showOverlay(null); });
  $('btn-restart')?.addEventListener('click', () => location.reload());
  $('btn-menu')?.addEventListener('click', () => location.reload());
  window.addEventListener('keydown', () => audio.ensure(), { once: true });
  window.addEventListener('mousedown', () => audio.ensure(), { once: true });
  window.addEventListener('resize', () => R.resize());
}
wireButtons();

if (shotMode) {
  poseShot(S, shotMode);
  viewMode = shotMode === 'start' ? 'orbit' : 'chase';
  showOverlay(shotMode === 'start' ? 'menu' : null);
} else {
  showOverlay('menu');
}

function drainEvents() {
  for (const e of S.events) {
    if (e.type === 'shot') audio.shot();
    else if (e.type === 'crash') audio.crash();
    else if (e.type === 'mission-complete') {
      audio.jingle();
      floater(S.effects, S.player.x, S.player.y, `+$${e.reward}`, '#7dff8a');
    } else if (e.type === 'enter-car' || e.type === 'taxi-pickup' || e.type === 'taxi-fare') {
      audio.blip();
    } else if (e.type === 'busted' || e.type === 'wasted') {
      audio.crash();
    }
  }
  S.events.length = 0;
}

let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  // Pause toggle.
  if (input.justPressed.has('pause') && S.flags.started && !S.flags.menu) {
    paused = !paused;
    showOverlay(paused ? 'pause' : null);
  }

  if (!paused) {
    // Aim from the mouse, in world terms.
    if (S.flags.started && !S.flags.menu) {
      S.aimAngle = R.screenAimAngle(input.mouse.x, input.mouse.y);
    }

    // Start the next job at Mara's Garage (E, on foot, no job running).
    if (input.justPressed.has('enter') && S.player.onFoot && !S.mission.active
      && S.stats.missionsDone < MISSIONS.length && S.flags.started) {
      const g = S.city.places.garage;
      const d = Math.hypot(S.player.x - g.x, S.player.y - g.y);
      if (d < 120) startMission(S, S.stats.missionsDone);
    }

    update(S, dt);
    drainEvents();

    // Sound follows the drive and the heat.
    const speed01 = S.player.car ? Math.abs(S.player.car.speed) / S.player.car.maxSpeed : 0;
    audio.engine(speed01);
    audio.siren(S.wanted.level > 0, dt);

    // Wasted / busted overlays while the sim respawns the player.
    if (S.flags.wasted) showOverlay('wasted');
    else if (S.flags.busted) showOverlay('busted');
    else if (!S.flags.menu && !paused) showOverlay(null);

    updateHUD(S);
    R.render(S, dt, { mode: viewMode, angle0: 0.6 });

    frames += 1;
    if (shotMode && frames >= 3 && !window.__ready) window.__ready = true;
  }

  input.endFrame();
}
requestAnimationFrame(loop);
