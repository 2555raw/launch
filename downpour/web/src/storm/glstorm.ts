/* The sky, on the GPU (WebGL2): deep space above the Earth.
 *
 *   sky        layered starfields that twinkle, drifting nebulae, a galaxy band with dust
 *              lanes and a far spiral galaxy, at reduced resolution into a texture
 *   stars      the currency stars, drawn like real stars (an over-exposed core, halo,
 *              diffraction spikes that shimmer) in the currency's colour, each with its
 *              sign written beside it like a star chart; born with a flare, drifting up
 *   planet     the Earth along the bottom, from NASA's real day and night maps and
 *              topography, with clouds and storms generated on the GPU once at start (a
 *              strip per frame; the generated ground stands in if the maps cannot load),
 *              turning slowly under a thin glowing atmosphere; at night (a button) the
 *              dark sweeps across until the whole face is black and only the real city
 *              lights shine, brightest where most people live
 *   satellite  a small 3D model (foil, solar cells, dishes) rendered supersampled into its
 *              own texture with a depth buffer; it comes up over the planet's edge, orbits
 *              along just inside the horizon, and leaves off the side of the screen, its
 *              panels flashing when they catch the sun
 *   meteors    shooting stars: a bright head with a fading tail, bloomed
 *   lens       vignette and film grain over everything
 *
 * Stars are drawn before the planet, so it hides the ones behind it; the satellite
 * orbits in front of it. Quality drops automatically if frames get slow, taps send at most one shooting
 * star every 0.35 s, and under prefers-reduced-motion a single still frame is drawn. If
 * WebGL2 is missing, Storm.tsx falls back to the 2D sky in engine.ts. */
import { CURRENCIES, currencyColor, dropGlyph } from '../data/currencies';
import { CLOUD_DRIFT, DAY_PHASE, EARTH_IMAGES, NIGHT_PHASE, PLANET, POLE_MAT, SPIN, START_TURN, STORMS, landFields, nightness, onPlanet, orbitAt, orbitSpan, sunAt, sunlightAt, toPlanet, type Vec3 } from './earth';
import { FULLSCREEN_VS, freeTarget, program, target, type Program, type Target } from './gl';
import { BEACON, SAT_RADIUS, SAT_STRIDE, WING_CENTRES, apply3, buildSatellite, perspective, rotation } from './satellite';
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

interface Sat {
  born: number;
  dur: number;
  /** orbit angle where it comes into view and where it leaves */
  from: number;
  to: number;
  ro: number;
  tilt: number;
  yaw: number;
  sway: number;
}

interface Tex {
  fbo: WebGLFramebuffer;
  tex: WebGLTexture;
  w: number;
  h: number;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const MAX_STARS = 24;
const MAX_PARTS = 900;
const MAX_METEORS = 24;
const METEOR_POINTS = 24;
const IGNITE = 1.3;
const FADE = 1.6;
const EARTH_STRIPS = 4;
/** The satellite's camera distance and field of view, framing its bounding sphere. */
const SAT_DIST = 16;
const SAT_FOV = 2 * Math.asin(SAT_RADIUS / SAT_DIST);
const SAT_F = 1 / Math.tan(SAT_FOV / 2);
/** Toward the planet from the satellite, for the blue light it throws up. */
const SAT_EARTH: Vec3 = [0.1, -0.97, -0.2];

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

  private progs!: Record<'sky' | 'blit' | 'drop' | 'part' | 'bolt' | 'blur' | 'add' | 'overlay' | 'planet' | 'surfGen' | 'cloudGen' | 'sat' | 'sprite', Program>;
  private vaoEmpty!: WebGLVertexArrayObject;
  private vaoDrop!: WebGLVertexArrayObject;
  private vaoPart!: WebGLVertexArrayObject;
  private vaoBolt!: WebGLVertexArrayObject;
  private vaoSat!: WebGLVertexArrayObject;
  private bufDrop!: WebGLBuffer;
  private bufPart!: WebGLBuffer;
  private bufBolt!: WebGLBuffer;
  private satCount = 0;
  private atlas!: WebGLTexture;
  private sky?: Target;
  private boltRT?: Target;
  private blurA?: Target;
  private blurB?: Target;

