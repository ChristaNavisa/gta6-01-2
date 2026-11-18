// Verde Bay 3D — Neon Nights. Entry point: wires the sim, the 3D renderer,
// the HUD, input and sound together, and stages the screenshot shots.

import { createGame, update, applySave } from './sim.js';
import { MISSIONS, startMission } from './missions.js';
import { loadSave } from './save.js';
import { createWorld } from './render3d.js';
import { createHud } from './hud.js';
import { createInput } from './input.js';
import { initAudio, updateAudio, playShot, playPickup, playMissionComplete, playSteal, playBusted, toggleMute } from './audio.js';
import { setupShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const seed = parseInt(params.get('seed') || '1', 10) || 1;
const shot = params.get('shot');

const S = createGame(seed);
S.input = createInput();
window.__game = S;

// Resume a saved game (but never in screenshot mode).
if (!shot) {
  const save = loadSave();
  if (save) applySave(S, save);
}

const canvas = document.getElementById('view');
const world = createWorld(canvas, S);
const hud = createHud(document.getElementById('hud'), S);

let frames = 0;
let audioReady = false;

function drainEvents() {
  for (const e of S.events) {
    if (e.type === 'missionComplete') {
      playMissionComplete();
      hud.banner(`${e.title} COMPLETE`, `+$${e.reward.toLocaleString('en-US')}`);
      if (S.stats.missionsDone < MISSIONS.length) {
        setTimeout(() => startMission(S, S.stats.missionsDone), 1200);
      } else {
        hud.banner('VERDE BAY COMPLETE', 'Every mission done — the city is yours.');
      }
    } else if (e.type === 'package') {
      playPickup();
      hud.banner('HIDDEN PACKAGE', `${S.stats.packagesFound}/10 — +$250`);
    } else if (e.type === 'shot') {
      playShot();
    } else if (e.type === 'steal') {
      playSteal();
    } else if (e.type === 'busted') {
      playBusted();
    } else if (e.type === 'wasted') {
      playBusted();
    } else if (e.type === 'copDown') {
      playShot();
    }
  }
  S.events.length = 0;
}

function startGame() {
  if (!audioReady) audioReady = initAudio();
  hud.hideStart();
  S.flags.menu = false;
  S.flags.started = true;
  if (!S.mission.active && S.stats.missionsDone < MISSIONS.length) {
    startMission(S, S.stats.missionsDone);
  }
}

document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-busted').addEventListener('click', () => hud.hideBusted());
document.getElementById('btn-wasted').addEventListener('click', () => hud.hideWasted());
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyM') toggleMute();
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (S.flags.started) S.flags.paused = !S.flags.paused;
  }
  if (e.code === 'Enter' && S.flags.menu) startGame();
});

if (shot) {
  // Screenshot mode: stage the shot, hide the menus, render until ready.
  const preset = setupShot(S, shot);
  world.setShotPreset(preset);
  hud.hideStart();
  S.flags.menu = false;
  S.flags.started = true;
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  if (S.flags.started && !S.flags.paused) {
    update(S, dt);
    drainEvents();
  }
  updateAudio(S.player.speed || 0, S.wanted.level, !S.player.onFoot);
  world.render(S, dt);
  hud.update();
  frames += 1;
  if (shot && frames >= 4 && !window.__ready) {
    window.__ready = true;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
