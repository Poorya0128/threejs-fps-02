// SALTLINE art/weapons-art.js — original firearm designs built from parts (ART.md §9): bevelled boxes, extruded
// side profiles with lightening slots, lathed barrels, rails and optics. Origin = trigger, forward = -z, units = m.
// Vertex colour = finish, aE = 1 polymer / 2 metal for the shared material (pattern 12). The slide and the
// magazine are separate meshes so the viewmodel can animate them.
import { Shape, Path, ExtrudeGeometry, LatheGeometry, Vector2, Matrix4, Mesh, Group, Object3D, Color, MeshBasicMaterial, AdditiveBlending,
	PlaneGeometry, CanvasTexture } from 'three';
import { Bld, boxInto } from './geo.js';
import { procMaterial } from './materials.js';

const lin = (hex) => { const c = new Color(hex); return [c.r, c.g, c.b]; };
const FIN = { M: lin(0x8a8e93), P: lin(0x45464a), S: lin(0xc4c7ca), W: lin(0x8a6040), B: lin(0xc9a050), R: lin(0x5a5d61) };
export const weaponMaterial = procMaterial({ c: 0xffffff, pat: 12, bump: 0.004, env: 1.2, metal: 1 });
const _m = new Matrix4();

const box = (B, f, x0, y0, z0, x1, y1, z1, e = 2) => boxInto(B, [x0, y0, Math.min(z0, z1)], [x1, y1, Math.max(z0, z1)], 0.0025, f, 0.2, e, e);
function ext(B, f, t, pts, x = 0, holes = [], e = 1) {
	const s = new Shape(); s.moveTo(pts[0], pts[1]);
	for (let k = 2; k < pts.length; k += 2) s.lineTo(pts[k], pts[k + 1]);
	for (const h of holes) { const p = new Path(); p.moveTo(h[0], h[1]); for (let k = 2; k < h.length; k += 2) p.lineTo(h[k], h[k + 1]); s.holes.push(p); }
	B.add(new ExtrudeGeometry(s, { depth: t, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.0018, bevelSegments: 2, curveSegments: 4 }), _m.makeRotationY(Math.PI / 2).setPosition(x - t / 2, 0, 0), e, f);
}
// Lathe along -z from z0: prof = [r, d, r, d, …] (radius, distance forward).
function lat(B, f, x, y, z0, prof, e = 2, seg = 18) {
	const pts = [];
	for (let k = 0; k < prof.length; k += 2) pts.push(new Vector2(prof[k], prof[k + 1]));
	B.add(new LatheGeometry(pts, seg), _m.makeRotationX(-Math.PI / 2).setPosition(x, y, z0), e, f);
}
const rail = (B, y, z0, z1) => { box(B, FIN.M, -0.011, y, z0, 0.011, y + 0.006, z1); for (let z = z0 - 0.005; z > z1; z -= 0.01) box(B, FIN.M, -0.011, y + 0.006, z, 0.011, y + 0.011, z - 0.005); };
const slots = (u0, u1, v0, v1, n) => { const out = [], w = (u1 - u0) / n; for (let k = 0; k < n; k++) { const a = u0 + k * w + w * 0.25, b = a + w * 0.5; out.push([a, v0, b, v0, b, v1, a, v1]); } return out; };

function optic(B, kind, z, y) {
	if (kind === 'scope') {
		lat(B, FIN.M, 0, y + 0.045, z + 0.14, [0, 0, 0.024, 0, 0.024, 0.07, 0.015, 0.1, 0.015, 0.2, 0.021, 0.24, 0.021, 0.3, 0.019, 0.31, 0, 0.31], 2, 24);
		for (const zz of [z + 0.07, z - 0.08]) box(B, FIN.M, -0.012, y, zz, 0.012, y + 0.03, zz - 0.02);
		lat(B, FIN.M, 0.02, y + 0.045, z - 0.01, [0, 0, 0.009, 0, 0.009, 0.02, 0, 0.02], 2, 12);
		return y + 0.045;
	}
	if (kind === 'holo') {
		box(B, FIN.P, -0.017, y, z, 0.017, y + 0.012, z - 0.09, 1);
		box(B, FIN.M, -0.019, y + 0.012, z, -0.015, y + 0.055, z - 0.09); box(B, FIN.M, 0.015, y + 0.012, z, 0.019, y + 0.055, z - 0.09);
		box(B, FIN.M, -0.019, y + 0.051, z, 0.019, y + 0.056, z - 0.09);
		return y + 0.033;
	}
	box(B, FIN.M, -0.013, y, z, 0.013, y + 0.01, z - 0.05);
	lat(B, FIN.M, 0, y + 0.03, z, [0.02, 0, 0.02, 0.05, 0.017, 0.052], 2, 20);
	return y + 0.03;
}

