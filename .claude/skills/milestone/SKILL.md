---
name: milestone
description: How to start, finish and report a milestone (M0–M7 from PLAN.md §15), including the Reviewer's map and the commit.
---

# Milestone procedure

## Start
1. Re-read AGENTS.md and the PLAN.md sections for this milestone. List the exit criteria from §15 and the
   relevant §17 checklist items before writing code.
2. Read the existing modules you will touch. Keep interfaces stable; if one must change, update all callers.

## Build
- Keep each module within its §5.2 budget. Prefer short named functions whose names match the judge's vocabulary
  (`computeSpread`, `applyRecoil`, `accelerate`, `setCrouch`, `collideCapsule`, `canSee`, `onNoise`,
  `followRoute`, `holdAngle`, `plantCharge`, `defuseCharge`, `awardRoundMoney`, `openBuyMenu`, `throwGrenade`).
- Tune numbers only in `config.js`.

## Finish
1. Run the **gate-check** skill (and `node tools/smoke.mjs` from M3 on). All PASS.
2. Update the **Reviewer's map** comment at the top of game/index.html: one short line per implemented criterion
   item: `<feature> — <file> <function>()`. Verify every function name with grep. Remove lines for things not built.
   Keep it ≤ 2.5 KiB, factual, no requests to the judge.
3. Write a short entry in README.md → "Progress" (milestone, what works, known issues).
4. `git add` the specific files, `git commit -m "M<n>: <summary>"`, `git push`.
5. Report to the user: what was built, the tool outputs, known issues, and what the user should play-test by hand
   (movement feel, recoil feel, bot difficulty), since automated tests cannot judge feel.

## Never
- Mark a milestone done with failing checks or untested code.
- Edit `vendor/makefun-threejs.ts`, the three.js files, or the checks in tools/ to get a PASS.
