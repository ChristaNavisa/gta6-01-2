// VERDE BAY — bootstrap, game loop, menus, and screenshot staging.
// Entry point: game/index.html loads this as a module.
import { createGame, applySave, update } from './world.js';
import { createInput, attachInput, endFrameInput, keyPressed } from './input.js';
import { createHud, updateHud } from './hud.js';
import { render } from './render.js';
import { applyShot } from './shots.js';
import { loadSave, writeSave, clearSave } from './save.js';
import { setMuted, isMuted, sfx } from './audio.js';
import { hashSeed } from './random.js';
import { startMission } from './missions.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const params = new URLSearchParams(location.search);
const seed = hashSeed(params.get('seed') || 'verde-bay-1');
const shotName = params.get('shot');

const S = createGame(seed);
S.ctx = ctx;
S.input = createInput();
S.hud = createHud(document);
attachInput(S.input, canvas);
// Exposed for debugging and for the screenshot harness.
window.__game = S;

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  canvas.width = w; canvas.height = h;
  S.view.w = w; S.view.h = h;
}
window.addEventListener('resize', resize);
resize();

// --- Menus ---------------------------------------------------------------
const menuEl = document.getElementById('menu');
const pauseEl = document.getElementById('pause');
const wastedEl = document.getElementById('wasted');
const bustedEl = document.getElementById('busted');
const newGameBtn = document.getElementById('new-game');
const continueBtn = document.getElementById('continue');
const howBtn = document.getElementById('how');
const howEl = document.getElementById('howto');
const resumeBtn = document.getElementById('resume');
const restartBtn = document.getElementById('restart');
const muteBtn = document.getElementById('mute');
const save = loadSave();
if (!save) continueBtn.style.display = 'none';
else continueBtn.textContent = `Continue — $${save.cash} · Job ${Math.min(save.missionIndex + 1, 6)}/6`;

function startPlaying(fromSave) {
  S.flags.menu = false;
  S.flags.started = true;
  menuEl.style.display = 'none';
  if (fromSave) {
    applySave(S, save);
    S.mission.nextAt = S.time + 1;
  } else {
    clearSave();
    S.mission.nextAt = S.time + 1;
  }
  sfx.click();
}

newGameBtn.addEventListener('click', () => startPlaying(false));
continueBtn.addEventListener('click', () => startPlaying(true));
howBtn.addEventListener('click', () => { howEl.style.display = howEl.style.display === 'block' ? 'none' : 'block'; });
resumeBtn.addEventListener('click', () => { S.flags.paused = false; pauseEl.style.display = 'none'; });
restartBtn.addEventListener('click', () => location.reload());
muteBtn.addEventListener('click', () => {
  setMuted(!isMuted());
  muteBtn.textContent = isMuted() ? '🔇 Sound off' : '🔊 Sound on';
});

// --- Screenshot staging --------------------------------------------------
if (shotName) {
  applyShot(S, shotName);
  menuEl.style.display = 'none';
  if (shotName === 'start') menuEl.style.display = 'flex';
  // Let the staged scene run a couple of simulated seconds so cars, police
  // and pedestrians are mid-motion when the screenshot is taken. Driving
  // shots hold the throttle so the car is actually moving.
  if (shotName !== 'start' && shotName !== 'end') {
    if (shotName === 'drive' || shotName === 'chase') S.input.keys.add('KeyW');
    for (let i = 0; i < 150; i++) update(S, 1 / 60);
    S.input.keys.delete('KeyW');
    S.messageT = 0; // keep the briefing banner out of the screenshot
  }
}

// --- Main loop ------------------------------------------------------------
let last = performance.now();
let wastedShown = false;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const input = S.input;

  if (keyPressed(input, ['Escape', 'KeyP']) && S.flags.started && !S.flags.menu && !S.flags.wasted) {
    S.flags.paused = !S.flags.paused;
    pauseEl.style.display = S.flags.paused ? 'flex' : 'none';
    sfx.click();
  }
  if (keyPressed(input, ['KeyM'])) {
    setMuted(!isMuted());
    muteBtn.textContent = isMuted() ? '🔇 Sound off' : '🔊 Sound on';
  }

  if (!S.flags.paused) update(S, dt);
  render(S);
  updateHud(S);

  // Wasted / busted overlays.
  if (S.flags.wasted && !wastedShown) {
    wastedShown = true;
    wastedEl.style.display = 'flex';
    setTimeout(() => { wastedEl.style.display = 'none'; wastedShown = false; }, 2500);
  }
  if (S.flags.busted) {
    bustedEl.style.display = 'flex';
    setTimeout(() => { bustedEl.style.display = 'none'; }, 3000);
  }

  endFrameInput(input);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
