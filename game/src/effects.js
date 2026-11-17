// VERDE BAY — short-lived visual effects: particles, bullet tracers and
// floating text. Pure data, no DOM: the sim spawns them, the renderer
// draws them, and update() ages them out.

export function createEffects() {
  return { particles: [], tracers: [], floaters: [] };
}

/** A burst of sparks / smoke at (x, y, z). */
export function burst(fx, x, y, z, color, n, power) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = (0.3 + Math.random() * 0.7) * power;
    fx.particles.push({
      x, y, z,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: Math.random() * power * 0.7,
      life: 0.5 + Math.random() * 0.5, maxLife: 1,
      color, size: 2 + Math.random() * 3,
    });
  }
  if (fx.particles.length > 400) fx.particles.splice(0, fx.particles.length - 400);
}

/** A bright line from a gun to its hit, fading fast. */
export function tracer(fx, x1, y1, z1, x2, y2, z2, color) {
  fx.tracers.push({ x1, y1, z1, x2, y2, z2, life: 0.12, color: color || '#ffd76a' });
  if (fx.tracers.length > 24) fx.tracers.shift();
}

/** Text that rises and fades above a spot (cash, pickups). */
export function floater(fx, x, y, text, color) {
  fx.floaters.push({ x, y, text, color: color || '#ffd76a', life: 1.4 });
  if (fx.floaters.length > 12) fx.floaters.shift();
}

export function updateEffects(fx, dt) {
  for (const p of fx.particles) {
    p.life -= dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    p.vz -= 60 * dt; // sparks fall back down
    p.vx *= 0.98; p.vy *= 0.98;
    if (p.z < 0.5) { p.z = 0.5; p.vz = 0; }
  }
  fx.particles = fx.particles.filter((p) => p.life > 0);
  for (const t of fx.tracers) t.life -= dt;
  fx.tracers = fx.tracers.filter((t) => t.life > 0);
  for (const f of fx.floaters) { f.life -= dt; f.y -= 14 * dt; }
  fx.floaters = fx.floaters.filter((f) => f.life > 0);
}
