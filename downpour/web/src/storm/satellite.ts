/* A communications satellite, modelled for the sky: a box-shaped bus wrapped in gold
 * and silver insulation foil with white radiators on top and bottom, two wings of three
 * solar panels on booms and yokes, a large dish on an arm with its feed on three struts,
 * a smaller dish, star trackers, an omni antenna and thruster nozzles.
 *
 * The mesh is triangles of [x, y, z, nx, ny, nz, u, v, material], in metres-ish model
 * units (x along the wings, y up, z toward the front). */
import type { Vec3 } from './earth';

export const MAT = { GOLD: 0, SILVER: 1, WHITE: 2, CELLS: 3, BACK: 4, METAL: 5, DARK: 6, DISH: 7 } as const;
export const SAT_STRIDE = 9;

/** Half the extent of the model, for framing it. */
export const SAT_RADIUS = 4.5;
/** Where the little red beacon sits (the tip of the omni antenna), and the centres of the wings. */
export const BEACON: Vec3 = [-0.42, 1.24, 0.3];
export const WING_CENTRES: Vec3[] = [
  [2.8, 0, 0],
  [-2.8, 0, 0],
];

type Frame = { o: Vec3; x: Vec3; y: Vec3; z: Vec3 };

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const len = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: Vec3): Vec3 => mul(a, 1 / (len(a) || 1));
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** A frame whose z axis points along `dir`. */
function frameAlong(o: Vec3, dir: Vec3): Frame {
  const z = norm(dir);
  const up: Vec3 = Math.abs(z[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const x = norm(cross(up, z));
  const y = cross(z, x);
  return { o, x, y, z };
}

class Builder {
  out: number[] = [];

  private push(p: Vec3, n: Vec3, u: number, v: number, m: number) {
    this.out.push(p[0], p[1], p[2], n[0], n[1], n[2], u, v, m);
  }

  tri(a: Vec3, b: Vec3, c: Vec3, na: Vec3, nb: Vec3, nc: Vec3, ua: [number, number], ub: [number, number], uc: [number, number], m: number) {
    this.push(a, na, ua[0], ua[1], m);
    this.push(b, nb, ub[0], ub[1], m);
    this.push(c, nc, uc[0], uc[1], m);
  }

  /** A flat quad, corners anticlockwise seen from the front. */
  quad(a: Vec3, b: Vec3, c: Vec3, d: Vec3, m: number) {
    const n = norm(cross(sub(b, a), sub(d, a)));
    this.tri(a, b, c, n, n, n, [0, 0], [1, 0], [1, 1], m);
    this.tri(a, c, d, n, n, n, [0, 0], [1, 1], [0, 1], m);
  }

  /** An axis-aligned box; materials for +x, -x, +y, -y, +z, -z. */
  box(c: Vec3, s: Vec3, m: number | number[]) {
    const mats = typeof m === 'number' ? [m, m, m, m, m, m] : m;
    const [hx, hy, hz] = [s[0] / 2, s[1] / 2, s[2] / 2];
    const P = (x: number, y: number, z: number): Vec3 => [c[0] + x * hx, c[1] + y * hy, c[2] + z * hz];
    this.quad(P(1, -1, 1), P(1, -1, -1), P(1, 1, -1), P(1, 1, 1), mats[0]);
    this.quad(P(-1, -1, -1), P(-1, -1, 1), P(-1, 1, 1), P(-1, 1, -1), mats[1]);
    this.quad(P(-1, 1, 1), P(1, 1, 1), P(1, 1, -1), P(-1, 1, -1), mats[2]);
    this.quad(P(-1, -1, -1), P(1, -1, -1), P(1, -1, 1), P(-1, -1, 1), mats[3]);
    this.quad(P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1), mats[4]);
    this.quad(P(1, -1, -1), P(-1, -1, -1), P(-1, 1, -1), P(1, 1, -1), mats[5]);
  }

  /** A tube or cone from a to b, radius r0 at a and r1 at b, optionally capped. */
  tube(a: Vec3, b: Vec3, r0: number, r1: number, seg: number, m: number, caps = true) {
    const f = frameAlong(a, sub(b, a));
    const L = len(sub(b, a));
    const slope = (r0 - r1) / L;
    for (let i = 0; i < seg; i++) {
      const t0 = (i / seg) * Math.PI * 2;
      const t1 = ((i + 1) / seg) * Math.PI * 2;
      const dir = (t: number): Vec3 => add(mul(f.x, Math.cos(t)), mul(f.y, Math.sin(t)));
      const n0 = norm(add(dir(t0), mul(f.z, slope)));
      const n1 = norm(add(dir(t1), mul(f.z, slope)));
      const a0 = add(a, mul(dir(t0), r0));
      const a1 = add(a, mul(dir(t1), r0));
      const b0 = add(b, mul(dir(t0), r1));
      const b1 = add(b, mul(dir(t1), r1));
      this.tri(a0, a1, b1, n0, n1, n1, [i / seg, 0], [(i + 1) / seg, 0], [(i + 1) / seg, 1], m);
      this.tri(a0, b1, b0, n0, n1, n0, [i / seg, 0], [(i + 1) / seg, 1], [i / seg, 1], m);
      if (caps) {
        const nb = mul(f.z, -1);
        if (r0 > 0) this.tri(a, a1, a0, nb, nb, nb, [0.5, 0.5], [0, 0], [1, 0], m);
        if (r1 > 0) this.tri(b, b0, b1, f.z, f.z, f.z, [0.5, 0.5], [0, 0], [1, 0], m);
      }
    }
  }

  /** A parabolic dish facing along `dir`, its rim at radius r and depth d behind it. */
  dish(c: Vec3, dir: Vec3, r: number, d: number, m: number) {
    const f = frameAlong(c, dir);
    const rings = 7;
    const seg = 28;
    const pt = (ri: number, si: number): [Vec3, Vec3] => {
      const rr = (ri / rings) * r;
      const t = (si / seg) * Math.PI * 2;
      const z = d * (rr / r) ** 2 - d; // vertex at -d, rim at 0
      const radial = add(mul(f.x, Math.cos(t)), mul(f.y, Math.sin(t)));
      const p = add(add(c, mul(radial, rr)), mul(f.z, z));
      // normal of z = d (r'/r)^2: facing forward, tilted inward
      const slope = (2 * d * rr) / (r * r);
      const n = norm(sub(f.z, mul(radial, slope)));
      return [p, n];
    };
    for (let ri = 0; ri < rings; ri++) {
      for (let si = 0; si < seg; si++) {
        const [p00, n00] = pt(ri, si);
        const [p10, n10] = pt(ri + 1, si);
        const [p11, n11] = pt(ri + 1, si + 1);
        const [p01, n01] = pt(ri, si + 1);
        const u0 = ri / rings;
        const u1 = (ri + 1) / rings;
        this.tri(p00, p10, p11, n00, n10, n11, [u0, 0], [u1, 0], [u1, 1], m);
        this.tri(p00, p11, p01, n00, n11, n01, [u0, 0], [u1, 1], [u0, 1], m);
      }
    }
    // a rolled rim
    for (let si = 0; si < seg; si++) {
      const t0 = (si / seg) * Math.PI * 2;
      const t1 = ((si + 1) / seg) * Math.PI * 2;
      const rad = (t: number): Vec3 => add(mul(f.x, Math.cos(t)), mul(f.y, Math.sin(t)));
      const a0 = add(c, mul(rad(t0), r));
      const a1 = add(c, mul(rad(t1), r));
      const b0 = add(a0, mul(f.z, -0.035));
      const b1 = add(a1, mul(f.z, -0.035));
      this.tri(a0, b0, b1, rad(t0), rad(t0), rad(t1), [0, 0], [0, 1], [1, 1], MAT.METAL);
      this.tri(a0, b1, a1, rad(t0), rad(t1), rad(t1), [0, 0], [1, 1], [1, 0], MAT.METAL);
    }
    return f;
  }
}

export function buildSatellite() {
  const b = new Builder();
  const { GOLD, SILVER, WHITE, CELLS, BACK, METAL, DARK, DISH } = MAT;

  // the bus: gold foil front and back, silver foil sides, white radiators top and bottom
  b.box([0, 0, 0], [1.4, 1.3, 1.3], [SILVER, SILVER, WHITE, WHITE, GOLD, GOLD]);
  // a thin frame along its edges, and an adapter ring underneath
  for (const x of [-0.7, 0.7]) for (const z of [-0.65, 0.65]) b.box([x, 0, z], [0.05, 1.32, 0.05], METAL);
  b.tube([0, -0.65, 0], [0, -0.78, 0], 0.42, 0.42, 24, METAL);
  // the main engine
  b.tube([0, -0.78, 0], [0, -1.08, 0], 0.08, 0.2, 18, DARK, false);

  // wings: boom, yoke, three panels, hinges
  for (const s of [1, -1]) {
    b.tube([0.7 * s, 0, 0], [1.12 * s, 0, 0], 0.045, 0.045, 12, METAL);
    b.box([0.72 * s, 0, 0], [0.06, 0.22, 0.22], METAL); // the drive at the root
    b.tube([1.12 * s, 0, 0], [1.26 * s, 0.4, 0], 0.022, 0.022, 8, METAL);
    b.tube([1.12 * s, 0, 0], [1.26 * s, -0.4, 0], 0.022, 0.022, 8, METAL);
    b.box([1.27 * s, 0, 0], [0.04, 0.9, 0.04], METAL);
    for (let i = 0; i < 3; i++) {
      const x0 = 1.3 + i * 1.03;
      const cx = (x0 + 0.5) * s;
      b.box([cx, 0, 0], [1.0, 0.9, 0.03], s > 0 ? [METAL, METAL, METAL, METAL, CELLS, BACK] : [METAL, METAL, METAL, METAL, CELLS, BACK]);
      if (i < 2) for (const y of [-0.3, 0.3]) b.box([(x0 + 1.015) * s, y, 0], [0.05, 0.07, 0.05], METAL);
    }
  }

  // the big dish on an arm off the front, looking forward and down
  const dishC: Vec3 = [0.05, -0.2, 1.08];
  const dishDir: Vec3 = norm([0, -0.38, 1]);
  b.tube([0.05, -0.2, 0.65], add(dishC, mul(dishDir, -0.16)), 0.045, 0.045, 10, METAL);
  const df = b.dish(dishC, dishDir, 0.56, 0.15, DISH);
  const focus = add(dishC, mul(df.z, 0.42));
  for (let k = 0; k < 3; k++) {
    const t = (k / 3) * Math.PI * 2 + 0.4;
    const rim = add(dishC, add(mul(df.x, Math.cos(t) * 0.53), mul(df.y, Math.sin(t) * 0.53)));
    b.tube(rim, focus, 0.009, 0.009, 5, METAL, false);
  }
  b.tube(add(focus, mul(df.z, -0.02)), add(focus, mul(df.z, -0.13)), 0.04, 0.06, 12, WHITE);

  // a smaller dish on top, looking up and forward
  b.tube([0.32, 0.65, 0.3], [0.32, 0.8, 0.36], 0.03, 0.03, 8, METAL);
  b.dish([0.32, 0.82, 0.37], norm([0, 1, 0.55]), 0.22, 0.05, DISH);

  // star trackers, omni antenna, thrusters
  for (const [x, z] of [
    [-0.3, -0.35],
    [-0.05, -0.42],
  ]) {
    b.tube([x, 0.65, z], [x, 0.84, z - 0.04], 0.065, 0.065, 12, DARK);
    b.tube([x, 0.84, z - 0.04], [x, 0.9, z - 0.05], 0.08, 0.1, 12, DARK, false);
  }
  b.tube([-0.42, 0.65, 0.3], BEACON, 0.014, 0.014, 6, METAL);
  b.box(BEACON, [0.05, 0.05, 0.05], WHITE);
  for (const x of [-0.5, 0.5]) for (const y of [-0.5, 0.5]) b.tube([x, y, -0.65], [x, y, -0.77], 0.03, 0.075, 10, DARK, false);

  const data = new Float32Array(b.out);
  return { data, count: data.length / SAT_STRIDE };
}

/* ------------------------------ small matrix helpers ------------------------------ */

/** Rotation (column-major mat3) from yaw about y, then pitch about x, then roll about z. */
export function rotation(yaw: number, pitch: number, roll: number) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const cr = Math.cos(roll), sr = Math.sin(roll);
  // R = Rz(roll) * Rx(pitch) * Ry(yaw)
  const Ry = [cy, 0, -sy, 0, 1, 0, sy, 0, cy];
  const Rx = [1, 0, 0, 0, cp, sp, 0, -sp, cp];
  const Rz = [cr, sr, 0, -sr, cr, 0, 0, 0, 1];
  return mul3(Rz, mul3(Rx, Ry));
}

