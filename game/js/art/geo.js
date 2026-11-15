// SALTLINE art/geo.js — geometry kit (ART.md §4). Every box is bevelled:
// hard 90-degree edges with flat shading are what make a scene look fake.
// All world geometry is merged per material (draw-call budget, ART.md §12).
import * as THREE from 'three';
import { MATERIALS } from '../config.js';

// Box with 1-segment chamfered edges. ExtrudeGeometry bevels the front and
// back faces; the shape is inset by r so the final size is exact.
export function bevelBox(sx, sy, sz, r = 0.03) {
  const w = Math.max(sx - 2 * r, 0.02), h = Math.max(sy - 2 * r, 0.02);
  const d = Math.max(sz - 2 * r, 0.02);
  const s = new THREE.Shape();
  s.moveTo(-w / 2, -h / 2); s.lineTo(w / 2, -h / 2);
  s.lineTo(w / 2, h / 2); s.lineTo(-w / 2, h / 2); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth: d, bevelEnabled: true, bevelThickness: r, bevelSize: r,
    bevelSegments: 1, steps: 1,
  });
  g.translate(0, 0, -d / 2);
  return g;
}

// World-space UVs: uv = world position projected on the face's dominant
// axis, 1 repeat per 2 m. No stretching, ever.
export function applyWorldUV(geo, scale = 0.5) {
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i));
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    let u, v;
    if (nx >= ny && nx >= nz) { u = z; v = y; }
    else if (ny >= nx && ny >= nz) { u = x; v = z; }
    else { u = x; v = y; }
    uv[i * 2] = u * scale; uv[i * 2 + 1] = v * scale;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

// Concatenate non-indexed geometries (no addons allowed in the game).
export function mergeGeos(geos) {
  const list = [];
  let vcount = 0;
  for (const g of geos) {
    const ng = g.index ? g.toNonIndexed() : g;
    list.push(ng); vcount += ng.attributes.position.count;
  }
  const pos = new Float32Array(vcount * 3);
  const nor = new Float32Array(vcount * 3);
  const uv = new Float32Array(vcount * 2);
  const col = new Float32Array(vcount * 3);
  let o = 0;
  for (const g of list) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    if (g.attributes.color) col.set(g.attributes.color.array, o * 3);
    else col.fill(1, o * 3, (o + n) * 3);
    o += n;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}

// Baked ambient occlusion into the vertex colour channel: for each vertex,
// cast a few cosine-weighted short rays against the world AABBs. A uniform
// grid keeps the broadphase cheap. Runs once at load; logs its own time.
const DIRS = [];
for (let i = 0; i < 8; i++) {
  const a = (i / 8) * Math.PI * 2, e = 0.45 + (i % 2) * 0.35;
  DIRS.push([Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)]);
}

export function bakeAO(geo, boxes) {
  const t0 = performance.now();
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const col = geo.attributes.color;
  // Uniform grid over the boxes (cell 4 m) for the ray broadphase.
  const cell = 4, grid = new Map();
  const key = (x, z) => `${Math.floor(x / cell)},${Math.floor(z / cell)}`;
  for (const b of boxes) {
    for (let gx = Math.floor(b.min.x / cell); gx <= Math.floor(b.max.x / cell); gx++)
      for (let gz = Math.floor(b.min.z / cell); gz <= Math.floor(b.max.z / cell); gz++) {
        const k = `${gx},${gz}`;
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(b);
      }
  }
  const near = (x, y, z) => {
    const out = [];
    const gx = Math.floor(x / cell), gz = Math.floor(z / cell);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const l = grid.get(`${gx + a},${gz + b}`);
      if (l) for (let i = 0; i < l.length; i++) out.push(l[i]);
    }
    return out;
  };
  const hit = (ox, oy, oz, dx, dy, dz) => {
    const list = near(ox, oy, oz);
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      let t0r = 0, t1r = 0.8;
      if (dx !== 0) { const ix = 1 / dx; let a = (b.min.x - ox) * ix, c = (b.max.x - ox) * ix; if (a > c) { const t = a; a = c; c = t; } t0r = Math.max(t0r, a); t1r = Math.min(t1r, c); if (t0r > t1r) continue; }
      else if (ox < b.min.x || ox > b.max.x) continue;
      if (dy !== 0) { const iy = 1 / dy; let a = (b.min.y - oy) * iy, c = (b.max.y - oy) * iy; if (a > c) { const t = a; a = c; c = t; } t0r = Math.max(t0r, a); t1r = Math.min(t1r, c); if (t0r > t1r) continue; }
      else if (oy < b.min.y || oy > b.max.y) continue;
      if (dz !== 0) { const iz = 1 / dz; let a = (b.min.z - oz) * iz, c = (b.max.z - oz) * iz; if (a > c) { const t = a; a = c; c = t; } t0r = Math.max(t0r, a); t1r = Math.min(t1r, c); if (t0r > t1r) continue; }
      else if (oz < b.min.z || oz > b.max.z) continue;
      if (t0r > 0.02) return true;
    }
    return false;
  };
  for (let v = 0; v < pos.count; v++) {
    const x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v);
    const nx = nor.getX(v), ny = nor.getY(v), nz = nor.getZ(v);
    let occ = 0;
    for (let d = 0; d < DIRS.length; d++) {
      // Reflect the hemisphere around the vertex normal.
      const dir = DIRS[d];
      let dx = dir[0], dy = dir[1], dz = dir[2];
      const dot = dx * nx + dy * ny + dz * nz;
      if (dot < 0) { dx -= 2 * dot * nx; dy -= 2 * dot * ny; dz -= 2 * dot * nz; }
      if (hit(x + nx * 0.02, y + ny * 0.02, z + nz * 0.02, dx, dy, dz)) occ++;
    }
    const ao = 1 - 0.55 * (occ / DIRS.length);
    // Dirt mask: darker near the floor.
    const dirt = 1 - 0.18 * (1 - Math.min(1, Math.max(0, y / 0.6)));
    col.setXYZ(v, col.getX(v) * ao * dirt, col.getY(v) * ao * dirt, col.getZ(v) * ao * dirt);
  }
  return performance.now() - t0;
}

// World meshes: one merged bevelled mesh per material. Boxes thinner than
// 5 cm are paint strips with no mesh. AO is baked per merged mesh.
export function buildWorld(scene, boxes) {
  const t0 = performance.now();
  const byMat = new Map();
  for (const b of boxes) {
    if (!byMat.has(b.mat)) byMat.set(b.mat, []);
    byMat.get(b.mat).push(b);
  }
  for (const [matId, list] of byMat) {
    const geos = [];
    for (const b of list) {
      const sx = b.max.x - b.min.x, sy = b.max.y - b.min.y, sz = b.max.z - b.min.z;
      if (sx < 0.05 || sy < 0.05 || sz < 0.05) continue;
      const g = bevelBox(sx, sy, sz, 0.03);
      g.translate((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2);
      applyWorldUV(g);
      geos.push(g);
    }
    if (!geos.length) continue;
    const merged = mergeGeos(geos);
    const preset = MATERIALS[matId] ?? MATERIALS[0];
    const mat = new THREE.MeshStandardMaterial({
      color: preset.color, roughness: preset.roughness, metalness: preset.metalness,
      vertexColors: true,
    });
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
    const ms = bakeAO(merged, boxes);
    if (matId === 0) console.log(`[saltline] AO bake: ${ms.toFixed(0)} ms`);
  }
  console.log(`[saltline] world built in ${(performance.now() - t0).toFixed(0)} ms`);
}
