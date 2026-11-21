// The city of Verde Bay: roads, blocks, buildings, parks, beach, port, ramps.
// Builds a deterministic map from a seeded RNG so every run has the same city.
import { WORLD, DISTRICTS, GARAGE_POS, GUNSTORE_POS, HOSPITAL_POS, BUSINESSES } from './config.js';
import { mulberry, clamp } from './util.js';

export function buildCity() {
  const rng = mulberry(20261121);
  const buildings = [];
  const parks = [];
  const ramps = [];
  const trees = [];
  const gap = WORLD.roadGap, road = WORLD.roadWidth;
  const half = road / 2 + 14;
  for (let bx = 0; bx < 12; bx++) {
    for (let by = 0; by < 12; by++) {
      const x0 = bx * gap + half, y0 = by * gap + half;
      const w = gap - road - 28, h = gap - road - 28;
      const roll = rng();
      if (roll < 0.14) {
        parks.push({ x: x0, y: y0, w, h });
        for (let i = 0; i < 5; i++) trees.push({ x: x0 + rng() * w, y: y0 + rng() * h, r: 8 + rng() * 7 });
        continue;
      }
      // 1-4 buildings per block, leaving alleys between them.
      const n = 1 + Math.floor(rng() * 3);
      for (let i = 0; i < n; i++) {
        const bw = 60 + rng() * 90, bh = 60 + rng() * 90;
        const px = x0 + rng() * Math.max(1, w - bw), py = y0 + rng() * Math.max(1, h - bh);
        const d = DISTRICTS.find((dd) => px >= dd.x && px < dd.x + dd.w && py >= dd.y && py < dd.y + dd.h) || DISTRICTS[0];
        buildings.push({
          x: px, y: py, w: bw, h: bh,
          color: shade(d.base, 0.75 + rng() * 0.5),
          roof: shade(d.accent, 0.5 + rng() * 0.4),
          hgt: 18 + rng() * 46,
          windows: Math.floor(rng() * 3),
        });
      }
    }
  }
  // Stunt ramps on a few open road stretches.
  ramps.push(
    { x: 1500, y: 300, angle: 0, w: 46, h: 90 },
    { x: 300, y: 1500, angle: Math.PI / 2, w: 46, h: 90 },
    { x: 2400, y: 2700, angle: Math.PI, w: 46, h: 90 },
    { x: 2700, y: 1200, angle: -Math.PI / 2, w: 46, h: 90 },
  );
  return {
    buildings, parks, ramps, trees,
    garage: GARAGE_POS, gunstore: GUNSTORE_POS, hospital: HOSPITAL_POS,
    businesses: BUSINESSES.map((b) => ({ ...b })),
  };
}

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(Math.round(((n >> 16) & 255) * f), 0, 255);
  const g = clamp(Math.round(((n >> 8) & 255) * f), 0, 255);
  const b = clamp(Math.round((n & 255) * f), 0, 255);
  return `rgb(${r},${g},${b})`;
}

export function isOnRoad(x, y) {
  const gap = WORLD.roadGap, road = WORLD.roadWidth;
  const mx = x % gap, my = y % gap;
  return mx < road / 2 + 8 || mx > gap - road / 2 - 8 || my < road / 2 + 8 || my > gap - road / 2 - 8;
}

export function districtAt(x, y) {
  return DISTRICTS.find((d) => x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) || DISTRICTS[0];
}

// Circle vs buildings: returns the building hit, or null.
export function hitBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    const nx = clamp(x, b.x, b.x + b.w), ny = clamp(y, b.y, b.y + b.h);
    const dx = x - nx, dy = y - ny;
    if (dx * dx + dy * dy < r * r) return b;
  }
  return null;
}

// Push a circle out of buildings; returns true when a push happened.
export function resolveBuildings(city, p, r) {
  let hit = false;
  for (const b of city.buildings) {
    const nx = clamp(p.x, b.x, b.x + b.w), ny = clamp(p.y, b.y, b.y + b.h);
    const dx = p.x - nx, dy = p.y - ny, d2 = dx * dx + dy * dy;
    if (d2 < r * r && d2 > 0.01) {
      const d = Math.sqrt(d2);
      p.x = nx + (dx / d) * r; p.y = ny + (dy / d) * r; hit = true;
    } else if (d2 <= 0.01) {
      p.x = b.x - r - 1; hit = true;
    }
  }
  return hit;
}

