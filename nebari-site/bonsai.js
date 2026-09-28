// Nebari — a sakura bonsai, drawn procedurally on canvas.
//
// Every tree is grown from a seed (a token address, a name, anything) with a growth
// factor from 0 to 1, so the same token always shows the same tree and it fills out as
// its pool trades. No images: trunk, pot, moss and every blossom are drawn here.
window.Bonsai = (function () {
  'use strict';

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function seedFrom(str) {
    let h = 2166136261;
    for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  const PINKS = ['#ffe6ef', '#ffd6e4', '#ffc4d8', '#ffb0cb', '#ff9bbf', '#f985b1', '#ef6fa2', '#de5c92'];
  const BARK = { light: '#6b4a34', mid: '#3d2618', dark: '#1f120b' };

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---------------------------------------------------------------- tree

  function draw(ctx, o) {
    const seed = typeof o.seed === 'string' ? seedFrom(o.seed) : (o.seed >>> 0) || 7;
    const r = mulberry32(seed);
    const growth = Math.max(0, Math.min(1, o.growth == null ? 1 : o.growth));
    const S = o.height / 400;
    const pads = [];
    const maxDepth = 5 + Math.round(growth * 2);
    const padScale = 0.75 + growth * 0.55;

    function seg(x1, y1, x2, y2, w1, w2, curv) {
      const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
      const px = -dy / L, py = dx / L;
      const mx = (x1 + x2) / 2 + px * curv, my = (y1 + y2) / 2 + py * curv;
      const wm = (w1 + w2) / 2;
      ctx.beginPath();
      ctx.moveTo(x1 + px * w1 / 2, y1 + py * w1 / 2);
      ctx.quadraticCurveTo(mx + px * wm / 2, my + py * wm / 2, x2 + px * w2 / 2, y2 + py * w2 / 2);
      ctx.lineTo(x2 - px * w2 / 2, y2 - py * w2 / 2);
      ctx.quadraticCurveTo(mx - px * wm / 2, my - py * wm / 2, x1 - px * w1 / 2, y1 - py * w1 / 2);
      ctx.closePath();
      const g = ctx.createLinearGradient(x1 + px * w1 / 2, y1 + py * w1 / 2, x1 - px * w1 / 2, y1 - py * w1 / 2);
      g.addColorStop(0, BARK.light); g.addColorStop(0.45, BARK.mid); g.addColorStop(1, BARK.dark);
      ctx.fillStyle = g; ctx.fill();
      if (w1 > 4 * S) {
        ctx.strokeStyle = 'rgba(0,0,0,0.28)';
        ctx.lineWidth = Math.max(0.5, w1 * 0.05);
        for (let k = 0; k < 3; k++) {
          const t = (k + 1) / 4 - 0.5;
          const o1 = t * w1 * 0.8, o2 = t * w2 * 0.8;
          ctx.beginPath();
          ctx.moveTo(x1 + px * o1, y1 + py * o1);
          ctx.quadraticCurveTo(mx + px * (o1 + o2) / 2, my + py * (o1 + o2) / 2, x2 + px * o2, y2 + py * o2);
          ctx.stroke();
        }
      }
      ctx.beginPath(); ctx.arc(x2, y2, w2 / 2, 0, Math.PI * 2); ctx.fillStyle = BARK.mid; ctx.fill();
    }

    function branch(x, y, ang, len, w, depth) {
      const nx = x + Math.sin(ang) * len, ny = y - Math.cos(ang) * len;
      const w2 = Math.max(1.2 * S, w * 0.66);
      seg(x, y, nx, ny, w, w2, (r() - 0.5) * len * 0.6);
      if (depth >= maxDepth || len < 7 * S) {
        pads.push({ x: nx, y: ny, s: padScale * (0.7 + r() * 0.6) * S * (depth >= maxDepth ? 1 : 0.8) });
        return;
      }
      const n = depth < 2 ? 2 : (r() < 0.55 ? 2 : 3);
      const dir = r() < 0.5 ? -1 : 1;
      for (let i = 0; i < n; i++) {
        const sgn = i % 2 === 0 ? dir : -dir;
        let a = ang + sgn * (0.3 + r() * 0.55) * (n === 3 && i === 2 ? 0.35 : 1);
        if (depth >= 3) a = a * 0.75 + sgn * 1.1 * 0.25; // pads flatten out, like a real bonsai
        a = Math.max(-1.75, Math.min(1.75, a));
        branch(nx, ny, a, len * (0.62 + r() * 0.16), w2, depth + 1);
      }
    }

    function blossom(cx, cy, R) {
      const rx = R * 1.5, ry = R * 0.85;
      ctx.fillStyle = 'rgba(150, 40, 90, 0.28)';
      ctx.beginPath(); ctx.ellipse(cx, cy + ry * 0.35, rx * 0.9, ry * 0.75, 0, 0, Math.PI * 2); ctx.fill();
      const n = Math.round(24 + R * 1.1);
      for (let i = 0; i < n; i++) {
        const t = r() * Math.PI * 2, d = Math.sqrt(r());
        const x = cx + Math.cos(t) * rx * d, y = cy + Math.sin(t) * ry * d;
        const rel = (y - cy) / ry;
        let idx = Math.floor(((rel + 1) / 2) * 5 + r() * 3);
        idx = Math.max(0, Math.min(PINKS.length - 1, idx));
        ctx.fillStyle = PINKS[idx];
        ctx.beginPath(); ctx.arc(x, y, R * (0.13 + r() * 0.16), 0, Math.PI * 2); ctx.fill();
      }
      const f = 2 + Math.floor(r() * 3);
      for (let i = 0; i < f; i++) {
        const t = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.8;
        flower(cx + Math.cos(t) * rx * d, cy + Math.sin(t) * ry * d, R * 0.22);
      }
    }

    function flower(x, y, s) {
      const rot = r() * Math.PI * 2;
      for (let k = 0; k < 5; k++) {
        const a = rot + (k * Math.PI * 2) / 5;
        ctx.fillStyle = k % 2 ? '#ffe9f1' : '#ffd9e6';
        ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * s * 0.55, y + Math.sin(a) * s * 0.55, s * 0.55, s * 0.34, a, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#e2367f'; ctx.beginPath(); ctx.arc(x, y, s * 0.18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd24a';
      for (let k = 0; k < 4; k++) {
        const a = r() * Math.PI * 2;
        ctx.beginPath(); ctx.arc(x + Math.cos(a) * s * 0.22, y + Math.sin(a) * s * 0.22, s * 0.06, 0, Math.PI * 2); ctx.fill();
      }
    }

    function pot(x, y) {
      const W = 150 * S, H = 40 * S;
      if (o.shadow !== false) {
        const g = ctx.createRadialGradient(x, y + 38 * S, 0, x, y + 38 * S, 190 * S);
        g.addColorStop(0, 'rgba(0,0,0,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y + 42 * S, 200 * S, 28 * S, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.beginPath();
      ctx.moveTo(x - W, y + 6 * S); ctx.lineTo(x + W, y + 6 * S); ctx.lineTo(x + W * 0.86, y + H);
      ctx.quadraticCurveTo(x, y + H + 7 * S, x - W * 0.86, y + H); ctx.closePath();
      let g = ctx.createLinearGradient(x - W, 0, x + W, 0);
      g.addColorStop(0, '#15161c'); g.addColorStop(0.32, '#3b3f4d'); g.addColorStop(0.55, '#262a35'); g.addColorStop(1, '#0f1015');
      ctx.fillStyle = g; ctx.fill();
      roundRect(ctx, x - W * 1.04, y - 3 * S, W * 2.08, 11 * S, 4 * S);
      g = ctx.createLinearGradient(0, y - 3 * S, 0, y + 8 * S);
      g.addColorStop(0, '#5d6273'); g.addColorStop(1, '#22252e');
      ctx.fillStyle = g; ctx.fill();
      ctx.fillStyle = '#0f1015';
      [-0.72, 0.72].forEach((k) => { roundRect(ctx, x + k * W * 0.8 - 11 * S, y + H - 2 * S, 22 * S, 8 * S, 3 * S); ctx.fill(); });
      // soil and moss
      ctx.beginPath(); ctx.ellipse(x, y - 2 * S, W * 0.97, 12 * S, 0, 0, Math.PI * 2); ctx.fillStyle = '#2a1a12'; ctx.fill();
      for (let i = 0; i < 46; i++) {
        const t = r() * Math.PI * 2, d = Math.sqrt(r());
        const mx = x + Math.cos(t) * W * 0.9 * d, my = y - 3 * S + Math.sin(t) * 9 * S * d;
        ctx.fillStyle = ['#3d5a2b', '#557a36', '#6a8f42', '#4a6b31'][Math.floor(r() * 4)];
        ctx.beginPath(); ctx.ellipse(mx, my, (5 + r() * 9) * S, (3 + r() * 4) * S, r() * Math.PI, 0, Math.PI * 2); ctx.fill();
      }
    }

    // ---- compose
    const bx = o.x, by = o.y;
    if (o.pot !== false) pot(bx, by);

    let x = bx, y = by - 6 * S, w = 34 * S;
    const lean = (r() - 0.5) * 0.3;
    const trunk = [[-0.28 + lean, 70], [0.42 + lean, 62], [-0.18 + lean, 55]];
    const knots = [];
    for (const [a, l] of trunk) {
      const nx = x + Math.sin(a) * l * S, ny = y - Math.cos(a) * l * S;
      const w2 = w * 0.78;
      seg(x, y, nx, ny, w, w2, (a > 0 ? -1 : 1) * 18 * S);
      x = nx; y = ny; w = w2;
      knots.push({ x, y, w });
    }
    // low sweeping branches, then the crown
    branch(knots[0].x, knots[0].y, -1.25 + lean, 58 * S * (0.8 + growth * 0.3), knots[0].w * 0.45, 3);
    branch(knots[1].x, knots[1].y, 1.15 + lean, 68 * S * (0.8 + growth * 0.3), knots[1].w * 0.5, 2);
    branch(x, y, -0.2 + lean, 60 * S, w, 1);

    pads.sort((a, b) => a.y - b.y);
    for (const p of pads) blossom(p.x, p.y, 22 * p.s);
  }

  // Keeps a canvas sized to its CSS box and redraws the tree when it changes.
  // `layout(w, h)` returns the draw options for that size.
  function mount(canvas, layout) {
    const ctx = canvas.getContext('2d');
    let raf = 0;
    function render() {
      raf = 0;
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width)), h = Math.max(1, Math.round(rect.height));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const opts = layout(w, h);
      if (opts) draw(ctx, opts);
    }
    const schedule = () => { if (!raf) raf = requestAnimationFrame(render); };
    if ('ResizeObserver' in window) new ResizeObserver(schedule).observe(canvas);
    else window.addEventListener('resize', schedule);
    schedule();
    return { redraw: schedule };
  }

  // ------------------------------------------------------------- petals

  function petals(canvas, opts) {
    const ctx = canvas.getContext('2d');
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const count = reduced ? 0 : (opts && opts.count) || 26;
    let w = 0, h = 0, dpr = 1, list = [], running = true;
    const rnd = Math.random;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      w = Math.round(rect.width); h = Math.round(rect.height);
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function spawn(p, top) {
      p.x = rnd() * w; p.y = top ? -20 : rnd() * h;
      p.s = 4 + rnd() * 5; p.a = rnd() * Math.PI * 2; p.spin = (rnd() - 0.5) * 0.04;
      p.vy = 0.35 + rnd() * 0.6; p.vx = 0.2 + rnd() * 0.5; p.ph = rnd() * Math.PI * 2;
      p.c = PINKS[2 + Math.floor(rnd() * 5)];
      return p;
    }
    function step() {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);
      for (const p of list) {
        p.ph += 0.02; p.a += p.spin;
        p.x += Math.sin(p.ph) * 0.6 + p.vx * 0.4; p.y += p.vy;
        if (p.y > h + 20 || p.x > w + 30) spawn(p, true);
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.globalAlpha = 0.85;
        ctx.fillStyle = p.c;
        ctx.beginPath();
        ctx.moveTo(0, -p.s);
        ctx.bezierCurveTo(p.s * 0.9, -p.s * 0.9, p.s * 0.9, p.s * 0.6, 0, p.s);
        ctx.bezierCurveTo(-p.s * 0.9, p.s * 0.6, -p.s * 0.9, -p.s * 0.9, 0, -p.s);
        ctx.fill();
        ctx.restore();
      }
      requestAnimationFrame(step);
    }
    resize();
    window.addEventListener('resize', resize);
    for (let i = 0; i < count; i++) list.push(spawn({}, false));
    document.addEventListener('visibilitychange', () => {
      running = !document.hidden;
      if (running) requestAnimationFrame(step);
    });
    if (count) requestAnimationFrame(step);
  }

  return { draw, mount, petals, seedFrom };
})();
