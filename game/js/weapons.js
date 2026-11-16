// SALTLINE weapons.js — gunplay (PLAN.md §7). Player and bots share this
import * as THREE from 'three';
import { WEAPONS, HIT, ARMOR_RATIO, MOVE, ECON } from './config.js';
import { clamp, rayAABB, raySphere, rayCapsule, _v0, _v1, _v3 } from './math.js';
import { pushFx, pushNoise } from './state.js';
import { throwGrenade } from './grenades.js';

const _eye = new THREE.Vector3();
const _muz = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();

export function giveWeapon(a, id) {
  const w = WEAPONS[id];
  const grp = (x) => (x.cls === 'pistol' ? 1 : x.cls === 'knife' ? 2 : 0);
  let idx = -1;
  for (let i = 0; i < a.weapons.length; i++) if (grp(WEAPONS[a.weapons[i]]) === grp(w)) { idx = i; break; }
  if (idx < 0) { idx = a.weapons.length; a.weapons.push(id); }
  else a.weapons[idx] = id;
  a.ammo[id] = { mag: w.mag, reserve: w.reserve };
  return idx;
}

export function activeWeapon(a) { return WEAPONS[a.weapons[a.active]]; }
export function activeId(a) { return a.weapons[a.active]; }

export function eyePos(a, out) {
  return out.set(a.pos.x, a.pos.y + a.eyeHeight, a.pos.z);
}

export function viewDir(a, out) {
  const yaw = a.yaw + a.recoil.yaw, pitch = a.pitch + a.recoil.pitch;
  const cp = Math.cos(pitch);
  return out.set(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp);
}

function maxSpeed(a) {
  const w = activeWeapon(a);
  let s = MOVE.speed[w.cls] ?? MOVE.defaultSpeed;
  if (a.scoped) s *= MOVE.scopeMul;
  return s;
}

export function computeSpread(a) {
  const w = activeWeapon(a);
  if (w.cls === 'knife') return 0;
  const s = w.spread;
  let base = s[0];
  if (a.crouch > 0.5) base *= s[1];
  if (a.scoped && w.scopedSpread) base = w.scopedSpread;
  const speed = Math.hypot(a.vel.x, a.vel.z);
  const move = 0.02 * s[2] * clamp(speed / maxSpeed(a), 0, 1);
  const air = a.onGround ? 0 : s[3];
  return base + move + air + a.spreadBloom;
}

export function applyRecoil(state, a, w) {
  const k = w.kick, i = Math.min(a.shotsFired, k[3] - 1);
  const j = (state.rng() - 0.5) * 0.3;
  a.recoil.pitch += (k[0] + k[1] * i) * (1 + j);
  a.recoil.yaw += (i % 2 ? k[2] : -k[2]) * (i ? 0.5 + 0.5 * i / Math.max(1, k[3] - 1) : 0) * (1 + j);
  a.spreadBloom += w.spread[4];
  a.shotsFired++;
  a.lastShotT = state.time;
}

function traceAgent(ox, oy, oz, dx, dy, dz, t, maxDist) {
  const eyeY = t.pos.y + t.eyeHeight;
  const fx = -Math.sin(t.yaw), fz = -Math.cos(t.yaw);
  const rx = Math.cos(t.yaw), rz = -Math.sin(t.yaw);
  let best = -1, group = '';
  const test = (tt, g) => { if (tt >= 0 && tt < maxDist && (best < 0 || tt < best)) { best = tt; group = g; } };
  const cap = (ax, ay, az, bx, by, bz, r, g) => test(rayCapsule(ox, oy, oz, dx, dy, dz, ax, ay, az, bx, by, bz, r, maxDist), g);
  cap(t.pos.x, eyeY - 0.12, t.pos.z, t.pos.x, eyeY - 0.52, t.pos.z, 0.24, 'chest');
  cap(t.pos.x, eyeY - 0.52, t.pos.z, t.pos.x, eyeY - 0.85, t.pos.z, 0.22, 'stomach');
  test(raySphere(ox, oy, oz, dx, dy, dz, t.pos.x, eyeY + 0.05, t.pos.z, 0.14, maxDist), 'head');
  for (let s = -1; s <= 1; s += 2) {
    const sx = t.pos.x + rx * 0.3 * s, sz = t.pos.z + rz * 0.3 * s;
    cap(sx, eyeY - 0.18, sz, sx + fx * 0.08, eyeY - 0.78, sz + fz * 0.08, 0.09, 'arm');
    const lx = t.pos.x + rx * 0.12 * s, lz = t.pos.z + rz * 0.12 * s;
    cap(lx, eyeY - 0.85, lz, lx, t.pos.y + 0.05, lz, 0.11, 'leg');
  }
  return best < 0 ? null : { t: best, target: t, group };
}

