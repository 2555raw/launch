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
    $('#s-mid2').textContent = 'reservation ' + fmt((p.bid + p.ask) / 2, 4);
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
        `<span>${fmt(buy ? p.bid : p.ask, 4)}</span><span>${qty}</span><span class="${edge >= 0 ? 'up' : 'down'}">${edge >= 0 ? '+' : '−'}${fmt(Math.abs(edge), 2)}</span>`;
      fillsEl.prepend(el);
      while (fillsEl.children.length > 6) fillsEl.lastChild.remove();
      $('#f-count').textContent = fills + '/50';
      const invEl = $('#s-inv');
      invEl.innerHTML = (inv >= 0 ? '+' : '−') + fmt(Math.abs(inv), 0) + ' <em>base</em>';
      invEl.className = inv >= 0 ? 'up' : 'down';
      const pEl = $('#s-pnl');
      pEl.textContent = (pnl >= 0 ? '+' : '−') + fmt(Math.abs(pnl), 2);
      pEl.className = pnl >= 0 ? 'up' : 'down';
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
  // An underwater ledge: five treasures, one per venue, on sand mounds, with
  // the couple in the middle. Everything glows in the accent blue.
  function pedestal(x) {
    return `<g>
      <ellipse cx="${x}" cy="292" rx="70" ry="16" fill="#000" opacity="0.35"/>
      <path d="M${x - 66},290 C${x - 60},262 ${x + 60},262 ${x + 66},290 Z" fill="url(#sc-sand)"/>
      <ellipse class="sc-glow" cx="${x}" cy="276" rx="58" ry="10" fill="none" stroke="#2553e6" stroke-width="2.5" filter="url(#sc-blur)"/>
      <ellipse cx="${x}" cy="276" rx="56" ry="9" fill="none" stroke="#5f86ff" stroke-width="1" opacity="0.7"/>
    </g>`;
  }
  const glowBlob = (x, y, r) => `<circle class="sc-glow" cx="${x}" cy="${y}" r="${r}" fill="url(#sc-halo)"/>`;

  const clam = x => `<g>${glowBlob(x, 236, 56)}
      <path d="M${x - 44},262 C${x - 44},290 ${x + 44},290 ${x + 44},262 Z" fill="#c7b7d8"/>
      <g stroke="#8e7aa8" stroke-width="1.4">${[-30, -15, 0, 15, 30].map(d => `<path d="M${x},286 L${x + d},263"/>`).join('')}</g>
      <path d="M${x - 44},260 C${x - 50},212 ${x + 30},200 ${x + 44},250 Z" fill="#b3a2c9"/>
      <g stroke="#8e7aa8" stroke-width="1.4" fill="none">${[0.2, 0.4, 0.6, 0.8].map(t => `<path d="M${x + 40},250 Q${x - 10},${222 + t * 12} ${x - 44 + t * 8},${258 - t * 36}"/>`).join('')}</g>
      <circle cx="${x + 4}" cy="252" r="15" fill="url(#sc-pearl)"/>
      <circle cx="${x - 1}" cy="247" r="4" fill="#fff" opacity="0.9"/>
    </g>`;

  const bottle = x => `<g class="sc-bob" >${glowBlob(x, 222, 60)}
      <g transform="rotate(-24 ${x} 230)">
        <rect x="${x - 20}" y="196" width="40" height="72" rx="14" fill="url(#sc-glass)" stroke="#9fc8ff" stroke-opacity="0.6"/>
        <rect x="${x - 8}" y="176" width="16" height="24" rx="4" fill="url(#sc-glass)" stroke="#9fc8ff" stroke-opacity="0.6"/>
        <rect x="${x - 7}" y="168" width="14" height="12" rx="3" fill="#a87a4c"/>
        <rect class="sc-glow" x="${x - 11}" y="212" width="22" height="40" rx="5" fill="#e9eeff"/>
        <g stroke="#2553e6" stroke-width="2" stroke-linecap="round"><path d="M${x - 6},222 h12"/><path d="M${x - 6},230 h9"/><path d="M${x - 6},238 h12"/></g>
        <rect x="${x - 14}" y="204" width="5" height="54" rx="2.5" fill="#fff" opacity="0.35"/>
      </g></g>`;

  const trident = x => `<g>${glowBlob(x, 200, 64)}
      <g stroke-linecap="round" fill="none">
        <path d="M${x},272 L${x},146" stroke="#1e40af" stroke-width="7"/>
        <path d="M${x},272 L${x},146" stroke="#8fb0ff" stroke-width="2" opacity="0.8"/>
        <path d="M${x - 26},128 C${x - 26},160 ${x + 26},160 ${x + 26},128" stroke="#2553e6" stroke-width="6"/>
        <path d="M${x},160 L${x},112" stroke="#2553e6" stroke-width="6"/>
      </g>
      <g fill="#8fb0ff">
        <path d="M${x - 26},112 l-7,18 h14 z"/><path d="M${x},96 l-7,18 h14 z"/><path d="M${x + 26},112 l-7,18 h14 z"/>
      </g>
      <rect x="${x - 7}" y="224" width="14" height="8" rx="2" fill="#f0c36a"/>
    </g>`;

  const conch = x => `<g>${glowBlob(x, 236, 56)}
      <path d="M${x - 46},262 C${x - 58},226 ${x - 18},196 ${x + 16},206 C${x + 44},212 ${x + 56},240 ${x + 44},262 Z" fill="#f2c9a8"/>
      <path d="M${x - 46},262 C${x - 30},252 ${x + 20},250 ${x + 44},262 Z" fill="#f28f7a"/>
      <g fill="none" stroke="#c98d6a" stroke-width="1.6">
        <path d="M${x + 16},206 C${x + 4},222 ${x + 14},238 ${x + 30},236"/>
        <path d="M${x - 10},206 C${x - 20},224 ${x - 8},244 ${x + 10},246"/>
        <path d="M${x - 32},218 C${x - 40},236 ${x - 28},252 ${x - 12},254"/>
      </g>
      <path d="M${x + 16},206 C${x + 30},200 ${x + 46},190 ${x + 60},178 C${x + 52},196 ${x + 46},212 ${x + 36},222 Z" fill="#f7dcc3"/>
    </g>`;

  const chest = x => `<g>${glowBlob(x, 226, 66)}
      <rect x="${x - 46}" y="232" width="92" height="46" rx="6" fill="#6b4226"/>
      <rect x="${x - 46}" y="232" width="92" height="46" rx="6" fill="none" stroke="#2a1a10" stroke-width="2"/>
      <rect x="${x - 50}" y="240" width="100" height="7" fill="#b8883c"/>
      <rect x="${x - 6}" y="244" width="12" height="14" rx="2" fill="#e0b453"/>
      <path class="sc-glow" d="M${x - 40},234 Q${x},214 ${x + 40},234 Z" fill="#9fc0ff"/>
      <g fill="#ffd36b">${[-24, -10, 6, 20].map((d, i) => `<circle cx="${x + d}" cy="${230 - (i % 2) * 4}" r="5"/>`).join('')}</g>
      <circle cx="${x + 2}" cy="224" r="6" fill="#dfe8ff"/>
      <path d="M${x - 46},232 L${x - 40},186 C${x - 20},172 ${x + 20},172 ${x + 40},186 L${x + 46},232 Z" fill="#7a4b2b" transform="rotate(-8 ${x - 46} 232)"/>
      <path d="M${x - 44},226 L${x - 40},190" stroke="#b8883c" stroke-width="6" transform="rotate(-8 ${x - 46} 232)"/>
    </g>`;

  function embed(svg, x, y, w, flip) {
    const h = w * 1.7;
    const inner = svg.replace('<svg ', `<svg x="${x}" y="${y}" width="${w}" height="${h}" `);
    return flip ? `<g transform="translate(${2 * x + w} 0) scale(-1 1)">${inner}</g>` : inner;
  }

  function buildScene() {
    const el = $('#scene');
    if (!el) return;
    let rays = '';
    [[120, 70], [300, 50], [520, 90], [760, 60], [930, 80]].forEach(([x, w], i) => {
      rays += `<path class="sc-ray" style="animation-delay:${-i * 1.3}s" d="M${x},0 L${x + w},0 L${x + w * 2.2 - 60},350 L${x - 80},350 Z" fill="url(#sc-rayg)"/>`;
    });
    let bubbles = '';
    for (let i = 0; i < 14; i++) {
      const x = 40 + Math.random() * 984, r = 1.5 + Math.random() * 3.5;
      bubbles += `<circle class="sc-bubble" style="animation-delay:${(-Math.random() * 6).toFixed(2)}s;animation-duration:${(5 + Math.random() * 4).toFixed(1)}s" cx="${x.toFixed(0)}" cy="${(290 + Math.random() * 40).toFixed(0)}" r="${r.toFixed(1)}" fill="none" stroke="#cfeaff" stroke-opacity="0.6"/>`;
    }
    const fishS = (x, y, s, c, flip) => `<g transform="translate(${x} ${y}) scale(${flip ? -s : s} ${s})" fill="${c}" opacity="0.5"><path d="M18,0 C14,-8 -6,-8 -12,0 C-6,8 14,8 18,0Z"/><path d="M-11,0 L-20,-7 L-18,0 L-20,7Z"/></g>`;
    const bgFish = [fishS(200, 70, 1.1, '#6aa6c8'), fishS(232, 84, 0.9, '#6aa6c8'), fishS(214, 96, 1, '#6aa6c8'), fishS(860, 60, 1.2, '#7ab0cf', true), fishS(890, 74, 0.9, '#7ab0cf', true), fishS(660, 110, 1.4, '#e8b64a', true)].join('');

    const kelpL = [20, 48, 70].map((x, i) => `<path class="sway sway--kelp" style="transform-origin:${x}px 350px;animation-delay:${-i * 2}s" d="M${x},350 C${x - 20},270 ${x + 20},200 ${x - 6},${110 + i * 20}" stroke="#3f6a38" stroke-width="7" fill="none" stroke-linecap="round" opacity="0.85"/>`).join('')
      + [1000, 1030, 1050].map((x, i) => `<path class="sway sway--kelp" style="transform-origin:${x}px 350px;animation-delay:${-i * 1.6}s" d="M${x},350 C${x + 20},270 ${x - 20},200 ${x + 6},${100 + i * 24}" stroke="#3f6a38" stroke-width="7" fill="none" stroke-linecap="round" opacity="0.85"/>`).join('');

    el.innerHTML = `<svg viewBox="0 0 1064 350" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="sc-water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d4f72"/><stop offset="0.55" stop-color="#083453"/><stop offset="1" stop-color="#041a30"/></linearGradient>
        <linearGradient id="sc-rayg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfeaff" stop-opacity="0.35"/><stop offset="1" stop-color="#bfeaff" stop-opacity="0"/></linearGradient>
        <linearGradient id="sc-sand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8f7f63"/><stop offset="1" stop-color="#4d4538"/></linearGradient>
        <linearGradient id="sc-ledge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b4a50"/><stop offset="1" stop-color="#16222b"/></linearGradient>
        <radialGradient id="sc-halo"><stop offset="0" stop-color="#2553e6" stop-opacity="0.55"/><stop offset="1" stop-color="#2553e6" stop-opacity="0"/></radialGradient>
        <radialGradient id="sc-pearl" cx="0.35" cy="0.35"><stop offset="0" stop-color="#ffffff"/><stop offset="0.6" stop-color="#cfdcff"/><stop offset="1" stop-color="#6f8fe0"/></radialGradient>
        <linearGradient id="sc-glass" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5fb3c9" stop-opacity="0.55"/><stop offset="1" stop-color="#2d7c98" stop-opacity="0.35"/></linearGradient>
        <filter id="sc-blur"><feGaussianBlur stdDeviation="4"/></filter>
      </defs>
      <rect width="1064" height="350" fill="url(#sc-water)"/>
      ${rays}
      ${bgFish}
      <path d="M0,230 C120,200 200,236 320,214 C460,190 560,230 700,206 C820,188 930,220 1064,200 L1064,350 L0,350Z" fill="#0b2a40" opacity="0.8"/>
      ${kelpL}
      <path d="M0,286 C160,272 300,292 532,280 C760,268 900,290 1064,278 L1064,350 L0,350Z" fill="url(#sc-ledge)"/>
      <path d="M0,286 C160,272 300,292 532,280 C760,268 900,290 1064,278" fill="none" stroke="#6aa0bd" stroke-opacity="0.35" stroke-width="2"/>
      ${pedestal(110)}${clam(110)}
      ${pedestal(262)}${bottle(262)}
      ${pedestal(412)}${trident(412)}
      ${pedestal(800)}${conch(800)}
      ${pedestal(952)}${chest(952)}
      ${glowBlob(600, 170, 140)}
      <g class="sc-bob">${embed(him(), 492, 22, 150, false)}</g>
      <g class="sc-bob sc-bob--2">${embed(her(), 596, 36, 140, true)}</g>
      ${bubbles}
    </svg>`;
  }
  buildScene();
})();
