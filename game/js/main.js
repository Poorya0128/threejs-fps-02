// Boot and loop: fixed 64 Hz tick, interpolated frames. Flags: ?autoplay=1&speed&seed&norender=1, ?scenario=, ?cam=.
import { Vector3 } from 'three';
import { TICK, MAX_TICKS_PER_FRAME, INPUT, MOVE } from './config.js';
import { createState, createAgent } from './state.js';
import { mulberry32, clamp } from './math.js';
import { createInput, applyLook } from './input.js';
import { stepAgent, setCrouch, wishDir } from './physics.js';
import { giveWeapon, updateWeapons, maxSpeed } from './weapons.js';
import { initGrenades, updateGrenades } from './grenades.js';
import { startRound, updateRounds, plantCharge, defuseCharge } from './rounds.js';
import { buyItem } from './economy.js';
import { spawnBots, onRoundStart, updateBots, driveAgent } from './bots.js';
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
const SPEED = clamp(Number(q.get('speed') ?? 1), 1, 64), DRAW = q.get('norender') !== '1', SHOWN = ['round', 'phase', 'roundsPlayed', 'matchOver', 'lastWinReason'];
const state = createState(MAP, mulberry32(Number(q.get('seed') ?? 1337)));
const status = window.__saltline = { ready: false, score: state.score, scenarioReady: false, stats: { drawCalls: 0, triangles: 0, frameMs: 0 } };

state.boxes = buildBoxes(); state.autoplay = AUTOPLAY;
initGrenades(state);
for (let i = 1; i <= 9; i++) { const t = i <= 4 ? 'strand' : 'bastion'; state.agents.push(createAgent(i, t, true, ...MAP.spawns[t])); }
for (const a of state.agents) giveWeapon(a, 'wren');
spawnBots(state, buildNav(MAP, state.boxes));

const R = createRenderer(document.getElementById('game')), { dir } = buildLighting(R.renderer, R.scene);
buildWorld(R.scene, state.boxes, MAP);
R.vmScene.environment = R.scene.environment; R.vmScene.environmentIntensity = 1.3;
const vm = createViewmodel(R.vmScene, dir), chars = createCharacters(R.scene), fx = createFx(R.scene), hud = createHud(MAP), audio = createAudio();
const { lockPointer } = createInput(R.renderer.domElement, state.input);

const el = (id) => document.getElementById(id), menu = { title: el('title'), pause: el('pause'), end: el('end') };
const showMenu = (name) => { for (const k in menu) menu[k].hidden = k !== name; state.input.canLock = !name; state.paused = name === 'pause' || name === 'title'; };
const play = () => { showMenu(null); lockPointer(); };
el('deploy').onclick = el('resume').onclick = play;
el('restart').onclick = el('again').onclick = () => location.reload();
el('sSens').oninput = (e) => { INPUT.mouseSens = Number(e.target.value); };
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && !state.paused && !state.matchOver && !state.buyOpen && !AUTOPLAY && !SCENARIO) showMenu('pause'); });

const _wd = new Vector3();
function controlPlayer(dt) {
	const p = state.player, inp = state.input, frozen = state.phase === 'buy';
	inp.buyOpen = state.buyOpen;
	if (inp.buyToggle && frozen) state.buyOpen = !state.buyOpen;
	if (inp.buyKey && state.buyOpen) buyItem(state, p, inp.buyKey);
	inp.buyToggle = false; inp.buyKey = '';
	if (AUTOPLAY) return driveAgent(state, p, dt);
	if (!p.alive) return;
	setCrouch(state, p, inp.crouch, dt);
	const go = !frozen && wishDir(p.yaw, inp.f, inp.b, inp.l, inp.r, _wd);
	stepAgent(state, p, _wd.x, _wd.z, go ? maxSpeed(p) * (inp.walk ? MOVE.walkMul : 1) * (p.crouch > .5 ? MOVE.crouchMul : 1) : 0, inp.jump && !frozen, dt);
	if (inp.interact && state.phase === 'live') plantCharge(state, p, dt); else p.plantT = 0;
	if (inp.interact && state.phase === 'planted') defuseCharge(state, p, dt); else p.defuseT = 0;
}

export function tick(dt) {
	if (state.newRound) { state.newRound = false; onRoundStart(state); }
	controlPlayer(dt); updateBots(state, dt); updateWeapons(state, dt); updateGrenades(state, dt); updateRounds(state, dt);
	state.time += dt;
}

let acc = 0, last = performance.now(), frames = 0;
el('hud').hidden = !!CAM && q.get('hud') !== '1';
startRound(state);
if (SCENARIO) applyScenario(state, SCENARIO, tick);
else if (CAM) { state.buyOpen = false; state.scenarioDone = true; }
else if (!AUTOPLAY) showMenu('title');

const next = DRAW ? requestAnimationFrame : (f) => setTimeout(() => f(performance.now()), 1);
function frame(now) {
	next(frame);
	const dt = Math.min((now - last) / 1000, .1), p = state.player;
	last = now;
	if (!state.paused && !state.scenarioDone) {
		if (state.input.locked && p.alive) applyLook(state.input, p);
		let n = 0;
		for (acc += dt; acc >= TICK && n++ < MAX_TICKS_PER_FRAME; acc -= TICK) tick(TICK);
		if (n > MAX_TICKS_PER_FRAME) acc = 0;
		for (let i = 1; AUTOPLAY && i < SPEED; i++) tick(TICK);
	}
	if (state.matchOver && menu.end.hidden && !AUTOPLAY) {
		const { strand, bastion } = state.score;
		el('endT').textContent = `${strand > bastion ? 'STRAND' : 'BASTION'} WINS`;
		el('endS').textContent = `FINAL · ${strand} — ${bastion}`;
		showMenu('end'); document.exitPointerLock();
	}
	for (const k of SHOWN) status[k] = state[k];
	status.ready = true;
	if (!DRAW) return;
	const title = !menu.title.hidden, t0 = performance.now(), fdt = state.scenarioDone ? 0 : dt;
	if (CAM) { p.prevPos.copy(p.pos.set(CAM[0], CAM[1] - p.eyeHeight, CAM[2])); p.yaw = CAM[3] * Math.PI / 180; p.pitch = CAM[4] * Math.PI / 180; }
	if (title) R.orbit(now / 1000); else R.placeCamera(p, CAM ? 1 : clamp(acc / TICK, 0, 1), INPUT.fov);
	vm.group.visible = p.alive && !title;
	if (vm.group.visible) vm.update(state, R.camera, fdt);
	chars.update(state, dt);
	fx.update(state, vm, fdt, chars, R.camera.position);
	R.renderFrame(state.time);
	hud.update(state, p);
	audio.update(state, R.camera);
	const info = R.renderer.info.render;
	status.stats.drawCalls = info.calls; status.stats.triangles = info.triangles; status.stats.frameMs = performance.now() - t0;
	if (state.scenarioDone && ++frames >= 6) status.scenarioReady = true;
}
next(frame);
