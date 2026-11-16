// SALTLINE art/weapons-art.js — buildWeapon(spec) composes a gun from
import * as THREE from 'three';
import { VM } from '../config.js';

const metal = new THREE.MeshStandardMaterial({ color: 0x2e3136, metalness: 0.9, roughness: 0.42 });
const poly = new THREE.MeshStandardMaterial({ color: 0x1d1d1f, metalness: 0.1, roughness: 0.62 });
const brass = new THREE.MeshStandardMaterial({ color: 0xb08d3f, metalness: 1, roughness: 0.35 });
const glass = new THREE.MeshPhysicalMaterial({ color: 0x88aacc, metalness: 0, roughness: 0.05, transparent: true, opacity: 0.55 });
const glow = new THREE.MeshBasicMaterial({ color: 0xff3020 });

function box(w, h, d, mat, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); parent.add(m); return m;
}

function cyl(r0, r1, len, mat, x, y, z, parent, axis = 'z') {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, len, 12), mat);
  if (axis === 'z') m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z); parent.add(m); return m;
}

function extrude(pts, depth, mat, x, y, z, parent) {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.002, bevelSegments: 1 });
  g.translate(0, 0, -depth / 2);
  const m = new THREE.Mesh(g, mat);
  m.position.set(x, y, z); parent.add(m); return m;
}

export function buildWeapon(id) {
  const spec = VM[id];
  const g = new THREE.Group();
  const accent = new THREE.MeshStandardMaterial({ color: spec.accent, metalness: 0.6, roughness: 0.5 });
  const pistol = !spec.stock && spec.barrel <= 0.14;
  const L = 0.34 + spec.barrel;
  extrude([[-0.16, -0.03], [L * 0.45, -0.03], [L * 0.45, 0.045], [-0.1, 0.045], [-0.16, 0.02]], 0.045, metal, 0, 0, 0, g);
  cyl(0.011, 0.011, spec.barrel, metal, L * 0.45 + spec.barrel / 2, 0.012, 0, g);
  cyl(0.016, 0.016, 0.045, metal, L * 0.45 + spec.barrel - 0.01, 0.012, 0, g);
  if (pistol) box(L * 0.42, 0.035, 0.05, poly, L * 0.2, 0.028, 0, g);
  else box(L * 0.34, 0.055, 0.06, poly, L * 0.28, 0.005, 0, g);
  extrude([[0, 0], [0.035, 0], [0.02, -0.09], [-0.015, -0.09]], 0.04, poly, -0.06, -0.03, 0, g);
  let mag = null;
  if (spec.mag === 'curved') {
    mag = extrude([[0, 0], [0.05, 0], [0.075, -0.12], [0.03, -0.13], [-0.01, -0.02]], 0.035, accent, 0.08, -0.03, 0, g);
  } else if (spec.mag === 'straight') {
    mag = box(0.035, 0.13, 0.03, accent, 0.08, -0.09, 0, g);
  } else if (spec.mag === 'tube') {
    mag = cyl(0.014, 0.014, spec.barrel * 0.8, metal, L * 0.3, -0.02, 0, g);
  }
  if (spec.stock) extrude([[-0.16, -0.02], [-0.05, -0.02], [-0.05, 0.02], [-0.19, 0.02], [-0.22, -0.05]], 0.04, poly, -0.02, 0.01, 0, g);
  else box(0.03, 0.02, 0.04, metal, -0.12, 0.055, 0, g);
  box(0.006, 0.03, 0.006, metal, L * 0.42, 0.06, 0, g);
  if (spec.scope) {
    cyl(0.021, 0.021, 0.11, metal, 0.05, 0.055, 0, g);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.018, 16), glass);
    lens.position.set(0.105, 0.055, 0); lens.rotation.y = Math.PI / 2; g.add(lens);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.003, 8), glow);
    dot.position.set(0.104, 0.055, 0); dot.rotation.y = Math.PI / 2; g.add(dot);
  } else {
    box(0.03, 0.018, 0.05, metal, -0.05, 0.055, 0, g);
  }
  const bolt = box(0.05, 0.015, 0.05, metal, 0.02, 0.02, 0.028, g);
  if (id === 'cutlass') {
    g.clear();
    const blade = box(0.3, 0.004, 0.045, brass, 0.18, 0, 0, g);
    blade.scale.x = 1; blade.rotation.z = 0;
    box(0.11, 0.03, 0.035, poly, -0.02, 0, 0, g);
    box(0.02, 0.05, 0.04, metal, 0.045, 0, 0, g);
  }
  const muzzle = new THREE.Object3D();
  muzzle.position.set(L * 0.45 + spec.barrel, 0.012, 0);
  g.add(muzzle);
  g.traverse((m) => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = false; } });
  return { group: g, muzzle, mag, bolt, accent };
}
