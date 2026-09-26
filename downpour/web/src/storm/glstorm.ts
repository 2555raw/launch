/* The sky, on the GPU (WebGL2): deep space.
 *
 *   sky       a fragment shader renders layered starfields that twinkle, drifting
 *             nebulae, a galaxy band with dust lanes, a far spiral galaxy and the limb
 *             of a planet, at reduced resolution into a texture
 *   stars     the currency stars: glowing orbs in the currency's colour with a halo,
 *             diffraction spikes and the currency sign on their face; they are born
 *             with a flare, drift slowly upward and fade out after a while
 *   sparkles  bursts of sparks and a shockwave when a star is tapped, and the dust a
 *             shooting star sheds as it goes
 *   meteors   shooting stars: a bright head with a fading tail, bloomed, lighting the
 *             nebula they cross; tap the empty sky to send one through that point
 *   lens      vignette and film grain over everything
 *
 * Quality drops automatically if frames get slow, taps send at most one shooting star
 * every 0.35 s, and under prefers-reduced-motion a single still frame is drawn. If
 * WebGL2 is missing, Storm.tsx falls back to the 2D sky in engine.ts. */
import { CURRENCIES, currencyColor, dropGlyph } from '../data/currencies';
import { FULLSCREEN_VS, freeTarget, program, target, type Program, type Target } from './gl';
import * as S from './shaders';
import { COLUMN, type Intensity, type Scene, type StormRenderer } from './types';

type Pt = [number, number];

interface Star {
  x: number;
  y: number;
  r: number;
  vy: number;
  code: string;
  phase: number;
  rate: number;
  born: number;
  life: number;
  charge: number;
  alpha: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  grow: number;
  type: 0 | 1;
  tint: [number, number, number];
}

interface Meteor {
  born: number;
  dur: number;
  tail: number;
  from: Pt;
  to: Pt;
  width: number;
  bright: number;
  offset: number;
  count: number;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const MAX_STARS = 24;
const MAX_PARTS = 900;
const MAX_METEORS = 24;
const METEOR_POINTS = 24;
const IGNITE = 1.3;
const FADE = 1.6;

/** Where a currency star may sit on the hero without covering the headline. */
export function heroSpot(w: number, h: number, r: number) {
  const side = Math.max(0, w * 0.15);
  if (Math.random() < 0.3) return { x: rand(r * 3, w - r * 3), y: rand(h * 0.8, h * 0.95), alpha: 1 };
  const y = rand(h * 0.14, h * 0.8);
  if (side < r * 5) return { x: rand(r * 2, w - r * 2), y, alpha: 0.4 };
  const x = Math.random() < 0.5 ? rand(r * 2.5, side) : rand(w - side, w - r * 2.5);
  return { x, y, alpha: 1 };
}

const rgbCache = new Map<string, [number, number, number]>();
function rgbOf(code: string): [number, number, number] {
  const hit = rgbCache.get(code);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = 1;
  const g = c.getContext('2d')!;
  g.fillStyle = currencyColor(code);
  g.fillRect(0, 0, 1, 1);
  const d = g.getImageData(0, 0, 1, 1).data;
  const out: [number, number, number] = [d[0] / 255, d[1] / 255, d[2] / 255];
  rgbCache.set(code, out);
  return out;
}

export class GLStorm implements StormRenderer {
  onPop?: (code: string) => void;

  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private reduced: boolean;
  private running = false;
  private raf = 0;
  private last = 0;
  private t0 = performance.now() / 1000;

  private w = 0;
  private h = 0;
  private dpr = 1;
  private skyScale = 0.6;

  private progs!: Record<'sky' | 'blit' | 'drop' | 'part' | 'bolt' | 'blur' | 'add' | 'overlay', Program>;
  private vaoEmpty!: WebGLVertexArrayObject;
  private vaoDrop!: WebGLVertexArrayObject;
  private vaoPart!: WebGLVertexArrayObject;
  private vaoBolt!: WebGLVertexArrayObject;
  private bufDrop!: WebGLBuffer;
  private bufPart!: WebGLBuffer;
  private bufBolt!: WebGLBuffer;
  private atlas!: WebGLTexture;
  private sky?: Target;
  private boltRT?: Target;
  private blurA?: Target;
  private blurB?: Target;

