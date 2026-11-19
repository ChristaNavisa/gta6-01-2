// VERDE BAY 3D v8 — the island city: districts, buildings, palms, roads, places.
// Pure data + seeded RNG: no DOM, no THREE, so the Node smoke test can import it.
import { DISTRICTS, PACKAGE_COUNT } from './config.js';
import { mulberry32, pick } from './util.js';

const ROAD_X = [150, 450, 750, 1050, 1350, 1650, 1950, 2250, 2550, 2850, 3150];
const ROAD_Y = [150, 450, 750, 1050, 1350, 1650, 1950];
const ROAD_HALF = 46;

export const PLACES = {
  garage: { x: 1150, y: 850, name: 'Verde Garage' },
  stadium: { x: 1000, y: 350, name: 'Verde Stadium' },
  taxi: { x: 1200, y: 900, name: 'Taxi Rank' },
  dock: { x: 2100, y: 1800, name: 'Dockside' },
  warehouse: { x: 2200, y: 1000, name: 'Old Warehouse' },
  ferry: { x: 2250, y: 1880, name: 'Ferry Terminal' },
  bank: { x: 1050, y: 750, name: 'Verde Bank' },
  marina: { x: 2150, y: 1830, name: 'Marina del Sol' },
  casino: { x: 2100, y: 1550, name: 'Neon Crown Casino' },
  strip: { x: 2150, y: 1500, name: 'The Strip' },
  boat: { x: 3050, y: 1100, name: 'Isla Verde Dock' },
  port: { x: 2000, y: 1900, name: 'Port Verde' },
  cannery: { x: 2000, y: 1130, name: 'Old Cannery' },
  safehouse: { x: 900, y: 400, name: 'Safehouse Garage' },
  shop: { x: 1250, y: 950, name: 'Verde Arms' },
  hospital: { x: 350, y: 600, name: 'Verde General' },
  beach: { x: 1300, y: 1650, name: 'Palma Beach' },
};

const DISTRICT_ORDER = ['water', 'residential', 'downtown', 'oldtown', 'beach', 'industrial', 'strip', 'marina', 'isla'];

export function districtAt(x, y) {
  for (const id of DISTRICT_ORDER) {
    const d = DISTRICTS[id];
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return id;
  }
  return 'downtown';
}

const PLACE_NAMES = [
  { key: 'ferry', name: 'Ferry Terminal' },
  { key: 'marina', name: 'Marina del Sol' },
  { key: 'cannery', name: 'Old Cannery' },
];

export function districtNameAt(x, y) {
  for (const p of PLACE_NAMES) {
    const pl = PLACES[p.key];
    const dx = x - pl.x, dy = y - pl.y;
    if (dx * dx + dy * dy < 90 * 90) return p.name;
  }
  return DISTRICTS[districtAt(x, y)].name;
}

function onRoad(x, y) {
  for (const rx of ROAD_X) if (Math.abs(x - rx) < ROAD_HALF + 30) return true;
  for (const ry of ROAD_Y) if (Math.abs(y - ry) < ROAD_HALF + 30) return true;
  return false;
}

const BEACH_ROOFS = ['#f4a261', '#e9c46a', '#f7ede2', '#ee9b7a'];
const CITY_ROOFS = ['#5b6b7a', '#7a6b5b', '#4a5b6b', '#8a7a6b', '#6b7a5b'];

