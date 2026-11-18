// VERDE BAY 3D — the entrypoint for make.fun's gta6-01 bounty (Node 22,
// standard library only). It hands the game in: copy this directory's game/
// and screenshots/ to the output directory and write /output/dossier.json
// with the vendored make.fun library, so the judge reads exactly what the
// player plays. Run it locally with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// The program is deterministic: two runs on the same repository write the
// same bytes, because buildDossier sorts everything it reads and the copy
// carries no timestamps.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The playable game, plain static files under game/.
mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });

// The screenshots, real renders of the game in a browser.
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The dossier, exactly as the scorer rebuilds it: the same caps the gate
// publishes (reference/gate.json). Only text_max_bytes shapes the bytes;
// the other caps refuse an entry the scorer would refuse — more than 4
// screenshots or one over 256 KiB, more than 993 entries in game/, 48 MiB
// of game files in all, or a game path over 1000 bytes.
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
