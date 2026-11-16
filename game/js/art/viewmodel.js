// SALTLINE art/viewmodel.js — first-person weapon, gloved hands and sleeves (ART.md §9). Springs drive sway, bob,
// kick, slide cycling, reload and draw; a key light follows the real sun and dims when the eye is in shade.
import { Group, Mesh, ShaderMaterial, PlaneGeometry, AdditiveBlending, DoubleSide, DirectionalLight, HemisphereLight, Vector3, CapsuleGeometry,
	CylinderGeometry, Matrix4, Quaternion, Color, Euler } from 'three';
import { buildWeapon, weaponMaterial } from './weapons-art.js';
import { Bld, boxInto } from './geo.js';
import { damp, losBlocked } from '../math.js';
import { TEAM_LOOK } from '../config.js';

const HIP = [0.11, -0.125, -0.33], ADS = [0, -0.074, -0.22];
const lin = (h) => { const c = new Color(h); return [c.r, c.g, c.b]; };
const _m = new Matrix4(), _q = new Quaternion(), _e = new Euler(), _v = new Vector3(), _c = new Vector3(), _a = new Vector3(), _b = new Vector3(), _s = new Vector3(1, 1, 1), _up = new Vector3(0, 1, 0);
function limb(B, a, b, r0, r1, col, e) {
	_v.subVectors(b, a); const len = _v.length();
	_q.setFromUnitVectors(_up, _v.normalize());
	B.add(new CylinderGeometry(r1, r0, len, 14, 3), _m.compose(_c.addVectors(a, b).multiplyScalar(0.5), _q, _s.set(1, 1, 1)), e, col);
}
const capsule = (B, x, y, z, rx, ry, rz, r, l, col) => B.add(new CapsuleGeometry(r, l, 3, 10), _m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(1, 1, 1)), 1, col);
// Right hand wraps the grip; the left hand cups the handguard (long guns) or the right hand (pistols).
function buildArms(team, left, pistol) {
	const R = new Bld(), L = new Bld(), glove = lin(0x3b3428), knuckle = lin(0x2a251e), sleeve = lin(TEAM_LOOK[team].cloth), cuff = lin(TEAM_LOOK[team].gear);
	boxInto(R, [0.012, -0.1, -0.005], [0.04, -0.03, 0.06], 0.012, glove, 0.05, 1, 1);
	for (let k = 0; k < 4; k++) capsule(R, -0.004, -0.04 - k * 0.019, -0.012, 0, 0, Math.PI / 2, 0.0095, 0.03, k ? glove : knuckle);
	capsule(R, -0.016, -0.032, 0.012, 0.6, 0, 0.3, 0.01, 0.035, glove);
	limb(R, _a.set(0.03, -0.075, 0.07), _b.set(0.1, -0.2, 0.42), 0.034, 0.04, sleeve, 0);
	limb(R, _a.set(0.028, -0.072, 0.055), _b.set(0.034, -0.08, 0.1), 0.036, 0.037, cuff, 0);
	if (left) {
		const [x, y, z] = pistol ? [-0.03, -0.075, 0.015] : left;
		boxInto(L, [x - 0.048, y - 0.055, z - 0.035], [x - 0.012, y + 0.01, z + 0.035], 0.012, glove, 0.05, 1, 1);
		for (let k = 0; k < 4; k++) capsule(L, x + 0.012, y - 0.03, z - 0.028 + k * 0.019, Math.PI / 2, 0, 0.9, 0.0095, 0.028, glove);
		limb(L, _a.set(x - 0.035, y - 0.03, z + 0.03), _b.set(x - 0.26, y - 0.24, z + 0.36), 0.034, 0.044, sleeve, 0);
	}
	const mk = (B) => { if (!B.p.length) return null; const m = new Mesh(B.geo(), weaponMaterial); m.renderOrder = 1; return m; };
	return { right: mk(R), left: mk(L) };
}

const flashMat = new ShaderMaterial({
	uniforms: { uT: { value: 0 }, uSeed: { value: 0 } }, transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide,
	vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
	fragmentShader: `varying vec2 vUv; uniform float uT, uSeed;
		void main(){ vec2 p = vUv * 2. - 1.; float r = length(p), a = atan(p.y, p.x);
			float rays = pow(abs(sin(a * 3. + uSeed * 6.)), 10.) * .7 + pow(abs(sin(a * 5. + uSeed * 2.)), 16.) * .5;
			float i = (exp(-r * r * 18.) * 3. + rays * smoothstep(1., .0, r) * 1.6) * uT;
			gl_FragColor = vec4(vec3(1., .66, .32) * i * 5., 1.); }`,
});

