// SALTLINE input.js — keyboard / mouse / pointer lock into state.input
// (PLAN.md §4.6). Uses event.code so AZERTY works. No game logic here.
import { INPUT } from './config.js';

const KEYMAP = {
  KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b',
  KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r',
  Space: 'jump', ShiftLeft: 'walk', ShiftRight: 'walk',
  KeyC: 'crouch', ControlLeft: 'crouch',
};

export function createInput(canvas, input) {
  const onKey = (e, down) => {
    const k = KEYMAP[e.code];
    if (k) { input[k] = down; if (k === 'jump' || k === 'crouch') e.preventDefault(); }
    if (e.code === 'KeyR' && down) input.reload = true;
  };
  const onMouseMove = (e) => {
    if (!input.locked) return;
    input.lookDX += e.movementX;
    input.lookDY += e.movementY;
  };
  const onMouseDown = (e) => {
    if (!input.locked) { lockPointer(); return; }
    if (e.button === 0) input.fire = true;
    if (e.button === 2) input.alt = true;
  };
  const onMouseUp = (e) => {
    if (e.button === 0) input.fire = false;
    if (e.button === 2) input.alt = false;
  };
  const onLockChange = () => { input.locked = document.pointerLockElement === canvas; };
  const onContext = (e) => e.preventDefault();

  function lockPointer() {
    try {
      const p = canvas.requestPointerLock({ unadjustedMovement: true });
      if (p && p.catch) p.catch(() => canvas.requestPointerLock());
    } catch { canvas.requestPointerLock(); }
  }

  document.addEventListener('keydown', (e) => onKey(e, true));
  document.addEventListener('keyup', (e) => onKey(e, false));
  document.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('pointerlockchange', onLockChange);
  canvas.addEventListener('contextmenu', onContext);
  return { lockPointer };
}

// Consume accumulated mouse deltas (called once per frame by main.js).
export function consumeLook(input) {
  const dx = input.lookDX * INPUT.mouseSens;
  const dy = input.lookDY * INPUT.mouseSens;
  input.lookDX = 0; input.lookDY = 0;
  return { dx, dy };
}
