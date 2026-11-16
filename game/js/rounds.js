// Round phases, win checks, the Fuse (carried, dropped, planted, cut) and the half-time swap.
import { ROUND, ECON, WEAPONS } from './config.js';
import { awardRoundMoney } from './economy.js';
import { pushNoise, feed, teamName } from './state.js';
import { giveWeapon } from './weapons.js';

const SPAWN_OFF = [[0, 0], [-1.5, 2], [-1.5, -2], [1.5, 2.5], [1.5, -2.5]], REASON = {
	elimination: (w) => `${w.toUpperCase()} CLEARS THE FIELD`, time: () => 'BASTION HOLDS THE LINE', detonation: () => 'THE FUSE DETONATES', defuse: () => 'FUSE CUT — BASTION WINS',
};
const banner = (state, text, sub = '') => { state.banner = { text, sub, t: state.time }; };
const still = (a) => a.alive && Math.hypot(a.vel.x, a.vel.z) <= 1.2;
const near = (a, x, z, r) => Math.hypot(a.pos.x - x, a.pos.z - z) < r;
function alive(state, team) { let n = 0; for (const a of state.agents) n += a.alive && a.team === team; return n; }

export function siteAt(state, x, z) {
	const { sitePans: p, siteBoiler: b } = state.zones;
	return Math.hypot(x - p.cx, z - p.cz) < p.r ? 'pans' : Math.hypot(x - b.cx, z - b.cz) < b.r ? 'boiler' : null;
}

export function startRound(state) {
	if (state.round === ROUND.swapAfter + 1 && !state.swapped) { // half time: sides swap, money resets
		state.swapped = true;
		for (const a of state.agents) { a.team = a.team === 'strand' ? 'bastion' : 'strand'; a.money = ECON.start; a.alive = false; if (a.isBot) a.name = `${teamName(a.team)}-${a.id}`; }
		[state.score.strand, state.score.bastion] = [state.score.bastion, state.score.strand];
		state.lossStreak.strand = state.lossStreak.bastion = 0;
		feed(state, 'Half time: teams swap sides');
	}
	const n = { strand: 0, bastion: 0 }, strand = state.agents.filter((a) => a.team === 'strand');
	for (const a of state.agents) {
		const sp = state.map.spawns[a.team], o = SPAWN_OFF[n[a.team]++ % 5], s = a.team === 'strand' ? 1 : -1;
		if (!a.alive) { a.weapons.length = a.armor = 0; a.helm = false; a.nades.shard = a.nades.veil = 0; giveWeapon(a, 'wren'); }
		a.pos.set(sp[0] + o[0] * s, 0, sp[1] + o[1]); a.prevPos.copy(a.pos); a.vel.set(0, 0, 0); a.recoil.pitch = a.recoil.yaw = 0;
		Object.assign(a, { yaw: -s * Math.PI / 2, pitch: 0, alive: true, hp: 100, roundKills: 0, crouch: 0, plantT: 0, defuseT: 0, spreadBloom: 0,
			shotsFired: 0, reloadT: 0, scoped: false, scopeLevel: 0, grenadeMode: false, hasFuse: false, active: a.weapons[0] ? 0 : 1 });
		for (const id of a.weapons) if (id) a.ammo[id] = { mag: WEAPONS[id].mag, reserve: WEAPONS[id].reserve };
	}
	const carrier = strand[Math.floor(state.rng() * strand.length)];
	carrier.hasFuse = true;
	Object.assign(state.fuse, { carrier, site: null, planted: false, dropped: false });
	Object.assign(state, { phase: 'buy', roundT: ROUND.buyTime, newRound: true, buyOpen: !state.autoplay });
	banner(state, `ROUND ${state.round}`, 'BUY PHASE — B TO TOGGLE THE MENU');
}

function endRound(state, winner, reason) {
	awardRoundMoney(state, winner, reason);
	state.score[winner]++; state.roundsPlayed++; state.lastWinReason = reason;
	banner(state, REASON[reason](winner), `${winner.toUpperCase()} TAKES ROUND ${state.round}`);
	Object.assign(state, { phase: 'post', roundT: ROUND.postTime, buyOpen: false });
}

export function updateRounds(state, dt) {
	if (state.matchOver) return;
	const f = state.fuse, s = alive(state, 'strand'), b = alive(state, 'bastion'), over = (state.roundT -= dt) <= 0;
	if (state.phase === 'buy' && over) { Object.assign(state, { phase: 'live', roundT: ROUND.liveTime, buyOpen: false }); banner(state, 'GO'); }
	else if (state.phase === 'live') {
		if (f.carrier && !f.carrier.alive) { Object.assign(f, { dropped: true, x: f.carrier.pos.x, z: f.carrier.pos.z, carrier: null }); feed(state, 'The Fuse is down'); }
		for (const a of state.agents) if (f.dropped && a.alive && a.team === 'strand' && near(a, f.x, f.z, 1.1)) { f.dropped = false; f.carrier = a; a.hasFuse = true; }
		if (!b) endRound(state, 'strand', 'elimination'); else if (!s) endRound(state, 'bastion', 'elimination'); else if (over) endRound(state, 'bastion', 'time');
	} else if (state.phase === 'planted') { if (!b) endRound(state, 'strand', 'elimination'); else if (over) endRound(state, 'strand', 'detonation'); }
	else if (state.phase === 'post' && over) {
		const { strand, bastion } = state.score;
		if (Math.max(strand, bastion) < ROUND.winRounds) { state.round++; startRound(state); return; }
		Object.assign(state, { matchOver: true, phase: 'matchEnd' });
		banner(state, `${strand > bastion ? 'STRAND' : 'BASTION'} WINS THE MATCH`, `${strand} — ${bastion}`);
	}
}

export function plantCharge(state, a, dt) {
	const site = siteAt(state, a.pos.x, a.pos.z);
	if (!a.hasFuse || state.phase !== 'live' || !site || !still(a)) { a.plantT = 0; return; }
	if (a.plantT === 0) pushNoise(state, a.pos.x, a.pos.y, a.pos.z, 18, a.team, 2);
	if ((a.plantT += dt) < ROUND.plantTime) return;
	a.plantT = 0; a.hasFuse = false; a.money = Math.min(ECON.cap, a.money + ECON.plant);
	Object.assign(state.fuse, { planted: true, site, x: a.pos.x, z: a.pos.z, carrier: null });
	Object.assign(state, { phase: 'planted', roundT: ROUND.fuseTime });
	pushNoise(state, a.pos.x, a.pos.y, a.pos.z, 70, a.team, 2);
	banner(state, `FUSE PLANTED AT ${site.toUpperCase()}`, `${ROUND.fuseTime} SECONDS`);
	feed(state, `${a.name} planted the Fuse at ${site === 'pans' ? 'Pans' : 'Boiler'}`);
}

export function defuseCharge(state, a, dt) {
	const f = state.fuse;
	if (state.phase !== 'planted' || a.team !== 'bastion' || !near(a, f.x, f.z, 1.6) || !still(a)) { a.defuseT = 0; return; }
	if (a.defuseT === 0) pushNoise(state, a.pos.x, a.pos.y, a.pos.z, 26, a.team, 2);
	if ((a.defuseT += dt) < ROUND.defuseTime) return;
	a.defuseT = 0; f.planted = false; feed(state, `${a.name} cut the Fuse`); endRound(state, 'bastion', 'defuse');
}
