# AGENTS.md — SALTLINE (make.fun "best three.js tactical FPS" entry)

You are building a round-based tactical FPS for desktop Chrome on three.js 0.187.0, single-player vs bots,
shipped as static files. **PLAN.md is the full specification. Read all of it before your first edit.**
This file repeats the rules that must never be broken and defines how to work in this repo.

## Non-negotiable rules
1. **three.js**: only `game/three.module.min.js` and `game/three.core.min.js` (already vendored, byte-exact,
   checked by `tools/vendor-three.sh --check`). Never edit, re-download, minify or replace them.
   No `three/addons`, no CDN, no second copy. `game/index.html` has exactly one
   `<script type="importmap">{ "imports": { "three": "./three.module.min.js" } }</script>`.
2. **Offline & static**: no build step, no network request, no web fonts, no `data:` URIs in `src`/`href`,
   every reference is a relative path to a real file inside `game/`. Dynamic `import()` only with literals.
   All textures are generated with canvas, all sounds with WebAudio.
3. **Kit files**: `vendor/makefun-threejs.ts` and the starter `main.ts` come from the competition kit
   (see docs/KIT.md). Copy them unchanged. Never write your own version of `makefun-threejs.ts` and never
   guess its API: read the file. If the kit files are missing, stop and ask the user for them before
   working on `main.ts`. You can build the game itself without them.
4. **main.ts** runs on plain Node 22.18+ with type stripping: erasable TS only (no enum/namespace/parameter
   properties), `.ts` extensions in relative imports, only Node built-ins plus `./vendor/makefun-threejs.ts`.
   It must never import npm packages (the grader does not run `npm install`).
5. **Originality**: no names, maps, characters, HUD layouts or art from Counter-Strike or any commercial game.
   Use the names in PLAN.md §4 (Strand, Bastion, Fuse, Cutters, Brinehold, Wren, Talon, …).
6. **The judge reads only screenshots + source text capped at 160 KiB**, starting with index.html and following
   static imports depth-first. Keep all game source (`.html .js .mjs .css .json .glsl …` under game/, excluding
   `*.min.js`) at **≤ 145 KiB**. Never hide game code in `*.min.js` or a `vendor/` folder.
7. **Never claim a feature in the Reviewer's map comment (top of index.html) that is not in the code.**
   Every line names a real file and function. Facts only, no requests to the judge.
8. Do not modify `tools/` checks to make them pass. Fix the game instead. You may fix a real bug in a tool;
   say so in the commit message.

## Code rules (judge criterion 5)
- Module layout and budgets: PLAN.md §5.2. One job per module. `main.js` imports in the order of that table.
- One state object from `js/state.js`. Systems are `update(state, dt)` functions without hidden state.
- Fixed-step sim at 64 Hz with accumulator and render interpolation. Render reads state, never writes it.
- No allocations in per-tick or per-frame code: module-level scratch vectors, pools, ring buffers. No
  `.map/.filter/.forEach` closures in hot loops. HUD writes the DOM only when a value changed.
- Player and bots share the same physics, weapon, economy code paths.
- No dead code, no commented-out code, no debug overlays in committed milestones, no duplicate logic.
- Seeded RNG for everything that affects the sim.

## Test contract the game must expose (used by tools/smoke.mjs and tools/shoot.mjs)
`window.__saltline` is a small **read-only status object** updated by `main.js`:
```js
{ ready: boolean,          // first frame rendered
  round: number, phase: 'buy'|'live'|'planted'|'post'|'matchEnd',
  score: { strand: number, bastion: number },
  roundsPlayed: number, matchOver: boolean,
  lastWinReason: 'elimination'|'time'|'detonation'|'defuse'|null,
  scenarioReady: boolean } // true when a ?scenario= setup has settled and the frame is final
```
URL parameters:
- `?autoplay=1` — the player slot is driven by a bot brain (no pointer lock needed).
- `&speed=N` — run N sim ticks per animation frame (1–16).
- `&seed=N` — RNG seed.
- `?scenario=cover|buy|fuse|roundend` — deterministic screenshot setups from `js/scenarios.js` (PLAN.md §13),
  built only from normal game systems. Sets `scenarioReady` and pauses the sim.

## Workflow
Work milestone by milestone (PLAN.md §15: M0 → M7). Do not start a milestone before the previous one passes.
At the end of every milestone, run and show the output of:
```sh
sh tools/vendor-three.sh --check
node tools/check-gate.mjs            # gate rules for game/ and screenshots/
node tools/check-budget.mjs          # source bytes and judge reading order
node tools/smoke.mjs                 # from M3 on: full autoplay matches, no console errors, no network
```
Then commit with a message `M<n>: <summary>` and push. Never report a milestone done without the command output.
Skills in `.claude/skills/` describe each of these procedures in detail; load the matching one before the task.

Parallel subagents: build the core (state, loop, input, physics, weapons, map, rounds) yourself, sequentially.
After M3, independent modules (audio, textures, characters, viewmodel, HUD styling) may go to subagents with
worktree isolation; give each the PLAN.md section, the file's budget and the module interfaces.

If something in PLAN.md is impossible or contradicts the kit, stop and ask the user; do not invent a workaround
that touches the rules above.

## Repo map
```
AGENTS.md          this file
PLAN.md            full design and process
docs/KIT.md        where the kit files go and how main.ts must behave
docs/MUSE.md       setup notes and milestone prompts for the human operator
game/              the shipped game (three.js files already vendored)
screenshots/       3–4 JPEGs, made by tools/shoot.mjs only
tools/             dev-only checks and scripts (never copied to output)
vendor/            makefun-threejs.ts from the kit (unchanged)
.claude/skills/    procedures: gate-check, vendor-three, screenshots, hot-loop-audit, milestone
```
