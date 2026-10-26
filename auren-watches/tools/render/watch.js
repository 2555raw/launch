/* AUREN product renderer.
 *
 * Builds a watch from parameters (see models.js), puts it in a studio — soft
 * boxes for reflections, a key light, a contact shadow — and renders a still.
 * The page exposes window.AUREN.shot(spec) for render.js to drive through
 * Playwright. Units are millimetres; the dial faces +Z and twelve is +Y. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { HorizontalBlurShader } from 'three/addons/shaders/HorizontalBlurShader.js';
import { VerticalBlurShader } from 'three/addons/shaders/VerticalBlurShader.js';

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const TAU = Math.PI * 2;
const rnd = mulberry(7);
function mulberry(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ studio */

// The environment the metal reflects: a dark room with soft boxes. It is what
// makes polished steel read as steel.
function studioEnvironment(mood) {
  const env = new THREE.Scene();
  const dark = mood === 'dark';
  env.background = new THREE.Color(dark ? 0x050506 : 0x2a2a2c);
  const box = (w, h, intensity, pos, look = [0, 0, 0]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(intensity, intensity, intensity), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(...look);
    env.add(m);
  };
  const k = dark ? 0.7 : 1;
  box(6, 3, 5 * k, [0, 6, 1]);               // overhead
  box(1.2, 7, 7 * k, [-6, 1, 2]);             // left strip
  box(1.2, 7, 4 * k, [6, 1, 1]);              // right strip
  box(8, 1.5, 2.2 * k, [0, -1, 6]);            // low front bounce
  box(3, 3, 3 * k, [-3, 3, -5]);              // back left
  if (!dark) box(14, 6, 0.9, [0, -6, 0]);     // pale floor bounce
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.02).texture;
  pmrem.dispose();
  return tex;
}

/* --------------------------------------------------------------- materials */

const METALS = {
  steel: { color: 0xdedfe1, roughness: 0.14 },
  steelBrushed: { color: 0xd6d7d9, roughness: 0.3 },
  steelDark: { color: 0x9a9ca0, roughness: 0.12 },
  gold: { color: 0xe2c48f, roughness: 0.16 },
  goldBrushed: { color: 0xdcbd86, roughness: 0.3 },
  black: { color: 0x1d1d20, roughness: 0.3, metalness: 0.8 },
  blackBrushed: { color: 0x1a1a1d, roughness: 0.42, metalness: 0.8 },
  titanium: { color: 0x8e9095, roughness: 0.22 },
  titaniumBrushed: { color: 0x87898e, roughness: 0.36 }
};
function metal(name, brushed = false) {
  const m = METALS[brushed && METALS[name + 'Brushed'] ? name + 'Brushed' : name];
  return new THREE.MeshPhysicalMaterial({
    color: m.color, metalness: m.metalness ?? 1, roughness: m.roughness,
    clearcoat: name.startsWith('black') ? 0.4 : 0, clearcoatRoughness: 0.2
  });
}

/* ---------------------------------------------------------------- textures */

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

const DIAL_PX = 2048;

