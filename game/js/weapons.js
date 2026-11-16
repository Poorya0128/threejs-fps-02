// SALTLINE weapons.js — gunplay shared by the player and bots (PLAN.md §7): hitscan against the map and body
// hitboxes, computeSpread (movement, air, crouch, bloom), applyRecoil (learnable spray + recovery), reloads,
// slot switching, the knife, and applyHit (hit groups, armour, falloff, kill credit).
import { Vector3 } from 'three';
import { WEAPONS, HIT, ARMOR_RATIO, MOVE, ECON } from './config.js';
import { clamp, rayAABB, raySphere, rayCapsule } from './math.js';
import { pushFx, pushNoise, feed } from './state.js';
import { throwGrenade } from './grenades.js';

const _eye = new Vector3(), _muz = new Vector3(), _dir = new Vector3(), _right = new Vector3();
const HIT_RESULT = { t: 0, x: 0, y: 0, z: 0, target: null, group: '', mat: -1, nx: 0, ny: 0, nz: 0 };

export function giveWeapon(a, id) {
	const w = WEAPONS[id], k = w.cls === 'pistol' ? 1 : w.cls === 'knife' ? 2 : 0;
	while (a.weapons.length < 3) a.weapons.push(null);
	a.weapons[k] = id; a.ammo[id] = { mag: w.mag, reserve: w.reserve };
	return k;
}
export const activeId = (a) => a.weapons[a.active];
export const activeWeapon = (a) => WEAPONS[a.weapons[a.active]] || WEAPONS.cutlass;
export const eyePos = (a, out) => out.set(a.pos.x, a.pos.y + a.eyeHeight, a.pos.z);
export function viewDir(a, out) {
	const yaw = a.yaw + a.recoil.yaw, pitch = a.pitch + a.recoil.pitch, cp = Math.cos(pitch);
	return out.set(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp);
}
export const maxSpeed = (a) => (MOVE.speed[activeWeapon(a).cls] ?? MOVE.defaultSpeed) * (a.scoped ? MOVE.scopeMul : 1);

// Cone half-angle in radians. Standing still and crouched is near-perfect; full running speed adds 0.035 × move,
// leaving the ground adds the air term, and every shot blooms it until it recovers.
export function computeSpread(a) {
	const w = activeWeapon(a), s = w.spread;
	if (w.cls === 'knife') return 0;
	const base = (a.scoped && w.scopedSpread ? w.scopedSpread : s[0]) * (a.crouch > .5 ? s[1] : 1);
	return base + .035 * s[2] * clamp(Math.hypot(a.vel.x, a.vel.z) / maxSpeed(a) - .1, 0, 1) + (a.onGround ? 0 : s[3]) + a.spreadBloom;
}

// The same shot index always kicks the same way (the climb levels off after kick[3] shots), with ±12 % jitter.
export function applyRecoil(state, a, w) {
	const k = w.kick, i = a.shotsFired, j = 1 + (state.rng() - .5) * .24;
	a.recoil.pitch += k[0] * (1 + k[1] * Math.min(i, k[3])) * (i < k[3] ? 1 : .35) * j;
	a.recoil.yaw += k[2] * Math.sin(i * .55 + .8) * Math.min(1, i / 4) * j;
	a.spreadBloom += w.spread[4];
	a.shotsFired++; a.lastShotT = state.time;
}

