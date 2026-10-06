/* UnyHooks — the 3D scenes on the landing page (three.js, WebGL).

   Three canvases, each drawn only while it is on screen:

     [data-scene="hero"]   a night sea with rolling swell, the moon and its
                           glitter on the water, a galleon on the horizon and a
                           brass hook rising out of the water where the page's
                           .uh-orb box sits
     [data-scene="coin"]   the $UHOOKS doubloon, turning in the moonlight
     [data-scene="sea"]    the same sea under the closing call, with the ship
                           sailing across

   Each canvas sits on top of the page's 2D drawing of the same thing. The 2D
   drawing stays until the first 3D frame is ready (the container gets
   .is-3d), so without WebGL nothing changes. With prefers-reduced-motion one
   still frame is drawn and nothing moves.

   Built into ../scene3d.js with esbuild (npm run build:3d). */

import * as THREE from 'three';

const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const small = window.matchMedia('(max-width: 760px)').matches;

/* ---------- shared: the night sky ---------- */

const MOON_DIR = new THREE.Vector3(0.3, 0.13, -1).normalize();

const SKY_GLSL = /* glsl */`
  uniform vec3 uMoonDir;
  vec3 skyColor(vec3 d) {
    float h = clamp(d.y, 0.0, 1.0);
    vec3 zenith = vec3(0.003, 0.007, 0.02);
    vec3 horizon = vec3(0.026, 0.038, 0.07);
    vec3 c = mix(horizon, zenith, pow(h, 0.4));
    float m = max(dot(d, uMoonDir), 0.0);
    c += vec3(0.4, 0.34, 0.24) * pow(m, 16.0) * 0.16;
    c += vec3(0.95, 0.88, 0.7) * pow(m, 420.0) * 0.6;
    // the warm band low on the horizon, under the moon
    c += vec3(0.1, 0.055, 0.02) * exp(-abs(d.y) * 24.0) * (0.2 + 0.8 * pow(m, 4.0));
    return c;
  }
`;

