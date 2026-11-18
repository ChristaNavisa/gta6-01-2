// Verde Bay in 3D: three.js scene, dusk lighting, the island city, traffic,
// the chase camera and the screenshot presets. The sim owns the state;
// this module only draws it.

import 'three';

// The vendored three.min.js is the UMD build (r160): it sets window.THREE
// and has no ESM exports, so a namespace import would be empty.
const THREE = window.THREE;
import { WORLD, DUSK } from './config.js';
import { DISTRICTS } from './city.js';
import { particles, updateParticles, makeGlowTexture } from './effects.js';
import { MISSIONS } from './missions.js';
import { clamp, lerp } from './util.js';

const SCALE_X = 1024 / WORLD.width;
const SCALE_Y = 660 / WORLD.height;

function makeSkyTexture() {
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#1d2547');
  grad.addColorStop(0.45, '#5b3a6e');
  grad.addColorStop(0.75, '#c65f4e');
  grad.addColorStop(1, '#ff9e57');
  g.fillStyle = grad;
  g.fillRect(0, 0, 16, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeWindowTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#aab0bb';
  g.fillRect(0, 0, 128, 256);
  for (let y = 8; y < 248; y += 16) {
    for (let x = 8; x < 120; x += 16) {
      const lit = Math.random() < 0.42;
      g.fillStyle = lit ? '#ffd166' : '#2b3440';
      g.fillRect(x, y, 9, 11);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function drawGroundTexture(city) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 660;
  const g = c.getContext('2d');
  const X = (x) => x * SCALE_X;
  const Y = (y) => y * SCALE_Y;
  // Water first: the channel, the sea, and the water around Isla Verde.
  g.fillStyle = '#1d4e89';
  g.fillRect(0, 0, 1024, 660);
  // Land districts.
  for (const d of DISTRICTS) {
    g.fillStyle = d.ground;
    g.fillRect(X(d.x0), Y(d.y0), X(d.x1 - d.x0), Y(d.y1 - d.y0));
  }
  // The bridge deck across the channel.
  g.fillStyle = '#7a7d84';
  g.fillRect(X(WORLD.channelX0), Y(WORLD.bridgeY0), X(WORLD.channelX1 - WORLD.channelX0), Y(WORLD.bridgeY1 - WORLD.bridgeY0));
  // Roads: dark asphalt strips on the 200px grid, with center dashes.
  g.fillStyle = '#2f3237';
  for (let x = 0; x <= WORLD.width; x += 200) {
    if (x >= WORLD.channelX0 && x < WORLD.channelX1) continue;
    g.fillRect(X(x) - 6, 0, 13, 660);
  }
  for (let y = 0; y <= WORLD.height; y += 200) {
    g.fillRect(0, Y(y) - 6, 1024, 13);
  }
  // The bridge carries its road across the channel.
  g.fillStyle = '#2f3237';
  g.fillRect(X(WORLD.channelX0), Y(1000) - 6, X(WORLD.channelX1 - WORLD.channelX0), 13);
  g.fillRect(X(WORLD.channelX0), Y(1200) - 6, X(WORLD.channelX1 - WORLD.channelX0), 13);
  // Center dashes on the main roads.
  g.fillStyle = '#e8c15a';
  for (let x = 0; x <= WORLD.width; x += 200) {
    if (x >= WORLD.channelX0 && x < WORLD.channelX1) continue;
    for (let y = 0; y < WORLD.height; y += 44) {
      g.fillRect(X(x) - 1, Y(y), 2, 14);
    }
  }
  for (let y = 0; y <= WORLD.height; y += 200) {
    for (let x = 0; x < WORLD.width; x += 44) {
      if (x >= WORLD.channelX0 && x < WORLD.channelX1) continue;
      g.fillRect(X(x), Y(y) - 1, 14, 2);
    }
  }
  // Marina docks.
  g.fillStyle = '#8a7a5a';
  g.fillRect(X(2080), Y(1860), X(120), Y(14));
  g.fillRect(X(2220), Y(1900), X(120), Y(14));
  // Beach shoreline highlight.
  g.fillStyle = '#f7e3b0';
  g.fillRect(0, Y(2020), X(1700), Y(30));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const geoCache = new Map();
function boxGeo(w, h, d) {
  const key = `box:${w},${h},${d}`;
  if (!geoCache.has(key)) geoCache.set(key, new THREE.BoxGeometry(w, h, d));
  return geoCache.get(key);
}
const matCache = new Map();
function lambert(color) {
  if (!matCache.has(color)) matCache.set(color, new THREE.MeshLambertMaterial({ color }));
  return matCache.get(color);
}
function basic(color) {
  const key = `basic:${color}`;
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshBasicMaterial({ color }));
  return matCache.get(key);
}

/** Build one car group (body, cabin, wheels, lights). Forward is +x. */
function makeCarMesh(car) {
  const group = new THREE.Group();
  const isTruck = car.type === 'truck';
  const len = isTruck ? 72 : 56;
  const wid = isTruck ? 36 : 30;
  const bodyH = isTruck ? 18 : 12;
  const body = new THREE.Mesh(boxGeo(len, bodyH, wid), lambert(car.color));
  body.position.y = 8;
  group.add(body);
  const cabin = new THREE.Mesh(
    boxGeo(isTruck ? 22 : 28, 10, wid - 4),
    new THREE.MeshLambertMaterial({ color: '#141c28' }),
  );
  cabin.position.set(isTruck ? len / 2 - 16 : -4, bodyH + 5, 0);
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(6, 6, 4, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: '#111111' });
  for (const [wx, wz] of [[-len / 2 + 12, -wid / 2], [-len / 2 + 12, wid / 2], [len / 2 - 12, -wid / 2], [len / 2 - 12, wid / 2]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(wx, 6, wz);
    group.add(wheel);
  }
  const headMat = basic('#fff3b0');
  for (const wz of [-9, 9]) {
    const light = new THREE.Mesh(boxGeo(2, 3, 5), headMat);
    light.position.set(len / 2, 8, wz);
    group.add(light);
  }
  const tailMat = basic('#ff2a2a');
  for (const wz of [-9, 9]) {
    const light = new THREE.Mesh(boxGeo(2, 3, 5), tailMat);
    light.position.set(-len / 2, 8, wz);
    group.add(light);
  }
  if (car.type === 'taxi') {
    const sign = new THREE.Mesh(boxGeo(16, 5, 10), basic('#ffd60a'));
    sign.position.set(-4, bodyH + 13, 0);
    group.add(sign);
  }
  if (car.isCop) {
    const red = new THREE.Mesh(boxGeo(8, 4, 8), basic('#ff2a2a'));
    red.position.set(0, bodyH + 12, -8);
    const blue = new THREE.Mesh(boxGeo(8, 4, 8), basic('#2277ff'));
    blue.position.set(0, bodyH + 12, 8);
    group.add(red);
    group.add(blue);
    group.userData.flash = { red, blue };
  }
  return group;
}

/** Build one pedestrian figure (body + head). */
function makePedMesh(color) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(boxGeo(11, 22, 8), lambert(color));
  body.position.y = 11;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(4.5, 8, 8), lambert('#e8b98a'));
  head.position.y = 26;
  group.add(head);
  return group;
}

/** Create the renderer + scene for a game state. Returns { render(S, dt) }. */
export function createWorld(canvas, S) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  scene.background = makeSkyTexture();
  scene.fog = new THREE.Fog(new THREE.Color(DUSK.fog), 500, 2800);

  const hemi = new THREE.HemisphereLight(0x8a7bd8, 0x4a3b2f, 1.0);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffb347, 1.6);
  sun.position.set(-900, 420, 300);
  sun.target.position.set(1700, 0, 1100);
  scene.add(sun);
  scene.add(sun.target);

  // Low sun disc on the western horizon.
  const sunSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(makeGlowTexture()), color: 0xffb347, transparent: true, depthWrite: false }),
  );
  sunSprite.position.set(-400, 150, 1100);
  sunSprite.scale.set(420, 420, 1);
  scene.add(sunSprite);

  // Ground.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.width, WORLD.height),
    new THREE.MeshLambertMaterial({ map: drawGroundTexture(S.city) }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(WORLD.width / 2, 0, WORLD.height / 2);
  scene.add(ground);

  // Water overlays (channel, sea, around Isla Verde) for a reflective sheen.
  const waterMat = new THREE.MeshPhongMaterial({ color: 0x2a6db0, transparent: true, opacity: 0.5, shininess: 140, specular: 0xffcf99 });
  const waterRects = [
    [WORLD.channelX0, 0, WORLD.channelX1 - WORLD.channelX0, WORLD.height],
    [0, WORLD.seaY0, WORLD.width, WORLD.height - WORLD.seaY0],
    [WORLD.islaX0, 0, WORLD.width - WORLD.islaX0, 700],
    [WORLD.islaX0, 1500, WORLD.width - WORLD.islaX0, WORLD.height - 1500],
  ];
  for (const [x, y, w, h] of waterRects) {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), waterMat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(x + w / 2, 0.5, y + h / 2);
    scene.add(plane);
  }

  const city = S.city;

  // Buildings: one instanced mesh for walls (window texture), one for roofs.
  const wallTex = makeWindowTexture();
  const wallMat = new THREE.MeshLambertMaterial({ map: wallTex });
  const walls = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), wallMat, Math.max(1, city.buildings.length));
  const roofs = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff }), Math.max(1, city.buildings.length));
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const wallTint = new THREE.Color();
  const roofColor = new THREE.Color();
  city.buildings.forEach((b, i) => {
    m4.compose(new THREE.Vector3(b.x + b.w / 2, b.height / 2, b.y + b.d / 2), q, new THREE.Vector3(b.w, b.height, b.d));
    walls.setMatrixAt(i, m4);
    const shade = 0.82 + ((i * 37) % 20) / 100;
    wallTint.setRGB(shade, shade * 0.96, shade * 0.92);
    walls.setColorAt(i, wallTint);
    m4.compose(new THREE.Vector3(b.x + b.w / 2, b.height + 1.5, b.y + b.d / 2), q, new THREE.Vector3(b.w + 2, 3, b.d + 2));
    roofs.setMatrixAt(i, m4);
    roofColor.set(b.roof);
    roofs.setColorAt(i, roofColor);
  });
  walls.instanceMatrix.needsUpdate = true;
  roofs.instanceMatrix.needsUpdate = true;
  if (walls.instanceColor) walls.instanceColor.needsUpdate = true;
  if (roofs.instanceColor) roofs.instanceColor.needsUpdate = true;
  scene.add(walls);
  scene.add(roofs);

  // Smokestacks on industrial buildings.
  const stackBuildings = city.buildings.filter((b) => b.stack);
  if (stackBuildings.length > 0) {
    const stacks = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(4, 5.5, 42, 8),
      new THREE.MeshLambertMaterial({ color: '#8a8580' }),
      stackBuildings.length,
    );
    stackBuildings.forEach((b, i) => {
      m4.compose(new THREE.Vector3(b.x + b.w - 12, b.height + 21, b.y + 12), q, new THREE.Vector3(1, 1, 1));
      stacks.setMatrixAt(i, m4);
    });
    stacks.instanceMatrix.needsUpdate = true;
    scene.add(stacks);
  }

  // Neon signs on the Strip: glowing face plates + tall sign poles.
  const neonBuildings = city.buildings.filter((b) => b.neon);
  if (neonBuildings.length > 0) {
    const signs = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(34, 9),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
      neonBuildings.length,
    );
    const signColor = new THREE.Color();
    neonBuildings.forEach((b, i) => {
      m4.compose(new THREE.Vector3(b.x + b.w / 2, b.height * 0.62, b.y + b.d + 1.5), q, new THREE.Vector3(1, 1, 1));
      signs.setMatrixAt(i, m4);
      signColor.set(b.sign || '#ff2e88');
      signs.setColorAt(i, signColor);
    });
    signs.instanceMatrix.needsUpdate = true;
    if (signs.instanceColor) signs.instanceColor.needsUpdate = true;
    scene.add(signs);
  }

  // Palms: trunks + canopies, instanced.
  const palmCount = Math.max(1, city.palms.length);
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(2.2, 3.4, 26, 6), new THREE.MeshLambertMaterial({ color: '#7a5230' }), palmCount);
  const canopies = new THREE.InstancedMesh(new THREE.ConeGeometry(15, 20, 6), new THREE.MeshLambertMaterial({ color: '#2f8f4e' }), palmCount);
  city.palms.forEach((p, i) => {
    m4.compose(new THREE.Vector3(p.x, 13, p.y), q, new THREE.Vector3(1, 1, 1));
    trunks.setMatrixAt(i, m4);
    m4.compose(new THREE.Vector3(p.x, 32, p.y), q, new THREE.Vector3(1, 0.7, 1));
    canopies.setMatrixAt(i, m4);
  });
  trunks.instanceMatrix.needsUpdate = true;
  canopies.instanceMatrix.needsUpdate = true;
  scene.add(trunks);
  scene.add(canopies);

  // Street lamps: poles + warm glowing bulbs.
  const lampCount = Math.max(1, city.lamps.length);
  const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1.6, 34, 6), new THREE.MeshLambertMaterial({ color: '#2b2b2b' }), lampCount);
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(3.4, 8, 8), new THREE.MeshBasicMaterial({ color: '#ffd166' }), lampCount);
  city.lamps.forEach((p, i) => {
    m4.compose(new THREE.Vector3(p.x, 17, p.y), q, new THREE.Vector3(1, 1, 1));
    poles.setMatrixAt(i, m4);
    m4.compose(new THREE.Vector3(p.x, 35, p.y), q, new THREE.Vector3(1, 1, 1));
    bulbs.setMatrixAt(i, m4);
  });
  poles.instanceMatrix.needsUpdate = true;
  bulbs.instanceMatrix.needsUpdate = true;
  scene.add(poles);
  scene.add(bulbs);

  // The bridge: deck, rails and two towers.
  const deck = new THREE.Mesh(boxGeo(WORLD.channelX1 - WORLD.channelX0 + 40, 6, WORLD.bridgeY1 - WORLD.bridgeY0), lambert('#7a7d84'));
  deck.position.set((WORLD.channelX0 + WORLD.channelX1) / 2, 3, (WORLD.bridgeY0 + WORLD.bridgeY1) / 2);
  scene.add(deck);
  for (const z of [WORLD.bridgeY0 + 4, WORLD.bridgeY1 - 4]) {
    const rail = new THREE.Mesh(boxGeo(WORLD.channelX1 - WORLD.channelX0 + 40, 3, 3), lambert('#c9a227'));
    rail.position.set((WORLD.channelX0 + WORLD.channelX1) / 2, 8, z);
    scene.add(rail);
  }
  // Two pairs of towers flanking the deck — never on the roadway itself,
  // or they block the chase camera (and the road) mid-bridge.
  for (const x of [2670, 2830]) {
    for (const z of [WORLD.bridgeY0 - 14, WORLD.bridgeY1 + 14]) {
      const tower = new THREE.Mesh(boxGeo(14, 90, 16), lambert('#e8e0d0'));
      tower.position.set(x, 45, z);
      scene.add(tower);
    }
  }

  // The ferry at the marina dock + a cargo ship in the channel.
  function makeBoat(x, y, angle, len, color) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(boxGeo(len, 14, 34), lambert(color));
    hull.position.y = 7;
    boat.add(hull);
    const cabin = new THREE.Mesh(boxGeo(len * 0.4, 12, 26), lambert('#f7f3ea'));
    cabin.position.set(-len * 0.15, 20, 0);
    boat.add(cabin);
    boat.position.set(x, 0, y);
    boat.rotation.y = -angle;
    return boat;
  }
  scene.add(makeBoat(city.ferry.x, city.ferry.y, city.ferry.angle, 120, '#2e5fa3'));
  scene.add(makeBoat(city.ship.x, city.ship.y, city.ship.angle, 170, '#8a2f2f'));

  // Mission marker: gold beam + floating diamond.
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(7, 7, 150, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd60a, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 75;
  scene.add(beam);
  const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(13), basic('#ffd60a'));
  diamond.position.y = 130;
  scene.add(diamond);

  // Hidden packages: spinning gold octahedrons.
  const packageMeshes = city.packages.map((pkg) => {
    const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(9), basic('#ffd60a'));
    mesh.position.set(pkg.x, 14, pkg.y);
    scene.add(mesh);
    return mesh;
  });

  // Particles: one Points cloud, soft radial sprites.
  const MAX_PARTICLES = 600;
  const particleGeo = new THREE.BufferGeometry();
  const particlePos = new Float32Array(MAX_PARTICLES * 3);
  const particleCol = new Float32Array(MAX_PARTICLES * 3);
  particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));
  particleGeo.setAttribute('color', new THREE.BufferAttribute(particleCol, 3));
  const particleMat = new THREE.PointsMaterial({
    size: 11,
    map: new THREE.CanvasTexture(makeGlowTexture()),
    transparent: true,
    depthWrite: false,
    vertexColors: true,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(particleGeo, particleMat);
  points.frustumCulled = false;
  scene.add(points);

  const camera = new THREE.PerspectiveCamera(62, 1, 1, 6000);
  const carMeshes = new Map();
  const pedMeshes = new Map();
  const copFlash = new Map();
  let playerMesh = null;
  let gangMeshes = new Map();
  let shotPreset = null;
  const camPos = new THREE.Vector3(1100, 300, 1400);
  const camTarget = new THREE.Vector3(1100, 0, 900);

  function syncCar(car) {
    let mesh = carMeshes.get(car);
    if (!mesh) {
      mesh = makeCarMesh(car);
      carMeshes.set(car, mesh);
      scene.add(mesh);
      if (car.isCop && mesh.userData.flash) copFlash.set(car, mesh.userData.flash);
    }
    mesh.position.set(car.x, 0, car.y);
    mesh.rotation.y = -car.angle;
    return mesh;
  }

  function syncPed(ped, key, color) {
    let mesh = pedMeshes.get(key);
    if (!mesh) {
      mesh = makePedMesh(color);
      pedMeshes.set(key, mesh);
      scene.add(mesh);
    }
    mesh.position.set(ped.x, 0, ped.y);
    mesh.rotation.y = -ped.angle;
    return mesh;
  }

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  return {
    scene,
    camera,
    renderer,
    setShotPreset(name) {
      shotPreset = name;
    },
    render(S, dt) {
      updateParticles(dt);
      const p = S.player;

      // Cars: the player's car, traffic, parked cars and cops.
      const seenCars = new Set();
      for (const car of [...S.cars, ...S.cops]) {
        syncCar(car);
        seenCars.add(car);
      }
      for (const [car, mesh] of [...carMeshes]) {
        if (!seenCars.has(car)) {
          scene.remove(mesh);
          carMeshes.delete(car);
          copFlash.delete(car);
        }
      }
      // Cop light bars flash with the clock.
      const flashOn = Math.floor(S.time * 3) % 2 === 0;
      for (const { red, blue } of copFlash.values()) {
        red.visible = flashOn;
        blue.visible = !flashOn;
      }

      // Pedestrians + gang + the player on foot.
      const seenPeds = new Set();
      S.peds.forEach((ped, i) => {
        syncPed(ped, `ped${i}`, ped.color);
        seenPeds.add(`ped${i}`);
      });
      const seenGang = new Set();
      S.gang.forEach((g, i) => {
        if (g.hp <= 0) return;
        syncPed(g, `gang${i}`, '#7a1f1f');
        seenGang.add(`gang${i}`);
      });
      for (const [key, mesh] of [...pedMeshes]) {
        if (!seenPeds.has(key) && !seenGang.has(key) && key !== 'player') {
          scene.remove(mesh);
          pedMeshes.delete(key);
        }
      }
      if (p.onFoot) {
        if (!playerMesh) {
          playerMesh = makePedMesh('#2456c8');
          pedMeshes.set('player', playerMesh);
          scene.add(playerMesh);
        }
        playerMesh.position.set(p.x, 0, p.y);
        playerMesh.rotation.y = -p.angle;
        playerMesh.visible = true;
      } else if (playerMesh) {
        playerMesh.visible = false;
      }

      // Packages spin until collected.
      S.packages.forEach((pkg, i) => {
        const mesh = packageMeshes[i];
        if (!mesh) return;
        mesh.visible = !pkg.found;
        mesh.rotation.y += dt * 2;
        mesh.position.y = 14 + Math.sin(S.time * 2 + i) * 4;
      });

      // Mission marker over the current objective.
      let marker = null;
      if (S.mission.active) {
        const def = MISSIONS[S.mission.index];
        const stage = def ? def.stages[S.mission.stage] : null;
        if (stage) {
          if (stage.type === 'steal' && S.mission.data.targetCar) {
            marker = { x: S.mission.data.targetCar.x, y: S.mission.data.targetCar.y };
          } else if (stage.target && S.city.places[stage.target]) {
            marker = S.city.places[stage.target];
          }
        }
      }
      if (marker) {
        beam.visible = true;
        diamond.visible = true;
        beam.position.set(marker.x, 75, marker.y);
        diamond.position.set(marker.x, 130 + Math.sin(S.time * 2.4) * 8, marker.y);
        diamond.rotation.y += dt * 1.6;
      } else {
        beam.visible = false;
        diamond.visible = false;
      }

      // Particles.
      const posAttr = particleGeo.getAttribute('position');
      const colAttr = particleGeo.getAttribute('color');
      const tmpColor = new THREE.Color();
      for (let i = 0; i < MAX_PARTICLES; i++) {
        const pt = particles[i];
        if (pt) {
          posAttr.setXYZ(i, pt.x, pt.z, pt.y);
          tmpColor.set(pt.color);
          const fade = 1 - pt.age / pt.life;
          colAttr.setXYZ(i, tmpColor.r * fade, tmpColor.g * fade, tmpColor.b * fade);
        } else {
          posAttr.setXYZ(i, 0, -100, 0);
          colAttr.setXYZ(i, 0, 0, 0);
        }
      }
      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;

      // Camera: chase cam, or a fixed cinematic preset for screenshots.
      const fx = Math.cos(p.angle);
      const fy = Math.sin(p.angle);
      if (shotPreset === 'start') {
        camPos.set(1380, 260, 1420);
        camTarget.set(1080, 20, 900);
      } else if (shotPreset === 'drive') {
        camPos.set(p.x - fx * 150, 62, p.y - fy * 150);
        camTarget.set(p.x + fx * 90, 14, p.y + fy * 90);
      } else if (shotPreset === 'chase') {
        camPos.set(p.x - fx * 190, 78, p.y - fy * 190);
        camTarget.set(p.x + fx * 120, 12, p.y + fy * 120);
      } else if (shotPreset === 'mission') {
        camPos.set(p.x - fx * 130, 110, p.y - fy * 130 + 60);
        camTarget.set(p.x + fx * 60, 16, p.y + fy * 60);
      } else if (p.onFoot) {
        const tx = p.x - fx * 74;
        const ty = p.y - fy * 74;
        camPos.x = lerp(camPos.x, tx, 1 - Math.pow(0.001, dt));
        camPos.y = lerp(camPos.y, 46, 1 - Math.pow(0.001, dt));
        camPos.z = lerp(camPos.z, ty, 1 - Math.pow(0.001, dt));
        camTarget.set(p.x + fx * 50, 14, p.y + fy * 50);
      } else {
        const tx = p.x - fx * 148;
        const ty = p.y - fy * 148;
        camPos.x = lerp(camPos.x, tx, 1 - Math.pow(0.0005, dt));
        camPos.y = lerp(camPos.y, 58, 1 - Math.pow(0.0005, dt));
        camPos.z = lerp(camPos.z, ty, 1 - Math.pow(0.0005, dt));
        camTarget.set(p.x + fx * 110, 12, p.y + fy * 110);
      }
      camera.position.copy(camPos);
      camera.lookAt(camTarget);
      renderer.render(scene, camera);
    },
  };
}
