// VERDE BAY v9 — particles and juice: explosions, muzzle flashes, NOS flames,
// dust puffs and camera shake. All particles are plain three.js points that
// recycle, so the game never allocates during a chase.
import { rand } from './util.js';

const THREE = window.THREE;

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.shake = 0;
    this.pool = [];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 600), 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.7, vertexColors: true, transparent: true, opacity: 0.95 }));
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.colors = new Float32Array(3 * 600);
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
  }
  burst(x, y, z, color, count, speed, life, up) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= 600) break;
      const p = this.pool.pop() || {};
      const a = rand(0, Math.PI * 2);
      const v = rand(0.3, 1) * speed;
      p.x = x; p.y = y; p.z = z;
      p.vx = Math.cos(a) * v;
      p.vy = rand(0.2, 1) * (up || speed * 0.6);
      p.vz = Math.sin(a) * v;
      p.life = rand(0.4, 1) * life;
      p.maxLife = p.life;
      p.r = ((color >> 16) & 255) / 255;
      p.g = ((color >> 8) & 255) / 255;
      p.b = (color & 255) / 255;
      this.particles.push(p);
    }
  }
  explosion(x, y, z) {
    this.burst(x, y + 1, z, 0xff7a1a, 46, 14, 1.1, 10);
    this.burst(x, y + 0.6, z, 0x333333, 24, 7, 1.8, 6);
    this.burst(x, y + 1, z, 0xffd23c, 20, 18, 0.5, 8);
    this.shake = Math.min(this.shake + 0.7, 1.2);
  }
  muzzle(x, y, z) { this.burst(x, y, z, 0xffe9a8, 5, 6, 0.18, 2); }
  nosFlame(x, y, z, heading) {
    const bx = x + Math.sin(heading) * 2.4;
    const bz = z + Math.cos(heading) * 2.4;
    this.burst(bx, y + 0.5, bz, 0x3fa8ff, 6, 4, 0.3, 1);
    this.burst(bx, y + 0.5, bz, 0xff9a1a, 3, 3, 0.25, 1);
  }
  dust(x, y, z) { this.burst(x, y + 0.2, z, 0xb8a888, 3, 2.5, 0.6, 1.5); }
  blood(x, y, z) { this.burst(x, y + 1, z, 0xb01a1a, 8, 4, 0.5, 2); }
  addShake(amount) { this.shake = Math.min(this.shake + amount, 1.2); }
  update(dt) {
    this.shake = Math.max(0, this.shake - dt * 1.8);
    const pos = this.points.geometry.attributes.position.array;
    const col = this.points.geometry.attributes.color.array;
    let n = 0;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.pool.push(p); this.particles.splice(i, 1); continue; }
      p.vy -= 9 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.1) { p.y = 0.1; p.vy *= -0.3; }
      pos[n * 3] = p.x; pos[n * 3 + 1] = p.y; pos[n * 3 + 2] = p.z;
      const fade = p.life / p.maxLife;
      col[n * 3] = p.r * fade; col[n * 3 + 1] = p.g * fade; col[n * 3 + 2] = p.b * fade;
      n++;
    }
    // Hide the unused tail of the buffer below the ground.
    for (let i = n; i < 600; i++) { pos[i * 3 + 1] = -50; }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
    this.points.geometry.setDrawRange(0, Math.max(n, 1));
  }
  // Apply the current shake to a camera after its normal update.
  applyShake(camera) {
    if (this.shake <= 0.01) return;
    camera.position.x += rand(-1, 1) * this.shake * 0.35;
    camera.position.y += rand(-1, 1) * this.shake * 0.25;
  }
}
