# ART.md — Visual specification for SALTLINE (everything generated in code)

**Read this before any visual work.** It overrides the art notes in PLAN.md §11 where they differ.

Goal: screenshots that look close to a real place at a real time of day, with clean, deliberate elements, built
**entirely from code at runtime**: no image files, no model files, no three.js addons, nothing over the network,
and all of it inside the 160 KiB judge-text budget (art gets ~44 KiB, see §11).

Realism in a browser game comes mostly from **light, materials and edges**, not from polygon count. Spend effort in
this order, because each step gives more realism per byte than the next:

1. Lighting: sun + sky + image-based reflections + soft accurate shadows + ambient occlusion.
2. Post-processing: HDR, tone mapping, bloom, colour grade.
3. Materials: roughness and colour variation, normal detail, wear at edges, dirt at the bottom of walls.
4. Edges: **every box is bevelled**. Hard 90° edges with flat shading are what makes a scene look fake.
5. Detail density: trims, pipes, cables, signs, decals, props. No wall surface larger than ~4 m without a break.
6. Characters, weapons, FX animation.

Verified in the vendored r187 build: `PMREMGenerator`, `ExtrudeGeometry`, `LatheGeometry`, `TubeGeometry`,
`CapsuleGeometry`, `WebGLRenderTarget` (with `samples` for MSAA), `DepthTexture`, `HalfFloatType`, `InstancedMesh`,
`onBeforeCompile`, `MeshPhysicalMaterial`, `AgXToneMapping`, `NeutralToneMapping`, `ACESFilmicToneMapping`.
**`PCFSoftShadowMap` is removed in r187** (it logs a warning and falls back). Use `PCFShadowMap` and `shadow.radius`,
or `VSMShadowMap` if PCF looks too hard.

---

## 1. Art direction (lock this first)

- Place: Brinehold, a salt-evaporation works on a cold coast, 25 minutes before sunset, clear sky with thin high cloud.
- Mood: quiet, dusty, warm light on cold materials. Long shadows across the yard. Indoors are darker and cooler,
  lit by sodium lamps.
- Reference feel (study, never copy): industrial photography of salt works and docks, golden-hour light in modern
  realistic shooters. Describe what you see in references in words in your notes, then build it from rules below.
- Palette (linear-light targets, pick sRGB swatches near these):
  - Light materials: bleached concrete `#cfc6b4`, salt crust `#e8e2d6`, plaster `#d9d2c3`
  - Mid: weathered steel `#6b6f73`, rust `#8a4a2c`, oxidised copper teal `#2f7f78`, wood `#7a5a3c`
  - Dark: asphalt `#2e2d2b`, deep steel `#30343a`, rubber `#1d1d1f`
  - Accents (small areas only): sodium amber `#f0a03c` (attackers, lamps, hazard), teal `#2f8f86` (defenders)
  - Sun colour `#ffd2a1`, sky zenith `#3a4f78`, horizon `#f2b48a`, shadow fill `#6f86a8`
- Value rule: no pure black (min ~2 % luminance in shadow after grade), no clipped white except the sun, lamp heads and
  muzzle flash. Characters must separate from the background by value, not only by hue.
- Albedo rule (physically plausible): no albedo above sRGB ~240 or below ~30. Metals use `metalness = 1` with coloured
  base, everything else `metalness = 0`.

## 2. Renderer and pipeline (`js/render.js`, `js/art/post.js`)

```
WebGLRenderer({ antialias:false, powerPreference:'high-performance', stencil:false })
setPixelRatio(min(devicePixelRatio, 1.5)); outputColorSpace = SRGBColorSpace
toneMapping = NoToneMapping on the renderer: tone mapping happens in the final post pass
shadowMap.enabled = true; shadowMap.type = PCFShadowMap
```
Frame:
1. Render the world into an HDR target: `WebGLRenderTarget(w, h, { type: HalfFloatType, samples: 4, depthTexture })`.
2. `clearDepth()`, render the viewmodel scene into the same target (own camera, FOV 54–60°, near 0.01).
3. Bloom: threshold ~1.0 in HDR, 5-level downsample/upsample chain (13-tap down, 9-tap tent up) at half resolution.
   Intensity low (0.04–0.08). It should only show on lamps, sun glints, muzzle flash, Fuse beacon.
