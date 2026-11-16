// SALTLINE grenades.js — thrown utility (PLAN.md §8): ballistic arcs that bounce off the map, Shard frag (falls off
// over 6 m, needs line of sight), Veil smoke (a sphere that blocks sight for bots and players) and Glare flash
// (blinds by distance and view angle). Pools of 8 grenades and 4 smokes live in the state.
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

// The player throws along the view (LMB full, RMB lob); bots pass a target and get the arc that lands on it.
export function throwGrenade(state, a, lob, tx, ty, tz) {
	const kind = a.nadeSel, g = state.nades.find((n) => !n.active);
	if (!a.nades[kind] || state.time < a.nextFireT || !g) return false;
	a.nades[kind]--; a.nextFireT = state.time + THROW.cool;
	if (!a.nades.shard && !a.nades.veil && !a.nades.glare) a.grenadeMode = false;
	eyePos(a, _e);
	if (tx !== undefined) {
		const dx = tx - _e.x, dz = tz - _e.z, dh = Math.max(.5, Math.hypot(dx, dz)), t = dh / 13;
		_d.set(dx / dh * 13, (ty - _e.y + .5 * THROW.gravity * t * t) / t, dz / dh * 13);
	} else { viewDir(a, _d).multiplyScalar(lob ? THROW.lob : THROW.full); _d.y += THROW.up; }
	Object.assign(g, { active: true, kind, x: _e.x, y: _e.y, z: _e.z, vx: _d.x, vy: _d.y, vz: _d.z, fuseT: GRENADES[kind].fuse, owner: a, bounced: false });
	return true;
}

function shard(state, g) {
	const gd = GRENADES.shard;
	state.fxBoom++;
	pushFx(state, 7, g.x, g.y, g.z, 0, 0, 0, 0);
	for (const t of state.agents) {
		if (!t.alive || t.team === g.owner.team) continue;
		const dist = Math.hypot(t.pos.x - g.x, t.pos.y + 1 - g.y, t.pos.z - g.z);
		if (dist < gd.radius && !losBlocked(state.boxes, g.x, g.y, g.z, t.pos.x, t.pos.y + 1, t.pos.z)) applyHit(state, g.owner, t, 'chest', Math.round(gd.dmg * (1 - dist / gd.radius)), 0, FRAG);
	}
	pushNoise(state, g.x, g.y, g.z, 60, g.owner.team, 3);
}
function glare(state, g) {
	const gd = GRENADES.glare;
	pushFx(state, 7, g.x, g.y, g.z, 0, 0, 0, 1);
	for (const a of state.agents) {
		if (!a.alive) continue;
		const ey = a.pos.y + a.eyeHeight, dx = g.x - a.pos.x, dz = g.z - a.pos.z, dist = Math.hypot(dx, g.y - ey, dz);
		if (dist > gd.range || losBlocked(state.boxes, g.x, g.y, g.z, a.pos.x, ey, a.pos.z)) continue;
		const facing = (-Math.sin(a.yaw) * dx - Math.cos(a.yaw) * dz) / Math.max(.01, dist) > .2, blind = gd.blind * (1 - dist / gd.range) * (facing ? 1 : .25);
		if (blind > .3) a.flashT = Math.max(a.flashT, blind);
	}
}

export function updateGrenades(state, dt) {
	for (const a of state.agents) if (a.flashT > 0) a.flashT = Math.max(0, a.flashT - dt);
	for (const g of state.nades) {
		if (!g.active) continue;
		const ox = g.x, oy = g.y, oz = g.z;
		g.vy -= THROW.gravity * dt; g.x += g.vx * dt; g.y += g.vy * dt; g.z += g.vz * dt;
		if (g.y < .05) { g.y = .05; g.vy = Math.abs(g.vy) * THROW.bounce; g.vx *= .7; g.vz *= .7; }
		else if (inside(state.boxes, g.x, g.y, g.z)) { // find the axis that entered the box and reflect it
			const vert = !inside(state.boxes, g.x, oy, g.z), alongX = !vert && inside(state.boxes, g.x, oy, oz);
			g.x = ox; g.y = oy; g.z = oz;
			if (vert) { g.vy = -g.vy * THROW.bounce; g.vx *= .7; g.vz *= .7; } else if (alongX) { g.vx = -g.vx * THROW.bounce; g.vy *= .8; } else { g.vz = -g.vz * THROW.bounce; g.vy *= .8; }
		}
		if (!g.bounced && (g.y <= .06 || g.vy * (g.y - oy) < 0)) { g.bounced = true; pushNoise(state, g.x, g.y, g.z, 14, g.owner.team, 3); }
		g.fuseT -= dt;
		if (g.kind === 'veil' && (Math.hypot(g.vx, g.vy, g.vz) < .8 || g.fuseT <= 0)) {
			g.active = false;
			const s = state.smokes.find((m) => !m.active), v = GRENADES.veil;
			if (s) Object.assign(s, { active: true, x: g.x, y: Math.max(.9, g.y), z: g.z, r: v.radius, t: state.time, dur: v.dur });
		} else if (g.fuseT <= 0) { g.active = false; (g.kind === 'shard' ? shard : glare)(state, g); }
	}
	for (const s of state.smokes) if (s.active && state.time > s.t + s.dur) s.active = false;
}
