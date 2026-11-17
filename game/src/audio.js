// VERDE BAY — synthesized sound. Everything is WebAudio oscillators and
// filtered noise: no audio files to load. Silent until the player clicks
// (browsers block audio before a gesture), and every call is guarded so
// a missing AudioContext never breaks the game.

export function createAudio() {
  const A = {
    ctx: null,
    master: null,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    sirenOn: false,
    sirenT: 0,
    muted: false,
  };

  /** Call from a user gesture (click / key). Safe to call repeatedly. */
  A.ensure = function ensure() {
    if (A.ctx) {
      if (A.ctx.state === 'suspended') A.ctx.resume().catch(() => {});
      return;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      A.ctx = new Ctx();
      A.master = A.ctx.createGain();
      A.master.gain.value = 0.35;
      A.master.connect(A.ctx.destination);
      A.engineOsc = A.ctx.createOscillator();
      A.engineOsc.type = 'sawtooth';
      A.engineOsc.frequency.value = 50;
      A.engineGain = A.ctx.createGain();
      A.engineGain.gain.value = 0;
      const lp = A.ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 420;
      A.engineOsc.connect(lp);
      lp.connect(A.engineGain);
      A.engineGain.connect(A.master);
      A.engineOsc.start();
      A.sirenOsc = A.ctx.createOscillator();
      A.sirenOsc.type = 'sine';
      A.sirenOsc.frequency.value = 700;
      A.sirenGain = A.ctx.createGain();
      A.sirenGain.gain.value = 0;
      A.sirenOsc.connect(A.sirenGain);
      A.sirenGain.connect(A.master);
      A.sirenOsc.start();
    } catch (e) {
      A.ctx = null;
    }
  };

  /** Engine hum follows how fast the player drives (0..1). */
  A.engine = function engine(speed01) {
    if (!A.ctx || !A.engineOsc) return;
    A.engineOsc.frequency.value = 48 + speed01 * 130;
    A.engineGain.gain.value = 0.02 + speed01 * 0.05;
  };

  /** Two-tone police siren while the player is wanted. */
  A.siren = function siren(on, dt) {
    if (!A.ctx || !A.sirenOsc) return;
    A.sirenOn = on;
    A.sirenGain.gain.value = on ? 0.045 : 0;
    if (on) {
      A.sirenT += dt;
      A.sirenOsc.frequency.value = (Math.floor(A.sirenT * 2.2) % 2 === 0) ? 660 : 880;
    }
  };

  function blip(freq, dur, type, vol) {
    if (!A.ctx) return;
    try {
      const o = A.ctx.createOscillator();
      const g = A.ctx.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.2, A.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, A.ctx.currentTime + dur);
      o.connect(g); g.connect(A.master);
      o.start(); o.stop(A.ctx.currentTime + dur);
    } catch (e) { /* audio is decoration, never fatal */ }
  }

  function noise(dur, vol, freq) {
    if (!A.ctx) return;
    try {
      const len = Math.floor(A.ctx.sampleRate * dur);
      const buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = A.ctx.createBufferSource();
      src.buffer = buf;
      const f = A.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = freq || 1800;
      const g = A.ctx.createGain();
      g.gain.value = vol || 0.25;
      src.connect(f); f.connect(g); g.connect(A.master);
      src.start();
    } catch (e) { /* audio is decoration, never fatal */ }
  }

  /** Gunshot crack. */
  A.shot = function shot() { noise(0.14, 0.3, 2400); };
  /** Pickup / cash blip. */
  A.blip = function blipSound() { blip(880, 0.12, 'sine', 0.22); };
  /** Crash thud. */
  A.crash = function crash() { noise(0.25, 0.3, 500); };
  /** Mission-complete arpeggio. */
  A.jingle = function jingle() {
    if (!A.ctx) return;
    [523, 659, 784, 1046].forEach((f, i) => {
      setTimeout(() => blip(f, 0.22, 'triangle', 0.2), i * 110);
    });
  };

  return A;
}
