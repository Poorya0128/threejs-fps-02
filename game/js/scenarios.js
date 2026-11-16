// Screenshot setups (?scenario=cover|buy|fuse|roundend) from normal systems, then frozen.
import { buyItem } from './economy.js';
import { throwGrenade } from './grenades.js';
import { plantCharge } from './rounds.js';
import { feed } from './state.js';
import { applyHit } from './weapons.js';
import { WEAPONS } from './config.js';

const put = (a, x, z, yawDeg, pitch = 0) => { a.pos.set(x, a.pos.y, z); a.prevPos.copy(a.pos); a.yaw = yawDeg * Math.PI / 180; a.pitch = pitch; a.alive = true; };
const run = (tick, n, until = () => false) => { for (let i = 0; i < n && !until(); i++) tick(1 / 64); };
const score = (state, round, s, b) => { state.round = round; state.score.strand = s; state.score.bastion = b; };

export function applyScenario(state, name, tick) {
	const p = state.player, S = state.agents.filter((a) => a.team === 'strand' && a !== p), B = state.agents.filter((a) => a.team === 'bastion');
	for (const a of state.agents) a.money = 6000;
	state.newRound = false; state.banner = null;
	if (name === 'buy') {
		score(state, 3, 1, 1); p.money = 4350; state.roundT = 9; state.buyOpen = true;
		put(p, -44, 4, -78, -.02); buyItem(state, p, 'armor');
		[[-40.5, 1.5, -95], [-41, 6.5, -70], [-37.5, 8, -110], [-39.5, -.5, -80]].forEach(([x, z, y], i) => put(S[i], x, z, y));
		run(tick, 20);
		return void (state.scenarioDone = true);
	}
	state.phase = 'live'; state.roundT = 78; state.buyOpen = false;
	for (const a of state.agents) { buyItem(state, a, a.team === 'strand' ? 'talon' : 'gavel'); buyItem(state, a, 'helm'); }
	if (name === 'cover') {
		put(p, -3.2, -24.2, -96); score(state, 5, 2, 2);
		put(S[0], 1.6, -28.5, -80); put(S[1], -5, -21.4, -100);
		put(B[0], 10.5, -25.5, 92); put(B[1], 15, -21.6, 100); put(B[2], 20, -28.5, 85);
		B[0].crouch = 1; B[1].brain.crouch = false; B[3].alive = S[2].alive = false;
		feed(state, '', { a: 'Strand-2', b: 'Bastion-8', w: 'TALON', head: true }); feed(state, '', { a: 'Bastion-5', b: 'Strand-3', w: 'GAVEL' });
		state.input.fire = true;
		run(tick, 40, () => state.shots.fired > 6 && p.shotsFired >= 3 && state.time - p.lastShotT < .01);
		state.input.fire = false;
	} else if (name === 'fuse') {
		const c = S[0];
		put(p, 22.5, 21.6, 88, -.12); score(state, 8, 3, 4);
		for (const a of state.agents) a.hasFuse = a === c;
		state.fuse.carrier = c;
		for (let i = 0; i < 200 && state.phase !== 'planted'; i++) { put(c, 13, 22.8, 90); c.vel.set(0, 0, 0); plantCharge(state, c, 1 / 64); tick(1 / 64); }
		for (const b of B) b.alive = false;
		put(B[0], 44, 2, 90);
		p.nades.veil = 1; p.nadeSel = 'veil';
		throwGrenade(state, p, false, 6, 1, 23.5);
		run(tick, 240);
		put(p, 22.5, 21.6, 88, -.12); put(c, 9.5, 19.4, 70); put(S[1], 16.8, 18.4, 80);
		c.crouch = S[1].crouch = 1; c.speed = S[1].speed = 0;
	} else {
		put(p, 3, -20.5, -60, -.06); score(state, 6, 2, 2); state.roundsPlayed = 4;
		put(S[0], 9, -25, -40); put(S[1], 13.5, -29.5, 30);
		for (const [i, x, z] of [[0, 12, -22.5], [1, 17.6, -27.6], [2, 7.5, -31]]) { put(B[i], x, z, 90); applyHit(state, S[0], B[i], 'head', 200, 8, WEAPONS.talon); }
		applyHit(state, S[1], B[3], 'chest', 300, 8, WEAPONS.talon); applyHit(state, p, B[4], 'head', 200, 8, WEAPONS.talon);
		run(tick, 90);
		state.input.scoreboard = true;
	}
	state.scenarioDone = true;
}
