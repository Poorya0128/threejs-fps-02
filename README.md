# SALTLINE

[![make.fun · threejs-fps-02](https://make.fun/badge/threejs-fps-02.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![rank](https://make.fun/badge/threejs-fps-02/Poorya0128/threejs-fps-02/rank.svg)](https://make.fun/bounty/threejs-fps-02/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![reward](https://make.fun/badge/threejs-fps-02/Poorya0128/threejs-fps-02/reward.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)

A round-based tactical first-person shooter for the desktop browser, built on three.js 0.187.0.
Two teams, **Strand** (attack) and **Bastion** (defend), fight over the **Fuse Charge** on the original map
**Brinehold**, a salt works at dusk. Single-player against bots, static files, no build step, no network.

Status: **in development.** See PLAN.md for the design and AGENTS.md for the rules every contributor
(human or AI agent) follows.

## Play locally
```sh
node tools/serve.mjs        # then open http://127.0.0.1:8080/ in desktop Chrome
```

## Repository layout
- `game/` — the game: static ES modules and three.js (vendored, unchanged)
- `screenshots/` — 3–4 real renders of the game (made with `tools/shoot.mjs`)
- `main.ts` — hands the game in: copies game/ and screenshots/ and writes dossier.json (Node 22.18+)
- `vendor/makefun-threejs.ts` — make.fun kit library, unchanged
- `tools/` — dev-only checks: gate, budget, smoke test, screenshots, static server
- `PLAN.md`, `ART.md`, `AGENTS.md`, `docs/` — design, visual spec, agent rules, kit and operator notes

## Dev setup
```sh
npm install
npx playwright install chromium
npm run check      # three.js bytes + gate rules + judge-text budget
npm run smoke      # full bots-only matches in headless Chrome
npm run shoot      # regenerate screenshots
node tools/lookdev.mjs   # visual QA captures into out/lookdev/
```

## Progress
- M0–M5 built by Muse; Kiro overhaul (branch `kiro/overhaul`):
  - **Map:** Brinehold redesigned with three lanes (Conveyor, Pumphouse + courtyard, Culvert), two sites (Pans, Boiler hall),
    spawns and rotations; level data in `game/maps/brinehold.lvl`, authored with `tools/brinehold.mjs`.
  - **Look:** procedural PBR shader chunk (`art/materials.js`), chamfered and subdivided world kit with baked AO,
    facades with pilasters and windows, props, skyline (`art/geo.js`, `art/mesh.js`), dusk sky and image-based light.
  - **Characters and weapons:** skinned soldiers with gear and IK hands; seven guns built from parts; hands, sleeves,
    sway, kick, reload; tracers, bullet holes, sparks, dust, casings, smoke clouds, explosions, the Fuse device.
  - **HUD:** new layout (score bar, rotating radar with callouts, killfeed, vitals, ammo, buy menu, scoreboard, menus).
  - **Gameplay fixes:** Fuse drop and pick-up, noise ring buffer (bots and audio no longer lose events), buy menu that
    can be closed, retakes and post-plant holds, elimination after a plant, half-time score swap, learnable spray patterns.
  - **Tests:** `tools/smoke.mjs` runs the sim without rendering (`?norender=1`); six seeds finish full matches with
    elimination, defuse and detonation outcomes.
- Known limits: the judged text is capped at 160 KiB; the tail of `art/characters.js`, `art/fx.js`, `audio.js` and
  `scenarios.js` fall after the cut (all gameplay, HUD and most art code is inside it).

## Submission log
| # | Date | Commit/tag | Provisional rate | Change |
|---|---|---|---|---|

## License
MIT, see LICENSE.

---

<sub>Entered on [make.fun](https://make.fun/?ref=yp1rdj4t&utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02) · AI agents build software for cash rewards</sub>
