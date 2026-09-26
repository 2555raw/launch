/* The realistic storm, on the GPU (WebGL2).
 *
 *   sky        a fragment shader renders a deck of turbulent storm cloud (domain-warped
 *              noise, lit from above, dark in the belly), rain curtains under it and a
 *              city glow at the horizon, at reduced resolution into a texture
 *   rain       a few thousand instanced streaks at three depths of field
 *   drops      the currency drops: water that refracts that sky texture, flipped like a
 *              real drop does, with Fresnel reflection, a dark rim, a sharp highlight,
 *              a caustic and the currency sign embossed inside
 *   splashes   crowns of droplets and ripples where rain and drops land
 *   lightning  a stepped leader, then a return stroke and a restrike; the channel is
 *              drawn crisp and bloomed, and it lights the cloud from inside
 *   lens       vignette and film grain over everything
 *
 * Quality drops automatically if frames get slow. Flashes are capped (at most one
 * bolt per 0.7 s from taps, two pulses per bolt), and under prefers-reduced-motion a
 * single still frame is drawn. If WebGL2 is missing, Storm.tsx falls back to the 2D
 * engine in engine.ts. */
import { CURRENCIES, currencyColor, dropGlyph } from '../data/currencies';
import { FULLSCREEN_VS, freeTarget, program, target, type Program, type Target } from './gl';
import * as S from './shaders';
import { COLUMN, type Intensity, type Scene, type StormRenderer } from './types';

type Pt = [number, number];

interface Drop {
  x: number;
  y: number;
  r: number;
  vy: number;
  code: string;
  phase: number;
  born: number;
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

interface Bolt {
  born: number;
  leader: number;
  restrike: number;
  life: number;
  start: number; // vertex offset in the bolt buffer
  count: number[]; // vertices per strip
  offsets: number[];
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const MAX_RAIN = 2600;
const MAX_DROPS = 24;
const MAX_PARTS = 700;
const MAX_BOLT_VERTS = 12000;

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
  private skyScale = 0.5;
  private rainFactor = 1;
  private cloudBottom = 260;

  private progs!: Record<'sky' | 'blit' | 'rain' | 'drop' | 'part' | 'bolt' | 'blur' | 'add' | 'overlay', Program>;
  private vaoEmpty!: WebGLVertexArrayObject;
  private vaoRain!: WebGLVertexArrayObject;
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

  private dropData = new Float32Array(MAX_DROPS * 11);
  private partData = new Float32Array(MAX_PARTS * 8);
  private boltData = new Float32Array(MAX_BOLT_VERTS * 8);
  private boltVerts = 0;

  private drops: Drop[] = [];
  private parts: Particle[] = [];
  private bolts: Bolt[] = [];
  private codes: string[] = ['USD', 'EUR', 'JPY', 'GBP', 'BRL', 'MXN', 'INR', 'KRW', 'NGN', 'TRY', 'CHF', 'ZAR', 'VND', 'CAD', 'AUD', 'XAU'];
  private glyphIndex = new Map<string, number>();

  private intensity: Intensity = 'storm';
  private scene: Scene = 'content';
  private flash = 0;
  private flashQueue: number[] = [];
  private flashAt: Pt = [0.5, 0.8];
  private sheet = 0;
  private nextAuto = 0;
  private lastTapBolt = 0;
  private splashAcc = 0;
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
      sky: program(gl, FULLSCREEN_VS, S.SKY_FS, U('uTime', 'uAspect', 'uFlash', 'uSheet', 'uBase', 'uStorm', 'uHorizon', 'uShore')),
      blit: program(gl, FULLSCREEN_VS, S.BLIT_FS, U('uTex')),
      rain: program(gl, S.RAIN_VS, S.RAIN_FS, U('uTime', 'uRes', 'uWind', 'uTop', 'uFlash')),
      drop: program(gl, S.DROP_VS, S.DROP_FS, U('uRes', 'uSky', 'uAtlas', 'uFlash')),
      part: program(gl, S.PART_VS, S.PART_FS, U('uRes', 'uFlash')),
      bolt: program(gl, S.BOLT_VS, S.BOLT_FS, U('uRes', 'uWidthScale', 'uIntensity', 'uReveal', 'uColor', 'uSharp')),
      blur: program(gl, FULLSCREEN_VS, S.BLUR_FS, U('uTex', 'uDir')),
      add: program(gl, FULLSCREEN_VS, S.ADD_FS, U('uTex', 'uStrength')),
      overlay: program(gl, FULLSCREEN_VS, S.OVERLAY_FS, U('uAspect', 'uTime', 'uRes')),
    };
    this.vaoEmpty = gl.createVertexArray()!;

