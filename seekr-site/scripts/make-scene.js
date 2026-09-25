/* Renders public/art/scene.jpg: a photographic blue sky with sunlit cumulus
 * over a meadow of flowers, seen from knee height. Pure JS, per-pixel:
 *   sky     — Rayleigh-ish gradient with a sun glow
 *   clouds  — domain-warped fBm on a perspective cloud plane, lit toward the sun
 *   land    — hazed tree line and hills, then a perspective ground plane
 *   meadow  — grass texture, flowers projected from the ground plane, the near
 *             ones blurred like a shallow depth of field
 *   finish  — filmic tone curve, vignette, fine grain
 * Seeded, so the output is stable. Run with `npm run art`. */
const fs = require('fs');
const path = require('path');
const jpeg = require('jpeg-js');

const W = 2400, H = 1400;
const HORIZON = Math.round(H * 0.6);
const SUN = { x: W * 0.8, y: H * 0.14 };

/* ---------- noise ---------- */
let seed = 1337;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const perm = new Uint8Array(512);
{ const p = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) perm[i] = p[i & 255]; }
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;
function grad(h, x, y) { switch (h & 7) { case 0: return x + y; case 1: return -x + y; case 2: return x - y; case 3: return -x - y; case 4: return x; case 5: return -x; case 6: return y; default: return -y; } }
function noise(x, y) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
  x -= Math.floor(x); y -= Math.floor(y);
  const u = fade(x), v = fade(y);
  const a = perm[X] + Y, b = perm[X + 1] + Y;
  return lerp(lerp(grad(perm[a], x, y), grad(perm[b], x - 1, y), u), lerp(grad(perm[a + 1], x, y - 1), grad(perm[b + 1], x - 1, y - 1), u), v);
}
function fbm(x, y, oct = 6) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { s += a * noise(x * f, y * f); f *= 2.03; a *= 0.5; } return s; }

const img = new Float32Array(W * H * 3);
const land = new Float32Array(W * H); // 1 where the ground is, for the night pass
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const srgbToLin = (c) => c.map((v) => Math.pow(v, 2.2));

/* ---------- sky + clouds ---------- */
const ZENITH = srgbToLin(hex('#1f5fcf'));
const MID = srgbToLin(hex('#4f93e8'));
const HAZE = srgbToLin(hex('#bfdcf7'));
const SUNCOL = [1.0, 0.96, 0.86];
const CLOUD_LIT = [1.05, 1.03, 1.0];
const CLOUD_SHADE = srgbToLin(hex('#8b9db8'));
const CLOUD_BASE = srgbToLin(hex('#a9b8cc'));

function cloudDensity(px, pz) {
  const wx = fbm(px * 0.6 + 3.1, pz * 0.6 + 7.7, 4) * 1.2;
  const wz = fbm(px * 0.6 - 5.2, pz * 0.6 + 1.3, 4) * 1.2;
  const n = fbm((px + wx) * 0.55, (pz + wz) * 0.8, 7);
  const coverage = 0.02 + 0.09 * Math.sin(px * 0.25 + 1.0);
  return clamp((n - coverage) * 5.5);
}

