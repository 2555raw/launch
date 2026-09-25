/* Renders public/art/scene-day.jpg and scene-night.jpg: a meadow of wild
 * flowers under the sky, photographed from knee height.
 *
 * A small physically-minded renderer, pure JS:
 *   camera   — pinhole, 70° horizontal field of view, 1.2 m up, pitched 6° up
 *   sky      — Rayleigh-like gradient, Mie glow around the sun
 *   clouds   — volumetric cumulus: a density field raymarched through a slab
 *              1.2–2.8 km up, lit toward the sun (Beer–Lambert, Henyey–
 *              Greenstein phase, powder term), fading into the haze with distance
 *   land     — tree line and hills on the horizon with aerial perspective,
 *              then the ground plane textured in world space
 *   meadow   — grass blades and flowers (daisies, buttercups, poppies,
 *              cornflowers, clover) placed in the world and projected,
 *              drawn far to near
 *   lens     — depth of field on the foreground, bloom, vignette, grain
 * The night plate reuses the land under moonlight with stars and a moon.
 * Seeded, so the output is stable. `npm run art`. */
const fs = require('fs');
const path = require('path');
const jpeg = require('jpeg-js');

const W = 2400, H = 1400;
const F = (W / 2) / Math.tan((70 * Math.PI) / 360); // focal length in px
const PITCH = (6 * Math.PI) / 180;
const CAM_H = 1.2;
const HORIZON = Math.round(H / 2 + F * Math.tan(PITCH));
const SUN_AZ = (24 * Math.PI) / 180, SUN_EL = (17 * Math.PI) / 180;
const SUN_DIR = [Math.sin(SUN_AZ) * Math.cos(SUN_EL), Math.sin(SUN_EL), Math.cos(SUN_AZ) * Math.cos(SUN_EL)];
const SUN_PX = { x: W / 2 + F * Math.tan(SUN_AZ), y: H / 2 - F * Math.tan(SUN_EL - PITCH) };

/* ---------- random + noise ---------- */
let seed = 20260925;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const P = new Uint8Array(512);
{ const p = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) P[i] = p[i & 255]; }
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
function g2(h, x, y) { switch (h & 7) { case 0: return x + y; case 1: return -x + y; case 2: return x - y; case 3: return -x - y; case 4: return x; case 5: return -x; case 6: return y; default: return -y; } }
function noise2(x, y) {
  const X = Math.floor(x), Y = Math.floor(y); x -= X; y -= Y; const xi = X & 255, yi = Y & 255;
  const u = fade(x), v = fade(y), a = P[xi] + yi, b = P[xi + 1] + yi;
  return lerp(lerp(g2(P[a], x, y), g2(P[b], x - 1, y), u), lerp(g2(P[a + 1], x, y - 1), g2(P[b + 1], x - 1, y - 1), u), v);
}
function g3(h, x, y, z) { const hh = h & 15, u = hh < 8 ? x : y, v = hh < 4 ? y : hh === 12 || hh === 14 ? x : z; return ((hh & 1) ? -u : u) + ((hh & 2) ? -v : v); }
function noise3(x, y, z) {
  const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z); x -= X; y -= Y; z -= Z;
  const xi = X & 255, yi = Y & 255, zi = Z & 255, u = fade(x), v = fade(y), w = fade(z);
  const A = P[xi] + yi, AA = P[A] + zi, AB = P[A + 1] + zi, B = P[xi + 1] + yi, BA = P[B] + zi, BB = P[B + 1] + zi;
  return lerp(lerp(lerp(g3(P[AA], x, y, z), g3(P[BA], x - 1, y, z), u), lerp(g3(P[AB], x, y - 1, z), g3(P[BB], x - 1, y - 1, z), u), v),
    lerp(lerp(g3(P[AA + 1], x, y, z - 1), g3(P[BA + 1], x - 1, y, z - 1), u), lerp(g3(P[AB + 1], x, y - 1, z - 1), g3(P[BB + 1], x - 1, y - 1, z - 1), u), v), w);
}
const fbm2 = (x, y, o = 5) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * noise2(x * f, y * f); f *= 2.02; a *= 0.5; } return s; };
const fbm3 = (x, y, z, o = 5) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * noise3(x * f, y * f, z * f); f *= 2.03; a *= 0.5; } return s; };

