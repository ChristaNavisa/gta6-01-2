// VERDE BAY 3D v7 — the story: 10 missions, $31,000 of story cash.
// Pure logic over the game state S: no DOM, no THREE, safe to import from Node.
// Stage types: goto, driveTo, pickup, deliver, steal, eliminate, grab, escape, escapeArea.

import { dist } from './util.js';
import { CAR_TYPES } from './config.js';

export const MISSIONS = [
  {
    id: 'first-wheels', title: 'First Wheels', giver: 'Rosa', reward: 500,
    brief: 'Rosa needs wheels. Lift the red sports car from Verde Motors and bring it to the garage.',
    stages: [
      { type: 'goto', target: 'dealership', text: 'Go to Verde Motors' },
      { type: 'steal', target: 'garage', spawn: 'dealership', carType: 'sport', text: 'Steal the sports car, take it to the garage' },
    ],
  },
  {
    id: 'taxi-takedown', title: 'Taxi Takedown', giver: 'Rosa', reward: 800,
    brief: 'A rival crew is shaking down Rosa Diner. Clear them out, then get clear of the area.',
    stages: [
      { type: 'goto', target: 'diner', text: 'Go to Rosa Diner' },
      { type: 'eliminate', target: 'diner', count: 5, text: 'Take out the rival crew' },
      { type: 'escapeArea', target: 'diner', text: 'Get clear of the diner area' },
    ],
  },
  {
    id: 'dockside-deal', title: 'Dockside Deal', giver: 'Marco', reward: 1000,
    brief: 'Marco has a package waiting on Sunset Pier. Drive out, grab it, run it to the Harbor Warehouse.',
    stages: [
      { type: 'driveTo', target: 'pier', text: 'Drive to Sunset Pier' },
      { type: 'pickup', target: 'pier', text: 'Pick up the package' },
      { type: 'deliver', target: 'warehouse', text: 'Deliver it to the Harbor Warehouse' },
    ],
  },
  {
    id: 'big-score', title: 'The Big Score', giver: 'Marco', reward: 1400,
    brief: 'Verde National Bank keeps its afternoon take in the back room. Grab it and lose the heat at the marina.',
    stages: [
      { type: 'goto', target: 'bank', text: 'Go to Verde National Bank' },
      { type: 'grab', target: 'bank', wanted: 2, text: 'Grab the afternoon take' },
      { type: 'escape', target: 'marina', text: 'Lose the cops at the marina' },
    ],
  },
  {
    id: 'cannery-run', title: 'Cannery Run', giver: 'Rosa', reward: 1800,
    brief: 'The Old Cannery hides a crate Rosa paid for. Drive over, pick it up, drop it at the stadium.',
    stages: [
      { type: 'driveTo', target: 'cannery', text: 'Drive to the Old Cannery' },
      { type: 'pickup', target: 'cannery', text: 'Pick up the crate' },
      { type: 'deliver', target: 'stadium', text: 'Deliver it to Verde Stadium' },
    ],
  },
  {
    id: 'harbor-heist', title: 'Harbor Heist', giver: 'Marco', reward: 3500,
    brief: 'A shipment lands at the Harbor Warehouse tonight. Take it while the dock crew is on break.',
    stages: [
      { type: 'goto', target: 'warehouse', text: 'Go to the Harbor Warehouse' },
      { type: 'grab', target: 'warehouse', wanted: 2, text: 'Grab the shipment' },
      { type: 'escape', target: 'marina', text: 'Lose the cops at the marina' },
    ],
  },
  {
    id: 'island-run', title: 'Island Run', giver: 'Rosa', reward: 4000,
    brief: 'A light-keeper on Isla Verde is holding a case for Rosa. Cross the bridge, get it, bring it to the ferry.',
    stages: [
      { type: 'driveTo', target: 'lighthouse', text: 'Drive to the Isla Lighthouse' },
      { type: 'pickup', target: 'lighthouse', text: 'Pick up the case' },
      { type: 'deliver', target: 'ferry', text: 'Deliver it to the Ferry Terminal' },
    ],
  },
  {
    id: 'last-ferry', title: 'Last Ferry', giver: 'Marco', reward: 5000,
    brief: 'The last ferry carries a lockbox for Marco. Take it from the terminal and vanish at the marina.',
    stages: [
      { type: 'goto', target: 'ferry', text: 'Go to the Ferry Terminal' },
      { type: 'grab', target: 'ferry', wanted: 2, text: 'Grab the lockbox' },
      { type: 'escape', target: 'marina', text: 'Lose the cops at the marina' },
    ],
  },
  {
    id: 'neon-grand-prix', title: 'Neon Grand Prix', giver: 'Lena', reward: 6000,
    brief: 'Lena bets the Strip has no faster driver than you. Three checkpoints, one night: casino, hotel, pier.',
    stages: [
      { type: 'driveTo', target: 'casino', text: 'Checkpoint 1: Neon Casino' },
      { type: 'driveTo', target: 'hotel', text: 'Checkpoint 2: Palms Hotel' },
      { type: 'driveTo', target: 'pier', text: 'Checkpoint 3: Sunset Pier' },
    ],
  },
  {
    id: 'the-vault', title: 'The Vault', giver: 'Marco', reward: 7000,
    brief: 'The vault under Verde National Bank. The crew is waiting inside. Take them down, crack it, get out.',
    stages: [
      { type: 'goto', target: 'bank', text: 'Go to Verde National Bank' },
      { type: 'eliminate', target: 'bank', count: 6, text: 'Take out the vault crew' },
      { type: 'grab', target: 'bank', wanted: 3, text: 'Crack the vault' },
      { type: 'escape', target: 'stadium', text: 'Lose the cops at the stadium' },
    ],
  },
];

