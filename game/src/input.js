// Keyboard + mouse input for Verde Bay.
// Keeps two sets the sim reads every frame: `keys` (held) and `justPressed`
// (pressed since the last update; the sim clears it each step).

/** Attach listeners and return the shared input state. */
export function createInput() {
  const input = { keys: new Set(), justPressed: new Set(), mouseX: 0, mouseY: 0, mouseDown: false };

  const GAME_KEYS = new Set([
    'KeyW', 'KeyA', 'KeyS', 'KeyD',
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'ShiftLeft', 'ShiftRight', 'Space', 'KeyE', 'KeyF', 'KeyM', 'KeyP', 'Escape',
  ]);

  function onKeyDown(e) {
    if (!GAME_KEYS.has(e.code)) return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
    if (!e.repeat) {
      input.keys.add(e.code);
      input.justPressed.add(e.code);
    }
  }

  function onKeyUp(e) {
    input.keys.delete(e.code);
  }

  function onMouseDown(e) {
    input.mouseDown = true;
    input.justPressed.add('Mouse0');
    input.mouseX = e.clientX;
    input.mouseY = e.clientY;
  }

  function onMouseUp() {
    input.mouseDown = false;
  }

  function onBlur() {
    input.keys.clear();
    input.mouseDown = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('blur', onBlur);

  return input;
}
