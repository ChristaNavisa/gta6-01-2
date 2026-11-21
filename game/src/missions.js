// VERDE BAY v9 — the story: 12 missions in order, each a chain of steps
// (steal a car, reach a marker, lose the cops, win a race, hold a spot,
// clear attackers). Completing one pays money and respect, unlocks crew
// members, and opens the next. Missions can be failed and retried.
import { MISSIONS } from './config.js';
import { dist2d } from './util.js';
import { Race } from './race.js';

export class MissionRunner {
  constructor(sim) {
    this.sim = sim;
    this.completed = 0; // missions finished, in order
    this.active = null; // { def, stepIndex, timer, holdTimer, overTimer, race }
    this.failed = null;
  }
  nextDef() { return MISSIONS[this.completed] || null; }
  isDone() { return this.completed >= MISSIONS.length; }
  start() {
    const def = this.nextDef();
    if (!def || this.active) return false;
    this.failed = null;
    this.active = { def, stepIndex: 0, timer: 0, holdTimer: 0, overTimer: 0, race: null };
    this.sim.say('Mission ' + def.id + ' — ' + def.title + ': ' + def.briefing);
    this.beginStep();
    return true;
  }
  beginStep() {
    const step = this.currentStep();
    if (!step) { this.complete(); return; }
    const sim = this.sim;
    if (step.kind === 'goto' || step.kind === 'defend') {
      sim.setObjective(step.x, step.z, step.label || step.kind);
      if (step.kind === 'defend') sim.spawnAttackers(step.x, step.z, step.count);
    } else if (step.kind === 'race') {
      sim.race = new Race(sim, step.race);
      sim.race.buildCourse();
      const first = sim.race.checkpoints[0];
      sim.setObjective(first.x, first.z, 'Race start — follow the rings');
    } else if (step.kind === 'escape') {
      sim.setWantedStars(step.stars || 2);
      this.active.timer = step.seconds;
      sim.say('Lose the cops — survive ' + step.seconds + ' seconds.');
    } else if (step.kind === 'hold') {
      this.active.holdTimer = step.seconds;
      sim.say('Hold this spot for ' + step.seconds + ' seconds.');
    } else if (step.kind === 'steal') {
      sim.say('Take a car — any car' + (step.carId ? ' (a ' + step.carId + ')' : '') + ' — and go.');
    }
    if (step.stars) sim.setWantedStars(step.stars);
  }
  currentStep() {
    if (!this.active) return null;
    return this.active.def.steps[this.active.stepIndex] || null;
  }
  advanceStep() {
    this.active.stepIndex += 1;
    this.active.holdTimer = 0;
    this.active.overTimer = 0;
    this.sim.audio.pickup();
    this.beginStep();
  }
  fail(reason) {
    const def = this.active.def;
    this.sim.say('Mission failed: ' + reason + ' — ' + def.title + ' can be retried (M).');
    this.failed = def.id;
    this.active = null;
    this.sim.clearObjective();
    if (this.sim.race) { this.sim.race.cancel(); this.sim.race = null; }
  }
  complete() {
    const def = this.active.def;
    this.completed += 1;
    let payout = def.payout;
    if (def.unlockCrew) this.sim.crew.unlock(def.unlockCrew);
    this.sim.money += payout;
    this.sim.addRespect(def.respect, def.district);
    this.sim.audio.fanfare();
    this.sim.say('Mission complete: ' + def.title + ' — +' + '$' + payout.toLocaleString('en-US') + ', +' + def.respect + ' respect.');
    this.active = null;
    this.sim.clearObjective();
    if (this.sim.race) { this.sim.race = null; }
    if (this.isDone()) this.sim.say('ALL 12 MISSIONS DONE. Verde Bay is yours, boss.');
  }
  onKill(ped) {
    if (!this.active) return;
    const step = this.currentStep();
    if (step && step.kind === 'defend') {
      const left = this.sim.attackers.length;
      if (left === 0) this.advanceStep();
      else this.sim.say('Attackers left: ' + left);
    }
  }
  onRaceFinished(id, won, time) {
    if (!this.active) return;
    const step = this.currentStep();
    if (step && step.kind === 'race') {
      if (won) this.advanceStep();
      else this.fail('Race lost (' + time.toFixed(0) + 's).');
    }
  }
  update(dt) {
    if (!this.active) return;
    const sim = this.sim;
    const step = this.currentStep();
    if (!step) return;
    const p = sim.playerPos();
    if (step.kind === 'steal') {
      const ok = step.carId
        ? (sim.player.vehicle && sim.player.vehicle.def.id === step.carId)
        : !!sim.player.vehicle;
      if (ok) this.advanceStep();
    } else if (step.kind === 'goto') {
      if (dist2d(p.x, p.z, step.x, step.z) < 9) this.advanceStep();
      else if (step.maxStars !== undefined && sim.wanted > step.maxStars) {
        this.active.overTimer += dt;
        if (this.active.overTimer > 5) this.fail('The police spotted the drop.');
      } else this.active.overTimer = 0;
    } else if (step.kind === 'escape') {
      this.active.timer -= dt;
      if (this.active.timer <= 0) {
        sim.heat = 0;
        sim.wanted = 0;
        this.advanceStep();
      }
    } else if (step.kind === 'hold') {
      const target = this.active.def.steps[this.active.stepIndex];
      const cx = target.x !== undefined ? target.x : p.x;
      const cz = target.z !== undefined ? target.z : p.z;
      if (dist2d(p.x, p.z, cx, cz) < 12) {
        this.active.holdTimer -= dt;
        if (this.active.holdTimer <= 0) this.advanceStep();
      }
    } else if (step.kind === 'race') {
      // The Race instance reports its own finish through onRaceFinished.
      if (sim.race && !sim.race.active && !sim.race.finished) sim.race = null;
    } else if (step.kind === 'defend') {
      if (sim.attackers.length === 0 && sim.peds.filter((x) => x.hostile && !x.dead).length === 0) this.advanceStep();
    }
  }
  statusLine() {
    if (this.isDone()) return 'Story complete — free roam. $12,000 final payout banked.';
    if (this.active) {
      const step = this.currentStep();
      return 'Mission ' + this.active.def.id + ' — ' + this.active.def.title +
        (step ? ' · ' + (step.label || step.kind) : '');
    }
    const next = this.nextDef();
    return 'Next: Mission ' + next.id + ' — ' + next.title + ' (press M)';
  }
  static titles() { return MISSIONS.map((m) => m.id + '. ' + m.title + ' — ' + m.giver + ' ($' + m.payout + ')'); }
}
