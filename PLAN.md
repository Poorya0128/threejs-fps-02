# SALTLINE — Master Plan for the make.fun "Best three.js Tactical FPS" Bounty

This document is the complete brief for the agent that builds the entry. Read all of it before writing code.
Sections 1–3 are rules and strategy. Sections 4–12 are the design. Sections 13–16 are the process.

Working title: **SALTLINE**. Map: **Brinehold**. All names in this plan are original; keep them or replace
them with other original names, but never use names from Counter-Strike, Valorant, Rainbow Six, CoD, etc.

---

## 0. Facts already verified (Nov 15, 2026)

- `npm pack three@0.187.0` works. `package/build/three.module.js` (658,900 bytes) contains exactly
  **two** occurrences of `'./three.core.js'` (single quotes). `three.core.js` is 1,474,799 bytes.
- Sandbox Node is v22.23.4. Node ≥ 22.18 runs `.ts` files directly with type stripping, so `main.ts`
  must use **erasable TypeScript only**: no `enum`, no `namespace`, no constructor parameter properties,
  and relative imports must include the `.ts` extension (`import { buildDossier } from './vendor/makefun-threejs.ts'`).
- The kit (starter `main.ts` + `vendor/makefun-threejs.ts`) is not public on the web. Get it from the
  bounty page / final kit. Do not write your own `makefun-threejs.ts`.

---

## 1. Hard rules (an entry that breaks one of these is invalid or loses)

### 1.1 Repository
- Public GitHub repo on the user's own account, **created after the competition opened**.
- Root: `LICENSE` (MIT), `main.ts`, `vendor/makefun-threejs.ts` (kit copy, never edited, not even whitespace),
  `game/`, `screenshots/`, `README.md`, `tools/` (dev-only scripts, never copied to output).
- `main.ts` must run with **only Node built-ins plus the vendor file**. The grader will not `npm install`.
  Base it on the starter's `main.ts`: copy `game/` and `screenshots/` to `process.env.MAKEFUN_OUTPUT_DIR ?? '/output'`,
  then write `dossier.json` with `buildDossier`. Skip dotfiles (`.DS_Store`) when copying.
  Time limit 120 s per run (it will take < 1 s).

### 1.2 three.js vendoring (do it with a script, `tools/vendor-three.sh`)
```sh
npm pack three@0.187.0 && tar xzf three-0.187.0.tgz
cp package/build/three.core.js   game/three.core.min.js
sed "s#'./three.core.js'#'./three.core.min.js'#g" package/build/three.module.js > game/three.module.min.js
grep -c "three.core.min.js" game/three.module.min.js   # must report the 2 rewritten specifiers
```
If the kit ships these two files, compare with `cmp`; the kit's bytes win.
- `game/index.html` contains **exactly one** `<script type="importmap">`:
  `{ "imports": { "three": "./three.module.min.js" } }`.
- **Do not use `three/addons`** (PointerLockControls, BufferGeometryUtils, EffectComposer, GLTFLoader…).
  Write the small pieces yourself. This avoids any extra three.js files and any "other version" risk.
- Never import three from a CDN, never ship a second copy.

