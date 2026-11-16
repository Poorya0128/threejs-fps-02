// SALTLINE art/geo.js — geometry kit (ART.md §4). Every box is bevelled
import * as THREE from 'three';
import { MATERIALS } from '../config.js';
import { rayAABB } from '../math.js';

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

const DIRS = [];
for (let i = 0; i < 8; i++) {
  const a = (i / 8) * Math.PI * 2, e = 0.45 + (i % 2) * 0.35;
  DIRS.push([Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)]);
}

export function bakeAO(geo, boxes) {
  const t0 = performance.now();
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const col = geo.attributes.color;
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
      if (rayAABB(ox, oy, oz, dx, dy, dz, b.min, b.max, 0.8) > 0.02) return true;
    }
    return false;
  };
  for (let v = 0; v < pos.count; v++) {
    const x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v);
    const nx = nor.getX(v), ny = nor.getY(v), nz = nor.getZ(v);
    let occ = 0;
    for (let d = 0; d < DIRS.length; d++) {
      const dir = DIRS[d];
      let dx = dir[0], dy = dir[1], dz = dir[2];
      const dot = dx * nx + dy * ny + dz * nz;
      if (dot < 0) { dx -= 2 * dot * nx; dy -= 2 * dot * ny; dz -= 2 * dot * nz; }
      if (hit(x + nx * 0.02, y + ny * 0.02, z + nz * 0.02, dx, dy, dz)) occ++;
    }
    const ao = 1 - 0.55 * (occ / DIRS.length);
    const dirt = 1 - 0.18 * (1 - Math.min(1, Math.max(0, y / 0.6)));
    col.setXYZ(v, col.getX(v) * ao * dirt, col.getY(v) * ao * dirt, col.getZ(v) * ao * dirt);
  }
  return performance.now() - t0;
}

function noiseTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const img = x.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 118 + Math.floor(Math.random() * 20);
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function signTexture(text) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = '#1d1d1f'; x.fillRect(0, 0, 256, 64);
  x.fillStyle = '#f0a03c'; x.font = 'bold 38px monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text, 128, 34);
  return new THREE.CanvasTexture(c);
}

function dressWorld(scene) {
  const rust = new THREE.MeshStandardMaterial({ color: 0x8a4a2c, roughness: 0.9, metalness: 0.2 });
  const teal = new THREE.MeshStandardMaterial({ color: 0x2f7f78, roughness: 0.6, metalness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x30343a, roughness: 0.5, metalness: 0.9 });
  const add = (mesh, x, y, z, ry = 0) => { mesh.position.set(x, y, z); mesh.rotation.y = ry; mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh); return mesh; };
  // Boiler vessel (14,1.5,33, 6x3x4): rim band, waist band, face pipes, gauge.
  add(new THREE.Mesh(new THREE.BoxGeometry(6.3, 0.18, 4.3), rust), 14, 2.9, 33);
  add(new THREE.Mesh(new THREE.BoxGeometry(6.15, 0.12, 4.15), teal), 14, 1.5, 33);
  for (const [x, r] of [[11.8, 0.09], [13.2, 0.07], [16.2, 0.09]]) {
    add(new THREE.Mesh(new THREE.CylinderGeometry(r, r, 3.1, 8), dark), x, 1.55, 30.9);
  }
  // Signs: BOILER above the hall door, PANS on the pumphouse beam.
  for (const [text, x, y, z, w, h] of [['BOILER', 14.75, 4.5, 22.6, 4, 1], ['PANS', -2, 3.5, -10.4, 3, 0.75]]) {
    add(new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: signTexture(text), roughness: 0.7 })), x, y, z);
  }
}

export function buildWorld(scene, boxes) {
  const t0 = performance.now();
  const noise = noiseTexture();
  const byMat = new Map();
  for (const b of boxes) {
    if (!byMat.has(b.mat)) byMat.set(b.mat, []);
    byMat.get(b.mat).push(b);
  }
  for (const [matId, list] of byMat) {
    const geos = [];
    for (let bi = 0; bi < list.length; bi++) {
      const b = list[bi];
      const sx = b.max.x - b.min.x, sy = b.max.y - b.min.y, sz = b.max.z - b.min.z;
      if (sx < 0.05 || sy < 0.05 || sz < 0.05) continue;
      const g = bevelBox(sx, sy, sz, 0.03);
      g.translate((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2);
      applyWorldUV(g);
      const n = g.attributes.position.count;
      const col = new Float32Array(n * 3);
      col.fill(0.88 + ((bi * 37) % 10) / 60);
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geos.push(g);
    }
    if (!geos.length) continue;
    const merged = mergeGeos(geos);
    const preset = MATERIALS[matId] ?? MATERIALS[0];
    const mat = new THREE.MeshStandardMaterial({
      color: preset.color, roughness: preset.roughness, metalness: preset.metalness,
      vertexColors: true, bumpMap: noise, bumpScale: 1.0,
    });
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
    const ms = bakeAO(merged, boxes);
    if (matId === 0) console.log(`[saltline] AO bake: ${ms.toFixed(0)} ms`);
  }
  dressWorld(scene);
  console.log(`[saltline] world built in ${(performance.now() - t0).toFixed(0)} ms`);
}
