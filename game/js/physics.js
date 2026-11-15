// SALTLINE physics.js — Quake-style ground model, capsule vs AABB
// collision, step-up (PLAN.md §6). Player and bots share this code path.
import * as THREE from 'three';
import { MOVE } from './config.js';
import { clamp } from './math.js';

const _wish = new THREE.Vector3();

// Friction then accelerate along a wish direction (Quake model).
export function applyFriction(a, dt) {
  const vx = a.vel.x, vz = a.vel.z;
  const speed = Math.hypot(vx, vz);
  if (speed < 0.05) { a.vel.x = 0; a.vel.z = 0; return; }
  const control = Math.max(speed, MOVE.stopSpeed);
  const drop = control * MOVE.friction * dt;
  const ns = Math.max(0, speed - drop) / speed;
  a.vel.x *= ns; a.vel.z *= ns;
}

export function accelerate(a, wx, wz, wishSpeed, accel, dt) {
  const cur = a.vel.x * wx + a.vel.z * wz;
  const add = wishSpeed - cur;
  if (add <= 0) return;
  const acc = Math.min(accel * wishSpeed * dt, add);
  a.vel.x += wx * acc; a.vel.z += wz * acc;
}

// Smooth crouch 0..1 over MOVE.crouchTime; refuses to stand under a ceiling.
export function setCrouch(state, a, wantCrouch, dt) {
  const target = wantCrouch ? 1 : 0;
  const rate = dt / MOVE.crouchTime;
  if (target < a.crouch) {
    // Standing up: probe the head space first.
    const h = heightAt(a.crouch);
    const standH = MOVE.heightStand;
    if (headClear(state, a, standH)) a.crouch = Math.max(0, a.crouch - rate);
    else a.crouch = Math.min(a.crouch, crouchForHeight(state, a, h));
  } else {
    a.crouch = Math.min(1, a.crouch + rate);
  }
  a.eyeHeight = MOVE.eyeStand + (MOVE.eyeCrouch - MOVE.eyeStand) * a.crouch;
}

function heightAt(crouch) {
  return MOVE.heightStand + (MOVE.heightCrouch - MOVE.heightStand) * crouch;
}

function crouchForHeight(state, a, h) {
  // Largest crouch (0..1) whose capsule height still fits under the ceiling.
  for (let c = a.crouch; c <= 1.0001; c += 0.05) {
    if (!headClear(state, a, heightAt(c))) return Math.max(0, c - 0.05);
  }
  return 1;
}

// Is there room for a capsule of height h standing on the agent's feet?
function headClear(state, a, h) {
  const r = MOVE.radius, x = a.pos.x, z = a.pos.z;
  const minY = a.pos.y, maxY = a.pos.y + h;
  for (let i = 0; i < state.boxes.length; i++) {
    const b = state.boxes[i];
    if (x + r <= b.min.x || x - r >= b.max.x) continue;
    if (z + r <= b.min.z || z - r >= b.max.z) continue;
    if (maxY <= b.min.y || minY >= b.max.y) continue;
    return false;
  }
  return true;
}

// One fixed tick of movement for an agent. wishX/wishZ is the normalized
// move direction in world space; speed is the target speed.
export function stepAgent(state, a, wishX, wishZ, wishSpeed, jump, dt) {
  // --- horizontal ---
  if (a.onGround) {
    applyFriction(a, dt);
    accelerate(a, wishX, wishZ, wishSpeed, MOVE.accelGround, dt);
  } else {
    accelerate(a, wishX, wishZ, wishSpeed, MOVE.accelAir, dt);
  }
  // --- vertical ---
  if (jump && a.onGround) { a.vel.y = MOVE.jumpVel; a.onGround = false; }
  a.vel.y -= MOVE.gravity * dt;
  if (a.vel.y < -22) a.vel.y = -22;

  a.prevPos.copy(a.pos);
  a.pos.x += a.vel.x * dt;
  a.pos.z += a.vel.z * dt;
  collideHorizontal(state, a);
  a.pos.y += a.vel.y * dt;
  collideVertical(state, a);
}

