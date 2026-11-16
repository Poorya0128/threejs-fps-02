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
const _m = new Matrix4(), _n = new Matrix4(), _q = new Quaternion(), _s = new Vector3(), P = (x, y, z) => new Vector3(x, y, z);
const seg = (B, a, b, r, col) => B.add(new CapsuleGeometry(r, a.distanceTo(b), 3, 10), along(a, b), 1, col);
const se = (d, a, b, p) => { const c = Math.cos(d / 57.3), s = Math.sin(d / 57.3); return [a * Math.sign(c) * Math.abs(c) ** p, b * Math.sign(s) * Math.abs(s) ** p]; };
const at = (L, y) => L[0] + (L[2] - L[0]) * (y - L[1]) / (L[3] - L[1]);
// The four fingers as one block: a flattened tube h tall round a grip section (superellipse a, b, power p) from d0° to d1°,
// with rounded ends; m places it, local y along the grip.
function fingers(B, a, b, p, d0, d1, h, m, col) {
	const pts = Array.from({ length: 9 }, (_, k) => { const [x, z] = se(d0 + (d1 - d0) * k / 8, a + .005, b + .005, p); return new Vector3(x, 0, z); });
	m.scale(_s.set(1, h / .034, 1)); // the inner half of the 17 mm tube sits inside the grip
	B.add(new TubeGeometry(new CatmullRomCurve3(pts), 24, .017, 12), m, 1, col);
	for (const q of [pts[0], pts[8]]) B.add(new SphereGeometry(.017, 12, 8), _n.makeTranslation(q).premultiply(m), 1, col);
}

// Hands from the weapon's grip data: right palm behind the grip, fingers round its front below the guard, thumb along the
// frame; left hand round the handguard or over the right fingers on a pistol. Returns builders and wrist points.
export function buildHands(w, glove) {
	const R = new Bld(), L = new Bld(), G = w.grip, zf = (y) => at(G.f, y), zb = (y) => at(G.b, y), zc = (y) => (zf(y) + zb(y)) / 2;
	const hw = G.hw, ym = G.fy - .02, y0 = G.fy + .006, h = .074, dz = (zb(ym) - zf(ym)) / 2, xT = -G.side - .011, yT = G.top + .01;
	const rake = -Math.atan2(zc(y0 - .1) - zc(y0), .1), grip = () => _m.makeRotationX(rake).setPosition(0, y0 - h / 2, zc(y0 - h / 2));
	seg(R, P(.002, G.top - .012, zb(G.top - .012) + .012), P(.003, G.fy - .05, zb(G.fy - .05) + .012), .016, glove);
	fingers(R, hw, dz, .6, 42, -168, h, grip(), glove);
	seg(R, P(xT + .002, yT, zb(G.top) - .002), P(xT + .001, yT + .003, zf(G.top) - .03), .0095, glove);
	const rw = [hw * .4, ym - .01, zb(ym) + .036];
	seg(R, P(.004, ym, zb(ym) + .014), P(...rw), .021, glove);
	let lw;
	if (w.left) {
		const z = w.left[2], [cy, rx, ry, p] = w.hg, [px, py] = se(-135, rx + .013, ry + .013, p);
		seg(L, P(px, cy + py, z + .042), P(px + .006, cy + py, z - .03), .017, glove);
		fingers(L, rx, ry, p, -150, 45, h, _m.makeRotationX(-Math.PI / 2).setPosition(0, cy, z), glove);
		seg(L, P(-rx - .012, cy - ry * .45, z + .045), P(-rx - .008, cy + ry * .12, z - .036), .0095, glove);
		lw = [-rx - .008, cy - ry - .004, z + .062]; seg(L, P(px, cy + py, z + .04), P(...lw), .021, glove);
	} else {
		fingers(L, hw + .02, dz + .02, .6, 165, 284, h, grip(), glove);
		seg(L, P(-hw - .02, G.top - .02, zb(G.top) + .004), P(xT - .002, G.top - .018, zf(G.top) - .028), .0095, glove);
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
