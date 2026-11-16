// SALTLINE input.js — keyboard / mouse / pointer lock into state.input
// (PLAN.md §4.6). Uses event.code so AZERTY works. No game logic here.
import { INPUT } from './config.js';
import { clamp } from './math.js';

const KEYMAP = {
  KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b',
  KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r',
  Space: 'jump', ShiftLeft: 'walk', ShiftRight: 'walk',
  KeyC: 'crouch', ControlLeft: 'crouch',
};

export function createInput(canvas, input) {
  // Chrome fires one synthetic mousemove when pointer lock engages, with
  // movement equal to minus the pre-lock cursor position (a jump of up to
  // the full screen). Drop exactly that first event after locking; also
  // clamp each event so a teleported cursor can never spin the view.
  let justLocked = false;
  const onKey = (e, down) => {
    const k = KEYMAP[e.code];
    if (k) { input[k] = down; if (k === 'jump' || k === 'crouch') e.preventDefault(); }
    if (e.code === 'KeyR' && down) input.reload = true;
    if (e.code === 'KeyQ' && down) input.lastWeapon = true;
    if (e.code.startsWith('Digit')) { const s = Number(e.code[5]); if (down && s >= 1 && s <= 4) input.slot = s; }
  };
  const onMouseMove = (e) => {
    if (!input.locked) return;
    if (justLocked) { justLocked = false; return; }
    // Chromium fires synthetic mousemove events on pointer-lock acquisition
    // and on mousedown while locked, with movement equal to minus the
    // pre-lock cursor position (hundreds of px in one event). A real mouse
    // never moves that far in a single event; drop those.
    if (Math.abs(e.movementX) > 250 || Math.abs(e.movementY) > 250) return;
    input.lookDX += clamp(e.movementX, -150, 150);
    input.lookDY += clamp(e.movementY, -150, 150);
  };
  const onMouseDown = (e) => {
    if (!input.locked) { lockPointer(); return; }
    if (e.button === 0) { input.fire = true; input.fireEdge = true; }
    if (e.button === 2) input.alt = true;
  };
  const onMouseUp = (e) => {
    if (e.button === 0) input.fire = false;
    if (e.button === 2) input.alt = false;
  };
  const onWheel = (e) => { if (input.locked) input.wheel += Math.sign(e.deltaY); };
  const onLockChange = () => {
    const locked = document.pointerLockElement === canvas;
    if (locked && !input.locked) justLocked = true;
    input.locked = locked;
  };
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
  canvas.addEventListener('wheel', onWheel, { passive: true });
  return { lockPointer };
}

// Consume accumulated mouse deltas (called once per frame by main.js).
export function consumeLook(input) {
  const dx = input.lookDX * INPUT.mouseSens;
  const dy = input.lookDY * INPUT.mouseSens;
  input.lookDX = 0; input.lookDY = 0;
  return { dx, dy };
}
