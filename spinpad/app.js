/* Spinpad — the whole application.
 *
 * The product rule: a token cannot be launched until the dial has been spun,
 * and the colour it stops on sets the underlying asset. That is enforced in
 * three independent places on purpose — the launch control ships disabled, the
 * step machine only reaches step three with a resolved spin, and launch()
 * re-checks the spin before it writes anything. Re-enabling the control from a
 * console produces nothing.
 *
 * Nothing here touches a chain. Caps, replies and curve progress are generated
 * figures, and the interface says so wherever they appear.
 */

(() => {
  'use strict';

  /* ---------- the four colours, the four assets ---------- */

  const COLORS = {
    green:  { id: 'green',  label: 'Green',  asset: 'Nvidia', ticker: 'NVDA' },
    yellow: { id: 'yellow', label: 'Yellow', asset: 'Amazon', ticker: 'AMZN' },
    blue:   { id: 'blue',   label: 'Blue',   asset: 'Meta',   ticker: 'META' },
    red:    { id: 'red',    label: 'Red',    asset: 'Tesla',  ticker: 'TSLA' },
  };

  // Fixed reading order, used by the legend, the filters and the meter alike.
  // Categorical identity never follows rank, so a filter or a sort cannot
  // repaint or reorder these.
  const ORDER = ['blue', 'red', 'green', 'yellow'];

  // Quadrants run clockwise from twelve o'clock, in the order the labels sit
  // around the dial: top-right, bottom-right, bottom-left, top-left.
  const LIMBS = ['right hand', 'right foot', 'left foot', 'left hand'];

  // Mat order, rotated one step per quadrant so neighbouring quadrants do not
  // start on the same colour. Four sectors per colour, sixteen in total.
  const BASE = ['green', 'yellow', 'blue', 'red'];
  const SECTORS = [];
  for (let q = 0; q < 4; q++) {
    for (let k = 0; k < 4; k++) SECTORS.push({ color: BASE[(k + q) % 4], limb: LIMBS[q] });
  }

  const SEG = 360 / SECTORS.length;   // 22.5 degrees
  const EXPECTED = 100 / 4;           // four sectors of sixteen per colour
  const GRADUATE = 69000;             // simulated cap that fills the curve
  const KEY = 'spinpad.coins.v1';

  /* ---------- helpers ---------- */

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const rnd = (n) => {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] % n;           // 2^32 is a multiple of 16 and of 1000: no modulo bias
  };

  const num = (n) => n.toLocaleString('en-US');

  const money = (n) => n >= 1e6
    ? '$' + (n / 1e6).toFixed(1) + 'M'
    : n >= 1000 ? '$' + (n / 1000).toFixed(1) + 'K' : '$' + n;

  const ago = (ts) => {
    const s = Math.max(0, (Date.now() - ts) / 1000);
    if (s < 60) return Math.floor(s) + 's ago';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    return Math.floor(s / 86400) + 'd ago';
  };

  const initials = (t) => t.replace(/[^A-Z0-9]/gi, '').slice(0, 3).toUpperCase() || '??';

  /* ---------- store ---------- */

  const DEMO = [
    { name: 'Meridian Reserve', ticker: 'MRDN', color: 'red',    limb: 'right foot', supply: 1000000000, desc: 'Index-style exposure with the pairing fixed at launch.',      cap: 48200, replies: 214, age: 41 },
    { name: 'Halden Grid',      ticker: 'HLDN', color: 'green',  limb: 'right hand', supply: 500000000,  desc: 'Compute-adjacent launch; the asset was drawn, not picked.',   cap: 31800, replies: 96,  age: 96 },
    { name: 'Copperline',       ticker: 'CPRL', color: 'blue',   limb: 'left hand',  supply: 1000000000, desc: 'Social-graph pairing, assigned on the first and only spin.',  cap: 12400, replies: 41,  age: 180 },
    { name: 'Vantage Point',    ticker: 'VNTG', color: 'yellow', limb: 'left foot',  supply: 210000000,  desc: 'Logistics-themed launch with a recorded spin outcome.',       cap: 8100,  replies: 27,  age: 320 },
    { name: 'Solace Works',     ticker: 'SLCE', color: 'green',  limb: 'right foot', supply: 888888888,  desc: 'Four colours, four assets, one spin per launch.',             cap: 5600,  replies: 12,  age: 615 },
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

  /* ---------- the dial ---------- */

  const sectorPath = (cx, cy, r, a0, a1) => {
    const pt = (a) => {
      const rad = (a - 90) * Math.PI / 180;
      return [(cx + r * Math.cos(rad)).toFixed(2), (cy + r * Math.sin(rad)).toFixed(2)];
    };
    const [x0, y0] = pt(a0), [x1, y1] = pt(a1);
    return `M${cx} ${cy} L${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1} Z`;
  };

  const drawDial = (svg) => {
    const hex = { green: '#2FA84F', yellow: '#FDD208', blue: '#1B75BC', red: '#E4322B' };
    let out = '<circle cx="100" cy="100" r="94" fill="#fff"/>';
    SECTORS.forEach((s, i) => {
      out += `<path d="${sectorPath(100, 100, 90, i * SEG, (i + 1) * SEG)}" fill="${hex[s.color]}" stroke="#fff" stroke-width="1.5"/>`;
    });
    out += '<circle cx="100" cy="100" r="93" class="sp-rim"/>';
    out += '<circle cx="100" cy="100" r="19" fill="#fff" stroke="#12141A" stroke-width="2"/>';
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
    const widest = shares.slice().sort((a, b) => Math.abs(b.pct - EXPECTED) - Math.abs(a.pct - EXPECTED))[0];
    const gap = widest.pct - EXPECTED;

    const tiles = [
      ['Launches recorded', num(total), total === 1 ? 'token' : 'tokens'],
      ['Combined cap', money(sum), 'simulated'],
      ['Most drawn', total ? COLORS[most.k].asset : '—', total ? most.pct.toFixed(1) + '%' : ''],
      ['Widest deviation', total ? (gap >= 0 ? '+' : '') + gap.toFixed(1) : '—', total ? 'pts · ' + COLORS[widest.k].asset : ''],
    ];

    $('kpis').innerHTML = tiles.map(([label, value, note]) => `
      <dl class="sp-kpi">
        <dt>${esc(label)}</dt>
        <dd>${esc(value)}${note ? `<small>${esc(note)}</small>` : ''}</dd>
      </dl>`).join('');
  };

  // Horizontal bars, one per asset, in fixed order. Every bar carries a visible
  // ink label with its share and count: green and yellow fall under 3:1 against
  // white, so the numbers cannot live in the colour alone. The dashed rule marks
  // the 25% each colour is expected to draw.
  const renderMeter = () => {
    const counts = tally();
    const total = coins.length;
    const max = Math.max(EXPECTED + 6, ...ORDER.map((k) => (total ? counts[k] / total * 100 : 0)));

    $('meter').innerHTML = ORDER.map((k) => {
      const col = COLORS[k];
      const pct = total ? counts[k] / total * 100 : 0;
      const gap = pct - EXPECTED;
      const tip = `${col.asset}: ${counts[k]} of ${total} launches, ${pct.toFixed(1)}% against an expected 25% (${gap >= 0 ? '+' : ''}${gap.toFixed(1)} pts)`;
      return `
        <div class="sp-meter-row" data-color="${k}" title="${esc(tip)}">
          <span class="sp-meter-name"><i class="sp-dot" data-color="${k}"></i>${esc(col.asset)}</span>
          <span class="sp-meter-track">
            <span class="sp-meter-fill" style="width:${(pct / max * 100).toFixed(2)}%"></span>
            <span class="sp-meter-ref" style="left:${(EXPECTED / max * 100).toFixed(2)}%">${k === ORDER[0] ? '<span>expected 25%</span>' : ''}</span>
          </span>
          <span class="sp-meter-val">${pct.toFixed(1)}%<small>${counts[k]} of ${total}</small></span>
        </div>`;
    }).join('');

    $('meterNote').textContent = total
      ? `Based on ${total} launch${total === 1 ? '' : 'es'} recorded in this browser, sample launches included. A small record deviates from 25% freely; the dial itself is flat by construction.`
      : 'No launches recorded yet. Each colour holds four of the dial’s sixteen equal sectors.';
  };

  /* ---------- board ---------- */

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

  const coinCard = (c) => {
    const col = COLORS[c.color];
    const pct = Math.min(100, Math.round(c.cap / GRADUATE * 100));
    return `
      <article class="sp-coin" data-color="${c.color}">
        <span class="sp-avatar">${esc(initials(c.ticker))}</span>
        <div class="sp-coin-body">
          <p class="sp-coin-name">${esc(c.name)} <em>${esc(c.ticker)}</em></p>
          <p class="sp-coin-meta">Cap <b>${money(c.cap)}</b> · ${c.replies} replies · ${ago(c.ts)}${c.demo ? '<span class="sp-coin-demo">sample</span>' : ''}</p>
          <p class="sp-coin-desc">${esc(c.desc || 'No description.')}</p>
          <span class="sp-coin-asset"><i class="sp-dot" data-color="${c.color}"></i>${esc(col.asset)} · ${esc(col.ticker)}</span>
          <div class="sp-curve"><i style="width:${pct}%"></i></div>
        </div>
      </article>`;
  };

  const renderLead = () => {
    const card = $('lead');
    const top = coins.slice().sort((a, b) => b.cap - a.cap)[0];
    if (!top) { card.hidden = true; return; }
    card.hidden = false;
    const col = COLORS[top.color];
    const pct = Math.min(100, Math.round(top.cap / GRADUATE * 100));
    card.dataset.color = top.color;
    $('leadAvatar').textContent = initials(top.ticker);
    $('leadName').textContent = top.name + ' · ' + top.ticker;
    $('leadMeta').innerHTML = `Cap <b>${money(top.cap)}</b> · ${top.replies} replies · paired with ${esc(col.asset)} (${esc(col.ticker)}) · drawn on ${esc(col.label.toLowerCase())}, ${esc(top.limb)}`;
    $('leadDesc').textContent = top.desc || 'No description.';
    $('leadCurve').style.width = pct + '%';
    $('leadCurveLabel').textContent = `${pct}% of the simulated ${money(GRADUATE)} curve`;
  };

  const renderTicker = () => {
    const last = coins.slice().sort((a, b) => b.ts - a.ts).slice(0, 10);
    if (!last.length) { $('tickerTrack').innerHTML = ''; return; }
    const one = last.map((c) => {
      const col = COLORS[c.color];
      return `<span class="sp-tick"><i class="sp-dot" data-color="${c.color}"></i><b>${esc(c.ticker)}</b> drew ${esc(col.label.toLowerCase())} → ${esc(col.ticker)} · ${ago(c.ts)}</span>`;
    }).join('');
    $('tickerTrack').innerHTML = one + one;   // two copies: the marquee loops at -50%
  };

  const renderBoard = () => {
    const list = visible();
    $('grid').innerHTML = list.map(coinCard).join('');
    $('empty').hidden = list.length > 0;
    $('count').textContent = `Showing ${list.length} of ${coins.length} launches · all figures simulated`;
    renderLead();
    renderTicker();
    renderKpis();
    renderMeter();
  };

  /* ---------- create flow ---------- */

  const modal = $('create');
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
    $('launch').disabled = n !== 3 || !flow.spin;
    $('spinCount').textContent = 'Spins ' + (flow.spin ? 1 : 0) + '/1';
  };

  const err = (id, msg) => {
    const box = document.querySelector(`.sp-err[data-for="${id}"]`);
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

    if (coins.some((c) => c.ticker === ticker)) {
      ok = err('fTicker', 'That ticker is already on the board.') && ok;
    }
    return ok ? { name, ticker, supply, desc } : null;
  };

  const doSpin = () => {
    if (flow.step !== 2 || flow.spin || flow.spinning) return;
    flow.spinning = true;
    setStep(2);
    $('status').textContent = 'Spinning. The outcome is the dial’s, not yours.';

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
    $('resLine').textContent = `This token is now paired with ${col.asset} (${col.ticker}). The pairing cannot be changed and the spin cannot be repeated.`;

    $('assetSlot').dataset.color = sector.color;
    $('assetName').textContent = col.asset + ' · ' + col.ticker;
    $('assetHint').textContent = 'Locked by the spin';
    $('status').textContent = `${col.label} drawn on ${sector.limb}. The launch control is now open.`;

    setStep(3);
  };

  const launch = () => {
    // The rule, checked again at the last possible moment.
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
    pad.hidden = true;
    const t = $('ticket');
    t.hidden = false;
    t.dataset.color = coin.color;
    $('tkId').textContent = coin.id;
    $('tkAvatar').textContent = initials(coin.ticker);
    $('tkName').textContent = coin.name;
    $('tkTicker').textContent = coin.ticker;
    $('tkRows').innerHTML = [
      ['Colour drawn', col.label],
      ['Underlying asset', col.asset + ' (' + col.ticker + ')'],
      ['Quadrant', coin.limb],
      ['Total supply', num(coin.supply)],
      ['Opening cap', money(coin.cap) + ' (simulated)'],
      ['Recorded', new Date(coin.ts).toLocaleString('en-US')],
    ].map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
    $('tkNote').textContent =
      `${coin.name} launches paired with ${col.asset} because the dial stopped on ${col.label.toLowerCase()}, ${coin.limb}. ` +
      'One spin per launch: another token requires another spin.';
    $('tkCopy').textContent = 'Copy record';
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
    $('assetSlot').dataset.color = 'none';
    $('assetName').textContent = 'Assigned by the spin';
    $('assetHint').textContent = 'Locked until the dial is spun';
    $('status').textContent = 'Complete the token details to unlock the spin.';
    $('ticket').hidden = true;
    pad.hidden = false;
    setStep(1);
  };

  const openCreate = () => {
    if (!modal.open) {
      if (typeof modal.showModal === 'function') modal.showModal();
      else modal.setAttribute('open', '');
    }
    $('fName').focus();
  };

  /* ---------- wiring ---------- */

  const init = () => {
    drawDial($('dial'));
    load();
    renderBoard();
    resetFlow();

    $('openCreate').addEventListener('click', openCreate);
    $('openCreate2').addEventListener('click', openCreate);
    modal.addEventListener('close', () => { if (!$('ticket').hidden) resetFlow(); });

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
      if (flow.spin || flow.spinning) return;     // already spun: no way back
      $('status').textContent = 'Complete the token details to unlock the spin.';
      setStep(1);
    });

    $('spin').addEventListener('click', doSpin);
    $('launch').addEventListener('click', launch);

    $('discard').addEventListener('click', () => {
      if (!confirm('Discarding clears the whole draft — name, ticker, supply, description and the spin. This is starting over, not re-rolling.')) return;
      flow.rot = 0;
      const needle = $('needle');
      needle.style.transition = 'none';
      needle.style.transform = 'rotate(0deg)';
      requestAnimationFrame(() => { needle.style.transition = ''; });
      resetFlow();
    });

    $('tkAgain').addEventListener('click', () => { resetFlow(); $('fName').focus(); });

    $('tkCopy').addEventListener('click', async (e) => {
      const rows = [...$('tkRows').children].map((d) => d.querySelector('dt').textContent + ': ' + d.querySelector('dd').textContent);
      const text = ['Spinpad — spin record', $('tkId').textContent,
        $('tkName').textContent + ' (' + $('tkTicker').textContent + ')', ...rows].join('\n');
      try {
        await navigator.clipboard.writeText(text);
        e.target.textContent = 'Copied';
      } catch (e2) {
        e.target.textContent = 'Copy failed';
      }
      setTimeout(() => { e.target.textContent = 'Copy record'; }, 1800);
    });

    $('fTicker').addEventListener('input', (e) => {
      e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    });

    // Formatted on blur only: rewriting the value while the field has focus
    // fights with whatever the user is doing to it mid-edit.
    $('fSupply').addEventListener('blur', (e) => {
      const n = Number(e.target.value.replace(/\D/g, ''));
      e.target.value = n ? num(n) : '';
    });

    $('fDesc').addEventListener('input', (e) => { $('descCount').textContent = e.target.value.length + '/140'; });

    $('filters').addEventListener('click', (e) => {
      const b = e.target.closest('.sp-chip');
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

    // the board ages: relative times should not freeze on a tab left open
    setInterval(renderBoard, 60000);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
