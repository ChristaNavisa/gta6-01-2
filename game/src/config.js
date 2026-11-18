// Verde Bay tuning constants: world size, physics, vehicles, wanted ladder.
// One place for every number the sim, the renderer and the HUD share.

export const WORLD = {
  width: 3400,
  height: 2200,
  mainlandWidth: 2600,
  channelX0: 2600,
  channelX1: 2900,
  islaX0: 2900,
  // The bridge corridor across the channel (walkable / drivable strip).
  bridgeY0: 1000,
  bridgeY1: 1200,
  bridgeX: 2750,
  bridgeY: 1100,
  // The sea along the south edge, below the beach.
  seaY0: 2050,
};

export const PLAYER = {
  walkSpeed: 150,
  runSpeed: 210,
  radius: 14,
  hp: 100,
};

export const VEHICLES = {
  sedan: { name: 'Sedan', maxSpeed: 340, accel: 260, reverse: 140, turn: 2.6, nitroMax: 100 },
  sport: { name: 'Comet GT', maxSpeed: 430, accel: 330, reverse: 160, turn: 3.0, nitroMax: 140 },
  taxi: { name: 'Taxi', maxSpeed: 320, accel: 250, reverse: 130, turn: 2.7, nitroMax: 80 },
  truck: { name: 'Hauler', maxSpeed: 250, accel: 180, reverse: 110, turn: 2.0, nitroMax: 60 },
};

export const VEHICLE_COLORS = [
  '#2e5fa3', '#d7263d', '#f4b400', '#3fa34d', '#7b2fbe', '#e07a5f',
  '#e9c46a', '#8ecae6', '#ef476f', '#06d6a0', '#c0c0c0', '#2b2d42',
];

export const WANTED = {
  // Heat thresholds for wanted levels 1..5.
  thresholds: [25, 60, 120, 200, 300],
  decayPerSecond: 2.5,
  copSpeed: 300,
  copCatchRadius: 26,
  bustFine: 250,
};

export const TRAFFIC_COUNT = 22;
export const PED_COUNT = 36;
export const MAX_COPS = 6;

export const PACKAGE_REWARD = 250;
export const PACKAGE_COUNT = 10;

export const SAVE_KEY = 'verde-bay-save-v1';

// Dusk palette for the renderer and the HUD.
export const DUSK = {
  skyTop: '#2b3a67',
  skyBottom: '#ff9e57',
  sun: '#ffb347',
  fog: '#e8956b',
  water: '#1d4e89',
  sand: '#e8cf9a',
};
