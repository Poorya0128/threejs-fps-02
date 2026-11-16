// SALTLINE rounds.js — phase machine, win checks, plant/defuse, side swap,
// spectate (§4.3). Phases: buy → live → [planted] → post → matchEnd.
import { ROUND, ECON } from './config.js';
import { awardRoundMoney } from './economy.js';
import { resetAgentsForRound } from './state.js';

export function banner(state, text) { state.banner = { text, t: state.time }; }

function aliveCount(state, team) {
  let n = 0;
  for (const a of state.agents) if (a.alive && a.team === team) n++;
  return n;
}

// Place every agent at its team spawn (small deterministic offset).
function placeAgents(state) {
  const s = state.map.spawns;
  const off = [[0, 0], [-2, 1.5], [2, 1.5], [-2, -1.5], [2, -1.5]];
  let si = 0, bi = 0;
  for (const a of state.agents) {
    const o = a.team === 'strand' ? off[si++ % 5] : off[bi++ % 5];
    const sp = a.team === 'strand' ? s.strand : s.bastion;
    a.pos.set(sp[0] + o[0], 0, sp[1] + o[1]);
    a.prevPos.copy(a.pos);
    a.vel.set(0, 0, 0);
    a.yaw = a.team === 'strand' ? 0 : Math.PI;
    a.pitch = 0; a.crouch = 0; a.flashT = 0;
  }
}

export function startRound(state) {
  resetAgentsForRound(state);
  placeAgents(state);
  // Side swap after round 6: teams swap, money resets (§4.3).
  if (state.round === ROUND.swapAfter + 1 && !state.swapped) {
    state.swapped = true;
    for (const a of state.agents) a.team = a.team === 'strand' ? 'bastion' : 'strand';
    for (const a of state.agents) a.money = ECON.start;
    state.lossStreak = { strand: 0, bastion: 0 };
    placeAgents(state);
  }
  // Fuse carrier: a random Strand bot (never the player in M3).
  const carriers = state.agents.filter((a) => a.team === 'strand' && a.isBot && a.alive);
  const carrier = carriers[Math.floor(state.rng() * carriers.length)] || null;
  for (const a of state.agents) a.hasFuse = false;
  if (carrier) carrier.hasFuse = true;
  state.fuse = { carrier, site: null, planted: false, x: 0, z: 0, t: 0 };
  state.phase = 'buy';
  state.roundT = ROUND.buyTime;
  state.spectateIdx = -1;
  banner(state, `ROUND ${state.round} — BUY PHASE`);
}

// End a round: money, score, banner; post advances the match.
export function endRound(state, winner, reason) {
  awardRoundMoney(state, winner, reason);
  state.score[winner]++;
  state.roundsPlayed++;
  state.lastWinReason = reason;
  const names = {
    elimination: winner === 'strand' ? 'Strand clears Bastion' : 'Bastion clears Strand',
    time: 'Bastion holds the line',
    detonation: 'Fuse detonates — Strand takes the round',
    defuse: 'Fuse defused — Bastion takes the round',
  };
  banner(state, names[reason] || `${winner} wins the round`);
  state.phase = 'post';
  state.roundT = ROUND.postTime;
}

function checkElimination(state) {
  const s = aliveCount(state, 'strand'), b = aliveCount(state, 'bastion');
  if (state.phase === 'live') {
    if (b === 0 && s > 0) endRound(state, 'strand', 'elimination');
    else if (s === 0 && b > 0) endRound(state, 'bastion', 'elimination');
  } else if (state.phase === 'planted') {
    // Killing all Strand after a plant does NOT win: defuse the Fuse.
    if (s === 0 && b === 0) endRound(state, 'strand', 'detonation');
  }
}