function pistol(o) {
	const B = new Bld(), K = new Bld(), A = new Bld(), L = o.len;
	box(B, o.frame, -0.014, -0.012, 0.035, 0.014, 0.012, -L + 0.02, 1);
	box(K, o.slide, -0.016, 0.012, 0.045, 0.016, 0.044, -L, 2);
	for (let z = 0.035; z > 0.0; z -= 0.007) box(K, FIN.R, -0.0165, 0.016, z, 0.0165, 0.04, z - 0.0025);
	box(K, FIN.M, -0.003, 0.044, -L + 0.01, 0.003, 0.051, -L + 0.018); box(K, FIN.M, -0.009, 0.044, 0.035, 0.009, 0.05, 0.028);
	lat(B, FIN.S, 0, 0.028, -L + 0.002, [0.0065, 0, 0.0065, 0.005, 0, 0.005], 2, 12);
	ext(B, o.grip, 0.03, [0.03, -0.01, -0.012, -0.01, -0.03, -0.115, 0.005, -0.12, 0.016, -0.03], 0, [], 1);
	ext(B, o.frame, 0.012, [0.0, -0.012, -0.07, -0.012, -0.07, -0.036, -0.06, -0.044, -0.01, -0.044], 0, [[-0.012, -0.018, -0.055, -0.018, -0.05, -0.038, -0.015, -0.038]]);
	box(B, FIN.S, -0.002, -0.036, -0.03, 0.002, -0.014, -0.036);
	box(A, FIN.M, -0.012, -0.112, 0.012, 0.012, -0.124, -0.026);
	if (o.hammer) box(K, FIN.S, -0.004, 0.03, 0.058, 0.004, 0.05, 0.045);
	if (o.wood) for (const s of [-1, 1]) box(B, FIN.W, s * 0.016 - 0.002, -0.095, 0.005, s * 0.016 + 0.002, -0.02, -0.03, 1);
	return { B, K, A, muz: [0, 0.028, -L - 0.01], left: null, sight: 0.05 };
}

