/* The sky behind every page, on a 2D canvas, for browsers without WebGL2 (or with
 * ?storm2d). A simpler cousin of glstorm.ts:
 *
 *   space     a painted backdrop of nebula glow and a few thousand fixed stars, some of
 *             which twinkle
 *   stars     the currency stars: glowing orbs with the currency sign, born with a flare,
 *             drifting slowly upward and fading out after a while
 *   meteors   shooting stars with fading tails; tap the empty sky to send one
 *   sparkles  a burst of sparks and a ring when a currency star is tapped
 *
 * Nothing moves at all under prefers-reduced-motion. */
import { currencyColor, dropGlyph } from '../data/currencies';
import { heroSpot } from './glstorm';
import { COLUMN, type Intensity, type Scene, type StormRenderer } from './types';

interface Star {
  x: number;
  y: number;
  r: number;
  vy: number;
  code: string;
  phase: number;
  born: number;
  life: number;
  alpha: number;
}

interface Twinkler {
  x: number;
  y: number;
  r: number;
  phase: number;
  rate: number;
}

interface Meteor {
  x: number;
  y: number;
  dx: number;
  dy: number;
  len: number;
  born: number;
  dur: number;
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

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const IGNITE = 1.2;
const FADE = 1.5;

export class StormEngine implements StormRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private reduced: boolean;
  private running = false;
  private raf = 0;
  private last = 0;
  private w = 0;
  private h = 0;
  private dpr = 1;

