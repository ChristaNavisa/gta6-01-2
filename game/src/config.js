// Tunables for VERDE BAY 3D v8: world, districts, vehicles, weapons, wanted.
export const WORLD = { w: 3400, h: 2100 };

export const DISTRICTS = {
  residential: { x0: 800, y0: 0, x1: 1400, y1: 600, name: 'Residential', ground: '#7a9a5b' },
  downtown: { x0: 800, y0: 600, x1: 1400, y1: 1100, name: 'Downtown', ground: '#8a8f98' },
  oldtown: { x0: 0, y0: 400, x1: 600, y1: 1000, name: 'Old Town', ground: '#9a7b5b' },
  beach: { x0: 900, y0: 1500, x1: 1700, y1: 2000, name: 'Beachfront', ground: '#e8d29a' },
  industrial: { x0: 1900, y0: 800, x1: 2500, y1: 1300, name: 'Industrial Zone', ground: '#6f6f6f' },
  strip: { x0: 1900, y0: 1400, x1: 2400, y1: 1750, name: 'The Strip', ground: '#3d2b4d' },
  marina: { x0: 1900, y0: 1750, x1: 2400, y1: 2050, name: 'Marina del Sol', ground: '#4a7a8a' },
  isla: { x0: 2600, y0: 900, x1: 3350, y1: 1400, name: 'Isla Verde', ground: '#5b8a4a' },
  water: { x0: 2600, y0: 0, x1: 2900, y1: 950, name: 'Verde Channel', ground: '#2a6a8a' },
};

export const CAR_TYPES = {
  sedan: { maxSpeed: 150, accel: 130, label: 'Sedan', nitroMax: 100 },
  sport: { maxSpeed: 195, accel: 165, label: 'Sports', nitroMax: 100 },
  taxi: { maxSpeed: 150, accel: 130, label: 'Taxi', nitroMax: 100 },
  truck: { maxSpeed: 110, accel: 90, label: 'Truck', nitroMax: 100 },
  cop: { maxSpeed: 178, accel: 150, label: 'Police Cruiser', nitroMax: 0 },
  jeep: { maxSpeed: 205, accel: 170, label: 'Military Jeep', nitroMax: 0 },
};

export const NITRO_MULT = 1.55;
export const NITRO_DRAIN = 42; // per second while boosting
export const NITRO_REGEN = 6; // per second while not boosting

export const WEAPONS = [
  { name: 'P9 Pistol', mag: 12, reserve: 60, damage: 34, rate: 0.22, spread: 0.05, range: 320, price: 0 },
  { name: 'VK-9 SMG', mag: 30, reserve: 180, damage: 18, rate: 0.09, spread: 0.09, range: 280, price: 1500 },
  { name: 'M12 Scattergun', mag: 6, reserve: 36, damage: 22, rate: 0.85, spread: 0.22, range: 170, price: 2500, pellets: 6 },
];

export const SHOP = {
  smg: { label: 'VK-9 SMG', price: 1500 },
  scattergun: { label: 'M12 Scattergun', price: 2500 },
  ammo: { label: 'Ammo refill (all weapons)', price: 400 },
  armor: { label: 'Body armor (+50)', price: 600 },
  medkit: { label: 'First aid (+50 HP)', price: 300 },
};

export const WANTED_HEAT = [0, 10, 25, 45, 65, 85]; // heat needed for each level
export const WANTED_DECAY = 2.2; // heat per second when quiet
export const WANTED_QUIET_TIME = 5; // seconds without crime before decay starts

export const DAY_LENGTH = 240; // seconds per full day/night cycle
export const PACKAGE_REWARD = 250;
export const PACKAGE_COUNT = 10;

export const RADIO_STATIONS = ['Verde FM', 'Neon Nights', 'Isla Beats'];
