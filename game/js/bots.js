// SALTLINE bots.js — bot brain: FSM, routes, holds, canSee, aiming
// (PLAN.md §9). Shares physics/weapons/economy code with the player.
// Hearing, callouts and retakes are M4 (PLAN.md §15).
import { BOT, MOVE } from './config.js';
import { clamp, damp, rayAABB } from './math.js';
import { stepAgent, setCrouch } from './physics.js';
import { giveWeapon, switchWeapon, activeWeapon, tryFire } from './weapons.js';
import { buyItem } from './economy.js';
import { plantCharge, defuseCharge } from './rounds.js';

const _d = { x: 0, y: 0, z: 0 };

export function createBrain(skill) {
  return {
    skill, state: 'buy', route: [], routeI: 0,
    target: null, reactT: 0, aimX: 0, aimY: 0, crouch: false,
    burstLeft: 0, burstPause: 0, scanT: 0, pieT: 0, smoothT: 0,
    plan: null, lastDist: 1e9, stuckT: 0, detourT: 0, detourDir: 1,
    prevState: null, lastRouteI: -1,
  };
}

// Spawn the 9 bots (4 Strand, 5 Bastion) with Talon loadouts.
export function spawnBots(state, nav) {
  for (const a of state.agents) {
    if (!a.isBot) continue;
    a.brain = createBrain(BOT[state.difficulty] || BOT.regular);
    giveWeapon(a, 'talon'); giveWeapon(a, 'wren'); giveWeapon(a, 'cutlass');
    a.active = 0;
  }
  state.nav = nav;
}

// Team strategy at round start (§9.2): routes per bot + buying.
export function onRoundStart(state) {
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
  });
  // Bastion: 2 Pans anchors, 2 Boiler anchors, 1 Pumphouse rotator.
  const holds = [...plans.bastion.pans, ...plans.bastion.boiler];
  bastionBots.forEach((b, i) => {
    b.brain.route = [nav.byName(i < 4 ? holds[i] : plans.bastion.rotator)];
    b.brain.routeI = 0;
    b.brain.state = i < 4 ? 'holdAngle' : 'followRoute';
    b.brain.plan = i < 4 ? 'anchor' : 'rotator';
  });
  // Buying by team average money: eco / force / full (§4.4).
  for (const t of ['strand', 'bastion']) {
    const team = state.agents.filter((a) => a.team === t);
    const avg = team.reduce((s, a) => s + a.money, 0) / team.length;
    for (const b of team) {
      if (!b.isBot) continue;
      if (avg >= 3400) { buyItem(state, b, 'armor'); if (b.id % 3 === 0) buyItem(state, b, 'longbow'); }
      else if (avg >= 2000) buyItem(state, b, 'armor');
      if (t === 'bastion' && avg >= 2400) buyItem(state, b, 'cutters');
    }
  }
}

// One ray vs all world boxes; true when a wall is closer than the target.
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

// Line of sight: within FOV 110°, range 60 m, ray to head or chest clear.
export function canSee(state, bot, target) {
  if (bot.flashT > 0) return false;
  const dx = target.pos.x - bot.pos.x, dz = target.pos.z - bot.pos.z;
  const dist = Math.hypot(dx, dz);
  if (dist > 60 || dist < 0.05) return false;
  const fx = -Math.sin(bot.yaw), fz = -Math.cos(bot.yaw);
  if ((dx * fx + dz * fz) / dist < Math.cos(55 * Math.PI / 180)) return false;
  const ey = bot.pos.y + bot.eyeHeight;
  const ty = target.pos.y + target.eyeHeight;
  return !rayBlocked(state, bot.pos.x, ey, bot.pos.z, dx, ty + 0.05 - ey, dz)
    || !rayBlocked(state, bot.pos.x, ey, bot.pos.z, dx, ty - 0.3 - ey, dz);
}

function nodePos(state, i, out) {
  const n = state.nodes[i];
  out.x = n[1]; out.z = n[2]; out.y = n[3];
  return out;
}

