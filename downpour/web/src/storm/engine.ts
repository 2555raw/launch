/* The sky behind every page, on a 2D canvas, for browsers without WebGL2 (or with
 * ?storm2d). A simpler cousin of glstorm.ts:
 *
 *   space      a painted backdrop of nebula glow and a few thousand fixed stars, some of
 *              which twinkle
 *   stars      the currency stars, drawn as real stars (halo, spikes, a white core) with
 *              the currency sign beside them; born with a flare, drifting slowly upward
 *   planet     the Earth, painted once from NASA's real day and night maps (the
 *              coastlines alone until they load): day on the left, dusk and night with
 *              its cities on the right, a thin glowing atmosphere
 *   satellite  orbiting along just inside the horizon and off the right side
 *   meteors    shooting stars with fading tails; tap the empty sky to send one
 *   sparkles   a burst of sparks and a ring when a currency star is tapped
 *
 * Nothing moves at all under prefers-reduced-motion. */
import { currencyColor, dropGlyph } from '../data/currencies';
import { EARTH_IMAGES, EARTH_SUN, PLANET, START_TURN, landFields, onPlanet, orbitAt, orbitSpan, toPlanet } from './earth';
import { heroSpot } from './glstorm';
import { drawSatellite2D } from './satellite';
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
  private earth?: { disc: HTMLCanvasElement; air: HTMLCanvasElement; top: number };
  private satSprite?: HTMLCanvasElement;
  private sat?: { born: number; dur: number; from: number; to: number; ro: number; tilt: number };
  private nextSat = 0;
  private satSize = 100;
  private maps?: { day: ImageData; night: ImageData };
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
    this.loadMaps();
  }

  /** The real day and night maps, read into memory to paint the planet from. */
  private loadMaps() {
    const read = async (url: string) => {
      const img = new Image();
      img.src = url;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const g = c.getContext('2d', { willReadFrequently: true })!;
      g.drawImage(img, 0, 0);
      return g.getImageData(0, 0, c.width, c.height);
    };
    Promise.all([read(EARTH_IMAGES.day(false)), read(EARTH_IMAGES.night)])
      .then(([day, night]) => {
        this.maps = { day, night };
        this.paintEarth();
        if (!this.running) this.frame(performance.now(), true);
      })
      .catch(() => {});
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
    this.paintEarth();
    this.satSize = Math.round(this.w < 720 ? Math.max(64, this.w * 0.2) : Math.max(80, Math.min(120, this.w * 0.07)));
    this.satSprite = undefined;
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

  /** A currency star, pre-rendered like a real one: a halo in its colour, long thin
   *  diffraction spikes, a white core, and the currency sign beside it. Drawn at a half
   *  size of 6 star radii, added to the sky. */
  private sprite(code: string) {
    const hit = this.sprites.get(code);
    if (hit) return hit;
    const R = 16;
    const S = R * 6;
    const scale = 2;
    const c = document.createElement('canvas');
    c.width = c.height = S * 2 * scale;
    const g = c.getContext('2d')!;
    g.scale(scale, scale);
    g.translate(S, S);
    const color = currencyColor(code);
    g.globalCompositeOperation = 'lighter';
    const halo = g.createRadialGradient(0, 0, 0, 0, 0, S * 0.7);
    halo.addColorStop(0, color);
    halo.addColorStop(0.15, color);
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 0.5;
    g.fillStyle = halo;
    g.fillRect(-S, -S, S * 2, S * 2);
    g.globalAlpha = 1;
    for (const horizontal of [true, false]) {
      const sp = horizontal ? g.createLinearGradient(-S, 0, S, 0) : g.createLinearGradient(0, -S, 0, S);
      sp.addColorStop(0, 'rgba(255,255,255,0)');
      sp.addColorStop(0.5, 'rgba(255,255,255,0.95)');
      sp.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = sp;
      g.beginPath();
      if (horizontal) {
        g.moveTo(-S, 0);
        g.lineTo(0, -1.3);
        g.lineTo(S, 0);
        g.lineTo(0, 1.3);
      } else {
        g.moveTo(0, -S);
        g.lineTo(1.3, 0);
        g.lineTo(0, S);
        g.lineTo(-1.3, 0);
      }
      g.fill();
    }
    const core = g.createRadialGradient(0, 0, 0, 0, 0, R * 0.9);
    core.addColorStop(0, '#ffffff');
    core.addColorStop(0.35, 'rgba(255,255,255,0.9)');
    core.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = core;
    g.fillRect(-R, -R, R * 2, R * 2);
    const glyph = dropGlyph(code);
    g.globalCompositeOperation = 'source-over';
    g.font = `700 ${[...glyph].length >= 3 ? 11 : 14}px "Sora Variable", "Sora", system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = 'rgba(225,232,255,0.8)';
    g.fillText(glyph, R * 1.6, R * 1.6);
    this.sprites.set(code, c);
    return c;
  }

  /** The planet's horizon, painted once per size from the real coastlines: the disc
   *  (opaque) and its atmosphere (added to the sky). Static; the WebGL sky turns it. */
  private paintEarth() {
    const w = Math.max(1, Math.round(this.w));
    const h = this.h;
    const topUv = Math.min(1, PLANET.cy + PLANET.r + PLANET.atmo * 4);
    const band = Math.max(1, Math.ceil(h * topUv));
    const cxp = PLANET.cx * (w / h);
    const R = PLANET.r;
    const { data: field, w: mw, h: mh } = landFields();
    // the softened coastline, sampled smoothly so coasts are not blocky
    const coast = (u: number, v: number) => {
      const fx = u * mw - 0.5;
      const fy = Math.min(mh - 1.001, Math.max(0, v * mh - 0.5));
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const tx = fx - x0;
      const ty = fy - y0;
      const at = (x: number, y: number) => field[(y * mw + (((x % mw) + mw) % mw)) * 2] / 255;
      return (at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx) * (1 - ty) + (at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx) * ty;
    };
    const spin = 0.5 + START_TURN;
    // a map pixel, smoothly, as 0..1 rgb
    const sample = (img: ImageData, u: number, v: number): [number, number, number] => {
      const fx = u * img.width - 0.5;
      const fy = Math.min(img.height - 1.001, Math.max(0, v * img.height - 0.5));
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const tx = fx - x0;
      const ty = fy - y0;
      const out: [number, number, number] = [0, 0, 0];
      for (let c = 0; c < 3; c++) {
        const at = (x: number, y: number) => img.data[(y * img.width + (((x % img.width) + img.width) % img.width)) * 4 + c];
        out[c] = ((at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx) * (1 - ty) + (at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx) * ty) / 255;
      }
      return out;
    };
    const disc = new ImageData(w, band);
    const air = new ImageData(w, band);
    const airC = (mu: number): [number, number, number] => {
      const day = Math.min(1, Math.max(0, (mu + 0.07) / 0.37));
      const dusk = Math.exp(-(((mu - 0.01) / 0.1) ** 2)) * 0.6;
      return [0.28 * day + dusk, 0.54 * day + 0.43 * dusk, day + 0.2 * dusk];
    };
    for (let y = 0; y < band; y++) {
      const py = 1 - (h - band + y + 0.5) / h;
      for (let x = 0; x < w; x++) {
        const px = (x + 0.5) / h;
        const dx = px - cxp;
        const dy = py - PLANET.cy;
        const dist = Math.hypot(dx, dy);
        const o = (y * w + x) * 4;
        const cover = Math.min(1, Math.max(0, (R - dist) * h + 0.5));
        if (cover > 0) {
          const z = Math.sqrt(Math.max(0, R * R - dist * dist));
          const n: [number, number, number] = [dx / R, dy / R, z / R];
          const q = toPlanet(n);
          const lat = Math.asin(Math.max(-1, Math.min(1, q[1])));
          let u = Math.atan2(-q[2], q[0]) / (Math.PI * 2) + spin;
          u -= Math.floor(u);
          const v = 0.5 - lat / Math.PI;
          const land = coast(u, v) > 0.5;
          const alat = Math.abs(lat) * 57.3;
          let base: [number, number, number] = land
            ? alat > 68
              ? [0.9, 0.93, 0.97]
              : alat > 12 && alat < 34
                ? [0.72, 0.58, 0.4]
                : [0.3, 0.36, 0.2]
            : [0.015, 0.05, 0.11];
          let lights: [number, number, number] | undefined;
          if (this.maps) {
            base = sample(this.maps.day, u, v);
            lights = sample(this.maps.night, u, v);
          }
          const ndl = n[0] * EARTH_SUN[0] + n[1] * EARTH_SUN[1] + n[2] * EARTH_SUN[2];
          const lit = Math.max(0, ndl) * 1.45;
          const T = Math.exp(-0.065 / Math.max(n[2], 0.015));
          const a = airC(ndl);
          let r = base[0] * lit * T + a[0] * (1 - T);
          let gg = base[1] * lit * T + a[1] * (1 - T);
          let b = base[2] * lit * T + a[2] * (1 - T);
          const night = 1 - Math.min(1, Math.max(0, (ndl + 0.16) / 0.2));
          if (lights) {
            r += lights[0] * lights[0] * 2.6 * night;
            gg += lights[1] * lights[1] * 2.2 * night;
            b += lights[2] * lights[2] * 1.6 * night;
          } else if (land && ndl < -0.04 && Math.random() < 0.012) {
            r += 0.9;
            gg += 0.6;
            b += 0.3;
          }
          disc.data[o] = Math.min(255, r * 255);
          disc.data[o + 1] = Math.min(255, gg * 255);
          disc.data[o + 2] = Math.min(255, b * 255);
          disc.data[o + 3] = cover * 255;
        }
        const alt = Math.max(0, dist - R) / PLANET.atmo;
        const mul = (dx / dist) * EARTH_SUN[0] + (dy / dist) * EARTH_SUN[1];
        const a = airC(mul);
        const k = Math.exp(-alt * 2.3) * 1.2 * (1 - cover);
        const edge = Math.exp(-alt * 10) * Math.min(1, Math.max(0, (mul + 0.08) / 0.38)) * 0.55 * (1 - cover);
        air.data[o] = Math.min(255, (a[0] * k + 0.75 * edge) * 255);
        air.data[o + 1] = Math.min(255, (a[1] * k + 0.88 * edge) * 255);
        air.data[o + 2] = Math.min(255, (a[2] * k + edge) * 255);
        air.data[o + 3] = 255;
      }
    }
    const toCanvas = (img: ImageData) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = band;
      c.getContext('2d')!.putImageData(img, 0, 0);
      return c;
    };
    this.earth = { disc: toCanvas(disc), air: toCanvas(air), top: h - band };
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
    let r = Math.random() < 0.3 ? rand(13, 18) : rand(8, 12);
    let x = 0;
    let y = 0;
    let vy = -rand(5, 13);
    let alpha = 1;
    for (let tries = 0; tries < 12; tries++) {
      x = rand(r * 3, this.w - r * 3);
      y = rand(this.h * 0.14, this.h * 0.94);
      alpha = 1;
      if (this.scene === 'hero') {
        ({ x, y, alpha } = heroSpot(this.w, this.h, r));
        vy = -rand(1.5, 4);
      } else {
        const g = this.gutter();
        if (g >= 90) {
          r = Math.min(r, g * 0.14);
          x = Math.random() < 0.5 ? rand(r * 2.5, g - r * 2) : rand(this.w - g + r * 2, this.w - r * 2.5);
        } else {
          alpha = 0.35;
          r *= 0.8;
        }
      }
      if (!onPlanet(x, y + r * 2, this.w, this.h)) break;
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
      if (Math.hypot(s.x - x, s.y - y) < s.r * 1.7) {
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
    if (!this.sat && !this.nextSat) this.nextSat = this.last / 1000 + 2.5;
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
      const pulse = 1 + 0.08 * Math.sin(s.phase * 1.7) + 0.04 * Math.sin(s.phase * 4.3);
      const size = s.r * 6 * grow * pulse * (0.7 + 0.3 * fade);
      g.globalAlpha = s.alpha * Math.min(1, k * 3) * fade;
      g.globalCompositeOperation = 'lighter';
      g.drawImage(this.sprite(s.code), s.x - size, s.y - size, size * 2, size * 2);
      g.globalCompositeOperation = 'source-over';
    }
    g.globalAlpha = 1;

    // the planet, hiding what is behind it, and its atmosphere
    if (this.earth) {
      g.drawImage(this.earth.disc, 0, this.earth.top, this.w, this.earth.disc.height);
      g.globalCompositeOperation = 'lighter';
      g.drawImage(this.earth.air, 0, this.earth.top, this.w, this.earth.air.height);
      g.globalCompositeOperation = 'source-over';
    }

    // the satellite, orbiting just inside the horizon and off the right side
    if (!still) {
      if (!this.sat && this.nextSat && now > this.nextSat) {
        const ro = rand(1.045, 1.075);
        const tilt = (rand(22, 29) * Math.PI) / 180;
        const span = orbitSpan(ro, tilt, this.w, this.h, this.satSize * 0.6);
        const arc = PLANET.r * ro * this.h * Math.max(0.05, span.from - span.to);
        this.sat = { born: now, dur: arc / rand(26, 34), from: span.from, to: span.to, ro, tilt };
      }
      if (this.sat && now - this.sat.born > this.sat.dur) {
        this.sat = undefined;
        this.nextSat = now + rand(16, 30);
      }
    }
    if (this.sat) {
      if (!this.satSprite) {
        const c = document.createElement('canvas');
        c.width = c.height = Math.round(this.satSize * this.dpr * 2);
        const sg = c.getContext('2d')!;
        sg.scale(this.dpr * 2, this.dpr * 2);
        sg.translate(this.satSize / 2, this.satSize / 2);
        drawSatellite2D(sg, this.satSize * 0.95);
        this.satSprite = c;
      }
      const k = Math.min(1, (now - this.sat.born) / this.sat.dur);
      const o = orbitAt(this.sat.from + (this.sat.to - this.sat.from) * k, this.sat.ro, this.sat.tilt, this.w, this.h);
      g.save();
      g.translate(o.x, o.y);
      g.rotate(-o.angle);
      g.drawImage(this.satSprite, -this.satSize / 2, -this.satSize / 2, this.satSize, this.satSize);
      g.restore();
    }

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
