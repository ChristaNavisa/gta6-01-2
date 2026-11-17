// VERDE BAY — configuration: world size, roads, palette, car models, tuning.
// All numbers are the game's own design, written for this entry.
export const WORLD_W = 2600;
export const WORLD_H = 2000;

// Road grid: vertical roads at these x, horizontal at these y. Roads are 64 wide.
export const ROAD_X = [200, 500, 800, 1100, 1400, 1700, 2000, 2300];
export const ROAD_Y = [200, 500, 800, 1100, 1400, 1700];
export const ROAD_W = 64;
export const WALK_W = 18; // sidewalk strip on each side of a road

// Beach strip along the south edge, water at the very bottom.
export const BEACH_Y = 1780;
export const WATER_Y = 1920;

// Sun-soaked palette for a modern coastal city.
export const PALETTE = {
  ground: '#8a9a5b',
  grass: '#7fb069',
  park: '#6da25e',
  sand: '#e9d8a6',
  water: '#3aa7c9',
  waterDeep: '#2b7fa3',
  asphalt: '#3d4149',
  asphaltDark: '#34383f',
  roadLine: '#ffd166',
  sidewalk: '#c9bfa8',
  curb: '#a89a7d',
  buildingRoof: ['#e07a5f', '#f2cc8f', '#81b29a', '#f4a261', '#a8dadc', '#e76f51', '#b5838d', '#ffcdb2'],
  buildingWall: ['#d9d4c5', '#cdb89a', '#b7c4ce', '#e8dcc8', '#c9b8a3'],
  glass: '#9fd8e8',
  downtown: ['#5d6d7e', '#7d8597', '#4a6fa5', '#6c757d'],
  tree: '#4d7c4f',
  treeLight: '#6a9e5f',
};

// Car models: name, size, top speed (px/s), accel, handling, colour pool.
export const CAR_MODELS = {
  sedan:   { name: 'Sedan',    w: 46, h: 22, top: 330, accel: 260, grip: 2.6, colors: ['#c0392b', '#2e5fa3', '#e8e8e8', '#3a3a3a', '#7d8c99'] },
  sport:   { name: 'Comet GT', w: 48, h: 21, top: 470, accel: 380, grip: 3.4, colors: ['#e74c3c', '#f1c40f', '#16a085', '#d63384'] },
  taxi:    { name: 'Cab',      w: 46, h: 22, top: 320, accel: 250, grip: 2.6, colors: ['#f5b301'] },
  van:     { name: 'Van',      w: 54, h: 24, top: 280, accel: 200, grip: 2.2, colors: ['#ecf0f1', '#5d6d7e', '#8e44ad'] },
  truck:   { name: 'Truck',    w: 62, h: 26, top: 250, accel: 170, grip: 2.0, colors: ['#7f8c8d', '#a04000', '#1f618d'] },
  police:  { name: 'Interceptor', w: 48, h: 22, top: 400, accel: 360, grip: 3.2, colors: ['#1a1a2e'] },
  muscle:  { name: 'Torro',    w: 50, h: 23, top: 400, accel: 330, grip: 2.9, colors: ['#922b21', '#1b4f72', '#7d6608'] },
};

export const PLAYER = {
  radius: 13,
  walkSpeed: 170,
  sprintSpeed: 265,
  maxHp: 100,
  pistolDamage: 34,
  pistolRange: 420,
  pistolCooldown: 0.28,
  startAmmo: 48,
};

export const WANTED = {
  maxStars: 5,
  decayDelay: 12,      // seconds with no crime and no cop sight before heat falls
  starDropTime: 6,     // seconds per star once decaying
  copSightRange: 520,
  maxCops: 8,
};

export const KEYS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  enter: ['KeyE'],
  brake: ['Space'],
  pause: ['Escape', 'KeyP'],
  mute: ['KeyM'],
  reload: ['KeyR'],
};

// Named places in Verde Bay (original names, no real-world or GTA references).
export const PLACES = {
  garage: { name: "Mara's Garage", x: 500, y: 830 },
  bank: { name: 'Verde Bay Bank', x: 1100, y: 530 },
  marina: { name: 'Marina del Sol', x: 2150, y: 1830 },
  warehouse: { name: 'Old Cannery', x: 2000, y: 1130 },
  hospital: { name: 'St. Alba Hospital', x: 800, y: 1130 },
  policeHQ: { name: 'VBPD Central', x: 1400, y: 830 },
  shop: { name: 'Sunny Arms', x: 1700, y: 530 },
  diner: { name: 'Palmera Diner', x: 800, y: 1430 },
  stadium: { name: 'Verde Bowl', x: 2300, y: 500 },
};