export function generateCity(seed) {
  const rng = mulberry32(seed * 7919 + 13);
  const buildings = [];
  const addBuilding = (district, x, y, w, d, floors, roof, opts = {}) => {
    buildings.push({
      x, y, w, d, floors,
      height: floors * 14 + 6,
      roof, district,
      neon: !!opts.neon,
      stack: !!opts.stack,
      color: opts.color || '#9aa5b1',
    });
  };

  // Downtown towers.
  for (let i = 0; i < 16; i++) {
    const x = 850 + rng() * 500, y = 650 + rng() * 400;
    if (onRoad(x, y)) continue;
    addBuilding('downtown', x, y, 60 + rng() * 50, 60 + rng() * 50,
      4 + Math.floor(rng() * 7), pick(rng, CITY_ROOFS));
  }
  // Industrial: single-storey warehouses, some with smokestacks. Placed on fixed
  // spots clear of the roads (x=1950/2250, y=1050) so the district is never empty.
  const indSpots = [
    [2080, 880], [2160, 1180], [2380, 880], [2440, 1180], [2100, 1250], [2400, 950],
  ];
  indSpots.forEach(([x, y], i) => {
    addBuilding('industrial', x, y, 110 + (i % 3) * 20, 80 + (i % 2) * 20, 1,
      pick(rng, ['#7a7a7a', '#8a6a5a', '#6a7a6a']),
      { stack: i % 2 === 0, color: '#8a8078' });
  });
  // Beachfront: low pastel blocks.
  for (let i = 0; i < 10; i++) {
    const x = 950 + rng() * 650, y = 1550 + rng() * 400;
    if (onRoad(x, y)) continue;
    addBuilding('beach', x, y, 55 + rng() * 40, 55 + rng() * 40,
      1 + Math.floor(rng() * 2), pick(rng, BEACH_ROOFS));
  }
  // Old Town: low brick.
  for (let i = 0; i < 9; i++) {
    const x = 80 + rng() * 460, y = 450 + rng() * 500;
    if (onRoad(x, y)) continue;
    addBuilding('oldtown', x, y, 50 + rng() * 40, 50 + rng() * 40,
      1 + Math.floor(rng() * 2), pick(rng, ['#a05a4a', '#b07a5a', '#8a5a4a']),
      { color: '#a06a5a' });
  }
  // Residential: small houses.
  for (let i = 0; i < 12; i++) {
    const x = 850 + rng() * 500, y = 60 + rng() * 480;
    if (onRoad(x, y)) continue;
    addBuilding('residential', x, y, 40 + rng() * 30, 40 + rng() * 30,
      1 + Math.floor(rng() * 2), pick(rng, ['#c96a5a', '#5a8a6a', '#6a7ab0', '#d0a05a']));
  }
  // The Strip: neon towers. Fixed spots clear of the roads (x=1950/2250, y=1650).
  const stripSpots = [
    [2070, 1480], [2160, 1560], [2340, 1480], [2360, 1560], [2100, 1730], [2350, 1730],
  ];
  stripSpots.forEach(([x, y], i) => {
    addBuilding('strip', x, y, 55 + (i % 3) * 20, 55 + (i % 2) * 20,
      3 + (i % 5), pick(rng, ['#ff2d78', '#22d3ee', '#facc15', '#a855f7']),
      { neon: i % 2 === 0, color: '#2a2a3a' });
  });
  // Marina: low white blocks.
  for (let i = 0; i < 6; i++) {
    const x = 1950 + rng() * 400, y = 1780 + rng() * 220;
    if (onRoad(x, y)) continue;
    addBuilding('marina', x, y, 50 + rng() * 40, 50 + rng() * 40,
      1 + Math.floor(rng() * 2), pick(rng, ['#f7f7f7', '#dbeafe', '#fef3c7']));
  }
  // Isla Verde: villas.
  for (let i = 0; i < 7; i++) {
    const x = 2950 + rng() * 350, y = 950 + rng() * 400;
    if (onRoad(x, y)) continue;
    addBuilding('isla', x, y, 45 + rng() * 35, 45 + rng() * 35,
      1 + Math.floor(rng() * 2), pick(rng, ['#f4a261', '#e9c46a', '#ffffff']));
  }

  // Palms: a dozen on the beach, a few downtown.
  const palms = [];
  for (let i = 0; i < 12; i++) {
    palms.push({ x: 950 + rng() * 700, y: 1560 + rng() * 380, h: 26 + rng() * 10 });
  }
  for (let i = 0; i < 4; i++) {
    palms.push({ x: 850 + rng() * 500, y: 650 + rng() * 400, h: 22 + rng() * 8 });
  }

  // Roads: grid segments clipped to the world.
  const roads = [];
  for (const ry of ROAD_Y) roads.push({ x0: 0, y0: ry, x1: 2600, y1: ry });
  for (const ry of ROAD_Y) if (ry >= 950 && ry <= 1350) roads.push({ x0: 2600, y0: ry, x1: 3400, y1: ry });
  for (const rx of ROAD_X) roads.push({ x0: rx, y0: 0, x1: rx, y1: 2100 });

  // Ten hidden packages, spread across the districts, on land.
  const pkgSpots = [
    [900, 200], [1300, 500], [400, 800], [1000, 1000], [1400, 1400],
    [2100, 900], [2300, 1600], [2000, 1950], [3100, 1000], [3200, 1300],
  ];
  const packages = pkgSpots.map(([x, y], i) => ({ id: i, x, y, found: false }));

  return {
    seed, buildings, palms, roads,
    places: PLACES, packages,
    bounds: { w: 3400, h: 2100 },
  };
}
