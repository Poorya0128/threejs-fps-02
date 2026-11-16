// World geometry (ART.md §4): bevelled boxes, walls, facades, props, ground and skyline, merged with baked AO.
import { Mesh, MeshStandardMaterial, MeshBasicMaterial, ShaderMaterial, CylinderGeometry, LatheGeometry, SphereGeometry, PlaneGeometry, BoxGeometry, BufferGeometry,
	Float32BufferAttribute, Vector2, Vector3, Matrix4, Quaternion, PointLight, DoubleSide, AdditiveBlending } from 'three';
import { sunDirection } from './lighting.js';
import { WORLD, GROUND, procMaterial } from './materials.js';
import { rayAABB, mulberry32 } from '../math.js';
import { Bld, boxInto, ticks, canvasTex, along } from './mesh.js';

// AO: 10 hemisphere rays of 1.6 m per vertex against the boxes of its 4 m cell.
const AO_DIRS = Array.from({ length: 10 }, (_, k) => { const a = k * 2.399, e = .25 + .6 * ((k * .618) % 1); return [Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)]; });
const cell = (x, z) => `${Math.floor(x / 4)},${Math.floor(z / 4)}`;
function spatialHash(boxes) {
	const h = new Map(), c = (v) => Math.floor(v / 4);
	for (const b of boxes) if (b.mat !== 12) for (let x = c(b.min.x - 2); x <= c(b.max.x + 2); x++) for (let z = c(b.min.z - 2); z <= c(b.max.z + 2); z++) (h.get(`${x},${z}`) ?? h.set(`${x},${z}`, []).get(`${x},${z}`)).push(b);
	return h;
}
function bakeAO(B, hash) {
	const P = B.p, N = B.n;
	for (let v = 0; v < P.length; v += 3) {
		const nx = N[v], ny = N[v + 1], nz = N[v + 2], x = P[v] + nx * .03, y = P[v + 1] + ny * .03, z = P[v + 2] + nz * .03, list = hash.get(cell(x, z));
		let occ = 0;
		if (list) for (const [ax, ay, az] of AO_DIRS) {
			const m = Math.min(0, ax * nx + ay * ny + az * nz) * 2;
			for (const b of list) { const t = rayAABB(x, y, z, ax - m * nx, ay - m * ny, az - m * nz, b.min, b.max, 1.6); if (t >= 0) { occ += 1 - t / 2.2; break; } }
		}
		for (let k = 0; k < 3; k++) B.c[v + k] *= 1 - .75 * Math.min(1, occ / 7.7);
	}
}

const _m = new Matrix4(), _q = new Quaternion(), _s = new Vector3(), _p = new Vector3(), _up = new Vector3(0, 1, 0), A = new Vector3(), Bv = new Vector3();
const at = (x, y, z, sx = 1, sy = 1, sz = 1, ry = 0) => _m.compose(_p.set(x, y, z), _q.setFromAxisAngle(_up, ry), _s.set(sx, sy, sz));
const lying = (x, y, z) => _m.makeRotationZ(Math.PI / 2).setPosition(x, y, z);
const tube = (B, a, b, r, seg = 12) => B.add(new CylinderGeometry(r, r, a.distanceTo(b), seg, Math.max(1, Math.round(a.distanceTo(b) / 1.5)), true), along(a, b));
// Box standing out of a facade (ax 2: face z = c, u along x; ax 0: face x = c, u along z), side s, depth d.
const onFace = (ax, c, s, u0, u1, y0, y1, d) => { const a = Math.min(c, c + s * d), b = Math.max(c, c + s * d); return ax === 2 ? [[u0, y0, a], [u1, y1, b]] : [[a, y0, u0], [b, y1, u1]]; };