function longGun(o) {
	const B = new Bld(), A = new Bld(), K = new Bld(), acc = lin(o.accent), bp = o.bullpup ? 0.17 : 0, R = o.recv;
	const z0 = 0.04 + bp, zf = -R + bp;
	box(B, FIN.M, -0.017, 0.012, z0, 0.017, 0.064, zf);
	box(B, acc, -0.0155, -0.028, z0 - 0.005, 0.0155, 0.013, zf + 0.06, 1);
	box(K, FIN.S, 0.016, 0.03, -0.03 + bp * 0.4, 0.024, 0.045, -0.07 + bp * 0.4);
	ext(B, FIN.P, 0.028, [0.0, -0.02, -0.035, -0.02, -0.058, -0.118, -0.024, -0.124, -0.008, -0.03], 0, [], 1);
	box(B, FIN.P, -0.004, -0.052, 0.002, 0.004, -0.046, -0.062, 1); box(B, FIN.S, -0.002, -0.044, -0.014, 0.002, -0.02, -0.02);
	const mz = 0.075 - bp;
	if (o.mag === 'curved') ext(A, acc, 0.024, [mz - 0.025, -0.02, mz + 0.025, -0.02, mz + 0.06, -0.2, mz + 0.012, -0.21], 0, [], 1);
	else if (o.mag === 'box') ext(A, FIN.P, 0.03, [mz - 0.03, -0.02, mz + 0.03, -0.02, mz + 0.03, -0.085, mz - 0.03, -0.085], 0, [], 1);
	else if (o.mag !== 'tube') ext(A, FIN.M, 0.022, [mz - 0.018, -0.02, mz + 0.018, -0.02, mz + 0.024, -0.17, mz - 0.014, -0.172]);
	const h0 = -zf, h1 = h0 + o.hg, hy0 = o.hgLow ?? 0.008;
	if (o.pump) {
		lat(B, FIN.M, 0, -0.01, zf, [0.012, 0, 0.012, o.hg + 0.1, 0.0, o.hg + 0.1]);
		lat(B, FIN.P, 0, -0.01, zf - 0.06, [0.022, 0, 0.024, 0.01, 0.024, 0.15, 0.022, 0.16, 0, 0.16], 1, 20);
		for (let d = 0.08; d < 0.21; d += 0.018) lat(B, FIN.P, 0, -0.01, zf - d, [0.026, 0, 0.026, 0.006, 0, 0.006], 1, 20);
	} else ext(B, o.hgColor ? lin(o.hgColor) : FIN.M, 0.044, [h0, hy0, h1, hy0 + 0.004, h1, 0.062, h0, 0.064], 0, slots(h0 + 0.02, h1 - 0.02, hy0 + 0.012, 0.05, Math.round(o.hg / 0.045)), 2);
	if (!o.pump) rail(B, 0.064, zf + 0.02, -h1 + 0.01);
	rail(B, 0.064, z0 - 0.01, zf + 0.02);
	const by = 0.035, bz = -h1;
	lat(B, FIN.M, 0, by, bz + 0.01, [o.bore, 0, o.bore, o.barrel, 0, o.barrel], 2, 16);
	if (o.flute) for (let k = 0; k < 6; k++) box(B, FIN.R, -o.bore - 0.0005, by - 0.0015, bz - 0.04 - k * 0.04, o.bore + 0.0005, by + 0.0015, bz - 0.065 - k * 0.04);
	lat(B, FIN.M, 0, by, bz - o.barrel + 0.01, [0.013, 0, 0.013, 0.012, 0.011, 0.014, 0.011, 0.02, 0.013, 0.022, 0.013, 0.05, 0.009, 0.055, 0, 0.055], 2, 16);
	box(B, FIN.M, -0.012, by - 0.014, bz, 0.012, by + 0.016, bz - 0.025);
	if (o.fore) ext(B, FIN.P, 0.026, [h0 + 0.07, hy0, h0 + 0.11, hy0, h0 + 0.105, hy0 - 0.09, h0 + 0.075, hy0 - 0.09], 0, [], 1);
	const sz0 = z0 - 0.005, stock = o.fp ? 'none' : o.stock; // in first person the stock sits behind the camera
	if (stock === 'tube') { lat(B, FIN.P, 0, 0.038, sz0 + 0.17, [0.0135, 0, 0.0135, 0.17], 1); ext(B, FIN.P, 0.034, [-sz0 - 0.1, 0.064, -sz0 - 0.26, 0.068, -sz0 - 0.27, -0.045, -sz0 - 0.235, -0.052, -sz0 - 0.13, 0.008, -sz0 - 0.1, 0.012], 0, [[-sz0 - 0.15, 0.045, -sz0 - 0.235, 0.048, -sz0 - 0.235, 0.0, -sz0 - 0.165, 0.025]]); }
	else if (stock === 'chassis') ext(B, acc, 0.03, [-sz0, 0.06, -sz0 - 0.3, 0.07, -sz0 - 0.31, -0.06, -sz0 - 0.27, -0.065, -sz0 - 0.2, -0.02, -sz0, -0.025], 0, [[-sz0 - 0.04, 0.035, -sz0 - 0.15, 0.04, -sz0 - 0.15, 0.0, -sz0 - 0.04, 0.0], [-sz0 - 0.18, 0.04, -sz0 - 0.27, 0.045, -sz0 - 0.27, -0.03, -sz0 - 0.2, 0.0]], 1);
	else if (stock === 'wire') { for (const s of [-1, 1]) lat(B, FIN.M, s * 0.014, 0.03, sz0 + 0.22, [0.004, 0, 0.004, 0.22], 2, 8); box(B, FIN.P, -0.02, -0.01, sz0 + 0.22, 0.02, 0.06, sz0 + 0.235, 1); }
	else if (stock === 'pump') ext(B, lin(0x5a3c26), 0.036, [-sz0, 0.055, -sz0 - 0.3, 0.06, -sz0 - 0.31, -0.07, -sz0 - 0.27, -0.075, -sz0 - 0.06, -0.03, -sz0, -0.02], 0, [], 1);
	if (o.bullpup && !o.fp) ext(B, acc, 0.036, [-z0 + 0.02, 0.064, -z0 - 0.14, 0.064, -z0 - 0.16, -0.04, -z0 - 0.02, -0.04], 0, [], 1);
	const sight = o.optic ? optic(B, o.optic, o.opticZ ?? -0.06, 0.075) : 0.075;
	if (!o.optic) { box(B, FIN.M, -0.008, 0.07, z0 - 0.01, 0.008, 0.086, z0 - 0.025); box(B, FIN.M, -0.002, 0.07, -h1 + 0.03, 0.002, 0.09, -h1 + 0.035); }
	if (o.bolt) { box(K, FIN.S, 0.017, 0.035, -0.02, 0.05, 0.042, -0.028); lat(K, FIN.S, 0.055, 0.038, -0.018, [0.008, 0, 0.008, 0.012, 0, 0.012], 2, 10); }
	return { B, K, A, muz: [0, by, bz - o.barrel - 0.05], left: [0, -0.005, -(h0 + 0.09)], sight, optic: o.optic };
}