export function commitCrime(S, level) {
  S.wanted.level = Math.max(S.wanted.level, Math.min(level, 5));
  S.wanted.heat = 100;
  S.wanted.calmT = 0;
}

export function startMission(S, index) {
  const def = MISSIONS[index];
  if (!def) return false;
  S.mission = { active: true, index, stage: 0, data: {}, def };
  beginStage(S);
  return true;
}

export function currentStage(S) {
  if (!S.mission.active) return null;
  return S.mission.def.stages[S.mission.stage] || null;
}

export function missionObjective(S) {
  if (!S.mission.active) {
    if (S.mission.index >= MISSIONS.length) return 'Story complete — free roam. Find all 10 hidden packages.';
    const next = MISSIONS[S.mission.index];
    return next ? `Next: ${next.title} — press M to start` : 'Free roam';
  }
  const stage = currentStage(S);
  return stage ? stage.text : '';
}

function beginStage(S) {
  const stage = currentStage(S);
  if (!stage) return;
  const place = S.city.places[stage.target];
  S.mission.data = { ...S.mission.data, grabT: 0 };
  if (stage.type === 'steal') {
    const spawn = S.city.places[stage.spawn || stage.target];
    const type = stage.carType || 'sport';
    const car = S.spawnCar(type, spawn.x + 40, spawn.y + 10, 0, CAR_TYPES[type].color, 'mission');
    S.cars.push(car);
    S.mission.data.targetCar = car;
  } else if (stage.type === 'eliminate') {
    const gang = [];
    const n = stage.count || 5;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      gang.push({
        x: place.x + Math.cos(a) * 55,
        y: place.y + Math.sin(a) * 55,
        hp: 100, maxHp: 100, angle: a, speed: 95,
        shootT: 0.6 + i * 0.25, state: 'combat', kind: 'gang',
      });
    }
    S.mission.data.gang = gang;
  } else if (stage.type === 'grab') {
    commitCrime(S, stage.wanted || 2);
  }
}

function advanceStage(S) {
  S.mission.stage += 1;
  if (S.mission.stage >= S.mission.def.stages.length) {
    completeMission(S);
  } else {
    beginStage(S);
  }
}

function completeMission(S) {
  const def = S.mission.def;
  S.stats.missionsDone += 1;
  S.player.cash += def.reward;
  S.mission.index += 1;
  S.mission.active = false;
  S.mission.stage = 0;
  S.mission.data = {};
  S.events.push({ type: 'missionComplete', title: def.title, reward: def.reward, t: S.time });
}

export function updateMission(S, dt) {
  if (!S.mission.active) return;
  const stage = currentStage(S);
  if (!stage) return;
  const p = S.player;
  const place = S.city.places[stage.target];
  const d = place ? dist(p.x, p.y, place.x, place.y) : 99999;
  switch (stage.type) {
    case 'goto':
    case 'deliver':
    case 'pickup':
      if (d < 70) advanceStage(S);
      break;
    case 'driveTo':
      if (p.car && d < 70) advanceStage(S);
      break;
    case 'steal': {
      const car = S.mission.data.targetCar;
      if (car && p.car === car && d < 70) advanceStage(S);
      break;
    }
    case 'eliminate': {
      const gang = S.mission.data.gang || [];
      if (gang.length > 0 && gang.every((g) => g.hp <= 0)) advanceStage(S);
      break;
    }
    case 'grab':
      if (d < 80) {
        S.mission.data.grabT = (S.mission.data.grabT || 0) + dt;
        if (S.mission.data.grabT >= 1.2) advanceStage(S);
      } else {
        S.mission.data.grabT = Math.max(0, (S.mission.data.grabT || 0) - dt);
      }
      break;
    case 'escape':
      if (S.wanted.level === 0 && d < 80) advanceStage(S);
      break;
    case 'escapeArea':
      if (d > 300) advanceStage(S);
      break;
    default:
      break;
  }
}
