// VERDE BAY 3D — the renderer: a low-poly third-person view of the city
// on three.js r160 (vendored as a classic script, so it arrives on
// window.THREE). World (x, y) maps to three (x, 0, -y); a heading of 0
// points east, and a mesh whose forward is +x takes rotation.y = heading.
import { WORLD_W, WORLD_H, ROAD_X, ROAD_Y, ROAD_W, BEACH_Y, WATER_Y, PALETTE } from './config.js';

const T = typeof window !== 'undefined' ? window.THREE : null;

function hex(css) {
  // '#rrggbb' -> 0xrrggbb for three.js materials.
  return parseInt(css.slice(1), 16);
}

function css(num) {
  return '#' + num.toString(16).padStart(6, '0');
}

// --- Ground texture ------------------------------------------------------------
// One big canvas painted in world coordinates (0.5 px per unit, flipY off so
// canvas row 0 is world y 0): district tints, parks, beach, water, roads
// with sidewalks, centre lines and crosswalks.
function makeGroundTexture(city) {
  const cv = document.createElement('canvas');
  cv.width = WORLD_W / 2;
  cv.height = WORLD_H / 2;
  const ctx = cv.getContext('2d');
  ctx.scale(0.5, 0.5);
  ctx.fillStyle = css(PALETTE.ground);
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  // District tints.
  for (const d of city.districts) {
    if (!d.tint) continue;
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = css(d.tint);
    ctx.fillRect(d.x, d.y, d.w, d.h);
  }
  ctx.globalAlpha = 1;
  // Parks.
  ctx.fillStyle = css(PALETTE.park);
  for (const p of city.parks) ctx.fillRect(p.x, p.y, p.w, p.h);
  // Beach, then water.
  ctx.fillStyle = css(PALETTE.sand);
  ctx.fillRect(0, BEACH_Y, WORLD_W, WATER_Y - BEACH_Y);
  const grad = ctx.createLinearGradient(0, WATER_Y, 0, WORLD_H);
  grad.addColorStop(0, css(PALETTE.water));
  grad.addColorStop(1, css(PALETTE.waterDeep));
  ctx.fillStyle = grad;
  ctx.fillRect(0, WATER_Y, WORLD_W, WORLD_H - WATER_Y);
  // Sidewalk border, then asphalt, for every road.
  for (const rx of ROAD_X) {
    ctx.fillStyle = css(PALETTE.sidewalk);
    ctx.fillRect(rx - ROAD_W / 2 - 12, 0, ROAD_W + 24, WORLD_H);
    ctx.fillStyle = css(PALETTE.asphalt);
    ctx.fillRect(rx - ROAD_W / 2, 0, ROAD_W, WORLD_H);
  }
  for (const ry of ROAD_Y) {
    ctx.fillStyle = css(PALETTE.sidewalk);
    ctx.fillRect(0, ry - ROAD_W / 2 - 12, WORLD_W, ROAD_W + 24);
    ctx.fillStyle = css(PALETTE.asphalt);
    ctx.fillRect(0, ry - ROAD_W / 2, WORLD_W, ROAD_W);
  }
  // Dashed centre lines.
  ctx.fillStyle = css(PALETTE.roadLine);
  for (const rx of ROAD_X) {
    for (let y = 0; y < WORLD_H; y += 56) ctx.fillRect(rx - 2, y, 4, 28);
  }
  for (const ry of ROAD_Y) {
    for (let x = 0; x < WORLD_W; x += 56) ctx.fillRect(x, ry - 2, 28, 4);
  }
  // Crosswalk stripes at every intersection.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (const rx of ROAD_X) {
    for (const ry of ROAD_Y) {
      for (let i = -3; i <= 3; i++) {
        ctx.fillRect(rx + i * 9 - 3, ry - ROAD_W / 2 + 4, 5, 12);
        ctx.fillRect(rx + i * 9 - 3, ry + ROAD_W / 2 - 16, 5, 12);
      }
    }
  }
  const tex = new T.CanvasTexture(cv);
  tex.flipY = false;
  tex.anisotropy = 4;
  tex.colorSpace = T.SRGBColorSpace;
  return tex;
}

