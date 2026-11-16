// SALTLINE bots.js — bot brain: FSM, routes, holds, canSee, aiming
import { BOT, MOVE, LINEUPS } from './config.js';
import { clamp, damp, rayAABB, smokeBlocks } from './math.js';
import { throwGrenade } from './grenades.js';
import { stepAgent, setCrouch } from './physics.js';
import { giveWeapon, switchWeapon, activeWeapon, tryFire } from './weapons.js';
import { buyItem } from './economy.js';
import { plantCharge, defuseCharge } from './rounds.js';

const _d = { x: 0, y: 0, z: 0 };

const wrapAngle = (a) => {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
};

export function createBrain(skill) {
  return {
    skill, state: 'buy', route: [], routeI: 0,
    target: null, reactT: 0, aimX: 0, aimY: 0, crouch: false,
    burstLeft: 0, burstPause: 0, scanT: 0, pieT: 0, smoothT: 0,
    plan: null, lastDist: 1e9, stuckT: 0, detourT: 0, detourDir: 1,
    prevState: null, lastRouteI: -1,
    lastKnown: null, callT: 0, utilT: 0, usedUtil: false, invT: 0, lastNoiseT: 0,
  };
}

export function spawnBots(state, nav) {
  for (const a of state.agents) {
    if (!a.isBot) continue;
    a.brain = createBrain(BOT[state.difficulty] || BOT.regular);
    giveWeapon(a, 'wren'); giveWeapon(a, 'cutlass');
    a.active = 0;
  }
  state.nav = nav;
}

export function onRoundStart(state) {
  if (state.lastBuyRound === state.round) return;
  state.lastBuyRound = state.round;
  const nav = state.nav, plans = state.map.plans;
  const strandBots = state.agents.filter((a) => a.team === 'strand' && (a.isBot || (state.autoplay && a === state.player)));
  const bastionBots = state.agents.filter((a) => a.isBot && a.team === 'bastion');
  const pick = ['rushPans', 'rushBoiler', 'split', 'spread'][Math.floor(state.rng() * 4)];
  const routes = plans.strand[pick];
  strandBots.forEach((b, i) => {
    b.brain.route = expandRoute(state, nav, b, routes[(i + 1) % routes.length]);
    b.brain.routeI = 0;
    b.brain.state = 'followRoute';
    b.brain.plan = pick;
    b.brain.usedUtil = false;
  });
  const holds = [...plans.bastion.pans, ...plans.bastion.boiler];
  bastionBots.forEach((b, i) => {
    b.brain.route = [nav.byName(i < 4 ? holds[i] : plans.bastion.rotator)];
    b.brain.routeI = 0;
    b.brain.state = i < 4 ? 'holdAngle' : 'followRoute';
    b.brain.plan = i < 4 ? 'anchor' : 'rotator';
  });
  for (const t of ['strand', 'bastion']) {
    const team = state.agents.filter((a) => a.team === t);
    const avg = team.reduce((s, a) => s + a.money, 0) / team.length;
    for (const b of team) {
      if (!b.isBot && !(state.autoplay && b === state.player)) continue;
      if (avg >= 3400) {
        for (const id of ['armor', b.id % 3 === 0 ? 'longbow' : b.id % 3 === 1 ? 'gavel' : 'talon', 'shard', 'veil']) buyItem(state, b, id);
        if (b.id % 2 === 0) buyItem(state, b, 'glare');
      } else if (avg >= 2000) {
        buyItem(state, b, 'armor');
        buyItem(state, b, 'hornet');
        if (b.id % 2 === 0) buyItem(state, b, 'shard');
      }
      if (t === 'bastion' && avg >= 2400) buyItem(state, b, 'cutters');
    }
  }
}