console.time('sky');
for (let y = 0; y < HORIZON; y++) {
  const t = y / HORIZON;
  let base = t < 0.55 ? mix3(ZENITH, MID, t / 0.55) : mix3(MID, HAZE, Math.pow((t - 0.55) / 0.45, 1.6));
  const depth = 1 / Math.max(0.018, (HORIZON - y) / HORIZON); // perspective: 1 overhead → large at the horizon
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3;
    const dx = (x - SUN.x) / W, dy = (y - SUN.y) / W;
    const d = Math.sqrt(dx * dx + dy * dy);
    const glow = Math.exp(-d * 9) * 0.55 + Math.exp(-d * 40) * 0.9 + Math.exp(-d * 180) * 3;
    let c = [base[0] + SUNCOL[0] * glow, base[1] + SUNCOL[1] * glow * 0.97, base[2] + SUNCOL[2] * glow * 0.9];

    /* cloud plane */
    const pz = depth * 1.2;
    const px = ((x - W * 0.5) / W) * depth * 2.4;
    const den = cloudDensity(px * 1.1, pz * 0.9) * clamp((depth - 1.05) / 0.4) * clamp(1 - (depth - 14) / 20);
    if (den > 0.001) {
      /* light: density a step toward the sun, and ambient from above */
      const sx = ((SUN.x - x) / W) * 0.18, sz = -0.12;
      const occl = cloudDensity(px * 1.1 + sx, pz * 0.9 + sz);
      const lit = clamp(1 - occl * 1.1 + 0.25);
      const edge = Math.pow(1 - den, 3); // thin edges catch the sun (silver lining)
      let cc = mix3(CLOUD_SHADE, CLOUD_LIT, lit);
      cc = mix3(cc, CLOUD_BASE, clamp((den - 0.6) * 0.8) * (1 - lit) * 0.6);
      const rim = edge * Math.exp(-d * 6) * 0.8;
      cc = [cc[0] + rim, cc[1] + rim * 0.97, cc[2] + rim * 0.9];
      /* aerial perspective: far clouds melt into the haze */
      const far = clamp((depth - 3) / 14);
      cc = mix3(cc, base, far * 0.55);
      const a = clamp(den * 1.6) * (1 - far * 0.35);
      c = mix3(c, cc, a);
    }
    img[i] = c[0]; img[i + 1] = c[1]; img[i + 2] = c[2];
  }
}
console.timeEnd('sky');

/* ---------- land: tree line, hills, meadow ---------- */
const FAR_GREEN = srgbToLin(hex('#6f9a6a'));
const MID_GREEN = srgbToLin(hex('#6a9a3c'));
const NEAR_GREEN = srgbToLin(hex('#2f6a1e'));
const DRY = srgbToLin(hex('#a6b24a'));
const TREE = srgbToLin(hex('#2f4f3a'));
const hazeAt = (y) => srgbToLin(hex('#c4def5'));

const treeTop = new Float32Array(W), hillA = new Float32Array(W), hillB = new Float32Array(W);
for (let x = 0; x < W; x++) {
  const u = x / W;
  treeTop[x] = HORIZON - 14 - 26 * (fbm(u * 18, 1.7, 5) * 0.5 + 0.5) - 30 * Math.max(0, fbm(u * 3, 9.1, 3));
  hillA[x] = HORIZON + 6 + 40 * fbm(u * 2.2, 4.4, 4) - 30 * Math.sin(u * Math.PI * 1.3 + 0.4);
  hillB[x] = HORIZON + 70 + 60 * fbm(u * 1.6 + 10, 2.2, 4) - 45 * Math.sin(u * Math.PI * 0.9 + 1.9);
}

console.time('land');
for (let y = HORIZON - 90; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3;
    const sky = [img[i], img[i + 1], img[i + 2]];
    let c = null;
    if (y >= treeTop[x] && y < hillA[x]) {
      const tex = fbm(x * 0.03, y * 0.05, 4) * 0.5 + 0.5;
      c = mix3(TREE, FAR_GREEN, tex * 0.5);
      c = mix3(c, hazeAt(y), 0.38);
    }
    if (y >= hillA[x]) {
      const tex = fbm(x * 0.01, y * 0.02, 5) * 0.5 + 0.5;
      c = mix3(FAR_GREEN, MID_GREEN, tex);
      c = mix3(c, DRY, clamp(fbm(x * 0.004, y * 0.01, 3) + 0.2) * 0.35);
      c = mix3(c, hazeAt(y), clamp(0.32 - (y - HORIZON) / 300));
    }
    if (y >= hillB[x]) {
      /* the meadow: a ground plane seen in perspective */
      const g = (y - HORIZON + 30) / (H - HORIZON + 30);
      const depth = 1 / Math.max(0.05, g);
      const gx = ((x - W / 2) / W) * depth * 6, gz = depth * 3;
      const coarse = fbm(gx * 0.8, gz * 0.8, 5) * 0.5 + 0.5;
      const fine = noise(gx * 30, gz * 30) * 0.5 + 0.5;
      const blade = Math.pow(Math.abs(noise(x * 0.9 / Math.max(1, depth * 0.35), y * 0.08)), 0.6);
      c = mix3(MID_GREEN, NEAR_GREEN, clamp(g * 1.2));
      c = mix3(c, DRY, clamp(coarse - 0.45) * 0.9);
      const shade = 0.6 + 0.4 * fine * (0.55 + 0.45 * blade) + (coarse - 0.5) * 0.45;
      c = c.map((v) => v * shade);
      /* sunlight rakes the far field */
      c = c.map((v, k) => v * (1 + 0.25 * (1 - g) * [1, 0.95, 0.8][k]));
      c = mix3(c, hazeAt(y), clamp(0.35 - g * 0.9));
    }
    if (c) {
      /* anti-alias the silhouettes */
      const e = Math.min(Math.abs(y - treeTop[x]), 1.5) / 1.5;
      const inside = y >= treeTop[x];
      const a = inside ? (y - treeTop[x] < 1 ? e : 1) : 0;
      land[y * W + x] = a;
      const out = mix3(sky, c, a);
      img[i] = out[0]; img[i + 1] = out[1]; img[i + 2] = out[2];
    }
  }
}
console.timeEnd('land');

