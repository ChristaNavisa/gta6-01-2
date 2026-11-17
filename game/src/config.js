// VERDE BAY — world constants. One place for every number the other
// modules share: the city size, the road grid, vehicle specs, the save key.

export const WORLD = { w: 2600, h: 2000 };

// Road grid: roads run along these lines, 64 units wide, 260 apart.
export const ROADS = {
  vertical: [130, 390, 650, 910, 1170, 1430, 1690, 1950, 2210, 2470],
  horizontal: [130, 390, 650, 910, 1170, 1430, 1690, 1950],
  width: 64,
  spacing: 260,
};

// District tints used by the renderer (ground, roofs, walls).
export const DISTRICT_STYLE = {
  downtown: { ground: '#3a3f4a', roof: '#2c2f38', wall: '#8a7f72' },
  industrial: { ground: '#4a4038', roof: '#5d5348', wall: '#7d7468' },
  beach: { ground: '#e8d9a8', roof: '#f4a261', wall: '#f7ede2' },
  oldtown: { ground: '#6b5a48', roof: '#7a4a35', wall: '#b5654a' },
  residential: { ground: '#5d7a52', roof: '#8a5a44', wall: '#d9c7a7' },
};

// Beach house roofs cycle through this palette.
export const BEACH_ROOFS = ['#f4a261', '#e9c46a', '#f7ede2', '#ee9b7a'];

// Vehicle specs: top speed in world units/second, acceleration, handling.
export const CAR_TYPES = {
  sedan: { name: 'Sedan', maxSpeed: 250, accel: 80, turn: 2.4, length: 52, width: 26 },
  sports: { name: 'Comet GT', maxSpeed: 330, accel: 115, turn: 2.9, length: 54, width: 26 },
  taxi: { name: 'Taxi', maxSpeed: 250, accel: 80, turn: 2.4, length: 52, width: 26 },
  police: { name: 'Torro', maxSpeed: 310, accel: 105, turn: 2.8, length: 54, width: 27 },
};

// Player on foot.
export const PLAYER = {
  walkSpeed: 155,
  radius: 16,
  hp: 100,
  enterRange: 55,
};

// Wanted: heat builds with crime and cools off; level is heat / 30, capped.
export const WANTED = {
  maxLevel: 5,
  heatPerLevel: 30,
  decayPerSecond: 6,
  crimeHeat: { steal: 20, grab: 70, kill: 40, shoot: 10 },
  bustTime: 1.2,
};

export const SAVE_KEY = 'verde-bay-save-v1';

// A shot that hits deals this much damage; gang members and foot cops
// go down in three hits.
export const GUN_DAMAGE = 34;
export const GUN_RANGE = 520;
