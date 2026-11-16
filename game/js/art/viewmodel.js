// SALTLINE art/viewmodel.js — first-person weapon, gloved hands and sleeves (ART.md §9). Springs drive sway, bob,
// kick, slide cycling, reload and draw; a key light follows the real sun and dims when the eye is in shade.
import { Group, Mesh, ShaderMaterial, PlaneGeometry, AdditiveBlending, DoubleSide, DirectionalLight, HemisphereLight, Vector3, CapsuleGeometry,
	CylinderGeometry, Matrix4, Quaternion, Color } from 'three';
import { buildWeapon, weaponMaterial } from './weapons-art.js';
import { Bld } from './mesh.js';
import { damp, losBlocked } from '../math.js';
import { TEAM_LOOK, WEAPONS } from '../config.js';

const HOLD = { pistol: [0.075, -0.105, -0.43], knife: [0.12, -0.13, -0.3], rifle: [0.11, -0.128, -0.37] }, ADS = [0, -0.074, -0.22];
const lin = (h) => { const c = new Color(h); return [c.r, c.g, c.b]; };
const _m = new Matrix4(), _q = new Quaternion(), _v = new Vector3(), _c = new Vector3(), _a = new Vector3(), _b = new Vector3(), _s = new Vector3(1, 1, 1), _up = new Vector3(0, 1, 0);
function limb(B, a, b, r0, r1, col, e) {
	_v.subVectors(b, a); const len = _v.length();
	_q.setFromUnitVectors(_up, _v.normalize());
	B.add(new CylinderGeometry(r1, r0, len, 14, 3), _m.compose(_c.addVectors(a, b).multiplyScalar(0.5), _q, _s.set(1, 1, 1)), e, col);
}
// Capsule bone between two points; a finger is three of them following an elliptical arc around the part it grips.
function seg(B, a, b, r, col) {
	_v.subVectors(b, a); const len = _v.length(); _q.setFromUnitVectors(_up, _v.normalize());
	B.add(new CapsuleGeometry(r, len, 2, 8), _m.compose(_c.addVectors(a, b).multiplyScalar(0.5), _q, _s.set(1, 1, 1)), 0, col);
}
const P = (x, y, z) => new Vector3(x, y, z);
function finger(B, pts, r, col, tip) { for (let k = 0; k < 3; k++) seg(B, pts[k], pts[k + 1], r * (1 - k * 0.08), k === 2 ? tip : col); }
// C-shaped fingers: around the pistol grip in the horizontal plane (x/z), around the handguard in the cross-section (x/y).
const gripArc = (y, deg) => { const t = (-0.02 - y) / 0.1, zc = 0.0175 + 0.0235 * t; return deg.map((d) => P(0.024 * Math.cos(d / 57.3), y, zc + 0.028 * Math.sin(d / 57.3))); };
const hgArc = (z, [cy, rx, ry], deg) => deg.map((d) => P((rx + 0.009) * Math.cos(d / 57.3), cy + (ry + 0.009) * Math.sin(d / 57.3), z));
// Right hand: palm behind the grip, three fingers wrapped round it, index finger on the trigger, thumb over the left side.
// Left hand: palm under the handguard, four fingers up its right side, thumb along the left (long guns), or cupping
// the right hand (pistols). Gloves are light coyote against the dark gun; sleeves are muted team cloth.
function buildArms(team, w, knife) {
	const R = new Bld(), L = new Bld(), glove = lin(0xa48a62), tip = lin(0x7c6646), sleeve = lin(new Color(TEAM_LOOK[team].cloth).lerp(new Color(0x3c3d3e), 0.5).getHex()), cuff = lin(TEAM_LOOK[team].gear), strap = lin(0x2c2b27);
	seg(R, P(0.012, -0.036, 0.034), P(0.014, -0.094, 0.05), 0.02, glove);
	for (const y of [-0.052, -0.072, -0.092]) finger(R, gripArc(y, [25, -40, -105, -165]), 0.0092, glove, tip);
	finger(R, [P(0.024, -0.03, 0.012), P(0.019, -0.033, -0.006), P(0.009, -0.036, -0.016), P(0.002, -0.04, -0.017)], 0.0088, glove, tip);
	finger(R, [P(0.004, -0.026, 0.05), P(-0.014, -0.026, 0.032), P(-0.022, -0.026, 0.012), P(-0.022, -0.028, -0.004)], 0.0098, glove, tip);
	seg(R, P(0.016, -0.05, 0.05), P(0.026, -0.072, 0.095), 0.025, cuff);
	limb(R, _a.set(0.026, -0.07, 0.085), _b.set(0.1, -0.2, 0.42), 0.034, 0.04, sleeve, 0);
	if (!knife && w.left) {
		const z = w.left[2], hg = w.hg, [cy, rx, ry] = hg;
		seg(L, P(-rx * 0.75 - 0.01, cy - ry * 0.75 - 0.01, z + 0.045), P(-rx * 0.5 - 0.004, cy - ry - 0.006, z - 0.035), 0.02, glove);
		for (let k = 0; k < 4; k++) finger(L, hgArc(z - 0.036 + k * 0.021, hg, [-125, -60, 0, 55]), 0.0092, glove, tip);
		finger(L, [P(-rx - 0.016, cy - ry * 0.5, z + 0.03), P(-rx - 0.012, cy, z + 0.005), P(-rx - 0.008, cy + ry * 0.45, z - 0.02), P(-rx - 0.004, cy + ry * 0.7, z - 0.04)], 0.0098, glove, tip);
		const wx = -rx - 0.012, wy = cy - ry - 0.004, wz = z + 0.055;
		seg(L, P(wx + 0.004, wy + 0.004, wz - 0.01), P(wx - 0.018, wy - 0.026, wz + 0.03), 0.026, cuff);
		limb(L, _a.set(wx - 0.012, wy - 0.018, wz + 0.02), _b.set(wx - 0.09, wy - 0.25, wz + 0.2), 0.035, 0.043, sleeve, 0);
		seg(L, P(-0.026, cy - 0.01, z + 0.09), P(-0.05, -0.06, z + 0.26), 0.005, strap); seg(L, P(-0.05, -0.06, z + 0.26), P(-0.13, -0.2, z + 0.5), 0.005, strap);
	} else if (!knife) {
		const [x, y, z] = [-0.03, -0.075, 0.015];
		seg(L, P(x - 0.03, y - 0.02, z + 0.01), P(x - 0.026, y - 0.06, z + 0.02), 0.02, glove);
		for (let k = 0; k < 4; k++) finger(L, [P(x - 0.034, y - 0.008 - k * 0.019, z + 0.03), P(x - 0.02, y - 0.01 - k * 0.019, z - 0.005), P(x + 0.012, y - 0.012 - k * 0.019, z - 0.012), P(x + 0.04, y - 0.014 - k * 0.019, z - 0.002)], 0.0092, glove, tip);
		limb(L, _a.set(x - 0.035, y - 0.03, z + 0.03), _b.set(x - 0.2, y - 0.24, z + 0.36), 0.034, 0.044, sleeve, 0);
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
	gl_FragColor=vec4(vec3(1.,.66,.32)*i*5.,1.);}`,
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
		flash() { s.flashT = 0.05; flashMat.uniforms.uSeed.value = Math.random(); flash.rotation.z = Math.random() * 3; },
		update(state, cam, dt) {
			const p = state.player, id = p.weapons[p.active];
			setWeapon(id, p.team); HIP = HOLD[WEAPONS[id].cls] || HOLD.rifle;
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
