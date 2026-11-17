// Canvas rendering for Verde Bay: city, cars, people, effects and warm sunlight.
import { WORLD_W, WORLD_H, ROAD_X, ROAD_Y, ROAD_W, BEACH_Y, WATER_Y, PALETTE } from './config.js';
import { clamp } from './random.js';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function render(S) {
  const ctx = S.ctx;
  const view = S.view;
  const cam = S.camera;
  ctx.clearRect(0, 0, view.w, view.h);
  ctx.save();
  ctx.translate(view.w / 2, view.h / 2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x, -cam.y);

  drawGround(S, ctx);
  drawRoads(S, ctx);
  drawParks(S, ctx);
  drawBuildings(S, ctx);
  drawTrees(S, ctx);
  drawSkids(S, ctx);
  drawMarker(S, ctx);
  drawCars(S, ctx);
  drawPeds(S, ctx);
  drawPlayer(S, ctx);
  drawBullets(S, ctx);
  drawParticles(S, ctx);
  drawFloaters(S, ctx);
  ctx.restore();

  drawSunlight(S, ctx);
  drawEdgeArrow(S, ctx);
}

function drawGround(S, ctx) {
  ctx.fillStyle = PALETTE.ground;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  // Beach and sea along the south edge.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(0, BEACH_Y, WORLD_W, WATER_Y - BEACH_Y);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(0, WATER_Y, WORLD_W, WORLD_H - WATER_Y);
  ctx.fillStyle = PALETTE.waterDeep;
  for (let x = 40; x < WORLD_W; x += 140) {
    ctx.beginPath();
    ctx.moveTo(x, WATER_Y + 22 + Math.sin(S.time * 1.4 + x * 0.01) * 4);
    ctx.lineTo(x + 70, WATER_Y + 22 + Math.sin(S.time * 1.4 + x * 0.01 + 1) * 4);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  // Marina pier.
  ctx.fillStyle = '#8d6e63';
  ctx.fillRect(2080, BEACH_Y + 30, 150, 14);
  ctx.fillRect(2140, BEACH_Y + 30, 14, 60);
}

function drawRoads(S, ctx) {
  // Sidewalk strips first, then asphalt, then centre dashes.
  for (const rx of ROAD_X) {
    ctx.fillStyle = PALETTE.sidewalk;
    ctx.fillRect(rx - ROAD_W / 2 - 18, 0, ROAD_W + 36, BEACH_Y);
  }
  for (const ry of ROAD_Y) {
    ctx.fillStyle = PALETTE.sidewalk;
    ctx.fillRect(0, ry - ROAD_W / 2 - 18, WORLD_W, ROAD_W + 36);
  }
  for (const rx of ROAD_X) {
    ctx.fillStyle = PALETTE.asphalt;
    ctx.fillRect(rx - ROAD_W / 2, 0, ROAD_W, BEACH_Y);
  }
  for (const ry of ROAD_Y) {
    ctx.fillStyle = PALETTE.asphalt;
    ctx.fillRect(0, ry - ROAD_W / 2, WORLD_W, ROAD_W);
  }
  // Centre dashes.
  ctx.fillStyle = PALETTE.roadLine;
  for (const rx of ROAD_X) {
    for (let y = 20; y < BEACH_Y; y += 56) ctx.fillRect(rx - 2, y, 4, 28);
  }
  for (const ry of ROAD_Y) {
    for (let x = 20; x < WORLD_W; x += 56) ctx.fillRect(x, ry - 2, 28, 4);
  }
  // Crosswalks at intersections.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (const rx of ROAD_X) for (const ry of ROAD_Y) {
    for (let i = -3; i <= 3; i++) ctx.fillRect(rx + i * 9 - 3, ry - ROAD_W / 2 + 4, 6, 12);
  }
}

function drawParks(S, ctx) {
  for (const p of S.city.parks) {
    ctx.fillStyle = PALETTE.park;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = '#8bc34a';
    ctx.fillRect(p.x + p.w / 2 - 6, p.y, 12, p.h);
  }
}

