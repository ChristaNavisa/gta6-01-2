// Save / load through localStorage. The shape is tiny on purpose: the
// number of finished missions and the player's cash, plus where they stood.

const KEY = 'verde-bay-save-v1';

function storage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Read the save, or null when there is none / it does not parse. */
export function loadSave() {
  const store = storage();
  if (!store) return null;
  let raw = null;
  try {
    raw = store.getItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return {
      missionIndex: typeof data.missionIndex === 'number' ? data.missionIndex : 0,
      cash: typeof data.cash === 'number' ? data.cash : 0,
      x: typeof data.x === 'number' ? data.x : 1100,
      y: typeof data.y === 'number' ? data.y : 1000,
    };
  } catch {
    return null;
  }
}

/** Write the current progress. Never throws (a full or blocked store is fine). */
export function writeSave(S) {
  const store = storage();
  if (!store) return;
  const data = {
    missionIndex: S.stats.missionsDone,
    cash: S.player.cash,
    x: Math.round(S.player.x),
    y: Math.round(S.player.y),
  };
  try {
    store.setItem(KEY, JSON.stringify(data));
  } catch {
    // A blocked or full store must never break the game.
  }
}

/** Wipe the save (New Game). */
export function clearSave() {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(KEY);
  } catch {
    // Ignore.
  }
}
