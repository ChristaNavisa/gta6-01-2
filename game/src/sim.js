// World simulation: pedestrians, police response, helicopter, wanted decay,
// taxi fares, business income, pickups.
import { WORLD } from './config.js';
import { clamp, rand, randi, pick, dist, angleTo, angleLerp } from './util.js';
import { resolveBuildings, districtAt } from './city.js';
import { makeCar } from './vehicles.js';
import { raiseWanted } from './weapons.js';
import { hurtPlayer } from './vehicles.js';
import { spawnBurst, addText } from './effects.js';
import { sfx } from './audio.js';

export function spawnPeds(G, n) {
  const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#ecf0f1', '#e67e22'];
  for (let i = 0; i < n; i++) {
    const x = rand(150, WORLD.w - 150), y = rand(150, WORLD.h - 150);
    if (dist(x, y, G.player.x, G.player.y) < 320) continue;
    G.peds.push({ kind: 'ped', x, y, angle: rand(0, Math.PI * 2), speed: rand(28, 55), hp: 30, color: pick(colors), panic: 0, walkT: rand(0, 3) });
  }
}

export function updatePeds(G, dt) {
  for (const p of G.peds) {
    if (p.dead) continue;
    const dPlayer = dist(p.x, p.y, G.player.x, G.player.y);
    if (p.panic > 0) {
      p.panic -= dt;
      const a = angleTo(G.player.x, G.player.y, p.x, p.y);
      p.angle = angleLerp(p.angle, a, clamp(dt * 4, 0, 1));
      p.x += Math.cos(p.angle) * 130 * dt;
      p.y += Math.sin(p.angle) * 130 * dt;
    } else {
      p.walkT -= dt;
      if (p.walkT <= 0) { p.walkT = rand(2, 5); p.angle = rand(0, Math.PI * 2); }
      p.x += Math.cos(p.angle) * p.speed * dt;
      p.y += Math.sin(p.angle) * p.speed * dt;
      // Flee from gunfire and fast cars.
      if (dPlayer < 120 && (G.player.car ? Math.abs(G.player.car.speed) > 260 : G.shotsFiredRecently)) {
        p.panic = 2.5;
      }
    }
    p.x = clamp(p.x, 60, WORLD.w - 60);
    p.y = clamp(p.y, 60, WORLD.h - 60);
    resolveBuildings(G.city, p, 10);
  }
  G.peds = G.peds.filter((p) => !p.dead && dist(p.x, p.y, G.player.x, G.player.y) < 1800);
  if (G.peds.length < 22) spawnPeds(G, 4);
}

export function updatePolice(G, dt) {
  // Heat decays when the player stays out of sight; wanted drops a star.
  if (G.wanted > 0) {
    const copsNear = G.cars.some((c) => c.kind === 'police' && dist(c.x, c.y, G.player.x, G.player.y) < 420);
    G.heat -= dt * (copsNear ? 2 : 9);
    if (G.heat <= 0) {
      G.wanted--;
      G.heat = G.wanted > 0 ? 100 : 0;
      if (G.wanted === 0) addText(G.fx, G.player.x, G.player.y - 30, 'HEAT CLEARED', '#7dff8a');
    }
  }
  // Spawn police to match the wanted level.
  const wantCount = G.wanted === 0 ? 0 : G.wanted === 1 ? 1 : G.wanted === 2 ? 2 : G.wanted === 3 ? 3 : G.wanted === 4 ? 4 : 5;
  const cops = G.cars.filter((c) => c.kind === 'police');
  if (cops.length < wantCount) {
    const a = rand(0, Math.PI * 2);
    const x = clamp(G.player.x + Math.cos(a) * 700, 80, WORLD.w - 80);
    const y = clamp(G.player.y + Math.sin(a) * 700, 80, WORLD.h - 80);
    const c = makeCar('sedan', x, y, 0, 'police');
    c.color = '#222831'; c.top = 460; c.accel = 420;
    G.cars.push(c);
  }
  if (cops.length > wantCount) {
    const far = cops.sort((a, b) => dist(b.x, b.y, G.player.x, G.player.y) - dist(a.x, a.y, G.player.x, G.player.y))[0];
    G.cars.splice(G.cars.indexOf(far), 1);
  }
  // Military jeeps at 5 stars.
  const jeeps = G.cars.filter((c) => c.kind === 'jeep');
  if (G.wanted >= 5 && jeeps.length < 2) {
    const a = rand(0, Math.PI * 2);
    const j = makeCar('muscle', clamp(G.player.x + Math.cos(a) * 800, 80, WORLD.w - 80), clamp(G.player.y + Math.sin(a) * 800, 80, WORLD.h - 80), 0, 'jeep');
    j.color = '#3a5f2f'; j.top = 480; j.accel = 460;
    G.cars.push(j);
  }
  if (G.wanted < 5) {
    G.cars = G.cars.filter((c) => c.kind !== 'jeep');
  }
  // Helicopter at 3+ stars: circles the player and spotlights.
  if (G.wanted >= 3) {
    if (!G.heli) G.heli = { angle: 0, r: 260, x: G.player.x, y: G.player.y };
    G.heli.angle += dt * 0.5;
    G.heli.x = G.player.x + Math.cos(G.heli.angle) * G.heli.r;
    G.heli.y = G.player.y + Math.sin(G.heli.angle) * G.heli.r;
    if (Math.random() < dt * 0.5) raiseWanted(G, 0); // heli keeps heat up
  } else {
    G.heli = null;
  }
  // Player running over peds in a car.
  if (G.player.car && Math.abs(G.player.car.speed) > 140) {
    for (const p of G.peds) {
      if (!p.dead && dist(p.x, p.y, G.player.x, G.player.y) < 26) {
        p.dead = true;
        spawnBurst(G.fx, p.x, p.y, '#ff4444', 8, 120);
        raiseWanted(G, 1);
      }
    }
  }
}

