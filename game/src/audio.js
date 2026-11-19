// VERDE BAY 3D v7 — synthesized sound: no audio files, everything is WebAudio.
// Engine hum, sirens, gunshots, pickups and three radio stations, all generated.
// Every call is safe when audio is locked or unavailable: it just does nothing.

import { RADIO } from './config.js';

const STATION_PATTERNS = [
  // VERDE FM — slow sunset chords (midi notes, 0 = rest). 16 steps at 96 bpm.
  { bpm: 96, wave: 'triangle', bass: [48, 0, 0, 48, 55, 0, 0, 55, 53, 0, 0, 53, 50, 0, 55, 0], lead: [72, 0, 76, 0, 79, 0, 76, 0, 74, 0, 79, 0, 81, 0, 79, 0] },
  // NEON NIGHTS — driving synthwave arpeggio at 118 bpm.
  { bpm: 118, wave: 'sawtooth', bass: [45, 45, 0, 45, 48, 0, 45, 0, 43, 43, 0, 43, 50, 0, 48, 0], lead: [69, 72, 76, 72, 69, 72, 76, 79, 77, 76, 74, 72, 71, 72, 74, 76] },
  // ISLA BEATS — island rhythm at 104 bpm.
  { bpm: 104, wave: 'square', bass: [50, 0, 50, 0, 55, 0, 50, 0, 48, 0, 48, 0, 53, 0, 55, 0], lead: [74, 0, 0, 77, 0, 74, 0, 0, 72, 0, 0, 74, 0, 77, 79, 0] },
];