const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255].map((v) => Math.pow(v, 2.2));
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];

/* camera ray for a pixel */
function ray(x, y) {
  const az = Math.atan((x - W / 2) / F);
  const el = Math.atan(-(y - H / 2) / F) + PITCH;
  return [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)];
}
/* screen position of a ground point (X across, Z forward, metres) */
function project(X, Yw, Z) {
  const dy = Yw - CAM_H, el = Math.atan2(dy, Math.hypot(X, Z)), az = Math.atan2(X, Z);
  return { x: W / 2 + F * Math.tan(az), y: H / 2 - F * Math.tan(el - PITCH) };
}
const rowToZ = (y) => { const el = Math.atan(-(y - H / 2) / F) + PITCH; return el < -1e-4 ? CAM_H / Math.tan(-el) : Infinity; };

const img = new Float32Array(W * H * 3);
const land = new Float32Array(W * H);
const depth = new Float32Array(W * H).fill(1e6);
const put = (i, c) => { img[i * 3] = c[0]; img[i * 3 + 1] = c[1]; img[i * 3 + 2] = c[2]; };
const get = (i) => [img[i * 3], img[i * 3 + 1], img[i * 3 + 2]];

/* ---------- sky ---------- */
const ZEN = hex('#1d50bd'), MIDSKY = hex('#4a8ee3'), HOR = hex('#bcd8f2');
const SUNC = [1.0, 0.95, 0.85];
function skyColor(d) {
  const el = Math.max(0, d[1]);
  const t = Math.pow(1 - el, 5);
  let c = mix(mix(ZEN, MIDSKY, Math.pow(1 - el, 1.6)), HOR, t);
  const cosA = d[0] * SUN_DIR[0] + d[1] * SUN_DIR[1] + d[2] * SUN_DIR[2];
  const mie = Math.pow(Math.max(0, cosA), 8) * 0.35 + Math.pow(Math.max(0, cosA), 90) * 0.9 + Math.pow(Math.max(0, cosA), 3000) * 14;
  return [c[0] + SUNC[0] * mie, c[1] + SUNC[1] * mie, c[2] + SUNC[2] * mie];
}
const hazeCol = (d) => mix(HOR, skyColor([d[0], 0.02, d[2]]), 0.5);

/* ---------- volumetric clouds ---------- */
const C0 = 1200, C1 = 2800;
function cloudDensity(x, y, z) {
  const hf = (y - C0) / (C1 - C0);
  if (hf <= 0 || hf >= 1) return 0;
  const s = 0.00042;
  const base = fbm3(x * s, y * s * 1.6, z * s, 4) * 0.5 + 0.5;
  const coverage = 0.6 + 0.1 * noise2(x * 0.00006, z * 0.00006);
  const shape = smooth(0, 0.12, hf) * smooth(1, 0.35, hf);  // flat bases, rounded tops
  let d = (base - coverage) * shape * 2.2;
  if (d <= 0) return 0;
  const detail = fbm3(x * s * 5.5, y * s * 5.5, z * s * 5.5, 2) * 0.5 + 0.5;
  d -= (1 - detail) * 0.2 * (1 - hf * 0.4);
  return Math.max(0, d * 1.7);
}
function hg(cos, g) { return (1 - g * g) / (4 * Math.PI * Math.pow(1 + g * g - 2 * g * cos, 1.5)); }

