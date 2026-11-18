// The story of VERDE BAY: 8 missions, $18,000 in total. Each mission is a
// list of stages; the sim drives them by stage type:
//   goto        reach the target place on foot or by car
//   pickup      reach the target place to pick something up
//   deliver     reach the target place carrying the goods
//   driveTo     reach the target place while driving a car
//   grab        hold the target point for a few seconds (a heist: raises wanted)
//   steal       get into the target car and bring it to the target place
//   eliminate   take out every member of the gang at the target place
//   escape      reach the target place once the heat is off (wanted 0)
//   escapeArea  get a good distance away from the target place
// A stage may carry `crime`: the wanted level set when the stage begins.

export const MISSIONS = [
  {
    id: 'first-wheels',
    title: 'First Wheels',
    contact: 'Milo',
    reward: 500,
    brief: "Milo needs wheels. Borrow a car from the garage lot and bring it to the stadium. Don't ask whose it is.",
    stages: [
      { type: 'goto', target: 'garage', text: 'Go to Verde Motors Garage' },
      { type: 'steal', target: 'garage', spawn: 'garage', text: 'Take the Comet GT and drive it to the stadium' },
      { type: 'driveTo', target: 'stadium', text: 'Deliver the car to Bay Stadium' },
    ],
  },
  {
    id: 'diner-dash',
    title: 'Diner Dash',
    contact: "Rosa",
    reward: 500,
    brief: "Rosa's diner is out of coffee and the hotel is out of patience. Run the delivery across town before it gets cold.",
    stages: [
      { type: 'pickup', target: 'diner', text: "Pick up the order at Rosa's Diner" },
      { type: 'deliver', target: 'hotel', text: 'Deliver the order to Hotel Miramar' },
      { type: 'goto', target: 'plaza', text: 'Meet Rosa at Liberty Plaza' },
    ],
  },
  {
    id: 'cannery-job',
    title: 'The Cannery Job',
    contact: 'Milo',
    reward: 1500,
    brief: 'The cannery crew is skimming the docks. Clear them out, grab the ledger from the warehouse and drop it at the marina.',
    stages: [
      { type: 'goto', target: 'cannery', text: 'Go to the Old Cannery' },
      { type: 'eliminate', target: 'cannery', text: 'Clear out the cannery crew' },
      { type: 'pickup', target: 'warehouse', text: 'Pick up the ledger at the Harbor Warehouse' },
      { type: 'deliver', target: 'marina', text: 'Deliver the ledger to Marina del Sol' },
    ],
  },
  {
    id: 'night-taxi',
    title: 'Night Shift Taxi',
    contact: 'Ferry',
    reward: 1000,
    brief: 'Ferry runs a cab on the side. Pick up the fare at Sunset Pier, drop them at Club Marea, then vanish before the cops ask questions.',
    stages: [
      { type: 'driveTo', target: 'pier', text: 'Drive to Sunset Pier' },
      { type: 'pickup', target: 'pier', text: 'Pick up the fare at the pier' },
      { type: 'deliver', target: 'club', text: 'Drop the fare at Club Marea' },
      { type: 'escapeArea', target: 'club', text: 'Get clear of the club district' },
    ],
  },
  {
    id: 'big-score',
    title: 'The Big Score',
    contact: 'Milo',
    reward: 2000,
    brief: 'Verde Bay Bank keeps its vault light on Fridays. Hit it fast, then lose the heat at the marina.',
    stages: [
      { type: 'goto', target: 'bank', text: 'Go to Verde Bay Bank' },
      { type: 'grab', target: 'bank', crime: 2, hold: 2.0, text: 'Hold the vault — grab the cash' },
      { type: 'escape', target: 'marina', text: 'Lose the heat at Marina del Sol' },
    ],
  },
  {
    id: 'harbor-heist',
    title: 'Harbor Heist',
    contact: 'Ferry',
    reward: 3500,
    brief: 'The harbor warehouse holds a shipment worth a fortune. Crack it, take the getaway car and disappear into the marina.',
    stages: [
      { type: 'goto', target: 'warehouse', text: 'Go to the Harbor Warehouse' },
      { type: 'grab', target: 'warehouse', crime: 2, hold: 2.0, text: 'Hold the warehouse — crack the shipment' },
      { type: 'steal', target: 'garage', spawn: 'warehouse', text: 'Take the getaway car to the garage' },
      { type: 'escape', target: 'marina', text: 'Lose the heat at Marina del Sol' },
    ],
  },
  {
    id: 'island-run',
    title: 'Island Run',
    contact: 'Milo',
    reward: 4000,
    brief: 'Smuggled cargo has to cross the Verde Bridge to Isla Verde — and the police know the route. Outrun them across the strait.',
    stages: [
      { type: 'pickup', target: 'cannery', text: 'Pick up the cargo at the Old Cannery' },
      { type: 'driveTo', target: 'bridge', crime: 2, text: 'Cross the Verde Bridge — outrun the police' },
      { type: 'deliver', target: 'islandDepot', text: 'Deliver the cargo to Isla Verde Depot' },
      { type: 'escape', target: 'stadium', text: 'Lose the heat at Bay Stadium' },
    ],
  },
  {
    id: 'last-ferry',
    title: 'The Last Ferry',
    contact: 'Ferry',
    reward: 5000,
    brief: 'One last job. The ferry terminal safe holds the payout of a decade — crack it, take the getaway car and never look back.',
    stages: [
      { type: 'goto', target: 'ferry', text: 'Go to the Ferry Terminal' },
      { type: 'grab', target: 'ferry', crime: 3, hold: 2.5, text: 'Hold the terminal — crack the safe' },
      { type: 'steal', target: 'garage', spawn: 'ferry', text: 'Take the getaway car to the garage' },
      { type: 'escape', target: 'marina', text: 'Lose the heat at Marina del Sol' },
    ],
  },
];