function skyDome(radius, withMoonDisc) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(radius, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { uMoonDir: { value: MOON_DIR } },
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
          c = mix(c, vec3(4.2, 3.9, 3.2) * (1.0 - seas), disc);` : ''}
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
    uniforms: { uTime: { value: 0 }, uPx: { value: 1 } },
    vertexShader: /* glsl */`
      attribute float seed;
      uniform float uTime, uPx;
      varying float vA;
      void main() {
        vA = (0.35 + 0.65 * seed) * (0.6 + 0.4 * sin(uTime * (0.6 + seed * 2.0) + seed * 40.0));
        vA *= smoothstep(0.02, 0.2, normalize(position).y);
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

// direction x, direction z, steepness, wavelength (m)
const WAVES = [
  [1.0, 0.25, 0.12, 26],
  [0.7, 0.85, 0.14, 15],
  [-0.35, 1.0, 0.12, 8.5],
  [0.25, -0.7, 0.09, 4.6]
];

// The same waves on the CPU, so floating things ride them.
function waveAt(x, z, t) {
  let px = x, py = 0, pz = z;
  for (const [dx0, dz0, st, wl] of WAVES) {
    const l = Math.hypot(dx0, dz0), dx = dx0 / l, dz = dz0 / l;
    const k = (2 * Math.PI) / wl, c = Math.sqrt(9.8 / k), a = st / k;
    const f = k * (dx * x + dz * z - c * t);
    px += dx * a * Math.cos(f); py += a * Math.sin(f); pz += dz * a * Math.cos(f);
  }
  return { x: px - x, y: py, z: pz - z };
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

function sea() {
  const waves = WAVES.map(([x, z, s, l]) => new THREE.Vector4(x, z, s, l));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uMoonDir: { value: MOON_DIR }, uWaves: { value: waves } },
    vertexShader: /* glsl */`
      uniform float uTime;
      uniform vec4 uWaves[4];
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vCrest;
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
        vec3 p = position;
        vec3 tang = vec3(1.0, 0.0, 0.0), bin = vec3(0.0, 0.0, 1.0);
        vec3 o = vec3(0.0);
        for (int i = 0; i < 4; i++) o += gerstner(uWaves[i], p.xz, tang, bin);
        p += o;
        vCrest = o.y;
        vNormal = normalize(cross(bin, tang));
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vCrest;
      ${SKY_GLSL}
      void main() {
        vec3 toCam = cameraPosition - vWorld;
        float dist = length(toCam);
        vec3 V = toCam / dist;
        // small ripples on top of the swell, fading out with distance so they don't shimmer
        vec2 q = vWorld.xz;
        float fade = exp(-dist * 0.025);
        vec3 n = normalize(vNormal + fade * vec3(
          sin(q.x * 1.9 + uTime * 1.4) * 0.06 + sin(q.x * 3.7 - q.y * 2.9 + uTime * 2.3) * 0.045 + sin(q.x * 7.3 + q.y * 5.1 - uTime * 3.1) * 0.025,
          0.0,
          cos(q.y * 2.1 - uTime * 1.2) * 0.06 + sin(q.y * 4.3 + q.x * 1.7 + uTime * 1.9) * 0.04 + cos(q.y * 8.1 - q.x * 3.3 + uTime * 2.7) * 0.022));
        float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
        vec3 R = reflect(-V, n);
        R.y = abs(R.y);
        vec3 sky = skyColor(R);
        float m = max(dot(R, uMoonDir), 0.0);
        // the moon's path: a tight glint and a broad sheen, both warm
        vec3 glint = vec3(1.0, 0.84, 0.55) * (pow(m, 2200.0) * 70.0 + pow(m, 300.0) * 1.2 + pow(m, 40.0) * 0.035);
        vec3 deep = vec3(0.002, 0.008, 0.017);
        vec3 body = deep + vec3(0.003, 0.018, 0.026) * clamp(vCrest * 1.2 + 0.4, 0.0, 1.2);
        vec3 col = mix(body, sky, fres) + glint;
        // foam on the sharpest crests close by
        col += vec3(0.05, 0.065, 0.08) * smoothstep(0.6, 0.9, vCrest) * fade;
        // haze towards the horizon
        vec3 hd = normalize(vec3(-V.x, 0.0, -V.z));
        float fog = 1.0 - exp(-dist * 0.0065);
        col = mix(col, skyColor(normalize(hd + vec3(0.0, 0.01, 0.0))), fog);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const mesh = new THREE.Mesh(seaGeometry(small ? 140 : 220, small ? 170 : 260, 24, -900, 900), mat);
  mesh.frustumCulled = false;
  return mesh;
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
  // A captain's hook as it would be worn: a forged steel hook screwed into a
  // brass ferrule, a stitched leather cup with brass rivets, and the cuff of a
  // red coat with gold braid and a lace ruffle. The sleeve fades out below.
  const group = new THREE.Group();
  const steel = new THREE.MeshPhysicalMaterial({ color: 0xE4E0D8, metalness: 1, roughness: 0.14, clearcoat: 0.6, clearcoatRoughness: 0.1, envMapIntensity: 1.3 });
  const brass = new THREE.MeshPhysicalMaterial({ color: 0xE8B04B, metalness: 1, roughness: 0.22, envMapIntensity: 1.2 });
  const leather = new THREE.MeshPhysicalMaterial({ color: 0x3B2416, roughness: 0.55, clearcoat: 0.35, clearcoatRoughness: 0.5, sheen: 0.4, sheenColor: 0x8a5a3a });
  const fade = (() => {
    const c = document.createElement('canvas'); c.width = 4; c.height = 256;
    const g = c.getContext('2d'), gr = g.createLinearGradient(0, 256, 0, 0);
    gr.addColorStop(0, '#000'); gr.addColorStop(0.55, '#fff'); gr.addColorStop(1, '#fff');
    g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
    return new THREE.CanvasTexture(c);
  })();
  const velvet = new THREE.MeshPhysicalMaterial({ color: 0x8E1B1B, roughness: 0.75, sheen: 1, sheenRoughness: 0.45, sheenColor: 0xff7a6a, alphaMap: fade, transparent: true });
  const lace = new THREE.MeshPhysicalMaterial({ color: 0xF4EFE4, roughness: 0.9, sheen: 0.6, sheenColor: 0xffffff, side: THREE.DoubleSide });

  // the hook: up out of the ferrule, over, and down to a point turned back up
  const curve = new THREE.CatmullRomCurve3([
    [0, -1.05, 0], [0, -0.3, 0], [0, 0.35, 0], [0.04, 0.82, 0], [0.3, 1.2, 0], [0.7, 1.3, 0],
    [1.05, 1.06, 0], [1.16, 0.62, 0], [1.04, 0.2, 0], [0.8, -0.04, 0], [0.56, -0.05, 0], [0.44, 0.1, 0]
  ].map((v) => new THREE.Vector3(...v)), false, 'centripetal');
  group.add(new THREE.Mesh(sweep(curve, (u) => {
    if (u < 0.5) return 0.115;
    const t = (u - 0.5) / 0.5;
    return 0.115 * Math.max(0.015, 1 - Math.pow(t, 1.35));
  }, 360, 36), steel));

  // brass ferrule and collar
  const lathe = (pts, mat, seg = 96) => {
    const m = new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg), mat);
    group.add(m);
    return m;
  };
  lathe([[0.1, -0.95], [0.15, -0.98], [0.15, -1.12], [0.19, -1.16], [0.19, -1.24], [0.16, -1.27]], brass);

  // the leather cup, flaring down to the cuff
  const cupR = (y) => 0.17 + (Math.min(-1.27, Math.max(-2.05, y)) + 1.27) / (-0.78) * 0.3;
  lathe([[0.16, -1.27], [0.2, -1.4], [0.29, -1.7], [0.42, -1.98], [0.47, -2.05], [0.47, -2.12], [0.44, -2.14]], leather);
  for (let row = 0; row < 2; row++) {
    const y = row ? -1.88 : -1.55;
    const r = row ? 0.395 : 0.25;
    const n = row ? 14 : 10;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + row * 0.2;
      const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 8), brass);
      rivet.position.set(Math.cos(a) * (r + 0.012), y, Math.sin(a) * (r + 0.012));
      group.add(rivet);
    }
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.035, 16, 96), brass);
  ring.rotation.x = Math.PI / 2; ring.position.y = -2.08;
  group.add(ring);

  // the lace ruffle: a frilled collar between the cup and the sleeve
  const frill = new THREE.RingGeometry(0.4, 0.74, 200, 5);
  const fp = frill.attributes.position;
  for (let i = 0; i < fp.count; i++) {
    const x = fp.getX(i), z = fp.getY(i), r = Math.hypot(x, z), a = Math.atan2(z, x);
    const o = (r - 0.4) / 0.34;
    // the lace droops over the sleeve and ripples in soft folds
    fp.setXYZ(i, x * (1 - o * 0.12), -o * o * 0.34 + Math.sin(a * 26) * 0.05 * o + Math.sin(a * 9 + 1) * 0.025 * o, z * (1 - o * 0.12));
  }
  frill.computeVertexNormals();
  const ruffle = new THREE.Mesh(frill, lace);
  ruffle.position.y = -2.14;
  group.add(ruffle);

  // the coat sleeve with gold braid, fading away below
  lathe([[0.62, -3.4], [0.6, -2.9], [0.58, -2.5], [0.56, -2.3], [0.5, -2.22], [0.36, -2.2]], velvet);
  [[-2.36, 0.565], [-2.5, 0.582]].forEach(([y, r]) => {
    const b = new THREE.Mesh(new THREE.TorusGeometry(r, 0.022, 10, 120), brass);
    b.rotation.x = Math.PI / 2; b.position.y = y;
    group.add(b);
  });
  [-0.35, 0, 0.35].forEach((a, i) => {
    const btn = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), brass);
    btn.position.set(Math.sin(a + 0.4) * 0.6, -2.66 - i * 0.02, Math.cos(a + 0.4) * 0.6);
    group.add(btn);
  });

  group.children.forEach((c) => { c.position.x -= 0.45; });
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

function coinFaceTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const g = c.getContext('2d');
  g.fillStyle = '#808080'; g.fillRect(0, 0, 1024, 1024);
  g.translate(512, 512);
  // raised rim, a beaded ring, the hook, the legend
  g.strokeStyle = '#fff'; g.lineWidth = 44; g.beginPath(); g.arc(0, 0, 470, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#e6e6e6';
  for (let i = 0; i < 72; i++) { const a = (i / 72) * Math.PI * 2; g.beginPath(); g.arc(Math.cos(a) * 405, Math.sin(a) * 405, 9, 0, Math.PI * 2); g.fill(); }
  g.save(); g.scale(6.2, 6.2); g.translate(-30.5, -46);
  g.fillStyle = '#fff';
  g.fill(new Path2D('M22.5 62V27A13.5 13.5 0 0 1 49.5 27C49.5 35.5 45.5 41 38.5 43.5C43 38.8 44.5 33.5 44.5 27A8.5 8.5 0 0 0 27.5 27V62Z'));
  g.fill(new Path2D('M18 63h14l6.2 12.6a1.6 1.6 0 0 1-1.4 2.4H13.2a1.6 1.6 0 0 1-1.4-2.4z'));
  g.restore();
  g.font = '700 64px Georgia, serif'; g.fillStyle = '#f2f2f2'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const word = 'UNYHOOKS · ROBINHOOD CHAIN · ';
  for (let i = 0; i < word.length; i++) {
    const a = -Math.PI / 2 + ((i - word.length / 2) / word.length) * Math.PI * 2;
    g.save(); g.rotate(a + Math.PI / 2); g.translate(0, -335); g.fillText(word[i], 0, 0); g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 8;
  t.center.set(0.5, 0.5);
  t.rotation = Math.PI / 2;
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
  const face = coinFaceTexture();
  const edge = coinEdgeTexture();
  const gold = (bump, scale) => new THREE.MeshPhysicalMaterial({ color: 0xF0B848, metalness: 1, roughness: 0.24, bumpMap: bump, bumpScale: scale, clearcoat: 0.5, clearcoatRoughness: 0.2, envMapIntensity: 1.4 });
  const coin = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.16, 160, 1), [gold(edge, 0.8), gold(face, 1.6), gold(face, 1.6)]);
  coin.rotation.x = Math.PI / 2;
  const g = new THREE.Group();
  g.add(coin);
  return g;
}

/* ---------- a scene on a canvas ---------- */

function makeRenderer(canvas, alpha, maxRatio) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha, powerPreference: 'high-performance' });
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxRatio));
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 0.95;
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

function seaScene(canvas, opts) {
  const renderer = makeRenderer(canvas, false, 1.5);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(opts.fov || 40, 1, 0.1, 2000);
  scene.environment = environment(renderer);
  scene.add(skyDome(1000, true));
  const sky = stars(small ? 700 : 1400, 900);
  sky.material.uniforms.uPx.value = renderer.getPixelRatio();
  scene.add(sky);
  const water = sea();
  scene.add(water);
  scene.add(new THREE.HemisphereLight(0x5a6c90, 0x05070c, 0.5));
  const moon = new THREE.DirectionalLight(0xdfe6ff, 1.6);
  moon.position.copy(MOON_DIR).multiplyScalar(50);
  scene.add(moon);

  const ship = shipModel();
  scene.add(ship);

  let hook = null, warm = null;
  if (opts.hook) {
    hook = hookModel();
    scene.add(hook);
    warm = new THREE.PointLight(0xffa64a, 18, 30, 2);
    scene.add(warm);
  }

  const ray = new THREE.Raycaster();
  const anchor = opts.anchor;
  let camY = opts.cam[1];
  const place = () => {
    if (!hook || !anchor) return;
    // Put the hook where the page's box for it is: a point along the ray
    // through the box's centre, hovering a little above the swell.
    const cr = canvas.getBoundingClientRect(), ar = anchor.getBoundingClientRect();
    const ndc = new THREE.Vector2(((ar.left + ar.width / 2 - cr.left) / cr.width) * 2 - 1, -(((ar.top + ar.height * 0.52 - cr.top) / cr.height) * 2 - 1));
    ray.setFromCamera(ndc, camera);
    const want = Math.min(ar.height, ar.width * 1.15) * 0.92 / cr.height;
    // The model is 4.75 tall with its centre 0.98 below its origin, and it
    // floats with its lowest point 0.8 above the water: its centre sits at
    // 0.8 + 2.42·s. At distance d the screen holds 2·d·tan(fov/2), so d = s/k;
    // the camera's height is what puts that centre on the ray through the box.
    const k = (want * 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / 4.75;
    const s = 0.75;
    const d = s / k;
    const dir = ray.ray.direction;
    camY = 0.8 + 2.42 * s + Math.max(0.01, -dir.y) * d;
    const p = new THREE.Vector3(camera.position.x + dir.x * d, 0, camera.position.z + dir.z * d);
    hook.userData.base = { x: p.x, z: p.z, s };
    hook.scale.setScalar(s);
  };

  const draw = (t) => {
    if (!fit(renderer, camera, canvas)) return;
    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;
    camera.position.set(opts.cam[0] + pointer.x * 0.35, camY - pointer.y * 0.15, opts.cam[2]);
    camera.lookAt(opts.look[0] + pointer.x * 0.6, camY + opts.look[1] - opts.cam[1], opts.look[2]);
    camera.updateMatrixWorld();
    if (hook && !hook.userData.base) place();
    water.material.uniforms.uTime.value = t;
    sky.material.uniforms.uTime.value = t;

    // the ship rides the swell
    const sx = opts.ship(t);
    const w0 = waveAt(sx.x, sx.z, t), w1 = waveAt(sx.x + 3, sx.z, t), w2 = waveAt(sx.x, sx.z + 1.5, t);
    ship.position.set(sx.x, w0.y * 0.8 - 0.3, sx.z);
    ship.rotation.set((w2.y - w0.y) * 0.25, sx.heading, (w1.y - w0.y) * 0.12);
    ship.scale.setScalar(sx.scale);

    if (hook) {
      const b = hook.userData.base;
      const w = waveAt(b.x, b.z, t);
      const bob = Math.sin(t * 0.8) * 0.08 + w.y * 0.12;
      hook.position.set(b.x, 0.8 + 3.4 * b.s + bob, b.z);
      hook.rotation.set(0.06 + Math.sin(t * 0.45) * 0.03, -0.3 + Math.sin(t * 0.25) * 0.5 + pointer.x * 0.35, -0.05 + Math.sin(t * 0.6) * 0.04);
      warm.position.set(b.x - 2.5 * b.s, 2.2 * b.s + 1, b.z + 3 * b.s);
    }
    renderer.render(scene, camera);
    canvas.parentElement.classList.add('is-3d');
  };
  window.addEventListener('resize', () => { if (hook) { hook.userData.base = null; } });
  loop(canvas, draw);
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

function webgl() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch (_) { return false; }
}

if (webgl()) {
  document.querySelectorAll('canvas[data-scene]').forEach((canvas) => {
    try {
      const kind = canvas.dataset.scene;
      if (kind === 'hero') {
        seaScene(canvas, {
          hook: true,
          anchor: document.querySelector(canvas.dataset.anchor || '.uh-orb'),
          cam: [0, 1.9, 8], look: [0, 1.25, -10],
          ship: (t) => ({ x: 22 + Math.sin(t * 0.03) * 5, z: -160, heading: 2.6, scale: 1.1 })
        });
      } else if (kind === 'sea') {
        seaScene(canvas, {
          fov: 38,
          cam: [0, 2.2, 8], look: [-3.5, 6.4, -10],
          ship: (t) => ({ x: ((t * 1.4 + 40) % 140) - 70, z: -72, heading: 0, scale: 1 })
        });
      } else if (kind === 'coin') {
        coinScene(canvas);
      }
    } catch (err) {
      // leave the 2D drawing in place
      console.warn('3D scene unavailable:', err && err.message);
    }
  });
}
