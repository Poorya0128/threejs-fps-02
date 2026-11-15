---
name: screenshots
description: Make the 3–4 judged screenshots (the first is the public cover) from the game's own ?scenario= setups with tools/shoot.mjs, then verify them by looking at them.
---

# Screenshots

Rules from the bounty: real renders of the game's own code, never edited, cropped, composited or borrowed.
3 or 4 PNG/JPEG files, ≤ 256 KiB each (we target ≤ 180 KiB because the dossier embeds them and must stay
≤ 1.5 MiB), long side ≤ 1280, short side ≥ 480. The first file by name is the cover.

## Scenarios (game/js/scenarios.js, ≤ 2 KiB)
Each scenario sets the RNG seed, round state, agent positions/loadouts and camera through **normal game
systems**, advances the sim some ticks so FX and animation are live, pauses, then sets
`window.__saltline.scenarioReady = true`. Nothing is drawn that the normal game cannot show.

| File | scenario | Must show |
|---|---|---|
| 01-cover.jpg | cover | live firefight on Conveyor at dusk, 2 enemy bots readable, muzzle flash + tracer, rifle viewmodel, full HUD (health, armor, ammo, money, timer, score, radar, killfeed with a headshot) |
| 02-buy.jpg | buy | buy phase, buy menu open with prices and credits, teammates in view |
| 03-fuse.jpg | fuse | planted Fuse at Boiler with beacon light, Fuse timer in HUD, smoke at the door, teammate holding an angle |
| 04-roundend.jpg | roundend | round-win banner + scoreboard over Pans |

## Procedure
1. `node tools/shoot.mjs` (or `--only cover`). It serves game/, waits for `scenarioReady`, captures 1280×720 JPEGs.
2. **Open and look at every image** (read the file as an image). Check: not black, HUD complete and crisp,
   characters readable against the background, the composition leads the eye, palette per PLAN.md §4.1.
3. Iterate on the scenario camera/positions/lighting until the cover is the best image of the game.
   Software GL in headless can differ from a real GPU; if shadows or colours look wrong, try `HEADED=1`.
4. `node tools/check-gate.mjs` → screenshots row PASS.
5. Commit the images together with the code that produced them; screenshots must match the current code.
