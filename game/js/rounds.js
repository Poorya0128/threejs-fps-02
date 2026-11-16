// SALTLINE rounds.js — the round phase machine (buy → live → planted → post → next round or matchEnd), win checks,
// Fuse carry / drop / pick-up, plantCharge and defuseCharge, the side swap at half time and spectating.
import { ROUND, ECON, WEAPONS } from './config.js';
import { awardRoundMoney } from './economy.js';
import { pushNoise, feed, teamName } from './state.js';
import { giveWeapon } from './weapons.js';

export const banner = (state, text, sub = '') => { state.banner = { text, sub, t: state.time }; };
function alive(state, team) { let n = 0; for (const a of state.agents) if (a.alive && a.team === team) n++; return n; }
const SPAWN_OFF = [[0, 0], [-1.5, 2], [-1.5, -2], [1.5, 2.5], [1.5, -2.5]];
const flat = (a) => Math.hypot(a.vel.x, a.vel.z);

// Survivors keep their kit; the dead respawn with knife and Wren. Everyone is refilled and placed at spawn.
function resetAgents(state) {
	const n = { strand: 0, bastion: 0 };
	for (const a of state.agents) {
		const sp = state.map.spawns[a.team], o = SPAWN_OFF[n[a.team]++ % 5], strand = a.team === 'strand';
		if (!a.alive) { a.weapons.length = 0; a.armor = 0; a.helm = a.hasCutters = false; a.nades.shard = a.nades.veil = a.nades.glare = 0; giveWeapon(a, 'cutlass'); giveWeapon(a, 'wren'); }
		a.pos.set(sp[0] + o[0] * (strand ? 1 : -1), 0, sp[1] + o[1]); a.prevPos.copy(a.pos); a.vel.set(0, 0, 0);
		Object.assign(a, { yaw: strand ? -Math.PI / 2 : Math.PI / 2, pitch: 0, alive: true, hp: 100, roundKills: 0, crouch: 0, flashT: 0, plantT: 0, defuseT: 0, spreadBloom: 0,
			shotsFired: 0, reloadT: 0, reloadShell: 0, scoped: false, scopeLevel: 0, grenadeMode: false, hasFuse: false, active: a.weapons[0] ? 0 : 1 });
		a.recoil.pitch = a.recoil.yaw = 0;
		for (const id of a.weapons) if (id) a.ammo[id] = { mag: WEAPONS[id].mag, reserve: WEAPONS[id].reserve };
	}
}

export function startRound(state) {
	if (state.round === ROUND.swapAfter + 1 && !state.swapped) {
		state.swapped = true;
		for (const a of state.agents) { a.team = a.team === 'strand' ? 'bastion' : 'strand'; a.money = ECON.start; a.alive = false; if (a.isBot) a.name = `${teamName(a.team)}-${a.id}`; }
		[state.score.strand, state.score.bastion] = [state.score.bastion, state.score.strand];
		state.lossStreak.strand = state.lossStreak.bastion = 0;
		feed(state, 'Half time: teams swap sides');
	}
	resetAgents(state);
	const pool = state.agents.filter((a) => a.team === 'strand'), carrier = pool[Math.floor(state.rng() * pool.length)];
	carrier.hasFuse = true;
	Object.assign(state.fuse, { carrier, site: null, planted: false, dropped: false, x: 0, z: 0 });
	Object.assign(state, { phase: 'buy', roundT: ROUND.buyTime, spectateIdx: -1, newRound: true, buyOpen: !state.autoplay });
	banner(state, `ROUND ${state.round}`, 'BUY PHASE — B TO TOGGLE THE MENU');
}

function endRound(state, winner, reason) {
	awardRoundMoney(state, winner, reason);
	state.score[winner]++; state.roundsPlayed++; state.lastWinReason = reason;
	let mvp = null;
	for (const a of state.agents) if (a.team === winner && (!mvp || a.roundKills > mvp.roundKills)) mvp = a;
	const text = { elimination: `${winner.toUpperCase()} CLEARS THE FIELD`, time: 'BASTION HOLDS THE LINE', detonation: 'THE FUSE DETONATES', defuse: 'FUSE CUT — BASTION WINS' }[reason];
	banner(state, text, `${winner.toUpperCase()} TAKES ROUND ${state.round}${mvp && mvp.roundKills ? ` · MVP ${mvp.name.toUpperCase()} (${mvp.roundKills})` : ''}`);
	Object.assign(state, { phase: 'post', roundT: ROUND.postTime, buyOpen: false });
}

