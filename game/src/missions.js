// The Verde Bay story: ten missions, $31,000 of story cash.
// Rewards are per mission; the running total is what the HUD shows.
// Stage types the sim drives: goto, pickup, deliver, driveTo, grab, steal,
// eliminate, escape, escapeArea. A stage's `target` is a place name in city.js.

import { VEHICLES, WANTED } from './config.js';
import { dist } from './util.js';

export const MISSIONS = [
  {
    id: 'first-wheels',
    title: 'First Wheels',
    reward: 500,
    briefing: 'Marla needs wheels. Steal a parked car and bring it to Sunset Garage.',
    stages: [
      { type: 'steal', target: 'garage', text: 'Steal a parked car' },
      { type: 'driveTo', target: 'garage', text: 'Drive it to Sunset Garage' },
    ],
  },
  {
    id: 'diner-dash',
    title: 'Diner Dash',
    reward: 500,
    briefing: 'Pick up Marla\'s lunch order at the diner and deliver it to the stadium.',
    stages: [
      { type: 'pickup', target: 'diner', text: 'Pick up the order at Marla Diner' },
      { type: 'deliver', target: 'stadium', text: 'Deliver it to Verde Stadium' },
    ],
  },
  {
    id: 'cannery-job',
    title: 'The Cannery Job',
    reward: 1500,
    briefing: 'A crate of "canned fish" at the old cannery is worth a fortune. Grab it and get out.',
    stages: [
      { type: 'goto', target: 'cannery', text: 'Reach the Old Cannery' },
      { type: 'grab', target: 'warehouse', text: 'Grab the crate' },
      { type: 'escape', target: 'stadium', text: 'Lose the heat at the stadium' },
    ],
  },
  {
    id: 'night-taxi',
    title: 'Night Shift Taxi',
    reward: 1000,
    briefing: 'Drive the cab tonight. A high roller at Hotel Miramar wants a ride to the casino.',
    stages: [
      { type: 'driveTo', target: 'taxi', text: 'Get to the Taxi Stand' },
      { type: 'pickup', target: 'hotel', text: 'Pick up the high roller' },
      { type: 'deliver', target: 'casino', text: 'Drop them at Casino Royale Verde' },
    ],
  },
  {
    id: 'big-score',
    title: 'The Big Score',
    reward: 2000,
    briefing: 'Verde Bay Bank, noon, one bag. Walk in, take it, walk out. The marina is your way out.',
    stages: [
      { type: 'goto', target: 'bank', text: 'Reach Verde Bay Bank' },
      { type: 'grab', target: 'bank', text: 'Grab the money bag' },
      { type: 'escape', target: 'marina', text: 'Escape to the marina' },
    ],
  },
  {
    id: 'harbor-heist',
    title: 'Harbor Heist',
    reward: 3500,
    briefing: 'The warehouse on the docks hides the syndicate payroll. Take it — the whole harbor will know.',
    stages: [
      { type: 'goto', target: 'warehouse', text: 'Reach the Cannery Warehouse' },
      { type: 'grab', target: 'warehouse', text: 'Grab the payroll' },
      { type: 'escape', target: 'marina', text: 'Escape to the marina' },
    ],
  },
  {
    id: 'island-run',
    title: 'Island Run',
    reward: 4000,
    briefing: 'A package for Villa Solana, across the bridge on Isla Verde. Then back to the Strip.',
    stages: [
      { type: 'driveTo', target: 'bridge', text: 'Cross Verde Bridge' },
      { type: 'goto', target: 'villa', text: 'Reach Villa Solana' },
      { type: 'deliver', target: 'casino', text: 'Deliver the receipt to the casino' },
    ],
  },
  {
    id: 'last-ferry',
    title: 'The Last Ferry',
    reward: 5000,
    briefing: 'The last ferry carries the syndicate ledger. Take it before it sails.',
    stages: [
      { type: 'goto', target: 'ferry', text: 'Reach the Ferry Terminal' },
      { type: 'grab', target: 'ferry', text: 'Grab the ledger' },
      { type: 'escape', target: 'marina', text: 'Escape to the marina' },
    ],
  },
  {
    id: 'neon-grand-prix',
    title: 'Neon Grand Prix',
    reward: 6000,
    briefing: 'Street race down the Strip. Three checkpoints, one winner. Nitro is legal tonight.',
    stages: [
      { type: 'driveTo', target: 'casino', text: 'Line up at the casino' },
      { type: 'driveTo', target: 'stadium', text: 'Checkpoint 1: the stadium' },
      { type: 'driveTo', target: 'beach', text: 'Checkpoint 2: the beach' },
      { type: 'driveTo', target: 'casino', text: 'Finish at the casino' },
    ],
  },
  {
    id: 'the-vault',
    title: 'The Vault',
    reward: 7000,
    briefing: 'The bank vault. Four guards, one drill, seven thousand reasons to run.',
    stages: [
      { type: 'goto', target: 'bank', text: 'Reach Verde Bay Bank' },
      { type: 'eliminate', target: 'bank', text: 'Deal with the vault guards' },
      { type: 'grab', target: 'bank', text: 'Crack the vault' },
      { type: 'escape', target: 'stadium', text: 'Escape to the stadium' },
    ],
  },
];

