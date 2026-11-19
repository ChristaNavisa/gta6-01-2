// VERDE BAY 3D v8 — 12 story missions, $48,000 of story cash, plus the crime
// helper the sim uses (kept here so sim.js can import it with no cycle).
import { WANTED_HEAT } from './config.js';
import { dist2 } from './util.js';
import { makeCar } from './sim.js';

export const MISSIONS = [
  {
    id: 'first-wheels', title: 'First Wheels', reward: 500,
    briefing: 'Your cousin left a ride at the Verde Garage. Pick it up and take it for a spin to the stadium.',
    stages: [
      { type: 'goto', target: 'garage', text: 'Get to the Verde Garage' },
      { type: 'driveTo', target: 'stadium', text: 'Drive to Verde Stadium' },
    ],
  },
  {
    id: 'taxi-takedown', title: 'Taxi Takedown', reward: 800,
    briefing: 'A rival crew is running cabs on your turf. Jack their taxi and bring it home.',
    stages: [
      { type: 'goto', target: 'taxi', text: 'Get to the Taxi Rank' },
      { type: 'steal', target: 'taxi', text: 'Steal the rival taxi, then lose it at the garage' },
    ],
  },
  {
    id: 'dockside-deal', title: 'Dockside Deal', reward: 1000,
    briefing: 'A buyer is waiting at the docks. Drive there, grab the package, deliver it to the warehouse.',
    stages: [
      { type: 'driveTo', target: 'dock', text: 'Drive to the Dockside meet' },
      { type: 'pickup', target: 'dock', text: 'Grab the package' },
      { type: 'deliver', target: 'warehouse', text: 'Deliver it to the Old Warehouse' },
    ],
  },
  {
    id: 'big-score', title: 'The Big Score', reward: 1400,
    briefing: 'The Verde Bank is soft at lunch. Grab the cash and lose the heat at the Marina.',
    stages: [
      { type: 'goto', target: 'bank', text: 'Case the Verde Bank' },
      { type: 'grab', target: 'bank', text: 'Grab the cash', wanted: 2 },
      { type: 'escape', target: 'marina', text: 'Escape to the Marina' },
    ],
  },
  {
    id: 'cannery-run', title: 'Cannery Run', reward: 1800,
    briefing: 'The Old Cannery has crates that need moving. Load up and drop them at Port Verde.',
    stages: [
      { type: 'driveTo', target: 'cannery', text: 'Drive to the Old Cannery' },
      { type: 'pickup', target: 'cannery', text: 'Load the crates' },
      { type: 'deliver', target: 'port', text: 'Drop them at Port Verde' },
    ],
  },
  {
    id: 'harbor-heist', title: 'Harbor Heist', reward: 3500,
    briefing: 'A shipment is sitting in the Old Warehouse. Take it — the cops will notice.',
    stages: [
      { type: 'goto', target: 'warehouse', text: 'Get to the Old Warehouse' },
      { type: 'grab', target: 'warehouse', text: 'Grab the shipment', wanted: 2 },
      { type: 'escape', target: 'marina', text: 'Escape to the Marina' },
    ],
  },
  {
    id: 'island-run', title: 'Island Run', reward: 4000,
    briefing: 'Run cargo across the channel: ferry terminal to the Isla Verde Dock.',
    stages: [
      { type: 'driveTo', target: 'ferry', text: 'Drive to the Ferry Terminal' },
      { type: 'pickup', target: 'ferry', text: 'Pick up the cargo' },
      { type: 'deliver', target: 'boat', text: 'Deliver it to the Isla Verde Dock' },
    ],
  },
  {
    id: 'last-ferry', title: 'The Last Ferry', reward: 5000,
    briefing: 'The last ferry leaves at midnight with a briefcase on it. Grab it and run.',
    stages: [
      { type: 'goto', target: 'ferry', text: 'Catch the last ferry' },
      { type: 'grab', target: 'ferry', text: 'Grab the briefcase', wanted: 2 },
      { type: 'escape', target: 'marina', text: 'Escape to the Marina' },
    ],
  },
  {
    id: 'neon-grand-prix', title: 'Neon Grand Prix', reward: 6000,
    briefing: 'An illegal street race through The Strip. Beat the rival racers to the casino.',
    stages: [
      { type: 'driveTo', target: 'strip', text: 'Race to The Strip' },
      { type: 'eliminate', target: 'strip', text: 'Clear the rival racers' },
      { type: 'deliver', target: 'casino', text: 'Finish at the Neon Crown Casino' },
    ],
  },
  {
    id: 'the-vault', title: 'The Vault', reward: 7000,
    briefing: 'The Verde Bank vault. Guards, then the grab — three stars the moment you touch it.',
    stages: [
      { type: 'goto', target: 'bank', text: 'Get to the Verde Bank' },
      { type: 'eliminate', target: 'bank', text: 'Take out the guards' },
      { type: 'grab', target: 'bank', text: 'Crack the vault', wanted: 3 },
      { type: 'escape', target: 'stadium', text: 'Escape to the Stadium' },
    ],
  },
  {
    id: 'neon-crown', title: 'Neon Crown', reward: 8000, night: true,
    briefing: 'Midnight on The Strip: a race and a shootout, finishing at the Neon Crown Casino.',
    stages: [
      { type: 'driveTo', target: 'strip', text: 'Race through The Strip at night' },
      { type: 'eliminate', target: 'strip', text: 'Win the shootout on The Strip' },
      { type: 'deliver', target: 'casino', text: 'Finish at the Neon Crown Casino' },
    ],
  },
  {
    id: 'king-of-verde', title: 'King of Verde', reward: 9000,
    briefing: 'The final heist: steal the casino vault, then escape by boat to Isla Verde.',
    stages: [
      { type: 'goto', target: 'casino', text: 'Get inside the Neon Crown Casino' },
      { type: 'grab', target: 'casino', text: 'Steal the casino vault', wanted: 4 },
      { type: 'escape', target: 'boat', text: 'Escape by boat to Isla Verde' },
    ],
  },
];

