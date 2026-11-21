// Cars: physics, traffic AI, spawning, drawing. A car is a plain object;
// the player car, traffic, police and parked cars all share the same shape.
import { CARS, WORLD } from './config.js';
import { clamp, rand, randi, pick, angleDiff, angleLerp, dist, angleTo } from './util.js';
import { resolveBuildings, isOnRoad } from './city.js';
import { addSkid, spawnSmoke, spawnFlame, spawnBurst } from './effects.js';
import { sfx } from './audio.js';

let carSeq = 1;

export function makeCar(defId, x, y, angle, kind) {
  const def = CARS.find((c) => c.id === defId) || CARS[0];
  return {
    id: carSeq++, defId: def.id, name: def.name, kind: kind || 'traffic',
    x, y, angle: angle || 0, speed: 0,
    top: def.top, accel: def.accel, grip: def.grip,
    color: def.color, len: def.len, wid: def.wid,
    hp: 100, nos: 100, upgrades: { engine: 0, armor: 0, nos: 0 },
    driver: null, target: null, stuck: 0, siren: 0,
  };
}

export function spawnTraffic(G, n) {
  for (let i = 0; i < n; i++) {
    const x = rand(200, WORLD.w - 200), y = rand(200, WORLD.h - 200);
    if (!isOnRoad(x, y)) continue;
    if (dist(x, y, G.player.x, G.player.y) < 500) continue;
    const c = makeCar(pick(['sedan', 'sedan', 'taxi', 'coupe', 'muscle']), x, y, pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]), 'traffic');
    c.color = pick(['#c0392b', '#2980b9', '#f1c40f', '#7f8c8d', '#16a085', '#d35400', '#ecf0f1']);
    c.speed = rand(60, 140);
    G.cars.push(c);
  }
}

export function spawnParked(G, n) {
  const spots = [
    { x: 1860, y: 960, def: 'coupe' }, { x: 960, y: 1860, def: 'muscle' },
    { x: 2760, y: 1560, def: 'sedan' }, { x: 1260, y: 2760, def: 'taxi' },
    { x: 3060, y: 660, def: 'sport' }, { x: 660, y: 3060, def: 'sedan' },
    { x: 2160, y: 2160, def: 'coupe' }, { x: 360, y: 1260, def: 'muscle' },
  ];
  for (let i = 0; i < Math.min(n, spots.length); i++) {
    const s = spots[i];
    const c = makeCar(s.def, s.x, s.y, pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]), 'parked');
    G.cars.push(c);
  }
}

function roadAngle(x, y) {
  const gap = WORLD.roadGap;
  const mx = x % gap, my = y % gap;
  const nearV = Math.min(mx, gap - mx), nearH = Math.min(my, gap - my);
  return nearV < nearH ? (mx < gap / 2 ? Math.PI / 2 : -Math.PI / 2) : (my < gap / 2 ? 0 : Math.PI);
}

export function updateCars(G, dt) {
  const p = G.player;
  for (const c of G.cars) {
    if (c.kind === 'parked') continue;
    if (c.kind === 'traffic') {
      // Follow the road grid; turn at intersections.
      const target = roadAngle(c.x, c.y);
      c.angle = angleLerp(c.angle, target, clamp(dt * 1.6, 0, 1));
      c.speed = Math.min(c.speed + c.accel * dt * 0.4, 150);
      // Slow down for the car ahead.
      for (const o of G.cars) {
        if (o === c || o.kind === 'parked') continue;
        if (dist(c.x, c.y, o.x, o.y) < 70 && Math.abs(angleDiff(c.angle, angleTo(c.x, c.y, o.x, o.y))) < 0.6) {
          c.speed = Math.max(0, c.speed - 300 * dt);
        }
      }
    } else if (c.kind === 'police') {
      updatePoliceCar(G, c, dt);
    }
    stepCar(G, c, dt, 0);
    if (c.hp <= 0 && c.kind !== 'player') {
      spawnBurst(G.fx, c.x, c.y, '#ff7b00', 10, 160);
      c.kind = 'wreck';
      c.speed = 0;
    }
  }
  // Despawn far traffic, respawn near the player.
  const before = G.cars.length;
  G.cars = G.cars.filter((c) => c.kind === 'player' || c.kind === 'parked' || c.kind === 'police' || dist(c.x, c.y, p.x, p.y) < 1600);
  if (G.cars.length < before - 2) spawnTraffic(G, 3);
  // Player car physics is driven from main.js via stepPlayerCar.
}