console.time('sky+clouds');
{
  const SC = 1, SW = W / SC, SH = Math.ceil(HORIZON / SC) + 2; // clouds at full resolution
  const cl = new Float32Array(SW * SH * 4);             // rgb + transmittance
  const AMB_TOP = hex('#dbe8f7'), AMB_BOT = hex('#8392a8');
  for (let sy = 0; sy < SH; sy++) for (let sx = 0; sx < SW; sx++) {
    const d = ray(sx * SC + SC / 2, sy * SC + SC / 2);
    const o = (sy * SW + sx) * 4;
    cl[o + 3] = 1;
    if (d[1] <= 0.012) continue;
    const t0 = C0 / d[1], t1 = Math.min(C1 / d[1], 42000);
    if (t0 > 42000) continue;
    const N = 36, dt = (t1 - t0) / N;
    const cosA = d[0] * SUN_DIR[0] + d[1] * SUN_DIR[1] + d[2] * SUN_DIR[2];
    const phase = hg(cosA, 0.55) * 0.7 + hg(cosA, -0.2) * 0.3;
    let T = 1, r = 0, g = 0, b = 0;
    let t = t0 + dt * rnd();
    for (let k = 0; k < N && T > 0.02; k++, t += dt) {
      const x = d[0] * t + 1800, y = d[1] * t, z = d[2] * t;
      const den = cloudDensity(x, y, z);
      if (den <= 0) continue;
      /* light toward the sun, two taps */
      const l1 = cloudDensity(x + SUN_DIR[0] * 160, y + SUN_DIR[1] * 160, z + SUN_DIR[2] * 160);
      const l2 = cloudDensity(x + SUN_DIR[0] * 480, y + SUN_DIR[1] * 480, z + SUN_DIR[2] * 480);
      const od = (l1 * 160 + l2 * 320) * 0.012;
      const beer = Math.exp(-od) , powder = 1 - Math.exp(-od * 2 - den * 2);
      const hf = (y - C0) / (C1 - C0);
      const amb = mix(AMB_BOT, AMB_TOP, hf);
      const sun = beer * powder * phase * 26;
      const cr = sun * SUNC[0] + amb[0] * 0.85, cg = sun * SUNC[1] + amb[1] * 0.85, cb = sun * SUNC[2] + amb[2] * 0.9;
      const ext = den * dt * 0.0075;
      const a = 1 - Math.exp(-ext);
      /* aerial perspective on this sample */
      const fog = 1 - Math.exp(-t / 26000);
      const hz = hazeCol(d);
      r += T * a * lerp(cr, hz[0], fog); g += T * a * lerp(cg, hz[1], fog); b += T * a * lerp(cb, hz[2], fog);
      T *= 1 - a;
    }
    cl[o] = r; cl[o + 1] = g; cl[o + 2] = b; cl[o + 3] = T;
  }
  /* composite onto the sky at full resolution, bilinear */
  for (let y = 0; y < HORIZON + 4 && y < H; y++) for (let x = 0; x < W; x++) {
    const d = ray(x, y);
    const sky = skyColor(d);
    const fx = Math.min(SW - 1.001, Math.max(0, x / SC - 0.5)), fy = Math.min(SH - 1.001, Math.max(0, y / SC - 0.5));
    const x0 = Math.floor(fx), y0 = Math.floor(fy), ax = fx - x0, ay = fy - y0;
    const s = (c) => lerp(lerp(cl[(y0 * SW + x0) * 4 + c], cl[(y0 * SW + x0 + 1) * 4 + c], ax), lerp(cl[((y0 + 1) * SW + x0) * 4 + c], cl[((y0 + 1) * SW + x0 + 1) * 4 + c], ax), ay);
    const T = s(3);
    put(y * W + x, [sky[0] * T + s(0), sky[1] * T + s(1), sky[2] * T + s(2)]);
  }
}
console.timeEnd('sky+clouds');

