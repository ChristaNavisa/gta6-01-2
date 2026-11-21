// Street races: 6 checkpoints, timer, best time, payout.
import { RACE_POINTS } from './config.js';
import { dist, fmtTime } from './util.js';
import { addText } from './effects.js';
import { sfx } from './audio.js';

export function startRace(G) {
  G.race = {
    active: true, idx: 0, time: 0, points: RACE_POINTS,
    best: G.stats.bestRace || null, lastWon: false, finished: false,
  };
  G.message = 'STREET RACE — hit all 6 checkpoints!';
  G.messageT = 5;
  sfx('pickup');
}

export function updateRace(G, dt) {
  const r = G.race;
  if (!r.active) return;
  r.time += dt;
  const pt = r.points[r.idx];
  if (!pt) { finishRace(G, true); return; }
  if (dist(G.player.x, G.player.y, pt.x, pt.y) < 70) {
    r.idx++;
    sfx('pickup');
    addText(G.fx, pt.x, pt.y - 24, 'CHECKPOINT ' + r.idx + '/6', '#7dff8a');
    if (r.idx >= r.points.length) finishRace(G, true);
  }
  if (r.time > 180) finishRace(G, false);
}

function finishRace(G, won) {
  const r = G.race;
  r.active = false;
  r.lastWon = won;
  if (!won) {
    G.message = 'RACE FAILED — time ran out.';
    G.messageT = 4;
    sfx('fail');
    return;
  }
  const prize = 1500 + Math.max(0, Math.floor((120 - r.time) * 20));
  G.money += prize;
  const isBest = !r.best || r.time < r.best;
  if (isBest) { G.stats.bestRace = r.time; r.best = r.time; }
  G.message = 'RACE WON in ' + fmtTime(r.time) + '  +$' + prize + (isBest ? '  (NEW BEST!)' : '');
  G.messageT = 6;
  addText(G.fx, G.player.x, G.player.y - 40, 'RACE WON +$' + prize, '#7dff8a');
  sfx('fanfare');
}

export function drawRace(ctx, G, cam) {
  const r = G.race;
  if (!r.active) return;
  for (let i = r.idx; i < r.points.length; i++) {
    const pt = r.points[i];
    const x = pt.x - cam.x, y = pt.y - cam.y;
    if (x < -60 || y < -60 || x > cam.w + 60 || y > cam.h + 60) continue;
    const next = i === r.idx;
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = next ? '#ffd166' : '#ffffff88';
    ctx.lineWidth = next ? 4 : 2;
    ctx.beginPath(); ctx.arc(0, 0, next ? 44 : 34, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = next ? '#ffd166' : '#fff';
    ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center';
    ctx.fillText(String(i + 1), 0, 6);
    ctx.restore();
  }
  // Timer bar.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(cam.w / 2 - 110, 54, 220, 30);
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center';
  ctx.fillText('RACE ' + fmtTime(r.time) + '  •  CP ' + (r.idx + 1) + '/6', cam.w / 2, 75);
}