/* ---------- sprites: grass blades and flowers ---------- */
function disc(cx, cy, r, col, alpha, soft) {
  const s = Math.max(0.6, soft);
  const x0 = Math.max(0, Math.floor(cx - r - s)), x1 = Math.min(W - 1, Math.ceil(cx + r + s));
  const y0 = Math.max(0, Math.floor(cy - r - s)), y1 = Math.min(H - 1, Math.ceil(cy + r + s));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const d = Math.hypot(x - cx, y - cy);
    const a = alpha * clamp((r + s * 0.5 - d) / s);
    if (a <= 0) continue;
    const i = (y * W + x) * 3;
    img[i] = lerp(img[i], col[0], a); img[i + 1] = lerp(img[i + 1], col[1], a); img[i + 2] = lerp(img[i + 2], col[2], a);
  }
}
function stroke(x0, y0, x1, y1, xc, yc, w0, w1, col, alpha, soft) {
  const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.8);
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * xc + t * t * x1;
    const y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * yc + t * t * y1;
    disc(x, y, lerp(w0, w1, t) / 2, col, alpha, soft);
  }
}

const PETALS = [['#ffffff', 0.34], ['#fff3a8', 0.14], ['#ffd23f', 0.16], ['#f7a8c4', 0.12], ['#c9a8f2', 0.1], ['#ff8f6b', 0.06], ['#8fb8ff', 0.08]];
const pickPetal = () => { let r = rnd(), acc = 0; for (const [c, p] of PETALS) { acc += p; if (r <= acc) return srgbToLin(hex(c)); } return srgbToLin(hex('#ffffff')); };