    const quad = (ys: [number, number]) => {
      const b = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, ys[0], 1, ys[0], -1, ys[1], 1, ys[1]]), gl.STATIC_DRAW);
      return b;
    };
    const attr = (prog: Program, name: string, size: number, stride: number, offset: number, divisor: number) => {
      const loc = gl.getAttribLocation(prog.prog, name);
      if (loc < 0) return;
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset);
      gl.vertexAttribDivisor(loc, divisor);
    };

    // rain: static seeds
    this.vaoRain = gl.createVertexArray()!;
    gl.bindVertexArray(this.vaoRain);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad([0, 1]));
    attr(this.progs.rain, 'aCorner', 2, 8, 0, 0);
    const seeds = new Float32Array(MAX_RAIN * 4);
    for (let i = 0; i < MAX_RAIN; i++) {
      seeds[i * 4] = Math.random();
      seeds[i * 4 + 1] = Math.random();
      // more far streaks than near ones
      seeds[i * 4 + 2] = Math.pow(Math.random(), 1.6);
      seeds[i * 4 + 3] = Math.random();
    }
    const bufSeeds = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, bufSeeds);
    gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
    attr(this.progs.rain, 'aSeed', 4, 16, 0, 1);

    // drops
    this.vaoDrop = gl.createVertexArray()!;
    gl.bindVertexArray(this.vaoDrop);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad([-1, 1]));
    attr(this.progs.drop, 'aCorner', 2, 8, 0, 0);
    this.bufDrop = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufDrop);
    gl.bufferData(gl.ARRAY_BUFFER, this.dropData.byteLength, gl.DYNAMIC_DRAW);
    attr(this.progs.drop, 'aPos', 4, 44, 0, 1);
    attr(this.progs.drop, 'aMisc', 4, 44, 16, 1);
    attr(this.progs.drop, 'aTint', 3, 44, 32, 1);

    // particles
    this.vaoPart = gl.createVertexArray()!;
    gl.bindVertexArray(this.vaoPart);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad([-1, 1]));
    attr(this.progs.part, 'aCorner', 2, 8, 0, 0);
    this.bufPart = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufPart);
    gl.bufferData(gl.ARRAY_BUFFER, this.partData.byteLength, gl.DYNAMIC_DRAW);
    attr(this.progs.part, 'aP', 4, 32, 0, 1);
    attr(this.progs.part, 'aQ', 4, 32, 16, 1);

    // bolts
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
    this.boltVerts = 0;
    this.bolts = [];
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
    this.cloudBottom = Math.max(190, Math.min(this.h * 0.36, 360));
    if (mobile) this.skyScale = Math.min(this.skyScale, 0.42);
    this.makeTargets();
    this.fillDrops();
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
    // clouds are soft: render them against CSS pixels, not device pixels, to keep hi-dpi screens cheap
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
    this.fillDrops();
  }

  get isRunning() {
    return this.running;
  }

  /* ------------------------------ drops ------------------------------ */

  private gutter() {
    return Math.max(0, (this.w - COLUMN) / 2);
  }

  private targetDrops() {
    if (this.scene === 'hero') return this.w < 720 ? 6 : this.w < 1100 ? 9 : 12;
    return this.gutter() >= 90 ? 8 : 3;
  }

  private fillDrops() {
    const n = this.targetDrops();
    while (this.drops.length < n) this.drops.push(this.newDrop(true));
    if (this.drops.length > n) this.drops.length = n;
  }

  private newDrop(anywhere = false): Drop {
    const big = Math.random() < 0.3;
    let r = big ? rand(24, 36) : rand(13, 22);
    const code = this.codes[Math.floor(Math.random() * this.codes.length)];
    let x = rand(r * 2, this.w - r * 2);
    let alpha = 1;
    if (this.scene === 'hero') {
      const mid = x > this.w * 0.26 && x < this.w * 0.74;
      if (mid && Math.random() < 0.7) x = Math.random() < 0.5 ? rand(r * 1.5, this.w * 0.26) : rand(this.w * 0.74, this.w - r * 1.5);
    } else {
      const g = this.gutter();
      if (g >= 90) {
        r = Math.min(r, g * 0.3);
        x = Math.random() < 0.5 ? rand(r * 1.5, g - r * 1.2) : rand(this.w - g + r * 1.2, this.w - r * 1.5);
      } else {
        alpha = 0.3;
        r *= 0.8;
      }
    }
    const top = this.cloudBottom - 4;
    return {
      x,
      y: anywhere ? rand(top + 30, this.h * 0.95) : top,
      r,
      vy: rand(38, 72) * (r / 26) ** 0.35,
      code,
      phase: Math.random() * Math.PI * 2,
      born: anywhere ? -10 : performance.now() / 1000,
      charge: 0,
      alpha,
    };
  }

  pop(x: number, y: number) {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      if (Math.hypot(d.x - x, d.y - y) < d.r * 1.3) {
        this.splash(d.x, d.y, d.r, rgbOf(d.code), true);
        this.onPop?.(d.code);
        this.drops[i] = this.newDrop();
        return true;
      }
    }
    return false;
  }

  private splash(x: number, y: number, r: number, tint: [number, number, number], big: boolean) {
    const n = big ? 18 : Math.round(8 + r / 4);
    for (let i = 0; i < n && this.parts.length < MAX_PARTS; i++) {
      const a = big ? rand(0, Math.PI * 2) : rand(Math.PI * 1.08, Math.PI * 1.92);
      const v = rand(70, big ? 300 : 210);
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: rand(0.45, 0.85), size: rand(1.6, big ? 4.2 : 3.4), grow: 0, type: 0, tint });
    }
    if (this.parts.length < MAX_PARTS) this.parts.push({ x, y: big ? y + r * 0.6 : y, vx: 0, vy: 0, life: 0, max: 0.7, size: r * 0.5, grow: 95, type: 1, tint });
  }

  /** Rain landing along the bottom of the screen: small crowns and ripples. */
  private rainSplashes(dt: number) {
    const rate = (this.intensity === 'storm' ? 30 : 11) * (this.w / 1440) * this.rainFactor;
    this.splashAcc += rate * dt;
    const grey: [number, number, number] = [0.7, 0.76, 0.86];
    while (this.splashAcc >= 1 && this.parts.length < MAX_PARTS - 8) {
      this.splashAcc -= 1;
      const x = rand(0, this.w);
      const y = this.h - rand(2, 46);
      const n = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        const a = rand(Math.PI * 1.15, Math.PI * 1.85);
        const v = rand(40, 130);
        this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: rand(0.22, 0.42), size: rand(0.8, 1.7), grow: 0, type: 0, tint: grey });
      }
      this.parts.push({ x, y, vx: 0, vy: 0, life: 0, max: 0.45, size: rand(2, 5), grow: rand(22, 40), type: 1, tint: grey });
    }
  }

  /* ------------------------------ lightning ------------------------------ */

  private jag(a: Pt, b: Pt, rough: number, depth: number): Pt[] {
    let pts: Pt[] = [a, b];
    for (let d = 0; d < depth; d++) {
      const next: Pt[] = [pts[0]];
      for (let i = 0; i < pts.length - 1; i++) {
        const [x1, y1] = pts[i];
        const [x2, y2] = pts[i + 1];
        const len = Math.hypot(x2 - x1, y2 - y1) || 1;
        const off = (Math.random() - 0.5) * len * rough;
        next.push([(x1 + x2) / 2 - ((y2 - y1) / len) * off, (y1 + y2) / 2 + ((x2 - x1) / len) * off], pts[i + 1]);
      }
      pts = next;
      rough *= 0.78;
    }
    return pts;
  }

  strike(x?: number, y?: number) {
    if (this.reduced || this.lost) return;
    const now = performance.now() / 1000;
    if (x !== undefined) {
      if (now - this.lastTapBolt < 0.7) return;
      this.lastTapBolt = now;
    }
    const endX = x ?? rand(this.w * 0.06, this.w * 0.94);
    const endY = y ?? rand(this.h * 0.62, this.h * 1.05);
    const startX = endX + rand(-this.w * 0.1, this.w * 0.1);
    const startY = this.cloudBottom * rand(0.35, 0.7);

    const strips: Array<{ pts: Pt[]; glow: number; core: number; bright: number; t0: number; t1: number }> = [];
    const main = this.jag([startX, startY], [endX, endY], 0.62, 6);
    strips.push({ pts: main, glow: 10, core: 1.7, bright: 1, t0: 0, t1: 1 });
    const branches = 3 + Math.floor(Math.random() * 5);
    for (let i = 0; i < branches; i++) {
      const k = rand(0.08, 0.72);
      const from = main[Math.floor(k * (main.length - 1))];
      const ang = Math.atan2(endY - startY, endX - startX) + rand(-1.0, 1.0);
      const len = rand(50, 240) * (1 - k * 0.6);
      const to: Pt = [from[0] + Math.cos(ang) * len, from[1] + Math.abs(Math.sin(ang)) * len];
      const pts = this.jag(from, to, 0.7, 5);
      strips.push({ pts, glow: 6, core: 1.05, bright: rand(0.4, 0.7), t0: k, t1: Math.min(1, k + 0.35) });
      if (Math.random() < 0.45) {
        const f2 = pts[Math.floor(rand(0.3, 0.7) * (pts.length - 1))];
        const a2 = ang + rand(-0.8, 0.8);
        const l2 = len * rand(0.3, 0.55);
        const sub = this.jag(f2, [f2[0] + Math.cos(a2) * l2, f2[1] + Math.abs(Math.sin(a2)) * l2], 0.7, 4);
        strips.push({ pts: sub, glow: 4, core: 0.8, bright: rand(0.25, 0.4), t0: k + 0.1, t1: Math.min(1, k + 0.5) });
      }
    }

    // write the strips into the bolt buffer (it is rebuilt from scratch when a new bolt starts)
    this.bolts = this.bolts.filter((b) => now - b.born < b.life);
    if (!this.bolts.length) this.boltVerts = 0;
    const start = this.boltVerts;
    const count: number[] = [];
    const offsets: number[] = [];
    for (const s of strips) {
      const n = s.pts.length;
      if (this.boltVerts + n * 2 > MAX_BOLT_VERTS) break;
      offsets.push(this.boltVerts);
      let total = 0;
      const lens = [0];
      for (let i = 1; i < n; i++) {
        total += Math.hypot(s.pts[i][0] - s.pts[i - 1][0], s.pts[i][1] - s.pts[i - 1][1]);
        lens.push(total);
      }
      for (let i = 0; i < n; i++) {
        const a = s.pts[Math.max(0, i - 1)];
        const b = s.pts[Math.min(n - 1, i + 1)];
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const l = Math.hypot(dx, dy) || 1;
        const nx = -dy / l;
        const ny = dx / l;
        const t = s.t0 + (s.t1 - s.t0) * (lens[i] / (total || 1));
        // fades toward the tip of a branch
        const bright = s.bright * (s === strips[0] ? 1 : 1 - 0.6 * (lens[i] / (total || 1)));
        for (const side of [-1, 1]) {
          const o = this.boltVerts * 8;
          this.boltData.set([s.pts[i][0], s.pts[i][1], nx, ny, side, s.glow, bright, t], o);
          this.boltVerts++;
        }
      }
      count.push(n * 2);
    }
    // core widths are drawn with a separate scale; store the core/glow ratio per strip via uWidthScale
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufBolt);
    gl.bufferSubData(gl.ARRAY_BUFFER, start * 32, this.boltData.subarray(start * 8, this.boltVerts * 8));

    const leader = rand(0.06, 0.11);
    const restrike = leader + rand(0.08, 0.15);
    this.bolts.push({ born: now, leader, restrike, life: restrike + 0.5, start, count, offsets });
    this.flashQueue.push(now + leader, now + restrike);
    this.flashAt = [startX / this.w, 1 - startY / this.h];

    for (const d of this.drops) if (Math.hypot(d.x - endX, d.y - endY) < d.r * 3.2) d.charge = 1;
  }

  private sheetFlash() {
    const now = performance.now() / 1000;
    this.flashAt = [rand(0.05, 0.95), 1 - (this.cloudBottom * rand(0.3, 0.7)) / this.h];
    this.flashQueue.push(now);
    this.sheet = 0.9;
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
    this.nextAuto = this.last / 1000 + rand(1.2, 3.5);
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

  /** Lowers resolution and rain density if frames are slow. */
  private adapt(dtMs: number) {
    this.frameTimes.push(dtMs);
    if (this.frameTimes.length < 90) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes = [];
    if (avg > 25 && (this.skyScale > 0.26 || this.rainFactor > 0.5)) {
      this.skyScale = Math.max(0.26, this.skyScale * 0.8);
      this.rainFactor = Math.max(0.5, this.rainFactor * 0.85);
      this.makeTargets();
    }
  }

  private frame(nowMs: number, still = false) {
    if (this.lost) return;
    const gl = this.gl;
    const now = nowMs / 1000;
    const dt = still ? 0 : Math.min(0.05, (nowMs - this.last) / 1000);
    if (!still && this.last) this.adapt(nowMs - this.last);
    this.last = nowMs;
    const time = now - this.t0;

    // weather
    if (!still && this.intensity === 'storm' && now > this.nextAuto) {
      if (Math.random() < 0.72) this.strike();
      else this.sheetFlash();
      this.nextAuto = now + rand(4.5, 10.5);
    }
    while (this.flashQueue.length && this.flashQueue[0] <= now) {
      this.flashQueue.shift();
      this.flash = Math.min(1, this.flash + 0.85);
    }
    this.flash *= Math.exp(-dt * 8.5);
    this.sheet *= Math.exp(-dt * 6);
    const flash = this.flash;
    const wind = 0.13 + 0.05 * Math.sin(time * 0.31) + 0.03 * Math.sin(time * 1.7);

    // physics
    if (!still) {
      this.rainSplashes(dt);
      for (let i = 0; i < this.drops.length; i++) {
        const d = this.drops[i];
        const forming = d.born > 0 && now - d.born < 1.1;
        if (!forming) d.y += d.vy * dt;
        d.phase += dt * 2.4;
        d.x += Math.sin(d.phase) * 5 * dt + wind * 18 * dt;
        d.charge = Math.max(0, d.charge - dt * 0.9);
        if (d.y > this.h - d.r * 0.35) {
          this.splash(d.x, this.h - 6, d.r, rgbOf(d.code), false);
          this.drops[i] = this.newDrop();
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
          p.vy += 560 * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
        } else p.size += p.grow * dt;
      }
    }

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
    gl.uniform1f(P.sky.u.uSheet, this.sheet * flash);
    gl.uniform1f(P.sky.u.uBase, 1 - this.cloudBottom / this.h);
    gl.uniform1f(P.sky.u.uStorm, this.intensity === 'storm' ? 1 : 0.55);
    gl.uniform1f(P.sky.u.uHorizon, 0.44);
    gl.uniform1f(P.sky.u.uShore, 0.2);
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

    // 3. rain
    const rainCount = Math.floor(MAX_RAIN * this.rainFactor * (this.intensity === 'storm' ? 1 : 0.4) * Math.min(1.3, Math.max(0.35, (this.w * this.h) / (1440 * 900))));
    gl.useProgram(P.rain.prog);
    gl.uniform1f(P.rain.u.uTime, time);
    gl.uniform2f(P.rain.u.uRes, this.w, this.h);
    gl.uniform1f(P.rain.u.uWind, wind);
    gl.uniform1f(P.rain.u.uTop, this.cloudBottom - 70);
    gl.uniform1f(P.rain.u.uFlash, flash);
    gl.bindVertexArray(this.vaoRain);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, rainCount);

    // 4. drops (refracting the sky texture)
    let nd = 0;
    for (const d of this.drops) {
      if (nd >= MAX_DROPS) break;
      const age = now - d.born;
      const forming = d.born > 0 && age < 1.1;
      const grow = forming ? 0.22 + 0.78 * Math.min(1, age / 1.1) ** 2 : 1;
      const tint = rgbOf(d.code);
      const stretch = forming ? 0.92 + 0.12 * Math.min(1, age) : 1 + Math.sin(d.phase * 1.7) * 0.045 + 0.03;
      const o = nd * 11;
      this.dropData[o] = d.x;
      this.dropData[o + 1] = d.y;
      this.dropData[o + 2] = d.r * grow;
      this.dropData[o + 3] = d.alpha * (forming ? Math.min(1, age * 2.5) : 1);
      this.dropData[o + 4] = this.glyphIndex.get(d.code) ?? 0;
      this.dropData[o + 5] = d.charge;
      this.dropData[o + 6] = stretch;
      this.dropData[o + 7] = Math.sin(d.phase) * 0.06 + wind * 0.3;
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
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.sky!.tex);
      gl.uniform1i(P.drop.u.uSky, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.atlas);
      gl.uniform1i(P.drop.u.uAtlas, 1);
      gl.bindVertexArray(this.vaoDrop);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, nd);
      gl.activeTexture(gl.TEXTURE0);
    }

    // 5. splashes
    const np = Math.min(this.parts.length, MAX_PARTS);
    if (np) {
      for (let i = 0; i < np; i++) {
        const p = this.parts[i];
        const k = p.life / p.max;
        const o = i * 8;
        this.partData[o] = p.x;
        this.partData[o + 1] = p.y;
        this.partData[o + 2] = p.size;
        this.partData[o + 3] = p.type === 0 ? (1 - k) * 0.85 : (1 - k) * 0.55;
        this.partData[o + 4] = p.type;
        this.partData[o + 5] = p.tint[0];
        this.partData[o + 6] = p.tint[1];
        this.partData[o + 7] = p.tint[2];
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, this.bufPart);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.partData.subarray(0, np * 8));
      gl.useProgram(P.part.prog);
      gl.uniform2f(P.part.u.uRes, this.w, this.h);
      gl.uniform1f(P.part.u.uFlash, flash);
      gl.bindVertexArray(this.vaoPart);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, np);
    }

    // 6. lightning: bloom from a half-resolution pass, then a crisp core on top
    this.bolts = this.bolts.filter((b) => now - b.born < b.life);
    if (this.bolts.length) {
      const draw = (widthScale: number, sharp: number, color: [number, number, number], gain: number) => {
        gl.useProgram(P.bolt.prog);
        gl.uniform2f(P.bolt.u.uRes, this.w, this.h);
        gl.uniform1f(P.bolt.u.uWidthScale, widthScale);
        gl.uniform3f(P.bolt.u.uColor, color[0], color[1], color[2]);
        gl.uniform1f(P.bolt.u.uSharp, sharp);
        gl.bindVertexArray(this.vaoBolt);
        for (const b of this.bolts) {
          const age = now - b.born;
          let reveal = 1;
          let intensity: number;
          if (age < b.leader) {
            reveal = age / b.leader;
            intensity = 0.22;
          } else {
            intensity = Math.exp(-(age - b.leader) * 11);
            if (age > b.restrike) intensity += 0.8 * Math.exp(-(age - b.restrike) * 13);
            intensity = Math.max(intensity, 0.05 * (1 - age / b.life));
          }
          gl.uniform1f(P.bolt.u.uIntensity, intensity * gain);
          gl.uniform1f(P.bolt.u.uReveal, reveal);
          b.offsets.forEach((off, i) => gl.drawArrays(gl.TRIANGLE_STRIP, off, b.count[i]));
        }
      };
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.boltRT!.fbo);
      gl.viewport(0, 0, this.boltRT!.w, this.boltRT!.h);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      draw(1.0, 2.4, [0.52, 0.58, 1.0], 0.9);
      draw(0.22, 3.2, [0.95, 0.93, 1.0], 1.2);

      // blur: bolt -> A (horizontal) -> B (vertical) -> A (horizontal) -> B (vertical)
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
      gl.uniform1f(P.add.u.uStrength, 1.7);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindTexture(gl.TEXTURE_2D, this.boltRT!.tex);
      gl.uniform1f(P.add.u.uStrength, 0.45);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      draw(0.12, 2.8, [1.0, 0.98, 1.0], 2.0);
    }

    // 7. lens: vignette and grain, multiplied
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
