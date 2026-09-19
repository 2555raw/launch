/* The 3D picture of the race.

   The engine in shared/race.js is two-dimensional and deterministic, and it
   stays that way: this file only reads it. Every step it takes the marbles'
   course positions and the movers' angles and puts them on a track that
   descends away from the camera at thirty-odd degrees, lit like an arcade
   cabinet: dark glass floor, neon rails, glowing pins, a checkered finish.

   Everything expensive is shared or pooled: one sphere geometry for every
   marble, one material per recipe, rails merged into a handful of meshes,
   sprites for labels only on the marbles that matter right now, and bloom
   switched off on small screens. */

(function () {
  'use strict';

  const S = {
    ready: false, renderer: null, scene: null, camera: null, composer: null, bloom: null,
    canvas: null, w: 1, h: 1, dpr: 1,
    race: null, course: null, players: new Map(), me: null,
    trackGroup: null, moverMeshes: [], marbles: new Map(), shadows: null,
    sparks: null, sparkData: [], confetti: null, confettiData: [],
    labels: new Map(), lights: {}, gateLights: [], boostMats: [],
    sphereGeo: null, capGeo: null, spinAngle: new Map(), lastSpeed: new Map(),
    gateLightState: 0, hitCount: 0
  };

  const K = 0.01;                       // course units → world
  const R = 13 * K;                     // marble radius in world units
  const W = (x, y, h) => CAMERA.world(x, y, h);
  const UP = () => CAMERA.UP;

  /* ---- setup ------------------------------------------------------------- */

  function init(canvas) {
    const THREE = window.THREE;
    if (!THREE) return false;
    S.canvas = canvas;
    S.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false });
    S.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    S.renderer.toneMappingExposure = 1.05;
    S.renderer.outputColorSpace = THREE.SRGBColorSpace;
    S.scene = new THREE.Scene();
    S.scene.background = new THREE.Color('#07070b');
    S.scene.fog = new THREE.FogExp2('#07070b', 0.022);
    S.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);

    /* light: a warm key from up-left, a cool fill, and a room map for the
       glass and chrome to have something to reflect */
    const key = new THREE.DirectionalLight('#ffe2c4', 1.6);
    key.position.set(-6, 12, 6);
    const fill = new THREE.DirectionalLight('#8fb4ff', 0.5);
    fill.position.set(8, 4, -6);
    const hemi = new THREE.HemisphereLight('#3a2a1a', '#05050a', 0.6);
    S.scene.add(key, fill, hemi);
    S.lights = { key, fill, hemi };
    const FX = window.THREE_FX;
    if (FX && FX.RoomEnvironment) {
      const pmrem = new THREE.PMREMGenerator(S.renderer);
      S.scene.environment = pmrem.fromScene(new FX.RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
    }

    S.sphereGeo = new THREE.SphereGeometry(R, 24, 16);
    S.shadowTex = softDisc(THREE);

    /* pooled sparks */
    const n = 400;
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    sg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const sm = new THREE.PointsMaterial({ size: 0.09, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending });
    S.sparks = new THREE.Points(sg, sm);
    S.sparks.frustumCulled = false;
    S.scene.add(S.sparks);
    for (let i = 0; i < n; i++) S.sparkData.push({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 });

    /* pooled confetti */
    const cn = 360;
    const cg = new THREE.PlaneGeometry(0.09, 0.05);
    const cm = new THREE.MeshBasicMaterial({ vertexColors: false, side: THREE.DoubleSide });
    S.confetti = new THREE.InstancedMesh(cg, cm, cn);
    S.confetti.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    S.confetti.count = 0;
    S.confetti.frustumCulled = false;
    S.scene.add(S.confetti);
    S.confettiColor = new THREE.Color();
    for (let i = 0; i < cn; i++) S.confettiData.push({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, c: '#fff' });

    resize();
    addEventListener('resize', resize);
    S.ready = true;
    return true;
  }

  function resize() {
    if (!S.renderer) return;
    const rect = S.canvas.getBoundingClientRect();
    S.w = Math.max(1, rect.width); S.h = Math.max(1, rect.height);
    const small = S.w < 760;
    S.dpr = Math.min(small ? 1.5 : 2, window.devicePixelRatio || 1);
    S.renderer.setPixelRatio(S.dpr);
    S.renderer.setSize(S.w, S.h, false);
    S.camera.aspect = S.w / S.h;
    S.camera.updateProjectionMatrix();
    setupPost(!small);
  }

  /* bloom on desktop, plain render on phones */
  function setupPost(bloom) {
    const THREE = window.THREE, FX = window.THREE_FX;
    if (!FX || !FX.EffectComposer) { S.composer = null; return; }
    if (!S.composer) {
      S.composer = new FX.EffectComposer(S.renderer);
      S.composer.addPass(new FX.RenderPass(S.scene, S.camera));
      S.bloom = new FX.UnrealBloomPass(new THREE.Vector2(S.w, S.h), 0.55, 0.5, 0.82);
      S.composer.addPass(S.bloom);
      S.composer.addPass(new FX.OutputPass());
    }
    S.bloom.enabled = bloom;
    S.composer.setSize(S.w, S.h);
    S.composer.setPixelRatio(S.dpr);
  }

  function softDisc(THREE) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const ctx = cv.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
    g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(cv);
  }

  /* ---- the course -------------------------------------------------------- */

  /* A capsule between two course points, `r` thick, lifted `h` off the plane. */
  function capsuleMesh(THREE, s, mat, h, radiusScale) {
    const a = W(s.x1, s.y1, h), b = W(s.x2, s.y2, h);
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const r = s.r * K * (radiusScale || 1);
    const geo = new THREE.CapsuleGeometry(r, Math.max(0.001, len), 3, 10);
    const m = new THREE.Mesh(geo, mat);
    m.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    if (len > 0.0001) {
      const dir = new THREE.Vector3(dx, dy, dz).normalize();
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    }
    return m;
  }

  function buildCourse(course) {
    const THREE = window.THREE;
    if (S.trackGroup) { disposeGroup(S.trackGroup); S.scene.remove(S.trackGroup); }
    const g = new THREE.Group();
    S.trackGroup = g;
    S.moverMeshes = [];
    S.gateLights = [];
    S.boostMats = [];
    S.course = course;

    const up = UP();
    const height = course.height;

    /* the floor: dark glass with a faint grid, one plane the length of the course */
    const floorTex = gridTexture(THREE);
    floorTex.repeat.set(5, height / 200);
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    const floorMat = new THREE.MeshStandardMaterial({ color: '#181a26', map: floorTex, roughness: 0.28, metalness: 0.55, emissive: '#2a1a0a', emissiveMap: floorTex, emissiveIntensity: 0.55 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(11.2, height * K + 6), floorMat);
    const mid = W(500, height / 2, -R * 1.05);
    floor.position.set(mid.x, mid.y, mid.z);
    floor.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(up.x, up.y, up.z));
    g.add(floor);

    /* the arena: a wide dark apron either side, and light pylons down the
       course so there is depth to read speed against */
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(80, height * K + 40), new THREE.MeshStandardMaterial({ color: '#08080d', roughness: 0.9, metalness: 0.1 }));
    const am = W(500, height / 2, -R * 1.6);
    apron.position.set(am.x, am.y, am.z);
    apron.quaternion.copy(floor.quaternion);
    g.add(apron);
    const pylonMat = new THREE.MeshBasicMaterial({ color: '#ff7a1a' });
    const pylonDark = new THREE.MeshStandardMaterial({ color: '#1b1d2a', roughness: 0.5, metalness: 0.7 });
    for (let y = 0; y < height; y += 900) {
      for (const x of [-260, 1260]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.5, 8), pylonDark);
        const p = W(x, y, 2.1);
        post.position.set(p.x, p.y, p.z);
        post.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(up.x, up.y, up.z));
        g.add(post);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), pylonMat);
        const lp = W(x, y, 4.4);
        lamp.position.set(lp.x, lp.y, lp.z);
        g.add(lamp);
      }
    }

    /* side glow strips, orange, the length of the track */
    const stripMat = new THREE.MeshBasicMaterial({ color: '#ff7a1a' });
    for (const x of [-8, 1008]) {
      const strip = capsuleMesh(THREE, { x1: x, y1: -300, x2: x, y2: height, r: 4 }, stripMat, -R * 0.6, 1);
      g.add(strip);
    }

    /* rails, pegs, boosts */
    const railMat = new THREE.MeshStandardMaterial({ color: '#2a2f45', roughness: 0.35, metalness: 0.8 });
    const railEdge = new THREE.MeshBasicMaterial({ color: '#7b8bb8', transparent: true, opacity: 0.55 });
    const pegMat = new THREE.MeshStandardMaterial({ color: '#3a3f5a', roughness: 0.3, metalness: 0.85 });
    const pegCap = new THREE.MeshBasicMaterial({ color: '#ffb36b' });
    const bumperCap = new THREE.MeshBasicMaterial({ color: '#ff5ea8' });
    for (const s of course.statics) {
      const isPeg = s.x1 === s.x2 && s.y1 === s.y2;
      if (s.boost) {
        const tex = chevronTexture(THREE);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        const L = Math.hypot(s.x2 - s.x1, s.y2 - s.y1) * K;
        tex.repeat.set(1, Math.max(2, L / 0.35));
        const bm = new THREE.MeshStandardMaterial({ map: tex, emissive: '#ff7a1a', emissiveMap: tex, emissiveIntensity: 1.4, color: '#ff9a3c', roughness: 0.4 });
        S.boostMats.push(tex);
        g.add(capsuleMesh(THREE, s, bm, 0, 1.15));
        continue;
      }
      if (isPeg) {
        const bumper = s.b > 0.6;
        const p = W(s.x1, s.y1, 0);
        const pin = new THREE.Mesh(new THREE.CylinderGeometry(s.r * K, s.r * K * 1.15, R * 2.6, 14), pegMat);
        pin.position.set(p.x + up.x * R * 0.3, p.y + up.y * R * 0.3, p.z + up.z * R * 0.3);
        pin.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(up.x, up.y, up.z));
        g.add(pin);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(s.r * K * 0.75, s.r * K * 0.75, 0.02, 14), bumper ? bumperCap : pegCap);
        const cp = W(s.x1, s.y1, R * 1.62);
        cap.position.set(cp.x, cp.y, cp.z);
        cap.quaternion.copy(pin.quaternion);
        g.add(cap);
      } else {
        g.add(capsuleMesh(THREE, s, railMat, 0, 1));
        /* the lit top edge */
        g.add(capsuleMesh(THREE, s, railEdge, s.r * K * 0.85, 0.22));
      }
    }

    /* movers get their own meshes, updated every frame */
    const moverMat = new THREE.MeshStandardMaterial({ color: '#c8365f', emissive: '#ff2f6d', emissiveIntensity: 0.55, roughness: 0.3, metalness: 0.6 });
    const gateMat = new THREE.MeshStandardMaterial({ color: '#ffd36e', emissive: '#ffb020', emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.5 });
    const list = [];
    for (const m of course.movers) RACE.moverSegments(m, 0, list, true);
    for (const seg of list) {
      const mesh = capsuleMesh(THREE, seg, seg.gate ? gateMat : moverMat, 0, 1);
      mesh.userData.len = 1;
      g.add(mesh);
      S.moverMeshes.push(mesh);
    }
    /* the hubs of the spinners and pistons */
    const hubMat = new THREE.MeshBasicMaterial({ color: '#ff5ea8' });
    for (const m of course.movers) {
      if (m.kind === 'gate') continue;
      const p = W(m.x, m.y, R * 0.2);
      const hub = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), hubMat);
      hub.position.set(p.x, p.y, p.z);
      g.add(hub);
    }

    /* the start gantry: a bar across the hopper with three lamps */
    const gantry = capsuleMesh(THREE, { x1: 60, y1: 430, x2: 940, y2: 430, r: 8 }, railMat, 2.2, 1);
    g.add(gantry);
    for (let i = 0; i < 3; i++) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), new THREE.MeshBasicMaterial({ color: '#3a1a1a' }));
      const p = W(380 + i * 120, 430, 2.2);
      lamp.position.set(p.x, p.y, p.z + 0.02);
      g.add(lamp);
      S.gateLights.push(lamp);
    }
    for (const x of [60, 940]) g.add(capsuleMesh(THREE, { x1: x, y1: 430, x2: x, y2: 430, r: 6 }, railMat, 1.1, 1).scale.set(1, 1, 1) && capsuleMesh(THREE, { x1: x, y1: 430, x2: x, y2: 431, r: 6 }, railMat, 0, 1));
    for (const x of [60, 940]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.3, 8), railMat);
      const p = W(x, 430, 1.1);
      post.position.set(p.x, p.y, p.z);
      post.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(up.x, up.y, up.z));
      g.add(post);
    }

    /* the finish: a checkered band, two pylons and a lit arch */
    const checker = checkerTexture(THREE);
    checker.repeat.set(10, 2);
    checker.wrapS = checker.wrapT = THREE.RepeatWrapping;
    const band = new THREE.Mesh(new THREE.PlaneGeometry(10, 0.6), new THREE.MeshBasicMaterial({ map: checker }));
    const fp = W(500, course.finishY, -R * 0.98);
    band.position.set(fp.x, fp.y, fp.z);
    band.quaternion.copy(floor.quaternion);
    g.add(band);
    const arch = capsuleMesh(THREE, { x1: -20, y1: course.finishY, x2: 1020, y2: course.finishY, r: 5 }, new THREE.MeshBasicMaterial({ color: '#7dff9b' }), 2.4, 1);
    g.add(arch);
    for (const x of [-20, 1020]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.5, 8), new THREE.MeshBasicMaterial({ color: '#7dff9b' }));
      const p = W(x, course.finishY, 1.2);
      post.position.set(p.x, p.y, p.z);
      post.quaternion.copy(pin_quat(THREE));
      g.add(post);
    }
    g.add(textSprite(THREE, 'FINISH', '#7dff9b', 1.6, W(500, course.finishY - 140, 1.9)));

    S.scene.add(g);
  }

  function pin_quat(THREE) {
    const up = UP();
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(up.x, up.y, up.z));
  }

  function gridTexture(THREE) {
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#12131c'; ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = 'rgba(255,150,70,.55)'; ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, 125, 125);
    ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(64, 0); ctx.lineTo(64, 128); ctx.moveTo(0, 64); ctx.lineTo(128, 64); ctx.stroke();
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  function chevronTexture(THREE) {
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#5a2a08'; ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#ffb36b';
    ctx.beginPath(); ctx.moveTo(4, 40); ctx.lineTo(32, 12); ctx.lineTo(60, 40); ctx.lineTo(60, 56); ctx.lineTo(32, 28); ctx.lineTo(4, 56); ctx.closePath(); ctx.fill();
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  function checkerTexture(THREE) {
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#eaeaf2'; ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#101018'; ctx.fillRect(0, 0, 32, 32); ctx.fillRect(32, 32, 32, 32);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; return t;
  }

  /* a floating text sprite: names above marbles, FINISH over the line */
  function textSprite(THREE, text, color, scale, at, sub) {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = sub ? 96 : 64;
    const ctx = cv.getContext('2d');
    ctx.font = '700 34px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = Math.min(248, ctx.measureText(text).width + 28);
    ctx.fillStyle = 'rgba(8,8,14,.72)';
    roundRect(ctx, 128 - w / 2, 8, w, 48, 12); ctx.fill();
    ctx.fillStyle = color; ctx.fillText(text, 128, 33);
    if (sub) { ctx.font = '600 22px ui-monospace, monospace'; ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillText(sub, 128, 76); }
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    sp.scale.set(scale, scale * (sub ? 0.375 : 0.25), 1);
    if (at) sp.position.set(at.x, at.y, at.z);
    sp.renderOrder = 10;
    return sp;
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function disposeGroup(g) {
    g.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material && !o.material.userData.shared) {
        if (o.material.map && o.material.map.userData && o.material.map.userData.own) o.material.map.dispose();
      }
    });
  }

  /* ---- the field --------------------------------------------------------- */

  /**
   * players: [{address, color, face, material, name}]
   * me: address of the connected wallet
   */
  function setRace(state, players, me) {
    const THREE = window.THREE;
    if (!S.ready) return;
    S.race = state;
    S.me = me || null;
    if (!S.course || S.course !== state.course) buildCourse(state.course);
    for (const m of S.marbles.values()) { S.scene.remove(m.mesh); S.scene.remove(m.shadow); if (m.label) S.scene.remove(m.label); if (m.halo) S.scene.remove(m.halo); }
    S.marbles.clear();
    S.players.clear();
    S.spinAngle.clear();
    S.lastSpeed.clear();
    for (const p of players) S.players.set(p.address, p);
    for (const b of state.balls) addMarble(b.id);
    S.confetti.count = 0;
    for (const d of S.sparkData) d.life = 0;
  }

  function addMarble(address) {
    const THREE = window.THREE;
    const p = S.players.get(address) || { address, color: '#ff7a1a', face: 'doge', material: SKINS.materialOf(address) };
    const mat = SKINS.marbleMaterial(THREE, { material: p.material || SKINS.materialOf(address), color: p.color, face: p.face });
    const mesh = new THREE.Mesh(S.sphereGeo, mat);
    S.scene.add(mesh);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(R * 3.2, R * 3.2), new THREE.MeshBasicMaterial({ map: S.shadowTex, transparent: true, depthWrite: false }));
    shadow.material.userData.shared = true;
    const up = UP();
    shadow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(up.x, up.y, up.z));
    shadow.renderOrder = 1;
    S.scene.add(shadow);
    const you = address === S.me;
    const name = p.name || (address.startsWith('0x') ? address.slice(0, 5) + '…' + address.slice(-3) : address.slice(0, 4) + '…' + address.slice(-3));
    const label = textSprite(THREE, name, you ? '#ffb36b' : '#ffffff', 1.05, null, you ? 'YOU' : null);
    label.visible = false;
    S.scene.add(label);
    S.marbles.set(address, { mesh, shadow, label, you, name });
  }

  /* the lobby adds marbles one at a time */
  function addPlayer(p) {
    if (!S.ready || !S.race) return;
    S.players.set(p.address, p);
    if (!S.marbles.has(p.address)) addMarble(p.address);
  }

  /* ---- per frame --------------------------------------------------------- */

  const tmpV = { a: null, b: null, q: null, m: null };
  function sync(dt, opts) {
    const THREE = window.THREE;
    if (!S.ready || !S.race) return;
    const st = S.race;
    const up = UP();
    const hold = st.hold;

    /* movers */
    const list = [];
    for (const m of st.course.movers) RACE.moverSegments(m, st.t, list, hold);
    for (let i = 0; i < S.moverMeshes.length && i < list.length; i++) {
      const seg = list[i], mesh = S.moverMeshes[i];
      const a = W(seg.x1, seg.y1, 0), b = W(seg.x2, seg.y2, 0);
      mesh.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
      const dir = new THREE.Vector3(b.x - a.x, b.y - a.y, b.z - a.z);
      if (dir.lengthSq() > 1e-8) mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    }

    /* boost chevrons run */
    for (const t of S.boostMats) t.offset.y -= dt * 1.8;

    /* gate lamps: red while held, amber in the last seconds, green at go */
    const cd = opts && opts.countdown;
    for (let i = 0; i < S.gateLights.length; i++) {
      const lamp = S.gateLights[i];
      let c = '#3a1a1a';
      if (cd !== undefined && cd !== null) {
        if (cd <= 0) c = '#39ff88';
        else if (cd <= 3 - i) c = '#ff9a3c';
        else c = '#ff3b3b';
      } else if (!hold && st.t > 0) c = '#39ff88';
      lamp.material.color.set(c);
    }

    /* marbles */
    const ranked = [];
    for (const b of st.balls) if (!b.done) ranked.push(b);
    ranked.sort((p, q) => q.y - p.y);
    const showLabel = new Set();
    for (let i = 0; i < Math.min(8, ranked.length); i++) showLabel.add(ranked[i].id);

    for (const b of st.balls) {
      const m = S.marbles.get(b.id);
      if (!m) continue;
      /* A marble that has finished parks past the line in finishing order,
         ten to a row, instead of falling out of the picture: the podium is
         a real place on the track. */
      let p;
      if (b.done) {
        const k = b.place - 1;
        p = W(140 + (k % 10) * 80, st.course.finishY + 90 + Math.floor(k / 10) * 44, 0);
      } else p = W(b.x, b.y, 0);
      m.mesh.position.set(p.x, p.y, p.z);
      /* spin: the engine gives a signed roll rate; add the sideways part */
      const a = S.spinAngle.get(b.id) || { f: 0, s: 0 };
      a.f += (b.spin || (b.vy / (13))) * dt;
      a.s += (b.vx / 13) * dt;
      S.spinAngle.set(b.id, a);
      m.mesh.rotation.set(-a.f, 0, -a.s);
      m.mesh.visible = true;
      m.shadow.visible = true;
      const sp = W(b.done ? 140 + ((b.place - 1) % 10) * 80 : b.x, b.done ? st.course.finishY + 90 + Math.floor((b.place - 1) / 10) * 44 : b.y, -R * 0.96);
      m.shadow.position.set(sp.x, sp.y, sp.z);
      const wantLabel = (m.you || showLabel.has(b.id) || (b.done && b.place <= 3)) && !hold;
      m.label.visible = wantLabel;
      if (wantLabel) m.label.position.set(p.x + up.x * R * 3.2, p.y + up.y * R * 3.2, p.z + up.z * R * 3.2);
      if (b.done && b.place === 1 && !m.crowned) {
        m.crowned = true;
        const halo = new THREE.Mesh(new THREE.TorusGeometry(R * 1.9, R * 0.16, 8, 32), new THREE.MeshBasicMaterial({ color: '#ffd36e' }));
        halo.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(up.x, up.y, up.z));
        m.halo = halo; S.scene.add(halo);
      }
      if (m.halo) { m.halo.position.set(p.x, p.y, p.z); m.halo.rotation.z += dt * 1.5; }

      /* sparks on a hard hit, from the speed the marble lost */
      const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      const was = S.lastSpeed.get(b.id) || speed;
      if (was - speed > 340 && !b.done) {
        burst(p, 4, S.players.get(b.id)?.color || '#ffb36b', 0.9);
        if (window.SOUND) SOUND.play('hit');
        if (S.me === b.id && window.CAMERA) CAMERA.shake(0.05);
      }
      S.lastSpeed.set(b.id, speed);
    }

    updateParticles(dt);

    /* camera */
    const c = CAMERA.decide(st, dt);
    S.camera.position.set(c.pos.x, c.pos.y, c.pos.z);
    S.camera.lookAt(c.look.x, c.look.y, c.look.z);
    if (Math.abs(S.camera.fov - c.fov) > 0.05) { S.camera.fov = c.fov; S.camera.updateProjectionMatrix(); }
    /* the key light rides with the camera so the leader is always lit */
    S.lights.key.position.set(c.pos.x - 4, c.pos.y + 8, c.pos.z + 3);
    S.lights.key.target.position.set(c.look.x, c.look.y, c.look.z);
    S.lights.key.target.updateMatrixWorld();
  }

  function render() {
    if (!S.ready) return;
    if (S.composer) S.composer.render(); else S.renderer.render(S.scene, S.camera);
  }

  /* ---- particles --------------------------------------------------------- */

  function burst(at, n, color, power) {
    const THREE = window.THREE;
    const col = new THREE.Color(color);
    let placed = 0;
    for (const d of S.sparkData) {
      if (d.life > 0) continue;
      d.life = 0.5 + Math.random() * 0.4;
      d.x = at.x; d.y = at.y; d.z = at.z;
      d.vx = (Math.random() - 0.5) * 2.4 * power; d.vy = Math.random() * 2.2 * power; d.vz = (Math.random() - 0.5) * 2.4 * power;
      d.r = col.r; d.g = col.g; d.b = col.b;
      if (++placed >= n) break;
    }
  }

  function celebrate(address) {
    const m = S.marbles.get(address);
    const at = m ? m.mesh.position : S.camera.position;
    const colors = ['#ff7a1a', '#ffd36e', '#7dff9b', '#ffffff', '#ff5ea8'];
    let placed = 0;
    for (const d of S.confettiData) {
      if (d.life > 0) continue;
      d.life = 2.6 + Math.random() * 1.4;
      d.x = at.x + (Math.random() - 0.5) * 1.5; d.y = at.y + 0.6; d.z = at.z + (Math.random() - 0.5) * 1.5;
      d.vx = (Math.random() - 0.5) * 3; d.vy = 2 + Math.random() * 3.2; d.vz = (Math.random() - 0.5) * 3;
      d.rx = Math.random() * 6; d.ry = Math.random() * 6; d.c = colors[placed % colors.length];
      if (++placed >= 300) break;
    }
    burst(at, 60, '#ffd36e', 1.6);
    if (window.CAMERA) CAMERA.shake(0.08);
  }

  function cheer(address) {
    const m = S.marbles.get(address);
    if (m) burst(m.mesh.position, 12, '#ff5ea8', 0.8);
  }

  function updateParticles(dt) {
    const THREE = window.THREE;
    const pos = S.sparks.geometry.attributes.position.array;
    const col = S.sparks.geometry.attributes.color.array;
    let i = 0;
    for (const d of S.sparkData) {
      if (d.life > 0) {
        d.life -= dt; d.vy -= 5 * dt;
        d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
        pos[i * 3] = d.x; pos[i * 3 + 1] = d.y; pos[i * 3 + 2] = d.z;
        const k = Math.max(0, d.life);
        col[i * 3] = d.r * k; col[i * 3 + 1] = d.g * k; col[i * 3 + 2] = d.b * k;
      } else { pos[i * 3 + 1] = -999; }
      i++;
    }
    S.sparks.geometry.attributes.position.needsUpdate = true;
    S.sparks.geometry.attributes.color.needsUpdate = true;

    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3();
    let count = 0;
    for (let j = 0; j < S.confettiData.length; j++) {
      const d = S.confettiData[j];
      if (d.life <= 0) continue;
      d.life -= dt; d.vy -= 3.2 * dt; d.vx *= 0.995; d.vz *= 0.995;
      d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
      d.rx += dt * 4; d.ry += dt * 3;
      e.set(d.rx, d.ry, 0); q.setFromEuler(e); v.set(d.x, d.y, d.z);
      m.compose(v, q, sc);
      S.confetti.setMatrixAt(count, m);
      S.confetti.setColorAt(count, S.confettiColor.set(d.c));
      count++;
    }
    S.confetti.count = count;
    if (count) { S.confetti.instanceMatrix.needsUpdate = true; if (S.confetti.instanceColor) S.confetti.instanceColor.needsUpdate = true; }
  }

  window.SCENE = { init, resize, setRace, addPlayer, sync, render, celebrate, cheer, burst, get ready() { return S.ready; }, get camera() { return S.camera; } };
})();
