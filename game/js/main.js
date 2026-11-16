// SALTLINE main.js — boot and the loop: a fixed 64 Hz simulation (tick) kept apart from rendering, which runs every
// animation frame and interpolates positions. URL flags for tests: ?autoplay=1&speed=N&seed=N, ?scenario=…, ?cam=….
import { Vector3 } from 'three';
import { TICK, MAX_TICKS_PER_FRAME, BOT, INPUT, MOVE } from './config.js';
import { createState, createAgent } from './state.js';
import { mulberry32, clamp } from './math.js';
import { createInput, applyLook } from './input.js';
import { stepAgent, setCrouch, wishDir } from './physics.js';
import { giveWeapon, updateWeapons, maxSpeed } from './weapons.js';
import { initGrenades, updateGrenades } from './grenades.js';
import { startRound, updateRounds, spectateTarget, cycleSpectate, plantCharge, defuseCharge } from './rounds.js';
import { buyItem } from './economy.js';
import { spawnBots, onRoundStart, updateBots, driveAgent, createBrain } from './bots.js';
import { buildNav } from './nav.js';
import { MAP, buildBoxes } from './map.js';
import { createHud } from './hud.js';
import { createRenderer } from './render.js';
import { buildLighting } from './art/lighting.js';
import { buildWorld } from './art/geo.js';
import { createViewmodel } from './art/viewmodel.js';
import { createCharacters } from './art/characters.js';
import { createFx } from './art/fx.js';
import { createAudio } from './audio.js';
import { applyScenario } from './scenarios.js';

const q = new URLSearchParams(location.search);
const AUTOPLAY = q.get('autoplay') === '1', SCENARIO = q.get('scenario'), CAM = q.get('cam');
const SPEED = clamp(Number(q.get('speed') ?? 1), 1, 64), SEED = Number(q.get('seed') ?? 1337), DRAW = q.get('norender') !== '1';
const status = window.__saltline = { ready: false, round: 1, phase: 'buy', score: null, roundsPlayed: 0, matchOver: false, lastWinReason: null, scenarioReady: false, stats: { drawCalls: 0, triangles: 0, frameMs: 0 } };

const state = createState(SEED, MAP, mulberry32(SEED));
state.boxes = buildBoxes(); state.autoplay = AUTOPLAY; status.score = state.score;
initGrenades(state);
for (let i = 1; i <= 9; i++) { const t = i <= 4 ? 'strand' : 'bastion', s = MAP.spawns[t]; state.agents.push(createAgent(i, t, true, s[0], s[1], 0)); }
for (const a of state.agents) { giveWeapon(a, 'cutlass'); giveWeapon(a, 'wren'); a.active = 1; }
if (AUTOPLAY) state.player.brain = createBrain(BOT.regular);
spawnBots(state, buildNav(MAP, state.boxes));

const R = createRenderer(document.getElementById('game'));
const light = buildLighting(R.renderer, R.scene);
buildWorld(R.scene, state.boxes, MAP);
R.vmScene.environment = R.scene.environment; R.vmScene.environmentIntensity = 1.3;
const vm = createViewmodel(R.vmScene, light.dir), chars = createCharacters(R.scene), fx = createFx(R.scene);
const hud = createHud(MAP), audio = createAudio();
const { lockPointer } = createInput(R.renderer.domElement, state.input);
const el = (id) => document.getElementById(id), menu = { title: el('title'), pause: el('pause'), end: el('end') };
const showMenu = (name) => { for (const k in menu) menu[k].hidden = k !== name; state.input.canLock = !name; state.paused = name === 'pause' || name === 'title'; };

function begin() { const d = document.querySelector('input[name=diff]:checked'); setSkill(d ? d.value : 'regular'); el('sDiff').value = state.difficulty; showMenu(null); lockPointer(); }
function setSkill(d) { state.difficulty = d; for (const a of state.agents) if (a.brain) a.brain.skill = BOT[d]; }
el('deploy').onclick = begin; el('resume').onclick = () => { showMenu(null); lockPointer(); };
el('restart').onclick = el('again').onclick = () => location.reload();
el('sSens').oninput = (e) => { INPUT.mouseSens = Number(e.target.value); };
el('sFov').oninput = (e) => { INPUT.fov = Number(e.target.value); };
el('sVol').oninput = (e) => audio.setVolume(Number(e.target.value));
el('sDiff').onchange = (e) => setSkill(e.target.value);
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && !state.paused && !state.matchOver && !state.buyOpen && !AUTOPLAY && !SCENARIO) showMenu('pause'); });

