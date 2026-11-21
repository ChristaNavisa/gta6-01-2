// VERDE BAY v9 — game data: the city, its cars, weapons, crew, districts and story.
// Every number here is a design decision the rest of the game reads: no magic
// constants are hidden inside the simulation files.
export const WORLD = {
  name: 'VERDE BAY',
  blocks: 7, // city blocks across (odd, so a plaza sits at the centre)
  blockSize: 46,
  roadWidth: 14,
  groundSize: 460,
  waterLevel: -0.4,
  dayLengthSec: 300, // one full day/night cycle
  startTime: 9.5, // morning, sun-soaked
};

export const DISTRICTS = [
  { id: 'marina', name: 'Marina', color: 0x2fa8a0, center: [-150, -150], unlock: 'Shop discount 10%' },
  { id: 'downtown', name: 'Downtown', color: 0xc9a227, center: [0, -60], unlock: 'Free car: Vesper GT' },
  { id: 'harbor', name: 'Harbor', color: 0x4a7ec2, center: [150, 60], unlock: 'Crew ability boost' },
  { id: 'hills', name: 'Verde Hills', color: 0x7fb069, center: [-120, 140], unlock: 'Gold paint' },
  { id: 'oldtown', name: 'Old Town', color: 0xb56576, center: [120, -140], unlock: 'King of Verde Bay' },
];

export const RESPECT_TIERS = [
  { at: 25, label: 'Street Known', reward: '10% shop discount in every district' },
  { at: 50, label: 'Bay Runner', reward: 'Free car: Vesper GT (garage)' },
  { at: 75, label: 'District Boss', reward: 'Crew abilities doubled' },
  { at: 100, label: 'King of Verde Bay', reward: 'Gold paint + $10,000' },
];

export const WEAPONS = [
  { id: 'pistol', name: 'P9 Pistol', damage: 34, rate: 0.28, range: 60, auto: false, ammo: 120, color: 0xd8d8d8, slot: 1 },
  { id: 'smg', name: 'VK-9 SMG', damage: 18, rate: 0.09, range: 48, auto: true, ammo: 240, color: 0x9fb4c7, slot: 2 },
  { id: 'shotgun', name: 'Breacher 12', damage: 26, rate: 0.8, range: 26, auto: false, ammo: 48, pellets: 6, color: 0xc98a3d, slot: 3 },
  { id: 'rifle', name: 'AR-77 Rifle', damage: 42, rate: 0.13, range: 95, auto: true, ammo: 180, color: 0x6b7f5e, slot: 4 },
  { id: 'lmg', name: 'Harbor LMG', damage: 26, rate: 0.07, range: 80, auto: true, ammo: 300, color: 0x8a6f4d, slot: 5 },
];

export const CARS = [
  { id: 'hatch', name: 'Pip Hatch', price: 0, topSpeed: 26, accel: 14, handling: 2.4, color: 0x8a94a6, kind: 'hatch' },
  { id: 'sedan', name: 'Marlin Sedan', price: 2500, topSpeed: 31, accel: 17, handling: 2.6, color: 0x3f6fb5, kind: 'sedan' },
  { id: 'sport', name: 'Vesper GT', price: 9000, topSpeed: 42, accel: 26, handling: 3.4, color: 0xc23b2e, kind: 'sport' },
  { id: 'muscle', name: 'Bison Muscle', price: 12000, topSpeed: 38, accel: 22, handling: 2.8, color: 0xe0a030, kind: 'muscle' },
  { id: 'taxi', name: 'Bay Taxi', price: 4000, topSpeed: 29, accel: 15, handling: 2.5, color: 0xf2c200, kind: 'taxi' },
  { id: 'truck', name: 'Hauler Truck', price: 7000, topSpeed: 24, accel: 12, handling: 2.0, color: 0x5e7d6a, kind: 'truck' },
];

export const GARAGE_UPGRADES = [
  { id: 'engine1', name: 'Engine Stage 1', price: 1500, effect: '+15% top speed', key: 'engine', level: 1 },
  { id: 'engine2', name: 'Engine Stage 2', price: 3500, effect: '+30% top speed', key: 'engine', level: 2 },
  { id: 'armor1', name: 'Armor Plating', price: 2000, effect: '2x vehicle health', key: 'armor', level: 1 },
  { id: 'noskit', name: 'NOS Kit', price: 1800, effect: 'Nitrous tank +50%', key: 'nos', level: 1 },
  { id: 'paint_gold', name: 'Gold Paint', price: 3000, effect: 'Gold paint job', key: 'paint', level: 1, needsRespect: 75 },
  { id: 'paint_neon', name: 'Neon Underglow', price: 1200, effect: 'Neon underglow at night', key: 'neon', level: 1 },
];

export const CREW_DEFS = [
  { id: 'mara', name: 'Mara Voss', role: 'Driver', ability: 'Race payout +20% and NOS refills 25% faster', unlockMission: 4, color: 0xe06a9a },
  { id: 'dario', name: 'Dario Kane', role: 'Muscle', ability: 'Police lose your trail 30% faster', unlockMission: 8, color: 0x7fb069 },
];

export const PLAYER = {
  walkSpeed: 7,
  runSpeed: 11,
  health: 100,
  startMoney: 500,
};

export const POLICE = {
  chaseSpeed: 34,
  spawnDistance: 55,
  maxCars: 6,
  heatDecayPerSec: 1.6,
  heatPerCrime: 22,
};

