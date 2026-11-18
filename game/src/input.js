// Keyboard and mouse input. The sim reads `keys` (held) and `justPressed`
// (pressed since the last frame); main.js clears justPressed every frame
// after the sim has seen it. Mouse position is kept relative to the canvas
// centre so the sim can aim the pistol and the camera can read it.

/** Create the input state and attach it to the window. Returns the state. */
export function createInput(canvas) {
  const input = {
    keys: new Set(),
    justPressed: new Set(),
    mouse: { x: 0, y: 0, down: false, screenDx: 0, screenDy: 0 },
  };

  const GAME_KEYS = [
    'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyM', 'KeyR', 'Space',
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'ShiftLeft', 'ShiftRight',
  ];

  window.addEventListener('keydown', (e) => {
    if (!GAME_KEYS.includes(e.code)) return;
    e.preventDefault();
    if (!input.keys.has(e.code)) input.justPressed.add(e.code);
    input.keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => {
    input.keys.delete(e.code);
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
    input.mouse.down = false;
  });

  const trackMouse = (e) => {
    const rect = canvas.getBoundingClientRect();
    input.mouse.x = e.clientX - rect.left;
    input.mouse.y = e.clientY - rect.top;
    input.mouse.screenDx = input.mouse.x - rect.width / 2;
    input.mouse.screenDy = input.mouse.y - rect.height / 2;
  };
  canvas.addEventListener('mousemove', trackMouse);
  canvas.addEventListener('mousedown', (e) => {
    trackMouse(e);
    input.mouse.down = true;
  });
  window.addEventListener('mouseup', () => {
    input.mouse.down = false;
  });

  return input;
}
