// VERDE BAY 3D v7 — keyboard + mouse state shared with the simulation.
// The sim reads keys / justPressed / mouseDown / aimAngle every tick.

export function createInput() {
  const input = {
    keys: new Set(),
    justPressed: new Set(),
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    aimAngle: 0,
  };

  const GAME_KEYS = new Set([
    'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyM', 'KeyR', 'KeyC', 'KeyE',
    'KeyP', 'KeyQ', 'Digit1', 'Digit2', 'Digit3', 'ShiftLeft', 'ShiftRight',
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Escape', 'Enter',
  ]);

  function onKeyDown(e) {
    if (!GAME_KEYS.has(e.code)) return;
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if (!e.repeat) {
      input.keys.add(e.code);
      input.justPressed.add(e.code);
    }
  }

  function onKeyUp(e) {
    input.keys.delete(e.code);
  }

  function onMouseMove(e) {
    input.mouseX = e.clientX;
    input.mouseY = e.clientY;
  }

  function onMouseDown(e) {
    if (e.button === 0) input.mouseDown = true;
  }

  function onMouseUp(e) {
    if (e.button === 0) input.mouseDown = false;
  }

  function onBlur() {
    input.keys.clear();
    input.mouseDown = false;
  }

  input.attach = function attach() {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('blur', onBlur);
  };

  input.detach = function detach() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mouseup', onMouseUp);
    window.removeEventListener('blur', onBlur);
  };

  return input;
}