  // the planet
  private maskTex?: WebGLTexture;
  private surf?: Tex;
  private cloud?: Tex;
  private earthStep = 0;
  private earthReadyAt = 0;
  private stormData = new Float32Array(32);
  private aniso = 0;
  private real: { day?: WebGLTexture; night?: WebGLTexture; relief?: WebGLTexture } = {};
  private realFailed = false;
  private planetAt = 0;

  // the satellite
  private satRT?: { fbo: WebGLFramebuffer; tex: WebGLTexture; depth: WebGLRenderbuffer; size: number };
  private satSize = 260;
  private sat?: Sat;
  private nextSat = 0;
  private sun: Vec3 = sunAt(DAY_PHASE);
  private phase = { from: DAY_PHASE, to: DAY_PHASE, t0: 0, dur: 1 };
  private satProj = perspective(SAT_FOV, 1, SAT_DIST - SAT_RADIUS - 1, SAT_DIST + SAT_RADIUS + 1);

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
    STORMS.forEach(([lat, lon, twist], i) => {
      const la = (lat * Math.PI) / 180;
      const lo = (lon * Math.PI) / 180;
      this.stormData.set([Math.cos(la) * Math.cos(lo), Math.sin(la), Math.cos(la) * Math.sin(lo), twist], i * 4);
    });
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
      drop: program(gl, S.DROP_VS, S.DROP_FS, U('uRes', 'uAtlas')),
      part: program(gl, S.PART_VS, S.PART_FS, U('uRes', 'uFlash')),
      bolt: program(gl, S.BOLT_VS, S.BOLT_FS, U('uRes', 'uWidthScale', 'uIntensity', 'uReveal', 'uColor', 'uSharp', 'uTail')),
      blur: program(gl, FULLSCREEN_VS, S.BLUR_FS, U('uTex', 'uDir')),
      add: program(gl, FULLSCREEN_VS, S.ADD_FS, U('uTex', 'uStrength')),
      overlay: program(gl, FULLSCREEN_VS, S.OVERLAY_FS, U('uAspect', 'uTime', 'uRes')),
      planet: program(gl, S.PLANET_VS, S.PLANET_FS, U('uTop', 'uAspect', 'uGeo', 'uAtmo', 'uPix', 'uSun', 'uSunP', 'uPole', 'uSpin', 'uSurf', 'uCloud', 'uDay', 'uNight', 'uRelief', 'uMask', 'uReal', 'uFade')),
      surfGen: program(gl, FULLSCREEN_VS, S.EARTH_SURF_FS, U('uMask')),
      cloudGen: program(gl, FULLSCREEN_VS, S.EARTH_CLOUD_FS, U('uMask', 'uStorm')),
      sat: program(gl, S.SAT_VS, S.SAT_FS, U('uRot', 'uProj', 'uDist', 'uSun', 'uEarth', 'uSunI', 'uEarthI')),
      sprite: program(gl, S.SPRITE_VS, S.SPRITE_FS, U('uRect', 'uRes', 'uTex', 'uAlpha')),
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

    // currency stars (and the satellite's glints and beacon)
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

