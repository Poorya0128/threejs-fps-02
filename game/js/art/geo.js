// SALTLINE art/geo.js — world geometry (ART.md §4). Every map box becomes a chamfered, subdivided mesh whose bevel
// vertices carry aE = 1 (edge wear); facades get plinths, cornices, pilasters and windows; props come from level data;
// everything is merged per material and gets per-vertex ambient occlusion baked against the map boxes.
import { Mesh, MeshStandardMaterial, CylinderGeometry, LatheGeometry, SphereGeometry, PlaneGeometry,
	BoxGeometry, CanvasTexture, Vector2, Vector3, Matrix4, Quaternion, PointLight, SRGBColorSpace, DoubleSide,
	ShaderMaterial, AdditiveBlending, BufferGeometry, Float32BufferAttribute, MeshBasicMaterial } from 'three';
import { sunDirection } from './lighting.js';
import { worldMaterials, groundMaterials, procMaterial } from './materials.js';
import { rayAABB, mulberry32 } from '../math.js';
import { Bld, boxInto, ticks } from './mesh.js';

const shaftMat = new ShaderMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide,
	vertexShader: 'varying float v;void main(){v=uv.y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
	fragmentShader: 'varying float v;void main(){gl_FragColor=vec4(vec3(1.,.72,.42)*.4*pow(1.-v,1.4),1.);}' });
// Ambient occlusion per vertex: 10 hemisphere rays of 1.6 m against nearby map boxes (spatial hash of 4 m cells).
const AO_DIRS = Array.from({ length: 10 }, (_, k) => { const a = k * 2.399, e = .25 + .6 * ((k * .618) % 1); return [Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)]; });
function bakeAO(B, hash) {
	const P = B.p, N = B.n, C = B.c;
	for (let v = 0; v < P.length / 3; v++) {
		const nx = N[v * 3], ny = N[v * 3 + 1], nz = N[v * 3 + 2], x = P[v * 3] + nx * .03, y = P[v * 3 + 1] + ny * .03, z = P[v * 3 + 2] + nz * .03;
		const list = hash.get(`${Math.floor(x / 4)},${Math.floor(z / 4)}`);
		if (!list) continue;
		let occ = 0;
		for (const [ax, ay, az] of AO_DIRS) {
			const dot = Math.min(0, ax * nx + ay * ny + az * nz) * 2;
			for (const b of list) { const t = rayAABB(x, y, z, ax - dot * nx, ay - dot * ny, az - dot * nz, b.min, b.max, 1.6); if (t >= 0) { occ += 1 - t / 2.2; break; } }
		}
		const ao = 1 - .75 * Math.min(1, occ / 7.7);
		C[v * 3] *= ao; C[v * 3 + 1] *= ao; C[v * 3 + 2] *= ao;
	}
}
function spatialHash(boxes) {
	const h = new Map();
	for (const b of boxes) if (b.mat !== 12) for (let gx = Math.floor((b.min.x - 2) / 4); gx <= Math.floor((b.max.x + 2) / 4); gx++)
		for (let gz = Math.floor((b.min.z - 2) / 4); gz <= Math.floor((b.max.z + 2) / 4); gz++) { const k = `${gx},${gz}`; if (!h.has(k)) h.set(k, []); h.get(k).push(b); }
	return h;
}

