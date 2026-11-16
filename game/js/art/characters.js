// SALTLINE art/characters.js — bot rigs (ART.md §7). 1.80 m / 7.5 heads,
import * as THREE from 'three';

const TEAM = {
  strand: { cloth: 0x8a7a52, gear: 0x5c5238, accent: 0xf0a03c, head: 0x6b5a34 },
  bastion: { cloth: 0x3a4450, gear: 0x232a33, accent: 0x2f8f86, head: 0x232a33 },
};

export function createCharacters(scene) {
  const torsoGeo = new THREE.CapsuleGeometry(0.21, 0.42, 4, 12);
  const headGeo = new THREE.SphereGeometry(0.115, 12, 10);
  const helmGeo = new THREE.SphereGeometry(0.14, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55);
  const limbGeo = new THREE.CapsuleGeometry(0.075, 0.36, 4, 10);
  const armGeo = new THREE.CapsuleGeometry(0.055, 0.3, 4, 10);
  const bootGeo = new THREE.BoxGeometry(0.11, 0.09, 0.28);
  const vestGeo = new THREE.BoxGeometry(0.36, 0.42, 0.1);
  const packGeo = new THREE.BoxGeometry(0.3, 0.38, 0.12);
  const stripGeo = new THREE.BoxGeometry(0.32, 0.03, 0.02);
  const gunGeo = new THREE.BoxGeometry(0.05, 0.1, 0.55);
  const barrelGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.28, 8);
  const patchGeo = new THREE.BoxGeometry(0.14, 0.07, 0.02);
  const visorGeo = new THREE.BoxGeometry(0.2, 0.06, 0.04);
  const padGeo = new THREE.BoxGeometry(0.13, 0.1, 0.04);
  const stripMat = new THREE.MeshStandardMaterial({ color: 0xf0a03c, emissive: 0xf0a03c, emissiveIntensity: 1.6 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x1d1d1f, roughness: 0.9 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x30343a, roughness: 0.45, metalness: 0.85 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc8a882, roughness: 0.7 });
  const visorMat = new THREE.MeshStandardMaterial({ color: 0x0e1216, roughness: 0.25, metalness: 0.6 });
  const mats = {};
  for (const t of ['strand', 'bastion']) {
    const c = TEAM[t];
    mats[t] = {
      cloth: new THREE.MeshStandardMaterial({ color: c.cloth, roughness: 0.85 }),
      gear: new THREE.MeshStandardMaterial({ color: c.gear, roughness: 0.6, metalness: 0.2 }),
      accent: new THREE.MeshStandardMaterial({ color: c.accent, roughness: 0.5, emissive: c.accent, emissiveIntensity: 0.45 }),
      head: new THREE.MeshStandardMaterial({ color: c.head, roughness: 0.85 }),
    };
  }

  const rigs = new Map();

  function part(parent, geo, mat, x, y, z) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0);
    parent.add(m);
    return m;
  }

  function rigFor(a) {
    const m = mats[a.team];
    const root = new THREE.Group();
    const pelvis = new THREE.Group();
    pelvis.position.y = 0.95;
    root.add(pelvis);
    const torsoMat = m.cloth.clone();
    const torso = part(pelvis, torsoGeo, torsoMat, 0, 0.28, 0); torso.castShadow = true;
    const vest = part(pelvis, vestGeo, m.gear, 0, 0.3, -0.19); vest.castShadow = true;
    const pack = part(pelvis, packGeo, m.gear, 0, 0.32, 0.22);
    const strip = part(pelvis, stripGeo, stripMat, 0, 0.4, 0.29);
    strip.visible = false;
    const chest = new THREE.Group();
    chest.position.y = 0.5;
    pelvis.add(chest);
    const head = new THREE.Group();
    head.position.y = 0.28;
    chest.add(head);
    const skull = part(head, headGeo, skin); skull.castShadow = true;
    const helm = part(head, helmGeo, m.head, 0, 0.03, 0);
    const visor = part(head, visorGeo, visorMat, 0, 0.02, -0.11);
    const patch = part(chest, patchGeo, m.accent, 0.16, 0.1, -0.05);
    const arms = [];
    for (const s of [-1, 1]) {
      const sh = new THREE.Group();
      sh.position.set(0.24 * s, 0.42, 0);
      pelvis.add(sh);
      const up = part(sh, armGeo, m.cloth, 0, -0.18, 0); up.castShadow = true;
      const el = new THREE.Group();
      el.position.y = -0.36;
      sh.add(el);
      const fo = part(el, armGeo, m.cloth, 0, -0.16, 0);
      sh.rotation.x = -1.1; el.rotation.x = -0.7;
      arms.push({ sh, el });
    }
    const legs = [];
    for (const s of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(0.11 * s, 0.92, 0);
      root.add(hip);
      const th = part(hip, limbGeo, m.cloth, 0, -0.22, 0); th.castShadow = true;
      const knee = new THREE.Group();
      knee.position.y = -0.46;
      hip.add(knee);
      const sh2 = part(knee, limbGeo, m.cloth, 0, -0.2, 0);
      const boot = part(knee, bootGeo, rubber, 0, -0.44, -0.05);
      const pad = part(knee, padGeo, rubber, 0, -0.05, -0.09);
      legs.push({ hip, knee });
    }
    const gun = new THREE.Group();
    gun.position.set(0.08, 0.32, -0.32);
    chest.add(gun);
    const recv = part(gun, gunGeo, metal);
    const barrel = part(gun, barrelGeo, metal, 0, 0.02, -0.38);
    barrel.rotation.x = Math.PI / 2;
    scene.add(root);
    const rig = { root, pelvis, chest, head, arms, legs, torsoMat, strip, fall: 0, flashT: 0 };
    rigs.set(a.id, rig);
    return rig;
  }

  return {
    flash(id) {
      const r = rigs.get(id);
      if (r) r.flashT = 0.12;
    },
    update(state, dt) {
      for (const a of state.agents) {
        if (!a.isBot) continue;
        let r = rigs.get(a.id);
        if (!r) r = rigFor(a);
        r.root.position.set(a.pos.x, a.pos.y, a.pos.z);
        r.root.rotation.y = a.yaw;
        r.strip.visible = a.hasFuse;
        if (r.flashT > 0) {
          r.flashT -= dt;
          r.torsoMat.emissive.setHex(0xffffff);
          r.torsoMat.emissiveIntensity = Math.max(0, r.flashT / 0.12) * 0.8;
        } else r.torsoMat.emissiveIntensity = 0;
        if (!a.alive) {
          r.fall = Math.min(1, r.fall + dt * 3);
          r.root.rotation.x = -Math.PI / 2 * r.fall;
          r.root.position.y = a.pos.y + 0.25 * r.fall;
          continue;
        }
        r.fall = 0;
        r.root.rotation.x = 0;
        const sp = a._speed || 0;
        const amp = Math.min(1, sp / 5) * 0.55;
        const ph = a._walkPhase || 0;
        r.legs[0].hip.rotation.x = Math.sin(ph) * amp;
        r.legs[1].hip.rotation.x = -Math.sin(ph) * amp;
        r.legs[0].knee.rotation.x = Math.max(0, -Math.sin(ph)) * amp * 1.4;
        r.legs[1].knee.rotation.x = Math.max(0, Math.sin(ph)) * amp * 1.4;
        const c = a.crouch;
        r.pelvis.position.y = 0.95 - c * 0.28;
        r.legs[0].hip.rotation.x += c * 0.5;
        r.legs[1].hip.rotation.x += c * 0.5;
        r.legs[0].knee.rotation.x += c * 0.9;
        r.legs[1].knee.rotation.x += c * 0.9;
        r.chest.rotation.x = c * 0.25 + a.pitch * 0.7;
        r.head.rotation.x = a.pitch * 0.3;
      }
    },
  };
}
