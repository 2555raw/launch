/* Seahorse builder.
 *
 * Draws the two MAREA characters as inline SVG. The body is not a hand-drawn
 * path: it is a spine (a smooth curve from the neck down into the curled tail)
 * with a width on each side, so the outline, the belly plates, the body rings
 * and the dorsal fin all follow the same curve and stay in proportion.
 *
 * Coordinates are for a 200 x 340 box with the seahorse facing right.
 * The partner is the same drawing, mirrored by the caller.
 */
(function () {
  'use strict';

  // Neck to tail tip. Widths are measured from the spine: `back` on the dorsal
  // side, `front` on the belly side (which becomes the inner side of the curl).
  const SPINE = [
    [95, 95], [83, 118], [76, 148], [80, 182], [90, 212], [95, 238],
    [89, 264], [82, 288], [86, 311], [102, 324], [119, 317], [123, 299],
    [113, 287], [101, 292], [102, 304]
  ];
  const BACK  = [16, 17, 18, 18, 16, 13, 11, 10, 9, 8, 7, 6, 5, 3.6, 1.6];
  const FRONT = [19, 33, 43, 41, 30, 18, 12, 10.5, 9, 8, 7, 6, 5, 3.6, 1.6];

  const PALETTES = {
    // Him: deep cobalt with a pale blue belly.
    blue: {
      back: '#0f2a78', mid: '#1e45c4', front: '#4f7df0', belly: '#b9cdfb',
      ring: '#0a1d57', fin: '#6f9bff', snout: '#1a3aa6', crown: '#3a64e0',
      cheek: '#7fa6ff', spot: '#d6e2ff'
    },
    // Her: warm sand-gold, the colour real seahorses often wear.
    gold: {
      back: '#b0561c', mid: '#e0892e', front: '#f4b04f', belly: '#ffe3a8',
      ring: '#7a3810', fin: '#ffc978', snout: '#c96d22', crown: '#f09a3a',
      cheek: '#ff8f7a', spot: '#fff1cf'
    }
  };

  function catmull(points, samplesPerSeg) {
    const out = [];
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)], p1 = points[i];
      const p2 = points[i + 1], p3 = points[Math.min(points.length - 1, i + 2)];
      for (let s = 0; s < samplesPerSeg; s++) {
        const t = s / samplesPerSeg, t2 = t * t, t3 = t2 * t;
        const f = (a, b, c, d) =>
          0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1]), i + t]);
      }
    }
    const last = points[points.length - 1];
    out.push([last[0], last[1], points.length - 1]);
    return out;
  }

  function lerpArr(arr, u) {
    const i = Math.min(arr.length - 2, Math.floor(u));
    const t = u - i;
    return arr[i] + (arr[i + 1] - arr[i]) * t;
  }

  // Smooth closed/open path through points using midpoint quadratics.
  function smoothPath(pts, close) {
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      d += `Q${pts[i][0].toFixed(1)},${pts[i][1].toFixed(1)} ${mx.toFixed(1)},${my.toFixed(1)}`;
    }
    const l = pts[pts.length - 1];
    d += `L${l[0].toFixed(1)},${l[1].toFixed(1)}`;
    return close ? d + 'Z' : d;
  }

  function build(opts) {
    const o = Object.assign({ palette: 'blue', id: 'sh', lashes: false }, opts);
    const P = PALETTES[o.palette];
    const id = o.id;
    const s = catmull(SPINE, 10);

    const F = s.map((p, i) => {
      const a = s[Math.max(0, i - 1)], b = s[Math.min(s.length - 1, i + 1)];
      let dx = b[0] - a[0], dy = b[1] - a[1];
      const len = Math.hypot(dx, dy) || 1;
      dx /= len; dy /= len;
      // Rotate direction by +90deg: (dx,dy) -> (dy,-dx). Heading down (0,1)
      // gives (1,0)... we want the back on screen-left, so use (-dy, dx).
      return { x: p[0], y: p[1], u: p[2], nx: -dy, ny: dx, back: lerpArr(BACK, p[2]), front: lerpArr(FRONT, p[2]) };
    });
    // With (-dy, dx) and heading down, n = (-1, 0): screen-left, the back.
    const side = (f, w) => [f.x + f.nx * w, f.y + f.ny * w];

    const backSide = F.map(f => side(f, f.back));
    const frontSide = F.map(f => side(f, -f.front));
    const outline = smoothPath(backSide.concat(frontSide.slice().reverse()), true);

    // Belly plates: a lighter band hugging the front edge down to the curl.
    const bellyEnd = Math.floor(F.length * 0.62);
    const bellyA = F.slice(0, bellyEnd).map(f => side(f, -f.front * 0.42));
    const bellyB = F.slice(0, bellyEnd).map(f => side(f, -f.front * 0.94)).reverse();
    const belly = smoothPath(bellyA.concat(bellyB), true);

    // Body rings: short arcs across the body, closer together down the tail.
    let rings = '';
    for (let i = 4; i < F.length - 8; i += (F[i].u < 5 ? 6 : 5)) {
      const f = F[i];
      const a = side(f, f.back * 0.96), b = side(f, -f.front * 0.96);
      const c = side(f, (f.back - f.front) * 0.5);
      const bend = 3 + f.front * 0.08;
      rings += `<path d="M${a[0].toFixed(1)},${a[1].toFixed(1)} Q${(c[0] + f.ny * 0 + (f.nx * 0)).toFixed(1)},${(c[1] + bend).toFixed(1)} ${b[0].toFixed(1)},${b[1].toFixed(1)}"/>`;
    }

    // Tubercles: small knobs along the back ridge.
    let knobs = '';
    for (let i = 3; i < F.length - 14; i += 5) {
      const f = F[i];
      const k = side(f, f.back + 1.2);
      knobs += `<circle cx="${k[0].toFixed(1)}" cy="${k[1].toFixed(1)}" r="${(1.6 + f.back * 0.06).toFixed(1)}"/>`;
    }

    // Speckles on the flank.
    let spots = '';
    let seed = o.palette === 'blue' ? 11 : 29;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 6; i < F.length * 0.66; i += 3) {
      const f = F[i];
      const w = (rnd() * 1.4 - 0.5) * f.back;
      const p = side(f, w);
      spots += `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${(0.7 + rnd() * 1.3).toFixed(1)}"/>`;
    }

    // Dorsal fin: a translucent fan on the back, rays following the spine.
    const f0 = Math.floor(F.length * 0.25), f1 = Math.floor(F.length * 0.40);
    const finBase = [], finTip = [];
    for (let i = f0; i <= f1; i++) {
      const f = F[i];
      const t = (i - f0) / (f1 - f0);
      const h = 14 + Math.sin(t * Math.PI) * 9;
      finBase.push(side(f, f.back - 1));
      finTip.push(side(f, f.back + h));
    }
    const fin = smoothPath(finBase.concat(finTip.slice().reverse()), true);
    let finRays = '';
    for (let i = 0; i < finBase.length; i += 2) {
      finRays += `<path d="M${finBase[i][0].toFixed(1)},${finBase[i][1].toFixed(1)} L${finTip[i][0].toFixed(1)},${finTip[i][1].toFixed(1)}"/>`;
    }
    const finCx = finBase[0][0], finCy = (finBase[0][1] + finBase[finBase.length - 1][1]) / 2;

    const lashes = o.lashes
      ? `<g class="sh-lash" stroke="${P.ring}" stroke-width="1.6" stroke-linecap="round" fill="none">
           <path d="M101,58 l-3,-6"/><path d="M105,56.5 l-1,-6.5"/><path d="M109.5,57 l1.5,-6"/>
         </g>`
      : '';

    return `
<svg class="seahorse seahorse--${o.palette}" viewBox="0 0 200 340" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="${id}-body" x1="0" y1="0" x2="1" y2="0.25">
      <stop offset="0" stop-color="${P.back}"/>
      <stop offset="0.55" stop-color="${P.mid}"/>
      <stop offset="1" stop-color="${P.front}"/>
    </linearGradient>
    <radialGradient id="${id}-sheen" cx="0.38" cy="0.22" r="0.55">
      <stop offset="0" stop-color="#fff" stop-opacity="0.38"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="${id}-belly" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${P.belly}" stop-opacity="0.95"/>
      <stop offset="1" stop-color="${P.belly}" stop-opacity="0.35"/>
    </linearGradient>
    <linearGradient id="${id}-fin" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${P.fin}" stop-opacity="0.2"/>
      <stop offset="1" stop-color="${P.fin}" stop-opacity="0.75"/>
    </linearGradient>
    <clipPath id="${id}-clip"><path d="${outline}"/></clipPath>
  </defs>

  <g class="sh-fin" style="transform-origin:${finCx.toFixed(1)}px ${finCy.toFixed(1)}px">
    <path d="${fin}" fill="url(#${id}-fin)"/>
    <g stroke="${P.fin}" stroke-opacity="0.8" stroke-width="0.9">${finRays}</g>
  </g>

  <path d="${outline}" fill="url(#${id}-body)"/>
  <g clip-path="url(#${id}-clip)">
    <path d="${belly}" fill="url(#${id}-belly)"/>
    <g fill="${P.spot}" opacity="0.45">${spots}</g>
    <g fill="none" stroke="${P.ring}" stroke-opacity="0.42" stroke-width="1.4" stroke-linecap="round">${rings}</g>
    <path d="${outline}" fill="url(#${id}-sheen)"/>
  </g>
  <g fill="${P.mid}">${knobs}</g>
  <path d="${outline}" fill="none" stroke="${P.ring}" stroke-opacity="0.55" stroke-width="1.2"/>

  <!-- pectoral fin, just behind the head -->
  <path class="sh-pec" d="M104,102 q10,-4 14,6 q-8,6 -14,2 z" fill="${P.fin}" fill-opacity="0.7"/>

  <!-- head -->
  <g class="sh-head" transform="rotate(9 98 86)">
    <path d="M114,62 C132,60 150,64 160,66 C165,66.5 167,70 166,76 C165,82 162,83 158,82 C146,80 132,84 116,88 Z" fill="${P.snout}"/>
    <path d="M160,66 C165,66.5 167,70 166,76 C165,82 162,83 158,82 C160,77 160,71 160,66 Z" fill="${P.ring}" opacity="0.5"/>
    <ellipse cx="100" cy="74" rx="25" ry="23" transform="rotate(-14 100 74)" fill="url(#${id}-body)"/>
    <path d="M78,82 C84,98 96,104 112,96 C104,104 88,106 80,96 Z" fill="${P.belly}" opacity="0.55"/>
    <ellipse cx="100" cy="74" rx="25" ry="23" transform="rotate(-14 100 74)" fill="url(#${id}-sheen)"/>
    <path d="M80,56 L78,40 L86,48 L90,34 L95,47 L102,38 L102,53 Z" fill="${P.crown}" stroke="${P.ring}" stroke-opacity="0.45" stroke-width="1"/>
    <ellipse cx="116" cy="84" rx="6.5" ry="3.6" fill="${P.cheek}" opacity="0.55"/>
    <g class="sh-eye">
      <circle cx="106" cy="68" r="9" fill="#fdfcf7"/>
      <circle cx="108" cy="69" r="6.4" fill="#07142e"/>
      <circle cx="110.3" cy="66.4" r="2.3" fill="#fff"/>
      <circle cx="106" cy="71.6" r="1" fill="#fff" opacity="0.8"/>
    </g>
    ${lashes}
  </g>
</svg>`;
  }

  window.Seahorse = { build };
})();