function rayBlocked(state, ox, oy, oz, dx, dy, dz) {
  const len = Math.hypot(dx, dy, dz);
  const ux = dx / len, uy = dy / len, uz = dz / len;
  for (let i = 0; i < state.boxes.length; i++) {
    const b = state.boxes[i];
    const t = rayAABB(ox, oy, oz, ux, uy, uz, b.min, b.max, len);
    if (t >= 0 && t < len - 0.3) return true;
  }
  return false;
}

function rayClear(state, bot, target, ty) {
  const ey = bot.pos.y + bot.eyeHeight;
  const dx = target.pos.x - bot.pos.x, dy = ty - ey, dz = target.pos.z - bot.pos.z;
  return !rayBlocked(state, bot.pos.x, ey, bot.pos.z, dx, dy, dz)
    && !smokeBlocks(state.smokes, state.time, bot.pos.x, ey, bot.pos.z, target.pos.x, ty, target.pos.z);
}

export function canSee(state, bot, target) {
  if (bot.flashT > 0) return false;
  const dx = target.pos.x - bot.pos.x, dz = target.pos.z - bot.pos.z;
  const dist = Math.hypot(dx, dz);
  if (dist > 60 || dist < 0.05) return false;
  const fx = -Math.sin(bot.yaw), fz = -Math.cos(bot.yaw);
  if ((dx * fx + dz * fz) / dist < Math.cos(55 * Math.PI / 180)) return false;
  const ty = target.pos.y + target.eyeHeight;
  return rayClear(state, bot, target, ty + 0.05) || rayClear(state, bot, target, ty - 0.3);
}

function nodePos(state, i, out) {
  const n = state.nodes[i];
  out.x = n[1]; out.z = n[2]; out.y = n[3];
  return out;
}

function walkClear(state, x0, z0, x1, z1) {
  const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz);
  if (len < 0.01) return true;
  const ux = dx / len, uz = dz / len;
  for (let i = 0; i < state.boxes.length; i++) {
    const b = state.boxes[i];
    if (b.max.y <= 0.5 || b.min.y >= 1.4) continue;
    for (let k = 0; k < 2; k++) {
      const y = k ? 1.4 : 0.5;
      if (y < b.min.y || y > b.max.y) continue;
      if (rayAABB(x0, y, z0, ux, 0, uz, b.min, b.max, len) >= 0) return false;
    }
  }
  return true;
}

function aimAt(bot, tx, ty, tz, dt, rate) {
  const dx = tx - bot.pos.x, dy = ty - (bot.pos.y + bot.eyeHeight), dz = tz - bot.pos.z;
  const yaw = Math.atan2(-dx, -dz) - bot.recoil.yaw;
  const pitch = Math.atan2(dy, Math.hypot(dx, dz)) - bot.recoil.pitch;
  bot.yaw += wrapAngle(yaw - bot.yaw) * (1 - Math.exp(-rate * dt));
  bot.pitch = damp(bot.pitch, clamp(pitch, -1.55, 1.55), rate, dt);
}

