// VERDE BAY 3D v7 — particles: muzzle flashes, explosions, smoke, sparks, skid dust.
// A small pooled mesh system on top of THREE; the renderer owns the scene.

export function createEffects(scene) {
  const T = globalThis.THREE;
  const geo = new T.BoxGeometry(1, 1, 1);
  const materials = new Map();
  const pool = [];
  const MAX = 240;

  function material(color) {
    if (!materials.has(color)) {
      materials.set(color, new T.MeshBasicMaterial({ color, transparent: true, opacity: 1 }));
    }
    return materials.get(color);
  }

  function spawn(x, y, z, vx, vy, vz, life, size, color, gravity) {
    let p = pool.find((q) => !q.alive);
    if (!p) {
      if (pool.length >= MAX) return;
      p = { mesh: new T.Mesh(geo, material('#ffffff')), alive: false, vel: new T.Vector3(), life: 0, maxLife: 1, gravity: 0, size: 1 };
      p.mesh.visible = false;
      scene.add(p.mesh);
      pool.push(p);
    }
    p.alive = true;
    p.mesh.visible = true;
    p.mesh.material = material(color);
    p.mesh.position.set(x, y, z);
    p.mesh.scale.setScalar(size);
    p.vel.set(vx, vy, vz);
    p.life = life;
    p.maxLife = life;
    p.gravity = gravity;
    p.size = size;
  }

  function burst(x, y, z, opts) {
    const o = opts || {};
    const n = o.count || 12;
    const speed = o.speed || 14;
    const color = o.color || '#ffcc66';
    const life = o.life || 0.7;
    const size = o.size || 0.9;
    const up = o.up || 6;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * speed;
      spawn(
        x, y, z,
        Math.cos(a) * r, up * Math.random(), Math.sin(a) * r,
        life * (0.6 + Math.random() * 0.7), size * (0.6 + Math.random() * 0.8),
        color, o.gravity === undefined ? -22 : o.gravity,
      );
    }
  }

  const E = {
    burst,
    muzzle(x, y, z, angle) {
      burst(x + Math.cos(angle) * 2, y + 1.2, z + Math.sin(angle) * 2, {
        count: 5, speed: 6, color: '#ffe066', life: 0.14, size: 0.7, up: 1, gravity: 0,
      });
    },
    explosion(x, y, z) {
      burst(x, y + 1, z, { count: 26, speed: 20, color: '#ff7b00', life: 0.9, size: 1.6, up: 12 });
      burst(x, y + 1, z, { count: 16, speed: 10, color: '#ffd166', life: 0.6, size: 1.1, up: 9 });
      burst(x, y + 2, z, { count: 12, speed: 5, color: '#555555', life: 1.6, size: 2.2, up: 8, gravity: 6 });
    },
    smoke(x, y, z) {
      burst(x, y, z, { count: 4, speed: 2, color: '#9a9a9a', life: 1.1, size: 1.4, up: 3, gravity: 5 });
    },
    sparks(x, y, z) {
      burst(x, y, z, { count: 10, speed: 16, color: '#fff3b0', life: 0.4, size: 0.5, up: 5 });
    },
    skid(x, y, z) {
      burst(x, y, z, { count: 3, speed: 3, color: '#c9c9c9', life: 0.5, size: 1.0, up: 1, gravity: 2 });
    },
    update(dt) {
      for (const p of pool) {
        if (!p.alive) continue;
        p.life -= dt;
        if (p.life <= 0) {
          p.alive = false;
          p.mesh.visible = false;
          continue;
        }
        p.vel.y += p.gravity * dt;
        p.mesh.position.x += p.vel.x * dt;
        p.mesh.position.y += p.vel.y * dt;
        p.mesh.position.z += p.vel.z * dt;
        if (p.mesh.position.y < 0.2) p.mesh.position.y = 0.2;
        const k = p.life / p.maxLife;
        p.mesh.scale.setScalar(Math.max(0.05, p.size * k));
        p.mesh.rotation.x += dt * 3;
        p.mesh.rotation.y += dt * 2;
      }
    },
  };
  return E;
}
