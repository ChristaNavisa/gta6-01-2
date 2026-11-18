# VERDE BAY 3D — Neon Nights

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/ChristaNavisa/gta6-01-2/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/ChristaNavisa/gta6-01-2/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world crime game in the spirit of GTA 6, built for the make.fun
**gta6-01** bounty. Explore Verde Bay — a sun-soaked island city at dusk —
on foot and by car, steal cars, outrun the police, and play ten story
missions for $31,000.

## The city

Seven districts across the water: **Downtown** towers, **Oldtown** brick,
**Palmside** homes, the **Old Cannery** industrial quarter, **Verde Beach**,
**Marina del Sol** with its ferry, and **The Strip** — a neon casino row —
plus **Isla Verde**, a villa island across the Verde Bridge.

## The story — 10 missions, $31,000

1. **First Wheels** ($500) — steal a car for Sunset Garage
2. **Diner Dash** ($500) — lunch run from Marla Diner to the stadium
3. **The Cannery Job** ($1,500) — lift a crate from the old cannery
4. **Night Shift Taxi** ($1,000) — drive a high roller to the casino
5. **The Big Score** ($2,000) — Verde Bay Bank at noon
6. **Harbor Heist** ($3,500) — the syndicate payroll on the docks
7. **Island Run** ($4,000) — a package for Villa Solana, across the bridge
8. **The Last Ferry** ($5,000) — the syndicate ledger before it sails
9. **Neon Grand Prix** ($6,000) — a three-checkpoint street race down the Strip
10. **The Vault** ($7,000) — four guards, one drill, one bank vault

## Systems

- **Driving** — sedans, the Comet GT sport car, taxis and trucks, each with
  its own handling; **nitro boost** (SHIFT) with a meter that refills
- **On foot** — walk, run, and shoot; enter any parked car with E
- **Wanted level** — 1 to 5 stars; police cars chase, ram, and bust you
- **Traffic & pedestrians** — 22 cars on the road grid, 36 people on foot
- **Hidden packages** — 10 gold caches hidden around the city, $250 each
- **HUD + minimap** — cash, mission tracker, wanted stars, nitro meter,
  and a live map with the mission marker, cops and packages
- **Sound** — fully synthesized WebAudio: engine, sirens, gunshots, jingles
- **Save** — progress (cash, missions, packages) in localStorage

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Drive / walk |
| E | Enter / exit car |
| SHIFT | Nitro boost (car) / run (on foot) |
| SPACE | Shoot (on foot) / brake (car) |
| Mouse click | Shoot |
| M | Mute · P / Esc | Pause |

## Play it

```sh
node serve.ts        # then open http://localhost:8080
```

Static files only — no build step, no network requests. The 3D city is
three.js (vendored under `game/vendor/`); every line of the game itself is
in `game/src/`.