export function stepCar(G, c, dt, steerInput) {
  const prevX = c.x, prevY = c.y;
  c.x += Math.cos(c.angle) * c.speed * dt;
  c.y += Math.sin(c.angle) * c.speed * dt;
  c.x = clamp(c.x, 40, WORLD.w - 40);
  c.y = clamp(c.y, 40, WORLD.h - 40);
  const hit = resolveBuildings(G.city, c, c.wid * 0.7);
  if (hit) {
    c.speed *= -0.25;
    if (Math.abs(c.speed) > 120) { sfx('crash'); }
    c.x = prevX; c.y = prevY;
  }
  // Car-car collision: simple push apart.
  for (const o of G.cars) {
    if (o === c) continue;
    const d = dist(c.x, c.y, o.x, o.y);
    if (d < 40 && d > 0.1) {
      const push = (40 - d) / 2;
      const a = angleTo(o.x, o.y, c.x, c.y);
      c.x += Math.cos(a) * push; c.y += Math.sin(a) * push;
      if (c.kind === 'player' && Math.abs(c.speed) > 200) sfx('crash');
    }
  }
  // Skid marks when drifting hard.
  if (Math.abs(steerInput) > 0.7 && Math.abs(c.speed) > 220) {
    addSkid(G.fx, c.x - Math.cos(c.angle) * c.len * 0.4, c.y - Math.sin(c.angle) * c.len * 0.4, c.angle);
  }
  if (c.hp < 40 && Math.random() < dt * 4) spawnSmoke(G.fx, c.x, c.y);
}

export function stepPlayerCar(G, dt, input) {
  const c = G.player.car;
  if (!c) return;
  const fwd = (input.keys.KeyW || input.keys.ArrowUp) ? 1 : 0;
  const back = (input.keys.KeyS || input.keys.ArrowDown) ? 1 : 0;
  const left = (input.keys.KeyA || input.keys.ArrowLeft) ? 1 : 0;
  const right = (input.keys.KeyD || input.keys.ArrowRight) ? 1 : 0;
  const hand = input.keys.Space ? 1 : 0;
  const nos = input.keys.ShiftLeft || input.keys.ShiftRight;
  const up = c.upgrades || { engine: 0, armor: 0, nos: 0 };
  const top = c.top * (1 + up.engine * 0.12);
  const accel = c.accel * (1 + up.engine * 0.15);
  if (fwd) c.speed += accel * dt;
  if (back) c.speed -= accel * 0.7 * dt;
  if (!fwd && !back) c.speed -= Math.sign(c.speed) * Math.min(Math.abs(c.speed), 160 * dt);
  if (nos && c.nos > 0 && fwd) {
    c.speed += accel * 1.6 * dt;
    c.nos = Math.max(0, c.nos - 34 * dt);
    spawnFlame(G.fx, c.x - Math.cos(c.angle) * c.len * 0.6, c.y - Math.sin(c.angle) * c.len * 0.6, c.angle + Math.PI);
    if (Math.random() < dt * 8) sfx('nos');
  } else {
    c.nos = Math.min(100, c.nos + (up.nos ? 9 : 5) * dt);
  }
  c.speed = clamp(c.speed, -top * 0.45, top * (nos && c.nos > 0 ? 1.25 : 1));
  const steer = (right - left) * (c.speed >= 0 ? 1 : -1) * (hand ? 1.5 : 1);
  const turnRate = c.grip * (hand ? 1.35 : 1) * clamp(Math.abs(c.speed) / 160, 0.25, 1);
  c.angle += steer * turnRate * dt;
  if (hand) c.speed *= (1 - 0.9 * dt);
  stepCar(G, c, dt, steer);
  G.player.x = c.x; G.player.y = c.y; G.player.angle = c.angle;
  // Stunt ramp check.
  for (const r of G.city.ramps) {
    if (dist(c.x, c.y, r.x, r.y) < 34 && Math.abs(c.speed) > 300 && !G.player.airborne) {
      G.player.airborne = 0.7;
      G.player.airTime = 0;
      sfx('jump');
    }
  }
  if (G.player.airborne) {
    G.player.airborne -= dt;
    G.player.airTime = (G.player.airTime || 0) + dt;
    if (G.player.airborne <= 0) {
      const bonus = Math.floor(G.player.airTime * 120);
      if (bonus > 40) {
        G.money += bonus;
        addText(G.fx, c.x, c.y - 30, 'STUNT +$' + bonus, '#ffd166');
        sfx('cash');
      }
      G.player.airborne = 0;
    }
  }
}

