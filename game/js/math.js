// Seeded RNG, easing and the ray tests behind shooting, sight, AO and collision.
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const damp = (x, target, rate, dt) => target + (x - target) * Math.exp(-rate * dt);

export function mulberry32(seed) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

let t0 = 0, t1 = 0;
function slab(o, d, lo, hi) {
	if (d === 0) return o >= lo && o <= hi;
	const p = (lo - o) / d, q = (hi - o) / d;
	t0 = Math.max(t0, Math.min(p, q)); t1 = Math.min(t1, Math.max(p, q));
	return t0 <= t1;
}
export function rayAABB(ox, oy, oz, dx, dy, dz, min, max, maxDist) {
	t0 = 0; t1 = maxDist;
	return slab(ox, dx, min.x, max.x) && slab(oy, dy, min.y, max.y) && slab(oz, dz, min.z, max.z) ? t0 : -1;
}

export function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r, maxDist) {
	const lx = cx - ox, ly = cy - oy, lz = cz - oz, tca = lx * dx + ly * dy + lz * dz, d2 = lx * lx + ly * ly + lz * lz - tca * tca;
	if (tca < 0 || d2 > r * r) return -1;
	const t = tca - Math.sqrt(r * r - d2);
	return t <= maxDist ? t : -1;
}

export function rayCapsule(ox, oy, oz, dx, dy, dz, ax, ay, az, bx, by, bz, r, maxDist) {
	const abx = bx - ax, aby = by - ay, abz = bz - az, aox = ox - ax, aoy = oy - ay, aoz = oz - az;
	const ab2 = abx * abx + aby * aby + abz * abz, dAb = dx * abx + dy * aby + dz * abz, abAo = abx * aox + aby * aoy + abz * aoz;
	const a = ab2 - dAb * dAb, b = ab2 * (dx * aox + dy * aoy + dz * aoz) - dAb * abAo, c = ab2 * (aox * aox + aoy * aoy + aoz * aoz - r * r) - abAo * abAo;
	const disc = b * b - a * c, t = (-b - Math.sqrt(disc)) / a, s = (dAb * t + abAo) / ab2;
	if (a > 1e-9 && disc >= 0 && s >= 0 && s <= 1) return t >= 0 && t <= maxDist ? t : -1;
	if (a > 1e-9 && disc < 0) return -1;
	return s > 1 ? raySphere(ox, oy, oz, dx, dy, dz, bx, by, bz, r, maxDist) : raySphere(ox, oy, oz, dx, dy, dz, ax, ay, az, r, maxDist);
}

// Segment blocked by a box (ignoring the last `end` metres) or by a Veil cloud?
export function losBlocked(boxes, x0, y0, z0, x1, y1, z1, end = .05) {
	const len = Math.hypot(x1 - x0, y1 - y0, z1 - z0), dx = (x1 - x0) / len, dy = (y1 - y0) / len, dz = (z1 - z0) / len;
	if (len < .01) return false;
	for (const b of boxes) { const t = rayAABB(x0, y0, z0, dx, dy, dz, b.min, b.max, len); if (t >= 0 && t < len - end) return true; }
	return false;
}
export function smokeBlocks(smokes, x0, y0, z0, x1, y1, z1) {
	const len = Math.hypot(x1 - x0, y1 - y0, z1 - z0), dx = (x1 - x0) / len, dy = (y1 - y0) / len, dz = (z1 - z0) / len;
	if (len < .01) return false;
	for (const s of smokes) if (s.active && raySphere(x0, y0, z0, dx, dy, dz, s.x, s.y, s.z, s.r, len) >= 0) return true;
	return false;
}
