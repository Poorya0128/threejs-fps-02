// SALTLINE state.js — one state object holds everything that changes
// (PLAN.md §5.1). Systems are update(state, dt) and hold no hidden state.
import * as THREE from 'three';
import { ROUND, MOVE } from './config.js';

export function createAgent(id, team, isBot, x, z, yaw) {
  return {
    id, team, isBot, alive: true, hp: 100, armor: 0, helm: false, money: 900,
    pos: new THREE.Vector3(x, 0, z), prevPos: new THREE.Vector3(x, 0, z),
    vel: new THREE.Vector3(), yaw, pitch: 0,
    crouch: 0, onGround: true, eyeHeight: MOVE.eyeStand,
    weapons: [], active: 0, ammo: {}, reloadT: 0, nextFireT: 0,
    shotsFired: 0, recoil: { pitch: 0, yaw: 0 }, spreadBloom: 0, flashT: 0,
    hasFuse: false, hasCutters: false, plantT: 0, defuseT: 0,
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
      crouch: false, fire: false, alt: false, reload: false,
      lookDX: 0, lookDY: 0, locked: false,
    },
    phase: 'live', round: 1, roundT: ROUND.liveTime,
    score: { strand: 0, bastion: 0 }, roundsPlayed: 0, matchOver: false,
    lastWinReason: null, fuse: null, noise: [], killfeed: [],
    camOverride: null, paused: false, scenario: null,
  };
}

// Reset per-round agent state (positions/HP); money and score survive.
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
