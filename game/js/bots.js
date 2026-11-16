// SALTLINE bots.js — bot brains (PLAN.md §9), running the same physics, weapons and economy as the player.
// States: followRoute → holdAngle → engage → investigate → plant / defuse / fetch. Team logic: buy rounds,
// attack plans, anchors and a rotator, callouts that rotate defenders, post-plant holds and retakes.
import { BOT, LINEUPS, ROUND } from './config.js';
import { rayAABB, smokeBlocks } from './math.js';
import { throwGrenade } from './grenades.js';
import { stepAgent, setCrouch } from './physics.js';
import { switchWeapon, activeWeapon, activeId, tryFire, maxSpeed, computeSpread } from './weapons.js';
import { buyItem } from './economy.js';
import { plantCharge, defuseCharge, siteAt } from './rounds.js';
import { feed } from './state.js';

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const D2 = (a, x, z) => (a.pos.x - x) ** 2 + (a.pos.z - z) ** 2;
const driven = (state, a) => a.isBot || (state.autoplay && a === state.player);
const MOVE = { x: 0, z: 0 };
const label = (name) => name.replace(/([a-z])([A-Z0-9])/g, '$1 $2');

export const createBrain = (skill) => ({ skill, state: 'idle', route: [], ri: 0, target: null, reactT: 0, err: 0, ex: 0, burst: 0, pause: 0, scanT: 0,
	pieT: 0, smoothT: 0, stuckT: 0, lastD: 1e9, detourT: 0, detour: 1, known: { x: 0, z: 0, t: -99 }, noiseT: 0, callT: -99, utilT: 0,
	usedUtil: false, fragT: -99, crouch: false, strafeT: 0, strafe: 1, hold: -1, lostT: 0, headAim: false, round: { retake: 0, post: 0, push: 0 } });

export function spawnBots(state, nav) {
	state.nav = nav;
	for (const a of state.agents) if (driven(state, a)) a.brain = createBrain(BOT[state.difficulty]);
}

// Team economy: full buy, force buy (after two losses or at match point) or save, announced on the radio.
function teamBuy(state, team) {
	const mates = state.agents.filter((a) => a.team === team && driven(state, a));
	if (!mates.length) return;
	const avg = mates.reduce((s, a) => s + a.money, 0) / mates.length, point = Math.max(state.score.strand, state.score.bastion) === ROUND.winRounds - 1;
	const mode = avg >= 3700 ? 'full' : avg >= 1900 && (state.lossStreak[team] >= 2 || point) ? 'force' : 'save';
	for (const b of mates) {
		const list = b.weapons[0] && mode !== 'save' ? ['armor'] : mode === 'full' ? [b.id % 4 === 3 ? 'longbow' : b.id % 2 ? 'gavel' : 'talon', 'helm', 'armor']
			: mode === 'force' ? [b.id % 3 ? 'hornet' : 'breaker', 'armor'] : b.money > 2400 ? ['mako'] : [];
		if (mode !== 'save') list.push('veil', 'shard', 'glare', 'cutters');
		for (const id of list) buyItem(state, b, id);
	}
	feed(state, `${team === 'strand' ? 'Strand' : 'Bastion'}: ${mode === 'save' ? 'saving this round' : `${mode} buy`}`);
}

const nearest = (state, x, z) => { let b = 0, bd = 1e9; state.nodes.forEach((n, i) => { const d = (n[1] - x) ** 2 + (n[2] - z) ** 2; if (d < bd) { bd = d; b = i; } }); return b; };
const holds = (state, flag) => state.nodes.flatMap((n, i) => ((n[4] & flag) && (n[4] & 1) ? [i] : []));
// A* legs between the named waypoints of a plan, starting from the bot's nearest node.
function setRoute(state, bot, names) {
	const br = bot.brain; let prev = nearest(state, bot.pos.x, bot.pos.z);
	br.route.length = 0; br.ri = 0;
	for (const name of names) {
		const idx = typeof name === 'number' ? name : state.nav.byName(name), leg = state.nav.findPath(prev, idx, state.nav._out);
		for (let i = leg.length ? 1 : 0; i < leg.length; i++) br.route.push(leg[i]);
		if (!leg.length) br.route.push(idx);
		prev = idx;
	}
	if (!br.route.length) br.route.push(prev);
}

