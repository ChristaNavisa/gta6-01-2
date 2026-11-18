// Particles for Verde Bay: muzzle flashes, nitro flames, pickup sparkles,
// explosions. Pure data — the sim spawns them, the renderer draws them as
// soft radial sprites (a canvas texture, so a PointsMaterial never shows
// hard white squares).

/** The live particle list, shared by the sim and the renderer. */
export const particles = [];

/** Spawn a burst of `count` glowing particles at (x, y, z). */
export function burst(x, y, z, { color = '#ffd60a', count = 12, speed = 120, life = 0.7, size = 6 } = {}) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.3 + Math.random() * 0.7);
    particles.push({
      x, y, z,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      vz: (Math.random() - 0.2) * speed * 0.6,
      life: life * (0.6 + Math.random() * 0.6),
      age: 0,
      size: size * (0.6 + Math.random() * 0.8),
      color,
    });
  }
  if (particles.length > 600) particles.splice(0, particles.length - 600);
}

/** Step every particle; dead ones are removed. */
export function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.age += dt;
    if (p.age >= p.life) {
      particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    p.vz -= 160 * dt;
    if (p.z < 0) {
      p.z = 0;
      p.vz *= -0.4;
    }
    p.vx *= 1 - 1.6 * dt;
    p.vy *= 1 - 1.6 * dt;
  }
}

/** A soft radial glow texture for THREE.Points (canvas, no asset file). */
export function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.7)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return c;
}
