// VERDE BAY v9 — the city itself: a sun-soaked island grid of blocks, roads,
// towers with lit windows, palms, streetlights, the garage, shops and the
// safehouse. Everything is procedural and deterministic (seed 1337), so the
// city is identical on every load and every machine.
import { WORLD, DISTRICTS } from './config.js';
import { mulberry32, randInt } from './util.js';

const THREE = window.THREE;

// Spots that must stay clear of buildings: mission markers, garage, shops.
const CLEAR_SPOTS = [
  [-40, 140], [-150, -150], [0, -60], [150, 60], [-120, 140], [120, -140],
  [20, -100], [-40, -100], [60, -20], [0, 60], [100, -120], [140, -160],
  [80, -90], [0, 10], [-90, 120], [90, 120], [-150, 60], [150, -60],
];
const CLEAR_R = 14;

function facadeTexture(base, lit) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  const rng = mulberry32(base.length * 7919 + lit * 131);
  for (let y = 8; y < 248; y += 16) {
    for (let x = 8; x < 120; x += 14) {
      const on = rng() < lit;
      g.fillStyle = on ? '#ffd98a' : '#1d2b3a';
      g.fillRect(x, y, 9, 11);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(scene) {
  const rng = mulberry32(1337);
  const group = new THREE.Group();
  group.name = 'city';
  scene.add(group);
  const colliders = [];
  const pitch = WORLD.blockSize + WORLD.roadWidth; // 60
  const half = (WORLD.blocks * pitch) / 2; // 210

  // Ground: island slab, then water around it.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.groundSize, WORLD.groundSize),
    new THREE.MeshLambertMaterial({ color: 0x9a8f7a }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(1400, 1400),
    new THREE.MeshLambertMaterial({ color: 0x2f7fb8 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = WORLD.waterLevel;
  group.add(water);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.groundSize + 26, WORLD.groundSize + 26),
    new THREE.MeshLambertMaterial({ color: 0xd9c28a }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.y = -0.15;
  group.add(sand);

  // Roads: dark strips along every grid line, plus centre dashes.
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x2e3138 });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8c95a });
  for (let k = -3; k <= 3; k++) {
    const c = k * pitch;
    const vRoad = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.roadWidth, WORLD.groundSize), roadMat);
    vRoad.rotation.x = -Math.PI / 2;
    vRoad.position.set(c, 0.02, 0);
    vRoad.receiveShadow = true;
    group.add(vRoad);
    const hRoad = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.groundSize, WORLD.roadWidth), roadMat);
    hRoad.rotation.x = -Math.PI / 2;
    hRoad.position.set(0, 0.02, c);
    hRoad.receiveShadow = true;
    group.add(hRoad);
    for (let d = -200; d <= 200; d += 16) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 4), dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(c, 0.04, d);
      group.add(dash);
    }
  }

  // Buildings: one tower per block, heights and colours vary by district.
  const facades = [
    facadeTexture('#8a7f74', 0.55),
    facadeTexture('#6f7d8c', 0.45),
    facadeTexture('#a08a6a', 0.6),
    facadeTexture('#7a6a8c', 0.4),
  ];
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x3a3f46 });
  const isClear = (x, z) => CLEAR_SPOTS.some(([cx, cz]) => Math.hypot(x - cx, z - cz) < CLEAR_R);
  for (let bi = -3; bi <= 2; bi++) {
    for (let bj = -3; bj <= 2; bj++) {
      const cx = bi * pitch + pitch / 2;
      const cz = bj * pitch + pitch / 2;
      if (isClear(cx, cz)) continue; // park / plaza instead of a tower
      const w = 20 + rng() * 14;
      const d = 20 + rng() * 14;
      const h = 10 + rng() * rng() * 34;
      const tex = facades[randInt(0, facades.length - 1)];
      const mat = new THREE.MeshLambertMaterial({ map: tex });
      const tower = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      tower.position.set(cx + (rng() - 0.5) * 4, h / 2, cz + (rng() - 0.5) * 4);
      tower.castShadow = true;
      tower.receiveShadow = true;
      group.add(tower);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, 1.2, d * 0.5), roofMat);
      roof.position.set(tower.position.x, h + 0.6, tower.position.z);
      group.add(roof);
      colliders.push({
        minX: tower.position.x - w / 2, maxX: tower.position.x + w / 2,
        minZ: tower.position.z - d / 2, maxZ: tower.position.z + d / 2,
      });
      // A few blocks get a second low building.
      if (rng() < 0.4) {
        const w2 = 12 + rng() * 8;
        const d2 = 12 + rng() * 8;
        const h2 = 5 + rng() * 6;
        const low = new THREE.Mesh(new THREE.BoxGeometry(w2, h2, d2), mat);
        low.position.set(cx + (rng() - 0.5) * 18, h2 / 2, cz + (rng() - 0.5) * 18);
        low.castShadow = true;
        group.add(low);
        colliders.push({
          minX: low.position.x - w2 / 2, maxX: low.position.x + w2 / 2,
          minZ: low.position.z - d2 / 2, maxZ: low.position.z + d2 / 2,
        });
      }
    }
  }

  // District signs: tall coloured pillars at each district centre.
  for (const dist of DISTRICTS) {
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.2, 16, 8),
      new THREE.MeshLambertMaterial({ color: dist.color, emissive: dist.color, emissiveIntensity: 0.25 }),
    );
    pillar.position.set(dist.center[0], 8, dist.center[1]);
    group.add(pillar);
  }

  // The Verde Garage: a wide low workshop with a yellow roof at (-40, 140).
  const garageMat = new THREE.MeshLambertMaterial({ color: 0xd8b13c });
  const garage = new THREE.Mesh(new THREE.BoxGeometry(30, 8, 18), garageMat);
  garage.position.set(-40, 4, 140);
  garage.castShadow = true;
  group.add(garage);
  const garageDoor = new THREE.Mesh(
    new THREE.BoxGeometry(20, 5.5, 0.6),
    new THREE.MeshLambertMaterial({ color: 0x2a2d33 }),
  );
  garageDoor.position.set(-40, 2.8, 130.8);
  group.add(garageDoor);
  colliders.push({ minX: -55, maxX: -25, minZ: 131, maxZ: 149 });

  // Shops: small storefronts with awnings.
  const shopPositions = [[-20, -100], [40, 40], [120, 100], [-100, -40]];
  const awningColors = [0xc23b2e, 0x2fa8a0, 0xc9a227, 0x4a7ec2];
  shopPositions.forEach(([x, z], i) => {
    const shop = new THREE.Mesh(new THREE.BoxGeometry(12, 6, 8), new THREE.MeshLambertMaterial({ color: 0xe8e0d0 }));
    shop.position.set(x, 3, z);
    shop.castShadow = true;
    group.add(shop);
    const awning = new THREE.Mesh(new THREE.BoxGeometry(13, 0.6, 4), new THREE.MeshLambertMaterial({ color: awningColors[i] }));
    awning.position.set(x, 5.4, z - 4.5);
    group.add(awning);
    colliders.push({ minX: x - 6, maxX: x + 6, minZ: z - 4, maxZ: z + 4 });
  });

  // Safehouse: a small house with a blue roof at (60, 140).
  const safehouse = new THREE.Mesh(new THREE.BoxGeometry(12, 6, 10), new THREE.MeshLambertMaterial({ color: 0xf0e6d2 }));
  safehouse.position.set(60, 3, 140);
  safehouse.castShadow = true;
  group.add(safehouse);
  const safeRoof = new THREE.Mesh(new THREE.ConeGeometry(9, 4, 4), new THREE.MeshLambertMaterial({ color: 0x3f6fb5 }));
  safeRoof.position.set(60, 8, 140);
  safeRoof.rotation.y = Math.PI / 4;
  group.add(safeRoof);
  colliders.push({ minX: 54, maxX: 66, minZ: 135, maxZ: 145 });

  // Palms along the marina and plaza trees in the park block.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2a });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f8f4f });
  const palms = [];
  for (let i = 0; i < 26; i++) {
    const x = -190 + rng() * 380;
    const z = rng() < 0.5 ? -195 + rng() * 12 : 183 + rng() * 12;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 7, 6), trunkMat);
    trunk.position.set(x, 3.5, z);
    group.add(trunk);
    const leaves = new THREE.Mesh(new THREE.ConeGeometry(3.2, 4, 6), leafMat);
    leaves.position.set(x, 8.5, z);
    group.add(leaves);
    palms.push({ x, z });
  }

  // Streetlights at every intersection; their bulbs glow at night.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x22242a });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const bulbs = [];
  for (let k = -3; k <= 3; k++) {
    for (let m = -3; m <= 3; m++) {
      const x = k * pitch + 8;
      const z = m * pitch + 8;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 7, 6), poleMat);
      pole.position.set(x, 3.5, z);
      group.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), bulbMat.clone());
      bulb.position.set(x, 7.2, z);
      group.add(bulb);
      bulbs.push(bulb);
    }
  }

  return {
    group,
    colliders,
    garagePos: { x: -40, z: 130 },
    shopPositions,
    safehousePos: { x: 60, z: 140 },
    spawnPos: { x: 0, z: 10 },
    roadLines: [-180, -120, -60, 0, 60, 120, 180],
    half,
    // Night falls: streetlight bulbs brighten, facades stay lit.
    updateNight(isNight) {
      const target = isNight ? 1 : 0.15;
      for (const b of bulbs) b.material.color.setHex(isNight ? 0xffe9a8 : 0x8a8a7a);
      void target;
    },
  };
}
