/* The sky behind every page, on a 2D canvas, for browsers without WebGL2 (or with
 * ?storm2d). A simpler cousin of glstorm.ts:
 *
 *   space      the WebGL sky's deep space, painted once per size (space2d.ts): faint
 *              nebulae eaten by dust, the galaxy band with its dust lanes, a far spiral
 *              galaxy, and fixed stars, denser along the band; some of them twinkle
 *   stars      the currency stars, drawn as the WebGL sky draws them (a white core, a halo
 *              in the currency's colour, spikes) with the currency sign beside them; born
 *              with a flare, drifting slowly upward
 *   planet     the Earth, painted once from NASA's real day and night maps and the cloud
 *              map (the coastlines alone until they load), in daylight, with its cities
 *              lit wherever it is night; a thin glowing atmosphere
 *   satellite  orbiting along just inside the horizon and off the right side
 *   meteors    shooting stars with fading tails, across the top of the sky
 *   sparkles   a tapped currency star flares up and fades, shedding a few faint motes
 *
 * Nothing moves at all under prefers-reduced-motion. */
import { currencyColor, dropGlyph } from '../data/currencies';
import { DAY_SUN as EARTH_SUN, EARTH_IMAGES, PLANET, START_TURN, awayFromPlanet, landFields, meteorStart, onPlanet, orbitAt, orbitSpan, toPlanet } from './earth';
import { heroSpot, rgbOf } from './glstorm';
import { GALAXY_AT, bandAt, deepSpace, spiralGalaxy, starImage, vignette } from './space2d';
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

interface Flare {
  x: number;
  y: number;
  r: number;
  grow: number;
  life: number;
  max: number;
  color: string;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
/** The same colour at an opacity (a hex or hsl() currency colour). */
const withAlpha = (c: string, a: number) =>
  c.startsWith('#') && c.length === 7
    ? c + Math.round(a * 255).toString(16).padStart(2, '0')
    : c.startsWith('hsl(')
      ? c.replace(')', ` / ${a})`)
      : `rgba(255,255,255,${a})`;
/** A flare's falloff, as gradient stops: most of its light close to the heart. */
const FLARE_STOPS: [number, number][] = [
  [0.1, 0.95],
  [0.2, 0.79],
  [0.3, 0.58],
  [0.45, 0.31],
  [0.6, 0.14],
  [0.8, 0.03],
  [1, 0],
];
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
  private maps?: { day: ImageData; night: ImageData; clouds?: ImageData };
  private sprites = new Map<string, HTMLCanvasElement>();
  private twinklers: Twinkler[] = [];
  private stars: Star[] = [];
  private meteors: Meteor[] = [];
  private parts: Particle[] = [];
  private flares: Flare[] = [];
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