### 1.3 Static, offline, no build step
- Plain ES modules under `game/js/`, loaded by `<script type="module" src="./js/main.js">`.
- **Zero network requests**: no web fonts, no CDN, no analytics, no `fetch('http…')`.
- Every `src`/`href` in index.html must be a **relative path to a real file inside game/**.
  No `data:` URIs in `src`/`href` attributes (the gate requires them to resolve to a regular file).
  Do not add a `<link rel="icon">` unless you ship the icon file.
- Dynamic `import()` only with string literals, or not at all.
- All art and sound are **generated in code** (canvas textures, WebAudio synthesis). This keeps the game
  offline, original by construction, and makes the art visible to the judge as code.

### 1.4 Gate limits (check them with `tools/check-gate.mjs`, see §14)
| Item | Limit |
|---|---|
| game/ entries (files + dirs) | ≤ 993 (aim for < 40) |
| game/ total size | ≤ 48 MiB (we will be ~2.3 MiB, mostly three.js) |
| game/index.html | ≤ 1 MiB |
| /output total | ≤ 1000 entries, ≤ 64 MiB |
| screenshots | 3 or 4 files, PNG/JPEG, ≤ 256 KiB each, long side ≤ 1280, short side ≥ 480, names `[A-Za-z0-9._-]`, not starting with `.` or `-` |
| dossier.json | ≤ 1.5 MiB, byte-identical to `buildDossier` output |
| symlinks | none anywhere in game/ |

**Dossier size trap:** if the dossier embeds screenshots as base64 (likely), 4 × 256 KiB of images is
about 1.37 MiB of base64 plus up to 160 KiB of source text, which goes over 1.5 MiB. Keep each screenshot
**≤ 180 KiB** (JPEG quality ~80–85 at 1280×720) and check the real dossier size after each build.
Smaller dossiers also win exact-tie breaks.

### 1.5 Originality
- No CS names or look-alikes: no "Terrorists/Counter-Terrorists", "C4", "bomb has been planted",
  "Dust/Mirage/Inferno", "AK-47/M4A1/AWP/Deagle/Glock", "de_" prefixes, CS HUD colours/layout copied 1:1,
  "Spike" (Valorant), "Defuser" as a brand name is fine generically but we use "Cutters".
- Own map layout (not a remake of any known map), own characters, own weapon silhouettes.
- Use generic genre words where needed (round, buy, plant, defuse, site); those are not owned by anyone.

### 1.6 Other
- Keep the coding-agent transcripts of **every** session that builds the game; they are uploaded with
  each submission.
- At most 5 submissions per day, 10 in total. **The last submission is the final entry**, so never let the
  last one be a regression (see §16).

---

## 2. How the judge works, and what that means for us

The judge never runs the game. It sees **the screenshots first, then a text of our source**, read in this
order: `index.html`, then JS modules in **depth-first static-import order from index.html**, then remaining
source files by path. The text is capped at **160 KiB**. Files named `*.min.js` or under `vendor/` are never read.

It compares two entries on five ranked criteria, and **the first criterion where they differ decides**:
1. Complete game (FPS view, mouse look, keyboard move, weapon fires/reloads/runs dry, bots that move/see/shoot,
   rounds that end and restart, HUD with health, ammo, round timer, score). **Screenshots and code must agree.**
2. Gunplay and movement (body hitboxes, head multiplier, recoil + spread punishing movement, acceleration,
   crouch, map collision, stopping to aim pays).
3. Tactics (objective beyond killing, money per round, buy menu, several weapons, ≥ 1 grenade, bots that follow
   routes, hold positions and react to sight **and sound**).
4. Map and look (original map with lanes, corners, sightlines; chosen palette; readable scene; own art).
5. Code (one job per module, fixed-step sim apart from rendering, no per-frame allocations in hot loops,
   state in one place, no duplication, no dead code).

Consequences, in priority order:

1. **Every feature must be provable in code the judge actually reads.** Keep all game source under
   **~150 KiB** so nothing is truncated. Never hide game logic in `*.min.js` or `vendor/`; unseen code
   counts as "a screen with no code behind it".
2. **Put a factual "Reviewer's map" comment at the top of index.html** (≤ 2.5 KiB): one line per criterion item,
   naming the file and function that implements it. Example lines:
   `Head ×4 / limbs ×0.75 damage — weapons.js applyHit()`;
   `Spread grows with speed, shrinks when crouched — weapons.js computeSpread()`;
   `Bots hear gunshots and footsteps — bots.js onNoise()`.
   Only list things that really exist. No pleading or instructions to the judge ("pick this entry"); those
   read as manipulation and cost credibility. Facts only.
3. **Name functions after the criteria vocabulary**: `computeSpread`, `applyRecoil`, `accelerate`, `applyFriction`,
   `setCrouch`, `collideCapsule`, `canSee`, `onNoise`, `followRoute`, `holdAngle`, `plantCharge`, `defuseCharge`,
   `awardRoundMoney`, `openBuyMenu`, `throwGrenade`. The judge skims; matching words help it find things.
4. **Import order = reading order.** In `main.js`, import the most important systems first:
   `config → state → sim (physics, weapons) → bots → rounds/economy → hud → render/art → audio`.
5. **Screenshots must each prove criteria visually** (HUD fully visible, a bot in view, buy menu, objective).
   See §13.
6. **Code criterion is cheap to win** if we design for it from day one (see §5). Most rival entries will
   have one 3,000-line file with `new Vector3()` in every update.

---

## 3. Scope: what "best" means here

Target a game that hits **every item in criteria 1–3 fully**, looks distinctive in four screenshots, and has
clean code. Do not chase extras that the judge cannot see (netcode, mobile, settings depth, many maps).

**In scope (must ship):** one map, 5v5 (player + 4 bot teammates vs 5 bots), attack/defend with a planted
charge, economy and buy menu, 7 guns + armor + 3 grenades + cutters, bots with routes, holds, sight, hearing,
team callouts, full HUD with radar, killfeed, scoreboard, round/match flow with side swap, procedural art and
audio, title screen, pause menu with sensitivity/FOV/volume.

**Out of scope (do not build):** multiplayer, extra maps, mobile/touch, gamepad, wall penetration (optional
stretch only if budget allows), ragdolls, save files, localisation.

---

## 4. Game design

### 4.1 Setting and palette
Brinehold is an abandoned salt-evaporation works on a coast at dusk. Palette (keep it strict):
- Salt white / bleached concrete `#e8e2d6`, `#cfc6b4`
- Oxidised copper teal (pipes, trims, defender colour) `#2f8f86`
- Sodium-lamp amber (lights, attacker colour) `#f0a03c`
- Rust `#9a4a2a`, dark steel `#3a3f46`
- Dusk sky gradient violet → peach `#2b2140` → `#f2a27a`, low warm sun, cool teal fill light.
Teams read instantly by colour: **Strand** (attackers, amber armbands/visors) vs **Bastion** (defenders, teal).

### 4.2 Teams, objective, names
- Attackers: **Strand**. Defenders: **Bastion**.
- Objective device: **Fuse Charge** ("the Fuse"). Carried by one attacker (shown on radar and HUD).
- Plant: hold E for 3.0 s inside a site zone while standing still or crouched. Fuse timer 40 s with an
  accelerating beep and a pulsing amber light.
- Defuse: hold E for 7 s, 3.5 s with **Cutters**. Moving or taking damage cancels.
- Sites: **Pans** (north, open evaporation pans with low walls) and **Boiler** (south, indoor boiler hall).

### 4.3 Round and match flow (`rounds.js`)
Phase machine: `buy (12 s, frozen in spawn, can turn and buy) → live (1:45) → [planted (40 s)] → post (5 s) → next round | matchEnd`.

Win conditions:
- Strand wins: all Bastion dead, or Fuse detonates.
- Bastion wins: all Strand dead before plant, round timer expires before plant, or Fuse defused.
- Plant with all Bastion still alive: round continues; killing all Strand after a plant does **not** win, the
  Fuse must still be defused.

Match: first to **7** round wins. Sides swap after round 6 (money reset to start). Match-end screen with
MVP and "Play again". After the player dies: spectate a living teammate (camera attaches to their eyes),
Space cycles. This keeps rounds watchable and shows bot behaviour.

### 4.4 Economy (`economy.js`, numbers in `config.js`, deliberately not CS's)
- Start 900 credits, cap 12,000.
- Round win: 3,000 (elimination/time), 3,300 (detonation/defuse).
- Loss: 1,500, +400 per consecutive loss, max 3,100. Reset after a win.
- Kill reward by class: pistol 250, SMG 550, shotgun 750, rifle 250, marksman 100.
- Plant: +300 to the planter, +600 to every Strand player if the round is lost after a plant.
- Bots buy with team logic: **eco** (< 2,000 team avg: pistols/armor), **force** (after 2 losses or match point),
  **full buy** (rifle + armor + 1–2 grenades). Show the decision in the killfeed as a radio line
  ("Strand: saving this round").

### 4.5 Arsenal (all in a data table in `config.js`)
| Slot | Name | Class | Price | Dmg | Head×4 | RPM | Mag/Reserve | Notes |
|---|---|---|---|---|---|---|---|---|
| 2 | **Wren** | pistol | free | 28 | yes | 380 semi | 15/45 | default |
| 2 | **Mako .45** | pistol | 700 | 52 | yes | 220 semi | 7/28 | punishing spread on move |
| 1 | **Hornet** | SMG | 1,250 | 24 | yes | 850 | 30/120 | good while moving, short range falloff |
| 1 | **Breaker** | shotgun | 1,100 | 9 × 9 pellets | yes | 70 pump | 6/30 | shell-by-shell reload |
| 1 | **Talon** | rifle | 2,700 | 34 | yes | 600 | 30/90 | strong vertical-then-sideways pattern |
| 1 | **Gavel** | rifle | 3,000 | 31 | yes | 660 | 25/75 | tighter pattern, lower damage |
| 1 | **Longbow** | marksman | 4,500 | 112 | yes | 40 bolt | 5/20 | RMB scope 2 levels, unscoped is wildly inaccurate |
| 3 | **Cutlass** | knife | – | 40/65 | – | – | – | melee |
| 4 | **Shard** | frag grenade | 300 | ≤ 98 falloff | – | – | 1 | bounces, 1.6 s fuse |
| 4 | **Veil** | smoke | 300 | – | – | – | 1 | 15 s cloud, **blocks bot vision** |
| 4 | **Glare** | flash | 200 | – | – | – | 2 | blinds by view angle, bots too |
| – | Plate vest | armor | 650 | | | | | 50 % damage absorption body |
| – | Plate + helm | armor | 1,000 | | | | | helm cancels the head bonus partially |
| – | **Cutters** | defuse kit | 400 | | | | | Bastion only |

Damage multipliers: head ×4, chest/stomach ×1, arms ×0.9, legs ×0.75. Armor: body damage × armorRatio
(0.5) to health, rest to armor; helm reduces head damage to ×(4 × 0.6). Range falloff per weapon
(`dmg × falloff^(dist/25 m)`).

### 4.6 Controls (`input.js`, use `event.code` so AZERTY works)
WASD move, mouse look, LMB fire, RMB scope/alt, R reload, Space jump, **Shift walk** (silent, accurate),
**C or Left Ctrl** crouch (Ctrl+W cannot be blocked, so C is the documented key), 1–4 slots, Q last weapon,
mouse wheel cycle, G drop weapon, E plant/defuse/pick up, B buy menu (buy phase or in spawn zone within
20 s of round start), Tab scoreboard, Esc pause. Pointer Lock via `canvas.requestPointerLock({ unadjustedMovement: true })`
with a fallback call without options. Resume `AudioContext` on the same click.

---

## 5. Architecture

### 5.1 Principles (these are also judge criterion 5)
- **One state object** (`state.js`) holds everything that changes: players/bots, round, economy, grenades,
  dropped weapons, noise events, killfeed. Systems are functions `update(state, dt)`; they hold no hidden state.
- **Fixed-step simulation at 64 Hz** (`TICK = 1/64`) with an accumulator in `main.js`, max 5 ticks per frame.
  Rendering runs every animation frame and **interpolates** between previous and current positions (`alpha`).
  Mouse look is applied per frame to the camera for responsiveness; the sim reads view angles at each tick.
- **No allocations in hot loops.** Module-level scratch vectors (`const _v1 = new Vector3()`), object pools for
  tracers, decals, particles, sounds, grenades, noise events (ring buffer). No `.map/.filter/.forEach` with
  new closures per frame, no template strings for the HUD per frame: **HUD writes the DOM only when a value
  changed** (cache last value per field).
- **Data in `config.js`, logic elsewhere.** Weapons, economy, timings, bot difficulty, palette.
- **Render layer reads state, never writes it.** Sim never touches meshes.
- Deterministic seeded RNG (`rng.js` or inside `math.js`, mulberry32). Used by sim, bots and FX, so autoplay
  tests and screenshot scenarios are reproducible.
- `?autoplay=1&speed=8` runs bots-only matches at N sim ticks per frame. It proves the sim/render split and
  powers the smoke test.

### 5.2 Files and byte budgets (total source target ≤ 150 KiB, hard cap 160 KiB)
Import order in `main.js` follows this table top to bottom (it is the judge's reading order).
Visual quality is a top priority, so art has a large share (ART.md §11); gameplay code must be compact.

| File | Job | Budget |
|---|---|---|
| `index.html` | Reviewer's map comment, import map, HUD/menus markup, CSS | 10 KiB |
| `js/main.js` | boot, fixed-step loop, wiring, autoplay/scenario/cam params | 4 |
| `js/config.js` | all tunables: weapons, economy, timings, palette, material presets, bot skill | 8 |
| `js/state.js` | `createState()`, `createAgent()`, reset helpers | 3 |
| `js/math.js` | scratch vectors, RNG, ray–AABB slab, ray–sphere/capsule, clamp/lerp/damp, springs | 4 |
| `js/input.js` | keyboard/mouse/pointer lock → `state.input` | 2.5 |
| `js/physics.js` | `accelerate`, `applyFriction`, gravity, jump, `setCrouch`, `collideCapsule` vs AABBs, step-up | 6 |
| `js/weapons.js` | fire, `computeSpread`, `applyRecoil` (pattern + recovery), reload, switch, `traceShot`, `applyHit` | 9 |
| `js/grenades.js` | throw arcs, bounce, frag damage, smoke volumes, flash blindness | 5 |
| `js/nav.js` | waypoint graph, auto-linking, A* with reused buffers | 3.5 |
| `js/bots.js` | bot brain: FSM, routes, holds, `canSee`, `onNoise`, aiming, buying, comms | 14 |
| `js/rounds.js` | phase machine, win checks, `plantCharge`, `defuseCharge`, side swap, spectate | 6.5 |
| `js/economy.js` | `awardRoundMoney`, kill rewards, `buyItem` (shared by player and bots) | 3 |
| `js/map.js` | Brinehold layout data (boxes, kit pieces, props, decals, lights, zones, nav, callouts) | 10 |
| `js/render.js` | renderer, cameras, interpolation, resize, pass order | 2.5 |
| `js/art/*.js` | post, lighting, materials, geo, sky, characters, weapons-art, viewmodel, fx (ART.md §11) | 44.5 |
| `js/hud.js` | HUD fields, crosshair from spread, radar, killfeed, buy menu, scoreboard, banners | 7 |
| `js/audio.js` | WebAudio synth: shots per weapon, footsteps, reload, beeps, explosion; 3D panners | 5 |
| `js/scenarios.js` | 4 named deterministic setups for screenshots (§13), ~60 lines | 2 |
| **Total** | | **~149.5 KiB** |

Budgets are ceilings. Write compact, readable code (short functions, data tables instead of repeated code, no
banner comments, no commented-out code, JSDoc only where types are unclear). Run `tools/check-budget.mjs`
after every milestone (it fails above 150 KiB). If over, cut verbosity first, then the lowest-value polish.
Never cut a criterion feature, and never move code or art into non-source files to dodge the budget: the look must
come from code the judge can read.

### 5.3 Core types (plain objects, created once)
```js
// agent (player and bots share this shape and the same physics/weapon code)
{ id, team:'strand'|'bastion', isBot, alive, hp, armor, helm, money,
  pos:Vector3, prevPos:Vector3, vel:Vector3, yaw, pitch, crouch:0..1, onGround,
  weapons:[slot0..slot4], active, ammo:{mag,reserve}, reloadT, nextFireT, shotsFired, recoil:{pitch,yaw},
  spreadBloom, flashT, hasFuse, hasCutters, plantT, defuseT, brain /* bots only */ }
