/* GLSL for the space sky. Written for this project. */

const NOISE = `
float hash(vec2 p) {
  p = fract(p * vec2(233.34, 851.73));
  p += dot(p, p + 23.45);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
const mat2 ROT = mat2(1.62, 1.18, -1.18, 1.62);
float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    s += a * noise(p);
    p = ROT * p + vec2(3.7, 11.1);
    a *= 0.5;
  }
  return s;
}
float fbm3(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    s += a * noise(p);
    p = ROT * p + vec2(3.7, 11.1);
    a *= 0.5;
  }
  return s;
}`;

/** Deep space: layered starfields that twinkle, a band of galaxy with dark dust
 *  lanes, drifting coloured nebulae and a small spiral galaxy far off. Shooting stars
 *  brighten the nebula they cross (uFlash). The planet is drawn over it by PLANET_FS. */
export const SKY_FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform float uTime;
uniform float uAspect;
uniform vec3 uFlash;   // xy: where a shooting star is (uv, y up), z: brightness
${NOISE}

// one layer of stars: a random point per grid cell, sized and coloured by chance
vec3 stars(vec2 p, float scale, float density, float t, float seed) {
  vec2 g = p * scale;
  vec2 cell = floor(g);
  vec2 f = fract(g) - 0.5;
  float rnd = hash(cell + seed);
  if (rnd > density) return vec3(0.0);
  vec2 off = vec2(hash(cell + seed + 1.7), hash(cell + seed + 9.1)) - 0.5;
  vec2 d = f - off * 0.8;
  float r = length(d);
  float mag = pow(hash(cell + seed + 4.4), 6.0);
  float size = 0.035 + mag * 0.09;
  float tw = 0.65 + 0.35 * sin(t * (1.2 + rnd * 3.0) + rnd * 40.0);
  float core = exp(-r * r / (size * size * 0.35));
  float spikes = mag > 0.35 ? (exp(-abs(d.x) * 60.0) * exp(-abs(d.y) * 7.0) + exp(-abs(d.y) * 60.0) * exp(-abs(d.x) * 7.0)) * mag : 0.0;
  float temp = hash(cell + seed + 2.9);
  vec3 tint = temp < 0.3 ? vec3(1.0, 0.82, 0.62) : temp < 0.75 ? vec3(0.92, 0.95, 1.0) : vec3(0.66, 0.78, 1.0);
  return tint * (core + spikes * 0.6) * (0.35 + mag * 1.8) * tw;
}

