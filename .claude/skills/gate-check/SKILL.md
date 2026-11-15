---
name: gate-check
description: Run before every commit, milestone and submission. Verifies the make.fun gate rules (game files, three.js bytes, import map, local-only references, screenshots, dossier size) and the 160 KiB judge-text budget.
---

# Gate check

1. `npm install` once (devDependencies: acorn, playwright). Never add runtime dependencies to the game or main.ts.
2. `sh tools/vendor-three.sh --check` → must print `three.js 0.187.0 files OK`.
3. `node tools/check-gate.mjs` → every row PASS. A WARN on js_parses means a module does not parse: fix it.
4. `node tools/check-budget.mjs` → PASS, total ≤ 145 KiB, nothing marked `CUT/HIDDEN`, every game module
   appears in the reading order (a module listed under "Not reached by imports" is probably dead code).
5. When the kit is present, produce the real output and check it too:
   ```sh
   rm -rf /tmp/out && mkdir /tmp/out && MAKEFUN_OUTPUT_DIR=/tmp/out node main.ts
   node tools/check-gate.mjs --out /tmp/out
   ```
   `/tmp/out` must contain only `game/`, `screenshots/`, `dossier.json`; dossier ≤ 1.5 MiB.
   Run `main.ts` twice and `cmp` the two dossier.json files: they must be identical (determinism).
6. Paste the outputs in your report. If a row fails, fix the game, not the tool.

Common failures: a `data:` or `https:` URL in index.html; `import 'three/addons/...'`; a second import map;
a module imported with a bare name other than `three`; a screenshot over 256 KiB or not 1280×720;
a stray `.DS_Store` or symlink in game/.
