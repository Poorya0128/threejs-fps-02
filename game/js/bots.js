// Bot brains (PLAN.md §9) on the shared physics, weapons and economy.
import { BOT, ROUND } from './config.js';
import { losBlocked, smokeBlocks } from './math.js';
import { throwGrenade } from './grenades.js';
import { stepAgent, setCrouch } from './physics.js';
import { switchWeapon, activeWeapon, activeId, tryFire, maxSpeed, computeSpread } from './weapons.js';
import { buyItem } from './economy.js';
import { plantCharge, defuseCharge, siteAt } from './rounds.js';
import { feed } from './state.js';
import { nearestNode, callName } from './nav.js';

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const D2 = (a, x, z) => (a.pos.x - x) ** 2 + (a.pos.z - z) ** 2;
const driven = (state, a) => a.isBot || (state.autoplay && a === state.player);
const known = (br, x, z, t) => { br.known.x = x; br.known.z = z; br.known.t = t; };
const holds = (state, flag) => state.nodes.flatMap((n, i) => ((n[4] & flag) && (n[4] & 1) ? [i] : []));
const SITE = { pans: 2, boiler: 4 }, MOVE = { x: 0, z: 0 }, UTIL = ['shard', 'veil'];

const createBrain = (skill) => ({ skill, state: 'idle', route: [], ri: 0, target: null, reactT: 0, err: 0, ex: 0, burst: 0, pause: 0, headAim: false,
	scanT: 0, lostT: 0, noiseT: 0, pieT: 0, smoothT: 0, stuckT: 0, lastD: 1e9, detourT: 0, detour: 1, crouch: false, hold: -1,
	known: { x: 0, z: 0, t: -99 }, callT: -99, utilT: 0, fragT: -99, retake: 0, post: 0, push: 0 });
export function spawnBots(state, nav) {
	state.nav = nav;
	for (const a of state.agents) if (driven(state, a)) a.brain = createBrain(BOT);
}

function teamBuy(state, team) {
	const mates = state.agents.filter((a) => a.team === team && driven(state, a));
	if (!mates.length) return;
	const avg = mates.reduce((s, a) => s + a.money, 0) / mates.length, point = Math.max(state.score.strand, state.score.bastion) === ROUND.winRounds - 1;
	const mode = avg >= 3700 ? 'full' : avg >= 1900 && (state.lossStreak[team] >= 2 || point) ? 'force' : 'save';
	for (const b of mates) {
		const gun = b.weapons[0] ? [] : mode === 'full' ? [['talon', 'gavel', 'talon', 'longbow'][b.id % 4], 'helm'] : ['hornet'];
		if (mode !== 'save') for (const id of [...gun, 'armor', 'veil', 'shard']) buyItem(state, b, id);
	}
}

function goTo(state, bot, points, mode = 'followRoute') {
	const br = bot.brain;
	let prev = nearestNode(state.nodes, bot.pos.x, bot.pos.z);
	br.route.length = br.ri = 0; br.state = mode;
	for (const pt of Array.isArray(points) ? points : [points]) {
		const idx = typeof pt === 'number' ? pt : state.nav.byName(pt), leg = state.nav.findPath(prev, idx);
		if (leg.length) for (let i = 1; i < leg.length; i++) br.route.push(leg[i]); else br.route.push(idx);
		prev = idx;
	}
	if (!br.route.length) br.route.push(prev);
}

export function onRoundStart(state) {
	teamBuy(state, 'strand'); teamBuy(state, 'bastion');
	const { strand, bastion } = state.map.plans, plan = Object.keys(strand)[Math.floor(state.rng() * 4)], routes = strand[plan];
	state.attackSite = /Pans/.test(plan) ? 'pans' : /Boiler/.test(plan) ? 'boiler' : state.rng() < .5 ? 'pans' : 'boiler';
	const anchors = [...bastion.pans, ...bastion.boiler, bastion.rotator];
	let si = 0, bi = 0;
	for (const a of state.agents) {
		const br = a.brain;
		if (!br || !driven(state, a)) continue;
		Object.assign(br, { target: null, burst: 0, crouch: state.rng() < .35, hold: -1 });
		br.known.t = -99;
		if (a.team === 'strand') goTo(state, a, a.hasFuse ? routes[0] : routes[si++ % routes.length]);
		else goTo(state, a, br.hold = state.nav.byName(anchors[bi++ % anchors.length]));
	}
	feed(state, `Strand plan: ${callName(plan)}`);
}

