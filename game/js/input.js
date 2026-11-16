// SALTLINE input.js — keyboard, mouse and pointer lock into state.input (physical key codes, so AZERTY works).
import { INPUT, BUY_KEYS } from './config.js';

const HOLD = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r', Space: 'jump',
	ShiftLeft: 'walk', ShiftRight: 'walk', KeyC: 'crouch', ControlLeft: 'crouch', KeyE: 'interact', Tab: 'scoreboard' };
const PRESS = { KeyR: 'reload', KeyQ: 'lastWeapon', KeyB: 'buyToggle' };
const KEY_CHAR = { Minus: '-', Equal: '=' };

export function createInput(canvas, input) {
	let skip = false;
	function lockPointer() {
		try { const p = canvas.requestPointerLock({ unadjustedMovement: true }); if (p && p.catch) p.catch(() => canvas.requestPointerLock()); }
		catch { canvas.requestPointerLock(); }
	}
	function key(e, down) {
		if (HOLD[e.code]) { input[HOLD[e.code]] = down; if (e.code === 'Tab' || e.code === 'Space') e.preventDefault(); }
		if (!down || e.repeat) return;
		if (PRESS[e.code]) input[PRESS[e.code]] = true;
		const ch = e.code.startsWith('Digit') ? e.code[5] : KEY_CHAR[e.code];
		if (!ch) return;
		if (input.buyOpen && BUY_KEYS[ch]) input.buyKey = BUY_KEYS[ch];
		else if (ch >= '1' && ch <= '4') input.slot = Number(ch);
	}
	document.addEventListener('keydown', (e) => key(e, true));
	document.addEventListener('keyup', (e) => key(e, false));
	document.addEventListener('mousemove', (e) => {
		if (!input.locked) return;
		if (skip) { skip = false; return; }
		if (Math.abs(e.movementX) > 300 || Math.abs(e.movementY) > 300) return;
		input.lookDX += e.movementX; input.lookDY += e.movementY;
	});
	canvas.addEventListener('mousedown', (e) => {
		if (!input.locked) { if (input.canLock) lockPointer(); return; }
		if (e.button === 0) { input.fire = true; input.fireEdge = true; } else if (e.button === 2) input.alt = true;
	});
	document.addEventListener('mouseup', (e) => { if (e.button === 0) input.fire = false; else if (e.button === 2) input.alt = false; });
	canvas.addEventListener('wheel', (e) => { if (input.locked) input.wheel += Math.sign(e.deltaY); }, { passive: true });
	canvas.addEventListener('contextmenu', (e) => e.preventDefault());
	document.addEventListener('pointerlockchange', () => { const l = document.pointerLockElement === canvas; if (l && !input.locked) skip = true; input.locked = l; if (!l) input.fire = false; });
	return { lockPointer };
}

// Mouse look, applied every rendered frame for responsiveness (the simulation reads yaw/pitch each tick).
export function applyLook(input, a) {
	const k = INPUT.mouseSens * (a.scopeLevel === 2 ? 0.2 : a.scopeLevel === 1 ? 0.45 : 1);
	a.yaw -= input.lookDX * k;
	a.pitch = Math.max(-INPUT.pitchMax, Math.min(INPUT.pitchMax, a.pitch - input.lookDY * k));
	input.lookDX = input.lookDY = 0;
}