// A dead carrier drops the Fuse where they fell; any living Strand agent who walks over it picks it up.
function updateFuse(state) {
	const f = state.fuse;
	if (f.planted) return;
	if (f.carrier && !f.carrier.alive) { Object.assign(f, { dropped: true, x: f.carrier.pos.x, z: f.carrier.pos.z }); f.carrier.hasFuse = false; f.carrier = null; feed(state, 'The Fuse is down'); }
	if (f.dropped) for (const a of state.agents) if (a.alive && a.team === 'strand' && Math.hypot(a.pos.x - f.x, a.pos.z - f.z) < 1.1) {
		f.dropped = false; f.carrier = a; a.hasFuse = true; feed(state, `${a.name} picked up the Fuse`); return;
	}
}

export function updateRounds(state, dt) {
	if (state.matchOver) return;
	state.roundT -= dt;
	const s = alive(state, 'strand'), b = alive(state, 'bastion'), over = state.roundT <= 0;
	if (state.phase === 'buy') { if (over) { Object.assign(state, { phase: 'live', roundT: ROUND.liveTime, buyOpen: false }); banner(state, 'GO'); } }
	else if (state.phase === 'live') {
		updateFuse(state);
		if (!b) endRound(state, 'strand', 'elimination'); else if (!s) endRound(state, 'bastion', 'elimination'); else if (over) endRound(state, 'bastion', 'time');
	} else if (state.phase === 'planted') { if (!b) endRound(state, 'strand', 'elimination'); else if (over) endRound(state, 'strand', 'detonation'); }
	else if (state.phase === 'post' && over) {
		const { strand, bastion } = state.score;
		if (Math.max(strand, bastion) < ROUND.winRounds) { state.round++; startRound(state); return; }
		state.matchOver = true; state.phase = 'matchEnd';
		banner(state, `${strand > bastion ? 'STRAND' : 'BASTION'} WINS THE MATCH`, `${strand} — ${bastion}`);
	}
}

export function siteAt(state, x, z) {
	const { sitePans: p, siteBoiler: q } = state.zones;
	return Math.hypot(x - p.cx, z - p.cz) < p.r ? 'pans' : Math.hypot(x - q.cx, z - q.cz) < q.r ? 'boiler' : null;
}

// Hold E on a site for ROUND.plantTime while carrying the Fuse; moving resets it.
export function plantCharge(state, a, dt) {
	const site = siteAt(state, a.pos.x, a.pos.z);
	if (!a.hasFuse || state.phase !== 'live' || !a.alive || !site || flat(a) > 1.2) { a.plantT = 0; return; }
	if (a.plantT === 0) pushNoise(state, a.pos.x, a.pos.y, a.pos.z, 18, a.team, 2);
	if ((a.plantT += dt) < ROUND.plantTime) return;
	a.plantT = 0; a.hasFuse = false;
	Object.assign(state.fuse, { planted: true, site, x: a.pos.x, z: a.pos.z, carrier: null });
	state.phase = 'planted'; state.roundT = ROUND.fuseTime;
	a.money = Math.min(ECON.cap, a.money + ECON.plant);
	pushNoise(state, a.pos.x, a.pos.y, a.pos.z, 70, a.team, 2);
	banner(state, `FUSE PLANTED AT ${site.toUpperCase()}`, `${ROUND.fuseTime} SECONDS`);
	feed(state, `${a.name} planted the Fuse at ${site === 'pans' ? 'Pans' : 'Boiler'}`);
}

// Hold E next to a planted Fuse; Cutters halve the time. Moving or taking damage (applyHit) resets it.
export function defuseCharge(state, a, dt) {
	const f = state.fuse;
	if (!f.planted || state.phase !== 'planted' || a.team !== 'bastion' || !a.alive || Math.hypot(a.pos.x - f.x, a.pos.z - f.z) > 1.6 || flat(a) > 1.2) { a.defuseT = 0; return; }
	if (a.defuseT === 0) pushNoise(state, a.pos.x, a.pos.y, a.pos.z, 26, a.team, 2);
	if ((a.defuseT += dt) < (a.hasCutters ? ROUND.defuseCuttersTime : ROUND.defuseTime)) return;
	a.defuseT = 0; f.planted = false; feed(state, `${a.name} cut the Fuse`); endRound(state, 'bastion', 'defuse');
}

// The living team-mate the dead player watches; Space cycles through them.
export function spectateTarget(state) {
	const n = state.player.alive ? 0 : alive(state, state.player.team);
	let k = n && Math.max(0, state.spectateIdx) % n;
	if (n) for (const a of state.agents) if (a.alive && a.team === state.player.team && !k--) return a;
	return null;
}
export const cycleSpectate = (state) => { state.spectateIdx++; };
