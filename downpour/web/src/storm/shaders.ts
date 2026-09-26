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
 *  lanes, drifting coloured nebulae, a small spiral galaxy far off, and the limb of
 *  a planet with a glowing atmosphere along the bottom. Shooting stars brighten
 *  the nebula they cross (uFlash). */
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

  // the limb of a planet along the bottom, with an atmosphere catching the light
  vec2 pc = vec2(0.72 * uAspect, -1.42);
  float pr = 1.6;
  vec2 dp = p - pc;
  float dist = length(dp);
  if (dist < pr) {
    vec3 nrm = vec3(dp / pr, sqrt(max(0.0, 1.0 - dot(dp, dp) / (pr * pr))));
    vec3 sun = normalize(vec3(-0.75, 0.55, 0.35));
    float lit = max(dot(nrm, sun), 0.0);
    float bands = fbm(vec2(dp.x * 3.0, dp.y * 14.0) + vec2(t * 0.005, 0.0));
    vec3 surf = mix(vec3(0.05, 0.07, 0.12), vec3(0.18, 0.22, 0.32), bands) * (0.08 + 0.92 * lit);
    // city-like lights on the night side
    float lights = smoothstep(0.93, 1.0, noise(dp * 180.0)) * (1.0 - smoothstep(0.0, 0.25, lit)) * 0.6;
    surf += vec3(1.0, 0.75, 0.4) * lights;
    col = surf;
  }
  float rim = exp(-abs(dist - pr) * 55.0) + exp(-max(dist - pr, 0.0) * 9.0) * 0.35;
  float sunSide = clamp(dot(normalize(dp), normalize(vec2(-0.75, 0.55))) * 0.5 + 0.6, 0.0, 1.0);
  col += vec3(0.25, 0.6, 1.0) * rim * sunSide * 0.9;

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

/** The currency stars: small glowing worlds in the currency's colour, lit from
 *  one side with a bright limb, a halo and four diffraction spikes, the sign in
 *  the middle. */
export const DROP_VS = `#version 300 es
in vec2 aCorner;       // -1..1
in vec4 aPos;          // x, y (px, y down), radius px, alpha
in vec4 aMisc;         // glyph index, charge, pulse, rotation
in vec3 aTint;
uniform vec2 uRes;
out vec2 vLocal;
out vec3 vTint;
out float vAlpha;
out float vGlyph;
out float vCharge;
out float vPulse;
void main() {
  vec2 local = aCorner * 3.2;
  float c = cos(aMisc.w);
  float sn = sin(aMisc.w);
  vec2 off = vec2(local.x, -local.y) * aPos.z;
  off = vec2(c * off.x - sn * off.y, sn * off.x + c * off.y);
  vec2 px = aPos.xy + off;
  vLocal = local;
  vTint = aTint;
  vAlpha = aPos.w;
  vGlyph = aMisc.x;
  vCharge = aMisc.y;
  vPulse = aMisc.z;
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
out vec4 o;
uniform sampler2D uAtlas;
uniform vec2 uRes;
uniform float uFlash;
void main() {
  vec2 p = vLocal;
  float r = length(p);
  float glowK = 1.0 + vPulse * 0.25 + vCharge * 0.8;
  // halo and diffraction spikes around the body
  float halo = exp(-max(r - 1.0, 0.0) * 2.2) * 0.45 * glowK;
  float spikes = (exp(-abs(p.x) * 9.0) * exp(-abs(p.y) * 0.9) + exp(-abs(p.y) * 9.0) * exp(-abs(p.x) * 0.9)) * 0.55 * glowK;
  vec3 col = (vTint * 0.8 + 0.2) * (halo + spikes * smoothstep(0.9, 1.4, r));
  float a = clamp(halo + spikes, 0.0, 1.0) * smoothstep(3.2, 2.4, r);

  float aa = fwidth(r) * 1.5;
  float body = smoothstep(1.0 + aa, 1.0 - aa, r);
  if (body > 0.0) {
    vec3 n = vec3(p, sqrt(max(0.0, 1.0 - r * r)));
    vec3 L = normalize(vec3(-0.6, 0.55, 0.6));
    float lit = max(dot(n, L), 0.0);
    // a banded, glowing surface in the currency's colour
    float bands = 0.5 + 0.5 * sin(p.y * 7.0 + sin(p.x * 3.0) * 1.5);
    vec3 surf = vTint * (0.28 + 0.72 * lit) * (0.8 + 0.25 * bands) + vTint * 0.25;
    float limb = pow(1.0 - n.z, 2.5);
    surf += (vTint * 0.6 + 0.4) * limb * 0.9;
    float spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 40.0);
    surf += vec3(1.0) * spec * 0.6;
    // the currency sign, pressed into the surface
    vec2 guv = p * 0.62 + 0.5;
    vec2 cell = vec2(mod(vGlyph, 16.0), floor(vGlyph / 16.0));
    vec2 auv = (cell + clamp(vec2(guv.x, 1.0 - guv.y), 0.002, 0.998)) / 16.0;
    float g = texture(uAtlas, auv).a;
    float gs = texture(uAtlas, auv + vec2(-0.0022, 0.0028)).a;
    surf = mix(surf, vec3(1.0, 0.99, 0.96), g * 0.92);
    surf -= (gs - g) * 0.25;
    surf *= 1.0 + vPulse * 0.15;
    col = mix(col, surf, body);
    a = max(a, body);
  }
  a *= vAlpha;
  o = vec4(col * vAlpha, a);
}`;

/** Sparkles and shockwave rings. */
export const PART_VS = `#version 300 es
in vec2 aCorner;
in vec4 aP;     // x, y, size, alpha
in vec4 aQ;     // type (0 sparkle, 1 ring), tint rgb
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
    a = smoothstep(0.16, 0.0, abs(r - 0.82)) * 0.7;
    c = mix(vec3(0.6, 0.68, 0.8), vTint, 0.35);
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