  /** The real day and night maps and the cloud map, read into memory to paint the planet from. */
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
    Promise.all([read(EARTH_IMAGES.day(false)), read(EARTH_IMAGES.lights), read(EARTH_IMAGES.clouds(false)).catch(() => undefined)])
      .then(([day, night, clouds]) => {
        this.maps = { day, night, clouds };
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


  /** Deep space as the WebGL sky paints it, once per size: the gas and the band at a
   *  quarter of the resolution (they are all soft), the spiral galaxy sharp, then the
   *  fixed stars and the lens vignette. */
  private paintBackdrop() {
    const c = document.createElement('canvas');
    c.width = this.canvas.width;
    c.height = this.canvas.height;
    const g = c.getContext('2d')!;
    const W = this.w;
    const H = this.h;
    const aspect = W / H;
    const step = Math.max(4, Math.ceil(Math.sqrt((W * H) / 90000)));
    const lw = Math.max(1, Math.ceil(W / step));
    const lh = Math.max(1, Math.ceil(H / step));
    const low = new ImageData(lw, lh);
    for (let y = 0; y < lh; y++) {
      const v = 1 - (y + 0.5) / lh;
      for (let x = 0; x < lw; x++) {
        const u = (x + 0.5) / lw;
        const [r, gg, b] = deepSpace(u, v, aspect);
        const k = vignette(u, v, aspect) * 255;
        const o = (y * lw + x) * 4;
        low.data[o] = r * k;
        low.data[o + 1] = gg * k;
        low.data[o + 2] = b * k;
        low.data[o + 3] = 255;
      }
    }
    const lc = document.createElement('canvas');
    lc.width = lw;
    lc.height = lh;
    lc.getContext('2d')!.putImageData(low, 0, 0);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(lc, 0, 0, c.width, c.height);

    // the spiral galaxy, at full resolution over its own box, added to the sky
    const half = Math.round(H * 0.16 * this.dpr);
    const gxc = GALAXY_AT[0] * c.width;
    const gyc = (1 - GALAXY_AT[1]) * c.height;
    const box = new ImageData(half * 2, half * 2);
    for (let y = 0; y < half * 2; y++) {
      const v = 1 - (gyc - half + y + 0.5) / c.height;
      for (let x = 0; x < half * 2; x++) {
        const u = (gxc - half + x + 0.5) / c.width;
        const k = spiralGalaxy(u, v, aspect) * vignette(u, v, aspect) * 255;
        const o = (y * half * 2 + x) * 4;
        box.data[o] = 0.88 * k;
        box.data[o + 1] = 0.9 * k;
        box.data[o + 2] = 0.96 * k;
        box.data[o + 3] = 255;
      }
    }
    const bc = document.createElement('canvas');
    bc.width = bc.height = half * 2;
    bc.getContext('2d')!.putImageData(box, 0, 0);
    g.globalCompositeOperation = 'lighter';
    g.drawImage(bc, gxc - half, gyc - half);

    // fixed stars: a dust of tiny faint ones, thicker along the band, then brighter ones,
    // a few with spikes. Drawn in batches of one colour and brightness, so the canvas is
    // not handed a new fill style for every star.
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const TINTS = ['255,209,158', '235,242,255', '168,199,255'];
    const tint = () => {
      const t = Math.random();
      return t < 0.3 ? 0 : t < 0.75 ? 1 : 2;
    };
    const LEVELS = 8;
    const batches: number[][] = Array.from({ length: TINTS.length * LEVELS }, () => []);
    const put = (x: number, y: number, size: number, alpha: number, t: number) => {
      const level = Math.max(0, Math.min(LEVELS - 1, Math.round(alpha * (LEVELS - 1))));
      if (level > 0) batches[t * LEVELS + level].push(x, y, size);
    };
    const dust = Math.round((W * H) / 70);
    for (let i = 0; i < dust; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      if (Math.random() > 0.55 + bandAt(x / W, 1 - y / H, aspect) * 0.45) continue;
      put(x, y, 0, (0.12 + Math.random() * 0.28) * vignette(x / W, 1 - y / H, aspect), tint());
    }
    const bright: Array<[number, number, number, number]> = [];
    const star = (x: number, y: number, mag: number) => {
      const vig = vignette(x / W, 1 - y / H, aspect);
      const t = tint();
      put(x, y, 0.35 + mag * 1.3, Math.min(1, (0.25 + mag * 0.9) * vig), t);
      if (mag > 0.8) bright.push([x, y, mag * vig, t]);
    };
    const n = Math.round((W * H) / 900);
    for (let i = 0; i < n; i++) star(Math.random() * W, Math.random() * H, Math.random() ** 6);
    for (let i = 0; i < n; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      if (Math.random() < bandAt(x / W, 1 - y / H, aspect) * 0.5) star(x, y, Math.random() ** 8);
    }
    batches.forEach((list, b) => {
      if (!list.length) return;
      g.fillStyle = `rgba(${TINTS[Math.floor(b / LEVELS)]},${(b % LEVELS) / (LEVELS - 1)})`;
      g.beginPath();
      for (let i = 0; i < list.length; i += 3) {
        const r = list[i + 2];
        if (r === 0) g.rect(list[i], list[i + 1], 0.8, 0.8);
        else {
          g.moveTo(list[i] + r, list[i + 1]);
          g.arc(list[i], list[i + 1], r, 0, Math.PI * 2);
        }
      }
      g.fill();
    });
    for (const [x, y, k, t] of bright) {
      const len = 2 + k * 7;
      for (const [dx, dy] of [
        [1, 0],
        [0, 1],
      ]) {
        const sp = g.createLinearGradient(x - dx * len, y - dy * len, x + dx * len, y + dy * len);
        sp.addColorStop(0, `rgba(${TINTS[t]},0)`);
        sp.addColorStop(0.5, `rgba(${TINTS[t]},${0.4 * k})`);
        sp.addColorStop(1, `rgba(${TINTS[t]},0)`);
        g.fillStyle = sp;
        g.fillRect(x - dx * len - dy * 0.35, y - dy * len - dx * 0.35, dx * len * 2 + dy * 0.7, dy * len * 2 + dx * 0.7);
      }
    }
    g.globalCompositeOperation = 'source-over';
    this.backdrop = c;
    this.twinklers = Array.from({ length: Math.round((this.w * this.h) / 16000) }, () => ({
      x: Math.random() * this.w,
      y: Math.random() * this.h,
      r: rand(0.6, 1.4),
      phase: Math.random() * Math.PI * 2,
      rate: rand(1, 3),
    }));
  }

  /** A currency star, pre-rendered as the WebGL sky draws it (space2d.ts). Drawn at a
   *  half size of 6 star radii, added to the sky; its sign is written beside it. */
  private sprite(code: string) {
    const hit = this.sprites.get(code);
    if (hit) return hit;
    const n = 288;
    const c = document.createElement('canvas');
    c.width = c.height = n;
    c.getContext('2d')!.putImageData(starImage(rgbOf(code), n), 0, 0);
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
    // Maps are sampled smoothly (bilinear, wrapping east-west) into reused buffers: this
    // runs for every pixel of the planet, so nothing is allocated per sample.
    const bilinear = (data: Uint8Array | Uint8ClampedArray, mw: number, mh: number, stride: number, u: number, v: number, out: Float64Array, channels: number) => {
      const fx = u * mw - 0.5;
      const fy = Math.min(mh - 1.001, Math.max(0, v * mh - 0.5));
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const tx = fx - x0;
      const ty = fy - y0;
      const xa = ((x0 % mw) + mw) % mw;
      const xb = xa + 1 === mw ? 0 : xa + 1;
      const r0 = y0 * mw;
      const r1 = r0 + mw;
      const i00 = (r0 + xa) * stride;
      const i10 = (r0 + xb) * stride;
      const i01 = (r1 + xa) * stride;
      const i11 = (r1 + xb) * stride;
      const w00 = (1 - tx) * (1 - ty);
      const w10 = tx * (1 - ty);
      const w01 = (1 - tx) * ty;
      const w11 = tx * ty;
      for (let c = 0; c < channels; c++) out[c] = (data[i00 + c] * w00 + data[i10 + c] * w10 + data[i01 + c] * w01 + data[i11 + c] * w11) / 255;
    };
    const one = new Float64Array(3);
    // the softened coastline, so coasts are not blocky
    const coast = (u: number, v: number) => {
      bilinear(field, mw, mh, 2, u, v, one, 1);
      return one[0];
    };
    const spin = 0.5 + START_TURN;
    // a map pixel as 0..1 rgb (in a buffer that the next call reuses)
    const dayPx = new Float64Array(3);
    const nightPx = new Float64Array(3);
    const cloudPx = new Float64Array(3);
    const sample = (img: ImageData, u: number, v: number, out: Float64Array, channels = 3) => {
      bilinear(img.data, img.width, img.height, 4, u, v, out, channels);
      return out;
    };
    const disc = new ImageData(w, band);
    const air = new ImageData(w, band);
    const airC = (mu: number): [number, number, number] => {
      const day = Math.min(1, Math.max(0, (mu + 0.07) / 0.37));
      const dusk = Math.exp(-(((mu - 0.01) / 0.1) ** 2)) * 0.28;
      return [0.28 * day + dusk, 0.54 * day + 0.62 * dusk, day + 0.45 * dusk];
    };
    for (let y = 0; y < band; y++) {
      const py = 1 - (h - band + y + 0.5) / h;
      for (let x = 0; x < w; x++) {
        const px = (x + 0.5) / h;
        const dx = px - cxp;
        const dy = py - PLANET.cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
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
          let base: ArrayLike<number> = land
            ? alat > 68
              ? [0.9, 0.93, 0.97]
              : alat > 12 && alat < 34
                ? [0.72, 0.58, 0.4]
                : [0.3, 0.36, 0.2]
            : [0.015, 0.05, 0.11];
          let lights: ArrayLike<number> | undefined;
          let cloud = 0;
          if (this.maps) {
            const d = sample(this.maps.day, u, v, dayPx);
            lights = sample(this.maps.night, u, v, nightPx, 1);
            // land as it looks from orbit: paler and less saturated than the map
            if (land) {
              const grey = d[0] * 0.3 + d[1] * 0.59 + d[2] * 0.11;
              for (let c = 0; c < 3; c++) d[c] += (grey - d[c]) * 0.32;
            }
            base = d;
            if (this.maps.clouds) cloud = sample(this.maps.clouds, u, v, cloudPx, 1)[0] * 0.9;
          }
          const ndl = n[0] * EARTH_SUN[0] + n[1] * EARTH_SUN[1] + n[2] * EARTH_SUN[2];
          const lit = Math.max(0, ndl) * 1.25;
          const T = Math.exp(-0.1 / Math.max(n[2], 0.015));
          const a = airC(ndl);
          let gr = base[0] * lit;
          let gg0 = base[1] * lit;
          let gb = base[2] * lit;
          if (cloud > 0) {
            // cloud tops in the low sun: warm at the terminator, white higher up, a pink edge at dusk
            const warm = Math.min(1, Math.max(0, ndl / 0.3));
            const s = warm * warm * (3 - 2 * warm);
            const k = 0.03 + 1.2 * Math.max(0, ndl);
            const dusk = Math.exp(-((ndl / 0.12) ** 2)) * 0.12;
            gr += (k + dusk - gr) * cloud;
            gg0 += ((0.62 + 0.36 * s) * k + 0.6 * dusk - gg0) * cloud;
            gb += ((0.42 + 0.53 * s) * k + 0.45 * dusk - gb) * cloud;
          }
          let r = gr * T + a[0] * (1 - T);
          let gg = gg0 * T + a[1] * (1 - T);
          let b = gb * T + a[2] * (1 - T);
          const night = 1 - Math.min(1, Math.max(0, (ndl + 0.16) / 0.2));
          // real city light, brightest where the most people live
          const lum = lights ? lights[0] : 0;
          const city = (lum * lum * 2.4 + lum * 0.6) * (1 - cloud * 0.8);
          if (lights) {
            r += city * night;
            gg += city * 0.8 * night;
            b += city * 0.52 * night;
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
        // it flares up for a moment and fades; a few faint motes of its light drift off
        const color = currencyColor(s.code);
        this.flares.push({ x: s.x, y: s.y, r: s.r * 2.4, grow: s.r * 1.4, life: 0, max: 0.85, color });
        for (let k = 0; k < 5; k++) {
          const a = rand(0, Math.PI * 2);
          const v = rand(10, 34);
          this.parts.push({ x: s.x + Math.cos(a) * s.r * 0.3, y: s.y + Math.sin(a) * s.r * 0.3, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: rand(0.5, 0.9), color, size: rand(0.8, 1.4) });
        }
        this.onPop?.(s.code);
        this.stars[i] = this.newStar();
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
    // over the planet and away from it, never down into it
    const len = rand(260, 480);
    const [ox, oy] = x !== undefined && y !== undefined ? [x, y] : meteorStart(this.w, this.h);
    const [dx, dy] = awayFromPlanet(ox, oy, this.w, this.h);
    const sx = x !== undefined ? ox - dx * len * 0.6 : ox;
    const sy = y !== undefined ? oy - dy * len * 0.6 : oy;
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
    g.textAlign = 'center';
    g.textBaseline = 'middle';
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
      // its sign, like a label on a star chart: the same size on every star, as in WebGL
      if (grow > 0.6) {
        const glyph = dropGlyph(s.code);
        const chars = [...glyph].length;
        g.font = `700 ${chars >= 3 ? 9 : chars === 2 ? 11 : 14}px "Sora Variable", "Sora", system-ui, sans-serif`;
        g.fillStyle = 'rgba(219,230,255,0.7)';
        g.fillText(glyph, s.x + size * 0.26, s.y + size * 0.26);
      }
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

    // motes and flares
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
    for (let i = this.flares.length - 1; i >= 0; i--) {
      const f = this.flares[i];
      if (!still) {
        f.life += dt;
        f.r += f.grow * dt;
      }
      const k = f.life / f.max;
      if (k >= 1) {
        this.flares.splice(i, 1);
        continue;
      }
      // at once as bright as the star was, then fading slowly: a soft glow, white at the heart
      g.globalAlpha = Math.min(1, k / 0.03) * (1 - k) ** 2 * 0.9;
      const glow = g.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
      glow.addColorStop(0, '#fff');
      for (const [at, a] of FLARE_STOPS) glow.addColorStop(at, withAlpha(f.color, a));
      g.fillStyle = glow;
      g.fillRect(f.x - f.r, f.y - f.r, f.r * 2, f.r * 2);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }
}
