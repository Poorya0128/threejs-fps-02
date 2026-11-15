# Competition kit files

The bounty's kit provides two files that this repo needs and that are **not** public on the web:

| Kit file | Goes to | Rule |
|---|---|---|
| `makefun-threejs.ts` | `vendor/makefun-threejs.ts` | Copied unchanged, byte for byte. The gate rebuilds the dossier with it and compares byte for byte. |
| starter `main.ts` | `main.ts` (repo root) | Start from it; change only what is needed. |

The kit may also contain its own copies of `three.module.min.js` / `three.core.min.js`. If so, compare them:
`cmp kit/three.module.min.js game/three.module.min.js && cmp kit/three.core.min.js game/three.core.min.js`.
The kit's bytes win if they ever differ (report it).

## What main.ts must do
1. Output dir = `process.env.MAKEFUN_OUTPUT_DIR ?? '/output'`.
2. Copy `game/` and `screenshots/` from the repo into it (plain files and dirs only, skip names starting with `.`).
3. Write `<out>/dossier.json` with `buildDossier` from `./vendor/makefun-threejs.ts`, exactly as the starter does.
4. Use only Node built-ins (`node:fs`, `node:path`, …) and the vendor file. No npm packages.
5. Node 22.18+ type stripping: erasable TypeScript only; relative imports end in `.ts`.

Test:
```sh
rm -rf /tmp/out && mkdir /tmp/out && MAKEFUN_OUTPUT_DIR=/tmp/out node main.ts && node tools/check-gate.mjs --out /tmp/out
```

## Until the kit is here
Build the game (M1–M5) normally; `tools/check-gate.mjs` and `tools/check-budget.mjs` work without the kit.
Do not write a replacement for `makefun-threejs.ts`. Ask the user for the kit before M0's main.ts step is
marked done.
