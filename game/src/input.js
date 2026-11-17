// Keyboard + mouse state, kept as one object the loop polls each frame.
export function createInput() {
  return {
    keys: new Set(),
    mouseX: 0, mouseY: 0,           // screen pixels, relative to the canvas
    mouseDown: false,
    clicked: false,                  // consumed by the game each frame
    justPressed: new Set(),          // keys pressed since last frame
    anyKey: false,
  };
}

export function attachInput(input, canvas) {
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!e.repeat) input.justPressed.add(e.code);
    input.keys.add(e.code);
    input.anyKey = true;
  });
  window.addEventListener('keyup', (e) => input.keys.delete(e.code));
  window.addEventListener('blur', () => { input.keys.clear(); input.mouseDown = false; });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouseX = e.clientX - r.left;
    input.mouseY = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { input.mouseDown = true; input.clicked = true; }
  });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) input.mouseDown = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

export function endFrameInput(input) {
  input.justPressed.clear();
  input.clicked = false;
}

export function keyDown(input, codes) {
  for (const c of codes) if (input.keys.has(c)) return true;
  return false;
}
export function keyPressed(input, codes) {
  for (const c of codes) if (input.justPressed.has(c)) return true;
  return false;
}