const blocked = (state, b, ey, t, ty) => losBlocked(state.boxes, b.pos.x, ey, b.pos.z, t.pos.x, ty, t.pos.z, .3) || smokeBlocks(state.smokes, b.pos.x, ey, b.pos.z, t.pos.x, ty, t.pos.z);
function canSee(state, bot, t) {
	const dx = t.pos.x - bot.pos.x, dz = t.pos.z - bot.pos.z, d = Math.hypot(dx, dz), ey = bot.pos.y + bot.eyeHeight, ty = t.pos.y + t.eyeHeight;
	if (d > 70 || d < .05 || (-Math.sin(bot.yaw) * dx - Math.cos(bot.yaw) * dz) / d < .57) return false;
	return !blocked(state, bot, ey, t, ty) || !blocked(state, bot, ey, t, ty - .45);
}

function onNoise(state, bot, n) {
	const br = bot.brain;
	if (n.team === bot.team || D2(bot, n.x, n.z) > n.r * n.r) return;
	known(br, n.x, n.z, state.time);
	if (n.kind === 2 && bot.team === 'strand' && state.phase === 'planted') goTo(state, bot, nearestNode(state.nodes, n.x, n.z));
	else if ((br.state === 'followRoute' && !bot.hasFuse) || (br.state === 'holdAngle' && n.kind === 1)) br.state = 'investigate';
}

// Callout: the team learns where the enemy is; a Bastion anchor off that site rotates to it.
function callout(state, bot, enemy) {
	const t = state.time, e = enemy.pos;
	if (t - bot.brain.callT < 6 || t - state.callT[bot.team] < 2.5) return;
	bot.brain.callT = state.callT[bot.team] = t;
	const node = state.nodes[nearestNode(state.nodes, e.x, e.z)], site = node[4] & 6;
	let moved = !site || bot.team !== 'bastion';
	feed(state, `${bot.name}: contact ${callName(node[0])}`);
	for (const m of state.agents) {
		const mb = m.brain;
		if (!mb || !m.alive || m.team !== bot.team || m === bot || !driven(state, m)) continue;
		known(mb, e.x, e.z, t);
		if (!moved && mb.state !== 'engage' && mb.hold >= 0 && !(state.nodes[mb.hold][4] & site)) { moved = true; goTo(state, m, mb.hold = holds(state, site)[0]); }
	}
}

function closest(state, team, x, z) {
	let best = null, bd = 1e9;
	for (const a of state.agents) if (a.alive && a.team === team && a.brain && driven(state, a) && D2(a, x, z) < bd) { bd = D2(a, x, z); best = a; }
	return best;
}

function aimAt(bot, tx, ty, tz, dt, rate) {
	const dx = tx - bot.pos.x, dz = tz - bot.pos.z, k = 1 - Math.exp(-rate * dt);
	const yaw = wrap(Math.atan2(-dx, -dz) - bot.recoil.yaw - bot.yaw), pitch = Math.atan2(ty - bot.pos.y - bot.eyeHeight, Math.hypot(dx, dz)) - bot.recoil.pitch - bot.pitch;
	bot.yaw += yaw * k; bot.pitch += pitch * k;
	return Math.abs(yaw) + Math.abs(pitch);
}
function steer(bot, tx, tz, dt) {
	const br = bot.brain, dx = tx - bot.pos.x, dz = tz - bot.pos.z, d = Math.hypot(dx, dz) || 1e-3;
	if (d < br.lastD - .05) { br.lastD = d; br.stuckT = 0; }
	else if ((br.stuckT += dt) > 1.2 && br.detourT <= 0) { br.detourT = .9; br.detour = -br.detour; br.lastD = 1e9; br.stuckT = 0; }
	const side = (br.detourT -= dt) > 0 ? br.detour : 0, k = side ? .4 : 1;
	MOVE.x = (dx * k - dz * side) / d; MOVE.z = (dz * k + dx * side) / d;
	bot.yaw += Math.max(-7 * dt, Math.min(7 * dt, wrap(Math.atan2(-MOVE.x, -MOVE.z) - bot.yaw)));
	return d;
}
function followRoute(state, bot, dt) {
	const br = bot.brain, p = bot.pos;
	if (br.ri >= br.route.length) return false;
	if ((br.smoothT -= dt) <= 0) {
		br.smoothT = .4;
		for (let j = Math.min(br.route.length - 1, br.ri + 4); j > br.ri; j--) {
			const n = state.nodes[br.route[j]];
			if (Math.abs(n[3] - p.y) < .4 && !losBlocked(state.boxes, p.x, p.y + .5, p.z, n[1], n[3] + .5, n[2], 0) && !losBlocked(state.boxes, p.x, p.y + 1.3, p.z, n[1], n[3] + 1.3, n[2], 0)) { br.ri = j; break; }
		}
	}
	const n = state.nodes[br.route[br.ri]];
	if (steer(bot, n[1], n[2], dt) < .7) { if (n[4] & 1) br.pieT = .8; br.ri++; br.lastD = 1e9; }
	return true;
}

