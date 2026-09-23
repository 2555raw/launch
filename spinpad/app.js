/* Spinpad — the whole application.
 *
 * The product rule, and the reason the pad exists: a coin cannot be launched
 * until the dial has been spun, and the colour it stops on writes the
 * underlying asset. That is enforced in three independent places on purpose —
 * the launch control ships disabled, the step machine only reaches step three
 * with a resolved spin, and launch() re-checks the spin before it writes
 * anything. Re-enabling the control from a console produces nothing.
 *
 * A chain is very much involved. Launching deploys a real ERC-20 on the network
 * in config.js, from the connected wallet, and opening a pool moves real funds.
 * Nothing on the page is a generated figure any more: what a card shows is what
 * is on chain, and what is not on chain yet says so.
 */

(() => {
  'use strict';

  /* ---------- the board: four families, four quadrants, sixteen assets ----------
   *
   * Where the arrow stops gives two coordinates, and it takes both to name an
   * asset. The colour picks the family; the quadrant picks which of the four
   * names inside it. Sixteen dots on the board, sixteen assets, one to a dot.
   *
   * The assets are invented. That is deliberate and it is not decoration: this
   * pad deploys real contracts on a real chain, and a token sold under the name
   * of a listed company, or advertised as tracking one, is a different and
   * heavily regulated thing. These are houses in a board game.
   */

  // Quadrants clockwise from twelve, matching the corners of the board. A pairs
  // trade has two legs and two sides; so does this.
  const QUADRANTS = [
    { id: 'bid',   label: 'bid hand',  short: 'Bid hand' },
    { id: 'ask',   label: 'ask hand',  short: 'Ask hand' },
    { id: 'short', label: 'short leg', short: 'Short leg' },
    { id: 'long',  label: 'long leg',  short: 'Long leg' },
  ];

  // One mark per asset, drawn rather than fetched: sixteen files would be
  // sixteen requests for something that is four hundred bytes of path data.
  const GLYPHS = {
    // the signs money already has: nobody's trademark, and instantly readable
    dollar:   'M12 3.5v17M15.8 7.6c-.7-1.2-2.1-2-3.8-2-2.3 0-4 1.3-4 3.2 0 4.4 8 2.4 8 6.8 0 1.9-1.8 3.3-4.1 3.3-1.9 0-3.5-.9-4.1-2.3',
    euro:     'M18 7.2A6.2 6.2 0 0 0 13.6 5C10 5 7 8.1 7 12s3 7 6.6 7A6.2 6.2 0 0 0 18 16.8M4.5 10.3h8M4.5 13.7h8',
    ether:    'M12 3l5.5 9L12 15.2 6.5 12zM12 17l5.5-3.2L12 21l-5.5-7.2z',
    etherRing:'M12 3.4l4.6 7.6L12 13.6 7.4 11zM12 15.2l4.6-2.7L12 20.6l-4.6-8.1zM12 3.4v17.2',
    etherArc: 'M12 3.4l4.6 7.6L12 13.6 7.4 11zM12 15.2l4.6-2.7L12 20.6l-4.6-8.1zM4 12a8 8 0 0 0 16 0',
    etherDot: 'M12 4.4l4.2 6.9L12 13.7 7.8 11.3zM12 15.1l4.2-2.5L12 19.6l-4.2-7zM19.5 19.5h.01',
    bitcoin:  'M9 6.5h4.6a2.8 2.8 0 0 1 0 5.5H9zM9 12h5.2a2.8 2.8 0 0 1 0 5.5H9zM9 6.5v11M11.4 4v2.5M11.4 17.5V20M14.4 4v2.5M14.4 17.5V20M6.6 6.5h2.6M6.6 17.5h2.6',
    bitcoinB: 'M8.5 6h4.8a2.7 2.7 0 0 1 0 5.4H8.5zM8.5 11.4h5.4a2.8 2.8 0 0 1 0 5.6H8.5zM8.5 6v11M12 3.6V6M12 17v2.4',
    bitcoinO: 'M12 3.6a8.4 8.4 0 1 0 0 16.8 8.4 8.4 0 0 0 0-16.8M10 8h3.4a2.2 2.2 0 0 1 0 4.4H10zM10 12.4h3.8a2.2 2.2 0 0 1 0 4.4H10zM10 8v8.8',
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

  const CFG = window.SPINPAD_CONFIG;

  // The board is built from config.js so there is exactly one place where an
  // address lives, and it is the place the verifier checks.
  const FAMILIES = {};
  ['green', 'yellow', 'blue', 'red'].forEach((k) => {
    const c = CFG.assets[k];
    FAMILIES[k] = {
      id: k,
      label: k[0].toUpperCase() + k.slice(1),
      family: c.family,
      blurb: c.blurb,
      assets: { bid: c.bid, ask: c.ask, short: c.short, long: c.long },
    };
  });

  const HEX = { green: '#2FA84F', yellow: '#FDD208', blue: '#1B75BC', red: '#E4322B' };

  const ORDER = ['blue', 'red', 'green', 'yellow'];

  const BASE = ['green', 'yellow', 'blue', 'red'];
  const SECTORS = [];
  for (let q = 0; q < 4; q++) {
    for (let k = 0; k < 4; k++) {
      SECTORS.push({ color: BASE[(k + q) % 4], quadrant: QUADRANTS[q].id });
    }
  }

  const assetOf = (color, quadrant) => FAMILIES[color].assets[quadrant];
  const quadOf = (id) => QUADRANTS.find((q) => q.id === id) || QUADRANTS[0];

  const drawn = (glyph, size) => `<svg class="lv-glyph" viewBox="0 0 24 24" width="${size}" height="${size}"
      fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
      aria-hidden="true"><path d="${GLYPHS[glyph] || GLYPHS.chevron}"/></svg>`;

  /* A square's own logo when there is a file for it, and the drawn mark when
     there is not.
     
     Both are rendered, one on top of the other, and the image only becomes
     visible once it has actually loaded. An onerror handler was the obvious way
     to do this and it did not work — sixteen missing files left sixteen broken
     images on the board — so the fallback is now the default state rather than
     a recovery from one. A square with no logo file costs nothing. */
  const mark = (asset, size) => {
    const glyph = typeof asset === 'string' ? asset : (asset && asset.glyph);
    const logo = typeof asset === 'string' ? '' : (asset && asset.logo);
    const svg = drawn(glyph, size);
    if (!logo) return svg;
    return `<span class="lv-mark" style="width:${size}px;height:${size}px">${svg}`
      + `<img class="lv-logo" src="${esc(logo)}" alt="" width="${size}" height="${size}"`
      + ` onload="this.parentNode.classList.add('has-logo')"></span>`;
  };

  const SEG = 360 / SECTORS.length;   // 22.5 degrees between dots
  const EXPECTED = 100 / 4;           // four of sixteen dots per family
  /* v3 because the shape changed twice: v1 stored a colour-only pairing, and v2
     stored supply as whole tokens where this stores a wei string. An old record
     read with this code shows a supply of 0 and counts coins that were never
     deployed, so the key moves rather than the reader guessing. */
  const KEY = 'spinpad.coins.v3';

  /* ---------- helpers ---------- */

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const rnd = (n) => {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] % n;           // 2^32 is a multiple of 16: no modulo bias
  };

  const num = (n) => n.toLocaleString('en-US');

  const ago = (ts) => {
    const s = Math.max(0, (Date.now() - ts) / 1000);
    if (s < 60) return Math.floor(s) + 's ago';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    return Math.floor(s / 86400) + 'd ago';
  };


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

  /* ---------- drawing the board ---------- */

  const dotAt = (i, r) => {
    const rad = (i * SEG + SEG / 2 - 90) * Math.PI / 180;
    return [100 + r * Math.cos(rad), 100 + r * Math.sin(rad)];
  };

  // Sixteen loose dots on a ring, a dashed cross marking the quadrants, and the
  // name in the middle — the board as it is printed, not a pie chart.
  const drawDial = (svg) => {
    let out = '<rect x="3" y="3" width="194" height="194" rx="12" fill="#FCFBF7" stroke="#E4E2DA" stroke-width="1.5"/>';
    out += '<path d="M100 14 V186 M14 100 H186" stroke="#D9D6CC" stroke-width="1" stroke-dasharray="3 4"/>';

    SECTORS.forEach((sec, i) => {
      const [x, y] = dotAt(i, 71);
      out += `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="13" fill="${HEX[sec.color]}" stroke="#FCFBF7" stroke-width="2"/>`
           + `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="13" fill="none" stroke="rgba(23,26,31,.16)" stroke-width="1"/>`;
    });

    out += '<text x="100" y="66" text-anchor="middle" class="lv-dial-word">SPINPAD</text>';
    out += '<text x="100" y="146" text-anchor="middle" class="lv-dial-word-2">16 DOTS \u00B7 16 ASSETS</text>';
    svg.innerHTML = out;
  };

  /* ---------- the mat, and the figure standing on it ----------
   *
   * Rows are the four limbs, columns the four colour families, so a circle on
   * the mat is exactly one cell of the pairing table. Tap one and that limb
   * walks onto it; when the arrow resolves, the same thing happens by itself.
   */

  const MAT_COLS = ['green', 'yellow', 'blue', 'red'];   // the board's own order
  // one row per limb, hands on top, feet below, like a figure facing the mat
  const MAT_ROWS = ['bid', 'ask', 'short', 'long'];

  const mat = { bid: 0, ask: 2, short: 1, long: 3, sel: 'bid' };

  // Offsets walked up to the floor, not getBoundingClientRect: the floor is
  // rotated in 3D, so a client rect would come back projected. offsetLeft/Top
  // are plain layout coordinates, which is what the overlay needs.
  const offsetIn = (el, root) => {
    let x = 0, y = 0, n = el;
    while (n && n !== root) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    return [x, y];
  };

  const dotCentre = (row, col, floor) => {
    const d = document.querySelector(`.lv-mat-dot[data-row="${row}"][data-col="${col}"]`);
    if (!d) return null;
    const [x, y] = offsetIn(d, floor);
    return [x + d.offsetWidth / 2, y + d.offsetHeight / 2];
  };

  const renderMatDots = () => {
    const rows = $('matRows');
    if (!rows) return;
    rows.innerHTML = MAT_ROWS.map((qid, r) => {
      const q = quadOf(qid);
      return `<div class="lv-mat-row" role="group" aria-label="${esc(q.short)}">`
        + `<span class="lv-mat-rowlabel">${esc(q.short)}</span>`
        + MAT_COLS.map((ck, c) => {
        const as = assetOf(ck, qid);
        return `<button class="lv-mat-dot" type="button" data-color="${ck}" data-row="${r}" data-col="${c}"
                  aria-label="${esc(q.short)} on ${esc(FAMILIES[ck].family)} — ${esc(as.name)}"
                  title="${esc(q.short)} · ${esc(FAMILIES[ck].family)} → ${esc(as.name)} (${esc(as.ticker)})"><i>${mark(as, 22)}<span>${esc(as.ticker)}</span></i></button>`;
      }).join('') + '</div>';
    }).join('');
  };

  // A quadratic with the control point pushed off the straight line, so an arm
  // reaching across the mat bends like an arm instead of pointing like a stick.
  const limbPath = (ax, ay, tx, ty, bend) => {
    const mx = (ax + tx) / 2, my = (ay + ty) / 2;
    const dx = tx - ax, dy = ty - ay;
    const len = Math.hypot(dx, dy) || 1;
    return `M${ax.toFixed(1)} ${ay.toFixed(1)} Q${(mx - dy / len * bend).toFixed(1)} ${(my + dx / len * bend).toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)}`;
  };

  const renderFigure = () => {
    const svg = $('matFigure');
    const floor = document.querySelector('.lv-mat-floor');
    if (!svg || !floor) return;

    const W = floor.clientWidth, H = floor.clientHeight;
    if (!W || !H) return;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

    const target = {};
    MAT_ROWS.forEach((qid, r) => { target[qid] = dotCentre(r, mat[qid], floor); });
    if (MAT_ROWS.some((q) => !target[q])) return;

    // the torso sits between the two hand rows and the two leg rows, centred on
    // the columns, so the figure stays in proportion at any width
    const rowY = (r) => (dotCentre(r, 0, floor) || [0, 0])[1];
    const colXs = MAT_COLS.map((_, c) => (dotCentre(0, c, floor) || [0, 0])[0]);
    const cx = colXs.reduce((s2, v) => s2 + v, 0) / colXs.length;
    const shY = (rowY(0) + rowY(1)) / 2;
    const hipY = (rowY(2) + rowY(3)) / 2;
    const reach = Math.max(8, (hipY - shY) * 0.16);

    const limbs = [
      { id: 'bid',   ax: cx, ay: shY,  bend:  reach },
      { id: 'ask',   ax: cx, ay: shY,  bend: -reach },
      { id: 'short', ax: cx, ay: hipY, bend:  reach * 0.9 },
      { id: 'long',  ax: cx, ay: hipY, bend: -reach * 0.9 },
    ];

    // Seen from above, so the head sits on the shoulders rather than over them:
    // torso first, limbs on it, then the head capping the top of the spine.
    const grip = Math.max(5, W * 0.016);
    let out = `<path class="lv-fig-body" d="M${cx.toFixed(1)} ${shY.toFixed(1)} L${cx.toFixed(1)} ${hipY.toFixed(1)}"/>`;
    limbs.forEach((l) => {
      const [tx, ty] = target[l.id];
      out += `<path class="lv-fig-limb" d="${limbPath(l.ax, l.ay, tx, ty, l.bend)}"/>`;
    });
    out += `<circle class="lv-fig-joint" cx="${cx.toFixed(1)}" cy="${hipY.toFixed(1)}" r="${(grip * 0.55).toFixed(1)}"/>`;
    out += `<circle class="lv-fig-head" cx="${cx.toFixed(1)}" cy="${shY.toFixed(1)}" r="${(grip * 1.35).toFixed(1)}"/>`;
    limbs.forEach((l) => {
      const [tx, ty] = target[l.id];
      out += `<circle class="lv-fig-grip" data-limb="${l.id}" cx="${tx.toFixed(1)}" cy="${ty.toFixed(1)}" r="${grip.toFixed(1)}">`
           + `<title>${esc(quadOf(l.id).short)} — drag along this row</title></circle>`;
    });
    svg.innerHTML = out;

    [...document.querySelectorAll('.lv-mat-dot')].forEach((d) => {
      d.classList.toggle('is-under', mat[MAT_ROWS[Number(d.dataset.row)]] === Number(d.dataset.col));
    });
  };

  const renderMatLimbs = () => {
    const box = $('matLimbs');
    if (!box) return;
    box.innerHTML = MAT_ROWS.map((qid) => {
      const q = quadOf(qid);
      const ck = MAT_COLS[mat[qid]];
      const as = assetOf(ck, qid);
      return `<button class="lv-mat-limb${mat.sel === qid ? ' is-sel' : ''}" type="button" data-limb="${qid}">
          <i class="lv-dot" data-color="${ck}"></i>
          <span>${esc(q.short)}</span>
          <em>${esc(as.name)}</em>
        </button>`;
    }).join('');

    const q = quadOf(mat.sel);
    const ck = MAT_COLS[mat[mat.sel]];
    const as = assetOf(ck, mat.sel);
    $('matRead').textContent =
      `${q.short} on ${FAMILIES[ck].label.toLowerCase()} → ${as.name} (${as.ticker}). ` +
      `${FAMILIES[ck].family} is ${FAMILIES[ck].blurb}; the ${q.label} picks the name inside it.`;
  };

  // The spinner's crosshair, laid under the circles so the mat reads as the same
   // object the arrow turns on.
  const renderCross = () => {
    const svg = $('matCross');
    const floor = document.querySelector('.lv-mat-floor');
    if (!svg || !floor) return;
    const W = floor.clientWidth, H = floor.clientHeight;
    if (!W || !H) return;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

    const xs = MAT_COLS.map((_, c) => (dotCentre(0, c, floor) || [0, 0])[0]);
    const ys = MAT_ROWS.map((_, r) => (dotCentre(r, 0, floor) || [0, 0])[1]);
    if (!xs[0] || !ys[0]) return;
    const cx = (xs[1] + xs[2]) / 2, cy = (ys[1] + ys[2]) / 2;
    const pad = W * 0.03;

    svg.innerHTML =
      `<path d="M${cx.toFixed(1)} ${pad.toFixed(1)} V${(H - pad).toFixed(1)} M${pad.toFixed(1)} ${cy.toFixed(1)} H${(W - pad).toFixed(1)}"
             stroke="rgba(23,26,31,.22)" stroke-width="1.5" stroke-dasharray="5 6"/>` +
      `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="3" fill="rgba(23,26,31,.22)"/>`;
  };

  // The pairing table, written out. Built from the same tables the board is
  // drawn from, so the desk cannot advertise a pairing the arrow will not give.
  const renderMatrix = () => {
    const el = $('matrix');
    if (!el) return;
    el.innerHTML = `
      <div class="lv-matrix-row lv-matrix-head">
        <span>Family</span>
        ${QUADRANTS.map((q) => `<span>${esc(q.short)}</span>`).join('')}
      </div>
      ${ORDER.map((k) => {
        const f = FAMILIES[k];
        return `
          <div class="lv-matrix-row" data-color="${k}">
            <span class="lv-matrix-fam"><i class="lv-dot" data-color="${k}"></i><b>${esc(f.family)}</b><em>${esc(f.blurb)}</em></span>
            ${QUADRANTS.map((q) => {
              const as = f.assets[q.id];
              return `<span class="lv-matrix-cell">${mark(as, 18)}<b>${esc(as.name)}</b><em>${esc(as.ticker)}</em></span>`;
            }).join('')}
          </div>`;
      }).join('')}`;
  };

  /* The spheres behind the hero: seven of the sixteen, drawn from the board so
     they can never advertise a token the board does not hold. */
  const ORB_LAYOUT = [
    { color: 'green',  q: 'bid',   cls: 'lv-orb-1' },
    { color: 'red',    q: 'ask',   cls: 'lv-orb-2' },
    { color: 'blue',   q: 'bid',   cls: 'lv-orb-3' },
    { color: 'yellow', q: 'short', cls: 'lv-orb-4' },
    { color: 'blue',   q: 'long',  cls: 'lv-orb-5' },
    { color: 'green',  q: 'short', cls: 'lv-orb-6' },
    { color: 'yellow', q: 'bid',   cls: 'lv-orb-7' },
  ];

  const renderOrbs = () => {
    const box = document.querySelector('.lv-orbs');
    if (!box) return;
    box.innerHTML = ORB_LAYOUT.map((o) => {
      const as = assetOf(o.color, o.q);
      return `<span class="lv-orb ${o.cls}" data-color="${o.color}">${mark(as, 26)}<b>${esc(as.ticker)}</b></span>`;
    }).join('');
  };

  const renderMat = () => {
    renderMatDots();
    // one frame, so the grid has been laid out before the overlays measure it
    requestAnimationFrame(() => { renderCross(); renderFigure(); });
    renderMatLimbs();
  };

  /* Dragging works by asking the document what is under the pointer rather than
     by mapping coordinates: the floor is rotated in 3D, so hit testing is the
     only cheap way to get this right. The limb steps from circle to circle as
     the pointer sweeps its row, and a drop outside the row simply leaves it
     where it was. */
  const drag = { limb: null, id: null };

  const dragTo = (x, y) => {
    const el = document.elementFromPoint(x, y);
    const dot = el && el.closest ? el.closest('.lv-mat-dot') : null;
    if (!dot) return;
    if (MAT_ROWS[Number(dot.dataset.row)] !== drag.limb) return;   // stay in your own row
    const col = Number(dot.dataset.col);
    if (mat[drag.limb] === col) return;
    mat[drag.limb] = col;
    renderFigure();
    renderMatLimbs();
  };

  const startDrag = (e) => {
    const grip = e.target.closest ? e.target.closest('.lv-fig-grip') : null;
    if (!grip || !grip.dataset.limb) return;
    drag.limb = grip.dataset.limb;
    drag.id = e.pointerId;
    mat.sel = drag.limb;
    document.querySelector('.lv-mat').classList.add('is-dragging');
    const row = document.querySelectorAll('.lv-mat-row')[MAT_ROWS.indexOf(drag.limb)];
    if (row) row.classList.add('is-live');
    try { $('matFigure').setPointerCapture(e.pointerId); } catch (e2) { /* no capture, moves still land */ }
    renderMatLimbs();
    e.preventDefault();
  };

  const endDrag = () => {
    if (!drag.limb) return;
    const row = document.querySelectorAll('.lv-mat-row')[MAT_ROWS.indexOf(drag.limb)];
    if (row) row.classList.remove('is-live');
    document.querySelector('.lv-mat').classList.remove('is-dragging');
    drag.limb = null;
    drag.id = null;
  };

  // the figure follows the draw: the limb the arrow named walks onto its colour
  const matFollow = (sector) => {
    const col = MAT_COLS.indexOf(sector.color);
    if (col < 0) return;
    mat[sector.quadrant] = col;
    mat.sel = sector.quadrant;
    renderFigure();
    renderMatLimbs();
    const dot = document.querySelector(`.lv-mat-dot[data-row="${MAT_ROWS.indexOf(sector.quadrant)}"][data-col="${col}"]`);
    if (dot) { dot.classList.remove('is-drawn'); void dot.offsetWidth; dot.classList.add('is-drawn'); }
  };

  /* ---------- metrics ---------- */

  const tally = () => {
    const counts = { blue: 0, red: 0, green: 0, yellow: 0 };
    coins.forEach((c) => { if (counts[c.color] !== undefined) counts[c.color]++; });
    return counts;
  };

  const renderKpis = () => {
    const counts = tally();
    const total = coins.length;
    const shares = ORDER.map((k) => ({ k, pct: total ? counts[k] / total * 100 : 0 }));
    const most = shares.slice().sort((a, b) => b.pct - a.pct)[0];
    const wide = shares.slice().sort((a, b) => Math.abs(b.pct - EXPECTED) - Math.abs(a.pct - EXPECTED))[0];
    const gap = wide.pct - EXPECTED;

    const tiles = [
      ['Launches recorded', num(total), total === 1 ? 'coin' : 'coins'],
      ['Launched on ' + CFG.chain.name, num(total), total === 1 ? 'contract' : 'contracts'],
      ['Most drawn family', total ? FAMILIES[most.k].family : '—', total ? most.pct.toFixed(1) + '%' : ''],
      ['Widest deviation', total ? (gap >= 0 ? '+' : '') + gap.toFixed(1) : '—', total ? 'pts · ' + FAMILIES[wide.k].family : ''],
    ];

    $('kpis').innerHTML = tiles.map(([label, value, note]) => `
      <dl class="lv-kpi">
        <dt>${esc(label)}</dt>
        <dd>${esc(value)}${note ? `<small>${esc(note)}</small>` : ''}</dd>
      </dl>`).join('');
  };

  const renderMeter = () => {
    const counts = tally();
    const total = coins.length;
    const max = Math.max(EXPECTED + 6, ...ORDER.map((k) => (total ? counts[k] / total * 100 : 0)));

    $('meter').innerHTML = ORDER.map((k, i) => {
      const f = FAMILIES[k];
      const pct = total ? counts[k] / total * 100 : 0;
      const gap = pct - EXPECTED;
      const tip = `${f.family}: ${counts[k]} of ${total} launches, ${pct.toFixed(1)}% against an expected 25% (${gap >= 0 ? '+' : ''}${gap.toFixed(1)} pts)`;
      return `
        <div class="lv-meter-row" data-color="${k}" title="${esc(tip)}">
          <span class="lv-meter-name"><i class="lv-dot" data-color="${k}"></i>${esc(f.family)}</span>
          <span class="lv-meter-track">
            <span class="lv-meter-fill" style="width:${(pct / max * 100).toFixed(2)}%"></span>
            <span class="lv-meter-ref" style="left:${(EXPECTED / max * 100).toFixed(2)}%">${i === 0 ? '<span>expected 25%</span>' : ''}</span>
          </span>
          <span class="lv-meter-val">${pct.toFixed(1)}%<small>${counts[k]} of ${total}</small></span>
        </div>`;
    }).join('');

    $('meterNote').textContent = total
      ? `Based on ${total} launch${total === 1 ? '' : 'es'} recorded in this browser, sample launches included. A short record wanders from 25% freely; the board itself is flat by construction.`
      : 'No launches recorded yet. Each family holds four of the board’s sixteen dots.';
  };

  /* ---------- coin cards ---------- */

  const view = { filter: 'all', sort: 'new', q: '' };

  const visible = () => {
    let list = coins.slice();
    if (view.filter !== 'all') list = list.filter((c) => c.color === view.filter);
    if (view.q) {
      const q = view.q.toLowerCase();
      list = list.filter((c) => (c.name + ' ' + c.ticker).toLowerCase().includes(q));
    }
    const by = { new: (a, b) => b.ts - a.ts, supply: (a, b) => Number(BigInt(b.supply) - BigInt(a.supply)), name: (a, b) => a.name.localeCompare(b.name) };
    return list.sort(by[view.sort] || by.new);
  };

  const short = (addr) => (addr ? addr.slice(0, 6) + '\u2026' + addr.slice(-4) : '');

  const coinCard = (c) => {
    const f = FAMILIES[c.color];
    const as = assetOf(c.color, c.quadrant);
    const link = c.address ? SpinpadChain.explorerAddress(c.address) : null;
    return `
      <article class="lv-coin" data-color="${c.color}">
        <div class="lv-coin-top">
          <span class="lv-coin-code">${esc(as.ticker)}</span>
          <span class="lv-disc">${mark(as, 34)}<i>${esc(as.ticker)}</i></span>
          <span class="lv-coin-age">${ago(c.ts)}</span>
        </div>
        <div class="lv-coin-body">
          <div class="lv-coin-title">
            <h3>${esc(c.name)}</h3>
            <span class="lv-coin-pill">${esc(c.ticker)}</span>
          </div>
          <p class="lv-coin-sub">drew ${esc(as.name)} \u00b7 ${esc(f.family)} ${esc(quadOf(c.quadrant).label)}</p>
          ${c.desc ? `<p class="lv-coin-desc">${esc(c.desc)}</p>` : ''}
          <dl class="lv-coin-facts">
            <div><dt>Supply</dt><dd>${esc(num(Number(BigInt(c.supply) / (10n ** 18n))))}</dd></div>
            <div><dt>Contract</dt><dd>${link
              ? `<a href="${esc(link)}" target="_blank" rel="noopener noreferrer">${esc(short(c.address))}</a>`
              : 'pending'}</dd></div>
            <div><dt>Pool</dt><dd>${c.poolTx
              ? `<a href="${esc(SpinpadChain.explorerTx(c.poolTx))}" target="_blank" rel="noopener noreferrer">opened</a>`
              : 'not opened'}</dd></div>
          </dl>
        </div>
      </article>`;
  };

  const renderTicker = () => {
    const last = coins.slice().sort((a, b) => b.ts - a.ts).slice(0, 10);
    if (!last.length) { $('tickerTrack').innerHTML = ''; return; }
    const one = last.map((c) => {
      const as = assetOf(c.color, c.quadrant);
      return `<span class="lv-tick"><i class="lv-dot" data-color="${c.color}"></i><b>${esc(c.ticker)}</b> drew ${esc(FAMILIES[c.color].label.toLowerCase())} on the ${esc(quadOf(c.quadrant).label)} → ${esc(as.name)} · ${ago(c.ts)}</span>`;
    }).join('');
    $('tickerTrack').innerHTML = one + one;   // two copies: the marquee loops at -50%
  };

  const renderBoard = () => {
    const list = visible();
    $('grid').innerHTML = list.map(coinCard).join('');
    $('empty').hidden = list.length > 0;
    $('count').textContent = `Showing ${list.length} of ${coins.length} coins · deployed from this browser`;
    renderTicker();
    renderKpis();
    renderMeter();
  };

  /* ---------- the pad ---------- */

  const pad = $('pad');
  const flow = { step: 1, draft: null, spin: null, spinning: false, rot: 0, sending: false, minted: null };

  /* What the chain said about the list in config.js. Nothing launches against
     an entry that is not in here with ok: true. */
  let quoteOk = null;
  let routerOk = null;

  const setStep = (n) => {
    flow.step = n;
    pad.dataset.step = String(n);
    [...$('steps').children].forEach((li) => {
      const s = Number(li.dataset.step);
      li.classList.toggle('is-on', s === n);
      li.classList.toggle('is-done', s < n);
    });

    $('fields').disabled = n > 1;
    $('toSpin').hidden = n > 1;
    $('backToForm').hidden = n !== 2 || flow.spinning;
    $('discard').hidden = n !== 3;
    $('spin').disabled = n !== 2 || flow.spinning || !!flow.spin;
    $('launchBtn').disabled = n !== 3 || !flow.spin;
    $('spinCount').textContent = 'Spins ' + (flow.spin ? 1 : 0) + '/1';
  };

  const err = (id, msg) => {
    const box = document.querySelector(`.lv-err[data-for="${id}"]`);
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

    let ok = true;
    ok = err('fName', name.length < 2 || name.length > 32 ? 'Between 2 and 32 characters.' : '') && ok;
    ok = err('fTicker', /^[A-Z0-9]{2,8}$/.test(ticker) ? '' : '2 to 8 letters or digits, no spaces.') && ok;
    ok = err('fSupply', !supply || supply < 1000 || supply > 1e12 ? 'Between 1,000 and 1,000,000,000,000.' : '') && ok;
    ok = err('fDesc', desc.length > 140 ? '140 characters maximum.' : '') && ok;
    if (coins.some((c) => c.ticker === ticker)) ok = err('fTicker', 'That ticker is already on the board.') && ok;

    return ok ? { name, ticker, supply, desc } : null;
  };

  // The right-hand column mirrors the draft as it is typed, and the asset row
  // stays empty until the dial has actually resolved.
  const renderSummary = () => {
    const ticker = ($('fTicker').value.trim().toUpperCase() || 'TICKER');
    const name = $('fName').value.trim() || 'Your coin';
    const supply = Number($('fSupply').value.replace(/\D/g, ''));
    const f = flow.spin ? FAMILIES[flow.spin.color] : null;
    const as = flow.spin ? assetOf(flow.spin.color, flow.spin.quadrant) : null;

    $('preview').dataset.color = flow.spin ? flow.spin.color : 'none';
    $('pvTicker').textContent = ticker;
    $('pvAsset').textContent = as ? as.ticker : 'UNPAIRED';

    $('sumName').textContent = name;
    $('sumSub').textContent = ticker + ' · ' + (as ? 'paired with ' + as.name : 'not yet paired');

    $('sumRows').innerHTML = [
      ['Underlying asset', as ? as.name + ' (' + as.ticker + ')' : 'Drawn at launch', false],
      ['Family', f ? f.family + ' · ' + f.label.toLowerCase() : 'Drawn at launch', false],
      ['Quadrant', flow.spin ? quadOf(flow.spin.quadrant).short : 'Drawn at launch', false],
      ['Total supply', supply ? num(supply) : 'Not set', true],
      ['Spins used', (flow.spin ? 1 : 0) + ' of 1', true],
      ['Opening cap', 'Set at launch', false],
    ].map(([k, v, mono]) => `<div><dt>${esc(k)}</dt><dd${mono ? ' class="is-mono"' : ''}>${esc(v)}</dd></div>`).join('');
  };

  const doSpin = () => {
    if (flow.step !== 2 || flow.spin || flow.spinning) return;
    flow.spinning = true;
    setStep(2);
    $('status').textContent = 'Spinning. The arrow decides the pairing, not you.';

    const i = rnd(SECTORS.length);
    const centre = i * SEG + SEG / 2;
    const jitter = (rnd(1000) / 1000 - 0.5) * (SEG - 6);
    const turns = 5 + rnd(3);
    const delta = (((centre + jitter) - flow.rot) % 360 + 360) % 360;
    flow.rot += turns * 360 + delta;

    const needle = $('needle');
    needle.style.transform = `rotate(${flow.rot}deg)`;

    const done = () => {
      needle.removeEventListener('transitionend', done);
      clearTimeout(guard);
      resolveSpin(SECTORS[i]);
    };
    needle.addEventListener('transitionend', done);
    // transitionend never fires on a tab backgrounded mid-spin
    const guard = setTimeout(done, 5200);
  };

  // Where the asset actually lands in the form, the instant the arrow stops.
  const resolveSpin = (sector) => {
    if (flow.spin) return;
    flow.spinning = false;
    flow.spin = sector;

    const f = FAMILIES[sector.color];
    const q = quadOf(sector.quadrant);
    const as = assetOf(sector.color, sector.quadrant);
    const res = $('result');
    res.hidden = false;
    res.dataset.color = sector.color;
    $('resDot').dataset.color = sector.color;
    $('resColor').textContent = as.name + ' · ' + as.ticker;
    $('resLimb').textContent = f.label + ' on the ' + q.label + ' · ' + f.family;
    $('resLine').textContent = `${f.label} puts you in ${f.family}; the ${q.label} picks ${as.name} out of it. The pairing is written into the launch and cannot be re-rolled.`;

    $('assetSlot').dataset.color = sector.color;
    $('assetName').textContent = as.name + ' · ' + as.ticker;
    $('assetHint').textContent = 'Locked';
    $('status').textContent = `${f.label} on the ${q.label} — ${as.name}. The asset is filled in and the launch control is open.`;

    setStep(3);
    renderSummary();
    matFollow(sector);
  };

  const say = (msg) => { $('status').textContent = msg; };

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
    if (!flow.spin || !flow.draft || flow.step !== 3) {
      say('No spin on record. Nothing launches here without one.');
      setStep(flow.step);
      return;
    }
    if (flow.sending) return;

    const f = FAMILIES[flow.spin.color];
    const as = assetOf(flow.spin.color, flow.spin.quadrant);
    const q = quadOf(flow.spin.quadrant);

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
        family: f.family,
        quadrant: q.label,
      });
    } catch (e) {
      flow.sending = false;
      setStep(3);
      say(e && e.code === 4001 ? 'Rejected in the wallet. Nothing was sent.'
        : 'The wallet refused the transaction: ' + ((e && e.message) || 'unknown error'));
      return;
    }

    say('Sent. Waiting for it to be mined — this usually takes a few seconds.');
    let receipt;
    try {
      receipt = await SpinpadChain.waitForReceipt(hash, (i) => {
        if (i && i % 5 === 0) say(`Still waiting (${i * 2}s). The hash is ${hash.slice(0, 10)}\u2026`);
      });
    } catch (e) {
      flow.sending = false;
      setStep(3);
      say((e && e.message) || 'Could not confirm the transaction.');
      return;
    }

    const coin = {
      id: hash,
      name: flow.draft.name,
      ticker: flow.draft.ticker,
      supply: supplyWei.toString(),
      desc: flow.draft.desc,
      color: flow.spin.color,
      quadrant: flow.spin.quadrant,
      address: receipt.contractAddress,
      txHash: hash,
      poolTx: null,
      creator: SpinpadChain.state.account,
      chainId: CFG.chain.id,
      ts: Date.now(),
    };

    coins.unshift(coin);
    save();
    renderBoard();
    flow.sending = false;
    setStep(4);
    say('Deployed. The draw is written into the contract and cannot be changed.');
    showRecord(coin);
  };

  /* The first pool: approve the router for the coin, then add both sides. Two
     more confirmations, and the amount of the drawn token is whatever the
     person types — the pad never picks a number that moves someone's money. */
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
      /* Both sides, because addLiquidity pulls both with transferFrom. Only
         approving the coin is why this reverted with TRANSFER_FROM_FAILED. */
      note.textContent = 'Approving the coin for the router\u2026 confirm in your wallet.';
      await SpinpadChain.ensureAllowance(coin.address, CFG.router.address, coinAmount, (step) => {
        note.textContent = step === 'reset'
          ? 'Clearing the old allowance on the coin first\u2026'
          : 'Approving the coin for the router\u2026 confirm in your wallet.';
      });

      note.textContent = 'Now approving your ' + quote.ticker + '\u2026 confirm in your wallet.';
      await SpinpadChain.ensureAllowance(quote.address, CFG.router.address, tokenAmount, (step) => {
        note.textContent = step === 'reset'
          ? 'Clearing the old ' + quote.ticker + ' allowance first\u2026'
          : 'Now approving your ' + quote.ticker + '\u2026 confirm in your wallet.';
      });

      note.textContent = 'Approved. Confirm the liquidity itself \u2014 this is the one that moves your '
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
      renderBoard();
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
    const f = FAMILIES[coin.color];
    const q = quadOf(coin.quadrant);
    const as = assetOf(coin.color, coin.quadrant);
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
      ['Theme drawn', as.name + ' (' + as.ticker + ')', false],
      ['Colour drawn', f.label + ' \u00b7 ' + f.family, false],
      ['Quadrant', q.short, false],
      ['Total supply', num(Number(BigInt(coin.supply) / (10n ** 18n))), true],
      ['Network', CFG.chain.name, false],
    ];
    $('tkRows').innerHTML = rows
      .map(([k, v, mono]) => `<div><dt>${esc(k)}</dt><dd${mono ? ' class="is-mono"' : ''}>${esc(v)}</dd></div>`).join('')
      + (coin.address ? `<div><dt>Contract</dt><dd class="is-mono"><a href="${esc(SpinpadChain.explorerAddress(coin.address))}" target="_blank" rel="noopener noreferrer">${esc(short(coin.address))}</a></dd></div>` : '')
      + (coin.txHash ? `<div><dt>Deployment</dt><dd class="is-mono"><a href="${esc(SpinpadChain.explorerTx(coin.txHash))}" target="_blank" rel="noopener noreferrer">${esc(short(coin.txHash))}</a></dd></div>` : '');

    $('tkNote').textContent =
      `${coin.name} drew ${as.name} because the arrow stopped on a ${f.label.toLowerCase()} dot in the `
      + `${q.label} quadrant, and that is written into the contract where nothing \u2014 including this page \u2014 `
      + `can change it. It is a name on a token: nothing here tracks ${as.name}\u2019s share price, and ${as.name} `
      + `has no connection to it.`;

    if ($('poolAsset')) {
      $('poolAsset').textContent = CFG.quote.ticker;
      const pa = $('poolAssetB'); if (pa) pa.textContent = CFG.quote.ticker;
      $('poolShare').textContent = Math.round(CFG.liquidity.supplyShare * 100) + '%';
      $('poolNote').textContent = coin.poolTx
        ? 'Pool already open.'
        : 'Optional, and it is where real money moves. Two confirmations: an approval, then the liquidity itself.';
      $('poolBtn').disabled = !!coin.poolTx;
    }
    $('tkCopy').textContent = 'Copy record';
    t.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  const resetFlow = () => {
    flow.draft = null;
    flow.spin = null;
    flow.spinning = false;
    $('form').reset();
    $('fSupply').value = '1,000,000,000';
    $('descCount').textContent = '0/140';
    ['fName', 'fTicker', 'fSupply', 'fDesc'].forEach((id) => err(id, ''));
    $('result').hidden = true;
    $('ticket').hidden = true;
    $('assetSlot').dataset.color = 'none';
    $('assetName').textContent = 'Assigned by the spin';
    $('assetHint').textContent = 'Locked';
    $('status').textContent = 'Complete the details to unlock the spin.';
    setStep(1);
    renderSummary();
  };

  /* ---------- wiring ---------- */

  /* ---------- the wallet ---------- */

  const renderWallet = () => {
    const btn = $('connect');
    const line = $('walletLine');
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

  /* One address does the work now, so one address gets checked. The squares on
     the board are themes and carry no address at all. */
  const verifyTokens = async () => {
    const box = $('verify');
    if (!box) return;
    if (!SpinpadChain.state.account) { box.innerHTML = ''; return; }

    box.innerHTML = '<p class="lv-verify-head">Checking against ' + esc(CFG.chain.name) + '\u2026</p>';
    const [q, r] = await Promise.all([
      SpinpadChain.verifyToken(CFG.quote),
      SpinpadChain.verifyRouter(),
    ]);
    quoteOk = q;
    routerOk = r;

    const row = (label, res, hint) => `
      <li class="${res.ok ? 'is-ok' : 'is-bad'}">
        <i class="lv-dot" data-color="${res.ok ? 'green' : 'none'}"></i>
        <b>${esc(label)}</b><em>${esc(res.ok ? (res.symbol ? res.symbol + ' \u00b7 verified' : 'verified') : res.reason)}</em>
      </li>${hint && !res.ok ? `<li class="lv-verify-hint">${esc(hint)}</li>` : ''}`;

    box.innerHTML =
      `<p class="lv-verify-head">${q.ok && r.ok ? 'Ready to launch on ' : 'Not ready on '}${esc(CFG.chain.name)}</p>`
      + '<ul class="lv-verify-list">'
      + row('Pair token (' + CFG.quote.ticker + ')', q, 'Fill quote.address in config.js. Deploying still works; pools do not.')
      + row('Router', r, 'Fill router.address and router.weth in config.js.')
      + '</ul>'
      + '<p class="lv-verify-note">The sixteen squares are themes written into the coin, not tokens. '
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
     Nobody gets to the board without being told, in as many words, that none of
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

  /* ---------- the sort control ---------- */

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
      renderBoard();
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

  /* ---------- coming back to the tab ----------
     Replaying a CSS animation needs the class off, a reflow, then the class on:
     without the flush the browser coalesces both changes and nothing moves. */
  const bloom = () => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    document.querySelectorAll('.lv-sec-pad, .lv-orbs').forEach((el) => {
      el.classList.remove('is-blooming');
      void el.offsetWidth;
      el.classList.add('is-blooming');
    });
  };

  const init = () => {
    drawDial($('dial'));
    renderOrbs();
    renderMatrix();
    renderMat();
    wireGate();
    wireSort();
    wireWallet();
    openGate();
    const floorEl = document.querySelector('.lv-mat-floor');
    if (floorEl && window.ResizeObserver) {
      new ResizeObserver(() => { renderCross(); renderFigure(); }).observe(floorEl);
    }

    const fig = $('matFigure');
    if (fig) {
      fig.addEventListener('pointerdown', startDrag);
      fig.addEventListener('pointermove', (e) => { if (drag.limb) dragTo(e.clientX, e.clientY); });
      fig.addEventListener('pointerup', endDrag);
      fig.addEventListener('pointercancel', endDrag);
      window.addEventListener('pointerup', endDrag);
    }
    load();
    renderBoard();
    resetFlow();

    const rows = $('matRows');
    if (rows) rows.addEventListener('click', (e) => {
      const d = e.target.closest('.lv-mat-dot');
      if (!d) return;
      const qid = MAT_ROWS[Number(d.dataset.row)];
      mat[qid] = Number(d.dataset.col);
      mat.sel = qid;
      renderFigure();
      renderMatLimbs();
    });

    const limbBox = $('matLimbs');
    if (limbBox) limbBox.addEventListener('click', (e) => {
      const b = e.target.closest('.lv-mat-limb');
      if (!b) return;
      mat.sel = b.dataset.limb;
      renderMatLimbs();
    });

    $('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const draft = readForm();
      if (!draft) return;
      flow.draft = draft;
      $('status').textContent = 'Details locked. One spin decides the pairing.';
      setStep(2);
      $('spin').focus();
    });

    $('backToForm').addEventListener('click', () => {
      if (flow.spin || flow.spinning) return;     // already spun: there is no way back
      $('status').textContent = 'Complete the details to unlock the spin.';
      setStep(1);
    });

    $('spin').addEventListener('click', doSpin);
    $('launchBtn').addEventListener('click', launch);
    if ($('poolBtn')) $('poolBtn').addEventListener('click', openPool);
    if ($('connect2')) $('connect2').addEventListener('click', () => $('connect').click());

    $('discard').addEventListener('click', () => {
      if (!confirm('Discarding clears the whole draft — name, ticker, supply, description and the spin. This is starting over, not re-rolling.')) return;
      flow.rot = 0;
      const needle = $('needle');
      needle.style.transition = 'none';
      needle.style.transform = 'rotate(0deg)';
      void needle.offsetWidth;          // flush, or the transition survives and it unwinds
      needle.style.transition = '';
      resetFlow();
    });

    $('tkAgain').addEventListener('click', () => {
      resetFlow();
      $('fName').focus();
      $('form').scrollIntoView({ block: 'center', behavior: 'smooth' });
    });

    $('tkCopy').addEventListener('click', async (e) => {
      const rows = [...$('tkRows').children].map((d) => d.querySelector('dt').textContent + ': ' + d.querySelector('dd').textContent);
      const text = ['Spinpad — spin record', $('tkId').textContent,
        $('tkName').textContent + ' (' + $('tkTicker').textContent + ')', ...rows].join('\n');
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

    // Formatted on blur only: rewriting the value while the field has focus
    // fights with whatever the user is doing to it mid-edit.
    $('fSupply').addEventListener('blur', (e) => {
      const n = Number(e.target.value.replace(/\D/g, ''));
      e.target.value = n ? num(n) : '';
      renderSummary();
    });

    $('fDesc').addEventListener('input', (e) => { $('descCount').textContent = e.target.value.length + '/140'; });

    $('filters').addEventListener('click', (e) => {
      const b = e.target.closest('.lv-chip');
      if (!b) return;
      view.filter = b.dataset.filter;
      [...$('filters').children].forEach((c) => c.classList.toggle('is-on', c === b));
      renderBoard();
    });

    $('search').addEventListener('input', (e) => { view.q = e.target.value.trim(); renderBoard(); });

    $('clear').addEventListener('click', () => {
      if (!confirm('This clears every launch stored in this browser, sample launches included. It cannot be undone.')) return;
      coins = [];
      save();
      renderBoard();
    });

    document.querySelectorAll('[data-scroll]').forEach((el) => {
      el.addEventListener('click', (e) => {
        const t = document.getElementById(el.dataset.scroll);
        if (!t) return;                 // a real href still works if the id moved
        e.preventDefault();
        t.scrollIntoView({ block: 'start', behavior: 'smooth' });
      });
    });

    // the asset named in the hero cycles through the four, so the promise on the
    // page is the same one the dial makes
    const rotator = $('rotator');
    const all = [];
    ORDER.forEach((k) => QUADRANTS.forEach((q) => all.push({ k, as: FAMILIES[k].assets[q.id] })));
    if (rotator && all.length) {
      // seed it from the board, so the page never shows a token the board lost
      rotator.textContent = all[0].as.name;
      rotator.dataset.color = all[0].k;
    }
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      let r = 0;
      setInterval(() => {
        r = (r + 1) % all.length;
        rotator.textContent = all[r].as.name;
        rotator.dataset.color = all[r].k;
      }, 2000);
    }

    // which section the nav is standing in
    const links = [...document.querySelectorAll('.lv-links a')];
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        links.forEach((a) => a.classList.toggle('is-here', a.dataset.scroll === en.target.id));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ['board', 'how', 'desk', 'playground', 'launch', 'proof', 'faq'].forEach((id) => { const s = $(id); if (s) spy.observe(s); });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') bloom();
    });
    window.addEventListener('pageshow', bloom);    // and on a back/forward restore
    bloom();

    // relative timestamps should not freeze on a tab left open
    setInterval(renderBoard, 60000);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
