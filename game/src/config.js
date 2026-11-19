// VERDE BAY 3D v7 — every tunable number in one place.
// Map size, districts, vehicles, weapons, radio, prices, physics.

export const MAP = { w: 3400, h: 2200, minX: 40, minY: 40, maxX: 3360, maxY: 2080 };

// District rectangles: { x0, y0, x1, y1, name }.
// districtAt() checks them in order; the water channel is checked first.
export const DISTRICTS = [
  { id: 'water', x0: 2620, y0: 0, x1: 2900, y1: 2200, name: 'Verde Channel' },
  { id: 'isla', x0: 2900, y0: 700, x1: 3360, y1: 1500, name: 'Isla Verde' },
  { id: 'marina', x0: 1900, y0: 1750, x1: 2450, y1: 2050, name: 'Marina del Sol' },
  { id: 'strip', x0: 1800, y0: 1300, x1: 2400, y1: 1750, name: 'The Strip' },
  { id: 'beach', x0: 800, y0: 1400, x1: 1800, y1: 1900, name: 'Verde Beach' },
  { id: 'industrial', x0: 1800, y0: 700, x1: 2600, y1: 1300, name: 'Industrial Yards' },
  { id: 'downtown', x0: 700, y0: 550, x1: 1600, y1: 1100, name: 'Downtown' },
  { id: 'oldtown', x0: 80, y0: 450, x1: 600, y1: 1000, name: 'Old Town' },
  { id: 'residential', x0: 600, y0: 80, x1: 1700, y1: 520, name: 'Palms Residential' },
];

// Vertical avenues (x) and horizontal streets (y). Road half-width 18.
export const ROADS_X = [300, 700, 1100, 1500, 1900, 2300, 3100];
export const ROADS_Y = [300, 700, 1100, 1500, 1900];
export const ROAD_HALF = 18;

// Named places: the city the missions drive through. label is shown on the
// minimap and by districtNameAt() when the player is close.
export const PLACES = {
  garage: { x: 1050, y: 420, label: 'Safehouse Garage' },
  marina: { x: 2150, y: 1830, label: 'Marina del Sol' },
  stadium: { x: 950, y: 1300, label: 'Verde Stadium' },
  warehouse: { x: 2100, y: 1000, label: 'Harbor Warehouse' },
  ferry: { x: 2250, y: 1880, label: 'Ferry Terminal' },
  bank: { x: 1150, y: 750, label: 'Verde National Bank' },
  cannery: { x: 2000, y: 1130, label: 'Old Cannery' },
  pier: { x: 1350, y: 1850, label: 'Sunset Pier' },
  hotel: { x: 1250, y: 1600, label: 'Palms Hotel' },
  casino: { x: 2150, y: 1500, label: 'Neon Casino' },
  club: { x: 2050, y: 1600, label: 'Club Mirage' },
  dealership: { x: 1500, y: 900, label: 'Verde Motors' },
  diner: { x: 400, y: 800, label: 'Rosa Diner' },
  park: { x: 850, y: 550, label: 'Palms Park' },
  plaza: { x: 1150, y: 950, label: 'Liberty Plaza' },
  lighthouse: { x: 3200, y: 1250, label: 'Isla Lighthouse' },
  airstrip: { x: 3100, y: 950, label: 'Isla Airstrip' },
  shop: { x: 1400, y: 700, label: 'Verde Arms' },
  safehouse: { x: 1050, y: 420, label: 'Safehouse' },
  hospital: { x: 1400, y: 1100, label: 'Verde General' },
  station: { x: 700, y: 900, label: 'Police Station' },
};

// Vehicle types: top speed in world units per second.
export const CAR_TYPES = {
  sedan: { maxSpeed: 240, accel: 95, color: '#2e5fa3', label: 'Sedan' },
  sport: { maxSpeed: 300, accel: 135, color: '#d7263d', label: 'Sports' },
  taxi: { maxSpeed: 250, accel: 105, color: '#f4b400', label: 'Taxi' },
  truck: { maxSpeed: 180, accel: 62, color: '#6c757d', label: 'Truck' },
  van: { maxSpeed: 210, accel: 80, color: '#e9ecef', label: 'Van' },
  cop: { maxSpeed: 272, accel: 122, color: '#212529', label: 'Police Cruiser' },
};

export const NITRO = { max: 100, boost: 1.55, drain: 42, regen: 9 };

// Weapons: damage per hit, fire interval, magazine, range, price.
export const WEAPONS = {
  pistol: { name: 'P9 Pistol', damage: 34, rate: 0.28, mag: 12, range: 260, spread: 0.02, pellets: 1, price: 0 },
  smg: { name: 'VK-9 SMG', damage: 22, rate: 0.09, mag: 30, range: 240, spread: 0.06, pellets: 1, price: 1500 },
  shotgun: { name: 'M12 Scattergun', damage: 18, rate: 0.8, mag: 6, range: 180, spread: 0.14, pellets: 6, price: 2500 },
};

export const SHOP = {
  ammoPistol: { label: 'Pistol ammo (48)', price: 120 },
  ammoSmg: { label: 'SMG ammo (120)', price: 300 },
  ammoShotgun: { label: 'Shells (24)', price: 240 },
  armor: { label: 'Body armor (50)', price: 400 },
  health: { label: 'First aid (full health)', price: 250 },
};

export const RADIO = [
  { name: 'VERDE FM', desc: 'Sunset chill', hue: 210 },
  { name: 'NEON NIGHTS', desc: 'Synthwave drive', hue: 300 },
  { name: 'ISLA BEATS', desc: 'Island rhythm', hue: 30 },
];

export const WANTED = {
  maxLevel: 5,
  bustSeconds: 2.5,
  bustFine: 150,
  decayCalmSeconds: 10,
  copCarCount: [0, 2, 3, 4, 5, 6],
  footCopCount: [0, 0, 2, 3, 4, 5],
};

export const PLAYER = {
  walkSpeed: 150,
  runSpeed: 215,
  health: 100,
  packageReward: 250,
  packageCount: 10,
  trafficCars: 22,
  pedestrians: 36,
  parkedCars: 14,
};

export const COLORS = {
  sky: '#ffd9a0',
  sun: '#ffdfb0',
  sea: '#1e6f8e',
  sand: '#e8d5a3',
  grass: '#7da05c',
  asphalt: '#3a3f46',
  sidewalk: '#8a8f96',
};