/* ---------- land: tree line, hills, ground ---------- */
console.time('land');
const TREE = hex('#1f3a24'), TREE_LIT = hex('#46703a'), HILL = hex('#5f8a45'), GRASS_FAR = hex('#7da04a'), GRASS_MID = hex('#5a8f33'), GRASS_NEAR = hex('#3c7424'), DRY = hex('#b5b25a'), SOIL = hex('#4a4a26');
/* silhouettes above the horizon, in pixels (distant, so flat) */
const hillTop = new Float32Array(W), treeTop = new Float32Array(W), treeBot = new Float32Array(W);
for (let x = 0; x < W; x++) {
  const u = x / W;
  hillTop[x] = HORIZON - 3 - 34 * Math.max(0, fbm2(u * 1.8, 3.1, 5) * 0.9 + 0.35) - 10 * (Math.sin(u * 4.1 + 1) * 0.5 + 0.5);
}
/* trees: overlapping crowns along a band, clumped */
const crowns = [];
for (let x = -40; x < W + 40; x += 1.5 + rnd() * 3) {
  const clump = fbm2(x * 0.003, 7.7, 4);
  if (clump < -0.22) continue;
  const base = HORIZON + 2;
  const h = 7 + (clump + 0.25) * 30 + rnd() * rnd() * 16;
  crowns.push({ x, base, h, r: 3 + rnd() * 6 + (clump + 0.25) * 5 });
}
treeTop.fill(1e9);
for (const c of crowns) for (let x = Math.floor(c.x - c.r); x <= c.x + c.r; x++) {
  if (x < 0 || x >= W) continue;
  const dx = (x - c.x) / c.r, top = c.base - c.h + c.r * (1 - Math.sqrt(Math.max(0, 1 - dx * dx)));
  if (top < treeTop[x]) treeTop[x] = top;
}
for (let y = Math.floor(HORIZON - 120); y < H; y++) for (let x = 0; x < W; x++) {
  const i = y * W + x;
  const d = ray(x, y);
  const hz = hazeCol(d);
  let c = null, a = 0;
  if (y >= treeTop[x] - 1 && y < HORIZON + 30) {
    const lit = clamp(fbm2(x * 0.05, y * 0.08, 4) * 0.8 + 0.5 + (x - SUN_PX.x) / W * -0.3);
    c = mix(mix(TREE, TREE_LIT, lit * 0.75 + clamp((treeTop[x] + 6 - y) / 6) * 0.3), hz, 0.3);
    a = clamp(y - treeTop[x] + 1);
  }
  if (y >= hillTop[x] - 1 && !(c && a >= 1 && y < hillTop[x] + 8 && treeTop[x] < hillTop[x])) {
    const hc = mix(mix(hex('#4f7250'), hex('#6d8f63'), clamp(fbm2(x * 0.01, y * 0.03, 3) + 0.5)), hz, 0.62);
    const ha = clamp(y - hillTop[x] + 1);
    if (!c || treeTop[x] > y) { c = hc; a = Math.max(a, ha); }
  }
  if (y > HORIZON) {
    const Z = rowToZ(y), X = Z * (x - W / 2) / F;
    const fog = clamp(1 - Math.exp(-Z / 420));
    const macro = fbm2(X * 0.02, Z * 0.02, 4) * 0.5 + 0.5;
    const meso = fbm2(X * 0.25, Z * 0.25, 4) * 0.5 + 0.5;
    const micro = noise2(X * 6, Z * 6) * 0.5 + 0.5;
    const near = clamp(1 - Z / 60);
    let gcol = mix(GRASS_FAR, GRASS_MID, clamp(1 - Z / 300));
    gcol = mix(gcol, GRASS_NEAR, near);
    gcol = mix(gcol, DRY, clamp(macro - 0.55) * 1.2);
    /* flower-rich patches read as a tint from far away */
    const bloom = clamp(fbm2(X * 0.05 + 9, Z * 0.05, 3) + 0.1);
    gcol = mix(gcol, hex('#e9e2b0'), bloom * clamp(Z / 60) * 0.25);
    const shade = 0.62 + 0.38 * (meso * 0.6 + micro * 0.4);
    gcol = mul(gcol, shade * (1 + 0.2 * (1 - near)));
    gcol = mix(gcol, SOIL, clamp(0.35 - meso) * near * 0.6);
    const g = mix(gcol, hz, fog * 0.75);
    if (y >= Math.max(hillTop[x], treeTop[x]) + 2 || y > HORIZON + 8) { c = g; a = 1; }
    depth[i] = Z;
  }
  if (c) { land[i] = a; put(i, mix(get(i), c, a)); }
}
console.timeEnd('land');