function boxNormal(b, p) {
  const d = [p.x - b.min.x, b.max.x - p.x, p.y - b.min.y, b.max.y - p.y, p.z - b.min.z, b.max.z - p.z];
  const i = d.indexOf(Math.min(...d));
  return _v3.set(i === 0 ? -1 : i === 1 ? 1 : 0, i === 2 ? -1 : i === 3 ? 1 : 0, i === 4 ? -1 : i === 5 ? 1 : 0);
}

export function traceShot(state, shooter, ox, oy, oz, dx, dy, dz, maxDist) {
  let tw = -1, wb = null;
  for (let i = 0; i < state.boxes.length; i++) {
    const b = state.boxes[i];
    const t = rayAABB(ox, oy, oz, dx, dy, dz, b.min, b.max, maxDist);
    if (t >= 0 && (tw < 0 || t < tw)) { tw = t; wb = b; }
  }
  let ta = null;
  for (const a of state.agents) {
    if (a === shooter || !a.alive || a.team === shooter.team) continue;
    const h = traceAgent(ox, oy, oz, dx, dy, dz, a, maxDist);
    if (h && (!ta || h.t < ta.t)) ta = h;
  }
  if (ta && (tw < 0 || ta.t < tw)) {
    return { t: ta.t, point: _v0.set(ox + dx * ta.t, oy + dy * ta.t, oz + dz * ta.t), target: ta.target, group: ta.group, mat: -1, normal: null };
  }
  if (tw >= 0) {
    const p = _v0.set(ox + dx * tw, oy + dy * tw, oz + dz * tw);
    return { t: tw, point: p, target: null, group: '', mat: wb.mat, normal: boxNormal(wb, p) };
  }
  return null;
}

export function applyHit(state, shooter, target, group, dmg, dist, w) {
  let total = dmg * Math.pow(w.falloff, dist / 25);
  total *= group === 'head' ? (target.helm ? HIT.headHelm : HIT.head) : HIT[group];
  total = Math.round(total);
  if (group !== 'head' && target.armor > 0) {
    const toArmor = Math.min(target.armor, total * ARMOR_RATIO);
    target.armor -= toArmor;
    target.hp -= total - toArmor;
  } else target.hp -= total;
  state.shots.hits++;
  if (group === 'head') { state.shots.heads++; shooter.headshots++; }
  state.spottedT[target.id] = state.time;
  pushFx(state, 6, target.pos.x, target.pos.y + 1, target.pos.z, 0, 0, 0, target.id, false);
  const killed = target.hp <= 0;
  if (killed) {
    target.hp = 0; target.alive = false; target.deaths++;
    shooter.kills++; state.shots.kills++;
    shooter.money = Math.min(ECON.cap, shooter.money + (ECON.kill[w.cls] || 0));
    state.killfeed.push({ text: `${shooter.name} ▸ ${target.name} · ${w.name}`, head: group === 'head', t: state.time });
    if (state.killfeed.length > 5) state.killfeed.shift();
  }
  shooter.lastHit = { t: state.time, head: group === 'head', killed };
  return killed;
}