4. Final pass (one fullscreen shader): exposure → **AgX** (or ACES; compare both on the cover, keep the better) →
   colour grade (lift/gamma/gain, warm highlights `+0.03 R`, cool shadows `+0.02 B`, saturation 0.95) →
   vignette (0.15) → very subtle grain (animated, 0.015) → output sRGB.
5. HUD is DOM on top; it is not affected by post.

Resize all targets on window resize. Keep one fullscreen triangle geometry and reuse materials. Expose
`?post=0` only if needed for debugging, then delete before shipping.

Optional, only if budget allows after everything else: SSAO at half resolution (8–12 samples, depth-only,
bilateral blur). The baked vertex AO in §4 is mandatory; SSAO is extra.

## 3. Lighting (`js/art/lighting.js`)

- **Sun**: `DirectionalLight`, colour `#ffd2a1`, intensity ~3.2, elevation 9–12°, azimuth so that the main lanes
  get long raking shadows and the cover screenshot is backlit or side-lit.
  - Shadow map 4096², orthographic camera fitted tightly to the playable bounds (~110 × 80 m) in light space,
    `shadow.bias ≈ -0.0003`, `shadow.normalBias ≈ 0.03`, `shadow.radius 2–3`. Tune until there is no acne
    on floors and no peter-panning gap under crates.
  - Only static world and characters cast; small props and FX do not.
- **Sky light**: `HemisphereLight` sky `#8aa6d1`, ground `#a4886a`, intensity ~0.35 (a fill so shadows are blue-grey,
  not black).
- **Image-based lighting (mandatory)**: build a small sky scene (the sky shader of §8 + sun disc + a dim ground
  colour), render it once with `PMREMGenerator.fromScene`, set `scene.environment`, `environmentIntensity ~0.6`.
  This gives metal and wet/smooth surfaces believable reflections. Regenerate only if the sun moves (it does not).
- **Interior areas** (Boiler hall, Pumphouse, Culvert): 6–10 `PointLight`s, sodium `#ffb062`, `distance` 10–14 m,
  `decay 2`, no shadows. Each has a visible fixture with an emissive bulb (HDR emissive 6–10 so bloom picks it up).
  Interiors also get a lower `environmentIntensity` via a per-material uniform or by using darker env on indoor
  materials (simple: indoor materials multiply env by 0.35).
- **Fake bounce**: a few large, dim, warm `PointLight`s (no shadows) placed where sun hits light floors, to lift
  the walls next to them. Two or three are enough.
- Light count ceiling: 1 directional + 1 hemisphere + ≤ 12 point lights total in the scene (shader cost).
  The muzzle flash reuses one pooled point light that is always in the scene with intensity 0 when off
  (adding/removing lights recompiles shaders).

## 4. Geometry kit (`js/art/geo.js`)

All static world geometry is generated from data in `map.js` by these builders, then merged per material.

- `bevelBox(sx, sy, sz, r)`: box with 1-segment chamfered edges (r = 0.02–0.04 m; larger 0.08 for concrete blocks).
  Normals smooth across the chamfer so edges catch light. This one function is the biggest realism win; every
  wall, crate, step, curb and frame uses it.
- World-space UVs: UV = world position projected on the face's dominant axis, scaled 1 repeat / 2 m. No stretching.
- Vertex colour channel used for **baked ambient occlusion** and **dirt mask**:
  - AO bake at load: for each merged-geometry vertex, cast 12 cosine-weighted short rays (0.8 m) against the
    world AABB list (cheap slab tests) and store occlusion. Spread the bake over the loading screen; keep it under
    ~400 ms total. Floors need enough vertices near walls for this to show: subdivide floor slabs into 1 m cells
    near walls (not in the open).
  - Dirt mask: higher near the floor (`1 - smoothstep(0, 0.6, heightAboveFloor)`) and under overhangs.
