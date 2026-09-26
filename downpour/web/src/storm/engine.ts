/* The sky behind every page: a storm drawn on one canvas.
 *
 *   clouds     a band of heavy cloud along the top, two layers drifting at different speeds
 *   rain       three depths of streaks, slanted by the wind
 *   drops      big glossy water drops that form under the clouds and fall, each carrying a
 *              currency sign; they splash at the bottom, or when you tap them
 *   lightning  branching bolts from the cloud base, with a flash that lights the clouds
 *              from inside; tap the empty sky to call one down where you tapped
 *
 * Flashes are capped in brightness and to at most three a second (WCAG 2.3.1), and
 * nothing moves at all under prefers-reduced-motion. */
import { currencyColor, dropGlyph } from '../data/currencies';
import { COLUMN, type Intensity, type Scene, type StormRenderer } from './types';

type Pt = [number, number];

interface Streak {
  x: number;
  y: number;
  len: number;
  speed: number;
  layer: 0 | 1 | 2;
}

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
  color: string;
  size: number;
}

interface Ring {
  x: number;
  y: number;
  r: number;
  life: number;
  color: string;
}

interface Bolt {
  paths: Pt[][];
  widths: number[];
  born: number;
  life: number;
  warm: boolean;
}

export type { Intensity, Scene } from './types';