// --- Window texture ---------------------------------------------------------------
// A light facade with a grid of windows; the material colour tints it to the
// building's wall colour. Per-building clones set the repeat so windows
// stay roughly the same size on tall and wide buildings alike.
function makeWindowTexture() {
  const cv = document.createElement('canvas');
  cv.width = 128;
  cv.height = 256;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#cfcfc8';
  ctx.fillRect(0, 0, 128, 256);
  const lit = ['#ffd166', '#ffe9a8', '#9fd8e8'];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 4; c++) {
      const x = 8 + c * 30, y = 10 + r * 30;
      ctx.fillStyle = Math.random() < 0.35 ? lit[(Math.random() * lit.length) | 0] : '#3a4552';
      ctx.fillRect(x, y, 20, 18);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(x, y, 20, 3);
    }
  }
  const tex = new T.CanvasTexture(cv);
  tex.wrapS = T.RepeatWrapping;
  tex.wrapT = T.RepeatWrapping;
  tex.colorSpace = T.SRGBColorSpace;
  return tex;
}

// --- Renderer ---------------------------------------------------------------------
export function createRenderer(S, canvas, opts) {
  if (!T) throw new Error('three.js (window.THREE) is not loaded');
  const noShadow = !!(opts && opts.noShadow);
  const renderer = new T.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.shadowMap.enabled = !noShadow;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new T.Scene();
  scene.background = new T.Color(0x2b2135); // dusk purple over the bay
  scene.fog = new T.Fog(0x2b2135, 700, 2400);

  const camera = new T.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.5, 4000);
  camera.position.set(1300, 300, -300);

  // Sunset: a low warm sun from the west, plus a cool sky fill.
  const sun = new T.DirectionalLight(0xffb36b, 2.2);
  sun.position.set(1300 - 900, 650, -1000 + 500);
  sun.target.position.set(1300, 0, -1000);
  sun.castShadow = !noShadow;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -1400;
  sun.shadow.camera.right = 1400;
  sun.shadow.camera.top = 1100;
  sun.shadow.camera.bottom = -1100;
  sun.shadow.camera.near = 100;
  sun.shadow.camera.far = 3200;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);
  const hemi = new T.HemisphereLight(0x8a7bb8, 0x3a2f28, 0.85);
  scene.add(hemi);

  // Ground.
  const ground = new T.Mesh(
    new T.PlaneGeometry(WORLD_W, WORLD_H),
    new T.MeshLambertMaterial({ map: makeGroundTexture(S.city) }),
  );
  ground.geometry.rotateX(-Math.PI / 2);
  ground.position.set(WORLD_W / 2, 0, -WORLD_H / 2);
  ground.receiveShadow = true;
  scene.add(ground);

  // Buildings: window-textured sides, a coloured roof slab, smokestacks
  // on warehouses. One shared window texture, cloned per building for the
  // repeat; roof materials are cached by colour.
  const winTex = makeWindowTexture();
  const roofMats = new Map();
  const darkMat = new T.MeshLambertMaterial({ color: 0x2a2a2e });
  const roofOf = (colorCss) => {
    if (!roofMats.has(colorCss)) roofMats.set(colorCss, new T.MeshLambertMaterial({ color: hex(colorCss) }));
    return roofMats.get(colorCss);
  };
  const stackMat = new T.MeshLambertMaterial({ color: 0x8a8580 });
  const stackTopMat = new T.MeshLambertMaterial({ color: 0x4a4642 });
  const buildingGroup = new T.Group();
  for (const b of S.city.buildings) {
    const tex = winTex.clone();
    tex.needsUpdate = true;
    tex.repeat.set(Math.max(1, Math.round(b.w / 70)), Math.max(1, Math.round(b.height / 45)));
    const winMat = new T.MeshLambertMaterial({ color: hex(b.wall), map: tex });
    const roofMat = roofOf(b.roof);
    const mesh = new T.Mesh(
      new T.BoxGeometry(b.w, b.height, b.h),
      [winMat, winMat, roofMat, darkMat, winMat, winMat],
    );
    mesh.position.set(b.x + b.w / 2, b.height / 2, -(b.y + b.h / 2));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    buildingGroup.add(mesh);
    // A thin roof slab so the roof colour reads from above.
    const slab = new T.Mesh(new T.BoxGeometry(b.w + 2, 1.5, b.h + 2), roofMat);
    slab.position.set(b.x + b.w / 2, b.height + 0.75, -(b.y + b.h / 2));
    slab.castShadow = true;
    buildingGroup.add(slab);
    if (b.stack) {
      const sx = b.x + b.w * 0.25, sz = -(b.y + b.h * 0.3);
      const stack = new T.Mesh(new T.CylinderGeometry(3, 4, 16, 8), stackMat);
      stack.position.set(sx, b.height + 8, sz);
      stack.castShadow = true;
      buildingGroup.add(stack);
      const cap = new T.Mesh(new T.CylinderGeometry(3.4, 3.4, 1.5, 8), stackTopMat);
      cap.position.set(sx, b.height + 16, sz);
      buildingGroup.add(cap);
    }
  }
  scene.add(buildingGroup);

  // Trees, palms and lamps as instanced meshes (hundreds of them, one draw
  // call each). Per-instance colour varies the canopy.
  const dummy = new T.Object3D();
  function instanced(geo, mat, items, place) {
    const m = new T.InstancedMesh(geo, mat, items.length);
    items.forEach((it, i) => {
      place(dummy, it);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      if (it._color !== undefined) m.setColorAt(i, new T.Color(it._color));
    });
    m.castShadow = true;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    scene.add(m);
    return m;
  }
  instanced(
    new T.CylinderGeometry(2.2, 3.4, 14, 6),
    new T.MeshLambertMaterial({ color: PALETTE.trunk }),
    S.city.trees,
    (d, t) => { d.position.set(t.x, 7, -t.y); d.rotation.set(0, 0, 0); d.scale.set(1, 1, 1); },
  );
  const treeColors = [PALETTE.tree, PALETTE.treeLight];
  S.city.trees.forEach((t, i) => { t._color = treeColors[i % 2]; });
  instanced(
    new T.IcosahedronGeometry(1, 0),
    new T.MeshLambertMaterial({ color: 0xffffff }),
    S.city.trees,
    (d, t) => { d.position.set(t.x, 15 + t.r * 0.4, -t.y); d.rotation.set(0, t.x * 0.01, 0); d.scale.set(t.r, t.r * 0.9, t.r); },
  );
  instanced(
    new T.CylinderGeometry(1.6, 2.6, 22, 6),
    new T.MeshLambertMaterial({ color: PALETTE.trunk }),
    S.city.palms,
    (d, p) => { d.position.set(p.x, 11, -p.y); d.rotation.set(0.06, 0, 0.04); d.scale.set(1, 1, 1); },
  );
  const palmColors = [PALETTE.palm, PALETTE.palmLight];
  S.city.palms.forEach((p, i) => { p._color = palmColors[i % 2]; });
  instanced(
    new T.IcosahedronGeometry(1, 0),
    new T.MeshLambertMaterial({ color: 0xffffff }),
    S.city.palms,
    (d, p) => { d.position.set(p.x, 23, -p.y); d.rotation.set(0, p.x * 0.01, 0); d.scale.set(p.r * 1.15, p.r * 0.55, p.r * 1.15); },
  );
  instanced(
    new T.CylinderGeometry(0.9, 1.3, 22, 6),
    new T.MeshLambertMaterial({ color: 0x2e3138 }),
    S.city.lamps,
    (d, l) => { d.position.set(l.x, 11, -l.y); d.rotation.set(0, 0, 0); d.scale.set(1, 1, 1); },
  );
  instanced(
    new T.SphereGeometry(2.6, 8, 6),
    new T.MeshBasicMaterial({ color: 0xffd166 }),
    S.city.lamps,
    (d, l) => { d.position.set(l.x, 22.5, -l.y); d.rotation.set(0, 0, 0); d.scale.set(1, 1, 1); },
  );

  // Mission marker: ground disc + light beam + a rotating ring.
  const marker = new T.Group();
  const markerDisc = new T.Mesh(
    new T.CylinderGeometry(18, 18, 2, 24),
    new T.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.55 }),
  );
  markerDisc.position.y = 1;
  const markerBeam = new T.Mesh(
    new T.CylinderGeometry(3, 3, 70, 12, 1, true),
    new T.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.22, side: T.DoubleSide, depthWrite: false }),
  );
  markerBeam.position.y = 35;
  const markerRing = new T.Mesh(
    new T.TorusGeometry(20, 1.6, 8, 32),
    new T.MeshBasicMaterial({ color: 0xffd166 }),
  );
  markerRing.rotation.x = Math.PI / 2;
  markerRing.position.y = 8;
  marker.add(markerDisc);
  marker.add(markerBeam);
  marker.add(markerRing);
  marker.visible = false;
  scene.add(marker);

  // Particles (explosions, muzzle bursts) as one Points cloud. A soft round
  // sprite keeps sparks looking like sparks instead of white squares.
  const spriteTex = (() => {
    const cv = document.createElement('canvas');
    cv.width = 64; cv.height = 64;
    const ctx = cv.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.8)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return new T.CanvasTexture(cv);
  })();
  const MAX_PARTICLES = 512;
  const particleGeo = new T.BufferGeometry();
  const particlePos = new Float32Array(MAX_PARTICLES * 3);
  const particleCol = new Float32Array(MAX_PARTICLES * 3);
  particleGeo.setAttribute('position', new T.BufferAttribute(particlePos, 3));
  particleGeo.setAttribute('color', new T.BufferAttribute(particleCol, 3));
  const particles = new T.Points(particleGeo, new T.PointsMaterial({ size: 6, vertexColors: true, sizeAttenuation: true, transparent: true, opacity: 0.95, map: spriteTex, depthWrite: false }));
  particles.frustumCulled = false;
  scene.add(particles);

  // Bullet tracers as one LineSegments cloud.
  const MAX_TRACERS = 24;
  const tracerGeo = new T.BufferGeometry();
  const tracerPos = new Float32Array(MAX_TRACERS * 6);
  tracerGeo.setAttribute('position', new T.BufferAttribute(tracerPos, 3));
  const tracers = new T.LineSegments(tracerGeo, new T.LineBasicMaterial({ color: 0xffe66d, transparent: true, opacity: 0.85 }));
  tracers.frustumCulled = false;
  scene.add(tracers);

  // One pooled explosion light, driven by S.flash.
  const flashLight = new T.PointLight(0xff7733, 0, 160, 1.6);
  flashLight.visible = false;
  scene.add(flashLight);

  // A uniform-grid index over building footprints for the camera occlusion
  // ray: cell 200 world units, key 'cx,cz' -> building indices.
  const occGrid = new Map();
  const CELL = 200;
  S.city.buildings.forEach((b, i) => {
    const x0 = Math.floor(b.x / CELL), x1 = Math.floor((b.x + b.w) / CELL);
    const z0 = Math.floor(-(b.y + b.h) / CELL), z1 = Math.floor(-b.y / CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const key = cx + ',' + cz;
        if (!occGrid.has(key)) occGrid.set(key, []);
        occGrid.get(key).push(i);
      }
    }
  });

  return {
    renderer, scene, camera, frames: 0,
    carMeshes: new Map(),
    pedMeshes: new Map(),
    pickupMeshes: new Map(),
    playerMesh: null,
    marker, markerDisc, markerBeam, markerRing,
    particles, particleGeo, particlePos, particleCol,
    tracers, tracerGeo, tracerPos,
    flashLight,
    occGrid, buildings: S.city.buildings,
    camPos: new T.Vector3(1300, 300, -300),
  };
}

