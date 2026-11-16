// SALTLINE art/weapons-art.js — original firearm designs built from parts (ART.md §9): bevelled boxes, extruded
// side profiles with lightening slots, lathed barrels, rails and optics. Origin = trigger, forward = -z, units = m.
// Vertex colour = finish, aE = 1 polymer / 2 metal for the shared material (pattern 12). The slide and the
// magazine are separate meshes so the viewmodel can animate them.
import { Shape, Path, ExtrudeGeometry, LatheGeometry, Vector2, Matrix4, Mesh, Group, Object3D, Color, MeshBasicMaterial, AdditiveBlending,
	PlaneGeometry, CircleGeometry, CanvasTexture, MeshStandardMaterial, DoubleSide } from 'three';
import { Bld, boxInto } from './mesh.js';
import { procMaterial } from './materials.js';

const lin = (hex) => { const c = new Color(hex); return [c.r, c.g, c.b]; };
const FIN = { K: lin(0x1b1c1f), M: lin(0x8a8e93), P: lin(0x45464a), S: lin(0xc4c7ca), W: lin(0x8a6040), B: lin(0xc9a050), R: lin(0x5a5d61) };
export const weaponMaterial = procMaterial({ c: 0xffffff, pat: 12, bump: .004, env: 1.2, metal: 1 });
const _m = new Matrix4();

const box = (B, f, x0, y0, z0, x1, y1, z1, e = 2) => boxInto(B, [x0, y0, Math.min(z0, z1)], [x1, y1, Math.max(z0, z1)], .0025, f, .2, e, e);
function ext(B, f, t, pts, x = 0, holes = [], e = 1) {
	const s = new Shape(); s.moveTo(pts[0], pts[1]);
	for (let k = 2; k < pts.length; k += 2) s.lineTo(pts[k], pts[k + 1]);
	for (const h of holes) { const p = new Path(); p.moveTo(h[0], h[1]); for (let k = 2; k < h.length; k += 2) p.lineTo(h[k], h[k + 1]); s.holes.push(p); }
	B.add(new ExtrudeGeometry(s, { depth: t, bevelEnabled: true, bevelThickness: .002, bevelSize: .0018, bevelSegments: 2, curveSegments: 4 }), _m.makeRotationY(Math.PI / 2).setPosition(x - t / 2,0,0), e, f);
}
// Lathe along -z from z0: prof = [r, d, r, d, …] (radius, distance forward).
function lat(B, f, x, y, z0, prof, e = 2, seg = 18) {
	const pts = [];
	for (let k = 0; k < prof.length; k += 2) pts.push(new Vector2(prof[k], prof[k + 1]));
	B.add(new LatheGeometry(pts, seg), _m.makeRotationX(-Math.PI / 2).setPosition(x, y, z0), e, f);
}
const rail = (B, y, z0, z1) => { box(B, FIN.M, -.011, y, z0,.011, y + .006, z1); for (let z = z0 - .005; z > z1; z -= .01) box(B, FIN.M, -.011, y + .006, z, .011, y + .011, z - .005); };
const slots = (u0, u1, v0, v1, n) => { const out = [], w = (u1 - u0) / n; for (let k = 0; k < n; k++) { const a = u0 + k * w + w * .25, b = a + w * .5; out.push([a, v0, b, v0, b, v1, a, v1]); } return out; };

function optic(B, kind, z, y) {
	if (kind === 'scope') {
		lat(B, FIN.K, 0, y + .045, z + .14, [0,0,.028,0,.028,.07,.019,.1,.019,.2,.025,.24,.025,.3,.023,.31,0,.31], 1,24);
		for (const zz of [z + .07, z - .08]) box(B, FIN.K, -.012, y, zz, .012, y + .03, zz - .02,1);
		lat(B, FIN.K, .024, y + .045, z - .01, [0,0,.009,0,.009,.02,0,.02], 1,12);
		return y + .045;
	}
	if (kind === 'holo') {
		box(B, FIN.K, -.017, y, z, .017, y + .012, z - .09,1);
		box(B, FIN.K, -.019, y + .012, z, -.015, y + .055, z - .09,1); box(B, FIN.K, .015, y + .012, z, .019, y + .055, z - .09,1);
		box(B, FIN.K, -.019, y + .051, z, .019, y + .056, z - .09,1);
		return y + .033;
	}
	box(B, FIN.K, -.013, y, z, .013, y + .01, z - .05,1);
	lat(B, FIN.K, 0, y + .03, z, [.023,0,.023,.05,.02,.052], 1,20);
	return y + .03;
}