export const TOTAL_STORY_CASH = MISSIONS.reduce((a, m) => a + m.reward, 0);

/** Set up the current stage: pick the steal target, spawn the gang, or raise the heat on a grab. */
export function beginStage(S) {
  const def = MISSIONS[S.mission.index];
  const stage = def.stages[S.mission.stage];
  S.mission.text = stage.text;
  S.mission.grabTimer = 0;
  if (stage.type === 'steal') {
    let best = null;
    let bestD = 700;
    for (const car of S.cars) {
      if (car.owner !== 'parked') continue;
      const d = dist(S.player.x, S.player.y, car.x, car.y);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    if (!best) {
      const spec = VEHICLES.sedan;
      best = {
        type: 'sedan', x: S.player.x + 60, y: S.player.y, angle: 0, speed: 0,
        color: '#2e5fa3', owner: 'parked', maxSpeed: spec.maxSpeed, accel: spec.accel,
        reverse: spec.reverse, turn: spec.turn, nitro: spec.nitroMax, nitroMax: spec.nitroMax,
        hp: 100, bustTimer: 0, length: 56, width: 34,
      };
      S.cars.push(best);
    }
    S.mission.data.targetCar = best;
  } else if (stage.type === 'eliminate') {
    const place = S.city.places[stage.target];
    const gang = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      gang.push({ x: place.x + Math.cos(a) * 90, y: place.y + Math.sin(a) * 90, angle: a, hp: 100, shootTimer: 0.2 + (i % 3) * 0.3 });
    }
    S.gang = gang;
    S.mission.data.gang = gang;
  } else if (stage.type === 'grab') {
    // The grab itself is the crime: the heat jumps the moment it starts.
    const heat = def.id === 'the-vault' ? 200 : 120;
    S.wanted.heat = Math.max(S.wanted.heat, heat);
    S.wanted.lastCrime = S.time;
    let level = 0;
    for (let i = 0; i < WANTED.thresholds.length; i++) {
      if (S.wanted.heat >= WANTED.thresholds[i]) level = i + 1;
    }
    S.wanted.level = level;
  }
}

/** Start mission `index` on a game state: resets the mission tracker. */
export function startMission(S, index) {
  const def = MISSIONS[index];
  if (!def) return;
  S.mission = {
    active: true,
    index,
    stage: 0,
    data: {},
    grabTimer: 0,
    text: def.stages[0].text,
    title: def.title,
  };
  S.stats.missionAttempts = (S.stats.missionAttempts || 0) + 1;
  beginStage(S);
}
