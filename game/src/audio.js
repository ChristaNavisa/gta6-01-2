// All sound is synthesized with WebAudio: no audio files, nothing fetched.
// A soft engine hum follows the car's speed, a two-tone siren follows the
// wanted level, and one-shots cover gunfire, pickups and mission jingles.
// Everything is guarded: a browser without audio still plays silently.

/** Create the audio engine. Call resume() from a user gesture. */
export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    sirenTimer: 0,
    started: false,
  };

  function ensure() {
    if (audio.ctx) return true;
    try {
      const Ctx = window.AudioContext ?? window.webkitAudioContext;
      if (!Ctx) return false;
      audio.ctx = new Ctx();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = 0.35;
      audio.master.connect(audio.ctx.destination);
      // Engine: a low sawtooth whose pitch follows speed.
      audio.engineOsc = audio.ctx.createOscillator();
      audio.engineOsc.type = 'sawtooth';
      audio.engineOsc.frequency.value = 55;
      audio.engineGain = audio.ctx.createGain();
      audio.engineGain.gain.value = 0;
      const engineFilter = audio.ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      audio.engineOsc.connect(engineFilter);
      engineFilter.connect(audio.engineGain);
      audio.engineGain.connect(audio.master);
      audio.engineOsc.start();
      // Siren: a sine that wails between two notes.
      audio.sirenOsc = audio.ctx.createOscillator();
      audio.sirenOsc.type = 'sine';
      audio.sirenOsc.frequency.value = 720;
      audio.sirenGain = audio.ctx.createGain();
      audio.sirenGain.gain.value = 0;
      audio.sirenOsc.connect(audio.sirenGain);
      audio.sirenGain.connect(audio.master);
      audio.sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!audio.ctx) return;
    try {
      const t = audio.ctx.currentTime;
      const osc = audio.ctx.createOscillator();
      const gain = audio.ctx.createGain();
      osc.type = type ?? 'square';
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      gain.gain.setValueAtTime(vol ?? 0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain);
      gain.connect(audio.master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch {
      // Sound is garnish; never let it break the game.
    }
  }

  return {
    /** Start (or resume) the audio context. Call from a click or keypress. */
    resume() {
      if (!ensure()) return;
      audio.started = true;
      if (audio.ctx.state === 'suspended') audio.ctx.resume().catch(() => {});
    },
    /** Pistol shot. */
    shot() {
      blip(220, 0.12, 'square', 0.25, 60);
    },
    /** Pickup / objective done. */
    pickup() {
      blip(660, 0.09, 'sine', 0.2);
      setTimeout(() => blip(880, 0.14, 'sine', 0.2), 90);
    },
    /** Mission complete jingle. */
    jingle() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.16, 'triangle', 0.22), i * 110));
    },
    /** Busted / failed sting. */
    sting() {
      blip(196, 0.5, 'sawtooth', 0.2, 98);
    },
    /** Per-frame: engine pitch from speed, siren wail from wanted level. */
    update(S) {
      if (!audio.ctx || !audio.started) return;
      try {
        const speed = Math.abs(S.player.speed ?? 0);
        audio.engineGain.gain.value = S.player.car ? 0.05 + Math.min(0.09, speed / 9000) : 0;
        audio.engineOsc.frequency.value = 50 + speed * 0.09;
        if (S.wanted.level > 0) {
          audio.sirenTimer += 1 / 60;
          const wail = Math.sin(audio.sirenTimer * 3.2) > 0 ? 740 : 540;
          audio.sirenOsc.frequency.value = wail;
          audio.sirenGain.gain.value = 0.045;
        } else {
          audio.sirenGain.gain.value = 0;
        }
      } catch {
        // Ignore.
      }
    },
  };
}
