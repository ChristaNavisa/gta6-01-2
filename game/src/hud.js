// The DOM HUD: cash and mission objective, wanted stars, health, the
// minimap canvas, and the start menu. The sim owns the numbers; this file
// only draws them.

import { MISSIONS, missionObjective } from './missions.js';
import { districtNameAt } from './city.js';
import { fmtCash } from './util.js';

const DISTRICT_COLORS = {
  downtown: '#5c6b7a',
  industrial: '#6b705c',
  beach: '#e9c46a',
  oldtown: '#b5654a',
  residential: '#81b29a',
  marina: '#457b9d',
  isla: '#2a9d8f',
  water: '#1d4e6b',
};

/** Build the HUD inside the page. Returns { update, showBanner }. */
export function createHUD(S) {
  const root = document.getElementById('hud');
  root.innerHTML = `
    <div id="hud-top-left">
      <div id="hud-cash">$0</div>
      <div id="hud-district">Downtown</div>
      <div id="hud-objective"></div>
    </div>
    <div id="hud-top-right">
      <div id="hud-wanted"></div>
      <div id="hud-health"><div id="hud-health-bar"></div></div>
      <div id="hud-missions"></div>
    </div>
    <div id="hud-banner"></div>
    <canvas id="hud-minimap" width="220" height="150"></canvas>
    <div id="hud-help">WASD drive / walk &middot; E enter car &middot; Space shoot &middot; M mission &middot; Shift run</div>
  `;
  const cashEl = document.getElementById('hud-cash');
  const districtEl = document.getElementById('hud-district');
  const objectiveEl = document.getElementById('hud-objective');
  const wantedEl = document.getElementById('hud-wanted');
  const healthBar = document.getElementById('hud-health-bar');
  const missionsEl = document.getElementById('hud-missions');
  const bannerEl = document.getElementById('hud-banner');
  const map = document.getElementById('hud-minimap');
  const mapCtx = map.getContext('2d');

  let bannerTimer = 0;
  let lastMissionsDone = -1;

  function drawMinimap() {
    const city = S.city;
    const sx = map.width / city.width;
    const sy = map.height / city.height;
    mapCtx.clearRect(0, 0, map.width, map.height);
    // Sea.
    mapCtx.fillStyle = '#16324a';
    mapCtx.fillRect(0, 0, map.width, map.height);
    // Land.
    mapCtx.fillStyle = '#3d5a40';
    mapCtx.fillRect(0, 0, 2600 * sx, 2000 * sy);
    mapCtx.fillRect(2720 * sx, 700 * sy, 660 * sx, 800 * sy);
    // Districts.
    for (const d of city.districts) {
      mapCtx.fillStyle = DISTRICT_COLORS[d.id] ?? '#888888';
      mapCtx.fillRect(d.x0 * sx, d.y0 * sy, (d.x1 - d.x0) * sx, (d.y1 - d.y0) * sy);
    }
    // Bridge.
    mapCtx.fillStyle = '#c1121f';
    mapCtx.fillRect(2600 * sx, 940 * sy, 120 * sx, 200 * sy);
    // Roads.
    mapCtx.strokeStyle = 'rgba(20,20,26,0.9)';
    mapCtx.lineWidth = 2;
    for (const r of city.roads) {
      mapCtx.beginPath();
      mapCtx.moveTo(r.x0 * sx, r.y0 * sy);
      mapCtx.lineTo(r.x1 * sx, r.y1 * sy);
      mapCtx.stroke();
    }
    // Mission target.
    if (S.mission.active) {
      const def = MISSIONS[S.mission.index];
      const stage = def.stages[S.mission.stage];
      const place = stage.target ? city.places[stage.target] : null;
      if (place) {
        const pulse = 5 + Math.sin(S.time * 5) * 2;
        mapCtx.fillStyle = '#ffd166';
        mapCtx.beginPath();
        mapCtx.arc(place.x * sx, place.y * sy, pulse, 0, Math.PI * 2);
        mapCtx.fill();
      }
    }
    // Cops.
    mapCtx.fillStyle = '#ff595e';
    for (const cop of S.cops) {
      mapCtx.fillRect(cop.x * sx - 2, cop.y * sy - 2, 4, 4);
    }
    // Player.
    mapCtx.fillStyle = '#ffffff';
    mapCtx.beginPath();
    mapCtx.arc(S.player.x * sx, S.player.y * sy, 4, 0, Math.PI * 2);
    mapCtx.fill();
    mapCtx.strokeStyle = '#111111';
    mapCtx.stroke();
  }

  return {
    update() {
      cashEl.textContent = fmtCash(S.player.cash);
      districtEl.textContent = districtNameAt(S.player.x, S.player.y);
      objectiveEl.textContent = missionObjective(S);
      const stars = '★'.repeat(S.wanted.level) + '☆'.repeat(5 - S.wanted.level);
      wantedEl.textContent = stars;
      wantedEl.className = S.wanted.level > 0 ? 'hot' : '';
      healthBar.style.width = `${Math.max(0, S.player.health)}%`;
      const speed = S.player.car ? Math.abs(Math.round(S.player.speed * 0.12)) : 0;
      missionsEl.textContent = S.player.car
        ? `${speed} mph · ${S.stats.missionsDone}/${MISSIONS.length} missions`
        : `${S.stats.missionsDone}/${MISSIONS.length} missions`;
      if (S.stats.missionsDone !== lastMissionsDone) {
        lastMissionsDone = S.stats.missionsDone;
        if (S.stats.missionsDone > 0 && S.stats.missionsDone < MISSIONS.length) {
          bannerEl.textContent = `Mission ${S.stats.missionsDone} complete — next: ${MISSIONS[S.stats.missionsDone].title}`;
          bannerTimer = 4;
        } else if (S.stats.missionsDone >= MISSIONS.length) {
          bannerEl.textContent = 'Story complete — Verde Bay is yours!';
          bannerTimer = 8;
        }
      }
      if (S.messageTimer > 0 && S.message) {
        bannerEl.textContent = S.message;
        bannerTimer = S.messageTimer;
      }
      if (bannerTimer > 0) {
        bannerTimer -= 1 / 60;
        bannerEl.style.opacity = '1';
      } else {
        bannerEl.style.opacity = '0';
      }
      drawMinimap();
    },
    showBanner(text, seconds) {
      bannerEl.textContent = text;
      bannerTimer = seconds ?? 4;
    },
  };
}