export const TOTAL_STORY_CASH = MISSIONS.reduce((a, m) => a + m.reward, 0);

// Raise the wanted level to at least `level` (heat jumps to that level's floor).
export function commitCrime(S, level) {
  if (level <= S.wanted.level) return;
  S.wanted.level = level;
  S.wanted.heat = WANTED_HEAT[level] + 1;
  S.wanted.quiet = 0;
  S.wanted.maxLevel = Math.max(S.wanted.maxLevel || 0, level);
}

export function startMission(S, index) {
  const def = MISSIONS[index];
  if (!def) return false;
  S.mission = { active: true, index, stage: 0, data: {}, def, failed: false };
  if (def.night) S.dayTime = 0.88; // midnight on The Strip
  beginStage(S);
  return true;
}

function spawnGang(S, place, n) {
  const gang = [];
  for (let i = 0; i < n; i++) {
    gang.push({
      x: place.x + (i - n / 2) * 40, y: place.y + ((i % 2) * 60 - 30),
      hp: 100, angle: 0, shootTimer: 1 + i * 0.4, dead: false,
    });
  }
  return gang;
}

function beginStage(S) {
  const def = S.mission.def;
  const stage = def.stages[S.mission.stage];
  if (!stage) return;
  S.mission.data = {};
  if (stage.type === 'grab' && stage.wanted) commitCrime(S, stage.wanted);
  if (stage.type === 'eliminate') {
    const place = S.city.places[stage.target];
    S.mission.data.gang = spawnGang(S, place, 3 + (S.mission.index >= 8 ? 2 : 0));
  }
  if (stage.type === 'steal') {
    const place = S.city.places[stage.target];
    const car = makeCar('taxi', place.x + 30, place.y, 0, '#f4b400', 'target');
    S.cars.push(car);
    S.mission.data.targetCar = car;
  }
}

function stageDone(S) {
  const def = S.mission.def;
  const stage = def.stages[S.mission.stage];
  const p = S.player;
  const place = stage.target ? S.city.places[stage.target] : null;
  switch (stage.type) {
    case 'goto':
    case 'driveTo':
    case 'pickup':
    case 'deliver':
    case 'grab':
    case 'escape':
      return place && dist2(p.x, p.y, place.x, place.y) < 75;
    case 'escapeArea':
      return place && dist2(p.x, p.y, place.x, place.y) > 400;
    case 'steal': {
      const car = S.mission.data.targetCar;
      const g = S.city.places.garage;
      return !!car && p.car === car && dist2(p.x, p.y, g.x, g.y) < 75;
    }
    case 'eliminate': {
      const gang = S.mission.data.gang || [];
      return gang.length > 0 && gang.every((g) => g.hp <= 0);
    }
    default:
      return false;
  }
}

export function updateMission(S, dt) {
  if (!S.mission.active) return;
  if (stageDone(S)) {
    S.mission.stage += 1;
    if (S.mission.stage >= S.mission.def.stages.length) {
      // Mission complete: pay out, advance, fanfare.
      S.player.cash += S.mission.def.reward;
      S.stats.missionsDone += 1;
      S.fanfare = { text: `MISSION COMPLETE — ${S.mission.def.title}  +$${S.mission.def.reward}`, t: 0 };
      S.mission.active = false;
      S.mission.index += 1;
      S.mission.stage = 0;
      S.autosave = true;
      return;
    }
    beginStage(S);
  }
}

export function failMission(S, reason) {
  if (!S.mission.active) return;
  S.mission.active = false;
  S.mission.failed = true;
  S.mission.failReason = reason;
  S.fanfare = { text: `MISSION FAILED — ${reason}`, t: 0 };
  S.wanted.level = 0;
  S.wanted.heat = 0;
  const hospital = S.city.places.hospital;
  S.player.x = hospital.x; S.player.y = hospital.y;
  S.player.health = 50;
  if (S.player.car) { S.player.car = null; S.player.onFoot = true; }
}