/* ---------- meadow sprites ---------- */
function blend(x, y, c, a) {
  if (a <= 0 || x < 0 || y < 0 || x >= W || y >= H) return;
  const i = y * W + x, o = i * 3;
  img[o] = lerp(img[o], c[0], a); img[o + 1] = lerp(img[o + 1], c[1], a); img[o + 2] = lerp(img[o + 2], c[2], a);
  land[i] = 1;
}
function ellipse(cx, cy, rx, ry, rot, c, alpha) {
  const R = Math.max(rx, ry) + 1.5, cs = Math.cos(rot), sn = Math.sin(rot);
  for (let y = Math.floor(cy - R); y <= cy + R; y++) for (let x = Math.floor(cx - R); x <= cx + R; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
    const u = (dx * cs + dy * sn) / Math.max(0.35, rx), v = (-dx * sn + dy * cs) / Math.max(0.35, ry);
    const dd = Math.sqrt(u * u + v * v);
    const edge = clamp((1 - dd) * Math.min(rx, ry) + 0.5);
    if (edge > 0) blend(x, y, c, alpha * edge);
  }
}
function blade(x0, y0, x1, y1, xc, yc, w, cBase, cTip, alpha) {
  const len = Math.hypot(x1 - x0, y1 - y0), steps = Math.max(2, Math.ceil(len / 0.7));
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * xc + t * t * x1;
    const y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * yc + t * t * y1;
    const ww = Math.max(0.35, w * (1 - t * 0.9));
    const c = mix(cBase, cTip, Math.pow(t, 1.4));
    ellipse(x, y, ww, ww, 0, c, alpha);
  }
}

const SPECIES = [
  { p: 0.36, kind: 'daisy', size: 0.022, petal: hex('#f7f6f0'), center: hex('#e8b21c'), n: [13, 17] },
  { p: 0.3, kind: 'buttercup', size: 0.013, petal: hex('#f6cf1b'), center: hex('#d99a0e'), n: [5, 5] },
  { p: 0.1, kind: 'poppy', size: 0.03, petal: hex('#d8321e'), center: hex('#1c1712'), n: [4, 4] },
  { p: 0.12, kind: 'cornflower', size: 0.016, petal: hex('#4f6fd8'), center: hex('#2a3a8a'), n: [8, 9] },
  { p: 0.12, kind: 'clover', size: 0.012, petal: hex('#c979b0'), center: hex('#a0558d'), n: [0, 0] }
];
const pickSpecies = () => { let r = rnd(), acc = 0; for (const s of SPECIES) { acc += s.p; if (r <= acc) return s; } return SPECIES[0]; };