// --- Cars ---------------------------------------------------------------------------
// One group per car: body, glass cabin, four spinning wheels, brake lights,
// headlights, plus a police light bar or a taxi sign when applicable.
// Body materials are cached by colour; the glass and wheel materials are shared.
const _bodyMats = new Map();
const _glassMat = () => _glassMat.m || (_glassMat.m = new T.MeshPhongMaterial({ color: 0x14161f, shininess: 90 }));
const _wheelMat = () => _wheelMat.m || (_wheelMat.m = new T.MeshLambertMaterial({ color: 0x141414 }));
const _brakeOff = () => _brakeOff.m || (_brakeOff.m = new T.MeshLambertMaterial({ color: 0x5a1010 }));
const _brakeOn = () => _brakeOn.m || (_brakeOn.m = new T.MeshBasicMaterial({ color: 0xff2a2a }));
const _headMat = () => _headMat.m || (_headMat.m = new T.MeshBasicMaterial({ color: 0xfff2b0 }));
const _lightRed = () => _lightRed.m || (_lightRed.m = new T.MeshBasicMaterial({ color: 0xff2222 }));
const _lightBlue = () => _lightBlue.m || (_lightBlue.m = new T.MeshBasicMaterial({ color: 0x2266ff }));
const _lightOff = () => _lightOff.m || (_lightOff.m = new T.MeshLambertMaterial({ color: 0x30343c }));
const _taxiMat = () => _taxiMat.m || (_taxiMat.m = new T.MeshBasicMaterial({ color: 0xffd166 }));

