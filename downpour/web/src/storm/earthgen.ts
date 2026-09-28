/* The planet's cloud cover, generated once, offline: scripts/build-earth-clouds.mjs renders
 * CLOUD_FS into web/public/earth/clouds-*.jpg, which the sky loads like the NASA maps.
 * It is not part of the site: shaders this long take some GPU drivers minutes to compile
 * (Direct3D unrolls every noise loop), long enough to crash the browser. */

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

/** Cloud cover: domain-warped, thinner over deserts, thicker in the rain belts, twisted
 *  into cyclones, two hurricanes with eyes. Equirectangular, row 0 at the north pole. */
export const CLOUD_FS = `#version 300 es
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
  o = vec4(vec3(cloud), 1.0);
}`;
