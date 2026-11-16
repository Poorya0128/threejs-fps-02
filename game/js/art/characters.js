// SALTLINE art/characters.js — bot rigs (ART.md §7). 1.80 m / 7.5 heads,
// faces covered, team identity by silhouette + colour. Shared geometry
// and materials; only the torso material is cloned (hit flash).
import * as THREE from 'three';

const TEAM = {
  strand: { cloth: 0x8a7a52, gear: 0x5c5238, accent: 0xf0a03c, head: 0x6b5a34 },
  bastion: { cloth: 0x3a4450, gear: 0x232a33, accent: 0x2f8f86, head: 0x232a33 },
};

export function createCharacters(scene) {
  // Shared geometry (one set for all rigs).
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
  const patchGeo = new THREE.BoxGeometry(0.1, 0.05, 0.02);
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
      accent: new THREE.MeshStandardMaterial({ color: c.accent, roughness: 0.5, emissive: c.accent, emissiveIntensity: 0.25 }),
      head: new THREE.MeshStandardMaterial({ color: c.head, roughness: 0.85 }),
    };
  }

  const rigs = new Map();

  function rigFor(a) {
    const m = mats[a.team];
    const root = new THREE.Group();
    const pelvis = new THREE.Group();
    pelvis.position.y = 0.95;
    root.add(pelvis);
    const torsoMat = m.cloth.clone();
    const torso = new THREE.Mesh(torsoGeo, torsoMat);
    torso.position.y = 0.28; torso.castShadow = true;
    pelvis.add(torso);
    const vest = new THREE.Mesh(vestGeo, m.gear);
    vest.position.set(0, 0.3, -0.19); vest.castShadow = true;
    pelvis.add(vest);
    const pack = new THREE.Mesh(packGeo, m.gear);
    pack.position.set(0, 0.32, 0.22);
    pelvis.add(pack);
    const strip = new THREE.Mesh(stripGeo, stripMat);
    strip.position.set(0, 0.4, 0.29);
    strip.visible = false;
    pelvis.add(strip);
    const chest = new THREE.Group();
    chest.position.y = 0.5;
    pelvis.add(chest);
    const head = new THREE.Group();
    head.position.y = 0.28;
    chest.add(head);
    const skull = new THREE.Mesh(headGeo, skin);
    skull.castShadow = true;
    head.add(skull);
    const helm = new THREE.Mesh(helmGeo, m.head);
    helm.position.y = 0.03;
    head.add(helm);
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 0.02, -0.11);
    head.add(visor);
    const patch = new THREE.Mesh(patchGeo, m.accent);
    patch.position.set(0.16, 0.1, -0.05);
    chest.add(patch);
    // Arms: posed forward in a two-hand hold on the gun.
    const arms = [];
    for (const s of [-1, 1]) {
      const sh = new THREE.Group();
      sh.position.set(0.24 * s, 0.42, 0);
      pelvis.add(sh);
      const up = new THREE.Mesh(armGeo, m.cloth);
      up.position.y = -0.18; up.castShadow = true;
      sh.add(up);
      const el = new THREE.Group();
      el.position.y = -0.36;
      sh.add(el);
      const fo = new THREE.Mesh(armGeo, m.cloth);
      fo.position.y = -0.16;
      el.add(fo);
      sh.rotation.x = -1.1; el.rotation.x = -0.7;
      arms.push({ sh, el });
    }
    // Legs: thigh pivot at the hip, shin pivot at the knee.
    const legs = [];
    for (const s of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(0.11 * s, 0.92, 0);
      root.add(hip);
      const th = new THREE.Mesh(limbGeo, m.cloth);
      th.position.y = -0.22; th.castShadow = true;
      hip.add(th);
      const knee = new THREE.Group();
      knee.position.y = -0.46;
      hip.add(knee);
      const sh2 = new THREE.Mesh(limbGeo, m.cloth);
      sh2.position.y = -0.2;
      knee.add(sh2);
      const boot = new THREE.Mesh(bootGeo, rubber);
      boot.position.set(0, -0.44, -0.05);
      knee.add(boot);
      const pad = new THREE.Mesh(padGeo, rubber);
      pad.position.set(0, -0.05, -0.09);
      knee.add(pad);
      legs.push({ hip, knee });
    }
    // Gun: compact rifle silhouette, parented to the chest so it aims.
    const gun = new THREE.Group();
    gun.position.set(0.08, 0.32, -0.32);
    chest.add(gun);
    const recv = new THREE.Mesh(gunGeo, metal);
    gun.add(recv);
    const barrel = new THREE.Mesh(barrelGeo, metal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, -0.38);
    gun.add(barrel);
    scene.add(root);
    const rig = { root, pelvis, chest, head, arms, legs, torsoMat, strip, fall: 0, flashT: 0 };
    rigs.set(a.id, rig);
    return rig;
  }

  return {
    // Hit flash on one rig (called from fx.js when it drains kind-6 events).
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
          // Death: rigid-body-lite fall, then stay for the round (§7).
          r.fall = Math.min(1, r.fall + dt * 3);
          r.root.rotation.x = -Math.PI / 2 * r.fall;
          r.root.position.y = a.pos.y + 0.25 * r.fall;
          continue;
        }
        r.fall = 0;
        r.root.rotation.x = 0;
        // Locomotion: phase from distance travelled (§7).
        const sp = a._speed || 0;
        const amp = Math.min(1, sp / 5) * 0.55;
        const ph = a._walkPhase || 0;
        r.legs[0].hip.rotation.x = Math.sin(ph) * amp;
        r.legs[1].hip.rotation.x = -Math.sin(ph) * amp;
        r.legs[0].knee.rotation.x = Math.max(0, -Math.sin(ph)) * amp * 1.4;
        r.legs[1].knee.rotation.x = Math.max(0, Math.sin(ph)) * amp * 1.4;
        // Crouch blend: lower pelvis, bend legs, lean the torso.
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