  private backdrop?: HTMLCanvasElement;
  private sprites = new Map<string, HTMLCanvasElement>();
  private twinklers: Twinkler[] = [];
  private stars: Star[] = [];
  private meteors: Meteor[] = [];
  private parts: Particle[] = [];
  private rings: Ring[] = [];
  private nextAuto = 0;
  private lastTap = 0;
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
    this.paintBackdrop();
    this.fillStars();
    if (this.reduced || !this.running) this.frame(performance.now(), true);
  }

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

  /** Nebula glow and fixed stars, painted once per size. */
  private paintBackdrop() {
    const c = document.createElement('canvas');
    c.width = this.canvas.width;
    c.height = this.canvas.height;
    const g = c.getContext('2d')!;
    g.scale(this.dpr, this.dpr);
    const bg = g.createLinearGradient(0, 0, 0, this.h);
    bg.addColorStop(0, '#04040f');
    bg.addColorStop(1, '#0a0822');
    g.fillStyle = bg;
    g.fillRect(0, 0, this.w, this.h);
    const blob = (x: number, y: number, r: number, color: string) => {
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, color);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    };
    blob(this.w * 0.8, this.h * 0.2, this.h * 0.6, 'rgba(120, 40, 160, 0.28)');
    blob(this.w * 0.15, this.h * 0.75, this.h * 0.55, 'rgba(20, 90, 150, 0.26)');
    blob(this.w * 0.5, this.h * 0.45, this.h * 0.4, 'rgba(160, 90, 40, 0.1)');
    const n = Math.round((this.w * this.h) / 900);
    for (let i = 0; i < n; i++) {
      const mag = Math.random() ** 5;
      const t = Math.random();
      g.fillStyle = t < 0.3 ? '#ffd9a8' : t < 0.75 ? '#eef2ff' : '#b8ccff';
      g.globalAlpha = 0.25 + mag * 0.75;
      g.beginPath();
      g.arc(Math.random() * this.w, Math.random() * this.h, 0.4 + mag * 1.3, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    this.backdrop = c;
    this.twinklers = Array.from({ length: Math.round((this.w * this.h) / 16000) }, () => ({
      x: Math.random() * this.w,
      y: Math.random() * this.h,
      r: rand(0.8, 1.8),
      phase: Math.random() * Math.PI * 2,
      rate: rand(1, 3),
    }));
  }

  /** A currency star, pre-rendered: halo, spikes, a lit sphere and the sign. */
  private sprite(code: string) {
    const hit = this.sprites.get(code);
    if (hit) return hit;
    const R = 40;
    const S = R * 3;
    const scale = 2;
    const c = document.createElement('canvas');
    c.width = c.height = S * 2 * scale;
    const g = c.getContext('2d')!;
    g.scale(scale, scale);
    g.translate(S, S);
    const color = currencyColor(code);

    const halo = g.createRadialGradient(0, 0, R * 0.8, 0, 0, S);
    halo.addColorStop(0, color);
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 0.45;
    g.fillStyle = halo;
    g.fillRect(-S, -S, S * 2, S * 2);
    g.globalAlpha = 1;
    for (const [w, h] of [
      [S * 2, 2.4],
      [2.4, S * 2],
    ]) {
      const sp = w > h ? g.createLinearGradient(-S, 0, S, 0) : g.createLinearGradient(0, -S, 0, S);
      sp.addColorStop(0, 'rgba(255,255,255,0)');
      sp.addColorStop(0.5, 'rgba(255,255,255,0.85)');
      sp.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = sp;
      g.fillRect(-w / 2, -h / 2, w, h);
    }

    const body = g.createRadialGradient(-R * 0.35, -R * 0.4, R * 0.05, 0, 0, R);
    body.addColorStop(0, '#ffffff');
    body.addColorStop(0.3, color);
    body.addColorStop(0.8, color);
    body.addColorStop(1, '#0b0724');
    g.beginPath();
    g.arc(0, 0, R, 0, Math.PI * 2);
    g.fillStyle = body;
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineWidth = 1.4;
    g.stroke();

    const glyph = dropGlyph(code);
    const size = [...glyph].length >= 3 ? R * 0.62 : [...glyph].length === 2 ? R * 0.78 : R * 0.98;
    g.font = `800 ${size}px "Sora Variable", "Sora", system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = 'rgba(11,7,36,0.45)';
    g.fillText(glyph, 1.2, 2.4);
    g.fillStyle = '#fffdf5';
    g.fillText(glyph, 0, 1);

    this.sprites.set(code, c);
    return c;
  }

  /* ------------------------------ currency stars ------------------------------ */

  private gutter() {
    return Math.max(0, (this.w - COLUMN) / 2);
  }

  private fillStars() {
    const n = this.scene === 'hero' ? (this.w < 720 ? 5 : this.w < 1100 ? 8 : 11) : this.gutter() >= 90 ? 7 : 3;
    while (this.stars.length < n) this.stars.push(this.newStar(true));
    if (this.stars.length > n) this.stars.length = n;
  }

  private newStar(settled = false): Star {
    let r = Math.random() < 0.3 ? rand(19, 26) : rand(11, 17);
    let x = rand(r * 3, this.w - r * 3);
    let y = rand(this.h * 0.14, this.h * 0.94);
    let vy = -rand(5, 13);
    let alpha = 1;
    if (this.scene === 'hero') {
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
      code: this.codes[Math.floor(Math.random() * this.codes.length)],
      phase: Math.random() * Math.PI * 2,
      born: settled ? now - rand(IGNITE, life * 0.7) : now,
      life,
      alpha,
    };
  }

  pop(x: number, y: number): boolean {
    for (let i = this.stars.length - 1; i >= 0; i--) {
      const s = this.stars[i];
      if (Math.hypot(s.x - x, s.y - y) < s.r * 1.5) {
        const color = currencyColor(s.code);
        for (let k = 0; k < 28; k++) {
          const a = rand(0, Math.PI * 2);
          const v = rand(50, 260);
          this.parts.push({ x: s.x, y: s.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: rand(0.6, 1.2), color, size: rand(1.2, 3) });
        }
        this.rings.push({ x: s.x, y: s.y, r: s.r * 0.8, life: 0, color });
        this.onPop?.(s.code);
        this.stars[i] = this.newStar();
        this.rings.push({ x: this.stars[i].x, y: this.stars[i].y, r: 6, life: 0, color: currencyColor(this.stars[i].code) });
        return true;
      }
    }
    return false;
  }

  /* ------------------------------ shooting stars ------------------------------ */

  strike(x?: number, y?: number) {
    if (this.reduced) return;
    const now = performance.now() / 1000;
    if (x !== undefined) {
      if (now - this.lastTap < 0.35) return;
      this.lastTap = now;
    }
    const dir = Math.random() < 0.5 ? -1 : 1;
    const ang = rand(0.28, 0.7);
    const dx = Math.cos(ang) * dir;
    const dy = Math.sin(ang);
    const len = rand(260, 480);
    const sx = x !== undefined ? x - dx * len * 0.6 : rand(this.w * 0.08, this.w * 0.92);
    const sy = y !== undefined ? y - dy * len * 0.6 : rand(-20, this.h * 0.45);
    this.meteors.push({ x: sx, y: sy, dx, dy, len, born: now, dur: rand(0.75, 1.15) });
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
    this.nextAuto = this.last / 1000 + rand(0.8, 2.2);
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

  renderAt(ms: number) {
    this.frame(ms, false);
  }

  private frame(nowMs: number, still = false) {
    const g = this.ctx;
    const now = nowMs / 1000;
    const dt = still ? 0 : Math.max(0, Math.min(0.05, (nowMs - this.last) / 1000));
    this.last = nowMs;
    const shower = this.intensity === 'storm';

    if (!still && now > this.nextAuto) {
      this.strike();
      this.nextAuto = now + (shower ? rand(1.6, 4) : rand(6, 12));
    }

    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.backdrop) g.drawImage(this.backdrop, 0, 0, this.w, this.h);

    // twinkling stars
    g.fillStyle = '#fff';
    for (const t of this.twinklers) {
      g.globalAlpha = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(now * t.rate + t.phase));
      g.beginPath();
      g.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;

    // currency stars
    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];
      if (!still) {
        s.y += s.vy * dt;
        s.phase += dt * 2;
        s.x += Math.sin(s.phase * 0.35) * 3 * dt;
      }
      const age = now - s.born;
      if (!still && (age > s.life || s.y < -s.r * 3.5)) {
        this.stars[i] = this.newStar();
        this.rings.push({ x: this.stars[i].x, y: this.stars[i].y, r: 6, life: 0, color: currencyColor(this.stars[i].code) });
        continue;
      }
      const k = Math.min(1, Math.max(0, age) / IGNITE);
      const grow = 0.15 + 0.85 * (1 - (1 - k) ** 3);
      const left = s.life - age;
      const fade = left < FADE ? Math.max(0, left / FADE) : 1;
      const pulse = 1 + 0.05 * Math.sin(s.phase);
      const size = s.r * 3 * grow * pulse * (0.7 + 0.3 * fade);
      g.globalAlpha = s.alpha * Math.min(1, k * 3) * fade;
      g.drawImage(this.sprite(s.code), s.x - size, s.y - size, size * 2, size * 2);
    }
    g.globalAlpha = 1;

    // meteors
    g.globalCompositeOperation = 'lighter';
    this.meteors = this.meteors.filter((m) => now - m.born < m.dur);
    g.lineCap = 'round';
    for (const m of this.meteors) {
      const k = (now - m.born) / m.dur;
      const tail = 0.35;
      const reveal = k * (1 + tail);
      const head = Math.min(1, reveal);
      const back = Math.max(0, reveal - tail);
      const fade = reveal > 1 ? Math.max(0, 1 - (reveal - 1) / tail) : Math.min(1, k / 0.12);
      const hx = m.x + m.dx * m.len * head;
      const hy = m.y + m.dy * m.len * head;
      const tx = m.x + m.dx * m.len * back;
      const ty = m.y + m.dy * m.len * back;
      const gr = g.createLinearGradient(tx, ty, hx, hy);
      gr.addColorStop(0, 'rgba(140,170,255,0)');
      gr.addColorStop(1, `rgba(235,240,255,${0.95 * fade})`);
      g.strokeStyle = gr;
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(tx, ty);
      g.lineTo(hx, hy);
      g.stroke();
      if (reveal <= 1) {
        const glow = g.createRadialGradient(hx, hy, 0, hx, hy, 12);
        glow.addColorStop(0, `rgba(255,255,255,${0.9 * fade})`);
        glow.addColorStop(1, 'rgba(120,150,255,0)');
        g.fillStyle = glow;
        g.fillRect(hx - 12, hy - 12, 24, 24);
      }
    }

    // sparks and rings
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      if (!still) {
        p.life += dt;
        const drag = Math.exp(-dt * 2.6);
        p.vx *= drag;
        p.vy *= drag;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      if (p.life > p.max) {
        this.parts.splice(i, 1);
        continue;
      }
      g.globalAlpha = 1 - p.life / p.max;
      g.fillStyle = p.color;
      g.beginPath();
      g.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      g.fill();
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      if (!still) {
        r.life += dt;
        r.r += 150 * dt;
      }
      if (r.life > 0.7) {
        this.rings.splice(i, 1);
        continue;
      }
      g.globalAlpha = (1 - r.life / 0.7) * 0.7;
      g.strokeStyle = r.color;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      g.stroke();
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }
}
