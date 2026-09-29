/* The ocean behind the page.
 *
 * Four layers, back to front, all inside #ocean (fixed, behind the content):
 *   1. water     a CSS gradient from the lit surface down to the deep
 *   2. reef      three SVG ridges generated here (far, mid, near), each one
 *                pushed further into the blue the further away it sits
 *   3. life      a 2D canvas: fish, schools, marine snow and bubbles
 *   4. light     a WebGL canvas: sun shafts from the surface and caustics
 *                dancing on the reef, blended on top with `screen`
 *
 * Everything is procedural, so there are no image files to ship. A seeded
 * random keeps the reef the same on every visit.
 */
(function () {
  'use strict';

  const root = document.getElementById('ocean');
  if (!root) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------------------------------------------------------------- helpers
  function mulberry(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const toHex = c => '#' + c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
  // Water eats red first: push a colour toward the water tone by `amt`.
  function fog(color, amt, water) {
    const a = hex(color), w = hex(water || '#0a2f4d');
    const k = [amt * 1.15, amt, amt * 0.85];
    return toHex(a.map((v, i) => v + (w[i] - v) * Math.min(1, k[i])));
  }
  const f1 = n => n.toFixed(1);

  // ---------------------------------------------------------------- reef
  const W = 1600;

  function rockPath(r, x, base, w, h) {
    const pts = [];
    const n = 14;
    for (let i = 0; i <= n; i++) {
      const a = Math.PI * (i / n);
      const bump = 1 + (r() - 0.5) * 0.28;
      pts.push([x + Math.cos(Math.PI - a) * w / 2 * (1 + (r() - 0.5) * 0.1), base - Math.sin(a) * h * bump]);
    }
    let d = `M${f1(x - w / 2)},${f1(base + 4)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      d += `Q${f1(pts[i][0])},${f1(pts[i][1])} ${f1(mx)},${f1(my)}`;
    }
    return d + `L${f1(x + w / 2)},${f1(base + 4)}Z`;
  }

  function branching(r, x, y, opt) {
    // Staghorn / sea-fan style branching, one path per generation so each
    // generation can share a stroke width.
    const gens = [];
    const tips = [];
    function grow(px, py, ang, len, depth) {
      const bend = (r() - 0.5) * opt.wiggle;
      const ex = px + Math.cos(ang) * len, ey = py + Math.sin(ang) * len;
      const cx = px + Math.cos(ang + bend) * len * 0.55, cy = py + Math.sin(ang + bend) * len * 0.55;
      (gens[depth] = gens[depth] || []).push(`M${f1(px)},${f1(py)}Q${f1(cx)},${f1(cy)} ${f1(ex)},${f1(ey)}`);
      if (depth >= opt.depth) { tips.push([ex, ey]); return; }
      const kids = opt.kids[0] + Math.floor(r() * (opt.kids[1] - opt.kids[0] + 1));
      for (let k = 0; k < kids; k++) {
        const spread = opt.spread * (k - (kids - 1) / 2) + (r() - 0.5) * opt.jitter;
        grow(ex, ey, ang + spread, len * (opt.decay + (r() - 0.5) * 0.12), depth + 1);
      }
    }
    for (let s = 0; s < opt.stems; s++) {
      grow(x + (r() - 0.5) * opt.base, y, -Math.PI / 2 + (r() - 0.5) * opt.lean, opt.len, 0);
    }
    return { gens, tips };
  }

  function staghorn(r, x, y, size, color, fogAmt) {
    const { gens, tips } = branching(r, x, y, {
      stems: 3, base: size * 0.4, lean: 1.1, len: size * 0.34, depth: 3, kids: [2, 3],
      spread: 0.5, jitter: 0.35, decay: 0.72, wiggle: 0.6
    });
    const dark = fog(color, fogAmt + 0.25), main = fog(color, fogAmt), light = fog('#ffe9d6', fogAmt + 0.15);
    let out = '<g stroke-linecap="round" fill="none">';
    gens.forEach((g, i) => {
      const w = size * 0.085 * Math.pow(0.74, i);
      out += `<path d="${g.join('')}" stroke="${dark}" stroke-width="${f1(w + 2)}"/>`;
      out += `<path d="${g.join('')}" stroke="${main}" stroke-width="${f1(w)}"/>`;
    });
    out += `<g fill="${light}" opacity="0.8">${tips.map(t => `<circle cx="${f1(t[0])}" cy="${f1(t[1])}" r="${f1(size * 0.022)}"/>`).join('')}</g>`;
    return out + '</g>';
  }

  function seaFan(r, x, y, size, color, fogAmt) {
    const { gens } = branching(r, x, y, {
      stems: 1, base: 0, lean: 0.3, len: size * 0.16, depth: 6, kids: [2, 2],
      spread: 0.34, jitter: 0.3, decay: 0.8, wiggle: 0.5
    });
    const main = fog(color, fogAmt);
    let out = `<g class="sway sway--slow" style="transform-origin:${f1(x)}px ${f1(y)}px" stroke-linecap="round" fill="none" stroke="${main}">`;
    out += `<ellipse cx="${f1(x)}" cy="${f1(y - size * 0.55)}" rx="${f1(size * 0.42)}" ry="${f1(size * 0.44)}" fill="${main}" fill-opacity="0.13" stroke="none"/>`;
    gens.forEach((g, i) => { out += `<path d="${g.join('')}" stroke-width="${f1(Math.max(0.8, size * 0.03 * Math.pow(0.72, i)))}"/>`; });
    return out + '</g>';
  }

  function brainCoral(r, x, y, rad, color, fogAmt, id) {
    const main = fog(color, fogAmt), dark = fog(color, fogAmt + 0.3), light = fog('#fff2cf', fogAmt + 0.2);
    const h = rad * 0.72;
    const dome = `M${f1(x - rad)},${f1(y)} C${f1(x - rad)},${f1(y - h * 1.3)} ${f1(x + rad)},${f1(y - h * 1.3)} ${f1(x + rad)},${f1(y)}Z`;
    let grooves = '';
    for (let row = 0; row < 7; row++) {
      const yy = y - h * (row + 0.5) / 7.2;
      let d = `M${f1(x - rad)},${f1(yy)}`;
      for (let k = 0; k <= 12; k++) {
        const xx = x - rad + (k / 12) * rad * 2;
        d += `Q${f1(xx - rad / 24)},${f1(yy + (r() - 0.5) * rad * 0.22)} ${f1(xx)},${f1(yy + (r() - 0.5) * 3)}`;
      }
      grooves += `<path d="${d}"/>`;
    }
    return `<g>
      <clipPath id="${id}"><path d="${dome}"/></clipPath>
      <path d="${dome}" fill="${main}"/>
      <g clip-path="url(#${id})">
        <g fill="none" stroke="${dark}" stroke-width="${f1(rad * 0.05)}" stroke-linecap="round">${grooves}</g>
        <ellipse cx="${f1(x - rad * 0.25)}" cy="${f1(y - h * 0.85)}" rx="${f1(rad * 0.6)}" ry="${f1(h * 0.35)}" fill="${light}" opacity="0.22"/>
        <rect x="${f1(x - rad)}" y="${f1(y - h * 0.4)}" width="${f1(rad * 2)}" height="${f1(h * 0.4)}" fill="${dark}" opacity="0.45"/>
      </g></g>`;
  }

  function tubeSponge(r, x, y, size, color, fogAmt) {
    const main = fog(color, fogAmt), dark = fog(color, fogAmt + 0.35), rim = fog('#ffd9ec', fogAmt + 0.2);
    let out = '<g>';
    const n = 3 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const w = size * (0.14 + r() * 0.08), h = size * (0.45 + r() * 0.55);
      const cx = x + (i - (n - 1) / 2) * w * 0.95 + (r() - 0.5) * 6;
      const lean = (i - (n - 1) / 2) * 6 + (r() - 0.5) * 6;
      const top = y - h;
      out += `<path d="M${f1(cx - w / 2)},${f1(y)} C${f1(cx - w / 2)},${f1(y - h * 0.5)} ${f1(cx - w * 0.6 + lean)},${f1(top + h * 0.2)} ${f1(cx - w * 0.55 + lean)},${f1(top)}
        L${f1(cx + w * 0.55 + lean)},${f1(top)} C${f1(cx + w * 0.6 + lean)},${f1(top + h * 0.2)} ${f1(cx + w / 2)},${f1(y - h * 0.5)} ${f1(cx + w / 2)},${f1(y)}Z" fill="${main}"/>`;
      out += `<path d="M${f1(cx - w * 0.3)},${f1(y)} C${f1(cx - w * 0.3)},${f1(y - h * 0.5)} ${f1(cx - w * 0.35 + lean)},${f1(top + h * 0.2)} ${f1(cx - w * 0.3 + lean)},${f1(top + 4)}" stroke="${rim}" stroke-opacity="0.25" stroke-width="${f1(w * 0.12)}" fill="none"/>`;
      out += `<ellipse cx="${f1(cx + lean)}" cy="${f1(top)}" rx="${f1(w * 0.55)}" ry="${f1(w * 0.2)}" fill="${rim}" opacity="0.7"/>`;
      out += `<ellipse cx="${f1(cx + lean)}" cy="${f1(top + 1)}" rx="${f1(w * 0.42)}" ry="${f1(w * 0.13)}" fill="${dark}"/>`;
    }
    return out + '</g>';
  }

  function anemone(r, x, y, size, color, fogAmt) {
    const main = fog(color, fogAmt), tip = fog('#fff0f6', fogAmt + 0.1), col = fog('#6a3d52', fogAmt);
    let t = '';
    const n = 26;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i / (n - 1) - 0.5) * 2.5;
      const len = size * (0.55 + r() * 0.35);
      const ex = x + Math.cos(a) * len, ey = y - size * 0.3 + Math.sin(a) * len * 0.9;
      const cx = x + Math.cos(a - 0.4) * len * 0.5, cy = y - size * 0.3 + Math.sin(a - 0.4) * len * 0.5;
      t += `<path d="M${f1(x + (r() - 0.5) * size * 0.3)},${f1(y - size * 0.28)}Q${f1(cx)},${f1(cy)} ${f1(ex)},${f1(ey)}"/>`;
    }
    const delay = (r() * -6).toFixed(2);
    return `<g>
      <path d="M${f1(x - size * 0.2)},${f1(y)} Q${f1(x - size * 0.24)},${f1(y - size * 0.2)} ${f1(x - size * 0.16)},${f1(y - size * 0.3)} L${f1(x + size * 0.16)},${f1(y - size * 0.3)} Q${f1(x + size * 0.24)},${f1(y - size * 0.2)} ${f1(x + size * 0.2)},${f1(y)}Z" fill="${col}"/>
      <g class="sway sway--anemone" style="transform-origin:${f1(x)}px ${f1(y - size * 0.3)}px;animation-delay:${delay}s" fill="none" stroke-linecap="round">
        <g stroke="${main}" stroke-width="${f1(size * 0.06)}">${t}</g>
        <g stroke="${tip}" stroke-width="${f1(size * 0.03)}" stroke-dasharray="1 ${f1(size * 2)}" stroke-dashoffset="${f1(-size * 0.5)}" opacity="0.6">${t}</g>
      </g></g>`;
  }

  function kelp(r, x, y, h, color, fogAmt) {
    const main = fog(color, fogAmt), vein = fog('#d8e7a0', fogAmt + 0.1);
    let stem = `M${f1(x)},${f1(y)}`;
    let blades = '';
    const seg = 9;
    let px = x, py = y;
    for (let i = 1; i <= seg; i++) {
      const ny = y - (h * i) / seg;
      const nx = x + Math.sin(i * 0.9 + r() * 0.6) * h * 0.035;
      stem += `Q${f1(px + (r() - 0.5) * 10)},${f1((py + ny) / 2)} ${f1(nx)},${f1(ny)}`;
      if (i > 1) {
        const side = i % 2 ? 1 : -1;
        const bl = h * (0.13 + r() * 0.07), bw = h * 0.03;
        const tx = nx + side * bl, ty = ny - bl * 0.55;
        blades += `<path d="M${f1(nx)},${f1(ny)} C${f1(nx + side * bl * 0.3)},${f1(ny - bw * 2)} ${f1(tx - side * bl * 0.2)},${f1(ty - bw)} ${f1(tx)},${f1(ty)} C${f1(tx - side * bl * 0.3)},${f1(ty + bw * 1.6)} ${f1(nx + side * bl * 0.3)},${f1(ny + bw)} ${f1(nx)},${f1(ny)}Z"/>`;
      }
      px = nx; py = ny;
    }
    const dur = (7 + r() * 4).toFixed(1), delay = (r() * -8).toFixed(1);
    return `<g class="sway sway--kelp" style="transform-origin:${f1(x)}px ${f1(y)}px;animation-duration:${dur}s;animation-delay:${delay}s">
      <path d="${stem}" fill="none" stroke="${main}" stroke-width="${f1(h * 0.012 + 1.5)}" stroke-linecap="round"/>
      <g fill="${main}" fill-opacity="0.92" stroke="${vein}" stroke-opacity="0.18" stroke-width="1">${blades}</g></g>`;
  }

  function seagrass(r, x, y, h, color, fogAmt) {
    const main = fog(color, fogAmt);
    let blades = '';
    for (let i = 0; i < 9; i++) {
      const bx = x + (i - 4) * 4 + (r() - 0.5) * 4;
      const bh = h * (0.5 + r() * 0.5);
      const bend = (r() - 0.3) * bh * 0.4;
      blades += `<path d="M${f1(bx)},${f1(y)} Q${f1(bx + bend * 0.2)},${f1(y - bh * 0.6)} ${f1(bx + bend)},${f1(y - bh)}"/>`;
    }
    const delay = (r() * -6).toFixed(1);
    return `<g class="sway sway--grass" style="transform-origin:${f1(x)}px ${f1(y)}px;animation-delay:${delay}s" fill="none" stroke="${main}" stroke-width="2.4" stroke-linecap="round">${blades}</g>`;
  }

  function urchin(r, x, y, size, fogAmt) {
    const c = fog('#2a1838', fogAmt), s = fog('#4b2d62', fogAmt);
    let sp = '';
    for (let i = 0; i < 28; i++) {
      const a = Math.PI + (i / 27) * Math.PI + (r() - 0.5) * 0.1;
      const l = size * (0.9 + r() * 0.6);
      sp += `<path d="M${f1(x)},${f1(y - size * 0.3)}L${f1(x + Math.cos(a) * l)},${f1(y - size * 0.3 + Math.sin(a) * l)}"/>`;
    }
    return `<g><g stroke="${s}" stroke-width="1.2" stroke-linecap="round">${sp}</g><ellipse cx="${f1(x)}" cy="${f1(y - size * 0.25)}" rx="${f1(size * 0.5)}" ry="${f1(size * 0.38)}" fill="${c}"/></g>`;
  }

  function starfish(x, y, size, rot, color, fogAmt) {
    const c = fog(color, fogAmt), d = fog(color, fogAmt + 0.25);
    let p = '';
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 ? size * 0.38 : size;
      p += (i ? 'L' : 'M') + f1(Math.cos(a) * rr) + ',' + f1(Math.sin(a) * rr * 0.55);
    }
    return `<g transform="translate(${f1(x)} ${f1(y)}) rotate(${rot})"><path d="${p}Z" fill="${c}" stroke="${d}" stroke-width="2" stroke-linejoin="round"/></g>`;
  }

  function shell(x, y, size, fogAmt) {
    const c = fog('#e9d3bb', fogAmt), d = fog('#b49274', fogAmt);
    let ribs = '';
    for (let i = 0; i < 7; i++) {
      const a = Math.PI + (i / 6) * Math.PI;
      ribs += `<path d="M${f1(x)},${f1(y)}L${f1(x + Math.cos(a) * size)},${f1(y + Math.sin(a) * size * 0.8)}"/>`;
    }
    return `<g><path d="M${f1(x - size)},${f1(y)} A${f1(size)},${f1(size * 0.8)} 0 0 1 ${f1(x + size)},${f1(y)}Z" fill="${c}"/><g stroke="${d}" stroke-width="1.2">${ribs}</g></g>`;
  }

  function sand(r, H, top, color, fogAmt) {
    let d = `M0,${H}L0,${f1(top)}`;
    for (let x = 0; x <= W; x += 100) {
      d += `Q${f1(x + 50)},${f1(top + (r() - 0.5) * 22)} ${f1(x + 100)},${f1(top + (r() - 0.5) * 10)}`;
    }
    return `<path d="${d}L${W},${H}Z" fill="${fog(color, fogAmt)}"/>`;
  }

  function buildLayer(kind, H) {
    const r = mulberry(kind === 'far' ? 7 : kind === 'mid' ? 19 : 42);
    let svg = '';
    let n = 0;
    const uid = () => `rc-${kind}-${n++}`;

    if (kind === 'far') {
      const f = 0.72;
      for (let i = 0; i < 9; i++) {
        const x = i * 200 + r() * 80, w = 260 + r() * 220, h = 90 + r() * 120;
        svg += `<path d="${rockPath(r, x, H, w, h)}" fill="${fog('#3b4d5c', f)}"/>`;
      }
      for (let i = 0; i < 10; i++) svg += seaFan(r, r() * W, H - 60 - r() * 60, 90 + r() * 90, '#9b4f7a', f + 0.05);
      for (let i = 0; i < 8; i++) svg += staghorn(r, r() * W, H - 50 - r() * 40, 70 + r() * 60, '#c9825c', f + 0.05);
      for (let i = 0; i < 6; i++) svg += kelp(r, r() * W, H, 220 + r() * 160, '#4d6b3a', f);
    }

    if (kind === 'mid') {
      const f = 0.42;
      svg += sand(r, H, H - 70, '#b9a57e', f + 0.08);
      for (let i = 0; i < 7; i++) {
        const x = i * 250 + r() * 90, w = 200 + r() * 180, h = 70 + r() * 90;
        svg += `<path d="${rockPath(r, x, H - 40, w, h)}" fill="${fog('#4f5a57', f)}"/>`;
      }
      for (let i = 0; i < 8; i++) svg += seaFan(r, 60 + r() * (W - 120), H - 95 - r() * 30, 110 + r() * 70, i % 2 ? '#a64b6a' : '#7d5aa8', f);
      for (let i = 0; i < 7; i++) svg += staghorn(r, r() * W, H - 80 - r() * 30, 80 + r() * 60, i % 2 ? '#d0875f' : '#c7a153', f);
      for (let i = 0; i < 5; i++) svg += brainCoral(r, r() * W, H - 55 - r() * 20, 40 + r() * 26, '#b88a52', f, uid());
      for (let i = 0; i < 5; i++) svg += tubeSponge(r, r() * W, H - 60 - r() * 20, 90 + r() * 50, '#9a4f86', f);
      for (let i = 0; i < 7; i++) svg += kelp(r, r() * W, H - 40, 200 + r() * 170, '#5d7a33', f);
    }

    if (kind === 'near') {
      const f = 0.1;
      svg += sand(r, H, H - 48, '#c8b288', f + 0.14);
      // two big coral heads framing the page, plus a low line across the middle
      const heads = [[110, 1], [W - 130, -1]];
      heads.forEach(([hx]) => {
        svg += `<path d="${rockPath(r, hx, H - 20, 380, 150)}" fill="${fog('#4a4f4c', f + 0.18)}"/>`;
        svg += `<path d="${rockPath(r, hx + 40, H - 20, 240, 110)}" fill="${fog('#5b5e57', f + 0.14)}"/>`;
      });
      svg += brainCoral(r, 150, H - 120, 70, '#c8924e', f, uid());
      svg += brainCoral(r, W - 170, H - 128, 64, '#b37a4a', f, uid());
      svg += tubeSponge(r, 40, H - 110, 150, '#a8528f', f);
      svg += tubeSponge(r, W - 40, H - 118, 170, '#8e4fa6', f);
      svg += staghorn(r, 260, H - 110, 140, '#e08a5a', f);
      svg += staghorn(r, W - 300, H - 118, 150, '#d9a44a', f);
      svg += anemone(r, 330, H - 60, 70, '#f07aa2', f);
      svg += anemone(r, W - 380, H - 62, 66, '#ff9a6a', f);
      svg += seaFan(r, 70, H - 170, 170, '#b8456f', f + 0.05);
      svg += seaFan(r, W - 90, H - 200, 190, '#7b54b5', f + 0.05);
      for (let i = 0; i < 4; i++) svg += kelp(r, 10 + r() * 60, H - 30, 380 + r() * 180, '#6d8a36', f);
      for (let i = 0; i < 4; i++) svg += kelp(r, W - 80 + r() * 70, H - 30, 380 + r() * 180, '#6d8a36', f);
      for (let i = 0; i < 16; i++) svg += seagrass(r, r() * W, H - 26 - r() * 10, 40 + r() * 40, '#5f8a45', f + 0.05);
      // small life on the sand
      for (let i = 0; i < 5; i++) svg += brainCoral(r, 420 + r() * (W - 840), H - 38, 16 + r() * 16, i % 2 ? '#c29155' : '#a8784a', f + 0.05, uid());
      svg += urchin(r, 520, H - 30, 18, f);
      svg += urchin(r, W - 560, H - 28, 15, f);
      svg += starfish(640, H - 22, 18, 20, '#e0663f', f);
      svg += starfish(W - 700, H - 20, 15, -30, '#d9853a', f);
      svg += shell(760, H - 18, 12, f);
      svg += shell(W - 820, H - 16, 10, f);
      for (let i = 0; i < 4; i++) svg += anemone(r, 560 + r() * (W - 1120), H - 30, 26 + r() * 14, i % 2 ? '#ef7fa8' : '#86d0c6', f + 0.04);
    }

    return `<svg class="reef reef--${kind}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" aria-hidden="true">${svg}</svg>`;
  }

  const reefWrap = document.createElement('div');
  reefWrap.className = 'ocean__reef';
  reefWrap.innerHTML = buildLayer('far', 520) + buildLayer('mid', 520) + buildLayer('near', 560);
  const [farLayer, midLayer, nearLayer] = reefWrap.querySelectorAll('.reef');

  // ---------------------------------------------------------------- life
  const life = document.createElement('canvas');
  life.className = 'ocean__life';

  const lightCv = document.createElement('canvas');
  lightCv.className = 'ocean__light';

  const shade = document.createElement('div');
  shade.className = 'ocean__shade';

  // far reef, fish, mid + near reef, light on top of everything
  root.append(farLayer, life, midLayer, nearLayer, lightCv, shade);

  const ctx = life.getContext('2d');
  let vw = 0, vh = 0, dpr = 1;
  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    vw = window.innerWidth; vh = window.innerHeight;
    life.width = vw * dpr; life.height = vh * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  size();

  const R = mulberry(1234);
  const WATER = '#0b3350';

  const SPECIES = {
    chromis:  { len: 26, h: 0.42, top: '#2d8fb5', belly: '#9fe3ef', fin: '#5ec3dc', stripe: null },
    tang:     { len: 34, h: 0.72, top: '#f2c230', belly: '#ffe56b', fin: '#e8a91d', stripe: null },
    anthias:  { len: 24, h: 0.46, top: '#f27a58', belly: '#ffc0a0', fin: '#ff9c7c', stripe: null },
    sergeant: { len: 30, h: 0.55, top: '#c9c96a', belly: '#eef2e0', fin: '#b3b870', stripe: '#1d2a34' },
    silver:   { len: 18, h: 0.3,  top: '#3f6f93', belly: '#d9ecf4', fin: '#8fb6cc', stripe: null },
    angel:    { len: 40, h: 0.9,  top: '#1f4aa8', belly: '#f5c542', fin: '#3a6ae0', stripe: '#f5c542' }
  };

  function fishColor(c, z) { return fog(c, (1 - z) * 0.85, WATER); }

  function drawFish(f, t) {
    const sp = SPECIES[f.sp];
    const L = sp.len * f.scale, H = L * sp.h;
    const wag = Math.sin(t * f.wagSpeed + f.phase) * 0.28;
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.scale(f.dir, 1);
    ctx.rotate(f.tilt);
    ctx.globalAlpha = 0.35 + f.z * 0.65;

    const top = fishColor(sp.top, f.z), belly = fishColor(sp.belly, f.z), fin = fishColor(sp.fin, f.z);

    // tail
    ctx.save();
    ctx.translate(-L * 0.42, 0);
    ctx.rotate(wag);
    ctx.fillStyle = fin;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-L * 0.2, -H * 0.2, -L * 0.3, -H * 0.55);
    ctx.quadraticCurveTo(-L * 0.2, 0, -L * 0.3, H * 0.55);
    ctx.quadraticCurveTo(-L * 0.2, H * 0.2, 0, 0);
    ctx.fill();
    ctx.restore();

    // dorsal + anal fins
    ctx.fillStyle = fin;
    ctx.beginPath();
    ctx.moveTo(L * 0.1, -H * 0.45);
    ctx.quadraticCurveTo(-L * 0.1, -H * (f.sp === 'angel' ? 1.25 : 0.85), -L * 0.32, -H * 0.2);
    ctx.lineTo(-L * 0.2, -H * 0.3);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-L * 0.05, H * 0.42);
    ctx.quadraticCurveTo(-L * 0.18, H * (f.sp === 'angel' ? 1.15 : 0.7), -L * 0.32, H * 0.2);
    ctx.fill();

    // body with a slight bend toward the tail
    const bend = wag * H * 0.25;
    const g = ctx.createLinearGradient(0, -H / 2, 0, H / 2);
    g.addColorStop(0, top); g.addColorStop(0.55, top); g.addColorStop(1, belly);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(L * 0.5, 0);
    ctx.bezierCurveTo(L * 0.45, -H * 0.62, -L * 0.2, -H * 0.62, -L * 0.44, bend - H * 0.08);
    ctx.lineTo(-L * 0.44, bend + H * 0.08);
    ctx.bezierCurveTo(-L * 0.2, H * 0.62, L * 0.45, H * 0.62, L * 0.5, 0);
    ctx.fill();

    if (sp.stripe) {
      ctx.save();
      ctx.clip();
      ctx.fillStyle = fishColor(sp.stripe, f.z);
      ctx.globalAlpha *= 0.7;
      for (let i = 0; i < 4; i++) ctx.fillRect(L * 0.22 - i * L * 0.18, -H, L * 0.06, H * 2);
      ctx.restore();
    }

    // sheen along the flank
    ctx.globalAlpha *= 0.35;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(L * 0.05, -H * 0.12, L * 0.3, H * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.35 + f.z * 0.65;

    // eye
    if (f.z > 0.45) {
      ctx.fillStyle = '#f2f6f8';
      ctx.beginPath(); ctx.arc(L * 0.3, -H * 0.1, H * 0.13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0a1420';
      ctx.beginPath(); ctx.arc(L * 0.315, -H * 0.1, H * 0.085, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // Loners: a handful of reef fish crossing at their own pace.
  const loners = [];
  const lonerSpecies = ['tang', 'anthias', 'sergeant', 'chromis', 'angel', 'tang', 'anthias', 'chromis'];
  lonerSpecies.forEach((sp, i) => {
    const z = 0.35 + R() * 0.65;
    loners.push({
      sp, z, scale: 0.55 + z * 0.9, x: R() * vw, baseY: vh * (0.25 + R() * 0.6), y: 0,
      dir: R() > 0.5 ? 1 : -1, speed: 10 + z * 22 + R() * 10, phase: R() * 10,
      wagSpeed: 5 + R() * 3, bob: 8 + R() * 18, tilt: 0, vy: 0
    });
  });

  // Schools: silversides moving as one, each fish holding a loose slot.
  const schools = [];
  function makeSchool(z, count) {
    const s = { z, dir: R() > 0.5 ? 1 : -1, speed: 16 + z * 18, x: 0, y: vh * (0.2 + R() * 0.45), members: [], t0: R() * 100 };
    s.x = s.dir > 0 ? -300 - R() * vw : vw + 300 + R() * vw;
    for (let i = 0; i < count; i++) {
      s.members.push({ sp: 'silver', z, scale: 0.5 + z * 0.7, ox: (R() - 0.5) * 220, oy: (R() - 0.5) * 90, x: 0, y: 0, dir: s.dir, phase: R() * 10, wagSpeed: 9 + R() * 4, tilt: 0 });
    }
    schools.push(s);
  }
  makeSchool(0.35, 26);
  makeSchool(0.6, 18);

  // Marine snow and bubbles.
  const snow = [];
  for (let i = 0; i < 140; i++) snow.push({ x: R() * vw, y: R() * vh, r: 0.4 + R() * 1.5, a: 0.12 + R() * 0.4, vy: 3 + R() * 8, sway: R() * 10, z: R() });
  const bubbles = [];
  function spawnBubble() {
    const x = R() < 0.5 ? 40 + R() * vw * 0.2 : vw * 0.8 + R() * (vw * 0.2 - 40);
    const n = 3 + Math.floor(R() * 6);
    for (let i = 0; i < n; i++) bubbles.push({ x: x + (R() - 0.5) * 8, y: vh + 10 + i * (14 + R() * 12), r: 1.2 + R() * 3.6, vy: 30 + R() * 30, ph: R() * 6 });
  }

  let mouseX = -9999, mouseY = -9999;
  window.addEventListener('pointermove', e => { mouseX = e.clientX; mouseY = e.clientY; }, { passive: true });

  let scrollY = window.scrollY;
  let last = performance.now();

  function stepLife(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now / 1000;
    ctx.clearRect(0, 0, vw, vh);

    // snow: behind fish when far, drifts with a touch of parallax
    ctx.fillStyle = '#cfe8f5';
    for (const p of snow) {
      p.y += p.vy * dt; p.x += Math.sin(t * 0.3 + p.sway) * 0.08;
      if (p.y > vh + 5) { p.y = -5; p.x = R() * vw; }
      const py = ((p.y - scrollY * 0.04 * (0.4 + p.z)) % (vh + 10) + vh + 10) % (vh + 10) - 5;
      ctx.globalAlpha = p.a;
      ctx.beginPath(); ctx.arc(p.x, py, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    const draw = [];

    for (const s of schools) {
      s.x += s.dir * s.speed * dt;
      const wob = Math.sin(t * 0.4 + s.t0) * 30;
      if ((s.dir > 0 && s.x > vw + 360) || (s.dir < 0 && s.x < -360)) {
        s.dir *= -1; s.y = vh * (0.18 + R() * 0.45);
        s.members.forEach(m => { m.dir = s.dir; });
      }
      for (const m of s.members) {
        // slots breathe slowly so the school changes shape as it swims
        const tx = s.x + m.ox * (1 + 0.15 * Math.sin(t * 0.5 + m.phase)) ;
        const ty = s.y + wob + m.oy * (1 + 0.25 * Math.sin(t * 0.35 + m.phase)) - scrollY * 0.05 * s.z;
        const dx = tx - mouseX, dy = ty - mouseY, d2 = dx * dx + dy * dy;
        let ax = 0, ay = 0;
        if (d2 < 14000) { const d = Math.sqrt(d2) || 1; ax = (dx / d) * (120 - d) * 0.9; ay = (dy / d) * (120 - d) * 0.9; }
        m.x += ((tx + ax) - m.x) * Math.min(1, dt * 3);
        const ny = ty + ay;
        m.tilt = Math.max(-0.3, Math.min(0.3, (ny - m.y) * 0.05)) * m.dir;
        m.y += (ny - m.y) * Math.min(1, dt * 3);
        if (!m.init) { m.x = tx; m.y = ty; m.init = true; }
        draw.push(m);
      }
    }

    for (const f of loners) {
      f.x += f.dir * f.speed * dt;
      if (f.dir > 0 && f.x > vw + 80) { f.x = -80; f.baseY = vh * (0.22 + R() * 0.6); }
      if (f.dir < 0 && f.x < -80) { f.x = vw + 80; f.baseY = vh * (0.22 + R() * 0.6); }
      const target = f.baseY + Math.sin(t * 0.5 + f.phase) * f.bob - scrollY * 0.06 * f.z;
      const dx = f.x - mouseX, dy = target - mouseY, d2 = dx * dx + dy * dy;
      let push = 0;
      if (d2 < 16000) push = (dy >= 0 ? 1 : -1) * (130 - Math.sqrt(d2)) * 0.8;
      const ny = target + push;
      f.tilt = Math.max(-0.35, Math.min(0.35, (ny - (f.y || ny)) * 0.04)) * f.dir;
      f.y = f.y ? f.y + (ny - f.y) * Math.min(1, dt * 2.5) : ny;
      draw.push(f);
    }

    draw.sort((a, b) => a.z - b.z);
    for (const f of draw) drawFish(f, t);

    // bubbles in front of everything
    if (R() < dt * 0.6) spawnBubble();
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      b.vy += 8 * dt;
      b.y -= b.vy * dt;
      b.x += Math.sin(t * 3 + b.ph) * 0.35;
      if (b.y < -20) { bubbles.splice(i, 1); continue; }
      const a = Math.min(1, (b.y / vh) * 1.4);
      ctx.globalAlpha = 0.55 * a;
      ctx.strokeStyle = '#d8f1ff';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 0.18 * a;
      ctx.fillStyle = '#bfe6ff';
      ctx.fill();
      ctx.globalAlpha = 0.9 * a;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.28, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- light
  const gl = lightCv.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
  let glDraw = null;
  if (gl) {
    const vs = `attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;
    const fs = `
      precision mediump float;
      uniform vec2 res; uniform float t; uniform float deep; uniform float reefTop;

      vec2 hash2(vec2 p){
        p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
        return fract(sin(p) * 43758.5453);
      }
      // Distance to the nearest cell border: thin bright lines where cells meet,
      // which is what light focused by a rippled surface looks like on sand.
      float cellEdge(vec2 p, float time){
        vec2 i = floor(p), f = fract(p);
        float d1 = 8., d2 = 8.;
        for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
          vec2 g = vec2(float(x), float(y));
          vec2 o = hash2(i + g);
          o = 0.5 + 0.42 * sin(time + 6.2831 * o);
          float d = length(g + o - f);
          if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
        }
        return d2 - d1;
      }
      float caustics(vec2 uv, float time){
        vec2 w = uv + 0.08 * vec2(sin(uv.y * 3.1 + time * 0.7), cos(uv.x * 2.7 - time * 0.6));
        float a = cellEdge(w * 5.0, time * 0.9);
        float b = cellEdge(w * 7.3 + 3.7, time * 1.1 + 2.0);
        float c = min(a, b);
        return pow(1.0 - smoothstep(0.0, 0.11, c), 3.0);
      }
      float rays(vec2 uv, float time){
        // shafts fan out from a point above the surface
        vec2 src = vec2(0.62, -0.55);
        vec2 d = uv - src;
        float ang = atan(d.x, d.y);
        float r = 0.0;
        r += 0.55 * pow(0.5 + 0.5 * sin(ang * 23.0 + time * 0.35), 7.0);
        r += 0.45 * pow(0.5 + 0.5 * sin(ang * 37.0 - time * 0.27 + 1.3), 9.0);
        r += 0.35 * pow(0.5 + 0.5 * sin(ang * 13.0 + time * 0.18 + 4.1), 5.0);
        float fall = exp(-uv.y * 1.9);
        return r * fall;
      }
      void main(){
        vec2 frag = gl_FragCoord.xy / res;
        vec2 uv = vec2(frag.x, 1.0 - frag.y);          // y = 0 at the top
        vec2 auv = vec2(uv.x * res.x / res.y, uv.y);   // aspect-correct

        float lit = 1.0 - deep * 0.75;
        float shafts = rays(vec2(uv.x * res.x / res.y * 0.6, uv.y), t) * 0.55 * lit;

        // rippled surface glow at the very top
        float surf = smoothstep(0.14, 0.0, uv.y) * (0.6 + 0.4 * caustics(auv * vec2(0.9, 3.0) + vec2(t * 0.02, 0.0), t * 1.3));
        surf *= lit;

        // caustics land on the reef and the sand
        float onReef = smoothstep(reefTop - 0.05, reefTop + 0.18, uv.y);
        float c = caustics(auv * 2.4 + vec2(0.0, t * 0.01), t) * onReef * (0.45 + 0.35 * lit);
        // a faint web through open water too
        c += caustics(auv * 1.6, t * 0.6) * 0.035 * lit * (1.0 - onReef);

        vec3 col = vec3(0.55, 0.85, 1.0) * shafts + vec3(0.75, 0.95, 1.0) * surf * 0.7 + vec3(0.7, 0.95, 1.0) * c * 0.38;
        float a = clamp(max(max(col.r, col.g), col.b), 0.0, 1.0);
        gl_FragColor = vec4(col, a);
      }`;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
    const v = sh(gl.VERTEX_SHADER, vs), fr = sh(gl.FRAGMENT_SHADER, fs);
    if (v && fr) {
      const prog = gl.createProgram();
      gl.attachShader(prog, v); gl.attachShader(prog, fr); gl.linkProgram(prog);
      if (gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        gl.useProgram(prog);
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(prog, 'p');
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        const U = n => gl.getUniformLocation(prog, n);
        const uRes = U('res'), uT = U('t'), uDeep = U('deep'), uReef = U('reefTop');
        glDraw = function (time, deep, reefTop) {
          const scale = 0.5;
          const w = Math.round(vw * scale), h = Math.round(vh * scale);
          if (lightCv.width !== w || lightCv.height !== h) { lightCv.width = w; lightCv.height = h; }
          gl.viewport(0, 0, w, h);
          gl.uniform2f(uRes, w, h);
          gl.uniform1f(uT, time);
          gl.uniform1f(uDeep, deep);
          gl.uniform1f(uReef, reefTop);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
        };
      }
    }
  }
  if (!glDraw) root.classList.add('ocean--nogl');

  // ---------------------------------------------------------------- depth
  // Scrolling is a dive: the water darkens and the reef settles lower while
  // there is text to read, then rises again for the closing sections.
  let deep = 0, reefShift = 0;
  function onScroll() {
    scrollY = window.scrollY;
    const max = Math.max(1, document.documentElement.scrollHeight - vh);
    const p = Math.min(1, scrollY / max);
    deep = Math.min(1, p * 1.25);
    const sink = Math.min(1, scrollY / (vh * 0.9));
    const rise = Math.max(0, (p - 0.86) / 0.14);
    reefShift = sink * (1 - rise);
    root.style.setProperty('--deep', deep.toFixed(3));
    root.style.setProperty('--sink', reefShift.toFixed(3));
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => { size(); onScroll(); });
  onScroll();

  function reefTopFrac() {
    const rect = nearLayer.getBoundingClientRect();
    return Math.min(1, Math.max(0, (rect.top + rect.height * 0.45) / vh));
  }

  let running = true;
  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running) { last = performance.now(); requestAnimationFrame(loop); }
  });

  let lastGl = 0;
  function loop(now) {
    if (!running) return;
    stepLife(now);
    if (glDraw && now - lastGl > 33) { glDraw(now / 1000, deep, reefTopFrac()); lastGl = now; }
    if (!reduceMotion) requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
