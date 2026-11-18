// The 3D view: three.js (vendored UMD, global THREE) draws the sim state.
// Sim coordinates are top-down (x right, y down); the 3D world maps them to
// (x, height, -y). Dusk lighting, soft shadows, a chase camera that pulls
// in when a building blocks the view.

import { CONFIG } from './config.js';
import { createEffects } from './effects.js';
import { districtAt } from './city.js';
import { MISSIONS, stagePlace } from './missions.js';
import { clamp, lerp } from './util.js';

const WALL_COLORS = ['#d9cfc0', '#c9b8a3', '#b8c4c9', '#e5d8c8', '#a8b8a0'];
const ROAD_COLOR = 0x2f2f38;
const WATER_COLOR = 0x1d4e6b;

function matCache() {
  const cache = new Map();
  return (color, opts = {}) => {
    const key = `${color}|${opts.emissive ?? ''}|${opts.transparent ?? ''}`;
    if (!cache.has(key)) {
      cache.set(key, new THREE.MeshLambertMaterial({
        color,
        emissive: opts.emissive ?? 0x000000,
        transparent: opts.transparent ?? false,
        opacity: opts.opacity ?? 1,
      }));
    }
    return cache.get(key);
  };
}

/** Create the renderer for a container element. Returns { update, resize }. */
export function createRenderer(container, city) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth || 1280, container.clientHeight || 800);
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2b2140);
  scene.fog = new THREE.Fog(0x2b2140, 900, 2600);

  const camera = new THREE.PerspectiveCamera(60, 1280 / 800, 1, 6000);
  camera.position.set(1100, 300, -700);

  // Dusk: a low warm sun and a purple sky fill.
  const hemi = new THREE.HemisphereLight(0x8a7bd8, 0x2e2a33, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffb36b, 1.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -500;
  sun.shadow.camera.right = 500;
  sun.shadow.camera.top = 500;
  sun.shadow.camera.bottom = -500;
  sun.shadow.camera.far = 2200;
  scene.add(sun);
  scene.add(sun.target);

  const materialFor = matCache();

  // --- ground, sea, bridge -----------------------------------------------
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(7000, 4500),
    new THREE.MeshLambertMaterial({ color: WATER_COLOR, transparent: true, opacity: 0.92 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(1700, -3, -1000);
  scene.add(water);

  const groundMat = materialFor('#5d7050');
  const ground = new THREE.Mesh(new THREE.BoxGeometry(2600, 20, 2000), groundMat);
  ground.position.set(1300, -10, -1000);
  ground.receiveShadow = true;
  scene.add(ground);
  const islaGround = new THREE.Mesh(new THREE.BoxGeometry(660, 20, 800), materialFor('#6b7f5c'));
  islaGround.position.set(3050, -10, -1100);
  islaGround.receiveShadow = true;
  scene.add(islaGround);
  const bridgeDeck = new THREE.Mesh(
    new THREE.BoxGeometry(140, 10, 220),
    materialFor('#3a3a44'),
  );
  bridgeDeck.position.set(2660, -2, -1040);
  bridgeDeck.receiveShadow = true;
  scene.add(bridgeDeck);
  for (const dz of [-110, 110]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(140, 8, 4), materialFor('#c1121f'));
    rail.position.set(2660, 8, -1040 + dz);
    scene.add(rail);
  }

  // --- roads ---------------------------------------------------------------
  const roadGroup = new THREE.Group();
  for (const r of city.roads) {
    const horizontal = r.y0 === r.y1;
    const len = horizontal ? r.x1 - r.x0 : r.y1 - r.y0;
    const w = horizontal ? len : 46;
    const d = horizontal ? 46 : len;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), materialFor(ROAD_COLOR));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set((r.x0 + r.x1) / 2, 0.4, -(r.y0 + r.y1) / 2);
    mesh.receiveShadow = true;
    roadGroup.add(mesh);
  }
  // Centre dashes on the main east-west roads.
  const dashMat = materialFor('#e8e8e8');
  for (const r of city.roads.slice(0, 6)) {
    const len = r.x1 - r.x0;
    for (let x = r.x0 + 30; x < r.x1 - 10; x += 70) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(26, 3), dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(x, 0.6, -r.y0);
      roadGroup.add(dash);
    }
    void len;
  }
  scene.add(roadGroup);

  // --- buildings -----------------------------------------------------------
  const buildingMeshes = [];
  const wallMats = WALL_COLORS.map((c) => materialFor(c));
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  for (const b of city.buildings) {
    const g = new THREE.Group();
    const walls = new THREE.Mesh(boxGeo, wallMats[Math.abs(Math.floor(b.x + b.y)) % wallMats.length]);
    walls.scale.set(b.w, b.height, b.d);
    walls.position.y = b.height / 2;
    walls.castShadow = true;
    walls.receiveShadow = true;
    g.add(walls);
    const roof = new THREE.Mesh(boxGeo, materialFor(b.roof));
    roof.scale.set(b.w + 3, 2, b.d + 3);
    roof.position.y = b.height + 1;
    g.add(roof);
    // Downtown towers get a lit rooftop beacon so the skyline reads at dusk.
    if (b.district === 'downtown' && b.floors >= 10) {
      const beacon = new THREE.Mesh(
        new THREE.BoxGeometry(4, 6, 4),
        materialFor('#ffd166', { emissive: 0xff9f1c }),
      );
      beacon.position.y = b.height + 5;
      g.add(beacon);
    }
    if (b.stack) {
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(4, 5, b.height * 0.9, 8), materialFor('#5f6a6a'));
      stack.position.set(b.w / 2 + 8, b.height * 0.45, 0);
      stack.castShadow = true;
      g.add(stack);
    }
    g.position.set(b.x, 0, -b.y);
    scene.add(g);
    buildingMeshes.push(walls);
  }

  // --- palms ---------------------------------------------------------------
  const trunkGeo = new THREE.CylinderGeometry(2.5, 4, 26, 6);
  const frondGeo = new THREE.ConeGeometry(16, 14, 6);
  const trunkMat = materialFor('#7a5a3a');
  const frondMat = materialFor('#2a9d5c');
  for (const p of city.palms) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 13;
    trunk.castShadow = true;
    g.add(trunk);
    const frond = new THREE.Mesh(frondGeo, frondMat);
    frond.position.y = 32;
    frond.castShadow = true;
    g.add(frond);
    g.position.set(p.x, 0, -p.y);
    scene.add(g);
  }

  // --- ferry + docks -------------------------------------------------------
  const ferryGroup = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(120, 16, 34), materialFor('#f7ede2'));
  hull.position.y = 4;
  hull.castShadow = true;
  ferryGroup.add(hull);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(70, 14, 26), materialFor('#457b9d'));
  cabin.position.y = 18;
  ferryGroup.add(cabin);
  const funnel = new THREE.Mesh(new THREE.CylinderGeometry(4, 5, 18, 8), materialFor('#e63946'));
  funnel.position.set(-20, 26, 0);
  ferryGroup.add(funnel);
  ferryGroup.position.set(city.ferry.x, 0, -city.ferry.y);
  ferryGroup.rotation.y = city.ferry.angle;
  scene.add(ferryGroup);
  const dockMat = materialFor('#8a6b48');
  for (let i = 0; i < 5; i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(10, 3, 60), dockMat);
    plank.position.set(2190 + i * 14, 1, -1900);
    scene.add(plank);
  }

  // --- mission beam --------------------------------------------------------
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(14, 14, 420, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.visible = false;
  scene.add(beam);
  const marker = new THREE.Mesh(
    new THREE.OctahedronGeometry(12),
    new THREE.MeshBasicMaterial({ color: 0xffd166 }),
  );
  marker.visible = false;
  scene.add(marker);

  // --- dynamic actors ------------------------------------------------------
  const carGeoBody = new THREE.BoxGeometry(34, 10, 18);
  const carGeoCabin = new THREE.BoxGeometry(18, 8, 16);
  const wheelGeo = new THREE.BoxGeometry(8, 8, 4);
  const wheelMat = materialFor('#111111');
  const glassMat = materialFor('#1b263b');
  const carMeshes = new Map();

  function carMesh(car) {
    let m = carMeshes.get(car.id);
    if (m) return m;
    const g = new THREE.Group();
    const body = new THREE.Mesh(carGeoBody, materialFor(car.color));
    body.position.y = 7;
    body.castShadow = true;
    g.add(body);
    const cabin = new THREE.Mesh(carGeoCabin, glassMat);
    cabin.position.set(-2, 15, 0);
    cabin.castShadow = true;
    g.add(cabin);
    for (const [wx, wz] of [[-11, -9], [11, -9], [-11, 9], [11, 9]]) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.set(wx, 4, wz);
      g.add(wheel);
    }
    if (car.owner === 'cop') {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(10, 3, 12), materialFor('#e63946', { emissive: 0xaa0000 }));
      bar.position.set(-2, 21, 0);
      bar.name = 'lightbar';
      g.add(bar);
    }
    scene.add(g);
    carMeshes.set(car.id, g);
    return g;
  }

  const personGeoBody = new THREE.CylinderGeometry(7, 9, 22, 8);
  const personGeoHead = new THREE.SphereGeometry(6, 8, 8);
  const playerGroup = new THREE.Group();
  const playerBody = new THREE.Mesh(personGeoBody, materialFor('#e63946'));
  playerBody.position.y = 11;
  playerBody.castShadow = true;
  playerGroup.add(playerBody);
  const playerHead = new THREE.Mesh(personGeoHead, materialFor('#f2c9a0'));
  playerHead.position.y = 27;
  playerHead.castShadow = true;
  playerGroup.add(playerHead);
  scene.add(playerGroup);

  const pedMeshes = new Map();
  function pedMesh(i, color) {
    let m = pedMeshes.get(i);
    if (m) return m;
    const g = new THREE.Group();
    const body = new THREE.Mesh(personGeoBody, materialFor(color));
    body.position.y = 11;
    body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(personGeoHead, materialFor('#e8b98a'));
    head.position.y = 27;
    g.add(head);
    scene.add(g);
    pedMeshes.set(i, g);
    return g;
  }

  const gangMeshes = new Map();
  const effects = createEffects(scene);

  const raycaster = new THREE.Raycaster();
  const camTarget = new THREE.Vector3(1100, 0, -1000);
  const camPos = new THREE.Vector3(1100, 300, -700);
  const desired = new THREE.Vector3();
  const lookAt = new THREE.Vector3();
  const rayDir = new THREE.Vector3();

  function syncCars(S) {
    const seen = new Set();
    for (const car of S.cars) {
      seen.add(car.id);
      const m = carMesh(car);
      m.position.set(car.x, 0, -car.y);
      m.rotation.y = -car.angle;
      const bar = m.getObjectByName('lightbar');
      if (bar) bar.visible = Math.floor(S.time * 4) % 2 === 0;
    }
    for (const [id, m] of [...carMeshes]) {
      if (!seen.has(id)) {
        scene.remove(m);
        carMeshes.delete(id);
      }
    }
  }

  return {
    /** The canvas element (for input listeners). */
    domElement: renderer.domElement,
    /** Advance the view one frame from the sim state. */
    update(S, dt) {
      const p = S.player;
      syncCars(S);

      // Pedestrians.
      S.peds.forEach((ped, i) => {
        const m = pedMesh(i, ped.color);
        m.position.set(ped.x, 0, -ped.y);
        m.rotation.y = -ped.angle;
      });

      // Gang members (red).
      const gang = S.mission.active && S.mission.data.gang ? S.mission.data.gang : [];
      gang.forEach((g, i) => {
        let m = gangMeshes.get(i);
        if (!m) {
          m = new THREE.Group();
          const body = new THREE.Mesh(personGeoBody, materialFor('#8d0801'));
          body.position.y = 11;
          body.castShadow = true;
          m.add(body);
          const head = new THREE.Mesh(personGeoHead, materialFor('#e8b98a'));
          head.position.y = 27;
          m.add(head);
          scene.add(m);
          gangMeshes.set(i, m);
        }
        m.visible = g.hp > 0;
        m.position.set(g.x, 0, -g.y);
        m.rotation.y = -g.angle;
      });
      for (const [i, m] of [...gangMeshes]) {
        if (i >= gang.length) {
          scene.remove(m);
          gangMeshes.delete(i);
        }
      }

      // Player on foot (hidden while driving).
      playerGroup.visible = p.onFoot;
      if (p.onFoot) {
        playerGroup.position.set(p.x, 0, -p.y);
        playerGroup.rotation.y = -p.aimAngle;
      }

      // Mission beam + marker over the current objective.
      if (S.mission.active) {
        const def = MISSIONS[S.mission.index];
        const stage = def.stages[S.mission.stage];
        const place = stagePlace(S, stage);
        if (place) {
          beam.visible = true;
          marker.visible = true;
          beam.position.set(place.x, 210, -place.y);
          marker.position.set(place.x, 60 + Math.sin(S.time * 3) * 8, -place.y);
          marker.rotation.y = S.time * 2;
        } else {
          beam.visible = false;
          marker.visible = false;
        }
      } else {
        beam.visible = false;
        marker.visible = false;
      }

      // Sun follows the player so shadows stay local.
      sun.position.set(p.x + 400, 500, -p.y + 300);
      sun.target.position.set(p.x, 0, -p.y);
      sun.target.updateMatrixWorld();

      // Chase camera: behind the player/car, pulled in past buildings.
      const cam = CONFIG.camera;
      const fx = Math.cos(p.angle);
      const fy = Math.sin(p.angle);
      const dist = p.car ? cam.distance + 60 : cam.distance;
      desired.set(
        p.x - fx * dist,
        cam.height,
        -(p.y - fy * dist),
      );
      camTarget.set(p.x + fx * cam.lookAhead, 10, -(p.y + fy * cam.lookAhead));
      rayDir.copy(desired).sub(camTarget).normalize();
      raycaster.set(camTarget, rayDir);
      raycaster.far = dist + 40;
      const hits = raycaster.intersectObjects(buildingMeshes, false);
      let pull = 1;
      if (hits.length > 0) pull = clamp((hits[0].distance - 30) / dist, 0.25, 1);
      desired.lerp(camTarget, 1 - pull);
      const k = Math.min(1, cam.smooth * dt);
      camPos.lerp(desired, k);
      camera.position.copy(camPos);
      lookAt.lerp(camTarget, Math.min(1, 8 * dt));
      camera.lookAt(lookAt);

      effects.update(S);
      renderer.render(scene, camera);
    },
    resize(w, h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    },
  };
}