// Round start: buys, a Strand plan (rush Pans, rush Boiler, split, default spread), Bastion anchors and a rotator.
export function onRoundStart(state) {
	teamBuy(state, 'strand'); teamBuy(state, 'bastion');
	const plan = ['rushPans', 'rushBoiler', 'split', 'spread'][Math.floor(state.rng() * 4)], routes = state.map.plans.strand[plan], h = state.map.plans.bastion;
	state.attackSite = plan === 'rushPans' ? 'pans' : plan === 'rushBoiler' ? 'boiler' : state.rng() < 0.5 ? 'pans' : 'boiler';
	const anchors = [...h.pans, ...h.boiler, h.rotator];
	let si = 0, bi = 0;
	for (const a of state.agents) {
		const br = a.brain;
		if (!br || !driven(state, a)) continue;
		Object.assign(br, { target: null, usedUtil: false, burst: 0, crouch: state.rng() < 0.35, hold: -1, state: 'followRoute' });
		br.known.t = -99;
		if (a.team === 'strand') setRoute(state, a, a.hasFuse ? routes[0] : routes[si++ % routes.length]);
		else { br.hold = state.nav.byName(anchors[bi++ % anchors.length]); setRoute(state, a, [br.hold]); }
	}
	feed(state, `Strand plan: ${{ rushPans: 'rush Pans', rushBoiler: 'rush Boiler', split: 'split', spread: 'default spread' }[plan]}`);
}

function blocked(state, ox, oy, oz, tx, ty, tz) {
	const dx = tx - ox, dy = ty - oy, dz = tz - oz, len = Math.hypot(dx, dy, dz);
	for (const b of state.boxes) { const t = rayAABB(ox, oy, oz, dx / len, dy / len, dz / len, b.min, b.max, len); if (t >= 0 && t < len - 0.3) return true; }
	return smokeBlocks(state.smokes, state.time, ox, oy, oz, tx, ty, tz);
}
// Sight: 110° field of view, 70 m, line of sight to head or chest through map boxes and Veil smoke, not while blind.
export function canSee(state, bot, t) {
	const dx = t.pos.x - bot.pos.x, dz = t.pos.z - bot.pos.z, d = Math.hypot(dx, dz), ey = bot.pos.y + bot.eyeHeight, ty = t.pos.y + t.eyeHeight;
	if (bot.flashT > 0.4 || d > 70 || d < 0.05 || (-Math.sin(bot.yaw) * dx - Math.cos(bot.yaw) * dz) / d < 0.57) return false;
	return !blocked(state, bot.pos.x, ey, bot.pos.z, t.pos.x, ty, t.pos.z) || !blocked(state, bot.pos.x, ey, bot.pos.z, t.pos.x, ty - 0.45, t.pos.z);
}

// Hearing: enemy shots, running steps, plants/defuses and grenades inside their radius update the last known position;
// a travelling or holding bot turns to investigate, and Strand runs back to a site where it hears a defuse.
export function onNoise(state, bot, n) {
	const br = bot.brain;
	if (n.team === bot.team || D2(bot, n.x, n.z) > n.r * n.r) return;
	br.known.x = n.x; br.known.z = n.z; br.known.t = state.time;
	if (n.kind === 2 && bot.team === 'strand' && state.phase === 'planted') { setRoute(state, bot, [nearest(state, n.x, n.z)]); br.state = 'followRoute'; }
	else if ((br.state === 'followRoute' && !bot.hasFuse) || (br.state === 'holdAngle' && n.kind === 1)) br.state = 'investigate';
}

// Callout: tell the team where the enemy is (nearest named waypoint); on a site call two off-site anchors rotate.
function callout(state, bot, enemy) {
	const br = bot.brain;
	if (state.time - br.callT < 6 || state.time - state.callT[bot.team] < 2.5) return;
	br.callT = state.callT[bot.team] = state.time;
	const node = state.nodes[nearest(state, enemy.pos.x, enemy.pos.z)], site = node[4] & 6;
	const seen = state.agents.filter((e) => e.alive && e.team !== bot.team && D2(e, enemy.pos.x, enemy.pos.z) < 100).length;
	feed(state, `${bot.name}: ${seen > 1 ? `${seen} ` : ''}contact ${label(node[0])}`);
	let moved = 0;
	for (const m of state.agents) {
		if (!m.brain || !m.alive || m.team !== bot.team || m === bot || !driven(state, m)) continue;
		Object.assign(m.brain.known, { x: enemy.pos.x, z: enemy.pos.z, t: state.time });
		const mine = m.brain.hold >= 0 ? state.nodes[m.brain.hold][4] & 6 : 0;
		if (m.team === 'bastion' && site && seen > 1 && mine !== site && moved < 2 && m.brain.state !== 'engage') {
			m.brain.hold = holds(state, site)[moved++ % 2]; setRoute(state, m, [m.brain.hold]); m.brain.state = 'followRoute';
		}
	}
	if (moved) feed(state, `${bot.name}: rotating ${moved} to ${site === 2 ? 'Pans' : 'Boiler'}`);
}

