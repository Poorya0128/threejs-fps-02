// SALTLINE input.js — keyboard, mouse and pointer lock into state.input (physical key codes, so AZERTY works).
import { INPUT, BUY_KEYS } from './config.js';

const HOLD = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r', Space: 'jump',
	ShiftLeft: 'walk', ShiftRight: 'walk', KeyC: 'crouch', ControlLeft: 'crouch', KeyE: 'interact', Tab: 'scoreboard' };
const PRESS = { KeyR: 'reload', KeyQ: 'lastWeapon', KeyB: 'buyToggle' }, CHAR = { Minus: '-', Equal: '=' }, SCOPE_SENS = [1, .45, .2];

export function createInput(canvas, input) {
	let skip = false; // the first mouse move after locking carries the jump to the lock point
	const lockPointer = () => { try { canvas.requestPointerLock({ unadjustedMovement: true })?.catch?.(() => canvas.requestPointerLock()); } catch { canvas.requestPointerLock(); } };
	function key(e, down) {
		if (HOLD[e.code]) { input[HOLD[e.code]] = down; if (e.code === 'Tab' || e.code === 'Space') e.preventDefault(); }
		if (!down || e.repeat) return;
		if (PRESS[e.code]) input[PRESS[e.code]] = true;
		const ch = e.code.startsWith('Digit') ? e.code[5] : CHAR[e.code];
		if (input.buyOpen && BUY_KEYS[ch]) input.buyKey = BUY_KEYS[ch];
		else if (ch >= '1' && ch <= '4') input.slot = Number(ch);
	}
	addEventListener('keydown', (e) => key(e, true));
	addEventListener('keyup', (e) => key(e, false));
	addEventListener('mousemove', (e) => {
		if (!input.locked) return;
		if (skip) { skip = false; return; }
		if (Math.abs(e.movementX) > 300 || Math.abs(e.movementY) > 300) return; // browser glitch spikes
		input.lookDX += e.movementX; input.lookDY += e.movementY;
	});
	canvas.addEventListener('mousedown', (e) => {
		if (!input.locked) { if (input.canLock) lockPointer(); return; }
		if (e.button === 0) input.fire = input.fireEdge = true; else if (e.button === 2) input.alt = true;
	});
	addEventListener('mouseup', (e) => { if (e.button === 0) input.fire = false; else if (e.button === 2) input.alt = false; });
	canvas.addEventListener('wheel', (e) => { if (input.locked) input.wheel += Math.sign(e.deltaY); }, { passive: true });
	canvas.addEventListener('contextmenu', (e) => e.preventDefault());
	document.addEventListener('pointerlockchange', () => { const l = document.pointerLockElement === canvas; if (l && !input.locked) skip = true; input.locked = l; if (!l) input.fire = false; });
	return { lockPointer };
}

// Mouse look, applied every rendered frame for responsiveness (the simulation reads yaw and pitch each tick).
export function applyLook(input, a) {
	const k = INPUT.mouseSens * SCOPE_SENS[a.scopeLevel];
	a.yaw -= input.lookDX * k;
	a.pitch = Math.max(-INPUT.pitchMax, Math.min(INPUT.pitchMax, a.pitch - input.lookDY * k));
	input.lookDX = input.lookDY = 0;
}