function pistol(o) {
	const B = new Bld(), K = new Bld(), A = new Bld(), L = o.len;
	box(B, o.frame, -.014,-.012,.035,.014,.012, -L + .02,1);
	box(K, o.slide, -.016,.012,.045,.016,.044, -L, 2);
	for (let z = .035; z > 0; z -= .007) box(K, FIN.R, -.0165,.016, z, .0165,.04, z - .0025);
	box(K, FIN.M, -.003,.044, -L + .01,.003,.051, -L + .018); box(K, FIN.M, -.009,.044,.035,.009,.05,.028);
	lat(B, FIN.S, 0,.028, -L + .002, [.0065,0,.0065,.005,0,.005], 2,12);
	ext(B, o.grip, .03, [.03,-.01,-.012,-.01,-.03,-.115,.005,-.12,.016,-.03], 0, [], 1);
	ext(B, o.frame, .012, [0,-.012,-.07,-.012,-.07,-.036,-.06,-.044,-.01,-.044], 0, [[-.012,-.018,-.055,-.018,-.05,-.038,-.015,-.038]]);
	box(B, FIN.S, -.002,-.036,-.03,.002,-.014,-.036);
	box(A, FIN.M, -.012,-.112,.012,.012,-.124,-.026);
	if (o.hammer) box(K, FIN.S, -.004,.03,.058,.004,.05,.045);
	if (o.wood) for (const s of [-1,1]) box(B, FIN.W, s * .016 - .002,-.095,.005, s * .016 + .002,-.02,-.03,1);
	return { B, K, A, muz: [0,.028, -L - .01], left: null, sight: .05 };
}

