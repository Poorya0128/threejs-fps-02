// SALTLINE main.js — boot, fixed-step loop.
import * as THREE from 'three';
import { TICK, MAX_TICKS_PER_FRAME, MOVE, RENDER, ROUND, BOT, INPUT } from './config.js';
import { createState, createAgent } from './state.js';
import { mulberry32, clamp } from './math.js';
import { createInput, consumeLook } from './input.js';
import { stepAgent, setCrouch, wishDir } from './physics.js';
import { giveWeapon, updateWeapons, activeWeapon } from './weapons.js';
import { buildNav } from './nav.js';
import { MAP, buildBoxes } from './map.js';
import { createRenderer } from './render.js';
import { buildLighting } from './art/lighting.js';
import { buildWorld } from './art/geo.js';
import { createHud } from './hud.js';
import { createViewmodel } from './art/viewmodel.js';
import { createFx } from './art/fx.js';
import { createCharacters } from './art/characters.js';
import { createAudio } from './audio.js';
import { spawnBots, onRoundStart, updateBots, driveAgent, createBrain } from './bots.js';
import { initGrenades, updateGrenades } from './grenades.js';
import { buyItem } from './economy.js';
import { startRound, updateRounds, spectateTarget, cycleSpectate, plantCharge, defuseCharge } from './rounds.js';
import { applyScenario } from './scenarios.js';

const params = new URLSearchParams(location.search);
const SEED = Number(params.get('seed') ?? 1337);
const AUTOPLAY = params.get('autoplay') === '1';
const SPEED = clamp(Number(params.get('speed') ?? 1), 1, 16);
const CAM = params.get('cam');
const SCENARIO = params.get('scenario');
const NO_RENDER = params.get('norender') === '1';
const DIFF = params.get('diff') || 'regular';

window.__saltline = {
  ready: false, round: 1, phase: 'live', score: { strand: 0, bastion: 0 },
  roundsPlayed: 0, matchOver: false, lastWinReason: null, scenarioReady: false,
  stats: { drawCalls: 0, triangles: 0, frameMs: 0 },
  shots: { fired: 0, hits: 0, heads: 0, kills: 0 },
};

const boxes = buildBoxes();
const state = createState(SEED, MAP);
state.rng = mulberry32(SEED);
state.boxes = boxes;
state.difficulty = DIFF;
state.autoplay = AUTOPLAY;
initGrenades(state);
const nav = buildNav(MAP, boxes);
state.links = nav.links;
window.__saltline.shots = state.shots;

const player = state.player;
giveWeapon(player, 'wren');
giveWeapon(player, 'cutlass');
for (let i = 1; i <= 9; i++) {
  const team = i <= 4 ? 'strand' : 'bastion';
  const sp = MAP.spawns[team];
  const b = createAgent(i, team, true, sp[0], sp[1], team === 'strand' ? 0 : Math.PI);
  state.agents.push(b);
}
if (AUTOPLAY) player.brain = createBrain(BOT[state.difficulty] || BOT.regular);

const holder = document.getElementById('game');
const R = createRenderer(holder);
buildLighting(R.renderer, R.scene, MAP);
R.vmScene.environment = R.scene.environment;
R.vmScene.environmentIntensity = RENDER.envIntensity;
R.vmScene.add(new THREE.HemisphereLight(0x8aa6d1, 0xa4886a, 0.6));
const hud = createHud();
const vm = createViewmodel(R.vmScene);
const fx = createFx(R.scene);
const chars = createCharacters(R.scene);
const audio = createAudio();
const { lockPointer } = createInput(R.renderer.domElement, state.input);

buildWorld(R.scene, boxes);

let acc = 0, last = performance.now(), firstFrame = true;
let frameCount = 0, prevJump = false;
const _wd = new THREE.Vector3();
const TITLE = !AUTOPLAY && !SCENARIO && !CAM;
let matchStarted = false;

function beginMatch() {
  if (matchStarted) return;
  matchStarted = true;
  spawnBots(state, nav);
  if (!SCENARIO) { startRound(state); onRoundStart(state); }
}
let started = !TITLE;
if (TITLE) {
  state.paused = true;
  document.getElementById('title').style.display = '';
} else {
  beginMatch();
}
if (SCENARIO) applyScenario(state, SCENARIO, () => tickOnce(TICK));

const titleEl = document.getElementById('title');
const pauseEl = document.getElementById('pause');
function deploy() {
  const sel = document.querySelector('input[name="diff"]:checked');
  if (sel) state.difficulty = sel.value;
  beginMatch();
  titleEl.style.display = 'none';
  pauseEl.style.display = 'none';
  state.paused = false;
  started = true;
  lockPointer();
}
document.getElementById('deploy').addEventListener('click', deploy);
document.getElementById('resume').addEventListener('click', deploy);
document.getElementById('restart').addEventListener('click', () => location.reload());
for (const [id, fn] of [['set-sens', (v) => { INPUT.mouseSens = Number(v); }], ['set-fov', (v) => { INPUT.fov = Number(v); }], ['set-vol', (v) => audio.setVolume(Number(v))]]) document.getElementById(id).addEventListener('input', (e) => fn(e.target.value));
document.getElementById('set-diff').addEventListener('change', (e) => {
  state.difficulty = e.target.value;
  for (const a of state.agents) if (a.brain) a.brain.skill = BOT[state.difficulty];
  if (player.brain) player.brain.skill = BOT[state.difficulty];
});
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === R.renderer.domElement;
  if (!locked && started && !state.paused && !state.matchOver && !SCENARIO && !state.buyOpen) {
    state.paused = true;
    pauseEl.style.display = '';
  }
});