function midiToFreq(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

export function createAudio() {
  const A = {
    ctx: null,
    master: null,
    engineOsc: null,
    engineOsc2: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    sirenOn: false,
    sirenFlip: 0,
    radioStation: 0,
    radioOn: false,
    radioTimer: null,
    radioStep: 0,
    muted: false,
  };

  function ensure() {
    if (A.ctx) return true;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      A.ctx = new Ctx();
      A.master = A.ctx.createGain();
      A.master.gain.value = 0.5;
      A.master.connect(A.ctx.destination);
      return true;
    } catch (e) {
      return false;
    }
  }

  A.unlock = function unlock() {
    if (!ensure()) return;
    if (A.ctx.state === 'suspended') {
      A.ctx.resume().catch(() => {});
    }
    if (!A.engineOsc) {
      try {
        A.engineOsc = A.ctx.createOscillator();
        A.engineOsc.type = 'sawtooth';
        A.engineOsc.frequency.value = 55;
        A.engineOsc2 = A.ctx.createOscillator();
        A.engineOsc2.type = 'square';
        A.engineOsc2.frequency.value = 28;
        A.engineGain = A.ctx.createGain();
        A.engineGain.gain.value = 0;
        A.engineOsc.connect(A.engineGain);
        A.engineOsc2.connect(A.engineGain);
        A.engineGain.connect(A.master);
        A.engineOsc.start();
        A.engineOsc2.start();
        A.sirenOsc = A.ctx.createOscillator();
        A.sirenOsc.type = 'sine';
        A.sirenOsc.frequency.value = 750;
        A.sirenGain = A.ctx.createGain();
        A.sirenGain.gain.value = 0;
        A.sirenOsc.connect(A.sirenGain);
        A.sirenGain.connect(A.master);
        A.sirenOsc.start();
      } catch (e) {
        // Audio stays silent; the game still plays.
      }
    }
  };

  function blip(freq, dur, type, vol, when = 0) {
    if (!A.ctx || !A.master) return;
    try {
      const t = A.ctx.currentTime + when;
      const o = A.ctx.createOscillator();
      const g = A.ctx.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g);
      g.connect(A.master);
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch (e) {
      // Ignore audio errors.
    }
  }

  function noiseBurst(dur, vol, freq) {
    if (!A.ctx || !A.master) return;
    try {
      const len = Math.floor(A.ctx.sampleRate * dur);
      const buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = A.ctx.createBufferSource();
      src.buffer = buf;
      const filt = A.ctx.createBiquadFilter();
      filt.type = 'bandpass';
      filt.frequency.value = freq || 1800;
      const g = A.ctx.createGain();
      g.gain.value = vol || 0.3;
      src.connect(filt);
      filt.connect(g);
      g.connect(A.master);
      src.start();
    } catch (e) {
      // Ignore audio errors.
    }
  }

  A.setEngine = function setEngine(speed01, boosting, driving) {
    if (!A.ctx || !A.engineGain) return;
    try {
      const target = driving ? 0.05 + speed01 * 0.09 : 0;
      A.engineGain.gain.setTargetAtTime(target, A.ctx.currentTime, 0.1);
      const f = 52 + speed01 * 130 + (boosting ? 40 : 0);
      A.engineOsc.frequency.setTargetAtTime(f, A.ctx.currentTime, 0.08);
      A.engineOsc2.frequency.setTargetAtTime(f / 2, A.ctx.currentTime, 0.08);
    } catch (e) {
      // Ignore audio errors.
    }
  };

  A.setSiren = function setSiren(on) {
    A.sirenOn = on;
    if (!A.ctx || !A.sirenGain) return;
    try {
      A.sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, A.ctx.currentTime, 0.2);
    } catch (e) {
      // Ignore audio errors.
    }
  };

  A.update = function update(dt) {
    if (!A.ctx || !A.sirenOsc || !A.sirenOn) return;
    A.sirenFlip += dt;
    if (A.sirenFlip > 0.45) {
      A.sirenFlip = 0;
      try {
        A.sirenOsc.frequency.value = A.sirenOsc.frequency.value > 800 ? 700 : 950;
      } catch (e) {
        // Ignore audio errors.
      }
    }
  };

  A.shot = function shot(weapon) {
    if (weapon === 'shotgun') noiseBurst(0.28, 0.5, 900);
    else if (weapon === 'smg') noiseBurst(0.1, 0.3, 2200);
    else noiseBurst(0.16, 0.35, 1600);
    blip(160, 0.08, 'square', 0.12);
  };

  A.pickup = function pickup() {
    blip(880, 0.12, 'sine', 0.22);
    blip(1318, 0.18, 'sine', 0.22, 0.09);
  };

  A.missionDone = function missionDone() {
    [523, 659, 784, 1046].forEach((f, i) => blip(f, 0.22, 'triangle', 0.22, i * 0.11));
  };

  A.click = function click() {
    blip(660, 0.06, 'sine', 0.15);
  };

  A.busted = function busted() {
    [392, 330, 262].forEach((f, i) => blip(f, 0.3, 'sawtooth', 0.14, i * 0.16));
  };

  function scheduleRadioStep() {
    if (!A.ctx || !A.radioOn) return;
    const pat = STATION_PATTERNS[A.radioStation];
    const stepDur = 60 / pat.bpm / 2;
    const bass = pat.bass[A.radioStep % 16];
    const lead = pat.lead[A.radioStep % 16];
    if (bass) blip(midiToFreq(bass), stepDur * 0.9, pat.wave, 0.1);
    if (lead) blip(midiToFreq(lead), stepDur * 0.7, 'sine', 0.07);
    A.radioStep += 1;
  }

  A.setStation = function setStation(i) {
    A.radioStation = ((i % RADIO.length) + RADIO.length) % RADIO.length;
    A.radioStep = 0;
    if (A.radioTimer) {
      clearInterval(A.radioTimer);
      A.radioTimer = null;
    }
    if (A.radioOn && A.ctx) {
      const pat = STATION_PATTERNS[A.radioStation];
      const stepDur = 60 / pat.bpm / 2;
      A.radioTimer = setInterval(scheduleRadioStep, stepDur * 1000);
    }
  };

  A.setRadio = function setRadio(on) {
    A.radioOn = on;
    if (on) A.setStation(A.radioStation);
    else if (A.radioTimer) {
      clearInterval(A.radioTimer);
      A.radioTimer = null;
    }
  };

  return A;
}
