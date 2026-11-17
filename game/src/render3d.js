// VERDE BAY — the 3D renderer. three.js r160 (vendored, window.THREE):
// a dusk-lit low-poly city, chase camera with occlusion pull-in, 3D cars
// and pedestrians, mission marker, particles and tracers. It only reads
// the sim state; it never changes it.

import { MISSIONS } from './missions.js';

const THREE = globalThis.THREE;

/** Ray vs axis-aligned box, slab test. Returns the hit t in [0,1] or -1. */
function rayBox(px, py, pz, dx, dy, dz, bx, by, bz, hw, hh, hd) {
  let tmin = 0; let tmax = 1;
  const mins = [bx - hw, by, bz - hd];
  const maxs = [bx + hw, by + hh, bz + hd];
  const o = [px, py, pz];
  const d = [dx, dy, dz];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) {
      if (o[i] < mins[i] || o[i] > maxs[i]) return -1;
    } else {
      let t1 = (mins[i] - o[i]) / d[i];
      let t2 = (maxs[i] - o[i]) / d[i];
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return -1;
    }
  }
  return tmin;
}

function makeGroundTexture(city) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 800;
  const g = c.getContext('2d');
  g.scale(1024 / 2600, 800 / 2000);
  // Base ground.
  g.fillStyle = '#2e3d33';
  g.fillRect(0, 0, 2600, 2000);
  // Beach sand + water at the south edge.
  g.fillStyle = '#d9c08a';
  g.fillRect(0, 1500, 2600, 500);
  g.fillStyle = '#274b73';
  g.fillRect(0, 1940, 2600, 60);
  g.fillStyle = '#3a6a9a';
  for (let x = 0; x < 2600; x += 90) g.fillRect(x, 1952, 50, 6);
  // Roads.
  g.fillStyle = '#26262b';
  for (const x of city.roads.vertical) g.fillRect(x - 32, 0, 64, 2000);
  for (const y of city.roads.horizontal) g.fillRect(0, y - 32, 2600, 64);
  // Sidewalk edges around each block.
  g.strokeStyle = '#4a4a52';
  g.lineWidth = 6;
  const vx = city.roads.vertical; const hy = city.roads.horizontal;
  for (let i = 0; i < vx.length - 1; i++) {
    for (let j = 0; j < hy.length - 1; j++) {
      g.strokeRect(vx[i] + 32, hy[j] + 32, vx[i + 1] - vx[i] - 64, hy[j + 1] - hy[j] - 64);
    }
  }
  // Center dashes.
  g.fillStyle = '#c9a227';
  for (const x of vx) {
    for (let y = 0; y < 2000; y += 80) g.fillRect(x - 3, y, 6, 38);
  }
  for (const y of hy) {
    for (let x = 0; x < 2600; x += 80) g.fillRect(x, y - 3, 38, 6);
  }
  // Crosswalks at every crossing.
  g.fillStyle = '#d8d8d8';
  for (const x of vx) {
    for (const y of hy) {
      for (let k = -3; k <= 3; k++) g.fillRect(x - 24 + k * 8, y - 30, 4, 16);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeWindowTexture(base, lit) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 64, 128);
  for (let y = 8; y < 120; y += 16) {
    for (let x = 6; x < 58; x += 14) {
      const on = ((x * 7 + y * 13) % 10) < 4;
      g.fillStyle = on ? lit : '#232833';
      g.fillRect(x, y, 9, 11);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function radialSprite() {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 32;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(16, 16, 1, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.7)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

export function createRenderer(canvas, S) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x241d3a);
  scene.fog = new THREE.Fog(0x241d3a, 500, 1600);

  const hemi = new THREE.HemisphereLight(0x8a7fd0, 0x3a2f28, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd9a0, 1.35);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -260; sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260; sun.shadow.camera.bottom = -260;
  sun.shadow.camera.far = 1200;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);

  const camera = new THREE.PerspectiveCamera(58, 1280 / 800, 1, 4000);
  const camPos = new THREE.Vector3(0, 400, 900);
  let snapped = false; // first chase frame: jump straight behind the player

  // --- static city ---------------------------------------------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(2600, 2000),
    new THREE.MeshStandardMaterial({ map: makeGroundTexture(S.city), roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(1300, 0, 1000);
  ground.receiveShadow = true;
  scene.add(ground);

  const texDowntown = makeWindowTexture('#6a6258', '#ffd76a');
  const texBrick = makeWindowTexture('#8a5a44', '#ffca7a');
  const texFlat = makeWindowTexture('#5d5348', '#ffe9a8');
  const wallMats = {
    downtown: new THREE.MeshStandardMaterial({ map: texDowntown, roughness: 0.9 }),
    oldtown: new THREE.MeshStandardMaterial({ map: texBrick, roughness: 0.95 }),
    residential: new THREE.MeshStandardMaterial({ map: texBrick, roughness: 0.95 }),
    industrial: new THREE.MeshStandardMaterial({ map: texFlat, roughness: 0.95 }),
    beach: new THREE.MeshStandardMaterial({ map: texBrick, roughness: 0.95 }),
  };
  const roofMatCache = new Map();
  function roofMat(color) {
    let m = roofMatCache.get(color);
    if (!m) { m = new THREE.MeshStandardMaterial({ color, roughness: 0.95 }); roofMatCache.set(color, m); }
    return m;
  }

  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const stackGeo = new THREE.CylinderGeometry(4, 6, 26, 8);
  const stackMat = new THREE.MeshStandardMaterial({ color: '#6a5a50', roughness: 1 });
  for (const b of S.city.buildings) {
    const mesh = new THREE.Mesh(unitBox, wallMats[b.district] || wallMats.downtown);
    mesh.scale.set(b.w, b.height, b.d);
    mesh.position.set(b.x, b.height / 2, b.y);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    const roof = new THREE.Mesh(unitBox, roofMat(b.roof));
    roof.scale.set(b.w + 4, 3, b.d + 4);
    roof.position.set(b.x, b.height + 1.5, b.y);
    roof.castShadow = true;
    scene.add(roof);
    if (b.stack) {
      const st = new THREE.Mesh(stackGeo, stackMat);
      st.position.set(b.x + b.w / 4, b.height + 13, b.y - b.d / 4);
      st.castShadow = true;
      scene.add(st);
    }
  }

  // Palms, trees, lamps as instanced meshes (static, repeated).
  function instanced(geo, mat, items, place) {
    const m = new THREE.InstancedMesh(geo, mat, items.length);
    const d = new THREE.Object3D();
    items.forEach((it, i) => { place(d, it); d.updateMatrix(); m.setMatrixAt(i, d.matrix); });
    m.castShadow = true;
    scene.add(m);
    return m;
  }
  const trunkGeo = new THREE.CylinderGeometry(2.2, 3.4, 26, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#7a5a3a', roughness: 1 });
  const palmTopGeo = new THREE.IcosahedronGeometry(9, 0);
  const palmTopMat = new THREE.MeshStandardMaterial({ color: '#3f7d3a', roughness: 1 });
  instanced(trunkGeo, trunkMat, S.city.palms, (d, p) => {
    d.position.set(p.x, 13 * p.s, p.y);
    d.scale.setScalar(p.s);
    d.rotation.z = p.lean;
  });
  instanced(palmTopGeo, palmTopMat, S.city.palms, (d, p) => {
    d.position.set(p.x + p.lean * 20, 30 * p.s, p.y);
    d.scale.set(p.s * 1.4, p.s * 0.7, p.s * 1.4);
  });
  const treeTrunkGeo = new THREE.CylinderGeometry(2, 3, 12, 6);
  const treeTopGeo = new THREE.IcosahedronGeometry(10, 0);
  const treeTopMat = new THREE.MeshStandardMaterial({ color: '#4a7d44', roughness: 1 });
  instanced(treeTrunkGeo, trunkMat, S.city.trees, (d, t) => {
    d.position.set(t.x, 6 * t.s, t.y);
    d.scale.setScalar(t.s);
  });
  instanced(treeTopGeo, treeTopMat, S.city.trees, (d, t) => {
    d.position.set(t.x, 18 * t.s, t.y);
    d.scale.setScalar(t.s);
  });
  const lampPoleGeo = new THREE.CylinderGeometry(1.2, 1.2, 22, 6);
  const lampPoleMat = new THREE.MeshStandardMaterial({ color: '#2c2f38', roughness: 0.9 });
  const lampBulbGeo = new THREE.SphereGeometry(2, 8, 6);
  const lampBulbMat = new THREE.MeshStandardMaterial({ color: '#ffd76a', emissive: '#ffca5e', emissiveIntensity: 1.6 });
  instanced(lampPoleGeo, lampPoleMat, S.city.lamps, (d, l) => { d.position.set(l.x, 11, l.y); });
  instanced(lampBulbGeo, lampBulbMat, S.city.lamps, (d, l) => { d.position.set(l.x, 23, l.y); });

  // --- dynamic objects -------------------------------------------------------
  const carMeshes = new Map();
  const pedMeshes = new Map();
  const bodyMatCache = new Map();
  function bodyMat(color) {
    let m = bodyMatCache.get(color);
    if (!m) { m = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.45 }); bodyMatCache.set(color, m); }
    return m;
  }
  const glassMat = new THREE.MeshStandardMaterial({ color: '#141a22', roughness: 0.15, metalness: 0.6 });
  const wheelGeo = new THREE.CylinderGeometry(5.5, 5.5, 4, 10);
  const wheelMat = new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.9 });
  const hubGeo = new THREE.BoxGeometry(1.5, 11, 4.4);
  const hubMat = new THREE.MeshStandardMaterial({ color: '#888888', roughness: 0.4, metalness: 0.7 });

  function buildCarMesh(car) {
    const g = new THREE.Group();
    const L = car.length; const W = car.width;
    const body = new THREE.Mesh(unitBox, bodyMat(car.color));
    body.scale.set(L, 10, W);
    body.position.y = 7;
    body.castShadow = true;
    g.add(body);
    const cabin = new THREE.Mesh(unitBox, glassMat);
    cabin.scale.set(L * 0.45, 8, W * 0.78);
    cabin.position.set(-L * 0.05, 15, 0);
    cabin.castShadow = true;
    g.add(cabin);
    const wheels = [];
    for (const [wx, wz] of [[L * 0.32, W / 2], [L * 0.32, -W / 2], [-L * 0.32, W / 2], [-L * 0.32, -W / 2]]) {
      const wg = new THREE.Group();
      wg.position.set(wx, 5.5, wz);
      const tire = new THREE.Mesh(wheelGeo, wheelMat);
      tire.rotation.x = Math.PI / 2;
      wg.add(tire);
      const hub = new THREE.Mesh(hubGeo, hubMat);
      wg.add(hub);
      g.add(wg);
      wheels.push(wg);
    }
    const brakeMat = new THREE.MeshStandardMaterial({ color: '#7a1010', emissive: '#ff2020', emissiveIntensity: 0.25 });
    for (const wz of [W / 2 - 4, -W / 2 + 4]) {
      const bl = new THREE.Mesh(unitBox, brakeMat);
      bl.scale.set(2, 3, 5);
      bl.position.set(-L / 2 - 0.5, 8, wz);
      g.add(bl);
    }
    let barA = null; let barB = null;
    if (car.type === 'police') {
      barA = new THREE.Mesh(unitBox, new THREE.MeshStandardMaterial({ color: '#300', emissive: '#ff2020', emissiveIntensity: 2 }));
      barA.scale.set(8, 3, 6); barA.position.set(0, 20.5, -W / 4);
      barB = new THREE.Mesh(unitBox, new THREE.MeshStandardMaterial({ color: '#003', emissive: '#2040ff', emissiveIntensity: 2 }));
      barB.scale.set(8, 3, 6); barB.position.set(0, 20.5, W / 4);
      g.add(barA); g.add(barB);
    }
    if (car.type === 'taxi') {
      const sign = new THREE.Mesh(unitBox, new THREE.MeshStandardMaterial({ color: '#3a2f00', emissive: '#ffd21a', emissiveIntensity: 1.4 }));
      sign.scale.set(12, 4, 8); sign.position.set(0, 20.5, 0);
      g.add(sign);
    }
    scene.add(g);
    const rec = { group: g, wheels, brakeMat, barA, barB };
    carMeshes.set(car, rec);
    return rec;
  }

  function buildPedMesh(ped) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(unitBox, new THREE.MeshStandardMaterial({ color: ped.color, roughness: 0.9 }));
    body.scale.set(11, 17, 7);
    body.position.y = 11;
    body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(4.6, 10, 8), new THREE.MeshStandardMaterial({ color: '#d9a077', roughness: 0.8 }));
    head.position.y = 23;
    head.castShadow = true;
    g.add(head);
    if (ped.kind === 'cop') {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 2.4, 10), new THREE.MeshStandardMaterial({ color: '#14264a', roughness: 0.8 }));
      cap.position.y = 27;
      g.add(cap);
    }
    if (ped.kind === 'gang') {
      const gun = new THREE.Mesh(unitBox, new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.6 }));
      gun.scale.set(10, 2, 2);
      gun.position.set(8, 14, 0);
      g.add(gun);
    }
    scene.add(g);
    pedMeshes.set(ped, g);
    return g;
  }

  // Mission marker: beam + spinning ring + bobbing orb.
  const marker = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(16, 16, 130, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd21a, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 65;
  marker.add(beam);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(26, 2.2, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd21a }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 2;
  marker.add(ring);
  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(6, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xffe066 }),
  );
  orb.position.y = 34;
  marker.add(orb);
  scene.add(marker);

  // Particles (Points) + tracers (LineSegments), preallocated.
  const MAXP = 400;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(MAXP * 3);
  const pCol = new Float32Array(MAXP * 3);
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const points = new THREE.Points(pGeo, new THREE.PointsMaterial({
    size: 7, map: radialSprite(), vertexColors: true, transparent: true,
    depthWrite: false, sizeAttenuation: true,
  }));
  points.frustumCulled = false;
  scene.add(points);
  const MAXT = 24;
  const tGeo = new THREE.BufferGeometry();
  const tPos = new Float32Array(MAXT * 6);
  const tCol = new Float32Array(MAXT * 6);
  tGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3));
  tGeo.setAttribute('color', new THREE.BufferAttribute(tCol, 3));
  const lines = new THREE.LineSegments(tGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 }));
  lines.frustumCulled = false;
  scene.add(lines);

  const flash = new THREE.PointLight(0xffd76a, 0, 260);
  scene.add(flash);
  let flashI = 0;

  const tmpColor = new THREE.Color();
  const camTarget = new THREE.Vector3();
  const desired = new THREE.Vector3();
  const forward = new THREE.Vector3();

  function syncCars(S) {
    const seen = new Set();
    for (const car of S.cars) {
      seen.add(car);
      let rec = carMeshes.get(car);
      if (!rec) rec = buildCarMesh(car);
      rec.group.position.set(car.x, 0, car.y);
      rec.group.rotation.y = -car.angle;
      for (const w of rec.wheels) w.rotation.z = car.wheelSpin || 0;
      rec.brakeMat.emissiveIntensity = car.brakeLight ? 2.4 : 0.25;
      if (rec.barA && rec.barB) {
        const on = Math.sin(S.time * 11) > 0;
        rec.barA.material.emissiveIntensity = on ? 2.4 : 0.15;
        rec.barB.material.emissiveIntensity = on ? 0.15 : 2.4;
      }
    }
    for (const [car, rec] of [...carMeshes]) {
      if (!seen.has(car)) { scene.remove(rec.group); carMeshes.delete(car); }
    }
  }

  function syncPeds(S) {
    const seen = new Set();
    const list = [...S.peds];
    const gang = (S.mission.data && S.mission.data.gang) || [];
    for (const g of gang) if (g.hp > 0) list.push(g);
    if (!S.player.onFoot) {
      // The player on foot gets a mesh too; in a car the car mesh shows.
    } else {
      list.push({ x: S.player.x, y: S.player.y, angle: S.player.angle, color: '#c97b2e', kind: 'player', hp: 1 });
    }
    for (const ped of list) {
      seen.add(ped);
      let g = pedMeshes.get(ped);
      if (!g) g = buildPedMesh(ped);
      g.position.set(ped.x, 0, ped.y);
      g.rotation.y = -ped.angle;
    }
    for (const [ped, g] of [...pedMeshes]) {
      if (!seen.has(ped)) { scene.remove(g); pedMeshes.delete(ped); }
    }
  }

  function objectivePos(S) {
    if (S.mission.active) {
      const def = MISSIONS[S.mission.index];
      const stage = def && def.stages[S.mission.stage];
      if (stage) {
        if (stage.type === 'steal' && S.mission.data.targetCar) {
          const c = S.mission.data.targetCar;
          return { x: c.x, y: c.y };
        }
        if (stage.target) return S.city.places[stage.target];
      }
    }
    if (S.taxi.state === 'waiting' && S.taxi.customer) return S.taxi.customer;
    if (S.taxi.state === 'riding' && S.taxi.dest) return S.taxi.dest;
    return null;
  }

  function render(S, dt, view) {
    syncCars(S);
    syncPeds(S);

    // Particles + tracers from the sim's effects.
    const parts = S.effects.particles;
    for (let i = 0; i < MAXP; i++) {
      const p = parts[i];
      if (p) {
        pPos[i * 3] = p.x; pPos[i * 3 + 1] = p.z; pPos[i * 3 + 2] = p.y;
        tmpColor.set(p.color);
        pCol[i * 3] = tmpColor.r; pCol[i * 3 + 1] = tmpColor.g; pCol[i * 3 + 2] = tmpColor.b;
      } else {
        pPos[i * 3 + 1] = -100;
      }
    }
    pGeo.attributes.position.needsUpdate = true;
    pGeo.attributes.color.needsUpdate = true;
    pGeo.setDrawRange(0, Math.min(parts.length, MAXP));
    const trs = S.effects.tracers;
    for (let i = 0; i < MAXT; i++) {
      const t = trs[i];
      if (t) {
        tPos[i * 6] = t.x1; tPos[i * 6 + 1] = t.z1; tPos[i * 6 + 2] = t.y1;
        tPos[i * 6 + 3] = t.x2; tPos[i * 6 + 4] = t.z2; tPos[i * 6 + 5] = t.y2;
        tmpColor.set(t.color);
        const a = Math.max(0.15, t.life / 0.12);
        tCol[i * 6] = tmpColor.r * a; tCol[i * 6 + 1] = tmpColor.g * a; tCol[i * 6 + 2] = tmpColor.b * a;
        tCol[i * 6 + 3] = tmpColor.r * a; tCol[i * 6 + 4] = tmpColor.g * a; tCol[i * 6 + 5] = tmpColor.b * a;
      } else {
        tPos[i * 6 + 1] = -100; tPos[i * 6 + 4] = -100;
      }
    }
    tGeo.attributes.position.needsUpdate = true;
    tGeo.attributes.color.needsUpdate = true;
    tGeo.setDrawRange(0, Math.min(trs.length, MAXT) * 2);
    if (trs.length > 0) {
      const t = trs[trs.length - 1];
      flash.position.set(t.x2, t.z2 + 6, t.y2);
      flashI = 26;
    }
    flashI = Math.max(0, flashI - dt * 160);
    flash.intensity = flashI;

    // Mission marker.
    const obj = objectivePos(S);
    marker.visible = !!obj;
    if (obj) {
      marker.position.set(obj.x, 0, obj.y);
      ring.rotation.z = S.time * 1.6;
      orb.position.y = 34 + Math.sin(S.time * 2.4) * 5;
    }

    // Camera.
    const p = S.player;
    if (view.mode === 'orbit') {
      const a = S.time * 0.03 + view.angle0;
      camera.position.set(1300 + Math.cos(a) * 950, 520, 1000 + Math.sin(a) * 950);
      camera.lookAt(1300, 0, 1000);
    } else {
      const inCar = !!p.car;
      const distC = inCar ? 95 : 85;
      const heightC = inCar ? 42 : 46;
      const fx = Math.cos(p.angle); const fy = Math.sin(p.angle);
      desired.set(p.x - fx * distC, heightC, p.y - fy * distC);
      // Occlusion pull-in: ray from the player's head to the camera.
      const ox = p.x; const oy = 14; const oz = p.y;
      const dx = desired.x - ox; const dy = desired.y - oy; const dz = desired.z - oz;
      let best = 1;
      for (const b of S.city.buildings) {
        const t = rayBox(ox, oy, oz, dx, dy, dz, b.x, 0, b.y, b.w / 2, b.height, b.d / 2);
        if (t >= 0 && t < best) best = t;
      }
      if (best < 1) {
        const pull = Math.max(0.25, best * 0.92);
        desired.set(ox + dx * pull, oy + dy * pull, oz + dz * pull);
      }
      if (!snapped) { camPos.copy(desired); snapped = true; }
      else camPos.lerp(desired, 0.14);
      const ahead = inCar ? 26 : 70;
      camTarget.set(p.x + fx * ahead, inCar ? 13 : 10, p.y + fy * ahead);
      camera.position.copy(camPos);
      camera.lookAt(camTarget);
    }

    // Sun follows the player so shadows stay local.
    sun.position.set(p.x + 320, 420, p.y - 240);
    sun.target.position.set(p.x, 0, p.y);

    renderer.render(scene, camera);
  }

  /** World aim angle for a mouse position (screen pixels). */
  function screenAimAngle(mx, my) {
    camera.getWorldDirection(forward);
    const camAngle = Math.atan2(forward.z, forward.x);
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const dx = mx - cx;
    const dy = my - cy;
    return camAngle + Math.atan2(dx, -dy);
  }

  function resize() {
    const w = canvas.clientWidth || 1280;
    const h = canvas.clientHeight || 800;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();

  return { render, screenAimAngle, resize, camera, scene, renderer };
}
