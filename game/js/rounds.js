// SALTLINE rounds.js — round phase machine (buy → live → planted → post → next | matchEnd), win checks,
// Fuse carry / drop / pick-up, plantCharge and defuseCharge, side swap at half time, spectating.
import { ROUND, ECON, WEAPONS } from './config.js';
import { awardRoundMoney } from './economy.js';
import { pushNoise, feed } from './state.js';
import { giveWeapon } from './weapons.js';

export const banner = (state, text, sub = '') => { state.banner = { text, sub, t: state.time }; };
const alive = (state, team) => { let n = 0; for (const a of state.agents) if (a.alive && a.team === team) n++; return n; };
const SPAWN_OFF = [[0,0], [-1.5,2], [-1.5,-2], [1.5,2.5], [1.5,-2.5]];

function resetAgents(state) {
	const n = { strand: 0, bastion: 0 };
	for (const a of state.agents) {
		const sp = state.map.spawns[a.team], o = SPAWN_OFF[n[a.team]++ % 5], sx = a.team === 'strand' ? 1 : -1;
		if (!a.alive) { a.weapons.length = 0; a.armor = 0; a.helm = false; a.hasCutters = false; a.nades.shard = a.nades.veil = a.nades.glare = 0; giveWeapon(a, 'cutlass'); giveWeapon(a, 'wren'); }
		a.pos.set(sp[0] + o[0] * sx, 0, sp[1] + o[1]); a.prevPos.copy(a.pos); a.vel.set(0,0,0);
		a.yaw = a.team === 'strand' ? -Math.PI / 2 : Math.PI / 2; a.pitch = 0;
		Object.assign(a, { alive: true, hp: 100, roundKills: 0, crouch: 0, flashT: 0, plantT: 0, defuseT: 0, spreadBloom: 0, shotsFired: 0, reloadT: 0, reloadShell: 0, scoped: false, scopeLevel: 0, grenadeMode: false, hasFuse: false });
		a.recoil.pitch = a.recoil.yaw = 0;
		a.active = a.weapons[0] ? 0 : 1;
		for (const id of a.weapons) if (id) a.ammo[id] = { mag: WEAPONS[id].mag, reserve: WEAPONS[id].reserve };
	}
}

export function startRound(state) {
	if (state.round === ROUND.swapAfter + 1 && !state.swapped) {
		state.swapped = true;
		for (const a of state.agents) { a.team = a.team === 'strand' ? 'bastion' : 'strand'; a.money = ECON.start; a.alive = false; a.name = a.isBot ? `${a.team === 'strand' ? 'Strand' : 'Bastion'}-${a.id}` : 'You'; }
		const s = state.score.strand; state.score.strand = state.score.bastion; state.score.bastion = s;
		state.lossStreak.strand = state.lossStreak.bastion = 0;
		feed(state, 'Half time: teams swap sides');
	}
	resetAgents(state);
	const pool = state.agents.filter((a) => a.team === 'strand');
	const carrier = pool[Math.floor(state.rng() * pool.length)];
	carrier.hasFuse = true;
	Object.assign(state.fuse, { carrier, site: null, planted: false, dropped: false, x: 0, z: 0 });
	state.phase = 'buy'; state.roundT = ROUND.buyTime; state.spectateIdx = -1; state.newRound = true;
	state.buyOpen = !state.autoplay;
	banner(state, `ROUND ${state.round}`, 'BUY PHASE — B TO TOGGLE THE MENU');
}

function endRound(state, winner, reason) {
	awardRoundMoney(state, winner, reason);
	state.score[winner]++; state.roundsPlayed++; state.lastWinReason = reason;
	const text = { elimination: `${winner.toUpperCase()} CLEARS THE FIELD`, time: 'BASTION HOLDS THE LINE', detonation: 'THE FUSE DETONATES', defuse: 'FUSE CUT — BASTION WINS' }[reason];
	let mvp = null;
	for (const a of state.agents) if (a.team === winner && (!mvp || a.roundKills > mvp.roundKills)) mvp = a;
	state.mvp = mvp;
	banner(state, text, `${winner === 'strand' ? 'STRAND' : 'BASTION'} TAKES ROUND ${state.round}${mvp && mvp.roundKills ? ` · MVP ${mvp.name.toUpperCase()} (${mvp.roundKills})` : ''}`);
	state.phase = 'post'; state.roundT = ROUND.postTime; state.buyOpen = false;
}