console.time('meadow');
const items = [];
/* scatter in ground space so density falls off with distance naturally */
for (let n = 0; n < 26000; n++) {
  const g = Math.pow(rnd(), 1.35);                // 0 far … 1 near
  const y = HORIZON + 80 + g * (H - HORIZON - 40);
  if (y > H + 40) continue;
  const clump = fbm(n * 0.013, 3.3, 3);
  const x = rnd() * (W + 200) - 100;
  if (rnd() > 0.55 + clump) continue;
  items.push({ x, y, g, kind: rnd() < 0.3 ? 'flower' : 'blade' });
}
items.sort((a, b) => a.y - b.y);
for (const it of items) {
  const s = 0.4 + it.g * it.g * 9;              // size with nearness
  const blur = it.g > 0.82 ? (it.g - 0.82) * 40 : it.g < 0.12 ? 0.8 : 0.6; // shallow depth of field up close
  if (it.kind === 'blade') {
    const h = s * (5 + rnd() * 6), lean = (rnd() - 0.5) * h * 0.6;
    const col = mix3(NEAR_GREEN, rnd() < 0.3 ? DRY : srgbToLin(hex('#6fae3c')), rnd() * 0.7).map((v) => v * (0.8 + rnd() * 0.5));
    stroke(it.x, it.y, it.x + lean, it.y - h, it.x + lean * 0.2, it.y - h * 0.6, Math.max(0.6, s * 0.55), 0.3, col, 0.9, blur);
  } else {
    const col = pickPetal();
    const stem = s * (3 + rnd() * 5);
    stroke(it.x, it.y, it.x + (rnd() - 0.5) * stem * 0.3, it.y - stem, it.x, it.y - stem * 0.5, Math.max(0.5, s * 0.25), Math.max(0.4, s * 0.18), NEAR_GREEN.map((v) => v * 0.9), 0.9, blur);
    const fx = it.x + (rnd() - 0.5) * stem * 0.3, fy = it.y - stem;
    const r = s * (0.9 + rnd() * 0.7);
    if (r < 1.3) { disc(fx, fy, Math.max(0.6, r), col, 0.95, blur); continue; }
    const np = 5 + Math.floor(rnd() * 3), rot = rnd() * Math.PI;
    const shaded = col.map((v) => v * 0.78);
    for (let k = 0; k < np; k++) {
      const a = rot + (k / np) * Math.PI * 2;
      disc(fx + Math.cos(a) * r * 0.75, fy + Math.sin(a) * r * 0.55, r * 0.62, k % 2 ? shaded : col, 0.95, blur);
    }
    disc(fx, fy, r * 0.38, srgbToLin(hex('#e8b400')), 1, blur);
    /* the sun catches the top petals */
    disc(fx - r * 0.2, fy - r * 0.3, r * 0.3, col.map((v) => Math.min(1.2, v * 1.25)), 0.35, blur + 1);
  }
}
console.timeEnd('meadow');

/* ---------- night: stars, milky way, moon; the same meadow under moonlight ---------- */
const MOON = { x: SUN.x, y: SUN.y + 20, r: 58 };
function nightSky() {
  const sky = new Float32Array(W * H * 3);
  const TOP = srgbToLin(hex('#030712')), MIDN = srgbToLin(hex('#0a1733')), LOW = srgbToLin(hex('#1c3057'));
  for (let y = 0; y < H; y++) {
    const t = clamp(y / HORIZON);
    const base = t < 0.6 ? mix3(TOP, MIDN, t / 0.6) : mix3(MIDN, LOW, Math.pow((t - 0.6) / 0.4, 1.4));
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      /* the milky way: a soft diagonal band with dust lanes */
      const u = (x / W) * 1.0 - (y / H) * 0.9 + 0.1;
      const band = Math.exp(-Math.pow((u - 0.35) / 0.12, 2));
      const dust = fbm(x * 0.004, y * 0.004, 6) * 0.5 + 0.5;
      const lane = clamp(fbm(x * 0.009 + 5, y * 0.009, 5) * 1.6 + 0.3);
      const mw = band * dust * lane * 0.07 * clamp(1 - t * 0.9);
      const dx = (x - MOON.x) / W, dy = (y - MOON.y) / W, d = Math.hypot(dx, dy);
      const halo = Math.exp(-d * 14) * 0.18 + Math.exp(-d * 60) * 0.25;
      sky[i] = base[0] + mw * 0.9 + halo * 0.8;
      sky[i + 1] = base[1] + mw * 0.85 + halo * 0.85;
      sky[i + 2] = base[2] + mw * 1.1 + halo * 1.0;
    }
  }
  const put = (cx, cy, r, col, a) => {
    for (let y = Math.max(0, Math.floor(cy - r - 2)); y <= Math.min(H - 1, cy + r + 2); y++) for (let x = Math.max(0, Math.floor(cx - r - 2)); x <= Math.min(W - 1, cx + r + 2); x++) {
      const k = a * Math.exp(-Math.pow(Math.hypot(x - cx, y - cy) / Math.max(0.45, r), 2));
      const i = (y * W + x) * 3; sky[i] += col[0] * k; sky[i + 1] += col[1] * k; sky[i + 2] += col[2] * k;
    }
  };
  /* stars: many faint, a few bright, denser along the milky way */
  const STAR = [[1, 1, 1], [0.8, 0.88, 1], [1, 0.92, 0.8], [0.75, 0.8, 1]];
  for (let n = 0; n < 9000; n++) {
    const x = rnd() * W, y = Math.pow(rnd(), 0.8) * (HORIZON - 10);
    const u = (x / W) - (y / H) * 0.9 + 0.1;
    const inBand = Math.exp(-Math.pow((u - 0.35) / 0.12, 2));
    if (rnd() > 0.35 + inBand * 0.65) continue;
    const m = Math.pow(rnd(), 7);
    const fadeLow = clamp((HORIZON - y) / 180);
    put(x, y, 0.55 + m * 1.6, STAR[Math.floor(rnd() * 4)], (0.25 + m * 3.2) * fadeLow);
  }
  /* the moon: a lit disc with maria and craters, soft limb */
  for (let y = Math.floor(MOON.y - MOON.r - 2); y <= MOON.y + MOON.r + 2; y++) for (let x = Math.floor(MOON.x - MOON.r - 2); x <= MOON.x + MOON.r + 2; x++) {
    const dx = (x - MOON.x) / MOON.r, dy = (y - MOON.y) / MOON.r, rr = Math.hypot(dx, dy);
    const a = clamp((1 - rr) * MOON.r * 0.9);
    if (a <= 0) continue;
    const maria = clamp(fbm(dx * 2.2 + 3, dy * 2.2 + 1, 4) * 1.8 + 0.1);
    const crater = Math.abs(noise(dx * 9, dy * 9)) * 0.25;
    const limb = 0.72 + 0.28 * Math.sqrt(clamp(1 - rr * rr));
    const v = (1.25 - maria * 0.38 - crater) * limb;
    const i = (y * W + x) * 3;
    sky[i] = lerp(sky[i], v * 1.0, a); sky[i + 1] = lerp(sky[i + 1], v * 0.98, a); sky[i + 2] = lerp(sky[i + 2], v * 0.92, a);
  }
  return sky;
}

