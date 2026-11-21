# VERDE BAY — an open-world crime game

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/ChristaNavisa/gta6-01-2/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/ChristaNavisa/gta6-01-2/reward.svg)](https://make.fun/bounty/gta6-01)

**VERDE BAY** is a complete open-world crime game for the [Make GTA 6](https://make.fun/bounty/gta6-01) bounty on make.fun: a sun-soaked fictional city you explore on foot and by car, with traffic and pedestrians, cars to steal, a wanted level with police who respond, twelve story missions, combat, businesses, a crew, and a HUD with a live minimap.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network requests — plain static files under `game/`.

## The city

Verde Bay is a 3600×3600 top-down city in six districts — Downtown Verde, Marina Bay, North Hills, Old Town, Portside and Sunset Beach — with a road grid, parks, a beach, a port, stunt ramps, a garage, a gun store and a hospital. A day/night cycle changes the light and switches the headlights on after dark.

## Systems

- **12 story missions** — pickups, package runs, ambushes, a grand race and a final showdown, with a mission fanfare and payouts.
- **Garage** — 6 cars to buy and upgrade (engine, armor, NOS), each with its own handling.
- **NOS boost** — a meter, flame effects and a sound cue on Shift.
- **Live minimap** — player, cars, police, helicopter, mission markers, race checkpoints and taxi fares.
- **Carjacking** — steal parked and traffic cars; stealing in front of police raises your wanted level.
- **Street races** — 6 checkpoints, a timer and a saved best time.
- **Crew** — Mara (driver, heat fades faster) and Dario (muscle, fights beside you), recruited through the story.
- **District respect** — earn it with missions, fares and business; it unlocks garage discounts.
- **Weapon wheel** — 5 weapons (fists, pistol, SMG, shotgun, rifle) with ammo sold at the gun store.
- **Police** — wanted stars 1–5, patrol cars, a visible helicopter at 3+ stars, military jeeps at 5 stars.
- **Businesses** — buy the Laundromat, the Sunset Motel and Club Nova; they pay out every minute.
- **Taxi fares** — pick up passengers and drop them off for fast cash.
- **Stunt jumps** — ramps pay air-time bonuses.
- **Save** — progress saves to localStorage; continue from the title screen.

## Controls

WASD / arrows move and drive · E enter / steal car · mouse aim, click shoot · Q weapon wheel · 1–5 weapons · Shift NOS · Space handbrake · G garage · B buy business · T taxi fare · M next mission · U gun store · H hospital · R radio · P save · Esc pause.

## Files

| File | Job |
| --- | --- |
| `game/src/main.js` | Game state, loop, player controls, menus |
| `game/src/config.js` | World, districts, cars, weapons, missions, businesses |
| `game/src/city.js` | Map generation, roads, buildings, collision |
| `game/src/vehicles.js` | Car physics, traffic AI, police driving |
| `game/src/weapons.js` | Shooting, bullets, weapon shop |
| `game/src/sim.js` | Pedestrians, police response, helicopter, taxi, business income |
| `game/src/missions.js` | Twelve story missions (step interpreter) |
| `game/src/race.js` | Street races: checkpoints, timer, best time |
| `game/src/garage.js` | Car shop, upgrades, taking cars out |
| `game/src/crew.js` | Mara, Dario and district respect |
| `game/src/effects.js` | Particles, skid marks, day/night light |
| `game/src/hud.js` | HUD readouts and the live minimap |
| `game/src/audio.js` | Procedural sound effects and radio |
| `game/src/input.js` | Keyboard and mouse input |
| `game/src/save.js` | localStorage save / load |
| `game/src/shots.js` | Screenshot poses (`?shot=...`) |
| `main.ts` | Entry program: copies game + screenshots, writes dossier.json |

## License

MIT — see `LICENSE`. An original game: its own city, characters, vehicles, names, story, art, sounds and music. Not affiliated with Rockstar Games.
