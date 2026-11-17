# VERDE BAY — Sunset Heist

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/ChristaNavisa/gta6-01-2/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/ChristaNavisa/gta6-01-2/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game in the spirit of GTA 6, built for the
[make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01). Everything in it —
the city, the characters, the cars, the story, the art and the sounds — is
invented for this game. No Rockstar names, maps, characters or assets.

## The game

Cole Vega came back to Verde Bay broke. Mara Voss, the fixer who runs the
garage on 5th, has work — if Cole can drive, steal, and disappear faster
than the VBPD can catch him.

- **A city to explore** — Verde Bay: downtown towers, the Palmera Diner,
  the Old Cannery, the Verde Bowl stadium, and the Marina del Sol beach,
  on foot and by car.
- **Traffic and pedestrians** — cars follow the avenues, walkers use the
  sidewalks, and both scatter when things go loud.
- **Steal and drive** — any parked or passing car is yours. Press E to
  take it. A Comet GT, a Torro muscle car, a cab, a van — each drives
  differently.
- **Wanted level** — steal in view of the law, hit a pedestrian, or fire
  a shot and the stars rise. Interceptors chase and ram; foot cops try
  to arrest you. Lose them to cool off.
- **Five story jobs** — from a first package run to the Verde Bay Bank
  job, with a getaway, a hot car, and a payback in between. Plus taxi
  fares on the side.
- **Combat** — a pistol, rival Vipers who shoot back, and a city that
  reacts.
- **HUD with minimap** — wanted stars, health, cash, ammo, speed, the
  mission objective, and a live minimap with police and marker dots.
- **Save** — progress (cash, jobs, stats) saves to localStorage.
- **Sound** — engine hum, sirens, gunshots and jingles, all synthesised
  with WebAudio. No audio files, no network.

## How to play

Open `game/index.html` in desktop Chrome (serve `game/` with any static
server, e.g. `node serve.ts`). Keyboard + mouse:

- **WASD** walk / drive, **Shift** sprint, **Space** handbrake
- **E** enter or exit a car
- **Mouse** aim, **click** shoot
- **Esc** pause, **M** mute

## Structure

- `game/src/main.js` — bootstrap, loop, menus
- `game/src/world.js` — game state and the per-frame update
- `game/src/city.js` — deterministic city generation (roads, blocks, parks, beach)
- `game/src/player.js` — on-foot movement, car theft, shooting
- `game/src/vehicles.js` — arcade car physics and traffic AI
- `game/src/pedestrians.js` — sidewalk walkers, fleeing, gang fighters
- `game/src/police.js` — wanted heat, police spawns, chases, arrests
- `game/src/missions.js` — the five-job story arc and taxi fares
- `game/src/render.js` — canvas rendering and sunlight
- `game/src/hud.js` — HUD readouts and the minimap
- `game/src/effects.js` — particles, skid marks, floating text
- `game/src/audio.js` — synthesised WebAudio effects
- `game/src/input.js`, `game/src/random.js`, `game/src/save.js`, `game/src/shots.js` — input, seeded RNG, saves, screenshot staging
- `main.ts` — the entry program: copies `game/` + `screenshots/` to `/output` and writes `dossier.json`

## Screenshots

The four screenshots in `screenshots/` are real renders of the game in
headless Chrome, taken deterministically with `?seed=1`:

1. `1-start.jpg` — title screen (`?shot=start&seed=1`)
2. `2-drive.jpg` — driving the Comet GT down the avenue (`?shot=drive&seed=1`)
3. `3-chase.jpg` — three-star chase with interceptors on your tail (`?shot=chase&seed=1`)
4. `4-mission.jpg` — the Old Cannery payback, on foot (`?shot=mission&seed=1`)
