// Synthesized sound for VERDE BAY 3D v8 — WebAudio only, no audio files.
// Engine hum, 3 radio stations, sirens, gunshots, fanfare.
import { RADIO_STATIONS } from './config.js';

let ctx = null;
let master = null;
let radioNodes = null;
let engineNodes = null;
let sirenTimer = 0;

export function ensureAudio() {
  if (ctx) return ctx;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  } catch (e) { ctx = null; }
  return ctx;
}

function osc(type, freq, gain, when = 0) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.value = gain;
  o.connect(g); g.connect(master);
  o.start(ctx.currentTime + when);
  return { o, g };
}

function noiseBurst(dur, gain) {
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(g); g.connect(master);
  src.start();
}

export function playShot() {
  if (!ctx) return;
  noiseBurst(0.12, 0.5);
  const { o, g } = osc('square', 180, 0.25);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
  o.stop(ctx.currentTime + 0.12);
}

export function playFanfare() {
  if (!ctx) return;
  const notes = [523, 659, 784, 1046];
  notes.forEach((f, i) => {
    const { o, g } = osc('triangle', f, 0.3, i * 0.12);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.4);
    o.stop(ctx.currentTime + i * 0.12 + 0.45);
  });
}

export function playPickup() {
  if (!ctx) return;
  const { o, g } = osc('sine', 880, 0.25);
  o.frequency.setValueAtTime(880, ctx.currentTime);
  o.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
  o.stop(ctx.currentTime + 0.22);
}

export function playBusted() {
  if (!ctx) return;
  [330, 262, 196].forEach((f, i) => {
    const { o, g } = osc('sawtooth', f, 0.2, i * 0.18);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.25);
    o.stop(ctx.currentTime + i * 0.18 + 0.3);
  });
}

// Radio: three stations, each a tiny step sequencer on two oscillators.
const STATION_PATTERNS = [
  { name: 'Verde FM', wave: 'sine', bpm: 96, bass: [130, 98, 110, 87], lead: [392, 440, 523, 440] },
  { name: 'Neon Nights', wave: 'sawtooth', bpm: 128, bass: [55, 55, 82, 73], lead: [220, 262, 330, 392] },
  { name: 'Isla Beats', wave: 'triangle', bpm: 110, bass: [98, 123, 98, 147], lead: [294, 370, 440, 370] },
];

let radioStep = 0;
let radioNext = 0;
let radioStation = -1;

export function setRadioStation(index, on) {
  if (!ctx) return;
  stopRadio();
  if (!on) return;
  radioStation = index;
  radioStep = 0;
  radioNext = ctx.currentTime + 0.05;
}

export function stopRadio() {
  if (radioNodes) {
    for (const n of radioNodes) { try { n.o.stop(); } catch (e) { /* already stopped */ } }
    radioNodes = null;
  }
  radioStation = -1;
}

export function updateRadio() {
  if (!ctx || radioStation < 0) return;
  const pat = STATION_PATTERNS[radioStation];
  const stepDur = 60 / pat.bpm / 2;
  while (radioNext < ctx.currentTime + 0.15) {
    const i = radioStep % 8;
    const bassNote = pat.bass[Math.floor(i / 2) % pat.bass.length];
    const leadNote = pat.lead[i % pat.lead.length];
    const b = osc(pat.wave, bassNote, 0.10, radioNext - ctx.currentTime);
    b.g.gain.exponentialRampToValueAtTime(0.001, radioNext + stepDur * 0.9);
    b.o.stop(radioNext + stepDur);
    if (i % 2 === 0) {
      const l = osc('sine', leadNote, 0.06, radioNext - ctx.currentTime);
      l.g.gain.exponentialRampToValueAtTime(0.001, radioNext + stepDur * 1.8);
      l.o.stop(radioNext + stepDur * 2);
    }
    radioNodes = [b, ...(radioNodes || [])].slice(0, 4);
    radioStep += 1;
    radioNext += stepDur;
  }
}

export function updateEngine(speed, maxSpeed, on) {
  if (!ctx) return;
  if (!on || maxSpeed <= 0) {
    if (engineNodes) { try { engineNodes.o.stop(); } catch (e) { /* ignore */ } engineNodes = null; }
    return;
  }
  if (!engineNodes) {
    engineNodes = osc('sawtooth', 60, 0.05);
  }
  const f = 55 + (speed / maxSpeed) * 130;
  engineNodes.o.frequency.setTargetAtTime(f, ctx.currentTime, 0.08);
  engineNodes.g.gain.setTargetAtTime(0.03 + (speed / maxSpeed) * 0.05, ctx.currentTime, 0.1);
}

export function updateSiren(dt, wantedLevel) {
  if (!ctx) return;
  sirenTimer += dt;
  if (wantedLevel <= 0) return;
  if (sirenTimer > 0.9) {
    sirenTimer = 0;
    const f = wantedLevel >= 3 ? 950 : 750;
    const { o, g } = osc('sine', f, 0.07);
    o.frequency.setValueAtTime(f, ctx.currentTime);
    o.frequency.linearRampToValueAtTime(f * 0.75, ctx.currentTime + 0.4);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    o.stop(ctx.currentTime + 0.5);
  }
}

export function stationName(i) { return RADIO_STATIONS[i] || 'Off'; }
