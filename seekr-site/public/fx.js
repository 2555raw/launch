/* Night sky over the header scene: stars twinkling across the top of the sky
 * and shooting stars streaking through it. Runs only in dark mode, pauses
 * when the tab is hidden, and holds still for prefers-reduced-motion. */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('.sky').forEach((sky) => {
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
        g.addColorStop(0.25, `rgba(190,215,255,${0.45 * a})`);
        g.addColorStop(1, 'rgba(160,190,255,0)');
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
      float m = smoothstep(.645, .73, uv.y);                       /* grass only, not sky or trees */
      float fg = mix(.35, 1., smoothstep(.66, 1., uv.y));          /* nearer grass moves more */
      float gust = .5 + .5 * sin(uT * .45 - uv.x * 5. + sin(uT * .23) * 1.5);
      float sway = sin(uT * 1.4 + uv.y * 95. + uv.x * 8.) * .55 + sin(uT * .9 + uv.y * 57. - uv.x * 4.) * .45;
      float a = .0062 * m * fg * gust;
      vec2 q = uv + vec2(sway * a, -abs(sway) * a * .35);
      gl_FragColor = vec4(mix(texture2D(uDay, q).rgb, texture2D(uNight, q).rgb, uMix), 1.);
    }`;
  document.querySelectorAll('.sky').forEach((sky) => {
    const dayImg = sky.querySelector('img.day'), nightImg = sky.querySelector('img.night');
    if (!dayImg || !nightImg) return;
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
        gl.uniform1f(U('uMix'), mixV); gl.uniform1f(U('uT'), (now - t0) / 1000);
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