function knife() {
	const B = new Bld();
	ext(B, FIN.S, 0.004, [0.0, 0.0, 0.17, 0.012, 0.2, 0.03, 0.15, 0.036, 0.0, 0.03], 0, [], 2);
	ext(B, FIN.P, 0.022, [-0.01, -0.006, -0.11, -0.004, -0.115, 0.036, -0.01, 0.04], 0, [], 1);
	box(B, FIN.M, -0.014, -0.012, 0.006, 0.014, 0.046, -0.004);
	return { B, K: null, A: null, muz: [0, 0.015, -0.2], left: null, sight: 0.05 };
}

const SPECS = {
	wren: () => pistol({ len: 0.18, frame: FIN.P, slide: lin(0x3a3c3f), grip: FIN.P }),
	mako: () => pistol({ len: 0.205, frame: lin(0x5c5e60), slide: lin(0x8a8c8e), grip: FIN.W, hammer: true, wood: true }),
	hornet: (fp) => longGun({ fp, recv: 0.2, hg: 0.12, barrel: 0.05, bore: 0.011, mag: 'straight', stock: 'wire', optic: 'dot', opticZ: -0.02, accent: 0x2f6b66, fore: true }),
	breaker: (fp) => longGun({ fp, recv: 0.2, hg: 0.36, barrel: 0.12, bore: 0.012, mag: 'tube', stock: 'pump', pump: true, accent: 0x333538 }),
	talon: (fp) => longGun({ fp, recv: 0.26, hg: 0.3, barrel: 0.14, bore: 0.0095, mag: 'curved', stock: 'tube', optic: 'dot', accent: 0x7a6c56, hgColor: 0x7a6c56 }),
	gavel: (fp) => longGun({ fp, recv: 0.12, hg: 0.32, barrel: 0.1, bore: 0.0095, mag: 'box', stock: 'none', bullpup: true, optic: 'holo', opticZ: -0.12, accent: 0x4c5a66 }),
	longbow: (fp) => longGun({ fp, recv: 0.3, hg: 0.28, barrel: 0.34, bore: 0.012, mag: 'box', stock: 'chassis', optic: 'scope', opticZ: -0.02, bolt: true, flute: true, accent: 0x55604a }),
	cutlass: knife,
};

const reticle = (() => {
	const c = document.createElement('canvas'); c.width = c.height = 64;
	const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 8);
	g.addColorStop(0, 'rgba(255,90,60,1)'); g.addColorStop(0.4, 'rgba(255,60,40,0.9)'); g.addColorStop(1, 'rgba(255,40,20,0)');
	x.fillStyle = g; x.fillRect(0, 0, 64, 64);
	return new MeshBasicMaterial({ map: new CanvasTexture(c), transparent: true, blending: AdditiveBlending, depthWrite: false, color: 0xffffff });
})();

// lod = true: one merged mesh (third person). Otherwise slide and magazine stay separate and optics get a reticle.
export function buildWeapon(id, lod = false) {
	const s = (SPECS[id] || SPECS.wren)(!lod), g = new Group();
	if (lod) { for (const P of [s.K, s.A]) if (P) s.B.merge(P); s.K = s.A = null; }
	const mk = (P) => { if (!P || !P.p.length) return null; const m = new Mesh(P.geo(), weaponMaterial); m.castShadow = lod; g.add(m); return m; };
	mk(s.B);
	const slide = mk(s.K), mag = mk(s.A);
	if (!lod && s.optic && s.optic !== 'scope') {
		const r = new Mesh(new PlaneGeometry(0.03, 0.03), reticle); r.position.set(0, s.sight, (s.optic === 'holo' ? -0.12 : -0.06) - 0.04); r.renderOrder = 2; g.add(r);
	}
	const muzzle = new Object3D(); muzzle.position.fromArray(s.muz); g.add(muzzle);
	return { group: g, muzzle, slide, mag, left: s.left, sight: s.sight };
}