const LAYERS = [
  { count: 0.45, len: [6, 11], speed: [380, 520], alpha: 0.13, width: 0.7 },
  { count: 0.35, len: [10, 18], speed: [560, 760], alpha: 0.2, width: 1 },
  { count: 0.2, len: [16, 28], speed: [820, 1100], alpha: 0.3, width: 1.4 },
] as const;

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** The 2D fallback, used when WebGL2 is not available. */
export class StormEngine implements StormRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private raf = 0;
  private last = 0;
  private running = false;
  private reduced = false;

  private sky?: HTMLCanvasElement;
  private cloudsBack?: HTMLCanvasElement;
  private cloudsFront?: HTMLCanvasElement;
  private cloudsLit?: HTMLCanvasElement;
  private cloudH = 0;
  private drift = 0;

  private streaks: Streak[] = [];
  private drops: Drop[] = [];
  private particles: Particle[] = [];
  private rings: Ring[] = [];
  private bolts: Bolt[] = [];
  private sprites = new Map<string, HTMLCanvasElement>();

  private flash = 0;
  private flashQueue: number[] = [];
  private flashTimes: number[] = [];
  private sheet = { x: 0, t: -1 };
  private nextAuto = 0;
  private wind = 0.14;
  private intensity: Intensity = 'storm';
  private scene: Scene = 'content';
  private codes: string[] = ['USD', 'EUR', 'JPY', 'GBP', 'BRL', 'MXN', 'INR', 'KRW', 'NGN', 'TRY', 'CHF', 'ZAR', 'VND', 'CAD', 'AUD', 'XAU'];

  onPop?: (code: string) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.resize();
  }

  /* ------------------------------ setup ------------------------------ */

  resize() {
    const mobile = window.innerWidth < 720;
    this.dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.75);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.canvas.style.width = `${this.w}px`;
    this.canvas.style.height = `${this.h}px`;
    this.cloudH = Math.max(150, Math.min(this.h * 0.3, 300));
    this.paintSky();
    this.paintClouds();
    this.fillRain();
    this.fillDrops();
    if (this.reduced || !this.running) this.frame(performance.now(), true);
  }

  setCurrencies(codes: string[]) {
    if (codes.length) this.codes = codes;
  }

  setIntensity(i: Intensity) {
    this.intensity = i;
    this.fillRain();
  }

  setScene(scene: Scene) {
    if (scene === this.scene) return;
    this.scene = scene;
    this.fillDrops();
  }

  /** Free space on each side of the page column, in px. */
  private gutter() {
    return Math.max(0, (this.w - COLUMN) / 2);
  }

  private density() {
    const area = (this.w * this.h) / (1440 * 900);
    const base = this.w < 720 ? 110 : 230;
    return Math.round(base * Math.min(1.6, Math.max(0.5, area)) * (this.intensity === 'storm' ? 1 : 0.45));
  }

  private fillRain() {
    const n = this.density();
    this.streaks = [];
    LAYERS.forEach((L, layer) => {
      const count = Math.round(n * L.count);
      for (let i = 0; i < count; i++) this.streaks.push(this.newStreak(layer as 0 | 1 | 2, true));
    });
  }

  private newStreak(layer: 0 | 1 | 2, anywhere = false): Streak {
    const L = LAYERS[layer];
    return {
      x: rand(-this.w * 0.1, this.w * 1.05),
      y: anywhere ? rand(this.cloudH * 0.5, this.h) : rand(this.cloudH * 0.45, this.cloudH * 0.8),
      len: rand(L.len[0], L.len[1]),
      speed: rand(L.speed[0], L.speed[1]),
      layer,
    };
  }

  private targetDrops() {
    if (this.scene === 'hero') return this.w < 720 ? 6 : this.w < 1100 ? 9 : 12;
    // content pages: a few in the margins, or a couple of faint ones when there are no margins
    return this.gutter() >= 90 ? 8 : 3;
  }

  private fillDrops() {
    const target = this.targetDrops();
    while (this.drops.length < target) this.drops.push(this.newDrop(true));
    if (this.drops.length > target) this.drops.length = target;
  }

  private newDrop(anywhere = false): Drop {
    const big = Math.random() < 0.3;
    let r = big ? rand(26, 40) : rand(12, 24);
    const code = this.codes[Math.floor(Math.random() * this.codes.length)];
    const base = this.cloudH * 0.72;
    let x = rand(r * 2, this.w - r * 2);
    let alpha = 1;
    if (this.scene === 'hero') {
      // keep most drops off the headline so it stays easy to read
      const mid = x > this.w * 0.26 && x < this.w * 0.74;
      if (mid && Math.random() < 0.7) {
        x = Math.random() < 0.5 ? rand(r * 1.5, this.w * 0.26) : rand(this.w * 0.74, this.w - r * 1.5);
      }
    } else {
      const g = this.gutter();
      if (g >= 90) {
        r = Math.min(r, g * 0.32);
        x = Math.random() < 0.5 ? rand(r * 1.5, g - r * 1.2) : rand(this.w - g + r * 1.2, this.w - r * 1.5);
      } else {
        alpha = 0.28;
        r *= 0.8;
      }
    }
    return {
      x,
      y: anywhere ? rand(base, this.h * 0.95) : base + rand(-10, 14),
      r,
      vy: rand(34, 70) * (r / 26) ** 0.35,
      code,
      phase: Math.random() * Math.PI * 2,
      born: anywhere ? -10 : performance.now() / 1000,
      charge: 0,
      alpha,
    };
  }

  /* ------------------------------ painting ------------------------------ */

  private paintSky() {
    const c = document.createElement('canvas');
    c.width = this.canvas.width;
    c.height = this.canvas.height;
    const g = c.getContext('2d')!;
    g.scale(this.dpr, this.dpr);
    const grad = g.createLinearGradient(0, 0, 0, this.h);
    grad.addColorStop(0, '#05080f');
    grad.addColorStop(0.28, '#0a1222');
    grad.addColorStop(0.62, '#101c33');
    grad.addColorStop(1, '#172944');
    g.fillStyle = grad;
    g.fillRect(0, 0, this.w, this.h);
    // a faint horizon glow, like a city under the storm
    const hz = g.createRadialGradient(this.w * 0.5, this.h * 1.15, 10, this.w * 0.5, this.h * 1.15, this.h * 0.9);
    hz.addColorStop(0, 'rgba(90,140,220,0.22)');
    hz.addColorStop(1, 'rgba(90,140,220,0)');
    g.fillStyle = hz;
    g.fillRect(0, 0, this.w, this.h);
    this.sky = c;
  }

  /** A strip of cloud one and a half screens wide, so it can drift and wrap.
   *  Clouds are built as clusters of many soft, low-alpha puffs shaped like domes
   *  (tall in the middle, flat underneath), darker at the base and lighter on top,
   *  which reads as a cloud bank rather than a row of blurry circles. */
  private cloudStrip(seed: number, lit: boolean, front: boolean) {
    const W = Math.round(this.w * 1.5);
    const H = Math.round(this.cloudH * (front ? 1.05 : 1.2));
    const c = document.createElement('canvas');
    c.width = Math.round(W * this.dpr);
    c.height = Math.round(H * this.dpr);
    const g = c.getContext('2d')!;
    g.scale(this.dpr, this.dpr);
    let s = seed;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);

    // solid ceiling: the storm has no sky above it
    const top = g.createLinearGradient(0, 0, 0, H * 0.6);
    if (lit) {
      top.addColorStop(0, 'rgba(160,182,232,0.55)');
      top.addColorStop(1, 'rgba(160,182,232,0)');
    } else {
      top.addColorStop(0, front ? 'rgba(17,23,36,1)' : 'rgba(11,16,27,1)');
      top.addColorStop(0.6, front ? 'rgba(20,27,42,0.85)' : 'rgba(13,19,31,0.8)');
      top.addColorStop(1, 'rgba(20,27,41,0)');
    }
    g.fillStyle = top;
    g.fillRect(0, 0, W, H * 0.6);

    const puff = (x: number, y: number, rad: number, rgb: string, a: number) => {
      const draw = (ox: number) => {
        const pg = g.createRadialGradient(x + ox, y - rad * 0.15, rad * 0.05, x + ox, y, rad);
        pg.addColorStop(0, `rgba(${rgb},${a})`);
        pg.addColorStop(0.55, `rgba(${rgb},${a * 0.55})`);
        pg.addColorStop(1, `rgba(${rgb},0)`);
        g.fillStyle = pg;
        g.beginPath();
        g.arc(x + ox, y, rad, 0, Math.PI * 2);
        g.fill();
      };
      draw(0);
      // wrap across the seam so the strip tiles
      if (x < rad) draw(W);
      else if (x > W - rad) draw(-W);
    };

    const clusters = Math.ceil(W / (front ? 150 : 190));
    for (let i = 0; i < clusters; i++) {
      const cx = (i + r() * 0.8) * (W / clusters);
      const baseY = H * (front ? 0.6 + r() * 0.2 : 0.5 + r() * 0.2);
      const width = (front ? 150 : 200) + r() * 160;
      const height = (front ? 55 : 70) + r() * 70;
      const n = front ? 30 : 24;
      for (let k = 0; k < n; k++) {
        const u = r() * 2 - 1;
        const x = cx + (u * width) / 2;
        const dome = Math.sqrt(Math.max(0, 1 - u * u));
        const y = baseY - height * dome * r();
        const rad = (front ? 22 : 30) + r() * (front ? 34 : 44) * (1 - 0.35 * Math.abs(u));
        const lift = (baseY - y) / height; // 0 at the base, 1 at the top of the dome
        if (lit) {
          puff(x, y, rad, '205,220,255', 0.1 + lift * 0.18);
        } else if (front) {
          const v = Math.round(26 + lift * 22 + r() * 6);
          puff(x, y, rad, `${v},${v + 8},${v + 22}`, 0.34);
        } else {
          const v = Math.round(18 + lift * 12 + r() * 5);
          puff(x, y, rad, `${v},${v + 6},${v + 17}`, 0.36);
        }
      }
      if (!lit) {
        // a darker belly under each cluster, where the rain comes from
        const belly = g.createRadialGradient(cx, baseY + 6, 4, cx, baseY + 6, width * 0.6);
        belly.addColorStop(0, front ? 'rgba(10,14,24,0.5)' : 'rgba(8,11,20,0.45)');
        belly.addColorStop(1, 'rgba(10,14,24,0)');
        g.fillStyle = belly;
        g.fillRect(cx - width, baseY - height, width * 2, height * 2);
      }
    }
    if (!lit && front) {
      // a faint cool rim along the underside, lit by the city below
      const rim = g.createLinearGradient(0, H * 0.65, 0, H);
      rim.addColorStop(0, 'rgba(120,150,210,0)');
      rim.addColorStop(0.75, 'rgba(120,150,210,0.05)');
      rim.addColorStop(1, 'rgba(120,150,210,0)');
      g.fillStyle = rim;
      g.fillRect(0, H * 0.65, W, H * 0.35);
    }
    return c;
  }

  private paintClouds() {
    this.cloudsBack = this.cloudStrip(7, false, false);
    this.cloudsFront = this.cloudStrip(91, false, true);
    this.cloudsLit = this.cloudStrip(91, true, true);
  }

  private sprite(code: string) {
    const hit = this.sprites.get(code);
    if (hit) return hit;
    const R = 40;
    const pad = 8;
    const c = document.createElement('canvas');
    const scale = 2;
    c.width = (R * 2 + pad * 2) * scale;
    c.height = (R * 2.9 + pad * 2) * scale;
    const g = c.getContext('2d')!;
    g.scale(scale, scale);
    g.translate(R + pad, R * 1.62 + pad);
    const color = currencyColor(code);

    const shape = () => {
      g.beginPath();
      g.moveTo(0, -R * 1.55);
      g.bezierCurveTo(R * 0.3, -R * 1.05, R, -R * 0.4, R, R * 0.15);
      g.arc(0, R * 0.15, R, 0, Math.PI);
      g.bezierCurveTo(-R, -R * 0.4, -R * 0.3, -R * 1.05, 0, -R * 1.55);
      g.closePath();
    };

    // soft glow
    g.save();
    g.shadowColor = color;
    g.shadowBlur = 16;
    shape();
    g.fillStyle = color;
    g.globalAlpha = 0.35;
    g.fill();
    g.restore();

    // body: water tinted with the currency's color
    shape();
    const body = g.createRadialGradient(-R * 0.35, -R * 0.2, R * 0.1, 0, R * 0.1, R * 1.25);
    body.addColorStop(0, 'rgba(255,255,255,0.85)');
    body.addColorStop(0.18, color);
    body.addColorStop(0.75, color);
    body.addColorStop(1, 'rgba(8,14,28,0.9)');
    g.globalAlpha = 0.9;
    g.fillStyle = body;
    g.fill();
    g.globalAlpha = 1;

    // darker lower edge, as if the drop refracts the sky below
    g.save();
    shape();
    g.clip();
    const lower = g.createLinearGradient(0, -R, 0, R * 1.2);
    lower.addColorStop(0, 'rgba(0,0,0,0)');
    lower.addColorStop(1, 'rgba(5,10,25,0.45)');
    g.fillStyle = lower;
    g.fillRect(-R * 1.2, -R * 1.7, R * 2.4, R * 3);
    g.restore();

    // rim and highlights
    shape();
    g.strokeStyle = 'rgba(255,255,255,0.45)';
    g.lineWidth = 1.2;
    g.stroke();
    g.beginPath();
    g.ellipse(-R * 0.42, -R * 0.25, R * 0.16, R * 0.34, -0.5, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.fill();
    g.beginPath();
    g.arc(R * 0.45, R * 0.62, R * 0.08, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.fill();

    // the currency sign
    const glyph = dropGlyph(code);
    const size = glyph.length >= 3 ? R * 0.62 : glyph.length === 2 ? R * 0.78 : R * 0.98;
    g.font = `800 ${size}px "Sora Variable", "Sora", system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = 'rgba(6,12,26,0.55)';
    g.fillText(glyph, 1, R * 0.22 + 1.5);
    g.fillStyle = 'rgba(255,255,255,0.95)';
    g.fillText(glyph, 0, R * 0.2);
    g.font = `700 ${R * 0.24}px "Inter Variable", system-ui, sans-serif`;
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.fillText(code, 0, R * 0.72);

    this.sprites.set(code, c);
    return c;
  }

  /* ------------------------------ lightning ------------------------------ */

  private boltPath(a: Pt, b: Pt, rough: number, depth: number): Pt[] {
    let pts: Pt[] = [a, b];
    for (let d = 0; d < depth; d++) {
      const next: Pt[] = [pts[0]];
      for (let i = 0; i < pts.length - 1; i++) {
        const [x1, y1] = pts[i];
        const [x2, y2] = pts[i + 1];
        const len = Math.hypot(x2 - x1, y2 - y1);
        const off = (Math.random() - 0.5) * len * rough;
        const nx = -(y2 - y1) / (len || 1);
        const ny = (x2 - x1) / (len || 1);
        next.push([(x1 + x2) / 2 + nx * off, (y1 + y2) / 2 + ny * off], pts[i + 1]);
      }
      pts = next;
      rough *= 0.92;
    }
    return pts;
  }

  /** Strikes from the cloud base toward (x, y), or somewhere random. */
  strike(x?: number, y?: number) {
    if (this.reduced) return;
    const t = performance.now() / 1000;
    // no more than three flashes in any second
    this.flashTimes = this.flashTimes.filter((f) => t - f < 1);
    if (this.flashTimes.length >= 3) return;
    this.flashTimes.push(t);

    const endX = x ?? rand(this.w * 0.08, this.w * 0.92);
    const endY = y ?? rand(this.h * 0.55, this.h * 1.02);
    const startX = endX + rand(-this.w * 0.12, this.w * 0.12);
    const startY = this.cloudH * rand(0.45, 0.7);
    const main = this.boltPath([startX, startY], [endX, endY], 0.42, 7);
    const paths: Pt[][] = [main];
    const widths = [1];
    const branches = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < branches; i++) {
      const from = main[Math.floor(rand(0.15, 0.7) * main.length)];
      const ang = Math.atan2(endY - startY, endX - startX) + rand(-0.9, 0.9);
      const len = rand(60, 220);
      const to: Pt = [from[0] + Math.cos(ang) * len, from[1] + Math.abs(Math.sin(ang)) * len];
      paths.push(this.boltPath(from, to, 0.5, 5));
      widths.push(rand(0.35, 0.6));
    }
    this.bolts.push({ paths, widths, born: t, life: rand(0.38, 0.6), warm: Math.random() < 0.3 });
    this.flashQueue.push(t, t + rand(0.07, 0.12));
    this.sheet = { x: startX, t };

    // a bolt that lands near a drop charges it
    for (const d of this.drops) {
      if (Math.hypot(d.x - endX, d.y - endY) < d.r * 3) d.charge = 1;
    }
  }

  /** Cloud-only flash with no bolt: the storm grumbling somewhere else. */
  private sheetFlash() {
    const t = performance.now() / 1000;
    this.flashTimes = this.flashTimes.filter((f) => t - f < 1);
    if (this.flashTimes.length >= 3) return;
    this.flashTimes.push(t);
    this.sheet = { x: rand(0, this.w), t };
    this.flashQueue.push(t);
  }

  /** Returns true if a drop was under the point (and pops it). */
  pop(x: number, y: number): boolean {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      if (Math.hypot(d.x - x, d.y - y) < d.r * 1.25) {
        this.splash(d, true);
        this.onPop?.(d.code);
        this.drops[i] = this.newDrop();
        return true;
      }
    }
    return false;
  }

  private splash(d: Drop, big = false) {
    const color = currencyColor(d.code);
    const n = big ? 16 : 9;
    for (let i = 0; i < n; i++) {
      const a = big ? rand(0, Math.PI * 2) : rand(Math.PI * 1.05, Math.PI * 1.95);
      const v = rand(60, big ? 260 : 170);
      this.particles.push({
        x: d.x,
        y: d.y + (big ? 0 : d.r * 0.3),
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 0,
        max: rand(0.45, 0.9),
        color,
        size: rand(1.4, big ? 4 : 3),
      });
    }
    this.rings.push({ x: d.x, y: big ? d.y : this.h - 6, r: d.r * 0.4, life: 0, color });
  }

  /* ------------------------------ loop ------------------------------ */

  start() {
    if (this.reduced) {
      this.frame(performance.now(), true);
      return;
    }
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.nextAuto = this.last / 1000 + rand(1.5, 4);
    const loop = (t: number) => {
      if (!this.running) return;
      this.frame(t);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  get isRunning() {
    return this.running;
  }

  private frame(nowMs: number, still = false) {
    const t = nowMs / 1000;
    const dt = still ? 0 : Math.min(0.05, (nowMs - this.last) / 1000);
    this.last = nowMs;
    const g = this.ctx;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // automatic weather
    if (!still && this.intensity === 'storm' && t > this.nextAuto) {
      if (Math.random() < 0.7) this.strike();
      else this.sheetFlash();
      this.nextAuto = t + rand(4.5, 11);
    }

    // flash envelope: each queued pulse jumps to full and decays
    while (this.flashQueue.length && this.flashQueue[0] <= t) {
      this.flashQueue.shift();
      this.flash = 1;
    }
    this.flash *= Math.exp(-dt * 9);
    const flash = this.flash;

    // sky
    if (this.sky) g.drawImage(this.sky, 0, 0, this.w, this.h);

    // lightning glow inside the clouds
    if (flash > 0.02 || t - this.sheet.t < 0.5) {
      const glow = g.createRadialGradient(this.sheet.x, this.cloudH * 0.45, 10, this.sheet.x, this.cloudH * 0.45, this.w * 0.5);
      glow.addColorStop(0, `rgba(170,195,255,${0.35 * flash})`);
      glow.addColorStop(1, 'rgba(170,195,255,0)');
      g.fillStyle = glow;
      g.fillRect(0, 0, this.w, this.h * 0.7);
    }

    // clouds
    this.drift += dt * 8;
    const strip = (img: HTMLCanvasElement | undefined, speed: number, y: number, alpha = 1) => {
      if (!img) return;
      const W = this.w * 1.5;
      const H = img.height / this.dpr;
      const off = -((this.drift * speed) % W);
      g.globalAlpha = alpha;
      g.drawImage(img, off, y, W, H);
      g.drawImage(img, off + W, y, W, H);
      g.globalAlpha = 1;
    };
    strip(this.cloudsBack, 0.5, -this.cloudH * 0.15);

    // bolts sit between the cloud layers so they come out of the cloud
    this.drawBolts(t);
    strip(this.cloudsFront, 1, -this.cloudH * 0.05);
    if (flash > 0.01) strip(this.cloudsLit, 1, -this.cloudH * 0.05, Math.min(1, flash * 1.1));

    // rain
    if (!still) {
      for (const s of this.streaks) {
        s.y += s.speed * dt;
        s.x += s.speed * this.wind * dt;
        if (s.y > this.h + 30 || s.x > this.w + 40) {
          if (s.layer === 2 && Math.random() < 0.25) {
            this.particles.push({ x: s.x, y: this.h - 2, vx: rand(-40, 40), vy: rand(-90, -40), life: 0, max: 0.3, color: 'rgba(190,215,255,0.7)', size: 1.1 });
          }
          Object.assign(s, this.newStreak(s.layer));
        }
      }
    }
    LAYERS.forEach((L, layer) => {
      g.beginPath();
      for (const s of this.streaks) {
        if (s.layer !== layer) continue;
        g.moveTo(s.x, s.y);
        g.lineTo(s.x - s.len * this.wind, s.y - s.len);
      }
      g.strokeStyle = `rgba(175,205,255,${L.alpha + flash * 0.25})`;
      g.lineWidth = L.width;
      g.stroke();
    });

    // drops
    for (let i = 0; i < this.drops.length; i++) {
      const d = this.drops[i];
      const age = t - d.born;
      const forming = d.born > 0 && age < 0.9;
      if (!still) {
        if (!forming) d.y += d.vy * dt;
        d.phase += dt * 2.2;
        d.x += Math.sin(d.phase) * 6 * dt + this.wind * 14 * dt;
        d.charge = Math.max(0, d.charge - dt * 0.8);
        if (d.y > this.h - d.r * 0.4) {
          this.splash(d);
          this.drops[i] = this.newDrop();
          continue;
        }
      }
      const scale = forming ? 0.25 + 0.75 * (age / 0.9) ** 2 : 1;
      const img = this.sprite(d.code);
      const k = (d.r / 40) * scale;
      const wob = Math.sin(d.phase * 1.3) * 0.04;
      const iw = (img.width / 2) * k;
      const ih = (img.height / 2) * k;
      g.save();
      g.translate(d.x, d.y);
      g.rotate(wob + this.wind * 0.25);
      g.scale(1 - wob * 0.6, 1 + wob);
      if (d.charge > 0) {
        g.shadowColor = '#ffe066';
        g.shadowBlur = 30 * d.charge;
      }
      g.globalAlpha = (forming ? Math.min(1, age * 2) : 1) * d.alpha;
      g.drawImage(img, -iw / 2, -((40 * 1.62 + 8) / (40 * 2.9 + 16)) * ih, iw, ih);
      g.restore();
    }

    // splashes
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life > p.max) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += 520 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      g.globalAlpha = 1 - p.life / p.max;
      g.fillStyle = p.color;
      g.beginPath();
      g.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life += dt;
      if (r.life > 0.6) {
        this.rings.splice(i, 1);
        continue;
      }
      g.globalAlpha = 0.6 * (1 - r.life / 0.6);
      g.strokeStyle = r.color;
      g.lineWidth = 1.5;
      g.beginPath();
      g.ellipse(r.x, r.y, r.r + r.life * 70, (r.r + r.life * 70) * 0.28, 0, 0, Math.PI * 2);
      g.stroke();
    }
    g.globalAlpha = 1;

    // mist along the bottom
    const mist = g.createLinearGradient(0, this.h * 0.82, 0, this.h);
    mist.addColorStop(0, 'rgba(60,90,140,0)');
    mist.addColorStop(1, 'rgba(60,90,140,0.18)');
    g.fillStyle = mist;
    g.fillRect(0, this.h * 0.82, this.w, this.h * 0.18);

    // the flash itself, capped so it never whites out the page
    if (flash > 0.01) {
      g.fillStyle = `rgba(200,220,255,${flash * 0.16})`;
      g.fillRect(0, 0, this.w, this.h);
    }
  }

  private drawBolts(t: number) {
    const g = this.ctx;
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      const age = t - b.born;
      if (age > b.life) {
        this.bolts.splice(i, 1);
        continue;
      }
      const k = age / b.life;
      const flicker = k < 0.15 ? 1 : k < 0.25 ? 0.35 : k < 0.4 ? 0.9 : 1 - (k - 0.4) / 0.6;
      const alpha = Math.max(0, flicker);
      const core = b.warm ? '255,236,150' : '235,242,255';
      const glow = b.warm ? '255,210,90' : '140,175,255';
      g.lineJoin = 'round';
      g.lineCap = 'round';
      b.paths.forEach((path, j) => {
        const w = b.widths[j];
        const trace = () => {
          g.beginPath();
          g.moveTo(path[0][0], path[0][1]);
          for (let p = 1; p < path.length; p++) g.lineTo(path[p][0], path[p][1]);
        };
        g.save();
        g.shadowColor = `rgba(${glow},${0.9 * alpha})`;
        g.shadowBlur = 22 * w;
        trace();
        g.strokeStyle = `rgba(${glow},${0.28 * alpha})`;
        g.lineWidth = 9 * w;
        g.stroke();
        g.restore();
        trace();
        g.strokeStyle = `rgba(${core},${alpha})`;
        g.lineWidth = 2.4 * w;
        g.stroke();
        trace();
        g.strokeStyle = `rgba(255,255,255,${alpha})`;
        g.lineWidth = 0.9 * w;
        g.stroke();
      });
    }
  }
}
