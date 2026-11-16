// Soldiers (ART.md §7): parts skinned to a 12-bone rig, team silhouettes, procedural motion, arm IK.
import { Bone, Skeleton, SkinnedMesh, Group, Mesh, MeshStandardMaterial, Float32BufferAttribute, Uint16BufferAttribute, CapsuleGeometry,
	SphereGeometry, CylinderGeometry, Matrix4, Vector3, Quaternion, Sprite, SpriteMaterial } from 'three';
import { Bld, boxInto, lin, canvasTex } from './mesh.js';
import { buildWeapon, weaponMaterial } from './weapons-art.js';
import { buildHands, GLOVE } from './viewmodel.js';
import { procMaterial } from './materials.js';
import { TEAM_LOOK } from '../config.js';

// Bones [parent, x, y, z] relative to the parent; arms hang down, forward is -z.
const BONES = [[-1,0,0,0], [0,0,.95,0], [1,0,.27,0], [2,0,.33,0], [2,-.2,.22,0], [4,0,-.29,0], [2,.2,.22,0], [6,0,-.29,0],
	[1,-.1,-.04,0], [8,0,-.44,0], [1,.1,-.04,0], [10,0,-.44,0]];
const [ROOT, PELVIS, CHEST, HEAD, LUA, LFA, RUA, RFA, LTH, LSH, RTH, RSH] = BONES.keys();
const LEGS = [[LTH, LSH, -1], [RTH, RSH, 1]], ARMS = [[LUA, LFA, -1], [RUA, RFA, 1]], L1 = .29, L2 = .27, DOWN = new Vector3(0,-1,0);
const _m = new Matrix4(), _q = new Quaternion(), _q2 = new Quaternion(), _v = new Vector3(), _s = new Vector3();
const _S = new Vector3(), _T = new Vector3(), _E = new Vector3(), _D = new Vector3(), _P = new Vector3();

function buildBody(team) {
	const L = TEAM_LOOK[team], B = new Bld(), skin = [], strand = team === 'strand';
	const [cloth, gear, acc, helm, dark, face] = [L.cloth, L.gear, L.accent, L.helmet, 0x1c1c1e, 0x9a7258].map(lin);
	const part = (bone, fn) => { fn(); while (skin.length < B.e.length) skin.push(bone); };
	const bx = (mn, mx, col, e = 1, r = .02) => boxInto(B, mn, mx, r, col, .4, e, e);
	const geo = (g, x, y, z, col, e = 0, sx = 1, sy = 1, sz = 1) => B.add(g, _m.compose(_v.set(x, y, z), _q.identity(), _s.set(sx, sy, sz)), e, col);
	const cyl = (r, h, x, y, z, col, e = 1) => geo(new CylinderGeometry(r, r, h, 12), x, y, z, col, e);
	part(PELVIS, () => {
		geo(new CapsuleGeometry(.15,.1,4,14), 0,.93,0, cloth, 0,1.1,1,.75);
		bx([-.18,.98,-.12], [.18,1.04,.12], gear);
		for (const x of [-.17,.17]) bx([x - .03,.9,-.06], [x + .03,1,.04], gear);
	});
	part(CHEST, () => {
		geo(new CapsuleGeometry(.16,.22,4,16), 0,1.3,0, cloth, 0,1.15,1,.72);
		bx([-.16,1.12,-.17], [.16,1.45,-.08], gear); bx([-.16,1.12,.07], [.16,1.45,.15], gear); bx([-.19,1.12,-.1], [.19,1.27,.09], gear);
		for (const [z0, z1] of [[-.18,-.165], [.15,.16]]) bx([-.165,1.4, z0], [.165,1.45, z1], acc, 3,.008);
		for (const x of [-.11,0,.11]) bx([x - .04,1.13,-.215], [x + .04,1.26,-.165], gear, 1,.012);
		for (const x of [-.1,.1]) bx([x - .035,1.44,-.12], [x + .035,1.5,.12], gear, 1,.01);
		if (strand) { bx([-.15,1.1,.15], [.15,1.44,.3], gear); bx([-.15,1.3,.3], [.15,1.36,.31], acc, 3,.005); }
		else { bx([-.13,1.3,.15], [.13,1.42,.2], dark); geo(new CylinderGeometry(.006,.008,.55,6), .1,1.62,.18, dark, 2); }
		cyl(.065,.1,0,1.53,0, face, 0);
	});
	part(HEAD, () => {
		geo(new SphereGeometry(.105,18,14), 0,1.66,-.01, face, 0,.95,1.08,1.05);
		geo(new SphereGeometry(.135,22,10,0,6.3,0, strand ? 1.45 : 1.75), 0,1.65,0, helm, 1,1,1.05,1.12);
		geo(new CylinderGeometry(.139,.139,.035,22,1, true), 0,1.7,0, acc, 3,1,1,1.12);
		for (const x of [-.12,.12]) cyl(.03,.035, x, 1.65,.01, dark);
		bx([-.025,1.76,-.15], [.025,1.8,-.11], dark, 2,.008);
		if (strand) { bx([-.085,1.66,-.125], [.085,1.7,-.09], dark, 2,.012); geo(new CylinderGeometry(.2,.21,.014,26), 0,1.68,.005, helm, 1); }
		else geo(new CylinderGeometry(.128,.128,.075,20,1, true, Math.PI * .62, Math.PI * .76), 0,1.655,-.005, dark, 2);
	});
	for (const [ua, fa, s] of ARMS) {
		part(ua, () => { geo(new CapsuleGeometry(.052,.19,4,12), s * .2,1.31,0, cloth); bx([s * .2 - .064,1.29,-.064], [s * .2 + .064,1.41,.064], acc, 3,.04); });
		part(fa, () => { geo(new CapsuleGeometry(.046,.17,4,12), s * .2,1.03,0, cloth); bx([s * .2 - .05,1.1,-.01], [s * .2 + .05,1.19,.06], gear, 1,.03); });
	}
	for (const [th, sh, s] of LEGS) {
		part(th, () => { geo(new CapsuleGeometry(.075,.28,4,14), s * .1,.69,0, cloth); if (s > 0) bx([.14,.62,-.06], [.19,.78,.06], gear); });
		part(sh, () => {
			geo(new CapsuleGeometry(.058,.28,4,12), s * .1,.27,0, cloth);
			bx([s * .1 - .065,.39,-.11], [s * .1 + .065,.53,-.03], gear, 1,.04);
			bx([s * .1 - .06,0,-.17], [s * .1 + .06,.14,.07], dark, 1,.045);
		});
	}
	const g = B.geo(), idx = new Uint16Array(skin.length * 4), w = new Float32Array(skin.length * 4);
	skin.forEach((b, k) => { idx[k * 4] = b; w[k * 4] = 1; });
	g.setAttribute('skinIndex', new Uint16BufferAttribute(idx, 4)); g.setAttribute('skinWeight', new Float32BufferAttribute(w, 4));
	return g;
}

