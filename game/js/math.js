// SALTLINE math.js — seeded RNG, easing and the ray tests used by shooting, sight, AO and collision.
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (x, target, rate, dt) => lerp(target, x, Math.exp(-rate * dt));

export function mulberry32(seed) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

// Slab test: distance along the unit ray to the box, or -1 when it misses within maxDist.
let t0 = 0, t1 = 0;
function slab(o, d, lo, hi) {
	if (d === 0) return o >= lo && o <= hi;
	const i = 1 / d, p = (lo - o) * i, q = (hi - o) * i;
	t0 = Math.max(t0, Math.min(p, q)); t1 = Math.min(t1, Math.max(p, q));
	return t0 <= t1;
}
export function rayAABB(ox, oy, oz, dx, dy, dz, min, max, maxDist) {
	t0 = 0; t1 = maxDist;
	return slab(ox, dx, min.x, max.x) && slab(oy, dy, min.y, max.y) && slab(oz, dz, min.z, max.z) ? t0 : -1;
}

export function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r, maxDist) {
	const lx = cx - ox, ly = cy - oy, lz = cz - oz, tca = lx * dx + ly * dy + lz * dz;
	if (tca < 0) return -1;
	const d2 = lx * lx + ly * ly + lz * lz - tca * tca;
	if (d2 > r * r) return -1;
	const t = tca - Math.sqrt(r * r - d2);
	return t <= maxDist ? t : -1;
}

// Capsule = cylinder a→b of radius r with spherical caps (hitboxes for limbs and torso).
export function rayCapsule(ox, oy, oz, dx, dy, dz, ax, ay, az, bx, by, bz, r, maxDist) {
	const abx = bx - ax, aby = by - ay, abz = bz - az, aox = ox - ax, aoy = oy - ay, aoz = oz - az;
	const ab2 = abx * abx + aby * aby + abz * abz, dAb = dx * abx + dy * aby + dz * abz;
	const dAo = dx * aox + dy * aoy + dz * aoz, abAo = abx * aox + aby * aoy + abz * aoz;
	const a = ab2 - dAb * dAb, b = ab2 * dAo - dAb * abAo, c = ab2 * (aox * aox + aoy * aoy + aoz * aoz - r * r) - abAo * abAo;
	if (a <= 1e-9) return raySphere(ox, oy, oz, dx, dy, dz, ax, ay, az, r, maxDist);
	const disc = b * b - a * c;
	if (disc < 0) return -1;
	const t = (-b - Math.sqrt(disc)) / a;
	if (t < 0 || t > maxDist) return -1;
	const s = (dAb * t + abAo) / ab2;
	return s < 0 ? raySphere(ox, oy, oz, dx, dy, dz, ax, ay, az, r, maxDist) : s > 1 ? raySphere(ox, oy, oz, dx, dy, dz, bx, by, bz, r, maxDist) : t;
}

// Is the segment 0→1 blocked by a map box (ignoring the last `end` metres)? smokeBlocks: by a live Veil cloud?
export function losBlocked(boxes, x0, y0, z0, x1, y1, z1, end = .05) {
	const len = Math.hypot(x1 - x0, y1 - y0, z1 - z0);
	if (len < .01) return false;
	const dx = (x1 - x0) / len, dy = (y1 - y0) / len, dz = (z1 - z0) / len;
	for (const b of boxes) { const t = rayAABB(x0, y0, z0, dx, dy, dz, b.min, b.max, len); if (t >= 0 && t < len - end) return true; }
	return false;
}
export function smokeBlocks(smokes, time, x0, y0, z0, x1, y1, z1) {
	const len = Math.hypot(x1 - x0, y1 - y0, z1 - z0);
	if (len < .01) return false;
	for (const s of smokes) if (s.active && time <= s.t + s.dur && raySphere(x0, y0, z0, (x1 - x0) / len, (y1 - y0) / len, (z1 - z0) / len, s.x, s.y, s.z, s.r, len) >= 0) return true;
	return false;
}
