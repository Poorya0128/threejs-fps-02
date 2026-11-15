---
name: art-review
description: Visual QA loop for every visual change (lighting, materials, geometry, characters, weapons, FX, HUD). Captures fixed lookdev views and the screenshot scenarios, then checks them against ART.md §13 by looking at the images. Use it before and after each art step.
---

# Art review

ART.md is the spec. Realism comes from light, materials and edges first (ART.md intro); review in that order.

## Set up the views (once the map exists)
Edit `tools/lookdev-views.json` with 10–14 stable views that cover: each lane looking toward its site at standing
eye height, each site from both entrances, one interior (Boiler hall), one view with sun behind the camera and one
against the sun, one close-up of a wall corner (materials and AO), one view with 3 bots at 10/25/40 m, one with the
viewmodel visible (`--hud` run). Keep names and coordinates fixed so runs are comparable. Each entry:
`{ "name": "...", "cam": [x, y, z, yawDeg, pitchDeg], "note": "what to judge here" }`.

## Loop
1. Before changing anything: `node tools/lookdev.mjs` → note the run folder (baseline).
2. Make one focused change (one ART.md section or sub-step).
3. `node tools/lookdev.mjs` again.
4. **Open every new image** (and the baseline of the same view) and go through ART.md §13 item by item.
   Write the result as a short table: view → failures found. Be strict: "looks fine" is not a result.
   Useful checks:
   - Convert mentally to greyscale: can you tell concrete, metal, wood, cloth apart? If not, roughness and
     pattern variation are too low.
   - Find the darkest shadow: is it blue-grey with visible detail? Find the brightest non-emissive surface:
     is it below white?
   - Look at every object's base: is there contact darkening? Any gap or float?
   - Look at edges: do bevels catch a highlight?
   - Look at the horizon: does the fog blend distant geometry into the sky colour?
5. Fix the failures, repeat from 3. Keep the change only if the images are better than the baseline.
6. Check `report.txt` for draw calls and triangles against ART.md §12. Frame times from headless software GL
   are not meaningful; ask the user to check FPS in real Chrome when a change is heavy.
7. Report to the user with 2–4 before/after image paths and the remaining known issues.

## Common fixes
- Flat, fake look → bevels missing, env map missing or too weak, roughness uniform.
- Muddy/grey image → exposure too low or tone mapping fighting the grade; adjust exposure first, grade second.
- Washed out → bloom threshold too low or fog too dense near the camera.
- Plastic metal → metalness < 1 or roughness too uniform; add noise-driven roughness and edge wear.
- Floating props → AO bake not reaching them (floor not subdivided near them) or shadow normalBias too large.
- Noisy shimmer at distance → add mipmaps to noise textures, lower noise frequency with distance.
- Characters vanish in shadow → raise hemisphere fill slightly or add rim from env; check team colour contrast.
