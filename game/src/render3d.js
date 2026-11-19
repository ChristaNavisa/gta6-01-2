// VERDE BAY 3D v8 — Three.js renderer: the island city, cars, peds, cops, the
// police helicopter (big, with a searchlight cone and a ground shadow marker),
// roadblocks, military jeeps, mission beacon, day/night lighting, chase camera.
import { DISTRICTS } from './config.js';
import { districtAt } from './city.js';

let renderer = null;
let scene = null;
let camera = null;
let sun = null;
let ambient = null;
let hemi = null;
let carGroups = new Map();
let pedGroups = new Map();
let heliGroup = null;
let heliRotor = null;
let heliLight = null;
let heliShadow = null;
let beacon = null;
let pkgGroups = new Map();
let canvasEl = null;
let framesRendered = 0;

const tmpColor = { r: 0, g: 0, b: 0 };

function hexColor(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

function mat(colorHex, emissiveHex, emissiveIntensity) {
  const m = new THREE.MeshLambertMaterial({ color: new THREE.Color(colorHex) });
  if (emissiveHex) {
    m.emissive = new THREE.Color(emissiveHex);
    m.emissiveIntensity = emissiveIntensity || 0.6;
  }
  return m;
}

function box(w, h, d, colorHex, emissiveHex, emissiveIntensity) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(colorHex, emissiveHex, emissiveIntensity));
  return mesh;
}

export function initRender(S, canvas) {
  canvasEl = canvas;
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(canvas.clientWidth || 1280, canvas.clientHeight || 800);
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#87ceeb');
  scene.fog = new THREE.Fog(new THREE.Color('#87ceeb'), 500, 2400);
  camera = new THREE.PerspectiveCamera(62, 1280 / 800, 0.5, 5000);

  sun = new THREE.DirectionalLight(0xfff2d0, 1.2);
  sun.position.set(600, 900, 400);
  scene.add(sun);
  ambient = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(ambient);
  hemi = new THREE.HemisphereLight(0xbfd9ff, 0x3a5a3a, 0.5);
  scene.add(hemi);

  buildCity(S);
  buildHeli();
  buildBeacon();
}

function buildCity(S) {
  const city = S.city;
  // Ground.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(3400, 2100),
    new THREE.MeshLambertMaterial({ color: new THREE.Color('#6f7f5a') }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(1700, 0, 1050);
  scene.add(ground);
  // District ground quads.
  for (const [id, d] of Object.entries(DISTRICTS)) {
    const quad = new THREE.Mesh(
      new THREE.PlaneGeometry(d.x1 - d.x0, d.y1 - d.y0),
      new THREE.MeshLambertMaterial({ color: new THREE.Color(d.ground) }),
    );
    quad.rotation.x = -Math.PI / 2;
    quad.position.set((d.x0 + d.x1) / 2, 0.1, (d.y0 + d.y1) / 2);
    scene.add(quad);
  }
  // Roads.
  const roadMat = new THREE.MeshLambertMaterial({ color: new THREE.Color('#2e2e33') });
  for (const r of city.roads) {
    const len = Math.hypot(r.x1 - r.x0, r.y1 - r.y0);
    const seg = new THREE.Mesh(new THREE.PlaneGeometry(len, 92), roadMat);
    seg.rotation.x = -Math.PI / 2;
    seg.rotation.z = -Math.atan2(r.y1 - r.y0, r.x1 - r.x0);
    seg.position.set((r.x0 + r.x1) / 2, 0.2, (r.y0 + r.y1) / 2);
    scene.add(seg);
  }
  // Buildings.
  for (const b of city.buildings) {
    const m = box(b.w, b.height, b.d, b.color, b.neon ? b.roof : null, b.neon ? 0.9 : 0);
    m.position.set(b.x, b.height / 2, b.y);
    scene.add(m);
    const roof = box(b.w + 2, 2, b.d + 2, b.roof);
    roof.position.set(b.x, b.height + 1, b.y);
    scene.add(roof);
    if (b.stack) {
      const stack = new THREE.Mesh(
        new THREE.CylinderGeometry(4, 5, 40, 8),
        new THREE.MeshLambertMaterial({ color: new THREE.Color('#555555') }),
      );
      stack.position.set(b.x + b.w / 3, b.height + 20, b.y);
      scene.add(stack);
    }
  }
  // Palms.
  for (const p of city.palms) {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(2, 3, p.h, 6),
      new THREE.MeshLambertMaterial({ color: new THREE.Color('#8a6a4a') }),
    );
    trunk.position.set(p.x, p.h / 2, p.y);
    scene.add(trunk);
    const top = new THREE.Mesh(
      new THREE.ConeGeometry(12, 14, 6),
      new THREE.MeshLambertMaterial({ color: new THREE.Color('#2e7d32') }),
    );
    top.position.set(p.x, p.h + 6, p.y);
    scene.add(top);
  }
  // Hidden packages: small glowing cyan boxes.
  for (const pkg of S.packages) {
    const g = box(10, 10, 10, '#22d3ee', '#22d3ee', 1.2);
    g.position.set(pkg.x, 8, pkg.y);
    scene.add(g);
    pkgGroups.set(pkg, g);
  }
}

