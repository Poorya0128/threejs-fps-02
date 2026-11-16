// SALTLINE state.js — one state object holds everything that changes
import * as THREE from 'three';
import { ROUND, MOVE } from './config.js';

export function createAgent(id, team, isBot, x, z, yaw) {
  return {
    id, team, isBot, alive: true, hp: 100, armor: 0, helm: false, money: 900,
    name: isBot ? `${team === 'strand' ? 'Strand' : 'Bastion'}-${id}` : 'You',
    pos: new THREE.Vector3(x, 0, z), prevPos: new THREE.Vector3(x, 0, z),
    vel: new THREE.Vector3(), yaw, pitch: 0,
    crouch: 0, onGround: true, eyeHeight: MOVE.eyeStand,
    weapons: [], active: 0, ammo: {}, reloadT: 0, reloadShell: 0, nextFireT: 0,
    switchT: 0, lastWeapon: 0, scoped: false, scopeLevel: 0,
    shotsFired: 0, recoil: { pitch: 0, yaw: 0 }, spreadBloom: 0, flashT: 0,
    hasFuse: false, hasCutters: false, plantT: 0, defuseT: 0,
    nades: { shard: 0, veil: 0, glare: 0 }, grenadeMode: false, nadeSel: 'shard',
    kills: 0, deaths: 0, headshots: 0, lastHit: null,
    stepAcc: 0, fallStart: 0, brain: null,
  };
}

export function createState(seed, map) {
  const player = createAgent(0, 'strand', false, map.spawns.strand[0], map.spawns.strand[1], 0);
  return {
    seed, rng: null, tick: 0, time: 0,
    map, boxes: map.boxes, zones: map.zones, nodes: map.nodes, links: null,
    player, agents: [player],
    input: {
      f: false, b: false, l: false, r: false, jump: false, walk: false,
      crouch: false, fire: false, alt: false, reload: false, interact: false,
      scoreboard: false,
      fireEdge: false, slot: 0, lastWeapon: false, wheel: 0,
      lookDX: 0, lookDY: 0, locked: false,
    },
    phase: 'live', round: 1, roundT: ROUND.liveTime,
    score: { strand: 0, bastion: 0 }, roundsPlayed: 0, matchOver: false,
    lastWinReason: null, fuse: null, noise: [], killfeed: [],
    nades: [], smokes: [], spottedT: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], buyOpen: false,
    fxBoom: 0, fxRing: 0,
    difficulty: 'regular', autoplay: false, spectateIdx: -1,
    lossStreak: { strand: 0, bastion: 0 }, banner: null, swapped: false,
    scenarioDone: false,
    shots: { fired: 0, hits: 0, heads: 0, kills: 0 },
    fxEvents: [], fxHead: 0, fxTail: 0,
    paused: false,
  };
}

export function pushFx(state, kind, x, y, z, dx, dy, dz, mat, head) {
  const pool = state.fxEvents;
  if (pool.length < 32) for (let i = 0; i < 32; i++) pool.push({ kind: 0, x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 0, mat: 0, head: 0 });
  const e = pool[state.fxTail];
  e.kind = kind; e.x = x; e.y = y; e.z = z; e.dx = dx; e.dy = dy; e.dz = dz; e.mat = mat; e.head = head ? 1 : 0;
  state.fxTail = (state.fxTail + 1) % 32;
  if (state.fxTail === state.fxHead) state.fxHead = (state.fxHead + 1) % 32;
}

export function pushNoise(state, x, y, z, r, team) {
  if (state.noise.length > 16) state.noise.shift();
  state.noise.push({ x, y, z, r, t: state.time, team });
}

export function resetAgentsForRound(state) {
  for (const a of state.agents) {
    a.alive = true; a.hp = 100; a.armor = 0; a.helm = false;
    a.vel.set(0, 0, 0); a.crouch = 0; a.flashT = 0;
    a.plantT = 0; a.defuseT = 0; a.spreadBloom = 0; a.shotsFired = 0;
  }
  const s = state.map.spawns;
  state.player.pos.set(s.strand[0], 0, s.strand[1]);
  state.player.prevPos.copy(state.player.pos);
  state.player.yaw = 0;
}
