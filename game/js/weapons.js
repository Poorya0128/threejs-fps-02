// SALTLINE weapons.js — gunplay (PLAN.md §7). Player and bots share this
// code path: fire, computeSpread, applyRecoil, reload, switch, traceShot,
// applyHit. Sounds and visuals are driven by state (fxEvents, lastHit).
import * as THREE from 'three';
import { WEAPONS, HIT, ARMOR_RATIO, MOVE, ECON } from './config.js';
import { clamp, rayAABB, raySphere, rayCapsule, _v0, _v1, _v3 } from './math.js';
import { pushFx } from './state.js';

const _eye = new THREE.Vector3();
const _muz = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();

export function giveWeapon(a, id) {
  a.weapons.push(id);
  a.ammo[id] = { mag: WEAPONS[id].mag, reserve: WEAPONS[id].reserve };
}

export function activeWeapon(a) { return WEAPONS[a.weapons[a.active]]; }
export function activeId(a) { return a.weapons[a.active]; }

export function eyePos(a, out) {
  return out.set(a.pos.x, a.pos.y + a.eyeHeight, a.pos.z);
}

// View direction including accumulated aim punch (full recoil).
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

// Spread in radians, recomputed every tick (§7): base (crouch/scope)
// + move + air + bloom. Stopping to aim pays.
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
  const pat = w.kick, i = Math.min(a.shotsFired, pat.length - 1);
  const j = (state.rng() - 0.5) * 0.3;
  a.recoil.pitch += pat[i][0] * (1 + j);
  a.recoil.yaw += pat[i][1] * (1 + j);
  a.spreadBloom += w.spread[4];
  a.shotsFired++;
  a.lastShotT = state.time;
}

// Hitboxes rebuilt from pos/crouch/yaw at trace time (PLAN.md §7):
// head sphere, chest/stomach capsules, arm and leg capsules.
function traceAgent(ox, oy, oz, dx, dy, dz, t, maxDist) {
  const eyeY = t.pos.y + t.eyeHeight;
  const fx = -Math.sin(t.yaw), fz = -Math.cos(t.yaw);
  const rx = Math.cos(t.yaw), rz = -Math.sin(t.yaw);
  let best = -1, group = '';
  const test = (tt, g) => { if (tt >= 0 && tt < maxDist && (best < 0 || tt < best)) { best = tt; group = g; } };
  test(raySphere(ox, oy, oz, dx, dy, dz, t.pos.x, eyeY + 0.05, t.pos.z, 0.14, maxDist), 'head');
  test(rayCapsule(ox, oy, oz, dx, dy, dz, t.pos.x, eyeY - 0.12, t.pos.z, t.pos.x, eyeY - 0.52, t.pos.z, 0.24, maxDist), 'chest');
  test(rayCapsule(ox, oy, oz, dx, dy, dz, t.pos.x, eyeY - 0.52, t.pos.z, t.pos.x, eyeY - 0.85, t.pos.z, 0.22, maxDist), 'stomach');
  for (let s = -1; s <= 1; s += 2) {
    const sx = t.pos.x + rx * 0.3 * s, sz = t.pos.z + rz * 0.3 * s;
    test(rayCapsule(ox, oy, oz, dx, dy, dz, sx, eyeY - 0.18, sz, sx + fx * 0.08, eyeY - 0.78, sz + fz * 0.08, 0.09, maxDist), 'arm');
    const lx = t.pos.x + rx * 0.12 * s, lz = t.pos.z + rz * 0.12 * s;
    test(rayCapsule(ox, oy, oz, dx, dy, dz, lx, eyeY - 0.85, lz, lx, t.pos.y + 0.05, lz, 0.11, maxDist), 'leg');
  }
  return best < 0 ? null : { t: best, target: t, group };
}

// Surface normal of the AABB face nearest the hit point.
function boxNormal(b, p) {
  const dxl = p.x - b.min.x, dxr = b.max.x - p.x;
  const dyl = p.y - b.min.y, dyr = b.max.y - p.y;
  const dzl = p.z - b.min.z, dzr = b.max.z - p.z;
  const m = Math.min(dxl, dxr, dyl, dyr, dzl, dzr);
  if (m === dxl) return _v3.set(-1, 0, 0);
  if (m === dxr) return _v3.set(1, 0, 0);
  if (m === dyl) return _v3.set(0, -1, 0);
  if (m === dyr) return _v3.set(0, 1, 0);
  if (m === dzl) return _v3.set(0, 0, -1);
  return _v3.set(0, 0, 1);
}

// Hitscan: nearest world AABB vs nearest agent hitbox. Closest hit wins.
// Returns {t, point, normal, mat, target, group} or null.
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

