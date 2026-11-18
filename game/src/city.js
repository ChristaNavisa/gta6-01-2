// VERDE BAY: an island city in the sea, built from one seed so every run of
// the game shows the same streets. The main island holds six districts; a
// bridge crosses the strait east to Isla Verde, the resort island, and the
// harbor in the south-east holds the ferry terminal.
//
// District rectangles (x0, y0, x1, y1). districtAt answers which one a point
// is in; districtNameAt answers the named place a point belongs to.

import { CONFIG } from './config.js';
import { mulberry32, randInt, randRange, pick } from './util.js';

const DISTRICTS = [
  { id: 'residential', name: 'Residential', x0: 400, y0: 40, x1: 1800, y1: 560 },
  { id: 'downtown', name: 'Downtown', x0: 800, y0: 600, x1: 1700, y1: 1150 },
  { id: 'oldtown', name: 'Old Town', x0: 40, y0: 480, x1: 620, y1: 1120 },
  { id: 'industrial', name: 'Industrial', x0: 1900, y0: 700, x1: 2580, y1: 1420 },
  { id: 'beach', name: 'Beach', x0: 800, y0: 1500, x1: 1900, y1: 1980 },
  { id: 'marina', name: 'Marina', x0: 1920, y0: 1500, x1: 2580, y1: 1980 },
  { id: 'isla', name: 'Isla Verde', x0: 2720, y0: 760, x1: 3380, y1: 1440 },
];

// Named sub-areas: a point inside one answers with its name.
const NAMED = [
  { name: 'Verde Bridge', x0: 2600, y0: 940, x1: 2720, y1: 1140 },
  { name: 'Ferry Terminal', x0: 2200, y0: 1840, x1: 2450, y1: 1980 },
  { name: 'Marina del Sol', x0: 1920, y0: 1500, x1: 2580, y1: 1980 },
  { name: 'Old Cannery', x0: 1900, y0: 700, x1: 2580, y1: 1420 },
  { name: 'Isla Verde', x0: 2720, y0: 760, x1: 3380, y1: 1440 },
];

// Axis-aligned streets. Traffic drives along these; buildings keep off them.
const ROADS = [
  { x0: 300, y0: 200, x1: 1900, y1: 200 },
  { x0: 100, y0: 580, x1: 2500, y1: 580 },
  { x0: 100, y0: 1150, x1: 2600, y1: 1150 },
  { x0: 700, y0: 1450, x1: 2600, y1: 1450 },
  { x0: 700, y0: 1650, x1: 2500, y1: 1650 },
  { x0: 1900, y0: 1050, x1: 3380, y1: 1050 },
  { x0: 300, y0: 400, x1: 300, y1: 1200 },
  { x0: 700, y0: 100, x1: 700, y1: 1900 },
  { x0: 1100, y0: 40, x1: 1100, y1: 1900 },
  { x0: 1500, y0: 100, x1: 1500, y1: 1900 },
  { x0: 2000, y0: 580, x1: 2000, y1: 1980 },
  { x0: 2300, y0: 700, x1: 2300, y1: 1980 },
  { x0: 3050, y0: 760, x1: 3050, y1: 1440 },
];

// Named places the missions and the HUD point at.
export const PLACES = {
  garage: { x: 1000, y: 900, label: 'Verde Motors Garage', district: 'downtown' },
  stadium: { x: 1400, y: 400, label: 'Bay Stadium', district: 'residential' },
  marina: { x: 2150, y: 1830, label: 'Marina del Sol', district: 'marina' },
  warehouse: { x: 2150, y: 1050, label: 'Harbor Warehouse', district: 'industrial' },
  cannery: { x: 2000, y: 1130, label: 'Old Cannery', district: 'industrial' },
  diner: { x: 500, y: 800, label: "Rosa's Diner", district: 'oldtown' },
  hotel: { x: 1200, y: 700, label: 'Hotel Miramar', district: 'downtown' },
  bank: { x: 1150, y: 950, label: 'Verde Bay Bank', district: 'downtown' },
  pier: { x: 1500, y: 1750, label: 'Sunset Pier', district: 'beach' },
  club: { x: 900, y: 1700, label: 'Club Marea', district: 'beach' },
  market: { x: 600, y: 400, label: 'Old Market', district: 'oldtown' },
  plaza: { x: 1100, y: 1000, label: 'Liberty Plaza', district: 'downtown' },
  ferry: { x: 2250, y: 1880, label: 'Ferry Terminal', district: 'marina' },
  bridge: { x: 2660, y: 1040, label: 'Verde Bridge', district: 'water' },
  islandDepot: { x: 3050, y: 1100, label: 'Isla Verde Depot', district: 'isla' },
};

const BEACH_ROOFS = ['#f4a261', '#e9c46a', '#f7ede2', '#ee9b7a'];
const DOWNTOWN_ROOFS = ['#3a506b', '#5c6b7a', '#2e4057', '#6c757d'];
const OLD_ROOFS = ['#b5654a', '#8d4b3a', '#a9714b'];
const MARINA_ROOFS = ['#f7ede2', '#a8dadc', '#457b9d'];
const ISLA_ROOFS = ['#f4a261', '#e9c46a', '#ffffff', '#2a9d8f'];

function inside(r, x, y) {
  return x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
}

/** Which district a point is in ('water' for the sea and the strait). */
export function districtAt(x, y) {
  for (const d of DISTRICTS) if (inside(d, x, y)) return d.id;
  return 'water';
}