- Kit pieces (functions with parameters, composed by map data):
  - wall with baseboard trim and top cap; doorway with frame and threshold; window with frame, sill, broken glass
    shards; pillar with base and capital; stairs with nosing; railing (posts + 2 rails + toe board);
    pipe runs (`TubeGeometry` along polylines, flanges every 3 m, brackets to the wall);
    hanging cables (catenary curves); conveyor (frame, rollers instanced, belt); vents and ducts;
    corrugated sheet (sine-displaced plane); pallets; crates (bevelled with plank grooves via normal detail);
    barrels (lathe with rims); salt piles (displaced cones with noise); sandbag walls (instanced rounded boxes);
    lamp fixtures (pole + head + emissive bulb + cable); signs (plane with canvas-text texture, §6).
- Detail rules: every wall run > 4 m gets a pillar, pipe, sign, stain or trim break. Every floor area has edge
  decals (dirt, salt rime) and a few small props. Corners get debris. Clean, but lived-in.
- Instancing: anything repeated ≥ 8 times is an `InstancedMesh` (rollers, sandbags, bolts, rail posts, pallets).
- Budgets: static world ≤ 250k triangles, ≤ 60 draw calls (merged per material); props ≤ 40 draw calls.

## 5. Materials (`js/art/materials.js`): procedural PBR in shader code

Base all world materials on `MeshStandardMaterial` and inject a shared GLSL chunk with `onBeforeCompile`
(keep the injected code ≤ ~3 KiB, shared by all presets):

- **Noise source**: at startup generate 2 small tileable textures in JS (`DataTexture`, 256², RGBA8, linear,
  mipmapped, `RepeatWrapping`):
  1. FBM value noise in R, G, B at 3 frequencies + cellular/worley in A.
  2. A height-detail texture whose derivative is used as a normal map (generate the normal map from height in JS
     with a Sobel filter: that is a real tangent-space normal map from code).
- **Triplanar sampling** in world space (blend by `pow(abs(normal), 4)`), so no UV seams on any geometry.
- Per material preset (data in `config.js` → `MATERIALS`):
  `baseColor, colorVar (amount of FBM tint), roughness [min,max], metalness, normalStrength, noiseScale,
  wearColor, wearAmount, dirtColor, dirtAmount, saltRime (0..1), indoor (env multiplier)`.
- Shader effects per fragment:
  - albedo × (1 ± colorVar × fbm), large-scale tonal patches (very low frequency) so walls are not uniform;
  - roughness from fbm between [min, max]; puddle/smooth patches on floors where cellular noise is low;
  - normal perturbation from the detail normal map × normalStrength;
  - **edge wear**: use the bevel chamfer (mark chamfer vertices with a vertex attribute or use the AO channel's
    edge flag) → lighter, rougher or bare-metal colour on edges, masked by noise;
  - **dirt/salt rime**: dirt mask from vertex colour × noise → darker, rougher at the bottom of walls;
    salt rime → white crystalline crust at the bottom of outdoor walls (Brinehold identity);
  - AO from vertex colour multiplies diffuse and (half) specular.
- Presets required: concrete, plaster, painted metal (teal, amber hazard), corrugated metal, rusted steel,
  galvanised steel, salt crust ground, asphalt, tiles (procedural grid in shader: grout lines + per-tile tint),
  wood planks (procedural grain + plank grid), rubber, cloth/canvas (for characters, high-frequency weave normal),
  polymer, gunmetal, brass, glass (MeshPhysicalMaterial, transmission off, low roughness, env reflections).
- Hazard stripes, painted floor markings (plant zones, lane arrows) are done in the shader from world position
  masks or as decal quads with a procedural shader, with wear noise through the paint.

## 6. Decals and signage (`js/art/decals.js` or inside `fx.js`)

