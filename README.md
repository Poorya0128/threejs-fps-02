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
- `PLAN.md`, `AGENTS.md`, `docs/` — design, agent rules, kit and operator notes

## Dev setup
```sh
npm install
npx playwright install chromium
npm run check      # three.js bytes + gate rules + judge-text budget
npm run smoke      # full bots-only matches in headless Chrome
npm run shoot      # regenerate screenshots
```

## Progress
- M0 scaffolding: three.js vendored and verified, tools and agent instructions in place. Kit files pending.

## Submission log
| # | Date | Commit/tag | Provisional rate | Change |
|---|---|---|---|---|

## License
MIT, see LICENSE.