void main() {
  vec2 uv = vUv;
  vec2 p = vec2(uv.x * uAspect, uv.y);
  float t = uTime;

  // the void, faintly blue at the top and violet toward the bottom
  vec3 col = mix(vec3(0.012, 0.01, 0.03), vec3(0.01, 0.018, 0.045), uv.y);

  // nebulae: domain-warped clouds of glowing gas in three hues
  vec2 q = p * 1.3 + vec2(t * 0.004, t * 0.002);
  vec2 w = vec2(fbm3(q + vec2(1.7, 9.2)), fbm3(q + vec2(8.3, 2.8)));
  float n1 = fbm(q + 1.8 * w);
  float n2 = fbm(q * 1.7 - 1.2 * w + 4.0);
  float mask1 = smoothstep(0.45, 0.85, n1);
  float mask2 = smoothstep(0.5, 0.9, n2);
  col += vec3(0.42, 0.1, 0.5) * mask1 * 0.55;           // magenta-violet
  col += vec3(0.05, 0.28, 0.45) * mask2 * 0.5;          // teal-blue
  col += vec3(0.55, 0.3, 0.08) * mask1 * mask2 * 0.45;  // warm where they meet
  // dark dust eating into the gas
  float dust = smoothstep(0.55, 0.75, fbm3(q * 2.3 + w * 1.4 + 11.0));
  col *= 1.0 - dust * 0.55;

  // the galaxy band, running corner to corner, with dust lanes down its middle
  vec2 bp = p - vec2(0.5 * uAspect, 0.5);
  float ang = 0.55;
  float across = bp.x * sin(ang) - bp.y * cos(ang);
  float along = bp.x * cos(ang) + bp.y * sin(ang);
  float band = exp(-across * across * 14.0);
  float lane = smoothstep(0.35, 0.7, fbm(vec2(along * 2.5, across * 9.0) + 3.0)) * exp(-across * across * 60.0);
  vec3 bandCol = mix(vec3(0.5, 0.45, 0.6), vec3(0.75, 0.62, 0.48), fbm3(vec2(along * 3.0, 1.0)));
  col += bandCol * band * 0.16 * (0.6 + 0.8 * fbm3(vec2(along * 6.0, across * 12.0)));
  col *= 1.0 - lane * 0.6;

  // starfields: many faint ones, fewer bright ones, extra dense along the band
  col += stars(p, 180.0, 0.55 + band * 0.4, t, 1.0) * 0.55;
  col += stars(p, 90.0, 0.35, t, 7.0) * 0.8;
  col += stars(p, 38.0, 0.22, t * 0.7, 13.0) * 1.1;
  col += stars(p, 14.0, 0.18, t * 0.5, 29.0) * 1.3;

  // a small spiral galaxy far away
  vec2 gp = (p - vec2(0.82 * uAspect, 0.78)) * vec2(1.0, 1.9);
  gp = mat2(0.87, -0.5, 0.5, 0.87) * gp;
  float gr = length(gp);
  float ga = atan(gp.y, gp.x);
  float arms = 0.5 + 0.5 * sin(ga * 2.0 - log(gr + 0.001) * 5.0 + t * 0.02);
  float gal = exp(-gr * 26.0) * (0.35 + 0.65 * arms) + exp(-gr * gr * 2200.0) * 1.4;
  col += vec3(0.85, 0.8, 1.0) * gal * 0.55;

  // a shooting star lights up the gas it passes
  vec2 fp = vec2(uFlash.x * uAspect, uFlash.y);
  float fr = length(p - fp);
  col += vec3(0.6, 0.7, 1.0) * uFlash.z * exp(-fr * 6.0) * (0.15 + mask1 + mask2) * 0.35;

  o = vec4(col, 1.0);
}`;

export const BLIT_FS = `#version 300 es
precision mediump float;
in vec2 vUv;
out vec4 o;
uniform sampler2D uTex;
void main() { o = vec4(texture(uTex, vUv).rgb, 1.0); }`;

/** The currency stars, drawn like real ones: an over-exposed white core, a soft halo
 *  and wide bloom in the star's colour, four long diffraction spikes that shimmer and
 *  fringe into colour toward their ends, and the currency's sign written small beside
 *  it, like a label on a star chart. Drawn additively. Also used for satellite glints
 *  and the beacon (no label). */
export const DROP_VS = `#version 300 es
in vec2 aCorner;       // -1..1
in vec4 aPos;          // x, y (px, y down), radius px, alpha
in vec4 aMisc;         // glyph index, charge, twinkle 0..1, label half-size in radii (0: none)
in vec3 aTint;
uniform vec2 uRes;
out vec2 vLocal;
out vec3 vTint;
out float vAlpha;
out float vGlyph;
out float vCharge;
out float vPulse;
out float vLabel;
void main() {
  vec2 local = aCorner * 6.0;
  vec2 px = aPos.xy + vec2(local.x, -local.y) * aPos.z;
  vLocal = local;
  vTint = aTint;
  vAlpha = aPos.w;
  vGlyph = aMisc.x;
  vCharge = aMisc.y;
  vPulse = aMisc.z;
  vLabel = aMisc.w;
  gl_Position = vec4(px.x / uRes.x * 2.0 - 1.0, 1.0 - px.y / uRes.y * 2.0, 0.0, 1.0);
}`;

export const DROP_FS = `#version 300 es
precision highp float;
in vec2 vLocal;
in vec3 vTint;
in float vAlpha;
in float vGlyph;
in float vCharge;
in float vPulse;
in float vLabel;
out vec4 o;
uniform sampler2D uAtlas;
void main() {
  vec2 p = vLocal;
  float r2 = dot(p, p);
  float r = sqrt(r2);
  float k = 1.0 + vCharge * 0.9;
  vec3 hue = mix(vTint, vec3(1.0), 0.4);
  float core = exp(-r2 * 7.0) * (1.2 + 0.4 * vPulse);
  float halo = exp(-r * 1.9) * 0.5;
  float bloom = 0.09 / (1.0 + r2 * 0.8);
  // spikes: thin, long, a little longer when the star flares
  float decay = (0.46 - 0.12 * vPulse) / k;
  float sx = exp(-abs(p.y) * 24.0 / (1.0 + abs(p.x) * 0.12)) * exp(-abs(p.x) * decay);
  float sy = exp(-abs(p.x) * 24.0 / (1.0 + abs(p.y) * 0.12)) * exp(-abs(p.y) * decay);
  float along = max(abs(p.x), abs(p.y));
  vec3 fringe = 0.55 + 0.45 * cos(6.2832 * (along * 0.2 + vec3(0.0, 0.33, 0.67)));
  vec3 spikeC = mix(vec3(1.0), fringe * hue * 1.25, smoothstep(0.8, 3.8, along) * 0.65);
  vec3 col = vec3(1.0) * core * k + hue * (halo + bloom) * k + spikeC * (sx + sy) * 0.8 * k;
  col *= smoothstep(6.0, 4.6, r);
  if (vLabel > 0.0) {
    vec2 lp = (p - vec2(1.55, -1.55)) / vLabel;
    if (max(abs(lp.x), abs(lp.y)) < 1.0) {
      vec2 guv = lp * 0.5 + 0.5;
      vec2 cell = vec2(mod(vGlyph, 16.0), floor(vGlyph / 16.0));
      float g = texture(uAtlas, (cell + vec2(guv.x, 1.0 - guv.y)) / 16.0).a;
      col += vec3(0.86, 0.9, 1.0) * g * 0.7;
    }
  }
  o = vec4(col * vAlpha, 0.0);
}`;

/** Sparkles and shockwave rings. */
export const PART_VS = `#version 300 es
in vec2 aCorner;
in vec4 aP;     // x, y, size, alpha
in vec4 aQ;     // type (0 sparkle, 1 flare), tint rgb
uniform vec2 uRes;
out vec2 vLocal;
out float vType;
out vec3 vTint;
out float vAlpha;
void main() {
  vec2 ext = vec2(aP.z);
  vec2 px = aP.xy + aCorner * ext;
  vLocal = aCorner;
  vType = aQ.x;
  vTint = aQ.yzw;
  vAlpha = aP.w;
  gl_Position = vec4(px.x / uRes.x * 2.0 - 1.0, 1.0 - px.y / uRes.y * 2.0, 0.0, 1.0);
}`;

export const PART_FS = `#version 300 es
precision mediump float;
in vec2 vLocal;
in float vType;
in vec3 vTint;
in float vAlpha;
out vec4 o;
uniform float uFlash;
void main() {
  float r = length(vLocal);
  float a;
  vec3 c;
  if (vType < 0.5) {
    a = smoothstep(1.0, 0.45, r);
    float glint = smoothstep(0.55, 0.0, length(vLocal - vec2(-0.35, 0.35)));
    c = mix(vec3(1.0), vTint, 0.45) * 1.2 + glint * 0.4;
  } else {
    // a flare: the star's light swelling into a soft glow, white at the heart
    a = (exp(-r * r * 6.0) * 0.8 + exp(-r * 3.2) * 0.3) * smoothstep(1.0, 0.72, r);
    c = mix(vTint, vec3(1.0), exp(-r * r * 14.0) * 0.8);
  }
  c += vec3(0.8, 0.85, 1.0) * uFlash * 0.6;
  a *= vAlpha;
  o = vec4(c * a, a);
}`;

/** Shooting stars: strips with a gaussian profile and a fading tail, drawn additively. */
export const BOLT_VS = `#version 300 es
in vec2 aPos;
in vec2 aNormal;
in vec4 aInfo;   // side, width, brightness, t along the bolt
uniform vec2 uRes;
uniform float uWidthScale;
out float vAcross;
out float vBright;
out float vT;
void main() {
  vec2 px = aPos + aNormal * aInfo.x * aInfo.y * uWidthScale;
  vAcross = aInfo.x;
  vBright = aInfo.z;
  vT = aInfo.w;
  gl_Position = vec4(px.x / uRes.x * 2.0 - 1.0, 1.0 - px.y / uRes.y * 2.0, 0.0, 1.0);
}`;

export const BOLT_FS = `#version 300 es
precision mediump float;
in float vAcross;
in float vBright;
in float vT;
out vec4 o;
uniform float uIntensity;
uniform float uReveal;
uniform vec3 uColor;
uniform float uSharp;
uniform float uTail;
void main() {
  if (vT > uReveal) discard;
  float prof = exp(-vAcross * vAcross * uSharp);
  float tail = uTail > 0.0 ? smoothstep(uReveal - uTail, uReveal, vT) : 1.0;
  float a = prof * vBright * uIntensity * tail * tail;
  o = vec4(uColor * a, a);
}`;

export const BLUR_FS = `#version 300 es
precision mediump float;
in vec2 vUv;
out vec4 o;
uniform sampler2D uTex;
uniform vec2 uDir;
void main() {
  vec3 s = texture(uTex, vUv).rgb * 0.227;
  s += (texture(uTex, vUv + uDir * 1.385).rgb + texture(uTex, vUv - uDir * 1.385).rgb) * 0.316;
  s += (texture(uTex, vUv + uDir * 3.231).rgb + texture(uTex, vUv - uDir * 3.231).rgb) * 0.07;
  o = vec4(s, 1.0);
}`;

export const ADD_FS = `#version 300 es
precision mediump float;
in vec2 vUv;
out vec4 o;
uniform sampler2D uTex;
uniform float uStrength;
void main() { o = vec4(texture(uTex, vUv).rgb * uStrength, 0.0); }`;

/** Lens vignette and film grain, multiplied over the frame. */
export const OVERLAY_FS = `#version 300 es
precision mediump float;
in vec2 vUv;
out vec4 o;
uniform float uAspect;
uniform float uTime;
uniform vec2 uRes;
float h(vec2 p) {
  p = fract(p * vec2(443.8, 441.4));
  p += dot(p, p + 19.19);
  return fract(p.x * p.y);
}
void main() {
  vec2 c = (vUv - 0.5) * vec2(uAspect, 1.0);
  float vig = mix(0.6, 1.0, smoothstep(1.2, 0.3, length(c)));
  float grain = h(vUv * uRes + fract(uTime * 7.13) * 91.7) - 0.5;
  o = vec4(vec3(vig * (1.0 + grain * 0.05)), 1.0);
}`;

/* ------------------------------ the Earth ------------------------------ */

/** Noise for generating the planet's textures once: 3D gradient noise on the unit sphere
 *  (no seams, no pinching at the poles) with an integer hash, so it looks the same on
 *  every GPU. */
const GEN_NOISE = `
uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z;
  v.y += v.z * v.x;
  v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z;
  v.y += v.z * v.x;
  v.z += v.x * v.y;
  return v;
}
vec3 grad3(vec3 cell) {
  uvec3 h = pcg3d(uvec3(ivec3(cell) + 4096));
  return vec3(h & 0xffffu) * (2.0 / 65535.0) - 1.0;
}
float gnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = p - i;
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float n000 = dot(grad3(i), f);
  float n100 = dot(grad3(i + vec3(1.0, 0.0, 0.0)), f - vec3(1.0, 0.0, 0.0));
  float n010 = dot(grad3(i + vec3(0.0, 1.0, 0.0)), f - vec3(0.0, 1.0, 0.0));
  float n110 = dot(grad3(i + vec3(1.0, 1.0, 0.0)), f - vec3(1.0, 1.0, 0.0));
  float n001 = dot(grad3(i + vec3(0.0, 0.0, 1.0)), f - vec3(0.0, 0.0, 1.0));
  float n101 = dot(grad3(i + vec3(1.0, 0.0, 1.0)), f - vec3(1.0, 0.0, 1.0));
  float n011 = dot(grad3(i + vec3(0.0, 1.0, 1.0)), f - vec3(0.0, 1.0, 1.0));
  float n111 = dot(grad3(i + vec3(1.0, 1.0, 1.0)), f - vec3(1.0, 1.0, 1.0));
  return mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y), mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z);
}
const mat3 M3 = mat3(0.00, 0.80, 0.60, -0.80, 0.36, -0.48, -0.60, -0.48, 0.64);
float fbm(vec3 p, int oct) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 9; i++) {
    if (i >= oct) break;
    s += a * gnoise(p);
    p = M3 * p * 2.02 + 0.13;
    a *= 0.5;
  }
  return s;
}
float ridged(vec3 p, int oct) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 9; i++) {
    if (i >= oct) break;
    float n = 1.0 - abs(gnoise(p) * 1.7);
    s += a * n * n;
    p = M3 * p * 2.1 + 0.29;
    a *= 0.5;
  }
  return s;
}`;

/** Climate from the real coastlines: land (the coast roughened by noise), shallow shelves,
 *  latitude, how far inland, humidity (rain belts, dry interiors, monsoon east coasts,
 *  wet western mid-latitudes), temperature, ice and mountains. */
const CLIMATE = `
uniform sampler2D uMask;
const float PI = 3.14159265;
const float TAU = 6.28318531;
struct Climate { float land; float shelf; float alat; float inland; float hum; float temp; float ice; float mount; };
Climate climate(vec3 s, vec2 uv) {
  Climate c;
  vec2 m = texture(uMask, uv).rg;
  float cn = fbm(s * 34.0, 5) + 0.45 * fbm(s * 140.0 + 4.0, 4);
  c.land = smoothstep(0.45, 0.55, m.r + cn * 0.45);
  c.shelf = smoothstep(0.0, 0.42, m.r + cn * 0.2);
  c.alat = abs(asin(clamp(s.y, -1.0, 1.0))) * 57.29578;
  c.inland = m.g;
  float nL = fbm(s * 2.4 + 11.0, 5);
  float nM = fbm(s * 10.0 + 3.0, 4);
  float hum = 0.95 * exp(-pow(c.alat / 12.0, 2.0)) + 0.6 * exp(-pow((c.alat - 52.0) / 15.0, 2.0)) + 0.14;
  hum *= 1.0 - smoothstep(0.35, 0.9, c.inland) * 0.6 * smoothstep(8.0, 20.0, c.alat);
  float du = 9.0 / 360.0;
  float seaE = 1.0 - texture(uMask, uv + vec2(du, 0.0)).g;
  float seaW = 1.0 - texture(uMask, uv - vec2(du, 0.0)).g;
  float sub = exp(-pow((c.alat - 26.0) / 11.0, 2.0));
  float mid = exp(-pow((c.alat - 50.0) / 12.0, 2.0));
  hum += sub * (0.42 * seaE - 0.12 * seaW) + mid * 0.25 * seaW;
  hum += nL * 0.5 + nM * 0.15;
  c.hum = clamp(hum, 0.0, 1.0);
  c.temp = 1.0 - c.alat / 90.0 + nL * 0.08;
  float r = ridged(s * 6.5 + 2.0, 5);
  c.mount = smoothstep(0.55, 0.85, r) * smoothstep(0.25, 0.6, c.inland);
  float fine = fbm(s * 60.0 + 7.0, 3);
  c.ice = clamp(smoothstep(0.215, 0.17, c.temp + fine * 0.05) + smoothstep(0.55, 0.75, c.inland) * smoothstep(60.0, 66.0, c.alat), 0.0, 1.0);
  return c;
}`;

/** Generates the ground: rgb colour (deserts, grassland, forest, rainforest, taiga,
 *  tundra, rock, ice; deep and shallow sea, sea ice), a = open water. Equirectangular,
 *  row 0 at the north pole. */
export const EARTH_SURF_FS = `#version 300 es
precision highp float;
precision highp int;
in vec2 vUv;
out vec4 o;
${GEN_NOISE}
${CLIMATE}
void main() {
  float lon = (vUv.x - 0.5) * TAU;
  float lat = (0.5 - vUv.y) * PI;
  vec3 s = vec3(cos(lat) * cos(lon), sin(lat), cos(lat) * sin(lon));
  Climate c = climate(s, vUv);
  float nM = fbm(s * 13.0 + 5.0, 4);
  float nF = fbm(s * 95.0 + 9.0, 4);
  vec3 L = mix(vec3(0.84, 0.69, 0.48), vec3(0.73, 0.49, 0.30), smoothstep(-0.2, 0.3, nM));
  L = mix(L, vec3(0.60, 0.53, 0.37), smoothstep(0.10, 0.26, c.hum));
  L = mix(L, vec3(0.41, 0.45, 0.25), smoothstep(0.26, 0.42, c.hum));
  L = mix(L, vec3(0.17, 0.28, 0.13), smoothstep(0.42, 0.62, c.hum));
  L = mix(L, vec3(0.08, 0.21, 0.07), smoothstep(0.70, 0.88, c.hum) * smoothstep(0.78, 0.9, c.temp));
  L = mix(L, vec3(0.13, 0.20, 0.13), smoothstep(0.43, 0.35, c.temp) * smoothstep(0.04, 0.18, c.hum));
  L = mix(L, vec3(0.47, 0.45, 0.38), smoothstep(0.31, 0.25, c.temp));
  L = mix(L, vec3(0.44, 0.40, 0.35), c.mount * 0.6);
  L *= 0.84 + 0.32 * clamp(nF + 0.5, 0.0, 1.0);
  L = mix(L, vec3(0.93, 0.95, 0.98), c.ice);
  vec3 deep = mix(vec3(0.010, 0.040, 0.100), vec3(0.018, 0.064, 0.120), smoothstep(25.0, 60.0, c.alat));
  vec3 shallow = mix(vec3(0.05, 0.27, 0.31), vec3(0.035, 0.11, 0.15), smoothstep(22.0, 42.0, c.alat));
  vec3 W = mix(deep, shallow, c.shelf * 0.8);
  W *= 0.94 + 0.12 * (nM + 0.5);
  float seaIce = smoothstep(75.0, 83.0, c.alat + nM * 8.0);
  W = mix(W, vec3(0.86, 0.9, 0.95), seaIce);
  o = vec4(mix(W, L, c.land), (1.0 - c.land) * (1.0 - seaIce));
}`;

/** Generates r = cloud cover (domain-warped, thinner over deserts, thicker in the rain
 *  belts, twisted into cyclones, two hurricanes with eyes), g = city lights (clusters
 *  where people would live, brightest near coasts), b = relief. */
export const EARTH_CLOUD_FS = `#version 300 es
precision highp float;
precision highp int;
in vec2 vUv;
out vec4 o;
uniform vec4 uStorm[8];
${GEN_NOISE}
${CLIMATE}
vec3 twist(vec3 v, vec3 k, float a) {
  float c = cos(a);
  float sn = sin(a);
  return v * c + cross(k, v) * sn + k * dot(k, v) * (1.0 - c);
}
float cities(vec3 s, float freq, float prob) {
  vec3 g = s * freq;
  vec3 i = floor(g);
  float sum = 0.0;
  for (int z = -1; z <= 1; z++)
    for (int y = -1; y <= 1; y++)
      for (int x = -1; x <= 1; x++) {
        vec3 cell = i + vec3(float(x), float(y), float(z));
        uvec3 h = pcg3d(uvec3(ivec3(cell) + 8192));
        if (float(h.x & 0xffffu) / 65535.0 > prob) continue;
        vec3 pos = cell + vec3(float((h.y >> 8u) & 0xffu), float((h.z >> 8u) & 0xffu), float((h.x >> 16u) & 0xffu)) / 255.0;
        float b = float(h.y & 0xffu) / 255.0;
        b = 0.2 + 0.8 * b * b * b;
        float sz = 0.12 + 0.3 * b;
        vec3 dv = g - pos;
        sum += b * exp(-dot(dv, dv) / (sz * sz));
      }
  return sum;
}
void main() {
  float lon = (vUv.x - 0.5) * TAU;
  float lat = (0.5 - vUv.y) * PI;
  vec3 s = vec3(cos(lat) * cos(lon), sin(lat), cos(lat) * sin(lon));
  Climate c = climate(s, vUv);
  vec3 p = s;
  float boost = 0.0;
  float eye = 0.0;
  for (int i = 0; i < 8; i++) {
    vec3 k = uStorm[i].xyz;
    float dd = length(s - k);
    float tight = i < 2 ? 0.055 : 0.16;
    p = twist(p, k, uStorm[i].w * exp(-dd / tight));
    if (i < 2) {
      boost += 0.75 * exp(-dd / 0.05);
      eye = max(eye, exp(-pow(dd / 0.0075, 2.0)));
    } else {
      boost += 0.18 * exp(-dd / 0.12);
    }
  }
  vec3 w = vec3(fbm(p * 2.2 + 1.7, 4), fbm(p * 2.2 + 9.2, 4), fbm(p * 2.2 + 4.4, 4));
  float base = fbm(p * 4.6 + w * 1.7, 7);
  float det = fbm(p * 36.0 + w * 3.0, 5);
  float dens = base * 1.8 + det * 0.45;
  float cov = 0.34 + 0.3 * exp(-pow(c.alat / 8.0, 2.0)) + 0.26 * exp(-pow((c.alat - 55.0) / 12.0, 2.0)) - 0.2 * exp(-pow((c.alat - 24.0) / 9.0, 2.0));
  cov -= (1.0 - c.hum) * 0.3 * c.land;
  cov += fbm(s * 1.6 + 5.0, 4) * 0.55;
  cov += boost;
  float t = mix(0.6, -0.6, clamp(cov, 0.0, 1.0));
  float cloud = smoothstep(t - 0.08, t + 0.55, dens) * (1.0 - eye);

  float habit = c.land * (1.0 - c.ice) * smoothstep(0.1, 0.32, c.hum) * smoothstep(0.26, 0.48, c.temp);
  habit *= 1.0 - 0.75 * smoothstep(0.78, 0.95, c.hum) * smoothstep(0.6, 0.9, c.inland);
  habit *= mix(1.3, 0.45, smoothstep(0.45, 0.95, c.inland));
  habit *= smoothstep(-0.18, 0.28, fbm(s * 5.0 + 21.0, 4) + 0.12);
  float lights = cities(s, 42.0, 0.55) * 1.6 + cities(s, 150.0, 0.45) * 0.9 + smoothstep(0.05, 0.45, fbm(s * 40.0 + 3.0, 3)) * 0.45;
  lights = clamp(lights * habit, 0.0, 1.0);

  o = vec4(cloud, lights, c.land * (0.2 + 0.8 * c.mount), 1.0);
}`;

/** A quad over the bottom band of the screen, up to uTop (uv), for the planet. */
export const PLANET_VS = `#version 300 es
uniform float uTop;
out vec2 vUv;
void main() {
  vec2 c = vec2(float(gl_VertexID & 1), float((gl_VertexID >> 1) & 1));
  vUv = vec2(c.x, c.y * uTop);
  gl_Position = vec4(vUv * 2.0 - 1.0, 0.0, 1.0);
}`;

/** The planet: NASA's real day map (or the generated one until it loads) wrapped on
 *  the sphere and turning, with relief from real topography, lit by a low sun (a soft
 *  terminator reddening the light, pink clouds at dusk, cloud shadows, a sheen on the
 *  sea toward the horizon), the real city lights on the night side with a glow round
 *  them, the ground fading into the air toward the horizon, and above it the atmosphere
 *  as a thin shell: white-blue low down, deep blue higher, orange where dusk meets the
 *  horizon, a faint green airglow over the night side. */
export const PLANET_FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform float uAspect;
uniform vec3 uGeo;
uniform float uAtmo;
uniform float uPix;
uniform vec3 uSun;
uniform vec3 uSunP;
uniform mat3 uPole;
uniform vec2 uSpin;
uniform sampler2D uSurf;
uniform sampler2D uCloud;
uniform sampler2D uDay;
uniform sampler2D uNight;
uniform sampler2D uRelief;
uniform sampler2D uMask;
uniform float uReal;
uniform float uFade;
const float PI = 3.14159265;
const float TAU = 6.28318531;
vec3 air(float mu, float duskW) {
  float day = smoothstep(-0.07, 0.3, mu);
  float dusk = exp(-pow((mu - 0.01) / duskW, 2.0));
  return vec3(0.28, 0.54, 1.0) * day + vec3(1.0, 0.43, 0.2) * dusk * 0.6;
}
void main() {
  vec2 p = vec2(vUv.x * uAspect, vUv.y);
  vec2 d = p - uGeo.xy;
  float R = uGeo.z;
  float dist = length(d);

  // the ground under this pixel, worked out everywhere so screen derivatives stay valid
  float dc = min(dist, R * 0.9999);
  vec2 dd = d * (dc / max(dist, 1e-6));
  vec3 n = vec3(dd, sqrt(max(R * R - dc * dc, 0.0))) / R;
  vec3 q = uPole * n;
  float lat = asin(clamp(q.y, -1.0, 1.0));
  float lon = atan(-q.z, q.x);   // east to the right, seen from outside
  float v = 0.5 - lat / PI;
  float us = lon / TAU + uSpin.x;
  vec2 a = vec2(fract(us), v);
  vec2 b = vec2(fract(us + 0.5), v);
  vec2 ax = dFdx(a);
  vec2 ay = dFdy(a);
  vec2 bx = dFdx(b);
  vec2 by = dFdy(b);
  bool useB = max(abs(ax.x), abs(ay.x)) > max(abs(bx.x), abs(by.x));
  vec2 gx = useB ? bx : ax;
  vec2 gy = useB ? by : ay;
  vec2 uvS = vec2(us, v);
  vec2 uvC = vec2(lon / TAU + uSpin.y, v);

  float cover = clamp((R - dist) / uPix + 0.5, 0.0, 1.0);
  vec3 ground = vec3(0.0);
  if (cover > 0.0) {
    vec4 S = textureGrad(uSurf, uvS, gx, gy);
    vec4 G = textureGrad(uCloud, uvS, gx, gy);
    float cl = textureGrad(uCloud, uvC, gx, gy).r * 0.9;
    vec3 east = vec3(-sin(lon), 0.0, -cos(lon));
    vec3 north = vec3(-sin(lat) * cos(lon), cos(lat), sin(lat) * sin(lon));
    vec3 albedo = S.rgb;
    float water = S.a;
    float ndlG = dot(n, uSun);
    if (uReal > 0.5) {
      albedo = textureGrad(uDay, uvS, gx, gy).rgb;
      water = 1.0 - smoothstep(0.4, 0.6, textureGrad(uMask, uvS, gx, gy).r);
      // relief from real topography, tilting the ground toward or away from the sun
      float h0 = textureGrad(uRelief, uvS, gx, gy).r;
      float hE = textureGrad(uRelief, uvS + vec2(1.0 / 2048.0, 0.0), gx, gy).r;
      float hN = textureGrad(uRelief, uvS - vec2(0.0, 1.0 / 1024.0), gx, gy).r;
      vec3 qn = normalize(q - 3.5 * ((hE - h0) * east + (hN - h0) * north));
      ndlG = dot(qn, uSunP);
    }
    float ndl = dot(n, uSun);
    float lit = max(ndl, 0.0);
    vec3 sunC = mix(vec3(1.0, 0.52, 0.26), vec3(1.0, 0.96, 0.9), smoothstep(0.0, 0.3, ndl));
    vec3 tq = uSunP - q * dot(q, uSunP);
    vec2 sh = vec2(dot(tq, east) / (max(cos(lat), 0.1) * TAU), -dot(tq, north) / PI) * 0.004;
    float shadow = textureGrad(uCloud, uvC + sh, gx, gy).r;
    vec3 col = albedo * sunC * max(ndlG, 0.0) * smoothstep(-0.02, 0.06, ndl) * 1.45 * (1.0 - shadow * 0.5);
    float fres = 0.02 + 0.98 * pow(1.0 - max(n.z, 0.0), 5.0);
    col += air(ndl, 0.07) * fres * water * (1.0 - cl) * 0.5;
    vec3 cloudC = sunC * (0.03 + 1.2 * lit) + vec3(1.0, 0.45, 0.3) * exp(-pow(ndl / 0.12, 2.0)) * 0.3;
    col = mix(col, cloudC, cl);
    float night = 1.0 - smoothstep(-0.16, 0.04, ndl);
    vec3 cities;
    if (uReal > 0.5) {
      // real city light: brightest where the most people live, with a soft glow round it
      float lum = textureGrad(uNight, uvS, gx, gy).r;
      float halo = textureGrad(uNight, uvS, gx * 5.0, gy * 5.0).r;
      cities = vec3(1.0, 0.78, 0.5) * (lum * lum * 2.4 + lum * 0.6 + halo * 0.9);
    } else {
      float glow = textureGrad(uCloud, uvS, gx * 5.0, gy * 5.0).g;
      cities = vec3(1.0, 0.75, 0.43) * G.g * 2.3 + vec3(1.0, 0.58, 0.3) * glow * 1.0;
    }
    col += cities * night * (1.0 - cl * 0.8);
    // moonlight: at night the map stays readable, dark and cool (black sea, blue-grey
    // land, pale ice and cloud)
    vec3 moonTint = vec3(0.45, 0.56, 0.86);
    float lumD = dot(albedo, vec3(0.3, 0.5, 0.2));
    vec3 moonGround = mix(vec3(lumD), albedo, 0.4) * moonTint * 0.44;
    col += mix(moonGround, moonTint * 0.3, cl) * night;
    float mu = max(n.z, 0.015);
    float T = exp(-0.065 / mu);
    ground = col * T + mix(air(ndl, 0.07), vec3(0.62, 0.74, 0.95) * smoothstep(-0.05, 0.3, ndl), 0.3) * (1.0 - T) * 1.1;
  }

  float h = max(dist - R, 0.0) / uAtmo;
  float mul = dot(vec3(d / max(dist, 1e-6), 0.0), uSun);
  vec3 sky = air(mul, 0.11) * exp(-h * 2.3) * 1.2;
  sky += vec3(0.75, 0.88, 1.0) * exp(-h * 10.0) * smoothstep(-0.08, 0.3, mul) * 0.55;
  sky += vec3(0.3, 0.75, 0.35) * exp(-pow((h - 1.1) / 0.16, 2.0)) * 0.1 * (1.0 - smoothstep(-0.25, 0.05, mul));
  // a faint moonlit rim so the planet's edge still shows at night
  sky += vec3(0.1, 0.17, 0.34) * exp(-h * 2.6) * 0.7 * (1.0 - smoothstep(-0.2, 0.1, mul));

  o = vec4(mix(sky, ground, cover), cover) * uFade;
}`;