function bodyMat(colorCss) {
  if (!_bodyMats.has(colorCss)) {
    _bodyMats.set(colorCss, new T.MeshPhongMaterial({ color: hex(colorCss), shininess: 70 }));
  }
  return _bodyMats.get(colorCss);
}

function buildCarMesh(car) {
  const g = new T.Group();
  const tall = car.model === 'van' || car.model === 'truck';
  const bodyH = tall ? 11 : 7;
  const body = new T.Mesh(new T.BoxGeometry(car.w, bodyH, car.h), bodyMat(car.color));
  body.position.y = 4 + bodyH / 2;
  body.castShadow = true;
  g.add(body);
  // Glass cabin: a cab at the front for trucks, a centred cabin otherwise.
  const cabW = car.model === 'truck' ? car.w * 0.26 : car.w * 0.42;
  const cabX = car.model === 'truck' ? car.w * 0.28 : -car.w * 0.04;
  const cabin = new T.Mesh(new T.BoxGeometry(cabW, 5, car.h * 0.72), _glassMat());
  cabin.position.set(cabX, 4 + bodyH + 2.2, 0);
  cabin.castShadow = true;
  g.add(cabin);
  // Wheels: cylinder geometry baked so its axis lies along z (the axle).
  const wheelGeo = new T.CylinderGeometry(4.2, 4.2, 3, 12);
  wheelGeo.rotateX(Math.PI / 2);
  const wheels = [];
  for (const [wx, wz] of [[-car.w * 0.32, car.h / 2 - 1], [car.w * 0.32, car.h / 2 - 1], [-car.w * 0.32, -(car.h / 2 - 1)], [car.w * 0.32, -(car.h / 2 - 1)]]) {
    const wheel = new T.Mesh(wheelGeo, _wheelMat());
    wheel.position.set(wx, 4.2, wz);
    wheel.castShadow = true;
    g.add(wheel);
    wheels.push(wheel);
  }
  // Brake lights at the rear, headlights at the front.
  const brakeL = new T.Mesh(new T.BoxGeometry(1.5, 2.5, 4), _brakeOff());
  brakeL.position.set(-car.w / 2 - 0.4, 6, car.h / 2 - 4);
  const brakeR = brakeL.clone();
  brakeR.position.z = -(car.h / 2 - 4);
  g.add(brakeL);
  g.add(brakeR);
  const headL = new T.Mesh(new T.BoxGeometry(1.5, 2, 3.5), _headMat());
  headL.position.set(car.w / 2 + 0.4, 5.5, car.h / 2 - 4);
  const headR = headL.clone();
  headR.position.z = -(car.h / 2 - 4);
  g.add(headL);
  g.add(headR);
  // Police light bar, or a taxi sign.
  let lightBarL = null, lightBarR = null;
  if (car.kind === 'police') {
    const bar = new T.Mesh(new T.BoxGeometry(8, 2, 14), _lightOff());
    bar.position.set(-2, 4 + bodyH + 5.4, 0);
    g.add(bar);
    lightBarL = new T.Mesh(new T.BoxGeometry(3.5, 2.5, 5), _lightOff());
    lightBarL.position.set(-2, 4 + bodyH + 6.8, 3.6);
    lightBarR = new T.Mesh(new T.BoxGeometry(3.5, 2.5, 5), _lightOff());
    lightBarR.position.set(-2, 4 + bodyH + 6.8, -3.6);
    g.add(lightBarL);
    g.add(lightBarR);
  }
  let taxiSign = null;
  if (car.kind === 'taxi') {
    taxiSign = new T.Mesh(new T.BoxGeometry(10, 2.5, 6), _taxiMat());
    taxiSign.position.set(-2, 4 + bodyH + 5.4, 0);
    g.add(taxiSign);
  }
  return { group: g, wheels, brakeL, brakeR, lightBarL, lightBarR, taxiSign };
}