/** The named place a point belongs to, or its district's display name. */
export function districtNameAt(x, y) {
  for (const n of NAMED) if (inside(n, x, y)) return n.name;
  const d = districtAt(x, y);
  if (d === 'water') return 'Open Sea';
  return DISTRICTS.find((dd) => dd.id === d).name;
}

/** True when the point is sea: outside both islands and off the bridge. */
export function isWater(x, y) {
  const b = CONFIG.bridge;
  if (x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1) return false;
  if (x >= 0 && x <= CONFIG.world.mainW && y >= 0 && y <= CONFIG.world.h) return false;
  if (x >= 2720 && x <= 3380 && y >= 700 && y <= 1500) return false;
  return true;
}

function nearRoad(x, y, margin) {
  for (const r of ROADS) {
    const horizontal = r.y0 === r.y1;
    if (horizontal) {
      if (x >= r.x0 - margin && x <= r.x1 + margin && Math.abs(y - r.y0) < margin + 26) return true;
    } else if (y >= r.y0 - margin && y <= r.y1 + margin && Math.abs(x - r.x0) < margin + 26) {
      return true;
    }
  }
  return false;
}

function nearPlace(x, y, margin) {
  for (const p of Object.values(PLACES)) {
    const dx = x - p.x;
    const dy = y - p.y;
    if (dx * dx + dy * dy < margin * margin) return true;
  }
  return false;
}

/** Build the whole city from one seed: buildings, palms, roads, places. */
export function generateCity(seed) {
  const rng = mulberry32(seed);
  const buildings = [];
  const palms = [];

  for (const d of DISTRICTS) {
    const step = d.id === 'industrial' ? 170 : d.id === 'downtown' ? 130 : 120;
    for (let gx = d.x0 + 60; gx < d.x1 - 40; gx += step) {
      for (let gy = d.y0 + 60; gy < d.y1 - 40; gy += step) {
        if (rng() < 0.18) continue; // empty lots keep the city breathing
        const x = gx + randRange(rng, -18, 18);
        const y = gy + randRange(rng, -18, 18);
        if (nearRoad(x, y, 20) || nearPlace(x, y, 110)) continue;
        let floors;
        let w;
        let depth;
        let roof;
        let stack = false;
        if (d.id === 'downtown') {
          floors = randInt(rng, 6, 14);
          w = randRange(rng, 44, 78);
          depth = randRange(rng, 44, 78);
          roof = pick(rng, DOWNTOWN_ROOFS);
        } else if (d.id === 'industrial') {
          floors = 1;
          w = randRange(rng, 70, 130);
          depth = randRange(rng, 60, 110);
          roof = pick(rng, ['#6b705c', '#7d7a6e', '#5f6a6a']);
          stack = rng() < 0.3;
        } else if (d.id === 'beach') {
          floors = randInt(rng, 1, 3);
          w = randRange(rng, 40, 70);
          depth = randRange(rng, 40, 70);
          roof = pick(rng, BEACH_ROOFS);
        } else if (d.id === 'oldtown') {
          floors = randInt(rng, 1, 2);
          w = randRange(rng, 40, 66);
          depth = randRange(rng, 40, 66);
          roof = pick(rng, OLD_ROOFS);
        } else if (d.id === 'marina') {
          floors = randInt(rng, 2, 4);
          w = randRange(rng, 44, 72);
          depth = randRange(rng, 44, 72);
          roof = pick(rng, MARINA_ROOFS);
        } else if (d.id === 'isla') {
          floors = randInt(rng, 1, 3);
          w = randRange(rng, 44, 76);
          depth = randRange(rng, 44, 76);
          roof = pick(rng, ISLA_ROOFS);
        } else {
          floors = randInt(rng, 1, 3);
          w = randRange(rng, 40, 66);
          depth = randRange(rng, 40, 66);
          roof = pick(rng, ['#e07a5f', '#f2cc8f', '#81b29a']);
        }
        buildings.push({
          x, y, w, d: depth, height: floors * 7 + 6, floors, roof, district: d.id, stack,
        });
      }
    }
  }

  // Guarantee at least one smokestack in the industrial district: the
  // seeded grid can otherwise roll a stack-free set of warehouses.
  if (!buildings.some((b) => b.district === 'industrial' && b.stack)) {
    const first = buildings.find((b) => b.district === 'industrial');
    if (first) first.stack = true;
  }

  // Palms cluster along the beach and the marina, with a few on Isla Verde.
  for (let i = 0; i < 42; i++) {
    palms.push({ x: randRange(rng, 830, 1880), y: randRange(rng, 1520, 1960) });
  }
  for (let i = 0; i < 8; i++) {
    palms.push({ x: randRange(rng, 1960, 2540), y: randRange(rng, 1560, 1940) });
  }
  for (let i = 0; i < 7; i++) {
    palms.push({ x: randRange(rng, 2760, 3340), y: randRange(rng, 1300, 1420) });
  }

  return {
    seed,
    width: CONFIG.world.w,
    height: CONFIG.world.h,
    districts: DISTRICTS,
    roads: ROADS,
    buildings,
    palms,
    places: PLACES,
    bridge: CONFIG.bridge,
    // The ferry sits moored at the terminal dock, static.
    ferry: { x: 2320, y: 1900, angle: 0.35 },
  };
}