/* ------------------------------ the satellite ------------------------------ */

export const SAT_VS = `#version 300 es
in vec3 aPos;
in vec3 aNormal;
in vec2 aUv;
in float aMat;
uniform mat3 uRot;
uniform mat4 uProj;
uniform float uDist;
out vec3 vN;
out vec3 vV;
out vec2 vUv;
out float vMat;
out vec3 vObj;
void main() {
  vec3 vp = uRot * aPos - vec3(0.0, 0.0, uDist);
  vN = uRot * aNormal;
  vV = -vp;
  vUv = aUv;
  vMat = aMat;
  vObj = aPos;
  gl_Position = uProj * vec4(vp, 1.0);
}`;

/** Physically based shading for the satellite: crinkled gold and silver foil (metallic,
 *  bumpy), white radiators, solar cells (dark blue glass with silver interconnects and
 *  fingers, glossy), panel backs, bare metal, black parts, white dishes. Lit by the sun,
 *  by blue light from the planet below, and reflecting the planet in anything shiny. */
export const SAT_FS = `#version 300 es
precision highp float;
in vec3 vN;
in vec3 vV;
in vec2 vUv;
in float vMat;
in vec3 vObj;
out vec4 o;
uniform vec3 uSun;
uniform vec3 uEarth;
uniform float uSunI;
uniform float uEarthI;
float h31(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float h21(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
float vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1.0, 0.0, 0.0)), f.x), mix(h31(i + vec3(0.0, 1.0, 0.0)), h31(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(h31(i + vec3(0.0, 0.0, 1.0)), h31(i + vec3(1.0, 0.0, 1.0)), f.x), mix(h31(i + vec3(0.0, 1.0, 1.0)), h31(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}
vec3 crinkle(vec3 N, vec3 p) {
  float e = 0.35;
  vec3 g = vec3(0.0);
  float a = 1.0;
  for (int i = 0; i < 3; i++) {
    float c = vnoise(p);
    g += a * (vec3(vnoise(p + vec3(e, 0.0, 0.0)), vnoise(p + vec3(0.0, e, 0.0)), vnoise(p + vec3(0.0, 0.0, e))) - c) / e;
    p *= 2.3;
    a *= 0.55;
  }
  return normalize(N + (g - N * dot(g, N)) * 0.1);
}
void main() {
  vec3 V = normalize(vV);
  vec3 N = faceforward(normalize(vN), -V, normalize(vN));
  int m = int(vMat + 0.5);
  vec3 base = vec3(0.8);
  float metal = 0.0;
  float rough = 0.5;
  float f0 = 0.04;
  if (m == 0 || m == 1) {
    N = crinkle(N, vObj * 9.0);
    base = m == 0 ? vec3(1.0, 0.71, 0.29) : vec3(0.8, 0.82, 0.86);
    metal = 1.0;
    rough = 0.3;
  } else if (m == 2) {
    base = vec3(0.85, 0.86, 0.87) * (0.94 + 0.06 * step(0.5, fract(vUv.x * 12.0)));
    rough = 0.7;
  } else if (m == 3) {
    vec2 g = vUv * vec2(12.0, 9.0);
    vec2 f = fract(g);
    float cell = step(0.07, f.x) * step(f.x, 0.95) * step(0.07, f.y) * step(f.y, 0.95);
    vec3 si = vec3(0.035, 0.075, 0.24) + vec3(0.01, 0.025, 0.07) * h21(floor(g));
    si += vec3(0.05) * smoothstep(0.08, 0.0, abs(fract(f.y * 5.0) - 0.5) - 0.42);
    base = mix(vec3(0.55, 0.57, 0.6), si, cell);
    rough = 0.1 + 0.25 * (1.0 - cell);
    f0 = 0.06;
  } else if (m == 4) {
    vec2 g = fract(vUv * vec2(6.0, 4.0));
    base = vec3(0.62, 0.62, 0.6) * (0.85 + 0.15 * step(0.04, g.x) * step(0.04, g.y));
    rough = 0.65;
  } else if (m == 5) {
    base = vec3(0.74, 0.76, 0.8);
    metal = 1.0;
    rough = 0.28;
  } else if (m == 6) {
    base = vec3(0.07, 0.07, 0.08);
    metal = 0.4;
    rough = 0.45;
  } else {
    base = vec3(0.9, 0.9, 0.88);
    rough = 0.55;
  }
  vec3 L = uSun;
  vec3 H = normalize(L + V);
  float ndl = max(dot(N, L), 0.0);
  float ndv = max(dot(N, V), 0.001);
  float ndh = max(dot(N, H), 0.0);
  float vdh = max(dot(V, H), 0.0);
  vec3 F0 = mix(vec3(f0), base, metal);
  vec3 F = F0 + (1.0 - F0) * pow(1.0 - vdh, 5.0);
  float a = rough * rough;
  float a2 = a * a;
  float dn = ndh * ndh * (a2 - 1.0) + 1.0;
  float D = a2 / (3.14159 * dn * dn);
  float kk = (rough + 1.0) * (rough + 1.0) / 8.0;
  float G = ndv / (ndv * (1.0 - kk) + kk) * ndl / (ndl * (1.0 - kk) + kk);
  vec3 spec = D * G * F / max(4.0 * ndv * ndl, 0.001);
  vec3 kd = (1.0 - F) * (1.0 - metal);
  vec3 sun = vec3(1.0, 0.97, 0.92) * 3.2 * uSunI;
  vec3 col = (kd * base / 3.14159 + spec) * sun * ndl;
  col += base * metal * (0.42 * ndl * uSunI + 0.05 * uEarthI);
  float nde = dot(N, uEarth) * 0.5 + 0.5;
  col += kd * base * vec3(0.09, 0.15, 0.26) * nde * nde * uEarthI;
  vec3 R = reflect(-V, N);
  float seeEarth = smoothstep(-0.1, 0.45, dot(R, uEarth));
  vec3 Fe = F0 + (max(vec3(1.0 - rough), F0) - F0) * pow(1.0 - ndv, 5.0);
  col += vec3(0.26, 0.44, 0.72) * seeEarth * Fe * (0.5 + 0.5 * metal) * uEarthI;
  col += base * 0.012 + vec3(0.02, 0.022, 0.03) * seeEarth * (1.0 - uEarthI);
  col = col / (1.0 + col * 0.25);
  o = vec4(col, 1.0);
}`;

/** A textured quad at a spot on screen (the satellite's render), premultiplied. */
export const SPRITE_VS = `#version 300 es
uniform vec4 uRect;
uniform vec2 uRes;
out vec2 vUv;
void main() {
  vec2 c = vec2(float(gl_VertexID & 1), float((gl_VertexID >> 1) & 1));
  vec2 px = uRect.xy + vec2(c.x * 2.0 - 1.0, 1.0 - c.y * 2.0) * uRect.zw;
  vUv = c;
  gl_Position = vec4(px.x / uRes.x * 2.0 - 1.0, 1.0 - px.y / uRes.y * 2.0, 0.0, 1.0);
}`;

export const SPRITE_FS = `#version 300 es
precision mediump float;
in vec2 vUv;
out vec4 o;
uniform sampler2D uTex;
uniform float uAlpha;
void main() {
  o = texture(uTex, vUv) * uAlpha;
}`;
