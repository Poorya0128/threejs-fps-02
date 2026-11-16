// SALTLINE scenarios.js — deterministic screenshot setups (§13).
import { startRound } from './rounds.js';
import { onRoundStart } from './bots.js';
import { giveWeapon } from './weapons.js';
import { throwGrenade } from './grenades.js';

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
    p.pos.set(-28, 0, 10); p.prevPos.copy(p.pos); p.yaw = 0; p.pitch = 0;
    strand[0].pos.set(-30, 0, 14); strand[1].pos.set(-26, 0, 4);
    bastion[0].pos.set(-27, 0, -18); bastion[1].pos.set(-22, 0, -24); bastion[2].pos.set(-16, 0, -26);
    for (const a of [...strand, ...bastion]) a.prevPos.copy(a.pos);
    advance(step, () => state.shots.fired > 0, 400);
    const s = bastion[0];
    if (s.alive) {
      s.brain.target = p; s.brain.reactT = 0; s.brain.burstLeft = 3;
      advance(step, () => state.shots.fired > 1, 32);
    }
  } else if (name === 'buy') {
    p.money = 4500;
    state.buyOpen = true;
    p.pos.set(-38, 0, 20); p.prevPos.copy(p.pos); p.yaw = Math.PI; p.pitch = 0;
    advance(step, () => false, 30);
  } else if (name === 'fuse') {
    state.phase = 'live'; state.roundT = 105;
    const c = state.fuse.carrier;
    c.pos.set(18, 0, 28); c.prevPos.copy(c.pos);
    c.brain.state = 'plant';
    p.pos.set(16, 0, 24); p.prevPos.copy(p.pos);
    p.yaw = Math.PI; p.pitch = 0;
    strand[0].pos.set(24, 0, 32); strand[0].prevPos.copy(strand[0].pos);
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
    strand[0].pos.set(-14, 0, -28); strand[0].prevPos.copy(strand[0].pos);
    strand[1].pos.set(-18, 0, -32); strand[1].prevPos.copy(strand[1].pos);
    p.pos.set(-16, 0, -20); p.prevPos.copy(p.pos); p.yaw = 0; p.pitch = 0;
    advance(step, () => false, 10);
  }
  state.scenarioDone = true;
}