console.time('meadow');
const items = [];
const ROWS0 = HORIZON + 6, ROWS1 = H + 260;
for (let n = 0; n < 150000; n++) {
  const yRow = ROWS0 + Math.pow(rnd(), 0.7) * (ROWS1 - ROWS0);
  const Z = yRow < H ? rowToZ(yRow) : CAM_H / Math.tan(Math.atan((yRow - H / 2) / F) - PITCH);
  if (!isFinite(Z) || Z < 2.2 || Z > 380) continue;
  const X = (rnd() - 0.5) * 2 * Z * (W / 2 + 140) / F;
  const patch = fbm2(X * 0.05 + 9, Z * 0.05, 3) + 0.1;
  const isFlower = rnd() < 0.05 + clamp(patch) * 0.16;
  items.push({ X, Z, isFlower });
}
items.sort((a, b) => b.Z - a.Z);
const SUN_SIDE = Math.sign(SUN_DIR[0]);
for (const it of items) {
  const base = project(it.X, 0, it.Z);
  const pxPerM = F / it.Z;
  const fog = clamp(1 - Math.exp(-it.Z / 260));
  const hz = hazeCol(ray(base.x, Math.min(base.y, H - 1)));
  const tone = (c) => mix(c, hz, fog * 0.7);
  if (!it.isFlower) {
    const h = (0.18 + rnd() * 0.3) * pxPerM, lean = (rnd() - 0.5) * h * 0.5, w = Math.max(0.35, 0.0035 * pxPerM);
    if (h < 1.2) continue;
    const dark = mix(hex('#24521a'), hex('#3d6f22'), rnd());
    const tipLit = mix(hex('#8fbf4a'), hex('#c9d67a'), rnd() * (rnd() < 0.2 ? 1 : 0.3));
    blade(base.x, base.y, base.x + lean, base.y - h, base.x + lean * 0.15, base.y - h * 0.55, w, tone(dark), tone(tipLit), 0.95);
    continue;
  }
  const sp = pickSpecies();
  const stemH = (0.2 + rnd() * 0.3) * pxPerM;
  const r = sp.size * (0.8 + rnd() * 0.5) * pxPerM;
  if (r < 0.45) { /* too small to resolve: a speck of colour */ ellipse(base.x, base.y - stemH, 0.6, 0.5, 0, tone(sp.petal), 0.9); continue; }
  const lean = (rnd() - 0.5) * stemH * 0.25;
  blade(base.x, base.y, base.x + lean, base.y - stemH, base.x, base.y - stemH * 0.5, Math.max(0.35, 0.0022 * pxPerM), tone(hex('#2c5a1d')), tone(hex('#4d7a2a')), 0.95);
  const fx = base.x + lean, fy = base.y - stemH;
  const tilt = 0.45 + rnd() * 0.35; // seen from low: flattened
  const rot = (rnd() - 0.5) * 0.5;
  const lit = 1 + 0.25 * SUN_SIDE;
  const petal = tone(mul(sp.petal, 0.95 + rnd() * 0.1));
  const shade = tone(mul(sp.petal, 0.62));
  if (sp.kind === 'clover') {
    for (let k = 0; k < 14; k++) ellipse(fx + (rnd() - 0.5) * r * 1.4, fy + (rnd() - 0.5) * r * 1.2, r * 0.32, r * 0.32, 0, rnd() < 0.5 ? petal : shade, 0.95);
    continue;
  }
  const n = sp.n[0] + Math.floor(rnd() * (sp.n[1] - sp.n[0] + 1));
  const rot0 = rnd() * Math.PI;
  /* back petals shaded, front petals lit */
  const order = [...Array(n).keys()].map((k) => rot0 + (k / n) * Math.PI * 2).sort((a, b) => Math.sin(a) - Math.sin(b));
  for (const a of order) {
    const len = sp.kind === 'daisy' ? r : sp.kind === 'poppy' ? r * 0.8 : r * 0.75;
    const wid = sp.kind === 'daisy' ? r * 0.18 : sp.kind === 'poppy' ? r * 0.62 : r * 0.36;
    const cx = fx + Math.cos(a) * len * 0.55, cy = fy + Math.sin(a) * len * 0.55 * tilt;
    const facing = Math.sin(a) > 0 ? 1 : 0.8;
    const pc = mix(shade, petal, clamp(facing * lit * 0.85));
    ellipse(cx, cy, len * 0.55, wid, Math.atan2(Math.sin(a) * tilt, Math.cos(a)), pc, 0.97);
  }
  const cr = sp.kind === 'daisy' ? r * 0.3 : sp.kind === 'poppy' ? r * 0.26 : r * 0.28;
  ellipse(fx, fy, cr, cr * (0.6 + tilt * 0.4), 0, tone(sp.center), 1);
  ellipse(fx - cr * 0.25, fy - cr * 0.25, cr * 0.45, cr * 0.35, 0, tone(mul(sp.center, 1.35)), 0.6);
}
console.timeEnd('meadow');

