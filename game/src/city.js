// VERDE BAY 3D v7 — the island city: districts, roads, buildings, palms, packages.
// Pure data generation (seeded): no DOM, no THREE, safe to import from Node.

import { mulberry32, pick, range, rangeInt, dist } from './util.js';
import { MAP, DISTRICTS, ROADS_X, ROADS_Y, ROAD_HALF, PLACES, PLAYER } from './config.js';

const BEACH_ROOFS = ['#f4a261', '#e9c46a', '#f7ede2', '#ee9b7a'];
const BRICK_ROOFS = ['#b5523c', '#8c4a32', '#a85b3f', '#7a3b2e'];
const CITY_ROOFS = ['#5a6b7a', '#7a8a99', '#4a5568', '#93a5b5', '#c9d4de'];
const RESORT_ROOFS = ['#f4a261', '#e9c46a', '#ffffff', '#8ecae6'];

// District of a point. Water (the channel + outer sea) wins first.
export function districtAt(x, y) {
  if (x < MAP.minX || x > MAP.maxX || y < MAP.minY || y > MAP.maxY) return 'water';
  if (x >= 2620 && x < 2900) return 'water';
  for (const d of DISTRICTS) {
    if (d.id === 'water') continue;
    if (x >= d.x0 && x <= d.x1 && y >= d.y0 && y <= d.y1) return d.id;
  }
  if (x >= 2900) return 'isla';
  if (y >= 1400) return 'beach';
  return 'downtown';
}

// Human name of where a point is: nearest named place wins, else the district.
export function districtNameAt(x, y) {
  let best = null;
  let bestD = 140;
  for (const key of Object.keys(PLACES)) {
    const p = PLACES[key];
    const d = dist(x, y, p.x, p.y);
    if (d < bestD) {
      bestD = d;
      best = p.label;
    }
  }
  if (best) return best;
  const id = districtAt(x, y);
  const d = DISTRICTS.find((r) => r.id === id);
  return d ? d.name : 'Verde Bay';
}

function onRoad(x, y) {
  for (const rx of ROADS_X) if (Math.abs(x - rx) < ROAD_HALF + 8) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) < ROAD_HALF + 8) return true;
  return false;
}

function nearPlace(x, y, r) {
  for (const key of Object.keys(PLACES)) {
    const p = PLACES[key];
    if (dist(x, y, p.x, p.y) < r) return true;
  }
  return false;
}

function insideBuilding(buildings, x, y, pad) {
  for (const b of buildings) {
    if (x > b.x - b.w / 2 - pad && x < b.x + b.w / 2 + pad && y > b.y - b.d / 2 - pad && y < b.y + b.d / 2 + pad) return true;
  }
  return false;
}

