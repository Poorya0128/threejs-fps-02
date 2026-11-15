# Notes for the human operator (running Muse Code on this repo)

## Before the first session
1. **Check the transcript rule first.** The bounty uploads "AI coding-agent transcripts of the sessions that built it"
   and runs a transcript gate. Confirm on the bounty page that Muse Code's session logs are an accepted format,
   and find where Muse stores them (its event log). Keep every session's log.
2. Put the kit files in place (docs/KIT.md) or have them ready to paste.
3. Settings (`~/.config/muse/settings.json`, must contain `"schema_version": 1`):
   - Standard tier model (`muse-spark-1.2`), **not** the contributor tier (it trains on your code and is limited
     to 100 requests/min, too low for subagents).
   - Reasoning effort `high` (or `xhigh` for M3/M4, the hardest milestones).
   - `runtime_capabilities`: keep memory recall, skill recall and goal tracking on; **turn verification on**
     (it is off by default and checks that the agent really ran what it claims).
4. Network: the sandbox is proxy-only by default. Allow the npm registry and Playwright's browser download
   (`npm install` then `npx playwright install chromium`). After that the game itself needs no network.
5. Do not use `--yolo` outside a disposable container.

## How to drive it
One milestone per prompt. Do not hand over the whole project in one prompt; long unsupervised runs are where
agents drift. After each milestone: read its report, check the tool output it pasted, and play the game yourself
for a few minutes (`node tools/serve.mjs` then open http://127.0.0.1:8080/ in Chrome). Give feedback on feel.

### Prompt templates
**M0**
> Read AGENTS.md and PLAN.md completely. Then do milestone M0 from PLAN.md §15: run `npm install` and
> `npx playwright install chromium`, place the kit files I give you (docs/KIT.md), write main.ts from the starter,
> create a minimal game/index.html with the import map and a lit rotating box, and run the gate-check skill.
> Show all command outputs. Commit "M0: pipeline" and push.

**M1 … M7**
> Do milestone M<n> from PLAN.md §15. Load the milestone skill first and follow it. Use the module layout and
> budgets from §5.2. Before finishing, run the gate-check skill (and tools/smoke.mjs from M3 on), update the
> Reviewer's map, commit "M<n>: …", push, and report outputs, known issues and what I should play-test.

**Parallel work (after M3 only)**
> Spawn subagents with worktree isolation for: (1) js/audio.js per PLAN.md §12b, (2) js/art/textures.js per §11,
> (3) js/art/characters.js per §11, (4) HUD styling in index.html per §12. Give each its PLAN.md section, its byte
> budget from §5.2, and the interfaces it must use. Review and merge each result; run gate-check and smoke after
> merging.

**Feedback after play-testing** (examples)
> Recoil on the Talon feels too weak: the 10th bullet should be ~2× higher than now. Bots on Regular
> react too fast at long range. Fix in config.js only, rerun smoke, commit.

## Submissions
Follow PLAN.md §16: first submission after M3, tag each submitted commit `sub-N`, log the provisional rate in
README.md, and make sure the last submission is the best build.

## Handing back for final review
When M7 is done, give the repo back to Kiro for the final audit (rules, gate, judge readability, code quality,
screenshots, originality).
