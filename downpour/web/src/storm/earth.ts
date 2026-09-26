/* The planet along the bottom of the sky: the real Earth's coastlines, where it sits on
 * screen, which way it faces and where its sun is. Shared by the WebGL sky and the 2D
 * fallback. */
import { EARTH_MASK } from './earthMask';

export type Vec3 = [number, number, number];

const norm = (v: Vec3): Vec3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Where the planet is, in sky units: x across in screen heights from the left edge,
 *  y up in screen heights from the bottom edge. Only its top shows, as a curved horizon. */
export const PLANET = {
  /** centre x, as a fraction of the screen width */
  cx: 0.68,
  /** centre y, in screen heights (below the bottom edge) */
  cy: -0.72,
  /** radius, in screen heights */
  r: 1.0,
  /** thickness of the glowing atmosphere, in screen heights */
  atmo: 0.026,
};

/** Toward the planet's sun, in view space (x right, y up, z toward the viewer): low on
 *  the left and a little in front, so the day side fills the left and middle, dusk
 *  crosses the planet on the right, and the cities of the night side glow beyond it. */
export const EARTH_SUN: Vec3 = norm([-0.9, 0.22, 0.25]);

/** The planet's north pole in view space: tipped away from the viewer so the near
 *  ground is around 13°N and the horizon runs through the mid-northern latitudes. */
const POLE: Vec3 = norm([0.214, 0.82, -0.53]);

/** Rows of the view-to-planet rotation: planet x, y (north) and z axes in view space. */
const AXIS_Y = POLE;
const AXIS_X = norm(cross(AXIS_Y, [0, 0, 1]));
const AXIS_Z = cross(AXIS_X, AXIS_Y);

/** View-space vector to planet frame. */
export function toPlanet(v: Vec3): Vec3 {
  return [dot(v, AXIS_X), dot(v, AXIS_Y), dot(v, AXIS_Z)];
}

/** The same rotation as a column-major mat3 for GLSL (q = M * n). */
export const POLE_MAT = new Float32Array([AXIS_X[0], AXIS_Y[0], AXIS_Z[0], AXIS_X[1], AXIS_Y[1], AXIS_Z[1], AXIS_X[2], AXIS_Y[2], AXIS_Z[2]]);

/** Longitude (turns) facing the viewer at the bottom of the screen when time starts:
 *  Africa and Arabia below, the Mediterranean and Europe toward the horizon. */
export const START_TURN = (() => {
  // the ground seen at the bottom middle of the screen
  const n = norm([0, -PLANET.cy / PLANET.r, Math.sqrt(1 - (PLANET.cy / PLANET.r) ** 2)]);
  const q = toPlanet(n);
  const lonHere = Math.atan2(-q[2], q[0]);
  const want = (30 * Math.PI) / 180;
  return (want - lonHere) / (2 * Math.PI);
})();

/** How fast the ground turns, in turns per second (one turn in 20 minutes), and how much
 *  faster the clouds drift. */
export const SPIN = 1 / 1200;
export const CLOUD_DRIFT = 1 / 9000;

/** The land mask, one byte per pixel (0 sea, 255 land), row 0 at the north pole. */
export function decodeMask() {
  const { w, h, runs } = EARTH_MASK;
  const bin = atob(runs);
  const out = new Uint8Array(w * h);
  let i = 0;
  let px = 0;
  let value = 0;
  let rowEnd = w;
  while (px < w * h && i < bin.length) {
    let n = 0;
    let shift = 0;
    let b: number;
    do {
      b = bin.charCodeAt(i++);
      n |= (b & 0x7f) << shift;
      shift += 7;
    } while (b & 0x80);
    if (value) out.fill(255, px, px + n);
    px += n;
    value ^= 1;
    if (px >= rowEnd) {
      rowEnd += w;
      value = 0;
    }
  }
  return { w, h, data: out };
}

/** Box blur along rows (wrapping round the globe) or columns (clamped at the poles). */
function blur(src: Float32Array, w: number, h: number, r: number, horizontal: boolean) {
  const out = new Float32Array(w * h);
  const n = horizontal ? w : h;
  const lines = horizontal ? h : w;
  const k = 1 / (2 * r + 1);
  for (let l = 0; l < lines; l++) {
    const at = (i: number) => {
      if (horizontal) return src[l * w + ((i % w) + w) % w];
      return src[Math.min(h - 1, Math.max(0, i)) * w + l];
    };
    let acc = 0;
    for (let i = -r; i <= r; i++) acc += at(i);
    for (let i = 0; i < n; i++) {
      if (horizontal) out[l * w + i] = acc * k;
      else out[i * w + l] = acc * k;
      acc += at(i + r + 1) - at(i - r);
    }
  }
  return out;
}

