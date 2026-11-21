// VERDE BAY — main game: state, loop, player controls, menus, rendering.
// A 2D top-down open-world crime game. All systems live in src/ modules.
import { WORLD, DISTRICTS, MISSIONS, TIPS, GARAGE_POS, GUNSTORE_POS, HOSPITAL_POS } from './config.js';
import { clamp, dist, angleTo, rand } from './util.js';
import { buildCity, drawCity, resolveBuildings, districtAt } from './city.js';
import { createInput, isDown, aimAngle, consume } from './input.js';
import { initAudio, sfx, engineStart, engineUpdate, startRadio, nextStation, toggleMute, currentStation } from './audio.js';
import { createEffects, updateEffects, drawEffects, drawDayNight, addText, spawnBurst } from './effects.js';
import { makeCar, spawnTraffic, spawnParked, updateCars, stepPlayerCar, drawCars, hurtPlayer } from './vehicles.js';
import { tryFire, updateBullets, drawBullets, switchWeapon, buyWeapon, buyAmmo, currentWeapon, raiseWanted } from './weapons.js';
import { spawnPeds, updatePeds, updatePolice, updateTaxi, updateBusinesses, drawHeli, drawPeds, startTaxiFare } from './sim.js';
import { startMission, updateMissions, updateEnemies, drawEnemies, drawMissionMarker, missionTarget } from './missions.js';
import { updateRace, drawRace } from './race.js';
import { garageHtml, buyCar, upgradeCar, takeCarOut, enterCar, exitCar, nearestStealable } from './garage.js';
import { spawnCrewBackup, updateCrewBackup, drawCrewBackup, respectHtml, crewInfo } from './crew.js';
import { updateHud } from './hud.js';
import { saveGame, loadGame, hasSave, applySave, clearSave } from './save.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const minimap = document.getElementById('minimap');
const hudEls = {
  money: document.getElementById('hud-money'),
  health: document.getElementById('hud-health'),
  armor: document.getElementById('hud-armor'),
  nos: document.getElementById('hud-nos'),
  speed: document.getElementById('hud-speed'),
  clock: document.getElementById('hud-clock'),
  district: document.getElementById('hud-district'),
  weapon: document.getElementById('hud-weapon'),
  wanted: document.getElementById('hud-wanted'),
  mission: document.getElementById('hud-mission'),
  toast: document.getElementById('hud-toast'),
  map: minimap,
};

function newGame() {
  return {
    mode: 'title', time: 0, clock: 8.5, money: 1500,
    player: {
      x: 660, y: 660, angle: 0, health: 100, armor: 0,
      onFoot: true, car: null, weapon: 'fists',
      weapons: ['fists', 'pistol'], ammo: { pistol: 48 },
      airborne: 0, airTime: 0, recoil: 0,
    },
    cars: [], peds: [], enemies: [], bullets: [],
    wanted: 0, heat: 0, heli: null,
    mission: null, missionsDone: [],
    race: { active: false, idx: 0, time: 0, points: [], best: null, lastWon: false },
    taxi: null, garage: { owned: ['sedan'], upgrades: { sedan: { engine: 0, armor: 0, nos: 0 } } },
    businesses: { owned: [] }, businessIncome: 0,
    crew: { mara: false, dario: false, respect: {} },
    crewBackup: null, stats: { fares: 0, missions: 0, bestRace: null, kills: 0 },
    message: '', messageT: 0, fireCooldown: 0, shotsFiredRecently: false,
    cam: { x: 0, y: 0, w: 1280, h: 720 },
    wheelOpen: false, tipIndex: 0,
  };
}

const G = newGame();
G.city = buildCity();
G.cityDistricts = DISTRICTS;
G.fx = createEffects();
const input = createInput(canvas);
let last = performance.now();
let fps = 60;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  G.cam.w = canvas.width;
  G.cam.h = canvas.height;
}
window.addEventListener('resize', resize);
resize();