// Hitboxes follow the body: head sphere, chest and stomach capsules, forearms raised to the gun, legs.
function traceAgent(ox, oy, oz, dx, dy, dz, t, maxDist, out) {
	const ey = t.pos.y + t.eyeHeight, fx = -Math.sin(t.yaw), fz = -Math.cos(t.yaw), X = t.pos.x, Z = t.pos.z;
	let best = -1;
	const test = (tt, g) => { if (tt >= 0 && (best < 0 || tt < best)) { best = tt; out.group = g; } };
	test(raySphere(ox, oy, oz, dx, dy, dz, X + fx * .02, ey + .04, Z + fz * .02, .13, maxDist), 'head');
	test(rayCapsule(ox, oy, oz, dx, dy, dz, X, ey - .16, Z, X, ey - .48, Z, .21, maxDist), 'chest');
	test(rayCapsule(ox, oy, oz, dx, dy, dz, X, ey - .5, Z, X, ey - .78, Z, .18, maxDist), 'stomach');
	for (let s = -1; s <= 1; s += 2) {
		const sx = X - fz * .24 * s, sz = Z + fx * .24 * s, lx = X - fz * .1 * s, lz = Z + fx * .1 * s;
		test(rayCapsule(ox, oy, oz, dx, dy, dz, sx, ey - .2, sz, sx + fx * .25, ey - .42, sz + fz * .25, .07, maxDist), 'arm');
		test(rayCapsule(ox, oy, oz, dx, dy, dz, lx, ey - .82, lz, lx, t.pos.y + .08, lz, .09, maxDist), 'leg');
	}
	return best;
}

// Nearest of the first map box and the first enemy hitbox along the ray, in the shared HIT_RESULT (or null).
export function traceShot(state, shooter, ox, oy, oz, dx, dy, dz, maxDist) {
	const h = HIT_RESULT;
	let tw = maxDist, wb = null;
	for (const b of state.boxes) { const t = rayAABB(ox, oy, oz, dx, dy, dz, b.min, b.max, tw); if (t >= 0 && t < tw) { tw = t; wb = b; } }
	h.target = null;
	for (const a of state.agents) {
		if (a === shooter || !a.alive || a.team === shooter.team) continue;
		const t = traceAgent(ox, oy, oz, dx, dy, dz, a, tw, h);
		if (t >= 0 && t < tw) { tw = t; h.target = a; wb = null; }
	}
	if (!h.target && !wb) return null;
	h.t = tw; h.x = ox + dx * tw; h.y = oy + dy * tw; h.z = oz + dz * tw; h.mat = wb ? wb.mat : -1;
	if (wb) { // face normal from the nearest box side
		const d0 = h.x - wb.min.x, d1 = wb.max.x - h.x, d2 = h.y - wb.min.y, d3 = wb.max.y - h.y, d4 = h.z - wb.min.z, d5 = wb.max.z - h.z, m = Math.min(d0, d1, d2, d3, d4, d5);
		h.nx = m === d0 ? -1 : m === d1 ? 1 : 0; h.ny = m === d2 ? -1 : m === d3 ? 1 : 0; h.nz = m === d4 ? -1 : m === d5 ? 1 : 0;
	}
	return h;
}

export function applyHit(state, shooter, target, group, dmg, dist, w) {
	const head = group === 'head';
	let total = Math.round(dmg * Math.pow(w.falloff, dist / 25) * (head ? (target.helm ? HIT.headHelm : HIT.head) : HIT[group]));
	if (target.armor > 0 && (!head || target.helm)) { const absorbed = Math.min(target.armor, total * (1 - ARMOR_RATIO)); target.armor -= absorbed; total -= absorbed; }
	target.hp -= total; target.defuseT = target.plantT = 0;
	target.hurtT = state.time; target.hurtYaw = Math.atan2(target.pos.x - shooter.pos.x, target.pos.z - shooter.pos.z);
	state.shots.hits++; state.spottedT[shooter.id] = state.spottedT[target.id] = state.time;
	if (head) state.shots.heads++;
	pushFx(state, 6, target.pos.x, target.pos.y + 1, target.pos.z, 0, 0, 0, target.id);
	const killed = target.hp <= 0;
	if (killed) {
		target.hp = 0; target.alive = false; target.deaths++;
		shooter.kills++; shooter.roundKills++; state.shots.kills++;
		if (head) shooter.headshots++;
		shooter.money = Math.min(ECON.cap, shooter.money + (ECON.kill[w.cls] || 0));
		feed(state, '', { a: shooter.name, b: target.name, w: w.name, head });
	}
	shooter.lastHit.t = state.time; shooter.lastHit.head = head;
	return killed;
}

