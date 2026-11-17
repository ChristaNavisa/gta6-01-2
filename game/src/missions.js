// VERDE BAY 3D — the story: six jobs and the taxi side job.
// The mission data lives in config.js; this file runs the stage machine.
import { MISSIONS } from './config.js';
import { dist } from './util.js';
import { randomRoadPoint } from './city.js';
import { sfx } from './audio.js';

export { MISSIONS };

export function createMissionState() {
  return { index: 0, stage: 0, stageT: 0, marker: null, objective: '', active: false, data: {}, nextAt: 0.6 };
}

function stageTarget(S, stage) {
  if (!stage.target) return null;
  const place = S.city.places[stage.target];
  return place ? { x: place.x, y: place.y, label: place.name } : null;
}

export function startMission(S, index) {
  const def = MISSIONS[index];
  if (!def) {
    S.mission.active = false;
    S.mission.objective = 'All jobs done — Verde Bay is yours.';
    return;
  }
  S.mission.index = index;
  S.mission.stage = 0;
  S.mission.stageT = 0;
  S.mission.active = true;
  S.mission.data = {};
  S.message = `${def.title}: ${def.briefing}`;
  S.messageT = 5;
  sfx.mission();
  beginStage(S);
}

function beginStage(S) {
  const def = MISSIONS[S.mission.index];
  const stage = def.stages[S.mission.stage];
  S.mission.stageT = 0;
  S.mission.objective = stage.text;
  S.mission.marker = stageTarget(S, stage);
  // Stage-specific setup.
  if (stage.type === 'steal') {
    const marina = S.city.places.marina;
    const car = S.makeCar('sport', marina.x - 60, marina.y - 40, 0, '#e74c3c', 'mission');
    S.cars.push(car);
    S.mission.data.targetCar = car;
    for (let i = 0; i < 3; i++) {
      S.peds.push(S.makePed(marina.x - 100 + i * 40, marina.y + 30, 'gang'));
    }
  }
  if (stage.type === 'eliminate') {
    const wh = S.city.places.warehouse;
    S.mission.data.gang = [];
    for (let i = 0; i < stage.count; i++) {
      const g = S.makePed(wh.x - 80 + (i % 3) * 55, wh.y - 40 + Math.floor(i / 3) * 55, 'gang');
      S.peds.push(g);
      S.mission.data.gang.push(g);
    }
  }
  if (def.id === 'getaway' && stage.type === 'driveTo') S.commitCrime(1.5, 600);
  if ((def.id === 'big-score' || def.id === 'harbor-heist') && stage.type === 'grab') S.commitCrime(2, 600);
}

