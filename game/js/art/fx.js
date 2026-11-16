// SALTLINE art/fx.js — pooled effects (ART.md §10) + static dummy targets
// for M2. Drains state.fxEvents (written by weapons.js) into visual pools.
// No allocations per frame: fixed pools, ring indices, scratch vectors.
import * as THREE from 'three';
import { FXHOLD } from '../config.js';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();

export function createFx(scene) {
  // --- tracers: 12 stretched boxes, HDR core, 0.12 s life ---
  const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe9b0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const tracers = [];
  for (let i = 0; i < 12; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 1), tracerMat.clone());
    m.visible = false; scene.add(m);
    tracers.push({ m, t: 0 });
  }
  let trIdx = 0;
  // --- impact decals: 24 dark discs, persist for the round ---
  const decalGeo = new THREE.CircleGeometry(0.09, 10);
  const decals = [];
  for (let i = 0; i < 24; i++) {
    const m = new THREE.Mesh(decalGeo, new THREE.MeshBasicMaterial({ color: 0x141210, transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.visible = false; scene.add(m);
    decals.push(m);
  }
  let decIdx = 0;
  // --- sparks/dust: one Points cloud, 96 particles ---
  const SN = 96;
  const sPos = new Float32Array(SN * 3), sVel = new Float32Array(SN * 3), sLife = new Float32Array(SN);
  const sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  const sparks = new THREE.Points(sGeo, new THREE.PointsMaterial({ color: 0xffd9a0, size: 0.05, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
  sparks.frustumCulled = false; scene.add(sparks);
  let spIdx = 0;
  // --- shells: 24 brass casings, bounce on the ground, fade after 4 s ---
  const shells = [];
  const shellGeo = new THREE.BoxGeometry(0.012, 0.006, 0.022);
  const shellMat = new THREE.MeshStandardMaterial({ color: 0xb08d3f, metalness: 1, roughness: 0.35 });
  for (let i = 0; i < 24; i++) {
    const m = new THREE.Mesh(shellGeo, shellMat);
    m.visible = false; scene.add(m);
    shells.push({ m, vx: 0, vy: 0, vz: 0, t: 0 });
  }
  let shIdx = 0;
  // --- world muzzle light: one reused point light ---
  const flashLight = new THREE.PointLight(0xffc27a, 0, 16, 1.8);
  scene.add(flashLight);
  let flashT = 0;
  // --- dummy targets: capsule body + head, team colours ---
  const dummies = new Map();
  const bodyGeo = new THREE.CylinderGeometry(0.22, 0.26, 1.05, 10);
  const headGeo = new THREE.SphereGeometry(0.14, 12, 10);
  const legGeo = new THREE.CylinderGeometry(0.09, 0.1, 0.75, 8);
  function dummyMesh(a) {
    const g = new THREE.Group();
    const col = a.team === 'bastion' ? 0x2f6f68 : 0x8a6a2c;
    const bodyMat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.8, metalness: 0.1 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 1.05; body.castShadow = true; g.add(body);
    const head = new THREE.Mesh(headGeo, new THREE.MeshStandardMaterial({ color: 0xc8a882, roughness: 0.7 }));
    head.position.y = 1.72; head.castShadow = true; g.add(head);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.05), new THREE.MeshStandardMaterial({ color: 0x1d1d1f, roughness: 0.3, metalness: 0.6 }));
    visor.position.set(0, 1.74, -0.12); g.add(visor);
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(legGeo, new THREE.MeshStandardMaterial({ color: 0x2e2d2b, roughness: 0.9 }));
      leg.position.set(0.12 * s, 0.38, 0); g.add(leg);
    }
    g.userData = { bodyMat, flashT: 0, fall: 0 };
    scene.add(g);
    return g;
  }

  function spawnTracer(x, y, z, ex, ey, ez) {
    const tr = tracers[trIdx]; trIdx = (trIdx + 1) % tracers.length;
    _a.set(x, y, z); _b.set(ex, ey, ez);
    const len = _a.distanceTo(_b);
    tr.m.position.copy(_a).lerp(_b, 0.5);
    tr.m.lookAt(_b);
    tr.m.scale.set(1, 1, len);
    tr.m.material.opacity = 0.9; tr.m.visible = true; tr.t = 0.12 * FXHOLD;
  }
  function spawnDecal(x, y, z, nx, ny, nz) {
    const m = decals[decIdx]; decIdx = (decIdx + 1) % decals.length;
    m.position.set(x + nx * 0.012, y + ny * 0.012, z + nz * 0.012);
    m.lookAt(x + nx, y + ny, z + nz);
    m.visible = true;
  }
  function spawnSparks(x, y, z) {
    const n = 8;
    for (let i = 0; i < n; i++) {
      const k = spIdx; spIdx = (spIdx + 1) % SN;
      sPos[k * 3] = x; sPos[k * 3 + 1] = y; sPos[k * 3 + 2] = z;
      sVel[k * 3] = (Math.random() - 0.5) * 3;
      sVel[k * 3 + 1] = Math.random() * 2.5;
      sVel[k * 3 + 2] = (Math.random() - 0.5) * 3;
      sLife[k] = 0.45;
    }
  }
  function spawnShell(x, y, z, rx, rz) {
    const s = shells[shIdx]; shIdx = (shIdx + 1) % shells.length;
    s.m.position.set(x + rx * 0.1, y - 0.05, z + rz * 0.1);
    s.vx = rx * 1.4 + (Math.random() - 0.5); s.vy = 1.4 + Math.random(); s.vz = rz * 1.4 + (Math.random() - 0.5);
    s.t = 4; s.m.visible = true;
  }

  return {
    // Drain the ring buffer and step all pools.
    update(state, viewmodel, dt) {
      const ev = state.fxEvents;
      while (state.fxHead !== state.fxTail) {
        const e = ev[state.fxHead];
        state.fxHead = (state.fxHead + 1) % 32;
        if (e.kind === 0) spawnTracer(e.x, e.y, e.z, e.dx, e.dy, e.dz);
        else if (e.kind === 1) { viewmodel.flash(); flashLight.position.set(e.x, e.y, e.z); flashLight.intensity = 22; flashT = 0.06 * FXHOLD; }
        else if (e.kind === 2) spawnDecal(e.x, e.y, e.z, e.dx, e.dy, e.dz);
        else if (e.kind === 3) spawnSparks(e.x, e.y, e.z);
        else if (e.kind === 4) spawnShell(e.x, e.y, e.z, e.dx, e.dz);
        else if (e.kind === 6) {
          const d = dummies.get(e.mat);
          if (d) { d.userData.flashT = 0.12; }
        }
      }
      if (flashT > 0) { flashT -= dt; flashLight.intensity = 22 * Math.max(0, flashT / (0.06 * FXHOLD)); }
      else flashLight.intensity = 0;
      for (const tr of tracers) {
        if (tr.t <= 0) continue;
        tr.t -= dt;
        tr.m.material.opacity = Math.max(0, tr.t / (0.12 * FXHOLD)) * 0.9;
        if (tr.t <= 0) tr.m.visible = false;
      }
      for (let i = 0; i < SN; i++) {
        if (sLife[i] <= 0) { sPos[i * 3 + 1] = -100; continue; }
        sLife[i] -= dt;
        sVel[i * 3 + 1] -= 6 * dt;
        sPos[i * 3] += sVel[i * 3] * dt;
        sPos[i * 3 + 1] += sVel[i * 3 + 1] * dt;
        sPos[i * 3 + 2] += sVel[i * 3 + 2] * dt;
      }
      sGeo.attributes.position.needsUpdate = true;
      for (const s of shells) {
        if (s.t <= 0) continue;
        s.t -= dt;
        s.vy -= 9.8 * dt;
        s.m.position.x += s.vx * dt; s.m.position.y += s.vy * dt; s.m.position.z += s.vz * dt;
        s.m.rotation.x += 9 * dt; s.m.rotation.z += 7 * dt;
        if (s.m.position.y < 0.01) { s.m.position.y = 0.01; s.vy *= -0.35; s.vx *= 0.6; s.vz *= 0.6; }
        if (s.t <= 0) s.m.visible = false;
      }
      // Dummy targets: place, hit-flash, fall on death.
      for (const a of state.agents) {
        if (!a.isBot) continue;
        let d = dummies.get(a.id);
        if (!d) { d = dummyMesh(a); dummies.set(a.id, d); }
        d.position.set(a.pos.x, a.pos.y, a.pos.z);
        d.rotation.y = a.yaw;
        if (!a.alive && d.userData.fall < 1) {
          d.userData.fall = Math.min(1, d.userData.fall + dt * 3);
          d.rotation.x = -Math.PI / 2 * d.userData.fall;
          d.position.y = 0.25 * d.userData.fall;
        }
        if (d.userData.flashT > 0) {
          d.userData.flashT -= dt;
          d.userData.bodyMat.emissive.setHex(0xffffff);
          d.userData.bodyMat.emissiveIntensity = Math.max(0, d.userData.flashT / 0.12) * 0.8;
        } else d.userData.bodyMat.emissiveIntensity = 0;
      }
    },
  };
}
