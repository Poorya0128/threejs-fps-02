# SALTLINE

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
- M0 scaffolding: three.js vendored and verified, tools and agent instructions in place. Kit files pending.
- ART.md visual spec, art-review skill and lookdev tool added.
- M1 move in the map: state object, 64 Hz fixed-step loop with render interpolation, pointer-lock input, Quake-style physics (acceleration, friction, jump, walk, crouch, capsule vs AABB, step-up), Brinehold blockout (110x80 m, 44 nav nodes, A* auto-linked), final render foundation (HDR target + ACES final pass + 3-level bloom, fitted sun shadow map, hemisphere + PMREM environment, bevelBox with world-space UVs and baked AO). Shadow-side lift verified by looking at frames: hemi 0.65, env 0.85, exposure 1.3, dusty-rose fog, 3 fake bounce lights. Fixed during M1: bloom feedback loop (separate upsample chain), HDR target black frame (auto-clear wiping the world on the viewmodel pass; depth texture dropped from the multisampled target). Source 60.9 KiB of the 150 KiB target. No screenshots yet (M5); no weapons/rounds/bots yet (M2/M3).

## Submission log
| # | Date | Commit/tag | Provisional rate | Change |
|---|---|---|---|---|

## License
MIT, see LICENSE.
