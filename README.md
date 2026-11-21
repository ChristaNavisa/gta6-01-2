# VERDE BAY — an open-world crime game

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/ChristaNavisa/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/ChristaNavisa/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

**VERDE BAY v9** — the most complete rendition yet of an open-world crime game
in the browser: a sun-soaked island city you explore on foot and by car, with
traffic and pedestrians, cars to steal, a wanted system with police cars,
a helicopter and a military response, 12 story missions, and a garage, street
races, a crew and respect to build.

## What is in the game

- **A living city** — Verde Bay: 7×7 blocks of towers with lit windows, a
  marina, downtown, harbor, hills and old town, palms, streetlights and a
  day/night cycle with a real sun.
- **Drive and steal** — traffic follows the roads, parked cars wait at the
  curb. Press E to carjack a driver or take a parked car; get out the same way.
- **Garage** — buy cars (6 models, from the Pip Hatch to the Bison Muscle),
  fit engine stages, armor, a bigger NOS tank, neon underglow and gold paint.
  Owned cars and upgrades persist in the save.
- **NOS** — hold Shift in a car for a nitrous boost: the HUD meter drains and
  refills, with flames and a speed kick.
- **Minimap** — a live canvas map in the HUD corner: you, police, the mission
  marker, the garage, shops and race rings.
- **Street races** — checkpoint courses with a par time and a payout (Bay
  Sprint, Harbor Loop). Mara's crew ability pays +20%.
- **Crew & respect** — Mara Voss (driver) and Dario Kane (muscle) join you as
  the story goes on. Respect grows with missions and unlocks a shop discount,
  a free Vesper GT, stronger crew abilities and gold paint.
- **Weapon wheel** — five weapons (pistol, SMG, shotgun, rifle, LMG). Hold Q
  or press 1–5; buy new ones at shops with mission money.
- **12 story missions** — from "First Wheels" to "The Big Score": courier
  runs, getaways, races, protection, a bank job and a 5-star finale. $48,000+
  in payouts, $12,000 for the last job alone.
- **Wanted** — 0 to 5 stars. Police chase and ram; at 5 stars a military
  jeep and a helicopter with a spotlight join in. Lose them, get busted, or
  get wasted — and wake up at the safehouse.
- **Radio** — three procedural stations (Bay FM, Verde Beats, Harbour Jazz),
  engine hum, sirens, gunshots and a mission fanfare. All synthesized, no
  audio files.
- **Save** — progress autosaves after every mission; F saves anywhere.

## How to play

Serve `game/` with any static server (`node serve.ts`, then
http://localhost:8080) and open `game/index.html` in desktop Chrome. No
network request is made: three.js is vendored under `game/vendor/`, every
sound is synthesized, every texture is drawn in code.

| Key | Action |
| --- | ------ |
| WASD / arrows | Walk / drive |
| Shift | Run · NOS boost in a car |
| E | Enter / steal a car · open garage / shop |
| Mouse click | Shoot (on foot) |
| Q (hold) / 1–5 | Weapon wheel |
| M | Start the next mission |
| R | Radio station |
| F | Save |
| Esc | Pause |
| H | Help |

## How it is built

`game/` is plain static files, no build step. The source is split into one
file per job so the structure reads at a glance:

- `src/config.js` — every number: districts, weapons, cars, garage, crew, races, missions
- `src/city.js` — the procedural island city
- `src/render3d.js` — renderer, chase camera, sun/sky, car and ped meshes
- `src/vehicles.js` — arcade car physics, traffic AI, police chase, helicopter
- `src/weapons.js` — five weapons and the weapon wheel
- `src/garage.js` — car shop and tuning, saved
- `src/race.js` — checkpoint street races with par times
- `src/crew.js` — crew abilities, respect tiers, district standing
- `src/sim.js` — the world: player, wanted, police, pedestrians, collisions
- `src/missions.js` — the 12-mission story runner
- `src/hud.js` — HUD, live minimap, garage panel
- `src/effects.js` — particles, explosions, NOS flames, camera shake
- `src/audio.js` — procedural WebAudio: engine, sirens, radio, gunshots
- `src/save.js` — localStorage save / load
- `src/shots.js` — `?shot=` scenes for the entry screenshots
- `src/main.js` — entrypoint, frame loop, menu and key bindings

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/`
to `/output` and writes `/output/dossier.json` with the vendored make.fun
library. Screenshots are real renders of this code in a browser.

## License

MIT — see `LICENSE`.
