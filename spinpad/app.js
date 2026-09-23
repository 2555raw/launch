/* Spinpad — the whole application.
 *
 * The product rule, and the reason the pad exists: a coin cannot be launched
 * until the dial has been spun, and the colour it stops on writes the
 * underlying asset. That is enforced in three independent places on purpose —
 * the launch control ships disabled, the step machine only reaches step three
 * with a resolved spin, and launch() re-checks the spin before it writes
 * anything. Re-enabling the control from a console produces nothing.
 *
 * No chain is involved. Prices, curves, caps and holders are generated figures,
 * and the interface says so wherever they appear.
 */

(() => {
  'use strict';

  /* ---------- the board: four families, four quadrants, sixteen assets ----------
   *
   * Where the arrow stops gives two coordinates, and it takes both to name an
   * asset. The colour picks the family; the quadrant picks which of the four
   * names inside it. Sixteen dots on the board, sixteen assets, one to a dot —
   * so red on the bid hand and red on the short leg are different coins.
   */

  // Quadrants clockwise from twelve o'clock, matching the labels printed in the
  // corners of the board. A pairs trade has two legs and two sides; so does this.
  const QUADRANTS = [
    { id: 'bid',   label: 'bid hand',   short: 'Bid hand' },
    { id: 'ask',   label: 'ask hand',   short: 'Ask hand' },
    { id: 'short', label: 'short leg',  short: 'Short leg' },
    { id: 'long',  label: 'long leg',   short: 'Long leg' },
  ];

  const FAMILIES = {
    green: {
      id: 'green', label: 'Green', family: 'Silicon', blurb: 'the chip makers',
      assets: {
        bid:   { name: 'Nvidia',   ticker: 'NVDA', unit: '0.000004200' },
        ask:   { name: 'AMD',      ticker: 'AMD',  unit: '0.000012800' },
        short: { name: 'Broadcom', ticker: 'AVGO', unit: '0.000006100' },
        long:  { name: 'TSMC',     ticker: 'TSM',  unit: '0.000009400' },
      },
    },
    red: {
      id: 'red', label: 'Red', family: 'Motion', blurb: 'everything that moves',
      assets: {
        bid:   { name: 'Tesla',  ticker: 'TSLA', unit: '0.000003400' },
        ask:   { name: 'Rivian', ticker: 'RIVN', unit: '0.000071000' },
        short: { name: 'Uber',   ticker: 'UBER', unit: '0.000013500' },
        long:  { name: 'Ford',   ticker: 'F',    unit: '0.000094000' },
      },
    },
    blue: {
      id: 'blue', label: 'Blue', family: 'Signal', blurb: 'screens and feeds',
      assets: {
        bid:   { name: 'Meta',     ticker: 'META',  unit: '0.000001800' },
        ask:   { name: 'Netflix',  ticker: 'NFLX',  unit: '0.000001100' },
        short: { name: 'Spotify',  ticker: 'SPOT',  unit: '0.000002000' },
        long:  { name: 'Alphabet', ticker: 'GOOGL', unit: '0.000006300' },
      },
    },
    yellow: {
      id: 'yellow', label: 'Yellow', family: 'Shelves', blurb: 'commerce and logistics',
      assets: {
        bid:   { name: 'Amazon',  ticker: 'AMZN', unit: '0.000005100' },
        ask:   { name: 'Shopify', ticker: 'SHOP', unit: '0.000010200' },
        short: { name: 'Walmart', ticker: 'WMT',  unit: '0.000011700' },
        long:  { name: 'Coupang', ticker: 'CPNG', unit: '0.000042000' },
      },
    },
  };

  const HEX = { green: '#2FA84F', yellow: '#FDD208', blue: '#1B75BC', red: '#E4322B' };

  // Fixed reading order for the matrix, the filters and the chart. Categorical
  // identity never follows rank, so a filter or a sort cannot repaint it.
  const ORDER = ['blue', 'red', 'green', 'yellow'];

  // One asset per dot. Each quadrant carries all four colours, so every
  // (colour, quadrant) pair appears exactly once around the board.
  const BASE = ['green', 'yellow', 'blue', 'red'];
  const SECTORS = [];
  for (let q = 0; q < 4; q++) {
    for (let k = 0; k < 4; k++) {
      SECTORS.push({ color: BASE[(k + q) % 4], quadrant: QUADRANTS[q].id });
    }
  }

  const assetOf = (color, quadrant) => FAMILIES[color].assets[quadrant];
  const quadOf = (id) => QUADRANTS.find((q) => q.id === id) || QUADRANTS[0];

  const SEG = 360 / SECTORS.length;   // 22.5 degrees between dots
  const EXPECTED = 100 / 4;           // four of sixteen dots per family
  const CURVE = 69000;                // simulated cap that fills the curve
  const KEY = 'spinpad.coins.v2';     // v1 held colour-only pairings

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

  const money = (n) => n >= 1e6
    ? '$' + (n / 1e6).toFixed(1) + 'M'
    : n >= 1000 ? '$' + (n / 1000).toFixed(1) + 'K' : '$' + n;

  const ago = (ts) => {
    const s = Math.max(0, (Date.now() - ts) / 1000);
    if (s < 60) return Math.floor(s) + 's ago';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    return Math.floor(s / 86400) + 'd ago';
  };

  const initials = (t) => t.replace(/[^A-Z0-9]/gi, '').slice(0, 5).toUpperCase() || '??';

  // deterministic noise per coin, so a card's sparkline is stable across renders
  const seeded = (str) => {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return () => {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return ((h ^= h >>> 16) >>> 0) / 4294967296;
    };
  };

  /* ---------- store ---------- */

  const DEMO = [
    { name: 'Meridian Reserve', ticker: 'MRDN', color: 'red',    quadrant: 'bid',   supply: 1000000000, desc: 'Red on the bid hand, and it took the loudest name in Motion.',    cap: 48200, replies: 214, age: 41 },
    { name: 'Halden Grid',      ticker: 'HLDN', color: 'green',  quadrant: 'short', supply: 500000000,  desc: 'Silicon, short leg. Not the chip anyone asks for first.',         cap: 31800, replies: 96,  age: 96 },
    { name: 'Copperline',       ticker: 'CPRL', color: 'blue',   quadrant: 'ask',   supply: 1000000000, desc: 'Signal on the ask hand: the feed nobody expected to draw.',       cap: 12400, replies: 41,  age: 180 },
    { name: 'Vantage Point',    ticker: 'VNTG', color: 'yellow', quadrant: 'long',  supply: 210000000,  desc: 'Shelves, long leg. Logistics by accident rather than by plan.',   cap: 8100,  replies: 27,  age: 320 },
    { name: 'Solace Works',     ticker: 'SLCE', color: 'green',  quadrant: 'long',  supply: 888888888,  desc: 'Sixteen dots on the board, and this is the one the arrow found.', cap: 5600,  replies: 12,  age: 615 },
  ];

  const seed = () => DEMO.map((d, i) => ({
    id: 'sample-' + (i + 1),
    name: d.name, ticker: d.ticker, color: d.color, quadrant: d.quadrant,
    supply: d.supply, desc: d.desc, cap: d.cap, replies: d.replies,
    ts: Date.now() - d.age * 60000, demo: true,
  }));

  let coins = [];

  const load = () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw === null) { coins = seed(); save(); return; }
      const parsed = JSON.parse(raw);
      coins = Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      coins = seed();              // storage blocked or corrupt: run from memory
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
                  title="${esc(q.short)} · ${esc(FAMILIES[ck].family)} → ${esc(as.name)} (${esc(as.ticker)})"><i><span>${esc(as.ticker)}</span></i></button>`;
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
      out += `<circle class="lv-fig-grip" cx="${tx.toFixed(1)}" cy="${ty.toFixed(1)}" r="${grip.toFixed(1)}"/>`;
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

  const renderMat = () => {
    renderMatDots();
    // one frame, so the grid has been laid out before the overlay measures it
    requestAnimationFrame(renderFigure);
    renderMatLimbs();
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
    const sum = coins.reduce((a, c) => a + c.cap, 0);
    const shares = ORDER.map((k) => ({ k, pct: total ? counts[k] / total * 100 : 0 }));
    const most = shares.slice().sort((a, b) => b.pct - a.pct)[0];
    const wide = shares.slice().sort((a, b) => Math.abs(b.pct - EXPECTED) - Math.abs(a.pct - EXPECTED))[0];
    const gap = wide.pct - EXPECTED;

    const tiles = [
      ['Launches recorded', num(total), total === 1 ? 'coin' : 'coins'],
      ['Combined cap', money(sum), 'simulated'],
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
    const by = { new: (a, b) => b.ts - a.ts, cap: (a, b) => b.cap - a.cap, replies: (a, b) => b.replies - a.replies };
    return list.sort(by[view.sort]);
  };

  const sparkline = (coin) => {
    const rand = seeded(coin.id + coin.ticker);
    const n = 46, walk = [];
    let v = 0;
    for (let i = 0; i < n; i++) { v += (rand() - 0.5) * 0.26; walk.push(v); }
    // normalised to its own range, so a quiet series still fills the box
    const lo = Math.min(...walk), hi = Math.max(...walk), span = (hi - lo) || 1;
    const pts = walk.map((y, i) => [
      (i / (n - 1) * 100).toFixed(2),
      (40 - (y - lo) / span * 34).toFixed(2),
    ]);
    const line = pts.map((p) => p.join(',')).join(' ');
    const area = `0,44 ${line} 100,44`;
    return `
      <svg class="lv-spark" viewBox="0 0 100 44" preserveAspectRatio="none" aria-hidden="true">
        <polygon points="${area}" fill="var(--c)" opacity=".1"/>
        <polyline points="${line}" fill="none" stroke="#171A1F" stroke-width="1.1"
                  stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
      </svg>`;
  };

  const coinCard = (c) => {
    const f = FAMILIES[c.color];
    const as = assetOf(c.color, c.quadrant);
    const pct = Math.min(100, c.cap / CURVE * 100);
    return `
      <article class="lv-coin" data-color="${c.color}">
        <div class="lv-coin-top">
          <span class="lv-coin-code">${esc(as.ticker)}</span>
          <span class="lv-disc"><b>${esc(initials(c.ticker))}</b><i>${esc(as.ticker)}</i></span>
          <span class="lv-coin-age">${ago(c.ts)}</span>
        </div>
        <div class="lv-coin-body">
          <div class="lv-coin-title">
            <h3>${esc(c.name)}</h3>
            <span class="lv-coin-pill">On the board</span>
          </div>
          <p class="lv-coin-sub">${esc(c.ticker)} · ${esc(as.name)} · ${esc(f.family)} ${esc(quadOf(c.quadrant).label)}${c.demo ? '<span class="lv-coin-demo">SAMPLE</span>' : ''}</p>
          <div class="lv-bar"><i style="width:${pct.toFixed(1)}%"></i></div>
          <div class="lv-coin-nums"><span>${esc(as.unit)} ${esc(as.ticker)}</span><span>${pct.toFixed(1)}% of curve</span></div>
          <p class="lv-spark-label">1 USD in ${esc(as.ticker)} · simulated</p>
          ${sparkline(c)}
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
    $('count').textContent = `Showing ${list.length} of ${coins.length} coins · every figure simulated`;
    renderTicker();
    renderKpis();
    renderMeter();
  };

  /* ---------- the pad ---------- */

  const pad = $('pad');
  const flow = { step: 1, draft: null, spin: null, spinning: false, rot: 0 };

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
      ['Family', f ? f.family + ' · ' + f.label.toLowerCase() : '—', false],
      ['Quadrant', flow.spin ? quadOf(flow.spin.quadrant).short : '—', false],
      ['Total supply', supply ? num(supply) : '—', true],
      ['Spins used', (flow.spin ? 1 : 0) + ' of 1', true],
      ['Opening cap', as ? 'set at launch' : '—', false],
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

  const launch = () => {
    // The rule, checked once more at the last possible moment.
    if (!flow.spin || !flow.draft || flow.step !== 3) {
      $('status').textContent = 'No spin on record. Nothing launches here without one.';
      setStep(flow.step);          // put back any control that was forced open
      return;
    }

    const coin = {
      id: 'spn-' + Date.now().toString(36) + '-' + rnd(4096).toString(36),
      name: flow.draft.name,
      ticker: flow.draft.ticker,
      supply: flow.draft.supply,
      desc: flow.draft.desc,
      color: flow.spin.color,
      quadrant: flow.spin.quadrant,
      cap: 3800 + rnd(2600),       // simulated, like every figure on the board
      replies: rnd(4),
      ts: Date.now(),
      demo: false,
    };

    coins.unshift(coin);
    save();
    renderBoard();
    showRecord(coin);
  };

  const showRecord = (coin) => {
    const t = $('ticket');
    t.hidden = false;
    t.dataset.color = coin.color;
    $('tkId').textContent = coin.id;
    $('tkAvatar').innerHTML = `<b>${esc(initials(coin.ticker))}</b>`;
    $('tkAvatar').dataset.color = coin.color;
    $('tkName').textContent = coin.name;
    $('tkTicker').textContent = coin.ticker;
    const f = FAMILIES[coin.color];
    const q = quadOf(coin.quadrant);
    const as = assetOf(coin.color, coin.quadrant);
    $('tkRows').innerHTML = [
      ['Underlying asset', as.name + ' (' + as.ticker + ')', false],
      ['Colour drawn', f.label + ' · ' + f.family, false],
      ['Quadrant', q.short, false],
      ['Total supply', num(coin.supply), true],
      ['Opening cap', money(coin.cap) + ' · simulated', true],
      ['Recorded', new Date(coin.ts).toLocaleString('en-US'), true],
    ].map(([k, v, mono]) => `<div><dt>${esc(k)}</dt><dd${mono ? ' class="is-mono"' : ''}>${esc(v)}</dd></div>`).join('');
    $('tkNote').textContent =
      `${coin.name} launches paired with ${as.name} because the arrow stopped on a ${f.label.toLowerCase()} dot in the ${q.label} quadrant — ` +
      `${f.label.toLowerCase()} names the family, the quadrant names the asset. One spin per launch: another coin needs another spin.`;
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

  const init = () => {
    drawDial($('dial'));
    renderMat();
    const floorEl = document.querySelector('.lv-mat-floor');
    if (floorEl && window.ResizeObserver) new ResizeObserver(renderFigure).observe(floorEl);
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

    $('discard').addEventListener('click', () => {
      if (!confirm('Discarding clears the whole draft — name, ticker, supply, description and the spin. This is starting over, not re-rolling.')) return;
      flow.rot = 0;
      const needle = $('needle');
      needle.style.transition = 'none';
      needle.style.transform = 'rotate(0deg)';
      requestAnimationFrame(() => { needle.style.transition = ''; });
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

    [$('connect'), $('connect2')].forEach((b) => b.addEventListener('click', () => {
      $('status').textContent = 'No wallet to connect: Spinpad is a simulation, and the dial is the only thing that signs anything here.';
      $('status').scrollIntoView({ block: 'center', behavior: 'smooth' });
    }));

    $('fTicker').addEventListener('input', (e) => {
      e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
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

    $('sort').addEventListener('change', (e) => { view.sort = e.target.value; renderBoard(); });
    $('search').addEventListener('input', (e) => { view.q = e.target.value.trim(); renderBoard(); });

    $('clear').addEventListener('click', () => {
      if (!confirm('This clears every launch stored in this browser, sample launches included. It cannot be undone.')) return;
      coins = [];
      save();
      renderBoard();
    });

    document.querySelectorAll('[data-scroll]').forEach((el) => {
      el.addEventListener('click', () => {
        const t = document.getElementById(el.dataset.scroll);
        if (t) t.scrollIntoView({ block: 'start', behavior: 'smooth' });
      });
    });

    // the asset named in the hero cycles through the four, so the promise on the
    // page is the same one the dial makes
    const rotator = $('rotator');
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const all = [];
      ORDER.forEach((k) => QUADRANTS.forEach((q) => all.push({ k, as: FAMILIES[k].assets[q.id] })));
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
    ['board', 'launch', 'how', 'proof', 'faq'].forEach((id) => { const s = $(id); if (s) spy.observe(s); });

    // relative timestamps should not freeze on a tab left open
    setInterval(renderBoard, 60000);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
