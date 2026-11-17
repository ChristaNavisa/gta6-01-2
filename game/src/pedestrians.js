// Pedestrians: walk the sidewalks, cross at intersections, flee from danger.
import { BEACH_Y, WORLD_W } from './config.js';
import { range, pick, chance, clamp, dist } from './random.js';
import { randomSidewalkPoint } from './city.js';

const SKINS = ['#f4d35e', '#ee964b', '#e07a5f', '#8ecae6', '#90be6d', '#f9c74f', '#b56576', '#6d6875'];
const SHIRTS = ['#e63946', '#2a9d8f', '#e9c46a', '#4361ee', '#7209b7', '#f77f00', '#06d6a0', '#ef476f', '#118ab2', '#ff70a6'];

export function makePed(rng, city, x, y, kind) {
  const p = x !== undefined ? { x, y } : randomSidewalkPoint(rng);
  return {
    x: p.x, y: p.y,
    angle: range(rng, 0, Math.PI * 2),
    speed: range(rng, 34, 62),
    kind: kind || 'walker',   // walker | gang | cop
    skin: pick(rng, SKINS),
    shirt: pick(rng, SHIRTS),
    hp: kind === 'gang' ? 60 : 100,
    state: 'walk',             // walk | flee | fight | down
    stateT: 0,
    target: null,
    shootT: range(rng, 0.5, 1.5),
    fleeFrom: null,
    bob: range(rng, 0, Math.PI * 2),
  };
}

export function updatePed(ped, S, dt) {
  const rng = S.rng;
  ped.bob += dt * 8;
  ped.stateT += dt;
  const player = S.player;
  const danger = nearestDanger(ped, S);
  if (ped.kind === 'walker' && danger && ped.state !== 'flee') {
    ped.state = 'flee';
    ped.stateT = 0;
    ped.fleeFrom = danger;
  }
  if (ped.state === 'flee') {
    const d = Math.atan2(ped.y - ped.fleeFrom.y, ped.x - ped.fleeFrom.x);
    ped.angle = d;
    ped.x += Math.cos(d) * 150 * dt;
    ped.y += Math.sin(d) * 150 * dt;
    if (ped.stateT > 2.5) { ped.state = 'walk'; ped.fleeFrom = null; }
    return;
  }
  if (ped.kind === 'gang' || ped.kind === 'cop') {
    // Fighters close in on the player and shoot when in range.
    const d = dist(ped.x, ped.y, player.x, player.y);
    if (d < 520 && player.hp > 0 && !S.flags.busted) {
      ped.state = 'fight';
      ped.angle = Math.atan2(player.y - ped.y, player.x - ped.x);
      if (d > 190) {
        ped.x += Math.cos(ped.angle) * 130 * dt;
        ped.y += Math.sin(ped.angle) * 130 * dt;
      }
      ped.shootT -= dt;
      if (ped.shootT <= 0 && d < 460) {
        ped.shootT = range(rng, 0.9, 1.7);
        S.bullets.push({
          x: ped.x, y: ped.y,
          vx: Math.cos(ped.angle + range(rng, -0.09, 0.09)) * 520,
          vy: Math.sin(ped.angle + range(rng, -0.09, 0.09)) * 520,
          from: ped.kind, damage: ped.kind === 'cop' ? 6 : 9, life: 1.1,
        });
        if (ped.kind === 'gang') S.audio.enemyShoot();
      }
      return;
    }
    ped.state = 'walk';
  }
  // Amble along: mostly straight, turn sometimes, stay on the sidewalks.
  if (Math.random() < dt * 0.25) ped.angle += range(rng, -1.2, 1.2);
  const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt;
  const ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
  ped.x = clamp(nx, 50, WORLD_W - 50);
  ped.y = clamp(ny, 50, BEACH_Y - 30);
}

function nearestDanger(ped, S) {
  const p = S.player;
  // A fast car or a gunshot nearby scares walkers.
  for (const c of S.cars) {
    if (Math.abs(c.speed) > 200 && dist(ped.x, ped.y, c.x, c.y) < 130) return { x: c.x, y: c.y };
  }
  if (S.flags.shotsFired > 0 && dist(ped.x, ped.y, p.x, p.y) < 380) return { x: p.x, y: p.y };
  return null;
}
