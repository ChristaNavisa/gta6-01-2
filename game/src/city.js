// Verde Bay: the island city. A deterministic, seeded generator builds the
// whole map — districts, buildings, palms, lamps, named places, the bridge,
// the ferry and the ten hidden packages — so every seed plays the same city.

import { WORLD } from './config.js';
import { mulberry32, randInt, randRange, pick, inRect } from './util.js';

// District rectangles. Order matters for districtAt: the first match wins.
export const DISTRICTS = [
  { id: 'isla', name: 'Isla Verde', x0: 2900, y0: 700, x1: 3400, y1: 1500, ground: '#7fae6e' },
  { id: 'strip', name: 'The Strip', x0: 1700, y0: 1400, x1: 2600, y1: 1750, ground: '#241a33' },
  { id: 'marina', name: 'Marina del Sol', x0: 1700, y0: 1750, x1: 2600, y1: 2050, ground: '#5a6b7a' },
  { id: 'industrial', name: 'Old Cannery', x0: 1700, y0: 0, x1: 2600, y1: 1400, ground: '#6b6560' },
  { id: 'beach', name: 'Verde Beach', x0: 0, y0: 1250, x1: 1700, y1: 2050, ground: '#e8cf9a' },
  { id: 'downtown', name: 'Downtown', x0: 700, y0: 550, x1: 1700, y1: 1250, ground: '#8a8f98' },
  { id: 'oldtown', name: 'Oldtown', x0: 0, y0: 0, x1: 700, y1: 1250, ground: '#a08b74' },
  { id: 'residential', name: 'Palmside', x0: 700, y0: 0, x1: 1700, y1: 550, ground: '#9db08a' },
];

const DISTRICT_BY_ID = new Map(DISTRICTS.map((d) => [d.id, d]));

const BEACH_ROOFS = ['#f4a261', '#e9c46a', '#f7ede2', '#ee9b7a'];
const DOWNTOWN_ROOFS = ['#3d405b', '#5c6b73', '#8d99ae', '#6d6875'];
const RESIDENTIAL_ROOFS = ['#b08968', '#7f4f24', '#936639', '#c2a878'];
const OLDTOWN_ROOFS = ['#9c6644', '#7f4f24', '#b08968', '#6b4226'];
const NEON_SIGNS = ['#ff2e88', '#00e5ff', '#ffd60a', '#7b2fff', '#39ff14', '#ff6b35'];

// Named places the missions and the HUD point at.
export const PLACES = {
  garage: { x: 950, y: 1150, label: 'Sunset Garage' },
  diner: { x: 600, y: 900, label: 'Marla Diner' },
  stadium: { x: 1400, y: 350, label: 'Verde Stadium' },
  warehouse: { x: 2050, y: 1050, label: 'Cannery Warehouse' },
  cannery: { x: 2000, y: 1130, label: 'Old Cannery' },
  bank: { x: 1200, y: 950, label: 'Verde Bay Bank' },
  marina: { x: 2150, y: 1830, label: 'Marina del Sol' },
  ferry: { x: 2250, y: 1880, label: 'Ferry Terminal' },
  taxi: { x: 900, y: 700, label: 'Taxi Stand' },
  hotel: { x: 1500, y: 700, label: 'Hotel Miramar' },
  casino: { x: 2100, y: 1550, label: 'Casino Royale Verde' },
  villa: { x: 3150, y: 1100, label: 'Villa Solana' },
  bridge: { x: 2750, y: 1100, label: 'Verde Bridge' },
  beach: { x: 1300, y: 1750, label: 'Verde Beach' },
  police: { x: 800, y: 1150, label: 'Verde Bay PD' },
  hospital: { x: 400, y: 400, label: 'St. Verde Hospital' },
};

// Ten hidden packages, tucked into alleys and corners at least 200px from
// every named place so the mission test driver never trips over one.
const PACKAGE_SPOTS = [
  { x: 180, y: 1900 },
  { x: 650, y: 1600 },
  { x: 1500, y: 2000 },
  { x: 1750, y: 500 },
  { x: 2450, y: 1300 },
  { x: 1900, y: 1650 },
  { x: 2500, y: 1900 },
  { x: 3000, y: 800 },
  { x: 3300, y: 1300 },
  { x: 350, y: 1150 },
];

/** The district id at a point, or 'water' / 'bridge' / 'outskirts'. */
export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (inRect(x, y, d)) return d.id;
  }
  if (x >= WORLD.channelX0 && x <= WORLD.channelX1 && y >= WORLD.bridgeY0 && y <= WORLD.bridgeY1) return 'bridge';
  return 'water';
}

/** A display name at a point: landmark names win near their places. */
export function districtNameAt(x, y) {
  const named = [
    ['Marina del Sol', PLACES.marina],
    ['Old Cannery', PLACES.cannery],
    ['Ferry Terminal', PLACES.ferry],
  ];
  let best = null;
  let bestD = 150;
  for (const [name, p] of named) {
    const d = Math.hypot(x - p.x, y - p.y);
    if (d < bestD) {
      bestD = d;
      best = name;
    }
  }
  if (best) return best;
  const id = districtAt(x, y);
  if (id === 'water') return 'Verde Bay';
  if (id === 'bridge') return 'Verde Bridge';
  return DISTRICT_BY_ID.get(id)?.name ?? 'Verde Bay';
}

/** True when a point is water (the channel, the sea, or around Isla Verde). */
export function isWater(x, y) {
  return districtAt(x, y) === 'water';
}

/** True when a point can be walked or driven on (land or bridge). */
export function isLand(x, y) {
  const d = districtAt(x, y);
  return d !== 'water';
}

