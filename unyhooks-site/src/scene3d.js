/* UnyHooks — the 3D on the landing page (three.js, WebGL).

     [data-scene="story"]  one night sea fixed behind the whole page: the moon,
                           moonlit cloud, a galleon on the horizon and a chrome
                           hook ploughing through the swell. Each chapter of the
                           page ([data-shot]) is a camera shot; scrolling moves
                           the camera between them, and the last one is dawn.
     [data-scene="coin"]   the $UHOOKS coin, turning in the light

   Scenes start when their canvas comes near the screen and draw only while it
   is visible. Without WebGL (or on a software renderer) the page keeps a still
   of the sea. With prefers-reduced-motion nothing moves; the camera still
   follows the scroll.

   Built into ../scene3d.js with esbuild (npm run build:3d). */

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const small = window.matchMedia('(max-width: 760px)').matches;

/* ---------- shared: the night sky ---------- */

const MOON_DIR = new THREE.Vector3(0.3, 0.15, -1).normalize();
// Where the light sits at night (the moon) and at dawn (the sun, low on the
// horizon). The story scene moves MOON_DIR between them as the page scrolls;
// every shader reads the same vector and the same DAWN value.
const NIGHT_DIR = MOON_DIR.clone();
const SUN_DIR = new THREE.Vector3(0.22, 0.035, -1).normalize();
const DAWN = { value: 0 };

const SKY_GLSL = /* glsl */`
  uniform vec3 uMoonDir;
  uniform float uDawn;
  vec3 skyColor(vec3 d) {
    float h = clamp(d.y, 0.0, 1.0);
    vec3 zenith = mix(vec3(0.003, 0.007, 0.02), vec3(0.02, 0.035, 0.09), uDawn);
    vec3 horizon = mix(vec3(0.026, 0.038, 0.07), vec3(0.34, 0.15, 0.09), uDawn);
    vec3 c = mix(horizon, zenith, pow(h, mix(0.4, 0.3, uDawn)));
    float m = max(dot(d, uMoonDir), 0.0);
    c += mix(vec3(0.4, 0.34, 0.24) * 0.16, vec3(1.0, 0.45, 0.18) * 0.45, uDawn) * pow(m, mix(16.0, 9.0, uDawn));
    c += mix(vec3(0.95, 0.88, 0.7) * 0.6, vec3(1.6, 0.85, 0.4) * 1.0, uDawn) * pow(m, mix(420.0, 220.0, uDawn));
    // the warm band low on the horizon, under the light
    c += mix(vec3(0.1, 0.055, 0.02), vec3(0.55, 0.24, 0.1), uDawn) * exp(-abs(d.y) * 24.0) * (0.2 + 0.8 * pow(m, 4.0));
    return c;
  }
`;

function skyDome(radius, withMoonDisc) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(radius, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { uMoonDir: { value: MOON_DIR }, uDawn: DAWN },
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position.z = gl_Position.w;
        }`,
      fragmentShader: /* glsl */`
        varying vec3 vDir;
        ${SKY_GLSL}
        void main() {
          vec3 d = normalize(vDir);
          vec3 c = skyColor(d);
          ${withMoonDisc ? `
          float m = dot(d, uMoonDir);
          float disc = smoothstep(0.99976, 0.99986, m);
          // a few darker seas on the moon's face
          vec3 t = normalize(cross(uMoonDir, vec3(0.0, 1.0, 0.0)));
          vec3 b = cross(t, uMoonDir);
          vec2 uv = vec2(dot(d, t), dot(d, b)) * 60.0;
          float seas = smoothstep(0.35, 0.0, length(uv - vec2(0.2, 0.25))) * 0.25 + smoothstep(0.25, 0.0, length(uv - vec2(-0.3, -0.15))) * 0.2;
          c = mix(c, mix(vec3(4.2, 3.9, 3.2) * (1.0 - seas), vec3(9.0, 5.2, 2.4), uDawn), disc);` : ''}
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    })
  );
}

function stars(count, radius) {
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const y = 0.03 + Math.pow(Math.random(), 0.8) * 0.97;
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(1 - y * y);
    pos.set([Math.cos(a) * r * radius, y * radius, Math.sin(a) * r * radius], i * 3);
    seed[i] = Math.random();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 }, uPx: { value: 1 }, uDawn: DAWN },
    vertexShader: /* glsl */`
      attribute float seed;
      uniform float uTime, uPx, uDawn;
      varying float vA;
      void main() {
        vA = (0.35 + 0.65 * seed) * (0.6 + 0.4 * sin(uTime * (0.6 + seed * 2.0) + seed * 40.0));
        vA *= smoothstep(0.02, 0.2, normalize(position).y) * (1.0 - uDawn);
        gl_PointSize = (0.8 + seed * seed * 2.2) * uPx;
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p; gl_Position.z = p.w * 0.9999;
      }`,
    fragmentShader: /* glsl */`
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        gl_FragColor = vec4(vec3(1.0, 0.96, 0.88), vA * smoothstep(0.5, 0.0, d));
      }`
  });
  return new THREE.Points(g, m);
}

/* The environment the metal reflects: the sky, the moon, and two warm
   lanterns so the brass picks up a golden edge. */
function environment(renderer, studio) {
  const env = new THREE.Scene();
  env.add(skyDome(50, true));
  if (studio) {
    // softboxes for the coin, so the gold reads as gold and not as night
    const box = (x, y, z, w, h, c) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
      m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m);
    };
    box(-6, 5, 8, 9, 6, new THREE.Color(5, 4.2, 3));
    box(8, -2, 6, 6, 9, new THREE.Color(2.4, 1.6, 0.8));
    box(0, -9, -4, 14, 5, new THREE.Color(0.6, 0.7, 1.0));
    box(0, 4, -10, 12, 8, new THREE.Color(1.2, 1.0, 0.8));
  }
  const lamp = (x, y, z, s, c) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s * 0.6), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  lamp(-14, 6, 8, 10, new THREE.Color(3.2, 1.7, 0.6));
  lamp(16, 3, 10, 7, new THREE.Color(1.6, 0.9, 0.35));
  lamp(0, 22, 0, 18, new THREE.Color(0.18, 0.2, 0.3));
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(env, 0.035).texture;
  pm.dispose();
  return tex;
}

/* ---------- the sea ---------- */

// direction x, direction z, steepness, wavelength (m): a long swell and the
// shorter chop riding on it
const WAVES = [
  [1.0, 0.25, 0.09, 34],
  [0.7, 0.85, 0.1, 21],
  [-0.35, 1.0, 0.09, 13],
  [0.25, -0.7, 0.08, 8],
  [0.95, -0.3, 0.07, 5.2],
  [-0.8, 0.6, 0.06, 3.3],
  [0.4, 0.9, 0.05, 2.1]
];

// The way the hook travels over the water: right and a little towards us,
// so its wake opens out behind it into the distance.
const FLOW_DIR = new THREE.Vector2(1, 0.5).normalize();

// The same waves on the CPU, so floating things ride them. `flow` is how far
// the water has moved past the hook.
function waveAt(x, z, t, flow = 0) {
  const qx = x + flow * FLOW_DIR.x, qz = z + flow * FLOW_DIR.y;
  let px = 0, py = 0, pz = 0;
  for (const [dx0, dz0, st, wl] of WAVES) {
    const l = Math.hypot(dx0, dz0), dx = dx0 / l, dz = dz0 / l;
    const k = (2 * Math.PI) / wl, c = Math.sqrt(9.8 / k), a = st / k;
    const f = k * (dx * qx + dz * qz - c * t);
    px += dx * a * Math.cos(f); py += a * Math.sin(f); pz += dz * a * Math.cos(f);
  }
  return { x: px, y: py, z: pz };
}