function startReload(a) {
	const w = activeWeapon(a), am = a.ammo[activeId(a)];
	if (!am || am.mag >= w.mag || am.reserve <= 0 || a.reloadT > 0 || a.reloadShell > 0) return;
	if (w.shell) a.reloadShell = w.reload; else a.reloadT = w.reload;
}

export function switchWeapon(a, idx) {
	if (idx < 0 || idx > 2 || !a.weapons[idx] || idx === a.active) return;
	a.lastWeapon = a.active; a.active = idx;
	Object.assign(a, { switchT: .4, reloadT: 0, reloadShell: 0, scoped: false, scopeLevel: 0, shotsFired: 0, spreadBloom: 0, grenadeMode: false });
	a.recoil.pitch = a.recoil.yaw = 0;
}

function firePellet(state, a, w, spread, tracer) {
	viewDir(a, _dir);
	if (spread > 0) {
		const ang = state.rng() * 6.2832, r = spread * Math.sqrt(state.rng());
		_right.set(Math.cos(a.yaw), 0, -Math.sin(a.yaw));
		_dir.addScaledVector(_right, Math.cos(ang) * r); _dir.y += Math.sin(ang) * r; _dir.normalize();
	}
	const h = traceShot(state, a, _eye.x, _eye.y, _eye.z, _dir.x, _dir.y, _dir.z, 250);
	const ex = h ? h.x : _eye.x + _dir.x * 250, ey = h ? h.y : _eye.y + _dir.y * 250, ez = h ? h.z : _eye.z + _dir.z * 250;
	if (h && h.target) applyHit(state, a, h.target, h.group, w.dmg, h.t, w);
	else if (h) { pushFx(state, 2, ex, ey, ez, h.nx, h.ny, h.nz, h.mat); pushFx(state, 3, ex, ey, ez, h.nx, h.ny, h.nz, h.mat); }
	if (tracer) pushFx(state, 0, _muz.x, _muz.y, _muz.z, ex, ey, ez, 0);
}

// Knife: the first enemy within reach in front; from behind it is a backstab.
function fireKnife(state, a, w) {
	eyePos(a, _eye); viewDir(a, _dir);
	a.nextFireT = state.time + .55; a.shotsFired++;
	for (const t of state.agents) {
		if (t === a || !t.alive || t.team === a.team) continue;
		const dx = t.pos.x - (_eye.x + _dir.x), dy = t.pos.y + 1 - (_eye.y + _dir.y), dz = t.pos.z - (_eye.z + _dir.z);
		if (dx * dx + dy * dy + dz * dz > 1.2) continue;
		const behind = -Math.sin(t.yaw) * (a.pos.x - t.pos.x) - Math.cos(t.yaw) * (a.pos.z - t.pos.z) < -.4;
		applyHit(state, a, t, 'chest', behind ? w.backstab : w.dmg, 1, w);
		return;
	}
}

