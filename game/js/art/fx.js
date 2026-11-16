// Pooled effects (ART.md §10) from state.fxEvents, plus grenades, Veil clouds and the Fuse.
import { Mesh, Sprite, SpriteMaterial, MeshBasicMaterial, MeshStandardMaterial, BoxGeometry, PlaneGeometry, CylinderGeometry, AdditiveBlending,
	Points, PointsMaterial, BufferGeometry, BufferAttribute, PointLight, Vector3, Color } from 'three';
import { mulberry32 } from '../math.js';
import { canvasTex } from './mesh.js';
import { ROUND } from '../config.js';

const _a = new Vector3(), METAL = new Set([2, 3, 4, 9, 10, 11]), hot = (r, g, b) => new Color(r, g, b), glow = { transparent: true, blending: AdditiveBlending, depthWrite: false };
const disc = (x, cx, cy, r, fill) => { x.fillStyle = fill; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); };
const puff = canvasTex(128, (x, s, r) => { for (let k = 0; k < 28; k++) {
	const px = s / 2 + (r() - .5) * s * .45, py = s / 2 + (r() - .5) * s * .45, g = x.createRadialGradient(px, py, 0, px, py, s * (.12 + r() * .22));
	g.addColorStop(0, `rgba(255,255,255,${.22 + r() * .2})`); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, s, s);
} });
const hole = canvasTex(64, (x, s, r) => { // dark core in chipped rim
	const g = x.createRadialGradient(32, 32, 0, 32, 32, 10);
	for (let k = 0; k < 14; k++) { const a = r() * 7, d = s * (.1 + r() * .16); disc(x, 32 + Math.cos(a) * d, 32 + Math.sin(a) * d, s * (.04 + r() * .07), `rgba(150,140,125,${.5 + r() * .4})`); }
	g.addColorStop(0, '#080706'); g.addColorStop(.7, 'rgba(25,22,20,.95)'); g.addColorStop(1, 'rgba(40,35,30,0)'); disc(x, 32, 32, 10, g);
});