// --- Pedestrians ---------------------------------------------------------------------
// Body, head, two swinging legs and two swinging arms. The pivot of each
// limb sits at its top (geometry translated down) so a z-rotation swings it
// forward and back along the walking direction.
const _pedBodyMats = new Map();
const _skinMat = () => _skinMat.m || (_skinMat.m = new T.MeshLambertMaterial({ color: 0xe8b98a }));
const _legMat = () => _legMat.m || (_legMat.m = new T.MeshLambertMaterial({ color: 0x2b2d42 }));
const _capMat = () => _capMat.m || (_capMat.m = new T.MeshLambertMaterial({ color: 0x1d3557 }));

function pedBodyMat(colorCss) {
  const c = colorCss || '#8a8f98';
  if (!_pedBodyMats.has(c)) {
    _pedBodyMats.set(c, new T.MeshLambertMaterial({ color: hex(c) }));
  }
  return _pedBodyMats.get(c);
}

function buildPedMesh(ped, isPlayer) {
  const g = new T.Group();
  const bodyColor = isPlayer ? '#2ec4b6' : ped.color;
  const body = new T.Mesh(new T.BoxGeometry(9, 15, 6), pedBodyMat(bodyColor));
  body.position.y = 13;
  body.castShadow = true;
  g.add(body);
  const head = new T.Mesh(new T.SphereGeometry(4.2, 10, 8), _skinMat());
  head.position.y = 24;
  head.castShadow = true;
  g.add(head);
  if (ped.kind === 'cop') {
    const cap = new T.Mesh(new T.CylinderGeometry(4.6, 4.6, 1.6, 10), _capMat());
    cap.position.y = 27.4;
    g.add(cap);
  }
  const legGeo = new T.BoxGeometry(3.5, 12, 3.5);
  legGeo.translate(0, -6, 0);
  const legL = new T.Mesh(legGeo, _legMat());
  legL.position.set(0, 7, 2.2);
  const legR = new T.Mesh(legGeo, _legMat());
  legR.position.set(0, 7, -2.2);
  g.add(legL);
  g.add(legR);
  const armGeo = new T.BoxGeometry(3, 11, 3);
  armGeo.translate(0, -5.5, 0);
  const armL = new T.Mesh(armGeo, pedBodyMat(bodyColor));
  armL.position.set(0, 19, 5);
  const armR = new T.Mesh(armGeo, pedBodyMat(bodyColor));
  armR.position.set(0, 19, -5);
  g.add(armL);
  g.add(armR);
  // The player's pistol, held out in front while on foot.
  let pistol = null;
  if (isPlayer) {
    pistol = new T.Mesh(new T.BoxGeometry(7, 1.5, 1.5), _wheelMat());
    pistol.position.set(9, 15, -5.5);
    g.add(pistol);
  }
  return { group: g, legL, legR, armL, armR, pistol };
}

