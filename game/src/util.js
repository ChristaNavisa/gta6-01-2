// Small math + seeded-random helpers shared by the whole game.
// No DOM, no imports: safe to load in Node (smoke tests) and the browser.

/** Deterministic PRNG (mulberry32). Same seed -> same sequence, every run. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A tiny RNG object built on mulberry32. */
export function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    range(a, b) { return a + (b - a) * next(); },
    int(a, b) { return Math.floor(a + (b - a + 1) * next()); },
    pick(arr) { return arr[Math.floor(next() * arr.length)]; },
    chance(p) { return next() < p; },
  };
}

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

export function lerp(a, b, t) { return a + (b - a) * t; }

/** Squared distance between two points. */
export function dist2(x1, y1, x2, y2) {
  const dx = x2 - x1; const dy = y2 - y1;
  return dx * dx + dy * dy;
}

export function dist(x1, y1, x2, y2) { return Math.sqrt(dist2(x1, y1, x2, y2)); }

export function angleTo(x1, y1, x2, y2) { return Math.atan2(y2 - y1, x2 - x1); }

/** Shortest signed turn from angle a toward angle b, in (-PI, PI]. */
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

/** Move angle a toward b by at most step radians. */
export function turnToward(a, b, step) {
  const d = angleDiff(a, b);
  if (Math.abs(d) <= step) return b;
  return a + Math.sign(d) * step;
}

/**
 * Circle vs axis-aligned box push-out.
 * Returns true when the circle overlapped the box; moves the circle out
 * along the smallest penetration axis and reports the push in `out`.
 */
export function pushOutCircleBox(cx, cy, r, bx, by, bw, bd, out) {
  const nx = clamp(cx, bx - bw / 2, bx + bw / 2);
  const ny = clamp(cy, by - bd / 2, by + bd / 2);
  const dx = cx - nx; const dy = cy - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return false;
  if (d2 > 0.000001) {
    const d = Math.sqrt(d2);
    const push = (r - d) / d;
    out.x = dx * push; out.y = dy * push;
  } else {
    // Center inside the box: push out along the smallest side.
    const left = cx - (bx - bw / 2);
    const right = (bx + bw / 2) - cx;
    const top = cy - (by - bd / 2);
    const bottom = (by + bd / 2) - cy;
    const m = Math.min(left, right, top, bottom);
    if (m === left) { out.x = -left - r; out.y = 0; }
    else if (m === right) { out.x = right + r; out.y = 0; }
    else if (m === top) { out.x = 0; out.y = -top - r; }
    else { out.x = 0; out.y = bottom + r; }
  }
  return true;
}
