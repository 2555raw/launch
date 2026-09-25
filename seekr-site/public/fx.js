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
