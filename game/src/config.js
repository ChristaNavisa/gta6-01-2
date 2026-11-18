// Tuning constants for VERDE BAY 3D. One place for every number the sim,
// the city and the renderer agree on, so a balance change is a one-line edit.

export const CONFIG = {
  // World: the main island spans x 0..2600, y 0..2000; Isla Verde sits east
  // across the bridge at x 2720..3380, so the whole map is 3400 x 2000.
  world: { w: 3400, h: 2000, mainW: 2600 },
  bridge: { x0: 2600, x1: 2720, y0: 940, y1: 1140 },

  // Player on foot.
  player: {
    walkSpeed: 170, // world units per second
    runSpeed: 260,
    radius: 14,
    health: 100,
    pistolRange: 320,
    pistolDamage: 34,
    fireCooldown: 0.28,
  },

  // Cars. Top speeds are world units per second (~1 unit = 0.3 m).
  cars: {
    sedan: { topSpeed: 620, accel: 420, brake: 700, turn: 2.6, grip: 8 },
    sport: { topSpeed: 780, accel: 560, brake: 800, turn: 3.0, grip: 9 },
    taxi: { topSpeed: 580, accel: 380, brake: 650, turn: 2.5, grip: 8 },
    truck: { topSpeed: 460, accel: 260, brake: 500, turn: 1.9, grip: 7 },
    cop: { topSpeed: 700, accel: 520, brake: 800, turn: 3.1, grip: 9 },
  },

  // Traffic and pedestrians.
  traffic: { count: 16, cruiseSpeed: 240 },
  peds: { count: 22, walkSpeed: 55 },

  // Wanted system.
  wanted: {
    maxLevel: 5,
    heatPerCrime: { steal: 35, grab: 80, assault: 25, kill: 60 },
    decayPerSecond: 6, // heat drains when no crime is committed
    copSpawnInterval: 4,
    bustDistance: 34,
    bustHoldSeconds: 1.5,
    bustFine: 200,
  },

  // Missions.
  mission: {
    targetRadius: 80, // how close the player must be to complete a goto
    grabHoldSeconds: 2.0, // seconds the player must hold the grab point
    escapeRadius: 320, // how far away escapeArea must take the player
  },

  // Camera and rendering.
  camera: { height: 210, distance: 280, lookAhead: 90, smooth: 5 },
  day: { sunAngle: -0.9, dusk: true },
};