// ---------- Menus (DOM) ----------
const titleEl = document.getElementById('title-screen');
const pauseEl = document.getElementById('pause-menu');
const garageEl = document.getElementById('garage-menu');
const wheelEl = document.getElementById('weapon-wheel');
const deadEl = document.getElementById('dead-screen');
const helpEl = document.getElementById('help-box');

function show(el, on) { if (el) el.style.display = on ? 'flex' : 'none'; }
function setMode(m) {
  G.mode = m;
  // The HUD belongs to gameplay, not the title screen.
  document.getElementById('hud').style.display = m === 'title' ? 'none' : 'block';
  show(titleEl, m === 'title');
  show(pauseEl, m === 'pause');
  show(garageEl, m === 'garage');
  show(deadEl, m === 'dead');
  if (m !== 'garage') garageEl.innerHTML = '';
}

document.getElementById('btn-new').addEventListener('click', () => {
  clearSave();
  Object.assign(G, newGame());
  G.city = buildCity(); G.cityDistricts = DISTRICTS; G.fx = createEffects();
  spawnTraffic(G, 14); spawnParked(G, 6); spawnPeds(G, 26);
  initAudio(); engineStart(); startRadio();
  setMode('play');
  startMission(G, 0);
  sfx('fanfare');
});
document.getElementById('btn-continue').addEventListener('click', () => {
  const data = loadGame();
  if (data) applySave(G, data);
  spawnTraffic(G, 14); spawnParked(G, 6); spawnPeds(G, 26);
  initAudio(); engineStart(); startRadio();
  setMode('play');
  sfx('pickup');
});
document.getElementById('btn-resume').addEventListener('click', () => setMode('play'));
document.getElementById('btn-save-quit').addEventListener('click', () => { saveGame(G); setMode('title'); });
document.getElementById('btn-restart').addEventListener('click', () => {
  Object.assign(G, newGame());
  G.city = buildCity(); G.cityDistricts = DISTRICTS; G.fx = createEffects();
  spawnTraffic(G, 14); spawnParked(G, 6); spawnPeds(G, 26);
  setMode('play');
  startMission(G, 0);
});
document.getElementById('btn-help').addEventListener('click', () => {
  helpEl.style.display = helpEl.style.display === 'block' ? 'none' : 'block';
});

// Garage overlay clicks (delegated).
garageEl.addEventListener('click', (e) => {
  const buy = e.target.closest('[data-buy]');
  const take = e.target.closest('[data-take]');
  const up = e.target.closest('[data-up]');
  const close = e.target.closest('[data-close-garage]');
  if (buy && buyCar(G, buy.dataset.buy)) refreshGarage();
  if (take) { takeCarOut(G, take.dataset.take); setMode('play'); }
  if (up) {
    const [id, part] = up.dataset.up.split(':');
    if (upgradeCar(G, id, part)) refreshGarage();
  }
  if (close) setMode('play');
});

function refreshGarage() {
  garageEl.innerHTML = garageHtml(G)
    + `<h3>CREW</h3><div class="crew-list">${crewInfo(G).map((c) => `<div>${c.recruited ? '✓' : '○'} <b>${c.name}</b> — ${c.role}<br><span>${c.perk}</span></div>`).join('')}</div>`
    + `<h3>DISTRICT RESPECT</h3><div class="respect-list">${respectHtml(G)}</div>`;
}

