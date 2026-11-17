// VERDE BAY 3D — synthesized sound: every effect is built from oscillators
// and filtered noise, so the game ships no audio files. The AudioContext is
// created lazily on the first sound, and every call is a safe no-op when
// there is no audio device (headless runs, Node tests).
let ctx = null;
let master = null;
let muted = false;
let engineOsc = null;
let engineGain = null;
let sirenNodes = null;
// Browsers refuse to start audio before a user gesture; creating the
// context earlier only logs a warning, so sounds stay silent until the
// first key or pointer press.
let gestured = false;
if (typeof window !== 'undefined') {
  const mark = () => { gestured = true; if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); };
  window.addEventListener('keydown', mark);
  window.addEventListener('pointerdown', mark);
}

function ac() {
  if (typeof window === 'undefined') return null;
  if (!gestured) return null;
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
  } catch { return null; }
  return ctx;
}

function tone(freq, dur, type, vol, slideTo) {
  const c = ac();
  if (!c) return;
  try {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, c.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), c.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.2, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g); g.connect(master);
    o.start(); o.stop(c.currentTime + dur + 0.02);
  } catch { /* audio is best-effort */ }
}

function noise(dur, vol, filterFreq, type) {
  const c = ac();
  if (!c) return;
  try {
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = type || 'lowpass';
    f.frequency.value = filterFreq || 800;
    const g = c.createGain();
    g.gain.value = vol || 0.25;
    src.connect(f); f.connect(g); g.connect(master);
    src.start();
  } catch { /* audio is best-effort */ }
}

export const sfx = {
  click() { tone(660, 0.07, 'square', 0.12); },
  shoot() { noise(0.09, 0.5, 2400, 'highpass'); tone(220, 0.08, 'square', 0.18, 60); },
  enemyShoot() { noise(0.08, 0.22, 1800, 'highpass'); },
  crash() { noise(0.25, 0.5, 500); tone(90, 0.2, 'sawtooth', 0.2, 40); },
  explosion() { noise(0.7, 0.7, 300); tone(60, 0.6, 'sine', 0.4, 30); },
  cash() { tone(880, 0.09, 'sine', 0.2); setTimeout(() => tone(1320, 0.12, 'sine', 0.2), 90); },
  pickup() { tone(520, 0.1, 'triangle', 0.2, 780); },
  mission() { [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.14, 'triangle', 0.22), i * 110)); },
  door() { noise(0.08, 0.2, 900); tone(180, 0.06, 'square', 0.08, 120); },
  honk() { tone(370, 0.18, 'square', 0.12); tone(466, 0.18, 'square', 0.1); },
  busted() { [392, 311, 233].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'sawtooth', 0.16), i * 160)); },
};

export function startSiren() {
  const c = ac();
  if (!c || sirenNodes) return;
  try {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.value = 700;
    g.gain.value = 0.05;
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.9;
    const lfoGain = c.createGain();
    lfoGain.gain.value = 320;
    lfo.connect(lfoGain); lfoGain.connect(o.frequency);
    o.connect(g); g.connect(master);
    o.start(); lfo.start();
    sirenNodes = { o, lfo, g };
  } catch { /* audio is best-effort */ }
}

export function stopSiren() {
  if (!sirenNodes) return;
  try { sirenNodes.o.stop(); sirenNodes.lfo.stop(); } catch { /* already stopped */ }
  sirenNodes = null;
}

// Continuous engine hum; level is 0..1 of top speed, on when driving.
export function setEngine(level, on) {
  const c = ac();
  if (!c) return;
  try {
    if (on && !engineOsc) {
      engineOsc = c.createOscillator();
      engineGain = c.createGain();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      engineGain.gain.value = 0;
      const f = c.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 500;
      engineOsc.connect(f); f.connect(engineGain); engineGain.connect(master);
      engineOsc.start();
    }
    if (engineOsc) {
      engineOsc.frequency.setTargetAtTime(55 + level * 130, c.currentTime, 0.08);
      engineGain.gain.setTargetAtTime(on ? 0.05 + level * 0.05 : 0, c.currentTime, 0.1);
    }
  } catch { /* audio is best-effort */ }
}

export function setMuted(m) {
  muted = !!m;
  if (master) { try { master.gain.value = muted ? 0 : 0.5; } catch { /* noop */ } }
}
export function isMuted() { return muted; }
