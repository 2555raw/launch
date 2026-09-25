/* Night sky over the header scene: stars twinkling across the top of the sky
 * and shooting stars streaking through it. Runs only in dark mode, pauses
 * when the tab is hidden, and holds still for prefers-reduced-motion. */
/* an indoor scene (the tea room) has no sky and no field: no stars, no wind */
const skyIndoor = (sky) => /\/art\/(room-|gen\/)/.test((sky.querySelector('img.day') || { getAttribute: () => '' }).getAttribute('src') || '');
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('.sky').forEach((sky) => {
    if (skyIndoor(sky)) return;
    const cv = document.createElement('canvas');
    cv.className = 'sky-fx';
    sky.appendChild(cv);
    const ctx = cv.getContext('2d');
    let w = 0, h = 0, dpr = 1, raf = 0;
    const stars = [], trails = [];
    let nextStar = 0;

    const resize = () => {
      dpr = Math.min(2, devicePixelRatio || 1);
      w = sky.clientWidth; h = sky.clientHeight;
      cv.width = w * dpr; cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    /* a ceiling of stars: dense at the top, thinning toward the horizon */
    const seedStars = () => {
      stars.length = 0;
      const n = Math.round(Math.min(260, (w * h) / 5200));
      for (let i = 0; i < n; i++) {
        const big = Math.random() < 0.08;
        stars.push({
          x: Math.random(), y: Math.pow(Math.random(), 1.7) * 0.5,
          r: big ? 1.2 + Math.random() * 0.9 : 0.4 + Math.random() * 0.7,
          base: big ? 0.75 : 0.3 + Math.random() * 0.45,
          sp: 0.6 + Math.random() * 2.2, ph: Math.random() * 6.28,
          tint: ['255,255,255', '210,225,255', '255,240,215'][Math.floor(Math.random() * 3)], big
        });
      }
    };
    const spawnTrail = (t) => {
      const fromX = 0.2 + Math.random() * 0.8, fromY = Math.random() * 0.28;
      const ang = Math.PI * (0.72 + Math.random() * 0.16); // down and to the left
      const speed = 0.55 + Math.random() * 0.6;
      trails.push({ x: fromX * w, y: fromY * h, dx: Math.cos(ang) * speed * w, dy: Math.sin(ang) * speed * w * 0.55, born: t, life: 0.7 + Math.random() * 0.6, len: 90 + Math.random() * 140 });
      nextStar = t + 1.4 + Math.random() * 3.4;
    };

    const draw = (ms) => {
      const t = ms / 1000;
      ctx.clearRect(0, 0, w, h);

      for (const s of stars) {
        const tw = reduce ? 1 : 0.55 + 0.45 * Math.sin(t * s.sp + s.ph) * Math.sin(t * s.sp * 0.37 + s.ph * 2);
        const a = Math.max(0, Math.min(1, s.base * tw));
        const x = s.x * w, y = s.y * h;
        if (s.big) {
          const g = ctx.createRadialGradient(x, y, 0, x, y, s.r * 5);
          g.addColorStop(0, `rgba(${s.tint},${0.55 * a})`); g.addColorStop(1, `rgba(${s.tint},0)`);
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, s.r * 5, 0, 6.28); ctx.fill();
          ctx.strokeStyle = `rgba(${s.tint},${0.35 * a})`; ctx.lineWidth = 0.6;
          ctx.beginPath(); ctx.moveTo(x - s.r * 4, y); ctx.lineTo(x + s.r * 4, y); ctx.moveTo(x, y - s.r * 4); ctx.lineTo(x, y + s.r * 4); ctx.stroke();
        }
        ctx.fillStyle = `rgba(${s.tint},${a})`;
        ctx.beginPath(); ctx.arc(x, y, s.r, 0, 6.28); ctx.fill();
      }

      if (!reduce && t > nextStar) spawnTrail(t);
      for (let i = trails.length - 1; i >= 0; i--) {
        const s = trails[i];
        const age = (t - s.born) / s.life;
        if (age >= 1) { trails.splice(i, 1); continue; }
        const px = s.x + s.dx * (t - s.born), py = s.y + s.dy * (t - s.born);
        const m = Math.hypot(s.dx, s.dy);
        const tx = px - (s.dx / m) * s.len, ty = py - (s.dy / m) * s.len;
        const a = Math.sin(Math.PI * age);
        const g = ctx.createLinearGradient(px, py, tx, ty);
        g.addColorStop(0, `rgba(255,255,255,${0.95 * a})`);
        g.addColorStop(0.25, `rgba(200,255,225,${0.45 * a})`);
        g.addColorStop(1, 'rgba(160,240,200,0)');
        ctx.strokeStyle = g; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(tx, ty); ctx.stroke();
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.beginPath(); ctx.arc(px, py, 1.6, 0, 6.28); ctx.fill();
      }
      if (!reduce) raf = requestAnimationFrame(draw);
    };

    const isNight = () => document.documentElement.dataset.theme === 'dark';
    const sync = () => {
      cancelAnimationFrame(raf);
      if (!isNight() || document.hidden) { ctx.clearRect(0, 0, w, h); return; }
      raf = requestAnimationFrame(draw);
    };
    resize(); seedStars();
    addEventListener('resize', () => { resize(); seedStars(); });
    document.addEventListener('visibilitychange', sync);
    new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    sync();
  });
})();