const _wd = new Vector3();
let prevJump = false;
// Player control for one tick: buy menu, movement (walk/crouch/scope speeds), plant and defuse, spectating.
function controlPlayer(dt) {
	const p = state.player, inp = state.input;
	inp.buyOpen = state.buyOpen;
	if (inp.buyToggle) { inp.buyToggle = false; if (state.phase === 'buy') state.buyOpen = !state.buyOpen; }
	if (inp.buyKey) { if (state.buyOpen) buyItem(state, p, inp.buyKey); inp.buyKey = ''; }
	if (AUTOPLAY) { driveAgent(state, p, dt); return; }
	if (!p.alive) { if (inp.jump && !prevJump) cycleSpectate(state); prevJump = inp.jump; return; }
	const frozen = state.phase === 'buy';
	setCrouch(state, p, inp.crouch, dt);
	let speed = maxSpeed(p) * (inp.walk ? MOVE.walkMul : 1) * (p.crouch > 0.5 ? MOVE.crouchMul : 1);
	if (frozen || !wishDir(p.yaw, inp.f, inp.b, inp.l, inp.r, _wd)) { speed = 0; _wd.set(0, 0, 0); }
	stepAgent(state, p, _wd.x, _wd.z, speed, inp.jump && !frozen, dt);
	if (inp.interact && state.phase === 'live') plantCharge(state, p, dt); else p.plantT = 0;
	if (inp.interact && state.phase === 'planted') defuseCharge(state, p, dt); else p.defuseT = 0;
}

export function tick(dt) {
	if (state.newRound) { state.newRound = false; onRoundStart(state); }
	controlPlayer(dt);
	updateBots(state, dt);
	updateWeapons(state, dt);
	updateGrenades(state, dt);
	updateRounds(state, dt);
	state.tick++; state.time += dt;
}

// Title screen: a slow orbit over the map while the match waits; ?cam= freezes a lookdev camera.
let camView = null, acc = 0, last = performance.now(), frames = 0;
if (CAM) { const [x, y, z, yaw, pitch] = CAM.split(',').map(Number); camView = { x, y, z, yaw: yaw * Math.PI / 180, pitch: pitch * Math.PI / 180 }; el('hud').hidden = q.get('hud') !== '1'; }
startRound(state);
if (SCENARIO) applyScenario(state, SCENARIO, tick);
else if (!AUTOPLAY && !CAM) showMenu('title');
else state.input.canLock = !AUTOPLAY;
if (CAM) { state.buyOpen = false; state.scenarioDone = true; }

const next = DRAW ? requestAnimationFrame : (f) => setTimeout(() => f(performance.now()), 1); // tests without drawing are not tied to the display
function frame(now) {
	next(frame);
	const dt = Math.min((now - last) / 1000, 0.1); last = now;
	const p = state.player;
	if (!state.paused && !state.scenarioDone) {
		if (state.input.locked && p.alive) applyLook(state.input, p);
		acc += dt;
		let n = 0;
		while (acc >= TICK && n++ < MAX_TICKS_PER_FRAME) { tick(TICK); acc -= TICK; }
		if (n > MAX_TICKS_PER_FRAME) acc = 0;
		for (let i = 1; AUTOPLAY && i < SPEED; i++) tick(TICK);
	}
	if (state.matchOver && menu.end.hidden && !AUTOPLAY) {
		el('endT').textContent = state.score.strand > state.score.bastion ? 'STRAND WINS' : 'BASTION WINS';
		el('endS').textContent = `FINAL · ${state.score.strand} — ${state.score.bastion}`;
		const best = state.agents.reduce((b, a) => (a.kills > b.kills ? a : b));
		el('endM').textContent = `MATCH MVP ${best.name.toUpperCase()} · ${best.kills} KILLS · ${best.headshots} HEADSHOTS`;
		showMenu('end'); document.exitPointerLock();
	}
	status.round = state.round; status.phase = state.phase; status.roundsPlayed = state.roundsPlayed; status.matchOver = state.matchOver; status.lastWinReason = state.lastWinReason;
	status.ready = true;
	if (!DRAW) return;
	const view = spectateTarget(state) || p, title = !menu.title.hidden;
	if (camView) { p.yaw = camView.yaw; p.pitch = camView.pitch; p.pos.set(camView.x, camView.y - p.eyeHeight, camView.z); p.prevPos.copy(p.pos); }
	const t0 = performance.now();
	if (title) R.orbit(now / 1000); else R.placeCamera(view, camView ? 1 : clamp(acc / TICK, 0, 1), INPUT.fov);
	vm.group.visible = view === p && p.alive && !title;
	if (vm.group.visible) vm.update(state, R.camera, state.scenarioDone ? 0 : dt);
	chars.update(state, dt);
	fx.update(state, vm, state.scenarioDone ? 0 : dt, chars, R.camera.position);
	R.renderFrame(state.time);
	hud.update(state, view);
	audio.update(state, R.camera);
	const info = R.renderer.info.render;
	status.stats.drawCalls = info.calls; status.stats.triangles = info.triangles; status.stats.frameMs = performance.now() - t0;
	if ((camView || state.scenarioDone) && ++frames >= 6) status.scenarioReady = true;
}
next(frame);
