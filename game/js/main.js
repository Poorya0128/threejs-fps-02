// SALTLINE main.js — boot, fixed-step loop, wiring (PLAN.md §5.1/§5.2).
// M1: move in the map. The sim runs at 64 Hz with an accumulator (max 5
// ticks/frame); rendering interpolates between ticks. Mouse look applies per
// frame for responsiveness; the sim reads view angles at each tick.
import * as THREE from 'three';
import { TICK, MAX_TICKS_PER_FRAME, MOVE, RENDER } from './config.js';
import { createState, createAgent } from './state.js';
import { mulberry32, clamp } from './math.js';
import { createInput, consumeLook } from './input.js';
import { stepAgent, setCrouch, wishDir } from './physics.js';
import { giveWeapon, updateWeapons, activeWeapon } from './weapons.js';
import { buildNav } from './nav.js';
import { MAP, buildBoxes } from './map.js';
import { createRenderer, buildDebugOverlay } from './render.js';
import { buildLighting } from './art/lighting.js';
import { buildWorld } from './art/geo.js';
import { createHud } from './hud.js';
import { createViewmodel } from './art/viewmodel.js';
import { createFx } from './art/fx.js';
import { createAudio } from './audio.js';

const params = new URLSearchParams(location.search);
const SEED = Number(params.get('seed') ?? 1337);
const AUTOPLAY = params.get('autoplay') === '1';
const SPEED = clamp(Number(params.get('speed') ?? 1), 1, 16);
const DEBUG = params.get('debug') === '1';
const CAM = params.get('cam');
const SCENARIO = params.get('scenario');
const YAW0 = Number(params.get('yaw') ?? 0) * Math.PI / 180; // test aid: initial aim
const PITCH0 = Number(params.get('pitch') ?? 0) * Math.PI / 180;
const NO_POST = params.get('post') === '0'; // debug only: bypass the post chain

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
const nav = buildNav(MAP, boxes);
state.links = nav.links;
window.__saltline.shots = state.shots;

// M2 loadout: Talon (slot 1), Wren (slot 2), Cutlass (slot 3), Longbow
// (slot 4, so the scope can be tried). Buy menu (M4) sets the real loadout.
giveWeapon(state.player, 'talon');
giveWeapon(state.player, 'wren');
giveWeapon(state.player, 'cutlass');
giveWeapon(state.player, 'longbow');
const DUMMIES = [[-36, 14], [-28, 2], [-27, -20], [-16, -26]];
for (let i = 0; i < DUMMIES.length; i++) {
  const d = createAgent(i + 1, 'bastion', true, DUMMIES[i][0], DUMMIES[i][1], Math.PI);
  state.agents.push(d);
}

const holder = document.getElementById('game');
const R = createRenderer(holder);
R.noPost = NO_POST;
const lights = buildLighting(R.renderer, R.scene, MAP);
// Viewmodel shares the world environment + a weak fill so it never goes
// black (ART.md §9: same env as the world, plus camera-relative fill).
R.vmScene.environment = R.scene.environment;
R.vmScene.environmentIntensity = RENDER.envIntensity;
R.vmScene.add(new THREE.HemisphereLight(0x8aa6d1, 0xa4886a, 0.6));
const hud = createHud();
const vm = createViewmodel(R.vmScene);
const fx = createFx(R.scene);
const audio = createAudio();
const { lockPointer } = createInput(R.renderer.domElement, state.input);
state.player.yaw = YAW0; state.player.pitch = PITCH0;

// --- world meshes: one merged bevelled mesh per material (art/geo.js) ---
buildWorld(R.scene, boxes);

const debugGroup = buildDebugOverlay(R.scene, nav, boxes);
debugGroup.visible = DEBUG;

// --- camera / lookdev modes ---
const player = state.player;
let camMode = null;
if (CAM) {
  const [x, y, z, yaw, pitch] = CAM.split(',').map(Number);
  camMode = { x, y, z, yaw: yaw * Math.PI / 180, pitch: pitch * Math.PI / 180 };
  player.pos.set(x, 0, z); player.prevPos.copy(player.pos);
  player.yaw = camMode.yaw; player.pitch = camMode.pitch;
  document.getElementById('hud').style.display = params.get('hud') === '1' ? '' : 'none';
}

// --- autoplay driver (M1): walk forward, steer off walls, look around ---
const _wd = new THREE.Vector3();
let autoYaw = 0, autoTimer = 0;
function autoplayTick(dt) {
  autoTimer -= dt;
  if (autoTimer <= 0) { autoTimer = 2 + state.rng() * 3; autoYaw = (state.rng() - 0.5) * 1.6; }
  player.yaw += autoYaw * dt * 0.25;
  state.input.f = true; state.input.walk = false; state.input.crouch = false;
}

// --- main loop ---
let acc = 0, last = performance.now(), firstFrame = true;
let frameCount = 0;

function tickOnce(dt) {
  const p = player;
  const look = consumeLook(state.input);
  if (p.scoped) { // scoped mouse sensitivity scales with the zoom
    const k = p.scopeLevel === 2 ? 0.15 : 0.4;
    look.dx *= k; look.dy *= k;
  }
  if (state.input.locked || AUTOPLAY) {
    p.yaw -= look.dx;
    p.pitch = clamp(p.pitch - look.dy, -1.55, 1.55);
  }
  if (AUTOPLAY) autoplayTick(dt);
  setCrouch(state, p, state.input.crouch, dt);
  const n = wishDir(p.yaw, state.input.f, state.input.b, state.input.l, state.input.r, _wd);
  const w = activeWeapon(p);
  let speed = MOVE.speed[w.cls] ?? MOVE.defaultSpeed;
  if (state.input.walk) speed *= MOVE.walkMul;
  if (p.crouch > 0.5) speed *= MOVE.crouchMul;
  if (p.scoped) speed *= MOVE.scopeMul;
  if (n) stepAgent(state, p, _wd.x, _wd.z, speed, state.input.jump, dt);
  else stepAgent(state, p, 0, 0, 0, state.input.jump, dt);
  updateWeapons(state, dt);
  state.tick++; state.time += dt;
}

function frame(now) {
  requestAnimationFrame(frame);
  const frameMs = now - last;
  last = now;
  const dt = Math.min(frameMs / 1000, 0.1);
  if (!camMode) {
    acc += dt;
    let n = 0;
    while (acc >= TICK && n < MAX_TICKS_PER_FRAME) { tickOnce(TICK); acc -= TICK; n++; }
    if (n === MAX_TICKS_PER_FRAME) acc = 0;
    if (AUTOPLAY) { for (let i = 0; i < SPEED - 1; i++) tickOnce(TICK); }
  } else if (frameCount < 4) {
    // Lookdev cam: settle a few ticks, then freeze the frame.
    tickOnce(TICK); tickOnce(TICK);
  }
  const alpha = camMode ? 1 : clamp(acc / TICK, 0, 1);
  R.placeCamera(player, alpha);
  const t0 = performance.now();
  R.renderFrame(state.time);
  vm.update(state, dt);
  fx.update(state, vm, dt);
  audio.update(state);
  const info = R.renderer.info;
  window.__saltline.stats.drawCalls = info.render.calls;
  window.__saltline.stats.triangles = info.render.triangles;
  window.__saltline.stats.frameMs = performance.now() - t0;
  hud.update(state);
  if (firstFrame) { firstFrame = false; window.__saltline.ready = true; }
  frameCount++;
  if ((camMode || SCENARIO) && frameCount >= 6 && !window.__saltline.scenarioReady) {
    window.__saltline.scenarioReady = true;
  }
}
requestAnimationFrame(frame);
