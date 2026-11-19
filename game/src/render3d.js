// VERDE BAY 3D v7 — the THREE.js renderer: golden-hour island city, traffic,
// police, helicopter, roadblocks, packages and the chase camera.
// Reads the sim state S every frame; the sim never imports this file.

import { COLORS } from './config.js';

const OX = 1700; // sim x -> world x
const OZ = 1100; // sim y -> world z

function wX(x) {
  return x - OX;
}
function wZ(y) {
  return y - OZ;
}

export function createRenderer(canvas, S) {
  const T = globalThis.THREE;
  const renderer = new T.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new T.Scene();
  scene.background = new T.Color(COLORS.sky);
  scene.fog = new T.Fog(new T.Color(COLORS.sky), 700, 2800);

  const hemi = new T.HemisphereLight(0xffe0b3, 0x3a5f4a, 0.95);
  scene.add(hemi);
  const sun = new T.DirectionalLight(0xffdfb0, 1.7);
  sun.position.set(900, 1100, -500);
  scene.add(sun);
  const fill = new T.DirectionalLight(0x9db8ff, 0.35);
  fill.position.set(-600, 400, 800);
  scene.add(fill);

  const boxGeo = new T.BoxGeometry(1, 1, 1);
  const cylGeo = new T.CylinderGeometry(1, 1, 1, 8);
  const coneGeo = new T.ConeGeometry(1, 1, 8);
  const sphereGeo = new T.SphereGeometry(1, 10, 8);
  const planeGeo = new T.PlaneGeometry(1, 1);

  const lambertCache = new Map();
  function lambert(color) {
    if (!lambertCache.has(color)) lambertCache.set(color, new T.MeshLambertMaterial({ color }));
    return lambertCache.get(color);
  }
  const basicCache = new Map();
  function basic(color) {
    if (!basicCache.has(color)) basicCache.set(color, new T.MeshBasicMaterial({ color }));
    return basicCache.get(color);
  }

  function addBox(x, y, z, sx, sy, sz, mat, parent) {
    const m = new T.Mesh(boxGeo, mat);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    (parent || scene).add(m);
    return m;
  }

  // --- static city ------------------------------------------------------------
  // Water everywhere below, land as two slabs (mainland + Isla Verde).
  const water = new T.Mesh(planeGeo, lambert(COLORS.sea));
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -0.6, 0);
  water.scale.set(4200, 3000, 1);
  scene.add(water);

  const mainland = new T.Mesh(planeGeo, lambert(COLORS.grass));
  mainland.rotation.x = -Math.PI / 2;
  mainland.position.set(wX(1310), 0, wZ(1100));
  mainland.scale.set(2620, 2200, 1);
  scene.add(mainland);

  const isla = new T.Mesh(planeGeo, lambert('#8fae6d'));
  isla.rotation.x = -Math.PI / 2;
  isla.position.set(wX(3130), 0, wZ(1100));
  isla.scale.set(460, 2200, 1);
  scene.add(isla);

  // Beach sand along the south shore.
  const sand = new T.Mesh(planeGeo, lambert(COLORS.sand));
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(wX(1300), 0.3, wZ(1740));
  sand.scale.set(1800, 640, 1);
  scene.add(sand);

  // Roads: dark strips with pale dashes.
  for (const r of S.city.roads) {
    const len = Math.hypot(r.x2 - r.x1, r.y2 - r.y1);
    const horizontal = r.y1 === r.y2;
    const road = new T.Mesh(planeGeo, lambert(COLORS.asphalt));
    road.rotation.x = -Math.PI / 2;
    road.position.set(wX((r.x1 + r.x2) / 2), 0.5, wZ((r.y1 + r.y2) / 2));
    road.scale.set(horizontal ? len : 36, horizontal ? 36 : len, 1);
    scene.add(road);
    // Center dashes.
    const n = Math.floor(len / 70);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const dx = r.x1 + (r.x2 - r.x1) * t;
      const dy = r.y1 + (r.y2 - r.y1) * t;
      const dash = new T.Mesh(planeGeo, basic('#e8e8e8'));
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(wX(dx), 0.6, wZ(dy));
      dash.scale.set(horizontal ? 26 : 3, horizontal ? 3 : 26, 1);
      scene.add(dash);
    }
  }

  // The bridge over the channel.
  const bridge = new T.Mesh(planeGeo, lambert('#6b6f76'));
  bridge.rotation.x = -Math.PI / 2;
  bridge.position.set(wX(2760), 1.2, wZ(1100));
  bridge.scale.set(300, 44, 1);
  scene.add(bridge);

  // Buildings.
  for (const b of S.city.buildings) {
    const wall = new T.Color(b.color).multiplyScalar(0.72);
    const body = addBox(wX(b.x), b.height / 2, wZ(b.y), b.w, b.height, b.d, lambert('#' + wall.getHexString()));
    body.userData.building = b;
    addBox(wX(b.x), b.height + 0.8, wZ(b.y), b.w + 2, 1.6, b.d + 2, lambert(b.roof));
    if (b.neon) {
      const neonColor = ['#00e5ff', '#ff2ea6', '#ffe600'][Math.floor(Math.random() * 3)];
      const strip = addBox(wX(b.x), b.height * 0.72, wZ(b.y - b.d / 2 - 0.6), b.w * 0.7, 2.2, 1, basic(neonColor));
      strip.userData.neon = true;
    }
    if (b.stack) {
      const stack = new T.Mesh(cylGeo, lambert('#8a8f96'));
      stack.position.set(wX(b.x + b.w / 4), b.height + 13, wZ(b.y));
      stack.scale.set(3.5, 26, 3.5);
      scene.add(stack);
    }
  }

  // Palms.
  for (const palm of S.city.palms) {
    const trunk = new T.Mesh(cylGeo, lambert('#8a6b48'));
    trunk.position.set(wX(palm.x), palm.h / 2, wZ(palm.y));
    trunk.scale.set(1.4, palm.h, 1.4);
    scene.add(trunk);
    const top = new T.Mesh(sphereGeo, lambert('#2f7d32'));
    top.position.set(wX(palm.x), palm.h + 3, wZ(palm.y));
    top.scale.set(7, 3.5, 7);
    scene.add(top);
  }

  // --- dynamic objects ----------------------------------------------------------
  const carGroups = new Map();
  const pedMeshes = [];
  const packageMeshes = [];
  const gangMeshes = new Map();
  let roadblockGroup = null;
  let heliGroup = null;
  let heliRotor = null;
  let playerGroup = null;

  function buildCarMesh(car) {
    const g = new T.Group();
    const isTruck = car.type === 'truck';
    const isCop = car.type === 'cop';
    const bodyLen = isTruck ? 7 : 4.8;
    const bodyH = isTruck ? 2.2 : 1.1;
    const body = new T.Mesh(boxGeo, lambert(car.color));
    body.scale.set(bodyLen, bodyH, 2.1);
    body.position.y = 0.85;
    g.add(body);
    const cabin = new T.Mesh(boxGeo, lambert(isCop ? '#dfe8ee' : '#1c2733'));
    cabin.scale.set(isTruck ? 2.2 : 2.4, 0.9, 1.8);
    cabin.position.set(isTruck ? 1.4 : -0.3, bodyH + 0.45, 0);
    g.add(cabin);
    const skirt = new T.Mesh(boxGeo, lambert('#151515'));
    skirt.scale.set(bodyLen * 0.94, 0.5, 2.15);
    skirt.position.y = 0.35;
    g.add(skirt);
    if (isCop) {
      const bar = new T.Mesh(boxGeo, basic('#ff2e4d'));
      bar.scale.set(1.2, 0.35, 0.6);
      bar.position.set(-0.3, bodyH + 1.05, 0);
      g.add(bar);
      g.userData.lightBar = bar;
      const bar2 = new T.Mesh(boxGeo, basic('#2e7dff'));
      bar2.scale.set(1.2, 0.35, 0.6);
      bar2.position.set(-0.3, bodyH + 1.05, 0);
      bar2.visible = false;
      g.add(bar2);
      g.userData.lightBar2 = bar2;
    }
    if (car.type === 'taxi') {
      const sign = new T.Mesh(boxGeo, basic('#f4b400'));
      sign.scale.set(1.1, 0.4, 0.7);
      sign.position.set(-0.3, bodyH + 1.05, 0);
      g.add(sign);
    }
    return g;
  }

  function buildPersonMesh(color) {
    const g = new T.Group();
    const body = new T.Mesh(boxGeo, lambert(color));
    body.scale.set(1.1, 2.2, 0.7);
    body.position.y = 1.5;
    g.add(body);
    const head = new T.Mesh(sphereGeo, lambert('#e8b98a'));
    head.scale.set(0.55, 0.55, 0.55);
    head.position.y = 2.9;
    g.add(head);
    return g;
  }

  for (const ped of S.peds) {
    const m = buildPersonMesh(ped.color);
    scene.add(m);
    pedMeshes.push(m);
  }

  for (const pkg of S.packages) {
    const m = new T.Mesh(boxGeo, basic('#2ec4b6'));
    m.scale.set(2.2, 2.2, 2.2);
    m.position.set(wX(pkg.x), 2.2, wZ(pkg.y));
    scene.add(m);
    packageMeshes.push(m);
  }

  playerGroup = buildPersonMesh('#2e5fa3');
  scene.add(playerGroup);

  heliGroup = new T.Group();
  {
    const body = new T.Mesh(boxGeo, lambert('#212529'));
    body.scale.set(7, 2.4, 3);
    body.position.y = 0;
    heliGroup.add(body);
    const tail = new T.Mesh(boxGeo, lambert('#212529'));
    tail.scale.set(5, 1, 1.2);
    tail.position.set(-5.5, 0.4, 0);
    heliGroup.add(tail);
    heliRotor = new T.Mesh(boxGeo, lambert('#151515'));
    heliRotor.scale.set(11, 0.25, 0.8);
    heliRotor.position.y = 1.6;
    heliGroup.add(heliRotor);
    const light = new T.Mesh(sphereGeo, basic('#ff2e4d'));
    light.scale.set(0.9, 0.9, 0.9);
    light.position.set(2, -1.4, 0);
    heliGroup.add(light);
    heliGroup.visible = false;
    scene.add(heliGroup);
  }

  const camera = new T.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 5000);
  const camState = { x: 0, y: 600, z: 900, orbit: 0 };
  let mode = 'menu';

  const R = {
    scene,
    snapToPlayer(S2) {
      const p = S2.player;
      const fx = Math.cos(p.angle);
      const fz = Math.sin(p.angle);
      const dist = p.car ? 15 : 12;
      camState.x = wX(p.x) - fx * dist;
      camState.y = p.car ? 8 : 7;
      camState.z = wZ(p.y) - fz * dist;
    },
    setMode(m) {
      mode = m;
    },
    resize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    },
    screenToGround(clientX, clientY) {
      const v = new T.Vector2((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
      const rc = new T.Raycaster();
      rc.setFromCamera(v, camera);
      const plane = new T.Plane(new T.Vector3(0, 1, 0), 0);
      const hit = new T.Vector3();
      if (rc.ray.intersectPlane(plane, hit)) return { x: hit.x + OX, y: hit.z + OZ };
      return null;
    },
    render(S2, dt) {
      const p = S2.player;
      // Cars.
      const liveIds = new Set();
      for (const car of S2.cars) {
        liveIds.add(car.id);
        let g = carGroups.get(car.id);
        if (!g) {
          g = buildCarMesh(car);
          carGroups.set(car.id, g);
          scene.add(g);
        }
        g.position.set(wX(car.x), 0, wZ(car.y));
        g.rotation.y = -car.angle;
        if (g.userData.lightBar) {
          const flash = Math.floor(S2.time * 4) % 2 === 0;
          g.userData.lightBar.visible = flash;
          g.userData.lightBar2.visible = !flash;
        }
      }
      for (const [id, g] of carGroups) {
        if (!liveIds.has(id)) {
          scene.remove(g);
          carGroups.delete(id);
        }
      }
      // Pedestrians.
      for (let i = 0; i < S2.peds.length; i++) {
        const ped = S2.peds[i];
        const m = pedMeshes[i];
        if (!m) continue;
        m.visible = ped.state !== 'down';
        m.position.set(wX(ped.x), ped.state === 'down' ? 0.4 : 0, wZ(ped.y));
        m.rotation.y = -ped.angle;
      }
      // Packages.
      for (let i = 0; i < S2.packages.length; i++) {
        const pkg = S2.packages[i];
        const m = packageMeshes[i];
        if (!m) continue;
        m.visible = !pkg.taken;
        if (!pkg.taken) {
          m.position.y = 2.2 + Math.sin(S2.time * 3 + i) * 0.5;
          m.rotation.y = S2.time * 1.5 + i;
        }
      }
      // Gang members.
      const gang = (S2.mission.data && S2.mission.data.gang) || [];
      const liveGang = new Set();
      gang.forEach((g, i) => {
        liveGang.add(i);
        let m = gangMeshes.get(i);
        if (!m) {
          m = buildPersonMesh('#c1121f');
          gangMeshes.set(i, m);
          scene.add(m);
        }
        m.visible = g.hp > 0;
        m.position.set(wX(g.x), 0, wZ(g.y));
        m.rotation.y = -g.angle;
      });
      for (const [i, m] of gangMeshes) {
        if (!liveGang.has(i)) {
          scene.remove(m);
          gangMeshes.delete(i);
        }
      }
      // Roadblocks.
      if (roadblockGroup) {
        scene.remove(roadblockGroup);
        roadblockGroup = null;
      }
      if (S2.roadblocks.length > 0) {
        roadblockGroup = new T.Group();
        for (const rb of S2.roadblocks) {
          for (const off of [-14, 14]) {
            const c = buildCarMesh({ type: 'cop', color: '#212529' });
            const a = rb.angle;
            c.position.set(wX(rb.x + Math.cos(a) * off), 0, wZ(rb.y + Math.sin(a) * off));
            c.rotation.y = -a;
            roadblockGroup.add(c);
          }
          const barrier = new T.Mesh(boxGeo, basic('#ff9f1c'));
          barrier.scale.set(30, 1.6, 1.2);
          barrier.position.set(wX(rb.x), 1.2, wZ(rb.y));
          barrier.rotation.y = -rb.angle;
          roadblockGroup.add(barrier);
        }
        scene.add(roadblockGroup);
      }
      // Helicopter.
      if (S2.heli.active) {
        heliGroup.visible = true;
        heliGroup.position.set(wX(S2.heli.x), 120, wZ(S2.heli.y));
        heliGroup.rotation.y = -Math.atan2(Math.sin(S2.heli.angle), Math.cos(S2.heli.angle)) + Math.PI / 2;
        heliRotor.rotation.y = S2.heli.rotor;
      } else {
        heliGroup.visible = false;
      }
      // Player on foot.
      if (p.onFoot) {
        playerGroup.visible = true;
        playerGroup.position.set(wX(p.x), 0, wZ(p.y));
        playerGroup.rotation.y = -p.angle;
      } else {
        playerGroup.visible = false;
      }
      // Camera.
      if (mode === 'menu') {
        camState.orbit += dt * 0.045;
        const cx = Math.cos(camState.orbit) * 1050;
        const cz = Math.sin(camState.orbit) * 1050;
        camera.position.set(cx, 520, cz);
        camera.lookAt(wX(1150), 0, wZ(950));
      } else {
        const fx = Math.cos(p.angle);
        const fz = Math.sin(p.angle);
        const dist = p.car ? 15 : 12;
        const height = p.car ? 8 : 7;
        const tx = wX(p.x) - fx * dist;
        const tz = wZ(p.y) - fz * dist;
        const k = 1 - Math.pow(0.001, dt);
        camState.x += (tx - camState.x) * k;
        camState.y += (height - camState.y) * k;
        camState.z += (tz - camState.z) * k;
        camera.position.set(camState.x, camState.y, camState.z);
        camera.lookAt(wX(p.x) + fx * 24, 2, wZ(p.y) + fz * 24);
      }
      renderer.render(scene, camera);
    },
  };
  return R;
}