// Dial face: colour, finish, minute track and printing. Applied indices and the
// hands are geometry, so they catch light; everything flat is printed here.
function dialTexture(model, col, R) {
  const c = canvas(DIAL_PX), g = c.getContext('2d');
  const s = DIAL_PX / 2 / R;              // px per mm
  g.translate(DIAL_PX / 2, DIAL_PX / 2);
  g.fillStyle = col.dial;
  g.fillRect(-DIAL_PX, -DIAL_PX, DIAL_PX * 2, DIAL_PX * 2);

  if (col.finish === 'sunburst') {
    // light catching the radial brushing: two bright lobes, two dark
    const cg = g.createConicGradient(-Math.PI / 4, 0, 0);
    const light = 'rgba(255,255,255,0.13)', none = 'rgba(255,255,255,0)', dark = 'rgba(0,0,0,0.16)';
    [[0, light], [0.12, none], [0.25, dark], [0.38, none], [0.5, light], [0.62, none], [0.75, dark], [0.88, none], [1, light]]
      .forEach(([o, cc]) => cg.addColorStop(o, cc));
    g.fillStyle = cg;
    g.fillRect(-DIAL_PX, -DIAL_PX, DIAL_PX * 2, DIAL_PX * 2);
    // the brushing itself
    for (let i = 0; i < 5200; i++) {
      const a = rnd() * TAU, v = rnd();
      g.strokeStyle = v > 0.5 ? `rgba(255,255,255,${0.02 + rnd() * 0.035})` : `rgba(0,0,0,${0.02 + rnd() * 0.04})`;
      g.lineWidth = 0.6 + rnd();
      g.beginPath();
      g.moveTo(Math.cos(a) * 20, Math.sin(a) * 20);
      g.lineTo(Math.cos(a) * DIAL_PX * 0.72, Math.sin(a) * DIAL_PX * 0.72);
      g.stroke();
    }
  } else {
    // fine grain so a matte dial does not look like plastic
    const img = g.getImageData(0, 0, 1, 1);
    for (let i = 0; i < 60000; i++) {
      const x = (rnd() - 0.5) * DIAL_PX, y = (rnd() - 0.5) * DIAL_PX;
      g.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.035)';
      g.fillRect(x, y, 2, 2);
    }
    void img;
  }
  // soft vignette towards the rehaut
  const vg = g.createRadialGradient(0, 0, R * s * 0.6, 0, 0, R * s);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.18)');
  g.fillStyle = vg;
  g.fillRect(-DIAL_PX, -DIAL_PX, DIAL_PX * 2, DIAL_PX * 2);

  // minute track
  g.strokeStyle = col.print;
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * TAU, five = i % 5 === 0;
    if (model.layout === 'chrono' && five) continue;
    const r0 = (R - (five ? 1.15 : 0.95)) * s, r1 = (R - 0.45) * s;
    g.lineWidth = (five ? 0.24 : 0.14) * s;
    g.globalAlpha = five ? 0.9 : 0.7;
    g.beginPath();
    g.moveTo(Math.sin(a) * r0, -Math.cos(a) * r0);
    g.lineTo(Math.sin(a) * r1, -Math.cos(a) * r1);
    g.stroke();
  }
  g.globalAlpha = 1;

  // chronograph: 1/5 s scale on the outer edge
  if (model.layout === 'chrono') {
    g.lineWidth = 0.08 * s;
    for (let i = 0; i < 300; i++) {
      if (i % 5 === 0) continue;
      const a = (i / 300) * TAU, r0 = (R - 0.75) * s, r1 = (R - 0.45) * s;
      g.globalAlpha = 0.55;
      g.beginPath();
      g.moveTo(Math.sin(a) * r0, -Math.cos(a) * r0);
      g.lineTo(Math.sin(a) * r1, -Math.cos(a) * r1);
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  // brand: symbol and name under twelve
  const sym = window.AUREN_LOGO.symbol;
  g.save();
  const symMm = 3.6;
  g.translate(-symMm / 2 * s, -(R * 0.66) * s);
  g.scale(symMm * s / 100, symMm * s / 100);
  g.fillStyle = col.print;
  g.fill(new Path2D(sym.ring), 'evenodd');
  [sym.index, ...sym.hands, sym.pivot].forEach((d) => g.fill(new Path2D(d)));
  g.restore();
  printText(g, 'AUREN', 0, -(R * 0.66 - symMm - 1.7) * s, 1.3 * s, 0.32, col.print, 600);
  const lower = model.layout === 'small-seconds' ? R * 0.18 : R * 0.42;
  printText(g, model.name, 0, (model.layout === 'chrono' ? R * 0.5 : lower) * s, 0.78 * s, 0.5, col.print, 500, 0.8);

  // sub-dials, snailed
  const subs = model.layout === 'chrono' ? [[-R * 0.36, 0.0], [R * 0.36, 0.0]]
    : model.layout === 'small-seconds' ? [[0, R * 0.5]] : [];
  const subR = model.layout === 'chrono' ? R * 0.235 : R * 0.21;
  subs.forEach(([x, y]) => {
    g.save();
    g.translate(x * s, y * s);
    g.fillStyle = col.sub || col.dial;
    g.beginPath(); g.arc(0, 0, subR * s, 0, TAU); g.fill();
    for (let r = 4; r < subR * s; r += 3.2) {
      g.strokeStyle = (r / 3.2) % 2 < 1 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)';
      g.lineWidth = 1.6;
      g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke();
    }
    g.strokeStyle = col.subPrint || col.print;
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * TAU, major = i % 5 === 0;
      const r0 = (subR - (major ? 0.9 : 0.55)) * s, r1 = (subR - 0.2) * s;
      g.lineWidth = (major ? 0.16 : 0.09) * s;
      g.beginPath();
      g.moveTo(Math.sin(a) * r0, -Math.cos(a) * r0);
      g.lineTo(Math.sin(a) * r1, -Math.cos(a) * r1);
      g.stroke();
    }
    g.lineWidth = 0.08 * s;
    g.beginPath(); g.arc(0, 0, (subR - 0.12) * s, 0, TAU); g.stroke();
    g.restore();
  });

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return { texture: t, subs, subR };
}