// ---------- Player ----------
function updatePlayer(dt) {
  const p = G.player;
  G.fireCooldown = Math.max(0, G.fireCooldown - dt);
  if (p.recoil > 0) p.recoil -= dt;
  if (p.car) {
    stepPlayerCar(G, dt, input);
    engineUpdate(Math.abs(p.car.speed) / p.car.top, true);
  } else {
    engineUpdate(0, false);
    const mx = (isDown(input, 'KeyD', 'ArrowRight') ? 1 : 0) - (isDown(input, 'KeyA', 'ArrowLeft') ? 1 : 0);
    const my = (isDown(input, 'KeyS', 'ArrowDown') ? 1 : 0) - (isDown(input, 'KeyW', 'ArrowUp') ? 1 : 0);
    const run = isDown(input, 'ShiftLeft', 'ShiftRight') ? 1.6 : 1;
    const len = Math.hypot(mx, my) || 1;
    const sp = 185 * run;
    p.x += (mx / len) * sp * dt * (mx || my ? 1 : 0);
    p.y += (my / len) * sp * dt * (mx || my ? 1 : 0);
    if (mx || my) p.angle = Math.atan2(my, mx);
    p.x = clamp(p.x, 40, WORLD.w - 40);
    p.y = clamp(p.y, 40, WORLD.h - 40);
    resolveBuildings(G.city, p, 12);
    // Aim with the mouse while on foot.
    const sx = p.x - G.cam.x, sy = p.y - G.cam.y;
    p.aim = aimAngle(input, sx, sy);
    if (input.mouseDown || (currentWeapon(G).auto && input.mouseDown)) tryFire(G, p.aim);
    if (input.mouseClicked) { tryFire(G, p.aim); input.mouseClicked = false; G.shotsFiredRecently = true; setTimeout(() => { G.shotsFiredRecently = false; }, 1500); }
  }
  // Weapon wheel / switching.
  if (isDown(input, 'KeyQ')) {
    G.wheelOpen = true;
    wheelEl.style.display = 'flex';
    const items = ['fists', 'pistol', 'smg', 'shotgun', 'rifle'].filter((id) => p.weapons.includes(id));
    wheelEl.innerHTML = items.map((id) => {
      const w = currentWeapon(G);
      const def = { fists: 'Fists', pistol: 'P9 Pistol', smg: 'VB SMG', shotgun: 'Street Sweeper', rifle: 'Longshot Rifle' }[id];
      return `<div class="wheel-item ${id === p.weapon ? 'active' : ''}" data-w="${id}">${def}<span>${id === 'fists' ? '∞' : p.ammo[id] || 0}</span></div>`;
    }).join('');
  } else if (G.wheelOpen) {
    G.wheelOpen = false;
    wheelEl.style.display = 'none';
    const hovered = document.querySelector('.wheel-item:hover');
    if (hovered) switchWeapon(G, hovered.dataset.w);
  }
  for (const [i, id] of ['fists', 'pistol', 'smg', 'shotgun', 'rifle'].entries()) {
    if (consume(input, 'Digit' + (i + 1))) switchWeapon(G, id);
  }
  if (input.wheelDir) {
    const ids = ['fists', 'pistol', 'smg', 'shotgun', 'rifle'].filter((id) => p.weapons.includes(id));
    const i = ids.indexOf(p.weapon);
    switchWeapon(G, ids[(i + input.wheelDir + ids.length) % ids.length]);
    input.wheelDir = 0;
  }
  // Enter / exit / steal cars.
  if (consume(input, 'KeyE')) {
    if (p.car) {
      exitCar(G);
    } else {
      const c = nearestStealable(G);
      if (c) {
        const wasParked = c.kind === 'parked';
        enterCar(G, c);
        if (!wasParked) {
          raiseWanted(G, 1);
          addText(G.fx, p.x, p.y - 30, 'CAR STOLEN! +★', '#ff5a5a');
          sfx('siren');
        }
        sfx('door');
      }
    }
  }
  // Interact: garage, gun store, hospital, business, taxi, mission start.
  if (consume(input, 'KeyG')) {
    if (dist(p.x, p.y, GARAGE_POS.x, GARAGE_POS.y) < 90) {
      refreshGarage();
      setMode('garage');
    }
  }
  if (consume(input, 'KeyB')) {
    const b = G.city.businesses.find((x) => dist(p.x, p.y, x.x, x.y) < 90);
    if (b) {
      if (G.businesses.owned.includes(b.id)) {
        G.message = b.name + ' is already yours. Income: $' + b.income + '/min.';
        G.messageT = 4;
      } else if (G.money >= b.price) {
        G.money -= b.price;
        G.businesses.owned.push(b.id);
        G.message = 'You bought ' + b.name + ' for $' + b.price.toLocaleString() + '!';
        G.messageT = 5;
        sfx('cash');
      } else {
        G.message = b.name + ' costs $' + b.price.toLocaleString() + '. You have $' + Math.floor(G.money).toLocaleString() + '.';
        G.messageT = 4;
      }
    }
  }
  if (consume(input, 'KeyT')) {
    if (!G.taxi && p.car) startTaxiFare(G);
  }
  if (consume(input, 'KeyM')) {
    if (!G.mission && G.missionsDone.length < 12) startMission(G, G.missionsDone.length);
  }
  if (consume(input, 'KeyR')) { G.message = 'Radio: ' + nextStation(); G.messageT = 3; sfx('radio'); }
  if (consume(input, 'KeyN')) { const m = toggleMute(); G.message = m ? 'Sound muted' : 'Sound on'; G.messageT = 2; }
  if (consume(input, 'KeyH')) {
    if (dist(p.x, p.y, HOSPITAL_POS.x, HOSPITAL_POS.y) < 90 && G.money >= 200) {
      G.money -= 200;
      p.health = 100; p.armor = 50;
      G.message = 'Patched up at the hospital. -$200';
      G.messageT = 4;
      sfx('pickup');
    }
  }
  if (consume(input, 'KeyU')) {
    if (dist(p.x, p.y, GUNSTORE_POS.x, GUNSTORE_POS.y) < 90) {
      // Quick buy: next unowned weapon, else ammo for current.
      const next = ['pistol', 'smg', 'shotgun', 'rifle'].find((id) => !p.weapons.includes(id));
      if (next) {
        if (buyWeapon(G, next)) { G.message = 'Bought the ' + next.toUpperCase() + '!'; G.messageT = 3; }
        else { G.message = 'Not enough cash for the ' + next.toUpperCase() + '.'; G.messageT = 3; }
      } else if (buyAmmo(G, p.weapon)) {
        G.message = 'Ammo restocked.'; G.messageT = 3;
      }
    }
  }
  if (consume(input, 'Escape')) { setMode('pause'); }
  if (consume(input, 'KeyP')) { saveGame(G); G.message = 'Game saved.'; G.messageT = 3; }
}