/* ---------- lens: depth of field on the foreground ---------- */
console.time('lens');
function boxBlur(src, r) {
  const out = new Float32Array(src.length), tmp = new Float32Array(src.length);
  for (let pass = 0; pass < 2; pass++) {
    const a = pass === 0 ? src : tmp, b = pass === 0 ? tmp : out;
    for (let y = 0; y < H; y++) for (let c = 0; c < 3; c++) {
      let acc = 0, n = 0;
      for (let x = -r; x <= r; x++) if (x >= 0 && x < W) { acc += a[(y * W + x) * 3 + c]; n++; }
      for (let x = 0; x < W; x++) {
        b[(y * W + x) * 3 + c] = acc / n;
        const xo = x - r, xi = x + r + 1;
        if (xo >= 0) { acc -= a[(y * W + xo) * 3 + c]; n--; }
        if (xi < W) { acc += a[(y * W + xi) * 3 + c]; n++; }
      }
    }
    if (pass === 0) {
      /* transpose pass: vertical */
      for (let x = 0; x < W; x++) for (let c = 0; c < 3; c++) {
        let acc = 0, n = 0;
        for (let y = -r; y <= r; y++) if (y >= 0 && y < H) { acc += tmp[(y * W + x) * 3 + c]; n++; }
        for (let y = 0; y < H; y++) {
          out[(y * W + x) * 3 + c] = acc / n;
          const yo = y - r, yi = y + r + 1;
          if (yo >= 0) { acc -= tmp[(yo * W + x) * 3 + c]; n--; }
          if (yi < H) { acc += tmp[(yi * W + x) * 3 + c]; n++; }
        }
      }
      tmp.set(out);
      break;
    }
  }
  return out;
}
const b3 = boxBlur(boxBlur(img, 2), 2);
const b8 = boxBlur(boxBlur(img, 5), 5);
for (let y = 0; y < H; y++) {
  /* focus at ~12 m: the near meadow softens, the far field softens a touch */
  const Z = rowToZ(y);
  const blur = y < HORIZON ? 0 : Z < 12 ? clamp((12 - Z) / 7) : clamp((Z - 60) / 400) * 0.25;
  if (blur <= 0) continue;
  for (let x = 0; x < W; x++) {
    const o = (y * W + x) * 3;
    for (let c = 0; c < 3; c++) {
      const v = blur < 0.5 ? lerp(img[o + c], b3[o + c], blur * 2) : lerp(b3[o + c], b8[o + c], (blur - 0.5) * 2);
      img[o + c] = v;
    }
  }
}
console.timeEnd('lens');

/* ---------- night: stars, milky way, moon; the same meadow in moonlight ---------- */
const MOON = { x: SUN_PX.x, y: SUN_PX.y + 30, r: 46 };
function nightPlate() {
  const sky = new Float32Array(W * H * 3);
  const TOP = hex('#02050e'), MIDN = hex('#081430'), LOW = hex('#1a2c52');
  for (let y = 0; y < H; y++) {
    const t = clamp(y / HORIZON);
    const base = t < 0.6 ? mix(TOP, MIDN, t / 0.6) : mix(MIDN, LOW, Math.pow((t - 0.6) / 0.4, 1.4));
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      const u = (x / W) - (y / H) * 0.9 + 0.1;
      const band = Math.exp(-Math.pow((u - 0.35) / 0.12, 2));
      const dust = fbm2(x * 0.004, y * 0.004, 6) * 0.5 + 0.5;
      const lane = clamp(fbm2(x * 0.009 + 5, y * 0.009, 5) * 1.6 + 0.3);
      const mw = band * dust * lane * 0.06 * clamp(1 - t * 0.9);
      const d = Math.hypot(x - MOON.x, y - MOON.y) / W;
      const halo = Math.exp(-d * 14) * 0.16 + Math.exp(-d * 60) * 0.22;
      sky[i] = base[0] + mw * 0.9 + halo * 0.8; sky[i + 1] = base[1] + mw * 0.85 + halo * 0.85; sky[i + 2] = base[2] + mw * 1.1 + halo;
    }
  }
  const star = (cx, cy, r, col, a) => {
    for (let y = Math.max(0, Math.floor(cy - r - 2)); y <= Math.min(H - 1, cy + r + 2); y++) for (let x = Math.max(0, Math.floor(cx - r - 2)); x <= Math.min(W - 1, cx + r + 2); x++) {
      const k = a * Math.exp(-Math.pow(Math.hypot(x - cx, y - cy) / Math.max(0.45, r), 2));
      const i = (y * W + x) * 3; sky[i] += col[0] * k; sky[i + 1] += col[1] * k; sky[i + 2] += col[2] * k;
    }
  };
  const COLS = [[1, 1, 1], [0.8, 0.88, 1], [1, 0.9, 0.78], [0.75, 0.8, 1]];
  for (let n = 0; n < 11000; n++) {
    const x = rnd() * W, y = Math.pow(rnd(), 0.8) * (HORIZON - 6);
    const u = x / W - (y / H) * 0.9 + 0.1, inBand = Math.exp(-Math.pow((u - 0.35) / 0.12, 2));
    if (rnd() > 0.35 + inBand * 0.65) continue;
    const m = Math.pow(rnd(), 7);
    star(x, y, 0.5 + m * 1.5, COLS[Math.floor(rnd() * 4)], (0.22 + m * 3) * clamp((HORIZON - y) / 160));
  }
  for (let y = Math.floor(MOON.y - MOON.r - 2); y <= MOON.y + MOON.r + 2; y++) for (let x = Math.floor(MOON.x - MOON.r - 2); x <= MOON.x + MOON.r + 2; x++) {
    const dx = (x - MOON.x) / MOON.r, dy = (y - MOON.y) / MOON.r, rr = Math.hypot(dx, dy);
    const a = clamp((1 - rr) * MOON.r * 0.9);
    if (a <= 0) continue;
    const maria = clamp(fbm2(dx * 2.2 + 3, dy * 2.2 + 1, 4) * 1.8 + 0.1);
    const crater = Math.abs(noise2(dx * 9, dy * 9)) * 0.22;
    const limb = 0.72 + 0.28 * Math.sqrt(clamp(1 - rr * rr));
    const v = (1.25 - maria * 0.38 - crater) * limb;
    const i = (y * W + x) * 3;
    sky[i] = lerp(sky[i], v, a); sky[i + 1] = lerp(sky[i + 1], v * 0.98, a); sky[i + 2] = lerp(sky[i + 2], v * 0.92, a);
  }
  /* the land, moonlit: cool, dim, the whites of the petals still read */
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const a = land[y * W + x];
    if (a <= 0) continue;
    const i = (y * W + x) * 3;
    const c = [img[i], img[i + 1], img[i + 2]];
    const lum = c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
    const g = clamp((y - HORIZON) / (H - HORIZON));
    const k = 0.09 + g * 0.07;
    const m = [lerp(lum, c[0], 0.3) * k * 0.62, lerp(lum, c[1], 0.3) * k * 0.82, lerp(lum, c[2], 0.3) * k * 1.35 + 0.003];
    for (let q = 0; q < 3; q++) sky[i + q] = lerp(sky[i + q], m[q], a);
  }
  return sky;
}