export function drawHeli(ctx, G, cam) {
  if (!G.heli) return;
  const x = G.heli.x - cam.x, y = G.heli.y - cam.y;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(255,255,200,0.10)';
  ctx.beginPath(); ctx.arc(0, 0, 190, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1c2733';
  ctx.beginPath(); ctx.ellipse(0, 0, 34, 14, 0.4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#888'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-40, 0); ctx.lineTo(40, 0); ctx.stroke();
  ctx.fillStyle = '#ff2d2d';
  ctx.beginPath(); ctx.arc(18, 0, 4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function drawPeds(ctx, G, cam) {
  for (const p of G.peds) {
    if (p.x < cam.x - 30 || p.y < cam.y - 30 || p.x > cam.x + cam.w + 30 || p.y > cam.y + cam.h + 30) continue;
    const x = p.x - cam.x, y = p.y - cam.y;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(x, y + 8, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f5d0a9';
    ctx.beginPath(); ctx.arc(x + Math.cos(p.angle) * 4, y + Math.sin(p.angle) * 4, 5, 0, Math.PI * 2); ctx.fill();
  }
}

// ---- Taxi side activity ----
export function startTaxiFare(G) {
  const a = rand(0, Math.PI * 2);
  const px = clamp(G.player.x + Math.cos(a) * rand(300, 600), 100, WORLD.w - 100);
  const py = clamp(G.player.y + Math.sin(a) * rand(300, 600), 100, WORLD.h - 100);
  const dx = clamp(px + rand(-900, 900), 100, WORLD.w - 100);
  const dy = clamp(py + rand(-900, 900), 100, WORLD.h - 100);
  G.taxi = { stage: 'pickup', px, py, dx, dy, fare: randi(120, 320), timer: 90 };
}

export function updateTaxi(G, dt) {
  if (!G.taxi) return;
  const t = G.taxi;
  t.timer -= dt;
  if (t.timer <= 0) { G.taxi = null; addText(G.fx, G.player.x, G.player.y - 30, 'FARE LOST', '#ff5a5a'); return; }
  const target = t.stage === 'pickup' ? { x: t.px, y: t.py } : { x: t.dx, y: t.dy };
  if (dist(G.player.x, G.player.y, target.x, target.y) < 46) {
    if (t.stage === 'pickup') {
      t.stage = 'dropoff';
      t.timer = 90;
      addText(G.fx, target.x, target.y - 24, 'PASSENGER IN!', '#ffd166');
      sfx('pickup');
    } else {
      G.money += t.fare;
      addText(G.fx, target.x, target.y - 24, 'FARE +$' + t.fare, '#ffd166');
      sfx('cash');
      G.stats.fares++;
      gainRespect(G, districtAt(target.x, target.y).id, 4);
      G.taxi = null;
      if (G.mission) G.mission.taxiDone = (G.mission.taxiDone || 0) + 1;
    }
  }
}

// ---- Businesses ----
export function updateBusinesses(G, dt) {
  G.businessIncome = G.businessIncome || 0;
  let rate = 0;
  for (const id of G.businesses.owned) {
    const b = G.city.businesses.find((x) => x.id === id);
    if (b) rate += b.income;
  }
  if (rate > 0) {
    G.businessIncome += (rate / 60) * dt;
    if (G.businessIncome >= 50) {
      const take = Math.floor(G.businessIncome);
      G.money += take;
      G.businessIncome -= take;
      addText(G.fx, G.player.x, G.player.y - 40, 'BUSINESS +$' + take, '#ffd166');
    }
  }
}

export function buyBusiness(G, id) {
  const b = G.city.businesses.find((x) => x.id === id);
  if (!b || G.businesses.owned.includes(id)) return false;
  if (G.money < b.price) return false;
  G.money -= b.price;
  G.businesses.owned.push(id);
  sfx('cash');
  return true;
}

// ---- Respect / crew ----
export function gainRespect(G, districtId, n) {
  G.crew.respect[districtId] = clamp((G.crew.respect[districtId] || 0) + n, 0, 100);
}

export function respectDiscount(G) {
  const d = districtAt(G.player.x, G.player.y);
  const r = G.crew.respect[d.id] || 0;
  return r >= 75 ? 0.25 : r >= 50 ? 0.15 : r >= 25 ? 0.1 : 0;
}