- Signs: `CanvasTexture` drawn in code: our own callout names (PANS, BOILER, CONVEYOR, CULVERT, PUMPHOUSE),
  arrows, hazard pictograms, a fictional company logo ("Brinehold Saltworks Co.", with a simple drawn emblem),
  worn by drawing noise over the paint. Text with system fonts only.
- Static decals (quads slightly off the surface with `polygonOffset`): stains, leaks under pipes, scorch marks,
  salt streaks, cracks, footpath wear on floors. 40–80 of them, placed by rules in map data.
- Dynamic bullet holes: ring buffer of 96 quads; procedural shader per surface type (concrete: dark hole + chipped
  ring + dust halo; metal: bright dented rim + dark centre; wood: splinter cross). Oriented to hit normal.

## 7. Characters (`js/art/characters.js`): semi-realistic, clean

Do not aim for photoreal faces (impossible without assets and it ends in uncanny results). Aim for **realistic
proportions, gear and materials, with faces mostly covered** (balaclava, goggles, visor). This is how modern
tactical games keep characters believable.

- Proportions: height 1.80 m, 7.5 heads tall, shoulder width 0.46 m, hips 0.36 m. Joint positions stored as data.
- Rig: hierarchy of `Object3D` bones (pelvis, spine, chest, neck, head, clavicles, upper arms, forearms, hands,
  thighs, shins, feet). Rigid parts parented to bones (no SkinnedMesh needed). Hide seams with gear (pads,
  sleeves, gloves, boots) placed over joints.
- Body parts from `LatheGeometry` profiles (torso, limbs tapered with real cross-sections) and `CapsuleGeometry`,
  12–16 radial segments, smooth normals. Each character ~8–10k triangles, all geometry shared between instances.
- Gear (each a small builder): plate carrier with 3 mag pouches and side cummerbund, belt with holster and pouches,
  helmet (lathe shell, rim, side rails, NVG mount, strap), ear protection/headset, goggles or visor, gloves,
  knee pads, boots with sole, backpack (attackers carry the Fuse in it, visible amber glow strip).
- Team identity by **silhouette + colour**, readable at 40 m:
  - Strand: desert-tan/olive fabric, soft cap or bump helmet, balaclava, amber armbands and backpack strip.
  - Bastion: slate-grey/navy fabric, full helmet with dark visor, teal shoulder patches and helmet stripe.
- Materials: cloth (weave normal, roughness 0.85, subtle colour variation per part), rubber (boots, pads),
  polymer (helmet, pouches), metal (buckles, rails), skin only on small visible areas (neck strip, if any).