function buildHeli() {
  heliGroup = new THREE.Group();
  // Big body so the helicopter reads clearly at distance.
  const body = box(16, 7, 8, '#1a1a2e');
  body.position.y = 0;
  heliGroup.add(body);
  const nose = box(6, 5, 7, '#24365e');
  nose.position.set(10, -0.5, 0);
  heliGroup.add(nose);
  const tail = box(16, 3, 3, '#1a1a2e');
  tail.position.set(-14, 1, 0);
  heliGroup.add(tail);
  const fin = box(2, 8, 1, '#d7263d');
  fin.position.set(-21, 4, 0);
  heliGroup.add(fin);
  // Main rotor: a long thin disc, much wider than the body.
  heliRotor = box(34, 0.6, 3, '#222222');
  heliRotor.position.y = 6;
  heliGroup.add(heliRotor);
  const rotor2 = box(3, 0.6, 34, '#222222');
  rotor2.position.y = 6;
  heliGroup.add(rotor2);
  const mast = box(2, 4, 2, '#333333');
  mast.position.y = 4;
  heliGroup.add(mast);
  // Searchlight cone pointing down (visible at night, and in the chase shot).
  const coneGeo = new THREE.ConeGeometry(16, 34, 16, 1, true);
  const coneMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#fff7ae'), transparent: true, opacity: 0.35,
    side: THREE.DoubleSide, depthWrite: false,
  });
  heliLight = new THREE.Mesh(coneGeo, coneMat);
  heliLight.rotation.x = Math.PI;
  heliLight.position.y = -19;
  heliGroup.add(heliLight);
  // Skids.
  const skidL = box(14, 1, 1, '#444444');
  skidL.position.set(0, -5, 4);
  heliGroup.add(skidL);
  const skidR = box(14, 1, 1, '#444444');
  skidR.position.set(0, -5, -4);
  heliGroup.add(skidR);
  heliGroup.visible = false;
  scene.add(heliGroup);
  // Ground shadow marker under the helicopter.
  heliShadow = new THREE.Mesh(
    new THREE.CircleGeometry(18, 20),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#000000'), transparent: true, opacity: 0.35, depthWrite: false }),
  );
  heliShadow.rotation.x = -Math.PI / 2;
  heliShadow.position.y = 0.4;
  heliShadow.visible = false;
  scene.add(heliShadow);
}

function buildBeacon() {
  beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(6, 6, 120, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd700'), transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
  );
  beacon.visible = false;
  scene.add(beacon);
}

