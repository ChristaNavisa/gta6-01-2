// Save / load for VERDE BAY 3D v8. localStorage only; pure data in, pure data out.
const KEY = 'verde-bay-save-v8';

function storage() {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch (e) { /* sandbox without storage */ }
  return null;
}

export function writeSave(S) {
  const store = storage();
  if (!store) return false;
  const data = {
    missionIndex: S.stats.missionsDone,
    cash: Math.round(S.player.cash),
    packagesFound: S.stats.packagesFound,
    health: Math.round(S.player.health),
    weapons: S.player.weapons.slice(),
    ammo: S.player.ammo.slice(),
    dayTime: S.dayTime,
    savedAt: Date.now(),
  };
  try { store.setItem(KEY, JSON.stringify(data)); return true; } catch (e) { return false; }
}

export function loadSave() {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.missionIndex !== 'number') return null;
    return data;
  } catch (e) { return null; }
}

export function clearSave() {
  const store = storage();
  if (store) { try { store.removeItem(KEY); } catch (e) { /* ignore */ } }
}