- Animation (procedural, per tick values interpolated per frame):
  - locomotion: phase from distance travelled; hip sway, leg swing with knee bend, foot lift, arm counter-swing
    when not aiming; walk vs run amplitude; crouch pose blends; strafing turns the pelvis less than the chest.
  - aim: chest and head pitch to aim pitch, weapon held in a two-hand pose per weapon class (hand targets on the
    weapon model's grip and handguard, solve elbows with 2-bone IK: a short analytic function).
  - fire: small chest kick; reload: hand to magazine pouch and back; plant/defuse: kneel pose.
  - hit: short flinch on the hit part; death: rigid-body-lite fall (pelvis falls with gravity, limbs follow with
    damped springs, settle on floor via the world AABBs) then stay for the round.
- The third-person weapon is the same `buildWeapon` output at lower detail (LOD flag).

## 8. Sky, sea and distant scenery (`js/art/sky.js`)

- Sky dome shader: analytic gradient by elevation and sun angle (zenith → horizon colours of §1), Mie-like glow
  around the sun (`pow(max(dot(v, sun), 0), 8..800)` layers), thin high clouds from FBM noise lit warm on the sun
  side, sun disc HDR ~20 for bloom.
- Sea beyond the outer walls: large plane, shader with scrolling normal noise, Fresnel reflection of the sky colour,
  sun glitter path. Salt flats: pale plane with noise. Distant silhouettes: cranes, chimneys, a lighthouse, pylons
  built from simple geometry, fogged.
- Fog: custom height fog in the material chunk (denser near the ground and with distance), colour sampled from the
  horizon colour toward the sun so distant objects melt into the warm haze. Keep near-field (< 30 m) crisp.
- Atmosphere: dust motes (instanced points, 300) drifting in sunlit areas and in interior light shafts;
  fake light shafts in Boiler hall (additive, soft-edged cones from the high windows, depth-faded).

## 9. Weapons and the first-person view (`js/art/weapons-art.js`, `js/art/viewmodel.js`)

The viewmodel is on screen in every frame and every screenshot: it gets the most detail.

- `buildWeapon(spec)` composes parts from data, every part a separate mesh (so the magazine, bolt and slide can
  animate): receiver (upper/lower), barrel, muzzle device, handguard, rail, stock, grip, magazine, trigger guard,
  charging handle/bolt, sights or optic.
  - Receiver, handguard, stock and grip: `ExtrudeGeometry` from 2D `Shape` profiles **with holes** (lightening cuts,
    slots, trigger guard) and `bevelEnabled: true` (bevelSize 1–2 mm, 2 segments). Profiles are point lists in data.
  - Barrel, muzzle, scope tubes: `LatheGeometry` with real-looking profiles (steps, flutes, crowns).
  - Rails: instanced teeth. Screws and pins: tiny instanced cylinders. Magazine: curved profile extruded.
  - Optic for rifles: red-dot housing with a glass lens (physical material, slight tint) and an **emissive reticle
    drawn by a shader on the lens** that stays sharp; the Longbow gets a real scope with a scope overlay in HUD when
    zoomed.
- Designs are original: plausible modern-firearm proportions and mechanics, but no replica of a real or game gun.
  Each of the 7 guns has a distinct silhouette (bullpup vs conventional, drum vs straight mag, etc.).
- Materials: gunmetal (metalness 1, roughness 0.35–0.55 from noise, lighter edge wear), anodised aluminium,
  polymer (dielectric, roughness 0.6, stippling normal on grips), one cerakote accent colour per weapon (sand,
  olive, slate), brass for casings.
- Hands and arms: gloves with fingers (3 capsule segments each, curled per weapon pose), sleeves in team cloth with
  a cuff, watch or wrist strap. Team colour on the sleeve patch.
- Viewmodel motion (springs, all per-frame, no allocation): idle breathing; sway that lags mouse movement;
  figure-8 walk bob scaled by speed; crouch dip; jump/land offset; fire kick (back + up + slight roll) with
  spring recovery; slide/bolt cycling on fire; reload with the magazine leaving the gun, a new one entering, and
  the hand moving to it; weapon draw animation on switch; ADS for the Longbow.
- Shell ejection: instanced brass casings (pool of 40) ejected with spin, bounce on floor AABBs, fade after 4 s,
  lit by the scene. Casing tinkle sound on first bounce.
- Viewmodel lighting: it is rendered with the same environment map and lights as the world (so it darkens indoors),
  plus a very weak camera-relative fill so it never goes black.

## 10. Effects (`js/art/fx.js`)

All pooled and preallocated, all drawn with small shaders:
- Muzzle flash: 2–3 crossed quads with a procedural star/noise shader (random rotation and scale per shot),
  HDR intensity for bloom, lasting 1–2 frames, plus the pooled point light (intensity pulse 0.05 s) and a
  small smoke wisp after a burst.
- Tracers: thin stretched quads, HDR core, every 3rd bullet.
- Impacts per surface: sparks (metal, additive streaks with gravity), dust puffs (concrete/salt, soft particles
  lit by sun direction), splinters (wood), plus the decal from §6.
- Smoke grenade cloud: ~40 large soft particles per cloud, lit with a simple half-Lambert toward the sun, depth-faded
  against the scene (soft particles via the depth texture), slow turbulence and expansion. It must look dense and
  opaque enough to block vision, as the gameplay says.
- Frag explosion: fireball (noise shader, 0.3 s), shock ring, debris (instanced bits), dust cloud, light flash, camera
  shake. Flash grenade: white HDR burst, screen white-out handled in HUD/post.
- Fuse beacon: pulsing amber emissive + point light + subtle heat shimmer quad (optional).

## 11. Byte budget for art (part of the 150 KiB total)

| File | Budget |
|---|---|
| `js/art/post.js` (HDR target, bloom, final grade) | 5 KiB |
| `js/art/lighting.js` (sun, hemi, PMREM, interior lights) | 2.5 KiB |
| `js/art/materials.js` (noise textures, shared shader chunk, presets wiring) | 7 KiB |
| `js/art/geo.js` (bevelBox, world UVs, merging, AO bake, kit pieces) | 8 KiB |
| `js/art/sky.js` (sky, sea, distant scenery, fog chunk) | 3 KiB |
| `js/art/characters.js` (rig, body, gear, animation, IK) | 7 KiB |
| `js/art/weapons-art.js` + `js/art/viewmodel.js` | 7 KiB |
| `js/art/fx.js` (+ decals) | 5 KiB |
| **Art total** | **~44.5 KiB** |

Rules to keep art code small and readable:
- Shapes, profiles, joint positions, material presets and prop placements are **data** (compact arrays in
  `config.js`/`map.js`), the builders are few generic functions.
- One shared GLSL chunk for all world materials; FX shaders share a small common header.
- No copy-paste between builders: if two props share structure, make one parameterised builder.
- Short names inside shaders are fine, but every shader starts with one comment line saying what it does.

## 12. Performance targets (realism must not cost the frame rate)

- 60 FPS at 1080p on a mid laptop GPU (e.g. Intel Iris Xe / GTX 1650 class) with all effects on.
- ≤ 150 draw calls per frame, ≤ 600k triangles per frame (including shadow pass), one 4096² shadow map.
- Quality presets in the pause menu (High / Medium): Medium = 2048 shadow, bloom half-res, pixel ratio 1,
  no dust motes. Default High; auto-drop to Medium if the first 5 s average > 22 ms per frame.
- All shaders compiled during the loading screen (`renderer.compile(scene, camera)` for world + viewmodel + FX),
  so the first shot does not stutter.

## 13. Visual QA loop (mandatory, see `.claude/skills/art-review`)

After every visual change:
1. `node tools/lookdev.mjs` captures fixed views (`?cam=` URLs) and the 4 scenarios into `out/lookdev/`.
2. Open every image and check the list below. Write down each failure and fix it before moving on.
3. Compare with the previous capture of the same view; a change must make the image better, not just different.

Checklist:
- [ ] Light: clear sun direction, long soft shadows, shadows blue-grey not black, no shadow acne, no light leaks at
      wall bases, no peter-panning under objects.
- [ ] Contact: every object sits on the ground (AO darkening at contact), nothing floats, no z-fighting.
- [ ] Edges: bevels catch light on walls, crates, steps, weapons. No hard flat-shaded boxes visible.
- [ ] Materials: concrete, metal, wood, cloth and rubber are distinguishable in a greyscale version of the image
      (differences in roughness and pattern, not only colour). Metals reflect the sky. No uniform flat colour areas.
- [ ] Texel density consistent; no stretched or swimming textures; no visible tiling repeats at mid distance.
- [ ] Palette: dominant warm/cool split, accents only on gameplay elements; no random saturated colours.
- [ ] Readability: enemies separate from background at 10, 25 and 40 m; site and lane signs readable; HUD crisp.
- [ ] Detail: no empty wall run > 4 m, corners and floors have believable wear; scene looks lived-in but clean.
- [ ] Viewmodel: hands and gun look solid, metal and polymer read differently, optic reticle sharp, no clipping.
- [ ] Characters: proportions right, gear readable, poses natural (feet on ground, no foot sliding, elbows bend
      the right way), death poses rest on the floor.
- [ ] FX: flash, tracer, impact, smoke look intentional and short; no square sprite edges visible.
- [ ] Post: bloom only on emissive/bright things, no washed-out haze, no banding in the sky (add dithering in the
      final pass if banding appears).
- [ ] Performance: frame time and draw calls logged by lookdev stay within §12.
