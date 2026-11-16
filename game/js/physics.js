// SALTLINE physics.js — movement shared by the player and bots: Quake-style friction and acceleration (stopping to
// aim pays), gravity and jumps, smoothed crouch with a head check, and a vertical capsule resolved against the map
// boxes with a 0.4 m step-up. Running steps and hard landings make noise.
import { MOVE } from './config.js';
import { clamp } from './math.js';
import { pushNoise } from './state.js';

function accelerate(a, wx, wz, wishSpeed, accel, dt) {
	const add = wishSpeed - (a.vel.x * wx + a.vel.z * wz);
	if (add <= 0) return;
	const k = Math.min(accel * wishSpeed * dt, add);
	a.vel.x += wx * k; a.vel.z += wz * k;
}
function friction(a, dt) {
	const speed = Math.hypot(a.vel.x, a.vel.z);
	if (speed < .05) { a.vel.x = a.vel.z = 0; return; }
	const k = Math.max(0, speed - Math.max(speed, MOVE.stopSpeed) * MOVE.friction * dt) / speed;
	a.vel.x *= k; a.vel.z *= k;
}

const heightAt = (c) => MOVE.heightStand + (MOVE.heightCrouch - MOVE.heightStand) * c;
const overlapsXZ = (a, b, r) => a.pos.x + r > b.min.x && a.pos.x - r < b.max.x && a.pos.z + r > b.min.z && a.pos.z - r < b.max.z;
function headClear(state, a, h) {
	for (const b of state.boxes) if (overlapsXZ(a, b, MOVE.radius) && a.pos.y + h > b.min.y && a.pos.y < b.max.y) return false;
	return true;
}
// Crouch eases in over MOVE.crouchTime; standing up waits for head room.
export function setCrouch(state, a, want, dt) {
	const rate = dt / MOVE.crouchTime;
	if (want) a.crouch = Math.min(1, a.crouch + rate);
	else if (a.crouch > 0 && headClear(state, a, heightAt(Math.max(0, a.crouch - rate)) + .02)) a.crouch = Math.max(0, a.crouch - rate);
	a.eyeHeight = MOVE.eyeStand + (MOVE.eyeCrouch - MOVE.eyeStand) * a.crouch;
}

export function stepAgent(state, a, wx, wz, wishSpeed, jump, dt) {
	if (a.onGround) friction(a, dt);
	accelerate(a, wx, wz, wishSpeed, a.onGround ? MOVE.accelGround : MOVE.accelAir, dt);
	if (jump && a.onGround && a.crouch < .5) { a.vel.y = MOVE.jumpVel; a.onGround = false; }
	a.vel.y = Math.max(-22, a.vel.y - MOVE.gravity * dt);
	a.prevPos.copy(a.pos);
	a.pos.x += a.vel.x * dt; a.pos.z += a.vel.z * dt;
	collideHorizontal(state, a);
	const fall = a.vel.y;
	a.pos.y += a.vel.y * dt;
	collideVertical(state, a);
	const speed = a.speed = Math.hypot(a.vel.x, a.vel.z);
	a.walkPhase += speed * dt * 2.3; a.stepAcc += speed * dt;
	if (a.onGround && a.crouch < .5 && wishSpeed > 0 && speed > wishSpeed * .6 && speed > 3 && a.stepAcc >= MOVE.stepNoiseStride) { a.stepAcc = 0; pushNoise(state, a.pos.x, a.pos.y, a.pos.z, 14, a.team); }
	else if (a.onGround && fall < -MOVE.landNoiseMinFall * 4) pushNoise(state, a.pos.x, a.pos.y, a.pos.z, 12, a.team);
}

// Push the capsule out of every overlapping box along the shortest horizontal direction (up to 3 passes), sliding
// along walls; boxes lower than the step-up lift the agent onto them instead.
function collideHorizontal(state, a) {
	const r = MOVE.radius, h = heightAt(a.crouch), p = a.pos;
	for (let pass = 0, hit = true; pass < 3 && hit; pass++) {
		hit = false;
		for (const b of state.boxes) {
			if (p.y + h <= b.min.y + .001 || p.y >= b.max.y - .001) continue;
			const dx = p.x - clamp(p.x, b.min.x, b.max.x), dz = p.z - clamp(p.z, b.min.z, b.max.z), d2 = dx * dx + dz * dz;
			if (d2 >= r * r) continue;
			hit = true;
			if (a.onGround && b.max.y - p.y <= MOVE.stepUp) { p.y = b.max.y; a.vel.y = 0; continue; }
			if (d2 < 1e-8) { // centre inside the box: leave by the nearest side
				const l = p.x - b.min.x, rt = b.max.x - p.x, n = p.z - b.min.z, s = b.max.z - p.z, m = Math.min(l, rt, n, s);
				if (m === l) p.x = b.min.x - r; else if (m === rt) p.x = b.max.x + r; else if (m === n) p.z = b.min.z - r; else p.z = b.max.z + r;
				continue;
			}
			const d = Math.sqrt(d2), nx = dx / d, nz = dz / d, vn = a.vel.x * nx + a.vel.z * nz;
			p.x += nx * (r - d); p.z += nz * (r - d);
			if (vn < 0) { a.vel.x -= vn * nx; a.vel.z -= vn * nz; }
		}
	}
}
function collideVertical(state, a) {
	const h = heightAt(a.crouch), p = a.pos;
	a.onGround = false;
	for (const b of state.boxes) {
		if (!overlapsXZ(a, b, MOVE.radius)) continue;
		if (a.vel.y <= 0 && a.prevPos.y >= b.max.y - .001 && p.y <= b.max.y) { p.y = b.max.y; a.vel.y = 0; a.onGround = true; }
		else if (a.vel.y > 0 && a.prevPos.y + h <= b.min.y + .001 && p.y + h >= b.min.y) { p.y = b.min.y - h; a.vel.y = 0; }
	}
	if (p.y <= 0) { p.y = 0; a.vel.y = 0; a.onGround = true; }
}

// Unit wish direction from WASD relative to yaw (forward is -z at yaw 0); false when no key is held.
export function wishDir(yaw, f, b, l, r, out) {
	const s = Math.sin(yaw), c = Math.cos(yaw), x = (b - f) * s + (r - l) * c, z = (b - f) * c - (r - l) * s, len = Math.hypot(x, z);
	if (len < 1e-3) { out.set(0, 0, 0); return false; }
	out.set(x / len, 0, z / len);
	return true;
}