function updateCamera(dt) {
  const tx = clamp(G.player.x - G.cam.w / 2, 0, WORLD.w - G.cam.w);
  const ty = clamp(G.player.y - G.cam.h / 2, 0, WORLD.h - G.cam.h);
  G.cam.x += (tx - G.cam.x) * Math.min(1, dt * 6);
  G.cam.y += (ty - G.cam.y) * Math.min(1, dt * 6);
}

// ---------- Render ----------
function drawPlayer(ctx, cam) {
  const p = G.player;
  if (p.car) return;
  const x = p.x - cam.x, y = p.y - cam.y;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(x, y + 9, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2c3e50';
  ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f5d0a9';
  ctx.beginPath(); ctx.arc(x + Math.cos(p.angle) * 5, y + Math.sin(p.angle) * 5, 6, 0, Math.PI * 2); ctx.fill();
  // Gun in hand.
  const w = currentWeapon(G);
  if (w.id !== 'fists') {
    ctx.strokeStyle = w.color; ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(p.aim || 0) * 10, y + Math.sin(p.aim || 0) * 10);
    ctx.lineTo(x + Math.cos(p.aim || 0) * 24, y + Math.sin(p.aim || 0) * 24);
    ctx.stroke();
  }
}

function drawWorld() {
  const cam = G.cam;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // The city draws in world coordinates; shift the context by the camera.
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  drawCity(ctx, G.city, cam, G);
  ctx.restore();
  drawEffects(ctx, G.fx, cam);
  drawMissionMarker(ctx, G, cam);
  drawRace(ctx, G, cam);
  drawPeds(ctx, G, cam);
  drawEnemies(ctx, G, cam);
  drawCrewBackup(ctx, G, cam);
  drawCars(ctx, G, cam);
  drawPlayer(ctx, cam);
  drawBullets(ctx, G, cam);
  drawHeli(ctx, G, cam);
  drawDayNight(ctx, canvas.width, canvas.height, G.clock);
  // Vignette.
  const grad = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.height * 0.45, canvas.width / 2, canvas.height / 2, canvas.height * 0.85);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawTitleBackdrop() {
  // Animated city pan behind the title screen.
  G.cam.x = (Math.sin(G.time * 0.05) * 0.5 + 0.5) * (WORLD.w - G.cam.w);
  G.cam.y = (Math.cos(G.time * 0.04) * 0.5 + 0.5) * (WORLD.h - G.cam.h);
  ctx.save();
  ctx.translate(-G.cam.x, -G.cam.y);
  drawCity(ctx, G.city, G.cam, G);
  ctx.restore();
  drawDayNight(ctx, canvas.width, canvas.height, G.clock);
}