export function tryFire(state, a, held, edge) {
	const w = activeWeapon(a);
	if (a.switchT > 0 || state.time < a.nextFireT || (w.auto ? !held : !edge)) return;
	if (w.cls === 'knife') { fireKnife(state, a, w); return; }
	const am = a.ammo[activeId(a)], pellets = w.pellets ?? 1;
	if (a.reloadShell > 0 && am.mag > 0) a.reloadShell = 0; // a shotgun can fire between shells
	if (a.reloadT > 0 || a.reloadShell > 0) return;
	if (am.mag <= 0) { a.dryT = state.time; a.nextFireT = state.time + .25; startReload(a); return; }
	am.mag--; a.nextFireT = state.time + 60 / w.rpm; state.shots.fired++;
	const spread = computeSpread(a);
	applyRecoil(state, a, w);
	eyePos(a, _eye);
	_right.set(Math.cos(a.yaw), 0, -Math.sin(a.yaw));
	viewDir(a, _muz).multiplyScalar(.62).add(_eye).addScaledVector(_right, .12); _muz.y -= .1;
	pushFx(state, 1, _muz.x, _muz.y, _muz.z, 0, 0, 0, 0);
	pushFx(state, 4, _muz.x - _right.x * .04, _muz.y, _muz.z - _right.z * .04, _right.x, 0, _right.z, 0);
	for (let i = 0; i < pellets; i++) firePellet(state, a, w, spread, i === 0 && (pellets > 1 || state.shots.fired % 2 === 0));
	pushNoise(state, a.pos.x, a.pos.y, a.pos.z, w.noise, a.team, 1);
	if (am.mag === 0 && am.reserve > 0) startReload(a);
}

// Per-tick weapon timers for everyone, then the player's input (slots, scope, reload, grenades, trigger).
export function updateWeapons(state, dt) {
	for (const a of state.agents) {
		if (!a.alive) continue;
		const w = activeWeapon(a), am = a.ammo[activeId(a)];
		if (a.reloadT > 0 && (a.reloadT -= dt) <= 0) { const take = Math.min(w.mag - am.mag, am.reserve); a.reloadT = 0; am.mag += take; am.reserve -= take; }
		if (a.reloadShell > 0 && (a.reloadShell -= dt) <= 0) {
			a.reloadShell = 0;
			if (am.mag < w.mag && am.reserve > 0) { am.mag++; am.reserve--; if (am.mag < w.mag && am.reserve > 0) a.reloadShell = w.reload; }
		}
		if (a.switchT > 0) a.switchT -= dt;
		if (state.time - a.lastShotT > .12) {
			const k = Math.exp(-7 * dt);
			a.recoil.pitch *= k; a.recoil.yaw *= k;
			if (Math.abs(a.recoil.pitch) < .0008) a.shotsFired = 0;
		}
		a.spreadBloom *= Math.exp(-5 * dt);
	}
	const p = state.player, inp = state.input;
	if (p.alive && !state.autoplay && state.phase !== 'post' && state.phase !== 'matchEnd') {
		if (inp.slot === 4) { // grenade key cycles through the grenades carried
			const order = ['shard', 'veil', 'glare'], i0 = order.indexOf(p.nadeSel);
			for (let k = 1; k <= 3; k++) { const id = order[(i0 + (p.grenadeMode ? k : k - 1)) % 3]; if (p.nades[id] > 0) { p.nadeSel = id; p.grenadeMode = true; p.scoped = false; break; } }
		} else if (inp.slot > 0) switchWeapon(p, inp.slot - 1);
		else if (inp.lastWeapon) switchWeapon(p, p.lastWeapon);
		else if (inp.wheel) for (let k = 1; k < 3; k++) { const idx = (p.active + Math.sign(inp.wheel) * k + 3) % 3; if (p.weapons[idx]) { switchWeapon(p, idx); break; } }
		const altEdge = inp.alt && !p.prevAlt;
		if (altEdge && !p.grenadeMode && activeWeapon(p).zoomFov) { p.scopeLevel = (p.scopeLevel + 1) % 3; p.scoped = p.scopeLevel > 0; }
		if (state.phase !== 'buy') {
			if (inp.reload) startReload(p);
			if (p.grenadeMode) { if (inp.fireEdge) throwGrenade(state, p, false); else if (altEdge) throwGrenade(state, p, true); }
			else if (!state.buyOpen) tryFire(state, p, inp.fire, inp.fireEdge);
		}
		p.prevAlt = inp.alt;
	}
	inp.reload = false; inp.slot = 0; inp.lastWeapon = false; inp.wheel = 0; inp.fireEdge = false;
}