```
Player and bots **must** go through the same `physics.step`, `weapons.tryFire`, `economy.buyItem`. That removes
duplication and means bots obey the same spread rules (so they visibly stop to shoot).

---

## 6. Movement (`physics.js`)
- Quake-style ground model: `applyFriction` (friction 5.5, stop speed 1.9 m/s) then `accelerate(wishDir, wishSpeed, accel=10)`.
  Air accel 1.2, limited air control. Gravity 15 m/s², jump velocity 4.8 m/s. No bunny-hop gain (cap speed after landing).
- Max speed depends on active weapon (knife 6.0, pistol 5.7, SMG 5.6, rifle 5.1, marksman 4.6 m/s).
  Walk ×0.52, crouch ×0.34. Scoped ×0.6.
- Capsule: radius 0.32 m, height 1.80 standing / 1.25 crouched, eye 1.62 / 1.12. Crouch transition is smoothed
  (0.12 s), and you cannot stand up under a ceiling (probe before uncrouch).
- Collision: capsule approximated as a vertical cylinder vs world AABBs; resolve along the axis of least
  penetration, iterate 3 times; step-up up to 0.4 m on ground; slide along walls. Map is axis-aligned boxes,
  plus ramps as stacked thin steps (keep everything AABB, no triangle collision).
- Footsteps: running above 0.6 × max speed on ground emits a step sound and a **noise event** every 0.38 m·s⁻¹-scaled
  stride; walking and crouching are silent. Landing from > 1.2 m emits noise.

## 7. Gunplay (`weapons.js`)
- **Hitscan** `traceShot(origin, dir, maxDist, shooter)`: ray vs world AABBs (slab test, nearest t), then ray vs each
  enemy and teammate hitbox set (friendly fire off by default, setting in config). Closest hit wins.
- **Hitboxes** per agent rebuilt each tick from pos/crouch/yaw: head sphere (r 0.14 at eye height + 0.05),
  chest capsule, stomach capsule, two arm capsules, two leg capsules. The `hitgroup` picks the multiplier.
- **Spread (`computeSpread`)**, in radians, recomputed every tick:
  `base(stand|crouch) + move × clamp(speed / maxSpeed) + air(if !onGround) + bloom`, where bloom adds per shot and
  decays exponentially. First-shot accuracy is near-perfect only when speed < 0.3 × max and on ground. This is the
  "stopping to aim pays" rule; counter-strafing works naturally because friction + opposite accel stops you fast.
- **Recoil (`applyRecoil`)**: each automatic weapon has a fixed **spray pattern** (array of `[pitch, yaw]` per shot index,
  ~30 entries, authored as an original shape) plus small random jitter. Aim punch moves the bullet direction fully;
  the camera shows ~50 % of it (view kick), recovering over 0.3–0.45 s after the trigger is released. The shot index
  resets when recovered.
- Reload: timed per weapon; reload cancels on switch; shotgun reloads shell by shell and can be interrupted by firing.
  Empty mag = dry-fire click sound and auto-reload prompt. Reserve can run out (criterion 1: "runs out of ammunition").
- Shotgun: 9 pellets, each its own trace, sharing one spread cone.
- Marksman: scoped FOV 40° and 15°, scope overlay in HUD, unscoped spread huge, scoped spread tiny when still.
- Knife: short sphere sweep, backstab bonus.
- Feedback: hit marker (white body, red head), headshot "ding" sound, damage numbers off by default, blood-free
  impact (spark + dust puff in salt colour, bots flash briefly). Killfeed shows a head icon on headshots.
- Gunshot emits a noise event with weapon-specific radius (pistol 30 m, rifle 45 m).

## 8. Grenades (`grenades.js`)
- Throw with LMB (full) / RMB (lob) from slot 4. Physics: projectile with gravity, AABB bounce (restitution 0.45,
  friction), rest detection. Pooled.
- **Shard (frag):** explodes after 1.6 s: damage falls off linearly to 0 at 6 m, blocked by line of sight (ray to chest),
  armor applies. Camera shake, explosion FX, loud noise event.
- **Veil (smoke):** on rest, spawns a smoke volume (sphere r 3.2 m, grows in 1 s, lasts 15 s) rendered as pooled billboard
  puffs. `canSee` treats ray–sphere intersection with an active smoke as blocked. Bots path through but cannot see through.
- **Glare (flash):** pops after 1.4 s; blind duration = f(distance, angle between view dir and flash, LOS). HUD white-out with
  decay; blinded bots stop firing accurately and back off.

## 9. Bots (`bots.js`, `nav.js`)
This is the biggest differentiator in criterion 3. Every behaviour named here should exist as a named function.

### 9.1 Navigation
- `map.js` defines ~70 named waypoints with **callouts** (e.g. `StrandYard`, `Conveyor`, `ConveyorEnd`, `PansFront`,
  `Pumphouse`, `PumpStairs`, `Culvert`, `CulvertExit`, `BoilerDoor`, `BoilerHall`, `BastionCourt`…), plus per-node flags
  (`cover`, `holdYaw`, `site:'pans'|'boiler'`).
- `nav.js` auto-links nodes at load when a capsule-sized sweep between them is clear (ray tests at knee and chest height)
  and allows explicit extra links. A* with preallocated arrays (`gScore`, `cameFrom`, open list as binary heap of ints).
- Path following: steer to next node, accept within 0.6 m, smooth by skipping to the farthest visible node, simple
  separation from teammates so they do not stack in doorways.

### 9.2 Brain (FSM per bot, plus team strategy)
States: `buy → followRoute → holdAngle → engage → investigate → plant / defuse / guardFuse → retreat`.
- **Team strategy at round start** (`pickStrategy`): Strand picks one of: rush Pans, rush Boiler, split (2 Conveyor + 3 Culvert to Pans),
  default (spread across lanes, then commit to the site with least contact after 35 s). Bastion assigns anchors: 2 Pans,
  2 Boiler, 1 Pumphouse rotator. Each plan is a list of node names per bot. Plans are data in `map.js`.
- **Routes:** `followRoute` walks the bot's node list; at nodes flagged `cover` it slows to walk speed (quiet) and checks corners
  ("pie" by sweeping yaw over `holdYaw` ± 40°).
- **Holds:** `holdAngle` makes defenders crouch or stand at anchor nodes, aiming at the node's `holdYaw` with small idle shifts,
  re-peeking after a contact.
- **Sight:** `canSee(bot, target)`: within FOV 110°, range 60 m, ray to target head and chest against world AABBs and smokes,
  not blind. Scan budget: each bot checks enemies every 2nd tick (staggered) to keep CPU low.
- **Reaction & aim:** reaction delay 200–380 ms by difficulty before first shot; aim is a damped spring towards the target's
  chest or head (head chance by skill) with error that shrinks while the target stays visible; bots **stop or crouch before
  firing** a rifle and burst-fire (3–5 shots) at range, spray up close. Because they use `computeSpread`, the rule is visible in code.
- **Hearing:** `onNoise(bot, noise)`: noise events (gunshot, footsteps, reload, plant, defuse start, grenade bounce) within their
  radius set `lastKnown` and switch to `investigate` (turn, pre-aim, approach cautiously) if not engaged. Hearing a defuse makes Strand
  bots rush the Fuse.
- **Memory & comms:** `lastKnown` decays after 6 s. When a bot spots an enemy it **calls it out** to teammates with the nearest callout;
  teammates' `lastKnown` updates and a radio line appears in the killfeed ("Bastion-2: two at Culvert"). Defenders rotate on calls.
- **Objective:** the Fuse carrier avoids leading the push, plants on site when the site is clear or covered; others guard the Fuse
  post-plant from hold nodes facing approach routes. Bastion retakes together (wait for 2+ teammates unless time < 15 s),
  then one defuses while others cover.
- **Grenades:** each strategy may include 1–2 utility throws from fixed lineup nodes (smoke at Conveyor end, flash over Boiler door) and
  reactive frags at the last known position.
- **Buying:** uses `economy.buyItem` with the team buy decision.
- Difficulty presets (Recruit / Regular / Veteran) change reaction, aim error, head chance and spray control. Default Regular.

## 10. The map: Brinehold (`map.js`)
Original three-lane layout about 110 m × 80 m. Design for clear sightlines, cover, and corners worth holding.

```
            N
   [Strand Yard]  ---- Conveyor (long open lane, raised belt, 45 m sightline) ---->  [PANS site]
        |                                                                           ^   (evaporation pans,
        |---- Pumphouse (mid: stairs, window overlooking Pans approach, short angles)--|    low salt walls,
        |                       |                                                       pump tower)
        |                  Mid connector to Bastion Court (defender rotate)
        |---- Culvert (tight concrete tunnel, 1 corner, water channel) ---> [BOILER site]
                                                                           (indoor hall, boiler, catwalk)
                                         [Bastion Court] (defender spawn, between the sites, 12-15 s rotate)