/** The place a mission stage points at (null for stages without one). */
export function stagePlace(S, stage) {
  if (!stage || !stage.target) return null;
  return S.city.places[stage.target] ?? null;
}

/** One-line objective text for the HUD. */
export function missionObjective(S) {
  if (!S.mission.active) {
    if (S.stats.missionsDone >= MISSIONS.length) return 'Story complete — Verde Bay is yours.';
    return `Next mission: ${MISSIONS[S.stats.missionsDone].title} (${MISSIONS[S.stats.missionsDone].reward}$) — press M to start`;
  }
  const def = MISSIONS[S.mission.index];
  const stage = def.stages[S.mission.stage];
  return `${def.title}: ${stage.text}`;
}

function beginStage(S) {
  const def = MISSIONS[S.mission.index];
  const stage = def.stages[S.mission.stage];
  S.mission.timer = 0;
  S.mission.holdTimer = 0;
  if (stage.crime) {
    S.wanted.level = Math.max(S.wanted.level, stage.crime);
    S.wanted.heat = 100;
    S.events.push(`Wanted level ${S.wanted.level} — the police are coming!`);
  }
  if (stage.type === 'steal') {
    const spawn = S.city.places[stage.spawn] ?? S.city.places.garage;
    const car = {
      id: `target-${def.id}`,
      type: 'sport',
      x: spawn.x + 40,
      y: spawn.y + 20,
      angle: 0,
      speed: 0,
      color: '#d90429',
      owner: 'target',
      driver: 'parked',
      hp: 100,
    };
    S.cars.push(car);
    S.mission.data.targetCar = car;
    S.events.push('A red Comet GT is waiting — take it!');
  }
  if (stage.type === 'eliminate') {
    const at = S.city.places[stage.target];
    const gang = [];
    for (let i = 0; i < 4; i++) {
      gang.push({
        x: at.x + (i % 2 === 0 ? -50 : 50),
        y: at.y + (i < 2 ? -50 : 50),
        angle: 0,
        hp: 50,
        speed: 40,
        shootTimer: 1 + i * 0.4,
      });
    }
    S.mission.data.gang = gang;
    S.events.push('The crew is here — clear them out!');
  }
  S.events.push(stage.text);
}

/** Start mission i (0-based). Sets up the first stage. */
export function startMission(S, i) {
  const def = MISSIONS[i];
  S.mission = { active: true, index: i, stage: 0, data: {}, timer: 0, holdTimer: 0 };
  S.events.push(`${def.title} — ${def.contact}: ${def.brief}`);
  beginStage(S);
}

/** Move to the next stage of the active mission (called by the sim). */
export function nextStage(S) {
  const def = MISSIONS[S.mission.index];
  S.mission.stage += 1;
  if (S.mission.stage >= def.stages.length) {
    S.player.cash += def.reward;
    S.stats.missionsDone += 1;
    S.mission.active = false;
    S.mission.index = S.stats.missionsDone;
    S.events.push(`Mission complete: ${def.title} — +$${def.reward.toLocaleString('en-US')}`);
    return true;
  }
  beginStage(S);
  return false;
}