function aimAt(bot, tx, ty, tz, dt, rate) {
	const dx = tx - bot.pos.x, dz = tz - bot.pos.z, k = 1 - Math.exp(-rate * dt);
	const yaw = wrap(Math.atan2(-dx, -dz) - bot.recoil.yaw - bot.yaw), pitch = Math.atan2(ty - bot.pos.y - bot.eyeHeight, Math.hypot(dx, dz)) - bot.recoil.pitch - bot.pitch;
	bot.yaw += yaw * k; bot.pitch += pitch * k;
	return Math.abs(yaw) + Math.abs(pitch);
}
// Steering with stuck detection: after 1.2 s without progress the bot sidesteps for 0.9 s.
function steer(state, bot, tx, tz, dt) {
	const br = bot.brain, dx = tx - bot.pos.x, dz = tz - bot.pos.z, d = Math.hypot(dx, dz) || 1e-3;
	if (d < br.lastD - 0.05) { br.lastD = d; br.stuckT = 0; } else if ((br.stuckT += dt) > 1.2 && br.detourT <= 0) { br.detourT = 0.9; br.detour = -br.detour; br.lastD = 1e9; br.stuckT = 0; }
	let side = 0;
	if (br.detourT > 0) { br.detourT -= dt; side = br.detour; }
	MOVE.x = (dx * (side ? 0.4 : 1) - dz * side) / d; MOVE.z = (dz * (side ? 0.4 : 1) + dx * side) / d;
	bot.yaw += Math.max(-7 * dt, Math.min(7 * dt, wrap(Math.atan2(-MOVE.x, -MOVE.z) - bot.yaw)));
	return d;
}
function walkClear(state, x0, z0, x1, z1) {
	const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz);
	for (const b of state.boxes) if (b.max.y > 0.45 && b.min.y < 1.4) for (const y of [0.5, 1.3]) if (y > b.min.y && y < b.max.y && rayAABB(x0, y, z0, dx / len, 0, dz / len, b.min, b.max, len) >= 0) return false;
	return true;
}
// Route following: skips ahead to the farthest visible waypoint and slows down at corners flagged for holding.
function followRoute(state, bot, dt) {
	const br = bot.brain;
	if (br.ri >= br.route.length) return false;
	if ((br.smoothT -= dt) <= 0) {
		br.smoothT = 0.4;
		for (let j = Math.min(br.route.length - 1, br.ri + 4); j > br.ri; j--) { const n = state.nodes[br.route[j]]; if (Math.abs(n[3] - bot.pos.y) < 0.4 && walkClear(state, bot.pos.x, bot.pos.z, n[1], n[2])) { br.ri = j; break; } }
	}
	const n = state.nodes[br.route[br.ri]];
	if (steer(state, bot, n[1], n[2], dt) < 0.7) { if (n[4] & 1) br.pieT = 0.8; br.ri++; br.lastD = 1e9; }
	return true;
}

