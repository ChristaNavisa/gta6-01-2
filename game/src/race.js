// VERDE BAY v9 — street races: a checkpoint course with a timer, a par time
// and a payout. Checkpoints are rings on the road grid; the race is won by
// hitting them all before the par time runs out. Mara's crew ability pays
// +20% on every race win.
import { RACE_DEFS } from './config.js';
import { dist2d, formatTime } from './util.js';

const THREE = window.THREE;

export class Race {
  constructor(sim, defId) {
    this.sim = sim;
    this.def = RACE_DEFS.find((r) => r.id === defId);
    this.active = false;
    this.checkpoints = [];
    this.index = 0;
    this.time = 0;
    this.best = null;
    this.finished = false;
    this.rings = [];
  }
  // Checkpoints run along the road grid so the course is always drivable.
  buildCourse() {
    const lines = [-180, -120, -60, 0, 60, 120, 180];
    const n = this.def.checkpoints;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const vertical = i % 2 === 0;
      const line = lines[(i * 2 + 1) % lines.length];
      const along = -160 + (i / (n - 1)) * 320;
      pts.push(vertical ? { x: line, z: along } : { x: along, z: line });
    }
    this.checkpoints = pts;
    this.index = 0;
    this.time = 0;
    this.finished = false;
    this.active = true;
    this.spawnRings();
    return pts;
  }
  spawnRings() {
    this.clearRings();
    this.checkpoints.forEach((p, i) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(6, 0.5, 8, 24),
        new THREE.MeshBasicMaterial({ color: i === 0 ? 0xffe14d : 0x2fa8a0 }),
      );
      ring.position.set(p.x, 3, p.z);
      ring.rotation.y = Math.PI / 2;
      this.sim.scene.add(ring);
      this.rings.push(ring);
    });
  }
  clearRings() {
    for (const r of this.rings) this.sim.scene.remove(r);
    this.rings = [];
  }
  update(dt) {
    if (!this.active || this.finished) return;
    this.time += dt;
    const p = this.sim.playerPos();
    const cp = this.checkpoints[this.index];
    if (cp && dist2d(p.x, p.z, cp.x, cp.z) < 9) {
      this.sim.audio.pickup();
      this.sim.effects.burst(cp.x, 2, cp.z, 0xffe14d, 16, 8, 0.8, 5);
      this.index += 1;
      if (this.index < this.rings.length) {
        this.rings[this.index].material.color.setHex(0xffe14d);
      }
      if (this.index >= this.checkpoints.length) this.finish();
    }
    if (this.time > this.def.parTimeSec * 1.6) this.fail('Time up — the race is over.');
  }
  finish() {
    this.finished = true;
    this.active = false;
    this.clearRings();
    const underPar = this.time <= this.def.parTimeSec;
    let payout = underPar ? this.def.payout : Math.round(this.def.payout * 0.4);
    if (this.sim.crew.has('mara')) payout = Math.round(payout * 1.2);
    this.sim.money += payout;
    this.sim.addRespect(underPar ? 8 : 3);
    this.sim.audio.fanfare();
    this.sim.say(
      (underPar ? 'Race won in ' + formatTime(this.time) + '! ' : 'Finished in ' + formatTime(this.time) + '. ') +
      'Payout ' + '$' + payout.toLocaleString('en-US') + '.',
    );
    if (this.sim.onRaceFinished) this.sim.onRaceFinished(this.def.id, underPar, this.time);
  }
  fail(reason) {
    this.finished = true;
    this.active = false;
    this.clearRings();
    this.sim.say(reason);
    if (this.sim.onRaceFinished) this.sim.onRaceFinished(this.def.id, false, this.time);
  }
  cancel() {
    this.active = false;
    this.finished = true;
    this.clearRings();
  }
  hudLine() {
    if (!this.active) return null;
    const cp = this.checkpoints[this.index];
    return {
      label: this.def.name + ' — checkpoint ' + (this.index + 1) + '/' + this.checkpoints.length,
      time: formatTime(this.time) + ' / par ' + formatTime(this.def.parTimeSec),
      next: cp,
    };
  }
  static list() { return RACE_DEFS.map((r) => ({ id: r.id, name: r.name, checkpoints: r.checkpoints, par: r.parTimeSec, payout: r.payout })); }
}