/* Wind over the field: the scene image is redrawn by a small WebGL shader that
 * sways the grass and flowers, gently, in slow gusts that roll across the field.
 * The sky and the tree line hold still; the foreground moves most. Same framing
 * as the <img> it sits on (object-fit: cover, 60% 48%), so it fades in seamlessly.
 * No WebGL, reduced motion or a hidden tab: the still image stays. */
(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const VS = 'attribute vec2 p; varying vec2 v; void main(){ v = vec2((p.x+1.)*.5, (1.-p.y)*.5); gl_Position = vec4(p,0.,1.); }';
  const FS = `precision mediump float;
    uniform sampler2D uDay, uNight; uniform float uMix, uT; uniform vec2 uRes, uImg, uPos; varying vec2 v;
    void main() {
      float s = max(uRes.x / uImg.x, uRes.y / uImg.y);
      vec2 disp = uImg * s, uv = (v * uRes - (uRes - disp) * uPos) / disp;
      /* the ground as a plane seen in perspective: distance grows toward the horizon */
      float h = .645, dy = max(uv.y - h, 0.) + .018;
      float z = .055 / dy;                                          /* ~.15 in front, ~3 at the horizon */
      float wx = (uv.x - .5) * z * (uImg.x / uImg.y);               /* position across the field, in ground units */
      /* long waves rolling downwind (+x), slow gusts on top; nothing varies fast
         from one row of pixels to the next, so each plant moves as one piece */
      float p = wx * 2.1 + z * .7 - uT * 1.05;
      float gust = .5 + .5 * sin(wx * .55 + z * .25 - uT * .33 + sin(uT * .17) * 1.2);
      float wave = .65 * sin(p) + .35 * sin(p * 1.83 + 1.7 - uT * .35);
      float lean = (.3 + .7 * gust) * (.55 + .45 * wave);          /* bends with the wind and springs back */
      float amp = .0085 / (1. + z * 3.);                            /* near grass sways more */
      float m = smoothstep(h, h + .08, uv.y);
      vec2 q = uv + vec2(-lean * amp * m, lean * amp * m * .22);
      gl_FragColor = vec4(mix(texture2D(uDay, q).rgb, texture2D(uNight, q).rgb, uMix), 1.);
    }`;
  document.querySelectorAll('.sky').forEach((sky) => {
    const dayImg = sky.querySelector('img.day'), nightImg = sky.querySelector('img.night');
    if (!dayImg || !nightImg || skyIndoor(sky)) return;
    const cv = document.createElement('canvas');
    cv.className = 'sky-wind';
    const gl = cv.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false });
    if (!gl) return;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return;
    gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = (n) => gl.getUniformLocation(pr, n);
    const tex = (unit, img) => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img); };
    const load = (el) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = el.currentSrc || el.src; });
    Promise.all([load(dayImg), load(nightImg)]).then(([d, n]) => {
      tex(0, d); tex(1, n);
      gl.uniform1i(U('uDay'), 0); gl.uniform1i(U('uNight'), 1);
      gl.uniform2f(U('uImg'), d.naturalWidth, d.naturalHeight); gl.uniform2f(U('uPos'), 0.6, 0.48);
      const dark = () => document.documentElement.dataset.theme === 'dark';
      let mixV = dark() ? 1 : 0, raf = 0, w = 0, h = 0;
      const resize = () => { const dpr = Math.min(1.5, devicePixelRatio || 1); w = sky.clientWidth; h = sky.clientHeight; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); gl.viewport(0, 0, cv.width, cv.height); gl.uniform2f(U('uRes'), cv.width, cv.height); };
      const t0 = performance.now(); let last = t0;
      const frame = (now) => {
        const target = dark() ? 1 : 0, dt = (now - last) / 1000; last = now;
        if (mixV !== target) mixV = target > mixV ? Math.min(target, mixV + dt / 0.6) : Math.max(target, mixV - dt / 0.6);  /* matches the images' .6s crossfade */
        gl.uniform1f(U('uMix'), mixV); gl.uniform1f(U('uT'), typeof window.__windT === 'number' ? window.__windT : (now - t0) / 1000);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        raf = requestAnimationFrame(frame);
      };
      resize(); addEventListener('resize', resize);
      const fxc = sky.querySelector('.sky-fx'); if (fxc) sky.insertBefore(cv, fxc); else sky.appendChild(cv);
      requestAnimationFrame(() => cv.classList.add('on'));
      document.addEventListener('visibilitychange', () => { cancelAnimationFrame(raf); if (!document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } });
      raf = requestAnimationFrame(frame);
    }).catch(() => null);
  });
})();

