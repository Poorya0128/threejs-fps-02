// SALTLINE art/geo.js — world geometry (ART.md §4). Every map box becomes a chamfered, subdivided mesh whose bevel
// vertices carry aE = 1 (edge wear); facades get plinths, cornices, pilasters and windows; props come from level data;
// everything is merged per material and gets per-vertex ambient occlusion baked against the map boxes.
import { BufferGeometry, Float32BufferAttribute, Mesh, MeshStandardMaterial, CylinderGeometry, LatheGeometry, SphereGeometry, PlaneGeometry,
	BoxGeometry, CanvasTexture, Vector2, Vector3, Matrix3, Matrix4, Quaternion, PointLight, SRGBColorSpace, DoubleSide } from 'three';
import { worldMaterials, groundMaterials, procMaterial } from './materials.js';
import { rayAABB, mulberry32 } from '../math.js';

// Indexed mesh builder: positions, normals, aE (0 plain, 1 bevel/polymer, 2 metal) and an RGB colour per vertex.
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

// Vertex rows along one axis; vertical faces are denser near the ground where contact shadow matters.
function ticks(a0, a1, isY, step = 1.6) {
	const out = [a0];
	if (isY) { for (const t of [0.15, 0.45, 1, 1.8, 3, 4.5, 6]) if (t > a0 + 0.05 && t < a1 - 0.05) out.push(t); }
	else for (let k = 1, n = Math.ceil((a1 - a0) / step); k < n; k++) out.push(a0 + (a1 - a0) * k / n);
	out.push(a1);
	return out;
}

// Chamfered box from min/max with bevel r: 6 inset faces, 12 bevel strips, 8 corner triangles; no bottom on the ground.
export function boxInto(B, mn, mx, r, t = 1, step = 1.6, e0 = 0, e1 = 1) {
	r = Math.min(r, 0.25 * Math.min(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]));
	const ground = mn[1] <= 0.01, skip = (ax, s) => ax === 1 && s < 0 && ground;
	const plane = (ax, s) => (s > 0 ? mx[ax] : mn[ax]), inset = (ax, s) => (s > 0 ? mx[ax] - r : mn[ax] + r), tk = (ax) => ticks(mn[ax] + r, mx[ax] - r, ax === 1, step);
	for (let ax = 0; ax < 3; ax++) for (const s of [-1, 1]) {
		if (skip(ax, s)) continue;
		const a = (ax + 1) % 3, b = (ax + 2) % 3, n = [0, 0, 0]; n[ax] = s;
		B.grid(tk(b).map((vb) => tk(a).map((va) => { const q = []; q[ax] = plane(ax, s); q[a] = va; q[b] = vb; return q; })), n, e0, t);
	}
	for (let A = 0; A < 3; A++) for (let C = A + 1; C < 3; C++) for (const sA of [-1, 1]) for (const sC of [-1, 1]) {
		if (skip(A, sA) || skip(C, sC)) continue;
		const D = 3 - A - C, n = [0, 0, 0]; n[A] = sA * 0.7071; n[C] = sC * 0.7071;
		B.grid([0, 1].map((k) => tk(D).map((vd) => { const q = []; q[D] = vd; q[A] = k ? plane(A, sA) : inset(A, sA); q[C] = k ? inset(C, sC) : plane(C, sC); return q; })), n, e1, t);
	}
	for (const sx of [-1, 1]) for (const sy of ground ? [1] : [-1, 1]) for (const sz of [-1, 1]) {
		const s = [sx, sy, sz], n = [sx * 0.577, sy * 0.577, sz * 0.577];
		const id = [0, 1, 2].map((ax) => B.v([0, 1, 2].map((k) => (k === ax ? plane(k, s[k]) : inset(k, s[k]))), n, e1, t));
		B.tri(id[0], id[1], id[2], s);
	}
}

