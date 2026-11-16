// SALTLINE art/fx.js — pooled effects (ART.md §10). Drains state.fxEvents
import * as THREE from 'three';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();

export function createFx(scene) {
  const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe9b0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const tracers = [];
  for (let i = 0; i < 12; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 1), tracerMat.clone());
    m.visible = false; scene.add(m);
    tracers.push({ m, t: 0 });
  }
  let trIdx = 0;
  const decalGeo = new THREE.CircleGeometry(0.09, 10);
  const decals = [];
  for (let i = 0; i < 24; i++) {
    const m = new THREE.Mesh(decalGeo, new THREE.MeshBasicMaterial({ color: 0x141210, transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.visible = false; scene.add(m);
    decals.push(m);
  }
  let decIdx = 0;
  const SN = 96;
  const sPos = new Float32Array(SN * 3), sVel = new Float32Array(SN * 3), sLife = new Float32Array(SN);
  const sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  const sparks = new THREE.Points(sGeo, new THREE.PointsMaterial({ color: 0xffd9a0, size: 0.05, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
  sparks.frustumCulled = false; scene.add(sparks);
  let spIdx = 0;
  const shells = [];
  const shellGeo = new THREE.BoxGeometry(0.012, 0.006, 0.022);
  const shellMat = new THREE.MeshStandardMaterial({ color: 0xb08d3f, metalness: 1, roughness: 0.35 });
  for (let i = 0; i < 24; i++) {
    const m = new THREE.Mesh(shellGeo, shellMat);
    m.visible = false; scene.add(m);
    shells.push({ m, vx: 0, vy: 0, vz: 0, t: 0 });
  }
  let shIdx = 0;
  const flashLight = new THREE.PointLight(0xffc27a, 0, 16, 1.8);
  scene.add(flashLight);
  let flashT = 0, flashDur = 0.06, flashMax = 22;
  const smokeTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 4, 32, 32, 32);
    for (const [o, a] of [[0, 0.85], [0.55, 0.4], [1, 0]]) g.addColorStop(o, `rgba(255,255,255,${a})`);
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const smokePuffs = [];
  for (let i = 0; i < 4; i++) {
    const group = [];
    for (let j = 0; j < 9; j++) {
      const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0x9aa0a3, transparent: true, opacity: 0, depthWrite: false }));
      m.visible = false; scene.add(m);
      group.push(m);
    }
    smokePuffs.push(group);
  }
  const nadeGeo = new THREE.SphereGeometry(0.07, 8, 6);
  const nadeMat = new THREE.MeshStandardMaterial({ color: 0x2a2e22, roughness: 0.6, metalness: 0.4 });
  const nadeMeshes = [];
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(nadeGeo, nadeMat);
    m.visible = false; scene.add(m);
    nadeMeshes.push(m);
  }
  function spawnTracer(x, y, z, ex, ey, ez) {
    const tr = tracers[trIdx]; trIdx = (trIdx + 1) % tracers.length;
    _a.set(x, y, z); _b.set(ex, ey, ez);
    const len = _a.distanceTo(_b);
    tr.m.position.copy(_a).lerp(_b, 0.5);
    tr.m.lookAt(_b);
    tr.m.scale.set(1, 1, len);
    tr.m.material.opacity = 0.9; tr.m.visible = true; tr.t = 0.12;
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
    update(state, viewmodel, dt, chars) {
      const ev = state.fxEvents;
      while (state.fxHead !== state.fxTail) {
        const e = ev[state.fxHead];
        state.fxHead = (state.fxHead + 1) % 32;
        if (e.kind === 0) spawnTracer(e.x, e.y, e.z, e.dx, e.dy, e.dz);
        else if (e.kind === 1) { viewmodel.flash(); flashLight.position.set(e.x, e.y, e.z); flashLight.intensity = 22; flashT = 0.06; flashDur = 0.06; flashMax = 22; }
        else if (e.kind === 2) spawnDecal(e.x, e.y, e.z, e.dx, e.dy, e.dz);
        else if (e.kind === 3) spawnSparks(e.x, e.y, e.z);
        else if (e.kind === 4) spawnShell(e.x, e.y, e.z, e.dx, e.dz);
        else if (e.kind === 6 && chars) chars.flash(e.mat);
        else if (e.kind === 7) {
          for (let k = 0; k < 3; k++) spawnSparks(e.x, e.y, e.z);
          flashLight.position.set(e.x, e.y, e.z); flashLight.intensity = 80; flashT = 0.3; flashDur = 0.3; flashMax = 80;
        }
      }
      if (flashT > 0) { flashT -= dt; flashLight.intensity = flashMax * Math.max(0, flashT / flashDur); }
      else flashLight.intensity = 0;
      for (let i = 0; i < 4; i++) {
        const s = state.smokes[i], group = smokePuffs[i];
        const age = state.time - s.t;
        const grow = s.active ? Math.min(1, age / 1.2) : 0;
        const fade = s.active ? Math.max(0, Math.min(1, (s.dur - age) / 3)) : 0;
        for (let j = 0; j < 9; j++) {
          const m = group[j];
          if (!s.active) { m.visible = false; continue; }
          const v = (k) => ((j * k) % 10) / 10;
          const a = j * 2.399, rr = s.r * (0.15 + 0.38 * v(37));
          m.position.set(s.x + Math.cos(a) * rr, s.y + 0.3 + v(53) * s.r * 0.55 + age * 0.12, s.z + Math.sin(a) * rr);
          const sc = s.r * (0.5 + 0.22 * v(29)) * (0.6 + 0.4 * grow);
          m.scale.set(sc, sc, 1);
          m.material.opacity = 0.42 * grow * fade;
          m.visible = true;
        }
      }
      for (let i = 0; i < 8; i++) {
        const g = state.nades[i], m = nadeMeshes[i];
        if (!g.active) { m.visible = false; continue; }
        m.position.set(g.x, g.y, g.z);
        m.visible = true;
      }
      for (const tr of tracers) {
        if (tr.t <= 0) continue;
        tr.t -= dt;
        tr.m.material.opacity = Math.max(0, tr.t / (0.12)) * 0.9;
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
    },
  };
}
