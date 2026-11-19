[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/ChristaNavisa/gta6-01-2/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/ChristaNavisa/gta6-01-2/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# VERDE BAY 3D v7 — Make GTA 6

An original open-world crime game in the spirit of GTA 6, built for the [make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01). One island city, ten story missions, $31,000 of story cash — and a police helicopter that does not give up.

## The city

Verde Bay is an island city off a sun-soaked coast: Downtown, Old Town, the Industrial Yards, Palms Residential, Verde Beach, The Strip, Marina del Sol, and Isla Verde across the bridge — plus the channel that splits them. Traffic (22 cars), pedestrians (36), palms, neon, and 10 hidden packages worth $250 each.

## What is in v7 (new vs v6)

- **Police helicopter** — at 3 wanted stars a heli circles overhead with a spotlight and keeps the heat on.
- **Police roadblocks** — at 2 stars, cruiser walls block the roads ahead of you.
- **Shops & safehouse** — Verde Arms sells the SMG ($1,500), the scattergun ($2,500), ammo, armor and first aid. The Safehouse Garage saves progress and heals you.
- **Three weapons** — P9 Pistol, VK-9 SMG, M12 Scattergun, with magazines, reloads and a weapon wheel (keys 1/2/3).
- **Radio** — three stations (Verde FM, Neon Nights, Isla Beats), all synthesized in WebAudio. Key C cycles.
- **Story** — 10 missions, $31,000 total: First Wheels ($500), Taxi Takedown ($800), Dockside Deal ($1,000), The Big Score ($1,400), Cannery Run ($1,800), Harbor Heist ($3,500), Island Run ($4,000), Last Ferry ($5,000), Neon Grand Prix ($6,000), The Vault ($7,000).

## Systems

- Driving with nitro (Shift, 1.55× boost), car stealing (F), traffic AI, wanted levels 1–5 with cop cars, foot cops, busts and roadblocks.
- On-foot and in-car combat, gang shootouts, health + armor, packages, minimap with mission markers.
- Save/load (localStorage), autosave after every mission, pause menu, busted/wasted flow.
- Synthesized sound only — engine, sirens, gunshots, radio. No audio files, no network requests.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive |
| Shift | Sprint / nitro boost |
| F | Enter / steal car, get out |
| Mouse + click | Aim, shoot |
| 1 / 2 / 3 | Pistol / SMG / Shotgun |
| R | Reload |
| M | Start next mission |
| E | Shop / Safehouse (when near) |
| C | Next radio station |
| Esc / P | Pause |

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

The game is plain static files under `game/` (three.js vendored as `game/vendor/three.min.js`) — no build step, no network. `main.ts` hands it in: it copies `game/` and `screenshots/` to the output directory and writes `dossier.json`.

## License

MIT — see [LICENSE](LICENSE).