function carGroup(car) {
  const g = new THREE.Group();
  const body = box(11, 3.2, 5.5, car.color);
  body.position.y = 2.2;
  g.add(body);
  const cabin = box(6, 2.6, 5, car.type === 'truck' ? '#444444' : '#223344');
  cabin.position.set(-0.5, 4.6, 0);
  g.add(cabin);
  const wheelMat = new THREE.MeshLambertMaterial({ color: new THREE.Color('#111111') });
  for (const [wx, wz] of [[3.5, 2.8], [3.5, -2.8], [-3.5, 2.8], [-3.5, -2.8]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 1, 10), wheelMat);
    w.rotation.x = Math.PI / 2;
    w.position.set(wx, 1.6, wz);
    g.add(w);
  }
  if (car.type === 'cop' || car.role === 'cop') {
    const bar = box(4, 1, 5.6, '#ff0000', '#ff0000', 1.0);
    bar.position.set(-0.5, 6.4, 0);
    g.add(bar);
  }
  if (car.type === 'jeep') {
    const gun = box(6, 1, 1, '#222222');
    gun.position.set(2, 6.5, 0);
    g.add(gun);
  }
  return g;
}

function pedGroup() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 2, 5.5, 8),
    new THREE.MeshLambertMaterial({ color: new THREE.Color('#c96a5a') }),
  );
  body.position.y = 3.4;
  g.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(1.6, 8, 8),
    new THREE.MeshLambertMaterial({ color: new THREE.Color('#e8b88a') }),
  );
  head.position.y = 7.2;
  g.add(head);
  return g;
}

function syncCars(S) {
  const seen = new Set();
  const all = [...S.cars, ...S.cops, ...S.military];
  if (S.player.car) all.push(S.player.car);
  for (const car of all) {
    seen.add(car);
    let g = carGroups.get(car);
    if (!g) {
      g = carGroup(car);
      carGroups.set(car, g);
      scene.add(g);
    }
    g.position.set(car.x, 0, car.y);
    g.rotation.y = -car.angle;
  }
  for (const [car, g] of carGroups) {
    if (!seen.has(car)) {
      scene.remove(g);
      carGroups.delete(car);
    }
  }
  // Roadblock cruisers: reuse cop car groups, angled across the road.
  for (const rb of S.roadblocks) {
    for (let i = 0; i < rb.cruisers; i++) {
      const key = `rb${S.roadblocks.indexOf(rb)}-${i}`;
      let g = carGroups.get(key);
      if (!g) {
        const fake = { type: 'cop', color: '#1a1a2e', role: 'cop' };
        g = carGroup(fake);
        carGroups.set(key, g);
        scene.add(g);
      }
      const off = (i - (rb.cruisers - 1) / 2) * 14;
      g.position.set(rb.x + Math.cos(rb.angle) * off, 0, rb.y + Math.sin(rb.angle) * off);
      g.rotation.y = -rb.angle;
    }
  }
}

function syncPeds(S) {
  const seen = new Set();
  for (const pd of S.peds) {
    if (pd.dead) continue;
    seen.add(pd);
    let g = pedGroups.get(pd);
    if (!g) {
      g = pedGroup();
      pedGroups.set(pd, g);
      scene.add(g);
    }
    g.position.set(pd.x, 0, pd.y);
    g.rotation.y = -pd.angle;
    g.rotation.z = 0;
  }
  const gang = (S.mission.active && S.mission.data.gang) || [];
  for (const gm of gang) {
    if (gm.hp <= 0) continue;
    seen.add(gm);
    let g = pedGroups.get(gm);
    if (!g) {
      g = pedGroup();
      g.children[0].material = new THREE.MeshLambertMaterial({ color: new THREE.Color('#8a1a1a') });
      pedGroups.set(gm, g);
      scene.add(g);
    }
    g.position.set(gm.x, 0, gm.y);
  }
  for (const [pd, g] of pedGroups) {
    if (!seen.has(pd)) {
      scene.remove(g);
      pedGroups.delete(pd);
    }
  }
}

function syncPackages(S) {
  for (const pkg of S.packages) {
    const g = pkgGroups.get(pkg);
    if (!g) continue;
    g.visible = !pkg.found;
    if (!pkg.found) g.rotation.y += 0.03;
  }
}