const _m = new Matrix4(), _q = new Quaternion(), _s = new Vector3(), _p = new Vector3(), _up = new Vector3(0,1,0), _d = new Vector3(), A = new Vector3(), Bv = new Vector3();
const at = (x, y, z, sx = 1, sy = 1, sz = 1, ry = 0) => _m.compose(_p.set(x, y, z), _q.setFromAxisAngle(_up, ry), _s.set(sx, sy, sz));
const rotZ = (x, y, z) => _m.makeRotationZ(Math.PI / 2).setPosition(x, y, z);
function tube(B, a, b, r, seg = 12) {
	_d.subVectors(b, a); const len = _d.length();
	B.add(new CylinderGeometry(r, r, len, seg, Math.max(1, Math.round(len / 1.5)), true), _m.compose(_p.addVectors(a, b).multiplyScalar(.5), _q.setFromUnitVectors(_up, _d.normalize()), _s.set(1,1,1)));
}
// A box standing out of a facade: ax 2 = face at z = c (side s, depth d, u along x); ax 0 = face at x = c (u along z).
const onFace = (ax, c, s, u0, u1, y0, y1, d) => (ax === 2 ? [[u0, y0, Math.min(c, c + s * d)], [u1, y1, Math.max(c, c + s * d)]] : [[Math.min(c, c + s * d), y0, u0], [Math.max(c, c + s * d), y1, u1]]);
// Painted, weathered canvas: sign boards (our own lane names) and the plant-zone floor marking.
function paint(w, h, draw, seed) {
	const c = document.createElement('canvas'); c.width = w; c.height = h;
	const x = c.getContext('2d'), rng = mulberry32(seed);
	draw(x);
	x.globalCompositeOperation = 'destination-out';
	for (let k = 0; k < 1600; k++) { x.fillStyle = `rgba(0,0,0,${rng() * .5})`; x.fillRect(rng() * w, rng() * h, 1 + rng() * 5,1 + rng() * 3); }
	const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.anisotropy = 8;
	return t;
}
const sign = (text, ratio) => paint(512, Math.round(512 / ratio), (x) => {
	const h = x.canvas.height; x.fillStyle = '#20262b'; x.fillRect(0,0,512, h); x.strokeStyle = '#e8e2d6'; x.lineWidth = 6; x.strokeRect(10,10,492, h - 20);
	x.fillStyle = '#e8e2d6'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `bold ${Math.min(h * .55,900 / text.length)}px Arial, sans-serif`; x.fillText(text, 256, h / 2 + 4);
}, text.length);
const zone = (letter) => paint(512,512, (x) => {
	x.strokeStyle = x.fillStyle = 'rgba(240,160,60,.85)'; x.lineWidth = 14; x.setLineDash([46,26]); x.beginPath(); x.arc(256,256,236,0,7); x.stroke();
	x.font = 'bold 300px Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(letter, 256,270);
}, letter.charCodeAt(0));

