const ANGLE = (45 * Math.PI) / 180;
const DIR = { x: -Math.cos(ANGLE), y: Math.sin(ANGLE) }; // along the line
const NORMAL = { x: Math.cos(ANGLE), y: Math.sin(ANGLE) }; // spacing axis

const LINE_SPACING = 26;
const STROKE_WIDTH = 1.4;
const EDGE_ALPHA = 0.05;
const CENTER_ALPHA = 0.16;

const RIPPLE_RADIUS = 170;
const RIPPLE_WINDOW = 220; // px of line subdivided around the closest point to the pointer
const RIPPLE_STEP = 18;
const RIPPLE_AMPLITUDE = 7;
const RIPPLE_WAVELENGTH = 46;
const RIPPLE_SPEED = 0.09;
const HOLD_MS = 80;
const DECAY_MS = 700;
const SETTLE_EPSILON = 0.01;

const canInteract =
  typeof matchMedia === "function" &&
  matchMedia("(hover: hover) and (pointer: fine)").matches &&
  !matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Diagonal line-pattern background for dark-blue blocks. Renders as a static
 * pattern by default; on capable pointers it also ripples toward the cursor
 * and relaxes back to flat when the cursor moves away or stops.
 */
export class LinePattern {
  constructor(container, { opacity = 1 } = {}) {
    this.container = container;
    this.opacity = opacity;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "line-pattern__canvas";
    this.canvas.setAttribute("aria-hidden", "true");
    this.ctx = this.canvas.getContext("2d");
    this.container.prepend(this.canvas);

    this.width = 0;
    this.height = 0;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.pointer = { x: 0, y: 0 };
    this.lastMoveAt = -Infinity;
    this.hovering = false;
    this.rafId = null;
    this.startTime = performance.now();

    this._onResize = this._resize.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerLeave = this._onPointerLeave.bind(this);
    this._tick = this._tick.bind(this);

    this.resizeObserver = new ResizeObserver(this._onResize);
    this.resizeObserver.observe(this.container);
    this._resize();

    if (canInteract) {
      this.container.addEventListener("pointermove", this._onPointerMove);
      this.container.addEventListener("pointerleave", this._onPointerLeave);
    }
  }

  _resize() {
    const rect = this.container.getBoundingClientRect();
    this.width = Math.max(1, Math.round(rect.width));
    this.height = Math.max(1, Math.round(rect.height));
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this._draw(0);
  }

  _onPointerMove(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = event.clientX - rect.left;
    this.pointer.y = event.clientY - rect.top;
    this.lastMoveAt = performance.now();
    this.hovering = true;
    this._ensureLoop();
  }

  _onPointerLeave() {
    this.hovering = false;
  }

  _ensureLoop() {
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(this._tick);
    }
  }

  _tick(now) {
    const idle = now - this.lastMoveAt;
    let amplitude = 0;
    if (this.hovering && idle < HOLD_MS) {
      amplitude = 1;
    } else {
      const decayIdle = Math.max(0, idle - HOLD_MS);
      amplitude = Math.max(0, 1 - decayIdle / DECAY_MS);
    }

    this._draw(amplitude, now);

    if (amplitude > SETTLE_EPSILON) {
      this.rafId = requestAnimationFrame(this._tick);
    } else {
      this.rafId = null;
    }
  }

  _draw(amplitude, now = performance.now()) {
    const { ctx, width, height } = this;
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.clip();
    ctx.lineCap = "round";
    ctx.strokeStyle = "#ffffff";

    const halfDiag = Math.hypot(width, height) / 2;
    const cx = width / 2;
    const cy = height / 2;
    const lineLength = width + height;
    const time = (now - this.startTime) / 1000;

    const offsets = this._offsetRange(width, height);
    for (const offset of offsets) {
      const p0 = { x: NORMAL.x * offset, y: NORMAL.y * offset };
      // radial falloff based on this line's offset from the pattern's own center axis
      const normalized = Math.min(1, Math.abs(offset - (NORMAL.x * cx + NORMAL.y * cy)) / halfDiag);
      const alpha = (CENTER_ALPHA - (CENTER_ALPHA - EDGE_ALPHA) * normalized) * this.opacity;

      ctx.globalAlpha = alpha;
      ctx.lineWidth = STROKE_WIDTH;

      const start = { x: p0.x - DIR.x * (lineLength / 2), y: p0.y - DIR.y * (lineLength / 2) };
      const end = { x: p0.x + DIR.x * (lineLength / 2), y: p0.y + DIR.y * (lineLength / 2) };

      if (amplitude <= SETTLE_EPSILON) {
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        continue;
      }

      this._strokeRippled(start, end, offset, amplitude, time);
    }

    ctx.restore();
  }

  _offsetRange(width, height) {
    const corners = [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: 0, y: height },
      { x: width, y: height },
    ];
    const offsets = corners.map((c) => c.x * NORMAL.x + c.y * NORMAL.y);
    const min = Math.min(...offsets);
    const max = Math.max(...offsets);
    const result = [];
    for (let o = min - LINE_SPACING; o <= max + LINE_SPACING; o += LINE_SPACING) {
      result.push(o);
    }
    return result;
  }

  _strokeRippled(start, end, offset, amplitude, time) {
    const { ctx, pointer } = this;

    // Closest point on the (infinite) line to the pointer, via projection onto DIR.
    const toPointer = { x: pointer.x - start.x, y: pointer.y - start.y };
    const along = toPointer.x * DIR.x + toPointer.y * DIR.y;
    const closest = { x: start.x + DIR.x * along, y: start.y + DIR.y * along };
    const distToPointer = Math.hypot(closest.x - pointer.x, closest.y - pointer.y);

    if (distToPointer > RIPPLE_RADIUS + RIPPLE_WINDOW) {
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      return;
    }

    const windowStart = along - RIPPLE_WINDOW;
    const windowEnd = along + RIPPLE_WINDOW;

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);

    const preEnd = { x: start.x + DIR.x * windowStart, y: start.y + DIR.y * windowStart };
    ctx.lineTo(preEnd.x, preEnd.y);

    for (let t = windowStart; t <= windowEnd; t += RIPPLE_STEP) {
      const p = { x: start.x + DIR.x * t, y: start.y + DIR.y * t };
      const dist = Math.hypot(p.x - pointer.x, p.y - pointer.y);
      const falloff = Math.max(0, 1 - dist / RIPPLE_RADIUS);
      const smooth = falloff * falloff * (3 - 2 * falloff);
      const wave = Math.sin(dist / RIPPLE_WAVELENGTH - time / RIPPLE_SPEED);
      const displacement = amplitude * smooth * wave * RIPPLE_AMPLITUDE;
      ctx.lineTo(p.x + NORMAL.x * displacement, p.y + NORMAL.y * displacement);
    }

    const postStart = { x: start.x + DIR.x * windowEnd, y: start.y + DIR.y * windowEnd };
    ctx.lineTo(postStart.x, postStart.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  }

  destroy() {
    this.resizeObserver.disconnect();
    this.container.removeEventListener("pointermove", this._onPointerMove);
    this.container.removeEventListener("pointerleave", this._onPointerLeave);
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.canvas.remove();
  }
}

export function initLinePatterns(selector = "[data-line-pattern]") {
  const instances = [];
  document.querySelectorAll(selector).forEach((el) => {
    const opacity = el.dataset.linePattern ? Number(el.dataset.linePattern) : 1;
    instances.push(new LinePattern(el, { opacity }));
  });
  return instances;
}
