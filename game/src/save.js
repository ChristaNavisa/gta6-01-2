// Save / load through localStorage. Progress is cash + mission index + stats.
const KEY = 'verdebay-save-v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (typeof s !== 'object' || s === null) return null;
    return {
      cash: Math.max(0, s.cash | 0),
      missionIndex: Math.max(0, Math.min(6, s.missionIndex | 0)),
      missionsDone: Math.max(0, s.missionsDone | 0),
      carsStolen: Math.max(0, s.carsStolen | 0),
      bestCash: Math.max(0, s.bestCash | 0),
    };
  } catch { return null; }
}

export function writeSave(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      cash: Math.round(state.player.cash),
      missionIndex: state.mission.index,
      missionsDone: state.stats.missionsDone,
      carsStolen: state.stats.carsStolen,
      bestCash: state.stats.bestCash,
    }));
  } catch { /* storage unavailable: play without saving */ }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch {}
}
