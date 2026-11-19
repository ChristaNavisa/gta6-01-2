# VERDE BAY 3D — v8

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/ChristaNavisa/gta6-01-2/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/ChristaNavisa/gta6-01-2/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world crime game in the spirit of GTA 6, built from scratch in Three.js: the island city of Verde Bay — 9 districts, a neon Strip, a port and ferry, Isla Verde across the channel — with traffic, pedestrians, a wanted system, a police helicopter, roadblocks, military jeeps at 5 stars, shops, a safehouse, 3 weapons, a radio, and a 12-mission story worth $48,000.

## The city

Verde Bay is a 3400×2100 island city: Downtown towers, Old Town brick, Residential streets, Beachfront palms, the Industrial Zone with smokestack warehouses, The Strip (neon casinos), Marina del Sol, Port Verde, and Isla Verde across the Verde Channel. Drive any car you find — sedans, sports cars, taxis, trucks — with nitro boost (Shift, 1.55×). On foot, walk, run, and fight.

## The law

- **Wanted 1–2:** police cruisers chase you; at 2 stars, roadblocks of 2 cruisers cut off the road ahead (hit one over 40 speed and you bounce off, −5 HP).
- **Wanted 3–4:** a police helicopter joins — big rotor, searchlight cone at night, ground shadow marker — and blocks your wanted level from decaying. The HUD flashes a HELI warning.
- **Wanted 5:** military jeeps join the chase (faster, heavier, they ram) and roadblocks gain a third cruiser.

Lose the heat by escaping and staying quiet — or get busted, or wasted.

## The story — 12 missions, $48,000

1. First Wheels — $500 · 2. Taxi Takedown — $800 · 3. Dockside Deal — $1,000 · 4. The Big Score — $1,400 · 5. Cannery Run — $1,800 · 6. Harbor Heist — $3,500 · 7. Island Run — $4,000 · 8. The Last Ferry — $5,000 · 9. Neon Grand Prix — $6,000 · 10. The Vault — $7,000 · 11. Neon Crown — $8,000 (midnight race + shootout on The Strip) · 12. King of Verde — $9,000 (steal the casino vault, escape by boat to Isla Verde).

Press M to start the next mission. Missions pay out on completion and autosave.

## Gear and money

- **Verde Arms shop** (press E): VK-9 SMG $1,500, M12 Scattergun $2,500, ammo refills, body armor, first aid.
- **Safehouse Garage** (press E): saves your game and restores health.
- **Weapons:** P9 Pistol, VK-9 SMG, M12 Scattergun — magazines, reload with R, slots 1/2/3.
- **Radio:** 3 synthesized stations — Verde FM, Neon Nights, Isla Beats (C to change).
- **Hidden packages:** 10 across the city, $250 each.
- **Day/night cycle:** the clock and lighting run a full day; neon and the helicopter searchlight come alive at night.

## Controls

WASD drive / walk · Shift nitro / run · Mouse aim · Click / F shoot · R reload · 1/2/3 weapons · C radio · E enter car / shop / safehouse · M next mission · Esc pause · Enter start.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

The game is static files under `game/` (Three.js vendored as `game/vendor/three.min.js`) with no build step and no network requests. `main.ts` hands it in: it copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored make.fun library.

## Files

- `game/src/config.js` — tunables: districts, vehicles, weapons, wanted levels
- `game/src/util.js` — math + seeded RNG
- `game/src/city.js` — the island city generator
- `game/src/missions.js` — the 12-mission story + crime helper
- `game/src/sim.js` — the simulation: driving, police, helicopter, combat, economy
- `game/src/render3d.js` — Three.js renderer, day/night lighting, chase camera
- `game/src/hud.js` — HUD, minimap, shop, wanted stars, HELI warning
- `game/src/input.js` — keyboard + mouse
- `game/src/audio.js` — synthesized engine, radio, sirens, gunshots, fanfare
- `game/src/effects.js` — particles and screen shake
- `game/src/shots.js` — screenshot staging (menu / drive / chase / mission)
- `game/src/save.js` — localStorage save / load
- `game/src/main.js` — boot + game loop
