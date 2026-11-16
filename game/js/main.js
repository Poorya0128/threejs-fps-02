// SALTLINE main.js — boot and the loop: a fixed 64 Hz simulation (tick) kept apart from rendering, which runs every
// animation frame and interpolates. Test flags: ?autoplay=1&speed=N&seed=N&norender=1, ?scenario=…, ?cam=x,y,z,yaw,pitch.
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

const q = new URLSearchParams(location.search), AUTOPLAY = q.get('autoplay') === '1', SCENARIO = q.get('scenario'), CAM = q.get('cam')?.split(',').map(Number);
const SPEED = clamp(Number(q.get('speed') ?? 1), 1, 64), SEED = Number(q.get('seed') ?? 1337), DRAW = q.get('norender') !== '1';
const SHOWN = ['round', 'phase', 'roundsPlayed', 'matchOver', 'lastWinReason'], status = window.__saltline = { ready: false, round: 1, phase: 'buy', score: null, roundsPlayed: 0, matchOver: false, lastWinReason: null, scenarioReady: false, stats: { drawCalls: 0, triangles: 0, frameMs: 0 } };

const state = createState(MAP, mulberry32(SEED));
state.boxes = buildBoxes(); state.autoplay = AUTOPLAY; status.score = state.score;
initGrenades(state);
for (let i = 1; i <= 9; i++) { const t = i <= 4 ? 'strand' : 'bastion', s = MAP.spawns[t]; state.agents.push(createAgent(i, t, true, s[0], s[1], 0)); }
for (const a of state.agents) { giveWeapon(a, 'cutlass'); giveWeapon(a, 'wren'); a.active = 1; }
if (AUTOPLAY) state.player.brain = createBrain(BOT.regular);
spawnBots(state, buildNav(MAP, state.boxes));

const R = createRenderer(document.getElementById('game')), light = buildLighting(R.renderer, R.scene);
buildWorld(R.scene, state.boxes, MAP);
R.vmScene.environment = R.scene.environment; R.vmScene.environmentIntensity = 1.3;
const vm = createViewmodel(R.vmScene, light.dir), chars = createCharacters(R.scene), fx = createFx(R.scene), hud = createHud(MAP), audio = createAudio();
const { lockPointer } = createInput(R.renderer.domElement, state.input);

// Menus: title (difficulty and deploy), pause (settings), match end. A menu pauses the sim and frees the pointer.
const el = (id) => document.getElementById(id), menu = { title: el('title'), pause: el('pause'), end: el('end') };
const showMenu = (name) => { for (const k in menu) menu[k].hidden = k !== name; state.input.canLock = !name; state.paused = name === 'pause' || name === 'title'; };
const setSkill = (d) => { state.difficulty = d; for (const a of state.agents) if (a.brain) a.brain.skill = BOT[d]; };
el('deploy').onclick = () => { setSkill(document.querySelector('input[name=diff]:checked')?.value ?? 'regular'); el('sDiff').value = state.difficulty; showMenu(null); lockPointer(); };
el('resume').onclick = () => { showMenu(null); lockPointer(); };
el('restart').onclick = el('again').onclick = () => location.reload();
el('sSens').oninput = (e) => { INPUT.mouseSens = Number(e.target.value); };
el('sFov').oninput = (e) => { INPUT.fov = Number(e.target.value); };
el('sVol').oninput = (e) => audio.setVolume(Number(e.target.value));
el('sDiff').onchange = (e) => setSkill(e.target.value);
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && !state.paused && !state.matchOver && !state.buyOpen && !AUTOPLAY && !SCENARIO) showMenu('pause'); });