function printText(g, text, x, y, capPx, tracking, color, weight, alpha = 1) {
  g.save();
  g.globalAlpha = alpha;
  g.fillStyle = color;
  g.font = `${weight} ${capPx / 0.7}px Montserrat`;
  g.textBaseline = 'middle';
  const chars = [...text];
  const widths = chars.map((ch) => g.measureText(ch).width);
  const track = tracking * capPx / 0.7;
  const total = widths.reduce((a, b) => a + b, 0) + track * (chars.length - 1);
  let cx = x - total / 2;
  chars.forEach((ch, i) => { g.fillText(ch, cx, y); cx += widths[i] + track; });
  g.restore();
}

// Leather or rubber strap surface: grain, and stitching along both edges.
function strapTextures(strap, lengthMm, widthMm) {
  const W = 512, H = Math.round(W * lengthMm / widthMm);
  const c = canvas(W, H), g = c.getContext('2d');
  const b = canvas(W, H), bg = b.getContext('2d');
  g.fillStyle = strap.color;
  g.fillRect(0, 0, W, H);
  bg.fillStyle = '#808080';
  bg.fillRect(0, 0, W, H);
  const grain = strap.type === 'leather' ? 26000 : 9000;
  for (let i = 0; i < grain; i++) {
    const x = rnd() * W, y = rnd() * H, r = strap.type === 'leather' ? 1 + rnd() * 2.2 : 0.8 + rnd();
    const v = rnd();
    g.fillStyle = v > 0.5 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.05)';
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    bg.fillStyle = v > 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)';
    bg.beginPath(); bg.arc(x, y, r, 0, TAU); bg.fill();
  }
  if (strap.type === 'leather') {
    const step = W / widthMm;             // px per mm across
    [1.6, widthMm - 1.6].forEach((mm) => {
      const x = mm * step;
      for (let y = 0; y < H; y += step * 1.6) {
        g.strokeStyle = strap.stitch;
        g.lineWidth = step * 0.32;
        g.lineCap = 'round';
        g.beginPath(); g.moveTo(x, y + step * 0.2); g.lineTo(x, y + step * 1.1); g.stroke();
        bg.strokeStyle = '#b0b0b0';
        bg.lineWidth = step * 0.35;
        bg.beginPath(); bg.moveTo(x, y + step * 0.2); bg.lineTo(x, y + step * 1.1); bg.stroke();
      }
    });
    // the edge is painted, slightly darker
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(0, 0, step * 0.35, H); g.fillRect(W - step * 0.35, 0, step * 0.35, H);
  } else {
    // shallow horizontal grooves
    const step = W / widthMm;
    for (let y = 0; y < H; y += step * 4) {
      bg.fillStyle = 'rgba(0,0,0,0.25)';
      bg.fillRect(step * 3, y, W - step * 6, step * 0.6);
      g.fillStyle = 'rgba(0,0,0,0.12)';
      g.fillRect(step * 3, y, W - step * 6, step * 0.6);
    }
  }
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  const bump = new THREE.CanvasTexture(b);
  return { map, bump };
}

// Slate for the dark scenes: layered value noise, broad and fine, no pattern.
function stoneTextures() {
  const N = 1024, c = canvas(N), g = c.getContext('2d');
  const img = g.createImageData(N, N);
  const grid = (n) => { const a = new Float32Array(n * n); for (let i = 0; i < a.length; i++) a[i] = rnd(); return a; };
  const octs = [[4, 0.35], [12, 0.25], [48, 0.18], [160, 0.12], [512, 0.1]].map(([n, w]) => ({ n, w, a: grid(n) }));
  // tiling value noise, so the repeat does not show a seam
  const sample = (o, x, y) => {
    const fx = x * o.n, fy = y * o.n, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
    const at = (i, j) => o.a[((j % o.n) + o.n) % o.n * o.n + ((i % o.n) + o.n) % o.n];
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    return (at(ix, iy) * (1 - sx) + at(ix + 1, iy) * sx) * (1 - sy) + (at(ix, iy + 1) * (1 - sx) + at(ix + 1, iy + 1) * sx) * sy;
  };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let v = 0;
    for (const o of octs) v += sample(o, x / N, y / N) * o.w;
    const l = 20 + v * 26 + (rnd() - 0.5) * 5;
    const i = (y * N + x) * 4;
    img.data[i] = l; img.data[i + 1] = l; img.data[i + 2] = l + 1.2; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  const bump = new THREE.CanvasTexture(c);
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  return { map, bump };
}

/* ---------------------------------------------------------------- geometry */

const lathe = (pts, seg = 160) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);

