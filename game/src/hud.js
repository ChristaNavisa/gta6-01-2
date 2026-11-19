// VERDE BAY 3D v7 — the HUD: minimap, wanted stars, cash, health, speed, weapons,
// radio, mission objective, prompts, toasts, banners and the menu/shop panels.
// Pure DOM: every update is guarded so a missing element can never throw.

import { fmtCash } from './util.js';
import { WEAPONS, RADIO } from './config.js';
import { districtNameAt } from './city.js';
import { MISSIONS, missionObjective } from './missions.js';

function el(id) {
  return document.getElementById(id);
}

function setText(id, text) {
  const n = el(id);
  if (n) n.textContent = text;
}

function setVisible(id, on) {
  const n = el(id);
  if (n) n.classList.toggle('hidden', !on);
}

export function createHud(S, cb) {
  const H = {
    toastT: 0,
    bannerT: 0,
    minimapTick: 0,
  };

  const canvas = el('minimap');
  const mctx = canvas ? canvas.getContext('2d') : null;

  function drawMinimap() {
    if (!mctx || !canvas) return;
    const W = canvas.width;
    const Hh = canvas.height;
    const sx = W / 3400;
    const sy = Hh / 2200;
    mctx.clearRect(0, 0, W, Hh);
    // Sea + land.
    mctx.fillStyle = '#1e6f8e';
    mctx.fillRect(0, 0, W, Hh);
    mctx.fillStyle = '#5d7d4a';
    mctx.fillRect(0, 0, 2620 * sx, Hh);
    mctx.fillRect(2900 * sx, 700 * sy, 460 * sx, 800 * sy);
    // Beach strip.
    mctx.fillStyle = '#e8d5a3';
    mctx.fillRect(800 * sx, 1400 * sy, 1000 * sx, 500 * sy);
    // Roads.
    mctx.strokeStyle = '#3a3f46';
    mctx.lineWidth = 2;
    for (const r of S.city.roads) {
      mctx.beginPath();
      mctx.moveTo(r.x1 * sx, r.y1 * sy);
      mctx.lineTo(r.x2 * sx, r.y2 * sy);
      mctx.stroke();
    }
    // Hidden packages left.
    mctx.fillStyle = '#2ec4b6';
    for (const pkg of S.packages) {
      if (pkg.taken) continue;
      mctx.fillRect(pkg.x * sx - 2, pkg.y * sy - 2, 4, 4);
    }
    // Mission target.
    if (S.mission.active) {
      const stage = S.mission.def.stages[S.mission.stage];
      const place = stage && S.city.places[stage.target];
      if (place) {
        const pulse = 5 + Math.sin(S.time * 5) * 2;
        mctx.fillStyle = '#ffd60a';
        mctx.beginPath();
        mctx.arc(place.x * sx, place.y * sy, pulse, 0, Math.PI * 2);
        mctx.fill();
        mctx.fillStyle = '#000';
        mctx.beginPath();
        mctx.arc(place.x * sx, place.y * sy, 2, 0, Math.PI * 2);
        mctx.fill();
      }
    }
    // Cops.
    mctx.fillStyle = '#ff2e4d';
    for (const c of S.cops) mctx.fillRect(c.x * sx - 2, c.y * sy - 2, 4, 4);
    for (const c of S.footCops) mctx.fillRect(c.x * sx - 2, c.y * sy - 2, 4, 4);
    if (S.heli.active) {
      mctx.strokeStyle = '#ff2e4d';
      mctx.beginPath();
      mctx.arc(S.heli.x * sx, S.heli.y * sy, 5, 0, Math.PI * 2);
      mctx.stroke();
    }
    // Player arrow.
    const p = S.player;
    mctx.save();
    mctx.translate(p.x * sx, p.y * sy);
    mctx.rotate(p.angle);
    mctx.fillStyle = '#ffffff';
    mctx.strokeStyle = '#111';
    mctx.beginPath();
    mctx.moveTo(7, 0);
    mctx.lineTo(-5, -4);
    mctx.lineTo(-5, 4);
    mctx.closePath();
    mctx.fill();
    mctx.stroke();
    mctx.restore();
  }

  H.update = function update() {
    const p = S.player;
    H.minimapTick += 1;
    if (H.minimapTick % 2 === 0) drawMinimap();
    // Wanted stars.
    const stars = el('wanted');
    if (stars) {
      let html = '';
      for (let i = 0; i < 5; i++) html += `<span class="star${i < S.wanted.level ? ' on' : ''}">★</span>`;
      stars.innerHTML = html;
    }
    setText('cash', fmtCash(p.cash));
    const hf = el('health-fill');
    if (hf) hf.style.width = Math.max(0, p.health) + '%';
    const af = el('armor-fill');
    if (af) af.style.width = Math.max(0, p.armor) + '%';
    const nf = el('nitro-fill');
    if (nf) nf.style.width = (p.car ? p.car.nitro : 0) + '%';
    setText('speed-num', p.car ? String(Math.round(Math.abs(p.car.speed) * 0.9)) : '0');
    const w = WEAPONS[p.weapon];
    const slot = p.weapons[p.weapon];
    setText('weapon-name', w ? w.name : '');
    setText('weapon-ammo', slot ? `${slot.inMag} / ${slot.reserve === Infinity ? '∞' : slot.reserve}` : '');
    // Weapon slots.
    for (const key of ['pistol', 'smg', 'shotgun']) {
      const n = el('slot-' + key);
      if (!n) continue;
      n.classList.toggle('owned', !!p.weapons[key].owned);
      n.classList.toggle('active', p.weapon === key);
    }
    setText('radio-name', RADIO[S.radio.station].name);
    setText('district-name', districtNameAt(p.x, p.y));
    setText('clock', new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
    // Mission panel.
    if (S.mission.active) {
      setText('mission-title', `${S.mission.def.title} — ${fmtCash(S.mission.def.reward)}`);
      setText('mission-text', missionObjective(S));
    } else if (S.mission.index >= MISSIONS.length) {
      setText('mission-title', 'Story complete');
      setText('mission-text', 'Free roam — find all 10 hidden packages.');
    } else {
      setText('mission-title', MISSIONS[S.mission.index].title);
      setText('mission-text', 'Press M to start — ' + fmtCash(MISSIONS[S.mission.index].reward));
    }
    // Prompt line.
    let prompt = '';
    if (S.flags.menu) prompt = '';
    else if (p.onFoot && S.near.car) prompt = 'Press F to steal the ' + (S.near.car.type || 'car');
    else if (!p.onFoot) prompt = 'F — get out   •   Shift — nitro   •   C — radio   •   1/2/3 — weapons';
    else if (S.near.shop) prompt = 'Press E — Verde Arms (buy weapons & ammo)';
    else if (S.near.safehouse) prompt = 'Press E — Safehouse (save + heal)';
    else prompt = 'WASD — move/drive   •   F — enter car   •   M — mission   •   Click — shoot';
    setText('prompt', prompt);
    // Toast + banner timers.
    if (H.toastT > 0) {
      H.toastT -= 1 / 60;
      if (H.toastT <= 0) setVisible('toast', false);
    }
    if (H.bannerT > 0) {
      H.bannerT -= 1 / 60;
      if (H.bannerT <= 0) setVisible('banner', false);
    }
  };

  H.toast = function toast(text) {
    setText('toast-text', text);
    setVisible('toast', true);
    H.toastT = 3;
  };

  H.banner = function banner(title, sub) {
    setText('banner-title', title);
    setText('banner-sub', sub || '');
    setVisible('banner', true);
    H.bannerT = 4;
  };

  H.showMenu = function showMenu(on) {
    setVisible('menu', on);
    setVisible('hud', !on);
  };

  H.showPaused = function showPaused(on) {
    setVisible('pause-panel', on);
  };

  H.showBusted = function showBusted(on) {
    setVisible('busted-panel', on);
  };

  H.showWasted = function showWasted(on) {
    setVisible('wasted-panel', on);
  };

  H.showShop = function showShop(on) {
    setVisible('shop-panel', on);
    if (on) H.refreshShop();
  };

  H.showSafehouse = function showSafehouse(on) {
    setVisible('safehouse-panel', on);
  };

  H.refreshShop = function refreshShop() {
    const p = S.player;
    const list = el('shop-items');
    if (!list) return;
    const items = [
      { key: 'smg', label: 'VK-9 SMG — $1,500', can: !p.weapons.smg.owned, price: 1500 },
      { key: 'shotgun', label: 'M12 Scattergun — $2,500', can: !p.weapons.shotgun.owned, price: 2500 },
      { key: 'ammoPistol', label: 'Pistol ammo (48) — $120', can: true, price: 120 },
      { key: 'ammoSmg', label: 'SMG ammo (120) — $300', can: p.weapons.smg.owned, price: 300 },
      { key: 'ammoShotgun', label: 'Shells (24) — $240', can: p.weapons.shotgun.owned, price: 240 },
      { key: 'armor', label: 'Body armor (50) — $400', can: p.armor < 50, price: 400 },
      { key: 'health', label: 'First aid (full health) — $250', can: p.health < 100, price: 250 },
    ];
    list.innerHTML = '';
    for (const it of items) {
      const b = document.createElement('button');
      b.className = 'shop-item';
      b.textContent = it.label + (it.can ? '' : ' — owned');
      b.disabled = !it.can || p.cash < it.price;
      b.addEventListener('click', () => cb.onBuy(it.key, it.price));
      list.appendChild(b);
    }
    setText('shop-cash', fmtCash(p.cash));
  };

  // Wire the static buttons once.
  const wire = (id, fn) => {
    const n = el(id);
    if (n) n.addEventListener('click', fn);
  };
  wire('btn-start', () => cb.onStart(false));
  wire('btn-continue', () => cb.onStart(true));
  wire('btn-resume', () => cb.onResume());
  wire('btn-restart', () => cb.onRestart());
  wire('btn-shop-close', () => cb.onClosePanels());
  wire('btn-safehouse-close', () => cb.onClosePanels());
  wire('btn-safehouse-save', () => cb.onSave());
  wire('btn-busted-ok', () => cb.onClosePanels());
  wire('btn-wasted-ok', () => cb.onClosePanels());

  return H;
}