export function createFx(scene) {
	const rng = mulberry32(99), add = (o) => { o.visible = false; scene.add(o); return o; }, pool = (n, f) => Array.from({ length: n }, f);
	const tracers = pool(16, () => ({ m: add(new Mesh(new BoxGeometry(.005, .005, 1.8), new MeshBasicMaterial({ color: hot(4, 2.6, 1.2), ...glow }))), a: new Vector3(), b: new Vector3(), t: 0, len: 0 }));
	const holeMat = new MeshStandardMaterial({ map: hole, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, roughness: .9 });
	const decals = pool(64, () => add(new Mesh(new PlaneGeometry(.14, .14), holeMat)));
	const SN = 160, sp = new Float32Array(SN * 3), sv = new Float32Array(SN * 3), sl = new Float32Array(SN), sGeo = new BufferGeometry();
	sGeo.setAttribute('position', new BufferAttribute(sp, 3));
	const sparks = new Points(sGeo, new PointsMaterial({ color: hot(8, 5, 2), size: .035, ...glow }));
	sparks.frustumCulled = false; scene.add(sparks);
	const sprites = (n, color, o) => pool(n, () => ({ s: add(new Sprite(new SpriteMaterial({ map: puff, color, transparent: true, depthWrite: false, opacity: 0, ...o }))), t: 0, life: 1, v: new Vector3(), grow: 1, a: .5 }));
	const dust = sprites(36, 0xcdc4b4), fire = sprites(6, hot(6, 3, 1.2), glow), clouds = sprites(64, 0xbdb8b0);
	const shellGeo = new CylinderGeometry(.0065, .0065, .028, 8), shellMat = new MeshStandardMaterial({ color: 0xd8ac4c, metalness: .8, roughness: .25, emissive: 0x3a2808 });
	const shells = pool(32, () => ({ m: add(new Mesh(shellGeo, shellMat)), v: new Vector3(), t: 0 }));
	const nadeGeo = new CylinderGeometry(.035, .035, .11, 10), nadeMat = new MeshStandardMaterial({ color: 0x3a4030, roughness: .6, metalness: .3 }), nades = pool(8, () => add(new Mesh(nadeGeo, nadeMat)));
	const light = new PointLight(0xffb060, 0, 14, 1.8), fuseLight = new PointLight(0xff9a30, 0, 7, 2);
	const fuse = add(new Mesh(new BoxGeometry(.34, .13, .24), new MeshStandardMaterial({ color: 0x2a2d30, roughness: .5, metalness: .6 })));
	const led = new Mesh(new BoxGeometry(.2, .02, .05), new MeshStandardMaterial({ color: 0, emissive: 0xffa040, emissiveIntensity: 8 }));
	led.position.set(0, .075, -.06); fuseLight.position.y = .4; fuse.add(led, fuseLight); scene.add(light);
	let lightT = 0, lightDur = 1, lightMax = 0, ti = 0, di = 0, si = 0, ui = 0, hi = 0, fi = 0;
	const emit = (P, i, x, y, z, life, grow, a, vx, vy, vz) => {
		const p = P[i % P.length]; p.s.position.set(x, y, z); p.v.set(vx, vy, vz); p.t = 0; p.life = life; p.grow = grow; p.a = a; p.s.visible = true; p.s.material.rotation = rng() * 6.3;
		return i + 1;
	};
	const spark = (x, y, z, n, v, up, life) => { for (let k = 0; k < n; k++) { const j = si++ % SN * 3; sp[j] = x; sp[j + 1] = y; sp[j + 2] = z; sv[j] = (rng() - .5) * v; sv[j + 1] = rng() * up; sv[j + 2] = (rng() - .5) * v; sl[j / 3] = life * (.5 + rng()); } };
	const flash = (x, y, z, peak, dur) => { light.position.set(x, y, z); lightMax = peak; lightDur = lightT = dur; };
	function event(e, vm, chars, eye) {
		const near = _a.set(e.x, e.y, e.z).distanceTo(eye) < 1.2, metal = METAL.has(e.mat);
		if (e.kind === 0) { const tr = tracers[ti++ % 16]; tr.a.set(e.x, e.y, e.z); tr.b.set(e.dx, e.dy, e.dz); tr.len = tr.a.distanceTo(tr.b); tr.t = near ? 4 / 520 : 0; tr.m.visible = tr.len > 5; }
		else if (e.kind === 1) { if (near) vm.flash(); else fi = emit(fire, fi, e.x, e.y, e.z, .035, .3, 1, 0, 0, 0); flash(e.x, e.y, e.z, 26, .035); }
		else if (e.kind === 2) {
			const m = decals[di++ % 64];
			m.position.set(e.x + e.dx * .005, e.y + e.dy * .005, e.z + e.dz * .005); m.lookAt(e.x + e.dx, e.y + e.dy, e.z + e.dz); m.rotateZ(rng() * 6.3); m.scale.setScalar(.7 + rng() * .6); m.visible = true;
		} else if (e.kind === 3) {
			const wood = e.mat === 6;
			if (metal) spark(e.x, e.y, e.z, 14, 5, 3.5, .3);
			for (let k = 0; k < (metal ? 1 : 3); k++) { ui = emit(dust, ui, e.x, e.y, e.z, .6 + rng() * .6, metal ? .4 : wood ? .5 : 1, .6, (rng() - .5) * .8 + e.dx * .6, .35, (rng() - .5) * .8 + e.dz * .6); dust[(ui - 1) % 36].s.material.color.setHex(wood ? 0x8a6a48 : 0xcdc4b4); }
		} else if (e.kind === 4) { const s = shells[hi++ % 32]; s.m.position.set(e.x, e.y - .04, e.z); s.v.set(e.dx * 2 + rng() - .5, 1.6 + rng(), e.dz * 2 + rng() - .5); s.t = 3; s.m.visible = true; }
		else if (e.kind === 6) chars.flash(e.mat);
		else if (e.kind === 7) {
			flash(e.x, e.y + 1, e.z, 120, .35);
			for (let k = 0; k < 5; k++) fi = emit(fire, fi, e.x + (rng() - .5) * .6, e.y + .3 + rng() * .4, e.z + (rng() - .5) * .6, .35, 4, 1, 0, 1, 0);
			for (let k = 0; k < 12; k++) ui = emit(dust, ui, e.x, e.y + .4, e.z, 3.5 + rng() * 2, 6, .65, (rng() - .5) * 4, 1 + rng() * 2, (rng() - .5) * 4);
			spark(e.x, e.y + .2, e.z, 40, 14, 9, .7);
		}
	}
	function stepSprites(P, dt) {
		for (const p of P) if (p.s.visible) {
			const k = (p.t += dt) / p.life;
			p.s.visible = k < 1;
			p.s.position.addScaledVector(p.v, dt); p.v.x *= .96; p.v.z *= .96;
			p.s.scale.setScalar(.25 + p.grow * Math.sqrt(k)); p.s.material.opacity = p.a * (1 - k) * Math.min(1, k * 12);
		}
	}
	return {
		update(state, vm, dt, chars, eye) {
			for (; state.fxHead !== state.fxTail; state.fxHead = (state.fxHead + 1) % state.fxEvents.length) event(state.fxEvents[state.fxHead], vm, chars, eye);
			lightT = Math.max(0, lightT - dt); light.intensity = lightMax * lightT / lightDur;
			for (const tr of tracers) if (tr.m.visible) {
				const d = (tr.t += dt) * 520;
				tr.m.visible = dt > 0 && d < tr.len + 1.2;
				tr.m.position.lerpVectors(tr.a, tr.b, Math.min(1, d / tr.len)); tr.m.lookAt(tr.b);
			}
			for (let j = 0; j < SN; j++) {
				sl[j] -= dt; sv[j * 3 + 1] -= 9.8 * dt;
				for (let k = 0; k < 3; k++) sp[j * 3 + k] = sl[j] > 0 ? sp[j * 3 + k] + sv[j * 3 + k] * dt : -99;
			}
			sGeo.attributes.position.needsUpdate = true;
			stepSprites(dust, dt); stepSprites(fire, dt);
			for (const s of shells) if (s.m.visible) {
				s.v.y -= 9.8 * dt; s.m.position.addScaledVector(s.v, dt); s.m.rotation.x += 14 * dt; s.m.rotation.z += 9 * dt;
				if (s.m.position.y < .006) { s.m.position.y = .006; s.v.multiplyScalar(.5); s.v.y *= -.6; }
				s.m.visible = (s.t -= dt) > 0;
			}
			// Veil: 16 puffs per cloud bloom out to the gameplay radius over 2.6 s, rise, and fade over the last 2.5 s.
			for (let i = 0; i < 64; i++) {
				const sm = state.smokes[i >> 4], j = i & 15, c = clouds[i].s, age = state.time - sm.t, k = 1 - (1 - Math.min(1, age / 2.6)) ** 2, fade = Math.min(1, (sm.dur - age) / 2.5);
				c.visible = sm.active && fade > 0;
				if (!c.visible) continue;
				const a = j * 2.399 + age * .05, rr = sm.r * (.2 + .55 * ((j * 7) % 16) / 16) * (.5 + .5 * k);
				c.position.set(sm.x + Math.cos(a) * rr, sm.y - .3 + ((j * 5) % 16) / 16 * sm.r * .9 * k + age * .04, sm.z + Math.sin(a) * rr);
				c.scale.setScalar(sm.r * (.9 + .5 * ((j * 3) % 16) / 16) * (.35 + .65 * k));
				c.material.rotation = j + age * .03 * (j % 2 ? 1 : -1); c.material.opacity = .7 * fade * Math.min(1, k * 2);
			}
			for (let i = 0; i < 8; i++) { const g = state.nades[i], m = nades[i]; m.visible = g.active; m.position.set(g.x, g.y, g.z); m.rotation.x += dt * 8; }
			const F = state.fuse;
			fuse.visible = F.planted || F.dropped;
			const blink = F.planted ? (Math.sin(state.time * (6 + 30 * (1 - state.roundT / ROUND.fuseTime))) > 0 ? 1 : .15) : .3;
			fuse.position.set(F.x, .065, F.z); led.material.emissiveIntensity = 8 * blink; fuseLight.intensity = F.planted ? 6 * blink : 0;
		},
	};
}
