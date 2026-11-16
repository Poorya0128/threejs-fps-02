// SALTLINE math.js — scratch vectors, seeded RNG, ray tests, helpers.
import * as THREE from 'three';

export const _v0 = new THREE.Vector3();
export const _v1 = new THREE.Vector3();
export const _v3 = new THREE.Vector3();

export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (x, target, rate, dt) => lerp(target, x, Math.exp(-rate * dt));

export function mulberry32(seed) {
	let a = seed >>> 0;
	return function next() {
		a |= 0; a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export function rayAABB(ox, oy, oz, dx, dy, dz, min, max, maxDist) {
	let tmin = 0, tmax = maxDist;
	let t1, t2;
	if (dx !== 0) { const ix = 1 / dx; t1 = (min.x - ox) * ix; t2 = (max.x - ox) * ix; if (t1 > t2) { const t = t1; t1 = t2; t2 = t; } if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; if (tmin > tmax) return -1; }
	else if (ox < min.x || ox > max.x) return -1;
	if (dy !== 0) { const iy = 1 / dy; t1 = (min.y - oy) * iy; t2 = (max.y - oy) * iy; if (t1 > t2) { const t = t1; t1 = t2; t2 = t; } if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; if (tmin > tmax) return -1; }
	else if (oy < min.y || oy > max.y) return -1;
	if (dz !== 0) { const iz = 1 / dz; t1 = (min.z - oz) * iz; t2 = (max.z - oz) * iz; if (t1 > t2) { const t = t1; t1 = t2; t2 = t; } if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; if (tmin > tmax) return -1; }
	else if (oz < min.z || oz > max.z) return -1;
	return tmin;
}

export function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r, maxDist) {
	const lx = cx - ox, ly = cy - oy, lz = cz - oz;
	const tca = lx * dx + ly * dy + lz * dz;
	if (tca < 0) return -1;
	const d2 = lx * lx + ly * ly + lz * lz - tca * tca;
	const r2 = r * r;
	if (d2 > r2) return -1;
	const t = tca - Math.sqrt(r2 - d2);
	return t <= maxDist ? t : -1;
}

export function rayCapsule(ox, oy, oz, dx, dy, dz, ax, ay, az, bx, by, bz, r, maxDist) {
	const abx = bx - ax, aby = by - ay, abz = bz - az;
	const aox = ox - ax, aoy = oy - ay, aoz = oz - az;
	const ab2 = abx * abx + aby * aby + abz * abz;
	const dAb = dx * abx + dy * aby + dz * abz;
	const dAo = dx * aox + dy * aoy + dz * aoz;
	const abAo = abx * aox + aby * aoy + abz * aoz;
	const a = ab2 - dAb * dAb, b = ab2 * dAo - dAb * abAo, c = ab2 * (aox * aox + aoy * aoy + aoz * aoz - r * r) - abAo * abAo;
	if (a <= 1e-9) return raySphere(ox, oy, oz, dx, dy, dz, ax, ay, az, r, maxDist);
	const disc = b * b - a * c;
	if (disc < 0) return -1;
	const t = (-b - Math.sqrt(disc)) / a;
	if (t < 0 || t > maxDist) return -1;
	const s = (dAb * t + abAo) / ab2;
	if (s < 0) return raySphere(ox, oy, oz, dx, dy, dz, ax, ay, az, r, maxDist);
	if (s > 1) return raySphere(ox, oy, oz, dx, dy, dz, bx, by, bz, r, maxDist);
	return t;
}

export function losBlocked(boxes, x0, y0, z0, x1, y1, z1) {
	const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
	const len = Math.hypot(dx, dy, dz);
	if (len < 0.01) return false;
	for (let i = 0; i < boxes.length; i++) {
		const b = boxes[i];
		const t = rayAABB(x0, y0, z0, dx / len, dy / len, dz / len, b.min, b.max, len);
		if (t >= 0 && t < len - 0.05) return true;
	}
	return false;
}

export function smokeBlocks(smokes, time, x0, y0, z0, x1, y1, z1) {
	for (let i = 0; i < smokes.length; i++) {
		const s = smokes[i];
		if (!s.active || time > s.t + s.dur) continue;
		const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
		const len = Math.hypot(dx, dy, dz);
		if (len < 0.01) continue;
		if (raySphere(x0, y0, z0, dx / len, dy / len, dz / len, s.x, s.y, s.z, s.r, len) >= 0) return true;
	}
	return false;
}
