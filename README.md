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
- M2 gunplay: full arsenal table (Wren/Mako/Hornet/Breaker/Talon/Gavel/Longbow/Cutlass + 3 grenades, all in config.js WEAPONS), hitscan vs world AABBs and agent hitboxes (head sphere, chest/stomach/arm/leg capsules; head ×4, helm ×2.4), spread (base/crouch/scope/move/air/bloom), spray patterns + view kick, reload (shotgun shell-by-shell, interruptible), weapon switching (1–4/Q/wheel), viewmodel built from weapon data (extruded receiver, lathe barrel, red-dot optic, gloved hands, sway/bob/kick/reload/ADS springs), muzzle flash + tracer + impact decals/sparks + ejecting shells + dummy hit-flash and fall, WebAudio synth shots/reload/headshot ding, HUD ammo/weapon/armor, crosshair gap from live spread, hit marker (red for head), killfeed, Longbow scope (2 levels, FOV 40°/15°, overlay). 4 static Bastion dummies to shoot (M2 test loadout: Talon/Wren/Cutlass/Longbow; buy menu sets the real loadout in M4). Verified in headless Chrome (SwiftShader, ~3 fps at 1280×720): standing 6 shots / 4 hits / 1 kill; headshot aim 3 shots / 1 hit / 1 head / 1 kill (Talon head ×4 kills); moving 6 shots / 1 hit (17% vs 67% standing — movement penalty proven); reload refilled 30/81 in one run; switch to Wren confirmed; scope overlay confirmed visible. Zero console errors. Source 107.9 KiB of the 150 KiB target. Bugs found by looking at frames and fixed: (1) Chromium fires synthetic mousemove events on pointer-lock acquisition and on mousedown while locked, with movement equal to minus the pre-lock cursor position — pitched the view +47° on every click; fixed by dropping the first event after lock plus a >250 px per-event magnitude guard. (2) Tracing from the muzzle biased shots ~0.16 m low / 0.18 m right, turning centred headshots into chest hits; the trace now starts at the eye, FX still at the muzzle. (3) The viewmodel had no lights/environment and its barrel pointed sideways; it now shares the world PMREM environment + a weak fill and is rotated to face forward. (4) The scope overlay never showed because the HUD set display '' while the CSS default is display:none; now sets 'block'. (5) An RMB press landing inside the 0.35 s switch window lost the scope edge; the scope toggle now runs before the switchT early-return. Known: the reload check is timing-flaky in the 3 fps headless harness (15 s real is borderline for the 2.2 s sim reload — it passed once, missed once); the mechanism is proven. Debug-only `?fxhold=1` (stretches flash/tracer life ×20) and `?post=0` remain, removed in M6.

## Submission log
| # | Date | Commit/tag | Provisional rate | Change |
|---|---|---|---|---|

## License
MIT, see LICENSE.