export function createViewmodel(vmScene, sunDir) {
	const root = new Group(), gun = new Group();
	vmScene.add(root); root.add(gun);
	const key = new DirectionalLight(0xffd2a1, 2.2), fill = new HemisphereLight(0x9ab0d0, 0x6a5040, 1.2);
	const rim = new DirectionalLight(0xdfe8ff, 1.1); rim.position.set(-0.6, 0.9, -0.5);
	vmScene.add(key, key.target, fill, rim);
	const flash = new Group();
	for (let k = 0; k < 3; k++) { const q = new Mesh(new PlaneGeometry(0.09, 0.09), flashMat); q.rotation.y = k * Math.PI / 3; q.rotation.x = Math.PI / 2; q.scale.set(1, 2.2, 1); flash.add(q); }
	const front = new Mesh(new PlaneGeometry(0.11, 0.11), flashMat); flash.add(front);
	const cache = {};
	let cur = null, curKey = '';
	const s = { rx: 0, ry: 0, bob: 0, kick: 0, kickV: 0, flashT: 0, rl0: 0, draw: 0, ads: 0, sun: 1, roof: 0, prevYaw: 0, prevPitch: 0, shots: 0, lit: 0 };
	function setWeapon(id, team) {
		const k = `${id}:${team}`;
		if (curKey === k) return;
		if (cur) gun.remove(cur.group);
		if (!cache[k]) {
			const w = buildWeapon(id), arms = buildArms(team, id === 'cutlass' ? null : w.left || [0, 0, 0], !w.left);
			for (const m of [arms.right, arms.left]) if (m) w.group.add(m);
			w.leftArm = arms.left; w.mag0 = w.mag ? w.mag.position.y : 0;
			cache[k] = w;
		}
		s.draw = curKey ? 1 : 0; cur = cache[k]; curKey = k; gun.add(cur.group); cur.muzzle.add(flash);
	}
	return {
		group: root,
		muzzleObj: () => (cur ? cur.muzzle : null),
		flash() { s.flashT = 0.05; flashMat.uniforms.uSeed.value = Math.random(); flash.rotation.z = Math.random() * 3; },
		update(state, cam, dt) {
			const p = state.player, id = p.weapons[p.active];
			setWeapon(id, p.team);
			root.visible = !(p.scoped && id === 'longbow');
			if (p.shotsFired !== s.shots) { if (p.shotsFired > s.shots) s.kickV += id === 'longbow' || id === 'breaker' ? 2.2 : 1; s.shots = p.shotsFired; }
			const rel = Math.max(p.reloadT, p.reloadShell);
			if (rel > 0 && s.rl0 === 0) s.rl0 = rel; else if (rel === 0) s.rl0 = 0;
			s.rx = damp(s.rx, (p.pitch - s.prevPitch) * 1.4, 12, dt); s.ry = damp(s.ry, (p.yaw - s.prevYaw) * 1.4, 12, dt);
			s.prevPitch = p.pitch; s.prevYaw = p.yaw;
			const speed = Math.hypot(p.vel.x, p.vel.z), bobA = Math.min(1, speed / 5) * (p.onGround ? 1 : 0.2);
			s.bob += dt * (1.2 + speed * 1.55);
			s.kickV += (-s.kick * 140 - s.kickV * 16) * dt; s.kick += s.kickV * dt;
			s.draw = Math.max(0, s.draw - dt * 2.8); s.ads = damp(s.ads, p.scoped ? 1 : 0, 14, dt);
			const t = s.rl0 > 0 ? 1 - rel / s.rl0 : 0, dip = Math.sin(Math.min(1, t * 1.15) * Math.PI), d = s.draw * s.draw;
			const breathe = Math.sin(state.time * 1.6) * 0.0015;
			root.position.set(
				HIP[0] + (ADS[0] - HIP[0]) * s.ads + Math.cos(s.bob) * 0.006 * bobA - s.ry * 0.05,
				HIP[1] + (ADS[1] - HIP[1]) * s.ads + Math.abs(Math.sin(s.bob)) * 0.007 * bobA + breathe - d * 0.2 - dip * 0.035 - p.crouch * 0.012 + s.rx * 0.04,
				HIP[2] + (ADS[2] - HIP[2]) * s.ads + s.kick * 0.045);
			root.rotation.set(s.kick * 0.13 + dip * 0.35 - d * 0.6 + s.rx * 0.5, 0.045 * (1 - s.ads) + s.ry * 0.6, dip * 0.45 + Math.cos(s.bob) * 0.012 * bobA + s.ry * 0.3);
			if (cur.slide) cur.slide.position.z = Math.min(0.03, Math.max(0, s.kick * 0.05));
			if (cur.mag) cur.mag.position.y = cur.mag0 - Math.max(0, Math.sin(Math.min(1, t * 1.6) * Math.PI)) * 0.22;
			if (cur.leftArm) cur.leftArm.position.set(0, -dip * 0.09, dip * 0.06);
			s.flashT -= dt; flashMat.uniforms.uT.value = Math.max(0, s.flashT / 0.05); flash.visible = s.flashT > 0;
			if ((s.lit = (s.lit + 1) % 6) === 0) {
				const e = cam.position;
				s.sunT = losBlocked(state.boxes, e.x, e.y, e.z, e.x + sunDir.x * 60, e.y + sunDir.y * 60, e.z + sunDir.z * 60) ? 0 : 1;
				s.roofT = losBlocked(state.boxes, e.x, e.y, e.z, e.x, e.y + 12, e.z) ? 1 : 0;
			}
			s.sun = damp(s.sun, s.sunT ?? 1, 4, dt); s.roof = damp(s.roof, s.roofT ?? 0, 4, dt);
			key.intensity = 0.2 + 1.5 * s.sun; fill.intensity = 1.2 - 0.6 * s.roof;
			key.position.copy(sunDir).applyQuaternion(_q.copy(cam.quaternion).invert());
		},
	};
}