/* ---------- finish ---------- */
const aces = (x) => clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14));
function bloomOf(buf, thr) {
  const b = new Float32Array(buf.length);
  for (let i = 0; i < buf.length; i++) b[i] = Math.max(0, buf[i] - thr);
  return boxBlur(boxBlur(boxBlur(b, 12), 12), 12);
}
function encode(buf, file, exposure, bloomAmt, warm) {
  const bl = bloomOf(buf, 1.1);
  const out = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3, o = (y * W + x) * 4;
    const vx = x / W - 0.5, vy = y / H - 0.45;
    const vig = 1 - clamp(Math.hypot(vx * 1.05, vy) - 0.32) * 0.6;
    const grain = (rnd() - 0.5) * 0.02;
    for (let k = 0; k < 3; k++) {
      let v = (buf[i + k] + bl[i + k] * bloomAmt) * exposure * vig * warm[k];
      v = Math.pow(aces(v), 1 / 2.2);
      /* a gentle S-curve for photographic contrast */
      v = v + 0.08 * Math.sin((v - 0.5) * Math.PI) * 0.5;
      out[o + k] = Math.round(clamp(v + grain) * 255);
    }
    out[o + 3] = 255;
  }
  fs.writeFileSync(file, jpeg.encode({ data: out, width: W, height: H }, 86).data);
  console.log(`wrote ${file} (${(fs.statSync(file).size / 1024).toFixed(0)} KB)`);
}

const dir = path.join(__dirname, '..', 'public', 'art');
encode(img, path.join(dir, 'scene-day.jpg'), 1.02, 0.22, [1.02, 1.0, 0.97]);
console.time('night');
const night = nightPlate();
console.timeEnd('night');
encode(night, path.join(dir, 'scene-night.jpg'), 1.15, 0.5, [0.98, 1.0, 1.04]);