```
Rules for the blockout:
- Attackers reach each site in ~22–28 s running, defenders ~8–10 s; rotation through Bastion Court ~14 s.
- Each site has 2 entrances from attacker side + 1 from defender side, 3+ cover pieces, one elevated position, and
  a plant zone drawn on the floor (amber hazard paint) for readability.
- Long sightline (Conveyor) favors the Longbow; Culvert favors SMG/shotgun; Pumphouse rewards rifles at mid range.
- Height variety: Pumphouse stairs, Boiler catwalk, Pans pump tower, stacked salt-bag walls.
- Spawn zones are buy zones. Out-of-bounds sealed with tall walls and cliffs; the sea and salt flats visible beyond
  as backdrop (non-collidable low geometry + fog).
- Data format: `boxes: [[x,y,z, sx,sy,sz, materialId], ...]`, `zones` (spawns, buy, sites), `nodes`, `plans`, `lights`, `props`.
  The same box list feeds collision, rendering and the radar.

## 11. Look → see ART.md
The complete visual specification (art direction, render pipeline, lighting, shadows, image-based lighting,
procedural PBR materials, bevelled geometry kit, baked AO, characters, weapons and viewmodel, FX, sky, budgets,
performance and the visual QA loop) is in **ART.md**. Everything is generated in code at runtime; no image or
model files. Note: `PCFSoftShadowMap` is removed in r187; use `PCFShadowMap` (see ART.md §3).

## 12. HUD and menus (`hud.js`, markup/CSS in index.html)
Style: own visual language: angular panels with clipped corners, salt-white text, amber/teal team accents, monospace numerals
with `font-variant-numeric: tabular-nums`, system fonts only (`ui-monospace, Consolas, monospace`).
- Bottom-left: health (number + bar), armor + helm icon, money (with +/- change popup).
- Bottom-right: weapon name, mag / reserve, grenade icons, Fuse/Cutters icon.
- Top-centre: **score** (Strand X — Y Bastion), **round timer** (turns into the Fuse timer after plant, amber pulse),
  round number, alive-player pips per team.
- Top-left: **radar** (canvas 2D, map drawn once to an offscreen canvas, then player arrow, teammates, enemies only when
  spotted/called, Fuse marker, site letters as our names).
- Top-right: killfeed with weapon names, headshot icon, radio lines.
- Centre: **dynamic crosshair** whose gap is derived from `computeSpread` (visual proof of movement penalty), hit marker,
  directional damage arcs, plant/defuse progress bar, prompts ("Hold E to plant the Fuse").
- **Buy menu (B):** grid by category with prices, greyed when unaffordable or wrong team, shows current credits, keyboard
  shortcuts (number keys), mouse clicks. Player can buy for themselves only.
- Scoreboard (Tab): kills, deaths, headshot %, money, alive state per player, both teams.
- Banners: "Round 4 — Buy phase", "Fuse planted at Boiler", "Bastion holds the line", "Strand wins the match".
- Title screen: game logo set in CSS, controls card, difficulty choice, "Click to deploy"; world renders behind with a slow camera
  orbit. Pause (Esc): resume, sensitivity, FOV (75–100), volume, difficulty, restart.

## 12b. Audio (`audio.js`)
WebAudio only, generated at boot into `AudioBuffer`s (no files): gunshots per weapon class (noise burst + low thump + filtered
tail, different envelopes), suppressed dry-fire click, reload foley (two clicks + slide), footsteps (filtered noise, surface variants
for metal catwalk vs concrete), knife swish, grenade bounce, explosion (long low noise + sub sine), flash pop + ear ring (high sine
under a lowpass while blind), Fuse beep (accelerating), plant/defuse cues, round start/end stingers (short synth chords), UI clicks.
3D: pooled `PannerNode`s (`HRTF`, inverse distance) for world sounds; occlusion approximated by lowpass when the ray to the listener
hits a wall. Master + SFX gain from settings.

---

## 13. Screenshots (`tools/shoot.mjs` + `js/scenarios.js`)
The first file by name is the **cover** and appears publicly on the make.fun feed. Each shot must prove criteria.

| File | Content | Proves |
|---|---|---|
| `01-cover.jpg` | Live round on Conveyor at dusk: two Strand bots mid-firefight with the player, muzzle flash, tracer, rifle viewmodel, full HUD (health, ammo, timer, score, radar, killfeed with a headshot). | criteria 1, 2, 4 |
| `02-buy.jpg` | Buy phase in Strand Yard with the buy menu open, credits shown, teammates in view buying. | criterion 3 (economy, arsenal, grenades) |
| `03-fuse.jpg` | Post-plant at Boiler: Fuse beacon pulsing, Fuse timer in HUD, a Veil smoke filling the door, teammate holding an angle. | criterion 3 (objective, smoke), 4 |
| `04-roundend.jpg` | Round-end banner + scoreboard overlay over the Pans site (or a Longbow scoped view). | criterion 1 (rounds, score) |

Rules:
- Real renders of the game's code, never edited, cropped in an editor, composited or upscaled.
- `scenarios.js` sets up a deterministic moment through the game's normal systems (seeded RNG, placing agents, giving weapons,
  advancing the sim N ticks, then pausing). It is honest staging, small (≤ 2 KiB), and enabled by `?scenario=cover` etc.
  Do not draw anything in scenario mode that the normal game cannot show.
- Capture with Playwright Chromium at viewport **1280×720**, `deviceScaleFactor: 1`, GPU enabled
  (`--use-angle=swiftshader --enable-unsafe-swiftshader` as a fallback in headless; prefer headed with real GPU if available),
  `page.screenshot({ type:'jpeg', quality: 82 })`. Wait for 2 rendered frames after the scenario settles.
- Then check each file ≤ 180 KiB (lower quality step by step if not), dimensions exactly 1280×720.
- Make the cover beautiful: low sun backlighting, warm/teal contrast, characters readable against the background, HUD crisp.
  Iterate composition several times; it is the first thing the judge and the public see.

---

## 14. Tooling (`tools/`, not copied to output)
**These tools already exist in the repo and were tested** (vendor check, gate check including negative cases,
budget, smoke test and screenshots with WebGL in headless Chromium). Use them as they are; the descriptions below
are their spec. `smoke.mjs` and `shoot.mjs` depend on the `window.__saltline` contract defined in AGENTS.md.
Shared helpers: `tools/serve.mjs` (static server) and `tools/browser.mjs` (Playwright launch, error and
network capture).

- `vendor-three.sh` — §1.2.
- `check-gate.mjs` — re-implements the gate checks locally: file/dir counts, sizes, no symlinks, path lengths, one import map
  pointing to `./three.module.min.js`, three files byte-equal to npm, every `src`/`href` in index.html resolves inside game/,
  every static import/export-from specifier resolves to a file inside game/ (parse with `acorn` as a dev dependency to
  match "read as AST"), screenshot rules (count, names, bytes, dimensions via PNG/JPEG header parse), dossier size.
- `check-budget.mjs` — runs `main.ts` into a temp dir, reads `dossier.json`, reports source bytes vs 160 KiB, which files
  are in the text and in what order, whether anything was cut, and the dossier's total bytes.
- `smoke.mjs` — Playwright: serve `game/` with a tiny static server (`node:http`), open `?autoplay=1&speed=8`, fail on any
  console error or any request leaving localhost, wait for `window.__saltline.matchOver === true` (expose a read-only
  status object for tests), assert ≥ 7 rounds played, both win types seen over 3 seeds, average frame time sane.
- `shoot.mjs` — §13.
- `package.json` (repo root) with `"type": "module"` and devDependencies `playwright`, `acorn` only. `main.ts` must not import them.

---

## 15. Milestones (each ends with gate check + budget check + smoke test + a commit)

**M0 — Pipeline (½ day).** Repo, MIT license, kit files, three vendored, index.html with import map and a lit spinning box,
`main.ts` from the starter, tools scaffolding. `node main.ts` with `MAKEFUN_OUTPUT_DIR=/tmp/out` produces a dossier;
`check-gate` passes. Exit: valid output locally.

**M1 — Move in the map (1 day).** `state`, fixed-step loop with interpolation, input + pointer lock, physics (accel, friction,
jump, walk, crouch, capsule collision, step-up), Brinehold blockout from box data with flat colours, spawns, zones, nav nodes
drawn in a debug overlay (debug code removed before submission). Exit: walk every lane, no falling through, no snagging.
Also set up the final render foundation now, so art is never bolted on at the end: HDR target + final tone-map
pass (ART.md §2), sun with fitted shadow map + hemisphere + PMREM environment (§3), and `bevelBox` with
world-space UVs (§4) used for the blockout from day one.

**M2 — Gunplay (1–2 days).** Weapons table, hitscan vs world and hitboxes, spread, spray patterns, view kick, reload, ammo,
switching, viewmodel, muzzle flash, tracers, decals, sounds, hit markers, HUD health/ammo, crosshair from spread. Static dummy
bots to shoot. Exit: headshot ×4 verified, moving shots visibly miss, standing taps hit.

**M3 — Complete game loop (2 days).** Bots with nav, routes, holds, sight, reaction, aiming, shooting, death; 5v5; round phases,
elimination and time win, timer, score, match end and restart, spectate on death; title + pause. **This is criterion 1 complete.**
Exit: smoke test plays full matches with no errors. Take rough screenshots. **Submission #1** (confirms the real gate and gives a
first provisional rate).

**M4 — Tactics (2 days).** Fuse carry/plant/defuse/detonate, Cutters, all win conditions, economy with loss streak, buy menu,
full arsenal, armor/helm, three grenades, bot buying, team strategies, hearing, callouts, rotations, retakes, utility lineups,
radar, killfeed, scoreboard. Exit: criteria 1–3 all present; Reviewer's map lists them. **Submission #2.**

**M5 — Look and sound (3 days, the most important polish milestone).** Everything in ART.md, in its priority order:
pipeline and post, lighting with IBL and shadows, procedural materials, bevelled geometry kit with baked AO, detail
density, sky and fog, characters, weapons and viewmodel, FX. Run the art-review skill after every step. Audio pass,
HUD styling, title screen. Performance pass (ART.md §12). Final-quality screenshots.
**Submission #3.**

**M6 — Code quality and judge readability (1 day).** Audit hot loops for allocations, remove dead code/debug code, merge any
duplicated logic (player/bot paths), confirm state lives only in `state.js`, check module order, tighten to ≤ 150 KiB, finalise the
Reviewer's map (verify each line points to a real function name). **Submission #4.**

**M7 — Playtest and final (1 day).** Manual play of 3 full matches per side at each difficulty; fix balance (bots must win some
rounds against a decent player on Regular, never feel aimbotty); verify on a fresh Chrome profile from a static server
(`npx http-server game` or `python3 -m http.server`) with DevTools Network tab showing only same-origin requests. Final
screenshots, final submission.

---

## 16. Submission strategy
- 10 submissions total, 5 per day. Planned: #1 at M3, #2 at M4, #3 at M5, #4 at M6, #5 final. Keep 5 in reserve for fixes.
- After each submission, record the provisional rate in `README.md` → "Submission log" (date, commit, rate, what changed).
  The provisional rate is noisy (12 games); treat differences under ~0.08 as noise.
- **The final entry is the last submission.** If an experiment scores worse, resubmit the best commit unchanged as the last one.
  Tag every submitted commit (`sub-1`, `sub-2`, …).
- Each submission needs the transcripts of the sessions that built it. Keep them organised per session.
- Before each submission run, in this order: `tools/vendor-three.sh` check (cmp), `check-gate`, `check-budget`, `smoke`,
  then `node main.ts` into a clean dir and inspect `dossier.json` size.

---

## 17. Quality checklist before the final submission
Criterion 1 — complete game
- [ ] Pointer-lock mouse look, WASD, jump, walk, crouch work; Esc pauses, click resumes.
- [ ] Every gun fires, reloads, runs dry (mag and reserve), dry-fire click, auto-switch prompt.
- [ ] Bots move, see, shoot, take damage, die; teammates fight on your side.
- [ ] Rounds end by elimination, time, detonation, defuse; next round starts; match ends at 7; restart works.
- [ ] HUD always shows health, ammo, round timer, score. All four visible in the cover screenshot.

Criterion 2 — gunplay/movement
- [ ] Head ×4, limb multipliers, armor/helm math, range falloff.
- [ ] Spread from speed/air/crouch/bloom; crosshair shows it; spray patterns + recovery; view kick.
- [ ] Acceleration/friction, crouch with ceiling check, capsule collision, step-up, walk is silent.

Criterion 3 — tactics
- [ ] Fuse plant/defuse with Cutters; site zones visible.
- [ ] Money per round with loss streak, kill rewards by class, buy menu, 7 guns, 3 grenades, armor.
- [ ] Bots: strategies, routes, holds, sight (FOV, LOS, smoke), hearing, memory, callouts, rotations, retakes, buying.

Criterion 4 — look
- [ ] Palette consistent; teams readable at a glance; signs and floor paint guide the eye; no z-fighting; no stretched textures.

Criterion 5 — code
- [ ] Modules match the §5.2 table; no file over ~20 KiB; no `new` of math objects inside update functions; pools everywhere;
      HUD dirty-checking; one state object; no dead/debug code; consistent naming; no duplicated player/bot logic.

Gate
- [ ] `check-gate` passes; three files byte-identical; one import map; no network; 4 screenshots ≤ 180 KiB at 1280×720;
      dossier ≤ 1.5 MiB; `vendor/makefun-threejs.ts` unchanged (`git diff` against the kit copy is empty); LICENSE present.

---

## 18. Common mistakes to avoid
- Using `three/examples/jsm/...` addons (adds files and import-map entries; avoid entirely).
- `data:` favicon or any remote font in index.html.
- Editing `vendor/makefun-threejs.ts` (even line endings: make sure git does not convert CRLF; add a `.gitattributes`
  with `* -text` for `vendor/` and `game/three.*.min.js`).
- Writing `main.ts` with TS-only syntax that Node's type stripping rejects, or importing npm packages from it.
- Source over 160 KiB, so the judge never sees the bots or the economy.
- A HUD element in screenshots with no code behind it, or a Reviewer's map line naming a function that does not exist.
- Allocating vectors in `update()` "just this once"; `Array.prototype.filter` in the bot loop.
- Bots that see through smoke or walls, or that snap-aim instantly (looks fake and contradicts "react to what they see").
- Copying any real game's names, map layout or HUD layout.
- Screenshot that is dark, empty, or missing the HUD.
- Letting a worse build be the last submission.