function paint(w, h, draw, worn = 1600) {
	const t = canvasTex(w, (x, _, rng) => {
		draw(x, w, h);
		x.globalCompositeOperation = 'destination-out';
		for (let k = 0; k < worn; k++) { x.fillStyle = `rgba(0,0,0,${rng() * .5})`; x.fillRect(rng() * w, rng() * h, 1 + rng() * 5, 1 + rng() * 3); }
	}, h);
	t.anisotropy = 8;
	return t;
}
const label = (x, text, px, cx, cy) => { Object.assign(x, { font: `bold ${px}px Arial, sans-serif`, textAlign: 'center', textBaseline: 'middle' }); x.fillText(text, cx, cy); };
const flat = (o) => ({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, ...o });
const poolMat = new MeshBasicMaterial(flat({ color: 0x9a6232, blending: AdditiveBlending, polygonOffsetFactor: -6, map: paint(128, 128, (x) => {
	const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, '#fff'); g.addColorStop(.4, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
	x.fillStyle = g; x.fillRect(0, 0, 128, 128);
}, 0) }));
const shaftMat = new ShaderMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide,
	vertexShader: 'varying float v;void main(){v=uv.y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
	fragmentShader: 'varying float v;void main(){gl_FragColor=vec4(vec3(1.,.72,.42)*.4*pow(1.-v,1.4),1.);}' });

