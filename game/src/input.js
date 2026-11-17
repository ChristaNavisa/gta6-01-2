// VERDE BAY — keyboard + mouse input. One shared state object:
// keys (held), justPressed (edge-triggered, cleared each frame by the
// main loop), and the mouse position for aiming.

export function createInput() {
  const input = {
    keys: new Set(),
    justPressed: new Set(),
    mouse: { x: 0, y: 0, down: false },
    attached: false,
  };

  const KEYMAP = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    KeyE: 'enter',
    Space: 'brake',
    Escape: 'pause',
    Enter: 'confirm',
  };

  /** Wire listeners to the page. Call once. */
  input.attach = function attach() {
    if (input.attached) return;
    input.attached = true;
    window.addEventListener('keydown', (e) => {
      const k = KEYMAP[e.code];
      if (k) {
        if (!e.repeat) input.justPressed.add(k);
        input.keys.add(k);
        if (k === 'brake' || k === 'up' || k === 'down') e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      const k = KEYMAP[e.code];
      if (k) input.keys.delete(k);
    });
    window.addEventListener('blur', () => input.keys.clear());
    window.addEventListener('mousemove', (e) => {
      input.mouse.x = e.clientX;
      input.mouse.y = e.clientY;
    });
    window.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      input.mouse.down = true;
      input.mouse.x = e.clientX;
      input.mouse.y = e.clientY;
      input.justPressed.add('shoot');
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) input.mouse.down = false;
    });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
  };

  /** Call at the end of every frame: edge triggers live for one frame. */
  input.endFrame = function endFrame() {
    input.justPressed.clear();
  };

  return input;
}
