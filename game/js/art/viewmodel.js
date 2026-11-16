// SALTLINE art/viewmodel.js — first-person weapon, gloved hands and sleeves (ART.md §9). Springs drive sway, bob,
// kick, slide cycling, reload and draw; a key light follows the real sun and dims when the eye is in shade.
import { Group, Mesh, ShaderMaterial, PlaneGeometry, AdditiveBlending, DoubleSide, DirectionalLight, HemisphereLight, Vector3, CapsuleGeometry,
	CylinderGeometry, SphereGeometry, Matrix4, Quaternion, Color } from 'three';
import { buildWeapon, weaponMaterial } from './weapons-art.js';
import { Bld } from './mesh.js';
import { damp, losBlocked } from '../math.js';
import { TEAM_LOOK, WEAPONS } from '../config.js';

const HOLD = { pistol: [.075,-.105,-.43], knife: [.12,-.13,-.3], rifle: [.11,-.128,-.37] }, ADS = [0,-.074,-.22];
const lin = (h) => { const c = new Color(h); return [c.r, c.g, c.b]; };
const _m = new Matrix4(), _q = new Quaternion(), _v = new Vector3(), _c = new Vector3(), _a = new Vector3(), _b = new Vector3(), _s = new Vector3(1,1,1), _up = new Vector3(0,1,0), _ax = new Vector3(1,0,0);
function limb(B, a, b, r0, r1, col, e) {
	_v.subVectors(b, a); const len = _v.length();
	_q.setFromUnitVectors(_up, _v.normalize());
	B.add(new CylinderGeometry(r1, r0, len, 14,3), _m.compose(_c.addVectors(a, b).multiplyScalar(.5), _q, _s.set(1,1,1)), e, col);
}
// Capsule bone between two points (smooth leather: aE 1); a finger is three of them (tapering phalanges, the last one tinted) that follow a
// superellipse around the part it grips, so the pads sit on the grip's flats and corners without cutting into them.
function seg(B, a, b, r, col) {
	_v.subVectors(b, a); const len = _v.length(); _q.setFromUnitVectors(_up, _v.normalize());
	B.add(new CapsuleGeometry(r, len, 3, 10), _m.compose(_c.addVectors(a, b).multiplyScalar(.5), _q, _s.set(1, 1, 1)), 1, col);
}
const P = (x, y, z) => new Vector3(x, y, z);
const pad = (B, x, y, z, sx, sy, sz, rx, col) => B.add(new SphereGeometry(1, 14, 10), _m.compose(_v.set(x, y, z), _q.setFromAxisAngle(_ax, rx), _s.set(sx, sy, sz)), 1, col);
const R_F = .0084; // finger radius: 17 mm fingers, 21 mm apart, so a 4 mm gap shows between them
function finger(B, pts, col, tip, knuckle) {
	for (let k = 0; k < 3; k++) seg(B, pts[k], pts[k + 1], R_F * (1 - k * .1), k === 2 ? tip : col);
	if (knuckle) B.add(new SphereGeometry(R_F * 1.12, 10, 8), _m.compose(pts[0], _q.identity(), _s.set(1, 1, 1)), 1, knuckle);
}
const se = (d, a, b, p) => { const c = Math.cos(d / 57.3), s = Math.sin(d / 57.3); return [a * Math.sign(c) * Math.abs(c) ** p, b * Math.sign(s) * Math.abs(s) ** p]; };
const at = (L, y) => L[0] + (L[2] - L[0]) * (y - L[1]) / (L[3] - L[1]);
// Hands on a weapon (gun-local coordinates, from weapons-art grip data). Right hand: heel of the palm behind the grip,
// back of the hand on its right flat, three fingers wrapped round the front at the grip's rake, index finger through
// the guard onto the trigger, thumb along the left side of the receiver. Left hand: palm under the handguard, four
// fingers round its right side, thumb along its left side; on pistols it wraps the right hand instead.
// Returns the meshes' builders and the wrist points the arms (viewmodel sleeves, soldier IK) attach to.
export function buildHands(w, knife, glove, tip, knuckle) {
	const R = new Bld(), L = new Bld(), G = w.grip, zf = (y) => at(G.f, y), zb = (y) => at(G.b, y);
	const rake = -Math.atan2(zb(G.top - .1) - zb(G.top), .1), ym = G.fy - .02, hw = G.hw;
	const wrap = (y, out, deg) => { const zc = (zf(y) + zb(y)) / 2, hd = (zb(y) - zf(y)) / 2; return deg.map((d, j) => { const [x, z] = se(d, hw + R_F + out, hd + R_F + out, .6); return P(x, y - j * .002, zc + z); }); };
	seg(R, P(.002, G.top - .012, zb(G.top - .012) + .012), P(.003, G.fy - .05, zb(G.fy - .05) + .012), .016, glove);
	pad(R, hw + .006, ym + .004, zb(ym) - .012, .009, .036, .021, rake, glove);
	pad(R, hw * .3, G.top - .004, zb(G.top) + .006, .018, .011, .016, 0, glove);
	for (let k = 0; k < 3; k++) finger(R, wrap(G.fy - k * .021, .001, [42, -30, -105, -168]), glove, tip, knuckle);
	const [ty, tz] = G.trig;
	finger(R, [P(hw + .007, ty + .003, zb(G.top) - .004), P(hw + .007, ty, tz + .026), P(hw * .5 + .005, ty - .003, tz + .009), P(.002, ty - .005, tz - .007)], glove, tip, knuckle);
	const yT = G.top + .01;
	const xT = -G.side - R_F * 1.1;
	finger(R, [P(hw * .2, G.top - .004, zb(G.top) + .012), P(xT + .002, yT, zb(G.top) - .002), P(xT, yT + .002, zf(G.top) - .008), P(xT + .001, yT + .003, zf(G.top) - .032)], glove, tip);
	const rw = [hw * .4, ym - .01, zb(ym) + .036];
	seg(R, P(.004, ym, zb(ym) + .014), P(...rw), .021, glove);
	let lw = null;
	if (!knife && w.left) {
		const z = w.left[2], [cy, rx, ry, p] = w.hg, ring = (zz, deg) => deg.map((d) => { const [x, y] = se(d, rx + R_F + .001, ry + R_F + .001, p); return P(x, cy + y, zz); });
		const [px, py] = se(-135, rx + .013, ry + .013, p);
		seg(L, P(px, cy + py, z + .042), P(px + .006, cy + py, z - .03), .017, glove);
		for (let k = 0; k < 4; k++) finger(L, ring(z - .032 + k * .021, [-150, -85, -15, 45]), glove, tip, knuckle);
		finger(L, [P(-rx - .012, cy - ry * .45, z + .045), P(-rx - .01, cy - ry * .2, z + .018), P(-rx - .009, cy, z - .01), P(-rx - .008, cy + ry * .12, z - .036)], glove, tip);
		lw = [-rx - .008, cy - ry - .004, z + .062]; seg(L, P(px, cy + py, z + .04), P(...lw), .021, glove);
	} else if (!knife) {
		const zc = (y) => (zf(y) + zb(y)) / 2;
		pad(L, -hw - .024, ym, zc(ym) + .006, .01, .034, .026, rake, glove);
		for (let k = 0; k < 3; k++) finger(L, wrap(G.fy - k * .021, R_F * 2, [165, 218, 255, 284]), glove, tip, knuckle);
		finger(L, [P(-hw - .02, G.top - .02, zb(G.top) + .004), P(xT - .004, G.top - .018, zc(G.top)), P(xT - .002, G.top - .018, zf(G.top) - .008), P(xT, G.top - .018, zf(G.top) - .028)], glove, tip);
		lw = [-hw - .024, G.fy - .05, zb(G.fy - .05) + .02]; seg(L, P(-hw - .02, ym - .02, zc(ym) + .01), P(...lw), .02, glove);
	}
	return { R, L, rw, lw };
}
// First-person arms: the hands plus a glove cuff and a muted team sleeve running back out of view.
function buildArms(team, w, knife) {
	const glove = lin(0xa48a62), sleeve = lin(new Color(TEAM_LOOK[team].cloth).lerp(new Color(0x3c3d3e), .5).getHex());
	const { R, L, rw, lw } = buildHands(w, knife, glove, lin(0x8a7350), lin(0x9c8460));
	limb(R, _a.fromArray(rw), _b.set(.1, -.2, .42), .03, .04, sleeve, 0);
	if (lw) limb(L, _a.fromArray(lw), _b.set(lw[0] - .17, lw[1] - .22, lw[2] + .2), .03, .046, sleeve, 0);
	const mk = (B) => { if (!B.p.length) return null; const m = new Mesh(B.geo(), weaponMaterial); m.renderOrder = 1; return m; };
	return { right: mk(R), left: mk(L) };
}

