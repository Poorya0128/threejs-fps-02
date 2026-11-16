// First-person weapon, gloved hands and sleeves (ART.md §9), sprung motion, sun-following key light.
import { Group, Mesh, ShaderMaterial, PlaneGeometry, AdditiveBlending, DoubleSide, DirectionalLight, HemisphereLight, Vector3, CapsuleGeometry,
	CylinderGeometry, SphereGeometry, TubeGeometry, CatmullRomCurve3, Matrix4, Quaternion, Color } from 'three';
import { buildWeapon, weaponMaterial } from './weapons-art.js';
import { Bld, lin, along } from './mesh.js';
import { damp, losBlocked } from '../math.js';
import { TEAM_LOOK, WEAPONS } from '../config.js';

const HOLD = { pistol: [.075, -.105, -.43], rifle: [.11, -.128, -.37] }, ADS = [0, -.074, -.22];
export const GLOVE = lin(0xa48a62);
const toAds = (hip, k, a) => hip[k] + (ADS[k] - hip[k]) * a;
const _m = new Matrix4(), _q = new Quaternion(), _v = new Vector3(), _s = new Vector3(), _x = new Vector3(1, 0, 0), P = (x, y, z) => new Vector3(x, y, z);
const seg = (B, a, b, r, col) => B.add(new CapsuleGeometry(r, a.distanceTo(b), 3, 10), along(a, b), 1, col);
const pad = (B, x, y, z, sx, sy, sz, rx, col) => B.add(new SphereGeometry(1, 14, 10), _m.compose(_v.set(x, y, z), _q.setFromAxisAngle(_x, rx), _s.set(sx, sy, sz)), 1, col);
const se = (d, a, b, p) => { const c = Math.cos(d / 57.3), s = Math.sin(d / 57.3); return [a * Math.sign(c) * Math.abs(c) ** p, b * Math.sign(s) * Math.abs(s) ** p]; };
const at = (L, y) => L[0] + (L[2] - L[0]) * (y - L[1]) / (L[3] - L[1]);
// Finger or thumb: a tube through pts with a round tip. Fingers are 17 mm thick and 16 mm apart, so they touch.
const R_F = .0085, GAP = .016;
function finger(B, pts, col, r = R_F) {
	B.add(new TubeGeometry(new CatmullRomCurve3(pts), 16, r, 8), _m.identity(), 1, col);
	for (const q of [pts[0], pts.at(-1)]) B.add(new SphereGeometry(r, 10, 8), _m.makeTranslation(q), 1, col);
}
// Six points from d0° to d1° on a superellipse section (a, b, p), placed by pt(u, v, j).
const arc = (d0, d1, a, b, p, pt) => Array.from({ length: 6 }, (_, j) => pt(...se(d0 + (d1 - d0) * j / 5, a, b, p), j));

