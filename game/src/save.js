// VERDE BAY v9 — save and load: money, respect, missions done, garage, crew
// and the player's position. Stored in localStorage under one key; a corrupt
// or missing save starts a fresh game without an error.
import { SAVE_KEY, PLAYER } from './config.js';

export function saveGame(sim) {
  try {
    const data = {
      version: 9,
      money: Math.round(sim.money),
      respect: sim.respect,
      missionsDone: sim.missions ? sim.missions.completed : 0,
      garage: sim.garage.state(),
      crew: sim.crew.state(),
      weaponsOwned: sim.weapons.owned,
      weaponsAmmo: sim.weapons.ammo,
      timeOfDay: sim.timeOfDay,
      day: sim.day,
      player: { x: sim.player.x, z: sim.player.z },
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) { return false; }
}

export function loadGame(sim) {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 9) return null;
    sim.money = data.money ?? PLAYER.startMoney;
    sim.respect = data.respect ?? 0;
    if (sim.missions) sim.missions.completed = data.missionsDone ?? 0;
    sim.garage.loadState(data.garage);
    sim.crew.loadState(data.crew);
    if (Array.isArray(data.weaponsOwned)) sim.weapons.owned = data.weaponsOwned;
    if (Array.isArray(data.weaponsAmmo)) sim.weapons.ammo = data.weaponsAmmo;
    sim.timeOfDay = data.timeOfDay ?? 9.5;
    sim.day = data.day ?? 1;
    if (data.player) {
      sim.player.x = data.player.x;
      sim.player.z = data.player.z;
      sim.player.mesh.position.set(data.player.x, 0, data.player.z);
    }
    return data;
  } catch (e) { return null; }
}

export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* no storage */ }
}