function mul3(a: number[], b: number[]) {
  const o = new Array(9).fill(0);
  for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) o[c * 3 + r] += a[k * 3 + r] * b[c * 3 + k];
  return o;
}

export function apply3(m: number[], v: Vec3): Vec3 {
  return [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]];
}

/** Column-major perspective projection. */
export function perspective(fovY: number, aspect: number, near: number, far: number) {
  const f = 1 / Math.tan(fovY / 2);
  const nf = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
}

/* ------------------------------ the 2D fallback's satellite ------------------------------ */

/** Draws the satellite flat (seen from the front) into a 2D canvas, centred at 0,0 and
 *  `span` wide. Used by the 2D sky. */
export function drawSatellite2D(g: CanvasRenderingContext2D, span: number) {
  const u = span / 8.8;
  g.save();
  g.scale(u, u);
  g.lineWidth = 0.02;
  // booms
  g.fillStyle = '#9aa3ad';
  g.fillRect(-1.3, -0.04, 2.6, 0.08);
  for (const s of [1, -1]) {
    g.fillRect(1.25 * s - 0.02, -0.45, 0.04, 0.9);
    for (let i = 0; i < 3; i++) {
      const x0 = (1.3 + i * 1.03) * s;
      const x = s > 0 ? x0 : x0 - 1.0;
      const grad = g.createLinearGradient(x, -0.45, x + 1.0, 0.45);
      grad.addColorStop(0, '#1d3a8a');
      grad.addColorStop(0.5, '#0b1a4d');
      grad.addColorStop(1, '#152f78');
      g.fillStyle = grad;
      g.fillRect(x, -0.45, 1.0, 0.9);
      g.strokeStyle = 'rgba(190,200,215,0.55)';
      for (let k = 1; k < 10; k++) {
        g.beginPath();
        g.moveTo(x + k * 0.1, -0.45);
        g.lineTo(x + k * 0.1, 0.45);
        g.stroke();
      }
      for (let k = 1; k < 8; k++) {
        g.beginPath();
        g.moveTo(x, -0.45 + k * 0.1125);
        g.lineTo(x + 1.0, -0.45 + k * 0.1125);
        g.stroke();
      }
      g.strokeStyle = '#aab3bf';
      g.strokeRect(x, -0.45, 1.0, 0.9);
    }
  }
  // body: gold foil
  const body = g.createLinearGradient(-0.7, -0.65, 0.7, 0.65);
  body.addColorStop(0, '#ffe39a');
  body.addColorStop(0.35, '#d9a13a');
  body.addColorStop(0.6, '#f6c65e');
  body.addColorStop(1, '#8a5a17');
  g.fillStyle = body;
  g.fillRect(-0.7, -0.65, 1.4, 1.3);
  g.strokeStyle = 'rgba(255,240,200,0.35)';
  for (let k = 0; k < 7; k++) {
    g.beginPath();
    g.moveTo(-0.7 + Math.random() * 1.4, -0.65);
    g.lineTo(-0.7 + Math.random() * 1.4, 0.65);
    g.stroke();
  }
  g.fillStyle = '#e8eaed';
  g.fillRect(-0.7, -0.72, 1.4, 0.08);
  g.fillRect(-0.7, 0.64, 1.4, 0.08);
  // dish
  const dish = g.createRadialGradient(-0.1, 0.1, 0.05, 0.05, 0.2, 0.56);
  dish.addColorStop(0, '#ffffff');
  dish.addColorStop(1, '#b9bec6');
  g.fillStyle = dish;
  g.beginPath();
  g.ellipse(0.05, 0.25, 0.56, 0.5, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#8e959e';
  g.lineWidth = 0.03;
  g.stroke();
  g.fillStyle = '#d6d9de';
  g.beginPath();
  g.arc(0.05, 0.25, 0.07, 0, Math.PI * 2);
  g.fill();
  // antenna
  g.strokeStyle = '#b0b7c0';
  g.beginPath();
  g.moveTo(-0.42, -0.65);
  g.lineTo(-0.42, -1.2);
  g.stroke();
  g.restore();
}
