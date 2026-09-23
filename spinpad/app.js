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

  /* ---------- the four colours, the four assets ---------- */

  const COLORS = {
    green:  { id: 'green',  label: 'Green',  asset: 'Nvidia', ticker: 'NVDA', unit: '0.000004200' },
    yellow: { id: 'yellow', label: 'Yellow', asset: 'Amazon', ticker: 'AMZN', unit: '0.000005100' },
    blue:   { id: 'blue',   label: 'Blue',   asset: 'Meta',   ticker: 'META', unit: '0.000001800' },
    red:    { id: 'red',    label: 'Red',    asset: 'Tesla',  ticker: 'TSLA', unit: '0.000003400' },
  };

  const HEX = { green: '#2FA84F', yellow: '#FDD208', blue: '#1B75BC', red: '#E4322B' };

  // Fixed reading order for the legend, the filters and the chart. Categorical
  // identity never follows rank, so a filter or a sort cannot repaint it.
  const ORDER = ['blue', 'red', 'green', 'yellow'];

  // Quadrants run clockwise from twelve o'clock, matching the labels printed in
  // the four corners of the board: top-right, bottom-right, bottom-left, top-left.
  const LIMBS = ['right hand', 'right foot', 'left foot', 'left hand'];

  // Mat order, rotated one place per quadrant so neighbouring quadrants do not
  // open on the same colour. Four sectors per colour, sixteen in all.
  const BASE = ['green', 'yellow', 'blue', 'red'];
  const SECTORS = [];
  for (let q = 0; q < 4; q++) {
    for (let k = 0; k < 4; k++) SECTORS.push({ color: BASE[(k + q) % 4], limb: LIMBS[q] });
  }

  const SEG = 360 / SECTORS.length;   // 22.5 degrees
  const EXPECTED = 100 / 4;           // four of sixteen sectors per colour
  const CURVE = 69000;                // simulated cap that fills the curve
  const KEY = 'spinpad.coins.v1';

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
    { name: 'Meridian Reserve', ticker: 'MRDN', color: 'red',    limb: 'right foot', supply: 1000000000, desc: 'Index-style exposure with the pairing fixed at launch.',     cap: 48200, replies: 214, age: 41 },
    { name: 'Halden Grid',      ticker: 'HLDN', color: 'green',  limb: 'right hand', supply: 500000000,  desc: 'Compute-adjacent launch; the asset was drawn, not picked.',  cap: 31800, replies: 96,  age: 96 },
    { name: 'Copperline',       ticker: 'CPRL', color: 'blue',   limb: 'left hand',  supply: 1000000000, desc: 'Social-graph pairing, assigned on the first and only spin.', cap: 12400, replies: 41,  age: 180 },
    { name: 'Vantage Point',    ticker: 'VNTG', color: 'yellow', limb: 'left foot',  supply: 210000000,  desc: 'Logistics-themed launch with a recorded spin outcome.',      cap: 8100,  replies: 27,  age: 320 },
    { name: 'Solace Works',     ticker: 'SLCE', color: 'green',  limb: 'right foot', supply: 888888888,  desc: 'Four colours, four assets, one spin per launch.',            cap: 5600,  replies: 12,  age: 615 },
  ];

  const seed = () => DEMO.map((d, i) => ({
    id: 'sample-' + (i + 1),
    name: d.name, ticker: d.ticker, color: d.color, limb: d.limb,
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

  /* ---------- the board ---------- */

  // A ring of sixteen equal sectors with an open centre, the way the spinner
  // board is printed: the arrow turns over it and the hub carries the name.
  const ringPath = (cx, cy, rOut, rIn, a0, a1) => {
    const pt = (r, a) => {
      const rad = (a - 90) * Math.PI / 180;
      return [(cx + r * Math.cos(rad)).toFixed(2), (cy + r * Math.sin(rad)).toFixed(2)];
    };
    const [xo0, yo0] = pt(rOut, a0), [xo1, yo1] = pt(rOut, a1);
    const [xi1, yi1] = pt(rIn, a1),  [xi0, yi0] = pt(rIn, a0);
    return `M${xo0} ${yo0} A${rOut} ${rOut} 0 0 1 ${xo1} ${yo1} L${xi1} ${yi1} A${rIn} ${rIn} 0 0 0 ${xi0} ${yi0} Z`;
  };

  const drawDial = (svg) => {
    let out = '<circle cx="100" cy="100" r="96" fill="#FCFBF7"/>';
    SECTORS.forEach((s, i) => {
      out += `<path d="${ringPath(100, 100, 94, 52, i * SEG, (i + 1) * SEG)}" fill="${HEX[s.color]}" stroke="#FCFBF7" stroke-width="1.6"/>`;
    });
    out += '<circle cx="100" cy="100" r="96" class="lv-rim"/>';
    out += '<circle cx="100" cy="100" r="52" fill="none" stroke="#171A1F" stroke-width="1.6"/>';
    out += '<text x="100" y="76" text-anchor="middle" class="lv-dial-word">SPINPAD</text>';
    out += '<text x="100" y="134" text-anchor="middle" class="lv-dial-word-2">16 SECTORS</text>';
    svg.innerHTML = out;
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
      ['Most drawn', total ? COLORS[most.k].asset : '—', total ? most.pct.toFixed(1) + '%' : ''],
      ['Widest deviation', total ? (gap >= 0 ? '+' : '') + gap.toFixed(1) : '—', total ? 'pts · ' + COLORS[wide.k].asset : ''],
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
      const col = COLORS[k];
      const pct = total ? counts[k] / total * 100 : 0;
      const gap = pct - EXPECTED;
      const tip = `${col.asset}: ${counts[k]} of ${total} launches, ${pct.toFixed(1)}% against an expected 25% (${gap >= 0 ? '+' : ''}${gap.toFixed(1)} pts)`;
      return `
        <div class="lv-meter-row" data-color="${k}" title="${esc(tip)}">
          <span class="lv-meter-name"><i class="lv-dot" data-color="${k}"></i>${esc(col.asset)}</span>
          <span class="lv-meter-track">
            <span class="lv-meter-fill" style="width:${(pct / max * 100).toFixed(2)}%"></span>
            <span class="lv-meter-ref" style="left:${(EXPECTED / max * 100).toFixed(2)}%">${i === 0 ? '<span>expected 25%</span>' : ''}</span>
          </span>
          <span class="lv-meter-val">${pct.toFixed(1)}%<small>${counts[k]} of ${total}</small></span>
        </div>`;
    }).join('');

    $('meterNote').textContent = total
      ? `Based on ${total} launch${total === 1 ? '' : 'es'} recorded in this browser, sample launches included. A short record wanders from 25% freely; the dial itself is flat by construction.`
      : 'No launches recorded yet. Each colour holds four of the dial’s sixteen equal sectors.';
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
    const col = COLORS[c.color];
    const pct = Math.min(100, c.cap / CURVE * 100);
    return `
      <article class="lv-coin" data-color="${c.color}">
        <div class="lv-coin-top">
          <span class="lv-coin-code">${esc(col.ticker)}</span>
          <span class="lv-disc"><b>${esc(initials(c.ticker))}</b><i>${esc(col.ticker)}</i></span>
          <span class="lv-coin-age">${ago(c.ts)}</span>
        </div>
        <div class="lv-coin-body">
          <div class="lv-coin-title">
            <h3>${esc(c.name)}</h3>
            <span class="lv-coin-pill">On the board</span>
          </div>
          <p class="lv-coin-sub">${esc(c.ticker)} · paired with ${esc(col.asset)}${c.demo ? '<span class="lv-coin-demo">SAMPLE</span>' : ''}</p>
          <div class="lv-bar"><i style="width:${pct.toFixed(1)}%"></i></div>
          <div class="lv-coin-nums"><span>${esc(col.unit)} ${esc(col.ticker)}</span><span>${pct.toFixed(1)}% of curve</span></div>
          <p class="lv-spark-label">1 USD in ${esc(col.ticker)} · simulated</p>
          ${sparkline(c)}
        </div>
      </article>`;
  };

  const renderTicker = () => {
    const last = coins.slice().sort((a, b) => b.ts - a.ts).slice(0, 10);
    if (!last.length) { $('tickerTrack').innerHTML = ''; return; }
    const one = last.map((c) => {
      const col = COLORS[c.color];
      return `<span class="lv-tick"><i class="lv-dot" data-color="${c.color}"></i><b>${esc(c.ticker)}</b> drew ${esc(col.label.toLowerCase())} → paired with ${esc(col.asset)} · ${ago(c.ts)}</span>`;
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
    const col = flow.spin ? COLORS[flow.spin.color] : null;

    $('preview').dataset.color = flow.spin ? flow.spin.color : 'none';
    $('pvTicker').textContent = ticker;
    $('pvAsset').textContent = col ? col.ticker : 'UNPAIRED';

    $('sumName').textContent = name;
    $('sumSub').textContent = ticker + ' · ' + (col ? 'paired with ' + col.asset : 'not yet paired');

    $('sumRows').innerHTML = [
      ['Underlying asset', col ? col.asset + ' (' + col.ticker + ')' : 'Drawn at launch', false],
      ['Colour drawn', col ? col.label : '—', false],
      ['Quadrant', flow.spin ? flow.spin.limb : '—', false],
      ['Total supply', supply ? num(supply) : '—', true],
      ['Spins used', (flow.spin ? 1 : 0) + ' of 1', true],
      ['Opening cap', col ? 'set at launch' : '—', false],
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

    const col = COLORS[sector.color];
    const res = $('result');
    res.hidden = false;
    res.dataset.color = sector.color;
    $('resDot').dataset.color = sector.color;
    $('resColor').textContent = col.label + ' — ' + col.asset;
    $('resLimb').textContent = sector.limb + ' · ' + col.ticker;
    $('resLine').textContent = `Paired with ${col.asset} (${col.ticker}). The pairing is written into the launch and cannot be re-rolled.`;

    $('assetSlot').dataset.color = sector.color;
    $('assetName').textContent = col.asset + ' · ' + col.ticker;
    $('assetHint').textContent = 'Locked';
    $('status').textContent = `${col.label} on ${sector.limb}. The asset is filled in and the launch control is open.`;

    setStep(3);
    renderSummary();
  };

  const launch = () => {
    // The rule, checked once more at the last possible moment.
    if (!flow.spin || !flow.draft || flow.step !== 3) {
      $('status').textContent = 'No spin on record. Nothing launches here without one.';
      setStep(flow.step);          // put back any control that was forced open
      return;
    }

    const col = COLORS[flow.spin.color];
    const coin = {
      id: 'spn-' + Date.now().toString(36) + '-' + rnd(4096).toString(36),
      name: flow.draft.name,
      ticker: flow.draft.ticker,
      supply: flow.draft.supply,
      desc: flow.draft.desc,
      color: flow.spin.color,
      limb: flow.spin.limb,
      cap: 3800 + rnd(2600),       // simulated, like every figure on the board
      replies: rnd(4),
      ts: Date.now(),
      demo: false,
    };

    coins.unshift(coin);
    save();
    renderBoard();
    showRecord(coin, col);
  };

  const showRecord = (coin, col) => {
    const t = $('ticket');
    t.hidden = false;
    t.dataset.color = coin.color;
    $('tkId').textContent = coin.id;
    $('tkAvatar').innerHTML = `<b>${esc(initials(coin.ticker))}</b>`;
    $('tkAvatar').dataset.color = coin.color;
    $('tkName').textContent = coin.name;
    $('tkTicker').textContent = coin.ticker;
    $('tkRows').innerHTML = [
      ['Colour drawn', col.label, false],
      ['Underlying asset', col.asset + ' (' + col.ticker + ')', false],
      ['Quadrant', coin.limb, false],
      ['Total supply', num(coin.supply), true],
      ['Opening cap', money(coin.cap) + ' · simulated', true],
      ['Recorded', new Date(coin.ts).toLocaleString('en-US'), true],
    ].map(([k, v, mono]) => `<div><dt>${esc(k)}</dt><dd${mono ? ' class="is-mono"' : ''}>${esc(v)}</dd></div>`).join('');
    $('tkNote').textContent =
      `${coin.name} launches paired with ${col.asset} because the arrow stopped on ${col.label.toLowerCase()}, ${coin.limb}. ` +
      'One spin per launch: another coin needs another spin.';
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
    load();
    renderBoard();
    resetFlow();

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

    $('caCopy').addEventListener('click', async (e) => {
      try { await navigator.clipboard.writeText($('caValue').textContent); e.target.textContent = 'Copied'; }
      catch (e2) { e.target.textContent = 'Copy failed'; }
      setTimeout(() => { e.target.textContent = 'Copy'; }, 1600);
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
      let r = 0;
      setInterval(() => {
        r = (r + 1) % ORDER.length;
        const col = COLORS[ORDER[r]];
        rotator.textContent = col.asset;
        rotator.dataset.color = col.id;
      }, 2200);
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
