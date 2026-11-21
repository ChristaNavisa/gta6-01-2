// VERDE BAY v9 — crew and respect: two named crew members with abilities,
// a respect meter (0–100) that grows with missions, and district standing
// that unlocks a discount, a free car, stronger crew and the gold paint.
import { CREW_DEFS, RESPECT_TIERS, DISTRICTS } from './config.js';

export class Crew {
  constructor(sim) {
    this.sim = sim;
    this.members = CREW_DEFS.map((d) => ({ ...d, unlocked: false }));
    this.standing = {};
    for (const d of DISTRICTS) this.standing[d.id] = 0;
    this.tiersClaimed = [];
  }
  has(id) { const m = this.members.find((x) => x.id === id); return !!(m && m.unlocked); }
  unlock(id) {
    const m = this.members.find((x) => x.id === id);
    if (!m || m.unlocked) return false;
    m.unlocked = true;
    this.sim.say(m.name + ' joined your crew — ' + m.role + ': ' + m.ability + '.');
    this.sim.audio.fanfare();
    return true;
  }
  list() {
    return this.members.map((m) => ({
      name: m.name, role: m.role, ability: m.ability, unlocked: m.unlocked,
    }));
  }
  // Respect grows with missions and races; crossing a tier pays its reward.
  addRespect(n, districtId) {
    const before = this.sim.respect;
    this.sim.respect = Math.min(100, this.sim.respect + n);
    if (districtId && this.standing[districtId] !== undefined) {
      this.standing[districtId] = Math.min(100, this.standing[districtId] + n);
    }
    for (const tier of RESPECT_TIERS) {
      if (before < tier.at && this.sim.respect >= tier.at && !this.tiersClaimed.includes(tier.at)) {
        this.tiersClaimed.push(tier.at);
        this.claimTier(tier);
      }
    }
  }
  claimTier(tier) {
    if (tier.at === 50 && !this.sim.garage.ownedCars.includes('sport')) {
      this.sim.garage.ownedCars.push('sport');
      this.sim.say('Respect ' + tier.at + ' — ' + tier.label + ': ' + tier.reward + '.');
    } else if (tier.at === 100) {
      this.sim.money += 10000;
      this.sim.say('Respect 100 — ' + tier.label + ': ' + tier.reward + '.');
    } else {
      this.sim.say('Respect ' + tier.at + ' — ' + tier.label + ': ' + tier.reward + '.');
    }
  }
  // Crew ability multipliers the sim reads every frame.
  nosRefillMultiplier() {
    let m = 1;
    if (this.has('mara')) m *= this.sim.respect >= 75 ? 1.5 : 1.25;
    return m;
  }
  heatDecayMultiplier() {
    let m = 1;
    if (this.has('dario')) m *= this.sim.respect >= 75 ? 1.6 : 1.3;
    return m;
  }
  racePayoutMultiplier() { return this.has('mara') ? 1.2 : 1; }
  shopDiscount() { return this.sim.respect >= 25 ? 0.1 : 0; }
  districtName(x, z) {
    let best = DISTRICTS[0]; let bestD = Infinity;
    for (const d of DISTRICTS) {
      const dd = Math.hypot(x - d.center[0], z - d.center[1]);
      if (dd < bestD) { bestD = dd; best = d; }
    }
    return best;
  }
  state() {
    return {
      members: this.members.map((m) => ({ id: m.id, unlocked: m.unlocked })),
      standing: { ...this.standing },
      tiersClaimed: [...this.tiersClaimed],
    };
  }
  loadState(s) {
    if (!s) return;
    for (const m of s.members || []) {
      const mine = this.members.find((x) => x.id === m.id);
      if (mine) mine.unlocked = !!m.unlocked;
    }
    this.standing = { ...this.standing, ...(s.standing || {}) };
    this.tiersClaimed = s.tiersClaimed || [];
  }
}
