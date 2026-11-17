# VERDE BAY — Sunset Heist

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/ChristaNavisa/gta6-01-2/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/ChristaNavisa/gta6-01-2/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world crime game in the spirit of GTA 6, built in three.js. One
driver, six jobs, and a whole city that wants him caught.

## The story

Cole Vega came back to Verde Bay broke. Mara Voss, the fixer who runs the
garage on 5th, has work — if Cole can drive, steal, and disappear faster
than the VBPD can catch him. Six jobs, $9,000 on the table, ending with
the Harbor Heist.

## The city

Verde Bay is a 2600×2000 open world with five districts: Downtown's towers,
the Industrial harbor with its cannery and smokestacks, the Beach with its
45 palms and the Marina del Sol, brick Oldtown, and the residential north
around the Verde Bowl stadium. Traffic cruises the grid, pedestrians walk
the sidewalks, and the sun sets over the water.

## What you can do

- **Drive and steal** — any car on the street is yours if you can take it.
  The Comet GT is the fastest thing in the city; the VBPD's Torro
  interceptors are almost as fast.
- **Wanted level 1–5** — steal, shoot, or pull a job and the police come:
  interceptors that ram, foot cops that drag you in.
- **Six story missions** — First Wheels, Courier Run, Payback, The Big
  Score, Getaway Driver, and the Harbor Heist ($3,500).
- **Combat** — mouse aim, click to shoot; gang members shoot back.
- **Taxi fares** — pick up a fare, drop them off, pocket the cash.
- **HUD + minimap** — cash, health, wanted stars, speed, district, and a
  live minimap with the objective, the cops, and your taxi fare.
- **Save** — progress saves after every job; continue from the menu.

## Controls

| Key | Action |
| --- | --- |
| WASD | Walk / drive |
| E | Get in or out of a car; start the next job at Mara's Garage |
| Mouse | Aim (click to shoot) |
| Space | Brake |
| Esc | Pause |

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network: `game/` is plain static files, three.js r160
vendored under `game/vendor/`.

## How it's built

- `game/src/city.js` — the seeded city: districts, roads, named places
- `game/src/sim.js` — the simulation: driving, traffic, peds, police, combat, taxi
- `game/src/render3d.js` — the three.js renderer: chase camera, shadows, marker
- `game/src/missions.js` — the six jobs and their stages
- `game/src/hud.js` — HUD + minimap
- `game/src/audio.js` — synthesized engine, sirens, gunshots (WebAudio, no files)
- `main.ts` — hands the game in: copies `game/` + `screenshots/` and writes the dossier

Built for the [make.fun GTA 6 bounty](https://make.fun/bounty/gta6-01).