function syncPedMesh(mesh, ped, dt) {
  const g = mesh.group;
  g.position.set(ped.x, Math.abs(Math.sin(ped.walkPhase || 0)) * 1.5, -ped.y);
  g.rotation.y = ped.angle;
  const swing = Math.sin(ped.walkPhase || 0) * (ped.speed > 10 ? 0.55 : 0.08);
  mesh.legL.rotation.z = swing;
  mesh.legR.rotation.z = -swing;
  mesh.armL.rotation.z = -swing * 0.7;
  mesh.armR.rotation.z = swing * 0.7;
  void dt;
}

// --- Camera occlusion -------------------------------------------------------------
// Slab test: the smallest t in [0,1] where the segment p0 + d*t enters the
// building's box (three coords: x in [b.x, b.x+b.w], y in [0, height],
// z in [-(b.y+b.h), -b.y]), or -1 for no hit.
function segmentT(p0, d, b) {
  let tmin = 0, tmax = 1;
  const mins = [b.x, 0, -(b.y + b.h)];
  const maxs = [b.x + b.w, b.height, -b.y];
  const o = [p0.x, p0.y, p0.z];
  const dd = [d.x, d.y, d.z];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(dd[i]) < 1e-9) {
      if (o[i] < mins[i] || o[i] > maxs[i]) return -1;
    } else {
      let t1 = (mins[i] - o[i]) / dd[i];
      let t2 = (maxs[i] - o[i]) / dd[i];
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return -1;
    }
  }
  return tmin;
}

// Walk the head->camera segment through the grid, test the candidate
// buildings, return the nearest hit fraction or -1.
function occludeT(R, p0, p1) {
  const dx = p1.x - p0.x, dy = p1.y - p0.y, dz = p1.z - p0.z;
  const d = { x: dx, y: dy, z: dz };
  const seen = new Set();
  let best = -1;
  const STEPS = 10;
  for (let s = 0; s <= STEPS; s++) {
    const t = s / STEPS;
    const key = Math.floor((p0.x + dx * t) / 200) + ',' + Math.floor((p0.z + dz * t) / 200);
    const list = R.occGrid.get(key);
    if (!list) continue;
    for (const idx of list) {
      if (seen.has(idx)) continue;
      seen.add(idx);
      const hit = segmentT(p0, d, R.buildings[idx]);
      if (hit >= 0 && (best < 0 || hit < best)) best = hit;
    }
  }
  return best;
}

let _tmpV = null;
let _rc = null, _pl = null, _hit = null;

