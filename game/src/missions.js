// VERDE BAY — the story: six jobs for Cole Vega, from a stolen Comet GT
// to the Harbor Heist. Missions are data; the sim drives them through
// startMission / updateMission, and the smoke test plays them all.

import { PLACE_NAMES } from './city.js';
import { WANTED } from './config.js';
import { dist } from './util.js';
import { writeSave } from './save.js';

export const MISSIONS = [
  {
    id: 'first-wheels',
    title: 'First Wheels',
    reward: 300,
    stages: [
      { type: 'steal', target: 'diner' },
      { type: 'driveTo', target: 'garage' },
    ],
  },
  {
    id: 'courier',
    title: 'Courier Run',
    reward: 600,
    stages: [
      { type: 'pickup', target: 'diner' },
      { type: 'deliver', target: 'stadium' },
    ],
  },
  {
    id: 'payback',
    title: 'Payback',
    reward: 900,
    stages: [
      { type: 'goto', target: 'club' },
      { type: 'eliminate', target: 'club' },
      { type: 'escapeArea', target: 'club' },
    ],
  },
  {
    id: 'big-score',
    title: 'The Big Score',
    reward: 1200,
    stages: [
      { type: 'goto', target: 'bank' },
      { type: 'grab', target: 'bank' },
      { type: 'escape', target: 'marina' },
    ],
  },
  {
    id: 'getaway',
    title: 'Getaway Driver',
    reward: 2500,
    stages: [
      { type: 'driveTo', target: 'stadium' },
      { type: 'escapeArea', target: 'stadium' },
    ],
  },
  {
    id: 'harbor-heist',
    title: 'Harbor Heist',
    reward: 3500,
    stages: [
      { type: 'goto', target: 'warehouse' },
      { type: 'grab', target: 'warehouse' },
      { type: 'escape', target: 'marina' },
    ],
  },
];

const ARRIVE = 70;
const STEAL_ARRIVE = 90;
const ESCAPE_DIST = 320;

function placeName(key) { return PLACE_NAMES[key] || key; }

function beginStage(S) {
  const def = MISSIONS[S.mission.index];
  const stage = def.stages[S.mission.stage];
  if (!stage) return;
  const place = stage.target ? S.city.places[stage.target] : null;
  if (stage.type === 'steal' && place) {
    const car = {
      type: 'sports', name: 'Comet GT',
      x: place.x + 30, y: place.y, angle: 0, speed: 0,
      color: '#d23b2e', owner: 'target',
      maxSpeed: 330, accel: 115, turn: 2.9, length: 54, width: 26,
      hp: 100, wheelSpin: 0,
    };
    S.cars.push(car);
    S.mission.data.targetCar = car;
  } else if (stage.type === 'eliminate' && place) {
    const gang = [];
    for (let i = 0; i < 3; i++) {
      gang.push({
        x: place.x + (i - 1) * 46, y: place.y + 30 + (i % 2) * 40,
        angle: 0, speed: 0, hp: 100, kind: 'gang',
        color: '#7a1f1f', state: 'guard', shootTimer: 1 + i * 0.5,
      });
    }
    S.mission.data.gang = gang;
  } else if (stage.type === 'grab') {
    // The grab is the crime: the vault job puts the cops on you at once.
    S.wanted.heat = Math.max(S.wanted.heat, WANTED.crimeHeat.grab);
    S.wanted.level = Math.min(WANTED.maxLevel, Math.floor(S.wanted.heat / WANTED.heatPerLevel));
    S.events.push({ type: 'crime', level: S.wanted.level });
  }
}

function completeMission(S) {
  const def = MISSIONS[S.mission.index];
  S.player.cash += def.reward;
  S.stats.missionsDone += 1;
  S.mission.active = false;
  S.mission.index = S.mission.index + 1;
  S.mission.stage = 0;
  S.mission.data = {};
  S.events.push({ type: 'mission-complete', title: def.title, reward: def.reward });
  writeSave(S);
}

export function failMission(S) {
  if (!S.mission.active) return;
  S.mission.active = false;
  S.mission.stage = 0;
  S.mission.data = {};
  S.events.push({ type: 'mission-failed' });
}

export function startMission(S, mi) {
  if (mi < 0 || mi >= MISSIONS.length) return;
  S.mission = { active: true, index: mi, stage: 0, data: {} };
  beginStage(S);
}

export function updateMission(S, dt) {
  if (!S.mission.active) return;
  const def = MISSIONS[S.mission.index];
  if (!def) { S.mission.active = false; return; }
  const stage = def.stages[S.mission.stage];
  if (!stage) { completeMission(S); return; }
  const p = S.player;
  const px = p.car ? p.car.x : p.x;
  const py = p.car ? p.car.y : p.y;
  const place = stage.target ? S.city.places[stage.target] : null;

  let done = false;
  if (stage.type === 'goto' || stage.type === 'pickup' || stage.type === 'deliver'
    || stage.type === 'driveTo' || stage.type === 'grab') {
    if (place && dist(px, py, place.x, place.y) < ARRIVE) done = true;
  } else if (stage.type === 'steal') {
    const car = S.mission.data.targetCar;
    const g = S.city.places.garage;
    if (car && dist(car.x, car.y, g.x, g.y) < STEAL_ARRIVE) done = true;
  } else if (stage.type === 'eliminate') {
    const gang = S.mission.data.gang || [];
    if (gang.length > 0 && gang.every((g) => g.hp <= 0)) done = true;
  } else if (stage.type === 'escape') {
    if (place && dist(px, py, place.x, place.y) < STEAL_ARRIVE) done = true;
  } else if (stage.type === 'escapeArea') {
    if (place && dist(px, py, place.x, place.y) > ESCAPE_DIST) done = true;
  }

  if (!done) return;
  S.mission.stage += 1;
  if (S.mission.stage >= def.stages.length) completeMission(S);
  else beginStage(S);
}

/** One line for the HUD: what the player should do right now. */
export function missionObjective(S) {
  if (!S.mission.active) {
    if (S.stats.missionsDone >= MISSIONS.length) return 'All jobs done — Verde Bay is yours.';
    return "Head to Mara's Garage to start the next job.";
  }
  const def = MISSIONS[S.mission.index];
  const stage = def.stages[S.mission.stage];
  if (!stage) return def.title;
  const name = stage.target ? placeName(stage.target) : '';
  switch (stage.type) {
    case 'goto': return `Head to ${name}`;
    case 'pickup': return `Pick up the package at ${name}`;
    case 'deliver': return `Deliver the package to ${name}`;
    case 'driveTo': return `Drive to ${name}`;
    case 'grab': return `Grab the goods at ${name}`;
    case 'steal': return "Steal the Comet GT, then take it to Mara's Garage";
    case 'eliminate': return `Take out the gang at ${name}`;
    case 'escape': return `Escape to ${name} — lose the cops`;
    case 'escapeArea': return `Lose the cops — get clear of ${name}`;
    default: return def.title;
  }
}