export function drawCity(ctx, city, cam, G) {
  const x0 = Math.max(0, cam.x - 40), y0 = Math.max(0, cam.y - 40);
  const x1 = Math.min(WORLD.w, cam.x + cam.w + 40), y1 = Math.min(WORLD.h, cam.y + cam.h + 40);
  // Ground: grass/sand base.
  ctx.fillStyle = '#5d7d4a';
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  // Beach strip along the south edge.
  ctx.fillStyle = '#d9c08a';
  ctx.fillRect(x0, 3300, x1 - x0, 300);
  ctx.fillStyle = '#3f8fbf';
  ctx.fillRect(x0, 3520, x1 - x0, 80);
  // Parks.
  for (const p of city.parks) {
    if (p.x > x1 || p.y > y1 || p.x + p.w < x0 || p.y + p.h < y0) continue;
    ctx.fillStyle = '#4c8a3f';
    ctx.fillRect(p.x, p.y, p.w, p.h);
  }
  // Roads: dark asphalt + centre dashes.
  ctx.fillStyle = '#33363d';
  const gap = WORLD.roadGap, road = WORLD.roadWidth;
  for (let gx = 0; gx <= 12; gx++) {
    const rx = gx * gap - road / 2;
    if (rx + road < x0 || rx > x1) continue;
    ctx.fillRect(rx, y0, road, y1 - y0);
  }
  for (let gy = 0; gy <= 12; gy++) {
    const ry = gy * gap - road / 2;
    if (ry + road < y0 || ry > y1) continue;
    ctx.fillRect(x0, ry, x1 - x0, road);
  }
  // Lane dashes.
  ctx.fillStyle = '#d8d8c8';
  for (let gx = 0; gx <= 12; gx++) {
    const rx = gx * gap;
    if (rx < x0 || rx > x1) continue;
    for (let y = Math.floor(y0 / 36) * 36; y < y1; y += 36) ctx.fillRect(rx - 2, y, 4, 18);
  }
  for (let gy = 0; gy <= 12; gy++) {
    const ry = gy * gap;
    if (ry < y0 || ry > y1) continue;
    for (let x = Math.floor(x0 / 36) * 36; x < x1; x += 36) ctx.fillRect(x, ry - 2, 18, 4);
  }
  // Trees.
  for (const t of city.trees) {
    if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
    ctx.fillStyle = '#2f6b2f';
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
  }
  // Buildings with a simple 3D-ish top face.
  for (const b of city.buildings) {
    if (b.x > x1 || b.y > y1 || b.x + b.w < x0 || b.y + b.h < y0) continue;
    const lift = Math.min(14, b.hgt * 0.25);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + lift, b.y + lift, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
    if (b.windows) {
      ctx.fillStyle = 'rgba(255,240,180,0.85)';
      const cols = Math.max(1, Math.floor(b.w / 22));
      for (let i = 0; i < cols; i++) ctx.fillRect(b.x + 8 + i * 22, b.y + 8, 8, 6);
    }
  }
  // Ramps.
  for (const r of city.ramps) {
    ctx.save();
    ctx.translate(r.x, r.y); ctx.rotate(r.angle);
    ctx.fillStyle = '#ffcf3f';
    ctx.fillRect(-r.w / 2, -r.h / 2, r.w, r.h);
    ctx.fillStyle = '#222';
    ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center';
    ctx.fillText('RAMP', 0, 5);
    ctx.restore();
  }
  drawLandmarks(ctx, city, x0, y0, x1, y1, G);
}

function drawLandmarks(ctx, city, x0, y0, x1, y1, G) {
  const mark = (x, y, label, color) => {
    if (x < x0 || x > x1 || y < y0 || y > y1) return;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
    ctx.fillText(label, x, y - 18);
  };
  mark(city.garage.x, city.garage.y, 'GARAGE', '#ff5a5a');
  mark(city.gunstore.x, city.gunstore.y, 'GUN STORE', '#7fd1ff');
  mark(city.hospital.x, city.hospital.y, 'HOSPITAL', '#7dff8a');
  for (const b of city.businesses) {
    const owned = G && G.businesses && G.businesses.owned.includes(b.id);
    mark(b.x, b.y, owned ? b.name.toUpperCase() + ' ✓' : b.name.toUpperCase(), owned ? '#ffd166' : '#c9a86a');
  }
}
