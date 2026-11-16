// SALTLINE art/mesh.js — shared art helpers: Bld, an indexed mesh builder with positions, normals, a per-vertex aE flag
// (0 plain, 1 bevel or polymer, 2 metal, 3 team accent) and colour; chamfered subdivided boxes; canvas textures.
import { BufferGeometry, Float32BufferAttribute, Vector3, Matrix3, Matrix4, Quaternion, Color, CanvasTexture, SRGBColorSpace } from 'three';
import { mulberry32 } from '../math.js';

export const lin = (hex) => { const c = new Color(hex); return [c.r, c.g, c.b]; };
// A texture painted on a canvas by draw(ctx, w, rng, h), seeded by its width.
export function canvasTex(w, draw, h = w) {
	const c = document.createElement('canvas');
	c.width = w; c.height = h; draw(c.getContext('2d'), w, mulberry32(w), h);
	const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace;
	return t;
}
// Matrix that stands a y-axis primitive (cylinder, capsule) between points a and b.
const _m = new Matrix4(), _q = new Quaternion(), _d = new Vector3(), _c = new Vector3(), _one = new Vector3(1, 1, 1), _up = new Vector3(0, 1, 0);
export const along = (a, b) => _m.compose(_c.addVectors(a, b).multiplyScalar(.5), _q.setFromUnitVectors(_up, _d.subVectors(b, a).normalize()), _one);

export class Bld {
	constructor() { this.p = []; this.n = []; this.e = []; this.c = []; this.i = []; }
	v(q, n, e, t) { this.p.push(q[0], q[1], q[2]); this.n.push(n[0], n[1], n[2]); this.e.push(e); if (t.length) this.c.push(t[0], t[1], t[2]); else this.c.push(t, t, t); return this.p.length / 3 - 1; }
	tri(a, b, c, n) { // winding chosen so the face points along n
		const P = this.p, u = [0, 1, 2].map((k) => P[b * 3 + k] - P[a * 3 + k]), w = [0, 1, 2].map((k) => P[c * 3 + k] - P[a * 3 + k]);
		const d = (u[1] * w[2] - u[2] * w[1]) * n[0] + (u[2] * w[0] - u[0] * w[2]) * n[1] + (u[0] * w[1] - u[1] * w[0]) * n[2];
		this.i.push(a, d < 0 ? c : b, d < 0 ? b : c);
	}
	grid(rows, n, e, t) {
		const id = rows.map((r) => r.map((q) => this.v(q, n, e, t)));
		for (let j = 0; j + 1 < id.length; j++) for (let i = 0; i + 1 < id[j].length; i++) { this.tri(id[j][i], id[j][i + 1], id[j + 1][i + 1], n); this.tri(id[j][i], id[j + 1][i + 1], id[j + 1][i], n); }
	}
	// Append a three.js geometry transformed by m, with flag e and colour t (grey level or [r, g, b]).
	add(g, m, e = 0, t = 1) {
		const o = this.p.length / 3, pos = g.attributes.position, nor = g.attributes.normal, nm = new Matrix3().getNormalMatrix(m), v = new Vector3(), n = [0, 0, 0];
		for (let k = 0; k < pos.count; k++) {
			v.fromBufferAttribute(nor, k).applyMatrix3(nm).normalize().toArray(n);
			this.v(v.fromBufferAttribute(pos, k).applyMatrix4(m).toArray(), n, e, t);
		}
		for (let k = 0; k < (g.index ? g.index.count : pos.count); k++) this.i.push(o + (g.index ? g.index.getX(k) : k));
	}
	merge(o) { const k = this.p.length / 3; this.p.push(...o.p); this.n.push(...o.n); this.e.push(...o.e); this.c.push(...o.c); for (const i of o.i) this.i.push(i + k); }
	geo() {
		const g = new BufferGeometry();
		for (const [k, a, s] of [['position', this.p, 3], ['normal', this.n, 3], ['aE', this.e, 1], ['color', this.c, 3]]) g.setAttribute(k, new Float32BufferAttribute(a, s));
		g.setIndex(this.i); g.computeBoundingSphere();
		return g;
	}
}

// Vertex rows along one axis; vertical faces are denser near the ground, where contact shadow and AO matter.
export function ticks(a0, a1, isY, step = 1.6) {
	const out = [a0];
	if (isY) { for (const t of [.15, .45, 1, 1.8, 3, 4.5, 6]) if (t > a0 + .05 && t < a1 - .05) out.push(t); }
	else for (let k = 1, n = Math.ceil((a1 - a0) / step); k < n; k++) out.push(a0 + (a1 - a0) * k / n);
	out.push(a1);
	return out;
}

// Chamfered box from min/max with bevel r: 6 inset faces, 12 bevel strips, 8 corner triangles; no bottom on the ground.
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