// Straight walk between two points: clear of AABBs at knee and chest height.
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
  // Aim minus accumulated recoil: viewDir adds recoil on top of
  // yaw/pitch, and an uncompensating bot sprays over the target.
  const yaw = Math.atan2(-dx, -dz) - bot.recoil.yaw;
  const pitch = Math.atan2(dy, Math.hypot(dx, dz)) - bot.recoil.pitch;
  let dyaw = yaw - bot.yaw;
  while (dyaw > Math.PI) dyaw -= 2 * Math.PI;
  while (dyaw < -Math.PI) dyaw += 2 * Math.PI;
  bot.yaw += dyaw * (1 - Math.exp(-rate * dt));
  bot.pitch = damp(bot.pitch, clamp(pitch, -1.55, 1.55), rate, dt);
}

// A* from the bot's nearest node to a goal node; falls back to [goal].
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

// A node is unwalkable when it sits deep inside a tall box: the capsule
// (r 0.4) can stand at most 0.2 m inside a wall face and still reach the
// 0.6 m arrival radius. Floor plates and steps are fine.
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

// Expand a plan route (node names) into a graph path: A* between
// consecutive waypoints, skipping waypoints inside walls. Some legs
// cross walls (YardGate→ConveyorStart crosses the x=-32 wall).
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
      else if (leg.length === 0) out.push(idx); // no graph path: straight line
    }
    prev = idx;
  }
  return out;
}

const _m = { x: 0, z: 0 };

// Move toward (tx,tz) with a stuck-detour. The graph is sparse and some
// legs cross walls it never linked, so a bot can push into a wall forever.
// If it has not closed on the point for 1.5 s, it sidesteps along the
// wall for a second, then retries. Returns the distance.
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
    const want = Math.atan2(-mx, -mz);
    let dyaw = want - bot.yaw;
    while (dyaw > Math.PI) dyaw -= 2 * Math.PI;
    while (dyaw < -Math.PI) dyaw += 2 * Math.PI;
    bot.yaw += clamp(dyaw, -6 * dt, 6 * dt);
  }
  out.x = mx; out.z = mz;
  return d;
}

