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
// Capsule bone between two points; a finger is three of them following an elliptical arc around the part it grips.
function seg(B, a, b, r, col) {
	_v.subVectors(b, a); const len = _v.length(); _q.setFromUnitVectors(_up, _v.normalize());
	B.add(new CapsuleGeometry(r, len, 2,8), _m.compose(_c.addVectors(a, b).multiplyScalar(.5), _q, _s.set(1,1,1)), 0, col);
}
const P = (x, y, z) => new Vector3(x, y, z);
// Ellipsoid pad (back of the hand, heel of the palm), tilted by rx about x.
const pad = (B, x, y, z, sx, sy, sz, rx, col) => B.add(new SphereGeometry(1,14,10), _m.compose(_v.set(x, y, z), _q.setFromAxisAngle(_ax, rx), _s.set(sx, sy, sz)), 0, col);
function finger(B, pts, r, col, tip) { for (let k = 0; k < 3; k++) seg(B, pts[k], pts[k + 1], r * (1 - k * .08), k === 2 ? tip : col); }
// C-shaped fingers: around the pistol grip in the horizontal plane (x/z), around the handguard in the cross-section (x/y).
const gripArc = (y, deg) => { const t = (-.02 - y) / .1, zc = .0175 + .0235 * t; return deg.map((d) => P(.024 * Math.cos(d / 57.3), y, zc + .028 * Math.sin(d / 57.3))); };
const hgArc = (z, [cy, rx, ry], deg) => deg.map((d) => P((rx + .009) * Math.cos(d / 57.3), cy + (ry + .009) * Math.sin(d / 57.3), z));
// Right hand: palm behind the grip, three fingers wrapped round it, index finger on the trigger, thumb over the left side.
// Left hand: palm under the handguard, four fingers up its right side, thumb along the left (long guns), or cupping
// the right hand (pistols). Gloves are light coyote against the dark gun; sleeves are muted team cloth.
function buildArms(team, w, knife) {
	const R = new Bld(), L = new Bld(), glove = lin(0xa48a62), tip = lin(0x7c6646), sleeve = lin(new Color(TEAM_LOOK[team].cloth).lerp(new Color(0x3c3d3e), .5).getHex()), strap = lin(0x2c2b27);
	seg(R, P(.006,-.04,.05), P(.008,-.094,.064), .017, glove);
	pad(R, .02,-.064,.036,.013,.036,.03,-.23, glove);
	for (const y of [-.052,-.072,-.092]) finger(R, gripArc(y, [25,-40,-105,-165]), .0092, glove, tip);
	finger(R, [P(.024,-.03,.012), P(.019,-.033,-.006), P(.009,-.036,-.016), P(.002,-.04,-.017)], .0088, glove, tip);
	finger(R, [P(.004,-.026,.05), P(-.014,-.026,.032), P(-.022,-.026,.012), P(-.022,-.028,-.004)], .0098, glove, tip);
	seg(R, P(.016,-.05,.05), P(.026,-.072,.095), .025, glove);
	limb(R, _a.set(.026,-.07,.085), _b.set(.1,-.2,.42), .034,.04, sleeve, 0);
	if (!knife && w.left) {
		const z = w.left[2], hg = w.hg, [cy, rx, ry] = hg;
		seg(L, P(-rx * .75 - .01, cy - ry * .75 - .01, z + .045), P(-rx * .5 - .004, cy - ry - .006, z - .035), .02, glove);
		for (let k = 0; k < 4; k++) finger(L, hgArc(z - .036 + k * .021, hg, [-125,-60,0,55]), .0092, glove, tip);
		finger(L, [P(-rx - .016, cy - ry * .5, z + .03), P(-rx - .012, cy, z + .005), P(-rx - .008, cy + ry * .45, z - .02), P(-rx - .004, cy + ry * .7, z - .04)], .0098, glove, tip);
		const wx = -rx - .012, wy = cy - ry - .004, wz = z + .055;
		seg(L, P(wx + .004, wy + .004, wz - .01), P(wx - .018, wy - .026, wz + .03), .026, glove);
		limb(L, _a.set(wx - .012, wy - .018, wz + .02), _b.set(wx - .17, wy - .22, wz + .18), .034,.046, sleeve, 0);
		seg(L, P(-.026, cy - .01, z + .09), P(-.05,-.06, z + .26), .005, strap); seg(L, P(-.05,-.06, z + .26), P(-.13,-.2, z + .5), .005, strap);
	} else if (!knife) {
		const [x, y, z] = [-.03,-.075,.015];
		seg(L, P(x - .03, y - .02, z + .01), P(x - .026, y - .06, z + .02), .02, glove);
		for (let k = 0; k < 4; k++) finger(L, [P(x - .034, y - .008 - k * .019, z + .03), P(x - .02, y - .01 - k * .019, z - .005), P(x + .012, y - .012 - k * .019, z - .012), P(x + .04, y - .014 - k * .019, z - .002)], .0092, glove, tip);
		limb(L, _a.set(x - .035, y - .03, z + .03), _b.set(x - .2, y - .24, z + .36), .034,.044, sleeve, 0);
	}
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
