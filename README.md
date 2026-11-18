# VERDE BAY 3D

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/ChristaNavisa/gta6-01-2/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/ChristaNavisa/gta6-01-2/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world crime game in the spirit of GTA 6, built for make.fun's
**gta6-01** bounty. Verde Bay is a sun-soaked island city — four districts,
a beach, a marina, and a bridge across the strait to Isla Verde — rendered
in 3D with three.js at dusk. Everything is original: the city, the
characters, the vehicles, the story, the art and the sounds.

## The city

- **Downtown** — glass towers and Liberty Plaza
- **Old Town** — low brick streets and Rosa's Diner
- **Industrial** — the Old Cannery and the Harbor Warehouse
- **Beach** — palms, Sunset Pier and Club Marea
- **Marina del Sol** — docks, the Ferry Terminal and the moored ferry
- **Isla Verde** — the resort island across the Verde Bridge

## Systems

- Explore on foot and by car; steal any parked or traffic car (the police notice)
- Traffic and pedestrians on a real street network
- Wanted level 1–5 with police who chase, ram and bust you
- Pistol combat with gang members who shoot back
- 8 story missions, $18,000 in total (see below)
- Taxi side-job, HUD with minimap, health and wanted stars
- Save to localStorage — progress survives a reload
- Synthesized WebAudio: engine hum, police sirens, gunfire, mission jingles
- Particle effects: dust, smoke and sparks as soft glowing sprites

## Story — 8 missions

1. **First Wheels** ($500) — Milo needs wheels. Borrow a Comet GT.
2. **Diner Dash** ($500) — Rosa's coffee run across town.
3. **The Cannery Job** ($1,500) — clear the crew, take the ledger.
4. **Night Shift Taxi** ($1,000) — one fare, then vanish.
5. **The Big Score** ($2,000) — crack the bank vault, lose the heat.
6. **Harbor Heist** ($3,500) — the warehouse shipment and a getaway car.
7. **Island Run** ($4,000) — smuggled cargo across the Verde Bridge, police on your tail.
8. **The Last Ferry** ($5,000) — the terminal safe, one last getaway.

## Play

```sh
node serve.ts
# open http://localhost:8080
```

WASD walk / drive · E enter or steal a car · Space or click shoot ·
Shift run · M start the next mission. The game runs offline from static
files — no network request, ever.

## Layout

- `main.ts` — the entrypoint: copies `game/` and `screenshots/` and writes the dossier
- `game/index.html` — the page (loads vendored three.js, then the game)
- `game/src/config.js` — tuning constants
- `game/src/util.js` — math and text helpers
- `game/src/city.js` — the island city: districts, streets, buildings, palms, places
- `game/src/sim.js` — the simulation: player, cars, traffic, police, combat, missions
- `game/src/missions.js` — the 8-mission story
- `game/src/render3d.js` — the three.js view with chase camera
- `game/src/hud.js` — HUD, minimap, wanted stars, start menu
- `game/src/input.js` — keyboard and mouse
- `game/src/audio.js` — synthesized WebAudio sound
- `game/src/effects.js` — soft-glow particle sprites
- `game/src/shots.js` — screenshot modes
- `game/src/save.js` — localStorage save / load
- `game/vendor/three.min.js` — vendored three.js r160
- `screenshots/` — 4 renders of the game itself
