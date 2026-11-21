// Keyboard + mouse input. Tracks held keys and mouse position/aim in world space.
export function createInput(canvas) {
  const input = {
    keys: {},
    pressed: {},
    mouseX: 0, mouseY: 0, mouseDown: false, mouseClicked: false,
    wheelDir: 0,
  };
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    // Latch single presses: a quick tap can fall between two frames, so the
    // keydown is remembered until the game consumes it.
    if (!e.repeat) input.pressed[e.code] = true;
    input.keys[e.code] = true;
  });
  window.addEventListener('keyup', (e) => { input.keys[e.code] = false; });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouseX = e.clientX - r.left;
    input.mouseY = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { input.mouseDown = true; input.mouseClicked = true; }
  });
  window.addEventListener('mouseup', () => { input.mouseDown = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('wheel', (e) => { input.wheelDir = e.deltaY > 0 ? 1 : -1; }, { passive: true });
  window.addEventListener('blur', () => { input.keys = {}; input.mouseDown = false; });
  return input;
}

export function isDown(input, ...codes) {
  return codes.some((c) => input.keys[c]);
}

export function pressed(input, code) {
  if (input.pressed[code]) { input.pressed[code] = false; return true; }
  return false;
}

// Alias with a verb that reads well at call sites: consume a latched press once.
export const consume = pressed;

// Aim angle from the player screen position toward the mouse.
export function aimAngle(input, px, py) {
  return Math.atan2(input.mouseY - py, input.mouseX - px);
}