if (SCENARIO || CAM) document.getElementById('hud-hint').style.display = 'none';
let camMode = null;
if (CAM) {
  const [x, y, z, yaw, pitch] = CAM.split(',').map(Number);
  camMode = { x, y, z, yaw: yaw * Math.PI / 180, pitch: pitch * Math.PI / 180 };
  player.pos.set(x, 0, z); player.prevPos.copy(player.pos);
  player.yaw = camMode.yaw; player.pitch = camMode.pitch;
  document.getElementById('hud').style.display = params.get('hud') === '1' ? '' : 'none';
}

function tickOnce(dt) {
  const p = player;
  if (state.newRound) { state.newRound = false; onRoundStart(state); }
  state.input.buyOpen = state.buyOpen;
  if (state.phase === 'buy' && !state.buyOpen && !SCENARIO) state.buyOpen = true;
  if (state.phase !== 'buy' && state.buyOpen) state.buyOpen = false;
  if (state.input.buyToggle) {
    state.input.buyToggle = false;
    if (state.phase === 'buy') state.buyOpen = !state.buyOpen;
  }
  if (state.buyOpen && document.pointerLockElement) document.exitPointerLock();
  if (state.buyOpen && state.input.buyKey) buyItem(state, p, state.input.buyKey);
  state.input.buyKey = '';
  if (AUTOPLAY) {
    driveAgent(state, p, dt);
  } else if (p.alive) {
    const look = consumeLook(state.input);
    if (p.scoped) {
      const k = p.scopeLevel === 2 ? 0.15 : 0.4;
      look.dx *= k; look.dy *= k;
    }
    if (state.input.locked) {
      p.yaw -= look.dx;
      p.pitch = clamp(p.pitch - look.dy, -1.55, 1.55);
    }
    const frozen = state.phase === 'buy' || state.paused;
    setCrouch(state, p, state.input.crouch && !frozen, dt);
    if (!frozen) {
      const n = wishDir(p.yaw, state.input.f, state.input.b, state.input.l, state.input.r, _wd);
      const w = activeWeapon(p);
      let speed = MOVE.speed[w.cls] ?? MOVE.defaultSpeed;
      if (state.input.walk) speed *= MOVE.walkMul;
      if (p.crouch > 0.5) speed *= MOVE.crouchMul;
      if (p.scoped) speed *= MOVE.scopeMul;
      if (n) stepAgent(state, p, _wd.x, _wd.z, speed, state.input.jump, dt);
      else stepAgent(state, p, 0, 0, 0, state.input.jump, dt);
      if (state.input.interact) {
        if (p.hasFuse && state.phase === 'live') plantCharge(state, p, dt);
        else if (state.phase === 'planted') defuseCharge(state, p, dt);
      } else { p.plantT = 0; p.defuseT = 0; }
    } else {
      stepAgent(state, p, 0, 0, 0, false, dt);
    }
  }
  if (!p.alive) {
    if (state.input.jump && !prevJump) cycleSpectate(state);
    prevJump = state.input.jump;
  }
  updateBots(state, dt);
  updateWeapons(state, dt);
  updateGrenades(state, dt);
  updateRounds(state, dt);
  state.tick++; state.time += dt;
}

function frame(now) {
  requestAnimationFrame(frame);
  const frameMs = now - last;
  last = now;
  const dt = Math.min(frameMs / 1000, 0.1);
  if (!state.paused && !state.scenarioDone) {
    if (!camMode) {
      acc += dt;
      let n = 0;
      while (acc >= TICK && n < MAX_TICKS_PER_FRAME) { tickOnce(TICK); acc -= TICK; n++; }
      if (n === MAX_TICKS_PER_FRAME) acc = 0;
      if (AUTOPLAY) { for (let i = 0; i < SPEED - 1; i++) tickOnce(TICK); }
    } else if (frameCount < 4) {
      tickOnce(TICK); tickOnce(TICK);
    }
  }
  const spec = spectateTarget(state);
  const camAgent = spec || player;
  if (!NO_RENDER) {
    const alpha = camMode ? 1 : clamp(acc / TICK, 0, 1);
    R.placeCamera(camAgent, alpha);
    const t0 = performance.now();
    R.renderFrame(state.time);
    if (spec) vm.group.visible = false;
    else { vm.group.visible = true; vm.update(state, dt); }
    fx.update(state, vm, state.scenarioDone ? 0 : dt, chars);
    chars.update(state, dt);
    audio.update(state);
    const info = R.renderer.info;
    window.__saltline.stats.drawCalls = info.render.calls;
    window.__saltline.stats.triangles = info.render.triangles;
    window.__saltline.stats.frameMs = performance.now() - t0;
    hud.update(state, camAgent);
  }
  const sl = window.__saltline;
  sl.round = state.round; sl.phase = state.phase;
  sl.score.strand = state.score.strand; sl.score.bastion = state.score.bastion;
  sl.roundsPlayed = state.roundsPlayed; sl.matchOver = state.matchOver;
  sl.lastWinReason = state.lastWinReason;
  if (firstFrame) { firstFrame = false; window.__saltline.ready = true; }
  frameCount++;
  if ((camMode || SCENARIO) && frameCount >= 6 && !window.__saltline.scenarioReady) {
    window.__saltline.scenarioReady = true;
  }
}
requestAnimationFrame(frame);