/* The tea room, alive. By day, steam rises from the cups and the teapot spout;
 * by night, the branch shadows on the paper doors sway in the wind and the
 * lantern's candle breathes. Everything is placed in the photos' own
 * coordinates (u across, v down, 0 to 1), measured on /art/gen/pro-*.jpg:
 * cups and spout from the day photo, the five paper panels that carry shadows
 * and the lantern from the night one. Only pixels inside a panel move, never
 * the wooden frames or the lantern, and never by more than a few pixels.
 * Same framing as the <img> underneath (object-fit: cover, 55% 55%). */
(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const VS = 'attribute vec2 p; varying vec2 v; void main(){ v = vec2((p.x+1.)*.5, (1.-p.y)*.5); gl_Position = vec4(p,0.,1.); }';
  const FS = `#ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif
    uniform sampler2D uDay, uNight; uniform float uMix, uT; uniform vec2 uRes, uImg, uPos; varying vec2 v;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) { vec2 i = floor(p), f = fract(p), u = f * f * (3. - 2. * f);
      return mix(mix(hash(i), hash(i + vec2(1., 0.)), u.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), u.x), u.y); }
    float fbm(vec2 p) { float s = 0., a = .5; for (int i = 0; i < 4; i++) { s += a * noise(p); p = p * 2.03 + 17.1; a *= .5; } return s; }
    /* 1 well inside the box (u0, u1, v0, v1), easing to 0 over m at its edges */
    float inbox(vec2 p, vec4 b, vec2 m) { return smoothstep(b.x, b.x + m.x, p.x) * (1. - smoothstep(b.y - m.x, b.y, p.x)) * smoothstep(b.z, b.z + m.y, p.y) * (1. - smoothstep(b.w - m.y, b.w, p.y)); }
    float lum(vec3 c) { return dot(c, vec3(.2126, .7152, .0722)); }
    /* a thread of steam rising H (in image heights) from base, curling as it climbs */
    float plume(vec2 uv, vec2 base, float H, float seed, float t, float asp) {
      vec2 q = uv - base; q.x *= asp;
      float h = -q.y / H;
      if (h < -.06 || h > 1.25) return 0.;
      h = max(h, 0.);
      float drift = ((fbm(vec2(h * 1.3 - t * .18, seed)) - .5) * .9 * h + sin(t * .45 + seed * 3.1 + h * 2.3) * .13 * h * h) * H;
      float x = q.x - drift, wd = H * (.035 + .16 * h);
      float core = exp(-x * x / (wd * wd));
      float n = fbm(vec2(x / H * 6. + seed * 4.7, h * 3.6 - t * .8));
      float wisp = smoothstep(.34, .74, n);
      float fade = smoothstep(0., .14, h) * (1. - smoothstep(.38, 1.1, h));
      return core * wisp * fade;
    }
    void main() {
      float s = max(uRes.x / uImg.x, uRes.y / uImg.y), asp = uImg.x / uImg.y, t = uT;
      vec2 disp = uImg * s, uv = (v * uRes - (uRes - disp) * uPos) / disp;
      vec3 day = texture2D(uDay, uv).rgb, night = texture2D(uNight, uv).rgb;
      /* ---- day: steam from the front cups, a back cup and the spout ---- */
      if (uMix < .999 && uv.x > .41 && uv.x < .575 && uv.y > .6 && uv.y < .745) {
        float st = plume(uv, vec2(.5045, .7355), .078, 1.3, t, asp)
                 + .8 * plume(uv, vec2(.476, .7355), .07, 4.1, t + 3.7, asp)
                 + .6 * plume(uv, vec2(.452, .7245), .062, 7.9, t + 1.9, asp)
                 + .45 * plume(uv, vec2(.5255, .712), .05, 2.6, t + 5.3, asp);
        st = min(st, 1.);
        day = mix(day, vec3(1.), st * .55) + st * .05;
      }
      /* ---- night: the shadows on the paper sway; the lantern breathes ---- */
      if (uMix > .001) {
        vec2 m = vec2(.012, .022);
        float w = max(max(max(inbox(uv, vec4(.428, .492, .285, .685), m), inbox(uv, vec4(.508, .572, .285, .685), m)),
                          max(inbox(uv, vec4(.581, .646, .285, .685), m), inbox(uv, vec4(.675, .738, .285, .685), m))),
                      inbox(uv, vec4(.834, .879, .21, .75), m));
        /* the lantern and its tassel hang in front of the doors: they stay put */
        w *= (1. - inbox(uv, vec4(.44, .56, -.1, .28), vec2(.012))) * (1. - inbox(uv, vec4(.486, .514, -.1, .44), vec2(.008)));
        float warm = smoothstep(.02, .12, night.r - night.b);
        w *= 1. - warm;
        if (w > .001) {
          float gust = .55 + .45 * sin(t * .23 + sin(t * .11) * 1.6);
          float ph = uv.x * 6.5 + uv.y * 2.5;
          vec2 d = vec2(sin(t * 1.7 + ph) + .35 * sin(t * 2.9 + ph * 1.7 + 1.3), .4 * sin(t * 1.3 + ph * .8 + .7)) * gust;
          d += .22 * vec2(sin(t * 5.3 + uv.y * 38. + uv.x * 21.), cos(t * 4.7 + uv.x * 33. + uv.y * 17.));
          d *= .0042 * w;
          vec3 n1 = texture2D(uNight, uv + vec2(d.x, d.y * asp)).rgb;
          /* never pull a dark frame or the lantern's warm light into the paper */
          float ok = (1. - smoothstep(.02, .12, n1.r - n1.b)) * smoothstep(.14, .24, lum(n1)) * smoothstep(.14, .24, lum(night));
          night = mix(night, n1, ok);
        }
        float fl = .5 * sin(t * 7.3) + .3 * sin(t * 11.9 + 1.7) + .2 * sin(t * 17.3 + .4);
        night *= 1. + warm * .05 * fl;
      }
      gl_FragColor = vec4(mix(day, night, uMix), 1.);
    }`;
  document.querySelectorAll('.sky').forEach((sky) => {
    const dayImg = sky.querySelector('img.day'), nightImg = sky.querySelector('img.night');
    if (!dayImg || !nightImg || !/\/art\/gen\//.test(dayImg.getAttribute('src') || '')) return;
    const cv = document.createElement('canvas');
    cv.className = 'sky-wind';
    const gl = cv.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false });
    if (!gl) return;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return;
    gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = (n) => gl.getUniformLocation(pr, n);
    const tex = (unit, img) => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img); };
    const load = (el) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = el.currentSrc || el.src; });
    Promise.all([load(dayImg), load(nightImg)]).then(([d, n]) => {
      tex(0, d); tex(1, n);
      gl.uniform1i(U('uDay'), 0); gl.uniform1i(U('uNight'), 1);
      gl.uniform2f(U('uImg'), d.naturalWidth, d.naturalHeight); gl.uniform2f(U('uPos'), 0.55, 0.55);
      const dark = () => document.documentElement.dataset.theme === 'dark';
      let mixV = dark() ? 1 : 0, raf = 0, drawn = 0;
      const resize = () => { const dpr = Math.min(1.5, devicePixelRatio || 1); cv.width = Math.round(sky.clientWidth * dpr); cv.height = Math.round(sky.clientHeight * dpr); gl.viewport(0, 0, cv.width, cv.height); gl.uniform2f(U('uRes'), cv.width, cv.height); };
      const t0 = performance.now(); let last = t0;
      const frame = (now) => {
        raf = requestAnimationFrame(frame);
        if (now - drawn < 30 && typeof window.__skyT !== 'number') return;            /* ~30 fps is plenty for steam and shadows */
        drawn = now;
        const target = dark() ? 1 : 0, dt = (now - last) / 1000; last = now;
        if (mixV !== target) mixV = target > mixV ? Math.min(target, mixV + dt / 0.6) : Math.max(target, mixV - dt / 0.6);
        gl.uniform1f(U('uMix'), mixV); gl.uniform1f(U('uT'), typeof window.__skyT === 'number' ? window.__skyT : ((now - t0) / 1000) % 3600);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      };
      resize(); addEventListener('resize', resize);
      const fxc = sky.querySelector('.sky-fx'); if (fxc) sky.insertBefore(cv, fxc); else sky.appendChild(cv);
      requestAnimationFrame(() => cv.classList.add('on'));
      document.addEventListener('visibilitychange', () => { cancelAnimationFrame(raf); if (!document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } });
      raf = requestAnimationFrame(frame);
    }).catch(() => null);
  });
})();
