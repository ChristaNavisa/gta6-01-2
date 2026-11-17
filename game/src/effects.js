// Particles, skid marks and floating text — the juice that sells a chase.
import { range, pick } from './random.js';

export function spawnBurst(S, x, y, color, n, speed) {
  for (let i = 0; i < n; i++) {
    const a = S.rng() * Math.PI * 2;
    const s = range(S.rng, speed * 0.3, speed);
    S.particles.push({
      x, y,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: range(S.rng, 0.3, 0.8), maxLife: 0.8,
      size: range(S.rng, 2, 5), color,
    });
  }
}

export function spawnSmoke(S, x, y) {
  S.particles.push({
    x, y, vx: range(S.rng, -12, 12), vy: range(S.rng, -30, -8),
    life: range(S.rng, 0.6, 1.2), maxLife: 1.2,
    size: range(S.rng, 6, 12), color: '#8d99ae', smoke: true,
  });
}

export function spawnExplosion(S, x, y) {
  spawnBurst(S, x, y, '#ff9f1c', 26, 320);
  spawnBurst(S, x, y, '#e71d36', 18, 220);
  spawnBurst(S, x, y, '#ffd166', 12, 140);
  for (let i = 0; i < 6; i++) spawnSmoke(S, x + range(S.rng, -14, 14), y + range(S.rng, -14, 14));
}

export function addSkid(S, x, y, angle) {
  S.skids.push({ x, y, angle, life: 6 });
  if (S.skids.length > 220) S.skids.shift();
}

export function addFloater(S, x, y, text, color) {
  S.floaters.push({ x, y, text, color: color || '#ffffff', life: 1.4 });
}

export function updateEffects(S, dt) {
  for (let i = S.particles.length - 1; i >= 0; i--) {
    const p = S.particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= (1 - 2.2 * dt);
    p.vy *= (1 - 2.2 * dt);
    if (p.life <= 0) S.particles.splice(i, 1);
  }
  for (let i = S.skids.length - 1; i >= 0; i--) {
    S.skids[i].life -= dt;
    if (S.skids[i].life <= 0) S.skids.splice(i, 1);
  }
  for (let i = S.floaters.length - 1; i >= 0; i--) {
    const f = S.floaters[i];
    f.life -= dt;
    f.y -= 34 * dt;
    if (f.life <= 0) S.floaters.splice(i, 1);
  }
}