function updatePoliceCar(G, c, dt) {
  const p = G.player;
  const target = p.car || p;
  const a = angleTo(c.x, c.y, target.x, target.y);
  c.angle = angleLerp(c.angle, a, clamp(dt * 2.2, 0, 1));
  const want = G.wanted >= 3 ? 430 : 360;
  c.speed = Math.min(c.speed + 420 * dt, want);
  c.siren += dt;
  if (c.siren > 1.1) { c.siren = 0; sfx('siren'); }
  // Ram the player when close.
  if (dist(c.x, c.y, target.x, target.y) < 46) {
    if (p.car) { p.car.hp -= 6 * dt * 10; p.car.speed *= 0.92; }
    else { hurtPlayer(G, 8 * dt); }
    if (Math.random() < dt * 3) sfx('crash');
  }
}

export function hurtPlayer(G, dmg) {
  if (G.player.armor > 0) {
    const absorbed = Math.min(G.player.armor, dmg);
    G.player.armor -= absorbed;
    dmg -= absorbed;
  }
  G.player.health -= dmg;
  if (G.player.health <= 0) {
    G.player.health = 0;
    G.mode = 'dead';
    sfx('fail');
  }
}

export function drawCars(ctx, G, cam) {
  for (const c of G.cars) {
    if (c.x < cam.x - 80 || c.y < cam.y - 80 || c.x > cam.x + cam.w + 80 || c.y > cam.y + cam.h + 80) continue;
    ctx.save();
    ctx.translate(c.x - cam.x, c.y - cam.y);
    ctx.rotate(c.angle);
    if (c.kind === 'wreck') ctx.globalAlpha = 0.7;
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-c.len / 2 + 3, -c.wid / 2 + 3, c.len, c.wid);
    // Body.
    ctx.fillStyle = c.color;
    roundRect(ctx, -c.len / 2, -c.wid / 2, c.len, c.wid, 6);
    ctx.fill();
    // Cabin.
    ctx.fillStyle = 'rgba(20,30,45,0.9)';
    roundRect(ctx, -c.len * 0.22, -c.wid * 0.32, c.len * 0.4, c.wid * 0.64, 4);
    ctx.fill();
    // Headlights at night.
    if (G.clock < 6 || G.clock >= 18) {
      ctx.fillStyle = '#fff8c0';
      ctx.fillRect(c.len / 2 - 2, -c.wid / 2 + 2, 4, 4);
      ctx.fillRect(c.len / 2 - 2, c.wid / 2 - 6, 4, 4);
    }
    if (c.kind === 'police') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(-c.len * 0.3, -c.wid / 2, c.len * 0.6, 5);
      ctx.fillStyle = c.siren < 0.55 ? '#ff2d2d' : '#2d7dff';
      ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
    }
    if (c.kind === 'player') {
      ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2;
      roundRect(ctx, -c.len / 2 - 3, -c.wid / 2 - 3, c.len + 6, c.wid + 6, 8);
      ctx.stroke();
    }
    ctx.restore();
  }
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
