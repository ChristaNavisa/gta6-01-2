// Keyboard + mouse input for VERDE BAY 3D v8. Binds to a state object the sim owns.
export function createInput() {
  return { keys: new Set(), justPressed: new Set(), mouse: { x: 0, y: 0, down: false } };
}

const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyR', 'KeyF', 'KeyC',
  'ShiftLeft', 'ShiftRight', 'Digit1', 'Digit2', 'Digit3', 'Escape', 'Enter', 'Space',
]);

export function attachInput(S, canvas) {
  const input = S.input;
  window.addEventListener('keydown', (e) => {
    if (!GAME_KEYS.has(e.code)) return;
    if (e.code === 'Space') e.preventDefault();
    if (!input.keys.has(e.code)) input.justPressed.add(e.code);
    input.keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => { input.keys.delete(e.code); });
  window.addEventListener('blur', () => { input.keys.clear(); });
  if (canvas) {
    canvas.addEventListener('mousedown', (e) => {
      input.mouse.down = true;
      input.justPressed.add('Mouse0');
    });
    canvas.addEventListener('mouseup', () => { input.mouse.down = false; });
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      input.mouse.x = e.clientX - r.left;
      input.mouse.y = e.clientY - r.top;
    });
  }
  return input;
}