// Perception every 2 ticks (reaction delay grows with distance), then objectives.
function think(state, bot, dt) {
	const br = bot.brain, f = state.fuse, rnd = state.round;
	if ((br.scanT -= dt) <= 0) {
		br.scanT = 2 / 64;
		for (const n of state.noise) if (n.t > br.noiseT) onNoise(state, bot, n);
		br.noiseT = state.time;
		let best = null, bd = 1e9;
		for (const e of state.agents) if (e.alive && e.team !== bot.team && D2(e, bot.pos.x, bot.pos.z) < bd && canSee(state, bot, e)) { bd = D2(e, bot.pos.x, bot.pos.z); best = e; }
		if (best && br.target !== best) {
			const sk = br.skill, dist = Math.sqrt(bd);
			br.reactT = (sk.react[0] + state.rng() * (sk.react[1] - sk.react[0])) * (best.crouch > .5 ? 1.25 : 1) * (1 + dist / 80);
			br.err = sk.aimErr * (1.5 + dist / 25); br.ex = state.rng() * 6.28; br.target = best; callout(state, bot, best);
		}
		if (best) { known(br, best.pos.x, best.pos.z, state.time); br.lostT = 0; br.state = 'engage'; }
		else if (br.state === 'engage' && (br.lostT += 2 / 64) > .7) { br.target = null; br.state = 'investigate'; }
	}
	if (br.state === 'engage') return;
	const atk = state.attackSite === 'pans';
	if (state.phase === 'planted') {
		const fuseNode = nearestNode(state.nodes, f.x, f.z);
		if (bot.team === 'bastion') {
			let mates = 0;
			for (const m of state.agents) mates += m.alive && m.team === 'bastion';
			if (br.retake !== rnd && (mates >= 2 || state.roundT < 18 || D2(bot, f.x, f.z) < 400)) { br.retake = rnd; br.hold = -1; goTo(state, bot, fuseNode); }
			if (br.retake === rnd && br.state !== 'defuse' && D2(bot, f.x, f.z) < 100 && closest(state, 'bastion', f.x, f.z) === bot) goTo(state, bot, fuseNode, 'defuse');
		} else if (br.post !== rnd) { br.post = rnd; const h = holds(state, SITE[f.site]); goTo(state, bot, br.hold = h[bot.id % h.length]); }
	} else if (bot.team === 'strand') {
		if (f.dropped && br.state !== 'fetch' && closest(state, 'strand', f.x, f.z) === bot) goTo(state, bot, nearestNode(state.nodes, f.x, f.z), 'fetch');
		if (bot.hasFuse && siteAt(state, bot.pos.x, bot.pos.z)) br.state = 'plant';
		else if (bot.hasFuse && br.state !== 'followRoute') goTo(state, bot, atk ? 'PansCenter' : 'BoilerCenter');
		if (state.phase === 'live' && state.roundT < ROUND.liveTime - 40 && br.push !== rnd && !bot.hasFuse) { br.push = rnd; goTo(state, bot, atk ? 'PansFront' : 'BoilerHall'); }
	}
}

function utility(state, bot, dt) {
	const br = bot.brain, k = br.known, d = D2(bot, k.x, k.z);
	if ((br.utilT -= dt) > 0) return;
	br.utilT = .5;
	let id = null;
	for (const n of UTIL) if (bot.nades[n]) { id = n; break; }
	if (id && !br.target && state.time - k.t < 3 && state.time - br.fragT > 9 && d < 600 && d > 36) { bot.nadeSel = id; if (throwGrenade(state, bot, false, k.x, 1, k.z)) br.fragT = state.time; }
}

