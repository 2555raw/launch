/* Night life over the header scene: fireflies drifting over the meadow and
 * shooting stars streaking across the sky. Runs only in dark mode, pauses
 * when the tab is hidden, and holds still for prefers-reduced-motion. */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('.sky').forEach((sky) => {
    const cv = document.createElement('canvas');
    cv.className = 'sky-fx';
    sky.appendChild(cv);
    const ctx = cv.getContext('2d');
    let w = 0, h = 0, dpr = 1, raf = 0, last = 0;
    const flies = [], trails = [];
    let nextStar = 0;

    const resize = () => {
      dpr = Math.min(2, devicePixelRatio || 1);
      w = sky.clientWidth; h = sky.clientHeight;
      cv.width = w * dpr; cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const seedFlies = () => {
      flies.length = 0;
      const n = Math.round(Math.max(8, Math.min(22, w / 70)));
      for (let i = 0; i < n; i++) flies.push({ x: Math.random(), y: 0.66 + Math.random() * 0.3, vx: (Math.random() - 0.5) * 0.02, vy: (Math.random() - 0.5) * 0.01, ph: Math.random() * 6.28, sp: 0.6 + Math.random() * 1.2, r: 1.4 + Math.random() * 1.8 });
    };
    const spawnStar = (t) => {
      const fromX = 0.25 + Math.random() * 0.75, fromY = Math.random() * 0.3;
      const ang = Math.PI * (0.72 + Math.random() * 0.16); // down and to the left
      const speed = 0.55 + Math.random() * 0.6;
      trails.push({ x: fromX * w, y: fromY * h, dx: Math.cos(ang) * speed * w, dy: Math.sin(ang) * speed * w * 0.55, born: t, life: 0.7 + Math.random() * 0.6, len: 90 + Math.random() * 140 });
      nextStar = t + 1.2 + Math.random() * 3.2;
    };

    const draw = (ms) => {
      const t = ms / 1000;
      const dt = Math.min(0.05, last ? t - last : 0.016);
      last = t;
      ctx.clearRect(0, 0, w, h);

      /* shooting stars */
      if (!reduce && t > nextStar) spawnStar(t);
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

      /* fireflies */
      for (const f of flies) {
        if (!reduce) {
          f.vx += (Math.random() - 0.5) * 0.02 * dt; f.vy += (Math.random() - 0.5) * 0.015 * dt;
          f.vx = Math.max(-0.02, Math.min(0.02, f.vx)); f.vy = Math.max(-0.012, Math.min(0.012, f.vy));
          f.x += f.vx * dt; f.y += f.vy * dt + Math.sin(t * f.sp + f.ph) * 0.0006;
          if (f.x < -0.02) f.x = 1.02; if (f.x > 1.02) f.x = -0.02;
          if (f.y < 0.64 || f.y > 0.97) f.vy *= -1;
        }
        const pulse = reduce ? 0.7 : Math.pow(0.5 + 0.5 * Math.sin(t * f.sp * 1.7 + f.ph), 3);
        const x = f.x * w, y = f.y * h, R = f.r * 7;
        const g = ctx.createRadialGradient(x, y, 0, x, y, R);
        g.addColorStop(0, `rgba(230,255,140,${0.9 * pulse})`);
        g.addColorStop(0.25, `rgba(200,255,90,${0.35 * pulse})`);
        g.addColorStop(1, 'rgba(180,255,80,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R, 0, 6.28); ctx.fill();
        ctx.fillStyle = `rgba(255,255,210,${0.95 * pulse})`; ctx.beginPath(); ctx.arc(x, y, f.r * 0.6, 0, 6.28); ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };

    const isNight = () => document.documentElement.dataset.theme === 'dark';
    const sync = () => {
      cancelAnimationFrame(raf);
      if (!isNight() || document.hidden) { ctx && ctx.clearRect(0, 0, w, h); return; }
      last = 0; raf = requestAnimationFrame(draw);
    };
    resize(); seedFlies();
    addEventListener('resize', () => { resize(); seedFlies(); });
    document.addEventListener('visibilitychange', sync);
    new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    sync();
  });
})();