/* moonlight on the day render: cool, dim, the whites of the petals still read */
function moonlit(c, y) {
  const lum = c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
  const g = clamp((y - HORIZON) / (H - HORIZON));
  const k = 0.1 + g * 0.08;
  const chroma = 0.3;
  return [lerp(lum, c[0], chroma) * k * 0.62, lerp(lum, c[1], chroma) * k * 0.82, lerp(lum, c[2], chroma) * k * 1.35 + 0.004];
}

/* ---------- finish: tone curve, vignette, grain, encode ---------- */
const aces = (x) => clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14));
function encode(buf, file, exposure) {
  const out = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3, o = (y * W + x) * 4;
    const vx = (x / W - 0.55), vy = (y / H - 0.45);
    const vig = 1 - clamp(Math.hypot(vx * 1.1, vy) - 0.35) * 0.55;
    const grain = (rnd() - 0.5) * 0.018;
    for (let k = 0; k < 3; k++) out[o + k] = Math.round(clamp(Math.pow(aces(buf[i + k] * exposure * vig), 1 / 2.2) + grain) * 255);
    out[o + 3] = 255;
  }
  fs.writeFileSync(file, jpeg.encode({ data: out, width: W, height: H }, 84).data);
  console.log(`wrote ${file} (${(fs.statSync(file).size / 1024).toFixed(0)} KB)`);
}

const dir = path.join(__dirname, '..', 'public', 'art');
encode(img, path.join(dir, 'scene-day.jpg'), 1.08);

console.time('night');
const night = nightSky();
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const a = land[y * W + x];
  if (a <= 0) continue;
  const i = (y * W + x) * 3;
  const m = moonlit([img[i], img[i + 1], img[i + 2]], y);
  for (let k = 0; k < 3; k++) night[i + k] = lerp(night[i + k], m[k], a);
}
console.timeEnd('night');
encode(night, path.join(dir, 'scene-night.jpg'), 1.15);