const flashMat = new ShaderMaterial({
	uniforms: { uT: { value: 0 }, uSeed: { value: 0 } }, transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide,
	vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
	fragmentShader: `varying vec2 vUv;uniform float uT,uSeed;
	void main(){vec2 p=vUv*2.-1.;float r=length(p),a=atan(p.y,p.x);
	float rays=pow(abs(sin(a*3.+uSeed*6.)),10.)*.7+pow(abs(sin(a*5.+uSeed*2.)),16.)*.5;
	float i=(exp(-r*r*18.)*3.+rays*smoothstep(1.,.0,r)*1.6)*uT;
	gl_FragColor=vec4(vec3(1.,.7,.36)*i*7.,1.);}`,
});

export function createViewmodel(vmScene, sunDir) {
	const root = new Group(), gun = new Group();
	vmScene.add(root); root.add(gun);
	const key = new DirectionalLight(0xffd2a1,2.2), fill = new HemisphereLight(0x9ab0d0,0x6a5040,1.2);
	const rim = new DirectionalLight(0xdfe8ff, 1.1); rim.position.set(-.6,.9,-.5);
	vmScene.add(key, key.target, fill, rim);
	const flash = new Group();
	for (let k = 0; k < 3; k++) { const q = new Mesh(new PlaneGeometry(.09,.09), flashMat); q.rotation.y = k * Math.PI / 3; q.rotation.x = Math.PI / 2; q.scale.set(1,2.2,1); flash.add(q); }
	const front = new Mesh(new PlaneGeometry(.11,.11), flashMat); flash.add(front);
	const cache = {};
	let cur = null, curKey = '';
	const s = { rx: 0, ry: 0, bob: 0, kick: 0, kickV: 0, flashT: 0, rl0: 0, draw: 0, ads: 0, sun: 1, roof: 0, prevYaw: 0, prevPitch: 0, shots: 0, lit: 0 };
	function setWeapon(id, team) {
		const k = `${id}:${team}`;
		if (curKey === k) return;
		if (cur) gun.remove(cur.group);
		if (!cache[k]) {
			const w = buildWeapon(id), arms = buildArms(team, w, id === 'cutlass');
			for (const m of [arms.right, arms.left]) if (m) w.group.add(m);
			w.leftArm = arms.left; w.mag0 = w.mag ? w.mag.position.y : 0;
			cache[k] = w;
		}
		s.draw = curKey ? 1 : 0; cur = cache[k]; curKey = k; gun.add(cur.group); cur.muzzle.add(flash);
	}
	let HIP = HOLD.rifle;
	return {
		group: root,
		muzzleObj: () => (cur ? cur.muzzle : null),
		flash() { s.flashT = .035; flashMat.uniforms.uSeed.value = Math.random(); flash.rotation.z = Math.random() * 3; },
		update(state, cam, dt) {
			const p = state.player, id = p.weapons[p.active];
			setWeapon(id, p.team); HIP = HOLD[WEAPONS[id].cls] || HOLD.rifle;
			root.visible = !(p.scoped && id === 'longbow');
			if (p.shotsFired !== s.shots) { if (p.shotsFired > s.shots) s.kickV += id === 'longbow' || id === 'breaker' ? 2.2 : 1; s.shots = p.shotsFired; }
			const rel = Math.max(p.reloadT, p.reloadShell);
			if (rel > 0 && s.rl0 === 0) s.rl0 = rel; else if (rel === 0) s.rl0 = 0;
			s.rx = damp(s.rx, (p.pitch - s.prevPitch) * 1.4,12, dt); s.ry = damp(s.ry, (p.yaw - s.prevYaw) * 1.4,12, dt);
			s.prevPitch = p.pitch; s.prevYaw = p.yaw;
			const speed = Math.hypot(p.vel.x, p.vel.z), bobA = Math.min(1, speed / 5) * (p.onGround ? 1 : .2);
			s.bob += dt * (1.2 + speed * 1.55);
			s.kickV += (-s.kick * 140 - s.kickV * 16) * dt; s.kick += s.kickV * dt;
			s.draw = Math.max(0, s.draw - dt * 2.8); s.ads = damp(s.ads, p.scoped ? 1 : 0,14, dt);
			const t = s.rl0 > 0 ? 1 - rel / s.rl0 : 0, dip = Math.sin(Math.min(1, t * 1.15) * Math.PI), d = s.draw * s.draw;
			const breathe = Math.sin(state.time * 1.6) * .0015;
			root.position.set(
				HIP[0] + (ADS[0] - HIP[0]) * s.ads + Math.cos(s.bob) * .006 * bobA - s.ry * .05,
				HIP[1] + (ADS[1] - HIP[1]) * s.ads + Math.abs(Math.sin(s.bob)) * .007 * bobA + breathe - d * .2 - dip * .035 - p.crouch * .012 + s.rx * .04,
				HIP[2] + (ADS[2] - HIP[2]) * s.ads + s.kick * .045);
			root.rotation.set(s.kick * .13 + dip * .35 - d * .6 + s.rx * .5,.045 * (1 - s.ads) + s.ry * .6, dip * .45 + Math.cos(s.bob) * .012 * bobA + s.ry * .3);
			if (cur.slide) cur.slide.position.z = Math.min(.03, Math.max(0, s.kick * .05));
			if (cur.mag) cur.mag.position.y = cur.mag0 - Math.max(0, Math.sin(Math.min(1, t * 1.6) * Math.PI)) * .22;
			if (cur.leftArm) cur.leftArm.position.set(0, -dip * .09, dip * .06);
			s.flashT -= dt; flashMat.uniforms.uT.value = Math.max(0, s.flashT / .035); flash.visible = s.flashT > 0;
			if ((s.lit = (s.lit + 1) % 6) === 0) {
				const e = cam.position;
				s.sunT = losBlocked(state.boxes, e.x, e.y, e.z, e.x + sunDir.x * 60, e.y + sunDir.y * 60, e.z + sunDir.z * 60) ? 0 : 1;
				s.roofT = losBlocked(state.boxes, e.x, e.y, e.z, e.x, e.y + 12, e.z) ? 1 : 0;
			}
			s.sun = damp(s.sun, s.sunT ?? 1,4, dt); s.roof = damp(s.roof, s.roofT ?? 0,4, dt);
			key.intensity = .2 + 1.5 * s.sun; fill.intensity = 1.2 - .6 * s.roof;
			key.position.copy(sunDir).applyQuaternion(_q.copy(cam.quaternion).invert());
		},
	};
}
