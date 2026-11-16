// SALTLINE scenarios.js — deterministic screenshot setups (§13).
import { startRound } from './rounds.js';
import { onRoundStart } from './bots.js';
import { giveWeapon } from './weapons.js';
import { throwGrenade } from './grenades.js';

function place(a, x, z, yaw) {
  a.pos.set(x, 0, z); a.prevPos.copy(a.pos);
  if (yaw !== undefined) a.yaw = yaw;
}

function advance(step, done, max) {
  for (let i = 0; i < max && !done(); i++) step();
}

export function applyScenario(state, name, step) {
  startRound(state);
  onRoundStart(state);
  const p = state.player;
  const strand = state.agents.filter((a) => a.isBot && a.team === 'strand');
  const bastion = state.agents.filter((a) => a.isBot && a.team === 'bastion');
  if (name === 'cover') {
    state.phase = 'live'; state.roundT = 105;
    state.banner = null;
    giveWeapon(p, 'talon'); p.active = p.weapons.indexOf('talon');
    place(p, -28, 10, 0); p.pitch = 0;
    place(strand[0], -30, 14); place(strand[1], -26, 4);
    place(bastion[0], -27, -18); place(bastion[1], -22, -24); place(bastion[2], -16, -26);
    advance(step, () => state.shots.fired > 0, 400);
    const s = bastion[0];
    if (s.alive) {
      s.brain.target = p; s.brain.reactT = 0; s.brain.burstLeft = 3;
      advance(step, () => state.shots.fired > 1, 32);
    }
  } else if (name === 'buy') {
    p.money = 4500;
    state.buyOpen = true;
    place(p, -38, 20, Math.PI); p.pitch = 0;
    advance(step, () => false, 30);
  } else if (name === 'fuse') {
    state.phase = 'live'; state.roundT = 105;
    const c = state.fuse.carrier;
    place(c, 18, 28);
    c.brain.state = 'plant';
    place(p, 16, 24, Math.PI); p.pitch = 0;
    place(strand[0], 24, 32);
    advance(step, () => state.phase === 'planted', 600);
    if (state.phase === 'planted') {
      c.nades.veil = 1; c.nadeSel = 'veil';
      throwGrenade(state, c, false, 14, 1, 30);
      advance(step, () => state.smokes.some((s) => s.active && state.time - s.t > 1), 320);
    }
  } else {
    state.phase = 'post'; state.roundT = 5;
    state.score.strand = 3; state.score.bastion = 2;
    state.banner = { text: 'STRAND CLEARS BASTION', t: state.time };
    state.roundsPlayed = 5;
    place(strand[0], -14, -28);
    place(strand[1], -18, -32);
    place(p, -16, -20, 0); p.pitch = 0;
    advance(step, () => false, 10);
  }
  state.scenarioDone = true;
}