function updateLighting(S) {
  const day = S.dayTime;
  const night = day > 0.75 || day < 0.22;
  const dusk = (day > 0.68 && day < 0.78) || (day > 0.18 && day < 0.26);
  const sunI = night ? 0.25 : dusk ? 0.7 : 1.25;
  sun.intensity = sunI;
  ambient.intensity = night ? 0.35 : 0.55;
  hemi.intensity = night ? 0.25 : 0.5;
  const sky = night ? '#0a0a2a' : dusk ? '#ff9a5a' : '#87ceeb';
  scene.background = new THREE.Color(sky);
  scene.fog.color = new THREE.Color(sky);
  const sunAngle = day * Math.PI * 2;
  sun.position.set(Math.cos(sunAngle) * 800, 500 + Math.sin(sunAngle) * 400, 400);
}

export function render(S, dt) {
  if (!renderer) return;
  updateLighting(S);
  syncCars(S);
  syncPeds(S);
  syncPackages(S);

  // Helicopter.
  if (S.heli && heliGroup) {
    heliGroup.visible = true;
    heliShadow.visible = true;
    heliGroup.position.set(S.heli.x, S.heli.z, S.heli.y);
    heliGroup.rotation.y = -Math.atan2(S.player.y - S.heli.y, S.player.x - S.heli.x);
    if (heliRotor) heliRotor.rotation.y = S.heli.rotor;
    heliLight.material.opacity = (S.dayTime > 0.75 || S.dayTime < 0.22) ? 0.5 : 0.22;
    heliShadow.position.set(S.heli.x, 0.4, S.heli.y);
  } else if (heliGroup) {
    heliGroup.visible = false;
    heliShadow.visible = false;
  }

  // Mission beacon at the current stage target.
  if (S.mission.active && S.mission.def) {
    const stage = S.mission.def.stages[S.mission.stage];
    const place = stage && stage.target ? S.city.places[stage.target] : null;
    if (place) {
      beacon.visible = true;
      beacon.position.set(place.x, 60, place.y);
      beacon.rotation.y += 0.01;
    } else {
      beacon.visible = false;
    }
  } else {
    beacon.visible = false;
  }

  // Camera.
  const p = S.player;
  const fwd = p.car ? p.angle : p.angle;
  let camDist = 26, camHeight = 13, lookAhead = 20, lookUp = 2;
  let fov = 62;
  if (S.shotMode === 'chase') {
    // Frame the helicopter: pull back, look up toward it.
    camDist = 34; camHeight = 11; lookAhead = 34; lookUp = 9; fov = 70;
  } else if (S.shotMode === 'start') {
    camDist = 60; camHeight = 34; lookAhead = 0; lookUp = 0; fov = 55;
  }
  if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
  const cx = p.x - Math.cos(fwd) * camDist;
  const cy = p.y - Math.sin(fwd) * camDist;
  const shakeX = (Math.random() - 0.5) * S.shake * 2;
  const shakeY = (Math.random() - 0.5) * S.shake * 2;
  camera.position.set(cx, camHeight + shakeY, cy + shakeX);
  let lookX = p.x + Math.cos(fwd) * lookAhead;
  let lookY = p.y + Math.sin(fwd) * lookAhead;
  let lookZ = lookUp;
  if (S.shotMode === 'chase' && S.heli) {
    // Aim the view between the player and the helicopter so both are in frame.
    lookX = (p.x + S.heli.x) / 2 + Math.cos(fwd) * 20;
    lookY = (p.y + S.heli.y) / 2 + Math.sin(fwd) * 20;
    lookZ = 14;
  }
  camera.lookAt(lookX, lookZ, lookY);

  // Particle effects (simple points).
  for (const e of S.effects) {
    if (e.kind === 'flash') {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(3, 6, 6),
        new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffdd55') }),
      );
      m.position.set(e.x, 4, e.y);
      scene.add(m);
      setTimeout(() => scene.remove(m), 120);
    }
  }

  renderer.render(scene, camera);
  framesRendered += 1;
  if (framesRendered === 2) window.__ready = true;
}
