// VERDE BAY 3D v7 — browser entry: the game loop, menus, shop, save, screenshots.
// Wires the pure sim to the renderer, HUD, audio and effects.

import { createGame, update, applySave } from './sim.js';
import { createRenderer } from './render3d.js';
import { createHud } from './hud.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createEffects } from './effects.js';
import { setupShot } from './shots.js';
import { loadSave, writeSave } from './save.js';

const params = new URLSearchParams(location.search);
const seed = parseInt(params.get('seed') || '1', 10);
const shotMode = params.get('shot');

const S = createGame(seed);
const input = createInput();
S.input = input;
input.attach();

const canvas = document.getElementById('c3d');
const renderer = createRenderer(canvas, S);
const audio = createAudio();
const hud = createHud(S, {
  onStart(fromSave) {
    if (fromSave) {
      const save = loadSave();
      if (save) applySave(S, save);
    }
    S.flags.menu = false;
    S.flags.started = true;
    S.flags.paused = false;
    audio.unlock();
    audio.setRadio(true);
    renderer.setMode('follow');
    hud.showMenu(false);
    hud.toast('Welcome to Verde Bay — press M for a mission');
  },
  onResume() {
    S.flags.paused = false;
    hud.showPaused(false);
    hud.showBusted(false);
    hud.showWasted(false);
    audio.unlock();
  },
  onRestart() {
    location.reload();
  },
  onClosePanels() {
    hud.showShop(false);
    hud.showSafehouse(false);
    hud.showBusted(false);
    hud.showWasted(false);
    S.flags.paused = false;
    audio.unlock();
  },
  onSave() {
    writeSave(S);
    S.player.health = 100;
    hud.toast('Progress saved at the Safehouse');
  },
  onBuy(key, price) {
    buy(key, price);
  },
});

const effects = createEffects(renderer.scene);

function buy(key, price) {
  const p = S.player;
  if (p.cash < price) {
    hud.toast('Not enough cash');
    return;
  }
  p.cash -= price;
  if (key === 'smg') {
    p.weapons.smg = { owned: true, inMag: 30, reserve: 120 };
    p.weapon = 'smg';
  } else if (key === 'shotgun') {
    p.weapons.shotgun = { owned: true, inMag: 6, reserve: 24 };
    p.weapon = 'shotgun';
  } else if (key === 'ammoPistol') p.weapons.pistol.reserve += 48;
  else if (key === 'ammoSmg') p.weapons.smg.reserve += 120;
  else if (key === 'ammoShotgun') p.weapons.shotgun.reserve += 24;
  else if (key === 'armor') p.armor = 50;
  else if (key === 'health') p.health = 100;
  audio.pickup();
  hud.refreshShop();
  hud.toast('Purchased');
}

function toWorld(x, y) {
  return { x: x - 1700, z: y - 1100 };
}

function handleEvent(ev) {
  const p = S.player;
  switch (ev.type) {
    case 'missionComplete':
      hud.banner(`${ev.title} complete`, `+$${ev.reward.toLocaleString('en-US')}`);
      audio.missionDone();
      writeSave(S);
      break;
    case 'package':
      hud.toast(`Hidden package ${ev.found}/10 — +$250`);
      audio.pickup();
      break;
    case 'shot': {
      const w = toWorld(p.x, p.y);
      effects.muzzle(w.x, 1.6, w.z, p.aimAngle);
      audio.shot(ev.weapon);
      break;
    }
    case 'shotAt':
      effects.sparks(toWorld(p.x, p.y).x, 1.5, toWorld(p.x, p.y).z);
      break;
    case 'kill':
      hud.toast(ev.kind === 'cop' ? 'Cop down — heat rising' : 'Target down');
      break;
    case 'rammed':
    case 'roadblockHit': {
      const w = toWorld(p.x, p.y);
      effects.sparks(w.x, 1.2, w.z);
      break;
    }
    case 'radio':
      audio.setStation(S.radio.station);
      hud.toast(`Radio: ${['VERDE FM', 'NEON NIGHTS', 'ISLA BEATS'][S.radio.station]}`);
      break;
    case 'busted':
      S.flags.paused = true;
      hud.showBusted(true);
      audio.busted();
      break;
    case 'wasted':
      S.flags.paused = true;
      hud.showWasted(true);
      audio.busted();
      break;
    case 'pedHit':
      hud.toast('Pedestrian hit — the cops noticed');
      break;
    default:
      break;
  }
}

window.addEventListener('keydown', () => audio.unlock(), { once: true });
window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
window.addEventListener('resize', () => renderer.resize());

// Screenshot staging, then the menu.
if (shotMode) {
  setupShot(S, shotMode);
  renderer.setMode(shotMode === 'start' ? 'menu' : 'follow');
  if (shotMode !== 'start') {
    hud.showMenu(false);
    renderer.snapToPlayer(S);
  }
} else {
  const save = loadSave();
  const btn = document.getElementById('btn-continue');
  if (btn) btn.style.display = save ? '' : 'none';
  const sub = document.getElementById('menu-sub');
  if (sub && save) sub.textContent = `Save found: mission ${save.missionIndex + 1} of 10 — $${save.cash.toLocaleString('en-US')}`;
}
window.__game = S;

let last = performance.now();
let frames = 0;

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  // Mouse aim: unproject the cursor onto the ground plane.
  if (S.flags.started && !S.flags.menu && S.player.onFoot) {
    const hit = renderer.screenToGround(input.mouseX, input.mouseY);
    if (hit) input.aimAngle = Math.atan2(hit.y - S.player.y, hit.x - S.player.x);
  }

  // Menu keys: shop / safehouse / pause, handled here (the sim owns the rest).
  if (S.flags.started && !S.flags.menu) {
    const jp = input.justPressed;
    if (jp.has('KeyE') && S.near.shop) {
      S.flags.paused = true;
      hud.showShop(true);
      audio.click();
    } else if (jp.has('KeyE') && S.near.safehouse) {
      S.flags.paused = true;
      hud.showSafehouse(true);
      audio.click();
    } else if (jp.has('Escape') || jp.has('KeyP')) {
      S.flags.paused = !S.flags.paused;
      hud.showPaused(S.flags.paused);
      audio.click();
    }
  } else if (S.flags.menu && input.justPressed.has('Enter')) {
    hud.showMenu(false);
    S.flags.menu = false;
    S.flags.started = true;
    audio.unlock();
    audio.setRadio(true);
    renderer.setMode('follow');
  }

  if (!S.flags.paused) {
    update(S, dt);
    for (const ev of S.events) handleEvent(ev);
    S.events.length = 0;
  } else {
    input.justPressed.clear();
  }

  // Engine + siren follow the sim.
  const driving = S.flags.started && !S.flags.menu && !!S.player.car;
  const speed01 = S.player.car ? Math.abs(S.player.car.speed) / S.player.car.maxSpeed : Math.abs(S.player.speed) / 215;
  audio.setEngine(speed01, driving && (input.keys.has('ShiftLeft') || input.keys.has('ShiftRight')), driving || S.player.speed > 1);
  audio.setSiren(S.wanted.level > 0 && S.flags.started && !S.flags.menu);
  audio.update(dt);

  effects.update(dt);
  renderer.render(S, dt);
  hud.update();

  frames += 1;
  if (frames === 4 && !window.__ready) window.__ready = true;
}

requestAnimationFrame(loop);