function buildCase(model, col) {
  const R = model.caseRadius, H = model.caseHeight;
  const group = new THREE.Group();
  const top = H * 0.42, bottom = -H * 0.58;   // z of bezel top and caseback
  const caseMat = metal(col.metal, true);
  const polish = metal(col.metal);

  // middle case and caseback, lathed around Y then turned to face +Z
  const mid = lathe([
    [0, bottom], [R * 0.66, bottom], [R * 0.78, bottom + 0.25], [R * 0.9, bottom + 1.1],
    [R * 0.97, bottom + 2.4], [R, bottom + 3.6], [R, top - 1.8], [R - 0.15, top - 1.2]
  ]);
  const midMesh = new THREE.Mesh(mid, caseMat);
  midMesh.rotation.x = Math.PI / 2;
  group.add(midMesh);

  // bezel
  const bz = model.bezel;
  const bezelPts = bz === 'thin'
    ? [[R - 0.15, top - 1.2], [R - 0.25, top - 0.5], [R - 0.7, top - 0.05], [R - 1.3, top], [R - 1.55, top - 0.35]]
    : bz === 'flat'
      ? [[R - 0.15, top - 1.2], [R - 0.2, top - 0.25], [R - 0.45, top], [R - 2.6, top], [R - 2.8, top - 0.3]]
      : [[R - 0.15, top - 1.2], [R - 0.3, top - 0.45], [R - 0.9, top - 0.02], [R - 1.8, top], [R - 2.3, top - 0.35], [R - 2.5, top - 0.8]];
  const bezel = new THREE.Mesh(lathe(bezelPts), polish);
  bezel.rotation.x = Math.PI / 2;
  group.add(bezel);
  const innerR = bezelPts[bezelPts.length - 1][0];

  // rehaut: the sloped ring between dial and bezel
  const dialZ = top - 2.2;
  const rehaut = new THREE.Mesh(lathe([[innerR - 1.1, dialZ + 0.01], [innerR, top - 0.5]]),
    new THREE.MeshPhysicalMaterial({ color: col.dial, roughness: 0.5, metalness: 0.2 }));
  rehaut.rotation.x = Math.PI / 2;
  group.add(rehaut);

  // lugs
  const lugW = 2.6, gap = model.strapWidth;
  const lugShape = new THREE.Shape();
  // side profile in (y = outward, x = height) coordinates
  const L0 = R * 0.72, L1 = R + 4.4;
  if (model.lugs === 'curved') {
    lugShape.moveTo(L0, top - 2.3);
    lugShape.quadraticCurveTo(R + 2, top - 2.0, L1, top - 4.6);
    lugShape.lineTo(L1, top - 6.4);
    lugShape.quadraticCurveTo(R + 1.5, top - 5.6, L0, bottom + 2);
  } else {
    lugShape.moveTo(L0, top - 1.6);
    lugShape.lineTo(R - 1, top - 1.7);
    lugShape.quadraticCurveTo(L1 - 0.8, top - 2.2, L1, top - 4.0);
    lugShape.lineTo(L1, top - 6.0);
    lugShape.quadraticCurveTo(R + 1.5, top - 5.6, R - 0.5, bottom + 1.6);
    lugShape.lineTo(L0, bottom + 1.2);
  }
  lugShape.closePath();
  const lugGeo = new THREE.ExtrudeGeometry(lugShape, { depth: lugW, bevelEnabled: true, bevelThickness: 0.35, bevelSize: 0.35, bevelSegments: 4, curveSegments: 24 });
  lugGeo.translate(0, 0, -lugW / 2);
  // shape x → world y (outward), shape y → world z (height), extrude z → world x
  lugGeo.applyMatrix4(new THREE.Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1));
  for (const sy of [1, -1]) for (const sx of [1, -1]) {
    const m = new THREE.Mesh(lugGeo, caseMat);
    m.position.x = sx * (gap / 2 + lugW / 2 + 0.35);
    m.scale.y = sy;
    group.add(m);
  }

  // crown at three
  const crownR = model.layout === 'chrono' ? 2.9 : model.bezel === 'thin' ? 2.4 : 3.1;
  const crownGeo = new THREE.CylinderGeometry(crownR, crownR, 2.6, 96, 1);
  const pos = crownGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), r = Math.hypot(x, z);
    if (r > crownR * 0.98) {
      const a = Math.atan2(z, x), k = 1 + 0.035 * Math.sign(Math.cos(a * 30));
      pos.setX(i, x * k); pos.setZ(i, z * k);
    }
  }
  crownGeo.computeVertexNormals();
  const crown = new THREE.Mesh(crownGeo, polish);
  crown.rotation.z = Math.PI / 2;
  const crownZ = (top + bottom) / 2 + 0.6;
  crown.position.set(R + 2.0, 0, crownZ);
  group.add(crown);
  const capGeo = new THREE.CylinderGeometry(crownR * 0.72, crownR * 0.72, 0.4, 64);
  const cap = new THREE.Mesh(capGeo, polish);
  cap.rotation.z = Math.PI / 2;
  cap.position.set(R + 3.4, 0, crownZ);
  group.add(cap);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 1.6, 32), polish);
  stem.rotation.z = Math.PI / 2;
  stem.position.set(R + 0.4, 0, crownZ);
  group.add(stem);

  if (model.pushers) {
    for (const deg of [60, 120]) {
      const a = (deg * Math.PI) / 180;
      const p = new THREE.Group();
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 2.2, 32), polish);
      const head = new THREE.Mesh(new RoundedBoxGeometry(2.9, 2.2, 3.4, 4, 0.5), polish);
      head.position.y = 2.2;
      tube.position.y = 0.6;
      p.add(tube, head);
      p.position.set(Math.sin(a) * R, Math.cos(a) * R, crownZ);
      p.rotation.z = -a;
      group.add(p);
    }
  }

  return { group, top, bottom, dialZ, innerR, R };
}