// Ambient occlusion per vertex: 10 hemisphere rays of 1.6 m against nearby map boxes (spatial hash of 4 m cells).
const AO_DIRS = Array.from({ length: 10 }, (_, k) => { const a = k * 2.399, e = 0.25 + 0.6 * ((k * 0.618) % 1); return [Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)]; });
function bakeAO(B, hash) {
	const P = B.p, N = B.n, C = B.c;
	for (let v = 0; v < P.length / 3; v++) {
		const nx = N[v * 3], ny = N[v * 3 + 1], nz = N[v * 3 + 2], x = P[v * 3] + nx * 0.03, y = P[v * 3 + 1] + ny * 0.03, z = P[v * 3 + 2] + nz * 0.03;
		const list = hash.get(`${Math.floor(x / 4)},${Math.floor(z / 4)}`);
		if (!list) continue;
		let occ = 0;
		for (const [ax, ay, az] of AO_DIRS) {
			const dot = Math.min(0, ax * nx + ay * ny + az * nz) * 2;
			for (const b of list) { const t = rayAABB(x, y, z, ax - dot * nx, ay - dot * ny, az - dot * nz, b.min, b.max, 1.6); if (t >= 0) { occ += 1 - t / 2.2; break; } }
		}
		const ao = 1 - 0.75 * Math.min(1, occ / 7.7);
		C[v * 3] *= ao; C[v * 3 + 1] *= ao; C[v * 3 + 2] *= ao;
	}
}
function spatialHash(boxes) {
	const h = new Map();
	for (const b of boxes) if (b.mat !== 12) for (let gx = Math.floor((b.min.x - 2) / 4); gx <= Math.floor((b.max.x + 2) / 4); gx++)
		for (let gz = Math.floor((b.min.z - 2) / 4); gz <= Math.floor((b.max.z + 2) / 4); gz++) { const k = `${gx},${gz}`; if (!h.has(k)) h.set(k, []); h.get(k).push(b); }
	return h;
}

const _m = new Matrix4(), _q = new Quaternion(), _s = new Vector3(), _p = new Vector3(), _up = new Vector3(0, 1, 0), _d = new Vector3(), A = new Vector3(), Bv = new Vector3();
const at = (x, y, z, sx = 1, sy = 1, sz = 1, ry = 0) => _m.compose(_p.set(x, y, z), _q.setFromAxisAngle(_up, ry), _s.set(sx, sy, sz));
const rotZ = (x, y, z) => _m.makeRotationZ(Math.PI / 2).setPosition(x, y, z);
function tube(B, a, b, r, seg = 12) {
	_d.subVectors(b, a); const len = _d.length();
	B.add(new CylinderGeometry(r, r, len, seg, Math.max(1, Math.round(len / 1.5)), true), _m.compose(_p.addVectors(a, b).multiplyScalar(0.5), _q.setFromUnitVectors(_up, _d.normalize()), _s.set(1, 1, 1)));
}
// A box standing out of a facade: ax 2 = face at z = c (side s, depth d, u along x); ax 0 = face at x = c (u along z).
const onFace = (ax, c, s, u0, u1, y0, y1, d) => (ax === 2 ? [[u0, y0, Math.min(c, c + s * d)], [u1, y1, Math.max(c, c + s * d)]] : [[Math.min(c, c + s * d), y0, u0], [Math.max(c, c + s * d), y1, u1]]);
// Painted, weathered canvas: sign boards (our own lane names) and the plant-zone floor marking.
function paint(w, h, draw, seed) {
	const c = document.createElement('canvas'); c.width = w; c.height = h;
	const x = c.getContext('2d'), rng = mulberry32(seed);
	draw(x);
	x.globalCompositeOperation = 'destination-out';
	for (let k = 0; k < 1600; k++) { x.fillStyle = `rgba(0,0,0,${rng() * 0.5})`; x.fillRect(rng() * w, rng() * h, 1 + rng() * 5, 1 + rng() * 3); }
	const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.anisotropy = 8;
	return t;
}
const sign = (text, ratio) => paint(512, Math.round(512 / ratio), (x) => {
	const h = x.canvas.height; x.fillStyle = '#20262b'; x.fillRect(0, 0, 512, h); x.strokeStyle = '#e8e2d6'; x.lineWidth = 6; x.strokeRect(10, 10, 492, h - 20);
	x.fillStyle = '#e8e2d6'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `bold ${Math.min(h * 0.55, 900 / text.length)}px Arial, sans-serif`; x.fillText(text, 256, h / 2 + 4);
}, text.length);
const zone = (letter) => paint(512, 512, (x) => {
	x.strokeStyle = x.fillStyle = 'rgba(240,160,60,.85)'; x.lineWidth = 14; x.setLineDash([46, 26]); x.beginPath(); x.arc(256, 256, 236, 0, 7); x.stroke();
	x.font = 'bold 300px Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(letter, 256, 270);
}, letter.charCodeAt(0));

