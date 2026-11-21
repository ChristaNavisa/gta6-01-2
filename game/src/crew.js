// Crew: Mara (driver) and Dario (muscle), plus the district respect system.
// Respect rises with missions, taxi fares and business in a district; it unlocks
// discounts, crew backup and cheaper ammo.
import { DISTRICTS } from './config.js';
import { clamp, dist } from './util.js';
import { districtAt } from './city.js';
import { gainRespect } from './sim.js';
import { addText, spawnBurst } from './effects.js';
import { sfx } from './audio.js';

export const CREW = [
  { id: 'mara', name: 'Mara', role: 'Driver', perk: 'Getaway driving: police lose you faster', mission: 'm4' },
  { id: 'dario', name: 'Dario', role: 'Muscle', perk: 'Fights beside you in kill missions', mission: 'm7' },
];

export function crewInfo(G) {
  return CREW.map((c) => ({
    ...c,
    recruited: !!G.crew[c.id],
  }));
}

// Dario backup: in kill missions he spawns beside the player and shoots enemies.
export function spawnCrewBackup(G) {
  if (!G.crew.dario || !G.mission) return;
  if (G.crewBackup) return;
  const b = {
    kind: 'ally', x: G.player.x + 50, y: G.player.y + 30,
    angle: 0, speed: 150, hp: 200, color: '#2ecc71', shootT: 1, dead: false,
  };
  G.crewBackup = b;
  addText(G.fx, b.x, b.y - 24, 'DARIO HAS YOUR BACK', '#7dff8a');
}

export function updateCrewBackup(G, dt) {
  const b = G.crewBackup;
  if (!b || b.dead) { G.crewBackup = null; return; }
  const target = G.enemies.find((e) => !e.dead);
  if (!target) {
    // Follow the player.
    const d = dist(b.x, b.y, G.player.x, G.player.y);
    if (d > 60) {
      const a = Math.atan2(G.player.y - b.y, G.player.x - b.x);
      b.x += Math.cos(a) * b.speed * dt;
      b.y += Math.sin(a) * b.speed * dt;
    }
    return;
  }
  const d = dist(b.x, b.y, target.x, target.y);
  b.angle = Math.atan2(target.y - b.y, target.x - b.x);
  if (d > 260) {
    b.x += Math.cos(b.angle) * b.speed * dt;
    b.y += Math.sin(b.angle) * b.speed * dt;
  } else {
    b.shootT -= dt;
    if (b.shootT <= 0) {
      b.shootT = 0.5;
      G.bullets.push({ x: b.x, y: b.y, vx: Math.cos(b.angle) * 900, vy: Math.sin(b.angle) * 900, dmg: 18, range: 420, travelled: 0 });
      sfx('shoot');
    }
  }
  if (!G.mission) { G.crewBackup = null; }
}

export function drawCrewBackup(ctx, G, cam) {
  const b = G.crewBackup;
  if (!b) return;
  const x = b.x - cam.x, y = b.y - cam.y;
  ctx.fillStyle = b.color;
  ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
  ctx.fillText('DARIO', x, y - 16);
}

// Mara perk: heat decays 40% faster while recruited.
export function heatDecayFactor(G) {
  return G.crew.mara ? 1.4 : 1;
}

export function respectHtml(G) {
  return DISTRICTS.map((d) => {
    const r = G.crew.respect[d.id] || 0;
    const bar = Math.round(r);
    return `<div class="respect-row"><span>${d.name}</span><div class="bar"><div style="width:${bar}%"></div></div><b>${bar}</b></div>`;
  }).join('');
}
