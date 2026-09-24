/* Twistr — the whole application.
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

  const CFG = window.TWISTR_CONFIG;
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
  const KEY = 'twistr.coins.v1';

  /* The product was called Spinpad until this release. Whatever is already in
     somebody's browser is under the old names, and a rename is no reason to
     throw their launches away — so the old keys are read once, written under
     the new ones, and removed. Nothing about the records themselves changed,
     which is why this is a carry-over and not another version bump. */
  const WAS = [['spinpad.coins.v4', 'twistr.coins.v1'], ['spinpad.gate.v1', 'twistr.gate.v1']];
  const carryOver = () => {
    WAS.forEach(([was, now]) => {
      try {
        if (localStorage.getItem(now) !== null) return;   // already carried, or already used
        const v = localStorage.getItem(was);
        if (v === null) return;
        localStorage.setItem(now, v);
        localStorage.removeItem(was);
      } catch (e) { /* storage blocked: there is nothing to carry */ }
    });
  };

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
    if (!ts) return 'unknown';          // read off the chain, timestamp unavailable
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

  /* Records carry a picture now, so the 5MB this gets is reachable. Dropping
     the oldest pictures beats dropping the oldest coins: a launch is the record
     and the image is decoration on it. Only if that is not enough does the list
     itself get shorter. */
  const save = () => {
    const write = (list) => localStorage.setItem(KEY, JSON.stringify(list));
    let list = coins.slice(0, 60);
    try { write(list); return; } catch (e) { /* full: fall through and shed weight */ }
    for (let keep = 6; keep >= 0; keep--) {
      const trimmed = list.map((c, i) => (i < keep ? c : Object.assign({}, c, { image: '' })));
      try { write(trimmed); return; } catch (e) { /* still full */ }
    }
    for (let n = 30; n >= 1; n = Math.floor(n / 2)) {
      const short_ = list.slice(0, n).map((c) => Object.assign({}, c, { image: '' }));
      try { write(short_); return; } catch (e) { /* keep shrinking */ }
    }
    try { localStorage.removeItem(KEY); } catch (e) { /* storage is blocked entirely */ }
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
      </radialGradient>
      <linearGradient id="${ns}-rim" x1="14%" y1="4%" x2="82%" y2="96%">
        <stop offset="0%" stop-color="#FFFFFF"/>
        <stop offset="38%" stop-color="#F1F0EC"/>
        <stop offset="72%" stop-color="#DFDDD6"/>
        <stop offset="100%" stop-color="#C9C6BC"/>
      </linearGradient>
      <radialGradient id="${ns}-face" cx="36%" cy="26%" r="78%">
        <stop offset="0%" stop-color="#FFFFFF"/>
        <stop offset="62%" stop-color="#FCFBF9"/>
        <stop offset="100%" stop-color="#F0EEE9"/>
      </radialGradient>
      <linearGradient id="${ns}-hub" x1="26%" y1="10%" x2="74%" y2="90%">
        <stop offset="0%" stop-color="#FFFFFF"/>
        <stop offset="55%" stop-color="#F0EEE9"/>
        <stop offset="100%" stop-color="#D5D2C9"/>
      </linearGradient></defs>`;

    /* The wheel is a disc, not a drawing of one. A rim with thickness, lit from
       the same top-left source as everything else, a face that is not flat
       white, and ticks cut into the rim — a flat circle with a hairline round
       it was the one object on the page that looked like a diagram. */
    /* Laid out as the spinner it is: a wide rim carrying the four quarter
       names, a cross dividing the board into those quarters, and the sixteen
       circles inside it. That is the object this page is about, and a ring of
       dots with the names floating outside it was a diagram of it. */
    /* The rim gives up what the circles need. Sixteen of them on a ring have
       2πr/16 of arc each, and at r=60 that was 23.6 against a diameter of 27 —
       they were overlapping, which is why the logos read as a crowded strip
       rather than sixteen things. At r=70 the arc is 27.5, so a circle of 25.2
       leaves a real gap either side. */
    const R_OUT = 97, R_RIM = 86, R_FACE = 85.5;
    const pol = (deg, r) => {
      const a = (deg - 90) * Math.PI / 180;
      return [100 + Math.cos(a) * r, 100 + Math.sin(a) * r];
    };
    const at2 = (deg, r) => pol(deg, r).map((n) => n.toFixed(2));
    const line = (cls, deg, r0, r1) => {
      const [x1, y1] = at2(deg, r0), [x2, y2] = at2(deg, r1);
      return `<line class="${cls}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
    };

    out += `<circle class="sp-rim" cx="100" cy="100" r="${R_OUT}" fill="url(#${ns}-rim)"/>`;
    out += `<circle class="sp-face" cx="100" cy="100" r="${R_FACE}" fill="url(#${ns}-face)"/>`;

    /* Alternate quarters take a breath of tint. On a printed board that is what
       says the thing is divided into four before you have read a word of it. */
    const quarter = 360 / POSITIONS.length;
    POSITIONS.forEach((p, q) => {
      if (q % 2) return;
      const [x0, y0] = at2(q * quarter, R_FACE);
      const [x1, y1] = at2((q + 1) * quarter, R_FACE);
      out += `<path class="sp-quad" d="M100 100 L${x0} ${y0} A${R_FACE} ${R_FACE} 0 0 1 ${x1} ${y1} Z"/>`;
    });

    // the cross runs out through the rim, the way the printed one does
    for (let q = 0; q < POSITIONS.length; q++) out += line('sp-cross', q * quarter, 0, R_OUT);

    out += `<circle class="sp-rim-in" cx="100" cy="100" r="${R_RIM}"/>`;

    // one tick per outcome, cut into the inside edge of the rim
    for (let i = 0; i < SECTORS.length; i++) out += line('sp-tick', (i + 0.5) * SEG, R_RIM, R_RIM + 6);

    /* Every circle wears the asset it pairs with. The colour still has to read
       at a glance — it is half the draw — so the logo sits on a white disc
       inside the sphere rather than on the sphere itself, and what is left of
       the colour is a thick ring. That is the board's rule inside out, and it
       is the same reason the board uses it: a mark printed on a saturated
       ground is a mark you cannot see.

       The drawn glyph goes underneath the picture rather than instead of it.
       An <image> whose file is missing renders nothing at all, so the glyph
       shows through on its own — the same fallback the board has, for free. */
    /* The white disc is 82% of the circle, not 64%. At 64% the five marks whose
       own colour is their ball's colour — Nvidia and Bull on green, Meta and
       Intel on blue, the gold bars on yellow — had so little white around them
       that they read as a smudge in a coloured blob. What is left is still
       unmistakably a ring of the colour, which is what the colour is for.

       And the picture's box is wider than it is tall, like the board's: a
       wordmark such as intel or GameStop is short and wide, and a square box
       shrinks it to the height of a letter. */
    const NODE_R = 12.6, DISC_R = 10.3, PIC_W = 15, PIC_H = 12.4, GLY = 11;
    SECTORS.forEach((sec, i) => {
      const [x, y] = nodeAt(i, 70);
      const as = assetOf(sec.color, sec.position);
      const cx = x.toFixed(2), cy = y.toFixed(2);
      out += `<g data-i="${i}"><title>${esc(comboOf(sec.color, sec.position))} → ${esc(as.name)}</title>`
        + `<ellipse class="sp-node-cast" cx="${cx}" cy="${(y + 3.4).toFixed(2)}" rx="11.2" ry="8.8"/>`
        + `<circle class="sp-node" data-i="${i}" cx="${cx}" cy="${cy}" r="${NODE_R}" fill="url(#${ns}-${sec.color})"/>`
        + `<circle class="sp-node-gloss" cx="${cx}" cy="${cy}" r="${NODE_R}" fill="url(#${ns}-gloss)"/>`
        + `<circle class="sp-node-disc" cx="${cx}" cy="${cy}" r="${DISC_R}"/>`
        /* The drawn mark is the fallback for a cell with no logo, and it is
           drawn *instead of* the picture, not under it.

           Under it was the bug: an <image> whose file is missing renders
           nothing, so a glyph underneath looked like a free fallback. But a
           logo that is present has transparent parts, and the grey glyph shows
           straight through them — a wavy line across Nvidia's eye, a ring
           behind Meta's. The board never had this because its CSS hides the
           glyph once the image loads; the wheel is SVG and had no such rule. */
        + (as.logo
          ? `<image class="sp-node-pic" href="${esc(as.logo)}" x="${(x - PIC_W / 2).toFixed(2)}"`
            + ` y="${(y - PIC_H / 2).toFixed(2)}" width="${PIC_W}" height="${PIC_H}"`
            + ` preserveAspectRatio="xMidYMid meet"/>`
          : `<g class="sp-node-glyph" transform="translate(${(x - GLY / 2).toFixed(2)} ${(y - GLY / 2).toFixed(2)}) scale(${(GLY / 24).toFixed(4)})">`
            + `<path d="${GLYPHS[as.glyph] || GLYPHS.chevron}"/></g>`)
        + `<circle class="sp-node-ring" cx="${cx}" cy="${cy}" r="${NODE_R}"/></g>`;
    });

    /* A plain cap, and no word in it. The arrow pivots on this exact spot, so
       anything written here is read through the arrow's tail. */
    out += `<circle class="sp-hub-cast" cx="100" cy="102.5" r="20"/>`;
    out += `<circle class="sp-hub" cx="100" cy="100" r="20" fill="url(#${ns}-hub)"/>`;
    out += `<circle class="sp-hub-in" cx="100" cy="100" r="14.5"/>`;
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
      /* Where this chip starts: the middle of the hero, expressed as the vector
         back from its own slot. Percentages cannot do it — a percentage inside
         translate() is a percentage of the element, not of its container — so
         the trip is written in viewport units against the hero's own box.
         The far ones leave later, which is what makes it read as a burst
         spreading rather than sixteen things moving at once. */
      const fx = (50 - slot.x).toFixed(2);
      const fy = (50 - slot.y).toFixed(2);
      const reach = Math.hypot(50 - slot.x, 50 - slot.y) / 60;   // 0 near, ~1 far
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
          --fx:calc(${fx} * 1vw);
          --fy:calc(${fy} * (100dvh - var(--nav-h) - var(--nav-gap)) / 100);
          --spin:${(dir * (14 + (i % 3) * 9)).toFixed(0)}deg;
          --delay:${(0.05 + reach * 0.34).toFixed(2)}s; --dur:${dur}s; --offset:-${(0.7 * i).toFixed(2)}s;
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

  /* ---------- the live chip ----------
   *
   * One asset at a time under the headline, cycling. It is read off SECTORS
   * like everything else: the version before last had a name written into the
   * markup, and it advertised a token that had been off the board for two
   * releases until a script corrected it two seconds after load.
   *
   * It says "yours could be", not "yours is". The wheel has not been spun.
   */
  let liveAt = Math.floor(Math.random() * SECTORS.length);

  const showLive = () => {
    const chip = $('heroLive'), name = $('heroLiveName'), markEl = $('heroLiveMark');
    if (!chip || !name || !markEl) return;
    const sec = SECTORS[liveAt % SECTORS.length];
    const as = assetOf(sec.color, sec.position);
    chip.dataset.color = sec.color;
    markEl.style.backgroundImage = as.logo ? `url("${as.logo}")` : 'none';
    // restart the entry animation: without the reflow it only ever plays once
    name.style.animation = 'none';
    void name.offsetWidth;
    name.style.animation = '';
    name.textContent = as.name;
  };

  const wireLive = () => {
    if (!$('heroLive')) return;
    showLive();
    if (reduced()) return;                 // one name, held, rather than a flicker
    const hero = document.querySelector('.sp-hero');
    setInterval(() => {
      if (hero && hero.classList.contains('is-still')) return;
      if (document.hidden) return;
      liveAt = (liveAt + 1) % SECTORS.length;
      showLive();
    }, 2200);
  };

  /* Sixteen things moving for ever is exactly the case a pause control exists
     for. It is not decoration you can ignore if it bothers you — and the chip
     under the headline is one of the sixteen things, so it stops too. */
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

  /* Over everything the board knows — this browser's launches and anything
     read back off the chain — because a bigger sample is a better one, and a
     distribution drawn from five local launches says nothing at all. */
  const tally = (list) => {
    const counts = {};
    ORDER.forEach((k) => { counts[k] = 0; });
    list.forEach((c) => { if (counts[c.color] !== undefined) counts[c.color]++; });
    return counts;
  };

  const renderKpis = () => {
    const box = $('kpis');
    if (!box) return;
    const all = merged();
    const counts = tally(all);
    const total = all.length;
    const shares = ORDER.map((k) => ({ k, pct: total ? counts[k] / total * 100 : 0 }));
    const most = shares.slice().sort((a, b) => b.pct - a.pct)[0];
    const wide = shares.slice().sort((a, b) => Math.abs(b.pct - EXPECTED) - Math.abs(a.pct - EXPECTED))[0];
    const gap = wide.pct - EXPECTED;

    const tiles = [
      ['Launches', num(total), total === 1 ? 'coin' : 'coins'],
      ['Pools opened', num(all.filter((c) => c.poolTx || c.pair).length), 'on ' + CFG.chain.name],
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
    const all = merged();
    const counts = tally(all);
    const total = all.length;
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
        ? `Based on ${total} launch${total === 1 ? '' : 'es'} the board can see. A short record wanders from ${EXPECTED}% freely; the wheel itself is flat by construction.`
        : `No launches recorded yet. Each colour holds four of the wheel’s ${SECTORS.length} nodes.`;
    }
  };

  /* ---------- proof ----------
   *
   * Real launches only. Every row here is a contract that exists, with the
   * transaction that made it; nothing is seeded and nothing is invented.
   */

  const view = { filter: 'all', sort: 'new', q: '' };

  /* ---------- launches read back off the chain ----------
   *
     The list above is what THIS browser remembers, which is not the same thing
     as what has been launched. A coin is deployed straight from the launcher's
     own wallet, so there is no factory holding a register and nothing to ask
     for a list — but every coin emits Paired in its constructor, and that is
     enough: one eth_getLogs on that topic finds coins launched by other people,
     in other browsers, on other machines, without this page being trusted for
     any of it.

     `chainCoins` is keyed by address and merged into the board. Nothing is
     written to storage from it: a launch someone else made is not this
     browser's record, and the local list stays exactly what it was.

     What the scan CANNOT do is see everything at once. Base makes a block every
     couple of seconds and a node will refuse a log query over too wide a range,
     so the scan walks backwards a window at a time and says plainly how far it
     has got. That is a real limit and the copy on the page says so rather than
     implying the board is complete. */
  const chainCoins = new Map();          // address → record
  const scan = { head: 0, reached: 0, running: false, blocked: '' };

  const WINDOW = 800;                    // blocks per eth_getLogs, conservative
  const PASSES = 6;                      // windows per press

  const byLabel = (list, label) => {
    const want = String(label || '').trim().toLowerCase();
    return list.find((x) => String(x.label).toLowerCase() === want) || null;
  };

  /* The contract stores the colour and position as their LABELS, so they come
     back as "Red" and "Left hand" rather than ids. A coin whose labels this
     config does not know — an older build, or a fork — is still a real coin and
     still shown; it just cannot be filtered by colour or given a mark. */
  const fromLog = (log, read, ts) => {
    const col = byLabel(CFG.colours, log.colour);
    const pos = byLabel(CFG.positions, log.position);
    return {
      id: log.txHash || log.address,
      address: log.address,
      name: read.name || log.asset || 'Unnamed',
      ticker: read.ticker || '',
      supply: read.supply || '0',
      desc: '',
      image: '',
      color: col ? col.id : '',
      position: pos ? pos.id : '',
      assetName: log.asset,
      creator: log.creator,
      block: log.block,
      ts: ts || 0,
      txHash: log.txHash,
      fromChain: true,
    };
  };

  /* Local first for the fields that only exist here — the picture and the
     description are typed into this browser and are not on the chain — then
     everything the chain says on top, because the chain is the authority for
     anything it holds. */
  const merged = () => {
    const out = new Map();
    coins.forEach((c) => {
      const k = String(c.address || c.id || '').toLowerCase();
      if (k) out.set(k, c); else out.set('local:' + c.id, c);
    });
    chainCoins.forEach((c, k) => {
      const mine = out.get(k);
      out.set(k, mine
        ? Object.assign({}, c, {
            desc: mine.desc || '',
            image: mine.image || '',
            poolTx: mine.poolTx || c.poolTx,
            pair: c.pair || mine.pair,
            ts: mine.ts || c.ts,
          })
        : c);
    });
    return [...out.values()];
  };

  const visible = () => {
    let list = merged();
    if (view.filter !== 'all') list = list.filter((c) => c.color === view.filter);
    if (view.q) {
      const q = view.q.toLowerCase();
      list = list.filter((c) => (c.name + ' ' + c.ticker).toLowerCase().includes(q));
    }
    const by = {
      /* A coin found in a log and a coin launched here are ordered together:
         the timestamp when there is one, the block when there is not. */
      new: (a, b) => (b.ts || 0) - (a.ts || 0) || (b.block || 0) - (a.block || 0),
      supply: (a, b) => Number(BigInt(b.supply) - BigInt(a.supply)),
      name: (a, b) => a.name.localeCompare(b.name),
    };
    return list.sort(by[view.sort] || by.new);
  };

  /* Whether this coin actually got a pool, said plainly. A launched coin with
     no pool is a token nobody can buy, and that is the single most useful thing
     this list can tell you about a row — so it gets a column rather than being
     something you find out by clicking through to the explorer.

     `pair` is the pool's own address, read off the factory when the pool opened.
     Coins launched before pools worked have a txHash and no pool, and say so. */
  const poolCell = (c) => {
    if (c.pair) {
      return `<a href="${esc(TwistrChain.explorerAddress(c.pair))}" target="_blank" rel="noopener noreferrer" class="is-live">Pool</a>`;
    }
    if (c.poolTx) {
      return `<a href="${esc(TwistrChain.explorerTx(c.poolTx))}" target="_blank" rel="noopener noreferrer" class="is-live">Pool</a>`;
    }
    return '<span>no pool</span>';
  };

  /* THE CONTRACT IS THE AUTHORITY, not this page's table.
   *
     For a coin launched here the two always agree, so this looked like it
     could be skipped — and a test of a coin read off the chain proved it
     could not. The board showed the asset THIS config maps red-plus-left-hand
     to, while the contract said something else entirely, and there was nothing
     on screen to say so. A coin from a different build of the pairing table, or
     from a fork, would have been quietly relabelled with a name it does not
     carry. That is the one thing this whole design exists to prevent.

     So: if the coin itself names an asset, that is the name shown. The table is
     only consulted for the mark and the ticker, and only when it agrees. */
  const assetShown = (c) => {
    const table = assetOf(c.color, c.position);
    if (!c.assetName) return table;
    if (table && table.name === c.assetName) return table;
    return {
      name: c.assetName,
      ticker: c.assetTicker || '',
      glyph: 'chevron',
      logo: '',
      offTable: true,
    };
  };

  const launchRow = (c) => {
    const as = assetShown(c);
    const size = 24;
    const pic = safeImage(c.image);
    const face = pic
      ? `<span class="sp-mark" style="--m:${size}px">${drawn(as.glyph, size)}`
        + `<img class="sp-logo" src="${esc(pic)}" alt="" width="${size}" height="${size}"></span>`
      : mark(as, size);
    return `
      <div class="sp-launch" data-color="${c.color}">
        <span class="sp-launch-mark">${face}</span>
        <span class="sp-launch-name"><b>${esc(c.name)}</b><br><em>${esc(c.ticker)}</em></span>
        <span class="sp-launch-pair"><b>${esc(as.name)}</b><em>${as.offTable
          ? 'as written in the contract'
          : esc(comboOf(c.color, c.position))}</em></span>
        <span class="sp-launch-pool">${poolCell(c)}</span>
        <span class="sp-launch-time">${ago(c.ts)}</span>
        <span class="sp-launch-tx">${c.txHash
          ? `<a href="${esc(TwistrChain.explorerTx(c.txHash))}" target="_blank" rel="noopener noreferrer">${esc(short(c.txHash))}</a>`
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
      const as = assetShown(c);
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
    if (count) {
      const all = merged().length;
      const off = chainCoins.size;
      count.textContent = `Showing ${list.length} of ${all}`
        + (off ? ` — ${off} read from ${CFG.chain.name}` : ' launched from this browser');
    }
    renderScan();
    renderTicker();
    renderKpis();
    renderMeter();
  };

  /* ---------- the scan ----------
   *
     How far back the board has looked, said in hours rather than blocks,
     because "reached block 24,113,900" tells nobody anything. Base makes a
     block about every two seconds. */
  const BLOCK_SECONDS = 2;

  const spanWords = (blocks) => {
    const hours = (blocks * BLOCK_SECONDS) / 3600;
    if (hours < 1.5) return Math.max(1, Math.round(hours * 60)) + ' minutes';
    if (hours < 48) return Math.round(hours) + ' hours';
    return Math.round(hours / 24) + ' days';
  };

  const renderScan = () => {
    const note = $('scanNote');
    const btn = $('scanBtn');
    const more = $('scanMore');
    if (!note) return;

    if (scan.blocked) {
      note.textContent = scan.blocked;
    } else if (scan.running) {
      note.textContent = 'Reading the logs…';
    } else if (scan.head) {
      const covered = scan.head - scan.reached;
      note.textContent = `Looked back ${spanWords(covered)} and found `
        + `${chainCoins.size} coin${chainCoins.size === 1 ? '' : 's'}. `
        + 'Older ones are further down the chain.';
    } else {
      note.textContent = '';
    }

    if (btn) {
      btn.disabled = scan.running;
      btn.textContent = scan.running ? 'Reading…' : (scan.head ? 'Check again' : 'Read launches from ' + CFG.chain.name);
    }
    if (more) {
      more.hidden = !scan.head || !!scan.blocked;
      more.disabled = scan.running;
    }
  };

  /* Walk backwards a window at a time. Not one wide query: a node will refuse
     a log range that is too big, and the refusal looks like an outage rather
     than a limit. Small windows, a bounded number per press, and whatever is
     found is shown as it is found. */
  const runScan = async (older) => {
    if (scan.running) return;
    if (!TwistrChain.hasWallet()) {
      scan.blocked = 'No wallet in this browser, and reading the chain needs one to talk to a node.';
      renderScan();
      return;
    }
    scan.running = true;
    scan.blocked = '';
    renderScan();

    try {
      if (!older || !scan.head) {
        scan.head = await TwistrChain.blockNumber();
        scan.reached = scan.head + 1;
      }

      let to = Math.min(scan.reached - 1, scan.head);
      for (let i = 0; i < PASSES && to > 0; i++) {
        const from = Math.max(0, to - WINDOW + 1);
        const logs = await TwistrChain.pairedLogs(from, to);
        for (const log of logs) await absorb(log);
        scan.reached = from;
        to = from - 1;
        renderProof();
      }
    } catch (e) {
      /* A node that refuses a log query, or a wallet that does not forward one,
         is a limit to report — not something to retry silently or pretend away. */
      scan.blocked = 'This wallet’s node would not answer the log query'
        + ((e && e.message) ? ' (' + e.message + ')' : '')
        + '. You can still paste a coin’s address below to look it up.';
    }

    scan.running = false;
    renderProof();
  };

  /* Found in a log, then read from the coin itself: the log is how it was
     found, the contract is what gets shown. */
  const absorb = async (log) => {
    if (chainCoins.has(log.address)) return;
    try {
      const read = await TwistrChain.readCoin(log.address);
      const rec = fromLog(log, read, await TwistrChain.blockTime(log.block));
      if (routerOk && routerOk.ok && routerOk.factory) {
        const pair = await TwistrChain.pairFor(routerOk.factory, log.address, routerOk.weth);
        if (pair) rec.pair = pair;
      }
      chainCoins.set(log.address, rec);
    } catch (e) { /* one unreadable coin does not stop the scan */ }
  };

  /* The way in when the log scan is refused, and the way to check one specific
     coin: paste its address and the page reads the draw straight off it. That
     is the whole point of writing the pairing into the contract — it can be
     read back by anyone, from the chain, without this page. */
  const lookUp = async () => {
    const field = $('lookup');
    const note = $('lookupNote');
    if (!field || !note) return;
    const addr = (field.value || '').trim().toLowerCase();

    if (!/^0x[0-9a-f]{40}$/.test(addr)) { note.textContent = 'That is not a contract address.'; return; }
    if (!TwistrChain.hasWallet()) { note.textContent = 'Reading the chain needs a wallet to talk to a node.'; return; }

    note.textContent = 'Reading…';
    try {
      const read = await TwistrChain.readCoin(addr);
      if (!read.ticker && !read.name) { note.textContent = 'Nothing at that address answers like a token.'; return; }

      const draw = await TwistrChain.readDraw(addr);
      if (!draw.asset) {
        note.textContent = `${read.name || addr} is a token, but it carries no Twistr draw — `
          + 'it was not launched here.';
        return;
      }

      const rec = fromLog(Object.assign({ address: addr, txHash: '', block: 0 }, draw), read, 0);
      if (routerOk && routerOk.ok && routerOk.factory) {
        const pair = await TwistrChain.pairFor(routerOk.factory, addr, routerOk.weth);
        if (pair) rec.pair = pair;
      }
      chainCoins.set(addr, rec);
      field.value = '';
      note.textContent = `${rec.name} is on the board: ${draw.asset}, from ${draw.colour.toLowerCase()} on the ${draw.position.toLowerCase()}.`;
      renderProof();
    } catch (e) {
      note.textContent = 'Could not read that address: ' + ((e && e.message) || 'the node refused');
    }
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
  /* Set when a launcher is deployed from the panel. It has to live out here
     because deploying one redraws the panel — the warning it was announced
     inside is exactly what goes away — and a confirmation that vanishes with
     the thing it was confirming tells the person nothing. */
  let factoryNews = '';

  /* Bring a stage's top under the nav rather than centring a control inside it.
     Centring the SPIN button put the wheel's heading behind the sticky bar —
     and the bigger the wheel got, the more of the stage went with it. The
     stages carry a scroll-margin for the bar, so `start` lands correctly. */
  const showStage = (n) => {
    const el = document.querySelector(`.sp-stage[data-stage="${n}"]`);
    if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

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

  /* ---------- the image ----------
   *
   * Uploaded is the wrong word for what happens, and the help text says so: the
   * file never leaves the browser. It is decoded, drawn into a canvas at 256px
   * and re-encoded, and that string is what sits beside the record in
   * localStorage. There is no server to send it to — this is four static files
   * — and there is nowhere on chain for it either.
   *
   * Resizing is not tidiness. localStorage is about 5MB for the whole origin,
   * and one photo off a phone is bigger than that on its own: stored raw, the
   * first coin with a picture would throw the whole board away.
   */
  const IMG_PX = 256;            // the largest it is ever drawn is about 47
  const IMG_MAX_BYTES = 20e6;    // refuse to decode something absurd
  const IMG_MAX_STORED = 220e3;  // and refuse to keep the result if it is still huge
  const IMG_OK = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/;

  let imageData = '';            // the encoded result, or empty
  let imageName = '';

  /* WebP first because it is the smallest by a distance. A browser without it
     hands back a PNG from toDataURL regardless of what was asked for, so the
     result is checked rather than trusted — and if PNG comes back large, the
     picture is a photograph and needs a lossy codec. JPEG has no alpha, so it
     gets a white ground; transparent pixels encoded as JPEG come out black. */
  const encodeCanvas = (c) => {
    const webp = c.toDataURL('image/webp', 0.82);
    if (webp.startsWith('data:image/webp')) return webp;
    const png = c.toDataURL('image/png');
    if (png.length <= 120e3) return png;
    const flat = document.createElement('canvas');
    flat.width = c.width; flat.height = c.height;
    const g = flat.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, flat.width, flat.height);
    g.drawImage(c, 0, 0);
    return flat.toDataURL('image/jpeg', 0.86);
  };

  const shrinkImage = (file) => new Promise((resolve, reject) => {
    if (!/^image\//.test(file.type)) { reject(new Error('That is not an image file.')); return; }
    if (file.size > IMG_MAX_BYTES) { reject(new Error('That file is over 20MB. Try a smaller one.')); return; }
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('That file could not be read.'));
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('This browser could not open that image.'));
      img.onload = () => {
        const long = Math.max(img.naturalWidth, img.naturalHeight);
        if (!long) { reject(new Error('That image has no size.')); return; }
        const k = Math.min(1, IMG_PX / long);
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.naturalWidth * k));
        c.height = Math.max(1, Math.round(img.naturalHeight * k));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        let url;
        try { url = encodeCanvas(c); } catch (e) { reject(new Error('That image could not be re-encoded.')); return; }
        if (url.length > IMG_MAX_STORED) { reject(new Error('That image is too big to keep in this browser.')); return; }
        resolve(url);
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });

  /* Anything rendered into a src attribute is checked against this first. The
     string this code writes always passes; a hand-edited localStorage entry
     saying data:text/html does not. */
  const safeImage = (v) => (typeof v === 'string' && IMG_OK.test(v) ? v : '');

  const kb = (n) => (n < 1024 ? n + ' B' : Math.round(n / 1024) + ' KB');

  const showImage = () => {
    const box = $('imageDrop'), has = $('imageHas');
    if (!box || !has) return;
    const on = !!imageData;
    box.classList.toggle('is-full', on);
    has.hidden = !on;
    const empty = box.querySelector('.sp-drop-empty');
    if (empty) empty.hidden = on;
    if (on) {
      $('imageThumb').src = imageData;
      $('imageName').textContent = imageName || 'image';
      // the stored length, not the file's: the stored one is what costs anything
      $('imageSize').textContent = kb(Math.round(imageData.length * 0.75)) + ' stored · ' + IMG_PX + 'px';
    }
  };

  const clearImage = () => {
    imageData = ''; imageName = '';
    if ($('fImage')) $('fImage').value = '';
    err('fImage', '');
    if ($('imageDrop')) $('imageDrop').classList.remove('is-bad');
    showImage();
    renderSummary();
  };

  const takeImage = (file) => {
    if (!file) return;
    const box = $('imageDrop');
    shrinkImage(file).then((url) => {
      imageData = url;
      imageName = file.name || 'image';
      err('fImage', '');
      if (box) box.classList.remove('is-bad');
      showImage();
      renderSummary();
    }).catch((e) => {
      imageData = ''; imageName = '';
      err('fImage', e.message);
      if (box) box.classList.add('is-bad');
      showImage();
      renderSummary();
    });
  };

  const wireImage = () => {
    const box = $('imageDrop'), input = $('fImage');
    if (!box || !input) return;
    input.addEventListener('change', () => takeImage(input.files && input.files[0]));
    $('imageClear').addEventListener('click', (e) => { e.stopPropagation(); clearImage(); });

    /* Every one of these has to preventDefault or the browser navigates to the
       file, which loses the whole draft along with the page. */
    ['dragenter', 'dragover'].forEach((t) => box.addEventListener(t, (e) => {
      e.preventDefault();
      if (!input.disabled) box.classList.add('is-over');
    }));
    ['dragleave', 'dragend'].forEach((t) => box.addEventListener(t, () => box.classList.remove('is-over')));
    box.addEventListener('drop', (e) => {
      e.preventDefault();
      box.classList.remove('is-over');
      if (input.disabled) return;
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      takeImage(f);
    });

    // a screenshot in the clipboard is the common case, and it has no file to pick
    box.addEventListener('paste', (e) => {
      const items = e.clipboardData && e.clipboardData.files;
      if (items && items[0]) { e.preventDefault(); takeImage(items[0]); }
    });
  };

  const readForm = () => {
    const name = $('fName').value.trim();
    const ticker = $('fTicker').value.trim().toUpperCase();
    const supply = Number($('fSupply').value.replace(/\D/g, ''));
    const desc = $('fDesc').value.trim();
    const image = imageData;
    const liqRaw = ($('fLiq') ? $('fLiq').value : '').trim();

    let ok = true;
    ok = err('fName', name.length < 2 || name.length > 32 ? 'Between 2 and 32 characters.' : '') && ok;
    ok = err('fTicker', /^[A-Z0-9]{2,8}$/.test(ticker) ? '' : '2 to 8 letters or digits, no spaces.') && ok;
    ok = err('fSupply', !supply || supply < 1000 || supply > 1e12 ? 'Between 1,000 and 1,000,000,000,000.' : '') && ok;
    ok = err('fDesc', desc.length > 140 ? '140 characters maximum.' : '') && ok;
    /* The field used to take a URL and refuse data: on the grounds that it
       would be an injection with extra steps. It only ever holds a data URL
       now — but one this code encoded off a canvas, never a string anybody
       typed, and it is checked on the way out as well as here. */
    ok = err('fImage', !image || IMG_OK.test(image) ? '' : 'That image could not be read. Choose another.') && ok;
    if (coins.some((c) => c.ticker === ticker)) ok = err('fTicker', 'That ticker is already on the board.') && ok;

    /* Empty is allowed and means "no pool". Anything else has to be a plain
       positive number, and it is validated HERE rather than after the coin is
       already deployed — finding out your liquidity figure was unreadable when
       the token already exists is the worst moment to find out. */
    let liq = '';
    if (liqRaw !== '') {
      if (!/^\d+(\.\d+)?$/.test(liqRaw) || Number(liqRaw) <= 0) {
        ok = err('fLiq', 'A plain positive number, or leave it empty for no pool.') && ok;
      } else if (!poolPossible()) {
        ok = err('fLiq', poolWhyNot()) && ok;
      } else {
        liq = liqRaw;
        err('fLiq', '');
      }
    } else {
      err('fLiq', '');
    }

    return ok ? { name, ticker, supply, desc, image, liq } : null;
  };

  /* Whether a pool could be opened at all, which is a different question from
     whether the person wants one. Asked before the launch rather than after,
     so "no router" is a thing you learn while typing and not while holding a
     token nobody can buy. */
  const poolPossible = () =>
    !!(CFG.router.address && routerOk && routerOk.ok && quoteOk && quoteOk.ok
       && TwistrChain.state.account);

  const poolWhyNot = () => {
    if (!CFG.router.address) return 'No router is configured, so no pool can be opened yet.';
    if (!TwistrChain.state.account) return 'Connect a wallet first — liquidity comes out of it.';
    if (!routerOk || !routerOk.ok) return 'The router has not verified: ' + ((routerOk && routerOk.reason) || 'not checked') + '.';
    if (!quoteOk || !quoteOk.ok) return CFG.quote.ticker + ' has not verified.';
    return 'A pool cannot be opened right now.';
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
      /* On the confirmation, because it is money leaving the wallet and the
         confirmation is the last screen before it does. */
      ['Starting liquidity', (() => {
        const v = ($('fLiq') && $('fLiq').value || '').trim();
        return v ? v + ' ' + payTicker() + ' + ' + Math.round(CFG.liquidity.supplyShare * 100) + '% of supply'
                 : 'None — no pool';
      })(), true],
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
      /* The picture goes on the orb the moment it is chosen, which is the only
         reason to believe it was read at all — there is no upload to watch. */
      const orbPic = $('orbPic');
      if (orbPic) {
        const pic = safeImage(imageData);
        orbPic.hidden = !pic;
        if (pic) orbPic.src = pic;
        $('orbTicker').closest('.sp-orb').classList.toggle('has-pic', !!pic);
      }
    }
  };

  const say = (msg) => { $('status').textContent = msg; };

  const doSpin = () => {
    if (flow.step !== 2 || flow.spin || flow.spinning) return;
    flow.spinning = true;
    setStep(2);
    say('Spinning. The wheel decides the pairing, not you.');

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

    if (!TwistrChain.hasWallet()) {
      say('No wallet in this browser. Twistr deploys a real contract, so it needs one.');
      return;
    }
    if (!TwistrChain.state.account) {
      say('Connect a wallet first — the contract is deployed from your address.');
      return;
    }
    if (!TwistrChain.onChain()) {
      say(`Wrong network. Switch to ${CFG.chain.name} before launching.`);
      return;
    }
    flow.sending = true;
    $('launchBtn').disabled = true;
    say('Pricing the deployment against the chain before opening your wallet…');
    let estimate = null;

    const supplyWei = BigInt(flow.draft.supply) * 10n ** 18n;
    let hash;
    try {
      hash = await TwistrChain.deploy({
        name: flow.draft.name,
        ticker: flow.draft.ticker,
        supplyWei,
        assetName: as.name,
        assetTicker: as.ticker,
        colour: f.label,
        position: p.label,
      }, (est) => {
        /* Said BEFORE the wallet opens, because this is the one thing that
           answers "why is my wallet showing a red simulation error?".

           A wallet's simulator and the node's gas estimate answer different
           questions. eth_estimateGas runs the transaction against current
           state; if it comes back with a number, the deployment executes. A
           wallet simulator is predicting balance changes for a preview, and a
           bare contract creation has no `to`, no transfer and no token it
           recognises — so it often has nothing to describe and shows a failure
           for a transaction that is completely fine. Phantom in particular is
           Solana-first and this is its weakest case on an EVM chain. */
        estimate = est;
        if (est.ok) {
          say('The node priced the deployment at ' + num(Number(est.gas)) + ' gas, so it executes. '
            + 'If your wallet says it cannot simulate this, that is the wallet — a bare contract '
            + 'creation has no transfer for it to preview. Confirm it.');
        } else {
          say('The node REFUSED to price this deployment (' + est.reason + '). That usually means it '
            + 'would fail. You can still send it, but do not confirm past a wallet warning unless '
            + 'you are willing to pay gas for a transaction that may revert.');
        }
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
      receipt = await TwistrChain.waitForReceipt(hash, (i) => {
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
      /* What went into the constructor, recorded next to what drew it. The row
         shows this rather than re-deriving the name from the table, so a later
         edit to the pairings cannot retroactively relabel a coin that is
         already on chain carrying the old name. */
      assetName: as.name,
      assetTicker: as.ticker,
      address: receipt.contractAddress,
      txHash: hash,
      poolTx: null,
      creator: TwistrChain.state.account,
      chainId: CFG.chain.id,
      /* What the node said it would cost, kept because it is the difference
         between "the wallet could not preview this" and "this was broken". */
      gasEstimate: estimate && estimate.ok ? estimate.gas : null,
      ts: Date.now(),
    };

    coins.unshift(coin);
    save();
    renderProof();
    flow.sending = false;
    setStep(5);
    showRecord(coin);

    /* A coin with no pool is a token nobody can buy, so liquidity is part of
       launching rather than a button to find afterwards. The amount was taken
       on the form, before any of this, which is the only moment it can still
       be changed for free.

       It is still THREE wallet confirmations and there is no honest way around
       that from a browser: deploying a contract, approving it and adding
       liquidity are three separate operations on chain, and making them one
       would need a factory contract of ours deployed to do all three
       atomically. What this does is stop the person having to go and find the
       second and third themselves.

       And it is deliberately sequenced after the record is shown. If the pool
       fails, the coin still exists, is on the board, and the panel is right
       there to retry — a failed pool must never look like a failed launch. */
    if (flow.draft && flow.draft.liq) {
      say('Deployed. Now putting the liquidity in — two more confirmations.');
      await openPool(flow.draft.liq);
    } else {
      say('Deployed. The pairing is written into the contract and cannot be changed. '
        + 'There is no pool, so nobody can buy it yet — you can open one below.');
    }
  };

  /* Is the quote token the router's own WETH? If it is, the pool can be paid
     for in plain ether and the router wraps it, which is one approval instead
     of two and no trip to a wrapping site first. Both halves have to be true
     and verified: the config has to say so, and the router has to have told us
     the same address on connect. Anything else falls back to the token path. */
  const paysInEther = () =>
    !!(routerOk && routerOk.ok && routerOk.weth
       && CFG.quote.address
       && routerOk.weth.toLowerCase() === CFG.quote.address.toLowerCase());

  const payTicker = () => (paysInEther() ? CFG.chain.currency.symbol : CFG.quote.ticker);

  /* The first pool.
     Paid in ether: one approval (the coin), then addLiquidityETH with the ether
     as value. Paid in the quote token: two approvals, because V2's addLiquidity
     pulls BOTH sides with transferFrom and approving only the coin is why an
     earlier version reverted with TRANSFER_FROM_FAILED every time.
     The amount is whatever the person types; the pad never picks a number that
     moves someone's money. */
  const openPool = async (amountOverride) => {
    const coin = flow.minted;
    if (!coin || !coin.address) return;
    const note = $('poolNote');
    const quote = CFG.quote;

    if (!CFG.router.address) { note.textContent = 'No router in config.js, so no pool can be opened.'; return; }
    if (!routerOk || !routerOk.ok) { note.textContent = 'The router has not verified: ' + (routerOk ? routerOk.reason : 'not checked') + '.'; return; }
    if (!quoteOk || !quoteOk.ok) { note.textContent = quote.ticker + ' has not verified: ' + (quoteOk ? quoteOk.reason : 'not checked') + '.'; return; }
    if (!TwistrChain.state.account) { note.textContent = 'Connect a wallet first.'; return; }
    /* The network can change between deploying and pooling, and every address
       here belongs to one chain. Without this, an approval and a liquidity call
       go out against whatever happens to live at those addresses elsewhere. */
    if (!TwistrChain.onChain()) {
      note.textContent = 'Wrong network. Switch back to ' + CFG.chain.name + ' before opening the pool.';
      return;
    }

    const inEther = paysInEther();
    const unit = payTicker();

    /* The amount comes from the launch form when the pool is part of the
       launch, and from the panel when someone opens one later on a coin that
       was deployed without liquidity. Same code either way. */
    const typed = String(amountOverride !== undefined && amountOverride !== null && amountOverride !== ''
      ? amountOverride
      : ($('poolAmount').value || '')).trim();
    if (!/^\d+(\.\d+)?$/.test(typed) || Number(typed) <= 0) {
      note.textContent = 'Type how much ' + unit + ' to put in, as a plain number.';
      return;
    }

    /* Scale by the decimals the chain reported, not the ones the config claims.
       Ether is 18 by definition; the quote token is whatever symbol()/decimals()
       actually returned on connect. */
    const dec = inEther ? 18 : Number(quoteOk.decimals);
    const [whole, frac = ''] = typed.split('.');
    const tokenAmount = BigInt(whole + (frac + '0'.repeat(dec)).slice(0, dec));
    if (tokenAmount <= 0n) {
      note.textContent = unit + ' has ' + dec + ' decimals, so that amount rounds to nothing. '
        + 'Type a larger one.';
      return;
    }

    const coinAmount = (BigInt(coin.supply) * BigInt(Math.round(CFG.liquidity.supplyShare * 1000))) / 1000n;
    if (coinAmount <= 0n) { note.textContent = 'Nothing of the coin to put in.'; return; }

    $('poolBtn').disabled = true;
    try {
      note.textContent = 'Approving the coin for the router… confirm in your wallet.';
      await TwistrChain.ensureAllowance(coin.address, CFG.router.address, coinAmount, (step) => {
        note.textContent = step === 'reset'
          ? 'Clearing the old allowance on the coin first…'
          : 'Approving the coin for the router… confirm in your wallet.';
      });

      let poolTx;
      if (inEther) {
        /* The router wraps the ether itself, so there is no second approval and
           nothing to hold beforehand. */
        note.textContent = 'Approved. Confirm the liquidity itself — this is the one that moves your '
          + unit + '.';
        poolTx = await TwistrChain.addLiquidityETH({
          coin: coin.address,
          coinAmount,
          ethAmount: tokenAmount,
        });
      } else {
        note.textContent = 'Now approving your ' + quote.ticker + '… confirm in your wallet.';
        await TwistrChain.ensureAllowance(quote.address, CFG.router.address, tokenAmount, (step) => {
          note.textContent = step === 'reset'
            ? 'Clearing the old ' + quote.ticker + ' allowance first…'
            : 'Now approving your ' + quote.ticker + '… confirm in your wallet.';
        });

        note.textContent = 'Approved. Confirm the liquidity itself — this is the one that moves your '
          + quote.ticker + '.';
        poolTx = await TwistrChain.addLiquidity({
          coin: coin.address,
          token: quote.address,
          coinAmount,
          tokenAmount,
        });
      }
      await TwistrChain.waitForReceipt(poolTx);

      coin.poolTx = poolTx;
      /* Ask the factory for the pair the router just created. It is the address
         a chart or a swap page needs, and it is the one thing that proves the
         pool exists to somebody who does not trust this page. */
      try {
        const pair = await TwistrChain.pairFor(routerOk.factory, coin.address, routerOk.weth);
        if (pair) coin.pair = pair;
      } catch (e) { /* the pool is open either way */ }
      save();
      renderProof();
      note.innerHTML = 'Pool open. <a href="' + esc(TwistrChain.explorerTx(poolTx))
        + '" target="_blank" rel="noopener noreferrer">See the transaction</a>'
        + (coin.pair
          ? ' · <a href="' + esc(TwistrChain.explorerAddress(coin.pair))
            + '" target="_blank" rel="noopener noreferrer">the pair</a>'
          : '')
        + '.';
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
    const as = assetShown(coin);
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
      + (coin.address ? `<div><dt>Contract</dt><dd class="is-mono"><a href="${esc(TwistrChain.explorerAddress(coin.address))}" target="_blank" rel="noopener noreferrer">${esc(short(coin.address))}</a></dd></div>` : '')
      + (coin.txHash ? `<div><dt>Transaction</dt><dd class="is-mono"><a href="${esc(TwistrChain.explorerTx(coin.txHash))}" target="_blank" rel="noopener noreferrer">${esc(short(coin.txHash))}</a></dd></div>` : '');

    $('tkNote').textContent =
      `${coin.name} is paired with ${as.name} because the wheel stopped on ${comboOf(coin.color, coin.position).toLowerCase()}, `
      + 'and that is written into the contract where nothing — including this page — can change it. '
      + `It is a name on a token: nothing here tracks ${as.name}’s share price, and ${as.name} has no `
      + 'connection to it.';

    if ($('poolAsset')) {
      /* The pool is always against the quote token. What the person HANDS OVER
         is ether when the router wraps for us, so the field has to say ETH or
         they will go looking for WETH they do not have. */
      const inEther = paysInEther();
      $('poolAsset').textContent = CFG.quote.ticker;
      const pa = $('poolAssetB'); if (pa) pa.textContent = payTicker();
      $('poolShare').textContent = Math.round(CFG.liquidity.supplyShare * 100) + '%';
      $('poolNote').textContent = coin.poolTx
        ? 'Pool already open.'
        : inEther
          ? 'Optional, and it is where real money moves. Two confirmations: approving the coin, '
            + 'then the liquidity itself. You pay in ' + CFG.chain.currency.symbol
            + ' — the router wraps it.'
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
    if ($('fLiq')) $('fLiq').value = '';
    $('descCount').textContent = '0/140';
    ['fName', 'fTicker', 'fSupply', 'fLiq', 'fDesc', 'fImage'].forEach((id) => { if ($(id)) err(id, ''); });
    /* form.reset() empties the file input but not the string this code holds,
       and a discarded draft leaving its picture on the next one is the kind of
       thing nobody reports and everybody notices. */
    clearImage();
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
  };

  /* ---------- the wallet ---------- */

  /* The note in the form says the same thing as the header, in the place where
     it is about to matter. It is deliberately not a blocker: a wallet is needed
     to launch, not to spin, and telling someone to connect before they have
     even seen the wheel is asking for a signature to look at a website. */
  const renderWalletNote = () => {
    const box = $('walletNote'), text = $('walletNoteText'), btn = $('connectInline');
    if (!box || !text || !btn) return;
    const acct = TwistrChain.state.account;
    const ready = !!acct && TwistrChain.onChain();
    box.classList.toggle('is-on', ready);
    btn.hidden = !!acct;
    if (!TwistrChain.hasWallet()) {
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
    if (!TwistrChain.hasWallet()) {
      btn.textContent = 'No wallet found';
      if (line) line.textContent = 'This pad deploys a real contract on ' + CFG.chain.name + ', so it needs a wallet in the browser.';
      return;
    }
    const acct = TwistrChain.state.account;
    if (!acct) {
      btn.textContent = 'Connect wallet';
      if (line) line.textContent = 'Not connected.';
      return;
    }
    btn.textContent = short(acct);
    if (line) {
      line.textContent = TwistrChain.onChain()
        ? 'Connected on ' + CFG.chain.name + '.'
        : 'Connected, but on the wrong network. Click to switch to ' + CFG.chain.name + '.';
    }
  };

  /* The form's liquidity field has to say what it will actually take. ETH when
     the router wraps for us, the quote token otherwise, and a plain refusal
     when no pool is possible at all — a field asking for money it cannot use
     is worse than no field. */
  const renderLiqField = () => {
    const field = $('fLiq');
    if (!field) return;
    const can = poolPossible();
    const unit = $('liqUnit');
    const help = $('liqHelp');
    if (unit) unit.textContent = can ? payTicker() : '—';
    field.disabled = !can;
    field.placeholder = can ? '0.05' : '';
    if (help) {
      help.textContent = can
        ? 'Goes into the pool the moment the coin exists, with '
          + Math.round(CFG.liquidity.supplyShare * 100)
          + '% of the supply against it. Leave it empty to deploy with no pool — the coin is real '
          + 'either way, but nobody can buy it.'
        : poolWhyNot() + ' The coin still deploys; it just comes out with no pool.';
    }
  };

  /* One address does the work, so one address gets checked. The sixteen cells
     are names written into the coin and carry no address at all. */
  const verifyTokens = async () => {
    const box = $('verify');
    if (!box) return;
    if (!TwistrChain.state.account) { box.innerHTML = ''; return; }

    box.innerHTML = '<p class="sp-verify-head">Checking against ' + esc(CFG.chain.name) + '…</p>';
    const w = TwistrChain.walletInfo();
    const [q, r] = await Promise.all([
      TwistrChain.verifyToken(CFG.quote),
      TwistrChain.verifyRouter(),
      /* Checked on every connect, not once. A remembered launcher on the wrong
         network is nothing at that address, and it has to fall back rather
         than launch into empty space. */
      TwistrChain.verifyFactory(),
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
      + row('Router (Uniswap V2)', r,
        'The router did not answer with the WETH and factory config.js claims, so pools are off. '
        + 'Deploying a coin still works.')
      + '</ul>'
      + (q.ok && r.ok
        ? '<p class="sp-verify-note">Pools open against ' + esc(CFG.quote.ticker)
          + (paysInEther()
            ? ', and you pay in ' + esc(CFG.chain.currency.symbol) + ' — the router wraps it for you.'
            : '.')
          + '</p>'
        : '')
      + '<p class="sp-verify-note">The sixteen cells are names written into the coin, not tokens. '
      + 'Nothing on the board tracks a share price.</p>'
      /* Said here, on connect, rather than after the wallet has already thrown
         its red box up. Knowing it is coming is the difference between "this
         site is broken" and "my wallet cannot preview this kind of
         transaction". */
      + (TwistrChain.usesFactory()
        ? '<p class="sp-verify-note">Launching goes through the launcher at <b class="is-mono">'
          + esc(TwistrChain.factoryAddress()) + '</b>, checked byte for byte against this build, so '
          + 'it is an ordinary call rather than a bare contract creation — which is what lets a '
          + 'wallet preview it.</p>'
        : '')
      /* Nothing about wallets here at all.
       *
         This spot held, over eight rounds, a growing yellow panel explaining a
         wallet's simulation behaviour. Then one line. Both were asked to be
         removed, and both deserved it: a launchpad whose first screen is a
         caveat about your wallet reads as broken. The state of the launcher
         belongs with the other chain facts below, said plainly and without
         naming anybody's wallet — and the button to set it up rides with it. */

    renderLiqField();

  };

  /* The launcher is set up from config.js, not from a button on the page.
   *
     Its address is deterministic — contract/TwistrFactory.sol through a CREATE2
     deployer — so it is already named in config.js and the pad checks whether
     code is there. Deploying it once makes every launch after it, for
     everybody, a contract call instead of a creation. That is a one-off
     operator job, not something a visitor should be looking at, and it had no
     business being the first thing on the wallet screen.

     TwistrChain.deployFactory() does it from the console for whoever runs the
     pad, and the check on connect picks it up from then on. */

  /* The wallet picker.
   *
     Wallets announce themselves over EIP-6963, so the page can list them
     instead of taking whatever won the race to set window.ethereum. With one
     wallet installed this never appears and connecting is one click, the way
     it always was. With several, you choose.

     Phantom is not in the list. It is excluded in chain.js at the site
     owner's request, because it refuses to preview this domain's transactions
     and nothing here changes that — listing it would be offering a dead end. */
  const renderPicker = () => {
    const box = $('picker');
    if (!box) return;
    const list = TwistrChain.wallets();
    const chosen = TwistrChain.chosenWallet();

    if (list.length < 2 || TwistrChain.state.account) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.innerHTML = '<p class="sp-picker-head">Which wallet?</p>'
      + '<div class="sp-picker-row">'
      + list.map((w) => '<button class="sp-wallet' + (chosen && chosen.uuid === w.uuid ? ' is-on' : '')
        + '" type="button" data-uuid="' + esc(w.uuid) + '">'
        + (w.icon ? '<img src="' + esc(w.icon) + '" alt="" width="20" height="20">' : '')
        + esc(w.name) + '</button>').join('')
      + '</div>';

    box.querySelectorAll('.sp-wallet').forEach((b) => {
      b.addEventListener('click', () => {
        TwistrChain.chooseWallet(b.dataset.uuid);
        renderPicker();
        renderWallet();
      });
    });
  };

  const wireWallet = () => {
    const btn = $('connect');
    if (!btn) return;

    /* Redrawn as wallets announce, which can happen after this runs. */
    window.__twistrWallets = renderPicker;
    renderPicker();

    btn.addEventListener('click', async () => {
      if (!TwistrChain.hasWallet()) {
        say('No wallet in this browser. Twistr deploys a real contract, so it needs one.');
        return;
      }
      /* More than one and none picked: the pad does not guess which of
         somebody's wallets to open. */
      if (TwistrChain.wallets().length > 1 && !TwistrChain.chosenWallet()) {
        renderPicker();
        say('Pick which wallet to use.');
        return;
      }
      try {
        if (!TwistrChain.state.account) await TwistrChain.connect();
        if (!TwistrChain.onChain()) await TwistrChain.switchChain();
      } catch (e) {
        say(e && e.code === 4001 ? 'Refused in the wallet.'
          : 'Could not connect: ' + ((e && e.message) || 'unknown error'));
      } finally {
        // the account can be connected even when the network switch was refused
        renderPicker();
        renderWallet();
        await verifyTokens();
      }
    });

    const p = TwistrChain.hasWallet() ? window.ethereum : null;
    if (p && p.on) {
      p.on('accountsChanged', (accs) => {
        TwistrChain.state.account = (accs && accs[0]) || null;
        renderWallet(); verifyTokens();
      });
      p.on('chainChanged', (id) => {
        TwistrChain.state.chainId = id;
        renderWallet(); verifyTokens();
      });
    }
    renderWallet();
  };

  /* ---------- the door ----------
     Nobody gets to the pad without being told, in as many words, that none of
     this settles. The tick is the point: it has to be a deliberate act. */
  const GATE = 'twistr.gate.v1';

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
    /* The brand closes it too. On a phone the open menu covers the page, so
       going to the top of a page you cannot see is not going anywhere. */
    nav.querySelectorAll('.sp-nav-links a, .sp-brand').forEach((a) => a.addEventListener('click', () => set(false)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
  };

  /* ---------- wiring ---------- */

  const init = () => {
    carryOver();          // before load() or the door reads anything

    wireLogos();            // before anything renders, or the first images race it
    drawWheel($('heroWheelSvg'));
    drawWheel($('dial'));
    labelWheel($('heroWheel'));
    labelWheel(document.querySelector('.sp-wheel-big'));
    wireHeroWheel();
    renderFloaters();
    wireImage();
    wireLive();
    wireMotion();
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
      showStage(2);
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
      showStage(4);
    });

    $('launchBtn').addEventListener('click', launch);
    if ($('poolBtn')) $('poolBtn').addEventListener('click', () => openPool());

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
      const text = ['Twistr — launch record', $('tkId').textContent,
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
    if ($('fLiq')) $('fLiq').addEventListener('input', renderSummary);
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

    document.querySelectorAll('.sp-chain-name').forEach((el) => { el.textContent = CFG.chain.name; });
    if ($('scanBtn')) $('scanBtn').addEventListener('click', () => runScan(false));
    if ($('scanMore')) $('scanMore').addEventListener('click', () => runScan(true));
    if ($('lookupBtn')) $('lookupBtn').addEventListener('click', lookUp);
    if ($('lookup')) {
      $('lookup').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); lookUp(); } });
    }

    $('clear').addEventListener('click', () => {
      if (!confirm('This clears every launch recorded in this browser. The contracts stay on chain; only the local record goes.')) return;
      coins = [];
      /* Anything read off the chain goes with it, or the list would not visibly
         change and the button would look broken. It is one press to read it
         back; the local record is the only thing actually destroyed here. */
      chainCoins.clear();
      scan.head = 0;
      scan.reached = 0;
      save();
      renderProof();
    });

    document.querySelectorAll('[data-scroll]').forEach((el) => {
      el.addEventListener('click', (e) => {
        /* The brand goes to the top of the page, not to an element. #top is the
           id of the sticky bar itself, and scrolling to something that never
           moves relative to the window does nothing at all — which is exactly
           what clicking the brand did. The href stays as the no-script
           fallback, where a fragment jump does land at the top. */
        if (el.dataset.scroll === 'top') {
          e.preventDefault();
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
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
