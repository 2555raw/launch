/* Page behaviour: characters, console mock, marquee, tabs, FAQ, reveal,
 * navigation and the venues scene. */
(function () {
  'use strict';

  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let uid = 0;

  // ---------------------------------------------------------------- characters
  const him = () => Seahorse.build({ palette: 'blue', id: 'him' + uid++ });
  const her = () => Seahorse.build({ palette: 'gold', id: 'her' + uid++, lashes: true });

  $$('[data-seahorse]').forEach(el => {
    const kind = el.dataset.seahorse;
    if (kind === 'him') el.innerHTML = him();
    else if (kind === 'her') el.innerHTML = her();
    else if (kind === 'mark') el.innerHTML = him();
    else if (kind === 'pair-small') el.innerHTML = `<div>${him()}</div><div>${her()}</div>`;
  });

  // hearts rising between the two
  const hearts = $('#hearts');
  const heartSvg = c => `<svg viewBox="0 0 24 22"><path d="M12 21s-9-5.6-9-12A5 5 0 0 1 12 6a5 5 0 0 1 9 3c0 6.4-9 12-9 12z" fill="${c}"/></svg>`;
  function heart() {
    if (!hearts || document.hidden) return;
    const h = document.createElement('span');
    h.className = 'heart';
    h.style.setProperty('--hx', (Math.random() * 60 - 30).toFixed(0) + 'px');
    h.innerHTML = heartSvg(Math.random() > 0.5 ? '#3a68ff' : '#ffb454');
    hearts.appendChild(h);
    setTimeout(() => h.remove(), 4400);
  }
  if (!reduceMotion) setInterval(heart, 1800);


  // ---------------------------------------------------------------- step art
  // Small underwater vignettes on top of each step card, all drawn here.
  const stepArt = {
    1: () => `<svg viewBox="0 0 300 180" preserveAspectRatio="xMidYMid slice">
        <defs><radialGradient id="sa1" cx="0.5" cy="0.5"><stop offset="0" stop-color="#2553e6" stop-opacity="0.55"/><stop offset="1" stop-color="#2553e6" stop-opacity="0"/></radialGradient></defs>
        <path d="M0,140 C60,128 120,146 180,136 C230,128 270,140 300,134 L300,180 L0,180Z" fill="#1a1a1a"/>
        <circle cx="150" cy="92" r="70" fill="url(#sa1)"/>
        <circle cx="150" cy="92" r="44" fill="#0a1f38" stroke="#5a80ff" stroke-width="3"/>
        <circle cx="150" cy="92" r="36" fill="none" stroke="#2553e6" stroke-opacity="0.5" stroke-dasharray="2 6"/>
        <path d="M150,60 L160,92 L150,124 L140,92 Z" fill="#3a68ff"/><path d="M150,60 L160,92 L140,92 Z" fill="#dbe6ff"/>
        <circle cx="150" cy="92" r="4" fill="#f2f2f2"/>
        <g fill="#8fb0ff" font-family="Inter,sans-serif" font-size="10" text-anchor="middle"><text x="150" y="43">N</text><text x="150" y="150">S</text><text x="100" y="96">W</text><text x="200" y="96">E</text></g>
      </svg>`,
    2: () => `<svg viewBox="0 0 300 180" preserveAspectRatio="xMidYMid slice">
        <path d="M0,146 C80,136 200,152 300,140 L300,180 L0,180Z" fill="#1a1a1a"/>
        ${[70, 130, 190, 250].map((x, i) => {
          const y = [58, 96, 72, 110][i];
          return `<g><path d="M${x},148 L${x},34" stroke="#2c4a60" stroke-width="6" stroke-linecap="round"/>
            <path d="M${x},148 L${x},${y}" stroke="#2553e6" stroke-width="6" stroke-linecap="round"/>
            <circle cx="${x}" cy="${y}" r="11" fill="#dbe6ff" stroke="#3a68ff" stroke-width="3"/>
            <circle cx="${x}" cy="${y}" r="18" fill="#2553e6" opacity="0.18"/></g>`;
        }).join('')}
      </svg>`,
    3: () => `<svg viewBox="0 0 300 180" preserveAspectRatio="xMidYMid slice">
        <defs><radialGradient id="sa3" cx="0.5" cy="0.5"><stop offset="0" stop-color="#2553e6" stop-opacity="0.5"/><stop offset="1" stop-color="#2553e6" stop-opacity="0"/></radialGradient></defs>
        <path d="M0,150 C70,140 170,156 300,144 L300,180 L0,180Z" fill="#1a1a1a"/>
        <circle cx="150" cy="90" r="80" fill="url(#sa3)"/>
        ${him().replace('<svg ', '<svg x="92" y="14" width="72" height="122" ')}
        <g transform="translate(372 0) scale(-1 1)">${her().replace('<svg ', '<svg x="160" y="20" width="68" height="116" ')}</g>
        <path d="M40,60 q10,-6 20,0 M232,48 q10,-6 20,0" stroke="#8fb0ff" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.6"/>
      </svg>`
  };
  $$('.step__art').forEach(el => { el.innerHTML = stepArt[el.dataset.art](); });

  // ---------------------------------------------------------------- nav
  const nav = $('.nav');
  const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 10);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  const menu = $('#menu'), links = $('#navlinks');
  menu.addEventListener('click', () => {
    const open = links.classList.toggle('is-open');
    menu.setAttribute('aria-expanded', open);
  });
  $$('a', links).forEach(a => a.addEventListener('click', () => { links.classList.remove('is-open'); menu.setAttribute('aria-expanded', 'false'); }));

  // ---------------------------------------------------------------- marquee
  const venues = ['EVM', 'Solana', 'Uniswap v3', 'Uniswap v4', 'Raydium CLMM', 'OpenBook', 'Orca', 'Meteora', 'PumpSwap', 'Launchpad curves', 'Pyth'];
  const row = $('#marquee');
  row.innerHTML = [0, 1, 2].map(() => venues.map(v => `<span>${v}</span>`).join('')).join('');

  // ---------------------------------------------------------------- console
  const N = 64;
  let mid = 1.2408, inv = 2140, pnl = 86.4, fills = 0;
  const series = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  function spreadAt(vol) { return 0.0008 + vol * 0.9; }
  let vol = 0.0006;
  for (let i = 0; i < N; i++) step(true);

  function step(init) {
    const shock = rnd() < 0.04 ? (rnd() - 0.5) * 0.02 : 0;
    const drift = (rnd() - 0.5) * 0.0028 + shock;
    vol = vol * 0.9 + Math.abs(drift) * 0.1;
    mid = Math.max(1.18, Math.min(1.31, mid + drift));
    const skew = (inv / 10000) * 0.0006;
    const half = spreadAt(vol) / 2;
    series.push({ mid, bid: mid - half - skew, ask: mid + half - skew });
    if (series.length > N) series.shift();
    if (!init) return half;
  }

  const chart = { mid: $('#c-mid'), glow: $('#c-mid-glow'), bid: $('#c-bid'), ask: $('#c-ask'), area: $('#c-area') };
  function draw() {
    let lo = Infinity, hi = -Infinity;
    series.forEach(p => { lo = Math.min(lo, p.bid); hi = Math.max(hi, p.ask); });
    const pad = (hi - lo) * 0.18 || 0.001;
    lo -= pad; hi += pad;
    const X = i => (i / (N - 1)) * 640, Y = v => 240 - ((v - lo) / (hi - lo)) * 240;
    const line = k => series.map((p, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(p[k]).toFixed(1)).join('');
    const m = line('mid');
    chart.mid.setAttribute('d', m);
    chart.glow.setAttribute('d', m);
    chart.bid.setAttribute('d', line('bid'));
    chart.ask.setAttribute('d', line('ask'));
    chart.area.setAttribute('d', m + `L640,240L0,240Z`);
  }

  const fmt = (v, d) => v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const fillsEl = $('#fills');
  function tick() {
    const half = step(false);
    draw();
    const p = series[series.length - 1];
    $('#s-mid').textContent = fmt(p.mid, 4);
    $('#s-mid2').textContent = 'res ' + fmt((p.bid + p.ask) / 2, 4);
    $('#s-bid').textContent = fmt(p.bid, 4);
    $('#s-ask').textContent = 'ask ' + fmt(p.ask, 4) + ' · ' + fmt((p.ask - p.bid) / p.mid * 1e4, 1) + ' bps';

    if (rnd() < 0.55) {
      const buy = rnd() < 0.5 - inv / 40000;
      const qty = Math.round(80 + rnd() * 420);
      inv += buy ? qty : -qty;
      const edge = (rnd() - 0.25) * half * qty;
      pnl += edge;
      fills = Math.min(50, fills + 1);
      const now = new Date();
      const el = document.createElement('div');
      el.className = 'fill ' + (buy ? 'fill--buy' : 'fill--sell');
      el.innerHTML = `<span class="t">${now.toTimeString().slice(0, 8)}</span><span class="side">${buy ? 'BUY' : 'SELL'}</span>` +
        `<span>${fmt(buy ? p.bid : p.ask, 4)}</span><span class="q">${qty}</span><span class="${edge >= 0 ? 'up' : 'down'}">${edge >= 0 ? '+' : '−'}${fmt(Math.abs(edge), 2)}</span>`;
      fillsEl.prepend(el);
      while (fillsEl.children.length > 8) fillsEl.lastChild.remove();
      $('#f-count').textContent = fills + '/50';
      const invEl = $('#s-inv');
      invEl.innerHTML = (inv >= 0 ? '+' : '−') + fmt(Math.abs(inv), 0) + ' <em>base</em>';
      invEl.className = 'tile__value ' + (inv >= 0 ? 'up' : 'down');
      const pEl = $('#s-pnl');
      pEl.textContent = (pnl >= 0 ? '+' : '−') + fmt(Math.abs(pnl), 2);
      pEl.className = 'tile__value ' + (pnl >= 0 ? 'up' : 'down');
      $('#s-eq').textContent = 'equity ' + fmt(5000 + pnl, 2);
    }
  }
  draw();
  for (let i = 0; i < 4; i++) tick();
  if (!reduceMotion) setInterval(() => { if (!document.hidden) tick(); }, 1400);

  // ---------------------------------------------------------------- code tabs
  $$('.tab').forEach(t => t.addEventListener('click', () => {
    $$('.tab').forEach(x => x.classList.toggle('is-on', x === t));
    $$('.code__body').forEach(b => { b.hidden = b.dataset.code !== t.dataset.tab; });
  }));
  $('#copy').addEventListener('click', async e => {
    const code = $('.code__body:not([hidden])').innerText;
    try { await navigator.clipboard.writeText(code); e.target.textContent = 'Copied'; }
    catch (_) { e.target.textContent = 'Select to copy'; }
    setTimeout(() => { e.target.textContent = 'Copy'; }, 1600);
  });

  // ---------------------------------------------------------------- faq: one open at a time
  $$('#faqlist details').forEach(d => d.addEventListener('toggle', () => {
    if (d.open) $$('#faqlist details').forEach(o => { if (o !== d) o.open = false; });
  }));

  // ---------------------------------------------------------------- reveal
  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }), { rootMargin: '0px 0px -8% 0px' });
    $$('.reveal').forEach(el => io.observe(el));
  } else {
    $$('.reveal').forEach(el => el.classList.add('is-in'));
  }

  // ---------------------------------------------------------------- venues scene
  // A dark stage: the couple under a spotlight, with five glowing tokens, one
  // per venue, floating in an arc around them.
  function token(x, y, glyph, delay) {
    return `<g class="sc-bob" style="animation-delay:${delay}s">
      <circle class="sc-glow" cx="${x}" cy="${y}" r="58" fill="url(#sc-halo)"/>
      <ellipse cx="${x}" cy="${y + 96}" rx="34" ry="6" fill="#000" opacity="0.5"/>
      <circle cx="${x}" cy="${y}" r="34" fill="url(#sc-coin)" stroke="#5a80ff" stroke-width="2"/>
      <circle cx="${x}" cy="${y}" r="26" fill="none" stroke="#9fb8ff" stroke-opacity="0.35" stroke-dasharray="3 5"/>
      <g fill="none" stroke="#e8eeff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${glyph(x, y)}</g>
    </g>`;
  }
  const glyphs = [
    (x, y) => `<path d="M${x - 13},${y + 8} L${x - 13},${y - 8} M${x + 13},${y + 8} L${x + 13},${y - 8} M${x - 13},${y} L${x + 13},${y}"/>`,        // range
    (x, y) => `<path d="M${x - 14},${y + 10} C${x - 6},${y + 8} ${x + 2},${y - 2} ${x + 14},${y - 12}"/>`,                                            // curve
    (x, y) => `<circle cx="${x}" cy="${y}" r="11"/><path d="M${x},${y - 11} L${x},${y + 11}"/>`,                                                       // pool
    (x, y) => `<path d="M${x - 12},${y + 10} L${x - 12},${y - 4} L${x},${y - 12} L${x + 12},${y - 4} L${x + 12},${y + 10} Z"/>`,                        // position
    (x, y) => `<path d="M${x - 12},${y - 9} h24 M${x - 12},${y} h16 M${x - 12},${y + 9} h20"/>`                                                        // book
  ];

  function embed(svg, x, y, w, flip) {
    const h = w * 1.7;
    const inner = svg.replace('<svg ', `<svg x="${x}" y="${y}" width="${w}" height="${h}" `);
    return flip ? `<g transform="translate(${2 * x + w} 0) scale(-1 1)">${inner}</g>` : inner;
  }

  function buildScene() {
    const el = $('#scene');
    if (!el) return;
    let dots = '';
    for (let i = 0; i < 40; i++) {
      dots += `<circle cx="${(Math.random() * 1064).toFixed(0)}" cy="${(Math.random() * 240).toFixed(0)}" r="${(0.6 + Math.random() * 1.2).toFixed(1)}" fill="#c8d6ff" opacity="${(0.1 + Math.random() * 0.35).toFixed(2)}"/>`;
    }
    const pos = [[92, 180], [216, 128], [340, 180], [850, 128], [974, 180]];
    el.innerHTML = `<svg viewBox="0 0 1064 355" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="sc-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#101318"/><stop offset="1" stop-color="#0b0b0d"/></linearGradient>
        <linearGradient id="sc-spot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6f90ff" stop-opacity="0.28"/><stop offset="1" stop-color="#6f90ff" stop-opacity="0"/></linearGradient>
        <radialGradient id="sc-halo"><stop offset="0" stop-color="#2553e6" stop-opacity="0.5"/><stop offset="1" stop-color="#2553e6" stop-opacity="0"/></radialGradient>
        <radialGradient id="sc-coin" cx="0.35" cy="0.3"><stop offset="0" stop-color="#3a68ff"/><stop offset="1" stop-color="#0f1f5c"/></radialGradient>
        <radialGradient id="sc-floor" cx="0.5" cy="0"><stop offset="0" stop-color="#2553e6" stop-opacity="0.35"/><stop offset="1" stop-color="#2553e6" stop-opacity="0"/></radialGradient>
      </defs>
      <rect width="1064" height="355" fill="url(#sc-bg)"/>
      ${dots}
      <path class="sc-ray" d="M534,0 L658,0 L764,300 L428,300 Z" fill="url(#sc-spot)"/>
      <rect y="300" width="1064" height="55" fill="#121212"/>
      <path d="M0,300 L1064,300" stroke="#2a2a2a" stroke-width="2"/>
      <ellipse cx="596" cy="302" rx="200" ry="26" fill="url(#sc-floor)"/>
      ${pos.map(([x, y], i) => token(x, y, glyphs[i], -i * 1.1)).join('')}
      <g class="sc-bob">${embed(him(), 510, 36, 140, false)}</g>
      <g class="sc-bob sc-bob--2">${embed(her(), 604, 48, 132, true)}</g>
    </svg>`;
  }
  buildScene();
})();