// Player control for one tick: buy menu, movement (walk / crouch / scope speeds), plant and defuse, spectating.
const _wd = new Vector3();
let prevJump = false;
function controlPlayer(dt) {
	const p = state.player, inp = state.input, frozen = state.phase === 'buy';
	inp.buyOpen = state.buyOpen;
	if (inp.buyToggle) { inp.buyToggle = false; if (frozen) state.buyOpen = !state.buyOpen; }
	if (inp.buyKey) { if (state.buyOpen) buyItem(state, p, inp.buyKey); inp.buyKey = ''; }
	if (AUTOPLAY) { driveAgent(state, p, dt); return; }
	if (!p.alive) { if (inp.jump && !prevJump) cycleSpectate(state); prevJump = inp.jump; return; }
	setCrouch(state, p, inp.crouch, dt);
	let speed = maxSpeed(p) * (inp.walk ? MOVE.walkMul : 1) * (p.crouch > .5 ? MOVE.crouchMul : 1);
	if (frozen || !wishDir(p.yaw, inp.f, inp.b, inp.l, inp.r, _wd)) { speed = 0; _wd.set(0, 0, 0); }
	stepAgent(state, p, _wd.x, _wd.z, speed, inp.jump && !frozen, dt);
	if (inp.interact && state.phase === 'live') plantCharge(state, p, dt); else p.plantT = 0;
	if (inp.interact && state.phase === 'planted') defuseCharge(state, p, dt); else p.defuseT = 0;
}

export function tick(dt) {
	if (state.newRound) { state.newRound = false; onRoundStart(state); }
	controlPlayer(dt); updateBots(state, dt); updateWeapons(state, dt); updateGrenades(state, dt); updateRounds(state, dt);
	state.tick++; state.time += dt;
}

// ?cam= freezes a lookdev camera with the HUD hidden; ?scenario= stages a screenshot; otherwise the title orbits.
let acc = 0, last = performance.now(), frames = 0;
if (CAM) el('hud').hidden = q.get('hud') !== '1';
startRound(state);
if (SCENARIO) applyScenario(state, SCENARIO, tick);
else if (CAM) { state.buyOpen = false; state.scenarioDone = true; }
else if (AUTOPLAY) state.input.canLock = false;
else showMenu('title');

const next = DRAW ? requestAnimationFrame : (f) => setTimeout(() => f(performance.now()), 1); // headless tests run unthrottled
function frame(now) {
	next(frame);
	const dt = Math.min((now - last) / 1000, .1), p = state.player;
	last = now;
	if (!state.paused && !state.scenarioDone) {
		if (state.input.locked && p.alive) applyLook(state.input, p);
		acc += dt;
		let n = 0;
		while (acc >= TICK && n++ < MAX_TICKS_PER_FRAME) { tick(TICK); acc -= TICK; }
		if (n > MAX_TICKS_PER_FRAME) acc = 0;
		for (let i = 1; AUTOPLAY && i < SPEED; i++) tick(TICK);
	}
	if (state.matchOver && menu.end.hidden && !AUTOPLAY) {
		const { strand, bastion } = state.score, best = state.agents.reduce((b, a) => (a.kills > b.kills ? a : b));
		el('endT').textContent = `${strand > bastion ? 'STRAND' : 'BASTION'} WINS`;
		el('endS').textContent = `FINAL · ${strand} — ${bastion}`;
		el('endM').textContent = `MATCH MVP ${best.name.toUpperCase()} · ${best.kills} KILLS · ${best.headshots} HEADSHOTS`;
		showMenu('end'); document.exitPointerLock();
	}
	for (const k of SHOWN) status[k] = state[k];
	status.ready = true;
	if (!DRAW) return;
	const view = spectateTarget(state) || p, title = !menu.title.hidden, t0 = performance.now(), fdt = state.scenarioDone ? 0 : dt;
	if (CAM) { p.pos.set(CAM[0], CAM[1] - p.eyeHeight, CAM[2]); p.prevPos.copy(p.pos); p.yaw = CAM[3] * Math.PI / 180; p.pitch = CAM[4] * Math.PI / 180; }
	if (title) R.orbit(now / 1000); else R.placeCamera(view, CAM ? 1 : clamp(acc / TICK, 0, 1), INPUT.fov);
	vm.group.visible = view === p && p.alive && !title;
	if (vm.group.visible) vm.update(state, R.camera, fdt);
	chars.update(state, dt);
	fx.update(state, vm, fdt, chars, R.camera.position);
	R.renderFrame(state.time);
	hud.update(state, view);
	audio.update(state, R.camera);
	const info = R.renderer.info.render;
	status.stats.drawCalls = info.calls; status.stats.triangles = info.triangles; status.stats.frameMs = performance.now() - t0;
	if (state.scenarioDone && ++frames >= 6) status.scenarioReady = true;
}
next(frame);
