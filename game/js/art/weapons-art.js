// Original firearms from parts (ART.md §9). Origin = trigger, forward = -z, metres; aE 1 polymer, 2 metal.
import { Shape, Path, ExtrudeGeometry, LatheGeometry, Vector2, Matrix4, Mesh, Group, Object3D, Color, MeshBasicMaterial, AdditiveBlending,
	PlaneGeometry, CircleGeometry, MeshStandardMaterial, DoubleSide } from 'three';
import { Bld, boxInto, lin, canvasTex } from './mesh.js';
import { procMaterial } from './materials.js';

const FIN = { K: lin(0x1b1c1f), M: lin(0x8a8e93), P: lin(0x45464a), S: lin(0xc4c7ca), R: lin(0x5a5d61) };
export const weaponMaterial = procMaterial({ c: 0xffffff, pat: 12, bump: .004, env: 1.2, metal: 1 });
const _m = new Matrix4();

const box = (B, f, x0, y0, z0, x1, y1, z1, e = 2) => boxInto(B, [x0, y0, Math.min(z0, z1)], [x1, y1, Math.max(z0, z1)], .0025, f, .2, e, e);
const path = (P, pts) => { P.moveTo(pts[0], pts[1]); for (let k = 2; k < pts.length; k += 2) P.lineTo(pts[k], pts[k + 1]); return P; };
function ext(B, f, t, pts, holes = [], e = 1) {
	const s = path(new Shape(), pts);
	for (const h of holes) s.holes.push(path(new Path(), h));
	B.add(new ExtrudeGeometry(s, { depth: t, bevelThickness: .002, bevelSize: .0018, bevelSegments: 2, curveSegments: 4 }), _m.makeRotationY(Math.PI / 2).setPosition(-t / 2,0,0), e, f);
}
function lat(B, f, x, y, z0, prof, e = 2, seg = 18) {
	const pts = [];
	for (let k = 0; k < prof.length; k += 2) pts.push(new Vector2(prof[k], prof[k + 1]));
	B.add(new LatheGeometry(pts, seg), _m.makeRotationX(-Math.PI / 2).setPosition(x, y, z0), e, f);
}
const rail = (B, y, z0, z1) => { box(B, FIN.M, -.011, y, z0, .011, y + .006, z1); for (let z = z0 - .005; z > z1; z -= .01) box(B, FIN.M, -.011, y + .006, z, .011, y + .011, z - .005); };
const slots = (u0, u1, v0, v1, n) => Array.from({ length: n }, (_, k) => { const a = u0 + (k + .25) * (u1 - u0) / n, b = a + (u1 - u0) / n / 2; return [a, v0, b, v0, b, v1, a, v1]; });

function optic(B, kind, z, y) {
	if (kind === 'scope') {
		lat(B, FIN.K, 0, y + .045, z + .14, [0,0,.028,0,.028,.07,.019,.1,.019,.2,.025,.24,.025,.3,.023,.31,0,.31], 1,24);
		for (const zz of [z + .07, z - .08]) box(B, FIN.K, -.012, y, zz, .012, y + .03, zz - .02,1);
		lat(B, FIN.K, .024, y + .045, z - .01, [0,0,.009,0,.009,.02,0,.02], 1,12);
		return y + .045;
	}
	if (kind === 'holo') {
		box(B, FIN.K, -.017, y, z, .017, y + .012, z - .09,1);
		for (const x of [-.017,.017]) box(B, FIN.K, x - .002, y + .012, z, x + .002, y + .055, z - .09,1);
		box(B, FIN.K, -.019, y + .051, z, .019, y + .056, z - .09,1);
		return y + .033;
	}
	box(B, FIN.K, -.013, y, z, .013, y + .01, z - .05,1);
	lat(B, FIN.K, 0, y + .03, z, [.023,0,.023,.05,.02,.052], 1,20);
	return y + .03;
}

