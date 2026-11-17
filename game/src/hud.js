// VERDE BAY — the HUD: cash, health, wanted stars, speed, district,
// mission objective, and a live 2D minimap. Reads the sim state every
// frame; never writes it.

import { districtNameAt } from './city.js';
import { MISSIONS, missionObjective } from './missions.js';

let el = null;
let mm = null;

export function initHUD() {
  el = {
    cash: document.getElementById('cash'),
    hpFill: document.getElementById('hp-fill'),
    stars: document.getElementById('stars'),
    speed: document.getElementById('speed'),
    carName: document.getElementById('car-name'),
    district: document.getElementById('district'),
    objective: document.getElementById('objective'),
    prompt: document.getElementById('prompt'),
    taxi: document.getElementById('taxi'),
  };
  mm = document.getElementById('minimap');
}

function starRow(level) {
  let s = '';
  for (let i = 0; i < 5; i++) s += i < level ? '★' : '☆';
  return s;
}

function drawMinimap(S) {
  if (!mm) return;
  const g = mm.getContext('2d');
  const W = mm.width; const H = mm.height;
  const sx = W / 2600; const sy = H / 2000;
  g.clearRect(0, 0, W, H);
  g.fillStyle = '#141c2c';
  g.fillRect(0, 0, W, H);
  // Beach strip.
  g.fillStyle = '#8a744a';
  g.fillRect(0, 1500 * sy, W, H - 1500 * sy);
  // Roads.
  g.strokeStyle = '#4a4a58';
  g.lineWidth = 2;
  for (const x of S.city.roads.vertical) {
    g.beginPath(); g.moveTo(x * sx, 0); g.lineTo(x * sx, H); g.stroke();
  }
  for (const y of S.city.roads.horizontal) {
    g.beginPath(); g.moveTo(0, y * sy); g.lineTo(W, y * sy); g.stroke();
  }
  // Buildings.
  g.fillStyle = '#6a6a78';
  for (const b of S.city.buildings) {
    g.fillRect((b.x - b.w / 2) * sx, (b.y - b.d / 2) * sy, Math.max(1, b.w * sx), Math.max(1, b.d * sy));
  }
  // Taxi fare.
  if (S.taxi.state === 'waiting' && S.taxi.customer) {
    g.fillStyle = '#ffd21a';
    g.beginPath(); g.arc(S.taxi.customer.x * sx, S.taxi.customer.y * sy, 4, 0, Math.PI * 2); g.fill();
  }
  if (S.taxi.state === 'riding' && S.taxi.dest) {
    g.fillStyle = '#7dff8a';
    g.beginPath(); g.arc(S.taxi.dest.x * sx, S.taxi.dest.y * sy, 4, 0, Math.PI * 2); g.fill();
  }
  // Mission objective.
  if (S.mission.active) {
    const def = MISSIONS[S.mission.index];
    const stage = def && def.stages[S.mission.stage];
    let target = null;
    if (stage) {
      if (stage.type === 'steal' && S.mission.data.targetCar) {
        target = S.mission.data.targetCar;
      } else if (stage.target) {
        target = S.city.places[stage.target];
      }
    }
    if (target) {
      const r = 4 + Math.sin(S.time * 5) * 1.5;
      g.fillStyle = '#ffd21a';
      g.beginPath(); g.arc(target.x * sx, target.y * sy, r, 0, Math.PI * 2); g.fill();
    }
  }
  // Cops.
  g.fillStyle = '#ff4a3a';
  for (const c of S.cops) {
    const x = c.car ? c.car.x : (c.ped ? c.ped.x : 0);
    const y = c.car ? c.car.y : (c.ped ? c.ped.y : 0);
    g.beginPath(); g.arc(x * sx, y * sy, 2.5, 0, Math.PI * 2); g.fill();
  }
  // Player arrow.
  const p = S.player;
  g.save();
  g.translate(p.x * sx, p.y * sy);
  g.rotate(p.angle);
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(7, 0); g.lineTo(-5, -4.5); g.lineTo(-5, 4.5);
  g.closePath(); g.fill();
  g.restore();
}

export function updateHUD(S) {
  if (!el) return;
  const p = S.player;
  if (el.cash) el.cash.textContent = '$' + p.cash.toLocaleString('en-US');
  if (el.hpFill) el.hpFill.style.width = Math.max(0, p.hp) + '%';
  if (el.stars) {
    el.stars.textContent = starRow(S.wanted.level);
    el.stars.classList.toggle('hot', S.wanted.level > 0);
  }
  if (el.speed) {
    const mph = p.car ? Math.round(Math.abs(p.car.speed) * 0.45) : 0;
    el.speed.textContent = mph + ' mph';
  }
  if (el.carName) el.carName.textContent = p.car ? p.car.name : 'On foot';
  if (el.district) el.district.textContent = districtNameAt(p.x, p.y);
  if (el.objective) el.objective.textContent = missionObjective(S);
  if (el.taxi) {
    if (S.taxi.state === 'riding') el.taxi.textContent = '🚕 Fare aboard — follow the green dot';
    else if (S.taxi.state === 'waiting') el.taxi.textContent = '🚕 Fare waiting — pick them up';
    else el.taxi.textContent = '';
  }
  if (el.prompt) {
    let text = '';
    if (p.onFoot && !S.mission.active && S.stats.missionsDone < 6) {
      const g = S.city.places.garage;
      const d = Math.hypot(p.x - g.x, p.y - g.y);
      if (d < 120) text = 'Press E to start the next job';
      else {
        let best = null; let bestD = 55 * 55;
        for (const car of S.cars) {
          const dd = (car.x - p.x) ** 2 + (car.y - p.y) ** 2;
          if (dd < bestD) { best = car; bestD = dd; }
        }
        if (best) text = 'Press E to enter the ' + best.name;
      }
    } else if (!p.onFoot) {
      text = 'Press E to get out';
    }
    el.prompt.textContent = text;
  }
  drawMinimap(S);
}