export function updateMission(S, dt) {
  const M = S.mission;
  if (!M.active) return;
  const def = MISSIONS[M.index];
  const stage = def.stages[M.stage];
  M.stageT += dt;
  const p = S.player;
  const px = p.car ? p.car.x : p.x;
  const py = p.car ? p.car.y : p.y;

  const advance = () => {
    M.stage += 1;
    if (M.stage >= def.stages.length) { completeMission(S, def); return; }
    beginStage(S);
  };

  switch (stage.type) {
    case 'goto':
    case 'driveTo':
    case 'deliver': {
      const t = stageTarget(S, stage);
      if (t && dist(px, py, t.x, t.y) < 46) {
        if (stage.type === 'deliver') { sfx.cash(); S.addFloater(p.x, p.y - 30, 'Delivered', '#7dff8a'); }
        advance();
      }
      break;
    }
    case 'pickup': {
      const t = stageTarget(S, stage);
      if (t && dist(px, py, t.x, t.y) < 46 && M.stageT > 0.6) advance();
      break;
    }
    case 'grab': {
      const t = stageTarget(S, stage);
      if (t && dist(px, py, t.x, t.y) < 52) {
        M.data.grabT = (M.data.grabT || 0) + dt;
        M.objective = `Grabbing the cash… ${Math.ceil(5 - M.data.grabT)}s`;
        if (M.data.grabT >= 5) {
          S.spawnBurst(p.x, p.y, '#7dff8a', 14, 160);
          advance();
        }
      } else {
        M.data.grabT = 0;
        M.objective = stage.text;
      }
      break;
    }
    case 'steal': {
      const car = M.data.targetCar;
      if (car && p.car === car) {
        const g = S.city.places.garage;
        M.marker = { x: g.x, y: g.y, label: g.name };
        M.objective = 'Bring the Comet GT to the garage';
        if (dist(car.x, car.y, g.x, g.y) < 60) {
          S.cars.splice(S.cars.indexOf(car), 1);
          p.car = null; p.onFoot = true;
          advance();
        }
      } else if (car) {
        M.marker = { x: car.x, y: car.y, label: 'Comet GT' };
        M.objective = 'Steal the Comet GT';
      }
      break;
    }
    case 'eliminate': {
      const gang = M.data.gang || [];
      const alive = gang.filter((g) => g.hp > 0).length;
      M.objective = `Take out the Vipers (${stage.count - alive}/${stage.count})`;
      if (alive === 0) advance();
      break;
    }
    case 'escape': {
      const finalTarget = (def.id === 'big-score' || def.id === 'harbor-heist')
        ? S.city.places.marina : S.city.places.stadium;
      M.marker = { x: finalTarget.x, y: finalTarget.y, label: finalTarget.name };
      if (S.wanted.level === 0 && dist(px, py, finalTarget.x, finalTarget.y) < 70) advance();
      else if (S.wanted.level > 0) M.objective = 'Lose the cops, then reach the marker';
      else M.objective = `Reach ${finalTarget.name}`;
      break;
    }
    case 'escapeArea': {
      const t = stageTarget(S, stage);
      if (t && dist(px, py, t.x, t.y) > 320) advance();
      break;
    }
  }
}

function completeMission(S, def) {
  const p = S.player;
  p.cash += def.reward;
  S.stats.missionsDone += 1;
  S.stats.bestCash = Math.max(S.stats.bestCash, p.cash);
  S.message = `Job done — ${def.title} paid $${def.reward}.`;
  S.messageT = 4;
  sfx.mission();
  S.spawnBurst(p.x, p.y - 20, '#ffd166', 20, 200);
  S.mission.active = false;
  S.mission.objective = '';
  S.mission.marker = null;
  S.mission.index += 1;
  // Next job starts when the player reaches the garage, or after a breather.
  S.mission.nextAt = S.time + 6;
}

// --- Taxi side job ----------------------------------------------------------
export function updateTaxi(S, dt) {
  const p = S.player;
  const T = S.taxi;
  if (!T) return;
  if (!p.car || p.car.model !== 'taxi') {
    if (T.active) {
      T.active = false; T.marker = null;
      S.message = 'Fare lost — you left the cab.';
      S.messageT = 2;
    }
    return;
  }
  if (!T.active) {
    // Offer a fare: a waiting pedestrian somewhere in the city.
    const spot = randomRoadPoint(S.rng);
    T.active = true;
    T.stage = 'pickup';
    T.marker = { x: spot.x, y: spot.y, label: 'Fare' };
    T.fare = 40 + Math.floor(S.rng() * 5) * 10;
    return;
  }
  const cx = p.car.x, cy = p.car.y;
  if (T.stage === 'pickup') {
    if (dist(cx, cy, T.marker.x, T.marker.y) < 48) {
      T.stage = 'dropoff';
      const dest = randomRoadPoint(S.rng);
      T.marker = { x: dest.x, y: dest.y, label: 'Drop-off' };
      S.message = 'Fare picked up — take them to the marker.';
      S.messageT = 2.5;
      sfx.pickup();
    }
  } else if (dist(cx, cy, T.marker.x, T.marker.y) < 48) {
    p.cash += T.fare;
    S.stats.bestCash = Math.max(S.stats.bestCash, p.cash);
    S.addFloater(cx, cy - 30, `+$${T.fare}`, '#7dff8a');
    sfx.cash();
    T.active = false;
    T.marker = null;
  }
}
