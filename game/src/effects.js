// Screen-space effects for VERDE BAY 3D v8: muzzle flashes, hits, explosions,
// smoke, and the screen shake the render reads. Particles live in the sim state
// (S.effects); this module spawns them and reads them back for drawing.
export function spawnExplosion(S, x, y) {
  for (let i = 0; i < 18; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 60 + Math.random() * 160;
    S.effects.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 0.5 + Math.random() * 0.4, max: 0.9, kind: 'spark',
    });
  }
  for (let i = 0; i < 8; i++) {
    S.effects.push({
      x: x + (Math.random() - 0.5) * 30, y: y + (Math.random() - 0.5) * 30,
      vx: (Math.random() - 0.5) * 20, vy: -20 - Math.random() * 30,
      life: 1.2 + Math.random() * 0.6, max: 1.8, kind: 'smoke',
    });
  }
  S.shake = Math.min(1, S.shake + 0.7);
}

export function spawnMuzzle(S, x, y, angle) {
  S.effects.push({
    x: x + Math.cos(angle) * 20, y: y + Math.sin(angle) * 20,
    vx: Math.cos(angle) * 120, vy: Math.sin(angle) * 120,
    life: 0.1, max: 0.1, kind: 'flash',
  });
}

export function spawnSkid(S, x, y) {
  S.effects.push({ x, y, vx: 0, vy: 0, life: 0.8, max: 0.8, kind: 'skid' });
}