// Hand placement: grip front/back edges [z, y, z, y], grip and frame half widths, web and first-finger heights, trigger [y, z].
const PGRIP = { f: [-.016,-.03,-.005,-.12], b: [.012,-.01,.03,-.115], hw: .017, side: .014, top: -.014, fy: -.052, trig: [-.027,-.033] };
const LGRIP = { f: [.008,-.03,.024,-.124], b: [.035,-.02,.058,-.118], hw: .016, side: .0155, top: -.026, fy: -.062, trig: [-.032,-.017] };
function pistol(o) {
	const B = new Bld(), K = new Bld(), A = new Bld(), L = o.len;
	box(B, o.frame, -.014,-.012,.035,.014,.012, -L + .02,1);
	box(K, o.slide, -.016,.012,.045,.016,.044, -L);
	for (let z = .035; z > 0; z -= .007) box(K, FIN.R, -.0165,.016, z, .0165,.04, z - .0025);
	box(K, FIN.M, -.003,.044, -L + .01,.003,.051, -L + .018); box(K, FIN.M, -.009,.044,.035,.009,.05,.028);
	lat(B, FIN.S, 0,.028, -L + .002, [.0065,0,.0065,.005,0,.005], 2,12);
	ext(B, o.grip, .03, [.03,-.01,-.012,-.01,-.03,-.115,.005,-.12,.016,-.03]);
	ext(B, o.frame, .012, [0,-.012,-.07,-.012,-.07,-.036,-.06,-.044,-.01,-.044], [[-.012,-.018,-.055,-.018,-.05,-.038,-.015,-.038]]);
	box(B, FIN.S, -.002,-.036,-.03,.002,-.014,-.036);
	box(A, FIN.M, -.012,-.112,.012,.012,-.124,-.026);
	return { B, K, A, muz: [0,.028, -L - .01], sight: .05, grip: PGRIP };
}

function longGun(o) {
	const B = new Bld(), A = new Bld(), K = new Bld(), acc = lin(o.accent), bp = o.bullpup ? .17 : 0, z0 = .04 + bp, zf = -o.recv + bp, mz = .075 - bp;
	box(B, FIN.M, -.017,.012, z0, .017,.064, zf);
	box(B, acc, -.0155,-.028, z0 - .005,.0155,.013, zf + .06,1);
	box(K, FIN.S, .016,.03,-.03 + bp * .4,.024,.045,-.07 + bp * .4);
	ext(B, FIN.P, .028, [0,-.02,-.035,-.02,-.058,-.118,-.024,-.124,-.008,-.03]);
	box(B, FIN.P, -.004,-.052,.002,.004,-.046,-.062,1); box(B, FIN.S, -.002,-.044,-.014,.002,-.02,-.02);
	if (o.mag === 'curved') ext(A, acc, .024, [mz - .025,-.02, mz + .025,-.02, mz + .06,-.2, mz + .012,-.21]);
	else if (o.mag === 'box') ext(A, FIN.P, .03, [mz - .03,-.02, mz + .03,-.02, mz + .03,-.085, mz - .03,-.085]);
	else if (o.mag) ext(A, FIN.M, .022, [mz - .018,-.02, mz + .018,-.02, mz + .024,-.17, mz - .014,-.172]);
	const h0 = -zf, h1 = h0 + o.hg, hy = o.hgLow ?? .008, by = .035, bz = -h1, s0 = z0 - .005;
	ext(B, o.hgColor ? lin(o.hgColor) : FIN.M, .044, [h0, hy, h1, hy + .004, h1, .062, h0, .064], slots(h0 + .02, h1 - .02, hy + .012,.05, Math.round(o.hg / .045)), 2);
	rail(B, .064, zf + .02, -h1 + .01);
	rail(B, .064, z0 - .01, zf + .02);
	lat(B, FIN.M, 0, by, bz + .01, [o.bore, 0, o.bore, o.barrel, 0, o.barrel], 2,16);
	if (o.flute) for (let k = 0; k < 6; k++) box(B, FIN.R, -o.bore - .0005, by - .0015, bz - .04 - k * .04, o.bore + .0005, by + .0015, bz - .065 - k * .04);
	lat(B, FIN.M, 0, by, bz - o.barrel + .01, [.013,0,.013,.012,.011,.014,.011,.02,.013,.022,.013,.05,.009,.055,0,.055], 2,16);
	box(B, FIN.M, -.012, by - .014, bz, .012, by + .016, bz - .025);
	if (o.fore) ext(B, FIN.P, .026, [h0 + .07, hy, h0 + .11, hy, h0 + .105, hy - .09, h0 + .075, hy - .09]);
	const S = (pts, f = FIN.P, holes = []) => ext(B, f, .034, pts.map((v, i) => (i % 2 ? v : -s0 - v)), holes.map((h) => h.map((v, i) => (i % 2 ? v : -s0 - v))));
	const stock = o.fp ? '' : o.stock;
	if (stock === 'tube') { lat(B, FIN.P, 0,.038, s0 + .17, [.0135,0,.0135,.17], 1); S([.1,.064,.26,.068,.27,-.045,.235,-.052,.13,.008,.1,.012], FIN.P, [[.15,.045,.235,.048,.235,0,.165,.025]]); }
	else if (stock === 'chassis') S([0,.06,.3,.07,.31,-.06,.27,-.065,.2,-.02,0,-.025], acc, [[.04,.035,.15,.04,.15,0,.04,0], [.18,.04,.27,.045,.27,-.03,.2,0]]);
	else if (stock === 'wire') { for (const s of [-1,1]) lat(B, FIN.M, s * .014,.03, s0 + .22, [.004,0,.004,.22], 2,8); box(B, FIN.P, -.02,-.01, s0 + .22,.02,.06, s0 + .235,1); }
	else if (o.bullpup && !o.fp) S([-.015,.064,.145,.064,.165,-.04,.025,-.04], acc);
	const sight = o.optic ? optic(B, o.optic, o.opticZ ?? -.06,.075) : .075;
	if (!o.optic) { box(B, FIN.M, -.008,.07, z0 - .01,.008,.086, z0 - .025); box(B, FIN.M, -.002,.07, -h1 + .03,.002,.09, -h1 + .035); }
	if (o.bolt) { box(K, FIN.S, .017,.035,-.02,.05,.042,-.028); lat(K, FIN.S, .055,.038,-.018, [.008,0,.008,.012,0,.012], 2,10); }
	return { B, K, A, muz: [0, by, bz - o.barrel - .05], left: [0,-.005, -(h0 + .09)], grip: LGRIP, sight, optic: o.optic, oz: o.opticZ ?? -.06,
		hg: [(hy + .064) / 2,.024, (.068 - hy) / 2,.55] };
}