/** Two fields over the mask for the GPU, interleaved: the coastline softened by a pixel
 *  or two (so noise can wiggle it into a real-looking coast), and how much land lies
 *  within a few degrees (dry interiors, crowded coasts). */
let fields: { w: number; h: number; data: Uint8Array; mask: Uint8Array } | undefined;
export function landFields() {
  if (fields) return fields;
  const { w, h, data } = decodeMask();
  const f = new Float32Array(w * h);
  for (let i = 0; i < f.length; i++) f[i] = data[i] / 255;
  let coast = f;
  for (let pass = 0; pass < 2; pass++) coast = blur(blur(coast, w, h, 1, true), w, h, 1, false);
  let inland = f;
  for (let pass = 0; pass < 3; pass++) inland = blur(blur(inland, w, h, 9, true), w, h, 9, false);
  const out = new Uint8Array(w * h * 2);
  for (let i = 0; i < w * h; i++) {
    out[i * 2] = Math.round(coast[i] * 255);
    out[i * 2 + 1] = Math.round(inland[i] * 255);
  }
  fields = { w, h, data: out, mask: data };
  return fields;
}

/** Screen y (CSS px, from the top) of the horizon above screen x, or undefined where the
 *  planet is not below. */
export function horizonY(x: number, w: number, h: number) {
  const px = x / h;
  const dx = px - PLANET.cx * (w / h);
  if (Math.abs(dx) >= PLANET.r) return undefined;
  const py = PLANET.cy + Math.sqrt(PLANET.r * PLANET.r - dx * dx);
  return h * (1 - py);
}

/** Whether screen point (x, y) (CSS px) lies on the planet's disc. */
export function onPlanet(x: number, y: number, w: number, h: number) {
  const px = x / h - PLANET.cx * (w / h);
  const py = 1 - y / h - PLANET.cy;
  return px * px + py * py < PLANET.r * PLANET.r;
}

/** Cyclones and hurricanes for the cloud cover: centre (lat, lon in degrees) and twist
 *  (radians; positive turns anticlockwise seen from above, as in the north). The first
 *  two are tight hurricanes with an eye. */
export const STORMS: Array<[number, number, number]> = [
  [19, -58, 9],
  [17, 132, 9],
  [53, -28, 4.5],
  [49, 163, 4.5],
  [57, 18, 3.5],
  [44, -142, 4],
  [-51, 62, -4.5],
  [-56, -104, -4],
];

/** The real Earth: NASA's Blue Marble (day) and Earth at Night maps and topography,
 *  public domain, prepared by scripts/build-earth-images.mjs. */
export const EARTH_IMAGES = {
  day: (big: boolean) => `${import.meta.env.BASE_URL}earth/day-${big ? '4k' : '2k'}.jpg`,
  night: `${import.meta.env.BASE_URL}earth/night-2k.jpg`,
  relief: `${import.meta.env.BASE_URL}earth/relief-2k.jpg`,
};

/** A low orbit round the planet as we see it: a circle of `ro` planet radii round its
 *  centre, tilted toward us by `tilt` (radians), travelled left to right over the top as
 *  θ falls. Screen position in CSS px, depth (+ toward us) and direction of travel on
 *  screen (radians, y up). */
export function orbitAt(theta: number, ro: number, tilt: number, w: number, h: number) {
  const R = PLANET.r * ro;
  const x = PLANET.cx * (w / h) + R * Math.cos(theta);
  const y = PLANET.cy + R * Math.sin(theta) * Math.cos(tilt);
  return {
    x: x * h,
    y: h * (1 - y),
    z: R * Math.sin(theta) * Math.sin(tilt),
    angle: Math.atan2(-Math.cos(theta) * Math.cos(tilt), Math.sin(theta)),
  };
}

/** The part of that orbit on screen: θ where it comes into view (over the bottom or the
 *  left edge) and where it leaves (off the right edge, or the bottom), padded by `pad`
 *  CSS px so it enters and leaves fully out of sight. */
export function orbitSpan(ro: number, tilt: number, w: number, h: number, pad: number) {
  const R = PLANET.r * ro;
  const cxp = PLANET.cx * (w / h);
  const clamp = (v: number) => Math.max(-1, Math.min(1, v));
  const s = clamp((-PLANET.cy - pad / h) / (R * Math.cos(tilt)));
  const enterX = Math.acos(clamp((-cxp - pad / h) / R));
  const enterY = Math.PI - Math.asin(s);
  const leaveX = Math.acos(clamp((w / h - cxp + pad / h) / R));
  const leaveY = Math.asin(s);
  return { from: Math.min(enterX, enterY), to: Math.max(leaveX, leaveY), throughSide: leaveX > leaveY };
}