function seaGeometry(cols, rows, near, far, halfWidth) {
  // Rows are packed tight near the camera and loose towards the horizon.
  const pos = new Float32Array((cols + 1) * (rows + 1) * 3);
  let i = 0;
  for (let r = 0; r <= rows; r++) {
    const t = r / rows;
    const z = near - (near - far) * Math.pow(t, 2.4);
    const w = halfWidth * (0.25 + Math.pow(t, 1.2) * 0.75);
    for (let c = 0; c <= cols; c++) {
      const g = (c / cols) * 2 - 1;
      pos[i++] = Math.sign(g) * Math.pow(Math.abs(g), 1.6) * w * 2;
      pos[i++] = 0;
      pos[i++] = z;
    }
  }
  const idx = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = r * (cols + 1) + c, b = a + cols + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

/* The small waves, as a tiling map: a height field summed from waves whose
   wave numbers are whole cycles per tile, so it wraps without a seam. RG is
   the slope, A the height (used to break up the foam). It is drawn once on
   the GPU into a render target, so building it never blocks the page. */
function waterNormals(renderer, size = 256) {
  if (renderer.userData?.normals) return renderer.userData.normals;
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const waves = [];
  for (let i = 0; i < 72; i++) {
    const ang = 0.35 + (rnd() - 0.5) * 2.6;
    const k = 2 + Math.pow(rnd(), 1.7) * 34;
    const kx = Math.round(Math.cos(ang) * k), kz = Math.round(Math.sin(ang) * k);
    if (!kx && !kz) continue;
    waves.push([kx, kz, 1 / Math.pow(Math.hypot(kx, kz), 1.45), rnd() * Math.PI * 2]);
  }
  const f = (x) => x.toFixed(6);
  // the slope scale and height range of this set of waves, measured once
  const S = 34.1314, MIN_H = -1.741, MAX_H = 2.8598;
  const rt = new THREE.WebGLRenderTarget(size, size, {
    wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping,
    magFilter: THREE.LinearFilter, minFilter: THREE.LinearMipmapLinearFilter,
    generateMipmaps: true, depthBuffer: false
  });
  rt.texture.anisotropy = 8;
  const mat = new THREE.ShaderMaterial({
    vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: /* glsl */`
      precision highp float;
      float hh = 0.0, gx = 0.0, gz = 0.0;
      vec2 uv;
      void w(float kx, float kz, float a, float p) {
        float ph = 6.2831853 * (kx * uv.x + kz * uv.y) + p;
        float s = sin(ph), c = cos(ph);
        hh += a * (s + 0.25 * s * s);
        gx += a * 6.2831853 * kx * c * (1.0 + 0.5 * s);
        gz += a * 6.2831853 * kz * c * (1.0 + 0.5 * s);
      }
      void main() {
        uv = (gl_FragCoord.xy - 0.5) / ${size}.0;
        ${waves.map(([kx, kz, a, p]) => `w(${f(kx)}, ${f(kz)}, ${f(a)}, ${f(p)});`).join(' ')}
        gl_FragColor = vec4(clamp(0.5 + 0.5 * gx / ${S}, 0.0, 1.0), clamp(0.5 + 0.5 * gz / ${S}, 0.0, 1.0), 0.5, (hh - (${MIN_H})) / (${MAX_H} - (${MIN_H})));
      }`
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  const prev = renderer.getRenderTarget();
  renderer.setRenderTarget(rt);
  renderer.render(quad, new THREE.Camera());
  renderer.setRenderTarget(prev);
  mat.dispose(); quad.geometry.dispose();
  renderer.userData = { ...(renderer.userData || {}), normals: rt.texture };
  return rt.texture;
}

/* The water. Gerstner swell moves the vertices; the tiling map adds the chop;
   the colour is the reflection (a mirror render of the scene when there is
   one, the sky otherwise) over a near-black body, the moon's glitter on top,
   and foam where the hook cuts through. */
function sea(renderer) {
  const waves = WAVES.map(([x, z, s, l]) => new THREE.Vector4(x, z, s, l));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uFlow: { value: 0 },
      uMoonDir: { value: MOON_DIR },
      uDawn: DAWN,
      uWaves: { value: waves },
      uNormals: { value: waterNormals(renderer) },
      uRefl: { value: null },
      uReflMat: { value: new THREE.Matrix4() },
      uHasRefl: { value: 0 },
      uHook: { value: new THREE.Vector4(0, 0, 0, 0) },
      uDir: { value: FLOW_DIR }
    },
    vertexShader: /* glsl */`
      uniform float uTime, uFlow;
      uniform vec2 uDir;
      uniform vec4 uWaves[${WAVES.length}];
      uniform mat4 uReflMat;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vCrest;
      varying vec4 vRefl;
      vec3 gerstner(vec4 w, vec2 p, inout vec3 tang, inout vec3 bin) {
        float k = 6.28318 / w.w;
        float c = sqrt(9.8 / k);
        vec2 d = normalize(w.xy);
        float f = k * (dot(d, p) - c * uTime);
        float a = w.z / k;
        tang += vec3(-d.x * d.x * w.z * sin(f), d.x * w.z * cos(f), -d.x * d.y * w.z * sin(f));
        bin += vec3(-d.x * d.y * w.z * sin(f), d.y * w.z * cos(f), -d.y * d.y * w.z * sin(f));
        return vec3(d.x * a * cos(f), a * sin(f), d.y * a * cos(f));
      }
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vec2 q = wp.xz + uDir * uFlow;
        vec3 tang = vec3(1.0, 0.0, 0.0), bin = vec3(0.0, 0.0, 1.0);
        vec3 o = vec3(0.0);
        for (int i = 0; i < ${WAVES.length}; i++) o += gerstner(uWaves[i], q, tang, bin);
        wp.xyz += o;
        vCrest = o.y;
        vNormal = normalize(cross(bin, tang));
        vWorld = wp.xyz;
        vRefl = uReflMat * wp;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uFlow, uHasRefl;
      uniform vec2 uDir;
      uniform sampler2D uNormals, uRefl;
      uniform vec4 uHook;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vCrest;
      varying vec4 vRefl;
      ${SKY_GLSL}
      vec4 tap(vec2 uv) { vec4 s = texture2D(uNormals, uv); s.xy = s.xy * 2.0 - 1.0; return s; }
      void main() {
        vec3 toCam = cameraPosition - vWorld;
        float dist = length(toCam);
        vec3 V = toCam / dist;
        vec2 q = vWorld.xz + uDir * uFlow;
        float t = uTime;

        // the chop: four scales of the same map, drifting different ways
        vec4 a = tap(q * 0.043 + vec2(t * 0.010, t * 0.004));
        vec4 b = tap(q * 0.107 + vec2(-t * 0.016, t * 0.012));
        vec4 c = tap(q * 0.271 + vec2(t * 0.022, -t * 0.027));
        vec4 d = tap(q * 0.683 + vec2(-t * 0.035, -t * 0.019));
        vec2 slope = a.xy * 0.9 + b.xy * 0.75 + c.xy * 0.55 + d.xy * 0.35 * exp(-dist * 0.04);
        float hgt = (a.a + b.a * 0.8 + c.a * 0.6 + d.a * 0.4) / 2.8;

        // the hook's wake: a turbulent trail behind it and the two arms of a
        // Kelvin wedge (about 19.5°), plus a collar of white water at the shaft
        float wake = 0.0;
        if (uHook.w > 0.0) {
          vec2 rel = (vWorld.xz - uHook.xy) / uHook.w;
          float back = -dot(rel, uDir), side = abs(rel.x * uDir.y - rel.y * uDir.x), r = length(rel);
          float behind = smoothstep(-0.1, 0.35, back);
          float arms = exp(-pow((side - back * 0.354) / (0.07 + back * 0.07), 2.0)) * behind * exp(-back / 4.0) * 0.7;
          float trail = exp(-pow(side / (0.09 + back * 0.08), 2.0)) * behind * exp(-back / 1.8);
          float collar = exp(-pow(max(r - 0.16, 0.0) / (0.09 + max(-back, 0.0) * 0.08), 2.0));
          wake = arms * 0.95 + trail * 1.1 + collar * 1.3;
          slope += vec2(c.x, d.y) * wake * 1.4;
        }

        float strength = mix(0.22, 0.1, smoothstep(10.0, 220.0, dist));
        vec3 n = normalize(vNormal + vec3(-slope.x, 0.0, -slope.y) * strength);
        float ndv = max(dot(n, V), 0.0);
        float fres = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
        vec3 R = reflect(-V, n);
        R.y = abs(R.y);

        vec3 refl;
        if (uHasRefl > 0.5) {
          vec2 ruv = vRefl.xy / vRefl.w + n.xz * 0.11;
          refl = texture2D(uRefl, ruv).rgb;
        } else {
          refl = skyColor(R);
        }

        // the moon on the water: a hard glitter close in that widens into a
        // soft column towards the horizon
        float m = max(dot(R, uMoonDir), 0.0);
        float far = smoothstep(15.0, 260.0, dist);
        float sharp = mix(2600.0, 420.0, far);
        vec3 moonCol = mix(vec3(1.0, 0.82, 0.55), vec3(1.0, 0.6, 0.3), uDawn);
        vec3 glint = moonCol * (pow(m, sharp) * mix(6.5, 2.2, far) + pow(m, 160.0) * 0.26 + pow(m, 24.0) * 0.02);

        vec3 deep = mix(vec3(0.0015, 0.005, 0.011), vec3(0.012, 0.02, 0.035), uDawn);
        // a little light through the backs of the waves facing the moon
        vec3 body = deep + vec3(0.004, 0.016, 0.02) * clamp(vCrest * 0.9 + 0.35, 0.0, 1.1) * (0.5 + hgt);
        vec3 col = mix(body, min(refl, vec3(6.0)), fres) + glint * (1.0 - 0.45 * uDawn);

        // white water: the wake, and a few breaking crests close by
        float near = exp(-dist * 0.03);
        float foamMask = smoothstep(0.5, 0.78, hgt + wake * 0.3) * clamp(wake, 0.0, 1.0) * 0.8;
        foamMask += smoothstep(0.55, 0.85, vCrest) * smoothstep(0.62, 0.8, hgt) * 0.5 * near;
        vec3 foamCol = vec3(0.23, 0.26, 0.3) + moonCol * pow(max(dot(n, normalize(uMoonDir + V)), 0.0), 8.0) * 0.25;
        col = mix(col, foamCol, clamp(foamMask, 0.0, 0.85));

        // haze towards the horizon
        vec3 hd = normalize(vec3(-V.x, 0.0, -V.z));
        float fog = 1.0 - exp(-dist * 0.0055);
        col = mix(col, skyColor(normalize(hd + vec3(0.0, 0.012, 0.0))), fog);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const mesh = new THREE.Mesh(seaGeometry(small ? 140 : 240, small ? 170 : 280, 24, -900, 900), mat);
  mesh.frustumCulled = false;
  return mesh;
}

/* ---------- clouds ---------- */

// A layer of cloud on a flattened dome over the sea: dark undersides, and
// silver to gold edges where the moon is behind them. Drawn after the stars,
// so it hides them, and over the moon, so it can pass in front of it.
function cloudDome(radius) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      uniforms: { uMoonDir: { value: MOON_DIR }, uTime: { value: 0 }, uDawn: DAWN },
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position.z = gl_Position.w * 0.99995;
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uMoonDir;
        uniform float uTime, uDawn;
        varying vec3 vDir;
        float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
        }
        const mat2 ROT = mat2(1.6, 1.2, -1.2, 1.6);
        float fbm(vec2 p) {
          float s = 0.0, a = 0.5;
          for (int i = 0; i < 5; i++) { s += a * noise(p); p = ROT * p; a *= 0.5; }
          return s;
        }
        float fbm4(vec2 p) {
          float s = 0.0, a = 0.5;
          for (int i = 0; i < 3; i++) { s += a * noise(p); p = ROT * p; a *= 0.5; }
          return s;
        }
        vec2 plane(vec3 d) { return d.xz / (d.y + 0.035) * 0.55; }
        float cover(vec3 d) {
          // a bank of cloud low on the horizon, heaviest to the right of the
          // moon, and only rags of it higher up
          float low = 1.0 - smoothstep(0.03, 0.2, d.y);
          float right = smoothstep(0.05, 0.55, d.x);
          return 0.66 - 0.17 * low * (0.45 + right) - 0.05 * right;
        }
        float density(vec2 p, float cv) { return smoothstep(cv, cv + 0.28, fbm(p)); }
        void main() {
          vec3 d = normalize(vDir);
          if (d.y < 0.008) discard;
          vec2 drift = vec2(uTime * 0.006, uTime * 0.0015);
          vec2 p = plane(d) + drift;
          float cv = cover(d);
          float den = density(p, cv);
          if (den < 0.004) discard;
          // light from the moon: step towards the moon's place on the cloud
          // plane and see how much cloud is in the way
          vec2 mp = plane(uMoonDir) + drift;
          vec2 step = normalize(mp - p) * 0.05;
          float occ = 0.0;
          for (int i = 1; i <= 3; i++) occ += smoothstep(cv, cv + 0.28, fbm4(p + step * float(i))) * 1.33;
          float lit = exp(-occ * 1.1);
          float m = max(dot(d, uMoonDir), 0.0);
          float phase = 0.03 + uDawn * 0.12 + pow(m, 6.0) * 0.5 + pow(m, 40.0) * 2.2 + pow(m, 300.0) * 6.0;
          vec3 under = mix(vec3(0.006, 0.009, 0.018), vec3(0.06, 0.035, 0.05), uDawn);
          vec3 edge = mix(mix(vec3(0.65, 0.7, 0.85), vec3(1.0, 0.72, 0.42), smoothstep(0.6, 0.98, m)), vec3(1.0, 0.55, 0.3), uDawn);
          vec3 col = under + edge * lit * phase * (1.15 - den * 0.7);
          float alpha = den * smoothstep(0.008, 0.045, d.y) * 0.96;
          gl_FragColor = vec4(col, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    })
  );
  mesh.renderOrder = 2;
  mesh.frustumCulled = false;
  return mesh;
}

/* ---------- mirror ---------- */

// The scene seen from under the water's surface, for the sea to reflect.
function mirror(renderer) {
  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 0 });
  const cam = new THREE.PerspectiveCamera();
  const clip = [new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.02)];
  const N = new THREE.Vector3(0, 1, 0);
  const view = new THREE.Vector3(), target = new THREE.Vector3(), look = new THREE.Vector3(), rot = new THREE.Matrix4();
  const camPos = new THREE.Vector3();
  const bias = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  const texMat = new THREE.Matrix4();
  return {
    texture: rt.texture,
    matrix: texMat,
    clip,
    render(scene, camera, hide, scale) {
      const size = renderer.getDrawingBufferSize(new THREE.Vector2());
      const w = Math.max(4, Math.round(size.x * scale)), h = Math.max(4, Math.round(size.y * scale));
      if (rt.width !== w || rt.height !== h) rt.setSize(w, h);
      camPos.setFromMatrixPosition(camera.matrixWorld);
      view.set(camPos.x, -camPos.y, camPos.z);
      rot.extractRotation(camera.matrixWorld);
      look.set(0, 0, -1).applyMatrix4(rot).add(camPos);
      target.set(look.x, -look.y, look.z);
      cam.position.copy(view);
      cam.up.set(0, 1, 0).applyMatrix4(rot).reflect(N);
      cam.lookAt(target);
      cam.far = camera.far;
      cam.updateMatrixWorld();
      cam.projectionMatrix.copy(camera.projectionMatrix);
      texMat.copy(bias).multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse);
      hide.forEach((o) => { o.visible = false; });
      const prevClip = renderer.clippingPlanes, prevRT = renderer.getRenderTarget();
      renderer.clippingPlanes = clip;
      renderer.setRenderTarget(rt);
      renderer.clear();
      renderer.render(scene, cam);
      renderer.setRenderTarget(prevRT);
      renderer.clippingPlanes = prevClip;
      hide.forEach((o) => { o.visible = true; });
    }
  };
}

/* ---------- spray ---------- */

// Droplets thrown up where the hook's shaft cuts the water.
function spray(count) {
  const pos = new Float32Array(count * 3), life = new Float32Array(count);
  const vel = new Float32Array(count * 3), age = new Float32Array(count), ttl = new Float32Array(count);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('life', new THREE.BufferAttribute(life, 1));
  const pts = new THREE.Points(g, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uPx: { value: 1 }, uSize: { value: 1 } },
    vertexShader: /* glsl */`
      attribute float life;
      uniform float uPx, uSize;
      varying float vA;
      void main() {
        vA = life;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = uSize * uPx * (0.6 + life * 0.8) * 30.0 / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        gl_FragColor = vec4(vec3(0.75, 0.8, 0.88) * 0.9, vA * smoothstep(0.5, 0.1, d));
      }`
  }));
  pts.frustumCulled = false;
  for (let i = 0; i < count; i++) age[i] = ttl[i] = 1;
  let acc = 0;
  pts.userData.update = (dt, at, s, waterY, rate) => {
    acc += dt * rate;
    for (let i = 0; i < count && acc >= 1; i++) {
      if (age[i] < ttl[i]) continue;
      acc -= 1;
      // mostly off the leading edge, flung up, forward and to the sides
      const side = (Math.random() - 0.5) * 2;
      const ang = Math.random() * Math.PI * 2;
      const fx = FLOW_DIR.x, fz = FLOW_DIR.y;
      pos[i * 3] = at.x + Math.cos(ang) * 0.17 * s + fx * 0.08 * s;
      pos[i * 3 + 1] = waterY + 0.02 * s;
      pos[i * 3 + 2] = at.z + Math.sin(ang) * 0.17 * s + fz * 0.08 * s;
      const fwd = (0.25 + Math.random() * 0.6) * s, lat = side * 0.55 * s;
      vel[i * 3] = fx * fwd - fz * lat;
      vel[i * 3 + 1] = (0.5 + Math.random() * 1.1) * s;
      vel[i * 3 + 2] = fz * fwd + fx * lat;
      age[i] = 0; ttl[i] = 0.35 + Math.random() * 0.5;
    }
    acc = Math.min(acc, 1);
    for (let i = 0; i < count; i++) {
      if (age[i] >= ttl[i]) { life[i] = 0; continue; }
      age[i] += dt;
      vel[i * 3 + 1] -= 4.2 * s * dt;
      pos[i * 3] += vel[i * 3] * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      life[i] = Math.max(0, 1 - age[i] / ttl[i]);
    }
    g.attributes.position.needsUpdate = true;
    g.attributes.life.needsUpdate = true;
  };
  return pts;
}

/* ---------- the hook ---------- */

// Sweep a circle along a curve, with the radius varying along it.
function sweep(curve, radius, steps, sides) {
  const frames = curve.computeFrenetFrames(steps, false);
  const pos = [], nor = [], idx = [];
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    curve.getPointAt(u, p);
    const r = radius(u);
    for (let j = 0; j <= sides; j++) {
      const v = (j / sides) * Math.PI * 2;
      n.copy(frames.normals[i]).multiplyScalar(-Math.cos(v)).addScaledVector(frames.binormals[i], Math.sin(v)).normalize();
      pos.push(p.x + r * n.x, p.y + r * n.y, p.z + r * n.z);
      nor.push(n.x, n.y, n.z);
    }
  }
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < sides; j++) {
      const a = i * (sides + 1) + j, b = a + sides + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

function hookModel() {
  // A captain's hook, the classic shape: a thick polished steel hook tapering
  // to a sharp point, a brass ferrule, and a dark leather cup with a brass
  // band and one row of big rivets. Nothing else.
  const group = new THREE.Group();
  const steel = new THREE.MeshPhysicalMaterial({ color: 0xF2F0EC, metalness: 1, roughness: 0.09, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 2.2 });
  const brass = new THREE.MeshPhysicalMaterial({ color: 0xF0B850, metalness: 1, roughness: 0.18, clearcoat: 0.5, envMapIntensity: 1.8 });
  const leather = new THREE.MeshPhysicalMaterial({ color: 0x4A2A16, roughness: 0.58, clearcoat: 0.2, clearcoatRoughness: 0.5, sheen: 0.4, sheenColor: 0xB07040, envMapIntensity: 0.7 });

  // up out of the ferrule, a wide round curl, and a point that turns back up
  const curve = new THREE.CatmullRomCurve3([
    [0, -0.9, 0], [0, -0.2, 0], [0, 0.5, 0], [0.05, 0.98, 0], [0.3, 1.36, 0], [0.72, 1.48, 0],
    [1.12, 1.28, 0], [1.3, 0.86, 0], [1.33, 0.36, 0], [1.31, -0.1, 0]
  ].map((v) => new THREE.Vector3(...v)), false, 'centripetal');
  group.add(new THREE.Mesh(sweep(curve, (u) => {
    if (u < 0.78) return 0.135;
    const t = (u - 0.78) / 0.22;
    return 0.135 * Math.max(0.02, Math.pow(1 - t, 0.7));
  }, 400, 48), steel));

  // profiles are written top to bottom; the lathe wants them bottom to top
  // for its faces to point outwards
  const lathe = (pts, mat) => {
    const m = new THREE.Mesh(new THREE.LatheGeometry(pts.slice().reverse().map(([r, y]) => new THREE.Vector2(r, y)), 128), mat);
    group.add(m);
    return m;
  };
  // ferrule: a short brass collar with a bead at the top
  lathe([[0.14, -0.78], [0.2, -0.8], [0.22, -0.84], [0.2, -0.88], [0.18, -0.9], [0.18, -1.02], [0.23, -1.05], [0.23, -1.12], [0.2, -1.14]], brass);
  // the cup: a smooth bell of leather, rolled at the rim
  lathe([[0.2, -1.14], [0.24, -1.24], [0.31, -1.44], [0.42, -1.68], [0.53, -1.9], [0.565, -1.99], [0.575, -2.04], [0.56, -2.08], [0.52, -2.1], [0.0, -2.1]], leather);
  // the underside: matte and dark, so it never catches the light
  const base = new THREE.Mesh(new THREE.CircleGeometry(0.53, 64), new THREE.MeshStandardMaterial({ color: 0x120a05, roughness: 1 }));
  base.rotation.x = Math.PI / 2; base.position.y = -2.104;
  group.add(base);
  // a brass band near the rim and one row of big domed rivets above it
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.556, 0.026, 16, 128), brass);
  band.rotation.x = Math.PI / 2; band.position.y = -1.95;
  group.add(band);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const r = 0.47;
    const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.045, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), brass);
    rivet.position.set(Math.cos(a) * r, -1.68, Math.sin(a) * r);
    // sit flat on the sloped leather
    rivet.lookAt(Math.cos(a) * 3, -1.68 + 1.2, Math.sin(a) * 3);
    rivet.rotateX(Math.PI / 2);
    group.add(rivet);
  }
  group.children.forEach((c) => { c.position.x -= 0.6; });
  return group;
}

/* ---------- the ship ---------- */

function shipModel() {
  const ship = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x1c130c, roughness: 0.85 });
  const cloth = new THREE.MeshStandardMaterial({ color: 0x3a3a40, roughness: 1, side: THREE.DoubleSide });
  const s = new THREE.Shape();
  s.moveTo(-4.2, 1.4); s.lineTo(3.4, 1.4); s.lineTo(4.6, 2.2); s.lineTo(4.4, 1.0);
  s.quadraticCurveTo(3.6, -0.6, 0, -0.7); s.quadraticCurveTo(-3.4, -0.6, -4.0, 0.4); s.lineTo(-4.4, 2.4); s.lineTo(-3.4, 2.4); s.lineTo(-3.4, 1.4);
  const hull = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 2.0, bevelEnabled: true, bevelThickness: 0.3, bevelSize: 0.2, bevelSegments: 3 }), wood);
  hull.position.z = -1.0;
  ship.add(hull);
  const mast = (x, h) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, h, 8), wood);
    m.position.set(x, 1.4 + h / 2, 0);
    ship.add(m);
    return m;
  };
  const sail = (x, y, w, h) => {
    const g = new THREE.PlaneGeometry(w, h, 8, 6);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i) / (w / 2), v = p.getY(i) / (h / 2);
      p.setZ(i, (1 - u * u) * (1 - v * v * 0.6) * w * 0.18);
    }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, cloth);
    m.rotation.y = Math.PI / 2 + 0.25;
    m.position.set(x, y, 0);
    ship.add(m);
  };
  mast(-1.8, 6.5); mast(0.6, 8); mast(2.6, 5.5);
  sail(-1.8, 4.3, 2.6, 2.0); sail(-1.8, 6.5, 2.0, 1.4);
  sail(0.6, 4.6, 3.0, 2.4); sail(0.6, 7.2, 2.3, 1.6);
  sail(2.6, 4.2, 2.0, 1.8);
  const bow = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 3.2, 6), wood);
  bow.rotation.z = -1.0; bow.position.set(5.6, 3.0, 0);
  ship.add(bow);
  // lanterns at the stern and in the cabin windows
  const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 2.2, 0.7) });
  [[-4.0, 2.8, 0], [-3.0, 1.9, 1.05], [-2.3, 1.9, 1.05], [-1.6, 1.9, 1.05]].forEach(([x, y, z]) => {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), glow);
    l.position.set(x, y, z);
    ship.add(l);
  });
  return ship;
}

/* ---------- the coin ---------- */

// The UnyHooks mark (brand/mark.d.txt), in a 3000-unit square.
const MARK_D = 'M 1486 -17 C 1415 -11,1355 39,1337 107 C 1331 128,1332 125,1331 194 L 1330 258 1328 262 C 1325 268,1320 272,1314 275 C 1310 277,1308 278,1246 278 C 1180 279,1180 279,1161 284 C 1097 300,1047 356,1038 422 C 1037 428,1037 498,1037 654 C 1037 805,1037 881,1036 885 C 1035 893,1031 899,1026 903 C 1017 910,1018 910,955 910 C 894 910,885 911,869 915 C 803 932,756 983,744 1049 C 742 1060,742 1062,741 1195 C 741 1305,741 1329,740 1330 C 739 1331,701 1331,602 1331 L 466 1330 456 1328 C 383 1312,333 1258,322 1186 C 319 1165,319 1007,322 996 C 327 976,341 961,361 954 C 366 953,373 953,418 952 C 446 952,471 951,474 950 C 541 938,594 890,610 826 C 615 804,615 813,615 584 C 615 375,615 371,617 364 C 622 342,639 326,660 322 C 667 320,676 320,711 320 C 765 320,779 318,805 308 C 918 262,946 113,857 29 C 781 -43,657 -29,600 60 C 588 79,580 98,575 124 C 574 126,573 155,573 192 L 572 256 570 262 C 567 268,561 273,556 276 C 552 277,546 278,488 278 C 451 278,422 279,419 280 C 417 280,411 281,407 282 C 347 296,295 349,282 409 C 281 414,280 420,279 422 C 279 423,278 529,278 656 L 278 888 275 893 C 274 896,271 900,268 902 C 260 910,264 909,193 910 C 158 910,127 911,124 912 C 50 925,-4 981,-16 1056 C -18 1070,-18 1930,-16 1944 C -4 2019,50 2075,124 2088 C 127 2089,158 2090,193 2090 L 256 2090 261 2093 C 267 2095,273 2102,276 2108 C 277 2111,278 2129,278 2344 C 278 2471,279 2577,279 2578 C 280 2580,281 2586,282 2591 C 295 2651,347 2704,407 2718 C 411 2719,417 2720,419 2720 C 422 2721,451 2722,488 2722 C 546 2722,552 2723,556 2724 C 561 2727,567 2732,570 2738 L 572 2744 573 2808 C 573 2845,574 2874,575 2876 C 580 2902,588 2921,600 2940 C 657 3029,781 3043,857 2971 C 946 2887,918 2738,805 2692 C 779 2682,765 2680,711 2680 C 676 2680,667 2680,660 2678 C 639 2674,622 2658,617 2636 C 615 2629,615 2625,615 2416 C 615 2187,615 2196,610 2174 C 594 2110,541 2062,474 2050 C 471 2049,446 2048,418 2048 C 373 2047,366 2047,361 2046 C 341 2039,327 2024,322 2004 C 319 1993,319 1835,322 1814 C 333 1742,383 1688,456 1672 L 466 1670 602 1669 C 701 1669,739 1669,740 1670 C 741 1671,741 1695,741 1805 C 742 1938,742 1940,744 1951 C 756 2017,803 2068,869 2085 C 885 2089,894 2090,955 2090 C 1018 2090,1017 2090,1026 2097 C 1031 2101,1035 2107,1036 2115 C 1037 2119,1037 2195,1037 2346 C 1037 2502,1037 2572,1038 2578 C 1047 2644,1097 2700,1161 2716 C 1180 2721,1180 2721,1246 2722 C 1308 2722,1310 2723,1314 2725 C 1320 2728,1325 2732,1328 2738 L 1330 2742 1331 2806 C 1332 2875,1331 2872,1337 2893 C 1363 2993,1479 3046,1573 3001 C 1617 2980,1651 2939,1663 2893 C 1669 2872,1668 2875,1669 2806 L 1670 2742 1672 2738 C 1675 2732,1680 2728,1686 2725 C 1690 2723,1692 2722,1754 2722 C 1820 2721,1820 2721,1839 2716 C 1903 2700,1953 2644,1962 2578 C 1963 2572,1963 2502,1963 2346 C 1963 2195,1963 2119,1964 2115 C 1965 2107,1969 2101,1974 2097 C 1983 2090,1982 2090,2045 2090 C 2106 2090,2115 2089,2131 2085 C 2197 2068,2244 2017,2256 1951 C 2258 1940,2258 1938,2259 1805 C 2259 1695,2259 1671,2260 1670 C 2261 1669,2299 1669,2398 1669 L 2534 1670 2544 1672 C 2617 1688,2667 1742,2678 1814 C 2681 1835,2681 1993,2678 2004 C 2673 2024,2659 2039,2639 2046 C 2634 2047,2627 2047,2582 2048 C 2554 2048,2529 2049,2526 2050 C 2459 2062,2406 2110,2390 2174 C 2385 2196,2385 2187,2385 2416 C 2385 2625,2385 2629,2383 2636 C 2378 2658,2361 2674,2340 2678 C 2333 2680,2324 2680,2289 2680 C 2235 2680,2221 2682,2195 2692 C 2082 2738,2054 2887,2143 2971 C 2219 3043,2343 3029,2400 2940 C 2412 2921,2420 2902,2425 2876 C 2426 2874,2427 2845,2427 2808 L 2428 2744 2430 2738 C 2433 2732,2439 2727,2444 2724 C 2448 2723,2454 2722,2512 2722 C 2549 2722,2578 2721,2581 2720 C 2583 2720,2589 2719,2593 2718 C 2653 2704,2705 2651,2718 2591 C 2719 2586,2720 2580,2721 2578 C 2721 2577,2722 2471,2722 2344 C 2722 2129,2723 2111,2724 2108 C 2727 2102,2733 2095,2739 2093 L 2744 2090 2807 2090 C 2842 2090,2873 2089,2876 2088 C 2950 2075,3004 2019,3016 1944 C 3018 1930,3018 1070,3016 1056 C 3004 981,2950 925,2876 912 C 2873 911,2842 910,2807 910 C 2736 909,2740 910,2732 902 C 2729 900,2726 896,2725 893 L 2722 888 2722 656 C 2722 529,2721 423,2721 422 C 2720 420,2719 414,2718 409 C 2705 349,2653 296,2593 282 C 2589 281,2583 280,2581 280 C 2578 279,2549 278,2512 278 C 2454 278,2448 277,2444 276 C 2439 273,2433 268,2430 262 L 2428 256 2427 192 C 2427 155,2426 126,2425 124 C 2420 98,2412 79,2400 60 C 2343 -29,2219 -43,2143 29 C 2054 113,2082 262,2195 308 C 2221 318,2235 320,2289 320 C 2324 320,2333 320,2340 322 C 2361 326,2378 342,2383 364 C 2385 371,2385 375,2385 584 C 2385 813,2385 804,2390 826 C 2406 890,2459 938,2526 950 C 2529 951,2554 952,2582 952 C 2627 953,2634 953,2639 954 C 2659 961,2673 976,2678 996 C 2681 1007,2681 1165,2678 1186 C 2667 1258,2617 1312,2544 1328 L 2534 1330 2398 1331 C 2299 1331,2261 1331,2260 1330 C 2259 1329,2259 1305,2259 1195 C 2258 1062,2258 1060,2256 1049 C 2244 983,2197 932,2131 915 C 2115 911,2106 910,2045 910 C 1982 910,1983 910,1974 903 C 1969 899,1965 893,1964 885 C 1963 881,1963 805,1963 654 C 1963 498,1963 428,1962 422 C 1953 356,1903 300,1839 284 C 1820 279,1820 279,1754 278 C 1692 278,1690 277,1686 275 C 1680 272,1675 268,1672 262 L 1670 258 1669 194 C 1668 125,1669 128,1663 107 C 1643 30,1566 -24,1486 -17 M 1418 321 C 1397 326,1379 344,1375 365 C 1374 368,1374 441,1374 578 C 1374 715,1374 791,1373 798 C 1366 875,1309 937,1233 950 C 1230 951,1205 952,1176 952 L 1126 953 1118 955 C 1100 962,1089 972,1082 989 L 1080 996 1080 1090 L 1080 1184 1082 1195 C 1097 1264,1147 1314,1215 1328 L 1226 1330 1500 1330 L 1774 1330 1785 1328 C 1853 1314,1903 1264,1918 1195 L 1920 1184 1920 1090 L 1920 996 1918 989 C 1911 972,1900 962,1882 955 L 1874 953 1824 952 C 1795 952,1770 951,1767 950 C 1691 937,1634 875,1627 798 C 1626 791,1626 715,1626 578 C 1626 445,1626 368,1625 365 C 1622 347,1606 329,1587 323 L 1580 321 1502 320 C 1440 320,1423 320,1418 321 M 1228 1670 C 1158 1676,1098 1731,1082 1805 L 1080 1816 1080 1910 L 1080 2004 1082 2011 C 1089 2028,1100 2038,1118 2045 L 1126 2047 1176 2048 C 1205 2048,1230 2049,1233 2050 C 1309 2063,1366 2125,1373 2202 C 1374 2209,1374 2285,1374 2422 C 1374 2555,1374 2632,1375 2635 C 1378 2653,1395 2671,1413 2677 L 1420 2680 1500 2680 L 1580 2680 1587 2677 C 1605 2671,1622 2653,1625 2635 C 1626 2632,1626 2555,1626 2422 C 1626 2285,1626 2209,1627 2202 C 1634 2125,1691 2063,1767 2050 C 1770 2049,1795 2048,1824 2048 L 1874 2047 1882 2045 C 1900 2038,1911 2028,1918 2011 L 1920 2004 1920 1910 L 1920 1816 1918 1805 C 1903 1736,1854 1687,1786 1672 L 1776 1670 1504 1669 C 1355 1669,1231 1669,1228 1670';

// One face of the doubloon as a bump map: grey is the field, white is raised.
// The front carries the UnyHooks mark and "$UHOOKS"; the back, Uniswap's unicorn.
function coinFaceTexture(side) {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const g = c.getContext('2d');
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 8;
  t.center.set(0.5, 0.5);
  t.rotation = Math.PI / 2;
  const legend = (word, r, size) => {
    g.font = `700 ${size}px Georgia, serif`; g.fillStyle = '#f2f2f2'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 0; i < word.length; i++) {
      const a = -Math.PI / 2 + ((i - word.length / 2) / word.length) * Math.PI * 2;
      g.save(); g.rotate(a + Math.PI / 2); g.translate(0, -r); g.fillText(word[i], 0, 0); g.restore();
    }
  };
  // letters along the top arc only, centred, `span` degrees wide
  const arc = (word, r, size, span) => {
    g.font = `700 ${size}px Georgia, serif`; g.fillStyle = '#f2f2f2'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const step = (span / Math.max(1, word.length - 1)) * Math.PI / 180;
    for (let i = 0; i < word.length; i++) {
      const a = (i - (word.length - 1) / 2) * step;
      g.save(); g.rotate(a); g.translate(0, -r); g.fillText(word[i], 0, 0); g.restore();
    }
  };
  g.fillStyle = '#808080'; g.fillRect(0, 0, 1024, 1024);
  g.translate(512, 512);
  // raised rim and a beaded ring on both faces
  g.strokeStyle = '#fff'; g.lineWidth = 44; g.beginPath(); g.arc(0, 0, 470, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#e6e6e6';
  for (let i = 0; i < 72; i++) { const a = (i / 72) * Math.PI * 2; g.beginPath(); g.arc(Math.cos(a) * 405, Math.sin(a) * 405, 9, 0, Math.PI * 2); g.fill(); }
  if (side === 'front') {
    g.save(); g.translate(-150, -195); g.scale(0.1, 0.1);
    g.fillStyle = '#fff';
    g.fill(new Path2D(MARK_D), 'evenodd');
    g.restore();
    g.font = '700 92px Georgia, serif'; g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('$UHOOKS', 0, 215);
    arc('ROBINHOOD CHAIN', 335, 52, 120);
  } else {
    legend('BUILT ON UNISWAP V4 · BUILT ON UNISWAP V4 · ', 335, 46);
    // Uniswap's mark, struck in relief: its pink pixels become raised metal
    const img = new Image();
    img.onload = () => {
      const k = document.createElement('canvas');
      k.width = k.height = 256;
      const kg = k.getContext('2d');
      kg.drawImage(img, 0, 0, 256, 256);
      const d = kg.getImageData(0, 0, 256, 256);
      for (let i = 0; i < d.data.length; i += 4) {
        const [r, gg, b] = [d.data[i], d.data[i + 1], d.data[i + 2]];
        const pink = r > 170 && gg < 140 && b > 120 ? Math.min(1, (r - gg) / 200) : 0;
        d.data[i] = d.data[i + 1] = d.data[i + 2] = 255; d.data[i + 3] = Math.round(pink * 255);
      }
      kg.putImageData(d, 0, 0);
      g.drawImage(k, -270, -270, 540, 540);
      t.needsUpdate = true;
    };
    img.src = new URL('uniswap.png', document.baseURI).href;
  }
  return t;
}

function coinEdgeTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 16;
  const g = c.getContext('2d');
  for (let x = 0; x < 1024; x += 8) { g.fillStyle = '#fff'; g.fillRect(x, 0, 4, 16); g.fillStyle = '#555'; g.fillRect(x + 4, 0, 4, 16); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping; t.repeat.set(3, 1);
  return t;
}

function coinModel() {
  const front = coinFaceTexture('front');
  const back = coinFaceTexture('back');
  const edge = coinEdgeTexture();
  const gold = (bump, scale) => new THREE.MeshPhysicalMaterial({ color: 0xF0B848, metalness: 1, roughness: 0.24, bumpMap: bump, bumpScale: scale, clearcoat: 0.5, clearcoatRoughness: 0.2, envMapIntensity: 1.4 });
  const coin = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.16, 160, 1), [gold(edge, 0.8), gold(front, 1.6), gold(back, 1.6)]);
  coin.rotation.x = Math.PI / 2;
  const g = new THREE.Group();
  g.add(coin);
  return g;
}

/* ---------- a scene on a canvas ---------- */

function makeRenderer(canvas, alpha, maxRatio) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha, powerPreference: 'high-performance' });
  if (softwareGL(r.getContext())) { r.dispose(); throw new Error('software renderer'); }
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxRatio));
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 0.8;
  return r;
}

function fit(renderer, camera, canvas) {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return false;
  const size = renderer.getSize(new THREE.Vector2());
  if (size.x !== w || size.y !== h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  return true;
}

// Run draw(t) every frame while the canvas is on screen.
function loop(canvas, draw) {
  let on = false, raf = 0, t0 = performance.now();
  const tick = (now) => {
    raf = 0;
    draw((now - t0) / 1000);
    if (on && !still) raf = requestAnimationFrame(tick);
  };
  new IntersectionObserver(([e]) => {
    on = e.isIntersecting;
    if (on && !raf) raf = requestAnimationFrame(tick);
  }, { rootMargin: '100px' }).observe(canvas);
  draw(still ? 6 : 0);
}

const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
window.addEventListener('pointermove', (e) => {
  pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
}, { passive: true });

/* ---------- the story: one sea behind the whole page ---------- */

/* Camera shots, one per chapter of the page ([data-shot] sections). The hook
   stands at the origin and ploughs along FLOW_DIR; each shot is a camera
   position and the point it looks at, plus how far into dawn the sky is.
   Scrolling between two chapters blends their shots. */
const SHOTS = {
  // the opening: the hook off to the right, the moon above it
  hero: { pos: [-2.7, 0.95, 7.2], look: [-2.9, 1.55, -10], dawn: 0,
    // narrow screens: the hook small and high, above the words
    portrait: { pos: [-0.9, 1.2, 12.5], look: [0.2, -0.75, 0] } },
  // down at the waterline beside it
  close: { pos: [-3.6, 0.6, 4.1], look: [-1.2, 1.15, -1.4], dawn: 0 },
  // ahead of it, looking back along its wake
  front: { pos: [4.7, 1.25, 4.5], look: [-2.2, 1.05, 1.0], dawn: 0 },
  // high above, the wake drawn out behind it
  aerial: { pos: [-3.2, 7.5, 6.6], look: [-3.8, 0, -1.9], dawn: 0.05 },
  // the end of the night: the sun on the horizon, the hook off to the side
  dawn: { pos: [-1.6, 1.5, 7.8], look: [-6.0, 2.4, -10], dawn: 1 }
};

const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const ease = (t) => t * t * (3 - 2 * t);

function storyScene(canvas) {
  const renderer = makeRenderer(canvas, false, 1.5);
  // ?hq=1 keeps the full treatment on a narrow screen (rendering the video)
  let hq = !small || /[?&]hq=1/.test(location.search);
  const dbg = new URLSearchParams(location.search).get('dbg') || '';
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 2000);
  scene.environment = environment(renderer);
  scene.add(skyDome(1000, true));
  const sky = stars(small ? 700 : 1400, 900);
  sky.material.uniforms.uPx.value = renderer.getPixelRatio();
  scene.add(sky);
  const clouds = cloudDome(980);
  scene.add(clouds);
  const water = sea(renderer);
  scene.add(water);
  const hemi = new THREE.HemisphereLight(0x5a6c90, 0x05070c, 0.4);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight(0xffe2b8, 1.8);
  scene.add(moon);
  const ship = shipModel();
  scene.add(ship);
  ship.visible = !dbg.includes('noship');

  const mir = mirror(renderer);
  water.material.uniforms.uRefl.value = mir.texture;
  water.material.uniforms.uReflMat.value = mir.matrix;

  // the hook, its chrome reflecting what is really around it
  const S = 1.1;
  const hook = hookModel();
  hook.scale.setScalar(S);
  let cube = null, cubeRT = null, panels = [];
  const studio = () => environment(renderer, true);
  if (hq) {
    cubeRT = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType });
    cube = new THREE.CubeCamera(0.1, 2000, cubeRT);
    cube.children.forEach((c) => c.layers.enable(2));
    scene.add(cube);
    // softboxes only the cube camera sees, so the chrome reads as chrome
    const panel = (w, h, c, at) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
      m.layers.set(2);
      m.position.set(at[0], 0.9 * S + at[1], at[2]);
      m.lookAt(0, 0.9 * S, 0);
      scene.add(m);
      return m;
    };
    panels = [
      panel(14, 6, new THREE.Color(1.6, 1.5, 1.4), [-6, 7, 8]),
      panel(8, 10, new THREE.Color(0.5, 0.6, 0.85), [9, 2, 6]),
      panel(20, 4, new THREE.Color(0.25, 0.28, 0.35), [0, 12, -2])
    ];
    hook.traverse((o) => { if (o.material) { o.material.envMap = cubeRT.texture; o.material.envMapIntensity = 1.6; } });
  } else {
    const env = studio();
    hook.traverse((o) => { if (o.material) o.material.envMap = env; });
  }
  scene.add(hook);
  const drops = spray(small ? 90 : 220);
  drops.material.uniforms.uPx.value = renderer.getPixelRatio();
  scene.add(drops);
  const rim = new THREE.SpotLight(0xffe6c4, 45, 40, 0.5, 0.6, 2);
  rim.position.set(3.5 * S, 3 * S + 1.2, -2.5 * S);
  rim.target = hook;
  scene.add(rim);
  const fill = new THREE.PointLight(0x8aa4d8, 6, 20, 2);
  fill.position.set(-2.5 * S, 1.2 * S, 3 * S);
  scene.add(fill);

  let composer = null;
  if (hq && !dbg.includes('nobloom')) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.2, 0.45, 1.2));
    composer.addPass(new OutputPass());
  }

  /* Where the page is: which two chapters the middle of the screen sits
     between, and how far from one to the other. */
  const chapters = [...document.querySelectorAll('[data-shot]')];
  const labels = [...document.querySelectorAll('[data-label3d]')];
  const portrait = () => canvas.clientHeight > canvas.clientWidth * 1.05;
  // ?cam=x,y,z,lx,ly,lz: a fixed camera, for rendering stills (brand images)
  const camParam = (new URLSearchParams(location.search).get('cam') || '').split(',').map(Number);
  const shotFor = (name) => {
    if (camParam.length === 6 && camParam.every(Number.isFinite)) return { pos: V3(camParam.slice(0, 3)), look: V3(camParam.slice(3)), dawn: 0 };
    const s = SHOTS[name] || SHOTS.hero;
    if (portrait() && s.portrait) return { pos: V3(s.portrait.pos), look: V3(s.portrait.look), dawn: s.dawn };
    const pos = V3(s.pos), look = V3(s.look);
    if (portrait()) {
      // narrow screens: stand further back, face the hook, and keep it in the
      // top half so the words can sit below it
      const at = new THREE.Vector3(0, 0.9 * S, 0);
      pos.sub(at).multiplyScalar(1.45).add(at);
      look.lerp(at, 0.75);
      look.y -= 0.9;
    }
    return { pos, look, dawn: s.dawn };
  };
  const where = () => {
    const mid = window.innerHeight / 2;
    let i = 0, f = 0;
    const centers = chapters.map((c) => { const r = c.getBoundingClientRect(); return r.top + r.height / 2; });
    if (mid <= centers[0]) return { i: 0, f: 0, x: 0 };
    for (i = 0; i < centers.length - 1; i++) {
      if (mid < centers[i + 1]) { f = (mid - centers[i]) / (centers[i + 1] - centers[i]); break; }
    }
    if (i >= centers.length - 1) return { i: centers.length - 1, f: 0, x: centers.length - 1 };
    return { i, f, x: i + f };
  };

  const pos = new THREE.Vector3(), look = new THREE.Vector3(), tmp = new THREE.Vector3();
  const shaft = new THREE.Vector3(), top = new THREE.Vector3(), wakePt = new THREE.Vector3();
  const u = water.material.uniforms;
  let flow = 0, last = 0, frame = 0, lastW = 0, lastH = 0;
  // 2: everything, 1: no bloom and a lower resolution, 0: no mirror or live chrome
  let level = hq ? 2 : 0, settled = false, stage = 0, cubeFrame = 0, measured = 0, slowCount = 0, gaveUp = false;
  const times = [];
  let smoothX = null;

  const draw = (t) => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    // keep the drawing buffer to a sane size on very large screens
    const ratio = Math.min(window.devicePixelRatio || 1, level > 1 ? 1.3 : 1, Math.sqrt((level > 1 ? 2.0e6 : 1.2e6) / (w * h)));
    if (Math.abs(renderer.getPixelRatio() - ratio) > 0.01) renderer.setPixelRatio(ratio);
    fit(renderer, camera, canvas);
    if (composer && (w !== lastW || h !== lastH || composer._ratio !== ratio)) {
      lastW = w; lastH = h; composer._ratio = ratio;
      composer.setPixelRatio(ratio);
      composer.setSize(w, h);
    }
    const dt = Math.min(0.1, Math.max(0, t - last)); last = t;

    // the camera eases towards where the scroll says it should be
    const at = where();
    smoothX = smoothX === null || still ? at.x : smoothX + (at.x - smoothX) * Math.min(1, dt * 4);
    const i = Math.min(chapters.length - 1, Math.floor(smoothX)), f = ease(smoothX - i);
    const a = shotFor(chapters[i].dataset.shot), b = shotFor(chapters[Math.min(chapters.length - 1, i + 1)].dataset.shot);
    pos.copy(a.pos).lerp(b.pos, f);
    look.copy(a.look).lerp(b.look, f);
    DAWN.value = a.dawn + (b.dawn - a.dawn) * f;

    // a little life in the hand-held camera, and the pointer's pull
    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;
    pos.x += Math.sin(t * 0.31) * 0.05 + pointer.x * 0.3;
    pos.y += Math.sin(t * 0.43) * 0.03 - pointer.y * 0.12;
    camera.position.copy(pos);
    camera.lookAt(look.x + pointer.x * 0.5, look.y, look.z);
    camera.updateMatrixWorld();

    // night to dawn: the light moves from the moon to the rising sun
    MOON_DIR.copy(NIGHT_DIR).lerp(SUN_DIR, DAWN.value).normalize();
    moon.position.copy(MOON_DIR).multiplyScalar(50);
    moon.color.setRGB(1, 0.89 - DAWN.value * 0.25, 0.72 - DAWN.value * 0.35);
    hemi.intensity = 0.4 + DAWN.value * 0.5;

    // the hook ploughs on: the sea streams past it and its wake trails away
    flow += (still ? 0 : 1.25 * S) * dt;
    u.uTime.value = t;
    u.uFlow.value = flow;
    sky.material.uniforms.uTime.value = t;
    clouds.material.uniforms.uTime.value = t;

    const sx = { x: 26 + Math.sin(t * 0.03) * 5, z: -170 };
    const w0 = waveAt(sx.x, sx.z, t, flow), w1 = waveAt(sx.x + 3, sx.z, t, flow), w2 = waveAt(sx.x, sx.z + 1.5, t, flow);
    ship.position.set(sx.x, w0.y * 0.8 - 0.3, sx.z);
    ship.rotation.set((w2.y - w0.y) * 0.25, 2.6, (w1.y - w0.y) * 0.12);
    ship.scale.setScalar(1.1);

    const weave = Math.sin(t * 0.23) * 0.3 * S;
    const wv = waveAt(0, weave, t, flow), wa = waveAt(0.6, weave, t, flow), wb = waveAt(-0.6, weave, t, flow);
    hook.position.set(0, 0.35 * S + wv.y * 0.9, weave);
    hook.rotation.set(Math.sin(t * 0.5) * 0.03, Math.atan2(-FLOW_DIR.y, FLOW_DIR.x) + 0.1 + Math.cos(t * 0.23) * 0.15, -0.06 - (wa.y - wb.y) * 0.35);
    hook.updateMatrixWorld();
    shaft.set(-0.6, -0.35, 0); hook.localToWorld(shaft);
    u.uHook.value.set(shaft.x, shaft.z, 0, S);
    drops.userData.update(dt, shaft, S, wv.y, still ? 0 : 160);

    if (cube && hq && stage >= 3 && (cubeFrame++ % 45 === 0)) {
      cube.position.set(0.1 * S, 0.9 * S, weave);
      hook.visible = false; drops.visible = false;
      u.uHasRefl.value = 0;
      cube.update(renderer, scene);
      hook.visible = true; drops.visible = true;
    }

    if (hq && stage >= 1) {
      // the hook is left out of the mirror: on choppy water its reflection
      // breaks into streaks that read as lightning, not as metal
      mir.render(scene, camera, [water, drops, hook], level > 1 ? 0.4 : 0.3);
      u.uHasRefl.value = dbg.includes('nomirror') ? 0 : 1;
      if (composer && level > 1 && stage >= 2) composer.render(); else renderer.render(scene, camera);
    } else {
      u.uHasRefl.value = 0;
      renderer.render(scene, camera);
    }

    // labels pinned to points in the scene, shown in their own chapter
    top.set(0.62, 1.55, 0); hook.localToWorld(top);
    wakePt.set(shaft.x - FLOW_DIR.x * 3.2 * S, 0.05, shaft.z - FLOW_DIR.y * 3.2 * S);
    const pts = { top, shaft, wake: wakePt };
    for (const el of labels) {
      const p3 = pts[el.dataset.label3d] || top;
      tmp.copy(p3).project(camera);
      const sec = el.closest('[data-shot]');
      const ch = chapters.indexOf(sec);
      // only while its own chapter fills most of the screen
      const r = sec.getBoundingClientRect();
      const shown = Math.max(0, Math.min(r.bottom, h) - Math.max(r.top, 0)) / h;
      const near = Math.max(0, 1 - Math.abs(smoothX - ch) * 2.2) * Math.min(1, Math.max(0, (shown - 0.55) / 0.3));
      const onScreen = tmp.z < 1 && Math.abs(tmp.x) < 1.1 && Math.abs(tmp.y) < 1.1;
      el.style.opacity = onScreen ? near.toFixed(3) : '0';
      // keep the whole label on screen
      const lw = el._w || (el._w = el.offsetWidth);
      const lx = Math.min((tmp.x + 1) / 2 * w, w - lw - 34);
      el.style.transform = `translate(${lx.toFixed(1)}px, ${((1 - tmp.y) / 2 * h).toFixed(1)}px)`;
    }

    frame++;
    // A slow GPU steps down rather than stutter: first the bloom and part of
    // the resolution, then the mirror and the live chrome.
    if (!hq && !gaveUp && !still && ++slowCount > 30) {
      // the lightest version: if even this can't keep up, the video takes over
      times.push(dt * 1000);
      if (times.length === 40) {
        times.sort((p, q) => p - q);
        if (times[20] > 45) { gaveUp = true; visible = 0; no3d(); }
        times.length = 0;
        slowCount = -1e9;
      }
    }
    if (stage >= 3 && ++measured > 20 && level > 0 && !settled && !still) {
      times.push(dt * 1000);
      if (times.length === 40) {
        times.sort((p, q) => p - q);
        if (times[20] > 21) {
          level--;
          if (level === 0) {
            hq = false;
            if (cubeRT) { const env = studio(); hook.traverse((o) => { if (o.material) o.material.envMap = env; }); }
            panels.forEach((m) => scene.remove(m));
          }
        } else settled = true;
        times.length = 0;
      }
    }
    document.documentElement.classList.add('is-3d');
  };

  // draw while any chapter is on screen; the page's solid sections cover it
  let visible = 0, raf = 0, ready = false;
  let t0 = performance.now();
  const tick = (now) => {
    raf = 0;
    draw((now - t0) / 1000);
    if (visible > 0 && !still && !gaveUp) raf = requestAnimationFrame(tick);
  };
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { e.target._on = e.isIntersecting; });
    visible = chapters.filter((c) => c._on).length;
    if (ready && visible > 0 && !raf && !gaveUp) raf = requestAnimationFrame(tick);
    if (!visible) labels.forEach((el) => { el.style.opacity = '0'; });
  });
  chapters.forEach((c) => io.observe(c));
  // reduced motion: one still per scroll position
  if (still) window.addEventListener('scroll', () => { if (ready && !raf) raf = requestAnimationFrame(tick); }, { passive: true });
  // Compile every shader before the first frame, off the main thread where
  // the browser can, so starting the scene never freezes the page. Until then
  // the page shows a still of this same shot.
  // Then the extras come in one at a time, each compiled before it is used:
  // the mirror (its clipped variants of every material), the bloom, and last
  // the live chrome reflections.
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const extras = async () => {
    if (!hq) return;
    await wait(300);
    if (renderer.compileAsync) {
      renderer.clippingPlanes = mir.clip;
      try { await renderer.compileAsync(scene, camera); } finally { renderer.clippingPlanes = []; }
    }
    stage = 1;
    await wait(500);
    stage = 2;
    await wait(700);
    stage = 3;
  };
  const go = () => {
    ready = true;
    t0 = performance.now();
    if (rendering) return;
    if (!raf) raf = requestAnimationFrame(tick);
    extras().catch(() => { stage = 3; });
  };
  // ?render=1: no loop; scripts/media/render-sea.js asks for each frame at a
  // fixed time step and records the still frames into the fallback video.
  const rendering = /[?&]render=1/.test(location.search);
  if (rendering) {
    window.__uhFrame = (t) => { draw(t); return true; };
    window.__uhReady = (async () => {
      if (hq && renderer.compileAsync) {
        renderer.clippingPlanes = mir.clip;
        try { await renderer.compileAsync(scene, camera); } finally { renderer.clippingPlanes = []; }
      }
      stage = 3; settled = true;
      return true;
    })();
  }
  fit(renderer, camera, canvas);
  if (renderer.compileAsync) renderer.compileAsync(scene, camera).then(go, go); else go();
}

function coinScene(canvas) {
  const renderer = makeRenderer(canvas, true, 2);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0, 4.6);
  scene.environment = environment(renderer, true);
  const key = new THREE.DirectionalLight(0xfff0d0, 2.2);
  key.position.set(-2, 3, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x8aa0ff, 1.2);
  rim.position.set(3, -1, -2);
  scene.add(rim);
  const coin = coinModel();
  scene.add(coin);
  let spin = 0, last = 0;
  loop(canvas, (t) => {
    if (!fit(renderer, camera, canvas)) return;
    const dt = Math.min(0.05, t - last); last = t;
    spin += dt * 0.6;
    coin.rotation.set(0.2 + Math.sin(t * 0.8) * 0.08 - pointer.y * 0.25, spin + pointer.x * 0.5, Math.sin(t * 0.5) * 0.06);
    coin.position.y = Math.sin(t * 1.1) * 0.06;
    renderer.render(scene, camera);
    canvas.parentElement.classList.add('is-3d');
  });
}

/* ---------- start ---------- */

// No GPU (a software renderer) would make every frame cost the whole page,
// so those visitors keep the still. Checked on the scene's own context, so no
// extra one is created just to ask. ?3d=force overrides it.
function webgl() {
  return 'WebGL2RenderingContext' in window || 'WebGLRenderingContext' in window;
}
function softwareGL(gl) {
  if (/[?&]3d=force/.test(location.search)) return false;
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
  return /swiftshader|llvmpipe|softpipe|software/i.test(name);
}

// Each scene is built only when its canvas comes within a screen of view, so
// the page's first paint never waits on the scenes further down.
const start = (canvas) => {
  try {
    const kind = canvas.dataset.scene;
    if (kind === 'story') {
      // after the page has loaded and gone quiet: the still covers until then
      const run = () => { try { storyScene(canvas); } catch (err) { console.warn('3D scene unavailable:', err && err.message); no3d(); } };
      const idle = () => ('requestIdleCallback' in window ? requestIdleCallback(run, { timeout: 1200 }) : setTimeout(run, 50));
      if (document.readyState === 'complete') idle(); else window.addEventListener('load', idle, { once: true });
    }
    else if (kind === 'coin') coinScene(canvas);
  } catch (err) {
    // put the still back
    console.warn('3D scene unavailable:', err && err.message);
    if (canvas.dataset.scene === 'story') no3d();
  }
};

// The page hides the still of the sea from the first paint when it expects 3D
// (html.uh-3d-on); without WebGL, or if the story scene fails, it comes back.
function no3d() {
  document.documentElement.classList.remove('uh-3d-on', 'is-3d');
  window.dispatchEvent(new Event('uh-3d-off'));
}
window.__uh3d = true;

if (!webgl()) no3d();
else {
  const near = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      near.unobserve(e.target);
      start(e.target);
    });
  }, { rootMargin: '100% 0px' });
  document.querySelectorAll('canvas[data-scene]').forEach((c) => near.observe(c));
}
