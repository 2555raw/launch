/* GLSL for the realistic storm. Written for this project. */

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
// sum of |noise| octaves: puffy, cauliflower-like billows
float billow(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * abs(noise(p) * 2.0 - 1.0);
    p = ROT * p + vec2(1.3, 7.9);
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

/** Storm sky: a deck of turbulent cumulonimbus, rain curtains beneath it, a faint
 *  city glow at the horizon, and lightning that lights the cloud from inside. */
export const SKY_FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform float uTime;
uniform float uAspect;
uniform vec3 uFlash;   // xy: where the bolt leaves the cloud (uv, y up), z: intensity
uniform float uSheet;  // cloud-wide flash with no bolt
uniform float uBase;   // cloud base height (uv, from the bottom)
uniform float uStorm;  // 1 storm, ~0.55 drizzle
${NOISE}
void main() {
  vec2 uv = vUv;
  vec2 p = vec2(uv.x * uAspect, uv.y);
  float t = uTime;
  vec2 drift = vec2(t * 0.012, 0.0);

  // the underside of the deck is ragged, not a straight line
  float base = uBase + 0.07 * (fbm3(vec2(p.x * 1.1 + t * 0.006, 2.3)) - 0.5);
  float h = uv.y - base;

  // turbulent, domain-warped cloud field, squashed like a real storm deck
  vec2 q = p * vec2(1.6, 2.7) + drift;
  vec2 w = vec2(fbm3(q + vec2(0.0, t * 0.012)), fbm3(q + vec2(5.3, 1.9) - vec2(t * 0.009, 0.0)));
  float d = mix(fbm(q + 1.35 * w), 1.0 - billow(q * 1.25 + w * 0.6), 0.42);
  float lumps = fbm3(p * vec2(0.75, 1.4) + drift * 0.6 + 9.0);

  // coverage: broken near the base, a solid (but still textured) ceiling above
  float cover = smoothstep(-0.16, 0.16, h + (lumps - 0.5) * 0.3);
  float dens = clamp((d - 0.28) * 2.6 + cover - 0.32, 0.0, 1.0) * cover;
  dens = max(dens, smoothstep(0.06, 0.4, h) * (0.8 + 0.2 * d));

  // billows: brighter where the field peaks toward the light above, dark in the cavities
  vec2 qu = q + vec2(0.012, 0.075);
  float dUp = mix(fbm(qu + 1.35 * w), 1.0 - billow(qu * 1.25 + w * 0.6), 0.42);
  float edge = clamp((d - dUp) * 6.0 + 0.45, 0.0, 1.0);
  float belly = smoothstep(0.22, -0.08, h);
  float det = fbm3(q * 3.6 - drift * 2.8);

  vec3 cDark = vec3(0.022, 0.028, 0.042);
  vec3 cMid = vec3(0.085, 0.1, 0.13);
  vec3 cLight = vec3(0.25, 0.28, 0.34);
  vec3 cloud = mix(cMid, cDark, belly * 0.85);
  cloud += (cLight - cMid) * pow(edge, 1.6) * (1.0 - belly * 0.65);
  cloud *= 0.72 + 0.56 * smoothstep(0.18, 0.78, d);
  cloud *= 0.86 + 0.28 * det;
  cloud *= mix(1.3, 1.0, uStorm);

  // sky beyond the deck: steel blue, lighter toward the horizon
  vec3 sky = mix(vec3(0.085, 0.11, 0.155), vec3(0.03, 0.04, 0.062), smoothstep(0.0, 0.85, uv.y));
  // rain curtains hanging under the deck, leaning with the wind
  float curtains = fbm3(vec2(p.x * 4.4 + t * 0.05 - uv.y * 0.9, uv.y * 0.45 - t * 0.32));
  float under = smoothstep(0.03, -0.42, h);
  sky = mix(sky, vec3(0.14, 0.165, 0.21), smoothstep(0.4, 0.78, curtains) * under * 0.8 * uStorm);
  // a faint city glow under the storm
  sky += vec3(0.06, 0.055, 0.05) * pow(1.0 - uv.y, 4.5);

  vec3 col = mix(sky, cloud, dens);

  // ragged scud racing under the base
  float scud = fbm3(p * vec2(3.2, 7.0) + vec2(t * 0.045, 0.0));
  float band = smoothstep(-0.13, -0.03, h) * smoothstep(0.08, 0.0, h);
  col = mix(col, cDark * 1.3, smoothstep(0.52, 0.72, scud) * band * 0.85);

  // lightning: a light inside the cloud, scattered by its density
  vec2 fp = vec2(uFlash.x * uAspect, uFlash.y);
  float r = length((p - fp) * vec2(1.0, 1.7));
  float glow = uFlash.z * exp(-r * 2.4);
  vec3 flashCol = vec3(0.8, 0.85, 1.0);
  col += flashCol * glow * (0.16 + 1.9 * dens * (0.5 + 0.5 * det) * (0.55 + 0.45 * edge));
  col += flashCol * uSheet * dens * (0.25 + 0.75 * edge) * 0.6;
  col += flashCol * (uFlash.z * 0.04 + uSheet * 0.025);

  o = vec4(col, 1.0);
}`;

export const BLIT_FS = `#version 300 es
precision mediump float;
in vec2 vUv;
out vec4 o;
uniform sampler2D uTex;
void main() { o = vec4(texture(uTex, vUv).rgb, 1.0); }`;

/** Rain: thin streaks at three depths of field, drawn instanced. */
export const RAIN_VS = `#version 300 es
in vec2 aCorner;       // x: -1..1 across, y: 0 tail .. 1 head
in vec4 aSeed;         // x, y phase, depth, random
uniform float uTime;
uniform vec2 uRes;
uniform float uWind;
uniform float uTop;
out vec2 vLocal;
out float vAlpha;
void main() {
  float depth = aSeed.z;
  float speed = mix(620.0, 1450.0, depth);
  float len = mix(9.0, 44.0, depth * depth);
  float width = mix(0.55, 1.9, depth * depth);
  float span = uRes.y - uTop + len * 2.0;
  float y = uTop - len + mod(aSeed.y * span + uTime * speed, span);
  float x = aSeed.x * (uRes.x + 240.0) - 120.0 + (y - uTop) * uWind;
  vec2 dir = normalize(vec2(uWind, 1.0));
  vec2 perp = vec2(-dir.y, dir.x);
  vec2 pos = vec2(x, y) + dir * (aCorner.y - 1.0) * len + perp * aCorner.x * width;
  vLocal = aCorner;
  // streaks fade in as they leave the cloud
  float fadeIn = clamp((y - uTop) / 90.0, 0.0, 1.0);
  vAlpha = mix(0.09, 0.3, depth) * (0.55 + 0.45 * aSeed.w) * fadeIn;
  gl_Position = vec4(pos.x / uRes.x * 2.0 - 1.0, 1.0 - pos.y / uRes.y * 2.0, 0.0, 1.0);
}`;

export const RAIN_FS = `#version 300 es
precision mediump float;
in vec2 vLocal;
in float vAlpha;
out vec4 o;
uniform float uFlash;
void main() {
  float across = 1.0 - abs(vLocal.x);
  float along = smoothstep(0.0, 0.4, vLocal.y) * smoothstep(1.0, 0.82, vLocal.y);
  float a = vAlpha * across * across * along * (1.0 + uFlash * 1.8);
  vec3 c = mix(vec3(0.6, 0.67, 0.78), vec3(0.92, 0.95, 1.0), clamp(uFlash, 0.0, 1.0));
  o = vec4(c * a, a);
}`;

/** The currency drops: water that refracts the sky behind it (flipped, as a real
 *  drop does), with Fresnel reflection, a dark rim, a sharp highlight, a caustic,
 *  and the currency sign embossed inside the water. */
export const DROP_VS = `#version 300 es
in vec2 aCorner;       // -1..1
in vec4 aPos;          // x, y (px, y down), radius px, alpha
in vec4 aMisc;         // glyph index, charge, stretch, rotation
in vec3 aTint;
uniform vec2 uRes;
out vec2 vLocal;
out vec2 vScreen;
out vec3 vTint;
out float vAlpha;
out float vGlyph;
out float vCharge;
out float vRadius;
void main() {
  vec2 local = vec2(aCorner.x * 1.3, mix(-1.3, 2.1, aCorner.y * 0.5 + 0.5));
  float s = aMisc.z;
  float c = cos(aMisc.w);
  float sn = sin(aMisc.w);
  vec2 off = vec2(local.x, -local.y) * aPos.z;
  off = vec2(off.x / sqrt(s), off.y * s);
  off = vec2(c * off.x - sn * off.y, sn * off.x + c * off.y);
  vec2 px = aPos.xy + off;
  vLocal = local;
  vScreen = vec2(px.x / uRes.x, 1.0 - px.y / uRes.y);
  vTint = aTint;
  vAlpha = aPos.w;
  vGlyph = aMisc.x;
  vCharge = aMisc.y;
  vRadius = aPos.z;
  gl_Position = vec4(px.x / uRes.x * 2.0 - 1.0, 1.0 - px.y / uRes.y * 2.0, 0.0, 1.0);
}`;

export const DROP_FS = `#version 300 es
precision highp float;
in vec2 vLocal;
in vec2 vScreen;
in vec3 vTint;
in float vAlpha;
in float vGlyph;
in float vCharge;
in float vRadius;
out vec4 o;
uniform sampler2D uSky;
uniform sampler2D uAtlas;
uniform vec2 uRes;
uniform float uFlash;

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}
// a drop hanging tip-up: a round body blended into a pointed top
float shape(vec2 p) {
  float body = length(p) - 1.0;
  vec2 q = vec2(abs(p.x), p.y);
  vec2 n = normalize(vec2(1.0, 0.56));
  float tip = max(dot(q - vec2(0.0, 1.9), n), -p.y);
  return smin(body, tip, 0.5);
}
float heightAt(vec2 p) {
  float s = -shape(p);
  return sqrt(max(s * (2.0 - s), 0.0));
}
void main() {
  vec2 p = vLocal;
  float d = shape(p);
  float aa = fwidth(d) * 1.2;
  float cover = smoothstep(aa, -aa, d);
  if (cover <= 0.0) discard;

  float e = 0.025;
  float hx = (heightAt(p + vec2(e, 0.0)) - heightAt(p - vec2(e, 0.0))) / (2.0 * e);
  float hy = (heightAt(p + vec2(0.0, e)) - heightAt(p - vec2(0.0, e))) / (2.0 * e);
  vec3 n = normalize(vec3(-hx, -hy, 1.0));

  // what is behind the drop, seen through it: flipped and squeezed like a lens
  vec2 bend = -n.xy * 1.7 - p * 0.3;
  vec3 bg = texture(uSky, clamp(vScreen + bend * vRadius / uRes, 0.001, 0.999)).rgb;
  bg = bg * 1.8 + vec3(0.02, 0.026, 0.036); // a drop gathers light from all around

  float rimT = 1.0 - clamp(n.z, 0.0, 1.0);
  float fres = 0.02 + 0.98 * pow(rimT, 5.0);
  vec3 envTop = vec3(0.36, 0.39, 0.47) + vec3(0.8, 0.85, 1.0) * uFlash;
  vec3 env = mix(vec3(0.05, 0.058, 0.078), envTop, clamp(n.y * 0.5 + 0.55, 0.0, 1.0));
  vec3 col = bg * (1.0 - fres) + env * fres;

  // a faint tint of the currency's color in the water
  col += vTint * 0.035 + col * vTint * 0.16;

  // a dark band inside the edge (internal reflection), then a bright hairline at the very edge
  col *= 1.0 - 0.34 * smoothstep(0.5, 0.9, rimT);
  col += envTop * smoothstep(0.86, 1.0, rimT) * (0.45 + 0.55 * clamp(n.y, 0.0, 1.0));

  // the currency sign, embossed inside the water
  vec2 guv = p * 0.6 + 0.5 + n.xy * 0.02;
  float inCell = step(0.0, guv.x) * step(guv.x, 1.0) * step(0.0, guv.y) * step(guv.y, 1.0);
  vec2 cell = vec2(mod(vGlyph, 16.0), floor(vGlyph / 16.0));
  vec2 auv = (cell + clamp(vec2(guv.x, 1.0 - guv.y), 0.002, 0.998)) / 16.0;
  float g = texture(uAtlas, auv).a * inCell;
  float gs = texture(uAtlas, auv + vec2(-0.0022, 0.0028)).a * inCell;
  vec3 ink = mix(vec3(0.93, 0.96, 1.0), vTint * 0.9 + 0.25, 0.22);
  col = mix(col, ink, g * 0.9);
  col += (g - gs) * 0.28;
  col -= (gs - g) * 0.12;

  // highlights come off the round body (the tip is too thin to hold one): a sharp
  // specular, a soft window reflection up-left, and light focused into a caustic low-right
  float rb = dot(p, p);
  vec3 nb = rb < 1.0 ? normalize(vec3(p, sqrt(1.0 - rb))) : n;
  float bodyW = smoothstep(1.1, 0.6, p.y);
  vec3 ns = normalize(mix(n, nb, bodyW));
  vec3 L = normalize(vec3(-0.62, 0.66, 0.42));
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float nh = max(dot(ns, H), 0.0);
  float spec = (pow(nh, 220.0) * 2.2 + pow(nh, 26.0) * 0.14) * (0.35 + 0.65 * bodyW);
  // kept out toward the edge so it never sits on the sign
  float window = smoothstep(0.17, 0.06, length((p - vec2(-0.58, 0.46)) * vec2(1.0, 0.62))) * bodyW;
  float glint = smoothstep(0.1, 0.0, length(p - vec2(0.42, -0.5)));
  float caustic = smoothstep(0.5, 0.0, length((p - vec2(0.22, -0.62)) * vec2(1.0, 1.9)));
  col += vec3(1.0) * (spec * (1.0 - g) + window * 0.5 + glint * 0.45);
  col += (vTint * 0.7 + 0.28) * caustic * 0.6 * (1.0 - g * 0.6);
  col += vec3(0.85, 0.9, 1.0) * uFlash * (spec * 2.5 + fres * 0.4 + window * 0.4);
  col += vec3(0.7, 0.8, 1.0) * vCharge * (0.35 + 0.65 * fres);

  float a = cover * vAlpha;
  o = vec4(col * a, a);
}`;

/** Splash droplets and ripples. */
export const PART_VS = `#version 300 es
in vec2 aCorner;
in vec4 aP;     // x, y, size, alpha
in vec4 aQ;     // type (0 droplet, 1 ripple), tint rgb
uniform vec2 uRes;
out vec2 vLocal;
out float vType;
out vec3 vTint;
out float vAlpha;
void main() {
  vec2 ext = aQ.x < 0.5 ? vec2(aP.z) : vec2(aP.z, aP.z * 0.28);
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
    c = mix(vec3(0.62, 0.7, 0.82), vTint, 0.3) + glint * 0.55;
  } else {
    a = smoothstep(0.16, 0.0, abs(r - 0.82)) * 0.7;
    c = mix(vec3(0.6, 0.68, 0.8), vTint, 0.35);
  }
  c += vec3(0.8, 0.85, 1.0) * uFlash * 0.6;
  a *= vAlpha;
  o = vec4(c * a, a);
}`;

/** Lightning channel: drawn as strips with a gaussian profile, additively. */
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
void main() {
  if (vT > uReveal) discard;
  float prof = exp(-vAcross * vAcross * uSharp);
  float a = prof * vBright * uIntensity;
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