// A hand pointing +Y from the pivot, as an extruded outline.
function handGeometry(style, length, width, tail = 0) {
  const s = new THREE.Shape();
  const w = width / 2;
  if (style === 'dauphine') {
    s.moveTo(0, -tail - 0.6);
    s.lineTo(w, length * 0.12);
    s.lineTo(0, length);
    s.lineTo(-w, length * 0.12);
  } else if (style === 'baton') {
    s.moveTo(-w * 0.75, -tail);
    s.lineTo(w * 0.75, -tail);
    s.lineTo(w * 0.75, length - w);
    s.lineTo(0, length);
    s.lineTo(-w * 0.75, length - w);
  } else if (style === 'seconds') {
    s.moveTo(-w, -tail);
    s.lineTo(w, -tail);
    s.lineTo(w * 0.45, length);
    s.lineTo(-w * 0.45, length);
  } else {                                    // sword
    s.moveTo(-w * 0.45, -tail);
    s.lineTo(w * 0.45, -tail);
    s.lineTo(w, length * 0.3);
    s.lineTo(w * 0.25, length * 0.97);
    s.lineTo(0, length);
    s.lineTo(-w * 0.25, length * 0.97);
    s.lineTo(-w, length * 0.3);
  }
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.07, bevelSize: style === 'dauphine' ? 0.12 : 0.06, bevelSegments: 2 });
  return geo;
}

function buildDial(model, col, kase) {
  const group = new THREE.Group();
  const R = kase.innerR - 1.05;
  const { texture, subs, subR } = dialTexture(model, col, R);
  const dial = new THREE.Mesh(new THREE.CircleGeometry(R, 160), new THREE.MeshPhysicalMaterial({
    map: texture, roughness: col.finish === 'sunburst' ? 0.32 : 0.62, metalness: col.finish === 'sunburst' ? 0.35 : 0.05,
    clearcoat: col.finish === 'sunburst' ? 0.3 : 0, clearcoatRoughness: 0.3
  }));
  dial.position.z = kase.dialZ;
  dial.receiveShadow = true;
  group.add(dial);

  // applied indices
  const idxMetal = metal(col.indexMetal || col.handMetal || col.metal);
  const shape = model.indices;
  const dims = shape === 'slim' ? [0.45, 3.4] : shape === 'short' ? [0.95, 2.0] : [1.0, 2.9];
  const idxGeo = new RoundedBoxGeometry(dims[0], dims[1], 0.45, 2, 0.12);
  for (let h = 0; h < 12; h++) {
    if (model.layout === 'small-seconds' && h === 6) continue;
    const a = (h / 12) * TAU;
    const rr = R - 1.6 - dims[1] / 2;
    const pair = h === 0 ? [-0.75, 0.75] : [0];
    for (const off of pair) {
      const m = new THREE.Mesh(idxGeo, idxMetal);
      const ox = Math.cos(a) * off, oy = Math.sin(a) * off;
      m.position.set(Math.sin(a) * rr + ox, Math.cos(a) * rr - oy * 0, kase.dialZ + 0.22);
      if (h === 0) m.position.x = off;
      m.rotation.z = -a;
      m.castShadow = true;
      group.add(m);
    }
  }

  // hands at 10:09:36
  const handMat = metal(col.handMetal || col.metal);
  const z0 = kase.dialZ + 0.75;
  const hand = (geo, mat, deg, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.z = z;
    m.rotation.z = -(deg * Math.PI) / 180;
    m.castShadow = true;
    group.add(m);
    return m;
  };
  const hs = model.hands;
  hand(handGeometry(hs, R * 0.58, hs === 'dauphine' ? 1.5 : 1.7, 1.6), handMat, 304.8, z0);
  hand(handGeometry(hs, R * 0.9, hs === 'dauphine' ? 1.3 : 1.45, 1.8), handMat, 57.6, z0 + 0.32);
  const secMat = new THREE.MeshPhysicalMaterial({ color: col.seconds, metalness: 0.6, roughness: 0.3 });
  if (model.layout !== 'small-seconds') {
    hand(handGeometry('seconds', R * 0.94, 0.36, 4.2), secMat, 216, z0 + 0.64);
    const cw = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.2, 32), secMat);
    cw.rotation.x = Math.PI / 2;
    cw.position.set(Math.sin(216 * Math.PI / 180) * -3.2, Math.cos(216 * Math.PI / 180) * -3.2, z0 + 0.74);
    group.add(cw);
  }
  const pivot = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 1.6, 32), model.layout === 'small-seconds' ? handMat : secMat);
  pivot.rotation.x = Math.PI / 2;
  pivot.position.z = z0 + 0.2;
  group.add(pivot);

  // sub-dial hands
  subs.forEach(([x, y], i) => {
    const deg = model.layout === 'small-seconds' ? 150 : i === 0 ? 210 : 0;
    const m = hand(handGeometry('seconds', subR * 0.85, 0.32, 1.2), model.layout === 'small-seconds' ? handMat : secMat, deg, kase.dialZ + 0.25);
    m.position.x = x; m.position.y = -y;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.6, 24), handMat);
    p.rotation.x = Math.PI / 2;
    p.position.set(x, -y, kase.dialZ + 0.35);
    group.add(p);
  });

  // crystal
  const cr = kase.innerR + 0.2, Rs = 160, theta = Math.asin(cr / Rs);
  const crystal = new THREE.Mesh(new THREE.SphereGeometry(Rs, 160, 8, 0, TAU, 0, theta), new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: 0.02, transmission: 1, thickness: 0.8, ior: 1.6,
    transparent: true, specularIntensity: 0.55, envMapIntensity: 0.8
  }));
  crystal.rotation.x = Math.PI / 2;
  crystal.position.z = kase.top - 0.45 - Rs * Math.cos(theta);
  group.add(crystal);
  return group;
}