function muzzlePos(a, out) {
  eyePos(a, out);
  viewDir(a, _dir);
  rightOf(a, _right);
  out.addScaledVector(_dir, 0.55).addScaledVector(_right, 0.18);
  out.y -= 0.16;
  return out;
}

function startReload(state, a) {
  const w = activeWeapon(a), am = a.ammo[activeId(a)];
  if (!am || am.mag >= w.mag || am.reserve <= 0 || a.reloadT > 0) return;
  if (w.shell) a.reloadShell = w.reload;
  else a.reloadT = w.reload;
}

function finishReload(a) {
  const w = activeWeapon(a), am = a.ammo[activeId(a)];
  const need = w.mag - am.mag, take = Math.min(need, am.reserve);
  am.mag += take; am.reserve -= take;
}

export function switchWeapon(state, a, idx) {
  if (idx < 0 || idx >= a.weapons.length || idx === a.active || a.switchT > 0) return;
  a.lastWeapon = a.active; a.active = idx;
  a.switchT = 0.35; a.reloadT = 0; a.reloadShell = 0;
  a.scoped = false; a.scopeLevel = 0;
  a.shotsFired = 0; a.recoil.pitch = 0; a.recoil.yaw = 0; a.spreadBloom = 0;
}

function rightOf(a, out) { return out.set(Math.cos(a.yaw), 0, -Math.sin(a.yaw)); }

function firePellet(state, a, w, ex, ey, ez, mx, my, mz, spread, every3rd) {
  viewDir(a, _dir);
  if (spread > 0) {
    const rx = (state.rng() - 0.5) * 2 * spread, ry = (state.rng() - 0.5) * 2 * spread;
    rightOf(a, _right);
    _dir.addScaledVector(_right, rx).addScaledVector(_up.set(0, 1, 0), ry).normalize();
  }
  const hit = traceShot(state, a, ex, ey, ez, _dir.x, _dir.y, _dir.z, 200);
  const end = hit ? hit.point : _v1.set(ex + _dir.x * 200, ey + _dir.y * 200, ez + _dir.z * 200);
  if (hit && hit.target) applyHit(state, a, hit.target, hit.group, w.dmg, hit.t, w);
  else if (hit) {
    pushFx(state, 2, end.x, end.y, end.z, hit.normal.x, hit.normal.y, hit.normal.z, hit.mat, false);
    pushFx(state, 3, end.x, end.y, end.z, 0, 0, 0, hit.mat, false);
  }
  if (every3rd) pushFx(state, 0, mx, my, mz, end.x, end.y, end.z, 0, false);
}

function fireKnife(state, a) {
  eyePos(a, _eye); viewDir(a, _dir);
  const cx = _eye.x + _dir.x * 1.2, cy = _eye.y + _dir.y * 1.2, cz = _eye.z + _dir.z * 1.2;
  for (const t of state.agents) {
    if (t === a || !t.alive || t.team === a.team) continue;
    const dx = t.pos.x - cx, dy = (t.pos.y + 1.0) - cy, dz = t.pos.z - cz;
    if (dx * dx + dy * dy + dz * dz > 1.1) continue;
    const tf = -Math.sin(t.yaw) * (a.pos.x - t.pos.x) + -Math.cos(t.yaw) * (a.pos.z - t.pos.z);
    const back = tf < -0.5;
    const w = activeWeapon(a);
    applyHit(state, a, t, 'chest', back ? w.backstab : w.dmg, 1, w);
    a.nextFireT = state.time + 0.6;
    return;
  }
  a.nextFireT = state.time + 0.6;
}

