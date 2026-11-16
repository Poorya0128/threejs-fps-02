// SALTLINE art/viewmodel.js — first-person weapon presentation (ART.md §9).
import * as THREE from 'three';
import { buildWeapon } from './weapons-art.js';
import { damp } from '../math.js';

const HIP = { x: 0.24, y: -0.21, z: -0.45 };
const ADS = { x: 0.0, y: -0.135, z: -0.32 };

export function createViewmodel(vmScene) {
  const group = new THREE.Group();
  vmScene.add(group);
  const cache = {};
  let cur = null, curId = '';
  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xffd9a0, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const flash = new THREE.Group();
  const f1 = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), flashMat);
  const f2 = f1.clone(); f2.rotation.z = Math.PI / 2;
  flash.add(f1, f2);
  const flashLight = new THREE.PointLight(0xffc27a, 0, 3, 1.6);
  flash.add(flashLight);
  vmScene.add(flash);
  const fill = new THREE.PointLight(0xffe0b8, 0.85, 1.6, 2);
  fill.position.set(0.12, 0.18, 0.28);
  group.add(fill);
  const _mw = new THREE.Vector3();
  const glove = new THREE.MeshStandardMaterial({ color: 0x3a352c, metalness: 0, roughness: 0.85 });
  const handR = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.11), glove);
  const handL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.1), glove);
  group.add(handR, handL);

  const s = {
    px: 0, py: 0, pz: 0, rx: 0, ry: 0, bob: 0, kick: 0, kickV: 0,
    flashT: 0, reloadT0: 0, drawT: 0,
    prevYaw: 0, prevPitch: 0, prevShots: 0, prevReload: 0, prevSwitch: 0, prevId: '',
  };
  const api = {
    group,
    setWeapon(id) {
      if (curId === id) return;
      if (cur) group.remove(cur.group);
      if (!cache[id]) cache[id] = buildWeapon(id);
      cur = cache[id]; curId = id;
      cur.group.rotation.y = Math.PI / 2;
      cur.group.position.set(0, 0, 0.05);
      group.add(cur.group);
      s.drawT = 0.35;
      handR.position.set(0.02, -0.05, 0.02);
      handL.position.set(0.0, -0.06, -0.28);
    },
    flash() { s.flashT = 0.06; },
    muzzleObj() { return cur ? cur.muzzle : null; },
    update(state, dt) {
      const p = state.player;
      const id = p.weapons[p.active];
      if (id !== s.prevId) { api.setWeapon(id); s.prevId = id; }
      if (!cur) return;
      if (p.shotsFired !== s.prevShots) { s.kickV += 0.9; s.prevShots = p.shotsFired; }
      if (p.reloadT > 0 && s.prevReload === 0) s.reloadT0 = p.reloadT;
      if (p.reloadShell > 0 && s.prevReload === 0) s.reloadT0 = p.reloadShell;
      s.prevReload = Math.max(p.reloadT, p.reloadShell);
      const dYaw = p.yaw - s.prevYaw, dPitch = p.pitch - s.prevPitch;
      s.prevYaw = p.yaw; s.prevPitch = p.pitch;
      s.rx = damp(s.rx, -dPitch * 0.9, 10, dt);
      s.ry = damp(s.ry, -dYaw * 0.9, 10, dt);
      const speed = Math.hypot(p.vel.x, p.vel.z);
      s.bob += dt * (2.2 + speed * 1.5);
      const bobA = Math.min(1, speed / 5) * (p.onGround ? 1 : 0);
      s.kickV += (-s.kick * 90 - s.kickV * 12) * dt;
      s.kick += s.kickV * dt;
      if (s.drawT > 0) s.drawT -= dt;
      const draw = Math.max(0, s.drawT) / 0.35;
      const rl = s.prevReload > 0 && s.reloadT0 > 0 ? 1 - s.prevReload / s.reloadT0 : 0;
      const dip = rl > 0 ? Math.sin(rl * Math.PI) : 0;
      const ads = p.scoped ? 1 : 0;
      const tx = HIP.x + (ADS.x - HIP.x) * ads;
      const ty = HIP.y + (ADS.y - HIP.y) * ads - draw * 0.25 - dip * 0.05 + Math.sin(s.bob * 2) * 0.006 * bobA - p.crouch * 0.02;
      const tz = HIP.z + (ADS.z - HIP.z) * ads + s.kick * 0.06 - dip * 0.04;
      group.position.set(tx + Math.cos(s.bob) * 0.004 * bobA, ty, tz);
      group.rotation.set(s.rx + s.kick * 0.09 + dip * 0.5, s.ry, s.kick * 0.03);
      if (cur.mag) cur.mag.position.y = (cur.mag.userData.y ?? (cur.mag.userData.y = cur.mag.position.y)) - dip * 0.12;
      if (cur.bolt) cur.bolt.position.z = s.kick * 0.05;
      if (s.flashT > 0) {
        s.flashT -= dt;
        const m = cur.muzzle;
        m.getWorldPosition(_mw);
        flash.position.copy(_mw);
        flash.rotation.z = Math.random() * Math.PI;
        flashMat.opacity = Math.max(0, s.flashT / (0.06));
        flashLight.intensity = 14 * Math.max(0, s.flashT / (0.06));
        flash.visible = true;
      } else flash.visible = false;
    },
  };
  return api;
}