function collideHorizontal(state, a) {
  const r = MOVE.radius, h = heightAt(a.crouch);
  for (let iter = 0; iter < 3; iter++) {
    let pushed = false;
    for (let i = 0; i < state.boxes.length; i++) {
      const b = state.boxes[i];
      // Vertical overlap with the capsule?
      if (a.pos.y + h <= b.min.y + 0.001 || a.pos.y >= b.max.y - 0.001) continue;
      const cx = clamp(a.pos.x, b.min.x, b.max.x);
      const cz = clamp(a.pos.z, b.min.z, b.max.z);
      const dx = a.pos.x - cx, dz = a.pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      // Inside the box in plan view: push out along the least-penetration axis.
      if (d2 < 1e-8) {
        const pl = a.pos.x - b.min.x, pr = b.max.x - a.pos.x;
        const pb = a.pos.z - b.min.z, pf = b.max.z - a.pos.z;
        const m = Math.min(pl, pr, pb, pf);
        if (m === pl) a.pos.x = b.min.x - r;
        else if (m === pr) a.pos.x = b.max.x + r;
        else if (m === pb) a.pos.z = b.min.z - r;
        else a.pos.z = b.max.z + r;
        pushed = true; continue;
      }
      const d = Math.sqrt(d2);
      // Step-up: low obstacle, on ground, top within step height.
      if (a.onGround && b.max.y - a.pos.y <= MOVE.stepUp && b.max.y > a.pos.y) {
        a.pos.y = b.max.y; a.vel.y = 0; a.onGround = true; pushed = true; continue;
      }
      const push = (r - d) / d;
      a.pos.x += dx * push; a.pos.z += dz * push;
      // Kill velocity into the wall so we slide instead of sticking.
      const nx = dx / d, nz = dz / d;
      const vn = a.vel.x * nx + a.vel.z * nz;
      if (vn < 0) { a.vel.x -= vn * nx; a.vel.z -= vn * nz; }
      pushed = true;
    }
    if (!pushed) break;
  }
}

function collideVertical(state, a) {
  const r = MOVE.radius, h = heightAt(a.crouch);
  let grounded = false;
  for (let i = 0; i < state.boxes.length; i++) {
    const b = state.boxes[i];
    if (a.pos.x + r <= b.min.x || a.pos.x - r >= b.max.x) continue;
    if (a.pos.z + r <= b.min.z || a.pos.z - r >= b.max.z) continue;
    // Falling onto the top face.
    if (a.vel.y <= 0 && a.prevPos.y >= b.max.y - 0.001 && a.pos.y <= b.max.y) {
      a.pos.y = b.max.y; a.vel.y = 0; grounded = true;
    }
    // Hitting the underside.
    else if (a.vel.y > 0 && a.prevPos.y + h <= b.min.y + 0.001 && a.pos.y + h >= b.min.y) {
      a.pos.y = b.min.y - h; a.vel.y = 0;
    }
  }
  if (a.pos.y <= 0) { // the ground slab top is y=0; safety floor
    a.pos.y = 0; a.vel.y = 0; grounded = true;
  }
  a.onGround = grounded;
}

// Wish direction from yaw + input (forward is -Z rotated by yaw).
export function wishDir(yaw, f, b, l, r, out) {
  const sy = Math.sin(yaw), cy = Math.cos(yaw);
  // Forward vector (yaw=0 faces -Z, north at spawn):
  // forward = (-sin(yaw), 0, -cos(yaw)); right = (cos(yaw), 0, -sin(yaw)).
  let x = 0, z = 0;
  if (f) { x += -sy; z += -cy; }
  if (b) { x += sy; z += cy; }
  if (l) { x += -cy; z += sy; }
  if (r) { x += cy; z += -sy; }
  const len = Math.hypot(x, z);
  if (len < 0.001) { out.set(0, 0, 0); return 0; }
  out.set(x / len, 0, z / len);
  return 1;
}
