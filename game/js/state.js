// SALTLINE state.js — the one state object that holds everything that changes (PLAN.md §5.1), plus the two ring
// buffers systems talk through: fxEvents (sim → art) and noise (sim → bots and audio).
import { Vector3 } from 'three';
import { MOVE, ECON } from './config.js';

export const teamName = (team) => (team === 'strand' ? 'Strand' : 'Bastion');
export function createAgent(id, team, isBot, x, z, yaw) {
	return {
		id, team, isBot, alive: true, hp: 100, armor: 0, helm: false, money: ECON.start, name: isBot ? `${teamName(team)}-${id}` : 'You',
		pos: new Vector3(x, 0, z), prevPos: new Vector3(x, 0, z), vel: new Vector3(), yaw, pitch: 0, crouch: 0, onGround: true, eyeHeight: MOVE.eyeStand,
		weapons: [], active: 0, ammo: {}, reloadT: 0, reloadShell: 0, nextFireT: 0, switchT: 0, lastWeapon: 0, scoped: false, scopeLevel: 0,
		shotsFired: 0, lastShotT: -99, dryT: 0, recoil: { pitch: 0, yaw: 0 }, spreadBloom: 0, flashT: 0,
		hasFuse: false, hasCutters: false, plantT: 0, defuseT: 0, nades: { shard: 0, veil: 0, glare: 0 }, grenadeMode: false, nadeSel: 'shard',
		kills: 0, deaths: 0, headshots: 0, roundKills: 0, lastHit: { t: -1, head: false }, hurtT: -9, hurtYaw: 0,
		stepAcc: 0, brain: null, walkPhase: 0, speed: 0,
	};
}

export function createState(map, rng) {
	const s = map.spawns.strand, player = createAgent(0, 'strand', false, s[0], s[1], -Math.PI / 2);
	return {
		rng, tick: 0, time: 0, map, boxes: null, zones: map.zones, nodes: map.nodes, nav: null, player, agents: [player],
		input: {
			f: false, b: false, l: false, r: false, jump: false, walk: false, crouch: false, fire: false, fireEdge: false, alt: false, reload: false,
			interact: false, scoreboard: false, slot: 0, lastWeapon: false, wheel: 0, lookDX: 0, lookDY: 0, locked: false, buyToggle: false, buyKey: '',
		},
		phase: 'buy', round: 1, roundT: 0, score: { strand: 0, bastion: 0 }, roundsPlayed: 0, matchOver: false, lastWinReason: null,
		fuse: { carrier: null, site: null, planted: false, dropped: false, x: 0, z: 0 },
		noise: Array.from({ length: 32 }, () => ({ x: 0, y: 0, z: 0, r: 0, t: -99, team: '', kind: 0 })), noiseSeq: 0,
		fxEvents: Array.from({ length: 64 }, () => ({ kind: 0, x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 0, mat: 0 })), fxHead: 0, fxTail: 0, fxBoom: 0,
		killfeed: [], nades: [], smokes: [], spottedT: new Float32Array(16).fill(-99), buyOpen: false, difficulty: 'regular', autoplay: false,
		spectateIdx: -1, lossStreak: { strand: 0, bastion: 0 }, banner: null, callT: { strand: -99, bastion: -99 }, swapped: false,
		scenarioDone: false, paused: false, newRound: false, shots: { fired: 0, hits: 0, heads: 0, kills: 0 },
	};
}

// fx kinds: 0 tracer, 1 muzzle, 2 bullet hole, 3 impact, 4 casing, 6 body hit, 7 explosion (mat 0) / flash (mat 1).
export function pushFx(state, kind, x, y, z, dx, dy, dz, mat) {
	const e = state.fxEvents[state.fxTail];
	e.kind = kind; e.x = x; e.y = y; e.z = z; e.dx = dx; e.dy = dy; e.dz = dz; e.mat = mat;
	state.fxTail = (state.fxTail + 1) % state.fxEvents.length;
	if (state.fxTail === state.fxHead) state.fxHead = (state.fxHead + 1) % state.fxEvents.length;
}
// noise kinds: 0 step, 1 shot, 2 objective, 3 grenade. Bots and audio read new entries by sequence number.
export function pushNoise(state, x, y, z, r, team, kind = 0) {
	const n = state.noise[state.noiseSeq++ % state.noise.length];
	n.x = x; n.y = y; n.z = z; n.r = r; n.t = state.time; n.team = team; n.kind = kind;
}
// Killfeed: radio lines { text } and kills { a, b, w, head }, the last six.
export function feed(state, text, kill = null) {
	state.killfeed.push(kill ? { ...kill, t: state.time } : { text, t: state.time });
	if (state.killfeed.length > 6) state.killfeed.shift();
}
