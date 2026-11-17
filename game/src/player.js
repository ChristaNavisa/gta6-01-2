// The player on foot: walk, sprint, enter/exit cars, aim and shoot.
import { PLAYER, KEYS, WORLD_W, WORLD_H, WANTED } from './config.js';
import { clamp, dist, angleTo } from './random.js';
import { pointInBuilding } from './city.js';
import { sfx } from './audio.js';
import { spawnBurst } from './effects.js';

export function createPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2,
    hp: PLAYER.maxHp, armor: 0,
    cash: 0, ammo: PLAYER.startAmmo,
    onFoot: true, car: null,
    speed: 0, moving: false,
    shootCooldown: 0,
    aimX: 0, aimY: 0,
    invuln: 0,
  };
}

export function updatePlayer(S, dt) {
  const p = S.player;
  const input = S.input;
  if (p.hp <= 0) return;
  if (p.invuln > 0) p.invuln -= dt;
  if (p.shootCooldown > 0) p.shootCooldown -= dt;

  if (!p.onFoot && p.car) return; // driving is handled by vehicles.driveCar

  // Aim at the mouse in world space.
  p.aimX = S.camera.x + (input.mouseX - S.view.w / 2) / S.camera.zoom;
  p.aimY = S.camera.y + (input.mouseY - S.view.h / 2) / S.camera.zoom;
  p.angle = angleTo(p.x, p.y, p.aimX, p.aimY);

  // Movement.
  let mx = 0, my = 0;
  if (input.keys.has('KeyW') || input.keys.has('ArrowUp')) my -= 1;
  if (input.keys.has('KeyS') || input.keys.has('ArrowDown')) my += 1;
  if (input.keys.has('KeyA') || input.keys.has('ArrowLeft')) mx -= 1;
  if (input.keys.has('KeyD') || input.keys.has('ArrowRight')) mx += 1;
  const sprint = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');
  const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  p.moving = mx !== 0 || my !== 0;
  if (p.moving) {
    const len = Math.hypot(mx, my);
    const nx = p.x + (mx / len) * speed * dt;
    const ny = p.y + (my / len) * speed * dt;
    if (!pointInBuilding(S.city, nx, p.y, PLAYER.radius)) p.x = clamp(nx, 30, WORLD_W - 30);
    if (!pointInBuilding(S.city, p.x, ny, PLAYER.radius)) p.y = clamp(ny, 30, WORLD_H - 30);
    p.speed = speed;
  } else {
    p.speed = 0;
  }

  // Enter / exit a car.
  if (input.justPressed.has('KeyE')) {
    const near = nearestCar(S, 64);
    if (near) enterCar(S, near);
  }

  // Shoot with the mouse.
  if ((input.mouseDown || input.clicked) && p.ammo > 0 && p.shootCooldown <= 0) {
    p.shootCooldown = PLAYER.pistolCooldown;
    p.ammo -= 1;
    S.flags.shotsFired += 1;
    const a = angleTo(p.x, p.y, p.aimX, p.aimY);
    S.bullets.push({
      x: p.x + Math.cos(a) * 18, y: p.y + Math.sin(a) * 18,
      vx: Math.cos(a) * 760, vy: Math.sin(a) * 760,
      from: 'player', damage: PLAYER.pistolDamage, life: 0.7,
    });
    sfx.shoot();
    spawnBurst(S, p.x + Math.cos(a) * 22, p.y + Math.sin(a) * 22, '#ffd166', 3, 120);
    commitCrime(S, 0.25, 300);
  }
}

export function nearestCar(S, maxDist) {
  let best = null, bestD = maxDist;
  for (const c of S.cars) {
    if (c.kind === 'police' && c.driver) continue;
    const d = dist(S.player.x, S.player.y, c.x, c.y);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

export function enterCar(S, car) {
  const p = S.player;
  if (car.kind === 'parked' || car.kind === 'traffic' || car.kind === 'mission') {
    // Stealing a car in view of the law is a crime.
    car.kind = 'player';
    car.driver = false;
    if (S.wanted.level > 0 || copNearby(S, 420)) commitCrime(S, 1, 420);
    S.stats.carsStolen += 1;
    S.audio.door();
  } else if (car.kind === 'player') {
    // Re-enter your own car.
  } else {
    return;
  }
  p.car = car;
  p.onFoot = false;
  p.x = car.x; p.y = car.y;
}

export function exitCar(S) {
  const p = S.player;
  if (!p.car) return;
  const car = p.car;
  car.kind = 'parked';
  // Step out to the side of the car.
  const side = p.angle + Math.PI / 2;
  p.x = car.x + Math.cos(side) * 34;
  p.y = car.y + Math.sin(side) * 34;
  if (pointInBuilding(S.city, p.x, p.y, PLAYER.radius)) {
    p.x = car.x - Math.cos(side) * 34;
    p.y = car.y - Math.sin(side) * 34;
  }
  p.car = null;
  p.onFoot = true;
  S.audio.door();
}

export function copNearby(S, range) {
  for (const c of S.cops) if (dist(S.player.x, S.player.y, c.x, c.y) < range) return true;
  for (const c of S.cars) if (c.kind === 'police' && dist(S.player.x, S.player.y, c.x, c.y) < range) return true;
  return false;
}

// A crime adds heat; enough heat raises the wanted level.
export function commitCrime(S, stars, sightRange) {
  const w = S.wanted;
  w.heat = Math.min(5, w.heat + stars);
  w.lastCrime = S.time;
  w.decayAt = S.time + WANTED.decayDelay;
  const newLevel = Math.min(5, Math.max(w.level, Math.ceil(w.heat)));
  if (newLevel > w.level) {
    w.level = newLevel;
    S.message = wantedText(newLevel);
    S.messageT = 2.5;
    if (newLevel >= 1) S.audio.startSiren();
  }
}

export function wantedText(level) {
  return ['Clean', 'One star — the law is watching', 'Two stars — patrols on your tail', 'Three stars — the whole precinct', 'Four stars — roadblocks ahead', 'Five stars — the entire city is hunting you'][level];
}

export function hurtPlayer(S, damage) {
  const p = S.player;
  if (p.invuln > 0 || p.hp <= 0) return;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, damage);
    p.armor -= absorbed;
    damage -= absorbed;
  }
  p.hp -= damage;
  p.invuln = 0.4;
  if (p.hp <= 0) {
    p.hp = 0;
    S.flags.wasted = true;
  }
}
