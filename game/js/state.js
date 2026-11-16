// The one state object (PLAN.md §5.1) and its ring buffers: fxEvents (sim → art), noise (sim → bots, audio).
import { Vector3 } from 'three';
import { MOVE, ECON } from './config.js';

const flags = (names) => Object.fromEntries(names.split(' ').map((k) => [k, false]));
export const teamName = (team) => (team === 'strand' ? 'Strand' : 'Bastion');

export function createAgent(id, team, isBot, x, z) {
	return {
		id, team, isBot, alive: true, hp: 100, armor: 0, helm: false, money: ECON.start, name: isBot ? `${teamName(team)}-${id}` : 'You',
		pos: new Vector3(x, 0, z), prevPos: new Vector3(x, 0, z), vel: new Vector3(), yaw: 0, pitch: 0, crouch: 0, onGround: true, eyeHeight: MOVE.eyeStand,
		weapons: [], active: 0, ammo: {}, reloadT: 0, nextFireT: 0, switchT: 0, lastWeapon: 0, scoped: false, scopeLevel: 0, prevAlt: false,
		shotsFired: 0, lastShotT: -99, recoil: { pitch: 0, yaw: 0 }, spreadBloom: 0,
		hasFuse: false, hasCutters: false, plantT: 0, defuseT: 0, nades: { shard: 0, veil: 0 }, grenadeMode: false, nadeSel: 'shard',
		kills: 0, deaths: 0, headshots: 0, roundKills: 0, lastHit: { t: -1, head: false }, hurtT: -9,
		stepAcc: 0, walkPhase: 0, speed: 0, brain: null,
	};
}

export function createState(map, rng) {
	const s = map.spawns.strand, player = createAgent(0, 'strand', false, s[0], s[1]);
	return {
		rng, time: 0, map, zones: map.zones, nodes: map.nodes, boxes: null, nav: null, player, agents: [player],
		input: { ...flags('f b l r jump walk crouch fire fireEdge alt reload interact scoreboard lastWeapon locked canLock buyToggle buyOpen'), slot: 0, wheel: 0, lookDX: 0, lookDY: 0, buyKey: '' },
		phase: 'buy', round: 1, roundT: 0, score: { strand: 0, bastion: 0 }, roundsPlayed: 0, matchOver: false, lastWinReason: null,
		fuse: { carrier: null, site: null, planted: false, dropped: false, x: 0, z: 0 }, attackSite: 'pans',
		noise: Array.from({ length: 32 }, () => ({ x: 0, y: 0, z: 0, r: 0, t: -99, team: '', kind: 0 })), noiseSeq: 0,
		fxEvents: Array.from({ length: 64 }, () => ({ kind: 0, x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 0, mat: 0 })), fxHead: 0, fxTail: 0,
		killfeed: [], nades: [], smokes: [], spottedT: new Float32Array(16).fill(-99), lossStreak: { strand: 0, bastion: 0 }, callT: { strand: -99, bastion: -99 },
		banner: null, shots: { fired: 0 },
		...flags('buyOpen autoplay swapped scenarioDone paused newRound'),
	};
}

// fx kinds: 0 tracer, 1 muzzle, 2 bullet hole, 3 impact, 4 casing, 6 body hit, 7 explosion.
export function pushFx(state, kind, x, y, z, dx, dy, dz, mat) {
	const e = state.fxEvents[state.fxTail], n = state.fxEvents.length;
	e.kind = kind; e.x = x; e.y = y; e.z = z; e.dx = dx; e.dy = dy; e.dz = dz; e.mat = mat;
	state.fxTail = (state.fxTail + 1) % n;
	if (state.fxTail === state.fxHead) state.fxHead = (state.fxHead + 1) % n;
}
// noise kinds: 0 step, 1 shot, 2 objective, 3 grenade; readers follow noiseSeq.
export function pushNoise(state, x, y, z, r, team, kind = 0) {
	const n = state.noise[state.noiseSeq++ % state.noise.length];
	n.x = x; n.y = y; n.z = z; n.r = r; n.t = state.time; n.team = team; n.kind = kind;
}
// Killfeed: radio lines { text } and kills { a, b, w, head }.
export function feed(state, text, kill = null) {
	state.killfeed.push(kill ? { ...kill, t: state.time } : { text, t: state.time });
	if (state.killfeed.length > 6) state.killfeed.shift();
}