function longGun(o) {
	const B = new Bld(), A = new Bld(), K = new Bld(), acc = lin(o.accent), bp = o.bullpup ? .17 : 0, R = o.recv;
	const z0 = .04 + bp, zf = -R + bp;
	box(B, FIN.M, -.017,.012, z0,.017,.064, zf);
	box(B, acc, -.0155,-.028, z0 - .005,.0155,.013, zf + .06,1);
	box(K, FIN.S, .016,.03,-.03 + bp * .4,.024,.045,-.07 + bp * .4);
	ext(B, FIN.P, .028, [0,-.02,-.035,-.02,-.058,-.118,-.024,-.124,-.008,-.03], 0, [], 1);
	box(B, FIN.P, -.004,-.052,.002,.004,-.046,-.062,1); box(B, FIN.S, -.002,-.044,-.014,.002,-.02,-.02);
	const mz = .075 - bp;
	if (o.mag === 'curved') ext(A, acc, .024, [mz - .025,-.02, mz + .025,-.02, mz + .06,-.2, mz + .012,-.21], 0, [], 1);
	else if (o.mag === 'box') ext(A, FIN.P, .03, [mz - .03,-.02, mz + .03,-.02, mz + .03,-.085, mz - .03,-.085], 0, [], 1);
	else if (o.mag !== 'tube') ext(A, FIN.M, .022, [mz - .018,-.02, mz + .018,-.02, mz + .024,-.17, mz - .014,-.172]);
	const h0 = -zf, h1 = h0 + o.hg, hy0 = o.hgLow ?? .008;
	if (o.pump) {
		lat(B, FIN.M, 0,-.01, zf, [.012,0,.012, o.hg + .1,0, o.hg + .1]);
		lat(B, FIN.P, 0,-.01, zf - .06, [.022,0,.024,.01,.024,.15,.022,.16,0,.16], 1,20);
		for (let d = .08; d < .21; d += .018) lat(B, FIN.P, 0,-.01, zf - d, [.026,0,.026,.006,0,.006], 1,20);
	} else ext(B, o.hgColor ? lin(o.hgColor) : FIN.M, .044, [h0, hy0, h1, hy0 + .004, h1,.062, h0,.064], 0, slots(h0 + .02, h1 - .02, hy0 + .012,.05, Math.round(o.hg / .045)), 2);
	if (!o.pump) rail(B, .064, zf + .02, -h1 + .01);
	rail(B, .064, z0 - .01, zf + .02);
	const by = .035, bz = -h1;
	lat(B, FIN.M, 0, by, bz + .01, [o.bore, 0, o.bore, o.barrel, 0, o.barrel], 2,16);
	if (o.flute) for (let k = 0; k < 6; k++) box(B, FIN.R, -o.bore - .0005, by - .0015, bz - .04 - k * .04, o.bore + .0005, by + .0015, bz - .065 - k * .04);
	lat(B, FIN.M, 0, by, bz - o.barrel + .01, [.013,0,.013,.012,.011,.014,.011,.02,.013,.022,.013,.05,.009,.055,0,.055], 2,16);
	box(B, FIN.M, -.012, by - .014, bz, .012, by + .016, bz - .025);
	if (o.fore) ext(B, FIN.P, .026, [h0 + .07, hy0, h0 + .11, hy0, h0 + .105, hy0 - .09, h0 + .075, hy0 - .09], 0, [], 1);
	const sz0 = z0 - .005, stock = o.fp ? 'none' : o.stock; // in first person the stock sits behind the camera
	if (stock === 'tube') { lat(B, FIN.P, 0,.038, sz0 + .17, [.0135,0,.0135,.17], 1); ext(B, FIN.P, .034, [-sz0 - .1,.064, -sz0 - .26,.068, -sz0 - .27,-.045, -sz0 - .235,-.052, -sz0 - .13,.008, -sz0 - .1,.012], 0, [[-sz0 - .15,.045, -sz0 - .235,.048, -sz0 - .235,0, -sz0 - .165,.025]]); }
	else if (stock === 'chassis') ext(B, acc, .03, [-sz0,.06, -sz0 - .3,.07, -sz0 - .31,-.06, -sz0 - .27,-.065, -sz0 - .2,-.02, -sz0,-.025], 0, [[-sz0 - .04,.035, -sz0 - .15,.04, -sz0 - .15,0, -sz0 - .04,0], [-sz0 - .18,.04, -sz0 - .27,.045, -sz0 - .27,-.03, -sz0 - .2,0]], 1);
	else if (stock === 'wire') { for (const s of [-1,1]) lat(B, FIN.M, s * .014,.03, sz0 + .22, [.004,0,.004,.22], 2,8); box(B, FIN.P, -.02,-.01, sz0 + .22,.02,.06, sz0 + .235,1); }
	else if (stock === 'pump') ext(B, lin(0x5a3c26), .036, [-sz0,.055, -sz0 - .3,.06, -sz0 - .31,-.07, -sz0 - .27,-.075, -sz0 - .06,-.03, -sz0,-.02], 0, [], 1);
	if (o.bullpup && !o.fp) ext(B, acc, .036, [-z0 + .02,.064, -z0 - .14,.064, -z0 - .16,-.04, -z0 - .02,-.04], 0, [], 1);
	const sight = o.optic ? optic(B, o.optic, o.opticZ ?? -.06,.075) : .075;
	if (!o.optic) { box(B, FIN.M, -.008,.07, z0 - .01,.008,.086, z0 - .025); box(B, FIN.M, -.002,.07, -h1 + .03,.002,.09, -h1 + .035); }
	if (o.bolt) { box(K, FIN.S, .017,.035,-.02,.05,.042,-.028); lat(K, FIN.S, .055,.038,-.018, [.008,0,.008,.012,0,.012], 2,10); }
	return { B, K, A, muz: [0, by, bz - o.barrel - .05], left: [0,-.005, -(h0 + .09)], hg: o.pump ? [-.01,.026,.026] : [(hy0 + .064) / 2,.023, (.066 - hy0) / 2], sight, optic: o.optic, oz: o.opticZ ?? -.06 };
}