// --- Per-frame render ------------------------------------------------------------
export function renderFrame(R, S, dt) {
  if (!_tmpV) _tmpV = new T.Vector3();
  // Keep the aspect right if the window was resized (main.js resizes the
  // renderer directly and does not touch the camera).
  const vw = window.innerWidth, vh = window.innerHeight;
  if (Math.abs(R.camera.aspect - vw / vh) > 0.001) {
    R.camera.aspect = vw / vh;
    R.camera.updateProjectionMatrix();
  }
  const p = S.player;
  const px = p.car ? p.car.x : p.x;
  const py = p.car ? p.car.y : p.y;
  const heading = p.car ? p.car.angle : p.angle;
  const fx = Math.cos(heading), fz = -Math.sin(heading); // forward, in three coords

  if (S.flags.menu && !S.flags.started) {
    // Slow orbit over the city behind the menu.
    const a = S.time * 0.05;
    _tmpV.set(1300 + Math.cos(a) * 650, 300, -1000 + Math.sin(a) * 650);
    R.camPos.lerp(_tmpV, 1 - Math.exp(-2 * dt));
    R.camera.position.copy(R.camPos);
    R.camera.lookAt(1300, 0, -1000);
  } else {
    // Chase camera: 95 back, 42 up, pulled in when a building blocks the view.
    const head = { x: px, y: 8, z: -py };
    const desired = { x: px - fx * 95, y: 42, z: -py - fz * 95 };
    const t = occludeT(R, head, desired);
    if (t >= 0) {
      const pull = Math.max(0.15, t * 0.85);
      desired.x = head.x + (desired.x - head.x) * pull;
      desired.y = head.y + (desired.y - head.y) * pull;
      desired.z = head.z + (desired.z - head.z) * pull;
    }
    _tmpV.set(desired.x, desired.y, desired.z);
    if (S.cameraSnap) { R.camPos.copy(_tmpV); S.cameraSnap = false; }
    else R.camPos.lerp(_tmpV, 1 - Math.exp(-6 * dt));
    R.camera.position.copy(R.camPos);
    if (S.shake > 0) {
      R.camera.position.x += (Math.random() - 0.5) * S.shake * 2.5;
      R.camera.position.y += (Math.random() - 0.5) * S.shake * 2.5;
      R.camera.position.z += (Math.random() - 0.5) * S.shake * 2.5;
    }
    R.camera.lookAt(px + fx * 25, 5, -py + fz * 25);
  }

  // Cars: create on demand, drop when they leave the sim.
  const liveCars = new Set(S.cars);
  for (const [car, mesh] of R.carMeshes) {
    if (!liveCars.has(car)) { R.scene.remove(mesh.group); R.carMeshes.delete(car); }
  }
  for (const car of S.cars) {
    let mesh = R.carMeshes.get(car);
    if (!mesh) { mesh = buildCarMesh(car); R.carMeshes.set(car, mesh); R.scene.add(mesh.group); }
    mesh.group.position.set(car.x, 0, -car.y);
    mesh.group.rotation.y = car.angle;
    const spin = (car.speed * dt) / 4.2;
    for (const w of mesh.wheels) w.rotation.z -= spin;
    const brakeMat = car.brake ? _brakeOn() : _brakeOff();
    mesh.brakeL.material = brakeMat;
    mesh.brakeR.material = brakeMat;
    if (mesh.lightBarL) {
      const flashing = S.wanted.level > 0;
      const phase = Math.floor(S.time * 5) % 2 === 0;
      mesh.lightBarL.material = flashing && phase ? _lightRed() : _lightOff();
      mesh.lightBarR.material = flashing && !phase ? _lightBlue() : _lightOff();
    }
  }

  // Pedestrians and foot police.
  const livePeds = new Set([...S.peds, ...S.cops]);
  for (const [ped, mesh] of R.pedMeshes) {
    if (!livePeds.has(ped)) { R.scene.remove(mesh.group); R.pedMeshes.delete(ped); }
  }
  for (const ped of livePeds) {
    let mesh = R.pedMeshes.get(ped);
    if (!mesh) { mesh = buildPedMesh(ped, false); R.pedMeshes.set(ped, mesh); R.scene.add(mesh.group); }
    syncPedMesh(mesh, ped, dt);
  }

  // The player on foot (hidden while driving — they are inside the car).
  if (!R.playerMesh) { R.playerMesh = buildPedMesh(S.player, true); R.scene.add(R.playerMesh.group); }
  if (S.player.onFoot) {
    S.player.walkPhase = (S.player.walkPhase || 0) + dt * (S.player.speed > 10 ? 9 : 2);
    R.playerMesh.group.visible = true;
    syncPedMesh(R.playerMesh, S.player, dt);
    if (R.playerMesh.pistol) R.playerMesh.pistol.visible = true;
  } else {
    R.playerMesh.group.visible = false;
  }

  // Mission marker (yellow) or taxi marker (cyan).
  if (!R.markerOrbs) {
    R.markerOrbs = [];
    for (let i = 0; i < 3; i++) {
      const orb = new T.Mesh(new T.SphereGeometry(2.2, 8, 6), new T.MeshBasicMaterial({ color: 0xffffff }));
      R.marker.add(orb);
      R.markerOrbs.push(orb);
    }
  }
  const m = S.mission.marker || (S.taxi && S.taxi.active ? S.taxi.marker : null);
  if (m) {
    const isTaxi = !S.mission.marker;
    const col = isTaxi ? 0x4cc9f0 : 0xffd166;
    R.marker.visible = true;
    R.marker.position.set(m.x, 0, -m.y);
    R.markerDisc.material.color.setHex(col);
    R.markerBeam.material.color.setHex(col);
    R.markerRing.material.color.setHex(col);
    const pulse = 1 + Math.sin(S.time * 3) * 0.08;
    R.markerDisc.scale.set(pulse, 1, pulse);
    R.marker.rotation.y += dt * 1.2;
    for (let i = 0; i < 3; i++) {
      const a = S.time * 1.2 + (i * Math.PI * 2) / 3;
      R.markerOrbs[i].position.set(Math.cos(a) * 20, 8, Math.sin(a) * 20);
    }
  } else {
    R.marker.visible = false;
  }

  // Armor pickups: spinning cyan cubes.
  const livePickups = new Set(S.pickups);
  for (const [pk, mesh] of R.pickupMeshes) {
    if (!livePickups.has(pk)) { R.scene.remove(mesh); R.pickupMeshes.delete(pk); }
  }
  for (const pk of S.pickups) {
    let mesh = R.pickupMeshes.get(pk);
    if (!mesh) {
      mesh = new T.Mesh(new T.BoxGeometry(10, 10, 10), new T.MeshBasicMaterial({ color: 0x4cc9f0 }));
      R.pickupMeshes.set(pk, mesh);
      R.scene.add(mesh);
    }
    mesh.position.set(pk.x, 4 + Math.sin(S.time * 3 + pk.x) * 1.5, -pk.y);
    mesh.rotation.y += dt * 2;
  }

  // Particles.
  const pn = Math.min(S.particles.length, 512);
  const col = new T.Color();
  for (let i = 0; i < pn; i++) {
    const pt = S.particles[i];
    R.particlePos[i * 3] = pt.x;
    R.particlePos[i * 3 + 1] = 3;
    R.particlePos[i * 3 + 2] = -pt.y;
    col.set(pt.color);
    R.particleCol[i * 3] = col.r;
    R.particleCol[i * 3 + 1] = col.g;
    R.particleCol[i * 3 + 2] = col.b;
  }
  R.particleGeo.setDrawRange(0, pn);
  R.particleGeo.attributes.position.needsUpdate = true;
  R.particleGeo.attributes.color.needsUpdate = true;

  // Tracers.
  const tn = Math.min(S.tracers.length, 24);
  for (let i = 0; i < tn; i++) {
    const tr = S.tracers[i];
    R.tracerPos[i * 6] = tr.x1;
    R.tracerPos[i * 6 + 1] = 4;
    R.tracerPos[i * 6 + 2] = -tr.y1;
    R.tracerPos[i * 6 + 3] = tr.x2;
    R.tracerPos[i * 6 + 4] = 4;
    R.tracerPos[i * 6 + 5] = -tr.y2;
  }
  R.tracerGeo.setDrawRange(0, tn * 2);
  R.tracerGeo.attributes.position.needsUpdate = true;

  // Explosion flash light.
  if (S.flash) {
    R.flashLight.visible = true;
    R.flashLight.position.set(S.flash.x, 12, -S.flash.y);
    R.flashLight.intensity = 150 * Math.max(0, S.flash.life / 0.35);
  } else {
    R.flashLight.visible = false;
  }

  R.renderer.render(R.scene, R.camera);
  R.frames += 1;
}

// --- Mouse aim -----------------------------------------------------------------------
// Project a screen point onto the ground plane (y = 0) and return world {x, y}.
export function screenToGround(R, S, mx, my, w, h) {
  void S;
  if (!_rc) {
    _rc = new T.Raycaster();
    _pl = new T.Plane(new T.Vector3(0, 1, 0), 0);
    _hit = new T.Vector3();
  }
  _rc.setFromCamera({ x: (mx / w) * 2 - 1, y: -(my / h) * 2 + 1 }, R.camera);
  if (!_rc.ray.intersectPlane(_pl, _hit)) return null;
  return { x: _hit.x, y: -_hit.z };
}
