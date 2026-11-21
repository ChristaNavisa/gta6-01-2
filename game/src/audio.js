// VERDE BAY v9 — procedural audio: no sound files, everything is synthesized
// with WebAudio so the game stays offline and self-contained. Engine hum, sirens,
// gunshots, pickups, UI clicks and three lo-fi radio stations.
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.radioOsc = [];
    this.radioGain = null;
    this.station = 0;
    this.muted = false;
    this.stations = ['BAY FM 88.2', 'VERDE BEATS 101.5', 'HARBOUR JAZZ 94.7'];
  }
  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 50;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(this.engineGain).connect(this.master);
      this.engineOsc.start();
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'sine';
      this.sirenOsc.frequency.value = 700;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain).connect(this.master);
      this.sirenOsc.start();
      this.startRadio();
    } catch (e) { /* audio is optional; the game plays silent */ }
  }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }
  setEngine(rpm, on) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(on ? 0.03 + rpm * 0.05 : 0, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(45 + rpm * 140, t, 0.1);
  }
  setSiren(on) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sirenGain.gain.setTargetAtTime(on ? 0.035 : 0, t, 0.2);
    if (on) this.sirenOsc.frequency.setTargetAtTime(650 + 250 * Math.sin(t * 2.4), t, 0.1);
  }
  blip(freq, dur, type, vol) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || 'square';
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + dur);
  }
  shot(weaponId) {
    if (!this.ctx) return;
    const freq = weaponId === 'shotgun' ? 90 : weaponId === 'lmg' ? 160 : 220;
    this.blip(freq, 0.14, 'sawtooth', 0.22);
    this.blip(freq * 0.5, 0.1, 'square', 0.1);
  }
  pickup() { this.blip(880, 0.12, 'sine', 0.15); this.blip(1320, 0.18, 'sine', 0.12); }
  click() { this.blip(660, 0.06, 'square', 0.08); }
  fanfare() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'triangle', 0.16), i * 110));
  }
  crash() { this.blip(70, 0.3, 'sawtooth', 0.25); }
  nextStation() {
    this.station = (this.station + 1) % this.stations.length;
    this.startRadio();
    return this.stations[this.station];
  }
  stationName() { return this.stations[this.station]; }
  startRadio() {
    if (!this.ctx) return;
    this.radioOsc.forEach((o) => { try { o.stop(); } catch (e) { /* already stopped */ } });
    this.radioOsc = [];
    if (!this.radioGain) {
      this.radioGain = this.ctx.createGain();
      this.radioGain.gain.value = 0.035;
      this.radioGain.connect(this.master);
    }
    const roots = [110, 98, 130.8];
    const root = roots[this.station];
    [1, 1.5, 2].forEach((mult, i) => {
      const o = this.ctx.createOscillator();
      o.type = i === 2 ? 'triangle' : 'sine';
      o.frequency.value = root * mult;
      o.detune.value = (i - 1) * 4;
      o.connect(this.radioGain);
      o.start();
      this.radioOsc.push(o);
    });
  }
}