// The strap as one loop from the top lugs round the back to the bottom lugs, as
// it sits on a wrist. A rounded rectangle swept along a curve in the YZ plane.
function buildStrap(model, strapDef, kase) {
  const W0 = model.strapWidth - 0.3, W1 = W0 - 2.5, T = strapDef.type === 'rubber' ? 3.4 : 2.9;
  const yL = kase.R + 3.9, zL = kase.top - 4.6;
  const pts = [
    [yL - 4, zL + 0.4], [yL, zL], [yL + 7, zL - 4], [yL + 11, zL - 13], [yL + 11.5, zL - 25],
    [yL + 6, zL - 38], [yL - 8, zL - 47], [0, zL - 49.5],
    [-(yL - 8), zL - 47], [-(yL + 6), zL - 38], [-(yL + 11.5), zL - 25], [-(yL + 11), zL - 13], [-(yL + 7), zL - 4], [-yL, zL], [-(yL - 4), zL + 0.4]
  ].map(([y, z]) => new THREE.Vector3(0, y, z));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const N = 360, M = 28;
  const length = curve.getLength();
  const tex = strapTextures(strapDef, length, W0);

  // cross-section: rounded rectangle, u across the width
  const sect = [];
  const cr = T * 0.45;
  for (let i = 0; i < M; i++) {
    const t = i / M;
    // walk the perimeter: top edge, right cap, bottom edge, left cap
    let x, y, nx, ny;
    if (t < 0.4) { const k = t / 0.4; x = -0.5 + k; y = 0.5; nx = 0; ny = 1; }
    else if (t < 0.5) { const a = ((t - 0.4) / 0.1) * Math.PI; x = 0.5; y = Math.cos(a) * 0.5; nx = Math.sin(a); ny = Math.cos(a); }
    else if (t < 0.9) { const k = (t - 0.5) / 0.4; x = 0.5 - k; y = -0.5; nx = 0; ny = -1; }
    else { const a = ((t - 0.9) / 0.1) * Math.PI; x = -0.5; y = -Math.cos(a) * 0.5; nx = -Math.sin(a); ny = -Math.cos(a); }
    sect.push({ x, y, nx, ny });
  }
  const P = [], Nn = [], UV = [], I = [];
  const X = new THREE.Vector3(1, 0, 0);
  for (let j = 0; j <= N; j++) {
    const v = j / N;
    const p = curve.getPointAt(v), tan = curve.getTangentAt(v);
    const nrm = new THREE.Vector3().crossVectors(tan, X).normalize();   // across the thickness, outward
    const w = W1 + (W0 - W1) * Math.pow(Math.abs(v - 0.5) * 2, 2.5);
    for (const s of sect) {
      const ex = s.x * w + Math.sign(s.x) * 0;
      const capX = Math.abs(s.x) === 0.5 && Math.abs(s.y) < 0.5 ? s.x * w + Math.sign(s.x) * (cr * Math.sqrt(1 - (2 * s.y) ** 2) - cr) : ex;
      const pos = p.clone().addScaledVector(X, capX).addScaledVector(nrm, s.y * T);
      P.push(pos.x, pos.y, pos.z);
      const n = new THREE.Vector3().addScaledVector(X, s.nx).addScaledVector(nrm, s.ny).normalize();
      Nn.push(n.x, n.y, n.z);
      UV.push(Math.min(1, Math.max(0, (s.x * w + w / 2) / W0 + (W0 - w) / (2 * W0))), v);
    }
  }
  for (let j = 0; j < N; j++) for (let i = 0; i < M; i++) {
    const a = j * M + i, b = j * M + (i + 1) % M, c = (j + 1) * M + i, d = (j + 1) * M + (i + 1) % M;
    I.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  geo.setIndex(I);
  tex.map.repeat.set(1, 1);
  const mat = new THREE.MeshPhysicalMaterial({
    map: tex.map, bumpMap: tex.bump, bumpScale: strapDef.type === 'leather' ? 1.6 : 0.8,
    roughness: strapDef.type === 'leather' ? 0.55 : 0.72, metalness: 0,
    sheen: strapDef.type === 'leather' ? 0.4 : 0, sheenRoughness: 0.6, sheenColor: new THREE.Color(0x777777),
    side: THREE.DoubleSide
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const box = new THREE.Box3().setFromObject(mesh);
  return { mesh, floorY: box.min.y };
}

/* ----------------------------------------------------------- contact shadow */

// A soft shadow under the watch: render the scene's depth from below, blur it,
// and lay it on the floor. Cheap, and softer than a shadow map.
function contactShadow(scene, size, y, darkness = 1.1, blur = 3.2) {
  const group = new THREE.Group();
  group.position.y = y;
  const rt = new THREE.WebGLRenderTarget(1024, 1024); rt.texture.generateMipmaps = false;
  const rtB = new THREE.WebGLRenderTarget(1024, 1024); rtB.texture.generateMipmaps = false;
  const geo = new THREE.PlaneGeometry(size, size).rotateX(Math.PI / 2);
  const plane = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: rt.texture, transparent: true, depthWrite: false, opacity: 0.9 }));
  plane.renderOrder = 1;
  plane.scale.y = -1;
  group.add(plane);
  const blurPlane = new THREE.Mesh(geo);
  blurPlane.visible = false;
  group.add(blurPlane);
  const cam = new THREE.OrthographicCamera(-size / 2, size / 2, size / 2, -size / 2, 0, 60);
  cam.rotation.x = Math.PI / 2;
  group.add(cam);
  const depthMat = new THREE.MeshDepthMaterial();
  depthMat.onBeforeCompile = (shader) => {
    shader.uniforms.darkness = { value: darkness };
    shader.fragmentShader = 'uniform float darkness;\n' + shader.fragmentShader.replace(
      'gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );',
      'gl_FragColor = vec4( vec3( 0.0 ), ( 1.0 - fragCoordZ ) * darkness );');
  };
  depthMat.depthTest = false; depthMat.depthWrite = false;
  const hb = new THREE.ShaderMaterial(HorizontalBlurShader); hb.depthTest = false;
  const vb = new THREE.ShaderMaterial(VerticalBlurShader); vb.depthTest = false;
  scene.add(group);

  return function render() {
    const bg = scene.background, fog = scene.fog;
    scene.background = null; scene.fog = null;
    const hidden = [];
    scene.traverse((o) => { if (o.userData.noContact && o.visible) { o.visible = false; hidden.push(o); } });
    plane.visible = false;
    scene.overrideMaterial = depthMat;
    const tm = renderer.toneMapping;
    const clear = renderer.getClearColor(new THREE.Color());
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setRenderTarget(rt);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(scene, cam);
    scene.overrideMaterial = null;
    for (let i = 0; i < 3; i++) {
      const amt = blur * (i ? 0.6 : 1);
      blurPlane.visible = true;
      blurPlane.material = hb; hb.uniforms.tDiffuse.value = rt.texture; hb.uniforms.h.value = amt / 256;
      renderer.setRenderTarget(rtB); renderer.render(blurPlane, cam);
      blurPlane.material = vb; vb.uniforms.tDiffuse.value = rtB.texture; vb.uniforms.v.value = amt / 256;
      renderer.setRenderTarget(rt); renderer.render(blurPlane, cam);
      blurPlane.visible = false;
    }
    renderer.setRenderTarget(null);
    renderer.setClearColor(clear, 1);
    renderer.toneMapping = tm;
    plane.visible = true;
    hidden.forEach((o) => { o.visible = true; });
    scene.background = bg; scene.fog = fog;
  };
}