// One bot tick: sense, decide, move, shoot.
function botTick(state, bot, dt) {
  const br = bot.brain, sk = br.skill;
  if (!bot.alive) return;
  // Frozen outside live play: buy / post / match-end phases stand still.
  if (state.phase !== 'live' && state.phase !== 'planted') {
    setCrouch(state, bot, false, dt);
    stepAgent(state, bot, 0, 0, 0, false, dt);
    return;
  }
  // Sense (staggered: each bot scans every 2nd tick).
  br.scanT -= dt;
  if (br.scanT <= 0) {
    br.scanT = 2 / 64;
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
        br.crouch = state.rng() < 0.4; // decided once per engagement
      }
      br.state = 'engage';
    } else if (br.target && br.state === 'engage') {
      br.target = null;
      br.state = 'followRoute';
    }
  }
  // Decide / move.
  let moveX = 0, moveZ = 0, speed = 0, wantCrouch = false, wantFire = false;
  const w = activeWeapon(bot);
  // Reset stuck tracking on a state change or a new route node.
  if (br.state !== br.prevState) { br.prevState = br.state; br.lastDist = 1e9; br.stuckT = 0; br.detourT = 0; }
  if (br.routeI !== br.lastRouteI) { br.lastRouteI = br.routeI; br.lastDist = 1e9; br.stuckT = 0; }
  if (br.state === 'engage' && br.target && br.target.alive) {
    const t = br.target;
    const ty = t.pos.y + t.eyeHeight - (state.rng() < sk.head ? 0.35 : 0.05);
    // Aim error scales with distance (angular error, §9.2).
    const dist = Math.hypot(t.pos.x - bot.pos.x, t.pos.z - bot.pos.z);
    const rx = Math.cos(bot.yaw), rz = -Math.sin(bot.yaw);
    aimAt(bot, t.pos.x + rx * br.aimX * dist, ty + br.aimY * dist, t.pos.z + rz * br.aimX * dist, dt, 9);
    br.reactT -= dt;
    if (br.reactT <= 0) {
      // Stop or crouch before firing; burst-fire at range (§9.2).
      wantCrouch = br.crouch && w.cls === 'rifle';
      if (br.burstLeft <= 0) {
        br.burstPause -= dt;
        if (br.burstPause <= 0) {
          br.burstLeft = sk.burst[0] + Math.floor(state.rng() * (sk.burst[1] - sk.burst[0] + 1));
          // Fresh aim error each burst: a fixed error for a whole
          // engagement makes long duels binary (always hit or always miss).
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
    // Walk to the hold node first (with the stuck-detour), then face its hold yaw.
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
    // Plant at the site the carrier is in (state.fuse.site is null
    // until the plant completes, so it cannot pick the target).
    const z = state.zones;
    const inBoiler = Math.hypot(bot.pos.x - z.siteBoiler.cx, bot.pos.z - z.siteBoiler.cz) < z.siteBoiler.r;
    const c = inBoiler ? z.siteBoiler : z.sitePans;
    const dx = c.cx - bot.pos.x, dz = c.cz - bot.pos.z, d = Math.hypot(dx, dz);
    if (d > 2) { moveX = dx / d; moveZ = dz / d; speed = MOVE.speed[w.cls]; }
    else plantCharge(state, bot, dt);
  } else if (br.state === 'defuse') {
    const f = state.fuse;
    if (f && f.planted) {
      const dx = f.x - bot.pos.x, dz = f.z - bot.pos.z, d = Math.hypot(dx, dz);
      if (d > 1.6) { moveX = dx / d; moveZ = dz / d; speed = MOVE.speed[w.cls]; }
      else defuseCharge(state, bot, dt);
    } else br.state = 'followRoute';
  } else { // followRoute / buy
    if (br.route.length && br.routeI < br.route.length) {
      // Skip to the farthest visible route node (§9.1), twice a second.
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
        // Cover nodes: slow to walk speed and pie the corner (§9.2).
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
      // Route done: the carrier A*s to the site centre; other attackers
      // hold a cover node at the target site; defenders hold.
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
  // Objective transitions.
  if (state.phase === 'planted') {
    if (bot.team === 'strand' && br.state !== 'engage') {
      // Guard the Fuse: hold a site node facing the approaches (§9.2).
      const site = state.fuse.site === 'boiler' ? 4 : 2;
      const cands = state.nodes.map((n, i) => [i, n]).filter(([, n]) => (n[4] & site) && (n[4] & 1));
      if (cands.length && br.state !== 'holdAngle') {
        br.route = [cands[Math.floor(state.rng() * cands.length)][0]];
        br.routeI = 0;
        br.state = 'holdAngle';
      }
    } else if (bot.team === 'bastion' && br.state !== 'engage' && br.state !== 'defuse') {
      // Retake together: wait for a teammate unless time is short (§9.2).
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
  // Move + shoot.
  setCrouch(state, bot, wantCrouch, dt);
  const jump = !!bot._wantJump; bot._wantJump = false;
  if (moveX || moveZ) {
    const len = Math.hypot(moveX, moveZ);
    stepAgent(state, bot, moveX / len, moveZ / len, speed, jump, dt);
  } else stepAgent(state, bot, 0, 0, 0, jump, dt);
  // Separation: don't stack in doorways (§9.1).
  for (const o of state.agents) {
    if (o === bot || !o.alive) continue;
    const dx = bot.pos.x - o.pos.x, dz = bot.pos.z - o.pos.z, d2 = dx * dx + dz * dz;
    if (d2 < 0.64 && d2 > 1e-6) {
      const d = Math.sqrt(d2), k = 3 * dt / d;
      bot.pos.x += dx * k; bot.pos.z += dz * k;
    }
  }
  // Dry weapon: switch to the pistol.
  const aw = activeWeapon(bot);
  const am = bot.ammo[bot.weapons[bot.active]];
  if (am && am.mag === 0 && am.reserve === 0 && bot.weapons.length > 1) {
    const pi = bot.weapons.indexOf('wren');
    if (pi >= 0 && pi !== bot.active) switchWeapon(state, bot, pi);
  }
  if (wantFire) tryFire(state, bot, true, true);
  // Walk phase for the character rig (distance travelled).
  const moved = Math.hypot(bot.pos.x - bot.prevPos.x, bot.pos.z - bot.prevPos.z);
  bot._walkPhase = (bot._walkPhase || 0) + moved * 2.2;
  bot._speed = moved / dt;
}

export function updateBots(state, dt) {
  for (const a of state.agents) {
    if (a.isBot) botTick(state, a, dt);
  }
}

// The autoplay player slot is driven by the same brain (AGENTS.md).
export function driveAgent(state, a, dt) { botTick(state, a, dt); }
