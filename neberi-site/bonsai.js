// Nebari — a sakura bonsai, drawn procedurally on canvas.
//
// Every tree is grown from a seed (a token address, a name, anything) with a growth
// factor from 0 to 1, so the same token always shows the same tree and it fills out as
// its pool trades. No images: roots, trunk, bark, pot, moss, every blossom and the
// light behind them are drawn here.
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

  // blossom palette, light to deep; the underside of a pad uses the deep end.
  // Ink and paper: white blossoms shaded into grey, a black trunk, like a sumi-e.
  const PINKS = ['#ffffff', '#fafafa', '#f2f2f2', '#e8e8e8', '#dadada', '#c9c9c9', '#b4b4b4', '#9a9a9a', '#7c7c7c'];
  const BARK = { hi: '#6b6b6b', light: '#484848', mid: '#262626', dark: '#121212', edge: '#050505' };

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  const supportsFilter = (() => { try { const c = document.createElement('canvas').getContext('2d'); return c && 'filter' in c; } catch (_) { return false; } })();

  // ---------------------------------------------------------------- tree

  function draw(ctx, o) {
    const seed = typeof o.seed === 'string' ? seedFrom(o.seed) : (o.seed >>> 0) || 7;
    const r = mulberry32(seed);
    const growth = Math.max(0, Math.min(1, o.growth == null ? 1 : o.growth));
    const S = o.height / 400;
    const pads = [];
    const maxDepth = 5 + Math.round(growth * 2);
    const padScale = 0.75 + growth * 0.55;
    const bx = o.x, by = o.y;

    // ---- a tapered, slightly bent branch segment with bark grain
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
      // light from the upper left: the side facing it is warmer, the far side falls to black
      const g = ctx.createLinearGradient(x1 + px * w1 / 2, y1 + py * w1 / 2, x1 - px * w1 / 2, y1 - py * w1 / 2);
      const lit = px < 0;
      g.addColorStop(0, lit ? BARK.hi : BARK.dark);
      g.addColorStop(0.3, lit ? BARK.light : BARK.mid);
      g.addColorStop(0.7, lit ? BARK.mid : BARK.light);
      g.addColorStop(1, lit ? BARK.edge : BARK.hi);
      ctx.fillStyle = g; ctx.fill();
      if (w1 > 3.5 * S) {
        const n = Math.min(7, Math.round(w1 / (2.2 * S)));
        for (let k = 0; k < n; k++) {
          const t = (k + 0.5 + (r() - 0.5) * 0.6) / n - 0.5;
          const o1 = t * w1 * 0.86, o2 = t * w2 * 0.86;
          ctx.strokeStyle = r() < 0.7 ? `rgba(0,0,0,${0.12 + r() * 0.22})` : `rgba(255,220,190,${0.08 + r() * 0.1})`;
          ctx.lineWidth = Math.max(0.4, w1 * (0.03 + r() * 0.04));
          ctx.beginPath();
          ctx.moveTo(x1 + px * o1, y1 + py * o1);
          ctx.quadraticCurveTo(mx + px * (o1 + o2) / 2 + (r() - 0.5) * 2 * S, my + py * (o1 + o2) / 2 + (r() - 0.5) * 2 * S, x2 + px * o2, y2 + py * o2);
          ctx.stroke();
        }
        // a knot now and then
        if (w1 > 8 * S && r() < 0.35) {
          const t = 0.3 + r() * 0.4;
          const kx = x1 + dx * t + px * (r() - 0.5) * w1 * 0.4, ky = y1 + dy * t + py * (r() - 0.5) * w1 * 0.4;
          const kr = w1 * (0.1 + r() * 0.12);
          const kg = ctx.createRadialGradient(kx - kr * 0.3, ky - kr * 0.3, 0, kx, ky, kr);
          kg.addColorStop(0, BARK.light); kg.addColorStop(0.7, BARK.dark); kg.addColorStop(1, BARK.mid);
          ctx.fillStyle = kg; ctx.beginPath(); ctx.ellipse(kx, ky, kr, kr * 0.7, Math.atan2(dy, dx), 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.beginPath(); ctx.arc(x2, y2, w2 / 2, 0, Math.PI * 2); ctx.fillStyle = BARK.mid; ctx.fill();
    }

    function branch(x, y, ang, len, w, depth) {
      const nx = x + Math.sin(ang) * len, ny = y - Math.cos(ang) * len;
      const w2 = Math.max(1.1 * S, w * 0.66);
      seg(x, y, nx, ny, w, w2, (r() - 0.5) * len * 0.6);
      if (depth >= maxDepth || len < 7 * S) {
        pads.push({ x: nx, y: ny, s: padScale * (0.7 + r() * 0.6) * S * (depth >= maxDepth ? 1 : 0.8), back: r() < 0.32 });
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

    // ---- a cloud of blossoms: shaded underside, lit top, open flowers, buds, twigs
    function blossom(cx, cy, R, back) {
      const rx = R * 1.55, ry = R * 0.9;
      // cast shadow under the pad
      ctx.fillStyle = back ? 'rgba(0, 0, 0, 0.10)' : 'rgba(0, 0, 0, 0.2)';
      ctx.beginPath(); ctx.ellipse(cx + R * 0.15, cy + ry * 0.45, rx * 0.95, ry * 0.7, 0, 0, Math.PI * 2); ctx.fill();
      // a few dark twigs peeking through
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)'; ctx.lineWidth = Math.max(0.6, R * 0.05);
      for (let i = 0; i < 4; i++) {
        const a = r() * Math.PI * 2, l = R * (0.6 + r() * 0.8);
        ctx.beginPath(); ctx.moveTo(cx, cy + ry * 0.2); ctx.quadraticCurveTo(cx + Math.cos(a) * l * 0.5, cy + Math.sin(a) * l * 0.3, cx + Math.cos(a) * l, cy + Math.sin(a) * l * 0.6); ctx.stroke();
      }
      const n = Math.round(22 + R * 0.9);
      for (let i = 0; i < n; i++) {
        const t = r() * Math.PI * 2, d = Math.sqrt(r());
        const x = cx + Math.cos(t) * rx * d, y = cy + Math.sin(t) * ry * d;
        const rel = (y - cy) / ry;                       // -1 top .. 1 bottom
        const side = (x - cx) / rx;                      // -1 left (lit) .. 1 right
        let idx = Math.floor(((rel + 1) / 2) * 5 + side * 1.2 + r() * 2.5);
        idx = Math.max(0, Math.min(PINKS.length - 1, idx + (back ? -1 : 0)));
        const rad = R * (0.12 + r() * 0.17);
        if (rad > 5.5) {
          const g = ctx.createRadialGradient(x - rad * 0.35, y - rad * 0.35, rad * 0.1, x, y, rad);
          g.addColorStop(0, PINKS[Math.max(0, idx - 2)]); g.addColorStop(1, PINKS[idx]);
          ctx.fillStyle = g;
        } else {
          ctx.fillStyle = PINKS[idx];
        }
        ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
      }
      // buds: small deep-pink dots, mostly at the edges
      ctx.fillStyle = '#8e2a3b';
      for (let i = 0; i < 6; i++) {
        const t = r() * Math.PI * 2, d = 0.7 + r() * 0.35;
        ctx.beginPath(); ctx.arc(cx + Math.cos(t) * rx * d, cy + Math.sin(t) * ry * d, R * (0.04 + r() * 0.04), 0, Math.PI * 2); ctx.fill();
      }
      // open five-petal flowers on the lit top
      const f = 3 + Math.floor(r() * 4);
      for (let i = 0; i < f; i++) {
        const t = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.85;
        flower(cx + Math.cos(t) * rx * d, cy + Math.sin(t) * ry * d - ry * 0.15, R * (0.2 + r() * 0.1));
      }
      // top highlight: a soft light on the upper left of the pad
      const hg = ctx.createRadialGradient(cx - rx * 0.3, cy - ry * 0.45, 0, cx - rx * 0.3, cy - ry * 0.45, rx * 0.8);
      hg.addColorStop(0, 'rgba(255,255,255,0.28)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = hg; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    }

    function flower(x, y, s) {
      const rot = r() * Math.PI * 2;
      for (let k = 0; k < 5; k++) {
        const a = rot + (k * Math.PI * 2) / 5;
        const px = x + Math.cos(a) * s * 0.55, py = y + Math.sin(a) * s * 0.55;
        const g = ctx.createRadialGradient(x, y, s * 0.1, px, py, s * 0.6);
        g.addColorStop(0, '#bdbdbd'); g.addColorStop(0.5, '#eeeeee'); g.addColorStop(1, '#ffffff');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(px, py, s * 0.56, s * 0.36, a, 0, Math.PI * 2); ctx.fill();
        // the notch at the petal tip
        ctx.fillStyle = 'rgba(255,255,255,0.0)';
      }
      ctx.fillStyle = '#7b1e2e'; ctx.beginPath(); ctx.arc(x, y, s * 0.16, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#6a6a6a'; ctx.lineWidth = Math.max(0.5, s * 0.05);
      for (let k = 0; k < 6; k++) {
        const a = r() * Math.PI * 2, l = s * (0.18 + r() * 0.16);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
        ctx.fillStyle = '#3a3a3a'; ctx.beginPath(); ctx.arc(x + Math.cos(a) * l, y + Math.sin(a) * l, s * 0.05, 0, Math.PI * 2); ctx.fill();
      }
    }

    // ---- ground: pot, soil, moss, the root spread
    function pot(x, y) {
      const W = 150 * S, H = 40 * S;
      if (o.shadow !== false) {
        const g = ctx.createRadialGradient(x, y + 38 * S, 0, x, y + 38 * S, 200 * S);
        g.addColorStop(0, 'rgba(0,0,0,0.4)'); g.addColorStop(0.5, 'rgba(0,0,0,0.14)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x + 10 * S, y + 44 * S, 215 * S, 30 * S, 0, 0, Math.PI * 2); ctx.fill();
      }
      // body: glazed, darker at the edges, a vertical highlight on the lit side
      ctx.beginPath();
      ctx.moveTo(x - W, y + 6 * S); ctx.lineTo(x + W, y + 6 * S); ctx.lineTo(x + W * 0.86, y + H);
      ctx.quadraticCurveTo(x, y + H + 7 * S, x - W * 0.86, y + H); ctx.closePath();
      let g = ctx.createLinearGradient(x - W, 0, x + W, 0);
      g.addColorStop(0, '#0f0f0f'); g.addColorStop(0.18, '#2c2c2c'); g.addColorStop(0.3, '#4f4f4f'); g.addColorStop(0.42, '#2e2e2e'); g.addColorStop(0.75, '#1c1c1c'); g.addColorStop(1, '#0a0a0a');
      ctx.fillStyle = g; ctx.fill();
      g = ctx.createLinearGradient(0, y + 6 * S, 0, y + H);
      g.addColorStop(0, 'rgba(255,255,255,0.10)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = g; ctx.fill();
      // rim
      roundRect(ctx, x - W * 1.04, y - 3 * S, W * 2.08, 11 * S, 4 * S);
      g = ctx.createLinearGradient(x - W, 0, x + W, 0);
      g.addColorStop(0, '#2c2c2c'); g.addColorStop(0.3, '#767676'); g.addColorStop(0.6, '#3f3f3f'); g.addColorStop(1, '#1a1a1a');
      ctx.fillStyle = g; ctx.fill();
      g = ctx.createLinearGradient(0, y - 3 * S, 0, y + 8 * S);
      g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(0.4, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.3)');
      ctx.fillStyle = g; ctx.fill();
      ctx.fillStyle = '#0d0d0d';
      [-0.72, 0.72].forEach((k) => { roundRect(ctx, x + k * W * 0.8 - 11 * S, y + H - 2 * S, 22 * S, 8 * S, 3 * S); ctx.fill(); });
      // soil
      g = ctx.createLinearGradient(0, y - 14 * S, 0, y + 6 * S);
      g.addColorStop(0, '#3a3a3a'); g.addColorStop(1, '#1c1c1c');
      ctx.beginPath(); ctx.ellipse(x, y - 2 * S, W * 0.97, 12 * S, 0, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
      // moss: clumps with a lit top
      for (let i = 0; i < 70; i++) {
        const t = r() * Math.PI * 2, d = Math.sqrt(r());
        const mx = x + Math.cos(t) * W * 0.92 * d, my = y - 3 * S + Math.sin(t) * 9 * S * d;
        const mw = (4 + r() * 10) * S, mh = (2.5 + r() * 4) * S;
        const mg = ctx.createRadialGradient(mx - mw * 0.3, my - mh * 0.6, 0, mx, my, mw);
        const tone = ['#8a8a8a', '#6e6e6e', '#565656', '#a0a0a0'][Math.floor(r() * 4)];
        mg.addColorStop(0, tone); mg.addColorStop(1, '#3a3a3a');
        ctx.fillStyle = mg;
        ctx.beginPath(); ctx.ellipse(mx, my, mw, mh, r() * Math.PI, 0, Math.PI * 2); ctx.fill();
      }
      // a few small stones
      for (let i = 0; i < 5; i++) {
        const sx = x + (r() - 0.5) * W * 1.5, sy = y - 4 * S + (r() - 0.5) * 8 * S;
        const sr = (2 + r() * 3) * S;
        const sg = ctx.createRadialGradient(sx - sr * 0.3, sy - sr * 0.4, 0, sx, sy, sr);
        sg.addColorStop(0, '#d0d0d0'); sg.addColorStop(1, '#5a5a5a');
        ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse(sx, sy, sr, sr * 0.7, r(), 0, Math.PI * 2); ctx.fill();
      }
    }

    function roots(x, y, w) {
      // nebari: the root flare, spreading over the soil in every direction
      const n = 6 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + r() * 0.5;
        const len = w * (0.9 + r() * 1.3);
        const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len * 0.28 + 2 * S;
        seg(x + Math.cos(a) * w * 0.25, y - 1 * S, ex, ey, w * (0.32 + r() * 0.16), 1.5 * S, (r() - 0.5) * len * 0.3);
      }
    }

    function fallenPetals(x, y) {
      for (let i = 0; i < 14; i++) {
        const px = x + (r() - 0.5) * 460 * S, py = y + 30 * S + (r() - 0.3) * 30 * S;
        const s = (2.5 + r() * 3) * S;
        ctx.save(); ctx.translate(px, py); ctx.rotate(r() * Math.PI); ctx.scale(1, 0.55);
        ctx.fillStyle = PINKS[2 + Math.floor(r() * 4)]; ctx.globalAlpha = 0.85;
        ctx.beginPath(); ctx.moveTo(0, -s); ctx.bezierCurveTo(s * 0.9, -s * 0.9, s * 0.9, s * 0.6, 0, s); ctx.bezierCurveTo(-s * 0.9, s * 0.6, -s * 0.9, -s * 0.9, 0, -s); ctx.fill();
        ctx.restore();
      }
    }

    // ---- compose
    if (o.bokeh !== false && o.bokeh) bokeh(ctx, o, r);
    if (o.pot !== false) pot(bx, by);

    let x = bx, y = by - 6 * S, w = 36 * S;
    const lean = (r() - 0.5) * 0.3;
    const trunk = [[-0.3 + lean, 62], [0.4 + lean, 58], [-0.22 + lean, 50], [0.12 + lean, 30]];
    const knots = [];
    roots(x, y + 2 * S, w);
    for (const [a, l] of trunk) {
      const nx = x + Math.sin(a) * l * S, ny = y - Math.cos(a) * l * S;
      const w2 = w * 0.8;
      seg(x, y, nx, ny, w, w2, (a > 0 ? -1 : 1) * 16 * S);
      x = nx; y = ny; w = w2;
      knots.push({ x, y, w });
    }
    branch(knots[0].x, knots[0].y, -1.25 + lean, 58 * S * (0.8 + growth * 0.3), knots[0].w * 0.45, 3);
    branch(knots[1].x, knots[1].y, 1.15 + lean, 68 * S * (0.8 + growth * 0.3), knots[1].w * 0.5, 2);
    branch(knots[2].x, knots[2].y, -0.9 + lean, 40 * S * (0.8 + growth * 0.3), knots[2].w * 0.4, 3);
    branch(x, y, -0.2 + lean, 56 * S, w, 1);

    // soft light bloom behind the canopy
    if (pads.length) {
      let cx = 0, cy = 0; pads.forEach((p) => { cx += p.x; cy += p.y; }); cx /= pads.length; cy /= pads.length;
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 190 * S);
      bg.addColorStop(0, 'rgba(0, 0, 0, 0.05)'); bg.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(cx, cy, 190 * S, 0, Math.PI * 2); ctx.fill();
    }
    pads.sort((a, b) => a.y - b.y);
    const back = pads.filter((p) => p.back), front = pads.filter((p) => !p.back);
    if (back.length) {
      // the far pads are drawn on their own layer and composited once, slightly out of focus
      const main = ctx;
      const off = document.createElement('canvas');
      off.width = main.canvas.width; off.height = main.canvas.height;
      const octx = off.getContext('2d');
      octx.setTransform(main.getTransform());
      ctx = octx;
      for (const p of back) blossom(p.x, p.y, 22 * p.s, true);
      ctx = main;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (supportsFilter) ctx.filter = `blur(${Math.max(0.6, 1.3 * S).toFixed(1)}px)`;
      ctx.drawImage(off, 0, 0);
      ctx.restore();
    }
    for (const p of front) blossom(p.x, p.y, 22 * p.s, false);
    if (o.pot !== false) fallenPetals(bx, by);
  }

  // out-of-focus lights behind the tree, like a photo taken with a wide aperture
  function bokeh(ctx, o, r) {
    const { x, y, height: h } = o;
    const n = 26;
    for (let i = 0; i < n; i++) {
      const bx = x + (r() - 0.5) * h * 1.8, by = y - h * 0.55 + (r() - 0.5) * h * 1.2;
      const rad = h * (0.02 + r() * 0.07);
      const g = ctx.createRadialGradient(bx, by, 0, bx, by, rad);
      const a = 0.08 + r() * 0.16;
      const c = r() < 0.6 ? '120,120,120' : '255,255,255';
      g.addColorStop(0, `rgba(${c},${a})`); g.addColorStop(0.75, `rgba(${c},${a * 0.8})`); g.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, by, rad, 0, Math.PI * 2); ctx.fill();
    }
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
      // big canvases are drawn at a modest resolution: the tree is soft anyway
      const dpr = Math.min(w * h > 600000 ? 1.25 : 2, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const opts = layout(w, h);
      if (opts) draw(ctx, opts);
    }
    let timer = 0;
    const schedule = () => { clearTimeout(timer); timer = setTimeout(() => { if (!raf) raf = requestAnimationFrame(render); }, 120); };
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
      dpr = 1;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    let lastT = 0;
    function spawn(p, top) {
      p.x = rnd() * w; p.y = top ? -20 : rnd() * h;
      p.z = 0.5 + rnd(); // depth: bigger, faster and sharper when near
      p.s = (3 + rnd() * 4) * p.z; p.a = rnd() * Math.PI * 2; p.spin = (rnd() - 0.5) * 0.05;
      p.vy = (0.3 + rnd() * 0.5) * p.z; p.vx = 0.2 + rnd() * 0.5; p.ph = rnd() * Math.PI * 2;
      p.flip = rnd() * Math.PI * 2;
      p.c = rnd() < 0.18 ? '#8e2a3b' : PINKS[2 + Math.floor(rnd() * 5)]; // now and then a maroon petal
      return p;
    }
    function step(t) {
      if (!running) return;
      requestAnimationFrame(step);
      if (t - lastT < 33 || document.body.classList.contains('ng-welcome-open')) return; // ~30 fps, and idle behind the gate
      lastT = t;
      ctx.clearRect(0, 0, w, h);
      for (const p of list) {
        p.ph += 0.02; p.a += p.spin; p.flip += 0.035;
        p.x += Math.sin(p.ph) * 0.6 + p.vx * 0.4; p.y += p.vy;
        if (p.y > h + 20 || p.x > w + 30) spawn(p, true);
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
        ctx.scale(1, 0.35 + Math.abs(Math.sin(p.flip)) * 0.65); // tumbling
        ctx.globalAlpha = 0.55 + p.z * 0.3;
        ctx.fillStyle = p.c;
        ctx.beginPath();
        ctx.moveTo(0, -p.s);
        ctx.bezierCurveTo(p.s * 0.9, -p.s * 0.9, p.s * 0.9, p.s * 0.6, 0, p.s);
        ctx.bezierCurveTo(-p.s * 0.9, p.s * 0.6, -p.s * 0.9, -p.s * 0.9, 0, -p.s);
        ctx.fill();
        ctx.restore();
      }
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
