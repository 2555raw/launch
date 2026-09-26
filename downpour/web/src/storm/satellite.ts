/* A slim modern satellite, modelled for the sky: a flat tray of a body with silver foil
 * on top, one long, narrow solar array on a short mast (four panels folded out on
 * hinges), a small dish and two star trackers on top, a whip antenna with a beacon, and
 * an ion thruster at the far end.
 *
 * The mesh is triangles of [x, y, z, nx, ny, nz, u, v, material], in metres-ish model
 * units (x along the array, y up, z toward the front). */
import type { Vec3 } from './earth';

export const MAT = { GOLD: 0, SILVER: 1, WHITE: 2, CELLS: 3, BACK: 4, METAL: 5, DARK: 6, DISH: 7 } as const;
export const SAT_STRIDE = 9;

/** Half the extent of the model, for framing it. */
export const SAT_RADIUS = 4.7;
/** Where the little red beacon sits (the tip of the whip antenna), and the middle of the array. */
export const BEACON: Vec3 = [-4.25, 0.52, -0.42];
export const WING_CENTRES: Vec3[] = [[1.52, 0, 0]];

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
  const { SILVER, WHITE, CELLS, BACK, METAL, DARK, DISH } = MAT;

  // the body: a flat tray, silver foil on top, white underneath, bare metal round the edge
  b.box([-3.25, 0, 0], [2.3, 0.14, 1.25], [METAL, METAL, SILVER, WHITE, METAL, METAL]);
  // two star trackers and a small dish on top, looking up and forward
  for (const [x, z] of [
    [-3.2, -0.38],
    [-2.9, -0.38],
  ]) {
    b.tube([x, 0.07, z], [x, 0.2, z - 0.03], 0.055, 0.055, 12, DARK);
    b.tube([x, 0.2, z - 0.03], [x, 0.25, z - 0.04], 0.07, 0.085, 12, DARK, false);
  }
  b.tube([-3.9, 0.07, 0.3], [-3.9, 0.16, 0.33], 0.025, 0.025, 8, METAL);
  b.dish([-3.9, 0.18, 0.34], norm([0, 1, 0.6]), 0.2, 0.045, DISH);
  // a whip antenna with the beacon at its tip, and the ion thruster at the far end
  b.tube([-4.25, 0.07, -0.42], BEACON, 0.012, 0.012, 6, METAL);
  b.box(BEACON, [0.045, 0.045, 0.045], WHITE);
  b.tube([-4.4, 0, 0.1], [-4.62, 0, 0.1], 0.06, 0.11, 14, DARK, false);

  // the mast out to the array, with its drive at the root and a yoke at the far end
  b.box([-2.08, 0, 0], [0.08, 0.2, 0.2], METAL);
  b.tube([-2.1, 0, 0], [-1.6, 0, 0], 0.04, 0.04, 10, METAL);
  b.box([-1.6, 0, 0], [0.04, 1.3, 0.04], METAL);

  // the array: four long panels, cells to the front, hinged end to end
  const panel = 1.51;
  const gap = 0.04;
  for (let i = 0; i < 4; i++) {
    const x0 = -1.56 + i * (panel + gap);
    b.box([x0 + panel / 2, 0, 0], [panel, 1.3, 0.03], [METAL, METAL, METAL, METAL, CELLS, BACK]);
    if (i < 3) for (const y of [-0.42, 0.42]) b.box([x0 + panel + gap / 2, y, 0], [0.05, 0.08, 0.05], METAL);
  }

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

/** Draws the satellite flat (seen from the front, its top tipped a little toward us)
 *  into a 2D canvas, centred at 0,0 and `span` wide. Used by the 2D sky. */
export function drawSatellite2D(g: CanvasRenderingContext2D, span: number) {
  const u = span / 9.3;
  g.save();
  g.scale(u, u);
  g.lineWidth = 0.02;
  // the array: four long panels of blue cells on the mast
  g.fillStyle = '#9aa3ad';
  g.fillRect(-2.1, -0.04, 0.55, 0.08);
  g.fillRect(-1.62, -0.65, 0.04, 1.3);
  for (let i = 0; i < 4; i++) {
    const x = -1.56 + i * 1.55;
    const grad = g.createLinearGradient(x, -0.65, x + 1.51, 0.65);
    grad.addColorStop(0, '#1d3a8a');
    grad.addColorStop(0.5, '#0b1a4d');
    grad.addColorStop(1, '#152f78');
    g.fillStyle = grad;
    g.fillRect(x, -0.65, 1.51, 1.3);
    g.strokeStyle = 'rgba(190,200,215,0.5)';
    for (let k = 1; k < 12; k++) {
      g.beginPath();
      g.moveTo(x + k * (1.51 / 12), -0.65);
      g.lineTo(x + k * (1.51 / 12), 0.65);
      g.stroke();
    }
    for (let k = 1; k < 9; k++) {
      g.beginPath();
      g.moveTo(x, -0.65 + k * (1.3 / 9));
      g.lineTo(x + 1.51, -0.65 + k * (1.3 / 9));
      g.stroke();
    }
    g.strokeStyle = '#aab3bf';
    g.strokeRect(x, -0.65, 1.51, 1.3);
  }
  // the body: a thin tray, its silver top seen at a slant above its front edge
  const top = g.createLinearGradient(-4.4, -0.3, -2.1, -0.07);
  top.addColorStop(0, '#f1f3f6');
  top.addColorStop(0.5, '#a9b0ba');
  top.addColorStop(1, '#dde1e6');
  g.fillStyle = top;
  g.beginPath();
  g.moveTo(-4.4, -0.07);
  g.lineTo(-2.1, -0.07);
  g.lineTo(-2.2, -0.3);
  g.lineTo(-4.3, -0.3);
  g.closePath();
  g.fill();
  g.fillStyle = '#7d8691';
  g.fillRect(-4.4, -0.07, 2.3, 0.14);
  // a small dish and two star trackers on top, the whip antenna, the thruster
  g.fillStyle = '#e9ebee';
  g.beginPath();
  g.ellipse(-3.9, -0.42, 0.2, 0.12, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#1a1c20';
  g.fillRect(-3.26, -0.5, 0.11, 0.2);
  g.fillRect(-2.96, -0.5, 0.11, 0.2);
  g.strokeStyle = '#b0b7c0';
  g.lineWidth = 0.025;
  g.beginPath();
  g.moveTo(-4.25, -0.2);
  g.lineTo(-4.25, -0.62);
  g.stroke();
  g.fillStyle = '#23262b';
  g.beginPath();
  g.moveTo(-4.4, -0.06);
  g.lineTo(-4.62, -0.11);
  g.lineTo(-4.62, 0.11);
  g.lineTo(-4.4, 0.06);
  g.closePath();
  g.fill();
  g.restore();
}