// Fuse carry: a dead carrier drops it where they fell; any living Strand agent walking over it picks it up.
function updateFuse(state) {
	const f = state.fuse;
	if (f.planted) return;
	if (f.carrier && !f.carrier.alive) {
		f.dropped = true; f.x = f.carrier.pos.x; f.z = f.carrier.pos.z; f.carrier.hasFuse = false; f.carrier = null;
		feed(state, 'The Fuse is down');
	}
	if (!f.dropped) return;
	for (const a of state.agents) if (a.alive && a.team === 'strand' && Math.hypot(a.pos.x - f.x, a.pos.z - f.z) < 1.1) {
		f.dropped = false; f.carrier = a; a.hasFuse = true; feed(state, `${a.name} picked up the Fuse`); return;
	}
}

export function updateRounds(state, dt) {
	if (state.matchOver) return;
	state.roundT -= dt;
	const s = alive(state, 'strand'), b = alive(state, 'bastion');
	if (state.phase === 'buy') {
		if (state.roundT <= 0) { state.phase = 'live'; state.roundT = ROUND.liveTime; state.buyOpen = false; banner(state, 'GO', ''); }
	} else if (state.phase === 'live') {
		updateFuse(state);
		if (b === 0) endRound(state, 'strand', 'elimination');
		else if (s === 0) endRound(state, 'bastion', 'elimination');
		else if (state.roundT <= 0) endRound(state, 'bastion', 'time');
	} else if (state.phase === 'planted') {
		if (b === 0) endRound(state, 'strand', 'elimination');
		else if (state.roundT <= 0) endRound(state, 'strand', 'detonation');
	} else if (state.phase === 'post' && state.roundT <= 0) {
		if (state.score.strand >= ROUND.winRounds || state.score.bastion >= ROUND.winRounds) {
			state.matchOver = true; state.phase = 'matchEnd';
			banner(state, state.score.strand > state.score.bastion ? 'STRAND WINS THE MATCH' : 'BASTION WINS THE MATCH', `${state.score.strand} — ${state.score.bastion}`);
		} else { state.round++; startRound(state); }
	}
}

export function siteAt(state, x, z) {
	const { sitePans: p, siteBoiler: q } = state.zones;
	return Math.hypot(x - p.cx, z - p.cz) < p.r ? 'pans' : Math.hypot(x - q.cx, z - q.cz) < q.r ? 'boiler' : null;
}

// Hold E on a site for ROUND.plantTime while carrying the Fuse; moving fast resets the plant.
export function plantCharge(state, a, dt) {
	const site = siteAt(state, a.pos.x, a.pos.z);
	if (!a.hasFuse || state.phase !== 'live' || !a.alive || !site || Math.hypot(a.vel.x, a.vel.z) > 1.2) { a.plantT = 0; return; }
	if (a.plantT === 0) pushNoise(state, a.pos.x, a.pos.y, a.pos.z, 18, a.team, 2);
	a.plantT += dt;
	if (a.plantT < ROUND.plantTime) return;
	a.plantT = 0; a.hasFuse = false;
	Object.assign(state.fuse, { planted: true, site, x: a.pos.x, z: a.pos.z, carrier: null });
	state.phase = 'planted'; state.roundT = ROUND.fuseTime;
	a.money = Math.min(ECON.cap, a.money + ECON.plant);
	pushNoise(state, a.pos.x, a.pos.y, a.pos.z, 70, a.team, 2);
	banner(state, `FUSE PLANTED AT ${site.toUpperCase()}`, `${ROUND.fuseTime} SECONDS`);
	feed(state, `${a.name} planted the Fuse at ${site === 'pans' ? 'Pans' : 'Boiler'}`);
}

// Hold E next to a planted Fuse; Cutters halve the time. Taking damage or moving resets it (weapons.applyHit).
export function defuseCharge(state, a, dt) {
	const f = state.fuse;
	if (!f.planted || state.phase !== 'planted' || a.team !== 'bastion' || !a.alive || Math.hypot(a.pos.x - f.x, a.pos.z - f.z) > 1.6 || Math.hypot(a.vel.x, a.vel.z) > 1.2) { a.defuseT = 0; return; }
	if (a.defuseT === 0) pushNoise(state, a.pos.x, a.pos.y, a.pos.z, 26, a.team, 2);
	a.defuseT += dt;
	if (a.defuseT >= (a.hasCutters ? ROUND.defuseCuttersTime : ROUND.defuseTime)) { a.defuseT = 0; f.planted = false; feed(state, `${a.name} cut the Fuse`); endRound(state, 'bastion', 'defuse'); }
}

export function spectateTarget(state) {
	if (state.player.alive) return null;
	let n = 0, pick = null;
	for (const a of state.agents) if (a.alive && a.team === state.player.team) { if (n === Math.max(0, state.spectateIdx)) pick = a; n++; }
	if (!pick && n) { state.spectateIdx = 0; return spectateTarget(state); }
	return pick;
}
export const cycleSpectate = (state) => { state.spectateIdx++; };
