// Verde Bay: a deterministic grid city — roads, blocks, buildings, parks, beach.
// The layout is generated from the seed so every run of the same seed matches.
import { WORLD_W, WORLD_H, ROAD_X, ROAD_Y, ROAD_W, BEACH_Y, WATER_Y, PALETTE, PLACES, DISTRICTS } from './config.js';
import { makeRng, range, rangeInt, pick, chance, clamp } from './random.js';

// Which district a point belongs to (first matching rect wins).
export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d.id;
  }
  return 'residential';
}

export function districtNameAt(x, y) {
  const id = districtAt(x, y);
  const d = DISTRICTS.find((v) => v.id === id);
  return d ? d.name : 'Verde Bay';
}

export function generateCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const parks = [];
  const trees = [];
  const palms = [];
  const lamps = [];

  // Blocks are the rectangles between neighbouring roads.
  const xs = [0, ...ROAD_X, WORLD_W];
  const ys = [0, ...ROAD_Y, BEACH_Y];
  for (let bi = 0; bi < xs.length - 1; bi++) {
    for (let bj = 0; bj < ys.length - 1; bj++) {
      const x0 = xs[bi] + ROAD_W / 2 + 14;
      const x1 = xs[bi + 1] - ROAD_W / 2 - 14;
      const y0 = ys[bj] + ROAD_W / 2 + 14;
      const y1 = ys[bj + 1] - ROAD_W / 2 - 14;
      if (x1 - x0 < 60 || y1 - y0 < 60) continue;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const district = districtAt(cx, cy);
      const downtown = district === 'downtown';
      const industrial = district === 'industrial';
      const roll = rng();
      if (roll < 0.14) {
        // A park: grass, trees, a path.
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        const n = rangeInt(rng, 4, 9);
        for (let i = 0; i < n; i++) trees.push({ x: range(rng, x0 + 14, x1 - 14), y: range(rng, y0 + 14, y1 - 14), r: range(rng, 9, 15) });
        continue;
      }
      // 1-4 buildings per block, with a margin for sidewalk. Industrial blocks
      // hold one big flat warehouse instead of several small houses.
      const cols = industrial ? 1 : ((x1 - x0) > 170 && chance(rng, 0.6) ? 2 : 1);
      const rows = industrial ? 1 : ((y1 - y0) > 170 && chance(rng, 0.5) ? 2 : 1);
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const bw = (x1 - x0) / cols - 18;
          const bh = (y1 - y0) / rows - 18;
          if (bw < 46 || bh < 40) continue;
          const bx = x0 + c * ((x1 - x0) / cols) + 9;
          const by = y0 + r * ((y1 - y0) / rows) + 9;
          const tall = downtown && chance(rng, 0.55);
          const roofPool = tall ? PALETTE.downtown
            : district === 'industrial' ? PALETTE.industrial
            : district === 'beach' ? PALETTE.beach
            : district === 'oldtown' ? PALETTE.oldtown
            : PALETTE.buildingRoof;
          buildings.push({
            x: bx, y: by, w: bw, h: bh,
            roof: pick(rng, roofPool),
            wall: pick(rng, industrial ? ['#9a8f80', '#8a8a84', '#a39a8b'] : PALETTE.buildingWall),
            tall,
            district,
            // Warehouses get a smokestack on the roof.
            stack: industrial && chance(rng, 0.6),
            floors: tall ? rangeInt(rng, 4, 9) : industrial ? 1 : district === 'oldtown' ? rangeInt(rng, 1, 2) : rangeInt(rng, 1, 3),
            windows: rangeInt(rng, 2, 5),
          });
        }
      }
      // Palms cluster on beach blocks; old town gets extra shade trees.
      if (district === 'beach') {
        const n = rangeInt(rng, 3, 6);
        for (let i = 0; i < n; i++) palms.push({ x: range(rng, x0 + 14, x1 - 14), y: range(rng, y0 + 14, y1 - 14), r: range(rng, 9, 13) });
      }
      if (chance(rng, district === 'oldtown' ? 0.9 : 0.7)) trees.push({ x: range(rng, x0 + 10, x1 - 10), y: range(rng, y0 + 10, y1 - 10), r: range(rng, 8, 13) });
    }
  }

  // Palm-lined promenade along the beach.
  for (let x = 80; x < WORLD_W; x += 130) {
    if (chance(rng, 0.75)) palms.push({ x: x + range(rng, -20, 20), y: BEACH_Y - 24 + range(rng, -6, 6), r: range(rng, 10, 14) });
  }

  // Street lamps along the main avenues.
  for (const x of ROAD_X) for (const y of ROAD_Y) {
    lamps.push({ x: x + ROAD_W / 2 + 8, y: y - ROAD_W / 2 - 8 });
    lamps.push({ x: x - ROAD_W / 2 - 8, y: y + ROAD_W / 2 + 8 });
  }

  return {
    w: WORLD_W, h: WORLD_H,
    buildings, parks, trees, palms, lamps,
    districts: DISTRICTS,
    places: { ...PLACES },
  };
}

// --- Road helpers ---------------------------------------------------------
export function isOnRoad(x, y) {
  for (const rx of ROAD_X) if (Math.abs(x - rx) <= ROAD_W / 2) return true;
  for (const ry of ROAD_Y) if (Math.abs(y - ry) <= ROAD_W / 2) return true;
  return false;
}

export function nearestRoadPoint(rng, x, y) {
  // Snap to the closest road centre line.
  let best = null, bestD = Infinity;
  for (const rx of ROAD_X) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; best = { x: rx, y: clamp(y, 60, WORLD_H - 60), horizontal: false }; }
  }
  for (const ry of ROAD_Y) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; best = { x: clamp(x, 60, WORLD_W - 60), y: ry, horizontal: true }; }
  }
  return best;
}

export function randomRoadPoint(rng) {
  if (chance(rng, 0.5)) {
    return { x: pick(rng, ROAD_X), y: range(rng, 80, BEACH_Y - 80), horizontal: false };
  }
  return { x: range(rng, 80, WORLD_W - 80), y: pick(rng, ROAD_Y), horizontal: true };
}

export function randomSidewalkPoint(rng) {
  const p = randomRoadPoint(rng);
  const off = (ROAD_W / 2 + 12) * (chance(rng, 0.5) ? 1 : -1);
  if (p.horizontal) return { x: p.x, y: clamp(p.y + off, 60, BEACH_Y - 40) };
  return { x: clamp(p.x + off, 60, WORLD_W - 60), y: p.y };
}

export function pointInBuilding(city, x, y, pad) {
  const p = pad || 0;
  for (const b of city.buildings) {
    if (x > b.x - p && x < b.x + b.w + p && y > b.y - p && y < b.y + b.h + p) return b;
  }
  return null;
}

export function inWater(x, y) { return y >= WATER_Y; }
export function onBeach(x, y) { return y >= BEACH_Y && y < WATER_Y; }

// True when no building stands between the two points (sampled along the
// segment). Police use it: a cop behind a tower block cannot see the player.
export function hasLineOfSight(city, ax, ay, bx, by) {
  const d = Math.hypot(bx - ax, by - ay);
  const steps = Math.max(1, Math.ceil(d / 24));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (pointInBuilding(city, ax + (bx - ax) * t, ay + (by - ay) * t, 0)) return false;
  }
  return true;
}