export function tryFire(state, a, held, edge) {
  const w = activeWeapon(a);
  if (w.cls === 'knife') {
    if (edge && state.time >= a.nextFireT) fireKnife(state, a);
    return;
  }
  if (a.switchT > 0 || state.time < a.nextFireT) return;
  if (!w.auto && !edge) return;
  if (w.auto && !held) return;
  if (a.reloadShell > 0) a.reloadShell = 0;
  const am = a.ammo[activeId(a)];
  if (am.mag <= 0) {
    a.dryT = state.time;
    a.nextFireT = state.time + 0.3;
    startReload(state, a);
    return;
  }
  am.mag--;
  a.nextFireT = state.time + 60 / w.rpm;
  state.shots.fired++;
  applyRecoil(state, a, w);
  eyePos(a, _eye);
  muzzlePos(a, _muz);
  pushFx(state, 1, _muz.x, _muz.y, _muz.z, 0, 0, 0, 0, false);
  pushFx(state, 4, _muz.x, _muz.y, _muz.z, Math.cos(a.yaw), 0, -Math.sin(a.yaw), 0, false);
  const spread = computeSpread(a);
  const n = w.pellets;
  for (let i = 0; i < n; i++) firePellet(state, a, w, _eye.x, _eye.y, _eye.z, _muz.x, _muz.y, _muz.z, spread, state.shots.fired % 3 === 0 && i === 0);
  pushNoise(state, a.pos.x, a.pos.y, a.pos.z, w.noise, a.team);
}

export function updateWeapons(state, dt) {
  const p = state.player, inp = state.input;
  for (const a of state.agents) {
    if (!a.alive) continue;
    if (a.reloadT > 0) {
      a.reloadT -= dt;
      if (a.reloadT <= 0) { a.reloadT = 0; finishReload(a); }
    } else if (a.reloadShell > 0) {
      a.reloadShell -= dt;
      if (a.reloadShell <= 0) {
        const w = activeWeapon(a), am = a.ammo[activeId(a)];
        if (am.mag < w.mag && am.reserve > 0) { am.mag++; am.reserve--; a.reloadShell = w.reload; }
        else a.reloadShell = 0;
      }
    }
    if (a.switchT > 0) a.switchT -= dt;
    const dtLast = state.time - (a.lastShotT || -99);
    if (dtLast > 0.1) {
      const k = Math.exp(-4 * dt);
      a.recoil.pitch *= k; a.recoil.yaw *= k;
      if (Math.abs(a.recoil.pitch) < 0.0005 && a.shotsFired > 0) a.shotsFired = 0;
    }
    a.spreadBloom *= Math.exp(-6 * dt);
  }
  if (inp.slot === 4) {
    const kinds = ['shard', 'veil', 'glare'].filter((k) => p.nades[k] > 0);
    if (kinds.length) { p.nadeSel = kinds[(kinds.indexOf(p.nadeSel) + 1) % kinds.length]; p.grenadeMode = true; }
  } else if (inp.slot > 0) { switchWeapon(state, p, inp.slot - 1); p.grenadeMode = false; }
  else if (inp.lastWeapon) { switchWeapon(state, p, p.lastWeapon); p.grenadeMode = false; }
  else if (inp.wheel !== 0) {
    const d = inp.wheel > 0 ? 1 : -1;
    switchWeapon(state, p, (p.active + d + p.weapons.length) % p.weapons.length);
    p.grenadeMode = false;
  }
  const altEdge = inp.alt && !p.prevAlt;
  if (altEdge && !p.grenadeMode) {
    const w = activeWeapon(p);
    if (w.scope) { p.scopeLevel = (p.scopeLevel + 1) % 3; p.scoped = p.scopeLevel > 0; }
  }
  p.prevAlt = inp.alt;
  if (!p.alive || p.switchT > 0 || state.phase === 'buy' || state.phase === 'post' || state.phase === 'matchEnd') { inp.reload = false; inp.slot = 0; inp.lastWeapon = false; inp.wheel = 0; inp.fireEdge = false; return; }
  if (inp.reload) startReload(state, p);
  if (p.grenadeMode) {
    if (inp.fireEdge) throwGrenade(state, p, false);
    else if (altEdge) throwGrenade(state, p, true);
  } else tryFire(state, p, inp.fire, inp.fireEdge);
  inp.reload = false; inp.slot = 0; inp.lastWeapon = false; inp.wheel = 0; inp.fireEdge = false;
}