// Perception every 2 ticks (hearing, then sight with a reaction delay that grows with distance), then objectives.
function think(state, bot, dt) {
	const br = bot.brain, f = state.fuse, R = br.round, rnd = state.round;
	if ((br.scanT -= dt) <= 0) {
		br.scanT = 2 / 64;
		for (const n of state.noise) if (n.t > br.noiseT) onNoise(state, bot, n);
		br.noiseT = state.time;
		let best = null, bd = 1e9;
		for (const e of state.agents) if (e.alive && e.team !== bot.team) { const d = D2(e, bot.pos.x, bot.pos.z); if (d < bd && canSee(state, bot, e)) { bd = d; best = e; } }
		if (best) {
			if (br.target !== best) {
				const sk = br.skill, dist = Math.sqrt(bd);
				br.reactT = (sk.react[0] + state.rng() * (sk.react[1] - sk.react[0])) * (best.crouch > 0.5 ? 1.25 : 1) * (1 + dist / 80);
				br.err = sk.aimErr * (1.5 + dist / 25); br.ex = state.rng() * 6.28; br.target = best; callout(state, bot, best);
			}
			Object.assign(br.known, { x: best.pos.x, z: best.pos.z, t: state.time }); br.lostT = 0; br.state = 'engage';
		} else if (br.state === 'engage' && (br.lostT += 2 / 64) > 0.7) { br.target = null; br.state = 'investigate'; }
	}
	if (br.state === 'engage' || bot.flashT > 0.4) return;
	const goSite = (name) => { setRoute(state, bot, [name]); br.state = 'followRoute'; };
	if (state.phase === 'planted') {
		if (bot.team === 'bastion') {
			let first = null, nd = 1e9, mates = 0;
			for (const m of state.agents) if (m.alive && m.team === 'bastion') { mates++; const d = D2(m, f.x, f.z); if (d < nd) { nd = d; first = m; } }
			if (R.retake !== rnd && (mates >= 2 || state.roundT < 18 || D2(bot, f.x, f.z) < 400)) { R.retake = rnd; br.hold = -1; goSite(nearest(state, f.x, f.z)); }
			if (R.retake === rnd && first === bot && br.state !== 'defuse' && D2(bot, f.x, f.z) < 100) { goSite(nearest(state, f.x, f.z)); br.state = 'defuse'; }
		} else if (R.post !== rnd) { R.post = rnd; const h = holds(state, f.site === 'pans' ? 2 : 4); br.hold = h[bot.id % h.length]; goSite(br.hold); }
	} else if (bot.team === 'strand') {
		if (f.dropped && br.state !== 'fetch') {
			let first = null, nd = 1e9;
			for (const m of state.agents) if (m.alive && m.team === 'strand' && m.brain && driven(state, m)) { const d = D2(m, f.x, f.z); if (d < nd) { nd = d; first = m; } }
			if (first === bot) { goSite(nearest(state, f.x, f.z)); br.state = 'fetch'; }
		}
		if (bot.hasFuse && siteAt(state, bot.pos.x, bot.pos.z)) br.state = 'plant';
		else if (bot.hasFuse && br.state !== 'followRoute') goSite(state.attackSite === 'pans' ? 'PansCenter' : 'BoilerCenter');
		if (state.phase === 'live' && state.roundT < ROUND.liveTime - 40 && R.push !== rnd && !bot.hasFuse) { R.push = rnd; goSite(state.attackSite === 'pans' ? 'PansFront' : 'BoilerHall'); }
	}
}

// Utility: Strand smokes the site entrance from fixed lineups; anyone throws a Shard or Glare at a fresh last-known spot.
function utility(state, bot, dt) {
	const br = bot.brain, k = br.known;
	if ((br.utilT -= dt) > 0) return;
	br.utilT = 0.5;
	if (!br.usedUtil && bot.team === 'strand' && br.state === 'followRoute') for (const [node, kind, tx, tz] of LINEUPS) {
		const n = state.nodes[state.nav.byName(node)];
		if (bot.nades[kind] > 0 && D2(bot, n[1], n[2]) < 36) { bot.nadeSel = kind; if (throwGrenade(state, bot, false, tx, 1.2, tz)) { br.usedUtil = true; feed(state, `${bot.name}: Veil out`); return; } }
	}
	const d = D2(bot, k.x, k.z), id = bot.nades.shard ? 'shard' : bot.nades.glare ? 'glare' : null;
	if (id && !br.target && state.time - k.t < 3 && state.time - br.fragT > 9 && d < 600 && d > 36) {
		bot.nadeSel = id; if (throwGrenade(state, bot, false, k.x, 1, k.z)) { br.fragT = state.time; feed(state, `${bot.name}: ${id === 'shard' ? 'Shard' : 'Glare'} out`); }
	}
}

