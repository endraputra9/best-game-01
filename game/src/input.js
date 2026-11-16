// Keyboard and mouse state for Sparkhollow. The rest of the game reads plain
// fields off one Input: held keys, edge-triggered presses (consumed once), and
// the pointer in logical field coordinates. The view transform that maps page
// pixels to field pixels is supplied by main.js, so input stays DOM-only.

export class Input {
  constructor(canvas, toField) {
    this.keys = new Set();
    this.presses = new Set();
    this.mouse = { x: 0, y: 0, down: false, rightDown: false };
    this.mousePressed = false;
    this.rightPressed = false;
    this.toField = toField;

    window.addEventListener('keydown', (event) => {
      if (event.repeat) return;
      this.keys.add(event.code);
      this.presses.add(event.code);
      if (event.code.startsWith('Arrow') || event.code === 'Space') event.preventDefault();
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouse.down = false;
      this.mouse.rightDown = false;
    });
    canvas.addEventListener('pointermove', (event) => {
      const point = this.toField(event.clientX, event.clientY);
      this.mouse.x = point.x;
      this.mouse.y = point.y;
    });
    canvas.addEventListener('pointerdown', (event) => {
      const point = this.toField(event.clientX, event.clientY);
      this.mouse.x = point.x;
      this.mouse.y = point.y;
      if (event.button === 0) {
        this.mouse.down = true;
        this.mousePressed = true;
      } else if (event.button === 2) {
        this.mouse.rightDown = true;
        this.rightPressed = true;
      }
      canvas.setPointerCapture?.(event.pointerId);
    });
    window.addEventListener('pointerup', (event) => {
      if (event.button === 0) this.mouse.down = false;
      if (event.button === 2) this.mouse.rightDown = false;
    });
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  /** True while any of the given key codes is held. */
  down(...codes) {
    return codes.some((code) => this.keys.has(code));
  }

  /** True once per physical press of any given code; consumes the press. */
  pressed(...codes) {
    const hit = codes.some((code) => this.presses.has(code));
    if (hit) for (const code of codes) this.presses.delete(code);
    return hit;
  }

  /** The movement axis the keys ask for, each component in -1, 0 or 1. */
  axis() {
    const x = (this.down('KeyD', 'ArrowRight') ? 1 : 0) - (this.down('KeyA', 'ArrowLeft') ? 1 : 0);
    const y = (this.down('KeyS', 'ArrowDown') ? 1 : 0) - (this.down('KeyW', 'ArrowUp') ? 1 : 0);
    return { x, y };
  }

  /** Clear per-frame edges; call once after each frame has read them. */
  endFrame() {
    this.presses.clear();
    this.mousePressed = false;
    this.rightPressed = false;
  }
}