export function buildWorld(scene, boxes, map) {
	const W = worldMaterials(), ground = groundMaterials(), rng = mulberry32(7), T = () => 0.9 + rng() * 0.16;
	const salt = procMaterial({ c: 0xeae6de, pat: 7, scale: 2, r0: 0.7, r1: 0.95, bump: 0.05 });
	const paintM = procMaterial({ c: 0x5d6e66, c2: 0x7a4a2c, pat: 2, scale: 0.35, r0: 0.45, r1: 0.7, metal: 0.2, bump: 0.01, wear: 1, dirt: 0.5 });
	const bags = procMaterial({ c: 0xa89a78, pat: 8, r0: 0.85, r1: 1, bump: 0.02, cvar: 0.15 }), rubber = procMaterial({ c: 0x1f1f20, pat: 9, r0: 0.6, r1: 0.8 });
	const bulb = new MeshStandardMaterial({ color: 0, emissive: 0xffc58a, emissiveIntensity: 9 });
	const glass = new MeshStandardMaterial({ color: 0x1a2229, roughness: 0.05, metalness: 0.3, envMapIntensity: 2.4 });
	const glassLit = new MeshStandardMaterial({ color: 0x1a1410, roughness: 0.1, emissive: 0xffa860, emissiveIntensity: 0.9 });
	const meshes = new Map(), get = (m) => { if (!meshes.has(m)) meshes.set(m, new Bld()); return meshes.get(m); };
	const box = (m, mn, mx, r = 0.02, t = 1) => boxInto(get(m), mn, mx, r, t);
	const edge = (v) => Math.abs(Math.abs(v) - 50) < 0.01 || Math.abs(Math.abs(v) - 38) < 0.01;
	for (const b of boxes) {
		if (b.mat >= 12) continue;
		const mn = [b.min.x, b.min.y, b.min.z], mx = [b.max.x, b.max.y, b.max.z], sx = mx[0] - mn[0], sy = mx[1] - mn[1], sz = mx[2] - mn[2];
		box(W[b.mat], mn, mx, b.mat === 6 ? 0.025 : sy > 3 ? 0.05 : 0.035, T());
		if (b.mat === 6) for (const k of [0.04, sy - 0.04]) box(W[6], [mn[0] - 0.02, mn[1] + k - 0.04, mn[2] - 0.02], [mx[0] + 0.02, mn[1] + k + 0.04, mx[2] + 0.02], 0.015, 0.8);
		const ax = sx > 5 && sz < 1.3 ? 2 : sz > 5 && sx < 1.3 ? 0 : -1;
		if (ax < 0 || sy < 3.5 || mn[1] > 0.01) continue;
		// Long walls: posts (fences) or pilasters (concrete) every ~5.5 m and a capping rail, so no run is a flat slab.
		const steel = b.mat === 11, M = steel ? W[2] : W[0], w = steel ? 0.06 : 0.21, len = ax ? sx : sz, n = Math.max(1, Math.round(len / 5.5));
		for (let k = 0; k <= n; k++) {
			const u = (ax ? mn[0] : mn[2]) + len * k / n, c = ax ? (mn[2] + mx[2]) / 2 : (mn[0] + mx[0]) / 2, half = (ax ? sz : sx) / 2 + (steel ? 0.1 : 0.14);
			box(M, ...onFace(ax, c - half, 1, u - w, u + w, 0, sy + 0.05, half * 2), 0.02, 0.95);
		}
		box(M, [mn[0] - 0.06, sy - 0.18, mn[2] - 0.06], [mx[0] + 0.06, sy + 0.08, mx[2] + 0.06], 0.02, 0.9);
	}
	// Facades: plinth, cornice, pilasters and framed window bays on every building face that is not against the map edge.
	for (const bi of map.buildings) {
		const [x0, , z0, x1, h, z1] = map.boxes[bi];
		box(W[0], [x0 - 0.08, 0, z0 - 0.08], [x1 + 0.08, 0.55, z1 + 0.08], 0.03, 0.85);
		box(W[0], [x0 - 0.16, h - 0.4, z0 - 0.16], [x1 + 0.16, h + 0.1, z1 + 0.16], 0.04, 0.95);
		for (const [ax, c, a0, a1, s] of [[2, z0, x0, x1, -1], [2, z1, x0, x1, 1], [0, x0, z0, z1, -1], [0, x1, z0, z1, 1]]) {
			if (edge(c)) continue;
			const n = Math.max(1, Math.round((a1 - a0) / 4.5)), bay = (a1 - a0) / n, hw = Math.min(0.8, bay / 2 - 0.5);
			for (let k = 0; k <= n; k++) {
				const u = a0 + bay * k;
				box(W[0], ...onFace(ax, c, s, u - 0.22, u + 0.22, 0, h - 0.4, 0.12), 0.02, 0.92);
				if (k === n || hw < 0.4) continue;
				for (let yb = 2.5; yb + 2 < h; yb += 2.6) {
					const um = u + bay / 2, yc = yb + 0.7, ry = ax === 2 ? (s < 0 ? Math.PI : 0) : s * Math.PI / 2;
					get(rng() < 0.22 ? glassLit : glass).add(new PlaneGeometry(hw * 2, 1.4), ax === 2 ? at(um, yc, c + s * 0.03, 1, 1, 1, ry) : at(c + s * 0.03, yc, um, 1, 1, 1, ry));
					for (const [du, dy, su, sv] of [[0, -0.74, hw + 0.08, 0.06], [0, 0.74, hw + 0.08, 0.06], [-hw - 0.04, 0, 0.05, 0.76], [hw + 0.04, 0, 0.05, 0.76], [0, 0, 0.025, 0.72]])
						box(W[2], ...onFace(ax, c, s, um + du - su, um + du + su, yc + dy - sv, yc + dy + sv, 0.09), 0.01);
				}
			}
		}
	}
	const PROPS = {
		tank(x, z, r, h) {
			get(W[9]).add(new CylinderGeometry(r, r, h - 0.6, 40, 6, true), at(x, (h - 0.6) / 2, z));
			get(W[9]).add(new SphereGeometry(r, 40, 8, 0, 6.3, 0, 0.5), at(x, h - 0.6 - r * Math.cos(0.5), z));
			for (let y = 0.6; y < h - 0.8; y += 1.4) get(W[2]).add(new CylinderGeometry(r + 0.04, r + 0.04, 0.09, 40, 1), at(x, y, z), 1);
			box(W[2], [x + r - 0.02, 0.3, z - 0.25], [x + r + 0.08, h - 0.4, z - 0.2], 0.01);
			box(W[0], [x - r - 0.2, 0, z - r - 0.2], [x + r + 0.2, 0.3, z + r + 0.2], 0.04);
		},
		pile(x, z, r, h) { get(salt).add(new LatheGeometry(Array.from({ length: 13 }, (_, k) => new Vector2(r * (1 - k / 12) * (1 + 0.06 * Math.sin(k * 3.1)), h * Math.pow(Math.sin(k / 12 * Math.PI / 2), 0.8))), 36), at(x, 0, z, 1, 1, 0.8)); },
		conveyor(x0, x1, z0, z1, y) {
			const S = W[2], zc = (z0 + z1) / 2;
			for (const zz of [z0 + 0.08, z1 - 0.08]) box(S, [x0, y - 0.32, zz - 0.06], [x1, y - 0.08, zz + 0.06], 0.01);
			for (let x = x0 + 0.5; x < x1; x += 2.2) for (const zz of [z0 + 0.1, z1 - 0.1]) box(S, [x - 0.06, 0, zz - 0.06], [x + 0.06, y - 0.3, zz + 0.06], 0.01);
			for (let x = x0 + 0.2; x < x1; x += 0.45) get(S).add(new CylinderGeometry(0.07, 0.07, z1 - z0 - 0.3, 10, 1), _m.makeRotationX(Math.PI / 2).setPosition(x, y - 0.2, zc), 1);
			box(rubber, [x0, y - 0.13, z0 + 0.18], [x1, y - 0.06, z1 - 0.18], 0.01);
			for (let x = x0 + 1.5; x < x1 - 1; x += 3.1) get(salt).add(new SphereGeometry(0.35, 10, 6, 0, 6.3, 0, 1.4), at(x, y - 0.12, zc, 1.4, 0.45, 0.9));
		},
		boiler(x0, x1, z, r) {
			const len = x1 - x0, xc = (x0 + x1) / 2, yc = r + 0.15;
			get(paintM).add(new CylinderGeometry(r, r, len - 0.8, 48, 6, true), rotZ(xc, yc, z));
			for (const s of [-1, 1]) get(paintM).add(new SphereGeometry(r, 48, 10, 0, 6.3, 0, 0.6), _m.makeRotationZ(-s * Math.PI / 2).setPosition(xc + s * (len / 2 - 0.4 - r * Math.cos(0.6)), yc, z));
			for (let x = x0 + 0.7; x < x1 - 0.5; x += 1.6) get(W[2]).add(new CylinderGeometry(r + 0.05, r + 0.05, 0.14, 48, 1), rotZ(x, yc, z), 1);
			for (const x of [x0 + 1.4, x1 - 1.4]) box(W[0], [x - 0.4, 0, z - r * 0.8], [x + 0.4, yc - r * 0.6, z + r * 0.8], 0.04);
			for (const x of [xc - 1.6, xc + 1.6]) tube(get(W[9]), A.set(x, yc + r - 0.1, z), Bv.set(x, 7, z), 0.22, 16);
		},
		rail(x0, z0, x1, z1, y) {
			const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / 1.4));
			for (let k = 0; k <= n; k++) tube(get(W[9]), A.set(x0 + (x1 - x0) * k / n, y, z0 + (z1 - z0) * k / n), Bv.set(x0 + (x1 - x0) * k / n, y + 1.05, z0 + (z1 - z0) * k / n), 0.025, 8);
			for (const dy of [0.5, 1.05]) tube(get(W[9]), A.set(x0, y + dy, z0), Bv.set(x1, y + dy, z1), 0.025, 8);
		},
		lamp(x, z, dir) {
			const dx = dir === 'w' ? -1.2 : 0, dz = dir === 'n' ? -1.2 : 0;
			tube(get(W[2]), A.set(x, 0, z), Bv.set(x, 5.6, z), 0.08, 10); tube(get(W[2]), A.set(x, 5.5, z), Bv.set(x + dx, 5.6, z + dz), 0.04, 8);
			box(W[2], [x + dx - 0.25, 5.45, z + dz - 0.18], [x + dx + 0.25, 5.65, z + dz + 0.18], 0.03);
			get(bulb).add(new BoxGeometry(0.4, 0.03, 0.26), at(x + dx, 5.44, z + dz));
			box(W[0], [x - 0.25, 0, z - 0.25], [x + 0.25, 0.3, z + 0.25], 0.03);
		},
		wlamp(x, y, z) {
			tube(get(W[2]), A.set(x, y, z), Bv.set(x, y + 0.8, z), 0.015, 6);
			get(W[2]).add(new SphereGeometry(0.28, 16, 6, 0, 6.3, 0, 1.3), at(x, y - 0.05, z)); get(bulb).add(new SphereGeometry(0.1, 10, 8), at(x, y - 0.12, z));
			const l = new PointLight(0xffb062, 26, 16, 1.8); l.position.set(x, y - 0.4, z); scene.add(l);
		},
		pipe(...pts) {
			for (let k = 0; k + 5 < pts.length; k += 3) {
				A.fromArray(pts, k); Bv.fromArray(pts, k + 3); tube(get(W[9]), A, Bv, 0.15, 14);
				get(W[9]).add(new SphereGeometry(0.15, 14, 8), at(Bv.x, Bv.y, Bv.z));
				const len = A.distanceTo(Bv);
				for (let t = 1.5; t < len; t += 3) tube(get(W[9]), _p.lerpVectors(A, Bv, (t - 0.04) / len).clone(), _d.lerpVectors(A, Bv, (t + 0.04) / len).clone(), 0.2, 14);
			}
		},
		sign(text, x, y, z, dir, w) {
			const h = Math.min(1.2, w * 0.28), m = new Mesh(new PlaneGeometry(w, h), new MeshStandardMaterial({ map: sign(text, w / h), roughness: 0.75, metalness: 0.2 }));
			m.position.set(x + [0, -1, 0, 1][dir] * 0.06, y, z + [-1, 0, 1, 0][dir] * 0.06); m.rotation.y = [Math.PI, -Math.PI / 2, 0, Math.PI / 2][dir]; m.receiveShadow = true; scene.add(m);
		},
		barrel(x, z) {
			get([W[3], W[4], W[10]][Math.floor(rng() * 3)]).add(new CylinderGeometry(0.3, 0.3, 0.88, 24, 3), at(x, 0.44, z, 1, 1, 1, rng() * 6));
			for (const y of [0.05, 0.3, 0.58, 0.86]) get(W[2]).add(new CylinderGeometry(0.31, 0.31, 0.035, 24, 1), at(x, y, z), 1);
		},
		bags(x0, z0, x1, z1, y) {
			for (let row = 0, yy = 0.13; yy < y; row++, yy += 0.24) for (let u = x0 + 0.3 + (row % 2) * 0.27; u < x1 - 0.2; u += 0.55)
				for (const zz of [z0 + 0.18, z1 - 0.18]) get(bags).add(new SphereGeometry(0.3, 12, 7), at(u, yy, zz, 0.95, 0.42, 0.62, (rng() - 0.5) * 0.2));
		},
		zone(x, z, letter) {
			const m = new Mesh(new PlaneGeometry(9, 9), new MeshStandardMaterial({ map: zone(letter), transparent: true, roughness: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
			m.rotation.x = -Math.PI / 2; m.position.set(x, 0.02, z); m.receiveShadow = true; scene.add(m);
		},
	};
	for (const [kind, ...args] of map.props) PROPS[kind](...args);
	const hash = spatialHash(boxes);
	for (const [mat, b] of meshes) {
		const lit = mat !== glass && mat !== glassLit && mat !== bulb;
		if (lit) bakeAO(b, hash);
		const mesh = new Mesh(b.geo(), mat); mesh.castShadow = lit; mesh.receiveShadow = true; scene.add(mesh);
	}
	// Ground: one subdivided slab per floor patch (asphalt, concrete, salt gravel, brine, wet concrete), AO baked too.
	map.floors.slice().sort((a, b) => (a[4] === 3) - (b[4] === 3)).forEach(([x0, z0, x1, z1, kind], k) => {
		const G = new Bld();
		G.grid(ticks(z0, z1, false, 1).map((z) => ticks(x0, x1, false, 1).map((x) => [x, 0.004 * k, z])), [0, 1, 0], 0, 1);
		bakeAO(G, hash);
		const m = ground[kind].clone(); m.onBeforeCompile = ground[kind].onBeforeCompile; m.customProgramCacheKey = ground[kind].customProgramCacheKey;
		Object.assign(m, { polygonOffset: true, polygonOffsetFactor: -k, polygonOffsetUnits: -k });
		const mesh = new Mesh(G.geo(), m); mesh.receiveShadow = true; scene.add(mesh);
	});
	backdrop(scene);
}

// Distant industrial skyline beyond the walls: chimneys, silos, a gantry crane and a ridge line, all fogged.
function backdrop(scene) {
	const far = new MeshStandardMaterial({ color: 0x6d6560, roughness: 0.9 }), B = new Bld(), R = new Bld(), rng = mulberry32(3);
	for (const [x, z, h] of [[-80, -95, 46], [-62, -100, 38]]) { B.add(new CylinderGeometry(1.6, 2.6, h, 20), at(x, h / 2, z)); B.add(new CylinderGeometry(1.75, 1.75, 1.2, 20), at(x, h - 4, z), 0, 0.5); }
	for (let k = 0; k < 4; k++) { B.add(new CylinderGeometry(5, 5, 22, 28), at(85 + k * 11, 11, 40 - k * 4)); B.add(new SphereGeometry(5, 28, 8, 0, 6.3, 0, 1.2), at(85 + k * 11, 22, 40 - k * 4)); }
	for (const [x, y, z, sx, sy, sz] of [[70, 17, -70, 1.2, 34, 1.2], [70, 17, -82, 1.2, 34, 1.2], [92, 17, -70, 1.2, 34, 1.2], [92, 17, -82, 1.2, 34, 1.2], [81, 33, -76, 30, 2.4, 14], [81, 31, -60, 2, 2, 40]]) B.add(new BoxGeometry(sx, sy, sz), at(x, y, z));
	const rows = [0, 1].map((k) => Array.from({ length: 97 }, (_, i) => { const a = i / 96 * Math.PI * 2; return [Math.cos(a) * 220, k ? 14 + rng() * 22 + 14 * Math.sin(a * 3) : -1, Math.sin(a) * 220]; }));
	R.grid(rows, [0, 0, -1], 0, 1);
	scene.add(new Mesh(B.geo(), far), new Mesh(R.geo(), new MeshStandardMaterial({ color: 0x4a4048, roughness: 1, side: DoubleSide })));
}
