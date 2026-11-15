// SALTLINE math.js — scratch vectors, seeded RNG, ray tests, helpers.
// No allocations in hot code: module-level scratch only (PLAN.md §5.1).
import * as THREE from 'three';

export const _v0 = new THREE.Vector3();
export const _v1 = new THREE.Vector3();
export const _v2 = new THREE.Vector3();
export const _v3 = new THREE.Vector3();
export const _v4 = new THREE.Vector3();

export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
// Frame-rate independent exponential approach: damp(x, target, rate, dt).
export const damp = (x, target, rate, dt) => lerp(target, x, Math.exp(-rate * dt));
export const deg2rad = (d) => d * Math.PI / 180;

// mulberry32 — deterministic seeded RNG used by sim, bots and FX.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Ray vs AABB (slab test). min/max are Vector3-like {x,y,z}. Returns
// distance along the ray, or -1 on a miss. dir must be normalized.
export function rayAABB(ox, oy, oz, dx, dy, dz, min, max, maxDist) {
  let tmin = 0, tmax = maxDist;
  // x
  let t1, t2;
  if (dx !== 0) { const ix = 1 / dx; t1 = (min.x - ox) * ix; t2 = (max.x - ox) * ix; if (t1 > t2) { const t = t1; t1 = t2; t2 = t; } if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; if (tmin > tmax) return -1; }
  else if (ox < min.x || ox > max.x) return -1;
  if (dy !== 0) { const iy = 1 / dy; t1 = (min.y - oy) * iy; t2 = (max.y - oy) * iy; if (t1 > t2) { const t = t1; t1 = t2; t2 = t; } if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; if (tmin > tmax) return -1; }
  else if (oy < min.y || oy > max.y) return -1;
  if (dz !== 0) { const iz = 1 / dz; t1 = (min.z - oz) * iz; t2 = (max.z - oz) * iz; if (t1 > t2) { const t = t1; t1 = t2; t2 = t; } if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; if (tmin > tmax) return -1; }
  else if (oz < min.z || oz > max.z) return -1;
  return tmin;
}

// Ray vs sphere. Returns distance, or -1.
export function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r, maxDist) {
  const lx = cx - ox, ly = cy - oy, lz = cz - oz;
  const tca = lx * dx + ly * dy + lz * dz;
  if (tca < 0) return -1;
  const d2 = lx * lx + ly * ly + lz * lz - tca * tca;
  const r2 = r * r;
  if (d2 > r2) return -1;
  const t = tca - Math.sqrt(r2 - d2);
  return t <= maxDist ? t : -1;
}

// Point inside AABB (with a small margin for capsule tests).
export function pointInBox(x, y, z, min, max) {
  return x >= min.x && x <= max.x && y >= min.y && y <= max.y && z >= min.z && z <= max.z;
}
