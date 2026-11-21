// Save / load via localStorage. Only numbers, ids and small lists — no code.
const KEY = 'verde-bay-save-v10';

export function saveGame(G) {
  try {
    const data = {
      money: G.money, clock: G.clock,
      health: G.player.health, armor: G.player.armor,
      weapons: G.player.weapons, weapon: G.player.weapon, ammo: G.player.ammo,
      missionsDone: G.missionsDone, missionIndex: G.missionsDone.length,
      garage: G.garage, businesses: G.businesses,
      crew: G.crew, stats: G.stats,
      player: { x: G.player.x, y: G.player.y },
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export function hasSave() {
  try { return !!localStorage.getItem(KEY); } catch { return false; }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

export function applySave(G, data) {
  if (!data) return;
  G.money = data.money ?? G.money;
  G.clock = data.clock ?? G.clock;
  G.player.health = data.health ?? 100;
  G.player.armor = data.armor ?? 0;
  if (Array.isArray(data.weapons)) G.player.weapons = data.weapons;
  if (data.weapon) G.player.weapon = data.weapon;
  if (data.ammo) G.player.ammo = data.ammo;
  if (Array.isArray(data.missionsDone)) G.missionsDone = data.missionsDone;
  if (data.garage) G.garage = data.garage;
  if (data.businesses) G.businesses = data.businesses;
  if (data.crew) G.crew = data.crew;
  if (data.stats) G.stats = { ...G.stats, ...data.stats };
  if (data.player) { G.player.x = data.player.x; G.player.y = data.player.y; }
}
