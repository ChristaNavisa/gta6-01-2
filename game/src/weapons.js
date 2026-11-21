// VERDE BAY v9 — combat: five weapons and the weapon wheel. The player shoots
// with the mouse; hits are resolved against police, rivals and vehicles in
// front of the player. The wheel (hold Q, or keys 1–5) switches weapons.
import { WEAPONS } from './config.js';
import { clamp, dist2d } from './util.js';

export class Weapons {
  constructor(sim) {
    this.sim = sim;
    this.owned = [true, false, false, false, false]; // pistol owned from the start
    this.ammo = WEAPONS.map((w) => w.ammo);
    this.current = 0;
    this.cooldown = 0;
    this.wheelOpen = false;
    this.kills = 0;
  }
  def() { return WEAPONS[this.current]; }
  name() { return this.def().name; }
  unlock(index) { this.owned[index] = true; }
  select(index) {
    if (index < 0 || index >= WEAPONS.length) return false;
    if (!this.owned[index]) return false;
    this.current = index;
    return true;
  }
  cycle(dir) {
    for (let i = 0; i < WEAPONS.length; i++) {
      const idx = (this.current + dir + WEAPONS.length * 2) % WEAPONS.length;
      if (this.owned[idx]) { this.current = idx; return; }
    }
  }
  // Fire one shot (or one pellet spread). Returns the hit list for effects.
  fire(px, pz, heading) {
    const w = this.def();
    if (this.cooldown > 0 || this.ammo[this.current] <= 0) return null;
    this.cooldown = w.rate;
    this.ammo[this.current] -= 1;
    const hits = [];
    const pellets = w.pellets || 1;
    const sim = this.sim;
    const targets = [];
    for (const ped of sim.peds) if (!ped.dead) targets.push({ kind: 'ped', obj: ped, x: ped.x, z: ped.z, r: 1.2 });
    for (const cop of sim.policeCars) if (!cop.dead) targets.push({ kind: 'car', obj: cop, x: cop.x, z: cop.z, r: 3 });
    for (const v of sim.vehicles) {
      if (v.dead || v.isPlayer) continue;
      targets.push({ kind: 'car', obj: v, x: v.x, z: v.z, r: 3 });
    }
    for (let p = 0; p < pellets; p++) {
      const spread = (Math.random() - 0.5) * (w.pellets ? 0.16 : 0.03);
      const dir = heading + spread;
      let best = null; let bestD = w.range;
      for (const t of targets) {
        const dx = t.x - px; const dz = t.z - pz;
        const d = Math.hypot(dx, dz);
        if (d > w.range + t.r || d < 0.5) continue;
        const ang = Math.atan2(dx, dz);
        let diff = ang - dir;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const lateral = Math.abs(Math.sin(diff)) * d;
        if (lateral < t.r + 0.6 && d < bestD) { best = t; bestD = d; }
      }
      if (best) {
        const dmg = w.damage * (best.kind === 'car' ? 0.6 : 1);
        hits.push({ target: best, damage: dmg, dist: bestD });
      }
    }
    return { weapon: w, hits, origin: { x: px, z: pz }, heading };
  }
  update(dt) { this.cooldown = Math.max(0, this.cooldown - dt); }
  // Ammo for the HUD: current weapon / total owned.
  hudLine() {
    const w = this.def();
    return w.name + '  ' + this.ammo[this.current] + ' / ' + WEAPONS.filter((_, i) => this.owned[i]).length + ' owned';
  }
  wheelItems() {
    return WEAPONS.map((w, i) => ({
      name: w.name, slot: w.slot, owned: this.owned[i], selected: i === this.current,
      ammo: this.ammo[i],
    }));
  }
  // Cheat-free shop: weapons are bought with mission money at shops.
  buy(index, money) {
    const prices = [0, 1200, 2200, 3500, 5000];
    if (this.owned[index]) return { ok: false, reason: 'Already owned' };
    if (money < prices[index]) return { ok: false, reason: 'Not enough money' };
    this.owned[index] = true;
    return { ok: true, cost: prices[index] };
  }
  static price(index) { return [0, 1200, 2200, 3500, 5000][index]; }
  static applyDamage(sim, hit) {
    const t = hit.target;
    if (t.kind === 'ped') {
      t.obj.health -= hit.damage;
      if (t.obj.health <= 0 && !t.obj.dead) {
        t.obj.dead = true;
        sim.effects.blood(t.obj.x, 1, t.obj.z);
        sim.weapons.kills += 1;
        sim.onKill(t.obj);
      }
    } else {
      const dead = t.obj.damage(hit.damage);
      if (dead) {
        sim.effects.explosion(t.obj.x, 0, t.obj.z);
        sim.audio.crash();
        if (t.obj.isPolice) sim.addWanted(1, 'destroyed police car');
      }
    }
  }
  static clampAmmo(a) { return clamp(a, 0, 999); }
  static weaponCount() { return WEAPONS.length; }
}
