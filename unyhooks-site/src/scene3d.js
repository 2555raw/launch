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
  // A captain's hook, the classic shape: a thick polished steel hook tapering
  // to a sharp point, a brass ferrule, and a dark leather cup with a brass
  // band and one row of big rivets. Nothing else.
  const group = new THREE.Group();
  const steel = new THREE.MeshPhysicalMaterial({ color: 0xF2F0EC, metalness: 1, roughness: 0.09, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 2.2 });
  const brass = new THREE.MeshPhysicalMaterial({ color: 0xF0B850, metalness: 1, roughness: 0.18, clearcoat: 0.5, envMapIntensity: 1.8 });
  const leather = new THREE.MeshPhysicalMaterial({ color: 0x4A2A16, roughness: 0.58, clearcoat: 0.2, clearcoatRoughness: 0.5, sheen: 0.4, sheenColor: 0xB07040, envMapIntensity: 0.7 });

  // up out of the ferrule, a wide round curl, and a point that turns back up
  const curve = new THREE.CatmullRomCurve3([
    [0, -0.9, 0], [0, -0.2, 0], [0, 0.5, 0], [0.06, 0.95, 0], [0.32, 1.32, 0], [0.74, 1.42, 0],
    [1.12, 1.2, 0], [1.26, 0.76, 0], [1.14, 0.3, 0], [0.86, 0.02, 0], [0.56, 0.0, 0], [0.4, 0.16, 0]
  ].map((v) => new THREE.Vector3(...v)), false, 'centripetal');
  group.add(new THREE.Mesh(sweep(curve, (u) => {
    if (u < 0.45) return 0.15;
    const t = (u - 0.45) / 0.55;
    return 0.15 * Math.max(0.012, Math.pow(1 - t, 0.85));
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

// One face of the doubloon as a bump map: grey is the field, white is raised.
// The front carries the hook and "$UHOOKS"; the back, Uniswap's unicorn.
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
    g.save(); g.scale(4.4, 4.4); g.translate(-30.5, -60);
    g.fillStyle = '#fff';
    g.fill(new Path2D('M22.5 62V27A13.5 13.5 0 0 1 49.5 27C49.5 35.5 45.5 41 38.5 43.5C43 38.8 44.5 33.5 44.5 27A8.5 8.5 0 0 0 27.5 27V62Z'));
    g.fill(new Path2D('M18 63h14l6.2 12.6a1.6 1.6 0 0 1-1.4 2.4H13.2a1.6 1.6 0 0 1-1.4-2.4z'));
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

  let hook = null, warm = null, ripple = null;
  if (opts.hook) {
    hook = hookModel();
    // the hook reflects a lit studio rather than the night, so the steel reads as steel
    const studio = environment(renderer, true);
    hook.traverse((o) => { if (o.material) o.material.envMap = studio; });
    scene.add(hook);
    ripple = new THREE.Mesh(new THREE.RingGeometry(0.16, 1.6, 128, 6), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: { uTime: { value: 0 } },
      vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: /* glsl */`
        uniform float uTime; varying vec2 vP;
        void main() {
          float r = length(vP);
          float rings = pow(0.5 + 0.5 * sin(r * 22.0 - uTime * 3.2), 6.0);
          float a = smoothstep(1.6, 0.25, r) * smoothstep(0.16, 0.24, r);
          float foam = smoothstep(0.32, 0.17, r);
          gl_FragColor = vec4(vec3(0.85, 0.88, 0.9), a * rings * 0.22 + foam * 0.35);
        }`
    }));
    ripple.rotation.x = -Math.PI / 2;
    scene.add(ripple);
    warm = new THREE.PointLight(0xffb060, 26, 30, 2);
    scene.add(warm);
    const rim = new THREE.SpotLight(0xdfe8ff, 60, 40, 0.5, 0.6, 2);
    rim.target = hook;
    hook.userData.rim = rim;
    scene.add(rim);
  }

  const ray = new THREE.Raycaster();
  const anchor = opts.anchor;
  let camY = opts.cam[1];
  const place = () => {
    if (!hook || !anchor) return;
    // Put the hook where the page's box for it is: a point along the ray
    // through the box's centre, hovering a little above the swell.
    const cr = canvas.getBoundingClientRect(), ar = anchor.getBoundingClientRect();
    const ndc = new THREE.Vector2(((ar.left + ar.width / 2 - cr.left) / cr.width) * 2 - 1, -(((ar.top + ar.height * 0.56 - cr.top) / cr.height) * 2 - 1));
    ray.setFromCamera(ndc, camera);
    const want = Math.min(ar.height, ar.width * 1.15) * 0.5 / cr.height;
    // The hook stands half under water: the sea cuts its shaft at the model's
    // y = -0.35, so what shows is the 1.77 above that (the curl and the upper
    // shaft), centred 0.89 above the water. At distance d the screen holds
    // 2·d·tan(fov/2), so d = s/k; the camera's height is what puts that centre
    // on the ray through the box.
    const k = (want * 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / 1.85;
    const s = 1.1;
    const d = s / k;
    const dir = ray.ray.direction;
    camY = 0.89 * s + Math.max(0.01, -dir.y) * d;
    const p = new THREE.Vector3(camera.position.x + dir.x * d, 0, camera.position.z + dir.z * d);
    hook.userData.base = { x: p.x, z: p.z, s };
    hook.scale.setScalar(s);
    ripple.scale.setScalar(s);
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
      const bob = Math.sin(t * 0.8) * 0.05;
      hook.position.set(b.x + w.x * 0.5, 0.35 * b.s + w.y * 0.85 + bob, b.z + w.z * 0.5);
      ripple.position.set(b.x + w.x * 0.5, w.y + 0.02, b.z + w.z * 0.5);
      ripple.material.uniforms.uTime.value = t;
      hook.rotation.set(Math.sin(t * 0.45) * 0.03, -0.45 + Math.sin(t * 0.25) * 0.45 + pointer.x * 0.35, -0.12 + Math.sin(t * 0.6) * 0.04);
      warm.position.set(b.x - 3 * b.s, 2.2 * b.s + 0.8, b.z + 3.2 * b.s);
      hook.userData.rim.position.set(b.x + 3.5 * b.s, 3 * b.s + 1.2, b.z - 2.5 * b.s);
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

/* ---------- the broadside: two cannons that fire as you scroll past ---------- */

function softTexture(inner, outer) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, inner); gr.addColorStop(0.45, outer); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function smokeTexture() {
  // a lumpy puff: a few overlapping soft blobs
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  for (let i = 0; i < 14; i++) {
    const x = 128 + (Math.random() - 0.5) * 110, y = 128 + (Math.random() - 0.5) * 110, r = 40 + Math.random() * 50;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  return new THREE.CanvasTexture(c);
}

// Canvas textures for the gun deck. Each returns a colour map and a matching
// grey map for bump and roughness, so the grain catches the light.
function woodTextures({ w = 1024, h = 512, boards = 8, base = [96, 62, 36], seams = true, nails = true, vertical = false } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const b = document.createElement('canvas'); b.width = w; b.height = h;
  const g = c.getContext('2d'), gb = b.getContext('2d');
  const bh = h / boards;
  for (let i = 0; i < boards; i++) {
    const y = i * bh, k = 0.78 + Math.random() * 0.35;
    const [r, gg, bb] = base.map((v) => Math.round(v * k));
    g.fillStyle = `rgb(${r},${gg},${bb})`; g.fillRect(0, y, w, bh);
    const tone = 115 + Math.round(Math.random() * 25);
    gb.fillStyle = `rgb(${tone},${tone},${tone})`; gb.fillRect(0, y, w, bh);
    // grain: long wavy streaks, now and then a knot
    for (let n = 0; n < 90; n++) {
      const yy = y + Math.random() * bh, dark = Math.random() < 0.6;
      g.strokeStyle = dark ? `rgba(20,10,4,${0.06 + Math.random() * 0.12})` : `rgba(255,220,170,${0.03 + Math.random() * 0.05})`;
      gb.strokeStyle = dark ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.12)';
      g.lineWidth = gb.lineWidth = 0.6 + Math.random() * 1.6;
      const ph = Math.random() * 6, amp = 1 + Math.random() * 3;
      [g, gb].forEach((x) => { x.beginPath(); x.moveTo(0, yy); for (let xx = 0; xx <= w; xx += 32) x.lineTo(xx, yy + Math.sin(xx / 90 + ph) * amp); x.stroke(); });
    }
    if (Math.random() < 0.5) {
      const kx = Math.random() * w, ky = y + bh * (0.3 + Math.random() * 0.4), rx = 9 + Math.random() * 8, ry = 4 + Math.random() * 3;
      [g, gb].forEach((x, j) => { x.fillStyle = j ? 'rgba(0,0,0,0.35)' : 'rgba(30,15,6,0.55)'; x.beginPath(); x.ellipse(kx, ky, rx, ry, 0, 0, 7); x.fill(); });
    }
    if (seams) {
      [g, gb].forEach((x) => { x.fillStyle = 'rgba(0,0,0,0.85)'; x.fillRect(0, y, w, 3); });
      const cut = Math.random() * (w - 100) + 50;
      [g, gb].forEach((x) => x.fillRect(cut, y, 3, bh));
      if (nails) {
        [cut - 16, cut + 19].forEach((x) => [0.3, 0.7].forEach((f) => {
          g.fillStyle = 'rgba(15,12,10,0.95)'; g.beginPath(); g.arc(x, y + bh * f, 3.2, 0, 7); g.fill();
          gb.fillStyle = '#000'; gb.beginPath(); gb.arc(x, y + bh * f, 3.2, 0, 7); gb.fill();
        }));
      }
    }
  }
  // grime and wear
  for (let n = 0; n < 40; n++) {
    const x = Math.random() * w, y = Math.random() * h, r = 20 + Math.random() * 80;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(10,6,3,${0.08 + Math.random() * 0.12})`); gr.addColorStop(1, 'rgba(10,6,3,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const tex = (cv, srgb) => {
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    if (vertical) { t.center.set(0.5, 0.5); t.rotation = Math.PI / 2; }
    return t;
  };
  return { map: tex(c, true), bump: tex(b, false) };
}

// cast iron: mottled, a little rust in the low spots
function ironTextures() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const r = document.createElement('canvas'); r.width = r.height = 512;
  const g = c.getContext('2d'), gr = r.getContext('2d');
  g.fillStyle = '#26272a'; g.fillRect(0, 0, 512, 512);
  gr.fillStyle = '#9a9a9a'; gr.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2600; i++) {
    const x = Math.random() * 512, y = Math.random() * 512, s = 1 + Math.random() * 6;
    const rust = Math.random() < 0.12, light = Math.random() < 0.5;
    g.fillStyle = rust ? `rgba(${110 + Math.random() * 40},${50 + Math.random() * 20},20,${0.08 + Math.random() * 0.15})` : (light ? `rgba(90,90,95,${0.05 + Math.random() * 0.08})` : `rgba(0,0,0,${0.05 + Math.random() * 0.08})`);
    g.beginPath(); g.arc(x, y, s, 0, 7); g.fill();
    gr.fillStyle = rust || light ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)';
    gr.beginPath(); gr.arc(x, y, s, 0, 7); gr.fill();
  }
  const t = (cv, srgb) => { const x = new THREE.CanvasTexture(cv); x.wrapS = x.wrapT = THREE.RepeatWrapping; if (srgb) x.colorSpace = THREE.SRGBColorSpace; return x; };
  return { map: t(c, true), rough: t(r, false) };
}

// laid hemp: a light rope with dark diagonal lays
function ropeTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#8c6b42'; g.fillRect(0, 0, 64, 256);
  for (let y = -64; y < 320; y += 16) {
    g.strokeStyle = 'rgba(40,24,10,0.55)'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(0, y); g.lineTo(64, y + 32); g.stroke();
    g.strokeStyle = 'rgba(255,225,170,0.25)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, y + 6); g.lineTo(64, y + 38); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// the materials the deck is built from
function deckKit(studio) {
  const woodT = woodTextures({ base: [104, 70, 42] });
  const carT = woodTextures({ w: 512, h: 256, boards: 2, base: [92, 52, 28], nails: false });
  const ironT = ironTextures();
  const rope = ropeTexture();
  return {
    deckWood: woodT,
    carriage: new THREE.MeshStandardMaterial({ map: carT.map, bumpMap: carT.bump, bumpScale: 1, roughness: 0.9 }),
    iron: new THREE.MeshStandardMaterial({ map: ironT.map, roughnessMap: ironT.rough, roughness: 0.75, metalness: 0.85, bumpMap: ironT.rough, bumpScale: 0.6, envMap: studio, envMapIntensity: 0.55 }),
    darkIron: new THREE.MeshStandardMaterial({ color: 0x141416, metalness: 0.8, roughness: 0.6, envMap: studio, envMapIntensity: 0.4 }),
    rope: (len) => { const t = rope.clone(); t.needsUpdate = true; t.repeat.set(1, Math.max(1, len * 6)); return new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }); }
  };
}

function cannonModel(kit) {
  const g = new THREE.Group();
  // the barrel, cast iron: button, breech ring, reinforces, a long chase, the muzzle swell
  const prof = [
    [0, -0.62], [0.06, -0.62], [0.085, -0.58], [0.08, -0.53], [0.045, -0.5], [0.05, -0.46], [0.14, -0.44], [0.25, -0.38], [0.31, -0.3],
    [0.33, -0.2], [0.355, -0.18], [0.355, -0.08], [0.33, -0.06], [0.32, 0.45], [0.34, 0.47], [0.34, 0.56], [0.3, 0.58],
    [0.255, 1.62], [0.275, 1.64], [0.275, 1.7], [0.255, 1.72], [0.25, 1.86], [0.29, 1.96], [0.305, 2.02], [0.305, 2.08], [0.17, 2.08], [0.16, 2.0]
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const barrel = new THREE.Mesh(new THREE.LatheGeometry(prof, 72), kit.iron);
  const bore = new THREE.Mesh(new THREE.CircleGeometry(0.16, 32), new THREE.MeshBasicMaterial({ color: 0x030202 }));
  bore.rotation.x = -Math.PI / 2; bore.position.y = 2.0;
  const trunnion = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.9, 20), kit.iron);
  trunnion.rotation.z = Math.PI / 2; trunnion.position.y = 0.52;
  const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.05, 12), kit.darkIron); // the touch hole's patch
  vent.position.set(-0.33, -0.2, 0); vent.rotation.z = Math.PI / 2;
  const gun = new THREE.Group();
  gun.add(barrel, bore, trunnion, vent);
  gun.rotation.z = -Math.PI / 2 + 0.05; // lies along +x, nose up a touch
  gun.position.set(-0.5, 0.86, 0);
  g.add(gun);
  // the carriage: stepped cheeks, a transom, axletrees, four solid trucks, iron caps
  const cheek = new THREE.Shape();
  cheek.moveTo(-1.15, 0); cheek.lineTo(0.62, 0); cheek.lineTo(0.62, 0.58); cheek.lineTo(0.16, 0.58); cheek.lineTo(0.16, 0.47);
  cheek.lineTo(-0.26, 0.47); cheek.lineTo(-0.26, 0.36); cheek.lineTo(-0.7, 0.36); cheek.lineTo(-0.7, 0.25); cheek.lineTo(-1.15, 0.25);
  [-0.36, 0.36].forEach((z) => {
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(cheek, { depth: 0.13, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 1 }), kit.carriage);
    m.position.set(0, 0.2, z - 0.065);
    g.add(m);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.03, 0.16), kit.darkIron); // cap-square over the trunnion
    cap.position.set(0.04, 0.8, z);
    g.add(cap);
    [-0.9, -0.45, 0.4].forEach((x) => { const bolt = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), kit.darkIron); bolt.position.set(x, 0.33, z + (z > 0 ? 0.08 : -0.08)); g.add(bolt); });
  });
  const transom = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.62), kit.carriage);
  transom.position.set(0.45, 0.3, 0); g.add(transom);
  const quoin = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.3), kit.carriage); // the wedge under the breech
  quoin.position.set(-0.92, 0.5, 0); quoin.rotation.z = 0.12; g.add(quoin);
  [[-0.82, 0.18], [0.34, 0.21]].forEach(([x, r]) => {
    const axle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 1.06), kit.carriage);
    axle.position.set(x, r, 0); g.add(axle);
    [-0.48, 0.48].forEach((z) => {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.11, 28), kit.carriage);
      w.rotation.x = Math.PI / 2; w.position.set(x, r, z);
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(r - 0.01, 0.012, 6, 28), kit.darkIron);
      hoop.position.set(x, r, z + (z > 0 ? 0.056 : -0.056));
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.16, 10), kit.darkIron);
      pin.rotation.x = Math.PI / 2; pin.position.set(x, r, z + (z > 0 ? 0.04 : -0.04));
      g.add(w, hoop, pin);
    });
  });
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const touch = new THREE.Object3D(); // the touch hole, where the fuse burns
  touch.position.set(-0.36, -0.2, 0);
  gun.add(touch);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 2.15, 0);
  gun.add(muzzle);
  return { group: g, gun, touch, muzzle };
}

function broadsideScene(canvas) {
  const renderer = makeRenderer(canvas, false, 1.5);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 2000);
  const studio = environment(renderer, true);
  scene.environment = environment(renderer);
  scene.add(skyDome(1000, true));
  const sky = stars(small ? 500 : 1000, 900);
  sky.material.uniforms.uPx.value = renderer.getPixelRatio();
  scene.add(sky);
  const water = sea();
  water.position.y = -3.2;
  scene.add(water);
  scene.add(new THREE.HemisphereLight(0x5a6c90, 0x05070c, 0.6));
  const moon = new THREE.DirectionalLight(0xdfe6ff, 1.2);
  moon.position.copy(MOON_DIR).multiplyScalar(50);
  scene.add(moon);

  // real shadows: the moon over the rail, cast across the deck
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  moon.intensity = 1.7;
  moon.castShadow = true;
  moon.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  Object.assign(moon.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 120 });
  moon.shadow.bias = -0.0004;
  moon.shadow.normalBias = 0.02;
  moon.position.copy(MOON_DIR).multiplyScalar(40).add(new THREE.Vector3(0, 0, -1));
  moon.target.position.set(0, 0, -1);
  scene.add(moon.target);

  const kit = deckKit(studio);
  const shadowy = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };

  // the deck: weathered planks, nailed, a little worn
  kit.deckWood.map.repeat.set(2.2, 4.5);
  kit.deckWood.bump.repeat.set(2.2, 4.5);
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(10, 9), new THREE.MeshStandardMaterial({ map: kit.deckWood.map, bumpMap: kit.deckWood.bump, bumpScale: 0.8, roughness: 0.97, metalness: 0 }));
  deck.rotation.x = -Math.PI / 2; deck.position.set(-3.25, 0, -1);
  deck.receiveShadow = true;
  scene.add(deck);

  // the bulwark: planked, two gun ports with their lids hauled up, a rail on top
  const wallT = woodTextures({ base: [78, 46, 26], boards: 6 });
  const wallMat = new THREE.MeshStandardMaterial({ map: wallT.map, bumpMap: wallT.bump, bumpScale: 1, roughness: 0.93 });
  const X = 1.75, T = 0.22, Z0 = -5.5, Z1 = 3.5;
  const PORTS = [0, -2.2].map((pz) => [pz - 0.5, pz + 0.5]);
  const slab = (y0, y1, z0, z1) => {
    const geo = new THREE.BoxGeometry(T, y1 - y0, z1 - z0);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * (z1 - z0)) / 3, (uv.getY(i) * (y1 - y0)) / 1.6);
    const m = shadowy(new THREE.Mesh(geo, wallMat));
    m.position.set(X, (y0 + y1) / 2, (z0 + z1) / 2);
    scene.add(m);
  };
  slab(0, 0.5, Z0, Z1);
  slab(1.36, 1.62, Z0, Z1);
  let zz = Z0;
  [...PORTS].sort((p, q) => p[0] - q[0]).forEach(([p0, p1]) => { slab(0.5, 1.36, zz, p0); zz = p1; });
  slab(0.5, 1.36, zz, Z1);
  const railCap = shadowy(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, Z1 - Z0 + 0.2), kit.carriage));
  railCap.position.set(X, 1.67, (Z0 + Z1) / 2);
  scene.add(railCap);
  // the hull's side below, outboard
  const side = shadowy(new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.4, Z1 - Z0), wallMat));
  side.position.set(X + 0.02, -1.7, (Z0 + Z1) / 2);
  scene.add(side);
  // knees inside the bulwark, between the guns
  [-4.4, -1.1, 1.1, 2.9].forEach((kz) => {
    const knee = new THREE.Shape();
    knee.moveTo(0, 0); knee.lineTo(0, 1.25); knee.lineTo(-0.16, 1.25); knee.quadraticCurveTo(-0.18, 0.35, -0.55, 0.16); knee.lineTo(-0.55, 0);
    const m = shadowy(new THREE.Mesh(new THREE.ExtrudeGeometry(knee, { depth: 0.14, bevelEnabled: false }), kit.carriage));
    m.position.set(X - T / 2, 0, kz - 0.07);
    scene.add(m);
  });
  // port lids, hinged at the top and hauled open
  PORTS.forEach(([p0, p1]) => {
    const lid = new THREE.Group();
    const board = shadowy(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.86, 1.04), wallMat));
    board.position.y = -0.43;
    lid.add(board);
    lid.position.set(X + T / 2 + 0.04, 1.38, (p0 + p1) / 2);
    lid.rotation.z = 1.05;
    scene.add(lid);
  });
  // ring bolts, and the breeching rope that stops each gun's recoil
  PORTS.forEach(([p0, p1]) => {
    const gz = (p0 + p1) / 2;
    [-0.75, 0.75].forEach((dz) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.013, 8, 16), kit.darkIron);
      ring.position.set(X - T / 2 - 0.02, 0.7, gz + dz); ring.rotation.y = Math.PI / 2;
      scene.add(ring);
    });
    const path = new THREE.CatmullRomCurve3([
      [X - 0.15, 0.7, gz - 0.75], [0.9, 0.62, gz - 0.62], [-0.2, 0.78, gz - 0.34], [-0.62, 0.86, gz - 0.06],
      [-0.66, 0.86, gz + 0.06], [-0.2, 0.78, gz + 0.34], [0.9, 0.62, gz + 0.62], [X - 0.15, 0.7, gz + 0.75]
    ].map((v) => new THREE.Vector3(...v)));
    scene.add(shadowy(new THREE.Mesh(new THREE.TubeGeometry(path, 80, 0.028, 8, false), kit.rope(path.getLength()))));
  });

  // stores on deck: shot stacked in pyramids, a bucket, a cask, a coil of rope
  const shot = new THREE.SphereGeometry(0.11, 16, 12);
  const pyramid = (cx, cz) => {
    for (let layer = 0, n = 3; n > 0; layer++, n--) {
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const m = shadowy(new THREE.Mesh(shot, kit.iron));
          m.position.set(cx + (i - (n - 1) / 2) * 0.22, 0.11 + layer * 0.155, cz + (j - (n - 1) / 2) * 0.22);
          scene.add(m);
        }
      }
    }
  };
  pyramid(-0.35, -1.1);
  pyramid(-0.4, 1.2);
  const staves = woodTextures({ w: 512, h: 256, boards: 10, base: [110, 72, 40], nails: false, vertical: true });
  const staveMat = new THREE.MeshStandardMaterial({ map: staves.map, bumpMap: staves.bump, bumpScale: 2, roughness: 0.85, side: THREE.DoubleSide });
  const bucket = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.17, 0.36, 24, 1, true), staveMat));
  bucket.position.set(-1.45, 0.18, -0.95);
  scene.add(bucket);
  const bucketWater = new THREE.Mesh(new THREE.CircleGeometry(0.2, 24), new THREE.MeshStandardMaterial({ color: 0x0a1418, metalness: 0.2, roughness: 0.1 }));
  bucketWater.rotation.x = -Math.PI / 2; bucketWater.position.set(-1.45, 0.3, -0.95);
  scene.add(bucketWater);
  [0.08, 0.28].forEach((y) => {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.2 - y * 0.08, 0.012, 6, 24), kit.darkIron);
    hoop.rotation.x = Math.PI / 2; hoop.position.set(-1.45, y, -0.95);
    scene.add(hoop);
  });
  const caskProf = [[0, 0], [0.3, 0], [0.36, 0.2], [0.39, 0.45], [0.36, 0.7], [0.3, 0.9], [0, 0.9]].map(([r, y]) => new THREE.Vector2(r, y));
  const cask = shadowy(new THREE.Mesh(new THREE.LatheGeometry(caskProf, 28), staveMat));
  cask.position.set(-2.1, 0, -3.3);
  scene.add(cask);
  [0.12, 0.3, 0.6, 0.78].forEach((y) => {
    const r = y < 0.45 ? 0.3 + (y / 0.45) * 0.09 : 0.39 - ((y - 0.45) / 0.45) * 0.09;
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(r + 0.005, 0.015, 6, 28), kit.darkIron);
    hoop.rotation.x = Math.PI / 2; hoop.position.set(-2.1, y, -3.3);
    scene.add(hoop);
  });
  const coilPts = [];
  for (let i = 0; i <= 260; i++) { const a = i * 0.21, r = 0.1 + i * 0.0011; coilPts.push(new THREE.Vector3(Math.cos(a) * r, 0.03, Math.sin(a) * r)); }
  const coil = new THREE.CatmullRomCurve3(coilPts);
  const coilMesh = shadowy(new THREE.Mesh(new THREE.TubeGeometry(coil, 600, 0.026, 6, false), kit.rope(coil.getLength())));
  coilMesh.position.set(-1.6, 0, 1.0);
  scene.add(coilMesh);

  // the mainmast behind, and its shrouds running down to the side
  const mast = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 20, 24), kit.carriage));
  mast.position.set(-2.8, 10, -4.6);
  scene.add(mast);
  [-5.4, -4.7, -4.0].forEach((sz, i) => {
    const line = new THREE.LineCurve3(new THREE.Vector3(X, 1.7, sz - 0.6), new THREE.Vector3(-2.6, 14, -4.6 + i * 0.12));
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(line, 4, 0.02, 6, false), kit.rope(16)));
  });

  // a lantern hung from the rail, its flame flickering
  const lantern = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, 0.15), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.5, 0.55) }));
  const cage = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.24, 0.18), new THREE.MeshStandardMaterial({ color: 0x1a1a1c, metalness: 0.7, roughness: 0.5, transparent: true, opacity: 0.35 }));
  const capTop = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.1, 4), kit.darkIron);
  capTop.position.y = 0.17; capTop.rotation.y = Math.PI / 4;
  lantern.add(glass, cage, capTop);
  lantern.position.set(1.42, 1.48, -1.1);
  scene.add(lantern);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.03), kit.darkIron);
  arm.position.set(1.55, 1.72, -1.1);
  scene.add(arm);

  const lamp = new THREE.PointLight(0xffa850, 12, 10, 2);
  lamp.position.set(1.42, 1.48, -1.1); scene.add(lamp);
  const lampGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture('rgba(255,210,140,1)', 'rgba(255,140,40,0.35)'), blending: THREE.AdditiveBlending, depthWrite: false }));
  lampGlow.scale.setScalar(0.7); lampGlow.position.copy(lamp.position); scene.add(lampGlow);

  const guns = [cannonModel(kit), cannonModel(kit)];
  guns[0].group.position.set(0.55, 0, 0.0);
  guns[1].group.position.set(0.55, 0, -2.2);
  guns.forEach((c) => scene.add(c.group));

  // effects
  const flashTex = softTexture('rgba(255,250,220,1)', 'rgba(255,150,40,0.6)');
  const smokeTex = smokeTexture();
  const sparkTex = softTexture('rgba(255,240,200,1)', 'rgba(255,160,60,0.5)');
  const parts = [];
  const sprite = (tex, additive) => {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
    scene.add(m);
    return m;
  };
  const emit = (kind, pos, vel, life, size, grow) => {
    const m = sprite(kind === 'smoke' ? smokeTex : kind === 'flash' ? flashTex : sparkTex, kind !== 'smoke');
    m.position.copy(pos);
    m.material.rotation = Math.random() * 6.28;
    parts.push({ m, kind, vel, life, age: 0, size, grow });
  };
  const flash = new THREE.PointLight(0xffc070, 0, 30, 2);
  scene.add(flash);
  const balls = [];
  const ballMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.7, roughness: 0.4 });

  const muzzlePos = new THREE.Vector3(), dirV = new THREE.Vector3();
  const fire = (c) => {
    c.muzzle.getWorldPosition(muzzlePos);
    dirV.set(Math.cos(0.06), Math.sin(0.06), 0);
    c.kick = 1;
    flash.position.copy(muzzlePos); flash.intensity = 260;
    for (let i = 0; i < 3; i++) emit('flash', muzzlePos.clone().addScaledVector(dirV, 0.3 + i * 0.35), dirV.clone().multiplyScalar(2), 0.14 + i * 0.03, 2.2 - i * 0.4, 6);
    for (let i = 0; i < (small ? 22 : 36); i++) {
      const v = dirV.clone().multiplyScalar(2.5 + Math.random() * 6).add(new THREE.Vector3((Math.random() - 0.5) * 1.5, Math.random() * 1.6, (Math.random() - 0.5) * 2.2));
      emit('smoke', muzzlePos.clone(), v, 2.6 + Math.random() * 2.2, 0.5 + Math.random() * 0.6, 1.4 + Math.random());
    }
    for (let i = 0; i < 26; i++) {
      const v = dirV.clone().multiplyScalar(4 + Math.random() * 8).add(new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 4, (Math.random() - 0.5) * 4));
      emit('spark', muzzlePos.clone(), v, 0.5 + Math.random() * 0.7, 0.08 + Math.random() * 0.08, 0);
    }
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), ballMat);
    ball.position.copy(muzzlePos);
    balls.push({ m: ball, v: dirV.clone().multiplyScalar(42), age: 0 });
    scene.add(ball);
    // the page feels it
    const host = canvas.parentElement;
    host.classList.remove('is-boom'); void host.offsetWidth; host.classList.add('is-boom');
  };

  // fire when the scene comes into view; re-arm once it has left the screen
  let armed = true, timeline = null;
  new IntersectionObserver(([e]) => {
    if (still) return;
    if (e.intersectionRatio >= 0.5 && armed) { armed = false; timeline = 0; }
    if (e.intersectionRatio === 0) armed = true;
  }, { threshold: [0, 0.5] }).observe(canvas);

  let last = 0;
  loop(canvas, (t) => {
    if (!fit(renderer, camera, canvas)) return;
    const dt = Math.min(0.1, t - last); last = t;
    pointer.x += (pointer.tx - pointer.x) * 0.05;
    const wide = camera.aspect > 1.4;
    camera.position.set(-3.6 + pointer.x * 0.3, 2.4, wide ? 5.2 : 7.5);
    camera.lookAt(wide ? 2.6 : 1.4, 0.9, -1.2);
    water.material.uniforms.uTime.value = t;
    sky.material.uniforms.uTime.value = t;
    lamp.intensity = 12 + Math.sin(t * 9) * 1.1 + Math.sin(t * 23) * 0.6;
    lantern.rotation.z = Math.sin(t * 1.1) * 0.06;
    lampGlow.position.set(1.42 + Math.sin(t * 1.1) * 0.02, 1.48, -1.1);

    // the fuses fizz, then the guns fire one after the other
    if (timeline !== null) {
      const before = timeline;
      timeline += dt;
      guns.forEach((c, i) => {
        const at = 0.55 + i * 0.5;
        if (timeline < at && Math.random() < 0.7) {
          const p = c.touch.getWorldPosition(new THREE.Vector3());
          emit('spark', p, new THREE.Vector3((Math.random() - 0.5) * 1.5, 1 + Math.random() * 1.5, (Math.random() - 0.5) * 1.5), 0.3, 0.05 + Math.random() * 0.05, 0);
        }
        if (before < at && timeline >= at) fire(c);
      });
      if (timeline > 6) timeline = null;
    }
    // recoil: back fast, then run out slowly
    guns.forEach((c, i) => {
      c.kick = Math.max(0, (c.kick || 0) - dt * 0.9);
      const k = c.kick > 0.85 ? (1 - c.kick) / 0.15 : c.kick / 0.85;
      c.group.position.x = 0.55 - 0.7 * Math.pow(Math.max(0, k), 0.6) * (c.kick > 0 ? 1 : 0);
    });
    flash.intensity *= Math.pow(0.0005, dt);

    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.age += dt;
      const f = p.age / p.life;
      if (f >= 1) { scene.remove(p.m); p.m.material.dispose(); parts.splice(i, 1); continue; }
      if (p.kind === 'smoke') {
        p.vel.multiplyScalar(Math.pow(0.18, dt)); p.vel.y += dt * 0.35; p.vel.x += dt * 0.25;
        p.m.material.opacity = 0.5 * Math.sin(Math.min(1, f * 6) * Math.PI / 2) * (1 - f);
        p.m.material.color.setRGB(0.55 + 0.2 * (1 - f), 0.52 + 0.15 * (1 - f), 0.5);
      } else if (p.kind === 'spark') {
        p.vel.y -= dt * 9; p.m.material.opacity = 1 - f;
      } else {
        p.m.material.opacity = 1 - f;
      }
      p.m.position.addScaledVector(p.vel, dt);
      p.m.scale.setScalar(p.size * (1 + p.grow * f));
    }
    for (let i = balls.length - 1; i >= 0; i--) {
      const b = balls[i];
      b.age += dt; b.v.y -= 9.8 * dt;
      b.m.position.addScaledVector(b.v, dt);
      if (b.age > 3) { scene.remove(b.m); balls.splice(i, 1); }
    }
    renderer.render(scene, camera);
    canvas.parentElement.classList.add('is-3d');
  });
}

/* ---------- start ---------- */

// No GPU (a software renderer) would make every frame cost the whole page,
// so those visitors keep the 2D drawings. ?3d=force overrides it.
function webgl() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return false;
    if (/[?&]3d=force/.test(location.search)) return true;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return !/swiftshader|llvmpipe|softpipe|software/i.test(name);
  } catch (_) { return false; }
}

// Each scene is built only when its canvas comes within a screen of view, so
// the page's first paint never waits on the scenes further down.
const start = (canvas) => {
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
    } else if (kind === 'broadside') {
      broadsideScene(canvas);
    }
  } catch (err) {
    // put the 2D drawing back
    console.warn('3D scene unavailable:', err && err.message);
    if (canvas.dataset.scene === 'hero') no3d();
  }
};

// The page hides the 2D hero drawing from the first paint when it expects 3D
// (html.uh-3d-on); without WebGL, or if the hero scene fails, it comes back.
function no3d() { document.documentElement.classList.remove('uh-3d-on'); }
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
