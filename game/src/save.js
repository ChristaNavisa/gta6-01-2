// VERDE BAY — save / load. One small JSON blob in localStorage:
// the mission the player reached and the cash they hold.

import { SAVE_KEY } from './config.js';

function storage() {
  if (typeof localStorage !== 'undefined') return localStorage;
  return null;
}

/** The saved blob, or null when there is none / it is unreadable. */
export function loadSave() {
  try {
    const s = storage();
    if (!s) return null;
    const raw = s.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return {
      missionIndex: typeof data.missionIndex === 'number' ? data.missionIndex : 0,
      cash: typeof data.cash === 'number' ? data.cash : 0,
    };
  } catch (e) {
    return null;
  }
}

/** Persist the current progress. Safe to call every mission completion. */
export function writeSave(S) {
  try {
    const s = storage();
    if (!s) return;
    s.setItem(SAVE_KEY, JSON.stringify({
      missionIndex: S.stats.missionsDone,
      cash: S.player.cash,
    }));
  } catch (e) {
    // Storage full or blocked: the game keeps running without a save.
  }
}
