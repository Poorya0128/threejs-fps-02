// Mesh builder (aE: 0 plain, 1 bevel or polymer, 2 metal, 3 accent), bevelled boxes, canvas textures.
import { BufferGeometry, Float32BufferAttribute, Vector3, Matrix3, Matrix4, Quaternion, Color, CanvasTexture, SRGBColorSpace } from 'three';
import { mulberry32 } from '../math.js';

export const lin = (hex) => new Color(hex).toArray();
export function canvasTex(w, draw, h = w) {
	const c = document.createElement('canvas');
	c.width = w; c.height = h; draw(c.getContext('2d'), w, mulberry32(w), h);
	const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace;
	return t;
}
const _m = new Matrix4(), _q = new Quaternion(), _d = new Vector3(), _c = new Vector3(), _u = new Vector3(), _w = new Vector3(), _one = new Vector3(1, 1, 1), _up = new Vector3(0, 1, 0);
export const along = (a, b) => _m.compose(_c.addVectors(a, b).multiplyScalar(.5), _q.setFromUnitVectors(_up, _d.subVectors(b, a).normalize()), _one);

export class Bld {
	constructor() { this.p = []; this.n = []; this.e = []; this.c = []; this.i = []; }
	v(q, n, e, t) { this.p.push(...q); this.n.push(...n); this.e.push(e); this.c.push(...(t.length ? t : [t, t, t])); return this.e.length - 1; }
	tri(a, b, c, n) {
		_c.fromArray(this.p, a * 3); _u.fromArray(this.p, b * 3).sub(_c); _w.fromArray(this.p, c * 3).sub(_c);
		if (_u.cross(_w).dot(_d.fromArray(n)) < 0) this.i.push(a, c, b); else this.i.push(a, b, c);
	}
	grid(rows, n, e, t) {
		const id = rows.map((r) => r.map((q) => this.v(q, n, e, t)));
		for (let j = 0; j + 1 < id.length; j++) for (let i = 0; i + 1 < id[j].length; i++) { this.tri(id[j][i], id[j][i + 1], id[j + 1][i + 1], n); this.tri(id[j][i], id[j + 1][i + 1], id[j + 1][i], n); }
	}
	// Append geometry g transformed by m, with flag e and colour t (grey or [r, g, b]).
	add(g, m, e = 0, t = 1) {
		const o = this.e.length, pos = g.attributes.position, nor = g.attributes.normal, nm = new Matrix3().getNormalMatrix(m), v = new Vector3();
		for (let k = 0; k < pos.count; k++) this.v(v.fromBufferAttribute(pos, k).applyMatrix4(m).toArray(), v.fromBufferAttribute(nor, k).applyMatrix3(nm).normalize().toArray(), e, t);
		for (let k = 0; k < (g.index ? g.index.count : pos.count); k++) this.i.push(o + (g.index ? g.index.getX(k) : k));
	}
	merge(o) { const k = this.e.length; this.p.push(...o.p); this.n.push(...o.n); this.e.push(...o.e); this.c.push(...o.c); this.i.push(...o.i.map((i) => i + k)); }
	geo() {
		const g = new BufferGeometry();
		for (const [k, a, s] of [['position', this.p, 3], ['normal', this.n, 3], ['aE', this.e, 1], ['color', this.c, 3]]) g.setAttribute(k, new Float32BufferAttribute(a, s));
		g.setIndex(this.i); g.computeBoundingSphere();
		return g;
	}
}

export function ticks(a0, a1, isY, step = 1.6) {
	const out = [a0];
	if (isY) { for (const t of [.15, .45, 1, 1.8, 3, 4.5, 6]) if (t > a0 + .05 && t < a1 - .05) out.push(t); }
	else for (let k = 1, n = Math.ceil((a1 - a0) / step); k < n; k++) out.push(a0 + (a1 - a0) * k / n);
	out.push(a1);
	return out;
}

// Chamfered box: 6 faces, 12 bevel strips, 8 corners; no bottom on the ground.
export function boxInto(B, mn, mx, r, t = 1, step = 1.6, e0 = 0, e1 = 1) {
	r = Math.min(r, .25 * Math.min(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]));
	const ground = mn[1] <= .01, skip = (ax, s) => ax === 1 && s < 0 && ground;
	const plane = (ax, s) => (s > 0 ? mx[ax] : mn[ax]), inset = (ax, s) => (s > 0 ? mx[ax] - r : mn[ax] + r), tk = (ax) => ticks(mn[ax] + r, mx[ax] - r, ax === 1, step);
	for (let ax = 0; ax < 3; ax++) for (const s of [-1, 1]) {
		if (skip(ax, s)) continue;
		const a = (ax + 1) % 3, b = (ax + 2) % 3, n = [0, 0, 0]; n[ax] = s;
		B.grid(tk(b).map((vb) => tk(a).map((va) => { const q = []; q[ax] = plane(ax, s); q[a] = va; q[b] = vb; return q; })), n, e0, t);
	}
	for (let A = 0; A < 3; A++) for (let C = A + 1; C < 3; C++) for (const sA of [-1, 1]) for (const sC of [-1, 1]) {
		if (skip(A, sA) || skip(C, sC)) continue;
		const D = 3 - A - C, n = [0, 0, 0]; n[A] = sA * .7071; n[C] = sC * .7071;
		B.grid([0, 1].map((k) => tk(D).map((vd) => { const q = []; q[D] = vd; q[A] = k ? plane(A, sA) : inset(A, sA); q[C] = k ? inset(C, sC) : plane(C, sC); return q; })), n, e1, t);
	}
	for (const sx of [-1, 1]) for (const sy of ground ? [1] : [-1, 1]) for (const sz of [-1, 1]) {
		const s = [sx, sy, sz], n = [sx * .577, sy * .577, sz * .577];
		B.tri(...[0, 1, 2].map((ax) => B.v([0, 1, 2].map((k) => (k === ax ? plane(k, s[k]) : inset(k, s[k]))), n, e1, t)), s);
	}
}
