// Grenades (PLAN.md §8): bouncing arcs, Shard frag (6 m falloff, line of sight), Veil smoke (blocks sight).
import { Vector3 } from 'three';
import { GRENADES, THROW } from './config.js';
import { losBlocked } from './math.js';
import { eyePos, viewDir, applyHit } from './weapons.js';
import { pushFx, pushNoise } from './state.js';

const _e = new Vector3(), _d = new Vector3(), FRAG = { falloff: 1, cls: 'frag', name: 'SHARD' };
export function initGrenades(state) {
	for (let i = 0; i < 8; i++) state.nades.push({ active: false, kind: '', x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, fuseT: 0, owner: null, bounced: false });
	for (let i = 0; i < 4; i++) state.smokes.push({ active: false, x: 0, y: 0, z: 0, r: 0, t: -99, dur: 0 });
}
function inside(boxes, x, y, z) {
	for (const b of boxes) if (x > b.min.x - .09 && x < b.max.x + .09 && y > b.min.y - .09 && y < b.max.y + .09 && z > b.min.z - .09 && z < b.max.z + .09) return true;
	return false;
}

export function throwGrenade(state, a, lob, tx, ty, tz) {
	const kind = a.nadeSel, g = state.nades.find((n) => !n.active);
	if (!a.nades[kind] || state.time < a.nextFireT || !g) return false;
	a.nades[kind]--; a.nextFireT = state.time + THROW.cool;
	a.grenadeMode &&= a.nades.shard + a.nades.veil > 0;
	eyePos(a, _e);
	if (tx !== undefined) {
		const dx = tx - _e.x, dz = tz - _e.z, dh = Math.max(.5, Math.hypot(dx, dz)), t = dh / 13;
		_d.set(dx / dh * 13, (ty - _e.y + .5 * THROW.gravity * t * t) / t, dz / dh * 13);
	} else viewDir(a, _d).multiplyScalar(lob ? THROW.lob : THROW.full).y += THROW.up;
	Object.assign(g, { active: true, kind, x: _e.x, y: _e.y, z: _e.z, vx: _d.x, vy: _d.y, vz: _d.z, fuseT: GRENADES[kind].fuse, owner: a, bounced: false });
	return true;
}

function shard(state, g) {
	const G = GRENADES.shard;
	pushFx(state, 7, g.x, g.y, g.z, 0, 0, 0, 0);
	pushNoise(state, g.x, g.y, g.z, 60, g.owner.team, 3);
	for (const t of state.agents) {
		const dist = Math.hypot(t.pos.x - g.x, t.pos.y + 1 - g.y, t.pos.z - g.z);
		if (t.alive && t.team !== g.owner.team && dist < G.radius && !losBlocked(state.boxes, g.x, g.y, g.z, t.pos.x, t.pos.y + 1, t.pos.z)) applyHit(state, g.owner, t, 'chest', Math.round(G.dmg * (1 - dist / G.radius)), 0, FRAG);
	}
}

export function updateGrenades(state, dt) {
	for (const g of state.nades) {
		if (!g.active) continue;
		const ox = g.x, oy = g.y, oz = g.z;
		g.vy -= THROW.gravity * dt; g.x += g.vx * dt; g.y += g.vy * dt; g.z += g.vz * dt;
		if (g.y < .05) { g.y = .05; g.vy = Math.abs(g.vy) * THROW.bounce; g.vx *= .7; g.vz *= .7; }
		else if (inside(state.boxes, g.x, g.y, g.z)) {
			const vert = !inside(state.boxes, g.x, oy, g.z), alongX = !vert && inside(state.boxes, g.x, oy, oz);
			g.x = ox; g.y = oy; g.z = oz;
			if (vert) { g.vy *= -THROW.bounce; g.vx *= .7; g.vz *= .7; } else if (alongX) { g.vx *= -THROW.bounce; g.vy *= .8; } else { g.vz *= -THROW.bounce; g.vy *= .8; }
		}
		if (!g.bounced && (g.y <= .06 || g.vy * (g.y - oy) < 0)) { g.bounced = true; pushNoise(state, g.x, g.y, g.z, 14, g.owner.team, 3); }
		g.fuseT -= dt;
		if (g.kind === 'veil' && (Math.hypot(g.vx, g.vy, g.vz) < .8 || g.fuseT <= 0)) {
			const s = state.smokes.find((m) => !m.active);
			g.active = false;
			if (s) Object.assign(s, { active: true, x: g.x, y: Math.max(.9, g.y), z: g.z, r: GRENADES.veil.radius, t: state.time, dur: GRENADES.veil.dur });
		} else if (g.fuseT <= 0) { g.active = false; shard(state, g); }
	}
	for (const s of state.smokes) s.active &&= state.time < s.t + s.dur;
}
