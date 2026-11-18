// Verde Bay HUD: cash, wanted stars, mission tracker, nitro meter, the
// package counter, the minimap and the start / busted / complete overlays.
// All DOM, drawn over the 3D canvas; the sim never touches the DOM.

import { MISSIONS } from './missions.js';
import { DISTRICTS } from './city.js';
import { WORLD } from './config.js';

/** Build the HUD inside `root` and return { update(S), banner(text, sub), showStart(), hideStart() }. */
export function createHud(root, S) {
  root.innerHTML = `
    <div id="hud-top">
      <div id="hud-cash">$<span id="cash">0</span></div>
      <div id="hud-mission">
        <div id="mission-title">VERDE BAY</div>
        <div id="mission-text">Welcome to Verde Bay</div>
      </div>
      <div id="hud-right">
        <div id="wanted"></div>
        <div id="hud-packages">◆ <span id="pkg">0</span>/10</div>
      </div>
    </div>
    <div id="hud-bottom">
      <div id="nitro-wrap"><div id="nitro-label">NITRO</div><div id="nitro-bar"><div id="nitro-fill"></div></div></div>
      <div id="hud-hints">WASD drive / walk &nbsp;·&nbsp; E enter car &nbsp;·&nbsp; SHIFT nitro / run &nbsp;·&nbsp; SPACE shoot / brake &nbsp;·&nbsp; M mute</div>
      <div id="hud-speed"><span id="speed">0</span> mph</div>
    </div>
    <canvas id="minimap" width="220" height="150"></canvas>
    <div id="banner" class="hidden"><div id="banner-title"></div><div id="banner-sub"></div></div>
    <div id="overlay-start" class="overlay">
      <div class="panel">
        <h1>VERDE BAY <span>3D</span></h1>
        <p class="tagline">NEON NIGHTS — an open-world crime story</p>
        <p>Seven districts, an island across the bridge, ten story missions,
        street races, a bank vault, and ten hidden packages. Steal cars,
        outrun the Verde Bay PD, and take the city.</p>
        <div class="missions-list" id="missions-list"></div>
        <button id="btn-start">▶ &nbsp;START THE NIGHT</button>
        <p class="controls">WASD move &nbsp;·&nbsp; E enter / exit car &nbsp;·&nbsp; SHIFT nitro &nbsp;·&nbsp; SPACE shoot &nbsp;·&nbsp; M mute</p>
      </div>
    </div>
    <div id="overlay-busted" class="overlay hidden">
      <div class="panel"><h1>BUSTED</h1><p>The Verde Bay PD caught you. $250 fine.</p><button id="btn-busted">BACK TO THE STREETS</button></div>
    </div>
    <div id="overlay-wasted" class="overlay hidden">
      <div class="panel"><h1>WASTED</h1><p>You woke up at St. Verde Hospital. $250 gone.</p><button id="btn-wasted">BACK TO THE STREETS</button></div>
    </div>`;

  const cashEl = root.querySelector('#cash');
  const missionTitle = root.querySelector('#mission-title');
  const missionText = root.querySelector('#mission-text');
  const wantedEl = root.querySelector('#wanted');
  const pkgEl = root.querySelector('#pkg');
  const nitroFill = root.querySelector('#nitro-fill');
  const speedEl = root.querySelector('#speed');
  const minimap = root.querySelector('#minimap');
  const mm = minimap.getContext('2d');
  const bannerEl = root.querySelector('#banner');
  const bannerTitle = root.querySelector('#banner-title');
  const bannerSub = root.querySelector('#banner-sub');
  const startOverlay = root.querySelector('#overlay-start');
  const bustedOverlay = root.querySelector('#overlay-busted');
  const wastedOverlay = root.querySelector('#overlay-wasted');

  root.querySelector('#missions-list').innerHTML = MISSIONS.map(
    (m, i) => `<div class="mission-row"><span class="mission-num">${i + 1}</span> ${m.title} <span class="mission-reward">$${m.reward.toLocaleString('en-US')}</span></div>`,
  ).join('');

  let bannerTimer = null;
  function banner(title, sub = '') {
    bannerTitle.textContent = title;
    bannerSub.textContent = sub;
    bannerEl.classList.remove('hidden');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => bannerEl.classList.add('hidden'), 3600);
  }

  function drawMinimap() {
    const w = minimap.width;
    const h = minimap.height;
    const sx = w / WORLD.width;
    const sy = h / WORLD.height;
    mm.clearRect(0, 0, w, h);
    mm.fillStyle = '#0d1526';
    mm.fillRect(0, 0, w, h);
    // Water.
    mm.fillStyle = '#1d4e89';
    mm.fillRect(WORLD.channelX0 * sx, 0, (WORLD.channelX1 - WORLD.channelX0) * sx, h);
    mm.fillRect(0, WORLD.seaY0 * sy, w, h - WORLD.seaY0 * sy);
    // Districts.
    for (const d of DISTRICTS) {
      mm.fillStyle = d.id === 'strip' ? '#3d2b5c' : d.id === 'beach' ? '#d9bd7f' : d.id === 'isla' ? '#5d8a4e' : '#3a4150';
      mm.fillRect(d.x0 * sx, d.y0 * sy, (d.x1 - d.x0) * sx, (d.y1 - d.y0) * sy);
    }
    // Roads.
    mm.strokeStyle = '#565b66';
    mm.lineWidth = 1;
    for (let x = 0; x <= WORLD.width; x += 200) {
      mm.beginPath();
      mm.moveTo(x * sx, 0);
      mm.lineTo(x * sx, h);
      mm.stroke();
    }
    for (let y = 0; y <= WORLD.height; y += 200) {
      mm.beginPath();
      mm.moveTo(0, y * sy);
      mm.lineTo(w, y * sy);
      mm.stroke();
    }
    // Hidden packages (gold dots).
    for (const pkg of S.packages) {
      if (pkg.found) continue;
      mm.fillStyle = '#ffd60a';
      mm.beginPath();
      mm.arc(pkg.x * sx, pkg.y * sy, 2.5, 0, Math.PI * 2);
      mm.fill();
    }
    // Mission marker.
    if (S.mission.active) {
      const def = MISSIONS[S.mission.index];
      const stage = def?.stages[S.mission.stage];
      let target = null;
      if (stage?.type === 'steal' && S.mission.data.targetCar) target = S.mission.data.targetCar;
      else if (stage?.target) target = S.city.places[stage.target];
      if (target) {
        mm.fillStyle = '#ffd60a';
        mm.beginPath();
        mm.arc(target.x * sx, target.y * sy, 4, 0, Math.PI * 2);
        mm.fill();
        mm.strokeStyle = '#ffd60a';
        mm.beginPath();
        mm.arc(target.x * sx, target.y * sy, 7, 0, Math.PI * 2);
        mm.stroke();
      }
    }
    // Cops (blue dots).
    mm.fillStyle = '#4d8dff';
    for (const cop of S.cops) {
      mm.beginPath();
      mm.arc(cop.x * sx, cop.y * sy, 2.5, 0, Math.PI * 2);
      mm.fill();
    }
    // The player (white arrow).
    const p = S.player;
    mm.save();
    mm.translate(p.x * sx, p.y * sy);
    mm.rotate(p.angle);
    mm.fillStyle = '#ffffff';
    mm.beginPath();
    mm.moveTo(6, 0);
    mm.lineTo(-4, -4);
    mm.lineTo(-4, 4);
    mm.closePath();
    mm.fill();
    mm.restore();
  }

  function update() {
    const p = S.player;
    cashEl.textContent = Math.floor(p.cash).toLocaleString('en-US');
    pkgEl.textContent = S.stats.packagesFound;
    wantedEl.innerHTML = Array.from({ length: 5 }, (_, i) =>
      `<span class="star ${i < S.wanted.level ? 'lit' : ''}">★</span>`).join('');
    if (S.mission.active) {
      const def = MISSIONS[S.mission.index];
      missionTitle.textContent = `${def.title} — $${def.reward.toLocaleString('en-US')}`;
      missionText.textContent = S.mission.text;
    } else if (S.stats.missionsDone >= MISSIONS.length) {
      missionTitle.textContent = 'VERDE BAY — COMPLETE';
      missionText.textContent = 'Every mission done. The city is yours.';
    } else {
      missionTitle.textContent = 'VERDE BAY';
      missionText.textContent = S.stats.missionsDone === 0
        ? 'Steal a car — mission 1 starts at Sunset Garage'
        : `Next: ${MISSIONS[S.stats.missionsDone].title}`;
    }
    const nitro = p.car ? Math.round((p.car.nitro / p.car.nitroMax) * 100) : 100;
    nitroFill.style.width = `${nitro}%`;
    speedEl.textContent = Math.round(Math.abs(p.speed || 0) * 0.22);
    drawMinimap();
    if (S.flags.busted) {
      S.flags.busted = false;
      bustedOverlay.classList.remove('hidden');
    }
    if (S.flags.wasted) {
      S.flags.wasted = false;
      wastedOverlay.classList.remove('hidden');
    }
  }

  return {
    update,
    banner,
    showStart() { startOverlay.classList.remove('hidden'); },
    hideStart() { startOverlay.classList.add('hidden'); },
    hideBusted() { bustedOverlay.classList.add('hidden'); },
    hideWasted() { wastedOverlay.classList.add('hidden'); },
  };
}