/* ------------------------------------------------------------------- shots */

const MODELS = {}, STRAPS = {};

function buildWatch(modelId, colourId, strapId) {
  const model = MODELS[modelId], col = model.colours[colourId];
  const watch = new THREE.Group();
  const kase = buildCase(model, col);
  kase.group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  watch.add(kase.group);
  watch.add(buildDial(model, col, kase));
  const strap = buildStrap(model, STRAPS[strapId], kase);
  watch.add(strap.mesh);
  return { watch, floorY: strap.floorY, kase };
}

/* spec: { model, colour, strap, angle, width, height, mood } */
async function shot(spec) {
  const { width, height } = spec;
  renderer.setSize(width, height, false);
  const scene = new THREE.Scene();
  const dark = spec.mood === 'dark';
  scene.environment = studioEnvironment(spec.mood);
  scene.environmentIntensity = 1;

  const { watch, floorY, kase } = buildWatch(spec.model, spec.colour, spec.strap);
  scene.add(watch);

  const angle = ANGLES[spec.angle];
  watch.rotation.y = angle.turn;
  watch.rotation.x = angle.tilt || 0;

  const bgHex = dark ? 0x0b0b0c : (spec.bg ? parseInt(spec.bg.slice(1), 16) : 0xecebe7);
  renderer.setClearColor(bgHex, 1);
  scene.background = null;

  // key light with a soft shadow map (hands onto the dial, case onto strap)
  const key = new THREE.DirectionalLight(0xffffff, dark ? 0.5 : 1.6);
  key.position.set(-60, 90, 80);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  key.shadow.camera.left = -60; key.shadow.camera.right = 60;
  key.shadow.camera.top = 60; key.shadow.camera.bottom = -60;
  key.shadow.camera.near = 10; key.shadow.camera.far = 300;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 6;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xfff4e6, dark ? 1.6 : 0.6);
  rim.position.set(80, 40, -60);
  scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xffffff, dark ? 0x101012 : 0xd8d6d0, dark ? 0.15 : 0.35));

  let floor = null;
  if (dark) {
    // a pool of light on the stone, falling off into black
    const spot = new THREE.SpotLight(0xfff6ea, 5.5, 0, 0.3, 0.95, 0);
    spot.position.set(-110, 280, 150);
    spot.target.position.set(0, floorY, -10);
    spot.castShadow = true;
    spot.shadow.mapSize.set(4096, 4096);
    spot.shadow.bias = -0.0003;
    spot.shadow.radius = 4;
    scene.add(spot, spot.target);
    const st = stoneTextures();
    st.map.repeat.set(4, 4); st.bump.repeat.set(4, 4);
    floor = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshStandardMaterial({
      map: st.map, bumpMap: st.bump, bumpScale: 0.9, roughness: 0.7, metalness: 0.0
    }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = floorY - 0.05;
    floor.receiveShadow = true;
    floor.userData.noContact = true;
    scene.add(floor);
    scene.fog = new THREE.Fog(0x0b0b0c, 180, 520);
  }

  const drawContact = contactShadow(scene, 200, floorY + 0.02, dark ? 1.4 : 1.15, dark ? 3 : 3.6);

  const cam = new THREE.PerspectiveCamera(angle.fov || 22, width / height, 1, 2000);
  const target = new THREE.Vector3(...(angle.target || [0, 0, -6]));
  if (spec.frame === 'hero-right') target.x -= 46;
  if (spec.frame === 'hero-low') target.y += 22;
  cam.position.set(...angle.cam);
  cam.lookAt(target);
  void kase;

  drawContact();
  renderer.render(scene, cam);
  return renderer.domElement.toDataURL('image/webp', spec.quality || 0.9);
}

// camera set-ups, in mm; the watch turns rather than the camera
const ANGLES = {
  front: { turn: 0, cam: [0, 22, 190], target: [0, -4, -10], fov: 26 },
  three: { turn: -0.62, cam: [0, 34, 185], target: [0, -5, -14], fov: 26 },
  side: { turn: -1.18, cam: [0, 30, 185], target: [0, -5, -18], fov: 26 },
  detail: { turn: -0.3, cam: [6, 14, 112], target: [3, 1, 0], fov: 24 },
  hero: { turn: -0.42, cam: [0, 30, 205], target: [0, -2, -10], fov: 30 },
  macro: { turn: -0.7, cam: [14, 26, 120], target: [4, -2, -4], fov: 24 }
};

async function init(models, straps) {
  Object.assign(MODELS, models);
  Object.assign(STRAPS, straps);
  await document.fonts.load('600 40px Montserrat');
  await document.fonts.load('500 40px Montserrat');
}

window.AUREN = { init, shot };
window.AUREN_READY = true;
