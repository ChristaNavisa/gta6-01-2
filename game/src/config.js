// VERDE BAY 3D — the game's design numbers: world, roads, districts,
// car tuning, places and the story. Same city and same six jobs as the
// 2D version; only the presentation is new.
export const WORLD_W = 2600;
export const WORLD_H = 2000;

// Road grid: vertical roads at these x, horizontal at these y. Roads are 64 wide.
export const ROAD_X = [200, 500, 800, 1100, 1400, 1700, 2000, 2300];
export const ROAD_Y = [200, 500, 800, 1100, 1400, 1700];
export const ROAD_W = 64;

// Beach strip along the south edge, water at the very bottom.
export const BEACH_Y = 1780;
export const WATER_Y = 1920;

// Sun-soaked palette for a modern coastal city. Hex numbers are for three.js,
// the matching css strings are for the 2D minimap.
export const PALETTE = {
  ground: 0x7fae5f,
  groundCss: '#7fae5f',
  park: 0x6da25e,
  sand: 0xe9d8a6,
  water: 0x2f9ec4,
  waterDeep: 0x2b7fa3,
  asphalt: 0x3d4149,
  roadLine: 0xffd166,
  sidewalk: 0xc9bfa8,
  buildingRoof: ['#e07a5f', '#f2cc8f', '#81b29a', '#f4a261', '#a8dadc', '#e76f51', '#b5838d', '#ffcdb2'],
  buildingWall: ['#d9d4c5', '#cdb89a', '#b7c4ce', '#e8dcc8', '#c9b8a3'],
  glass: 0x9fd8e8,
  downtown: ['#5d6d7e', '#7d8597', '#4a6fa5', '#6c757d'],
  // Flat warehouse roofs for the industrial east, warm stucco for the beach
  // front, brick reds for the old town west.
  industrial: ['#6b6f75', '#7a6a58', '#5f6b5a', '#8a7a5f'],
  beach: ['#f4a261', '#e9c46a', '#f7ede2', '#ee9b7a'],
  oldtown: ['#b5543c', '#c96f4a', '#a85438', '#d08a5a'],
  tree: 0x4d7c4f,
  treeLight: 0x6a9e5f,
  palm: 0x3e7d44,
  palmLight: 0x7fb069,
  trunk: 0x8a6f4d,
};

// Districts: named areas with their own look. Rects are in world coordinates;
// the first match wins, so order them from most specific to most general.
export const DISTRICTS = [
  { id: 'downtown', name: 'Downtown', x: 750, y: 450, w: 1000, h: 700, tint: 0x5a6e8c, label: 'DOWNTOWN' },
  { id: 'industrial', name: 'Old Cannery', x: 1850, y: 450, w: 750, h: 1050, tint: 0x464642, label: 'OLD CANNERY' },
  { id: 'beach', name: 'Marina del Sol', x: 0, y: 1500, w: 2600, h: 420, tint: 0xe9d8a6, label: 'MARINA DEL SOL' },
  { id: 'oldtown', name: 'Old Town', x: 0, y: 0, w: 650, h: 1500, tint: 0xb47846, label: 'OLD TOWN' },
  { id: 'residential', name: 'Verde Bay', x: 0, y: 0, w: WORLD_W, h: WORLD_H, tint: 0, label: 'VERDE BAY' },
];

// Car models: name, footprint (length x width in world units), top speed
// (units/s), accel, handling, colour pool.
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

// The story: six jobs from errand driver to the big score, plus the taxi
// side job. Same arc as the 2D version.
export const MISSIONS = [
  {
    id: 'first-job', title: 'First Job', reward: 300,
    briefing: "Mara needs a package run. Pick it up at her garage and take it to the Palmera Diner. Keep it clean.",
    stages: [
      { type: 'goto', target: 'garage', text: "Go to Mara's Garage" },
      { type: 'pickup', target: 'garage', text: 'Pick up the package' },
      { type: 'deliver', target: 'diner', text: 'Deliver the package to the Palmera Diner' },
    ],
  },
  {
    id: 'getaway', title: 'Getaway', reward: 600,
    briefing: "A client of Mara's is hot. Pick him up at the diner, then get him to the Verde Bowl — the cops will be looking.",
    stages: [
      { type: 'goto', target: 'diner', text: 'Pick up the client at the diner' },
      { type: 'driveTo', target: 'stadium', text: 'Drive the client to the Verde Bowl — lose the cops' },
      { type: 'escape', text: 'Lose the cops' },
    ],
  },
  {
    id: 'hot-wheels', title: 'Hot Wheels', reward: 900,
    briefing: "A Comet GT is parked at the marina, guarded by Vipers. Take the car — deal with the guards however you like — and bring it to the garage.",
    stages: [
      { type: 'goto', target: 'marina', text: 'Get to the marina' },
      { type: 'steal', target: 'garage', text: 'Steal the Comet GT and bring it to the garage' },
    ],
  },
  {
    id: 'payback', title: 'Payback', reward: 1200,
    briefing: "The Vipers hit one of Mara's drivers. Go to the Old Cannery and settle it. All of them.",
    stages: [
      { type: 'goto', target: 'warehouse', text: 'Go to the Old Cannery' },
      { type: 'eliminate', target: 'warehouse', count: 5, text: 'Take out the Vipers (0/5)' },
      { type: 'escapeArea', target: 'warehouse', text: 'Get clear of the cannery' },
    ],
  },
  {
    id: 'big-score', title: 'The Big Score', reward: 2500,
    briefing: "The Verde Bay Bank, Friday, 5pm. Grab the cash, then run for the boat at the marina. This is the one, Cole.",
    stages: [
      { type: 'goto', target: 'bank', text: 'Go to the Verde Bay Bank' },
      { type: 'grab', target: 'bank', text: 'Grab the cash — stay in the vault doorway' },
      { type: 'escape', text: 'Lose the cops and reach the marina boat' },
    ],
  },
  {
    id: 'harbor-heist', title: 'Harbor Heist', reward: 3500,
    briefing: "Mara's last play: the cannery safe holds the Vipers' cut. Crack it, grab the cash, and run for the boat at the marina — the whole VBPD will be on you.",
    stages: [
      { type: 'goto', target: 'warehouse', text: 'Get to the Old Cannery' },
      { type: 'grab', target: 'warehouse', text: 'Crack the safe — stay by the vault' },
      { type: 'escape', text: 'Lose the cops and reach the marina boat' },
    ],
  },
];