function nearestNode(state, bot) {
  let best = -1, bd = 1e9;
  for (let i = 0; i < state.nodes.length; i++) {
    const n = state.nodes[i];
    const d = (n[1] - bot.pos.x) ** 2 + (n[2] - bot.pos.z) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

function routeTo(state, bot, goal) {
  if (goal < 0) return [];
  const best = nearestNode(state, bot);
  if (best < 0) return [goal];
  const out = state.nav.findPath(best, goal, state.nav._out);
  return out.length ? out.slice() : [goal];
}

function nodeClear(state, idx) {
  const n = state.nodes[idx];
  for (let i = 0; i < state.boxes.length; i++) {
    const b = state.boxes[i];
    if (b.max.y <= n[3] + 0.45 || b.min.y >= n[3] + 1.8) continue;
    if (n[1] <= b.min.x - 0.05 || n[1] >= b.max.x + 0.05) continue;
    if (n[2] <= b.min.z - 0.05 || n[2] >= b.max.z + 0.05) continue;
    const dx = Math.min(n[1] - b.min.x, b.max.x - n[1]);
    const dz = Math.min(n[2] - b.min.z, b.max.z - n[2]);
    if (Math.min(dx, dz) > 0.2) return false;
  }
  return true;
}

function expandRoute(state, nav, bot, names) {
  const out = [];
  let prev = nearestNode(state, bot);
  for (const name of names) {
    const idx = nav.byName(name);
    if (idx < 0 || !nodeClear(state, idx)) continue;
    if (prev < 0) out.push(idx);
    else {
      const leg = nav.findPath(prev, idx, nav._out);
      if (leg.length > 1) { for (let i = 1; i < leg.length; i++) out.push(leg[i]); }
      else if (leg.length === 0) out.push(idx);
    }
    prev = idx;
  }
  return out;
}

const _m = { x: 0, z: 0 };

function moveToward(state, bot, tx, tz, dt, out) {
  const br = bot.brain;
  const dx = tx - bot.pos.x, dz = tz - bot.pos.z, d = Math.hypot(dx, dz);
  if (d < br.lastDist - 0.05) { br.lastDist = d; br.stuckT = 0; }
  else br.stuckT += dt;
  if (br.stuckT > 1.5 && br.detourT <= 0) {
    br.stuckT = 0; br.detourT = 1.0;
    br.detourDir = state.rng() < 0.5 ? 1 : -1;
    br.lastDist = 1e9;
  }
  let mx, mz;
  if (br.detourT > 0 && d > 0.01) {
    br.detourT -= dt;
    mx = -dz / d * br.detourDir; mz = dx / d * br.detourDir;
  } else if (d > 0.01) { mx = dx / d; mz = dz / d; }
  else { mx = 0; mz = 0; }
  if (mx || mz) {
    bot.yaw += clamp(wrapAngle(Math.atan2(-mx, -mz) - bot.yaw), -6 * dt, 6 * dt);
  }
  out.x = mx; out.z = mz;
  return d;
}

export function onNoise(state, bot, n) {
  const br = bot.brain;
  if (bot.hasFuse) return;
  if (n.team && n.team === bot.team) return;
  if (state.time - n.t > 6) return;
  const d = Math.hypot(n.x - bot.pos.x, n.z - bot.pos.z);
  if (d > n.r) return;
  br.lastKnown = { x: n.x, z: n.z, t: state.time };
  if (br.state !== 'engage' && br.state !== 'plant' && br.state !== 'defuse') br.state = 'investigate';
}

function callout(state, bot, enemy) {
  const br = bot.brain;
  if (state.time - br.callT < 5) return;
  br.callT = state.time;
  const n = nearestNode(state, enemy);
  const name = n >= 0 ? state.nodes[n][0] : 'mid';
  state.killfeed.push({ text: `${bot.name}: contact at ${name}`, head: false, t: state.time });
  if (state.killfeed.length > 5) state.killfeed.shift();
  state.spottedT[enemy.id] = state.time;
  const flag = n >= 0 ? state.nodes[n][4] & 6 : 0;
  let moved = false;
  for (const m of state.agents) {
    if (!m.isBot || !m.alive || m.team !== bot.team || m === bot || !m.brain) continue;
    m.brain.lastKnown = { x: enemy.pos.x, z: enemy.pos.z, t: state.time };
    if (!moved && flag && m.team === 'bastion' && m.brain.state === 'holdAngle' && m.brain.plan === 'anchor') {
      const hold = state.nodes[m.brain.route[0]];
      const holdFlag = hold ? hold[4] & 6 : 0;
      if (holdFlag && holdFlag !== flag) {
        m.brain.route = routeTo(state, m, state.nav.byName(flag === 4 ? 'BoilerCenter' : 'PansCenter'));
        m.brain.routeI = 0;
        m.brain.state = 'followRoute';
        moved = true;
      }
    }
  }
}

function botUtility(state, bot, dt) {
  const br = bot.brain;
  br.utilT -= dt;
  if (br.utilT > 0) return;
  br.utilT = 1;
  if (!br.usedUtil && bot.team === 'strand') {
    for (const [node, kind, tx, tz] of LINEUPS) {
      const idx = state.nav.byName(node);
      if (idx < 0) continue;
      const n = state.nodes[idx];
      if (Math.hypot(n[1] - bot.pos.x, n[2] - bot.pos.z) < 8 && bot.nades[kind] > 0) {
        bot.nadeSel = kind;
        if (throwGrenade(state, bot, false, tx, 1, tz)) { br.usedUtil = true; return; }
      }
    }
  }
  if (br.target && br.target.alive && bot.nades.shard > 0 && state.time - (br.fragT || 0) > 8 && state.rng() < 0.12) {
    bot.nadeSel = 'shard';
    if (throwGrenade(state, bot, false, br.target.pos.x, 1, br.target.pos.z)) br.fragT = state.time;
  }
}

function botTick(state, bot, dt) {
  const br = bot.brain, sk = br.skill;
  if (!bot.alive) return;
  if (bot.flashT > 0 && br.target) { br.target = null; br.state = 'followRoute'; }
  if (state.phase !== 'live' && state.phase !== 'planted') {
    setCrouch(state, bot, false, dt);
    stepAgent(state, bot, 0, 0, 0, false, dt);
    return;
  }
  br.scanT -= dt;
  if (br.scanT <= 0) {
    br.scanT = 2 / 64;
    for (const n of state.noise) if (n.t > br.lastNoiseT) onNoise(state, bot, n);
    br.lastNoiseT = state.time;
    let enemy = null, bd = 1e9;
    for (const a of state.agents) {
      if (!a.alive || a.team === bot.team || a === bot) continue;
      const d = (a.pos.x - bot.pos.x) ** 2 + (a.pos.z - bot.pos.z) ** 2;
      if (d < bd) { bd = d; enemy = a; }
    }
    if (enemy && canSee(state, bot, enemy)) {
      if (br.target !== enemy) {
        br.target = enemy;
        br.reactT = sk.react[0] + state.rng() * (sk.react[1] - sk.react[0]);
        br.aimX = (state.rng() - 0.5) * 2 * sk.aimErr;
        br.aimY = (state.rng() - 0.5) * 2 * sk.aimErr;
        br.crouch = state.rng() < 0.4;
        callout(state, bot, enemy);
      }
      br.state = 'engage';
    } else if (br.target && br.state === 'engage') {
      br.target = null;
      br.state = 'followRoute';
    }
  }
  botUtility(state, bot, dt);
  let moveX = 0, moveZ = 0, speed = 0, wantCrouch = false, wantFire = false;
  const w = activeWeapon(bot);
  if (br.state !== br.prevState) { br.prevState = br.state; br.lastDist = 1e9; br.stuckT = 0; br.detourT = 0; }
  if (br.routeI !== br.lastRouteI) { br.lastRouteI = br.routeI; br.lastDist = 1e9; br.stuckT = 0; }
  if (br.state === 'engage' && br.target && br.target.alive) {
    const t = br.target;
    const ty = t.pos.y + t.eyeHeight - (state.rng() < sk.head ? 0.35 : 0.05);
    const dist = Math.hypot(t.pos.x - bot.pos.x, t.pos.z - bot.pos.z);
    const rx = Math.cos(bot.yaw), rz = -Math.sin(bot.yaw);
    aimAt(bot, t.pos.x + rx * br.aimX * dist, ty + br.aimY * dist, t.pos.z + rz * br.aimX * dist, dt, 9);
    br.reactT -= dt;
    if (br.reactT <= 0) {
      wantCrouch = br.crouch && w.cls === 'rifle';
      if (br.burstLeft <= 0) {
        br.burstPause -= dt;
        if (br.burstPause <= 0) {
          br.burstLeft = sk.burst[0] + Math.floor(state.rng() * (sk.burst[1] - sk.burst[0] + 1));
          br.aimX = (state.rng() - 0.5) * 2 * sk.aimErr;
          br.aimY = (state.rng() - 0.5) * 2 * sk.aimErr;
        }
      }
      if (br.burstLeft > 0) {
        wantFire = true;
        br.burstLeft--;
        if (br.burstLeft === 0) br.burstPause = 0.35 + state.rng() * 0.3;
      }
    }
  } else if (br.state === 'holdAngle') {
    const n = state.nodes[br.route[0]];
    if (n) {
      const d = moveToward(state, bot, n[1], n[2], dt, _m);
      if (d > 2) { moveX = _m.x; moveZ = _m.z; speed = MOVE.speed[w.cls]; }
      else if (n[5] != null) {
        const hy = n[5] * Math.PI / 180;
        aimAt(bot, bot.pos.x - Math.sin(hy), bot.pos.y + bot.eyeHeight, bot.pos.z - Math.cos(hy), dt, 4);
      }
    }
  } else if (br.state === 'plant') {
    const z = state.zones;
    const inBoiler = Math.hypot(bot.pos.x - z.siteBoiler.cx, bot.pos.z - z.siteBoiler.cz) < z.siteBoiler.r;
    const c = inBoiler ? z.siteBoiler : z.sitePans;
    const dx = c.cx - bot.pos.x, dz = c.cz - bot.pos.z, d = Math.hypot(dx, dz);
    if (d > 2) { moveX = dx / d; moveZ = dz / d; speed = MOVE.speed[w.cls]; }
    else plantCharge(state, bot, dt);
  } else if (br.state === 'investigate') {
    const lk = br.lastKnown;
    if (!lk || state.time - lk.t > 6) br.state = 'followRoute';
    else {
      const d = moveToward(state, bot, lk.x, lk.z, dt, _m);
      if (d > 1.5) { moveX = _m.x; moveZ = _m.z; speed = MOVE.speed[w.cls] * 0.7; }
      else {
        aimAt(bot, lk.x, bot.pos.y + bot.eyeHeight, lk.z, dt, 4);
        br.invT += dt;
        if (br.invT > 1.5) { br.invT = 0; br.state = 'followRoute'; }
      }
    }
  } else if (br.state === 'defuse') {
    const f = state.fuse;
    if (f && f.planted) {
      const dx = f.x - bot.pos.x, dz = f.z - bot.pos.z, d = Math.hypot(dx, dz);
      if (d > 1.6) { moveX = dx / d; moveZ = dz / d; speed = MOVE.speed[w.cls]; }
      else defuseCharge(state, bot, dt);
    } else br.state = 'followRoute';
  } else {
    if (br.route.length && br.routeI < br.route.length) {
      br.smoothT -= dt;
      if (br.smoothT <= 0) {
        br.smoothT = 0.5;
        for (let j = br.route.length - 1; j > br.routeI; j--) {
          const n = nodePos(state, br.route[j], _d);
          if (walkClear(state, bot.pos.x, bot.pos.z, n.x, n.z)) { br.routeI = j; break; }
        }
      }
      const n = nodePos(state, br.route[br.routeI], _d);
      const dx = n.x - bot.pos.x, dz = n.z - bot.pos.z;
      const d = Math.hypot(dx, dz);
      const dy = n.y - bot.pos.y;
      if (d < 0.6 && Math.abs(dy) < 0.6) {
        if (state.nodes[br.route[br.routeI]][4] & 1) br.pieT = 0.7;
        br.routeI++;
      } else {
        moveToward(state, bot, n.x, n.z, dt, _m);
        moveX = _m.x; moveZ = _m.z;
        speed = MOVE.speed[w.cls];
        if (br.pieT > 0) { br.pieT -= dt; speed *= 0.5; }
      }
      if (dy > 0.45 && d < 2) bot._wantJump = true;
    } else if (br.state === 'followRoute') {
      if (bot.team === 'strand') {
        const flag = br.plan === 'rushBoiler' ? 4 : 2;
        const site = br.plan === 'rushBoiler' ? 'BoilerCenter' : 'PansCenter';
        if (bot.hasFuse) {
          br.route = routeTo(state, bot, state.nav.byName(site));
          br.routeI = 0;
        } else {
          const cands = [];
          for (let i = 0; i < state.nodes.length; i++) {
            const n = state.nodes[i];
            if ((n[4] & flag) && (n[4] & 1)) cands.push(i);
          }
          if (cands.length) {
            br.route = [cands[Math.floor(state.rng() * cands.length)]];
            br.routeI = 0;
            br.state = 'holdAngle';
          } else {
            br.route = routeTo(state, bot, state.nav.byName(site));
            br.routeI = 0;
          }
        }
      } else br.state = 'holdAngle';
    }
  }
  if (state.phase === 'planted') {
    if (bot.team === 'strand' && br.state !== 'engage' && br.state !== 'holdAngle') {
      const site = state.fuse.site === 'boiler' ? 4 : 2;
      let n0 = -1, count = 0;
      for (let i = 0; i < state.nodes.length; i++) {
        const n = state.nodes[i];
        if ((n[4] & site) && (n[4] & 1) && state.rng() < 1 / ++count) n0 = i;
      }
      if (n0 >= 0) { br.route = [n0]; br.routeI = 0; br.state = 'holdAngle'; }
    } else if (bot.team === 'bastion' && br.state !== 'engage' && br.state !== 'defuse') {
      const mates = state.agents.filter((a) => a.isBot && a.team === 'bastion' && a.alive && a !== bot).length;
      if (mates >= 1 || state.roundT < 15) br.state = 'defuse';
    }
  } else if (state.phase === 'live' && bot.hasFuse && br.state !== 'engage') {
    const z = state.zones;
    const near = Math.hypot(bot.pos.x - z.sitePans.cx, bot.pos.z - z.sitePans.cz) < z.sitePans.r
      || Math.hypot(bot.pos.x - z.siteBoiler.cx, bot.pos.z - z.siteBoiler.cz) < z.siteBoiler.r;
    if (near) br.state = 'plant';
    else if (br.state === 'plant') br.state = 'followRoute';
  }
  setCrouch(state, bot, wantCrouch, dt);
  const jump = !!bot._wantJump; bot._wantJump = false;
  if (moveX || moveZ) {
    const len = Math.hypot(moveX, moveZ);
    stepAgent(state, bot, moveX / len, moveZ / len, speed, jump, dt);
  } else stepAgent(state, bot, 0, 0, 0, jump, dt);
  for (const o of state.agents) {
    if (o === bot || !o.alive) continue;
    const dx = bot.pos.x - o.pos.x, dz = bot.pos.z - o.pos.z, d2 = dx * dx + dz * dz;
    if (d2 < 0.64 && d2 > 1e-6) {
      const d = Math.sqrt(d2), k = 3 * dt / d;
      bot.pos.x += dx * k; bot.pos.z += dz * k;
    }
  }
  const aw = activeWeapon(bot);
  const am = bot.ammo[bot.weapons[bot.active]];
  if (am && am.mag === 0 && am.reserve === 0 && bot.weapons.length > 1) {
    const pi = bot.weapons.indexOf('wren');
    if (pi >= 0 && pi !== bot.active) switchWeapon(state, bot, pi);
  }
  if (wantFire) tryFire(state, bot, true, true);
  const moved = Math.hypot(bot.pos.x - bot.prevPos.x, bot.pos.z - bot.prevPos.z);
  bot._walkPhase = (bot._walkPhase || 0) + moved * 2.2;
  bot._speed = moved / dt;
}

export function updateBots(state, dt) {
  for (const a of state.agents) {
    if (a.isBot) botTick(state, a, dt);
  }
}

export function driveAgent(state, a, dt) { botTick(state, a, dt); }