export function buildWorld(scene, boxes, map) {
	const W = WORLD.map(procMaterial), rng = mulberry32(7), meshes = new Map(), get = (m) => meshes.get(m) ?? meshes.set(m, new Bld()).get(m);
	const salt = procMaterial({ c: 0xeae6de, pat: 7, scale: 2, r0: .7, r1: .95, bump: .05 }), rubber = procMaterial({ c: 0x1f1f20, pat: 9, r0: .6, r1: .8 });
	const paintM = procMaterial({ c: 0x8a9a8e, c2: 0xa0623a, pat: 2, scale: .25, r0: .45, r1: .7, metal: .2, bump: .01, wear: 1, dirt: .5 });
	const bags = procMaterial({ c: 0xa89a78, r0: .85, r1: 1, cvar: .15 }), bulb = new MeshStandardMaterial({ color: 0, emissive: 0xffc58a, emissiveIntensity: 9 });
	const glass = new MeshStandardMaterial({ color: 0x1a2229, roughness: .05, metalness: .3, envMapIntensity: 2.4 });
	const glassLit = new MeshStandardMaterial({ color: 0x1a1410, roughness: .1, emissive: 0xffa860, emissiveIntensity: .9 });
	const conc = get(W[0]), steel = get(W[2]), pipes = get(W[9]), box = (B, mn, mx, r = .02, t = 1) => boxInto(B, mn, mx, r, t);
	const decal = (m, w, d, x, z, ry = 0) => { const q = new Mesh(new PlaneGeometry(w, d), m); q.rotation.set(-Math.PI / 2, 0, ry); q.position.set(x, .025, z); q.receiveShadow = m !== poolMat; scene.add(q); };
	const edge = (v) => [50, 38].includes(Math.abs(v)); // faces on the map border
	for (const b of boxes) {
		if (b.mat >= 12) continue;
		const mn = [b.min.x, b.min.y, b.min.z], mx = [b.max.x, b.max.y, b.max.z], sx = mx[0] - mn[0], sy = mx[1] - mn[1], sz = mx[2] - mn[2], B = get(W[b.mat]);
		box(B, mn, mx, b.mat === 6 ? .025 : sy > 3 ? .05 : .035, .9 + rng() * .16);
		const ax = sx > 5 && sz < 1.3 ? 2 : sz > 5 && sx < 1.3 ? 0 : -1;
		if (ax < 0 || sy < 3.5 || mn[1] > .01) continue;
		const fence = b.mat === 11, P = fence ? steel : conc, w = fence ? .06 : .21, len = ax ? sx : sz, n = Math.max(1, Math.round(len / 5.5));
		const c = ax ? (mn[2] + mx[2]) / 2 : (mn[0] + mx[0]) / 2, half = (ax ? sz : sx) / 2 + (fence ? .1 : .14);
		for (let k = 0; k <= n; k++) { const u = (ax ? mn[0] : mn[2]) + len * k / n; box(P, ...onFace(ax, c - half, 1, u - w, u + w, 0, sy + .05, half * 2), .02, .95); }
		box(P, [mn[0] - .06, sy - .18, mn[2] - .06], [mx[0] + .06, sy + .08, mx[2] + .06], .02, .9);
	}
	for (const bi of map.buildings) {
		const [x0, , z0, x1, h, z1] = map.boxes[bi];
		box(conc, [x0 - .08, 0, z0 - .08], [x1 + .08, .55, z1 + .08], .03, .85);
		box(conc, [x0 - .16, h - .4, z0 - .16], [x1 + .16, h + .1, z1 + .16], .04, .95);
		for (const [ax, c, a0, a1, s] of [[2, z0, x0, x1, -1], [2, z1, x0, x1, 1], [0, x0, z0, z1, -1], [0, x1, z0, z1, 1]]) {
			if (edge(c)) continue;
			const n = Math.max(1, Math.round((a1 - a0) / 4.5)), bay = (a1 - a0) / n, hw = Math.min(.8, bay / 2 - .5), ry = ax === 2 ? (s < 0 ? Math.PI : 0) : s * Math.PI / 2;
			for (let k = 0; k <= n; k++) {
				const u = a0 + bay * k, um = u + bay / 2;
				box(conc, ...onFace(ax, c, s, u - .22, u + .22, 0, h - .4, .12), .02, .92);
				if (k < n && hw >= .4) for (let yc = 3.2; yc + 1.3 < h; yc += 2.6) {
					get(rng() < .22 ? glassLit : glass).add(new PlaneGeometry(hw * 2, 1.4), ax === 2 ? at(um, yc, c + s * .03, 1, 1, 1, ry) : at(c + s * .03, yc, um, 1, 1, 1, ry));
					for (const [du, dy, su, sv] of [[0, -.74, hw + .08, .06], [0, .74, hw + .08, .06], [-hw - .04, 0, .05, .76], [hw + .04, 0, .05, .76], [0, 0, .025, .72]])
						box(steel, ...onFace(ax, c, s, um + du - su, um + du + su, yc + dy - sv, yc + dy + sv, .09), .01);
				}
			}
		}
	}
	const PROPS = {
		tank(x, z, r, h) {
			pipes.add(new CylinderGeometry(r, r, h - .6, 40, 6, true), at(x, (h - .6) / 2, z));
			pipes.add(new SphereGeometry(r, 40, 8, 0, 6.3, 0, .5), at(x, h - .6 - r * Math.cos(.5), z));
			for (let y = .6; y < h - .8; y += 1.4) steel.add(new CylinderGeometry(r + .04, r + .04, .09, 40, 1), at(x, y, z), 1);
			box(conc, [x - r - .2, 0, z - r - .2], [x + r + .2, .3, z + r + .2], .04);
		},
		pile(x, z, r, h) { get(salt).add(new LatheGeometry(Array.from({ length: 13 }, (_, k) => new Vector2(r * (1 - k / 12) * (1 + .06 * Math.sin(k * 3.1)), h * Math.sin(k / 12 * Math.PI / 2) ** .8)), 36), at(x, 0, z, 1, 1, .8)); },
		conveyor(x0, x1, z0, z1, y) {
			const zc = (z0 + z1) / 2;
			for (const zz of [z0 + .08, z1 - .08]) box(steel, [x0, y - .32, zz - .06], [x1, y - .08, zz + .06], .01);
			for (let x = x0 + .5; x < x1; x += 2.2) for (const zz of [z0 + .1, z1 - .1]) box(steel, [x - .06, 0, zz - .06], [x + .06, y - .3, zz + .06], .01);
			for (let x = x0 + .2; x < x1; x += .45) steel.add(new CylinderGeometry(.07, .07, z1 - z0 - .3, 10, 1), _m.makeRotationX(Math.PI / 2).setPosition(x, y - .2, zc), 1);
			box(get(rubber), [x0, y - .13, z0 + .18], [x1, y - .06, z1 - .18], .01);
			for (let x = x0 + 1.5; x < x1 - 1; x += 3.1) get(salt).add(new SphereGeometry(.35, 10, 6, 0, 6.3, 0, 1.4), at(x, y - .12, zc, 1.4, .45, .9));
		},
		boiler(x0, x1, z, r) {
			const len = x1 - x0 - .8, xc = (x0 + x1) / 2, yc = r + .15, R = r / Math.sin(.6), P = get(paintM);
			P.add(new CylinderGeometry(r, r, len, 48, 6, true), lying(xc, yc, z));
			for (const s of [-1, 1]) P.add(new SphereGeometry(R, 48, 10, 0, 6.3, 0, .6), _m.makeRotationZ(-s * Math.PI / 2).setPosition(xc + s * (len / 2 - R * Math.cos(.6)), yc, z));
			for (let x = x0 + .7; x < x1 - .5; x += 1.6) steel.add(new CylinderGeometry(r + .05, r + .05, .14, 48, 1), lying(x, yc, z), 1);
			for (const x of [x0 + 1.4, x1 - 1.4]) box(conc, [x - .4, 0, z - r * .8], [x + .4, yc - r * .6, z + r * .8], .04); // saddles
			for (const x of [xc - 1.6, xc + 1.6]) tube(pipes, A.set(x, yc + r - .1, z), Bv.set(x, 7, z), .22, 16);
		},
		rail(x0, z0, x1, z1, y) {
			const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / 1.4));
			for (let k = 0; k <= n; k++) { const x = x0 + (x1 - x0) * k / n, zz = z0 + (z1 - z0) * k / n; tube(pipes, A.set(x, y, zz), Bv.set(x, y + 1.05, zz), .025, 8); }
			for (const dy of [.5, 1.05]) tube(pipes, A.set(x0, y + dy, z0), Bv.set(x1, y + dy, z1), .025, 8);
		},
		lamp(x, z, dir) {
			const dx = dir === 'w' ? -1.2 : 0, dz = dir === 'n' ? -1.2 : 0;
			tube(steel, A.set(x, 0, z), Bv.set(x, 5.6, z), .08, 10); tube(steel, A.set(x, 5.5, z), Bv.set(x + dx, 5.6, z + dz), .04, 8);
			box(steel, [x + dx - .25, 5.45, z + dz - .18], [x + dx + .25, 5.65, z + dz + .18], .03);
			get(bulb).add(new BoxGeometry(.4, .03, .26), at(x + dx, 5.44, z + dz));
			box(conc, [x - .25, 0, z - .25], [x + .25, .3, z + .25], .03);
			decal(poolMat, 9, 9, x + dx, z + dz);
		},
		wlamp(x, y, z) {
			tube(steel, A.set(x, y, z), Bv.set(x, y + .8, z), .015, 6);
			steel.add(new SphereGeometry(.28, 16, 6, 0, 6.3, 0, 1.3), at(x, y - .05, z)); get(bulb).add(new SphereGeometry(.1, 10, 8), at(x, y - .12, z));
			const l = new PointLight(0xffb062, 40, 18, 1.8); l.position.set(x, y - .4, z); scene.add(l);
		},
		zone(x, z, letter) {
			decal(new MeshStandardMaterial(flat({ roughness: .8, map: paint(512, 512, (g) => {
				g.strokeStyle = g.fillStyle = 'rgba(240,160,60,.85)'; g.lineWidth = 14; g.setLineDash([46, 26]); g.beginPath(); g.arc(256, 256, 236, 0, 7); g.stroke();
				label(g, letter, 300, 256, 270);
			}) })), 9, 9, x, z);
		},
		// Through a window at x (y0..y1, z0..z1): the opening swept along the sunlight to the floor.
		shaft(x, y0, y1, z0, z1) {
			const d = sunDirection(), c = [[y0, z0], [y1, z0], [y1, z1], [y0, z1]], p = [], uv = [], g = new BufferGeometry();
			for (let k = 0; k < 4; k++) for (const [j, v] of [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]]) {
				const [y, z] = c[(k + j) % 4], t = v * y / d.y; p.push(x - d.x * t, y - d.y * t, z - d.z * t); uv.push(0, v);
			}
			g.setAttribute('position', new Float32BufferAttribute(p, 3)); g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
			scene.add(new Mesh(g, shaftMat));
		},
		pipe(...pts) {
			for (let k = 0; k + 5 < pts.length; k += 3) {
				A.fromArray(pts, k); Bv.fromArray(pts, k + 3); tube(pipes, A, Bv, .15, 14);
				pipes.add(new SphereGeometry(.15, 14, 8), at(Bv.x, Bv.y, Bv.z));
				for (let t = 1.5, len = A.distanceTo(Bv); t < len; t += 3) tube(pipes, A.clone().lerp(Bv, (t - .04) / len), A.clone().lerp(Bv, (t + .04) / len), .2, 14);
			}
		},
		sign(text, x, y, z, dir, w) { // dir 0 −z, 1 −x, 2 +z, 3 +x
			const h = Math.min(1.2, w * .28), m = new Mesh(new PlaneGeometry(w, h), new MeshStandardMaterial({ roughness: .75, metalness: .2, map: paint(512, Math.round(512 * h / w), (g, pw, ph) => {
				g.fillStyle = '#20262b'; g.fillRect(0, 0, pw, ph); g.strokeStyle = g.fillStyle = '#e8e2d6'; g.lineWidth = 6; g.strokeRect(10, 10, pw - 20, ph - 20);
				label(g, text, Math.min(ph * .55, 900 / text.length), pw / 2, ph / 2 + 4);
			}) }));
			m.position.set(x + [0, -1, 0, 1][dir] * .06, y, z + [-1, 0, 1, 0][dir] * .06); m.rotation.y = [Math.PI, -Math.PI / 2, 0, Math.PI / 2][dir]; m.receiveShadow = true; scene.add(m);
		},
		barrel(x, z) {
			get(W[[3, 4, 10][Math.floor(rng() * 3)]]).add(new CylinderGeometry(.3, .3, .88, 24, 3), at(x, .44, z, 1, 1, 1, rng() * 6));
			for (const y of [.05, .3, .58, .86]) steel.add(new CylinderGeometry(.31, .31, .035, 24, 1), at(x, y, z), 1);
		},
		bags(x0, z0, x1, z1, y) {
			for (let row = 0, yy = .13; yy < y; row++, yy += .24) for (let u = x0 + .3 + (row % 2) * .27; u < x1 - .2; u += .55)
				for (const zz of [z0 + .18, z1 - .18]) get(bags).add(new SphereGeometry(.3, 12, 7), at(u, yy, zz, .95, .42, .62, (rng() - .5) * .2));
		},
	};
	for (const [kind, ...args] of map.props) PROPS[kind](...args);
	const hash = spatialHash(boxes);
	for (const [mat, b] of meshes) {
		const lit = mat !== glass && mat !== glassLit && mat !== bulb;
		if (lit) bakeAO(b, hash);
		const mesh = new Mesh(b.geo(), mat); mesh.castShadow = lit; mesh.receiveShadow = true; scene.add(mesh);
	}
	map.floors.slice().sort((a, b) => (a[4] === 3) - (b[4] === 3)).forEach(([x0, z0, x1, z1, kind], k) => {
		const G = new Bld(), m = procMaterial(GROUND[kind]);
		G.grid(ticks(z0, z1, false, 1).map((z) => ticks(x0, x1, false, 1).map((x) => [x, .004 * k, z])), [0, 1, 0], 0, 1);
		bakeAO(G, hash);
		Object.assign(m, { polygonOffset: true, polygonOffsetFactor: -k, polygonOffsetUnits: -k });
		const mesh = new Mesh(G.geo(), m); mesh.receiveShadow = true; scene.add(mesh);
	});
	const S = new Bld(), ridge = new Bld(), r3 = mulberry32(3);
	for (const [x, z, h] of [[-80, -95, 46], [-62, -100, 38]]) { S.add(new CylinderGeometry(1.6, 2.6, h, 20), at(x, h / 2, z)); S.add(new CylinderGeometry(1.75, 1.75, 1.2, 20), at(x, h - 4, z), 0, .5); }
	for (let k = 0; k < 4; k++) { S.add(new CylinderGeometry(5, 5, 22, 28), at(85 + k * 11, 11, 40 - k * 4)); S.add(new SphereGeometry(5, 28, 8, 0, 6.3, 0, 1.2), at(85 + k * 11, 22, 40 - k * 4)); }
	for (const [x, y, z, sx, sy, sz] of [[70, 17, -70, 1.2, 34, 1.2], [70, 17, -82, 1.2, 34, 1.2], [92, 17, -70, 1.2, 34, 1.2], [92, 17, -82, 1.2, 34, 1.2], [81, 33, -76, 30, 2.4, 14], [81, 31, -60, 2, 2, 40]]) S.add(new BoxGeometry(sx, sy, sz), at(x, y, z));
	ridge.grid([0, 1].map((k) => Array.from({ length: 97 }, (_, i) => { const a = i / 96 * Math.PI * 2; return [Math.cos(a) * 220, k ? 14 + r3() * 22 + 14 * Math.sin(a * 3) : -1, Math.sin(a) * 220]; })), [0, 0, -1], 0, 1);
	scene.add(new Mesh(S.geo(), new MeshStandardMaterial({ color: 0x6d6560, roughness: .9 })), new Mesh(ridge.geo(), new MeshStandardMaterial({ color: 0x4a4048, roughness: 1, side: DoubleSide })));
}
