/* The WebGL sky's deep space (SKY_FS in shaders.ts) and its currency stars (DROP_FS),
 * ported to the CPU for the 2D sky: the same value noise, nebulae eaten by dust, the
 * galaxy band with its dust lanes, the far spiral galaxy and the lens vignette, without
 * the motion. Colours are 0..1 rgb. */

const fract = (x: number) => x - Math.floor(x);
const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function hash(x: number, y: number) {
  let px = fract(x * 233.34);
  let py = fract(y * 851.73);
  const d = px * (px + 23.45) + py * (py + 23.45);
  px += d;
  py += d;
  return fract(px * py);
}

function noise(x: number, y: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm(x: number, y: number, octaves: number) {
  let s = 0;
  let a = 0.5;
  for (let i = 0; i < octaves; i++) {
    s += a * noise(x, y);
    const nx = 1.62 * x - 1.18 * y + 3.7;
    y = 1.18 * x + 1.62 * y + 11.1;
    x = nx;
    a *= 0.5;
  }
  return s;
}

const BAND_SIN = Math.sin(0.55);
const BAND_COS = Math.cos(0.55);

/** How far from the galaxy band's middle a point is (0 at its heart), u right, v up. */
export function bandAt(u: number, v: number, aspect: number) {
  const bx = (u - 0.5) * aspect;
  const by = v - 0.5;
  const across = bx * BAND_SIN - by * BAND_COS;
  return Math.exp(-across * across * 14);
}

/** The void, the nebulae, the dust and the galaxy band at one point (u right, v up). */
export function deepSpace(u: number, v: number, aspect: number): [number, number, number] {
  const px = u * aspect;
  const py = v;
  let r = 0.007 + 0.001 * v;
  let g = 0.01 + 0.004 * v;
  let b = 0.018 + 0.012 * v;

  // nebulae: faint domain-warped wisps of gas, blue-grey and blue, with dark dust
  const qx = px * 1.3;
  const qy = py * 1.3;
  const wx = fbm(qx + 1.7, qy + 9.2, 3);
  const wy = fbm(qx + 8.3, qy + 2.8, 3);
  // (a touch stronger than in WebGL: the hash runs in double precision here, so the wisps
  // fall elsewhere, and side by side this keeps as much gas on screen)
  const m1 = smoothstep(0.45, 0.85, fbm(qx + 1.8 * wx, qy + 1.8 * wy, 5)) * 0.3;
  const m2 = smoothstep(0.5, 0.9, fbm(qx * 1.7 - 1.2 * wx + 4, qy * 1.7 - 1.2 * wy + 4, 5)) * 0.35;
  r += 0.13 * m1 + 0.05 * m2;
  g += 0.17 * m1 + 0.17 * m2;
  b += 0.26 * m1 + 0.32 * m2;
  const dust = 1 - smoothstep(0.55, 0.75, fbm(qx * 2.3 + wx * 1.4 + 11, qy * 2.3 + wy * 1.4 + 11, 3)) * 0.55;
  r *= dust;
  g *= dust;
  b *= dust;

  // the galaxy band, corner to corner, with dust lanes down its middle
  const bx = px - 0.5 * aspect;
  const by = py - 0.5;
  const across = bx * BAND_SIN - by * BAND_COS;
  const along = bx * BAND_COS + by * BAND_SIN;
  const band = Math.exp(-across * across * 14);
  if (band > 0.002) {
    const tint = fbm(along * 3, 1, 3);
    const k = band * 0.16 * (0.6 + 0.8 * fbm(along * 6, across * 12, 3));
    r += (0.52 + 0.12 * tint) * k;
    g += (0.55 + 0.08 * tint) * k;
    b += (0.6 + 0.02 * tint) * k;
    if (Math.abs(across) < 0.4) {
      const lane = 1 - smoothstep(0.35, 0.7, fbm(along * 2.5 + 3, across * 9 + 3, 5)) * Math.exp(-across * across * 60) * 0.6;
      r *= lane;
      g *= lane;
      b *= lane;
    }
  }
  return [r, g, b];
}

/** Where the far spiral galaxy sits (u right, v up), and its brightness at a point. */
export const GALAXY_AT = [0.82, 0.78] as const;
export function spiralGalaxy(u: number, v: number, aspect: number) {
  const dx = (u - GALAXY_AT[0]) * aspect;
  const dy = (v - GALAXY_AT[1]) * 1.9;
  const gx = 0.87 * dx + 0.5 * dy;
  const gy = -0.5 * dx + 0.87 * dy;
  const gr = Math.hypot(gx, gy);
  const arms = 0.5 + 0.5 * Math.sin(Math.atan2(gy, gx) * 2 - Math.log(gr + 0.001) * 5);
  return (Math.exp(-gr * 26) * (0.35 + 0.65 * arms) + Math.exp(-gr * gr * 2200) * 1.4) * 0.5;
}

/** The lens: darker toward the corners. */
export function vignette(u: number, v: number, aspect: number) {
  const len = Math.hypot((u - 0.5) * aspect, v - 0.5);
  return 0.6 + 0.4 * smoothstep(1.2, 0.3, len);
}

/* ------------------------------ currency stars ------------------------------ */

/** The parts of a currency star that do not depend on its colour, over a square of
 *  `n` px covering 6 star radii each way: core, halo and bloom, spikes, and how far
 *  the spikes fringe into colour. Worked out once. */
const FRINGE = [0, 0.33, 0.67];
let template: { n: number; core: Float32Array; glow: Float32Array; spike: Float32Array; fringe: Float32Array; mix: Float32Array } | undefined;
function starTemplate(n: number) {
  if (template && template.n === n) return template;
  const core = new Float32Array(n * n);
  const glow = new Float32Array(n * n);
  const spike = new Float32Array(n * n);
  const mix = new Float32Array(n * n);
  const fringe = new Float32Array(n * n * 3);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const px = ((x + 0.5) / n) * 12 - 6;
      const py = ((y + 0.5) / n) * 12 - 6;
      const r2 = px * px + py * py;
      const r = Math.sqrt(r2);
      const fade = smoothstep(6, 4.6, r);
      const i = y * n + x;
      core[i] = Math.exp(-r2 * 7) * 1.2 * fade;
      glow[i] = (Math.exp(-r * 1.9) * 0.5 + 0.09 / (1 + r2 * 0.8)) * fade;
      const ax = Math.abs(px);
      const ay = Math.abs(py);
      const sx = Math.exp((-ay * 24) / (1 + ax * 0.12)) * Math.exp(-ax * 0.46);
      const sy = Math.exp((-ax * 24) / (1 + ay * 0.12)) * Math.exp(-ay * 0.46);
      spike[i] = (sx + sy) * 0.8 * fade;
      const along = Math.max(ax, ay);
      mix[i] = smoothstep(0.8, 3.8, along) * 0.65;
      for (let c = 0; c < 3; c++) fringe[i * 3 + c] = 0.55 + 0.45 * Math.cos(6.2832 * (along * 0.2 + FRINGE[c]));
    }
  }
  template = { n, core, glow, spike, fringe, mix };
  return template;
}

/** A currency star as the WebGL sky draws it (a white core, a halo and bloom in the
 *  currency's colour, four long spikes fringing into colour), for additive drawing. */
export function starImage(tint: [number, number, number], n: number): ImageData {
  const t = starTemplate(n);
  const hue = tint.map((c) => c * 0.6 + 0.4);
  const img = new ImageData(n, n);
  const d = img.data;
  for (let i = 0; i < n * n; i++) {
    const m = t.mix[i];
    for (let c = 0; c < 3; c++) {
      const spikeC = 1 + (t.fringe[i * 3 + c] * hue[c] * 1.25 - 1) * m;
      const v = t.core[i] + hue[c] * t.glow[i] + spikeC * t.spike[i];
      d[i * 4 + c] = Math.min(255, v * 255);
    }
    d[i * 4 + 3] = 255;
  }
  return img;
}
