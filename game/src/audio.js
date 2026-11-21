// Procedural sound: WebAudio synth effects and a tiny radio. No audio files.
let ctx = null;
let muted = false;
let radioStation = 0;
let radioTimer = null;
let engineOsc = null;
let engineGain = null;

const STATIONS = [
  { name: 'VERDE FM — Sunset Pop', notes: [523, 659, 784, 880, 784, 659, 587, 659], tempo: 0.22 },
  { name: 'BAY 98 — Night Drive', notes: [392, 466, 523, 622, 523, 466, 392, 330], tempo: 0.28 },
  { name: 'OLD TOWN — Latin Heat', notes: [440, 554, 659, 554, 440, 523, 659, 784], tempo: 0.18 },
];

export function initAudio() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch { ctx = null; }
}

export function isMuted() { return muted; }
export function toggleMute() { muted = !muted; return muted; }
export function currentStation() { return STATIONS[radioStation].name; }
export function nextStation() {
  radioStation = (radioStation + 1) % STATIONS.length;
  startRadio();
  return STATIONS[radioStation].name;
}

function tone(freq, dur, type, vol, when = 0) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type || 'square';
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(vol || 0.08, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(ctx.destination);
  o.start(t); o.stop(t + dur + 0.02);
}

function noise(dur, vol, filterFreq) {
  if (!ctx || muted) return;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = filterFreq || 1200;
  const g = ctx.createGain();
  g.gain.value = vol || 0.15;
  src.connect(f); f.connect(g); g.connect(ctx.destination);
  src.start();
}

export function sfx(name) {
  if (!ctx || muted) return;
  if (ctx.state === 'suspended') ctx.resume();
  switch (name) {
    case 'shoot': noise(0.09, 0.22, 2400); break;
    case 'shotgun': noise(0.22, 0.3, 900); break;
    case 'hit': tone(180, 0.08, 'sawtooth', 0.1); break;
    case 'pickup': tone(660, 0.09, 'sine', 0.12); tone(990, 0.12, 'sine', 0.12, 0.09); break;
    case 'cash': tone(880, 0.08, 'sine', 0.12); tone(1174, 0.08, 'sine', 0.12, 0.08); tone(1568, 0.16, 'sine', 0.12, 0.16); break;
    case 'crash': noise(0.25, 0.28, 700); break;
    case 'siren': tone(700, 0.3, 'sine', 0.05); tone(950, 0.3, 'sine', 0.05, 0.3); break;
    case 'nos': noise(0.5, 0.12, 3200); break;
    case 'door': tone(220, 0.06, 'square', 0.08); break;
    case 'fail': tone(220, 0.2, 'sawtooth', 0.1); tone(165, 0.3, 'sawtooth', 0.1, 0.2); break;
    case 'click': tone(1200, 0.04, 'square', 0.06); break;
    case 'fanfare':
      [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, 0.22, 'triangle', 0.14, i * 0.14));
      break;
    case 'jump': tone(300, 0.3, 'sine', 0.1); break;
    case 'radio': tone(980, 0.05, 'sine', 0.08); break;
    default: break;
  }
}

export function engineStart() {
  if (!ctx || engineOsc) return;
  try {
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 60;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0.0;
    engineOsc.connect(engineGain); engineGain.connect(ctx.destination);
    engineOsc.start();
  } catch { engineOsc = null; }
}

export function engineUpdate(rpm, on) {
  if (!engineOsc || !engineGain || muted) return;
  engineOsc.frequency.setTargetAtTime(50 + rpm * 130, ctx.currentTime, 0.05);
  engineGain.gain.setTargetAtTime(on ? 0.035 : 0.0, ctx.currentTime, 0.1);
}

export function startRadio() {
  if (!ctx) return;
  stopRadio();
  const st = STATIONS[radioStation];
  let i = 0;
  const play = () => {
    if (!ctx || muted) { radioTimer = setTimeout(play, 400); return; }
    const f = st.notes[i % st.notes.length];
    tone(f, st.tempo * 0.9, 'triangle', 0.05);
    if (i % 4 === 2) tone(f / 2, st.tempo, 'sine', 0.05);
    i++;
    radioTimer = setTimeout(play, st.tempo * 1000);
  };
  play();
}

export function stopRadio() {
  if (radioTimer) { clearTimeout(radioTimer); radioTimer = null; }
}