  private dropData = new Float32Array(MAX_STARS * 11);
  private partData = new Float32Array(MAX_PARTS * 8);
  private boltData = new Float32Array(MAX_METEORS * METEOR_POINTS * 2 * 8);

  private stars: Star[] = [];
  private parts: Particle[] = [];
  private meteors: Meteor[] = [];
  private codes: string[] = ['USD', 'EUR', 'JPY', 'GBP', 'BRL', 'MXN', 'INR', 'KRW', 'NGN', 'TRY', 'CHF', 'ZAR', 'VND', 'CAD', 'AUD', 'XAU'];
  private glyphIndex = new Map<string, number>();

  private intensity: Intensity = 'storm';
  private scene: Scene = 'content';
  private flash = 0;
  private flashAt: Pt = [0.5, 0.8];
  private nextAuto = 0;
  private lastTap = 0;
  private frameTimes: number[] = [];
  private lost = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: true, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL2 is not available');
    this.gl = gl;
    this.reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.init();
    canvas.addEventListener('webglcontextlost', this.onLost, false);
    canvas.addEventListener('webglcontextrestored', this.onRestored, false);
    this.resize();
    if (document.fonts?.ready) document.fonts.ready.then(() => !this.lost && this.buildAtlas());
  }

  /* ------------------------------ GL setup ------------------------------ */

  private init() {
    const gl = this.gl;
    const U = (...n: string[]) => n;
    this.progs = {
      sky: program(gl, FULLSCREEN_VS, S.SKY_FS, U('uTime', 'uAspect', 'uFlash')),
      blit: program(gl, FULLSCREEN_VS, S.BLIT_FS, U('uTex')),
      drop: program(gl, S.DROP_VS, S.DROP_FS, U('uRes', 'uAtlas', 'uFlash')),
      part: program(gl, S.PART_VS, S.PART_FS, U('uRes', 'uFlash')),
      bolt: program(gl, S.BOLT_VS, S.BOLT_FS, U('uRes', 'uWidthScale', 'uIntensity', 'uReveal', 'uColor', 'uSharp', 'uTail')),
      blur: program(gl, FULLSCREEN_VS, S.BLUR_FS, U('uTex', 'uDir')),
      add: program(gl, FULLSCREEN_VS, S.ADD_FS, U('uTex', 'uStrength')),
      overlay: program(gl, FULLSCREEN_VS, S.OVERLAY_FS, U('uAspect', 'uTime', 'uRes')),
    };
    this.vaoEmpty = gl.createVertexArray()!;

    const quad = () => {
      const b = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      return b;
    };
    const attr = (prog: Program, name: string, size: number, stride: number, offset: number, divisor: number) => {
      const loc = gl.getAttribLocation(prog.prog, name);
      if (loc < 0) return;
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset);
      gl.vertexAttribDivisor(loc, divisor);
    };