// Hands from the weapon's grip data: right palm and three fingers round the grip, index on the trigger, thumb along the
// frame; left hand round the handguard or over the right hand. Each finger ends at its own angle, for its own length.
export function buildHands(w, glove) {
	const R = new Bld(), L = new Bld(), G = w.grip, zf = (y) => at(G.f, y), zb = (y) => at(G.b, y), zc = (y) => (zf(y) + zb(y)) / 2;
	const hw = G.hw, ym = G.fy - .022, [ty, tz] = G.trig, xT = -G.side - R_F, yT = G.top + .009, rake = -Math.atan2(zb(G.top - .1) - zb(G.top), .1);
	const wrap = (y, out, d0, d1) => arc(d0, d1, hw + out, (zb(y) - zf(y)) / 2 + out, .6, (x, z, j) => P(x, y - j * .0015, zc(y) + z));
	seg(R, P(.002, G.top - .012, zb(G.top - .012) + .012), P(.003, G.fy - .05, zb(G.fy - .05) + .012), .016, glove);
	pad(R, hw * .6, ym, zb(ym) - .002, .016, .04, .022, rake, glove);
	pad(R, -hw * .5, G.top - .016, zb(G.top - .016) + .004, .011, .024, .016, rake, glove);
	for (let k = 0; k < 3; k++) finger(R, wrap(G.fy - k * GAP, R_F * .85, 35, [-172, -165, -142][k]), glove);
	finger(R, [P(hw + R_F * .8, ty + .004, zb(G.top) - .008), P(hw + R_F * .8, ty + .001, tz + .024), P(hw * .5 + .004, ty - .003, tz + .008), P(.004, ty - .007, tz - .004)], glove);
	finger(R, [P(-hw * .6, G.top + .001, zb(G.top) + .006), P(xT + .002, yT, zb(G.top) - .004), P(xT, yT + .002, zf(G.top) - .006), P(xT + .002, yT + .002, zf(G.top) - .025)], glove, .0092);
	const rw = [hw * .4, ym - .01, zb(ym) + .036];
	seg(R, P(.004, ym, zb(ym) + .014), P(...rw), .021, glove);
	let lw;
	if (w.left) {
		const z = w.left[2], [cy, rx, ry, p] = w.hg, [px, py] = se(-135, rx + .013, ry + .013, p);
		pad(L, px, cy + py, z + .006, .02, .016, .04, 0, glove);
		for (let k = 0; k < 4; k++) finger(L, arc(-150, [52, 58, 48, 30][k], rx + R_F * .85, ry + R_F * .85, p, (x, y, j) => P(x, cy + y, z - .028 + k * GAP + j * .001)), glove);
		finger(L, [P(px, cy + py + .004, z + .03), P(-rx - .01, cy - ry * .3, z + .012), P(-rx - .009, cy, z - .01), P(-rx - .008, cy + ry * .15, z - .03)], glove, .0092);
		lw = [-rx - .008, cy - ry - .004, z + .062]; seg(L, P(px, cy + py, z + .03), P(...lw), .021, glove);
	} else {
		pad(L, -hw - .022, ym, zc(ym) + .006, .011, .034, .026, rake, glove);
		for (let k = 0; k < 4; k++) finger(L, wrap(G.fy + .006 - k * GAP, R_F * 2.7, 165, [282, 286, 280, 268][k]), glove);
		finger(L, [P(-hw - .02, G.top - .024, zb(G.top) + .004), P(xT - .006, G.top - .02, zc(G.top)), P(xT - .004, G.top - .02, zf(G.top) - .008), P(xT - .002, G.top - .02, zf(G.top) - .026)], glove, .0092);
		lw = [-hw - .024, G.fy - .05, zb(G.fy - .05) + .02]; seg(L, P(-hw - .02, ym - .02, zc(ym) + .01), P(...lw), .02, glove);
	}
	return { R, L, rw, lw };
}

function buildArms(team, w) {
	const sleeve = lin(new Color(TEAM_LOOK[team].cloth).lerp(new Color(0x3c3d3e), .5)), { R, L, rw, lw } = buildHands(w, GLOVE);
	const limb = (B, a, b, r0, r1) => B.add(new CylinderGeometry(r1, r0, a.distanceTo(b), 14, 3), along(a, b), 0, sleeve);
	limb(R, P(...rw), P(.1, -.2, .42), .03, .04);
	if (lw) limb(L, P(...lw), P(lw[0] - .17, lw[1] - .22, lw[2] + .2), .03, .046);
	return [R, L].map((B) => { if (!B.p.length) return null; const m = new Mesh(B.geo(), weaponMaterial); m.renderOrder = 1; return m; });
}

const flashMat = new ShaderMaterial({
	uniforms: { uT: { value: 0 }, uSeed: { value: 0 } }, transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide,
	vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
	fragmentShader: `varying vec2 vUv;uniform float uT,uSeed;
	void main(){vec2 p=vUv*2.-1.;float r=length(p),a=atan(p.y,p.x);
	float rays=pow(abs(sin(a*3.+uSeed*6.)),10.)*.7+pow(abs(sin(a*5.+uSeed*2.)),16.)*.5;
	gl_FragColor=vec4(vec3(1.,.7,.36)*(exp(-r*r*18.)*3.+rays*smoothstep(1.,0.,r)*1.6)*uT*7.,1.);}`,
});