function drawBuildings(S, ctx) {
  for (const b of S.city.buildings) {
    // Drop shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    // Walls and roof.
    ctx.fillStyle = b.wall;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
    // Windows on the roof face.
    ctx.fillStyle = PALETTE.glass;
    const cols = Math.max(1, Math.floor((b.w - 16) / 18));
    const rows = Math.max(1, Math.floor((b.h - 16) / 18));
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if ((c + r * 2) % 3 === 0) continue;
        ctx.fillRect(b.x + 9 + c * 18, b.y + 9 + r * 18, 10, 8);
      }
    }
    if (b.tall) {
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, 10);
    }
  }
}

function drawTrees(S, ctx) {
  for (const t of S.city.trees) {
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(t.x + 3, t.y + 4, t.r, t.r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = PALETTE.tree;
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = PALETTE.treeLight;
    ctx.beginPath(); ctx.arc(t.x - 3, t.y - 3, t.r * 0.55, 0, Math.PI * 2); ctx.fill();
  }
}

function drawSkids(S, ctx) {
  ctx.strokeStyle = 'rgba(20,20,20,0.4)';
  ctx.lineWidth = 4;
  for (const s of S.skids) {
    ctx.beginPath();
    ctx.moveTo(s.x - Math.cos(s.angle) * 12, s.y - Math.sin(s.angle) * 12);
    ctx.lineTo(s.x + Math.cos(s.angle) * 12, s.y + Math.sin(s.angle) * 12);
    ctx.stroke();
  }
}

function drawMarker(S, ctx) {
  const m = S.mission.marker || (S.taxi && S.taxi.marker);
  if (!m) return;
  const pulse = 1 + Math.sin(S.time * 4) * 0.12;
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(m.x, m.y, 26 * pulse, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(255,209,102,0.25)';
  ctx.beginPath(); ctx.arc(m.x, m.y, 26 * pulse, 0, Math.PI * 2); ctx.fill();
  // Light beam so the marker reads from far away.
  const grad = ctx.createLinearGradient(m.x, m.y - 160, m.x, m.y);
  grad.addColorStop(0, 'rgba(255,209,102,0)');
  grad.addColorStop(1, 'rgba(255,209,102,0.5)');
  ctx.fillStyle = grad;
  ctx.fillRect(m.x - 6, m.y - 160, 12, 160);
  ctx.fillStyle = '#ffd166';
  ctx.beginPath(); ctx.arc(m.x, m.y, 6, 0, Math.PI * 2); ctx.fill();
}

function drawCars(S, ctx) {
  for (const car of S.cars) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    rr(ctx, -car.w / 2 + 3, -car.h / 2 + 4, car.w, car.h, 8); ctx.fill();
    // Body.
    ctx.fillStyle = car.color;
    rr(ctx, -car.w / 2, -car.h / 2, car.w, car.h, 8); ctx.fill();
    // Roof + windshield.
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    rr(ctx, -car.w * 0.18, -car.h / 2 + 3, car.w * 0.36, car.h - 6, 5); ctx.fill();
    ctx.fillStyle = PALETTE.glass;
    ctx.fillRect(car.w * 0.18, -car.h / 2 + 4, 7, car.h - 8);
    // Headlights and brake lights.
    ctx.fillStyle = '#fff8c9';
    ctx.fillRect(car.w / 2 - 3, -car.h / 2 + 3, 3, 5);
    ctx.fillRect(car.w / 2 - 3, car.h / 2 - 8, 3, 5);
    ctx.fillStyle = car.brakeLight ? '#ff2e2e' : '#a31621';
    ctx.fillRect(-car.w / 2, -car.h / 2 + 3, 3, 5);
    ctx.fillRect(-car.w / 2, car.h / 2 - 8, 3, 5);
    if (car.kind === 'police') {
      const flash = Math.floor(S.time * 6) % 2 === 0;
      ctx.fillStyle = flash ? '#ff2e2e' : '#2e6bff';
      ctx.fillRect(-6, -car.h / 2 - 2, 12, 5);
      ctx.fillStyle = flash ? '#2e6bff' : '#ff2e2e';
      ctx.fillRect(-6, car.h / 2 - 3, 12, 5);
    }
    if (car.model === 'taxi') {
      ctx.fillStyle = '#111';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', 0, 3);
    }
    ctx.restore();
    // Damage smoke.
    if (car.hp < 55 && Math.random() < 0.2) {
      ctx.fillStyle = 'rgba(141,153,174,0.5)';
      ctx.beginPath(); ctx.arc(car.x - 8, car.y - 8, 6, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function drawPeds(S, ctx) {
  for (const ped of S.peds) drawPerson(ctx, ped.x, ped.y, ped.angle, ped.shirt, ped.skin, ped.state === 'down');
  for (const cop of S.cops) drawPerson(ctx, cop.x, cop.y, cop.angle, '#1a2a6c', '#e8b98a', false, true);
}

function drawPerson(ctx, x, y, angle, shirt, skin, down, isCop) {
  ctx.save();
  ctx.translate(x, y);
  if (down) { ctx.rotate(Math.PI / 2); }
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(0, 4, 10, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = shirt;
  ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(Math.cos(angle) * 3, Math.sin(angle) * 3, 5.5, 0, Math.PI * 2); ctx.fill();
  if (isCop) {
    ctx.fillStyle = '#101040';
    ctx.beginPath(); ctx.arc(Math.cos(angle) * 3, Math.sin(angle) * 3, 6.5, 0, Math.PI); ctx.fill();
  }
  ctx.restore();
}

function drawPlayer(S, ctx) {
  const p = S.player;
  if (p.hp <= 0) return;
  if (p.onFoot) {
    drawPerson(ctx, p.x, p.y, p.angle, '#d62828', '#f1c27d', false);
    // Player ring so the eye finds Cole at a glance.
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, 16 + Math.sin(S.time * 3) * 1.5, 0, Math.PI * 2); ctx.stroke();
    // Gun barrel toward the aim.
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(p.angle) * 10, p.y + Math.sin(p.angle) * 10);
    ctx.lineTo(p.x + Math.cos(p.angle) * 24, p.y + Math.sin(p.angle) * 24);
    ctx.stroke();
  } else if (p.car) {
    // A white ring under the player's car.
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(p.car.x, p.car.y, p.car.w * 0.75, p.car.h * 0.95, p.car.angle, 0, Math.PI * 2); ctx.stroke();
  }
}

function drawBullets(S, ctx) {
  ctx.strokeStyle = '#ffe66d';
  ctx.lineWidth = 2;
  for (const b of S.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.stroke();
  }
}

function drawParticles(S, ctx) {
  for (const p of S.particles) {
    const a = clamp(p.life / p.maxLife, 0, 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * a + 1, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawFloaters(S, ctx) {
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  for (const f of S.floaters) {
    ctx.globalAlpha = clamp(f.life, 0, 1);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

function drawSunlight(S, ctx) {
  // Warm afternoon light + a soft vignette, screen space.
  const g = ctx.createLinearGradient(0, 0, S.view.w, S.view.h);
  g.addColorStop(0, 'rgba(255,196,110,0.10)');
  g.addColorStop(0.5, 'rgba(255,196,110,0.03)');
  g.addColorStop(1, 'rgba(30,60,120,0.10)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S.view.w, S.view.h);
  const v = ctx.createRadialGradient(S.view.w / 2, S.view.h / 2, Math.min(S.view.w, S.view.h) * 0.42, S.view.w / 2, S.view.h / 2, Math.max(S.view.w, S.view.h) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, S.view.w, S.view.h);
}

function drawEdgeArrow(S, ctx) {
  const m = S.mission.marker || (S.taxi && S.taxi.marker);
  if (!m) return;
  const cam = S.camera;
  const sx = (m.x - cam.x) * cam.zoom + S.view.w / 2;
  const sy = (m.y - cam.y) * cam.zoom + S.view.h / 2;
  if (sx > 40 && sx < S.view.w - 40 && sy > 40 && sy < S.view.h - 40) return;
  const cx = clamp(sx, 50, S.view.w - 50);
  const cy = clamp(sy, 60, S.view.h - 50);
  const a = Math.atan2(sy - S.view.h / 2, sx - S.view.w / 2);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(a);
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.moveTo(16, 0); ctx.lineTo(-10, -11); ctx.lineTo(-10, 11); ctx.closePath();
  ctx.fill();
  ctx.restore();
}