// One tick of a bot (or the autoplay player) through the shared systems. It stops to fire, as computeSpread punishes
// moving shots, except with an SMG up close.
export function driveAgent(state, bot, dt) {
	const br = bot.brain, f = state.fuse, w = activeWeapon(bot), run = maxSpeed(bot), am = bot.ammo[activeId(bot)];
	if (!bot.alive) return;
	let mx = 0, mz = 0, speed = 0, gait = 0, crouch = false, fire = false;
	if (state.phase === 'live' || state.phase === 'planted') {
		think(state, bot, dt); utility(state, bot, dt);
		if (br.state === 'engage' && br.target?.alive) {
			const t = br.target, dist = Math.sqrt(D2(bot, t.pos.x, t.pos.z)), sk = br.skill, off = (br.err *= Math.exp(-1.4 * dt)) * dist;
			const miss = aimAt(bot, t.pos.x + Math.cos(br.ex) * off, t.pos.y + t.eyeHeight - (br.headAim ? 0 : .38) + Math.sin(br.ex) * off * .6, t.pos.z + Math.sin(br.ex) * off, dt, 10);
			const close = dist < 11 && w.cls === 'smg';
			crouch = br.crouch && dist > 12 && w.cls !== 'marksman';
			if ((br.reactT -= dt) <= 0 && miss < .06 + computeSpread(bot) * 2) {
				if (br.burst <= 0 && (br.pause -= dt) <= 0) { br.burst = dist < 9 ? 10 : sk.burst[0] + Math.floor(state.rng() * (sk.burst[1] - sk.burst[0] + 1)); br.headAim = state.rng() < sk.head; }
				if (br.burst > 0 && (close || bot.speed < run * .3)) { fire = true; if (state.time >= bot.nextFireT && --br.burst === 0) br.pause = .25 + state.rng() * .3; }
			}
		} else if (br.state === 'investigate') {
			if (state.time - br.known.t > 7 || steer(bot, br.known.x, br.known.z, dt) <= 2.5) br.state = br.hold >= 0 ? 'holdAngle' : 'followRoute';
			else { gait = .52; aimAt(bot, br.known.x, bot.pos.y + 1.5, br.known.z, dt, 3); }
		} else if (br.state === 'plant') {
			if (siteAt(state, bot.pos.x, bot.pos.z)) { plantCharge(state, bot, dt); crouch = bot.plantT > 0; } else br.state = 'followRoute';
		} else if (br.state === 'defuse' && f.planted) {
			if (D2(bot, f.x, f.z) < 1.2) { defuseCharge(state, bot, dt); crouch = true; }
			else { if (!followRoute(state, bot, dt)) steer(bot, f.x, f.z, dt); gait = 1; }
		} else if (followRoute(state, bot, dt)) { gait = br.pieT > 0 ? .5 : 1; br.pieT -= dt; }
		else if (br.state === 'fetch') { steer(bot, f.x, f.z, dt); gait = 1; if (!f.dropped) br.state = 'followRoute'; }
		else if (br.hold >= 0) {
			const n = state.nodes[br.hold], watch = f.planted && bot.team === 'strand'; // after the plant, Strand watches the Fuse
			const yaw = (watch ? Math.atan2(bot.pos.x - f.x, bot.pos.z - f.z) : (n[5] ?? 0) * Math.PI / 180) + Math.sin(state.time * .5 + bot.id) * .5;
			br.state = 'holdAngle'; crouch = br.crouch || watch;
			aimAt(bot, bot.pos.x - Math.sin(yaw), bot.pos.y + bot.eyeHeight, bot.pos.z - Math.cos(yaw), dt, 3);
		} else if (bot.team === 'strand') { const h = holds(state, SITE[state.attackSite]); goTo(state, bot, br.hold = h[bot.id % h.length]); }
	}
	if (gait) { mx = MOVE.x; mz = MOVE.z; speed = run * gait; }
	const len = Math.hypot(mx, mz) || 1;
	setCrouch(state, bot, crouch, dt);
	stepAgent(state, bot, mx / len, mz / len, speed, false, dt);
	for (const o of state.agents) {
		const dx = bot.pos.x - o.pos.x, dz = bot.pos.z - o.pos.z, d2 = dx * dx + dz * dz, k = 2.5 * dt / Math.sqrt(d2);
		if (o !== bot && o.alive && d2 < .5 && d2 > 1e-6) { bot.pos.x += dx * k; bot.pos.z += dz * k; }
	}
	if (am.mag + am.reserve === 0) switchWeapon(bot, 1);
	if (fire) tryFire(state, bot, true, true);
}

export function updateBots(state, dt) { for (const a of state.agents) if (a.isBot) driveAgent(state, a, dt); }