export function createViewmodel(vmScene, sunDir) {
	const root = new Group(), flash = new Group(), cache = {};
	const key = new DirectionalLight(0xffd2a1, 2.2), fill = new HemisphereLight(0x9ab0d0, 0x6a5040, 1.2), rim = new DirectionalLight(0xdfe8ff, 1.1);
	rim.position.set(-.6, .9, -.5); vmScene.add(root, key, key.target, fill, rim);
	for (let k = 0; k < 4; k++) { const q = new Mesh(new PlaneGeometry(.09, .09), flashMat); if (k < 3) { q.rotation.set(Math.PI / 2, k * Math.PI / 3, 0); q.scale.set(1, 2.2, 1); } else q.scale.setScalar(1.2); flash.add(q); }
	const s = { rx: 0, ry: 0, bob: 0, kick: 0, kickV: 0, flashT: 0, rl0: 0, draw: 0, ads: 0, sun: 1, roof: 0, sunT: 1, roofT: 0, yaw: 0, pitch: 0, shots: 0, lit: 0 };
	let cur = null, curKey = '';
	function setWeapon(id, team) {
		const k = `${id}:${team}`;
		if (curKey === k) return;
		if (cur) root.remove(cur.group);
		if (!cache[k]) {
			const w = cache[k] = buildWeapon(id), [right, left] = buildArms(team, w);
			for (const m of [right, left]) if (m) w.group.add(m);
			w.leftArm = left; w.mag0 = w.mag?.position.y;
		}
		s.draw = curKey ? 1 : 0; cur = cache[k]; curKey = k; root.add(cur.group); cur.muzzle.add(flash);
	}
	return {
		group: root,
		flash() { s.flashT = .035; flashMat.uniforms.uSeed.value = Math.random(); flash.rotation.z = Math.random() * 3; },
		update(state, cam, dt) {
			const p = state.player, id = p.weapons[p.active], hip = HOLD[WEAPONS[id].cls] || HOLD.rifle, rel = p.reloadT;
			setWeapon(id, p.team);
			root.visible = !(p.scoped && id === 'longbow');
			if (p.shotsFired > s.shots) s.kickV += id === 'longbow' || id === 'breaker' ? 2.2 : 1;
			s.shots = p.shotsFired;
			s.rl0 = rel > 0 ? s.rl0 || rel : 0;
			s.rx = damp(s.rx, (p.pitch - s.pitch) * 1.4, 12, dt); s.ry = damp(s.ry, (p.yaw - s.yaw) * 1.4, 12, dt);
			s.pitch = p.pitch; s.yaw = p.yaw;
			const speed = Math.hypot(p.vel.x, p.vel.z), bobA = Math.min(1, speed / 5) * (p.onGround ? 1 : .2);
			s.bob += dt * (1.2 + speed * 1.55);
			s.kickV += (-s.kick * 140 - s.kickV * 16) * dt; s.kick += s.kickV * dt;
			s.draw = Math.max(0, s.draw - dt * 2.8); s.ads = damp(s.ads, p.scoped ? 1 : 0, 14, dt);
			const t = s.rl0 > 0 ? 1 - rel / s.rl0 : 0, dip = Math.sin(Math.min(1, t * 1.15) * Math.PI), d = s.draw * s.draw, A = s.ads;
			root.position.set(toAds(hip, 0, A) + Math.cos(s.bob) * .006 * bobA - s.ry * .05,
				toAds(hip, 1, A) + Math.abs(Math.sin(s.bob)) * .007 * bobA + Math.sin(state.time * 1.6) * .0015 - d * .2 - dip * .035 - p.crouch * .012 + s.rx * .04, toAds(hip, 2, A) + s.kick * .045);
			root.rotation.set(s.kick * .13 + dip * .35 - d * .6 + s.rx * .5, .045 * (1 - A) + s.ry * .6, dip * .45 + Math.cos(s.bob) * .012 * bobA + s.ry * .3);
			if (cur.slide) cur.slide.position.z = Math.min(.03, Math.max(0, s.kick * .05));
			if (cur.mag) cur.mag.position.y = cur.mag0 - Math.max(0, Math.sin(Math.min(1, t * 1.6) * Math.PI)) * .22;
			cur.leftArm?.position.set(0, -dip * .09, dip * .06);
			s.flashT -= dt; flashMat.uniforms.uT.value = Math.max(0, s.flashT / .035); flash.visible = s.flashT > 0;
			if ((s.lit = (s.lit + 1) % 6) === 0) {
				const e = cam.position;
				s.sunT = losBlocked(state.boxes, e.x, e.y, e.z, e.x + sunDir.x * 60, e.y + sunDir.y * 60, e.z + sunDir.z * 60) ? 0 : 1;
				s.roofT = losBlocked(state.boxes, e.x, e.y, e.z, e.x, e.y + 12, e.z) ? 1 : 0;
			}
			s.sun = damp(s.sun, s.sunT, 4, dt); s.roof = damp(s.roof, s.roofT, 4, dt);
			key.intensity = .2 + 1.5 * s.sun; fill.intensity = 1.2 - .6 * s.roof;
			key.position.copy(sunDir).applyQuaternion(_q.copy(cam.quaternion).invert());
		},
	};
}
