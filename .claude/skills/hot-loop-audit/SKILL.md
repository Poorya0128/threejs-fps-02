---
name: hot-loop-audit
description: Audit for judge criterion 5 (code quality) — allocations in per-tick/per-frame code, duplicated logic, dead code, state outside state.js, sim/render coupling. Run at the end of M2, M4 and M6.
---

# Hot-loop and code-quality audit

Hot paths are every function called per tick or per frame: `update*`, `step*`, `tick*`, `render*`, bot think,
physics, weapons, fx, hud update, radar draw, audio per-frame code.

1. Find allocations in those functions:
   ```sh
   grep -nE "new (Vector2|Vector3|Quaternion|Euler|Matrix4|Color|Box3|Ray|Raycaster|Array|Map|Set)\b|\[\]|\{\s*\}" game/js -r
   grep -nE '\.(map|filter|forEach|reduce|slice|concat|flatMap)\(|\.\.\.|`' game/js -r
   ```
   Every hit inside a hot path must become a module-level scratch object, a pool, a preallocated typed array,
   or an indexed `for` loop. Hits in setup code (load, map build, pool creation) are fine.
2. DOM: HUD fields must compare with the last written value before writing `textContent`/`style`.
3. State: `grep -n "^let " game/js -r` — module-level mutable variables outside state.js are only allowed for
   scratch objects, pools and caches; gameplay state lives in the state object.
4. Sim vs render: sim modules (physics, weapons, grenades, bots, rounds, economy) must not import from `art/`,
   `render.js`, `hud.js` or `audio.js`. They emit events (in state) that render/hud/audio consume.
   Check: `grep -n "from './art\|from './render\|from './hud\|from './audio" game/js/{physics,weapons,grenades,bots,nav,rounds,economy}.js`
5. Duplication: player and bots use the same `physics.step`, `weapons.tryFire`, `economy.buyItem`.
   Search for copy-pasted blocks (same 3+ lines in two places) and merge them.
6. Dead code: every export is imported somewhere (`grep -rn "export function" game/js` then grep each name);
   no commented-out code, no `console.log`, no debug flags left on.
7. Re-run `node tools/check-budget.mjs` and `node tools/smoke.mjs`; report what changed.
