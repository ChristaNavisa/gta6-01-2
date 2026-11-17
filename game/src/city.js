// VERDE BAY — the city. A seeded, deterministic 2600x2000 map: five
// districts, a road grid, named places, buildings, palms, trees, lamps.
// generateCity(seed) returns the same city for the same seed, every run.

import { ROADS, BEACH_ROOFS } from './config.js';
import { makeRng } from './util.js';

export const PLACE_NAMES = {
  apartment: "Cole's Apartment",
  garage: "Mara's Garage",
  bank: 'First Verde Bank',
  diner: 'Sunset Diner',
  club: 'The Rusty Anchor',
  warehouse: 'Harbor Warehouse',
  cannery: 'Old Cannery',
  marina: 'Marina del Sol',
  pier: 'Sunset Pier',
  stadium: 'Verde Bowl',
  hospital: 'Verde General',
  station: 'VBPD Central',
};

// Fixed named places (world coordinates).
const PLACES = {
  apartment: { x: 400, y: 910 },
  garage: { x: 910, y: 910 },
  bank: { x: 1170, y: 650 },
  diner: { x: 910, y: 1170 },
  club: { x: 1430, y: 650 },
  warehouse: { x: 2080, y: 1100 },
  cannery: { x: 2000, y: 1130 },
  marina: { x: 2150, y: 1830 },
  pier: { x: 1300, y: 1850 },
  stadium: { x: 1300, y: 250 },
  hospital: { x: 650, y: 390 },
  station: { x: 1690, y: 910 },
};

/** Which district a point is in. */
export function districtAt(x, y) {
  if (y >= 1500) return 'beach';
  if (y < 500) return 'residential';
  if (x >= 1750) return 'industrial';
  if (x < 550) return 'oldtown';
  return 'downtown';
}

/** A human name for a spot: landmarks first, then the district. */
export function districtNameAt(x, y) {
  if (x >= 2000 && y >= 1700) return 'Marina del Sol';
  if (x >= 1850 && x < 2300 && y >= 1000 && y < 1250) return 'Old Cannery';
  const d = districtAt(x, y);
  return d.charAt(0).toUpperCase() + d.slice(1);
}

function nearPlace(x, y, places, r) {
  for (const k of Object.keys(places)) {
    const p = places[k];
    const dx = x - p.x; const dy = y - p.y;
    if (dx * dx + dy * dy < r * r) return true;
  }
  return false;
}

export function generateCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const vx = ROADS.vertical;
  const hy = ROADS.horizontal;

  const wallPick = (arr) => arr[Math.floor(rng.next() * arr.length)];

  // One or two buildings per road block, kept clear of named places.
  for (let bx = 0; bx < vx.length - 1; bx++) {
    for (let by = 0; by < hy.length - 1; by++) {
      const x0 = vx[bx] + 42; const x1 = vx[bx + 1] - 42;
      const y0 = hy[by] + 42; const y1 = hy[by + 1] - 42;
      const cx = (x0 + x1) / 2; const cy = (y0 + y1) / 2;
      const district = districtAt(cx, cy);
      if (nearPlace(cx, cy, PLACES, 150)) continue;
      if (rng.chance(0.22)) continue; // empty lot: parking, park, yard
      const count = district === 'industrial' ? 1 : (rng.chance(0.45) ? 2 : 1);
      for (let i = 0; i < count; i++) {
        let bx0 = x0; let bx1 = x1; let by0 = y0; let by1 = y1;
        if (count === 2) {
          if (x1 - x0 > y1 - y0) { if (i === 0) bx1 = cx; else bx0 = cx; }
          else { if (i === 0) by1 = cy; else by0 = cy; }
        }
        const w = Math.min(bx1 - bx0 - 12, district === 'industrial' ? rng.range(120, 190) : rng.range(58, 108));
        const d = Math.min(by1 - by0 - 12, district === 'industrial' ? rng.range(90, 150) : rng.range(48, 88));
        const x = (bx0 + bx1) / 2 + rng.range(-8, 8);
        const y = (by0 + by1) / 2 + rng.range(-8, 8);
        if (nearPlace(x, y, PLACES, 110)) continue;
        let floors; let height; let roof; let wall; let stack = false;
        if (district === 'industrial') {
          floors = 1; height = 14; roof = '#5d5348'; wall = '#7d7468';
          stack = rng.chance(0.45);
        } else if (district === 'beach') {
          floors = rng.int(1, 2); height = floors * 10;
          roof = wallPick(BEACH_ROOFS); wall = '#f7ede2';
        } else if (district === 'oldtown') {
          floors = rng.int(1, 2); height = floors * 9;
          roof = '#7a4a35'; wall = wallPick(['#b5654a', '#a0522d', '#8b5a2b']);
        } else if (district === 'residential') {
          floors = rng.int(1, 2); height = floors * 9;
          roof = '#8a5a44'; wall = wallPick(['#d9c7a7', '#c9b18a', '#e8dcc0']);
        } else {
          floors = rng.int(3, 10); height = floors * 11;
          roof = '#2c2f38'; wall = wallPick(['#8a7f72', '#9a8f80', '#7d7468', '#a08a6a']);
        }
        buildings.push({ x, y, w, d, floors, height, roof, wall, district, stack });
      }
    }
  }

  // 45 palms along the beach strip.
  const palms = [];
  for (let i = 0; i < 45; i++) {
    palms.push({
      x: rng.range(80, 2520),
      y: rng.range(1520, 1980),
      s: rng.range(0.8, 1.3),
      lean: rng.range(-0.12, 0.12),
    });
  }

  // Shade trees in the northern and western districts.
  const trees = [];
  for (let i = 0; i < 70; i++) {
    const x = rng.range(60, 2540);
    const y = rng.range(60, 1480);
    trees.push({ x, y, s: rng.range(0.7, 1.4) });
  }

  // Street lamps at every other road crossing.
  const lamps = [];
  for (const x of vx) {
    for (let i = 0; i < hy.length; i += 2) {
      lamps.push({ x: x + 42, y: hy[i] });
      lamps.push({ x: x - 42, y: hy[i] + 2 });
    }
  }
  for (const y of hy) {
    for (let i = 0; i < vx.length; i += 2) {
      lamps.push({ x: vx[i], y: y + 42 });
    }
  }

  return {
    seed,
    buildings,
    palms,
    trees,
    lamps,
    roads: ROADS,
    places: { ...PLACES },
  };
}