function nearAnyPlace(x, y, r) {
  for (const p of Object.values(PLACES)) {
    if (Math.hypot(x - p.x, y - p.y) < r) return true;
  }
  return false;
}

function buildingFor(rng, district, bx, by, bw, bd) {
  const b = { x: bx, y: by, w: bw, d: bd, floors: 1, height: 12, roof: '#888888', district, stack: false, neon: false, sign: null };
  if (district === 'downtown') {
    b.floors = randInt(rng, 6, 18);
    b.height = b.floors * 9 + randInt(rng, 0, 8);
    b.roof = pick(rng, DOWNTOWN_ROOFS);
  } else if (district === 'industrial') {
    b.floors = 1;
    b.height = randInt(rng, 14, 26);
    b.roof = pick(rng, ['#5a5a5a', '#6b6560', '#4a4a4a']);
    b.stack = rng() < 0.35;
  } else if (district === 'beach') {
    b.floors = randInt(rng, 1, 3);
    b.height = b.floors * 9 + 4;
    b.roof = pick(rng, BEACH_ROOFS);
  } else if (district === 'oldtown') {
    b.floors = randInt(rng, 1, 2);
    b.height = b.floors * 10 + 4;
    b.roof = pick(rng, OLDTOWN_ROOFS);
  } else if (district === 'residential') {
    b.floors = randInt(rng, 1, 3);
    b.height = b.floors * 9 + 4;
    b.roof = pick(rng, RESIDENTIAL_ROOFS);
  } else if (district === 'strip') {
    b.floors = randInt(rng, 4, 10);
    b.height = b.floors * 10 + randInt(rng, 0, 10);
    b.roof = pick(rng, ['#1d1b2e', '#2a1b3d', '#331832']);
    b.neon = rng() < 0.8;
    b.sign = pick(rng, NEON_SIGNS);
  } else if (district === 'marina') {
    b.floors = randInt(rng, 1, 4);
    b.height = b.floors * 9 + 4;
    b.roof = pick(rng, ['#e9c46a', '#8ecae6', '#f7ede2']);
  } else if (district === 'isla') {
    b.floors = randInt(rng, 1, 2);
    b.height = b.floors * 10 + 6;
    b.roof = pick(rng, ['#f4a261', '#e9c46a', '#ffffff']);
  }
  return b;
}

/** Build the whole city for a seed. Deterministic: same seed, same city. */
export function generateCity(seed) {
  const rng = mulberry32(seed);
  const buildings = [];
  const BLOCK = 200;
  const ROAD = 44;
  const inner = BLOCK - ROAD;

  // Grid blocks across the mainland and Isla Verde.
  for (let gx = 0; gx < 17; gx++) {
    for (let gy = 0; gy < 11; gy++) {
      const bx0 = gx * BLOCK;
      const by0 = gy * BLOCK;
      const cx = bx0 + BLOCK / 2;
      const cy = by0 + BLOCK / 2;
      // Isla Verde occupies its own corner; the channel is water.
      if (bx0 >= WORLD.channelX0 && bx0 < WORLD.islaX0) continue;
      if (bx0 >= WORLD.islaX0 && (cy < 700 || cy > 1500)) continue;
      if (by0 >= WORLD.seaY0) continue;
      const district = districtAt(cx, cy);
      if (district === 'water' || district === 'bridge') continue;
      if (nearAnyPlace(cx, cy, 150)) continue;
      // 1-3 buildings per block, kept inside the block's inner square.
      const count = district === 'downtown' || district === 'strip' ? randInt(rng, 2, 3) : randInt(rng, 1, 2);
      for (let i = 0; i < count; i++) {
        const w = district === 'industrial' ? randRange(rng, 110, 150) : randRange(rng, 46, 110);
        const d = district === 'industrial' ? randRange(rng, 70, 110) : randRange(rng, 40, 90);
        const x = bx0 + ROAD / 2 + randRange(rng, 0, Math.max(1, inner - w));
        const y = by0 + ROAD / 2 + randRange(rng, 0, Math.max(1, inner - d));
        buildings.push(buildingFor(rng, district, x, y, w, d));
      }
    }
  }

  // Palms along the beach and the marina promenade.
  const palms = [];
  for (let i = 0; i < 36; i++) {
    palms.push({ x: randRange(rng, 80, 1650), y: randRange(rng, 1520, 2000) });
  }
  for (let i = 0; i < 8; i++) {
    palms.push({ x: randRange(rng, 1750, 2550), y: randRange(rng, 1780, 2000) });
  }
  // A few palms on Isla Verde too.
  for (let i = 0; i < 6; i++) {
    palms.push({ x: randRange(rng, 2950, 3350), y: randRange(rng, 750, 1450) });
  }

  // Street lamps at road intersections.
  const lamps = [];
  for (let gx = 1; gx < 13; gx++) {
    for (let gy = 1; gy < 11; gy++) {
      if (rng() < 0.55) lamps.push({ x: gx * BLOCK + 26, y: gy * BLOCK + 26 });
    }
  }
  for (let gx = 15; gx < 17; gx++) {
    for (let gy = 4; gy < 8; gy++) {
      lamps.push({ x: gx * BLOCK + 26, y: gy * BLOCK + 26 });
    }
  }

  // The ferry at the marina dock, and a static cargo ship in the channel.
  const ferry = { x: PLACES.ferry.x + 60, y: PLACES.ferry.y + 70, angle: 0.2 };
  const ship = { x: 2750, y: 600, angle: Math.PI / 2 };

  return {
    seed,
    width: WORLD.width,
    height: WORLD.height,
    buildings,
    palms,
    lamps,
    ferry,
    ship,
    places: { ...PLACES },
    packages: PACKAGE_SPOTS.map((p) => ({ x: p.x, y: p.y, found: false })),
  };
}
