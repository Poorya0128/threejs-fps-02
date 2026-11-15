---
name: vendor-three
description: How three.js 0.187.0 is vendored into game/ and how to import it. Use whenever touching three.js files, the import map, or when tempted to use three.js addons.
---

# three.js vendoring

- The files are already in `game/three.module.min.js` and `game/three.core.min.js`. They are npm's
  `build/three.module.js` and `build/three.core.js`; the module's two `'./three.core.js'` specifiers are
  rewritten to `'./three.core.min.js'`. Nothing else differs.
- Check: `sh tools/vendor-three.sh --check`. Restore if broken: `sh tools/vendor-three.sh` (needs npm network).
- `.gitattributes` marks them `-text` so git never changes line endings. Never open and re-save them.
- The only import map, in game/index.html:
  ```html
  <script type="importmap">{ "imports": { "three": "./three.module.min.js" } }</script>
  ```
- In game modules: `import * as THREE from 'three';` or named imports (`import { Vector3, Mesh } from 'three';`).
  Named imports read better for the judge and make dependencies clear.
- **No addons.** Write the small helpers yourself:
  - Pointer lock: `canvas.requestPointerLock({ unadjustedMovement: true })`, catch and retry without options;
    listen to `pointerlockchange`; read `movementX/Y` on `mousemove`.
  - Geometry merge: build one `BufferGeometry` per material by writing positions/normals/uvs/colors of all boxes
    into typed arrays (PLAN.md §11). Do not use BufferGeometryUtils.
  - No EffectComposer/post-processing. Use tone mapping, fog, emissive materials, additive sprites.
- three r187 notes: use `renderer.outputColorSpace = SRGBColorSpace`, `texture.colorSpace = SRGBColorSpace`
  for colour canvases, `ACESFilmicToneMapping`. Check the API in `game/three.core.min.js` with grep instead of
  guessing when unsure.