    // the satellite
    const mesh = buildSatellite();
    this.satCount = mesh.count;
    this.vaoSat = gl.createVertexArray()!;
    gl.bindVertexArray(this.vaoSat);
    const bufSat = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, bufSat);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.data, gl.STATIC_DRAW);
    const st = SAT_STRIDE * 4;
    attr(this.progs.sat, 'aPos', 3, st, 0, 0);
    attr(this.progs.sat, 'aNormal', 3, st, 12, 0);
    attr(this.progs.sat, 'aUv', 2, st, 24, 0);
    attr(this.progs.sat, 'aMat', 1, st, 32, 0);
    gl.bindVertexArray(null);

    const ext = gl.getExtension('EXT_texture_filter_anisotropic');
    this.aniso = ext ? Math.min(8, gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT) as number) : 0;

    this.atlas = gl.createTexture()!;
    this.buildAtlas();
    this.makeEarth();
    this.loadEarthImages();
    this.meteors = [];
  }

  /** The real Earth maps, loaded in the background; the planet waits for the day map
   *  (up to a few seconds, then the generated ground stands in). */
  private loadEarthImages() {
    const gl = this.gl;
    const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    const big = maxTex >= 4096 && Math.max(window.innerWidth, window.innerHeight) * (window.devicePixelRatio || 1) >= 1300;
    this.real = {};
    this.realFailed = false;
    const load = (url: string, key: 'day' | 'night' | 'relief', single: boolean) => {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      img
        .decode()
        .then(() => {
          if (this.lost) return;
          const tex = gl.createTexture()!;
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
          gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
          if (single) gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, gl.RED, gl.UNSIGNED_BYTE, img);
          else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB8, gl.RGB, gl.UNSIGNED_BYTE, img);
          gl.generateMipmap(gl.TEXTURE_2D);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          const ext = this.aniso ? gl.getExtension('EXT_texture_filter_anisotropic') : null;
          if (ext) gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, this.aniso);
          this.real[key] = tex;
          if (!this.running) this.frame(performance.now(), true);
        })
        .catch(() => {
          if (key === 'day') this.realFailed = true;
        });
    };
    load(EARTH_IMAGES.day(big), 'day', false);
    load(EARTH_IMAGES.lights, 'night', true);
    load(EARTH_IMAGES.relief, 'relief', true);
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
      g.font = `700 ${size}px "Sora Variable", "Sora", system-ui, sans-serif`;
      const wdt = g.measureText(glyph).width;
      if (wdt > cell * 0.84) {
        size = Math.floor((size * cell * 0.84) / wdt);
        g.font = `700 ${size}px "Sora Variable", "Sora", system-ui, sans-serif`;
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

  /** The land mask, and empty targets for the planet's textures (filled a strip a frame). */
  private makeEarth() {
    const gl = this.gl;
    const f = landFields();
    this.maskTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.maskTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG8, f.w, f.h, 0, gl.RG, gl.UNSIGNED_BYTE, f.data);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const big = Math.max(window.innerWidth, window.innerHeight) >= 900 && (window.devicePixelRatio || 1) * Math.min(window.innerWidth, window.innerHeight) >= 700;
    const W = big ? 2048 : 1024;
    const make = (): Tex => {
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, W / 2, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fbo = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return { fbo, tex, w: W, h: W / 2 };
    };
    this.surf = make();
    this.cloud = make();
    this.earthStep = 0;
    this.earthReadyAt = 0;
  }

  /** Generates one strip of the planet's textures (or all of them), then their mipmaps. */
  private stepEarth(all: boolean) {
    if (this.earthReadyAt || !this.surf || !this.cloud) return;
    const gl = this.gl;
    gl.disable(gl.BLEND);
    gl.bindVertexArray(this.vaoEmpty);
    gl.enable(gl.SCISSOR_TEST);
    do {
      const pass = this.earthStep < EARTH_STRIPS ? 0 : 1;
      const strip = this.earthStep % EARTH_STRIPS;
      const t = pass ? this.cloud : this.surf;
      const P = pass ? this.progs.cloudGen : this.progs.surfGen;
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
      gl.viewport(0, 0, t.w, t.h);
      const y0 = Math.floor((t.h * strip) / EARTH_STRIPS);
      const y1 = Math.floor((t.h * (strip + 1)) / EARTH_STRIPS);
      gl.scissor(0, y0, t.w, y1 - y0);
      gl.useProgram(P.prog);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.maskTex!);
      gl.uniform1i(P.u.uMask, 0);
      if (pass) gl.uniform4fv(P.u.uStorm, this.stormData);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      this.earthStep++;
    } while (all && this.earthStep < EARTH_STRIPS * 2);
    gl.disable(gl.SCISSOR_TEST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (this.earthStep < EARTH_STRIPS * 2) return;
    const ext = this.aniso ? gl.getExtension('EXT_texture_filter_anisotropic') : null;
    for (const t of [this.surf, this.cloud]) {
      gl.bindTexture(gl.TEXTURE_2D, t.tex);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      if (ext) gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, this.aniso);
    }
    this.earthReadyAt = performance.now() / 1000;
  }

  private onLost = (e: Event) => {
    e.preventDefault();
    this.lost = true;
    cancelAnimationFrame(this.raf);
  };

  private onRestored = () => {
    this.lost = false;
    this.sky = this.boltRT = this.blurA = this.blurB = undefined;
    this.satRT = undefined;
    this.planetAt = 0;
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
    this.satSize = Math.round(this.w < 720 ? Math.max(64, this.w * 0.2) : Math.max(80, Math.min(120, this.w * 0.07)));
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

    // the satellite: rendered at twice its on-screen resolution, with depth
    if (this.satRT) {
      gl.deleteFramebuffer(this.satRT.fbo);
      gl.deleteTexture(this.satRT.tex);
      gl.deleteRenderbuffer(this.satRT.depth);
    }
    const size = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE) as number, 1024, Math.round(this.satSize * this.dpr * 3));
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const depth = gl.createRenderbuffer()!;
    gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, size, size);
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.satRT = { fbo, tex, depth, size };
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

  setNight(night: boolean, instant = false) {
    const to = night ? NIGHT_PHASE : DAY_PHASE;
    const now = performance.now() / 1000;
    const from = this.phaseAt(now);
    this.phase = instant || this.reduced || !this.running ? { from: to, to, t0: now, dur: 1 } : { from, to, t0: now, dur: 4.5 * Math.abs(to - from) / (NIGHT_PHASE - DAY_PHASE) + 0.5 };
    if (!this.running) this.frame(performance.now(), true);
  }

  /** Where the sun is along its path at `now`, easing between day and night. */
  private phaseAt(now: number) {
    const k = Math.min(1, Math.max(0, (now - this.phase.t0) / this.phase.dur));
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    return this.phase.from + (this.phase.to - this.phase.from) * e;
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
    let r = big ? rand(13, 18) : rand(8, 12);
    const code = this.codes[Math.floor(Math.random() * this.codes.length)];
    let x = 0;
    let y = 0;
    let vy = -rand(5, 13);
    let alpha = 1;
    // somewhere in open sky, never on the planet (it would hide the star)
    for (let tries = 0; tries < 12; tries++) {
      x = rand(r * 3, this.w - r * 3);
      y = rand(this.h * 0.14, this.h * 0.94);
      alpha = 1;
      if (this.scene === 'hero') {
        // keep the headline clear: beside it, or below the buttons
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
      if (Math.hypot(s.x - x, s.y - y) < s.r * 1.7) {
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

  /* ------------------------------ the satellite ------------------------------ */

  /** Puts the satellite on a low orbit: it comes up over the planet's edge (or in from the
   *  left), runs along just inside the horizon, and leaves off the right side. */
  private launchSatellite(now: number) {
    const ro = rand(1.045, 1.075);
    const tilt = (rand(22, 29) * Math.PI) / 180;
    const span = orbitSpan(ro, tilt, this.w, this.h, this.satSize * 0.6);
    const arc = PLANET.r * ro * this.h * Math.max(0.05, span.from - span.to);
    const speed = rand(26, 34) * Math.max(0.6, Math.min(1.2, this.h / 900));
    this.sat = {
      born: now,
      dur: arc / speed,
      from: span.from,
      to: span.to,
      ro,
      tilt,
      yaw: rand(0.3, 0.6) * (Math.random() < 0.5 ? -1 : 1),
      sway: rand(0.12, 0.2),
    };
  }

  /** Renders the satellite and composites it at its place on screen, with its panel
   *  glints and blinking beacon. Returns nothing drawn when there is no satellite. */
  private drawSatellite(now: number) {
    const sat = this.sat;
    const T = this.satRT;
    if (!sat || !T) return;
    const gl = this.gl;
    const age = now - sat.born;
    const k = Math.min(1, Math.max(0, age / sat.dur));
    const o = orbitAt(sat.from + (sat.to - sat.from) * k, sat.ro, sat.tilt, this.w, this.h);
    const cx = o.x;
    const cy = o.y;
    // wings along the orbit, underside toward the planet, turned a little to show its depth
    const rot = rotation(sat.yaw + 0.3 * Math.sin(sat.sway * age), 0.3 + 0.06 * Math.sin(age * 0.21), o.angle);

    gl.bindFramebuffer(gl.FRAMEBUFFER, T.fbo);
    gl.viewport(0, 0, T.size, T.size);
    gl.clearColor(0, 0, 0, 0);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    gl.disable(gl.BLEND);
    // lit by the same sun as the planet (leaning toward us, so its face reads), dark in
    // the planet's shadow; the planet below lights it blue only by day
    const sunI = sunlightAt(o.p, this.sun);
    const earthI = 1 - nightness(this.sun);
    const lv: Vec3 = [this.sun[0] + 0.2, this.sun[1] + 0.25, this.sun[2] + 0.55];
    const ll = Math.hypot(lv[0], lv[1], lv[2]) || 1;
    const L: Vec3 = [lv[0] / ll, lv[1] / ll, lv[2] / ll];
    const P = this.progs.sat;
    gl.useProgram(P.prog);
    gl.uniformMatrix3fv(P.u.uRot, false, new Float32Array(rot));
    gl.uniformMatrix4fv(P.u.uProj, false, this.satProj);
    gl.uniform1f(P.u.uDist, SAT_DIST);
    gl.uniform3f(P.u.uSun, L[0], L[1], L[2]);
    gl.uniform3f(P.u.uEarth, SAT_EARTH[0], SAT_EARTH[1], SAT_EARTH[2]);
    gl.uniform1f(P.u.uSunI, sunI);
    gl.uniform1f(P.u.uEarthI, earthI);
    gl.bindVertexArray(this.vaoSat);
    gl.drawArrays(gl.TRIANGLES, 0, this.satCount);
    gl.disable(gl.DEPTH_TEST);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const Q = this.progs.sprite;
    gl.useProgram(Q.prog);
    gl.uniform4f(Q.u.uRect, cx, cy, this.satSize / 2, this.satSize / 2);
    gl.uniform2f(Q.u.uRes, this.w, this.h);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, T.tex);
    gl.uniform1i(Q.u.uTex, 0);
    gl.uniform1f(Q.u.uAlpha, 1);
    gl.bindVertexArray(this.vaoEmpty);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // where a model point lands on screen
    const toScreen = (v: Vec3): Pt => {
      const p = apply3(rot, v);
      const z = SAT_DIST - p[2];
      return [cx + ((p[0] * SAT_F) / z) * (this.satSize / 2), cy - ((p[1] * SAT_F) / z) * (this.satSize / 2)];
    };
    const flares: Array<[Pt, number, [number, number, number], number]> = [];
    // the panels flash when they mirror the sun toward us
    const nF = apply3(rot, [0, 0, 1]);
    const dl = nF[0] * L[0] + nF[1] * L[1] + nF[2] * L[2];
    if (nF[2] > 0 && dl > 0 && sunI > 0.3) {
      const rz = 2 * dl * nF[2] - L[2];
      const glint = Math.pow(Math.max(0, rz), 320) * sunI;
      if (glint > 0.02) for (const c of WING_CENTRES) flares.push([toScreen(c), 3 + 14 * glint, [0.85, 0.92, 1], Math.min(1, glint * 2)]);
    }
    // a small red beacon on the antenna, blinking
    const top = apply3(rot, [0, 1, 0]);
    const ph = (now % 1.7) / 1.7;
    if (top[2] > -0.25 && ph < 0.12) flares.push([toScreen(BEACON), 2.6, [1, 0.25, 0.2], 1 - ph / 0.12]);
    if (flares.length) {
      let n = 0;
      for (const [[x, y], r, tint, a] of flares) {
        const o = n * 11;
        this.dropData.set([x, y, r, a, 0, 0, 0.5, 0, tint[0], tint[1], tint[2]], o);
        n++;
      }
      this.drawStars(n);
    }
  }

  /** Draws the first n instances in dropData with the star shader (additive). */
  private drawStars(n: number) {
    const gl = this.gl;
    const P = this.progs.drop;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufDrop);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.dropData.subarray(0, n * 11));
    gl.useProgram(P.prog);
    gl.uniform2f(P.u.uRes, this.w, this.h);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.atlas);
    gl.uniform1i(P.u.uAtlas, 1);
    gl.bindVertexArray(this.vaoDrop);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
    gl.activeTexture(gl.TEXTURE0);
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
    if (!this.sat && !this.nextSat) this.nextSat = this.last / 1000 + 2.5;
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
    this.sun = sunAt(this.phaseAt(now));

    // the planet's textures, a strip a frame until they are done (all at once for a still sky)
    this.stepEarth(still && this.reduced);

    // shooting stars on their own: a shower, or now and then when calm
    if (!still && now > this.nextAuto) {
      this.strike();
      if (shower && Math.random() < 0.25) this.strike();
      this.nextAuto = now + (shower ? rand(1.4, 3.8) : rand(6, 12));
    }

    // the satellite: one at a time, a pause between
    if (!still) {
      if (!this.sat && this.nextSat && now > this.nextSat) this.launchSatellite(now);
      if (this.sat && now - this.sat.born > this.sat.dur) {
        this.sat = undefined;
        this.nextSat = now + rand(16, 30);
      }
    } else if (this.reduced && !this.sat) {
      // a still sky still gets its satellite, parked part way along
      this.launchSatellite(now);
      this.sat!.born = now - this.sat!.dur * 0.45;
      this.sat!.sway = 0;
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
      const r = s.r * grow * (0.7 + 0.3 * fade);
      const o = nd * 11;
      const tint = rgbOf(s.code);
      // twinkle: a restless, uneven shimmer, as starlight through air
      const tw = 0.5 + 0.3 * Math.sin(s.phase * 1.7) + 0.2 * Math.sin(s.phase * 4.3 + 1.3);
      this.dropData[o] = s.x;
      this.dropData[o + 1] = s.y;
      this.dropData[o + 2] = r;
      this.dropData[o + 3] = s.alpha * Math.min(1, k * 3) * fade;
      this.dropData[o + 4] = this.glyphIndex.get(s.code) ?? 0;
      this.dropData[o + 5] = Math.max(s.charge, igniting ? (1 - k) * 1.2 : 0);
      this.dropData[o + 6] = Math.max(0, Math.min(1, tw));
      this.dropData[o + 7] = grow > 0.6 ? 11 / r : 0;
      this.dropData[o + 8] = tint[0];
      this.dropData[o + 9] = tint[1];
      this.dropData[o + 10] = tint[2];
      nd++;
    }
    if (nd) this.drawStars(nd);

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

    // 5. the planet, hiding whatever is behind it; it fades in once its textures exist
    // (the real day map, or after a few seconds without it, the generated ground)
    if (!this.planetAt && this.earthReadyAt && (this.real.day || this.realFailed || time > 6)) this.planetAt = now;
    if (this.planetAt) {
      const Q = P.planet;
      const fade = still ? 1 : Math.min(1, (now - this.planetAt) / 0.9);
      const spinS = (((0.5 + START_TURN - time * SPIN) % 1) + 1) % 1;
      const spinC = (((0.5 + START_TURN - time * (SPIN + CLOUD_DRIFT)) % 1) + 1) % 1;
      const sun = this.sun;
      const sunP = toPlanet(sun);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(Q.prog);
      gl.uniform1f(Q.u.uTop, Math.min(1, PLANET.cy + PLANET.r + PLANET.atmo * 4));
      gl.uniform1f(Q.u.uAspect, aspect);
      gl.uniform3f(Q.u.uGeo, PLANET.cx * aspect, PLANET.cy, PLANET.r);
      gl.uniform1f(Q.u.uAtmo, PLANET.atmo);
      gl.uniform1f(Q.u.uPix, 1 / H);
      gl.uniform3f(Q.u.uSun, sun[0], sun[1], sun[2]);
      gl.uniform3f(Q.u.uSunP, sunP[0], sunP[1], sunP[2]);
      gl.uniformMatrix3fv(Q.u.uPole, false, POLE_MAT);
      gl.uniform2f(Q.u.uSpin, spinS, spinC);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.surf!.tex);
      gl.uniform1i(Q.u.uSurf, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.cloud!.tex);
      gl.uniform1i(Q.u.uCloud, 1);
      const real = this.real.day && this.real.night && this.real.relief;
      gl.uniform1f(Q.u.uReal, real ? 1 : 0);
      if (real) {
        const units: Array<[WebGLTexture, WebGLUniformLocation | null]> = [
          [this.real.day!, Q.u.uDay],
          [this.real.night!, Q.u.uNight],
          [this.real.relief!, Q.u.uRelief],
          [this.maskTex!, Q.u.uMask],
        ];
        units.forEach(([tex, loc], i) => {
          gl.activeTexture(gl.TEXTURE2 + i);
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.uniform1i(loc, 2 + i);
        });
      }
      gl.uniform1f(Q.u.uFade, fade);
      gl.bindVertexArray(this.vaoEmpty);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.activeTexture(gl.TEXTURE0);
    }

    // 6. the satellite, orbiting in front of the planet
    this.drawSatellite(now);

    // 7. shooting stars: bloom from a half-resolution pass, then a crisp core on top
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

    // 8. lens: vignette and grain, multiplied
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
