// VERDE BAY 3D v7 — save / load through localStorage.
// Safe to import from Node: localStorage is only touched inside the functions.

const KEY = 'verde-bay-v7-save';

export function writeSave(S) {
  try {
    const data = {
      version: 7,
      missionIndex: S.mission.index,
      missionsDone: S.stats.missionsDone,
      cash: S.player.cash,
      health: S.player.health,
      packagesFound: S.stats.packagesFound,
      weapons: S.player.weapons,
      weapon: S.player.weapon,
      x: S.player.x,
      y: S.player.y,
      time: S.time,
    };
    globalThis.localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = globalThis.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function clearSave() {
  try {
    globalThis.localStorage.removeItem(KEY);
  } catch (e) {
    // No storage available: nothing to clear.
  }
}