    // currency stars
    this.vaoDrop = gl.createVertexArray()!;
    gl.bindVertexArray(this.vaoDrop);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad());
    attr(this.progs.drop, 'aCorner', 2, 8, 0, 0);
    this.bufDrop = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufDrop);
    gl.bufferData(gl.ARRAY_BUFFER, this.dropData.byteLength, gl.DYNAMIC_DRAW);
    attr(this.progs.drop, 'aPos', 4, 44, 0, 1);
    attr(this.progs.drop, 'aMisc', 4, 44, 16, 1);
    attr(this.progs.drop, 'aTint', 3, 44, 32, 1);

    // sparkles and shockwaves
    this.vaoPart = gl.createVertexArray()!;
    gl.bindVertexArray(this.vaoPart);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad());
    attr(this.progs.part, 'aCorner', 2, 8, 0, 0);
    this.bufPart = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufPart);
    gl.bufferData(gl.ARRAY_BUFFER, this.partData.byteLength, gl.DYNAMIC_DRAW);
    attr(this.progs.part, 'aP', 4, 32, 0, 1);
    attr(this.progs.part, 'aQ', 4, 32, 16, 1);

    // shooting stars
    this.vaoBolt = gl.createVertexArray()!;
    gl.bindVertexArray(this.vaoBolt);
    this.bufBolt = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufBolt);
    gl.bufferData(gl.ARRAY_BUFFER, this.boltData.byteLength, gl.DYNAMIC_DRAW);
    attr(this.progs.bolt, 'aPos', 2, 32, 0, 0);
    attr(this.progs.bolt, 'aNormal', 2, 32, 8, 0);
    attr(this.progs.bolt, 'aInfo', 4, 32, 16, 0);
    gl.bindVertexArray(null);

    this.atlas = gl.createTexture()!;
    this.buildAtlas();
    this.meteors = [];
  }

  /** Every currency sign, white on transparent, in a 16 x 16 grid of 64 px cells. */
  private buildAtlas() {
    const gl = this.gl;
    const cell = 64;
    const c = document.createElement('canvas');
    c.width = c.height = cell * 16;
    const g = c.getContext('2d')!;
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    CURRENCIES.forEach((cur, i) => {
      if (i >= 256) return;
      this.glyphIndex.set(cur.code, i);
      const glyph = dropGlyph(cur.code);
      let size = [...glyph].length >= 3 ? 26 : [...glyph].length === 2 ? 32 : 42;
      g.font = `800 ${size}px "Sora Variable", "Sora", system-ui, sans-serif`;
      const wdt = g.measureText(glyph).width;
      if (wdt > cell * 0.84) {
        size = Math.floor((size * cell * 0.84) / wdt);
        g.font = `800 ${size}px "Sora Variable", "Sora", system-ui, sans-serif`;
      }
      const cx = (i % 16) * cell + cell / 2;
      const cy = Math.floor(i / 16) * cell + cell / 2 + 2;
      g.fillText(glyph, cx, cy);
    });
    gl.bindTexture(gl.TEXTURE_2D, this.atlas);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  private onLost = (e: Event) => {
    e.preventDefault();
    this.lost = true;
    cancelAnimationFrame(this.raf);
  };

  private onRestored = () => {
    this.lost = false;
    this.sky = this.boltRT = this.blurA = this.blurB = undefined;
    this.init();
    this.resize();
    if (this.running) {
      this.running = false;
      this.start();
    }
  };

  /* ------------------------------ sizing ------------------------------ */

  resize() {
    if (this.lost) return;
    const mobile = window.innerWidth < 720;
    this.dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.35 : 1.6);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.canvas.style.width = `${this.w}px`;
    this.canvas.style.height = `${this.h}px`;
    if (mobile) this.skyScale = Math.min(this.skyScale, 0.5);
    this.makeTargets();
    this.fillStars();
    if (this.reduced || !this.running) this.frame(performance.now(), true);
  }

  private makeTargets() {
    const gl = this.gl;
    freeTarget(gl, this.sky);
    freeTarget(gl, this.boltRT);
    freeTarget(gl, this.blurA);
    freeTarget(gl, this.blurB);
    const W = this.canvas.width;
    const H = this.canvas.height;
    // the sky is rendered against CSS pixels, not device pixels, to keep hi-dpi screens cheap
    this.sky = target(gl, Math.max(2, Math.round(this.w * this.skyScale)), Math.max(2, Math.round(this.h * this.skyScale)));
    this.boltRT = target(gl, Math.max(2, Math.round(W / 2)), Math.max(2, Math.round(H / 2)));
    this.blurA = target(gl, Math.max(2, Math.round(W / 4)), Math.max(2, Math.round(H / 4)));
    this.blurB = target(gl, Math.max(2, Math.round(W / 4)), Math.max(2, Math.round(H / 4)));
  }

  /* ------------------------------ controls ------------------------------ */

  setCurrencies(codes: string[]) {
    if (codes.length) this.codes = codes;
  }

  setIntensity(i: Intensity) {
    this.intensity = i;
  }

  setScene(scene: Scene) {
    if (scene === this.scene) return;
    this.scene = scene;
    this.stars = [];
    this.fillStars();
  }

  get isRunning() {
    return this.running;
  }

  /* ------------------------------ currency stars ------------------------------ */

  private gutter() {
    return Math.max(0, (this.w - COLUMN) / 2);
  }

  private targetStars() {
    if (this.scene === 'hero') return this.w < 720 ? 6 : this.w < 1100 ? 9 : 12;
    return this.gutter() >= 90 ? 8 : 3;
  }

  private fillStars() {
    const n = this.targetStars();
    while (this.stars.length < n) this.stars.push(this.newStar(true));
    if (this.stars.length > n) this.stars.length = n;
  }

  private newStar(settled = false): Star {
    const big = Math.random() < 0.3;
    let r = big ? rand(19, 27) : rand(11, 17);
    const code = this.codes[Math.floor(Math.random() * this.codes.length)];
    let x = rand(r * 3, this.w - r * 3);
    let y = rand(this.h * 0.14, this.h * 0.94);
    let vy = -rand(5, 13);
    let alpha = 1;
    if (this.scene === 'hero') {
      // keep the headline clear: beside it, or below the buttons
      ({ x, y, alpha } = heroSpot(this.w, this.h, r));
      vy = -rand(1.5, 4);
    } else {
      const g = this.gutter();
      if (g >= 90) {
        r = Math.min(r, g * 0.2);
        x = Math.random() < 0.5 ? rand(r * 2.5, g - r * 2) : rand(this.w - g + r * 2, this.w - r * 2.5);
      } else {
        alpha = 0.35;
        r *= 0.8;
      }
    }
    const now = performance.now() / 1000;
    const life = rand(16, 34);
    return {
      x,
      y,
      r,
      vy,
      code,
      phase: Math.random() * Math.PI * 2,
      rate: rand(1.4, 2.8),
      // settled stars are already shining, part way through their life
      born: settled ? now - rand(IGNITE, life * 0.7) : now,
      life,
      charge: 0,
      alpha,
    };
  }

  /** A new star flares up: a ring of light and a few sparks. */
  private ignite(s: Star) {
    const tint = rgbOf(s.code);
    if (this.parts.length < MAX_PARTS) this.parts.push({ x: s.x, y: s.y, vx: 0, vy: 0, life: 0, max: 0.9, size: s.r * 0.6, grow: 70, type: 1, tint });
    for (let i = 0; i < 8 && this.parts.length < MAX_PARTS; i++) {
      const a = rand(0, Math.PI * 2);
      const v = rand(20, 70);
      this.parts.push({ x: s.x, y: s.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: rand(0.6, 1.1), size: rand(1.2, 2.4), grow: 0, type: 0, tint });
    }
  }

  pop(x: number, y: number) {
    const now = performance.now() / 1000;
    for (let i = this.stars.length - 1; i >= 0; i--) {
      const s = this.stars[i];
      if (now - s.born < IGNITE * 0.5) continue;
      if (Math.hypot(s.x - x, s.y - y) < s.r * 1.5) {
        this.burst(s.x, s.y, s.r, rgbOf(s.code));
        this.onPop?.(s.code);
        this.flash = Math.min(1, this.flash + 0.35);
        this.flashAt = [s.x / this.w, 1 - s.y / this.h];
        const next = this.newStar();
        this.stars[i] = next;
        this.ignite(next);
        return true;
      }
    }
    return false;
  }

  /** A star bursting: sparks flying out and slowing down, and a shockwave. */
  private burst(x: number, y: number, r: number, tint: [number, number, number]) {
    for (let i = 0; i < 34 && this.parts.length < MAX_PARTS; i++) {
      const a = rand(0, Math.PI * 2);
      const v = rand(50, 280);
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: rand(0.6, 1.3), size: rand(1.4, 3.6), grow: 0, type: 0, tint });
    }
    if (this.parts.length < MAX_PARTS) this.parts.push({ x, y, vx: 0, vy: 0, life: 0, max: 0.7, size: r * 0.8, grow: 190, type: 1, tint });
    if (this.parts.length < MAX_PARTS) this.parts.push({ x, y, vx: 0, vy: 0, life: 0, max: 0.45, size: r * 0.5, grow: 110, type: 1, tint: [1, 1, 1] });
  }

  /* ------------------------------ shooting stars ------------------------------ */

  /** A shooting star through (x, y) if given, else somewhere across the upper sky. */
  strike(x?: number, y?: number) {
    if (this.reduced || this.lost) return;
    const now = performance.now() / 1000;
    if (x !== undefined) {
      if (now - this.lastTap < 0.35) return;
      this.lastTap = now;
    }
    // mostly falling down and across, like meteors do
    const dir = Math.random() < 0.5 ? -1 : 1;
    const ang = rand(0.28, 0.7);
    const dx = Math.cos(ang) * dir;
    const dy = Math.sin(ang);
    const len = x !== undefined ? rand(320, 520) : rand(220, 480) * Math.min(1.3, Math.max(0.7, this.w / 1440));
    let from: Pt;
    if (x !== undefined && y !== undefined) {
      // the tap point sits a little past the middle, where the head is brightest
      from = [x - dx * len * 0.6, y - dy * len * 0.6];
    } else {
      from = [rand(this.w * 0.08, this.w * 0.92), rand(-20, this.h * 0.45)];
    }
    const to: Pt = [from[0] + dx * len, from[1] + dy * len];
    const bright = x !== undefined ? 1 : rand(0.55, 1);
    this.meteors = this.meteors.filter((m) => now - m.born < m.dur);
    if (this.meteors.length >= MAX_METEORS) this.meteors.shift();
    this.meteors.push({ born: now, dur: rand(0.75, 1.15), tail: rand(0.3, 0.42), from, to, width: rand(7, 10), bright, offset: 0, count: 0 });
    this.writeMeteors();
  }

  /** Rebuilds the meteor vertex buffer: a straight strip per meteor, t 0..1 along it. */
  private writeMeteors() {
    let v = 0;
    for (const m of this.meteors) {
      m.offset = v;
      const ddx = m.to[0] - m.from[0];
      const ddy = m.to[1] - m.from[1];
      const l = Math.hypot(ddx, ddy) || 1;
      const nx = -ddy / l;
      const ny = ddx / l;
      for (let i = 0; i < METEOR_POINTS; i++) {
        const t = i / (METEOR_POINTS - 1);
        const px = m.from[0] + ddx * t;
        const py = m.from[1] + ddy * t;
        // the head is wider than the tail
        const wdt = m.width * (0.45 + 0.55 * t);
        for (const side of [-1, 1]) {
          this.boltData.set([px, py, nx, ny, side, wdt, m.bright, t], v * 8);
          v++;
        }
      }
      m.count = METEOR_POINTS * 2;
    }
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufBolt);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.boltData.subarray(0, v * 8));
  }

  /** Where a meteor's head is and how bright it is at `now`. */
  private meteorState(m: Meteor, now: number) {
    const k = (now - m.born) / m.dur;
    const reveal = k * (1 + m.tail);
    const head = Math.min(1, reveal);
    const fadeIn = Math.min(1, k / 0.12);
    const fadeOut = reveal > 1 ? Math.max(0, 1 - (reveal - 1) / m.tail) : 1;
    const x = m.from[0] + (m.to[0] - m.from[0]) * head;
    const y = m.from[1] + (m.to[1] - m.from[1]) * head;
    return { reveal, x, y, intensity: fadeIn * fadeOut * m.bright, live: reveal <= 1 };
  }

  /* ------------------------------ loop ------------------------------ */

  start() {
    if (this.lost) return;
    if (this.reduced) {
      this.frame(performance.now(), true);
      return;
    }
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.nextAuto = this.last / 1000 + rand(0.8, 2.2);
    const loop = (t: number) => {
      if (!this.running || this.lost) return;
      this.frame(t);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /** Renders a single frame as if it were `ms` (performance.now() clock). For tests and stills. */
  renderAt(ms: number) {
    this.frame(ms, false);
  }

  destroy() {
    this.stop();
    this.canvas.removeEventListener('webglcontextlost', this.onLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onRestored);
  }

  /** Lowers the sky's resolution if frames are slow. */
  private adapt(dtMs: number) {
    this.frameTimes.push(dtMs);
    if (this.frameTimes.length < 90) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes = [];
    if (avg > 25 && this.skyScale > 0.3) {
      this.skyScale = Math.max(0.3, this.skyScale * 0.8);
      this.makeTargets();
    }
  }

  private frame(nowMs: number, still = false) {
    if (this.lost) return;
    const gl = this.gl;
    const now = nowMs / 1000;
    const dt = still ? 0 : Math.max(0, Math.min(0.05, (nowMs - this.last) / 1000));
    if (!still && this.last) this.adapt(nowMs - this.last);
    this.last = nowMs;
    const time = now - this.t0;
    const shower = this.intensity === 'storm';

    // shooting stars on their own: a shower, or now and then when calm
    if (!still && now > this.nextAuto) {
      this.strike();
      if (shower && Math.random() < 0.25) this.strike();
      this.nextAuto = now + (shower ? rand(1.4, 3.8) : rand(6, 12));
    }

    // physics
    if (!still) {
      for (let i = 0; i < this.stars.length; i++) {
        const s = this.stars[i];
        s.y += s.vy * dt;
        s.phase += dt * s.rate;
        s.x += Math.sin(s.phase * 0.35) * 3 * dt;
        s.charge = Math.max(0, s.charge - dt * 0.8);
        if (now - s.born > s.life || s.y < -s.r * 3.5) {
          const next = this.newStar();
          this.stars[i] = next;
          this.ignite(next);
        }
      }
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const p = this.parts[i];
        p.life += dt;
        if (p.life > p.max) {
          this.parts.splice(i, 1);
          continue;
        }
        if (p.type === 0) {
          // no gravity out here, just drag
          const drag = Math.exp(-dt * 2.6);
          p.vx *= drag;
          p.vy *= drag;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
        } else p.size += p.grow * dt;
      }
    }

    // meteors: their heads shed dust, light the gas and wake the stars they pass
    this.meteors = this.meteors.filter((m) => now - m.born < m.dur);
    let glow = 0;
    const white: [number, number, number] = [0.85, 0.9, 1];
    for (const m of this.meteors) {
      const st = this.meteorState(m, now);
      if (!st.live) continue;
      if (st.intensity > glow) {
        glow = st.intensity;
        this.flashAt = [st.x / this.w, 1 - st.y / this.h];
      }
      if (!still && Math.random() < 0.6 && this.parts.length < MAX_PARTS) {
        this.parts.push({ x: st.x + rand(-2, 2), y: st.y + rand(-2, 2), vx: rand(-14, 14), vy: rand(-14, 14), life: 0, max: rand(0.35, 0.7), size: rand(0.8, 1.7), grow: 0, type: 0, tint: white });
      }
      for (const s of this.stars) if (Math.hypot(s.x - st.x, s.y - st.y) < s.r * 3) s.charge = 1;
    }
    this.flash *= Math.exp(-dt * 5);
    const flash = Math.min(1, Math.max(this.flash, glow * 0.6));

    const W = this.canvas.width;
    const H = this.canvas.height;
    const aspect = this.w / this.h;
    const P = this.progs;

    // 1. sky into its texture
    gl.disable(gl.BLEND);
    gl.bindVertexArray(this.vaoEmpty);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.sky!.fbo);
    gl.viewport(0, 0, this.sky!.w, this.sky!.h);
    gl.useProgram(P.sky.prog);
    gl.uniform1f(P.sky.u.uTime, time);
    gl.uniform1f(P.sky.u.uAspect, aspect);
    gl.uniform3f(P.sky.u.uFlash, this.flashAt[0], this.flashAt[1], flash);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 2. sky onto the screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.useProgram(P.blit.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sky!.tex);
    gl.uniform1i(P.blit.u.uTex, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    // 3. currency stars
    let nd = 0;
    for (const s of this.stars) {
      if (nd >= MAX_STARS) break;
      const age = now - s.born;
      const igniting = age < IGNITE;
      const k = Math.min(1, age / IGNITE);
      // born small and over-bright, settling into its size
      const grow = igniting ? 0.15 + 0.85 * (1 - (1 - k) ** 3) : 1;
      const left = s.life - age;
      const fade = left < FADE ? Math.max(0, left / FADE) : 1;
      const tint = rgbOf(s.code);
      const o = nd * 11;
      this.dropData[o] = s.x;
      this.dropData[o + 1] = s.y;
      this.dropData[o + 2] = s.r * grow * (0.7 + 0.3 * fade);
      this.dropData[o + 3] = s.alpha * Math.min(1, k * 3) * fade;
      this.dropData[o + 4] = this.glyphIndex.get(s.code) ?? 0;
      this.dropData[o + 5] = Math.max(s.charge, igniting ? (1 - k) * 1.2 : 0);
      this.dropData[o + 6] = 0.5 + 0.5 * Math.sin(s.phase);
      this.dropData[o + 7] = 0;
      this.dropData[o + 8] = tint[0];
      this.dropData[o + 9] = tint[1];
      this.dropData[o + 10] = tint[2];
      nd++;
    }
    if (nd) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.bufDrop);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.dropData.subarray(0, nd * 11));
      gl.useProgram(P.drop.prog);
      gl.uniform2f(P.drop.u.uRes, this.w, this.h);
      gl.uniform1f(P.drop.u.uFlash, flash);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.atlas);
      gl.uniform1i(P.drop.u.uAtlas, 1);
      gl.bindVertexArray(this.vaoDrop);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, nd);
      gl.activeTexture(gl.TEXTURE0);
    }

    // 4. sparkles, added so they glow
    const np = Math.min(this.parts.length, MAX_PARTS);
    if (np) {
      for (let i = 0; i < np; i++) {
        const p = this.parts[i];
        const k = p.life / p.max;
        const tw = p.type === 0 ? 0.7 + 0.3 * Math.sin(p.life * 30 + i) : 1;
        const o = i * 8;
        this.partData[o] = p.x;
        this.partData[o + 1] = p.y;
        this.partData[o + 2] = p.size;
        this.partData[o + 3] = (p.type === 0 ? (1 - k) * 0.95 : (1 - k) ** 1.5 * 0.8) * tw;
        this.partData[o + 4] = p.type;
        this.partData[o + 5] = p.tint[0];
        this.partData[o + 6] = p.tint[1];
        this.partData[o + 7] = p.tint[2];
      }
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.bufPart);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.partData.subarray(0, np * 8));
      gl.useProgram(P.part.prog);
      gl.uniform2f(P.part.u.uRes, this.w, this.h);
      gl.uniform1f(P.part.u.uFlash, 0);
      gl.bindVertexArray(this.vaoPart);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, np);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }

    // 5. shooting stars: bloom from a half-resolution pass, then a crisp core on top
    if (this.meteors.length) {
      const draw = (widthScale: number, sharp: number, color: [number, number, number], gain: number) => {
        gl.useProgram(P.bolt.prog);
        gl.uniform2f(P.bolt.u.uRes, this.w, this.h);
        gl.uniform1f(P.bolt.u.uWidthScale, widthScale);
        gl.uniform3f(P.bolt.u.uColor, color[0], color[1], color[2]);
        gl.uniform1f(P.bolt.u.uSharp, sharp);
        gl.bindVertexArray(this.vaoBolt);
        for (const m of this.meteors) {
          const st = this.meteorState(m, now);
          gl.uniform1f(P.bolt.u.uIntensity, st.intensity * gain);
          gl.uniform1f(P.bolt.u.uReveal, st.reveal);
          gl.uniform1f(P.bolt.u.uTail, m.tail);
          gl.drawArrays(gl.TRIANGLE_STRIP, m.offset, m.count);
        }
      };
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.boltRT!.fbo);
      gl.viewport(0, 0, this.boltRT!.w, this.boltRT!.h);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      draw(1.0, 2.2, [0.5, 0.66, 1.0], 1.2);
      draw(0.35, 3.0, [0.95, 0.96, 1.0], 1.6);

      // blur: meteor -> A (horizontal) -> B (vertical) -> A (horizontal) -> B (vertical)
      gl.disable(gl.BLEND);
      gl.useProgram(P.blur.prog);
      gl.bindVertexArray(this.vaoEmpty);
      gl.uniform1i(P.blur.u.uTex, 0);
      const pass = (src: Target, dst: Target, dx: number, dy: number) => {
        gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo);
        gl.viewport(0, 0, dst.w, dst.h);
        gl.bindTexture(gl.TEXTURE_2D, src.tex);
        gl.uniform2f(P.blur.u.uDir, dx / src.w, dy / src.h);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      };
      pass(this.boltRT!, this.blurA!, 1.5, 0);
      pass(this.blurA!, this.blurB!, 0, 1.5);
      pass(this.blurB!, this.blurA!, 3, 0);
      pass(this.blurA!, this.blurB!, 0, 3);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, W, H);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(P.add.prog);
      gl.uniform1i(P.add.u.uTex, 0);
      gl.bindTexture(gl.TEXTURE_2D, this.blurB!.tex);
      gl.uniform1f(P.add.u.uStrength, 1.9);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindTexture(gl.TEXTURE_2D, this.boltRT!.tex);
      gl.uniform1f(P.add.u.uStrength, 0.4);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      draw(0.22, 2.6, [1.0, 1.0, 1.0], 2.2);
    }

    // 6. lens: vignette and grain, multiplied
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.DST_COLOR, gl.ZERO);
    gl.useProgram(P.overlay.prog);
    gl.bindVertexArray(this.vaoEmpty);
    gl.uniform1f(P.overlay.u.uAspect, aspect);
    gl.uniform1f(P.overlay.u.uTime, time);
    gl.uniform2f(P.overlay.u.uRes, this.w, this.h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
  }
}