// Two-bone IK in the chest frame: the wrist reaches T, the elbow bends out and down.
function reach(ua, fa, S, T, side) {
	_D.subVectors(T, S); const d = Math.min(_D.length(), L1 + L2 - .002); _D.normalize();
	const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
	_P.set(side * .7,-1,.35); _P.addScaledVector(_D, -_P.dot(_D)).normalize();
	_E.copy(S).addScaledVector(_D, a).addScaledVector(_P, h);
	ua.quaternion.setFromUnitVectors(DOWN, _v.subVectors(_E, S).normalize());
	fa.quaternion.copy(ua.quaternion).invert().multiply(_q2.setFromUnitVectors(DOWN, _v.subVectors(T, _E).normalize()));
}

export function createCharacters(scene) {
	const geos = { strand: buildBody('strand'), bastion: buildBody('bastion') }, rigs = new Map(), guns = {};
	const fuseMat = new MeshStandardMaterial({ color: 0, emissive: 0xf0a03c, emissiveIntensity: 6 });
	const markMat = new SpriteMaterial({ depthTest: false, transparent: true, sizeAttenuation: false, map: canvasTex(32, (x) => {
		Object.assign(x, { fillStyle: '#ff5a4a', strokeStyle: '#1a0a08', lineWidth: 3 }); x.beginPath(); x.moveTo(16,3); x.lineTo(28,16); x.lineTo(16,29); x.lineTo(4,16); x.closePath(); x.fill(); x.stroke();
	}) });
	function rigFor(a) {
		const bones = BONES.map(([, x, y, z]) => { const b = new Bone(); b.position.set(x, y, z); return b; });
		BONES.forEach(([p], k) => { if (p >= 0) bones[p].add(bones[k]); });
		const mat = procMaterial({ c: 0xffffff, pat: 12, bump: .004, dirt: .35, rime: .6 }), mesh = new SkinnedMesh(geos[a.team], mat);
		const fuse = new Mesh(new CylinderGeometry(.05,.05,.22,10), fuseMat), hold = new Group(), mark = new Sprite(markMat);
		mesh.add(bones[ROOT]); mesh.updateMatrixWorld(true); mesh.bind(new Skeleton(bones));
		mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false;
		fuse.position.set(0,0,.31); fuse.rotation.z = Math.PI / 2; bones[CHEST].add(fuse, hold);
		mark.scale.setScalar(.022); mesh.add(mark); scene.add(mesh);
		const r = { mesh, mat, mark, bones, fuse, hold, team: a.team, wid: '', gun: null, fall: 0, flinch: 0, amp: 0, side: a.id % 2 ? 1 : -1 };
		rigs.set(a.id, r);
		return r;
	}
	function holdWeapon(r, id) {
		if (r.wid === id) return;
		if (!guns[id]) {
			const w = guns[id] = buildWeapon(id, true), h = buildHands(w, GLOVE);
			h.R.merge(h.L); w.group.add(new Mesh(h.R.geo(), weaponMaterial)); w.rw = h.rw; w.lw = h.lw;
		}
		const w = guns[id], pistol = w.grip && !w.left;
		if (r.gun) r.hold.remove(r.gun.group);
		r.gun = { group: w.group.clone(), rw: w.rw, lw: w.lw }; r.wid = id;
		r.hold.add(r.gun.group);
		r.hold.position.set(pistol ? .03 : .1, pistol ? .17 : .13, pistol ? -.42 : -.16);
	}
	return {
		flash(id) { const r = rigs.get(id); if (r) r.flinch = 1; },
		update(state, dt) {
			for (const a of state.agents) {
				if (!a.isBot) continue;
				let r = rigs.get(a.id);
				if (r?.team !== a.team) { if (r) scene.remove(r.mesh); r = rigFor(a); } // sides swap at half time
				const b = r.bones;
				holdWeapon(r, a.weapons[a.active] || 'wren');
				r.mesh.position.copy(a.pos); r.mesh.rotation.y = a.yaw;
				r.fuse.visible = a.hasFuse;
				r.fall = a.alive ? 0 : Math.min(1, r.fall + dt * 2.6);
				r.flinch = Math.max(0, r.flinch - dt * 10); r.mat.userData.u.uL.value.w = state.scenarioDone ? 0 : r.flinch;
				r.mark.visible = a.alive && a.team !== state.player.team && state.time - state.spottedT[a.id] < 2.5; r.mark.position.y = 2.05 - a.crouch * .4;
				// Stride eases with speed; a death buckles the knees (k), then tips the body over (f).
				r.amp += (Math.min(1, a.speed / 5.5) * .62 - r.amp) * Math.min(1, dt * 8);
				const f = r.fall * r.fall, k = Math.sin(r.fall * Math.PI), amp = r.amp, ph = a.walkPhase, c = a.crouch * (1 - r.fall);
				b[PELVIS].position.y = .95 - c * .3 - f * .72 - k * .2 + Math.abs(Math.sin(ph)) * amp * .035;
				b[ROOT].rotation.set(-f * 1.45,0, f * .25 * r.side);
				b[PELVIS].rotation.y = Math.sin(ph) * amp * .12;
				for (const [th, sh, s] of LEGS) {
					b[th].rotation.x = -Math.sin(ph) * amp * s + c * 1.1 + f * .3 + k * .7;
					b[sh].rotation.x = -Math.max(0, Math.cos(ph) * s) * amp * 1.3 - c * 1.8 - f * .2 - k * 1.2;
				}
				b[CHEST].rotation.set(a.pitch * .65 + c * .2 - amp * .15 - r.flinch * .25 - f * .4, -b[PELVIS].rotation.y, 0);
				b[HEAD].rotation.x = a.pitch * .3 - f * .3;
				r.hold.visible = r.fall <= .3;
				if (r.hold.visible) r.hold.updateMatrix();
				for (const [ua, fa, s] of ARMS) {
					const pt = s > 0 ? r.gun.rw : r.gun.lw;
					if (!r.hold.visible) { b[ua].rotation.set(-.4 * f, 0, s * 1.3 * f); b[fa].rotation.set(-.5 * f, 0,0); }
					else if (pt) reach(b[ua], b[fa], _S.copy(b[ua].position), _T.fromArray(pt).applyMatrix4(r.hold.matrix), s);
					else { b[ua].rotation.set(.15,0,-.1); b[fa].rotation.set(-.3,0,0); }
				}
			}
		},
	};
}
