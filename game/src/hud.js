// HUD: DOM readouts (money, wanted, health, armor, NOS, weapon, mission, clock)
// and the live minimap canvas.
import { fmtMoney, fmtTime, fmtClock, clamp, dist } from './util.js';
import { currentWeapon } from './weapons.js';
import { districtAt } from './city.js';
import { currentStep } from './missions.js';

export function updateHud(G, hud) {
  if (!hud) return;
  const p = G.player;
  hud.money.textContent = fmtMoney(G.money);
  hud.health.style.width = clamp(p.health, 0, 100) + '%';
  hud.armor.style.width = clamp(p.armor, 0, 100) + '%';
  hud.nos.style.width = clamp(p.car ? p.car.nos : 100, 0, 100) + '%';
  hud.speed.textContent = p.car ? Math.round(Math.abs(p.car.speed) * 0.36) + ' km/h' : 'ON FOOT';
  hud.clock.textContent = fmtClock(G.clock);
  hud.district.textContent = districtAt(p.x, p.y).name;
  const w = currentWeapon(G);
  hud.weapon.textContent = w.name + (w.id === 'fists' ? '' : ' • ' + (G.player.ammo[w.id] || 0));
  // Wanted stars.
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < G.wanted ? '★' : '☆';
  hud.wanted.textContent = stars;
  hud.wanted.className = 'wanted' + (G.wanted >= 3 ? ' hot' : '');
  // Mission tracker.
  if (G.mission) {
    const s = currentStep(G);
    hud.mission.textContent = '▸ ' + G.mission.def.title + (s ? ' — ' + s.label : '');
    if (G.race.active) hud.mission.textContent += '  •  RACE ' + fmtTime(G.race.time);
    if (G.taxi) hud.mission.textContent += '  •  TAXI ' + Math.ceil(G.taxi.timer) + 's';
  } else if (G.missionsDone.length >= 12) {
    hud.mission.textContent = '★ KING OF VERDE BAY — story complete!';
  } else {
    hud.mission.textContent = 'Press M to start mission ' + (G.missionsDone.length + 1) + ' of 12';
  }
  // Message toast.
  if (G.messageT > 0) {
    hud.toast.textContent = G.message;
    hud.toast.style.opacity = '1';
  } else {
    hud.toast.style.opacity = '0';
  }
  drawMinimap(G, hud.map);
}

export function drawMinimap(G, canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const S = canvas.width;
  const scale = S / 3600;
  ctx.clearRect(0, 0, S, S);
  // Districts.
  for (const d of G.cityDistricts) {
    ctx.fillStyle = d.base + 'cc';
    ctx.fillRect(d.x * scale, d.y * scale, d.w * scale, d.h * scale);
  }
  // Roads.
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 2;
  for (let gx = 0; gx <= 12; gx++) {
    ctx.beginPath(); ctx.moveTo(gx * 300 * scale, 0); ctx.lineTo(gx * 300 * scale, S); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, gx * 300 * scale); ctx.lineTo(S, gx * 300 * scale); ctx.stroke();
  }
  // Business + garage markers.
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(G.city.garage.x * scale - 3, G.city.garage.y * scale - 3, 6, 6);
  for (const b of G.city.businesses) {
    ctx.fillStyle = G.businesses.owned.includes(b.id) ? '#ffd166' : '#c9a86a';
    ctx.beginPath(); ctx.arc(b.x * scale, b.y * scale, 3, 0, Math.PI * 2); ctx.fill();
  }
  // Mission target.
  const t = G.missionTarget;
  if (t) {
    ctx.fillStyle = '#ffd166';
    ctx.beginPath(); ctx.arc(t.x * scale, t.y * scale, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  // Race checkpoints.
  if (G.race.active) {
    for (const pt of G.race.points) {
      ctx.fillStyle = '#7dff8a';
      ctx.beginPath(); ctx.arc(pt.x * scale, pt.y * scale, 3, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Taxi target.
  if (G.taxi) {
    const tx = G.taxi.stage === 'pickup' ? G.taxi.px : G.taxi.dx;
    const ty = G.taxi.stage === 'pickup' ? G.taxi.py : G.taxi.dy;
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath(); ctx.arc(tx * scale, ty * scale, 4, 0, Math.PI * 2); ctx.fill();
  }
  // Police.
  for (const c of G.cars) {
    if (c.kind === 'police' || c.kind === 'jeep') {
      ctx.fillStyle = '#2d7dff';
      ctx.beginPath(); ctx.arc(c.x * scale, c.y * scale, 3, 0, Math.PI * 2); ctx.fill();
    }
  }
  if (G.heli) {
    ctx.fillStyle = '#ff2d2d';
    ctx.beginPath(); ctx.arc(G.heli.x * scale, G.heli.y * scale, 4, 0, Math.PI * 2); ctx.fill();
  }
  // Player arrow.
  const px = G.player.x * scale, py = G.player.y * scale;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(G.player.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
  ctx.restore();
  // Viewport box.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(G.cam.x * scale, G.cam.y * scale, G.cam.w * scale, G.cam.h * scale);
}
