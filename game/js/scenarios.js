// SALTLINE scenarios.js — deterministic screenshot setups (?scenario=cover|buy|fuse|roundend). Each places agents,
// buys through economy.buyItem and advances the real simulation, then freezes it (state.scenarioDone).
import { buyItem } from './economy.js';
import { throwGrenade } from './grenades.js';
import { plantCharge } from './rounds.js';
import { feed } from './state.js';

const put = (a, x, z, yawDeg, pitch = 0) => { a.pos.set(x, a.pos.y, z); a.prevPos.copy(a.pos); a.yaw = yawDeg * Math.PI / 180; a.pitch = pitch; a.alive = true; };
const run = (tick, n, until = () => false) => { for (let i = 0; i < n && !until(); i++) tick(1 / 64); };

export function applyScenario(state, name, tick) {
	const p = state.player, S = state.agents.filter((a) => a.team === 'strand' && a !== p), B = state.agents.filter((a) => a.team === 'bastion');
	for (const a of state.agents) a.money = 6000;
	state.newRound = false; state.banner = null;
	if (name === 'buy') {
		state.round = 3; state.score.strand = 1; state.score.bastion = 1; p.money = 4350; state.roundT = 9;
		put(p, -44, 4, -78, -0.02); state.buyOpen = true; buyItem(state, p, 'armor');
		[[-40.5, 1.5, -95], [-41, 6.5, -70], [-37.5, 8, -110], [-39.5, -0.5, -80]].forEach(([x, z, y], i) => put(S[i], x, z, y));
		run(tick, 20);
	} else {
		state.phase = 'live'; state.roundT = 78; state.buyOpen = false;
		for (const a of state.agents) { buyItem(state, a, a.team === 'strand' ? 'talon' : 'gavel'); buyItem(state, a, 'helm'); }
		if (name === 'cover') {
			put(p, -3.2, -24.2, -96, 0.0); state.round = 5; state.score.strand = 2; state.score.bastion = 2;
			put(S[0], 1.6, -28.5, -80); put(S[1], -5, -21.4, -100);
			put(B[0], 15.5, -26.5, 92); put(B[1], 20, -31.5, 80); put(B[2], 21, -22.5, 100);
			B[0].crouch = 1; B[1].brain.crouch = false;
			feed(state, 'Strand plan: rush Pans'); feed(state, 'Bastion-6: 2 contact Pans West');
			feed(state, 'Strand-2 ▸ Bastion-8 · TALON', true); feed(state, 'Bastion-5 ▸ Strand-3 · GAVEL');
			B[3].alive = false; S[2].alive = false;
			state.input.fire = true;
			run(tick, 40, () => state.shots.fired > 6 && p.shotsFired >= 3 && state.time - p.lastShotT < 0.01);
			state.input.fire = false;
		} else if (name === 'fuse') {
			put(p, 19.5, 27.5, 112, -0.08); state.round = 8; state.score.strand = 3; state.score.bastion = 4;
			const c = state.fuse.carrier; put(c, 13, 23.5, 90); c.vel.set(0, 0, 0);
			for (let i = 0; i < 200 && state.phase !== 'planted'; i++) { plantCharge(state, c, 1 / 64); tick(1 / 64); c.vel.set(0, 0, 0); put(c, 13, 23.5, 90); }
			put(c, 8.5, 31.5, 60); put(S.find((a) => a !== c) || S[1], 21, 33, 140);
			for (const b of B) b.alive = false; B[0].alive = true; put(B[0], -14, 24, -90);
			p.nades.veil = 1; p.nadeSel = 'veil';
			throwGrenade(state, p, false, 4.8, 1, 25.6);
			run(tick, 260);
			p.yaw = 100 * Math.PI / 180;
		} else {
			put(p, 3, -20.5, -60, -0.06); state.round = 6; state.score.strand = 3; state.score.bastion = 2; state.roundsPlayed = 5;
			put(S[0], 9, -25, -40); put(S[1], 13.5, -29.5, 30);
			for (const [i, x, z] of [[0, 12, -22.5], [1, 17.6, -27.6], [2, 7.5, -31]]) { put(B[i], x, z, 90); B[i].hp = 0; B[i].alive = false; }
			run(tick, 90);
			state.phase = 'post'; state.roundT = 4;
			state.banner = { text: 'STRAND CLEARS THE FIELD', sub: 'STRAND TAKES ROUND 6 · MVP STRAND-1 (3)', t: state.time };
			state.input.scoreboard = true;
		}
	}
	state.scenarioDone = true;
}