// One tick of a bot (or of the player in autoplay): think, then move and shoot through the shared systems.
// In a fight the bot stops (or strafes with an SMG/shotgun up close) before firing bursts, because computeSpread
// punishes moving shots for bots exactly as for the player.
export function driveAgent(state, bot, dt) {
	const br = bot.brain;
	if (!bot.alive) return;
	if (state.phase !== 'live' && state.phase !== 'planted') { setCrouch(state, bot, false, dt); stepAgent(state, bot, 0, 0, 0, false, dt); return; }
	think(state, bot, dt); utility(state, bot, dt);
	const w = activeWeapon(bot), run = maxSpeed(bot), f = state.fuse;
	let mx = 0, mz = 0, speed = 0, crouch = false, fire = false;
	const go = (k) => { mx = MOVE.x; mz = MOVE.z; speed = run * k; };
	if (bot.flashT > 0.4) { mx = bot.pos.x - br.known.x; mz = bot.pos.z - br.known.z; speed = run * 0.6; bot.yaw += Math.sin(state.time * 3 + bot.id) * dt; }
	else if (br.state === 'engage' && br.target && br.target.alive) {
		const t = br.target, dist = Math.sqrt(D2(bot, t.pos.x, t.pos.z)), sk = br.skill;
		br.err *= Math.exp(-1.4 * dt);
		const off = br.err * dist, miss = aimAt(bot, t.pos.x + Math.cos(br.ex) * off, t.pos.y + t.eyeHeight - (br.headAim ? 0 : 0.38) + Math.sin(br.ex) * off * 0.6, t.pos.z + Math.sin(br.ex) * off, dt, 10);
		const close = dist < 11 && (w.cls === 'smg' || w.cls === 'shotgun' || w.cls === 'knife');
		if (w.cls === 'knife') { mx = t.pos.x - bot.pos.x; mz = t.pos.z - bot.pos.z; speed = run; }
		else if (close) { if ((br.strafeT -= dt) <= 0) { br.strafeT = 0.35 + state.rng() * 0.5; br.strafe = -br.strafe; } mx = Math.cos(bot.yaw) * br.strafe; mz = -Math.sin(bot.yaw) * br.strafe; speed = run * 0.8; }
		crouch = br.crouch && dist > 12 && w.cls !== 'marksman';
		if ((br.reactT -= dt) <= 0 && miss < 0.06 + computeSpread(bot) * 2) {
			if (br.burst <= 0 && (br.pause -= dt) <= 0) { br.burst = dist < 9 ? 10 : sk.burst[0] + Math.floor(state.rng() * (sk.burst[1] - sk.burst[0] + 1)); br.headAim = state.rng() < sk.head; }
			if (br.burst > 0 && (close || Math.hypot(bot.vel.x, bot.vel.z) < run * 0.3)) { fire = true; if (state.time >= bot.nextFireT && --br.burst === 0) br.pause = 0.25 + state.rng() * 0.3; }
		}
	} else if (br.state === 'investigate') {
		const k = br.known, back = br.hold >= 0 ? 'holdAngle' : 'followRoute';
		if (state.time - k.t > 7 || steer(state, bot, k.x, k.z, dt) <= 2.5) br.state = back;
		else { go(0.52); aimAt(bot, k.x, bot.pos.y + 1.5, k.z, dt, 3); }
	} else if (br.state === 'plant') {
		if (!siteAt(state, bot.pos.x, bot.pos.z)) br.state = 'followRoute';
		else { plantCharge(state, bot, dt); crouch = bot.plantT > 0; }
	} else if (br.state === 'defuse' && f.planted) {
		if (D2(bot, f.x, f.z) > 1.2) { if (!followRoute(state, bot, dt)) steer(state, bot, f.x, f.z, dt); go(1); }
		else { defuseCharge(state, bot, dt); crouch = true; }
	} else if (followRoute(state, bot, dt)) { go(br.pieT > 0 ? 0.5 : 1); br.pieT -= dt; }
	else if (br.state === 'fetch') { steer(state, bot, f.x, f.z, dt); go(1); if (!f.dropped) br.state = 'followRoute'; }
	else if (br.hold >= 0) {
		const n = state.nodes[br.hold], yaw = (n[5] ?? 0) * Math.PI / 180 + Math.sin(state.time * 0.5 + bot.id) * 0.5;
		br.state = 'holdAngle'; crouch = br.crouch;
		aimAt(bot, bot.pos.x - Math.sin(yaw), bot.pos.y + bot.eyeHeight, bot.pos.z - Math.cos(yaw), dt, 3);
	} else if (bot.team === 'strand') { const h = holds(state, state.attackSite === 'pans' ? 2 : 4); br.hold = h[bot.id % h.length]; setRoute(state, bot, [br.hold]); }
	setCrouch(state, bot, crouch, dt);
	const len = Math.hypot(mx, mz) || 1;
	stepAgent(state, bot, mx / len, mz / len, speed, false, dt);
	for (const o of state.agents) {
		const dx = bot.pos.x - o.pos.x, dz = bot.pos.z - o.pos.z, d2 = dx * dx + dz * dz;
		if (o !== bot && o.alive && d2 < 0.5 && d2 > 1e-6) { const k = 2.5 * dt / Math.sqrt(d2); bot.pos.x += dx * k; bot.pos.z += dz * k; }
	}
	const am = bot.ammo[activeId(bot)];
	if (am && am.mag === 0 && am.reserve === 0) switchWeapon(bot, bot.weapons[1] ? 1 : 2);
	if (fire) tryFire(state, bot, true, true);
}

export function updateBots(state, dt) { for (const a of state.agents) if (a.isBot) driveAgent(state, a, dt); }