// Damage with hitgroup multiplier, range falloff and armor (PLAN.md §4.5/§7).
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
  if (group === 'head') state.shots.heads++;
  pushFx(state, 6, target.pos.x, target.pos.y + 1, target.pos.z, 0, 0, 0, target.id, false); // hit flash
  const killed = target.hp <= 0;
  if (killed) {
    target.hp = 0; target.alive = false; target.deaths++;
    shooter.kills++; state.shots.kills++;
    // Kill reward by weapon class (PLAN.md §4.4).
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
  _right.set(Math.cos(a.yaw), 0, -Math.sin(a.yaw));
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

// One shot. The trace starts at the EYE (the crosshair is the aim point);
 // the tracer starts at the muzzle. Tracing from the muzzle biased shots
// ~0.16 m low / 0.18 m right — enough to turn a headshot into a chest hit.
function firePellet(state, a, w, ex, ey, ez, mx, my, mz, spread, every3rd) {
  viewDir(a, _dir);
  if (spread > 0) {
    const rx = (state.rng() - 0.5) * 2 * spread, ry = (state.rng() - 0.5) * 2 * spread;
    _right.set(Math.cos(a.yaw), 0, -Math.sin(a.yaw));
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
    const back = tf < -0.5; // target faces away from the attacker
    const w = activeWeapon(a);
    applyHit(state, a, t, 'chest', back ? w.backstab : w.dmg, 1, w);
    a.nextFireT = state.time + 0.6;
    return;
  }
  a.nextFireT = state.time + 0.6;
}

// Shared fire path: player via updateWeapons, bots directly
// with (held, edge) = (wantFire, wantFire).
export function tryFire(state, a, held, edge) {
  const w = activeWeapon(a);
  if (w.cls === 'knife') {
    if (edge && state.time >= a.nextFireT) fireKnife(state, a);
    return;
  }
  if (a.switchT > 0 || state.time < a.nextFireT) return;
  if (!w.auto && !edge) return;
  if (w.auto && !held) return;
  if (a.reloadShell > 0) a.reloadShell = 0; // shotgun reload interrupted by firing
  const am = a.ammo[activeId(a)];
  if (am.mag <= 0) {
    a.dryT = state.time; // audio polls this for the dry-fire click
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
  if (state.noise.length > 16) state.noise.shift();
  state.noise.push({ x: a.pos.x, y: a.pos.y, z: a.pos.z, r: w.noise, t: state.time });
}

// Per-tick weapon system for every agent (player input + reload/recoil).
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
    // Recoil + bloom recover; pattern resets once fully recovered.
    const dtLast = state.time - (a.lastShotT || -99);
    if (dtLast > 0.1) {
      const k = Math.exp(-4 * dt);
      a.recoil.pitch *= k; a.recoil.yaw *= k;
      if (Math.abs(a.recoil.pitch) < 0.0005 && a.shotsFired > 0) a.shotsFired = 0;
    }
    a.spreadBloom *= Math.exp(-6 * dt);
  }
  // Weapon switching is attempted first (switchWeapon no-ops while
  // switchT > 0). The RMB scope toggle runs regardless of switchT: it is a
  // single-press edge, and dropping it when the press lands inside the
  // 0.35 s switch window made the scope silently miss. Fire/reload stay
  // blocked until the switch finishes.
  if (inp.slot > 0) { switchWeapon(state, p, inp.slot - 1); }
  else if (inp.lastWeapon) switchWeapon(state, p, p.lastWeapon);
  else if (inp.wheel !== 0) {
    const d = inp.wheel > 0 ? 1 : -1;
    switchWeapon(state, p, (p.active + d + p.weapons.length) % p.weapons.length);
  }
  // RMB cycles the Longbow scope (0 → 1 → 2 → 0); other weapons ignore it.
  if (inp.alt && !p.prevAlt) {
    const w = activeWeapon(p);
    if (w.scope) { p.scopeLevel = (p.scopeLevel + 1) % 3; p.scoped = p.scopeLevel > 0; }
  }
  p.prevAlt = inp.alt;
  if (!p.alive || p.switchT > 0 || state.phase === 'buy' || state.phase === 'post' || state.phase === 'matchEnd') { inp.reload = false; inp.slot = 0; inp.lastWeapon = false; inp.wheel = 0; inp.fireEdge = false; return; }
  if (inp.reload) startReload(state, p);
  tryFire(state, p, inp.fire, inp.fireEdge);
  inp.reload = false; inp.slot = 0; inp.lastWeapon = false; inp.wheel = 0; inp.fireEdge = false;
}
