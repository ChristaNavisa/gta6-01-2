// HUD for VERDE BAY 3D v8: DOM panels + a 2D minimap canvas. Reads the sim state
// every frame; never mutates it (except the shop buttons, which call buyShopItem).
import { WEAPONS, SHOP, RADIO_STATIONS } from './config.js';
import { districtNameAt } from './city.js';
import { fmtCash } from './util.js';
import { buyShopItem } from './sim.js';
import { MISSIONS } from './missions.js';

let els = null;
let minimap = null;
let mctx = null;
let shopBuilt = false;

export function initHud(S) {
  els = {
    cash: document.getElementById('hud-cash'),
    health: document.getElementById('hud-health'),
    armor: document.getElementById('hud-armor'),
    stars: document.getElementById('hud-stars'),
    heli: document.getElementById('hud-heli'),
    district: document.getElementById('hud-district'),
    clock: document.getElementById('hud-clock'),
    objective: document.getElementById('hud-objective'),
    weapons: document.getElementById('hud-weapons'),
    radio: document.getElementById('hud-radio'),
    prompt: document.getElementById('hud-prompt'),
    fanfare: document.getElementById('hud-fanfare'),
    menu: document.getElementById('menu'),
    shop: document.getElementById('shop'),
    shopList: document.getElementById('shop-list'),
    shopClose: document.getElementById('shop-close'),
  };
  minimap = document.getElementById('minimap');
  if (minimap) mctx = minimap.getContext('2d');
  if (els.shopClose) els.shopClose.addEventListener('click', () => { S.shop.open = false; });
  buildShop(S);
}

function buildShop(S) {
  if (shopBuilt || !els.shopList) return;
  shopBuilt = true;
  for (const [key, item] of Object.entries(SHOP)) {
    const row = document.createElement('div');
    row.className = 'shop-row';
    const label = document.createElement('span');
    label.textContent = `${item.label} — ${fmtCash(item.price)}`;
    const btn = document.createElement('button');
    btn.textContent = 'BUY';
    btn.addEventListener('click', () => {
      if (buyShopItem(S, key)) updateHud(S);
    });
    row.appendChild(label);
    row.appendChild(btn);
    els.shopList.appendChild(row);
  }
}

function starRow(level) {
  let s = '';
  for (let i = 1; i <= 5; i++) s += i <= level ? '★' : '☆';
  return s;
}

function clockText(dayTime) {
  const mins = Math.floor(dayTime * 24 * 60);
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  const night = dayTime > 0.75 || dayTime < 0.22;
  return `${hh}:${mm} ${night ? '🌙 NIGHT' : '☀️ DAY'}`;
}