// Build the whole city from a seed. Deterministic: same seed, same city.
export function generateCity(seed) {
  const rng = mulberry32(seed);
  const buildings = [];
  const palms = [];
  const packages = [];

  // Road segments for the renderer and the traffic AI.
  const roads = [];
  for (const rx of ROADS_X) {
    const y0 = rx === 3100 ? 720 : 60;
    const y1 = rx === 3100 ? 1480 : 2060;
    roads.push({ x1: rx, y1: y0, x2: rx, y2: y1 });
  }
  for (const ry of ROADS_Y) {
    roads.push({ x1: 60, y1: ry, x2: 3360, y2: ry });
  }

  // Building blocks: the gaps between roads (and the water channel, which no
  // block may span). Each gap is a city block.
  function gaps(blocked, min, max) {
    const ivs = [...blocked].sort((a, b) => a[0] - b[0]);
    const out = [];
    let cur = min;
    for (const [a, b] of ivs) {
      if (a - cur > 60) out.push([cur, a]);
      cur = Math.max(cur, b);
    }
    if (max - cur > 60) out.push([cur, max]);
    return out;
  }
  const blockedX = ROADS_X.map((r) => [r - ROAD_HALF - 10, r + ROAD_HALF + 10]);
  blockedX.push([2620, 2900]); // the channel splits the mainland from Isla Verde
  const cellX = gaps(blockedX, 60, 3360);
  const blockedY = ROADS_Y.map((r) => [r - ROAD_HALF - 10, r + ROAD_HALF + 10]);
  const cellY = gaps(blockedY, 60, 2080);

  for (const [cx0, cx1] of cellX) {
    for (const [cy0, cy1] of cellY) {
      const cx = (cx0 + cx1) / 2;
      const cy = (cy0 + cy1) / 2;
      const district = districtAt(cx, cy);
      if (district === 'water') continue;
      // One to four buildings per block, shaped by district.
      let count = 2;
      if (district === 'downtown') count = rangeInt(rng, 2, 4);
      else if (district === 'industrial') count = rangeInt(rng, 2, 3);
      else if (district === 'strip') count = rangeInt(rng, 2, 3);
      else if (district === 'residential' || district === 'beach') count = rangeInt(rng, 1, 3);
      else count = rangeInt(rng, 1, 2);
      for (let i = 0; i < count; i++) {
        const w = district === 'industrial' ? range(rng, 70, 120) : range(rng, 34, 74);
        const d = district === 'industrial' ? range(rng, 46, 80) : range(rng, 30, 62);
        const x = range(rng, cx0 + w / 2 + 4, cx1 - w / 2 - 4);
        const y = range(rng, cy0 + d / 2 + 4, cy1 - d / 2 - 4);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        if (nearPlace(x, y, 100)) continue;
        let floors;
        let roof;
        let neon = false;
        let stack = false;
        if (district === 'industrial') {
          floors = 1;
          roof = pick(rng, ['#6b7280', '#7d7468', '#5c6650']);
          stack = rng() < 0.45;
        } else if (district === 'beach') {
          floors = rangeInt(rng, 1, 3);
          roof = pick(rng, BEACH_ROOFS);
        } else if (district === 'oldtown') {
          floors = rangeInt(rng, 1, 2);
          roof = pick(rng, BRICK_ROOFS);
        } else if (district === 'strip') {
          floors = rangeInt(rng, 2, 6);
          roof = pick(rng, CITY_ROOFS);
          neon = rng() < 0.6;
        } else if (district === 'downtown') {
          floors = rangeInt(rng, 4, 12);
          roof = pick(rng, CITY_ROOFS);
          neon = rng() < 0.12;
        } else if (district === 'isla') {
          floors = rangeInt(rng, 2, 4);
          roof = pick(rng, RESORT_ROOFS);
        } else if (district === 'marina') {
          floors = rangeInt(rng, 1, 3);
          roof = pick(rng, ['#e9ecef', '#8ecae6', '#f4a261']);
        } else {
          floors = rangeInt(rng, 1, 3);
          roof = pick(rng, CITY_ROOFS);
        }
        buildings.push({
          x, y, w, d, floors, roof, neon, stack, district,
          height: floors * 9 + 6,
          color: roof,
        });
      }
    }
  }

  // Palms: a beach grove first, then a scatter through the leafy districts.
  let placed = 0;
  let guard = 0;
  while (placed < 16 && guard < 400) {
    guard += 1;
    const x = range(rng, 860, 1750);
    const y = range(rng, 1430, 1880);
    if (insideBuilding(buildings, x, y, 12)) continue;
    if (nearPlace(x, y, 60)) continue;
    palms.push({ x, y, h: range(rng, 16, 26) });
    placed += 1;
  }
  guard = 0;
  while (palms.length < 26 && guard < 400) {
    guard += 1;
    const spot = pick(rng, [
      [range(rng, 700, 1600), range(rng, 100, 480)],
      [range(rng, 1950, 2400), range(rng, 1780, 2020)],
      [range(rng, 2950, 3300), range(rng, 750, 1450)],
      [range(rng, 850, 1750), range(rng, 1430, 1880)],
    ]);
    const [x, y] = spot;
    if (districtAt(x, y) === 'water') continue;
    if (insideBuilding(buildings, x, y, 12)) continue;
    palms.push({ x, y, h: range(rng, 16, 26) });
  }

  // Ten hidden packages, spread across the map on open ground.
  const pkgSpots = [
    [PLACES.park.x + 40, PLACES.park.y + 30],
    [PLACES.plaza.x - 50, PLACES.plaza.y + 40],
    [PLACES.pier.x + 30, PLACES.pier.y - 20],
    [PLACES.stadium.x + 60, PLACES.stadium.y - 30],
    [PLACES.diner.x - 40, PLACES.diner.y + 50],
    [PLACES.cannery.x + 70, PLACES.cannery.y + 20],
    [PLACES.hotel.x - 60, PLACES.hotel.y - 40],
    [PLACES.lighthouse.x - 50, PLACES.lighthouse.y + 40],
    [PLACES.airstrip.x + 40, PLACES.airstrip.y + 60],
    [PLACES.club.x - 50, PLACES.club.y + 30],
  ];
  for (const [x, y] of pkgSpots) {
    packages.push({ x, y, taken: false, id: packages.length });
  }

  return {
    seed,
    buildings,
    palms,
    packages,
    places: PLACES,
    roads,
    bounds: { x0: 0, y0: 0, x1: MAP.w, y1: MAP.h },
  };
}