const SPECS = {
	wren: () => pistol({ len: .18, frame: FIN.P, slide: lin(0x3a3c3f), grip: FIN.P }),
	hornet: (fp) => longGun({ fp, recv: .2, hg: .12, barrel: .05, bore: .011, mag: 'straight', stock: 'wire', optic: 'dot', opticZ: -.02, accent: 0x2f6b66, fore: true }),
	talon: (fp) => longGun({ fp, recv: .26, hg: .3, barrel: .14, bore: .0095, mag: 'curved', stock: 'tube', optic: 'dot', accent: 0x7a6c56, hgColor: 0x7a6c56 }),
	gavel: (fp) => longGun({ fp, recv: .12, hg: .32, barrel: .1, bore: .0095, mag: 'box', bullpup: true, optic: 'holo', opticZ: -.12, accent: 0x4c5a66 }),
	longbow: (fp) => longGun({ fp, recv: .3, hg: .28, barrel: .34, bore: .012, mag: 'box', stock: 'chassis', optic: 'scope', opticZ: -.02, bolt: true, flute: true, accent: 0x55604a }),
};

const reticle = new MeshBasicMaterial({ transparent: true, blending: AdditiveBlending, depthWrite: false, color: new Color(4,1.4,1.2), map: canvasTex(64, (x) => {
	const g = x.createRadialGradient(32,32,0,32,32,8);
	g.addColorStop(0, '#ff5a3c'); g.addColorStop(.4, 'rgba(255,60,40,.9)'); g.addColorStop(1, 'rgba(255,40,20,0)'); x.fillStyle = g; x.fillRect(0,0,64,64);
}) });
const lens = new MeshStandardMaterial({ color: 0x241f3c, metalness: .5, roughness: .05, transparent: true, opacity: .6, envMapIntensity: 2.5, side: DoubleSide });

// lod: one merged mesh for soldiers; otherwise animated slide and magazine, glass optics.
export function buildWeapon(id, lod = false) {
	const s = SPECS[id](!lod), g = new Group(), mk = (P) => { if (!P?.p.length) return null; const m = new Mesh(P.geo(), weaponMaterial); m.castShadow = lod; g.add(m); return m; };
	if (lod) { for (const P of [s.K, s.A]) if (P) s.B.merge(P); s.K = s.A = null; }
	mk(s.B);
	const slide = mk(s.K), mag = mk(s.A), muzzle = new Object3D();
	if (!lod && s.optic) {
		const sc = s.optic === 'scope', z0 = s.oz + (sc ? .139 : -.001), z1 = z0 - (sc ? .308 : s.optic === 'holo' ? .088 : .048);
		for (const z of [z0, z1]) { const l = new Mesh(new CircleGeometry(sc ? .024 : .02,20), lens); l.position.set(0, s.sight, z); g.add(l); }
		if (!sc) { const r = new Mesh(new PlaneGeometry(.03,.03), reticle); r.position.set(0, s.sight, (z0 + z1) / 2); r.renderOrder = 2; g.add(r); }
	}
	muzzle.position.fromArray(s.muz); g.add(muzzle);
	return { group: g, muzzle, slide, mag, left: s.left, hg: s.hg, grip: s.grip, sight: s.sight };
}
