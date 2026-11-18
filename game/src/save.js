// Save / load for Verde Bay: one localStorage key, plain JSON.
// The smoke test drives writeSave -> loadSave -> applySave in the same process.

import { SAVE_KEY } from './config.js';

function storage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Read the saved game, or null when there is none / it is corrupt. */
export function loadSave() {
  const store = storage();
  if (!store) return null;
  let raw = null;
  try {
    raw = store.getItem(SAVE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return data;
  } catch {
    return null;
  }
}

/** Write the current progress to localStorage. */
export function writeSave(S) {
  const store = storage();
  if (!store) return;
  const data = {
    cash: S.player.cash,
    missionIndex: S.mission.active ? S.mission.index : S.stats.missionsDone,
    packagesFound: S.stats.packagesFound,
    packages: S.packages.map((p) => p.found),
    time: Math.floor(S.time),
    version: 6,
  };
  try {
    store.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Storage full or unavailable: the game keeps playing.
  }
}

/** Clear the saved game. */
export function clearSave() {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(SAVE_KEY);
  } catch {
    // Ignore.
  }
}
