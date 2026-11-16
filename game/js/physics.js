// Shared movement: Quake-style friction and acceleration, gravity, crouch, capsule vs boxes with step-up.
import { MOVE } from './config.js';
import { clamp } from './math.js';
import { pushNoise } from './state.js';

const heightAt = (c) => MOVE.heightStand + (MOVE.heightCrouch - MOVE.heightStand) * c;
const overXZ = (p, b, r) => p.x + r > b.min.x && p.x - r < b.max.x && p.z + r > b.min.z && p.z - r < b.max.z;
function headClear(state, p, h) {
	for (const b of state.boxes) if (overXZ(p, b, MOVE.radius) && p.y + h > b.min.y && p.y < b.max.y) return false;
	return true;
}

export function setCrouch(state, a, want, dt) {
	const c = a.crouch + (want ? 1 : -1) * dt / MOVE.crouchTime;
	if (want || (a.crouch > 0 && headClear(state, a.pos, heightAt(c) + .02))) a.crouch = clamp(c, 0, 1);
	a.eyeHeight = MOVE.eyeStand + (MOVE.eyeCrouch - MOVE.eyeStand) * a.crouch;
}

export function stepAgent(state, a, wx, wz, wish, jump, dt) {
	const v = a.vel;
	let speed = Math.hypot(v.x, v.z);
	if (a.onGround) {
		const k = speed < .05 ? 0 : Math.max(0, speed - Math.max(speed, MOVE.stopSpeed) * MOVE.friction * dt) / speed;
		v.x *= k; v.z *= k;
	}
	const add = Math.min(wish - (v.x * wx + v.z * wz), (a.onGround ? MOVE.accelGround : MOVE.accelAir) * wish * dt);
	if (add > 0) { v.x += wx * add; v.z += wz * add; }
	if (jump && a.onGround && a.crouch < .5) { v.y = MOVE.jumpVel; a.onGround = false; }
	v.y = Math.max(-22, v.y - MOVE.gravity * dt);
	a.prevPos.copy(a.pos);
	a.pos.x += v.x * dt; a.pos.z += v.z * dt;
	collideHorizontal(state, a);
	const fall = v.y;
	a.pos.y += v.y * dt;
	collideVertical(state, a);
	speed = a.speed = Math.hypot(v.x, v.z);
	a.walkPhase += speed * dt * 2.3; a.stepAcc += speed * dt;
	if (a.onGround && a.crouch < .5 && wish > 0 && speed > Math.max(3, wish * .6) && a.stepAcc >= MOVE.stepStride) { a.stepAcc = 0; pushNoise(state, a.pos.x, a.pos.y, a.pos.z, 14, a.team); }
	else if (a.onGround && fall < -4.8) pushNoise(state, a.pos.x, a.pos.y, a.pos.z, 12, a.team);
}

// Up to 3 passes out of overlapping boxes, sliding along them; low boxes are stepped onto.
function collideHorizontal(state, a) {
	const r = MOVE.radius, h = heightAt(a.crouch), p = a.pos, v = a.vel;
	for (let pass = 0, hit = true; pass < 3 && hit; pass++) {
		hit = false;
		for (const b of state.boxes) {
			if (p.y + h <= b.min.y + .001 || p.y >= b.max.y - .001) continue;
			const dx = p.x - clamp(p.x, b.min.x, b.max.x), dz = p.z - clamp(p.z, b.min.z, b.max.z), d2 = dx * dx + dz * dz;
			if (d2 >= r * r) continue;
			hit = true;
			if (a.onGround && b.max.y - p.y <= MOVE.stepUp) { p.y = b.max.y; v.y = 0; }
			else if (d2 < 1e-8) {
				const l = p.x - b.min.x, rt = b.max.x - p.x, n = p.z - b.min.z, s = b.max.z - p.z, m = Math.min(l, rt, n, s);
				if (m === l) p.x = b.min.x - r; else if (m === rt) p.x = b.max.x + r; else if (m === n) p.z = b.min.z - r; else p.z = b.max.z + r;
			} else {
				const d = Math.sqrt(d2), nx = dx / d, nz = dz / d, vn = Math.min(0, v.x * nx + v.z * nz);
				p.x += nx * (r - d); p.z += nz * (r - d); v.x -= vn * nx; v.z -= vn * nz;
			}
		}
	}
}
function collideVertical(state, a) {
	const h = heightAt(a.crouch), p = a.pos, v = a.vel;
	a.onGround = p.y <= 0;
	if (a.onGround) p.y = v.y = 0;
	for (const b of state.boxes) {
		if (!overXZ(p, b, MOVE.radius)) continue;
		if (v.y <= 0 && a.prevPos.y >= b.max.y - .001 && p.y <= b.max.y) { p.y = b.max.y; v.y = 0; a.onGround = true; }
		else if (v.y > 0 && a.prevPos.y + h <= b.min.y + .001 && p.y + h >= b.min.y) { p.y = b.min.y - h; v.y = 0; }
	}
}

export function wishDir(yaw, f, b, l, r, out) {
	const s = Math.sin(yaw), c = Math.cos(yaw), x = (b - f) * s + (r - l) * c, z = (b - f) * c - (r - l) * s, len = Math.hypot(x, z);
	out.set(len ? x / len : 0, 0, len ? z / len : 0);
	return len > 1e-3;
}
