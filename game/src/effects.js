// Particle effects for the 3D view: dust behind fast cars, smoke from
// damaged engines, sparks from gunfire. Every particle is a soft radial
// sprite — a canvas-generated glow texture on THREE.Points — never a bare
// PointsMaterial, which renders as hard white squares.

/** Build a 64px radial glow texture (white core fading to transparent). */
function makeGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.7)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

/** Create the effect system bound to a three.js scene. */
export function createEffects(scene) {
  const texture = makeGlowTexture();
  const MAX = 400;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(MAX * 3);
  const colors = new Float32Array(MAX * 3);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: 13,
    map: texture,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);

  const tmpColor = new THREE.Color();

  return {
    /** Sync the points cloud with the sim's particle list (called each frame). */
    update(S) {
      const list = S.particles;
      const n = Math.min(list.length, MAX);
      for (let i = 0; i < n; i++) {
        const pt = list[i];
        const fade = 1 - pt.life / pt.maxLife;
        positions[i * 3] = pt.x;
        positions[i * 3 + 1] = pt.z;
        positions[i * 3 + 2] = -pt.y;
        tmpColor.set(pt.color);
        // Fade the color toward black: with additive blending that fades the glow out.
        colors[i * 3] = tmpColor.r * fade;
        colors[i * 3 + 1] = tmpColor.g * fade;
        colors[i * 3 + 2] = tmpColor.b * fade;
      }
      // Park the rest far below the world.
      for (let i = n; i < MAX; i++) {
        positions[i * 3 + 1] = -1000;
        colors[i * 3] = 0;
        colors[i * 3 + 1] = 0;
        colors[i * 3 + 2] = 0;
      }
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
      geometry.setDrawRange(0, n);
    },
  };
}
