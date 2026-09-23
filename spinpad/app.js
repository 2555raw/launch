/* Spinpad — the whole application.
 *
 * The product rule, and the reason the pad exists: a coin cannot be launched
 * until the wheel has been spun, and the cell it stops on — one body position,
 * one colour — names the asset the coin is paired with. That pairing is not
 * editable afterwards. It is enforced in four independent places on purpose:
 * the launch control ships disabled, the stage machine only reaches the
 * confirmation with a resolved spin, nothing anywhere writes to flow.spin a
 * second time, and launch() re-reads the spin at the last possible moment and
 * sends exactly that. Re-enabling a control from a console produces nothing.
 *
 * A chain is very much involved. Launching deploys a real ERC-20 on the network
 * in config.js, from the connected wallet, and opening a pool moves real funds.
 * Nothing on the page is an invented figure: what a row shows is what is on
 * chain, and what is not on chain yet says so.
 *
 * There is no pairing table in this file. It is in config.js, once, and the
 * wheel, the board, the desk and the bytes in the constructor
 * are all read out of it, so they cannot drift apart.
 */

(() => {
  'use strict';

  /* ---------- the table ---------- */

  const CFG = window.SPINPAD_CONFIG;
  const POSITIONS = CFG.positions;
  const COLOURS = CFG.colours;

  const HEX = {};
  COLOURS.forEach((c) => { HEX[c.id] = c.hex; });

  const posOf = (id) => POSITIONS.find((p) => p.id === id) || POSITIONS[0];
  const colOf = (id) => COLOURS.find((c) => c.id === id) || COLOURS[0];
  const assetOf = (color, position) => CFG.pairings[position + '.' + color];

  const ORDER = COLOURS.map((c) => c.id);

  /* Sixteen sectors, one per cell of the table, so every pairing is on the
     wheel exactly once and each is drawn one time in sixteen. Each position
     owns a quarter of the wheel; the colours step round by one from quarter to
     quarter, which is what stops four of a colour sitting together. */
  const SECTORS = [];
  POSITIONS.forEach((p, q) => {
    COLOURS.forEach((_, k) => {
      SECTORS.push({ position: p.id, color: COLOURS[(k + q) % COLOURS.length].id });
    });
  });

  const SEG = 360 / SECTORS.length;   // 22.5 degrees between nodes
  const EXPECTED = 100 / COLOURS.length;

  /* v4 because the shape changed again: v3 keyed the pairing by quadrant names
     that no longer exist. An old record read with this code names the wrong
     asset, so the key moves rather than the reader guessing. */
  const KEY = 'spinpad.coins.v4';

  /* ---------- marks ----------
   *
   * Every asset has a drawn mark, and a slot for its own logo file. Both are
   * rendered, one on top of the other, and the image only becomes visible once
   * it has actually loaded. An onerror handler was the obvious way to do this
   * and it did not work — sixteen missing files left sixteen broken images on
   * the board — so the fallback is the default state rather than a recovery
   * from one. A square with no logo file costs nothing.
   */
  const GLYPHS = {
    // the one sign money already has: nobody's trademark, and readable at 22px
    dollar:   'M12 3.5v17M15.8 7.6c-.7-1.2-2.1-2-3.8-2-2.3 0-4 1.3-4 3.2 0 4.4 8 2.4 8 6.8 0 1.9-1.8 3.3-4.1 3.3-1.9 0-3.5-.9-4.1-2.3',
    chevron:  'M5 15l7-7 7 7',
    bars:     'M5 8h14M5 12h14M5 16h9',
    orbit:    'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7M3.5 12c0-1.7 3.8-3 8.5-3s8.5 1.3 8.5 3-3.8 3-8.5 3-8.5-1.3-8.5-3',
    grid:     'M5 5h5.5v5.5H5zM13.5 5H19v5.5h-5.5zM5 13.5h5.5V19H5zM13.5 13.5H19V19h-5.5z',
    arc:      'M12 4.5v15M7 10a5 5 0 0 0 10 0M5.5 19.5h13',
    arrowbox: 'M4.5 6.5h15v11h-15zM8.5 12h7M13 9.5l2.5 2.5L13 14.5',
    stack:    'M4 15.5l8 3.5 8-3.5M4 11.5l8 3.5 8-3.5M4 7.5l8 3.5 8-3.5',
    loop:     'M9.5 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6M15.5 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
    play:     'M9 6.5l9 5.5-9 5.5z',
    spark:    'M12 4c3 4 5 5.5 5 9a5 5 0 0 1-10 0c0-3.5 2-5 5-9z',
    wave:     'M3.5 12h3l2-5.5 3 11 3-8.5 2 3h4',
    tiles:    'M12 4l3.6 3.6L12 11.2 8.4 7.6zM12 12.8l3.6 3.6L12 20l-3.6-3.6z',
    bolt:     'M13.5 3.5L6.5 13h4.5l-1 7.5 7-10h-4.5z',
    rail:     'M8.5 4.5v15M15.5 4.5v15M5 9h14M5 15h14',
    waves:    'M3.5 9.5c3-2 5 2 8.5 0s5.5-2 8.5 0M3.5 15c3-2 5 2 8.5 0s5.5-2 8.5 0',
    delta:    'M12 4l7.5 16L12 16.5 4.5 20z',
  };

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const drawn = (glyph, size) => `<svg class="sp-glyph" viewBox="0 0 24 24" width="${size}" height="${size}"
      fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
      aria-hidden="true"><path d="${GLYPHS[glyph] || GLYPHS.chevron}"/></svg>`;

  const mark = (asset, size) => {
    const glyph = typeof asset === 'string' ? asset : (asset && asset.glyph);
    const logo = typeof asset === 'string' ? '' : (asset && asset.logo);
    const svg = drawn(glyph, size);
    if (!logo) return svg;
    // the size is a custom property rather than a width, so the stylesheet can
    // give a real logo more of the disc than a drawn glyph needs
    return `<span class="sp-mark" style="--m:${size}px">${svg}`
      + `<img class="sp-logo" src="${esc(logo)}" alt="" width="${size}" height="${size}"></span>`;
  };

  /* A logo that has actually loaded turns its disc white and pushes the colour
     out to a ring. Brand logos come in their own colours, and a red Tesla on a
     red circle is not a logo, it is a red circle — but the colour is the whole
     code of this product, so it stays, as the ring.
   
     This listens in the capture phase because `load` on an <img> does not
     bubble. The old inline onload could only reach the <span> around the image;
     the disc is one level further out. */
  const LOGO_HOLDER = '.sp-cell-node, .sp-desk-mark, .sp-result-mark, .sp-launch-mark, .sp-confirm-mark';

  const wireLogos = () => {
    document.addEventListener('load', (e) => {
      const img = e.target;
      if (!img || !img.classList || !img.classList.contains('sp-logo')) return;
      if (!img.naturalWidth) return;             // a 0x0 response is not a logo
      img.parentNode.classList.add('has-logo');
      const disc = img.closest(LOGO_HOLDER);
      if (disc) disc.classList.add('has-logo');
    }, true);
  };

  /* ---------- helpers ---------- */

  const $ = (id) => document.getElementById(id);

  const rnd = (n) => {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] % n;           // 2^32 is a multiple of 16: no modulo bias
  };

  const num = (n) => n.toLocaleString('en-US');
  const short = (addr) => (addr ? addr.slice(0, 6) + '…' + addr.slice(-4) : '');

  // "LEFT HAND · YELLOW" — the one phrasing the result, the record and the
  // proof list all use, so what someone reads is the same string everywhere.
  const comboOf = (color, position) =>
    posOf(position).label.toUpperCase() + ' · ' + colOf(color).label.toUpperCase();

  const ago = (ts) => {
    const s = Math.max(0, (Date.now() - ts) / 1000);
    if (s < 60) return Math.floor(s) + 's ago';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    return Math.floor(s / 86400) + 'd ago';
  };

  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- store ---------- */

  let coins = [];

  const load = () => {
    try {
      const raw = localStorage.getItem(KEY);
      const parsed = raw === null ? [] : JSON.parse(raw);
      coins = Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      coins = [];                  // storage blocked or corrupt: run from memory
    }
  };

  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(coins.slice(0, 60))); } catch (e) { /* ignore */ }
  };

  const lerp = (a, b, t) => a + (b - a) * t;

  /* Shading needs three more colours per sphere, mixed from the one in the
     table so they cannot drift apart from it. Towards white for the lit side
     and the rim, towards black for the terminator. */
  const mix = (hex, towards, t) => {
    const n = parseInt(hex.slice(1), 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    const d = towards === 'white' ? [255, 255, 255] : [0, 0, 0];
    return '#' + c.map((v, i) => Math.round(lerp(v, d[i], t)).toString(16).padStart(2, '0')).join('');
  };

  /* ---------- the wheel ----------
   *
   * Sixteen nodes on a ring, a dashed cross under them, an arrow over the top.
   * Nothing about it is decorative: node i is SECTORS[i], the arrow comes to
   * rest inside one node's slice, and that node is the pairing.
   */

  const nodeAt = (i, r) => {
    const rad = (i * SEG + SEG / 2 - 90) * Math.PI / 180;
    return [100 + r * Math.cos(rad), 100 + r * Math.sin(rad)];
  };

  const drawWheel = (svg) => {
    if (!svg) return;

    /* The nodes are lit the way the hero's spheres are, from one source in the
       top left, so the two objects on the page read as being in the same room.
       The gradient ids carry the svg's own id: two wheels in one document with
       the same ids is invalid, and the second would silently paint itself with
       the first one's gradients. */
    const ns = svg.id || 'w';
    let out = '<defs>' + COLOURS.map((c) => `
      <radialGradient id="${ns}-${c.id}" cx="34%" cy="28%" r="72%">
        <stop offset="0%" stop-color="${mix(c.hex, 'white', 0.5)}"/>
        <stop offset="46%" stop-color="${c.hex}"/>
        <stop offset="100%" stop-color="${mix(c.hex, 'black', 0.3)}"/>
      </radialGradient>`).join('')
      + `<radialGradient id="${ns}-gloss" cx="34%" cy="24%" r="48%">
        <stop offset="0%" stop-color="#fff" stop-opacity=".88"/>
        <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
      </radialGradient></defs>`;

    out += '<circle class="sp-rim" cx="100" cy="100" r="95"/>';
    out += '<path class="sp-spoke" d="M100 8 V192 M8 100 H192 M35 35 L165 165 M165 35 L35 165"/>';

    SECTORS.forEach((sec, i) => {
      const [x, y] = nodeAt(i, 70);
      const as = assetOf(sec.color, sec.position);
      const cx = x.toFixed(2), cy = y.toFixed(2);
      out += `<g data-i="${i}"><title>${esc(comboOf(sec.color, sec.position))} → ${esc(as.name)}</title>`
        + `<ellipse class="sp-node-cast" cx="${cx}" cy="${(y + 3.4).toFixed(2)}" rx="11.5" ry="9"/>`
        + `<circle class="sp-node" data-i="${i}" cx="${cx}" cy="${cy}" r="13" fill="url(#${ns}-${sec.color})"/>`
        + `<circle class="sp-node-gloss" cx="${cx}" cy="${cy}" r="13" fill="url(#${ns}-gloss)"/>`
        + `<circle class="sp-node-ring" cx="${cx}" cy="${cy}" r="13"/></g>`;
    });

    /* A plain ring, and no word in it. The arrow pivots on this exact spot, so
       anything written here is read through the arrow's tail. */
    out += '<circle class="sp-hub" cx="100" cy="100" r="22"/>';
    svg.innerHTML = out;
  };

  /* The corner labels are written from the table rather than the markup: the
     quarter a position owns is decided by its index in config.js, and a label
     that disagreed with the geometry would be a lie about where the arrow is
     pointing. Quarter q is centred on q*90+45 degrees clockwise from twelve. */
  const CORNERS = ['sp-wheel-tr', 'sp-wheel-br', 'sp-wheel-bl', 'sp-wheel-tl'];

  const labelWheel = (wheel) => {
    if (!wheel) return;
    POSITIONS.forEach((p, q) => {
      const el = wheel.querySelector('.' + CORNERS[q % CORNERS.length]);
      if (el) el.textContent = p.label;
    });
  };

  const setArrow = (el, deg) => { if (el) el.style.setProperty('--rot', deg + 'deg'); };

  /* The hero wheel tilts a little under the cursor. It is the only motion on
     the page that is purely for feel, and it is the thing that makes a flat
     circle read as an object you could reach out and turn. */
  const wireHeroWheel = () => {
    const wheel = $('heroWheel');
    const svg = $('heroWheelSvg');
    const caption = $('heroCaption');
    if (!wheel || !svg) return;
    const face = wheel.querySelector('.sp-wheel-face');
    const rest = 'Sixteen outcomes. The wheel picks one.';

    const tilt = (e) => {
      if (!face || reduced()) return;
      const r = wheel.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5;
      const ny = (e.clientY - r.top) / r.height - 0.5;
      face.style.setProperty('--tiltY', (nx * 16).toFixed(2) + 'deg');
      face.style.setProperty('--tiltX', (-ny * 16).toFixed(2) + 'deg');
    };
    const level = () => {
      if (!face) return;
      face.style.setProperty('--tiltY', '0deg');
      face.style.setProperty('--tiltX', '0deg');
    };

    wheel.addEventListener('pointermove', tilt);
    wheel.addEventListener('pointerleave', () => {
      level();
      svg.querySelectorAll('.sp-node.is-hot').forEach((n) => n.classList.remove('is-hot'));
      if (caption) caption.textContent = rest;
    });

    svg.addEventListener('pointerover', (e) => {
      const g = e.target.closest ? e.target.closest('[data-i]') : null;
      if (!g) return;
      const sec = SECTORS[Number(g.dataset.i)];
      if (!sec) return;
      svg.querySelectorAll('.sp-node.is-hot').forEach((n) => n.classList.remove('is-hot'));
      const node = svg.querySelector(`.sp-node[data-i="${g.dataset.i}"]`);
      if (node) node.classList.add('is-hot');
      const as = assetOf(sec.color, sec.position);
      if (caption) caption.textContent = comboOf(sec.color, sec.position) + ' → ' + as.name;
    });
  };

  /* ---------- the room ----------
   *
   * A floor, the mat laid on it, and someone standing on the mat, drawn into one
   * fixed SVG behind the whole page. When the wheel resolves, the limb it named
   * reaches for the colour it drew — so the thing the product does is happening
   * in the background of every screen, not only on the one with the wheel.
   *
   * Nothing here measures the DOM. The old mat did, and it needed offsetLeft
   * walks, a ResizeObserver and hit-testing to survive a CSS 3D rotation. The
   * floor is projected arithmetically instead: one function maps a point on the
   * mat to a point on screen, and everything — spots, limbs, the figure — is
   * drawn from it. It cannot disagree with a layout because it does not have one.
   */

  const ROOM = {
    // where each limb is standing, as a column index that is tweened, not snapped
    at: {},
    target: {},
    spinning: false,
    raf: null,
    t0: 0,
  };
  /* The home pose is compact, not one limb per column: hands on the two far
     rows and feet on the two near ones, all inside the middle two columns.
     A limb per column spreads the figure corner to corner and it stops reading
     as a person at all. */
  const HOME = { leftHand: 1, rightHand: 2, leftFoot: 1, rightFoot: 2 };
  POSITIONS.forEach((p, i) => {
    ROOM.at[p.id] = HOME[p.id] !== undefined ? HOME[p.id] : (i % COLOURS.length);
    ROOM.target[p.id] = ROOM.at[p.id];
  });

  /* A floor seen from a standing height. `v` runs 0 at the far edge to 1 at the
     near one, and the near edge is wider — so the spacing has to compress toward
     the back the way perspective really does, not linearly. This is the
     projective interpolation that does that. */
  const project = (u, v, W, H) => {
    const farY = H * 0.42, nearY = H * 1.02;
    const farW = W * 0.30, nearW = W * 1.25;
    const r = farW / nearW;
    const t = v / (v + (1 - v) / r);
    const y = farY + (nearY - farY) * t;
    const w = farW + (nearW - farW) * t;
    return [W / 2 + (u - 0.5) * w, y, w / nearW];
  };

  /* Where the mat lies on the floor, four rows by four columns. It is not a
     fixed rectangle: on a wide screen it sits in the middle, but on a phone the
     same numbers give a tall thin mat with a stretched figure standing in the
     middle of the copy. A narrow viewport gets a wider, lower mat instead, so
     the figure stays a figure and stays out of the text. */
  const matBox = (W, H) => (W / H < 0.9
    ? { u0: 0.20, u1: 0.80, v0: 0.66, v1: 0.96 }
    : { u0: 0.30, u1: 0.70, v0: 0.34, v1: 0.88 });
  const matCorners = (W, H) => {
    const m = matBox(W, H);
    return [[m.u0, m.v0], [m.u1, m.v0], [m.u1, m.v1], [m.u0, m.v1]]
      .map(([u, v]) => project(u, v, W, H));
  };
  const cell = (row, col, W, H) => {
    const m = matBox(W, H);
    const u = m.u0 + (m.u1 - m.u0) * ((col + 0.5) / COLOURS.length);
    const v = m.v0 + (m.v1 - m.v0) * ((row + 0.5) / POSITIONS.length);
    return project(u, v, W, H);
  };

  // a quadratic with its control point pushed off the straight line, so a limb
  // reaching across the mat bends like a limb instead of pointing like a stick
  const limbPath = (ax, ay, tx, ty, bend) => {
    const mx = (ax + tx) / 2, my = (ay + ty) / 2;
    const dx = tx - ax, dy = ty - ay;
    const len = Math.hypot(dx, dy) || 1;
    return `M${ax.toFixed(1)} ${ay.toFixed(1)} Q${(mx - dy / len * bend).toFixed(1)} ${(my + dx / len * bend).toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)}`;
  };

  const drawRoom = () => {
    const svg = $('roomSvg');
    if (!svg) return;
    const W = svg.clientWidth || window.innerWidth;
    const H = svg.clientHeight || window.innerHeight;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

    let out = '';

    // floorboards, converging the way the mat does
    for (let i = 0; i <= 14; i++) {
      const u = i / 14;
      const [x0, y0] = project(u, 0, W, H);
      const [x1, y1] = project(u, 1, W, H);
      out += `<path class="sp-plank" d="M${x0.toFixed(1)} ${y0.toFixed(1)} L${x1.toFixed(1)} ${y1.toFixed(1)}"/>`;
    }
    for (let j = 1; j <= 6; j++) {
      const v = j / 6;
      const [xa, ya] = project(0, v, W, H);
      const [xb] = project(1, v, W, H);
      out += `<path class="sp-plank" d="M${xa.toFixed(1)} ${ya.toFixed(1)} H${xb.toFixed(1)}"/>`;
    }

    // the mat itself
    const corners = matCorners(W, H);
    const poly = (pts) => 'M' + pts.map((c) => c[0].toFixed(1) + ' ' + c[1].toFixed(1)).join(' L') + ' Z';
    // a contact shadow: the same quad, nudged down and out, so the mat sits on
    // the floor instead of being printed on it
    const cx0 = corners.reduce((a, c) => a + c[0], 0) / 4;
    const cy0 = corners.reduce((a, c) => a + c[1], 0) / 4;
    out += `<path class="sp-mat-shadow" d="${poly(corners.map(([x, y]) => [cx0 + (x - cx0) * 1.035, cy0 + (y - cy0) * 1.035 + H * 0.006]))}"/>`;
    out += `<path class="sp-mat-pad" d="${poly(corners)}"/>`;

    const live = flow.spin;
    POSITIONS.forEach((p, r) => COLOURS.forEach((c, k) => {
      const [x, y, sc] = cell(r, k, W, H);
      const on = live && live.position === p.id && live.color === c.id;
      out += `<ellipse class="sp-mat-spot${on ? ' sp-mat-spot-live' : ''}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}"`
        + ` rx="${(W * 0.034 * sc).toFixed(1)}" ry="${(W * 0.034 * sc * 0.44).toFixed(1)}" fill="${c.hex}"/>`;
    }));

    /* The figure. Four limbs are on the mat; the body stands over them.
       Shoulders and hips are lifted off the floor rather than sitting at the
       spots, which is the whole difference between a person leaning over a mat
       and four lines meeting at a point — the first attempt put the shoulders
       at the midpoint of the two hands and the arms disappeared into the neck. */
    const foot = (pid) => {
      const r = POSITIONS.findIndex((p) => p.id === pid);
      return cell(r, ROOM.at[pid], W, H);
    };
    const [lhX, lhY, lhS] = foot('leftHand'), [rhX, rhY, rhS] = foot('rightHand');
    const [lfX, lfY, lfS] = foot('leftFoot'), [rfX, rfY, rfS] = foot('rightFoot');

    /* How tall a standing body is here, in screen pixels, at the mat's scale.
       The figure is shorter relative to its mat on a phone: at full height its
       head reaches into the hero copy, and scenery does not get to do that. */
    const matH = corners[3][1] - corners[0][1];
    const lift = matH * (W / H < 0.9 ? 0.30 : 0.46);
    const lw = Math.max(2.5, W * 0.0034);
    const sway = ROOM.spinning ? Math.sin(Date.now() / 200) * lift * 0.055 : 0;

    // hips over the feet, shoulders over the hands and set back toward the hips,
    // so the torso leans the way someone reaching across a mat actually leans
    const hipX = (lfX + rfX) / 2 + sway * 0.4;
    const hipY = (lfY + rfY) / 2 - lift * ((lfS + rfS) / 2);
    const shX = (lhX + rhX) / 2 * 0.62 + hipX * 0.38 + sway;
    const shY = (lhY + rhY) / 2 - lift * 1.06 * ((lhS + rhS) / 2);
    const headR = Math.max(10, lift * 0.20);

    out += '<g class="sp-doll">';
    // torso first, so the limbs and the head sit on top of it
    out += `<path class="sp-body" stroke-width="${(lw * 2).toFixed(1)}"`
      + ` d="M${shX.toFixed(1)} ${shY.toFixed(1)} L${hipX.toFixed(1)} ${hipY.toFixed(1)}"/>`;

    [['leftHand', lhX, lhY, shX, shY, 1], ['rightHand', rhX, rhY, shX, shY, -1],
     ['leftFoot', lfX, lfY, hipX, hipY, 0.7], ['rightFoot', rfX, rfY, hipX, hipY, -0.7]]
      .forEach(([, tx, ty, ax, ay, dir]) => {
        out += `<path class="sp-limb" stroke-width="${lw.toFixed(1)}"`
          + ` d="${limbPath(ax, ay, tx, ty, lift * 0.16 * dir)}"/>`;
        out += `<circle class="sp-hand" cx="${tx.toFixed(1)}" cy="${ty.toFixed(1)}" r="${(lw * 1.4).toFixed(1)}"/>`;
      });

    // the head leans out past the shoulders, in the direction the torso leans
    const leanX = (shX - hipX) * 0.18;
    out += `<circle class="sp-head" stroke-width="${(lw * 1.2).toFixed(1)}"`
      + ` cx="${(shX + leanX).toFixed(1)}" cy="${(shY - headR * 1.25).toFixed(1)}" r="${headR.toFixed(1)}"/>`;
    out += '</g>';

    svg.innerHTML = out;
  };

  /* Moving a limb is a tween rather than a jump: the point of the thing is to
     watch someone reach for the colour the wheel gave, and a reach that happens
     between two frames is not a reach. */
  const roomStep = () => {
    let moving = false;
    POSITIONS.forEach((p) => {
      const d = ROOM.target[p.id] - ROOM.at[p.id];
      if (Math.abs(d) > 0.002) { ROOM.at[p.id] += d * 0.12; moving = true; }
      else ROOM.at[p.id] = ROOM.target[p.id];
    });
    drawRoom();
    if (moving || ROOM.spinning) ROOM.raf = requestAnimationFrame(roomStep);
    else ROOM.raf = null;
  };

  const roomKick = () => { if (!ROOM.raf) ROOM.raf = requestAnimationFrame(roomStep); };

  const roomSpinning = (on) => {
    if (reduced()) return;
    ROOM.spinning = on;
    if (on) roomKick(); else drawRoom();
  };

  /* Discarding a draft puts the room back: the spot stays lit and the limb
     stays reaching otherwise, advertising a pairing that no longer exists. */
  const roomHome = () => {
    POSITIONS.forEach((p) => { ROOM.target[p.id] = HOME[p.id]; });
    if (reduced()) { POSITIONS.forEach((p) => { ROOM.at[p.id] = HOME[p.id]; }); drawRoom(); return; }
    roomKick();
  };

  // the wheel said a position and a colour; that limb goes to that column
  const roomFollow = (sector) => {
    const col = COLOURS.findIndex((c) => c.id === sector.color);
    if (col < 0) return;
    ROOM.target[sector.position] = col;
    if (reduced()) { ROOM.at[sector.position] = col; drawRoom(); return; }
    roomKick();
  };

  /* ---------- the drifting sixteen ----------
   *
   * Every asset on the board, once each, floating behind the hero on a disc of
   * its own colour. Built from the pairing table like everything else, so the
   * first thing anyone sees cannot advertise a pairing the wheel will not give.
   *
   * The slots are written out rather than randomised. Random placement puts two
   * discs on top of each other about as often as not, and drops one behind the
   * headline where it fights the only words on the page. These are laid out
   * around the copy and the wheel: the big, solid ones hold the margins, the
   * small faint ones fill the middle distance.
   *
   * `d` is depth, 0 near to 1 far, and it sets size and opacity together. Blur
   * would be the obvious third, and it is the reason this does not use it: a
   * blurred element that animates repaints every frame, and sixteen of those is
   * how a landing page starts dropping frames on a laptop.
   */
  /* `z` is the zone, and it is what makes this survive a phone. A layout tuned
     for two columns has nothing to say about one: the hero grows to nearly
     twice the height, every percentage lands somewhere else, and a disc that
     sat in the gap between the copy and the wheel ends up on the headline.
     Narrow screens keep the edge chips and drop the rest. */
  const SLOTS = [
    // the margins, where a disc can be big and solid without covering anything
    { x: 3,  y: 24, d: 0.05, z: 'edge' }, { x: 5,  y: 72, d: 0.12, z: 'edge' },
    { x: 96, y: 20, d: 0.10, z: 'edge' }, { x: 98, y: 66, d: 0.18, z: 'edge' },
    { x: 24, y: 97, d: 0.28, z: 'edge' }, { x: 94, y: 84, d: 0.32, z: 'edge' },
    // the band above the copy, and the one below it
    { x: 31, y: 6,  d: 0.50, z: 'band' }, { x: 53, y: 9,  d: 0.62, z: 'band' },
    { x: 71, y: 4,  d: 0.45, z: 'band' }, { x: 39, y: 92, d: 0.58, z: 'band' },
    { x: 60, y: 97, d: 0.74, z: 'band' }, { x: 75, y: 90, d: 0.54, z: 'band' },
    // the gap between the copy and the wheel
    { x: 47, y: 44, d: 0.84, z: 'inner' }, { x: 44, y: 74, d: 0.70, z: 'inner' },
    // and two far enough back to pass behind the words without being read
    { x: 19, y: 42, d: 0.93, z: 'inner' }, { x: 91, y: 44, d: 0.88, z: 'inner' },
  ];

  const renderFloaters = () => {
    const box = $('drift');
    if (!box) return;

    // one chip per cell of the table, in reading order, so all sixteen appear
    const cells = [];
    POSITIONS.forEach((p) => COLOURS.forEach((c) => {
      cells.push({ colour: c.id, asset: assetOf(c.id, p.id) });
    }));

    box.innerHTML = cells.map((cell, i) => {
      const slot = SLOTS[i % SLOTS.length];
      const size = Math.round(lerp(94, 38, slot.d));
      const opacity = lerp(0.95, 0.16, slot.d).toFixed(2);
      // the far ones drift further and slower, which is backwards from life and
      // right on screen: a small slow mover reads as distant
      const rise = lerp(10, 26, slot.d).toFixed(0);
      const sway = lerp(4, 11, slot.d).toFixed(0);
      const tilt = lerp(3, 9, slot.d).toFixed(0);
      const dur = lerp(6.5, 13, slot.d).toFixed(1);
      const dir = i % 2 ? 1 : -1;
      /* The light is in the same quarter for all of them, because one light
         source is what makes a group of objects look like it is in one place.
         It only wanders a few points, so they are not stamped from one mould. */
      const lx = (26 + (i % 4) * 3).toFixed(0);
      const ly = (22 + ((i * 5) % 4) * 3).toFixed(0);
      const hex = HEX[cell.colour];
      return `<span class="sp-float" data-color="${cell.colour}" data-zone="${slot.z}" style="
          --x:${slot.x}%; --y:${slot.y}%; --s:${size}px; --o:${opacity};
          --c-hi:${mix(hex, 'white', 0.55)}; --c-lo:${mix(hex, 'black', 0.34)};
          --c-rim:${mix(hex, 'white', 0.3)}; --lx:${lx}%; --ly:${ly}%;
          --delay:${(0.06 * i).toFixed(2)}s; --dur:${dur}s; --offset:-${(0.7 * i).toFixed(2)}s;
          --riseA:${rise * dir}%; --riseB:${-rise * dir}%;
          --swayA:${sway * -dir}%; --swayB:${sway * dir}%;
          --tiltA:${tilt * dir}deg; --tiltB:${-tilt * dir}deg;">
        <span class="sp-float-in">
          <span class="sp-float-disc">
            <span class="sp-float-face">${mark(cell.asset, Math.round(size * 0.36))}</span>
            <span class="sp-float-gloss"></span>
          </span>
        </span>
      </span>`;
    }).join('');
  };

  /* Sixteen things moving for ever is exactly the case a pause control exists
     for. It is not decoration you can ignore if it bothers you. */
  const wireMotion = () => {
    const btn = $('motion');
    const hero = document.querySelector('.sp-hero');
    if (!btn || !hero) return;
    btn.addEventListener('click', () => {
      const still = hero.classList.toggle('is-still');
      btn.textContent = still ? 'Resume motion' : 'Pause motion';
      btn.setAttribute('aria-pressed', String(still));
    });
  };

  /* ---------- the board ----------
   *
   * The whole table at once: four positions down, four colours across. This is
   * the page's answer to "what can I get", and it is the same object the wheel
   * is drawn from.
   */

  const boardCell = (c, p) => {
    const as = assetOf(c.id, p.id);
    return `<button class="sp-cell" type="button" data-color="${c.id}" data-pos="${p.id}"
              aria-label="${esc(p.label)} on ${esc(c.label)} pairs with ${esc(as.name)}">
        <span class="sp-cell-node">${mark(as, 24)}</span>
        <b>${esc(as.name)}</b>
        <em>${esc(as.ticker)}</em>
      </button>`;
  };

  const renderBoardGrid = () => {
    const grid = $('boardGrid');
    if (!grid) return;
    let out = '<div class="sp-board-corner"></div>';
    COLOURS.forEach((c) => {
      out += `<div class="sp-board-head" data-color="${c.id}"><i class="sp-dot"></i>${esc(c.label)}</div>`;
    });
    POSITIONS.forEach((p) => {
      out += `<div class="sp-board-side">${esc(p.label)}</div>`;
      COLOURS.forEach((c) => { out += boardCell(c, p); });
    });
    grid.innerHTML = out;
  };

  const readCell = (color, position) => {
    const box = $('boardRead');
    if (!box) return;
    const as = assetOf(color, position);
    box.hidden = false;
    box.dataset.color = color;
    box.innerHTML = `<span class="sp-cell-node">${mark(as, 30)}</span>
      <div>
        <p class="sp-kicker sp-kicker-sm">${esc(comboOf(color, position))}</p>
        <h3>${esc(as.name)} <em style="font-style:normal;color:var(--muted);font-size:15px">${esc(as.ticker)}</em></h3>
        <p>One of sixteen cells, so the wheel reaches it one time in sixteen. Land here and
        ${esc(as.name)} is written into your coin as its pairing — a name in the contract, not a
        price feed, and nothing to do with the company itself.</p>
      </div>`;
    document.querySelectorAll('.sp-cell').forEach((b) => {
      b.classList.toggle('is-on', b.dataset.color === color && b.dataset.pos === position);
    });
  };

  /* The asset desk: the same sixteen, written out the other way round — one
     card per asset, each saying the single route that reaches it. */
  const renderDesk = () => {
    const el = $('matrix');
    if (!el) return;
    el.innerHTML = POSITIONS.map((p) => COLOURS.map((c) => {
      const as = assetOf(c.id, p.id);
      return `
        <article class="sp-desk-card" data-color="${c.id}" data-pos="${p.id}" tabindex="0"
                 aria-label="${esc(as.name)} — ${esc(p.label)} on ${esc(c.label)}">
          <span class="sp-desk-mark">${mark(as, 26)}</span>
          <div class="sp-desk-body">
            <b>${esc(as.name)}</b>
            <em>${esc(as.ticker)}</em>
          </div>
          <p class="sp-desk-combo"><i class="sp-dot"></i>${esc(comboOf(c.id, p.id))}</p>
        </article>`;
    }).join('')).join('');
  };

  /* ---------- metrics ---------- */

  const tally = () => {
    const counts = {};
    ORDER.forEach((k) => { counts[k] = 0; });
    coins.forEach((c) => { if (counts[c.color] !== undefined) counts[c.color]++; });
    return counts;
  };

  const renderKpis = () => {
    const box = $('kpis');
    if (!box) return;
    const counts = tally();
    const total = coins.length;
    const shares = ORDER.map((k) => ({ k, pct: total ? counts[k] / total * 100 : 0 }));
    const most = shares.slice().sort((a, b) => b.pct - a.pct)[0];
    const wide = shares.slice().sort((a, b) => Math.abs(b.pct - EXPECTED) - Math.abs(a.pct - EXPECTED))[0];
    const gap = wide.pct - EXPECTED;

    const tiles = [
      ['Launches recorded', num(total), total === 1 ? 'coin' : 'coins'],
      ['Pools opened', num(coins.filter((c) => c.poolTx).length), 'on ' + CFG.chain.name],
      ['Most drawn colour', total ? colOf(most.k).label : 'None yet', total ? most.pct.toFixed(1) + '%' : ''],
      ['Widest deviation', total ? (gap >= 0 ? '+' : '') + gap.toFixed(1) : 'None yet', total ? 'pts · ' + colOf(wide.k).label : ''],
    ];

    box.innerHTML = tiles.map(([label, value, note]) => `
      <dl class="sp-kpi">
        <dt>${esc(label)}</dt>
        <dd>${esc(value)}${note ? `<small>${esc(note)}</small>` : ''}</dd>
      </dl>`).join('');
  };

  const renderMeter = () => {
    const box = $('meter');
    if (!box) return;
    const counts = tally();
    const total = coins.length;
    const max = Math.max(EXPECTED + 6, ...ORDER.map((k) => (total ? counts[k] / total * 100 : 0)));

    box.innerHTML = ORDER.map((k, i) => {
      const f = colOf(k);
      const pct = total ? counts[k] / total * 100 : 0;
      const gap = pct - EXPECTED;
      const tip = `${f.label}: ${counts[k]} of ${total} launches, ${pct.toFixed(1)}% against an expected ${EXPECTED}% (${gap >= 0 ? '+' : ''}${gap.toFixed(1)} pts)`;
      return `
        <div class="sp-meter-row" data-color="${k}" title="${esc(tip)}">
          <span class="sp-meter-name"><i class="sp-dot"></i>${esc(f.label)}</span>
          <span class="sp-meter-track">
            <span class="sp-meter-fill" style="width:${(pct / max * 100).toFixed(2)}%"></span>
            <span class="sp-meter-ref" style="left:${(EXPECTED / max * 100).toFixed(2)}%">${i === 0 ? `<span>expected ${EXPECTED}%</span>` : ''}</span>
          </span>
          <span class="sp-meter-val">${pct.toFixed(1)}%<small>${counts[k]} of ${total}</small></span>
        </div>`;
    }).join('');

    const note = $('meterNote');
    if (note) {
      note.textContent = total
        ? `Based on ${total} launch${total === 1 ? '' : 'es'} recorded in this browser. A short record wanders from ${EXPECTED}% freely; the wheel itself is flat by construction.`
        : `No launches recorded yet. Each colour holds four of the wheel’s ${SECTORS.length} nodes.`;
    }
  };

  /* ---------- proof ----------
   *
   * Real launches only. Every row here is a contract that exists, with the
   * transaction that made it; nothing is seeded and nothing is invented.
   */

  const view = { filter: 'all', sort: 'new', q: '' };

  const visible = () => {
    let list = coins.slice();
    if (view.filter !== 'all') list = list.filter((c) => c.color === view.filter);
    if (view.q) {
      const q = view.q.toLowerCase();
      list = list.filter((c) => (c.name + ' ' + c.ticker).toLowerCase().includes(q));
    }
    const by = {
      new: (a, b) => b.ts - a.ts,
      supply: (a, b) => Number(BigInt(b.supply) - BigInt(a.supply)),
      name: (a, b) => a.name.localeCompare(b.name),
    };
    return list.sort(by[view.sort] || by.new);
  };

  const launchRow = (c) => {
    const as = assetOf(c.color, c.position);
    const size = 24;
    const face = c.image
      ? `<span class="sp-mark" style="--m:${size}px">${drawn(as.glyph, size)}`
        + `<img class="sp-logo" src="${esc(c.image)}" alt="" width="${size}" height="${size}"></span>`
      : mark(as, size);
    return `
      <div class="sp-launch" data-color="${c.color}">
        <span class="sp-launch-mark">${face}</span>
        <span class="sp-launch-name"><b>${esc(c.name)}</b><br><em>${esc(c.ticker)}</em></span>
        <span class="sp-launch-pair"><b>${esc(as.name)}</b><em>${esc(comboOf(c.color, c.position))}</em></span>
        <span class="sp-launch-time">${ago(c.ts)}</span>
        <span class="sp-launch-tx">${c.txHash
          ? `<a href="${esc(SpinpadChain.explorerTx(c.txHash))}" target="_blank" rel="noopener noreferrer">${esc(short(c.txHash))}</a>`
          : '<span>pending</span>'}</span>
      </div>`;
  };

  const renderTicker = () => {
    const track = $('tickerTrack');
    if (!track) return;
    const band = track.closest('.sp-ticker');
    const last = coins.slice().sort((a, b) => b.ts - a.ts).slice(0, 10);
    // an empty band is two hairlines and a gap, which reads as a broken element
    if (band) band.hidden = last.length === 0;
    if (!last.length) { track.innerHTML = ''; return; }
    const one = last.map((c) => {
      const as = assetOf(c.color, c.position);
      return `<span class="sp-tick" data-color="${c.color}"><i class="sp-dot"></i><b>${esc(c.ticker)}</b> landed on ${esc(comboOf(c.color, c.position).toLowerCase())} → ${esc(as.name)} · ${ago(c.ts)}</span>`;
    }).join('');
    track.innerHTML = one + one;   // two copies: the marquee loops at -50%
  };

  const renderProof = () => {
    const list = visible();
    const grid = $('grid');
    if (grid) {
      grid.innerHTML = list.map(launchRow).join('');
      grid.hidden = list.length === 0;   // an empty list is a stray hairline
    }
    const empty = $('empty');
    if (empty) empty.hidden = list.length > 0;
    const count = $('count');
    if (count) count.textContent = `Showing ${list.length} of ${coins.length} launched from this browser`;
    renderTicker();
    renderKpis();
    renderMeter();
  };

  /* ---------- the pad ---------- */

  const pad = $('pad');
  /* Five stages: 1 create, 2 spin, 3 result, 4 confirm, 5 done. flow.spin is
     written exactly once, in resolveSpin, and read everywhere else. */
  const flow = { step: 1, draft: null, spin: null, spinning: false, rot: 0, sending: false, minted: null };

  /* What the chain said about the addresses in config.js. Nothing opens a pool
     against an entry that is not in here with ok: true. */
  let quoteOk = null;
  let routerOk = null;

  const setStep = (n) => {
    flow.step = n;
    if (pad) pad.dataset.step = String(n);

    const steps = $('steps');
    if (steps) {
      [...steps.children].forEach((li) => {
        const s = Number(li.dataset.step);
        // stage 3 (the result) and stage 4 (the confirmation) share step 03/04
        // on the rail: the rail has four beats, the pad has five screens.
        const beat = n >= 5 ? 5 : n;
        li.classList.toggle('is-on', s === beat);
        li.classList.toggle('is-done', s < beat);
      });
    }

    $('fields').disabled = n > 1;
    $('toSpin').hidden = n > 1;
    $('backToForm').hidden = n !== 2 || flow.spinning;
    $('discard').hidden = n !== 4;
    $('spin').disabled = n !== 2 || flow.spinning || !!flow.spin;
    $('launchBtn').disabled = n !== 4 || !flow.spin;
    $('spinCount').textContent = 'Spins ' + (flow.spin ? 1 : 0) + '/1';
  };

  const err = (id, msg) => {
    const box = document.querySelector(`.sp-err[data-for="${id}"]`);
    if (!box) return !msg;
    box.textContent = msg || '';
    box.classList.toggle('is-on', !!msg);
    $(id).setAttribute('aria-invalid', msg ? 'true' : 'false');
    return !msg;
  };

  const readForm = () => {
    const name = $('fName').value.trim();
    const ticker = $('fTicker').value.trim().toUpperCase();
    const supply = Number($('fSupply').value.replace(/\D/g, ''));
    const desc = $('fDesc').value.trim();
    const image = $('fImage') ? $('fImage').value.trim() : '';

    let ok = true;
    ok = err('fName', name.length < 2 || name.length > 32 ? 'Between 2 and 32 characters.' : '') && ok;
    ok = err('fTicker', /^[A-Z0-9]{2,8}$/.test(ticker) ? '' : '2 to 8 letters or digits, no spaces.') && ok;
    ok = err('fSupply', !supply || supply < 1000 || supply > 1e12 ? 'Between 1,000 and 1,000,000,000,000.' : '') && ok;
    ok = err('fDesc', desc.length > 140 ? '140 characters maximum.' : '') && ok;
    // An http:// image on an https page is blocked by the browser anyway, and a
    // javascript: or data: URL here would be an injection with extra steps.
    ok = err('fImage', !image || /^https:\/\/[^\s"'<>]+$/i.test(image) ? '' : 'Must be an https:// link, or left empty.') && ok;
    if (coins.some((c) => c.ticker === ticker)) ok = err('fTicker', 'That ticker is already on the board.') && ok;

    return ok ? { name, ticker, supply, desc, image } : null;
  };

  // The confirmation mirrors the draft, and the pairing rows read from
  // flow.spin — the same object launch() encodes — rather than from anything
  // the form can reach.
  const renderSummary = () => {
    const ticker = ($('fTicker').value.trim().toUpperCase() || 'TICKER');
    const name = $('fName').value.trim() || 'Your coin';
    const supply = Number($('fSupply').value.replace(/\D/g, ''));
    const f = flow.spin ? colOf(flow.spin.color) : null;
    const as = flow.spin ? assetOf(flow.spin.color, flow.spin.position) : null;

    $('preview').dataset.color = flow.spin ? flow.spin.color : 'none';
    $('pvTicker').textContent = ticker;
    $('pvAsset').textContent = as ? as.ticker : 'UNPAIRED';

    const sub = ticker + ' · ' + (as ? 'paired with ' + as.name : 'not yet paired');
    $('sumName').textContent = name;
    $('sumSub').textContent = sub;

    /* One set of rows, written to both panels: the live one beside the form
       and the one on the confirmation. Two copies of this list is two chances
       for the screen someone reads to disagree with the screen that launches. */
    const rows = [
      ['Pairing', as ? as.name + ' (' + as.ticker + ')' : 'Decided by the wheel', false],
      ['Spin result', flow.spin ? comboOf(flow.spin.color, flow.spin.position) : 'Not spun yet', false],
      ['Colour', f ? f.label : 'Decided by the wheel', false],
      ['Position', flow.spin ? posOf(flow.spin.position).label : 'Decided by the wheel', false],
      ['Total supply', supply ? num(supply) : 'Not set', true],
      ['Spins used', (flow.spin ? 1 : 0) + ' of 1', true],
      ['Network', CFG.chain.name, false],
    ].map(([k, v, mono]) => `<div><dt>${esc(k)}</dt><dd${mono ? ' class="is-mono"' : ''}>${esc(v)}</dd></div>`).join('');

    $('sumRows').innerHTML = rows;
    if ($('liveRows')) {
      $('liveRows').innerHTML = rows;
      $('liveName').textContent = name;
      $('liveSub').textContent = sub;
      $('orbTicker').textContent = ticker;
      $('orbTicker').nextElementSibling.textContent = as ? as.ticker : 'unpaired';
    }
  };

  const say = (msg) => { $('status').textContent = msg; };

  const doSpin = () => {
    if (flow.step !== 2 || flow.spin || flow.spinning) return;
    flow.spinning = true;
    setStep(2);
    say('Spinning. The wheel decides the pairing, not you.');
    roomSpinning(true);

    const i = rnd(SECTORS.length);
    const centre = i * SEG + SEG / 2;
    const jitter = (rnd(1000) / 1000 - 0.5) * (SEG - 6);
    const turns = 5 + rnd(3);
    const delta = (((centre + jitter) - flow.rot) % 360 + 360) % 360;
    flow.rot += turns * 360 + delta;

    const needle = $('needle');
    setArrow(needle, flow.rot);

    const done = () => {
      needle.removeEventListener('transitionend', done);
      clearTimeout(guard);
      resolveSpin(SECTORS[i], i);
    };
    needle.addEventListener('transitionend', done);
    // transitionend never fires on a tab backgrounded mid-spin
    const guard = setTimeout(done, 5200);
  };

  /* The one place flow.spin is ever written. Everything downstream — the
     result screen, the confirmation, the constructor arguments, the stored
     record — reads this object, so the pairing shown and the pairing launched
     are the same value by construction rather than by agreement. */
  const resolveSpin = (sector, i) => {
    if (flow.spin) return;
    flow.spinning = false;
    flow.spin = sector;

    const f = colOf(sector.color);
    const p = posOf(sector.position);
    const as = assetOf(sector.color, sector.position);

    const res = $('result');
    res.hidden = false;
    res.dataset.color = sector.color;
    $('resDot').dataset.color = sector.color;
    $('resDot').innerHTML = mark(as, 34);
    $('resLimb').textContent = comboOf(sector.color, sector.position);
    $('resColor').textContent = as.name;
    $('resLine').textContent = 'This goes into the contract at launch and cannot be changed — '
      + 'by you, by us, or by this page. There is no reroll.';

    $('assetSlot').dataset.color = sector.color;
    $('assetName').textContent = as.name + ' · ' + as.ticker;
    $('assetHint').textContent = 'Locked';

    const dial = $('dial');
    if (dial) {
      dial.querySelectorAll('.sp-node.is-hot').forEach((n) => n.classList.remove('is-hot'));
      const node = dial.querySelector(`.sp-node[data-i="${i}"]`);
      if (node) node.classList.add('is-hot');
    }

    say(`${p.label} on ${f.label.toLowerCase()} — ${as.name}. The pairing is locked.`);

    roomSpinning(false);
    roomFollow(sector);

    setStep(3);
    renderSummary();
  };

  /* ---------- launching, for real ----------
   *
   * Two transactions, never one. The deployment creates the coin and records
   * the draw; opening the pool is a separate, separately confirmed step. That
   * ordering is deliberate: it lets someone see their contract exist on the
   * explorer before they put anything into a pool, and a failed pool leaves a
   * perfectly good token rather than a half-finished launch.
   */
  const launch = async () => {
    // The rule, checked once more at the last possible moment.
    if (!flow.spin || !flow.draft || flow.step !== 4) {
      say('No spin on record. Nothing launches here without one.');
      setStep(flow.step);
      return;
    }
    if (flow.sending) return;

    const f = colOf(flow.spin.color);
    const p = posOf(flow.spin.position);
    const as = assetOf(flow.spin.color, flow.spin.position);

    if (!SpinpadChain.hasWallet()) {
      say('No wallet in this browser. Spinpad deploys a real contract, so it needs one.');
      return;
    }
    if (!SpinpadChain.state.account) {
      say('Connect a wallet first — the contract is deployed from your address.');
      return;
    }
    if (!SpinpadChain.onChain()) {
      say(`Wrong network. Switch to ${CFG.chain.name} before launching.`);
      return;
    }
    flow.sending = true;
    $('launchBtn').disabled = true;
    say('Confirm the deployment in your wallet. This costs gas and cannot be undone.');

    const supplyWei = BigInt(flow.draft.supply) * 10n ** 18n;
    let hash;
    try {
      hash = await SpinpadChain.deploy({
        name: flow.draft.name,
        ticker: flow.draft.ticker,
        supplyWei,
        assetName: as.name,
        assetTicker: as.ticker,
        colour: f.label,
        position: p.label,
      });
    } catch (e) {
      flow.sending = false;
      setStep(4);
      say(e && e.code === 4001 ? 'Rejected in the wallet. Nothing was sent.'
        : 'The wallet refused the transaction: ' + ((e && e.message) || 'unknown error'));
      return;
    }

    say('Sent. Waiting for it to be mined — this usually takes a few seconds.');
    let receipt;
    try {
      receipt = await SpinpadChain.waitForReceipt(hash, (i) => {
        if (i && i % 5 === 0) say(`Still waiting (${i * 2}s). The hash is ${hash.slice(0, 10)}…`);
      });
    } catch (e) {
      flow.sending = false;
      setStep(4);
      say((e && e.message) || 'Could not confirm the transaction.');
      return;
    }

    const coin = {
      id: hash,
      name: flow.draft.name,
      ticker: flow.draft.ticker,
      supply: supplyWei.toString(),
      desc: flow.draft.desc,
      image: flow.draft.image || '',
      color: flow.spin.color,
      position: flow.spin.position,
      address: receipt.contractAddress,
      txHash: hash,
      poolTx: null,
      creator: SpinpadChain.state.account,
      chainId: CFG.chain.id,
      ts: Date.now(),
    };

    coins.unshift(coin);
    save();
    renderProof();
    flow.sending = false;
    setStep(5);
    say('Deployed. The pairing is written into the contract and cannot be changed.');
    showRecord(coin);
  };

  /* The first pool: approve the router for both sides, then add liquidity.
     addLiquidity pulls both tokens with transferFrom, so both need allowances —
     approving only the coin is why an earlier version reverted with
     TRANSFER_FROM_FAILED. The amount of the pair token is whatever the person
     types; the pad never picks a number that moves someone's money. */
  const openPool = async () => {
    const coin = flow.minted;
    if (!coin || !coin.address) return;
    const note = $('poolNote');
    const quote = CFG.quote;

    if (!CFG.router.address) { note.textContent = 'No router in config.js, so no pool can be opened.'; return; }
    if (!routerOk || !routerOk.ok) { note.textContent = 'The router has not verified: ' + (routerOk ? routerOk.reason : 'not checked') + '.'; return; }
    if (!quoteOk || !quoteOk.ok) { note.textContent = quote.ticker + ' has not verified: ' + (quoteOk ? quoteOk.reason : 'not checked') + '.'; return; }
    if (!SpinpadChain.state.account) { note.textContent = 'Connect a wallet first.'; return; }
    /* The network can change between deploying and pooling, and every address
       here belongs to one chain. Without this, an approval and a liquidity call
       go out against whatever happens to live at those addresses elsewhere. */
    if (!SpinpadChain.onChain()) {
      note.textContent = 'Wrong network. Switch back to ' + CFG.chain.name + ' before opening the pool.';
      return;
    }

    const typed = ($('poolAmount').value || '').trim();
    if (!/^\d+(\.\d+)?$/.test(typed) || Number(typed) <= 0) {
      note.textContent = 'Type how much ' + quote.ticker + ' to put in, as a plain number.';
      return;
    }

    // scale by the decimals the chain reported, not the ones the config claims
    const dec = Number(quoteOk.decimals);
    const [whole, frac = ''] = typed.split('.');
    const tokenAmount = BigInt(whole + (frac + '0'.repeat(dec)).slice(0, dec));
    if (tokenAmount <= 0n) {
      note.textContent = quote.ticker + ' has ' + dec + ' decimals, so that amount rounds to nothing. '
        + 'Type a larger one.';
      return;
    }

    const coinAmount = (BigInt(coin.supply) * BigInt(Math.round(CFG.liquidity.supplyShare * 1000))) / 1000n;
    if (coinAmount <= 0n) { note.textContent = 'Nothing of the coin to put in.'; return; }

    $('poolBtn').disabled = true;
    try {
      note.textContent = 'Approving the coin for the router… confirm in your wallet.';
      await SpinpadChain.ensureAllowance(coin.address, CFG.router.address, coinAmount, (step) => {
        note.textContent = step === 'reset'
          ? 'Clearing the old allowance on the coin first…'
          : 'Approving the coin for the router… confirm in your wallet.';
      });

      note.textContent = 'Now approving your ' + quote.ticker + '… confirm in your wallet.';
      await SpinpadChain.ensureAllowance(quote.address, CFG.router.address, tokenAmount, (step) => {
        note.textContent = step === 'reset'
          ? 'Clearing the old ' + quote.ticker + ' allowance first…'
          : 'Now approving your ' + quote.ticker + '… confirm in your wallet.';
      });

      note.textContent = 'Approved. Confirm the liquidity itself — this is the one that moves your '
        + quote.ticker + '.';
      const poolTx = await SpinpadChain.addLiquidity({
        coin: coin.address,
        token: quote.address,
        coinAmount,
        tokenAmount,
      });
      await SpinpadChain.waitForReceipt(poolTx);

      coin.poolTx = poolTx;
      save();
      renderProof();
      note.innerHTML = 'Pool open. <a href="' + esc(SpinpadChain.explorerTx(poolTx))
        + '" target="_blank" rel="noopener noreferrer">See it on the explorer</a>.';
    } catch (e) {
      note.textContent = e && e.code === 4001 ? 'Rejected in the wallet. Nothing moved.'
        : 'The pool did not open: ' + ((e && e.message) || 'unknown error') + '. The coin is fine.';
      $('poolBtn').disabled = false;
    }
  };

  const showRecord = (coin) => {
    flow.minted = coin;
    const f = colOf(coin.color);
    const p = posOf(coin.position);
    const as = assetOf(coin.color, coin.position);
    const t = $('ticket');
    t.hidden = false;
    t.dataset.color = coin.color;
    $('tkId').textContent = short(coin.address || coin.txHash);
    $('tkAvatar').innerHTML = mark(as, 30);
    $('tkAvatar').dataset.color = coin.color;
    $('tkName').textContent = coin.name;
    $('tkTicker').textContent = coin.ticker;
    $('tkDesc').textContent = coin.desc || '';
    $('tkDesc').hidden = !coin.desc;

    const rows = [
      ['Pairing', as.name + ' (' + as.ticker + ')', false],
      ['Spin result', comboOf(coin.color, coin.position), false],
      ['Colour', f.label, false],
      ['Position', p.label, false],
      ['Total supply', num(Number(BigInt(coin.supply) / (10n ** 18n))), true],
      ['Network', CFG.chain.name, false],
    ];
    $('tkRows').innerHTML = rows
      .map(([k, v, mono]) => `<div><dt>${esc(k)}</dt><dd${mono ? ' class="is-mono"' : ''}>${esc(v)}</dd></div>`).join('')
      + (coin.address ? `<div><dt>Contract</dt><dd class="is-mono"><a href="${esc(SpinpadChain.explorerAddress(coin.address))}" target="_blank" rel="noopener noreferrer">${esc(short(coin.address))}</a></dd></div>` : '')
      + (coin.txHash ? `<div><dt>Transaction</dt><dd class="is-mono"><a href="${esc(SpinpadChain.explorerTx(coin.txHash))}" target="_blank" rel="noopener noreferrer">${esc(short(coin.txHash))}</a></dd></div>` : '');

    $('tkNote').textContent =
      `${coin.name} is paired with ${as.name} because the wheel stopped on ${comboOf(coin.color, coin.position).toLowerCase()}, `
      + 'and that is written into the contract where nothing — including this page — can change it. '
      + `It is a name on a token: nothing here tracks ${as.name}’s share price, and ${as.name} has no `
      + 'connection to it.';

    if ($('poolAsset')) {
      $('poolAsset').textContent = CFG.quote.ticker;
      const pa = $('poolAssetB'); if (pa) pa.textContent = CFG.quote.ticker;
      $('poolShare').textContent = Math.round(CFG.liquidity.supplyShare * 100) + '%';
      $('poolNote').textContent = coin.poolTx
        ? 'Pool already open.'
        : 'Optional, and it is where real money moves. Three confirmations: two approvals, then the liquidity itself.';
      $('poolBtn').disabled = !!coin.poolTx;
    }
    $('tkCopy').textContent = 'Copy record';
    t.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  const resetFlow = () => {
    flow.draft = null;
    flow.spin = null;
    flow.spinning = false;
    flow.minted = null;
    $('form').reset();
    $('fSupply').value = '1,000,000,000';
    $('descCount').textContent = '0/140';
    ['fName', 'fTicker', 'fSupply', 'fDesc', 'fImage'].forEach((id) => { if ($(id)) err(id, ''); });
    $('result').hidden = true;
    $('ticket').hidden = true;
    $('assetSlot').dataset.color = 'none';
    $('assetName').textContent = 'Decided by the wheel';
    $('assetHint').textContent = 'You cannot pick this';
    const dial = $('dial');
    if (dial) dial.querySelectorAll('.sp-node.is-hot').forEach((n) => n.classList.remove('is-hot'));
    say('Fill in the details, then the wheel decides the rest.');
    setStep(1);
    renderSummary();
    roomHome();
  };

  /* ---------- the wallet ---------- */

  /* The note in the form says the same thing as the header, in the place where
     it is about to matter. It is deliberately not a blocker: a wallet is needed
     to launch, not to spin, and telling someone to connect before they have
     even seen the wheel is asking for a signature to look at a website. */
  const renderWalletNote = () => {
    const box = $('walletNote'), text = $('walletNoteText'), btn = $('connectInline');
    if (!box || !text || !btn) return;
    const acct = SpinpadChain.state.account;
    const ready = !!acct && SpinpadChain.onChain();
    box.classList.toggle('is-on', ready);
    btn.hidden = !!acct;
    if (!SpinpadChain.hasWallet()) {
      text.innerHTML = '<b>No wallet in this browser.</b> You can still fill this in and spin \u2014 '
        + 'the wheel needs nothing. Launching does: it deploys a contract on ' + esc(CFG.chain.name)
        + ' from your own address.';
      btn.hidden = true;
      return;
    }
    if (!acct) {
      text.innerHTML = '<b>A wallet is needed to launch, not to spin.</b> Fill this in and spin '
        + 'whenever you like. The deployment is a transaction from your own address, and nothing is '
        + 'sent until you confirm it in the wallet.';
      return;
    }
    text.innerHTML = ready
      ? '<b>Connected as ' + esc(short(acct)) + '.</b> The coin will be deployed from this address on '
        + esc(CFG.chain.name) + ', and the supply minted to it.'
      : '<b>Connected as ' + esc(short(acct)) + ', on the wrong network.</b> Switch to '
        + esc(CFG.chain.name) + ' before launching \u2014 the header button does it.';
  };

  const renderWallet = () => {
    const btn = $('connect');
    const line = $('walletLine');
    renderWalletNote();
    if (!btn) return;
    if (!SpinpadChain.hasWallet()) {
      btn.textContent = 'No wallet found';
      if (line) line.textContent = 'This pad deploys a real contract on ' + CFG.chain.name + ', so it needs a wallet in the browser.';
      return;
    }
    const acct = SpinpadChain.state.account;
    if (!acct) {
      btn.textContent = 'Connect wallet';
      if (line) line.textContent = 'Not connected.';
      return;
    }
    btn.textContent = short(acct);
    if (line) {
      line.textContent = SpinpadChain.onChain()
        ? 'Connected on ' + CFG.chain.name + '.'
        : 'Connected, but on the wrong network. Click to switch to ' + CFG.chain.name + '.';
    }
  };

  /* One address does the work, so one address gets checked. The sixteen cells
     are names written into the coin and carry no address at all. */
  const verifyTokens = async () => {
    const box = $('verify');
    if (!box) return;
    if (!SpinpadChain.state.account) { box.innerHTML = ''; return; }

    box.innerHTML = '<p class="sp-verify-head">Checking against ' + esc(CFG.chain.name) + '…</p>';
    const [q, r] = await Promise.all([
      SpinpadChain.verifyToken(CFG.quote),
      SpinpadChain.verifyRouter(),
    ]);
    quoteOk = q;
    routerOk = r;

    const row = (label, res, hint) => `
      <li class="${res.ok ? 'is-ok' : 'is-bad'}">
        <i class="sp-dot" data-color="${res.ok ? 'green' : 'none'}"></i>
        <b>${esc(label)}</b><em>${esc(res.ok ? (res.symbol ? res.symbol + ' · verified' : 'verified') : res.reason)}</em>
      </li>${hint && !res.ok ? `<li class="sp-verify-hint">${esc(hint)}</li>` : ''}`;

    box.innerHTML =
      `<p class="sp-verify-head">${q.ok && r.ok ? 'Ready to launch on ' : 'Not ready on '}${esc(CFG.chain.name)}</p>`
      + '<ul class="sp-verify-list">'
      + row('Pair token (' + CFG.quote.ticker + ')', q, 'Fill quote.address in config.js. Deploying still works; pools do not.')
      + row('Router', r, 'Fill router.address and router.weth in config.js.')
      + '</ul>'
      + '<p class="sp-verify-note">The sixteen cells are names written into the coin, not tokens. '
      + 'Nothing on the board tracks a share price.</p>';
  };

  const wireWallet = () => {
    const btn = $('connect');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      if (!SpinpadChain.hasWallet()) {
        say('No wallet in this browser. Spinpad deploys a real contract, so it needs one.');
        return;
      }
      try {
        if (!SpinpadChain.state.account) await SpinpadChain.connect();
        if (!SpinpadChain.onChain()) await SpinpadChain.switchChain();
      } catch (e) {
        say(e && e.code === 4001 ? 'Refused in the wallet.'
          : 'Could not connect: ' + ((e && e.message) || 'unknown error'));
      } finally {
        // the account can be connected even when the network switch was refused
        renderWallet();
        await verifyTokens();
      }
    });

    const p = SpinpadChain.hasWallet() ? window.ethereum : null;
    if (p && p.on) {
      p.on('accountsChanged', (accs) => {
        SpinpadChain.state.account = (accs && accs[0]) || null;
        renderWallet(); verifyTokens();
      });
      p.on('chainChanged', (id) => {
        SpinpadChain.state.chainId = id;
        renderWallet(); verifyTokens();
      });
    }
    renderWallet();
  };

  /* ---------- the door ----------
     Nobody gets to the pad without being told, in as many words, that none of
     this settles. The tick is the point: it has to be a deliberate act. */
  const GATE = 'spinpad.gate.v1';

  const openGate = () => {
    const gate = $('gate');
    if (!gate) return;
    let seen = false;
    try { seen = localStorage.getItem(GATE) === 'ok'; } catch (e) { /* blocked: ask again */ }
    if (seen) return;
    if (typeof gate.showModal === 'function') gate.showModal();
    else gate.setAttribute('open', '');
  };

  const wireGate = () => {
    const gate = $('gate'), agree = $('gateAgree'), go = $('gateGo');
    if (!gate || !agree || !go) return;
    agree.addEventListener('change', () => { go.disabled = !agree.checked; });
    go.addEventListener('click', () => {
      if (!agree.checked) return;
      try { localStorage.setItem(GATE, 'ok'); } catch (e) { /* it will ask again */ }
      if (typeof gate.close === 'function') gate.close();
      else gate.removeAttribute('open');
    });
    // Esc closes a dialog on its own; make that mean "not accepted"
    gate.addEventListener('cancel', (e) => { e.preventDefault(); });
  };

  /* ---------- the sort control ----------
     A listbox rather than a native select: the platform control was the one
     thing on the page that looked borrowed. */
  const wireSort = () => {
    const btn = $('sortBtn'), menu = $('sortMenu');
    if (!btn || !menu) return;
    const items = [...menu.querySelectorAll('[role="option"]')];

    const close = () => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
    const open = () => {
      menu.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      (items.find((i) => i.getAttribute('aria-selected') === 'true') || items[0]).focus();
    };

    const choose = (li) => {
      items.forEach((i) => i.setAttribute('aria-selected', String(i === li)));
      btn.textContent = li.textContent;
      view.sort = li.dataset.value;
      renderProof();
      close();
      btn.focus();
    };

    btn.addEventListener('click', () => (menu.hidden ? open() : close()));
    menu.addEventListener('click', (e) => {
      const li = e.target.closest('[role="option"]');
      if (li) choose(li);
    });
    menu.addEventListener('keydown', (e) => {
      const at = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const next = (at + (e.key === 'ArrowDown' ? 1 : items.length - 1) + items.length) % items.length;
        items[next].focus();
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (at >= 0) choose(items[at]);
      } else if (e.key === 'Escape') {
        close(); btn.focus();
      }
    });
    document.addEventListener('click', (e) => {
      if (!menu.hidden && !e.target.closest('#sortWrap')) close();
    });
  };

  /* ---------- the mobile menu ---------- */
  const wireBurger = () => {
    const burger = $('burger');
    const nav = document.querySelector('.sp-nav');
    if (!burger || !nav) return;
    const set = (on) => {
      nav.classList.toggle('is-open', on);
      burger.setAttribute('aria-expanded', String(on));
    };
    burger.addEventListener('click', () => set(!nav.classList.contains('is-open')));
    nav.querySelectorAll('.sp-nav-links a').forEach((a) => a.addEventListener('click', () => set(false)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
  };

  /* ---------- wiring ---------- */

  const init = () => {
    wireLogos();            // before anything renders, or the first images race it
    drawWheel($('heroWheelSvg'));
    drawWheel($('dial'));
    labelWheel($('heroWheel'));
    labelWheel(document.querySelector('.sp-wheel-big'));
    wireHeroWheel();
    renderFloaters();
    wireMotion();
    drawRoom();
    window.addEventListener('resize', drawRoom);
    renderBoardGrid();
    renderDesk();
    wireGate();
    wireSort();
    wireBurger();
    wireWallet();
    openGate();

    load();
    renderProof();
    resetFlow();

    // the board reads out a cell when one is picked
    const grid = $('boardGrid');
    if (grid) grid.addEventListener('click', (e) => {
      const cell = e.target.closest('.sp-cell');
      if (!cell) return;
      readCell(cell.dataset.color, cell.dataset.pos);
    });

    $('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const draft = readForm();
      if (!draft) return;
      flow.draft = draft;
      setStep(2);
      say('Details locked. One spin decides the pairing.');
      $('spin').focus();
      $('spin').scrollIntoView({ block: 'center', behavior: 'smooth' });
    });

    $('backToForm').addEventListener('click', () => {
      if (flow.spin || flow.spinning) return;     // already spun: there is no way back
      setStep(1);
      say('Fill in the details, then the wheel decides the rest.');
    });

    // the note's button is the header's button, not a second path to a wallet
    if ($('connectInline')) $('connectInline').addEventListener('click', () => $('connect').click());

    $('spin').addEventListener('click', doSpin);

    // The only way from the result to the confirmation, and it carries nothing
    // with it: the pairing is already in flow.spin and is never re-read from
    // the screen.
    $('toLaunch').addEventListener('click', () => {
      if (!flow.spin || flow.step !== 3) return;
      setStep(4);
      renderSummary();
      $('launchBtn').scrollIntoView({ block: 'center', behavior: 'smooth' });
    });

    $('launchBtn').addEventListener('click', launch);
    if ($('poolBtn')) $('poolBtn').addEventListener('click', openPool);

    $('discard').addEventListener('click', () => {
      if (!confirm('Discarding clears the whole draft — name, ticker, supply, description and the spin. This is starting over, not re-rolling.')) return;
      flow.rot = 0;
      const needle = $('needle');
      needle.style.transition = 'none';
      setArrow(needle, 0);
      void needle.offsetWidth;          // flush, or the transition survives and it unwinds
      needle.style.transition = '';
      resetFlow();
    });

    $('tkAgain').addEventListener('click', () => {
      flow.rot = 0;
      const needle = $('needle');
      needle.style.transition = 'none';
      setArrow(needle, 0);
      void needle.offsetWidth;
      needle.style.transition = '';
      resetFlow();
      $('fName').focus();
      $('form').scrollIntoView({ block: 'center', behavior: 'smooth' });
    });

    $('tkCopy').addEventListener('click', async (e) => {
      const lines = [...$('tkRows').children].map((d) => d.querySelector('dt').textContent + ': ' + d.querySelector('dd').textContent);
      const text = ['Spinpad — launch record', $('tkId').textContent,
        $('tkName').textContent + ' (' + $('tkTicker').textContent + ')', ...lines].join('\n');
      try { await navigator.clipboard.writeText(text); e.target.textContent = 'Copied'; }
      catch (e2) { e.target.textContent = 'Copy failed'; }
      setTimeout(() => { e.target.textContent = 'Copy record'; }, 1800);
    });

    $('fTicker').addEventListener('input', (e) => {
      // Reassigning .value moves the caret to the end, so only do it when the
      // text actually changed, and put the caret back where the edit was.
      const el = e.target;
      const before = el.value;
      const after = before.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (after !== before) {
        const at = el.selectionStart === null ? after.length : el.selectionStart;
        const lost = before.length - after.length;
        el.value = after;
        const put = Math.max(0, Math.min(after.length, at - lost));
        try { el.setSelectionRange(put, put); } catch (e2) { /* not a text input */ }
      }
      renderSummary();
    });
    $('fName').addEventListener('input', renderSummary);

    /* The panel beside the form has to follow this field as it is typed, but the
       thousands separators still go in on blur only: rewriting .value while the
       field has focus fights whatever the user is doing to it mid-edit. So the
       two are split — read on input, reformat on blur. */
    $('fSupply').addEventListener('input', renderSummary);
    $('fSupply').addEventListener('blur', (e) => {
      const n = Number(e.target.value.replace(/\D/g, ''));
      e.target.value = n ? num(n) : '';
      renderSummary();
    });

    $('fDesc').addEventListener('input', (e) => { $('descCount').textContent = e.target.value.length + '/140'; });

    $('filters').addEventListener('click', (e) => {
      const b = e.target.closest('.sp-chip');
      if (!b) return;
      view.filter = b.dataset.filter;
      [...$('filters').children].forEach((c) => c.classList.toggle('is-on', c === b));
      renderProof();
    });

    $('search').addEventListener('input', (e) => { view.q = e.target.value.trim(); renderProof(); });

    $('clear').addEventListener('click', () => {
      if (!confirm('This clears every launch recorded in this browser. The contracts stay on chain; only the local record goes.')) return;
      coins = [];
      save();
      renderProof();
    });

    document.querySelectorAll('[data-scroll]').forEach((el) => {
      el.addEventListener('click', (e) => {
        const t = document.getElementById(el.dataset.scroll);
        if (!t) return;                 // a real href still works if the id moved
        e.preventDefault();
        t.scrollIntoView({ block: 'start', behavior: 'smooth' });
      });
    });

    // which section the nav is standing in
    const links = [...document.querySelectorAll('.sp-nav-links a')];
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        links.forEach((a) => a.classList.toggle('is-here', a.dataset.scroll === en.target.id));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ['board', 'launch', 'how', 'desk', 'proof', 'faq'].forEach((id) => { const s = $(id); if (s) spy.observe(s); });

    // relative timestamps should not freeze on a tab left open
    setInterval(renderProof, 60000);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
