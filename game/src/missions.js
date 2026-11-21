// Twelve story missions, run by a small step interpreter.
// Step types: goto, drive, carjack, collect, kill, race, taxi, business, survive.
import { MISSIONS } from './config.js';
import { dist, clamp } from './util.js';
import { addText, spawnBurst } from './effects.js';
import { sfx } from './audio.js';
import { startRace } from './race.js';
import { startTaxiFare, gainRespect } from './sim.js';
import { districtAt } from './city.js';

export function startMission(G, index) {
  const def = MISSIONS[index];
  if (!def) return false;
  G.mission = {
    index, def, step: 0, timer: 0, enemiesSpawned: false, taxiDone: 0,
    surviveT: 0, raceDone: false,
  };
  G.message = def.title + ' — ' + def.briefing;
  G.messageT = 6;
  sfx('pickup');
  return true;
}

export function currentStep(G) {
  if (!G.mission) return null;
  return G.mission.def.steps[G.mission.step] || null;
}

export function missionTarget(G) {
  const s = currentStep(G);
  if (!s) return null;
  if (s.type === 'race' || s.type === 'taxi' || s.type === 'survive') return null;
  return { x: s.x, y: s.y, label: s.label };
}

function advanceStep(G) {
  const m = G.mission;
  m.step++;
  m.enemiesSpawned = false;
  m.timer = 0;
  if (m.step >= m.def.steps.length) completeMission(G);
  else sfx('pickup');
}

function completeMission(G) {
  const m = G.mission;
  G.money += m.def.payout;
  G.missionsDone.push(m.def.id);
  gainRespect(G, districtAt(G.player.x, G.player.y).id, 12);
  G.message = 'MISSION COMPLETE: ' + m.def.title + '  +$' + m.def.payout;
  G.messageT = 6;
  addText(G.fx, G.player.x, G.player.y - 40, 'MISSION COMPLETE +$' + m.def.payout, '#7dff8a');
  sfx('fanfare');
  // Crew recruitment milestones.
  if (m.def.id === 'm4') { G.crew.mara = true; G.message += '  — Mara joined the crew!'; }
  if (m.def.id === 'm7') { G.crew.dario = true; G.message += '  — Dario joined the crew!'; }
  G.mission = null;
  G.stats.missions++;
}

function spawnMissionEnemies(G, step) {
  const n = step.count || 3;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    G.enemies.push({
      kind: 'enemy', x: step.x + Math.cos(a) * 120, y: step.y + Math.sin(a) * 120,
      angle: 0, speed: 95, hp: 60, color: '#8e44ad', shootT: 1 + Math.random(), dead: false,
    });
  }
  G.mission.enemiesSpawned = true;
}

export function updateMissions(G, dt) {
  const m = G.mission;
  if (!m) return;
  const s = currentStep(G);
  if (!s) return;
  m.timer += dt;
  const p = G.player;
  switch (s.type) {
    case 'goto': {
      if (dist(p.x, p.y, s.x, s.y) < 52) advanceStep(G);
      break;
    }
    case 'drive': {
      if (!p.car) break;
      if (dist(p.x, p.y, s.x, s.y) < 60) advanceStep(G);
      break;
    }
    case 'carjack': {
      if (p.car && dist(p.x, p.y, s.x, s.y) < 90) advanceStep(G);
      break;
    }
    case 'collect': {
      if (dist(p.x, p.y, s.x, s.y) < 48) {
        G.money += 150;
        addText(G.fx, s.x, s.y - 24, 'PICKED UP +$150', '#ffd166');
        sfx('pickup');
        advanceStep(G);
      }
      break;
    }
    case 'kill': {
      if (!m.enemiesSpawned) spawnMissionEnemies(G, s);
      const alive = G.enemies.filter((e) => !e.dead).length;
      if (alive === 0) advanceStep(G);
      break;
    }
    case 'race': {
      if (!G.race.active && !m.raceDone) {
        startRace(G);
        m.raceDone = true;
      }
      if (m.raceDone && !G.race.active) {
        if (G.race.lastWon) advanceStep(G);
        else { m.raceDone = false; G.message = 'Race lost — try again!'; G.messageT = 4; }
      }
      break;
    }
    case 'taxi': {
      if (!G.taxi) startTaxiFare(G);
      if ((m.taxiDone || 0) >= (s.count || 1)) advanceStep(G);
      break;
    }
    case 'business': {
      if (G.businesses.owned.includes('motel')) advanceStep(G);
      break;
    }
    case 'survive': {
      if (G.wanted < 4) G.wanted = 4;
      m.surviveT += dt;
      if (m.surviveT >= (s.seconds || 60)) advanceStep(G);
      break;
    }
    default: break;
  }
}

export function updateEnemies(G, dt) {
  for (const e of G.enemies) {
    if (e.dead) continue;
    const p = G.player;
    const d = dist(e.x, e.y, p.x, p.y);
    e.angle = Math.atan2(p.y - e.y, p.x - e.x);
    if (d > 320) {
      e.x += Math.cos(e.angle) * e.speed * dt;
      e.y += Math.sin(e.angle) * e.speed * dt;
    } else if (d < 200) {
      e.shootT -= dt;
      if (e.shootT <= 0) {
        e.shootT = 1.1 + Math.random();
        // Enemy bullet: slow, dodgeable.
        G.bullets.push({ x: e.x, y: e.y, vx: Math.cos(e.angle) * 420, vy: Math.sin(e.angle) * 420, dmg: 6, range: 360, travelled: 0, hostile: true });
        sfx('shoot');
      }
    }
    if (d < 30) {
      // Melee hit on the player.
      e.shootT -= dt;
      if (e.shootT <= 0) {
        e.shootT = 0.8;
        if (p.car) { p.car.hp -= 4; } else { p.health -= 6; }
      }
    }
  }
  G.enemies = G.enemies.filter((e) => !e.dead || e.deathT);
  // Hostile bullets hurt the player (handled in updateBullets via hostile flag).
}

export function drawEnemies(ctx, G, cam) {
  for (const e of G.enemies) {
    if (e.dead) continue;
    const x = e.x - cam.x, y = e.y - cam.y;
    if (x < -30 || y < -30 || x > cam.w + 30 || y > cam.h + 30) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(x, y + 8, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = e.color;
    ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(x - 10, y - 18, 20 * clamp(e.hp / 60, 0, 1), 3);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
    ctx.fillText('!', x, y - 22);
  }
}

export function drawMissionMarker(ctx, G, cam) {
  const t = missionTarget(G);
  if (!t) return;
  const x = t.x - cam.x, y = t.y - cam.y;
  const bob = Math.sin(G.time * 4) * 5;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.moveTo(0, 10); ctx.lineTo(14, -8); ctx.lineTo(0, -20); ctx.lineTo(-14, -8);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
  ctx.fillText(t.label, 0, -30);
  ctx.restore();
  // Edge arrow when the marker is off-screen.
  const sx = clamp(x, 40, cam.w - 40), sy = clamp(y, 40, cam.h - 40);
  if (sx !== x || sy !== y) {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(Math.atan2(y - sy, x - sx));
    ctx.fillStyle = '#ffd166';
    ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -9); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}
