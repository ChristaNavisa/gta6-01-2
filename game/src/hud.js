// HUD: DOM readouts (stars, cash, health, objective, speed, messages) + minimap.
import { ROAD_X, ROAD_Y, ROAD_W, WORLD_W, WORLD_H, BEACH_Y } from './config.js';
import { districtNameAt } from './city.js';

export function createHud(doc) {
  return {
    stars: doc.getElementById('stars'),
    cash: doc.getElementById('cash'),
    hpBar: doc.getElementById('hpbar'),
    armorBar: doc.getElementById('armorbar'),
    ammo: doc.getElementById('ammo'),
    objective: doc.getElementById('objective'),
    speed: doc.getElementById('speed'),
    district: doc.getElementById('district'),
    message: doc.getElementById('message'),
    minimap: doc.getElementById('minimap'),
    last: {},
  };
}

function setText(el, key, hud, text) {
  if (hud.last[key] !== text) { hud.last[key] = text; el.textContent = text; }
}

export function updateHud(S) {
  const hud = S.hud;
  if (!hud) return;
  const p = S.player;
  const w = S.wanted;

  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < w.level ? '★' : '☆';
  setText(hud.stars, 'stars', hud, stars);
  hud.stars.className = 'stars' + (w.level > 0 ? ' hot' : '');

  setText(hud.cash, 'cash', hud, `$${Math.round(p.cash).toLocaleString('en-US')}`);
  setText(hud.ammo, 'ammo', hud, p.onFoot ? `🔫 ${p.ammo}` : '🚗');
  const hpPct = Math.round((p.hp / 100) * 100);
  if (hud.last.hp !== hpPct) { hud.last.hp = hpPct; hud.hpBar.style.width = hpPct + '%'; }
  const arPct = Math.round(p.armor);
  if (hud.last.ar !== arPct) { hud.last.ar = arPct; hud.armorBar.style.width = arPct + '%'; }

  const obj = S.mission.active ? S.mission.objective : (S.mission.index >= 6 ? 'All jobs done — Verde Bay is yours.' : 'Head to Mara\'s Garage to start the next job.');
  setText(hud.objective, 'obj', hud, obj);

  const spd = p.car ? Math.round(Math.abs(p.car.speed) * 0.12) : Math.round(p.speed * 0.12);
  setText(hud.speed, 'speed', hud, p.car ? `${spd} mph · ${p.car.name}` : (p.moving ? 'On foot' : ''));
  const px = p.car ? p.car.x : p.x;
  const py = p.car ? p.car.y : p.y;
  setText(hud.district, 'district', hud, `📍 ${districtNameAt(px, py)}`);

  if (S.messageT > 0) {
    setText(hud.message, 'msg', hud, S.message);
    hud.message.style.opacity = '1';
  } else {
    hud.message.style.opacity = '0';
  }

  drawMinimap(S);
}

function drawMinimap(S) {
  const cv = S.hud.minimap;
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const mw = cv.width, mh = cv.height;
  const sx = mw / WORLD_W, sy = mh / WORLD_H;
  ctx.clearRect(0, 0, mw, mh);
  ctx.fillStyle = '#20242e';
  ctx.fillRect(0, 0, mw, mh);
  // Water + beach.
  ctx.fillStyle = '#2b7fa3';
  ctx.fillRect(0, BEACH_Y * sy, mw, mh - BEACH_Y * sy);
  ctx.fillStyle = '#e9d8a6';
  ctx.fillRect(0, (BEACH_Y - 20) * sy, mw, 20 * sy);
  // District tints so the map reads as places, not just roads.
  const mmTint = { downtown: 'rgba(74,111,165,0.40)', industrial: 'rgba(122,106,88,0.40)', beach: 'rgba(233,196,106,0.35)', oldtown: 'rgba(181,84,60,0.32)' };
  for (const d of S.city.districts) {
    if (mmTint[d.id]) { ctx.fillStyle = mmTint[d.id]; ctx.fillRect(d.x * sx, d.y * sy, d.w * sx, d.h * sy); }
  }
  // Roads.
  ctx.fillStyle = '#5a6068';
  for (const rx of ROAD_X) ctx.fillRect(rx * sx - 1, 0, 3, mh);
  for (const ry of ROAD_Y) ctx.fillRect(0, ry * sy - 1, mw, 3);
  // Buildings.
  ctx.fillStyle = '#8a8f98';
  for (const b of S.city.buildings) ctx.fillRect(b.x * sx, b.y * sy, Math.max(1.5, b.w * sx), Math.max(1.5, b.h * sy));
  // Mission marker.
  const m = S.mission.marker || (S.taxi && S.taxi.marker);
  if (m) {
    ctx.fillStyle = '#ffd166';
    ctx.beginPath(); ctx.arc(m.x * sx, m.y * sy, 4, 0, Math.PI * 2); ctx.fill();
  }
  // Police (red) and traffic (grey).
  for (const c of S.cars) {
    ctx.fillStyle = c.kind === 'police' ? '#ff2e2e' : '#c8c8c8';
    ctx.fillRect(c.x * sx - 1.5, c.y * sy - 1.5, 3, 3);
  }
  // Player arrow.
  const p = S.player;
  const px = p.car ? p.car.x : p.x;
  const py = p.car ? p.car.y : p.y;
  ctx.save();
  ctx.translate(px * sx, py * sy);
  ctx.rotate(p.car ? p.car.angle : p.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill();
  ctx.restore();
}