function knife() {
	const B = new Bld();
	ext(B, FIN.S, .004, [0,0,.17,.012,.2,.03,.15,.036,0,.03], 0, [], 2);
	ext(B, FIN.P, .022, [-.01,-.006,-.11,-.004,-.115,.036,-.01,.04], 0, [], 1);
	box(B, FIN.M, -.014,-.012,.006,.014,.046,-.004);
	return { B, K: null, A: null, muz: [0,.015,-.2], left: null, sight: .05 };
}

const SPECS = {
	wren: () => pistol({ len: .18, frame: FIN.P, slide: lin(0x3a3c3f), grip: FIN.P }),
	mako: () => pistol({ len: .205, frame: lin(0x5c5e60), slide: lin(0x8a8c8e), grip: FIN.W, hammer: true, wood: true }),
	hornet: (fp) => longGun({ fp, recv: .2, hg: .12, barrel: .05, bore: .011, mag: 'straight', stock: 'wire', optic: 'dot', opticZ: -.02, accent: 0x2f6b66, fore: true }),
	breaker: (fp) => longGun({ fp, recv: .2, hg: .36, barrel: .12, bore: .012, mag: 'tube', stock: 'pump', pump: true, accent: 0x333538 }),
	talon: (fp) => longGun({ fp, recv: .26, hg: .3, barrel: .14, bore: .0095, mag: 'curved', stock: 'tube', optic: 'dot', accent: 0x7a6c56, hgColor: 0x7a6c56 }),
	gavel: (fp) => longGun({ fp, recv: .12, hg: .32, barrel: .1, bore: .0095, mag: 'box', stock: 'none', bullpup: true, optic: 'holo', opticZ: -.12, accent: 0x4c5a66 }),
	longbow: (fp) => longGun({ fp, recv: .3, hg: .28, barrel: .34, bore: .012, mag: 'box', stock: 'chassis', optic: 'scope', opticZ: -.02, bolt: true, flute: true, accent: 0x55604a }),
	cutlass: knife,
};

const reticle = (() => {
	const c = document.createElement('canvas'); c.width = c.height = 64;
	const x = c.getContext('2d'), g = x.createRadialGradient(32,32,0,32,32,8);
	g.addColorStop(0, 'rgba(255,90,60,1)'); g.addColorStop(.4, 'rgba(255,60,40,.9)'); g.addColorStop(1, 'rgba(255,40,20,0)');
	x.fillStyle = g; x.fillRect(0,0,64,64);
	return new MeshBasicMaterial({ map: new CanvasTexture(c), transparent: true, blending: AdditiveBlending, depthWrite: false, color: new Color(4,1.4,1.2) });
})();
const lens = new MeshStandardMaterial({ color: 0x241f3c, metalness: .5, roughness: .05, transparent: true, opacity: .6, envMapIntensity: 2.5, side: DoubleSide });

// lod = true: one merged mesh (third person). Otherwise slide and magazine stay separate and optics get a reticle.
export function buildWeapon(id, lod = false) {
	const s = (SPECS[id] || SPECS.wren)(!lod), g = new Group();
	if (lod) { for (const P of [s.K, s.A]) if (P) s.B.merge(P); s.K = s.A = null; }
	const mk = (P) => { if (!P || !P.p.length) return null; const m = new Mesh(P.geo(), weaponMaterial); m.castShadow = lod; g.add(m); return m; };
	mk(s.B);
	const slide = mk(s.K), mag = mk(s.A);
	if (!lod && s.optic) { // tinted glass at both ends of the optic and an HDR red dot that reads on sky and walls
		const sc = s.optic === 'scope', z0 = s.oz + (sc ? .139 : -.001), z1 = z0 - (sc ? .308 : s.optic === 'holo' ? .088 : .048), R = sc ? .024 : .02;
		for (const z of [z0, z1]) { const l = new Mesh(new CircleGeometry(R, 20), lens); l.position.set(0, s.sight, z); g.add(l); }
		if (s.optic !== 'scope') { const r = new Mesh(new PlaneGeometry(.03,.03), reticle); r.position.set(0, s.sight, (z0 + z1) / 2); r.renderOrder = 2; g.add(r); }
	}
	const muzzle = new Object3D(); muzzle.position.fromArray(s.muz); g.add(muzzle);
	return { group: g, muzzle, slide, mag, left: s.left, hg: s.hg, sight: s.sight };
}