// ---------- Loop ----------
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  fps = fps * 0.95 + (1 / Math.max(dt, 0.001)) * 0.05;
  G.time += dt;
  if (G.mode === 'title') {
    drawTitleBackdrop();
    document.getElementById('btn-continue').style.display = hasSave() ? 'block' : 'none';
    return;
  }
  if (G.mode === 'pause' || G.mode === 'garage') {
    // Menus still listen for Escape / G so the player can always get back in.
    if (consume(input, 'Escape')) { setMode('play'); }
    if (G.mode === 'garage' && consume(input, 'KeyG')) { setMode('play'); }
    drawWorld();
    updateHud(G, hudEls);
    return;
  }
  if (G.mode === 'dead') {
    drawWorld();
    updateHud(G, hudEls);
    return;
  }
  if (G.mode !== 'play') return;
  // Clock: 1 game hour per 90 real seconds.
  G.clock = (G.clock + dt / 90) % 24;
  if (G.messageT > 0) G.messageT -= dt;
  updatePlayer(dt);
  updateCars(G, dt);
  updatePeds(G, dt);
  updatePolice(G, dt);
  updateBullets(G, dt);
  updateEnemies(G, dt);
  updateCrewBackup(G, dt);
  updateMissions(G, dt);
  updateRace(G, dt);
  updateTaxi(G, dt);
  updateBusinesses(G, dt);
  updateEffects(G.fx, dt);
  updateCamera(dt);
  G.missionTarget = missionTarget(G);
  if (G.mission && G.mission.def.steps[G.mission.step] && G.mission.def.steps[G.mission.step].type === 'kill') spawnCrewBackup(G);
  // Tip rotator.
  if (Math.floor(G.time) % 12 === 0 && Math.floor(G.time) !== G.tipIndex) {
    G.tipIndex = Math.floor(G.time);
    if (Math.random() < 0.5) { G.message = 'TIP: ' + TIPS[Math.floor(Math.random() * TIPS.length)]; G.messageT = 5; }
  }
  drawWorld();
  updateHud(G, hudEls);
}

// ---------- Boot ----------
spawnTraffic(G, 14);
spawnParked(G, 6);
spawnPeds(G, 26);
setMode('title');
// Debug/testing handle: lets automated playtests read game state (harmless in play).
window.__verde = G;
const params = new URLSearchParams(window.location.search);
if (params.get('shot')) {
  applyShot(G, params);
  // applyShot sets G.mode directly; sync the DOM overlays to match it, so a
  // screenshot pose never leaves the title screen on top of the game.
  if (G.mode === 'garage') { refreshGarage(); setMode('garage'); }
  else if (G.mode === 'play') { setMode('play'); }
} else {
  window.__shotReady = true;
}
requestAnimationFrame(frame);