export const RACE_DEFS = [
  { id: 'bay_sprint', name: 'Bay Sprint', checkpoints: 6, parTimeSec: 95, payout: 3500 },
  { id: 'harbor_loop', name: 'Harbor Loop', checkpoints: 8, parTimeSec: 130, payout: 5200 },
];

// 12 story missions. objective kinds: goto, deliver, escape, race, defend,
// hold, steal, trial. Each step is a waypoint the player must reach or an
// action to finish; payout and respect are paid on completion.
export const MISSIONS = [
  { id: 1, title: 'First Wheels', giver: 'Rico', district: 'marina',
    briefing: 'Rico needs wheels. Take any car on the street and bring it to the marina marker.',
    steps: [{ kind: 'steal' }, { kind: 'goto', x: -150, z: -150, label: 'Marina drop-off' }],
    payout: 800, respect: 6 },
  { id: 2, title: 'Courier Run', giver: 'Rico', district: 'downtown',
    briefing: 'Three parcels, three corners of Downtown. Drive fast, stay clean.',
    steps: [
      { kind: 'goto', x: -40, z: -100, label: 'Parcel 1 — Plaza' },
      { kind: 'goto', x: 60, z: -20, label: 'Parcel 2 — Arcade' },
      { kind: 'goto', x: 0, z: 60, label: 'Parcel 3 — Market' },
    ],
    payout: 1500, respect: 7 },
  { id: 3, title: 'Getaway Driver', giver: 'Mara Voss', district: 'harbor',
    briefing: 'The cops are on us. Lose a 2-star wanted level for 60 seconds. NOS helps.',
    steps: [{ kind: 'escape', seconds: 60, stars: 2 }],
    payout: 2200, respect: 9 },
  { id: 4, title: 'Street Race: Bay Sprint', giver: 'Mara Voss', district: 'marina',
    briefing: 'Six checkpoints around the bay. Beat the par time and Mara joins your crew.',
    steps: [{ kind: 'race', race: 'bay_sprint' }],
    payout: 3500, respect: 12, unlockCrew: 'mara' },
  { id: 5, title: 'Repo Run', giver: 'Dario Kane', district: 'oldtown',
    briefing: 'A Vesper GT is parked in Old Town. Take it and bring it to the garage — no police.',
    steps: [{ kind: 'steal', carId: 'sport' }, { kind: 'goto', x: -40, z: 140, label: 'Verde Garage' }],
    payout: 3000, respect: 10 },
  { id: 6, title: 'Protection', giver: 'Shopkeeper Ana', district: 'downtown',
    briefing: 'Rivals are shaking down Ana’s shop. Hold the plaza and stop five attackers.',
    steps: [{ kind: 'defend', x: 0, z: -60, count: 5, label: 'Defend the plaza' }],
    payout: 2800, respect: 11 },
  { id: 7, title: 'The Drop', giver: 'Rico', district: 'harbor',
    briefing: 'A package for the Harbor docks. The police are watching — stay under 2 stars.',
    steps: [{ kind: 'goto', x: 150, z: 60, label: 'Harbor docks', maxStars: 2 }],
    payout: 2600, respect: 9 },
  { id: 8, title: 'Heist Prep: Crew Up', giver: 'Dario Kane', district: 'hills',
    briefing: 'Meet Dario in the Hills. He wants proof you can handle a crew before he joins.',
    steps: [{ kind: 'goto', x: -120, z: 140, label: 'Meet Dario' }, { kind: 'hold', seconds: 20, label: 'Hold the lookout' }],
    payout: 2000, respect: 12, unlockCrew: 'dario' },
  { id: 9, title: 'Bank Job', giver: 'Rico', district: 'downtown',
    briefing: 'Hit the Downtown bank, hold the vault for 30 seconds, then lose the heat.',
    steps: [
      { kind: 'goto', x: 20, z: -100, label: 'Verde Bank' },
      { kind: 'hold', seconds: 30, label: 'Hold the vault' },
      { kind: 'escape', seconds: 45, stars: 3 },
    ],
    payout: 8000, respect: 15 },
  { id: 10, title: 'Turbo Trial', giver: 'Mara Voss', district: 'harbor',
    briefing: 'A timed NOS trial through the Harbor Loop. Eight checkpoints, 130 seconds.',
    steps: [{ kind: 'race', race: 'harbor_loop' }],
    payout: 5200, respect: 12 },
  { id: 11, title: 'District War', giver: 'Dario Kane', district: 'oldtown',
    briefing: 'Three rival crews hold Old Town corners. Clear all three and the district is yours.',
    steps: [
      { kind: 'defend', x: 100, z: -120, count: 4, label: 'Clear the corner' },
      { kind: 'defend', x: 140, z: -160, count: 4, label: 'Clear the alley' },
      { kind: 'defend', x: 80, z: -90, label: 'Clear the square' },
    ],
    payout: 6500, respect: 14 },
  { id: 12, title: 'The Big Score', giver: 'Rico', district: 'marina',
    briefing: 'The gold car. Take it from the Marina, survive a 5-star response, deliver it to the garage. This is the one they will talk about.',
    steps: [
      { kind: 'steal', carId: 'muscle' },
      { kind: 'goto', x: -40, z: 140, label: 'Verde Garage', stars: 5 },
    ],
    payout: 12000, respect: 20 },
];

export const SAVE_KEY = 'verde-bay-v9-save';
