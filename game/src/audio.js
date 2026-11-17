// Synthesised sound effects with WebAudio — no audio files, no network.
let ctx = null;
let muted = false;
let engineOsc = null;
let engineGain = null;
let sirenOsc = null;
let sirenGain = null;
let sirenTimer = null;

function ac() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
  }
  if (ctx && ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function setMuted(m) { muted = m; if (muted) stopSiren(); }
export function isMuted() { return muted; }

function blip(freq, dur, type, vol, slideTo) {
  if (muted) return;
  const c = ac(); if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type || 'square';
  o.frequency.setValueAtTime(freq, c.currentTime);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
  g.gain.setValueAtTime(vol || 0.12, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  o.connect(g); g.connect(c.destination);
  o.start(); o.stop(c.currentTime + dur + 0.02);
}

function noiseBurst(dur, vol, lowpass) {
  if (muted) return;
  const c = ac(); if (!c) return;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = lowpass || 1200;
  const g = c.createGain();
  g.gain.setValueAtTime(vol || 0.25, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  src.connect(f); f.connect(g); g.connect(c.destination);
  src.start();
}

export const sfx = {
  shoot() { noiseBurst(0.12, 0.3, 3000); blip(220, 0.08, 'square', 0.1, 60); },
  enemyShoot() { noiseBurst(0.1, 0.12, 2400); },
  pickup() { blip(660, 0.09, 'sine', 0.14); setTimeout(() => blip(990, 0.12, 'sine', 0.14), 70); },
  cash() { blip(880, 0.07, 'sine', 0.14); setTimeout(() => blip(1174, 0.07, 'sine', 0.14), 60); setTimeout(() => blip(1568, 0.14, 'sine', 0.14), 120); },
  crash() { noiseBurst(0.25, 0.4, 700); },
  honk() { blip(370, 0.16, 'square', 0.08, 340); },
  door() { blip(180, 0.07, 'triangle', 0.12, 120); },
  mission() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.16, 'sine', 0.15), i * 90)); },
  fail() { [392, 330, 262].forEach((f, i) => setTimeout(() => blip(f, 0.2, 'sawtooth', 0.1), i * 120)); },
  busted() { [440, 415, 392, 370].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'sawtooth', 0.12), i * 130)); },
  click() { blip(800, 0.05, 'sine', 0.1); },
};

export function setEngine(speedRatio, on) {
  if (muted || !on) {
    if (engineOsc) { try { engineOsc.stop(); } catch {} engineOsc = null; engineGain = null; }
    return;
  }
  const c = ac(); if (!c) return;
  if (!engineOsc) {
    engineOsc = c.createOscillator();
    engineOsc.type = 'sawtooth';
    engineGain = c.createGain();
    engineGain.gain.value = 0.03;
    const f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 900;
    engineOsc.connect(f); f.connect(engineGain); engineGain.connect(c.destination);
    engineOsc.start();
  }
  engineOsc.frequency.setTargetAtTime(55 + speedRatio * 165, c.currentTime, 0.08);
  engineGain.gain.setTargetAtTime(0.025 + speedRatio * 0.035, c.currentTime, 0.1);
}

export function startSiren() {
  if (muted || sirenOsc) return;
  const c = ac(); if (!c) return;
  sirenOsc = c.createOscillator();
  sirenOsc.type = 'sine';
  sirenGain = c.createGain();
  sirenGain.gain.value = 0.045;
  sirenOsc.connect(sirenGain); sirenGain.connect(c.destination);
  sirenOsc.start();
  let hi = true;
  sirenTimer = setInterval(() => {
    if (!sirenOsc) return;
    hi = !hi;
    sirenOsc.frequency.setTargetAtTime(hi ? 960 : 720, c.currentTime, 0.05);
  }, 420);
}

export function stopSiren() {
  if (sirenTimer) { clearInterval(sirenTimer); sirenTimer = null; }
  if (sirenOsc) { try { sirenOsc.stop(); } catch {} sirenOsc = null; sirenGain = null; }
}