// Floor decals: yellow-black hazard tape at site entrances and the warm pool of light under each street lamp.
const tape = paint(256,32, (x) => { x.fillStyle = '#d8a020'; x.fillRect(0,0,256,32); x.fillStyle = '#1c1c1e'; for (let u = -32; u < 256; u += 32) { x.beginPath(); x.moveTo(u, 32); x.lineTo(u + 16,32); x.lineTo(u + 48,0); x.lineTo(u + 32,0); x.fill(); } }, 5);
const poolTex = paint(128,128, (x) => { const g = x.createRadialGradient(64,64,0,64,64,64); g.addColorStop(0, '#fff'); g.addColorStop(.4, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0,0,128,128); }, 0);
const tapeMat = new MeshStandardMaterial({ map: tape, transparent: true, roughness: .7, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
const poolMat = new MeshBasicMaterial({ map: poolTex, color: 0x9a6232, transparent: true, blending: AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6 });

export function buildWorld(scene, boxes, map) {
	const decal = (m, w, d, x, z, ry) => { const q = new Mesh(new PlaneGeometry(w, d), m); q.rotation.set(-Math.PI / 2,0, ry); q.position.set(x, .025, z); q.receiveShadow = m === tapeMat; scene.add(q); };
	const W = worldMaterials(), ground = groundMaterials(), rng = mulberry32(7), T = () => .9 + rng() * .16;
	const salt = procMaterial({ c: 0xeae6de, pat: 7, scale: 2, r0: .7, r1: .95, bump: .05 });
	const paintM = procMaterial({ c: 0x8a9a8e, c2: 0xa0623a, pat: 2, scale: .25, r0: .45, r1: .7, metal: .2, bump: .01, wear: 1, dirt: .5 });
	const bags = procMaterial({ c: 0xa89a78, pat: 8, r0: .85, r1: 1, bump: .02, cvar: .15 }), rubber = procMaterial({ c: 0x1f1f20, pat: 9, r0: .6, r1: .8 });
	const bulb = new MeshStandardMaterial({ color: 0, emissive: 0xffc58a, emissiveIntensity: 9 });
	const glass = new MeshStandardMaterial({ color: 0x1a2229, roughness: .05, metalness: .3, envMapIntensity: 2.4 });
	const glassLit = new MeshStandardMaterial({ color: 0x1a1410, roughness: .1, emissive: 0xffa860, emissiveIntensity: .9 });
	const meshes = new Map(), get = (m) => { if (!meshes.has(m)) meshes.set(m, new Bld()); return meshes.get(m); };
	const box = (m, mn, mx, r = .02, t = 1) => boxInto(get(m), mn, mx, r, t);
	const edge = (v) => Math.abs(Math.abs(v) - 50) < .01 || Math.abs(Math.abs(v) - 38) < .01;
	for (const b of boxes) {
		if (b.mat >= 12) continue;
		const mn = [b.min.x, b.min.y, b.min.z], mx = [b.max.x, b.max.y, b.max.z], sx = mx[0] - mn[0], sy = mx[1] - mn[1], sz = mx[2] - mn[2];
		box(W[b.mat], mn, mx, b.mat === 6 ? .025 : sy > 3 ? .05 : .035, T());
		if (b.mat === 6) for (const k of [.04, sy - .04]) box(W[6], [mn[0] - .02, mn[1] + k - .04, mn[2] - .02], [mx[0] + .02, mn[1] + k + .04, mx[2] + .02], .015,.8);
		const ax = sx > 5 && sz < 1.3 ? 2 : sz > 5 && sx < 1.3 ? 0 : -1;
		if (ax < 0 || sy < 3.5 || mn[1] > .01) continue;
		// Long walls: posts (fences) or pilasters (concrete) every ~5.5 m and a capping rail, so no run is a flat slab.
		const steel = b.mat === 11, M = steel ? W[2] : W[0], w = steel ? .06 : .21, len = ax ? sx : sz, n = Math.max(1, Math.round(len / 5.5));
		for (let k = 0; k <= n; k++) {
			const u = (ax ? mn[0] : mn[2]) + len * k / n, c = ax ? (mn[2] + mx[2]) / 2 : (mn[0] + mx[0]) / 2, half = (ax ? sz : sx) / 2 + (steel ? .1 : .14);
			box(M, ...onFace(ax, c - half, 1, u - w, u + w, 0, sy + .05, half * 2), .02,.95);
		}
		box(M, [mn[0] - .06, sy - .18, mn[2] - .06], [mx[0] + .06, sy + .08, mx[2] + .06], .02,.9);
	}
	// Facades: plinth, cornice, pilasters and framed window bays on every building face that is not against the map edge.
	for (const bi of map.buildings) {
		const [x0, , z0, x1, h, z1] = map.boxes[bi];
		box(W[0], [x0 - .08,0, z0 - .08], [x1 + .08,.55, z1 + .08], .03,.85);
		box(W[0], [x0 - .16, h - .4, z0 - .16], [x1 + .16, h + .1, z1 + .16], .04,.95);
		for (const [ax, c, a0, a1, s] of [[2, z0, x0, x1,-1], [2, z1, x0, x1,1], [0, x0, z0, z1,-1], [0, x1, z0, z1,1]]) {
			if (edge(c)) continue;
			const n = Math.max(1, Math.round((a1 - a0) / 4.5)), bay = (a1 - a0) / n, hw = Math.min(.8, bay / 2 - .5);
			for (let k = 0; k <= n; k++) {
				const u = a0 + bay * k;
				box(W[0], ...onFace(ax, c, s, u - .22, u + .22,0, h - .4,.12), .02,.92);
				if (k === n || hw < .4) continue;
				for (let yb = 2.5; yb + 2 < h; yb += 2.6) {
					const um = u + bay / 2, yc = yb + .7, ry = ax === 2 ? (s < 0 ? Math.PI : 0) : s * Math.PI / 2;
					get(rng() < .22 ? glassLit : glass).add(new PlaneGeometry(hw * 2,1.4), ax === 2 ? at(um, yc, c + s * .03,1,1,1, ry) : at(c + s * .03, yc, um, 1,1,1, ry));
					for (const [du, dy, su, sv] of [[0,-.74, hw + .08,.06], [0,.74, hw + .08,.06], [-hw - .04,0,.05,.76], [hw + .04,0,.05,.76], [0,0,.025,.72]])
						box(W[2], ...onFace(ax, c, s, um + du - su, um + du + su, yc + dy - sv, yc + dy + sv, .09), .01);
				}
			}
		}
	}
	const PROPS = {
		tank(x, z, r, h) {
			get(W[9]).add(new CylinderGeometry(r, r, h - .6,40,6, true), at(x, (h - .6) / 2, z));
			get(W[9]).add(new SphereGeometry(r, 40,8,0,6.3,0,.5), at(x, h - .6 - r * Math.cos(.5), z));
			for (let y = .6; y < h - .8; y += 1.4) get(W[2]).add(new CylinderGeometry(r + .04, r + .04,.09,40,1), at(x, y, z), 1);
			box(W[2], [x + r - .02,.3, z - .25], [x + r + .08, h - .4, z - .2], .01);
			box(W[0], [x - r - .2,0, z - r - .2], [x + r + .2,.3, z + r + .2], .04);
		},
		pile(x, z, r, h) { get(salt).add(new LatheGeometry(Array.from({ length: 13 }, (_, k) => new Vector2(r * (1 - k / 12) * (1 + .06 * Math.sin(k * 3.1)), h * Math.pow(Math.sin(k / 12 * Math.PI / 2), .8))), 36), at(x, 0, z, 1,1,.8)); },
		conveyor(x0, x1, z0, z1, y) {
			const S = W[2], zc = (z0 + z1) / 2;
			for (const zz of [z0 + .08, z1 - .08]) box(S, [x0, y - .32, zz - .06], [x1, y - .08, zz + .06], .01);
			for (let x = x0 + .5; x < x1; x += 2.2) for (const zz of [z0 + .1, z1 - .1]) box(S, [x - .06,0, zz - .06], [x + .06, y - .3, zz + .06], .01);
			for (let x = x0 + .2; x < x1; x += .45) get(S).add(new CylinderGeometry(.07,.07, z1 - z0 - .3,10,1), _m.makeRotationX(Math.PI / 2).setPosition(x, y - .2, zc), 1);
			box(rubber, [x0, y - .13, z0 + .18], [x1, y - .06, z1 - .18], .01);
			for (let x = x0 + 1.5; x < x1 - 1; x += 3.1) get(salt).add(new SphereGeometry(.35,10,6,0,6.3,0,1.4), at(x, y - .12, zc, 1.4,.45,.9));
		},
		boiler(x0, x1, z, r) {
			const len = x1 - x0, xc = (x0 + x1) / 2, yc = r + .15;
			get(paintM).add(new CylinderGeometry(r, r, len - .8,48,6, true), rotZ(xc, yc, z));
			const R = r / Math.sin(.6); // dome whose rim matches the shell radius
			for (const s of [-1,1]) get(paintM).add(new SphereGeometry(R, 48,10,0,6.3,0,.6), _m.makeRotationZ(-s * Math.PI / 2).setPosition(xc + s * ((len - .8) / 2 - R * Math.cos(.6)), yc, z));
			for (let x = x0 + .7; x < x1 - .5; x += 1.6) get(W[2]).add(new CylinderGeometry(r + .05, r + .05,.14,48,1), rotZ(x, yc, z), 1);
			for (const x of [x0 + 1.4, x1 - 1.4]) box(W[0], [x - .4,0, z - r * .8], [x + .4, yc - r * .6, z + r * .8], .04);
			for (const x of [xc - 1.6, xc + 1.6]) tube(get(W[9]), A.set(x, yc + r - .1, z), Bv.set(x, 7, z), .22,16);
		},
		rail(x0, z0, x1, z1, y) {
			const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / 1.4));
			for (let k = 0; k <= n; k++) tube(get(W[9]), A.set(x0 + (x1 - x0) * k / n, y, z0 + (z1 - z0) * k / n), Bv.set(x0 + (x1 - x0) * k / n, y + 1.05, z0 + (z1 - z0) * k / n), .025,8);
			for (const dy of [.5,1.05]) tube(get(W[9]), A.set(x0, y + dy, z0), Bv.set(x1, y + dy, z1), .025,8);
		},
		lamp(x, z, dir) {
			const dx = dir === 'w' ? -1.2 : 0, dz = dir === 'n' ? -1.2 : 0;
			tube(get(W[2]), A.set(x, 0, z), Bv.set(x, 5.6, z), .08,10); tube(get(W[2]), A.set(x, 5.5, z), Bv.set(x + dx, 5.6, z + dz), .04,8);
			box(W[2], [x + dx - .25,5.45, z + dz - .18], [x + dx + .25,5.65, z + dz + .18], .03);
			get(bulb).add(new BoxGeometry(.4,.03,.26), at(x + dx, 5.44, z + dz));
			box(W[0], [x - .25,0, z - .25], [x + .25,.3, z + .25], .03);
			decal(poolMat, 9,9, x + dx, z + dz, 0);
		},
		tape(x, z, w, ry) { decal(tapeMat, w, .45, x, z, ry); },
		wlamp(x, y, z) {
			tube(get(W[2]), A.set(x, y, z), Bv.set(x, y + .8, z), .015,6);
			get(W[2]).add(new SphereGeometry(.28,16,6,0,6.3,0,1.3), at(x, y - .05, z)); get(bulb).add(new SphereGeometry(.1,10,8), at(x, y - .12, z));
			const l = new PointLight(0xffb062,40,18,1.8); l.position.set(x, y - .4, z); scene.add(l);
		},
		// Dusty sun shaft through a window opening (x, y0..y1, z0..z1): the four long faces of the prism swept along the
		// sunlight down to the floor, additive and fading with distance.
		shaft(x, y0, y1, z0, z1) {
			const d = sunDirection(), p = [], uv = [], c = [[y0, z0], [y1, z0], [y1, z1], [y0, z1]];
			for (let k = 0; k < 4; k++) for (const [y, z, v] of [[...c[k], 0], [...c[(k + 1) % 4], 0], [...c[(k + 1) % 4], 1], [...c[k], 0], [...c[(k + 1) % 4], 1], [...c[k], 1]]) {
				const t = v * y / d.y; p.push(x - d.x * t, y - d.y * t, z - d.z * t); uv.push(0, v);
			}
			const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(p, 3)); g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
			scene.add(new Mesh(g, shaftMat));
		},
		pipe(...pts) {
			for (let k = 0; k + 5 < pts.length; k += 3) {
				A.fromArray(pts, k); Bv.fromArray(pts, k + 3); tube(get(W[9]), A, Bv, .15,14);
				get(W[9]).add(new SphereGeometry(.15,14,8), at(Bv.x, Bv.y, Bv.z));
				const len = A.distanceTo(Bv);
				for (let t = 1.5; t < len; t += 3) tube(get(W[9]), _p.lerpVectors(A, Bv, (t - .04) / len).clone(), _d.lerpVectors(A, Bv, (t + .04) / len).clone(), .2,14);
			}
		},
		sign(text, x, y, z, dir, w) {
			const h = Math.min(1.2, w * .28), m = new Mesh(new PlaneGeometry(w, h), new MeshStandardMaterial({ map: sign(text, w / h), roughness: .75, metalness: .2 }));
			m.position.set(x + [0,-1,0,1][dir] * .06, y, z + [-1,0,1,0][dir] * .06); m.rotation.y = [Math.PI, -Math.PI / 2,0, Math.PI / 2][dir]; m.receiveShadow = true; scene.add(m);
		},
		barrel(x, z) {
			get([W[3], W[4], W[10]][Math.floor(rng() * 3)]).add(new CylinderGeometry(.3,.3,.88,24,3), at(x, .44, z, 1,1,1, rng() * 6));
			for (const y of [.05,.3,.58,.86]) get(W[2]).add(new CylinderGeometry(.31,.31,.035,24,1), at(x, y, z), 1);
		},
		bags(x0, z0, x1, z1, y) {
			for (let row = 0, yy = .13; yy < y; row++, yy += .24) for (let u = x0 + .3 + (row % 2) * .27; u < x1 - .2; u += .55)
				for (const zz of [z0 + .18, z1 - .18]) get(bags).add(new SphereGeometry(.3,12,7), at(u, yy, zz, .95,.42,.62, (rng() - .5) * .2));
		},
		zone(x, z, letter) {
			const m = new Mesh(new PlaneGeometry(9,9), new MeshStandardMaterial({ map: zone(letter), transparent: true, roughness: .8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
			m.rotation.x = -Math.PI / 2; m.position.set(x, .02, z); m.receiveShadow = true; scene.add(m);
		},
	};
	for (const [kind, ...args] of map.props) PROPS[kind](...args);
	const hash = spatialHash(boxes);
	for (const [mat, b] of meshes) {
		const lit = mat !== glass && mat !== glassLit && mat !== bulb;
		if (lit) bakeAO(b, hash);
		const mesh = new Mesh(b.geo(), mat); mesh.castShadow = lit; mesh.receiveShadow = true; scene.add(mesh);
	}
	// Ground: one subdivided slab per floor patch (asphalt, concrete, salt gravel, brine, wet concrete), AO baked too.
	map.floors.slice().sort((a, b) => (a[4] === 3) - (b[4] === 3)).forEach(([x0, z0, x1, z1, kind], k) => {
		const G = new Bld();
		G.grid(ticks(z0, z1, false, 1).map((z) => ticks(x0, x1, false, 1).map((x) => [x, .004 * k, z])), [0,1,0], 0,1);
		bakeAO(G, hash);
		const m = ground[kind].clone(); m.onBeforeCompile = ground[kind].onBeforeCompile; m.customProgramCacheKey = ground[kind].customProgramCacheKey;
		Object.assign(m, { polygonOffset: true, polygonOffsetFactor: -k, polygonOffsetUnits: -k });
		const mesh = new Mesh(G.geo(), m); mesh.receiveShadow = true; scene.add(mesh);
	});
	backdrop(scene);
}

// Distant industrial skyline beyond the walls: chimneys, silos, a gantry crane and a ridge line, all fogged.
function backdrop(scene) {
	const far = new MeshStandardMaterial({ color: 0x6d6560, roughness: .9 }), B = new Bld(), R = new Bld(), rng = mulberry32(3);
	for (const [x, z, h] of [[-80,-95,46], [-62,-100,38]]) { B.add(new CylinderGeometry(1.6,2.6, h, 20), at(x, h / 2, z)); B.add(new CylinderGeometry(1.75,1.75,1.2,20), at(x, h - 4, z), 0,.5); }
	for (let k = 0; k < 4; k++) { B.add(new CylinderGeometry(5,5,22,28), at(85 + k * 11,11,40 - k * 4)); B.add(new SphereGeometry(5,28,8,0,6.3,0,1.2), at(85 + k * 11,22,40 - k * 4)); }
	for (const [x, y, z, sx, sy, sz] of [[70,17,-70,1.2,34,1.2], [70,17,-82,1.2,34,1.2], [92,17,-70,1.2,34,1.2], [92,17,-82,1.2,34,1.2], [81,33,-76,30,2.4,14], [81,31,-60,2,2,40]]) B.add(new BoxGeometry(sx, sy, sz), at(x, y, z));
	const rows = [0,1].map((k) => Array.from({ length: 97 }, (_, i) => { const a = i / 96 * Math.PI * 2; return [Math.cos(a) * 220, k ? 14 + rng() * 22 + 14 * Math.sin(a * 3) : -1, Math.sin(a) * 220]; }));
	R.grid(rows, [0,0,-1], 0,1);
	scene.add(new Mesh(B.geo(), far), new Mesh(R.geo(), new MeshStandardMaterial({ color: 0x4a4048, roughness: 1, side: DoubleSide })));
}
