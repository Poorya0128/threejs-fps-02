// SALTLINE grenades.js — throw arcs, bounce, frag, smoke, flash (§8).
import * as THREE from 'three';
import { GRENADES, THROW } from './config.js';
import { losBlocked } from './math.js';
import { eyePos, viewDir, applyHit } from './weapons.js';
import { pushFx, pushNoise } from './state.js';

const _e = new THREE.Vector3(), _d = new THREE.Vector3();
const FRAG = { falloff: 1, cls: 'frag', name: 'SHARD' };

export function initGrenades(state) {
	for (let i = 0; i < 8; i++) state.nades.push({ active: false, kind: '', x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, fuseT: 0, owner: null, bounced: false });
	for (let i = 0; i < 4; i++) state.smokes.push({ active: false, x: 0, y: 0, z: 0, r: 0, t: 0, dur: 0 });
}

function insideAny(boxes, x, y, z) {
	for (let i = 0; i < boxes.length; i++) {
		const b = boxes[i];
		if (x > b.min.x - 0.09 && x < b.max.x + 0.09 && y > b.min.y - 0.09 && y < b.max.y + 0.09 && z > b.min.z - 0.09 && z < b.max.z + 0.09) return true;
	}
	return false;
}

export function throwGrenade(state, a, lob, tx, ty, tz) {
	const kind = a.nadeSel;
	if (!a.nades[kind] || state.time < a.nextFireT) return false;
	let g = null;
	for (let i = 0; i < state.nades.length; i++) if (!state.nades[i].active) { g = state.nades[i]; break; }
	if (!g) return false;
	a.nades[kind]--;
	a.nextFireT = state.time + THROW.cool;
	if (!a.nades.shard && !a.nades.veil && !a.nades.glare) a.grenadeMode = false;
	eyePos(a, _e);
	if (tx !== undefined) {
		const dx = tx - _e.x, dy = (ty ?? 1) - _e.y, dz = tz - _e.z;
		const dh = Math.max(0.5, Math.hypot(dx, dz)), t = dh / 13;
		_d.set(dx / dh * 13, (dy + 0.5 * THROW.gravity * t * t) / t, dz / dh * 13);
	} else {
		viewDir(a, _d);
		_d.multiplyScalar(lob ? THROW.lob : THROW.full); _d.y += THROW.up;
	}
	g.active = true; g.kind = kind; g.x = _e.x; g.y = _e.y; g.z = _e.z;
	g.vx = _d.x; g.vy = _d.y; g.vz = _d.z;
	g.fuseT = GRENADES[kind].fuse; g.owner = a; g.bounced = false;
	return true;
}

function explodeShard(state, g) {
	const gd = GRENADES.shard;
	state.fxBoom++;
	pushFx(state, 7, g.x, g.y, g.z, 0, 0, 0, 0);
	for (const t of state.agents) {
		if (!t.alive || t.team === g.owner.team) continue;
		const dx = t.pos.x - g.x, dy = (t.pos.y + 1) - g.y, dz = t.pos.z - g.z;
		const dist = Math.hypot(dx, dy, dz);
		if (dist > gd.radius) continue;
		if (losBlocked(state.boxes, g.x, g.y, g.z, t.pos.x, t.pos.y + 1, t.pos.z)) continue;
		applyHit(state, g.owner, t, 'chest', Math.round(gd.dmg * (1 - dist / gd.radius)), 0, FRAG);
	}
	pushNoise(state, g.x, g.y, g.z, 60, g.owner.team, 3);
}

function spawnSmoke(state, g) {
	let s = null;
	for (let i = 0; i < state.smokes.length; i++) if (!state.smokes[i].active) { s = state.smokes[i]; break; }
	if (!s) return;
	const gd = GRENADES.veil;
	s.active = true; s.x = g.x; s.y = Math.max(0.9, g.y); s.z = g.z; s.r = gd.radius; s.t = state.time; s.dur = gd.dur;
}

function popGlare(state, g) {
	const gd = GRENADES.glare;
	pushFx(state, 7, g.x, g.y, g.z, 0, 0, 0, 1);
	let playerFlashed = false;
	for (const a of state.agents) {
		if (!a.alive) continue;
		const dx = g.x - a.pos.x, dy = g.y - (a.pos.y + a.eyeHeight), dz = g.z - a.pos.z;
		const dist = Math.hypot(dx, dy, dz);
		if (dist > gd.range) continue;
		if (losBlocked(state.boxes, g.x, g.y, g.z, a.pos.x, a.pos.y + a.eyeHeight, a.pos.z)) continue;
		const fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw);
		const facing = (dx * fx + dz * fz) / Math.max(0.01, dist) > 0;
		const blind = gd.blind * (1 - dist / gd.range) * (facing ? 1 : 0.25);
		if (blind > 0.3) { a.flashT = Math.max(a.flashT, blind); if (a === state.player) playerFlashed = true; }
	}
	if (playerFlashed) state.fxRing++;
}

export function updateGrenades(state, dt) {
	for (const a of state.agents) if (a.flashT > 0) a.flashT = Math.max(0, a.flashT - dt);
	for (const g of state.nades) {
		if (!g.active) continue;
		g.vy -= THROW.gravity * dt;
		const ox = g.x, oy = g.y, oz = g.z;
		g.x += g.vx * dt; g.y += g.vy * dt; g.z += g.vz * dt;
		if (g.y < 0.05) { g.y = 0.05; g.vy = Math.abs(g.vy) * THROW.bounce; g.vx *= 0.7; g.vz *= 0.7; }
		else if (insideAny(state.boxes, g.x, g.y, g.z)) {
			const vert = !insideAny(state.boxes, g.x, oy, g.z), alongX = !vert && insideAny(state.boxes, g.x, oy, oz);
			g.x = ox; g.y = oy; g.z = oz;
			if (vert) { g.vy = -g.vy * THROW.bounce; g.vx *= 0.7; g.vz *= 0.7; }
			else if (alongX) { g.vx = -g.vx * THROW.bounce; g.vy *= 0.8; }
			else { g.vz = -g.vz * THROW.bounce; g.vy *= 0.8; }
		}
		if (!g.bounced && (g.y <= 0.06 || g.vy * (g.y - oy) < 0)) {
			g.bounced = true;
			pushNoise(state, g.x, g.y, g.z, 14, g.owner.team, 3);
		}
		const speed = Math.hypot(g.vx, g.vy, g.vz);
		g.fuseT -= dt;
		if (g.kind === 'veil' && (speed < 0.8 || g.fuseT <= 0)) { spawnSmoke(state, g); g.active = false; }
		else if (g.fuseT <= 0) {
			g.active = false;
			if (g.kind === 'shard') explodeShard(state, g);
			else if (g.kind === 'glare') popGlare(state, g);
		}
	}
	for (const s of state.smokes) if (s.active && state.time > s.t + s.dur) s.active = false;
}
