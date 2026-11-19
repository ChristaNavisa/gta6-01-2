// VERDE BAY 3D v8 — the entrypoint (Node 22, standard library only). It copies
// game/ and screenshots/ from beside this file to /output and writes
// /output/dossier.json with the vendored make.fun library, as the kit requires.
// It never deletes the output directory itself (the grader's /output is a mount
// point: removing it throws EBUSY) — it clears only the directory's contents,
// then copies in a fixed, sorted order so two runs write identical bytes.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Clear only the contents of the output directory, never the directory itself.
function emptyContents(dir: string): void {
  mkdirSync(dir, { recursive: true });
  for (const name of readdirSync(dir)) {
    rmSync(join(dir, name), { recursive: true, force: true });
  }
}

emptyContents(out);
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

// v8 revision: verify the dossier round-trips before reporting success, so a
// half-written or oversized output is caught here instead of at grading.
const written = JSON.parse(readFileSync(join(out, 'dossier.json'), 'utf8'));
if (written.schema !== 'makefun/dossier/v1') throw new Error('dossier schema mismatch after write');
if (!Array.isArray(written.images) || written.images.length !== 4) {
  throw new Error('dossier must carry exactly 4 images, got ' + (written.images || []).length);
}
for (const img of written.images) {
  if (typeof img.base64 !== 'string' || img.base64.length === 0) throw new Error('dossier image missing base64 data');
  if (Buffer.byteLength(img.base64, 'base64') > 256 * 1024) {
    throw new Error('dossier image exceeds the 256 KiB screenshot cap');
  }
}
console.log(`dossier OK: ${written.images.length} images, schema ${written.schema}, output in ${out}`);