export function updateHud(S) {
  if (!els) return;
  const p = S.player;
  els.cash.textContent = fmtCash(p.cash);
  els.health.textContent = `HP ${Math.max(0, Math.round(p.health))}`;
  els.health.style.color = p.health < 30 ? '#ff4444' : '#ffffff';
  els.armor.textContent = p.armor > 0 ? `ARMOR ${Math.round(p.armor)}` : '';
  els.stars.textContent = starRow(S.wanted.level);
  els.stars.style.color = S.wanted.level >= 3 ? '#ff4444' : '#ffd700';
  els.heli.style.display = S.heli ? 'block' : 'none';
  els.heli.textContent = S.heli ? '🚁 HELI ON YOU — LOSE THE HEAT' : '';
  els.district.textContent = districtNameAt(p.x, p.y);
  els.clock.textContent = clockText(S.dayTime);
  if (S.mission.active) {
    const def = S.mission.def;
    const stage = def.stages[S.mission.stage];
    els.objective.textContent = `${def.title}  •  ${stage ? stage.text : ''}  •  ${fmtCash(def.reward)}`;
  } else if (S.stats.missionsDone >= MISSIONS.length) {
    els.objective.textContent = 'ALL 12 MISSIONS DONE — KING OF VERDE 👑';
  } else {
    const next = MISSIONS[S.mission.index];
    els.objective.textContent = next ? `Next: ${next.title} — press M for the mission list` : '';
  }
  // Weapons.
  let whtml = '';
  WEAPONS.forEach((w, i) => {
    if (!p.weapons[i]) return;
    const cur = i === p.weapon ? '▶ ' : '';
    whtml += `<span class="${i === p.weapon ? 'w-cur' : ''}">${cur}${i + 1} ${w.name} ${p.ammo[i]}/${p.reserve[i]}</span> `;
  });
  els.weapons.innerHTML = whtml;
  els.radio.textContent = S.radio.on ? `📻 ${RADIO_STATIONS[S.radio.station]} (C)` : '📻 OFF (C)';
  // Prompts.
  let prompt = '';
  if (S.shop.near && !S.shop.open) prompt = 'Press E — Verde Arms shop';
  else if (S.safehouse.near) prompt = 'Press E — Safehouse: save + heal';
  else if (!p.car) prompt = 'Press E near a car to drive';
  els.prompt.textContent = prompt;
  // Fanfare banner.
  if (S.fanfare) {
    els.fanfare.textContent = S.fanfare.text;
    els.fanfare.style.display = 'block';
  } else {
    els.fanfare.style.display = 'none';
  }
  // Shop panel.
  if (els.shop) els.shop.style.display = S.shop.open ? 'block' : 'none';
  // Menu.
  if (els.menu) els.menu.style.display = S.flags.menu ? 'flex' : 'none';
  drawMinimap(S);
}

function drawMinimap(S) {
  if (!mctx || !minimap) return;
  const W = minimap.width, H = minimap.height;
  const sx = W / 3400, sy = H / 2100;
  mctx.clearRect(0, 0, W, H);
  mctx.fillStyle = '#16222e';
  mctx.fillRect(0, 0, W, H);
  // Water channel.
  mctx.fillStyle = '#2a6a8a';
  mctx.fillRect(2600 * sx, 0, 300 * sx, 950 * sy);
  // Roads.
  mctx.strokeStyle = '#3a3a3a';
  mctx.lineWidth = 2;
  for (const r of S.city.roads) {
    mctx.beginPath();
    mctx.moveTo(r.x0 * sx, r.y0 * sy);
    mctx.lineTo(r.x1 * sx, r.y1 * sy);
    mctx.stroke();
  }
  // Mission target.
  if (S.mission.active) {
    const stage = S.mission.def.stages[S.mission.stage];
    const place = stage && stage.target ? S.city.places[stage.target] : null;
    if (place) {
      mctx.fillStyle = '#ffd700';
      mctx.beginPath();
      mctx.arc(place.x * sx, place.y * sy, 5, 0, Math.PI * 2);
      mctx.fill();
    }
  }
  // Packages.
  mctx.fillStyle = '#22d3ee';
  for (const pkg of S.packages) {
    if (pkg.found) continue;
    mctx.fillRect(pkg.x * sx - 2, pkg.y * sy - 2, 4, 4);
  }
  // Cops (red), heli (orange), military (dark red).
  mctx.fillStyle = '#ff4444';
  for (const c of S.cops) mctx.fillRect(c.x * sx - 2, c.y * sy - 2, 4, 4);
  if (S.heli) {
    mctx.fillStyle = '#ff8800';
    mctx.beginPath();
    mctx.arc(S.heli.x * sx, S.heli.y * sy, 5, 0, Math.PI * 2);
    mctx.fill();
  }
  mctx.fillStyle = '#aa0000';
  for (const j of S.military) mctx.fillRect(j.x * sx - 2, j.y * sy - 2, 5, 5);
  // Player (white arrow).
  const p = S.player;
  mctx.fillStyle = '#ffffff';
  mctx.save();
  mctx.translate(p.x * sx, p.y * sy);
  mctx.rotate(p.angle);
  mctx.beginPath();
  mctx.moveTo(6, 0); mctx.lineTo(-4, -4); mctx.lineTo(-4, 4); mctx.closePath();
  mctx.fill();
  mctx.restore();
}
