/* Bonded — page behaviour.
   No dependencies. Everything the pages show comes through one adapter
   (`Bonded.adapter`), so wiring the real protocol means replacing that
   object, not touching the pages. See README → "Wiring the chain". */

(() => {
  'use strict';

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  /* =====================================================================
     CONFIG — the protocol facts the pages print. Fill these in.
     ===================================================================== */
  const CONFIG = {
    chain: 'Base',
    explorer: 'https://basescan.org',
    fee: '0.002 ETH',
    swapFee: '1.0%',
    creatorShare: '50%',
    factory: '0x0000000000000000000000000000000000000000',
    token: '0x0000000000000000000000000000000000000000',
    lockUrl: '#',
    factoryUrl: '#',
    docsUrl: '#',
    xUrl: '#',
    supply: 1_000_000_000,
  };

  /* =====================================================================
     SAMPLE DATA — replaced by the adapter once it talks to the chain.
     Stock prices are USD references; `z` is the element number shown on
     the tile. Pair figures are illustrative.
     ===================================================================== */
  const STOCKS = [
    { sym: 'NVDA',  name: 'NVIDIA',      price: 178.20,  z: 1 },
    { sym: 'TSLA',  name: 'Tesla',       price: 412.85,  z: 2 },
    { sym: 'AAPL',  name: 'Apple',       price: 236.10,  z: 3 },
    { sym: 'MSFT',  name: 'Microsoft',   price: 512.40,  z: 4 },
    { sym: 'AMZN',  name: 'Amazon',      price: 231.60,  z: 5 },
    { sym: 'GOOGL', name: 'Alphabet',    price: 244.30,  z: 6 },
    { sym: 'META',  name: 'Meta',        price: 744.90,  z: 7 },
    { sym: 'SPY',   name: 'S&P 500 ETF', price: 661.20,  z: 8 },
    { sym: 'COIN',  name: 'Coinbase',    price: 318.70,  z: 9 },
    { sym: 'HOOD',  name: 'Robinhood',   price: 118.40,  z: 10 },
    { sym: 'MSTR',  name: 'Strategy',    price: 341.20,  z: 11 },
    { sym: 'PLTR',  name: 'Palantir',    price: 172.30,  z: 12 },
  ];

  // name, ticker, stock, market cap USD, 24h volume USD, 24h change %, holders, age hours
  const PAIRS = [
    ['Robotaxi Season',  'ROBO',  'TSLA',  1_840_000,  612_000,  38.4, 2140, 6],
    ['Blackwell Bros',   'BWELL', 'NVDA',  4_210_000,  1_380_000, 12.1, 5120, 31],
    ['Jensen Jacket',    'JACKET','NVDA',  920_000,    284_000,  -8.6, 1430, 52],
    ['Vision Pro Max',   'VISION','AAPL',  610_000,    141_000,  4.2,  880,  9],
    ['Copilot Cult',     'CPLT',  'MSFT',  1_120_000,  310_000,  22.7, 1760, 18],
    ['Prime Day Every Day','PRIME','AMZN', 380_000,    92_000,   -3.1, 540,  3],
    ['Gemini Twins',     'TWINS', 'GOOGL', 2_060_000,  744_000,  15.9, 2980, 40],
    ['Zuck Chain',       'ZUCK',  'META',  1_470_000,  402_000,  -12.4, 2210, 77],
    ['Index Enjoyer',    'INDEX', 'SPY',   3_320_000,  866_000,  2.8,  6100, 120],
    ['Base Camp',        'CAMP',  'COIN',  760_000,    198_000,  47.3, 1010, 2],
    ['Retail Army',      'RETAIL','HOOD',  540_000,    166_000,  9.5,  790,  14],
    ['Saylor Says',      'SAYS',  'MSTR',  1_980_000,  528_000,  -5.7, 2660, 61],
    ['Karp Diem',        'KARP',  'PLTR',  430_000,    121_000,  18.2, 620,  5],
    ['Dojo Dreams',      'DOJO',  'TSLA',  290_000,    88_000,   -21.9, 470, 1],
    ['CUDA Cartel',      'CUDA',  'NVDA',  2_740_000,  915_000,  6.3,  3870, 96],
    ['Tim Apple',        'TIMMY', 'AAPL',  210_000,    54_000,   61.0, 330,  0.5],
    ['Azure Sky',        'AZURE', 'MSFT',  350_000,    73_000,   -1.4, 510,  27],
    ['Two Day Shipping', 'SHIP',  'AMZN',  1_260_000,  356_000,  8.8,  1920, 44],
  ].map(([name, ticker, stock, mcap, volume, change, holders, ageH]) => ({
    name, ticker, stock, mcap, volume, change, holders,
    createdAt: Date.now() - ageH * 3600e3,
    address: '0x' + hash(ticker + name).toString(16).padStart(8, '0').repeat(5),
  }));

  /* =====================================================================
     ADAPTER — the only thing the pages talk to.
     Replace `window.BONDED_ADAPTER` (define it before app.js loads) with an
     object exposing the same five methods and the pages run on real data.
     ===================================================================== */
  const mockAdapter = {
    async stats() {
      const volume = PAIRS.reduce((s, p) => s + p.volume, 0);
      const locked = PAIRS.reduce((s, p) => s + p.mcap * 0.31, 0);
      return { pairs: 1284, volumeUsd: volume * 3.6, lockedUsd: locked * 4.2 };
    },
    async stocks() {
      return STOCKS.map(s => ({ ...s, pairs: PAIRS.filter(p => p.stock === s.sym).length * 17 + s.z * 3 }));
    },
    async pairs() { return PAIRS.slice(); },
    async connect() {
      if (window.ethereum?.request) {
        const [address] = await window.ethereum.request({ method: 'eth_requestAccounts' });
        return { address };
      }
      await wait(500);
      return { address: '0xd3m0' + 'bonded'.padEnd(30, '0') + 'cafe' };
    },
    async createPair(payload) {
      // Real implementation: call the factory with payload and return the receipt.
      await wait(1600);
      const h = hash(JSON.stringify(payload) + Date.now()).toString(16);
      return {
        txHash: '0x' + (h + h + h + h + h + h + h + h).slice(0, 64),
        tokenAddress: '0x' + (h + h + h + h + h).slice(0, 40),
        pairAddress:  '0x' + (h + h + h + h + h).slice(2, 42),
      };
    },
  };

  const adapter = window.BONDED_ADAPTER || mockAdapter;
  window.Bonded = { config: CONFIG, adapter, stocks: STOCKS, pairs: PAIRS };

  /* =====================================================================
     helpers
     ===================================================================== */
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
  function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const fmtUsd = n => {
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + n.toFixed(n < 1 ? 4 : 2);
  };
  const fmtNum = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(Math.round(n));
  const fmtPct = n => (n > 0 ? '+' : '') + n.toFixed(1) + '%';
  const fmtAge = ts => {
    const m = Math.max(1, Math.round((Date.now() - ts) / 60e3));
    if (m < 60) return m + 'm';
    const h = Math.round(m / 60); if (h < 48) return h + 'h';
    return Math.round(h / 24) + 'd';
  };
  const SUB = '₀₁₂₃₄₅₆₇₈₉';
  // shares per token: 0.0000042 → 0.0₅42
  const fmtShares = x => {
    if (x === 0) return '0';
    if (x >= 1) return x.toFixed(3);
    const s = x.toFixed(18).replace(/0+$/, '');
    const m = s.match(/^0\.(0*)(\d+)$/);
    if (!m) return x.toPrecision(3);
    const zeros = m[1].length, digits = m[2].slice(0, 3);
    if (zeros < 4) return '0.' + m[1] + digits;
    return '0.0' + String(zeros).split('').map(d => SUB[+d]).join('') + digits;
  };

  const stockOf = sym => STOCKS.find(s => s.sym === sym) || STOCKS[0];
  const priceUsd = p => p.mcap / CONFIG.supply;
  const priceShares = p => priceUsd(p) / stockOf(p.stock).price;
  const initials = name => name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const avatarHue = ticker => hash(ticker) % 360;

  // deterministic walk that ends in the direction of the 24h change
  function series(p, n = 28) {
    let seed = hash(p.ticker), v = 100; const out = [];
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const drift = p.change / n / 100;
    for (let i = 0; i < n; i++) { v *= 1 + drift + (rnd() - .5) * .06; out.push(v); }
    const target = 100 * (1 + p.change / 100); const k = target / out[n - 1];
    return out.map((y, i) => y * (1 + (k - 1) * i / (n - 1)));
  }
  function sparkline(p, w = 260, h = 46) {
    const pts = series(p); const min = Math.min(...pts), max = Math.max(...pts) || 1;
    const xy = pts.map((y, i) => [i / (pts.length - 1) * w, h - 3 - (y - min) / (max - min || 1) * (h - 6)]);
    const line = xy.map(([x, y]) => x.toFixed(1) + ',' + y.toFixed(1)).join(' ');
    const fill = `0,${h} ${line} ${w},${h}`;
    return `<svg class="bd-spark ${p.change < 0 ? 'is-down' : ''}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><polygon class="bd-spark-fill" points="${fill}"/><polyline points="${line}"/></svg>`;
  }
  const avatar = (p, extra = '') => `<span class="bd-avatar ${extra}" style="background:hsl(${avatarHue(p.ticker)} 70% 58%)">${esc(initials(p.name))}</span>`;
  const badge = p => {
    const ageH = (Date.now() - p.createdAt) / 3600e3;
    if (ageH < 6) return '<span class="bd-badge bd-badge-new">new</span>';
    if (p.volume / p.mcap > .3) return '<span class="bd-badge bd-badge-hot">hot</span>';
    return '';
  };

  function pairCard(p) {
    const st = stockOf(p.stock);
    return `
      <div class="bd-paircard-head">
        ${avatar(p)}
        <div><div class="bd-paircard-name">${esc(p.name)}</div><div class="bd-paircard-pair">$${esc(p.ticker)} / ${st.sym}</div></div>
        <span class="bd-pair-chg ${p.change >= 0 ? 'bd-up' : 'bd-down'}">${fmtPct(p.change)}</span>
      </div>
      <div class="bd-paircard-price"><b>${fmtShares(priceShares(p))} <span class="bd-gold">${st.sym}</span></b><span>≈ ${fmtUsd(priceUsd(p))}</span></div>
      ${sparkline(p)}
      <div class="bd-paircard-foot"><span>MC ${fmtUsd(p.mcap)}</span><span>Vol ${fmtUsd(p.volume)}</span><span>${fmtNum(p.holders)} holders</span></div>`;
  }

  /* =====================================================================
     shared chrome
     ===================================================================== */
  document.body.classList.add('bd-js');

  // theme
  const SUN  = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4"/></svg>';
  const MOON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/></svg>';
  const themeBtn = $('#theme');
  const applyTheme = mode => { document.documentElement.setAttribute('data-theme', mode); if (themeBtn) themeBtn.innerHTML = mode === 'light' ? MOON : SUN; };
  let stored = null; try { stored = localStorage.getItem('bonded-theme'); } catch (_) {}
  applyTheme(stored === 'light' ? 'light' : 'dark');
  themeBtn?.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    applyTheme(next); try { localStorage.setItem('bonded-theme', next); } catch (_) {}
  });

  // menu
  const burger = $('#burger'), links = $('#navlinks');
  burger?.addEventListener('click', () => { const open = links.classList.toggle('is-open'); burger.setAttribute('aria-expanded', String(open)); });

  // anchor navigation with the nav height taken out
  const navH = () => ($('.bd-nav')?.offsetHeight || 64) + 8;
  $$('[data-scroll]').forEach(el => el.addEventListener('click', e => {
    const t = document.getElementById(el.dataset.scroll); if (!t) return;
    e.preventDefault(); links?.classList.remove('is-open');
    window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - navH(), behavior: 'smooth' });
  }));
  if (location.hash) { const t = document.getElementById(location.hash.slice(1)); if (t) setTimeout(() => window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - navH() }), 50); }

  // active section
  const sectionLinks = $$('.bd-nav-links a[data-scroll]');
  if (sectionLinks.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => entries.forEach(en => {
      if (!en.isIntersecting) return;
      sectionLinks.forEach(a => a.classList.toggle('is-active', a.dataset.scroll === en.target.id));
    }), { rootMargin: '-40% 0px -55% 0px' });
    sectionLinks.forEach(a => { const t = document.getElementById(a.dataset.scroll); if (t) io.observe(t); });
  }

  // reveal
  const rises = $$('.bd-rise');
  if ('IntersectionObserver' in window && rises.length) {
    const io = new IntersectionObserver(entries => entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } }), { threshold: .08 });
    rises.forEach(el => io.observe(el));
  } else rises.forEach(el => el.classList.add('is-in'));

  // config → page
  $$('[data-cfg]').forEach(el => { const v = CONFIG[el.dataset.cfg]; if (v != null) el.textContent = v; });
  $$('[data-cfg-href]').forEach(el => { const v = CONFIG[el.dataset.cfgHref]; if (v) el.href = v; });
  $$('[data-year]').forEach(el => el.textContent = new Date().getFullYear());
  $$('[data-copy]').forEach(btn => btn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(CONFIG[btn.dataset.copy]); btn.textContent = 'copied'; setTimeout(() => btn.textContent = 'copy', 1200); } catch (_) {}
  }));

  // stats → strip and proof
  adapter.stats().then(s => {
    const map = { pairs: fmtNum(s.pairs), volume: fmtUsd(s.volumeUsd), locked: fmtUsd(s.lockedUsd) };
    $$('[data-stat]').forEach(el => { if (map[el.dataset.stat]) el.textContent = map[el.dataset.stat]; });
  }).catch(() => {});

  // wallet
  let wallet = null;
  const walletBtns = $$('#wallet');
  const shortAddr = a => a.slice(0, 6) + '…' + a.slice(-4);
  const setWallet = w => { wallet = w; walletBtns.forEach(b => b.textContent = w ? shortAddr(w.address) : 'Connect wallet'); document.dispatchEvent(new CustomEvent('bonded:wallet', { detail: w })); };
  const connect = async () => { try { setWallet(await adapter.connect()); } catch (e) { console.warn('wallet', e); } return wallet; };
  walletBtns.forEach(b => b.addEventListener('click', () => wallet ? null : connect()));

  /* =====================================================================
     hero binding — used by home and launch
     ===================================================================== */
  function bindHero(stock, coin) {
    $$('[data-hero-stock]').forEach(el => el.textContent = stock.sym);
    $$('[data-hero-stock-name]').forEach(el => el.textContent = stock.name.toUpperCase());
    if (coin != null) $$('[data-hero-coin]').forEach(el => el.textContent = coin);
  }

  function elementTile(s, active) {
    return `<button class="bd-element ${active ? 'is-active' : ''}" type="button" data-sym="${s.sym}">
      <span class="bd-el-z">${String(s.z).padStart(2, '0')}</span>
      <div class="bd-el-sym">${s.sym}</div>
      <div class="bd-el-name">${esc(s.name)}</div>
      <div class="bd-el-row"><span class="bd-mono">$${s.price.toFixed(2)}</span><span>${s.pairs} pairs</span></div>
    </button>`;
  }

  /* =====================================================================
     HOME
     ===================================================================== */
  const page = document.body.dataset.page;

  if (page === 'home') {
    const grid = $('#elements-grid'), card = $('#hero-card'), pairsGrid = $('#pairs-grid');
    let current = 'NVDA';

    const heroPair = () => PAIRS.filter(p => p.stock === current).sort((a, b) => b.volume - a.volume)[0] || PAIRS[0];
    const paint = () => {
      const st = stockOf(current), p = heroPair();
      bindHero(st, p.ticker);
      if (card) card.innerHTML = pairCard(p);
      $$('.bd-element', grid).forEach(b => b.classList.toggle('is-active', b.dataset.sym === current));
      $$('a[href="launch.html"]', $('#elements')).forEach(a => a.href = 'launch.html?stock=' + current);
    };

    adapter.stocks().then(stocks => {
      grid.innerHTML = stocks.map(s => elementTile(s, s.sym === current)).join('');
      grid.addEventListener('click', e => { const b = e.target.closest('[data-sym]'); if (!b) return; current = b.dataset.sym; paint(); });
      paint();
    });

    adapter.pairs().then(pairs => {
      const pick = pairs.slice().sort((a, b) => (b.volume / b.mcap) - (a.volume / a.mcap)).slice(0, 6);
      pairsGrid.innerHTML = pick.map(p => {
        const st = stockOf(p.stock);
        return `<a class="bd-pair" href="board.html?q=${encodeURIComponent(p.ticker)}">
          <div class="bd-pair-head">${avatar(p)}
            <div><div class="bd-pair-name">${esc(p.name)} ${badge(p)}</div><div class="bd-pair-sub">$${esc(p.ticker)} · <span class="bd-gold">${st.sym}</span> · ${fmtAge(p.createdAt)} ago</div></div>
            <span class="bd-pair-chg ${p.change >= 0 ? 'bd-up' : 'bd-down'}">${fmtPct(p.change)}</span>
          </div>
          ${sparkline(p)}
          <div class="bd-pair-row">
            <div><b>${fmtShares(priceShares(p))} ${st.sym}</b><span>price</span></div>
            <div><b>${fmtUsd(p.mcap)}</b><span>market cap</span></div>
            <div><b>${fmtUsd(p.volume)}</b><span>24h volume</span></div>
          </div>
        </a>`;
      }).join('');
    });
  }

  /* =====================================================================
     BOARD
     ===================================================================== */
  if (page === 'board') {
    const rows = $('#rows'), cards = $('#cards'), empty = $('#empty'), chips = $('#stock-chips'), search = $('#search'), sortSel = $('#sort');
    const params = new URLSearchParams(location.search);
    const state = { tab: 'all', stock: params.get('stock') || 'all', q: params.get('q') || '', sort: 'volume', dir: -1 };
    if (state.q) search.value = state.q;
    let all = [];

    const applyFilters = () => {
      const q = state.q.trim().toLowerCase();
      let list = all.filter(p =>
        (state.stock === 'all' || p.stock === state.stock) &&
        (!q || p.name.toLowerCase().includes(q) || p.ticker.toLowerCase().includes(q) || p.stock.toLowerCase().includes(q)));
      if (state.tab === 'new') list = list.filter(p => Date.now() - p.createdAt < 24 * 3600e3);
      if (state.tab === 'hot') list = list.filter(p => p.volume / p.mcap > .25);
      if (state.tab === 'top') list = list.filter(p => p.mcap > 1e6);
      const key = { name: p => p.name.toLowerCase(), stock: p => p.stock, price: priceUsd, change: p => p.change, mcap: p => p.mcap, volume: p => p.volume, holders: p => p.holders, age: p => p.createdAt }[state.sort];
      list.sort((a, b) => { const x = key(a), y = key(b); return (x > y ? 1 : x < y ? -1 : 0) * state.dir; });
      return list;
    };

    const render = () => {
      const list = applyFilters();
      empty.hidden = list.length > 0;
      $$('th[data-sort]').forEach(th => th.classList.toggle('is-sorted', th.dataset.sort === state.sort));
      rows.innerHTML = list.map(p => {
        const st = stockOf(p.stock);
        return `<tr>
          <td><div class="bd-cell-pair">${avatar(p)}<div><b>${esc(p.name)} ${badge(p)}</b><span>$${esc(p.ticker)}</span></div></div></td>
          <td><span class="bd-stocktag"><i></i>${st.sym}</span></td>
          <td class="is-num bd-cell-price"><b>${fmtShares(priceShares(p))} ${st.sym}</b><span>≈ ${fmtUsd(priceUsd(p))}</span></td>
          <td class="is-num bd-mono ${p.change >= 0 ? 'bd-up' : 'bd-down'}">${fmtPct(p.change)}</td>
          <td>${sparkline(p, 96, 30)}</td>
          <td class="is-num bd-mono">${fmtUsd(p.mcap)}</td>
          <td class="is-num bd-mono">${fmtUsd(p.volume)}</td>
          <td class="is-num bd-mono">${fmtNum(p.holders)}</td>
          <td class="is-num bd-mono">${fmtAge(p.createdAt)}</td>
          <td class="is-num"><a class="bd-btn bd-btn-xs bd-btn-gold" href="${CONFIG.explorer}/address/${p.address}" target="_blank" rel="noopener">Trade</a></td>
        </tr>`;
      }).join('');
      cards.innerHTML = list.map(p => `<div class="bd-pair">${pairCard(p)}</div>`).join('');
    };

    adapter.stocks().then(stocks => {
      chips.innerHTML = `<button class="bd-chip ${state.stock === 'all' ? 'is-active' : ''}" data-stock="all" type="button">All stocks</button>` +
        stocks.map(s => `<button class="bd-chip ${state.stock === s.sym ? 'is-active' : ''}" data-stock="${s.sym}" type="button">${s.sym}</button>`).join('');
      chips.addEventListener('click', e => {
        const b = e.target.closest('[data-stock]'); if (!b) return;
        state.stock = b.dataset.stock; $$('.bd-chip', chips).forEach(c => c.classList.toggle('is-active', c === b)); render();
      });
    });
    adapter.pairs().then(pairs => { all = pairs; render(); });

    $('#tabs').addEventListener('click', e => {
      const b = e.target.closest('[data-tab]'); if (!b) return;
      state.tab = b.dataset.tab; $$('.bd-tab').forEach(t => t.classList.toggle('is-active', t === b)); render();
    });
    search.addEventListener('input', () => { state.q = search.value; render(); });
    sortSel.addEventListener('change', () => { state.sort = sortSel.value; state.dir = state.sort === 'name' || state.sort === 'stock' ? 1 : -1; render(); });
    $$('th[data-sort]').forEach(th => th.addEventListener('click', () => {
      if (state.sort === th.dataset.sort) state.dir *= -1; else { state.sort = th.dataset.sort; state.dir = th.dataset.sort === 'name' || th.dataset.sort === 'stock' ? 1 : -1; }
      if ([...sortSel.options].some(o => o.value === state.sort)) sortSel.value = state.sort;
      render();
    }));
  }

  /* =====================================================================
     LAUNCH
     ===================================================================== */
  if (page === 'launch') {
    const params = new URLSearchParams(location.search);
    const form = { stock: params.get('stock') || 'NVDA', name: '', ticker: '', desc: '', image: '', buy: '', x: '', site: '' };
    const panels = $$('[data-step]'), steps = $$('#stepper span');
    const grid = $('#launch-elements'), preview = $('#preview-card');
    let step = 1;

    const previewPair = () => ({
      name: form.name || 'Your token', ticker: form.ticker || 'TKN', stock: form.stock,
      mcap: 25_000 + (form.buy ? Number(form.buy) * stockOf(form.stock).price * 12 : 0), volume: 0, change: 0, holders: 1, createdAt: Date.now(),
    });
    const paintPreview = () => {
      const st = stockOf(form.stock);
      bindHero(st, form.ticker || '?');
      preview.innerHTML = pairCard(previewPair());
      $('#f-ticker-pair').textContent = '/ ' + st.sym;
      $('#f-buy-unit').textContent = st.sym;
    };
    const show = n => {
      step = n;
      panels.forEach(p => p.hidden = Number(p.dataset.step) !== n);
      steps.forEach((s, i) => { s.classList.toggle('is-done', i + 1 < n); s.classList.toggle('is-active', i + 1 === n); });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    adapter.stocks().then(stocks => {
      if (!stocks.some(s => s.sym === form.stock)) form.stock = stocks[0].sym;
      grid.innerHTML = stocks.map(s => elementTile(s, s.sym === form.stock)).join('');
      grid.addEventListener('click', e => {
        const b = e.target.closest('[data-sym]'); if (!b) return;
        form.stock = b.dataset.sym; $$('.bd-element', grid).forEach(x => x.classList.toggle('is-active', x === b)); paintPreview();
      });
      paintPreview();
    });

    const fields = { name: '#f-name', ticker: '#f-ticker', desc: '#f-desc', image: '#f-image', buy: '#f-buy', x: '#f-x', site: '#f-site' };
    Object.entries(fields).forEach(([k, sel]) => $(sel).addEventListener('input', e => {
      form[k] = k === 'ticker' ? e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') : e.target.value;
      if (k === 'ticker') e.target.value = form[k];
      paintPreview();
    }));

    const validate = () => {
      const err = $('#f-error');
      const problems = [];
      if (form.name.trim().length < 2) problems.push('Give the token a name (2 to 32 characters).');
      if (form.ticker.length < 2 || form.ticker.length > 8) problems.push('The ticker needs 2 to 8 letters or digits.');
      if (form.ticker && STOCKS.some(s => s.sym === form.ticker)) problems.push('That ticker is a stock symbol; pick another.');
      if (form.buy && Number(form.buy) < 0) problems.push('The first buy cannot be negative.');
      if (form.image && !/^https?:\/\//.test(form.image)) problems.push('The image needs a full https URL.');
      err.hidden = !problems.length; err.textContent = problems.join(' ');
      return !problems.length;
    };

    const reviewRows = () => {
      const st = stockOf(form.stock);
      return [
        ['Token', `${esc(form.name)} ($${esc(form.ticker)})`],
        ['Bonded to', `${st.sym} · ${esc(st.name)}`],
        ['Supply', CONFIG.supply.toLocaleString('en-US') + ' · fixed, no mint'],
        ['Pool', `${esc(form.ticker)} / ${st.sym} · liquidity locked`],
        ['Ownership', 'renounced at deploy'],
        ['Swap fee', `${CONFIG.swapFee} · ${CONFIG.creatorShare} to you`],
        ['First buy', form.buy ? `${Number(form.buy)} ${st.sym}` : 'none'],
        ['Creation fee', CONFIG.fee],
        ['Chain', CONFIG.chain],
      ].map(([k, v]) => `<div class="bd-review-row"><span>${k}</span><b>${v}</b></div>`).join('');
    };

    $$('[data-next]').forEach(b => b.addEventListener('click', () => {
      if (step === 2 && !validate()) return;
      if (step === 2) $('#review').innerHTML = reviewRows();
      show(step + 1);
    }));
    $$('[data-prev]').forEach(b => b.addEventListener('click', () => show(step - 1)));

    const deployBtn = $('#deploy');
    const paintDeploy = () => { deployBtn.textContent = wallet ? 'Bond it' : 'Connect wallet to bond'; };
    document.addEventListener('bonded:wallet', paintDeploy);
    paintDeploy();

    deployBtn.addEventListener('click', async () => {
      const err = $('#tx-error'); err.hidden = true;
      if (!wallet && !(await connect())) { err.hidden = false; err.textContent = 'No wallet connected.'; return; }
      deployBtn.disabled = true; deployBtn.textContent = 'Waiting for signature…';
      try {
        const res = await adapter.createPair({ ...form, supply: CONFIG.supply, creator: wallet.address });
        const st = stockOf(form.stock);
        $('#done').innerHTML = [
          ['Pair', `${esc(form.ticker)} / ${st.sym}`],
          ['Token', res.tokenAddress],
          ['Pool', res.pairAddress],
          ['Transaction', res.txHash.slice(0, 18) + '…'],
        ].map(([k, v]) => `<div class="bd-review-row"><span>${k}</span><b>${v}</b></div>`).join('');
        $('#done-tx').href = `${CONFIG.explorer}/tx/${res.txHash}`;
        show(4);
      } catch (e) {
        err.hidden = false; err.textContent = e?.message || 'The transaction was rejected.';
      } finally { deployBtn.disabled = false; paintDeploy(); }
    });
  }
})();
