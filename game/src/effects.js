// Particles, skid marks, floating text, muzzle flashes, explosions, screen shake,
// and the day/night lighting tint. Pure canvas, no assets.
import { rand, clamp } from './util.js';

export function createEffects() {
  return { particles: [], skids: [], texts: [], shake: 0 };
}

export function addShake(fx, amount) { fx.shake = Math.min(18, fx.shake + amount); }

export function spawnBurst(fx, x, y, color, n, speed) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = (speed || 120) * (0.4 + Math.random() * 0.8);
    fx.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + Math.random() * 0.5, max: 1, color, size: 2 + Math.random() * 4 });
  }
}

export function spawnSmoke(fx, x, y) {
  fx.particles.push({ x, y, vx: rand(-8, 8), vy: rand(-24, -8), life: 1.2, max: 1.2, color: '#999', size: 6 + Math.random() * 6, smoke: true });
}

export function spawnFlame(fx, x, y, angle) {
  fx.particles.push({ x, y, vx: Math.cos(angle) * 160 + rand(-20, 20), vy: Math.sin(angle) * 160 + rand(-20, 20), life: 0.35, max: 0.35, color: Math.random() < 0.5 ? '#ff9d00' : '#ffdd55', size: 5 + Math.random() * 4 });
}

export function spawnExplosion(fx, x, y) {
  spawnBurst(fx, x, y, '#ff7b00', 26, 260);
  spawnBurst(fx, x, y, '#ffdd55', 18, 180);
  spawnBurst(fx, x, y, '#555', 12, 90);
  addShake(fx, 10);
}

export function addSkid(fx, x, y, angle) {
  fx.skids.push({ x, y, angle, life: 6 });
  if (fx.skids.length > 400) fx.skids.splice(0, fx.skids.length - 400);
}

export function addText(fx, x, y, text, color) {
  fx.texts.push({ x, y, text, color: color || '#fff', life: 1.6 });
}

export function updateEffects(fx, dt) {
  for (const p of fx.particles) {
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 0.96; p.vy *= 0.96;
    p.life -= dt;
  }
  fx.particles = fx.particles.filter((p) => p.life > 0);
  for (const s of fx.skids) s.life -= dt;
  fx.skids = fx.skids.filter((s) => s.life > 0);
  for (const t of fx.texts) { t.y -= 26 * dt; t.life -= dt; }
  fx.texts = fx.texts.filter((t) => t.life > 0);
  fx.shake = Math.max(0, fx.shake - dt * 30);
}

export function drawEffects(ctx, fx, cam) {
  ctx.save();
  ctx.strokeStyle = 'rgba(20,20,20,0.5)';
  ctx.lineWidth = 5;
  for (const s of fx.skids) {
    ctx.save();
    ctx.translate(s.x - cam.x, s.y - cam.y);
    ctx.rotate(s.angle);
    ctx.globalAlpha = clamp(s.life / 6, 0, 0.55);
    ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(7, 0); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
  for (const p of fx.particles) {
    ctx.globalAlpha = clamp(p.life / p.max, 0, p.smoke ? 0.35 : 0.9);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x - cam.x, p.y - cam.y, p.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  ctx.font = 'bold 15px monospace';
  for (const t of fx.texts) {
    ctx.globalAlpha = clamp(t.life, 0, 1);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x - cam.x, t.y - cam.y);
  }
  ctx.globalAlpha = 1;
}

// Day/night overlay: hours 6-18 daylight, 18-6 night with streetlight glow.
export function drawDayNight(ctx, w, h, clock) {
  const night = clock < 6 || clock >= 18;
  if (!night) {
    // Golden hour tint.
    if (clock >= 16.5 && clock < 18) {
      ctx.fillStyle = 'rgba(255,150,60,0.08)';
      ctx.fillRect(0, 0, w, h);
    }
    return;
  }
  const depth = clock >= 20 || clock < 5 ? 0.42 : 0.28;
  ctx.fillStyle = `rgba(8,12,40,${depth})`;
  ctx.fillRect(0, 0, w, h);
}

export function isNight(clock) { return clock < 6 || clock >= 18; }