export function updateRounds(state, dt) {
  if (state.matchOver) return;
  state.roundT -= dt;
  if (state.phase === 'buy') {
    if (state.roundT <= 0) { state.phase = 'live'; state.roundT = ROUND.liveTime; }
    return;
  }
  if (state.phase === 'live') {
    checkElimination(state);
    if (state.phase !== 'live') return;
    if (state.roundT <= 0) endRound(state, 'bastion', 'time');
    return;
  }
  if (state.phase === 'planted') {
    checkElimination(state);
    if (state.phase !== 'planted') return;
    if (state.roundT <= 0) endRound(state, 'strand', 'detonation');
    return;
  }
  if (state.phase === 'post') {
    if (state.roundT <= 0) {
      if (state.score.strand >= ROUND.winRounds || state.score.bastion >= ROUND.winRounds) {
        state.matchOver = true;
        state.phase = 'matchEnd';
        banner(state, state.score.strand > state.score.bastion ? 'STRAND WINS THE MATCH' : 'BASTION WINS THE MATCH');
      } else {
        state.round++;
        startRound(state);
      }
    }
  }
}

// Plant progress for the Fuse carrier holding E inside a site.
// Returns 0..1 progress (0 when not planting).
export function plantCharge(state, a, dt) {
  if (!a.hasFuse || state.phase !== 'live' || !a.alive) { a.plantT = 0; return 0; }
  const z = state.zones;
  const inPans = Math.hypot(a.pos.x - z.sitePans.cx, a.pos.z - z.sitePans.cz) < z.sitePans.r;
  const inBoiler = Math.hypot(a.pos.x - z.siteBoiler.cx, a.pos.z - z.siteBoiler.cz) < z.siteBoiler.r;
  const site = inPans ? 'pans' : inBoiler ? 'boiler' : null;
  if (!site) { a.plantT = 0; return 0; }
  a.plantT += dt;
  if (a.plantT >= ROUND.plantTime) {
    a.plantT = 0;
    state.fuse.planted = true;
    state.fuse.site = site;
    state.fuse.x = a.pos.x; state.fuse.z = a.pos.z;
    state.fuse.t = ROUND.fuseTime;
    state.phase = 'planted';
    state.roundT = ROUND.fuseTime;
    a.money = Math.min(ECON.cap, a.money + ECON.plant); // plant bonus (§4.4)
    banner(state, `FUSE PLANTED AT ${site === 'pans' ? 'PANS' : 'BOILER'}`);
    state.killfeed.push({ text: `${a.name} planted the Fuse`, head: false, t: state.time });
  }
  return Math.min(1, a.plantT / ROUND.plantTime);
}

// Defuse progress for a Bastion agent holding E at the planted Fuse.
export function defuseCharge(state, a, dt) {
  if (!state.fuse || !state.fuse.planted || a.team !== 'bastion' || !a.alive) { a.defuseT = 0; return 0; }
  const d = Math.hypot(a.pos.x - state.fuse.x, a.pos.z - state.fuse.z);
  if (d > 2.2) { a.defuseT = 0; return 0; }
  const need = a.hasCutters ? ROUND.defuseCuttersTime : ROUND.defuseTime;
  a.defuseT += dt;
  if (a.defuseT >= need) {
    a.defuseT = 0;
    state.fuse.planted = false;
    endRound(state, 'bastion', 'defuse');
  }
  return Math.min(1, a.defuseT / need);
}

// Spectate: the camera follows a living teammate once the player is dead.
// Returns the agent to watch, or null (player alive).
function livingMates(state) {
  return state.agents.filter((a) => a.alive && a.team === state.player.team && a !== state.player);
}

export function spectateTarget(state) {
  const p = state.player;
  if (p.alive) return null;
  const mates = livingMates(state);
  if (!mates.length) return null;
  if (state.spectateIdx < 0 || state.spectateIdx >= mates.length) state.spectateIdx = 0;
  return mates[state.spectateIdx];
}

export function cycleSpectate(state) {
  const mates = livingMates(state);
  if (mates.length) state.spectateIdx = (state.spectateIdx + 1) % mates.length;
}
