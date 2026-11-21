// Weapons: five weapons, ammo, shooting, bullets, enemy hits.
import { WEAPONS } from './config.js';
import { dist, angleTo, rand, clamp } from './util.js';
import { spawnBurst, addText } from './effects.js';
import { sfx } from './audio.js';

export function ownedWeapons(G) {
  return G.player.weapons;
}

export function currentWeapon(G) {
  return WEAPONS.find((w) => w.id === G.player.weapon) || WEAPONS[0];
}

export function switchWeapon(G, id) {
  if (!G.player.weapons.includes(id)) return false;
  G.player.weapon = id;
  sfx('click');
  return true;
}

export function buyWeapon(G, id) {
  const w = WEAPONS.find((x) => x.id === id);
  if (!w || G.player.weapons.includes(id)) return false;
  if (G.money < w.price) return false;
  G.money -= w.price;
  G.player.weapons.push(id);
  G.player.ammo[id] = 60;
  sfx('cash');
  return true;
}

export function buyAmmo(G, id) {
  const w = WEAPONS.find((x) => x.id === id);
  if (!w || !G.player.weapons.includes(id) || w.ammoPrice === 0) return false;
  if (G.money < w.ammoPrice) return false;
  G.money -= w.ammoPrice;
  G.player.ammo[id] = (G.player.ammo[id] || 0) + 60;
  sfx('cash');
  return true;
}

export function tryFire(G, angle) {
  const w = currentWeapon(G);
  const p = G.player;
  if (G.fireCooldown > 0) return;
  if (w.id === 'fists') {
    G.fireCooldown = w.rate;
    // Melee arc: hit anything close in front.
    const targets = [...G.enemies, ...G.peds];
    for (const t of targets) {
      if (dist(p.x, p.y, t.x, t.y) < w.range && Math.abs(angleTo(p.x, p.y, t.x, t.y) - angle) < 0.9) {
        damageTarget(G, t, w.dmg);
      }
    }
    sfx('hit');
    return;
  }
  if ((G.player.ammo[w.id] || 0) <= 0) {
    G.fireCooldown = 0.25;
    sfx('click');
    return;
  }
  G.fireCooldown = w.rate;
  G.player.ammo[w.id]--;
  const pellets = w.pellets || 1;
  for (let i = 0; i < pellets; i++) {
    const a = angle + rand(-w.spread, w.spread);
    G.bullets.push({ x: p.x + Math.cos(angle) * 26, y: p.y + Math.sin(angle) * 26, vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed, dmg: w.dmg, range: w.range, travelled: 0 });
  }
  spawnBurst(G.fx, p.x + Math.cos(angle) * 30, p.y + Math.sin(angle) * 30, '#ffdd55', 3, 80);
  sfx(w.id === 'shotgun' ? 'shotgun' : 'shoot');
  G.player.recoil = 0.12;
}

export function damageTarget(G, t, dmg) {
  t.hp -= dmg;
  spawnBurst(G.fx, t.x, t.y, '#ff4444', 5, 100);
  if (t.hp <= 0 && !t.dead) {
    t.dead = true;
    spawnBurst(G.fx, t.x, t.y, '#ff4444', 14, 180);
    if (t.kind === 'enemy') {
      G.money += 60;
      addText(G.fx, t.x, t.y - 20, '+$60', '#ffd166');
    }
    if (t.kind === 'ped') {
      raiseWanted(G, 1);
    }
  }
}

export function raiseWanted(G, stars) {
  G.wanted = clamp(G.wanted + stars, 0, 5);
  G.heat = 100;
}

export function updateBullets(G, dt) {
  for (const b of G.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt;
    b.travelled += Math.abs(b.vx * dt) + Math.abs(b.vy * dt);
    // Hit buildings.
    const hitB = G.city.buildings.find((bb) => b.x > bb.x && b.x < bb.x + bb.w && b.y > bb.y && b.y < bb.y + bb.h);
    if (hitB) { b.dead = true; spawnBurst(G.fx, b.x, b.y, '#ccc', 3, 60); continue; }
    if (b.travelled > b.range) { b.dead = true; continue; }
    // Hit enemies / peds / police cars.
    for (const t of [...G.enemies, ...G.peds]) {
      if (t.dead) continue;
      if (dist(b.x, b.y, t.x, t.y) < 16) { damageTarget(G, t, b.dmg); b.dead = true; break; }
    }
    if (b.dead) continue;
    for (const c of G.cars) {
      if (c.kind === 'player') continue;
      if (Math.abs(b.x - c.x) < c.len / 2 && Math.abs(b.y - c.y) < c.wid / 2 + 6) {
        c.hp -= b.dmg;
        spawnBurst(G.fx, b.x, b.y, '#ffcc00', 4, 80);
        if (c.kind === 'police') raiseWanted(G, 1);
        if (c.kind === 'traffic' && c.hp < 60) raiseWanted(G, 1);
        b.dead = true;
        break;
      }
    }
  }
  G.bullets = G.bullets.filter((b) => !b.dead);
}

export function drawBullets(ctx, G, cam) {
  ctx.strokeStyle = '#ffe66d';
  ctx.lineWidth = 2;
  for (const b of G.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - cam.x - b.vx * 0.012, b.y - cam.y - b.vy * 0.012);
    ctx.lineTo(b.x - cam.x, b.y - cam.y);
    ctx.stroke();
  }
}

// Weapon wheel data for the HUD overlay.
export function wheelItems(G) {
  return WEAPONS.filter((w) => G.player.weapons.includes(w.id)).map((w) => ({
    id: w.id, name: w.name, ammo: w.id === 'fists' ? '∞' : String(G.player.ammo[w.id] || 0),
  }));
}
