// Synthesized sound for Verde Bay: no audio files, everything is WebAudio.
// The engine hum, sirens, gunshots, pickups and jingles are all oscillators
// and filtered noise, so the game ships zero audio assets.

let ctx = null;
let master = null;
let engineOsc = null;
let engineGain = null;
let sirenOsc = null;
let sirenGain = null;
let sirenTimer = null;
let muted = false;

/** Create the audio context on the first user gesture (browsers require it). */
export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return true;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
    // Engine: a low sawtooth whose pitch follows the car's speed.
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineOsc.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
    return true;
  } catch {
    ctx = null;
    return false;
  }
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.35;
  return muted;
}

/** Call every frame: the engine note follows speed, the siren wails when wanted. */
export function updateAudio(speed, wantedLevel, inCar) {
  if (!ctx || !engineOsc) return;
  const target = inCar ? 0.05 + Math.min(0.12, Math.abs(speed) / 430 * 0.12) : 0;
  engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
  engineOsc.frequency.setTargetAtTime(50 + Math.abs(speed) * 0.22, ctx.currentTime, 0.1);
  if (wantedLevel > 0 && !sirenOsc) {
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'triangle';
    sirenOsc.frequency.value = 700;
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0.045;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(master);
    sirenOsc.start();
    let high = true;
    sirenTimer = setInterval(() => {
      if (!sirenOsc) return;
      high = !high;
      sirenOsc.frequency.setTargetAtTime(high ? 950 : 650, ctx.currentTime, 0.05);
    }, 450);
  } else if (wantedLevel === 0 && sirenOsc) {
    clearInterval(sirenTimer);
    sirenTimer = null;
    try { sirenOsc.stop(); } catch { /* already stopped */ }
    sirenOsc.disconnect();
    sirenOsc = null;
  }
}

function blip(freq, dur, type = 'sine', vol = 0.2, when = 0) {
  if (!ctx || !master) return;
  const t = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noiseBurst(dur, vol = 0.3, filterFreq = 1200) {
  if (!ctx || !master) return;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = filterFreq;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(filter);
  filter.connect(g);
  g.connect(master);
  src.start();
}

/** A pistol shot: a short noise crack plus a low thump. */
export function playShot() {
  noiseBurst(0.09, 0.35, 1800);
  blip(140, 0.08, 'square', 0.12);
}

/** The cash-register chime of a collected package. */
export function playPickup() {
  blip(880, 0.12, 'sine', 0.2);
  blip(1318, 0.18, 'sine', 0.2, 0.09);
}

/** Mission complete: a little three-note jingle. */
export function playMissionComplete() {
  blip(523, 0.14, 'triangle', 0.22);
  blip(659, 0.14, 'triangle', 0.22, 0.12);
  blip(784, 0.26, 'triangle', 0.24, 0.24);
}

/** A car door / steal click. */
export function playSteal() {
  blip(220, 0.08, 'square', 0.12);
  blip(330, 0.1, 'square', 0.12, 0.07);
}

/** Busted sting. */
export function playBusted() {
  blip(392, 0.2, 'sawtooth', 0.16);
  blip(311, 0.34, 'sawtooth', 0.16, 0.18);
}
