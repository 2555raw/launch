/* Bonded — page behaviour.
   No dependencies. Everything the pages show comes through one adapter
   (`Bonded.adapter`), so wiring the real protocol means replacing that
   object, not touching the pages. See README → "Wiring the chain".
   Sections: config · sample data · adapter · helpers · chrome · the falls
   (hero scene) · home · pairs board · pair page · live · stocks · launch ·
   my playground · docs. */

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
    swapFeeRate: 0.01,
    creatorShare: '50%',
    creatorShareRate: 0.5,
    factory: '0x0000000000000000000000000000000000000000',
    token: '0x0000000000000000000000000000000000000000',
    lockUrl: '#',
    factoryUrl: '#',
    docsUrl: 'docs.html',
    xUrl: '#',
    supply: 1_000_000_000,
  };

  /* =====================================================================
     SAMPLE DATA — replaced by the adapter once it talks to the chain.
     `color` is the fish; tickers, never logos.
     ===================================================================== */
  const STOCKS = [
    { sym: 'NVDA',  name: 'NVIDIA',      price: 178.20, z: 1,  color: '#5FB53A' },
    { sym: 'TSLA',  name: 'Tesla',       price: 412.85, z: 2,  color: '#D8352E' },
    { sym: 'AAPL',  name: 'Apple',       price: 236.10, z: 3,  color: '#7A8794' },
    { sym: 'MSFT',  name: 'Microsoft',   price: 512.40, z: 4,  color: '#2F7FD8' },
    { sym: 'AMZN',  name: 'Amazon',      price: 231.60, z: 5,  color: '#F0962A' },
    { sym: 'GOOGL', name: 'Alphabet',    price: 244.30, z: 6,  color: '#E8B43A' },
    { sym: 'META',  name: 'Meta',        price: 744.90, z: 7,  color: '#1F6FEA' },
    { sym: 'SPY',   name: 'S&P 500 ETF', price: 661.20, z: 8,  color: '#28496B' },
    { sym: 'COIN',  name: 'Coinbase',    price: 318.70, z: 9,  color: '#3C5BF5' },
    { sym: 'HOOD',  name: 'Robinhood',   price: 118.40, z: 10, color: '#1FBF6C' },
    { sym: 'MSTR',  name: 'Strategy',    price: 341.20, z: 11, color: '#E3622A' },
    { sym: 'PLTR',  name: 'Palantir',    price: 172.30, z: 12, color: '#3A3F4A' },
  ];

  // name, ticker, stock, market cap USD, 24h volume USD, 24h change %, holders, age hours, one line
  const SEED_PAIRS = [
    ['Robotaxi Season',    'ROBO',  'TSLA',  1_840_000, 612_000,   38.4,  2140, 6,   'For everyone who thinks the robotaxi is the whole thesis.'],
    ['Blackwell Bros',     'BWELL', 'NVDA',  4_210_000, 1_380_000, 12.1,  5120, 31,  'Every chip has a family. This is the loud one.'],
    ['Jensen Jacket',      'JACKET','NVDA',  920_000,   284_000,   -8.6,  1430, 52,  'Leather, never cotton.'],
    ['Vision Pro Max',     'VISION','AAPL',  610_000,   141_000,   4.2,   880,  9,   'Spatial computing, priced in AAPL.'],
    ['Copilot Cult',       'CPLT',  'MSFT',  1_120_000, 310_000,   22.7,  1760, 18,  'The assistant that never sleeps, bonded to the company that never sells.'],
    ['Prime Day Every Day','PRIME', 'AMZN',  380_000,   92_000,    -3.1,  540,  3,   'Two-day shipping for your portfolio.'],
    ['Gemini Twins',       'TWINS', 'GOOGL', 2_060_000, 744_000,   15.9,  2980, 40,  'Two models, one ticker.'],
    ['Zuck Chain',         'ZUCK',  'META',  1_470_000, 402_000,   -12.4, 2210, 77,  'Metaverse survivors club.'],
    ['Index Enjoyer',      'INDEX', 'SPY',   3_320_000, 866_000,   2.8,   6100, 120, 'Boring on purpose. Bonded to the S&P.'],
    ['Base Camp',          'CAMP',  'COIN',  760_000,   198_000,   47.3,  1010, 2,   'Home of the chain, home of the coin.'],
    ['Retail Army',        'RETAIL','HOOD',  540_000,   166_000,   9.5,   790,  14,  'Confetti optional.'],
    ['Saylor Says',        'SAYS',  'MSTR',  1_980_000, 528_000,   -5.7,  2660, 61,  'There is no second best.'],
    ['Karp Diem',          'KARP',  'PLTR',  430_000,   121_000,   18.2,  620,  5,   'Seize the ontology.'],
    ['Dojo Dreams',        'DOJO',  'TSLA',  290_000,   88_000,    -21.9, 470,  1,   'Training on the road to full self-holding.'],
    ['CUDA Cartel',        'CUDA',  'NVDA',  2_740_000, 915_000,   6.3,   3870, 96,  'Parallel by design.'],
    ['Tim Apple',          'TIMMY', 'AAPL',  210_000,   54_000,    61.0,  330,  0.5, 'Good morning.'],
    ['Azure Sky',          'AZURE', 'MSFT',  350_000,   73_000,    -1.4,  510,  27,  'Cloud coverage, all day.'],
    ['Two Day Shipping',   'SHIP',  'AMZN',  1_260_000, 356_000,   8.8,   1920, 44,  'It arrives before you remember ordering it.'],
  ];
  const WORDS_A = ['Turbo', 'Quiet', 'Golden', 'Night', 'Pocket', 'Orbital', 'Velvet', 'Lucky', 'Deep', 'Paper'];
  const WORDS_B = ['Margin', 'Dividend', 'Quarter', 'Rally', 'Ticker', 'Halving', 'Guidance', 'Buyback', 'Beta', 'Float'];

  const mkPair = ([name, ticker, stock, mcap, volume, change, holders, ageH, desc], extra = {}) => ({
    name, ticker, stock, mcap, volume, change, holders, desc,
    createdAt: Date.now() - ageH * 3600e3,
    address: '0x' + hash(ticker + name).toString(16).padStart(8, '0').repeat(5),
    creator: '0x' + hash(name).toString(16).padStart(8, '0').repeat(5),
    ...extra,
  });

  /* =====================================================================
     persistence (the mock's memory between pages: launches and positions)
     ===================================================================== */
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} },
  };
  const LAUNCHED = store.get('bonded-launched', []);          // pairs created in this browser
  const HOLDINGS = store.get('bonded-holdings', {});          // ticker → token amount
  const PAIRS = [...LAUNCHED, ...SEED_PAIRS.map(p => mkPair(p))];
  const findPair = t => PAIRS.find(p => p.ticker === t);

  /* =====================================================================
     ADAPTER — the only thing the pages talk to.
     Replace `window.BONDED_ADAPTER` (define it before app.js loads) with an
     object exposing the same methods and the pages run on real data.
     ===================================================================== */
  const listeners = new Set();
  const emit = ev => listeners.forEach(fn => { try { fn(ev); } catch (_) {} });

  // a constant-product pool implied by the pair's market cap
  const pool = p => {
    const tokenReserve = CONFIG.supply * 0.55;
    const stockReserve = tokenReserve * priceShares(p);
    return { tokenReserve, stockReserve };
  };

  const mockAdapter = {
    async stats() {
      const volume = PAIRS.reduce((s, p) => s + p.volume, 0);
      const locked = PAIRS.reduce((s, p) => s + p.mcap * 0.31, 0);
      return { pairs: 1284 + LAUNCHED.length, volumeUsd: volume * 3.6, lockedUsd: locked * 4.2 };
    },
    async stocks() {
      return STOCKS.map(s => ({ ...s, pairs: PAIRS.filter(p => p.stock === s.sym).length * 17 + s.z * 3, change: ((hash(s.sym + 'd') % 700) - 300) / 100 }));
    },
    async pairs() { return PAIRS.slice(); },
    async pair(ticker) {
      const p = findPair(ticker); if (!p) return null;
      return { ...p, liquidityUsd: p.mcap * 0.31, series: priceSeries(p, 168), trades: tradeHistory(p) };
    },
    async connect() {
      if (window.ethereum?.request) {
        const [address] = await window.ethereum.request({ method: 'eth_requestAccounts' });
        return { address };
      }
      await wait(400);
      return { address: '0xd3m0' + 'bonded'.padEnd(30, '0') + 'cafe' };
    },
    async createPair(payload) {
      // Real implementation: call the factory with payload and return the receipt.
      await wait(1600);
      const h = hash(JSON.stringify(payload) + Date.now()).toString(16);
      const res = {
        txHash: '0x' + (h + h + h + h + h + h + h + h).slice(0, 64),
        tokenAddress: '0x' + (h + h + h + h + h).slice(0, 40),
        pairAddress:  '0x' + (h + h + h + h + h).slice(2, 42),
      };
      const st = stockOf(payload.stock);
      const buyUsd = Number(payload.buy || 0) * st.price;
      const p = mkPair([payload.name, payload.ticker, payload.stock, 25_000 + buyUsd * 12, buyUsd, 0, 1, 0, payload.desc || ''], {
        address: res.tokenAddress, creator: payload.creator, image: payload.image || '', x: payload.x || '', site: payload.site || '', mine: true,
      });
      LAUNCHED.unshift(p); PAIRS.unshift(p); store.set('bonded-launched', LAUNCHED);
      if (buyUsd > 0) { HOLDINGS[p.ticker] = (HOLDINGS[p.ticker] || 0) + Number(payload.buy) / priceShares(p) * 0.98; store.set('bonded-holdings', HOLDINGS); }
      emit({ kind: 'launch', pair: p, wallet: payload.creator, ts: Date.now() });
      return res;
    },
    async quote({ ticker, side, amount }) {
      const p = findPair(ticker); const { tokenReserve, stockReserve } = pool(p);
      const fee = amount * CONFIG.swapFeeRate; const inAmt = amount - fee;
      if (side === 'buy') {
        const out = tokenReserve * inAmt / (stockReserve + inAmt);
        return { out, priceImpact: inAmt / (stockReserve + inAmt), fee, feeUnit: p.stock };
      }
      const out = stockReserve * inAmt / (tokenReserve + inAmt);
      return { out, priceImpact: inAmt / (tokenReserve + inAmt), fee, feeUnit: ticker };
    },
    async swap({ ticker, side, amount, wallet }) {
      await wait(900);
      const p = findPair(ticker); const q = await this.quote({ ticker, side, amount });
      const st = stockOf(p.stock);
      if (side === 'buy') { HOLDINGS[ticker] = (HOLDINGS[ticker] || 0) + q.out; p.mcap *= 1 + q.priceImpact * 2; p.volume += amount * st.price; }
      else { HOLDINGS[ticker] = Math.max(0, (HOLDINGS[ticker] || 0) - amount); p.mcap *= 1 - q.priceImpact * 2; p.volume += q.out * st.price; }
      p.holders += side === 'buy' ? 1 : 0;
      store.set('bonded-holdings', HOLDINGS);
      const trade = { side, amountStock: side === 'buy' ? amount : q.out, amountToken: side === 'buy' ? q.out : amount, price: priceShares(p), wallet, ts: Date.now(), tx: '0x' + hash(ticker + Date.now()).toString(16).padStart(8, '0').repeat(8) };
      emit({ kind: side, pair: p, ...trade });
      return { txHash: trade.tx, trade };
    },
    async holdings() { return Object.entries(HOLDINGS).filter(([, a]) => a > 0).map(([ticker, amount]) => ({ ticker, amount })); },
    async launched() { return LAUNCHED.map(p => p.ticker); },
    subscribe(fn) {
      listeners.add(fn);
      if (listeners.size === 1 && !mockAdapter._timer) {
        const tick = () => {
          const r = Math.random();
          if (r < 0.06) {
            const st = STOCKS[Math.floor(Math.random() * STOCKS.length)];
            const name = WORDS_A[Math.floor(Math.random() * WORDS_A.length)] + ' ' + WORDS_B[Math.floor(Math.random() * WORDS_B.length)];
            const ticker = name.split(' ').map(w => w.slice(0, 3)).join('').toUpperCase().slice(0, 6);
            if (!findPair(ticker)) {
              const p = mkPair([name, ticker, st.sym, 18_000 + Math.random() * 40_000, 2_000 + Math.random() * 9_000, (Math.random() - .3) * 40, 1 + Math.floor(Math.random() * 12), 0, 'Just bonded.']);
              PAIRS.unshift(p); emit({ kind: 'launch', pair: p, wallet: p.creator, ts: Date.now() });
            }
          } else {
            const p = PAIRS[Math.floor(Math.random() * Math.min(PAIRS.length, 24))];
            const side = r < 0.78 ? 'buy' : 'sell';
            const amountStock = +(Math.random() ** 2 * 0.6 + 0.005).toFixed(4);
            const amountToken = amountStock / priceShares(p);
            emit({ kind: side, pair: p, amountStock, amountToken, price: priceShares(p), wallet: '0x' + Math.random().toString(16).slice(2, 10).padEnd(40, '0'), ts: Date.now() });
          }
          mockAdapter._timer = setTimeout(tick, 2200 + Math.random() * 3800);
        };
        mockAdapter._timer = setTimeout(tick, 1500);
      }
      return () => listeners.delete(fn);
    },
  };

  const adapter = window.BONDED_ADAPTER || mockAdapter;
  window.Bonded = { config: CONFIG, adapter, stocks: STOCKS, pairs: PAIRS };

  /* =====================================================================
     helpers
     ===================================================================== */
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
  function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const fmtUsd = n => {
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + n.toFixed(n < 1 ? 4 : 2);
  };
  const fmtNum = n => n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : n >= 100 ? String(Math.round(n)) : n.toFixed(n < 1 ? 4 : 2);
  const fmtPct = n => (n > 0 ? '+' : '') + n.toFixed(1) + '%';
  const fmtAge = ts => {
    const m = Math.max(1, Math.round((Date.now() - ts) / 60e3));
    if (m < 60) return m + 'm';
    const h = Math.round(m / 60); if (h < 48) return h + 'h';
    return Math.round(h / 24) + 'd';
  };
  const fmtTime = ts => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const shortAddr = a => a ? a.slice(0, 6) + '…' + a.slice(-4) : '—';
  const SUB = '₀₁₂₃₄₅₆₇₈₉';
  // shares per token: 0.0000042 → 0.0₅42
  const fmtShares = x => {
    if (!x) return '0';
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

  // deterministic walk that ends at the current price, in the direction of the 24h change
  function priceSeries(p, n = 28) {
    let seed = hash(p.ticker), v = 1; const out = [];
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const span = Math.min(n, 24);
    for (let i = 0; i < n; i++) { v *= 1 + (rnd() - .5) * .07; out.push(v); }
    // pin the last `span` points so that first→last = 24h change
    const k = (1 + p.change / 100) / (out[n - 1] / out[n - span]);
    for (let i = n - span; i < n; i++) out[i] *= 1 + (k - 1) * (i - (n - span)) / (span - 1);
    const scale = priceShares(p) / out[n - 1];
    return out.map(y => y * scale);
  }
  function tradeHistory(p) {
    let seed = hash(p.ticker + 't'); const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const out = []; let ts = Date.now() - 40e3;
    for (let i = 0; i < 18; i++) {
      const side = rnd() < .7 ? 'buy' : 'sell'; const amountStock = +(rnd() ** 2 * 0.5 + 0.004).toFixed(4);
      out.push({ side, amountStock, amountToken: amountStock / priceShares(p) * (1 + (rnd() - .5) * .1), price: priceShares(p) * (1 + (rnd() - .5) * .06), wallet: '0x' + Math.floor(rnd() * 1e12).toString(16).padEnd(40, '0'), ts, tx: '0x' + Math.floor(rnd() * 1e12).toString(16).padEnd(64, '0') });
      ts -= 30e3 + rnd() * 400e3;
    }
    return out;
  }
  function sparkline(p, w = 260, h = 46) {
    const pts = priceSeries(p, 28); const min = Math.min(...pts), max = Math.max(...pts);
    const xy = pts.map((y, i) => [i / (pts.length - 1) * w, h - 3 - (y - min) / (max - min || 1) * (h - 6)]);
    const line = xy.map(([x, y]) => x.toFixed(1) + ',' + y.toFixed(1)).join(' ');
    return `<svg class="bd-spark ${p.change < 0 ? 'is-down' : ''}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><polygon class="bd-spark-fill" points="0,${h} ${line} ${w},${h}"/><polyline points="${line}"/></svg>`;
  }
  const avatar = (p, extra = '') => p.image
    ? `<span class="bd-avatar ${extra}" style="background:url('${esc(p.image)}') center/cover"></span>`
    : `<span class="bd-avatar ${extra}" style="background:hsl(${avatarHue(p.ticker)} 70% 58%)">${esc(initials(p.name))}</span>`;
  const badge = p => {
    const ageH = (Date.now() - p.createdAt) / 3600e3;
    if (ageH < 6) return '<span class="bd-badge bd-badge-new">new</span>';
    if (p.volume / p.mcap > .3) return '<span class="bd-badge bd-badge-hot">hot</span>';
    return '';
  };
  const pairHref = p => 'pair.html?t=' + encodeURIComponent(p.ticker);

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
  function pairTile(p) {
    const st = stockOf(p.stock);
    return `<a class="bd-pair" href="${pairHref(p)}">
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
  }
  function elementTile(s, active) {
    return `<button class="bd-element ${active ? 'is-active' : ''}" type="button" data-sym="${s.sym}">
      <span class="bd-el-z">${String(s.z).padStart(2, '0')}</span>
      <div class="bd-el-sym">${s.sym}</div>
      <div class="bd-el-name">${esc(s.name)}</div>
      <div class="bd-el-row"><span class="bd-mono">$${s.price.toFixed(2)}</span><span>${s.pairs} pairs</span></div>
    </button>`;
  }
  const toastEl = $('#toast'); let toastT;
  const toast = msg => { if (!toastEl) return; toastEl.textContent = msg; toastEl.classList.add('is-on'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('is-on'), 2600); };

  /* =====================================================================
     shared chrome
     ===================================================================== */
  document.body.classList.add('bd-js');

  // one theme: the pale sky. The dark tokens stay in the stylesheet for later.
  document.documentElement.setAttribute('data-theme', 'light');

  // menu
  const burger = $('#burger'), links = $('#navlinks');
  burger?.addEventListener('click', () => { const open = links.classList.toggle('is-open'); burger.setAttribute('aria-expanded', String(open)); });
  document.addEventListener('click', e => { if (links?.classList.contains('is-open') && !e.target.closest('.bd-pill-left')) links.classList.remove('is-open'); });

  // anchor navigation
  const navH = () => 90;
  const scrollToId = id => { const t = document.getElementById(id); if (!t) return; window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - navH(), behavior: 'smooth' }); };
  $$('[data-scroll]').forEach(el => el.addEventListener('click', e => { e.preventDefault(); links?.classList.remove('is-open'); scrollToId(el.dataset.scroll); }));
  if (location.hash) { const t = document.getElementById(location.hash.slice(1)); if (t) setTimeout(() => window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - navH() }), 60); }

  // reveal
  const rises = $$('.bd-rise');
  if ('IntersectionObserver' in window && rises.length) {
    const io = new IntersectionObserver(entries => entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } }), { threshold: .08 });
    rises.forEach(el => io.observe(el));
  } else rises.forEach(el => el.classList.add('is-in'));

  // config → page
  const bindCfg = (root = document) => {
    $$('[data-cfg]', root).forEach(el => { const v = CONFIG[el.dataset.cfg]; if (v != null) el.textContent = v; });
    $$('[data-cfg-href]', root).forEach(el => { const v = CONFIG[el.dataset.cfgHref]; if (v) el.href = v; });
  };
  bindCfg();
  $$('[data-year]').forEach(el => el.textContent = new Date().getFullYear());
  const copyText = async (text, btn) => {
    try { await navigator.clipboard.writeText(text); } catch (_) {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (__) {} ta.remove();
    }
    if (btn) { const old = btn.textContent; btn.textContent = 'copied'; setTimeout(() => btn.textContent = old, 1200); }
    toast('Copied');
  };
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-copy]'); if (!b) return;
    copyText(b.dataset.copyText || CONFIG[b.dataset.copy] || b.dataset.copy, b);
  });

  // stats → strip and proof
  adapter.stats().then(s => {
    const map = { pairs: fmtNum(s.pairs), volume: fmtUsd(s.volumeUsd), locked: fmtUsd(s.lockedUsd) };
    $$('[data-stat]').forEach(el => { if (map[el.dataset.stat]) el.textContent = map[el.dataset.stat]; });
  }).catch(() => {});

  // wallet (remembered for the tab so it survives page changes)
  let wallet = null;
  const walletBtns = $$('.bd-wallet');
  const setWallet = w => {
    wallet = w; walletBtns.forEach(b => b.textContent = w ? shortAddr(w.address) : 'Connect wallet');
    try { w ? sessionStorage.setItem('bonded-wallet', JSON.stringify(w)) : sessionStorage.removeItem('bonded-wallet'); } catch (_) {}
    document.dispatchEvent(new CustomEvent('bonded:wallet', { detail: w }));
  };
  try { const w = JSON.parse(sessionStorage.getItem('bonded-wallet')); if (w?.address) setWallet(w); } catch (_) {}
  const connect = async () => { try { setWallet(await adapter.connect()); toast('Wallet connected'); } catch (e) { console.warn('wallet', e); } return wallet; };
  walletBtns.forEach(b => b.addEventListener('click', () => wallet ? (location.href = 'playground.html') : connect()));

  const page = document.body.dataset.page;

  /* =====================================================================
     THE FALLS — the hero scene. Each fish is a stock. It falls down one of
     the two falls, lands in the pond, swims slowly for about six seconds,
     sinks, and comes back over the top. Grab one: drop it in the pond and
     it swims; drop it in the air and it falls again. Click one to pick it.
     ===================================================================== */
  function falls() {
    const scene = $('#scene'), pondEl = $('#pond'), label = $('#fish-label'), hero = $('#hero');
    if (!scene) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const FISH_SVG = (s) => `<svg viewBox="-2 -6 104 68" aria-hidden="true">
      <path class="bd-fish-fin" d="M16 28 L0 8 L7 28 L0 48 Z"/>
      <path class="bd-fish-fin" d="M38 10 Q52 -6 68 10 Z"/>
      <path class="bd-fish-fin" d="M46 46 Q56 58 66 46 Z"/>
      <ellipse class="bd-fish-body" cx="52" cy="28" rx="40" ry="20"/>
      <path class="bd-fish-shade" d="M18 34 Q52 54 88 32 Q58 46 18 34 Z"/>
      <ellipse class="bd-fish-light" cx="46" cy="19" rx="22" ry="6"/>
      <circle class="bd-fish-eye" cx="80" cy="24" r="4.6"/><circle class="bd-fish-pupil" cx="81.5" cy="24" r="2.3"/>
      <text x="50" y="29" class="bd-fish-sym">${s.sym}</text>
    </svg>`;

    let W = 0, H = 0, bands = [], surfaceY = 0, paused = false, running = true, selected = null, hovered = null;
    const fish = STOCKS.map((s, i) => {
      const el = document.createElement('button');
      el.className = 'bd-fish'; el.type = 'button'; el.setAttribute('aria-label', s.sym + ' · ' + s.name);
      el.style.setProperty('--c', s.color); el.innerHTML = FISH_SVG(s);
      scene.appendChild(el);
      return { s, el, i, x: 0, y: 0, vx: 0, vy: 0, rot: 0, face: 1, op: 1, state: 'fall', t: Math.random() * 10, phase: Math.random() * 6.28, size: 0, w: 0, h: 0, baseX: 0, until: 0 };
    });

    const measure = () => {
      W = scene.clientWidth; H = scene.clientHeight;
      bands = $$('[data-fall]', scene).map(el => ({ x0: el.offsetLeft, x1: el.offsetLeft + el.offsetWidth }));
      surfaceY = pondEl.offsetTop + 26;
      const base = clamp(W / 14, 66, 104);
      fish.forEach(f => { f.size = base * (0.85 + ((f.i * 7) % 5) * 0.08); f.w = f.size; f.h = f.size * 0.62; });
    };
    const bandX = f => { const b = bands[f.i % bands.length] || { x0: W * .1, x1: W * .3 }; return b.x0 + Math.random() * Math.max(10, b.x1 - b.x0 - f.w); };
    const respawn = (f, high = true) => { f.state = 'fall'; f.baseX = bandX(f); f.x = f.baseX; f.y = -f.h - (high ? Math.random() * H * 1.2 : Math.random() * H * .4); f.vy = 0; f.face = 1; f.rot = 90; f.op = 1; };
    const startSwim = f => {
      f.state = 'swim'; f.vy = 0; f.rot = 0; f.op = 1;
      const speed = 14 + Math.random() * 16; f.vx = (Math.random() < .5 ? -1 : 1) * speed; f.face = f.vx > 0 ? 1 : -1;
      f.until = f.t + 6 + Math.random() * 2.5;
      f.y = clamp(f.y, surfaceY + 6, H - f.h - 58);
    };
    const splash = (x, y) => {
      const r = document.createElement('i'); r.className = 'bd-ripple'; r.style.left = x + 'px'; r.style.top = y + 'px'; scene.appendChild(r); setTimeout(() => r.remove(), 1200);
      for (let k = 0; k < 7; k++) {
        const d = document.createElement('i'); d.className = 'bd-splash'; d.style.left = x + 'px'; d.style.top = y + 'px';
        d.style.setProperty('--dx', ((Math.random() - .5) * 70) + 'px'); d.style.setProperty('--dy', (-30 - Math.random() * 50) + 'px');
        scene.appendChild(d); setTimeout(() => d.remove(), 800);
      }
    };
    const init = () => {
      measure();
      fish.forEach((f, i) => {
        if (reduced || i % 2) { f.x = W * .06 + Math.random() * (W * .88 - f.w); f.y = surfaceY + 10 + Math.random() * Math.max(10, H - surfaceY - f.h - 70); f.t = 0; startSwim(f); f.until = f.t + 2 + Math.random() * 6; }
        else respawn(f, true);
        render(f);
      });
    };
    const render = f => {
      f.el.style.setProperty('--x', f.x.toFixed(1) + 'px'); f.el.style.setProperty('--y', f.y.toFixed(1) + 'px');
      f.el.style.setProperty('--rot', f.rot.toFixed(1) + 'deg'); f.el.style.setProperty('--face', f.face); f.el.style.setProperty('--op', f.op);
      f.el.style.setProperty('--s', f.w + 'px');
      f.el.classList.toggle('is-swim', f.state === 'swim');
    };
    const placeLabel = f => {
      if (!f) { label.classList.remove('is-on'); return; }
      label.innerHTML = `<b>${f.s.sym}</b> · $${f.s.price.toFixed(2)} · Pair it ↗`;
      label.style.left = (f.x + f.w / 2) + 'px'; label.style.top = (f.y - 34) + 'px'; label.classList.add('is-on');
    };

    let last = performance.now();
    const step = now => {
      const dt = paused ? 0 : Math.min(.05, (now - last) / 1000); last = now;
      for (const f of fish) {
        if (f.state === 'drag') { render(f); continue; }
        f.t += dt;
        if (f.state === 'fall') {
          f.vy = Math.min(f.vy + 700 * dt, 760); f.y += f.vy * dt;
          f.x = f.baseX + Math.sin(f.t * 5 + f.phase) * 9; f.rot = 90 + Math.sin(f.t * 9) * 9; f.face = 1;
          if (f.y + f.h * .5 >= surfaceY) { splash(f.x + f.w / 2, surfaceY); startSwim(f); }
        } else if (f.state === 'swim') {
          f.vx += (Math.random() - .5) * 14 * dt;
          const sp = Math.abs(f.vx); if (sp < 12) f.vx = 12 * Math.sign(f.vx || 1); if (sp > 34) f.vx = 34 * Math.sign(f.vx);
          f.x += f.vx * dt; f.y += Math.sin(f.t * 1.4 + f.phase) * 7 * dt;
          const minX = W * .02, maxX = W * .98 - f.w;
          if (f.x < minX) { f.x = minX; f.vx = Math.abs(f.vx); } if (f.x > maxX) { f.x = maxX; f.vx = -Math.abs(f.vx); }
          f.y = clamp(f.y, surfaceY + 4, H - f.h - 58);
          f.face = f.vx > 0 ? 1 : -1; f.rot = Math.sin(f.t * 1.4 + f.phase) * 4;
          if (!reduced && f.t >= f.until) { f.state = 'sink'; f.until = f.t + .6; }
        } else if (f.state === 'sink') {
          f.op = Math.max(0, (f.until - f.t) / .6); f.y += 12 * dt;
          if (f.t >= f.until) { respawn(f, false); f.op = 0; f.state = 'rise'; f.until = f.t + .4; }
        } else if (f.state === 'rise') {
          f.op = Math.min(1, 1 - (f.until - f.t) / .4); if (f.t >= f.until) { f.state = 'fall'; f.op = 1; }
        }
        render(f);
      }
      if (hovered || selected) placeLabel(hovered || selected);
      if (running && !reduced) requestAnimationFrame(step);
    };

    // pointer: grab, drag, drop, click
    let drag = null;
    fish.forEach(f => {
      f.el.addEventListener('pointerdown', e => {
        e.preventDefault(); f.el.setPointerCapture(e.pointerId);
        drag = { f, sx: e.clientX, sy: e.clientY, ox: e.clientX - f.x, oy: e.clientY - f.y, moved: false, prev: f.state, lastX: e.clientX };
      });
      f.el.addEventListener('pointermove', e => {
        if (!drag || drag.f !== f) return;
        if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 4) { drag.moved = true; f.state = 'drag'; f.el.classList.add('is-drag'); f.rot = 0; f.op = 1; }
        if (!drag.moved) return;
        f.x = clamp(e.clientX - drag.ox, -f.w * .3, W - f.w * .7); f.y = clamp(e.clientY - drag.oy, -f.h, H - f.h * .5);
        const dx = e.clientX - drag.lastX; if (Math.abs(dx) > 1) f.face = dx > 0 ? 1 : -1; drag.lastX = e.clientX;
        render(f);
      });
      const release = e => {
        if (!drag || drag.f !== f) return;
        f.el.classList.remove('is-drag');
        if (drag.moved) {
          if (f.y + f.h * .5 >= surfaceY) { f.t = 0; startSwim(f); }
          else { f.state = 'fall'; f.baseX = f.x; f.vy = 0; f.rot = 90; }
        } else select(f);
        drag = null;
      };
      f.el.addEventListener('pointerup', release); f.el.addEventListener('pointercancel', release);
      f.el.addEventListener('pointerenter', () => { hovered = f; placeLabel(f); });
      f.el.addEventListener('pointerleave', () => { hovered = null; placeLabel(selected); });
    });

    const select = f => {
      selected = f; fish.forEach(o => o.el.classList.toggle('is-bonded', o === f));
      $$('[data-hero-stock-name]').forEach(el => el.textContent = f.s.name);
      $$('[data-hero-stock]').forEach(el => el.textContent = f.s.sym);
      const launch = $('#hero-launch'); if (launch) launch.href = 'launch.html?stock=' + f.s.sym;
      $$('#elements-grid .bd-element').forEach(b => b.classList.toggle('is-active', b.dataset.sym === f.s.sym));
      document.dispatchEvent(new CustomEvent('bonded:stock', { detail: f.s.sym }));
      placeLabel(f);
    };
    label.addEventListener('click', () => { if (selected) location.href = 'launch.html?stock=' + selected.s.sym; });

    // controls
    const motionBtn = $('#motion');
    motionBtn?.addEventListener('click', () => {
      paused = !paused; motionBtn.textContent = paused ? 'Resume motion' : 'Pause motion';
      $$('[data-fall]', scene).forEach(el => el.classList.toggle('is-paused', paused)); pondEl.classList.toggle('is-paused', paused);
    });
    $('#reset')?.addEventListener('click', () => { selected = null; fish.forEach(o => o.el.classList.remove('is-bonded')); placeLabel(null); init(); $$('[data-hero-stock-name]').forEach(el => el.textContent = 'NVIDIA'); const l = $('#hero-launch'); if (l) l.href = 'launch.html'; });

    // save work when the hero is off screen or the tab is hidden
    const io = new IntersectionObserver(([en]) => { const on = en.isIntersecting && !document.hidden; if (on && !running) { running = true; last = performance.now(); requestAnimationFrame(step); } if (!on) running = false; });
    io.observe(hero);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && !running) { running = true; last = performance.now(); requestAnimationFrame(step); } });
    addEventListener('resize', () => { const oldW = W; measure(); fish.forEach(f => { f.x = f.x / (oldW || W) * W; render(f); }); });

    init();
    if (!reduced) requestAnimationFrame(step);
    return { select: sym => { const f = fish.find(o => o.s.sym === sym); if (f) select(f); } };
  }

  /* =====================================================================
     HOME
     ===================================================================== */
  if (page === 'home') {
    const scene = falls();
    const grid = $('#elements-grid'), pairsGrid = $('#pairs-grid');
    adapter.stocks().then(stocks => {
      grid.innerHTML = stocks.map(s => elementTile(s, s.sym === 'NVDA')).join('');
      grid.addEventListener('click', e => { const b = e.target.closest('[data-sym]'); if (!b) return; scene?.select(b.dataset.sym); scrollToId('hero'); });
    });
    adapter.pairs().then(pairs => {
      const pick = pairs.slice().sort((a, b) => (b.volume / b.mcap) - (a.volume / a.mcap)).slice(0, 6);
      pairsGrid.innerHTML = pick.map(pairTile).join('');
    });
  }

  /* =====================================================================
     PAIRS BOARD
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
        return `<tr data-href="${pairHref(p)}" style="cursor:pointer">
          <td><div class="bd-cell-pair">${avatar(p)}<div><b>${esc(p.name)} ${badge(p)}</b><span>$${esc(p.ticker)}</span></div></div></td>
          <td><span class="bd-stocktag"><i></i>${st.sym}</span></td>
          <td class="is-num bd-cell-price"><b>${fmtShares(priceShares(p))} ${st.sym}</b><span>≈ ${fmtUsd(priceUsd(p))}</span></td>
          <td class="is-num bd-mono ${p.change >= 0 ? 'bd-up' : 'bd-down'}">${fmtPct(p.change)}</td>
          <td>${sparkline(p, 96, 30)}</td>
          <td class="is-num bd-mono">${fmtUsd(p.mcap)}</td>
          <td class="is-num bd-mono">${fmtUsd(p.volume)}</td>
          <td class="is-num bd-mono">${fmtNum(p.holders)}</td>
          <td class="is-num bd-mono">${fmtAge(p.createdAt)}</td>
          <td class="is-num"><a class="bd-btn bd-btn-xs bd-btn-gold" href="${pairHref(p)}">Trade</a></td>
        </tr>`;
      }).join('');
      cards.innerHTML = list.map(p => `<a class="bd-pair" href="${pairHref(p)}">${pairCard(p)}</a>`).join('');
    };
    rows.addEventListener('click', e => { if (e.target.closest('a')) return; const tr = e.target.closest('tr[data-href]'); if (tr) location.href = tr.dataset.href; });

    adapter.stocks().then(stocks => {
      chips.innerHTML = `<button class="bd-chip ${state.stock === 'all' ? 'is-active' : ''}" data-stock="all" type="button">All stocks</button>` +
        stocks.map(s => `<button class="bd-chip ${state.stock === s.sym ? 'is-active' : ''}" data-stock="${s.sym}" type="button">${s.sym}</button>`).join('');
      chips.addEventListener('click', e => {
        const b = e.target.closest('[data-stock]'); if (!b) return;
        state.stock = b.dataset.stock; $$('.bd-chip', chips).forEach(c => c.classList.toggle('is-active', c === b)); render();
      });
    });
    adapter.pairs().then(pairs => { all = pairs; render(); });
    adapter.subscribe(ev => { if (ev.kind === 'launch' && !all.includes(ev.pair)) { all.unshift(ev.pair); render(); } });

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
     PAIR PAGE — chart, stats, trades, and the trade panel
     ===================================================================== */
  if (page === 'pair') {
    const root = $('#pp');
    const ticker = new URLSearchParams(location.search).get('t');
    const chartSvg = (series, w = 720, h = 300) => {
      const min = Math.min(...series), max = Math.max(...series), pad = { l: 8, r: 64, t: 12, b: 24 };
      const X = i => pad.l + i / (series.length - 1) * (w - pad.l - pad.r), Y = v => pad.t + (1 - (v - min) / (max - min || 1)) * (h - pad.t - pad.b);
      const line = series.map((v, i) => X(i).toFixed(1) + ',' + Y(v).toFixed(1)).join(' ');
      const ticks = [max, (max + min) / 2, min];
      return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
        <g class="bd-grid">${ticks.map(v => `<line x1="${pad.l}" x2="${w - pad.r}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/>`).join('')}</g>
        <polygon class="bd-area" points="${X(0)},${h - pad.b} ${line} ${X(series.length - 1)},${h - pad.b}"/>
        <polyline class="bd-line" points="${line}"/>
        <g class="bd-axis">${ticks.map(v => `<text x="${w - pad.r + 8}" y="${(Y(v) + 3).toFixed(1)}">${fmtShares(v)}</text>`).join('')}</g>
      </svg>`;
    };
    const tradeRow = (t, st, p, fresh) => `<tr class="${fresh ? 'is-new' : ''}">
      <td class="${t.side === 'buy' ? 'bd-up' : 'bd-down'}">${t.side}</td>
      <td class="is-num">${fmtNum(t.amountStock)} ${st.sym}</td>
      <td class="is-num">${fmtNum(t.amountToken)} ${esc(p.ticker)}</td>
      <td class="is-num">${fmtShares(t.price)}</td>
      <td>${shortAddr(t.wallet)}</td>
      <td class="is-num" style="color:var(--dim)">${fmtTime(t.ts)}</td>
    </tr>`;

    adapter.pair(ticker).then(p => {
      if (!p) { root.innerHTML = `<div class="bd-empty" style="grid-column:1/-1">No pair called ${esc(ticker || '')}. <a class="bd-link" href="board.html">Back to the pairs</a>.</div>`; return; }
      const st = stockOf(p.stock);
      document.title = `$${p.ticker} / ${st.sym} — Bonded`;
      let range = '24h';
      const seriesFor = r => r === '1h' ? p.series.slice(-8) : r === '24h' ? p.series.slice(-24) : p.series;
      const rangeChange = r => { const s = seriesFor(r); return (s[s.length - 1] / s[0] - 1) * 100; };

      root.innerHTML = `
        <div>
          <div class="bd-pp-head">
            ${avatar(p)}
            <div>
              <div class="bd-pp-title">${esc(p.name)} ${badge(p)}</div>
              <div class="bd-pp-sub"><span>$${esc(p.ticker)}</span><span class="bd-stocktag"><i></i>${st.sym}</span><span>${fmtAge(p.createdAt)} ago</span><span>by ${shortAddr(p.creator)}</span></div>
            </div>
            <div class="bd-pp-price"><b id="pp-price">${fmtShares(priceShares(p))} <span class="bd-gold">${st.sym}</span></b><span id="pp-usd">≈ ${fmtUsd(priceUsd(p))} · <span class="${p.change >= 0 ? 'bd-up' : 'bd-down'}">${fmtPct(p.change)}</span> 24h</span></div>
          </div>
          <div class="bd-chart ${p.change < 0 ? 'is-down' : ''}" id="chart">
            <div class="bd-chart-top">
              <span class="bd-label">Price · ${st.sym} per ${esc(p.ticker)}</span>
              <div class="bd-tabs" id="ranges"><button class="bd-tab" data-r="1h">1H</button><button class="bd-tab is-active" data-r="24h">24H</button><button class="bd-tab" data-r="7d">7D</button></div>
            </div>
            <div id="chart-svg">${chartSvg(seriesFor(range))}</div>
          </div>
          <div class="bd-stats">
            <div class="bd-stat"><span class="bd-label">Market cap</span><b id="pp-mcap">${fmtUsd(p.mcap)}</b></div>
            <div class="bd-stat"><span class="bd-label">Liquidity</span><b>${fmtUsd(p.liquidityUsd)} · locked</b></div>
            <div class="bd-stat"><span class="bd-label">24h volume</span><b id="pp-vol">${fmtUsd(p.volume)}</b></div>
            <div class="bd-stat"><span class="bd-label">Holders</span><b id="pp-holders">${fmtNum(p.holders)}</b></div>
            <div class="bd-stat"><span class="bd-label">Token</span><b class="bd-small">${shortAddr(p.address)} <button class="bd-copy" data-copy="x" data-copy-text="${p.address}">copy</button></b></div>
            <div class="bd-stat"><span class="bd-label">Pool</span><b class="bd-small">${shortAddr('0x' + p.address.slice(6) + '0f0f')} <button class="bd-copy" data-copy="x" data-copy-text="0x${p.address.slice(6)}0f0f">copy</button></b></div>
            <div class="bd-stat"><span class="bd-label">Supply</span><b class="bd-small">${CONFIG.supply.toLocaleString('en-US')} · fixed</b></div>
            <div class="bd-stat"><span class="bd-label">Ownership</span><b class="bd-small">renounced</b></div>
          </div>
          <div class="bd-pp-section">
            <h3>About</h3>
            <div class="bd-about">
              ${esc(p.desc || 'No description given.')}
              <div class="bd-links">
                ${p.x ? `<a class="bd-btn bd-btn-xs bd-btn-ghost" href="${esc(p.x)}" target="_blank" rel="noopener">X ↗</a>` : ''}
                ${p.site ? `<a class="bd-btn bd-btn-xs bd-btn-ghost" href="${esc(p.site)}" target="_blank" rel="noopener">Website ↗</a>` : ''}
                <a class="bd-btn bd-btn-xs bd-btn-ghost" href="${CONFIG.explorer}/address/${p.address}" target="_blank" rel="noopener">Explorer ↗</a>
                <a class="bd-btn bd-btn-xs bd-btn-ghost" href="board.html?stock=${st.sym}">More ${st.sym} pairs →</a>
              </div>
            </div>
          </div>
          <div class="bd-pp-section">
            <h3>Trades</h3>
            <div style="overflow-x:auto"><table class="bd-trades"><thead><tr><th>Side</th><th class="is-num">${st.sym}</th><th class="is-num">${esc(p.ticker)}</th><th class="is-num">Price</th><th>Wallet</th><th class="is-num">Time</th></tr></thead>
            <tbody id="trades">${p.trades.map(t => tradeRow(t, st, p, false)).join('')}</tbody></table></div>
          </div>
        </div>
        <aside class="bd-trade" id="trade">
          <div class="bd-tabs"><button class="bd-tab is-buy is-active" data-side="buy">Buy</button><button class="bd-tab is-sell" data-side="sell">Sell</button></div>
          <div class="bd-amount">
            <label><span id="amt-label">You pay</span><a id="amt-max">max</a></label>
            <div class="bd-amount-row"><input id="amt" type="number" min="0" step="any" placeholder="0.00" inputmode="decimal"><span class="bd-unit" id="amt-unit">${st.sym}</span></div>
          </div>
          <div class="bd-quick" id="quick"></div>
          <div class="bd-arrow">↓</div>
          <div class="bd-amount">
            <label><span>You receive</span><span id="out-usd"></span></label>
            <div class="bd-amount-row"><input id="out" readonly placeholder="0"><span class="bd-unit is-coin" id="out-unit">${esc(p.ticker)}</span></div>
          </div>
          <div class="bd-quote">
            <div><span>Price</span><b>${fmtShares(priceShares(p))} ${st.sym}</b></div>
            <div><span>Price impact</span><b id="q-impact">—</b></div>
            <div><span>Fee (${CONFIG.swapFee})</span><b id="q-fee">—</b></div>
            <div><span>Min. received (1% slippage)</span><b id="q-min">—</b></div>
          </div>
          <button class="bd-btn bd-btn-buy" id="go" type="button">Connect wallet</button>
          <div class="bd-holding"><span>You hold</span><b id="hold">—</b></div>
          <div class="bd-error" id="t-error" hidden></div>
        </aside>`;

      // ranges
      $('#ranges').addEventListener('click', e => {
        const b = e.target.closest('[data-r]'); if (!b) return; range = b.dataset.r;
        $$('#ranges .bd-tab').forEach(t => t.classList.toggle('is-active', t === b));
        $('#chart').classList.toggle('is-down', rangeChange(range) < 0); $('#chart-svg').innerHTML = chartSvg(seriesFor(range));
      });

      // trade panel
      let side = 'buy', amount = 0, quote = null, holding = 0;
      const refreshHolding = async () => { holding = (await adapter.holdings(wallet?.address)).find(h => h.ticker === p.ticker)?.amount || 0; $('#hold').textContent = `${fmtNum(holding)} $${p.ticker} ≈ ${fmtNum(holding * priceShares(p))} ${st.sym}`; };
      const paintSide = () => {
        $$('#trade .bd-tab').forEach(t => t.classList.toggle('is-active', t.dataset.side === side));
        $('#amt-label').textContent = side === 'buy' ? 'You pay' : 'You sell'; $('#amt-unit').textContent = side === 'buy' ? st.sym : p.ticker; $('#amt-unit').classList.toggle('is-coin', side === 'sell');
        $('#out-unit').textContent = side === 'buy' ? p.ticker : st.sym; $('#out-unit').classList.toggle('is-coin', side === 'buy');
        $('#quick').innerHTML = side === 'buy' ? ['0.01', '0.05', '0.1', '0.5'].map(v => `<button data-v="${v}">${v} ${st.sym}</button>`).join('') : ['25', '50', '75', '100'].map(v => `<button data-pct="${v}">${v}%</button>`).join('');
        const go = $('#go'); go.className = 'bd-btn ' + (side === 'buy' ? 'bd-btn-buy' : 'bd-btn-sell');
        $('#amt').value = ''; amount = 0; paintQuote();
      };
      const paintQuote = async () => {
        const go = $('#go');
        if (!amount) { $('#out').value = ''; $('#out-usd').textContent = ''; $('#q-impact').textContent = $('#q-fee').textContent = $('#q-min').textContent = '—'; go.textContent = wallet ? (side === 'buy' ? `Buy $${p.ticker}` : `Sell $${p.ticker}`) : 'Connect wallet'; return; }
        quote = await adapter.quote({ ticker: p.ticker, side, amount });
        $('#out').value = fmtNum(quote.out);
        $('#out-usd').textContent = '≈ ' + fmtUsd(side === 'buy' ? quote.out * priceUsd(p) : quote.out * st.price);
        $('#q-impact').textContent = (quote.priceImpact * 100).toFixed(2) + '%'; $('#q-impact').className = quote.priceImpact > .05 ? 'bd-down' : '';
        $('#q-fee').textContent = fmtNum(quote.fee) + ' ' + quote.feeUnit; $('#q-min').textContent = fmtNum(quote.out * .99) + ' ' + (side === 'buy' ? p.ticker : st.sym);
        go.textContent = wallet ? (side === 'buy' ? `Buy ${fmtNum(quote.out)} $${p.ticker}` : `Sell for ${fmtNum(quote.out)} ${st.sym}`) : 'Connect wallet';
      };
      $('#trade').addEventListener('click', e => {
        const t = e.target.closest('[data-side]'); if (t) { side = t.dataset.side; paintSide(); return; }
        const q = e.target.closest('#quick button'); if (q) { const v = q.dataset.v ? Number(q.dataset.v) : holding * Number(q.dataset.pct) / 100; $('#amt').value = v ? +v.toFixed(6) : ''; amount = v || 0; paintQuote(); }
      });
      $('#amt').addEventListener('input', e => { amount = Math.max(0, Number(e.target.value) || 0); paintQuote(); });
      $('#amt-max').addEventListener('click', () => { if (side === 'sell') { $('#amt').value = +holding.toFixed(6); amount = holding; paintQuote(); } });
      $('#go').addEventListener('click', async () => {
        const err = $('#t-error'); err.hidden = true;
        if (!wallet && !(await connect())) return;
        if (!amount) { paintQuote(); return; }
        if (side === 'sell' && amount > holding + 1e-9) { err.hidden = false; err.textContent = `You hold ${fmtNum(holding)} $${p.ticker}.`; return; }
        const go = $('#go'); go.disabled = true; go.textContent = 'Waiting for signature…';
        try {
          const res = await adapter.swap({ ticker: p.ticker, side, amount, wallet: wallet.address });
          const tr = res.trade; $('#trades').insertAdjacentHTML('afterbegin', tradeRow(tr, st, p, true));
          toast(side === 'buy' ? `Bought ${fmtNum(tr.amountToken)} $${p.ticker} for ${fmtNum(tr.amountStock)} ${st.sym}` : `Sold ${fmtNum(tr.amountToken)} $${p.ticker} for ${fmtNum(tr.amountStock)} ${st.sym}`);
          $('#pp-price').innerHTML = `${fmtShares(priceShares(p))} <span class="bd-gold">${st.sym}</span>`; $('#pp-mcap').textContent = fmtUsd(p.mcap); $('#pp-vol').textContent = fmtUsd(p.volume); $('#pp-holders').textContent = fmtNum(p.holders);
          $('#amt').value = ''; amount = 0; await refreshHolding(); paintQuote();
        } catch (e) { err.hidden = false; err.textContent = e?.message || 'The transaction was rejected.'; }
        finally { go.disabled = false; }
      });
      document.addEventListener('bonded:wallet', () => { refreshHolding(); paintQuote(); });
      paintSide(); refreshHolding();
      // other people's trades on this pair land in the table too
      adapter.subscribe(ev => { if (ev.pair?.ticker === p.ticker && (ev.kind === 'buy' || ev.kind === 'sell') && ev.wallet !== wallet?.address) { $('#trades').insertAdjacentHTML('afterbegin', tradeRow(ev, st, p, true)); } });
    });
  }

  /* =====================================================================
     LIVE LAUNCHES
     ===================================================================== */
  if (page === 'live') {
    const feed = $('#feed'), fresh = $('#fresh');
    const item = (ev, isNew) => {
      const p = ev.pair, st = stockOf(p.stock);
      const text = ev.kind === 'launch'
        ? `<b>${esc(p.name)}</b> <span>bonded to</span> <b class="bd-gold">${st.sym}</b> <span>by ${shortAddr(ev.wallet)}</span>`
        : `<span>${shortAddr(ev.wallet)} ${ev.kind === 'buy' ? 'bought' : 'sold'}</span> <b>${fmtNum(ev.amountToken)} $${esc(p.ticker)}</b> <span>for</span> <b>${fmtNum(ev.amountStock)} ${st.sym}</b>`;
      return `<a class="bd-feed-item ${isNew ? 'is-new' : ''}" href="${pairHref(p)}"><span class="bd-feed-kind is-${ev.kind}">${ev.kind}</span>${avatar(p)}<div class="bd-feed-text">${text}</div><time>${fmtTime(ev.ts)}</time></a>`;
    };
    const paintFresh = pairs => { fresh.innerHTML = pairs.slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, 5).map(pairTile).join(''); };
    adapter.pairs().then(pairs => {
      // a plausible recent past, so the page is never empty
      const past = pairs.flatMap(p => tradeHistory(p).slice(0, 2).map(t => ({ ...t, kind: t.side, pair: p })))
        .concat(pairs.filter(p => Date.now() - p.createdAt < 6 * 3600e3).map(p => ({ kind: 'launch', pair: p, wallet: p.creator, ts: p.createdAt })))
        .sort((a, b) => b.ts - a.ts).slice(0, 24);
      feed.innerHTML = past.map(ev => item(ev, false)).join('');
      paintFresh(pairs);
      adapter.subscribe(ev => {
        feed.insertAdjacentHTML('afterbegin', item(ev, true));
        while (feed.children.length > 60) feed.lastElementChild.remove();
        if (ev.kind === 'launch') adapter.pairs().then(paintFresh);
      });
    });
  }

  /* =====================================================================
     STOCKS
     ===================================================================== */
  if (page === 'stocks') {
    const grid = $('#stocks-grid'), detail = $('#stock-detail');
    let current = new URLSearchParams(location.search).get('s') || 'NVDA', stocks = [], pairs = [];
    const paint = () => {
      const s = stocks.find(x => x.sym === current) || stocks[0]; if (!s) return;
      $$('.bd-element', grid).forEach(b => b.classList.toggle('is-active', b.dataset.sym === s.sym));
      const mine = pairs.filter(p => p.stock === s.sym).sort((a, b) => b.volume - a.volume);
      const vol = mine.reduce((t, p) => t + p.volume, 0), liq = mine.reduce((t, p) => t + p.mcap * .31, 0);
      detail.innerHTML = `
        <div class="bd-sd-head"><div class="bd-sd-atom">${s.sym}</div><div><h3>${esc(s.name)}</h3><p>$${s.price.toFixed(2)} · <span class="${s.change >= 0 ? 'bd-up' : 'bd-down'}">${fmtPct(s.change)}</span> today</p></div></div>
        <div class="bd-sd-stats">
          <div class="bd-stat"><span class="bd-label">Pairs</span><b>${s.pairs}</b></div>
          <div class="bd-stat"><span class="bd-label">24h volume</span><b>${fmtUsd(vol * 3.6)}</b></div>
          <div class="bd-stat"><span class="bd-label">Liquidity in ${s.sym}</span><b>${fmtUsd(liq * 4.2)}</b></div>
          <div class="bd-stat"><span class="bd-label">Quoted as</span><b class="bd-small">${s.sym} per token</b></div>
        </div>
        <div class="bd-hero-cta bd-hero-cta-row" style="flex-direction:row;justify-content:flex-start;margin-bottom:16px">
          <a class="bd-btn bd-btn-primary bd-btn-sm" href="launch.html?stock=${s.sym}">Launch on ${s.sym}</a>
          <a class="bd-btn bd-btn-ghost bd-btn-sm" href="board.html?stock=${s.sym}">All ${s.sym} pairs →</a>
        </div>
        <span class="bd-label">Busiest pairs</span>
        <div class="bd-sd-list" style="margin-top:8px">${mine.slice(0, 6).map(p => `<a class="bd-sd-row" href="${pairHref(p)}">${avatar(p)}<b>${esc(p.name)}</b><span>${fmtUsd(p.volume)}</span><span class="${p.change >= 0 ? 'bd-up' : 'bd-down'}">${fmtPct(p.change)}</span></a>`).join('') || '<div class="bd-empty">No pairs yet. Be the first.</div>'}</div>`;
      history.replaceState(null, '', 'stocks.html?s=' + s.sym);
    };
    Promise.all([adapter.stocks(), adapter.pairs()]).then(([s, p]) => {
      stocks = s; pairs = p;
      grid.innerHTML = stocks.map(x => elementTile(x, x.sym === current)).join('');
      grid.addEventListener('click', e => { const b = e.target.closest('[data-sym]'); if (!b) return; current = b.dataset.sym; paint(); });
      paint();
    });
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
      name: form.name || 'Your token', ticker: form.ticker || 'TKN', stock: form.stock, image: /^https?:\/\//.test(form.image) ? form.image : '',
      mcap: 25_000 + (form.buy ? Number(form.buy) * stockOf(form.stock).price * 12 : 0), volume: 0, change: 0, holders: 1, createdAt: Date.now(),
    });
    const paintPreview = () => {
      const st = stockOf(form.stock);
      $$('[data-hero-stock]').forEach(el => el.textContent = st.sym); $$('[data-hero-stock-name]').forEach(el => el.textContent = st.name.toUpperCase());
      $$('[data-hero-coin]').forEach(el => el.textContent = form.ticker || '?');
      preview.innerHTML = pairCard(previewPair());
      $('#f-ticker-pair').textContent = '/ ' + st.sym; $('#f-buy-unit').textContent = st.sym;
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
      grid.addEventListener('click', e => { const b = e.target.closest('[data-sym]'); if (!b) return; form.stock = b.dataset.sym; $$('.bd-element', grid).forEach(x => x.classList.toggle('is-active', x === b)); paintPreview(); });
      paintPreview();
    });
    const fields = { name: '#f-name', ticker: '#f-ticker', desc: '#f-desc', image: '#f-image', buy: '#f-buy', x: '#f-x', site: '#f-site' };
    Object.entries(fields).forEach(([k, sel]) => $(sel).addEventListener('input', e => {
      form[k] = k === 'ticker' ? e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') : e.target.value;
      if (k === 'ticker') e.target.value = form[k];
      paintPreview();
    }));
    const validate = () => {
      const err = $('#f-error'); const problems = [];
      if (form.name.trim().length < 2) problems.push('Give the token a name (2 to 32 characters).');
      if (form.ticker.length < 2 || form.ticker.length > 8) problems.push('The ticker needs 2 to 8 letters or digits.');
      if (form.ticker && STOCKS.some(s => s.sym === form.ticker)) problems.push('That ticker is a stock symbol; pick another.');
      if (form.ticker && findPair(form.ticker)) problems.push('That ticker is already bonded; pick another.');
      if (form.buy && Number(form.buy) < 0) problems.push('The first buy cannot be negative.');
      if (form.image && !/^https?:\/\//.test(form.image)) problems.push('The image needs a full https URL.');
      err.hidden = !problems.length; err.textContent = problems.join(' ');
      return !problems.length;
    };
    const reviewRows = () => {
      const st = stockOf(form.stock);
      return [
        ['Token', `${esc(form.name)} ($${esc(form.ticker)})`], ['Bonded to', `${st.sym} · ${esc(st.name)}`],
        ['Supply', CONFIG.supply.toLocaleString('en-US') + ' · fixed, no mint'], ['Pool', `${esc(form.ticker)} / ${st.sym} · liquidity locked`],
        ['Ownership', 'renounced at deploy'], ['Swap fee', `${CONFIG.swapFee} · ${CONFIG.creatorShare} to you`],
        ['First buy', form.buy ? `${Number(form.buy)} ${st.sym}` : 'none'], ['Creation fee', CONFIG.fee], ['Chain', CONFIG.chain],
      ].map(([k, v]) => `<div class="bd-review-row"><span>${k}</span><b>${v}</b></div>`).join('');
    };
    $$('[data-next]').forEach(b => b.addEventListener('click', () => { if (step === 2 && !validate()) return; if (step === 2) $('#review').innerHTML = reviewRows(); show(step + 1); }));
    $$('[data-prev]').forEach(b => b.addEventListener('click', () => show(step - 1)));
    const deployBtn = $('#deploy');
    const paintDeploy = () => { deployBtn.textContent = wallet ? 'Bond it' : 'Connect wallet to bond'; };
    document.addEventListener('bonded:wallet', paintDeploy); paintDeploy();
    deployBtn.addEventListener('click', async () => {
      const err = $('#tx-error'); err.hidden = true;
      if (!wallet && !(await connect())) { err.hidden = false; err.textContent = 'No wallet connected.'; return; }
      deployBtn.disabled = true; deployBtn.textContent = 'Waiting for signature…';
      try {
        const res = await adapter.createPair({ ...form, supply: CONFIG.supply, creator: wallet.address });
        const st = stockOf(form.stock);
        $('#done').innerHTML = [['Pair', `${esc(form.ticker)} / ${st.sym}`], ['Token', res.tokenAddress], ['Pool', res.pairAddress], ['Transaction', res.txHash.slice(0, 18) + '…']]
          .map(([k, v]) => `<div class="bd-review-row"><span>${k}</span><b>${v}</b></div>`).join('');
        $('#done-tx').href = `${CONFIG.explorer}/tx/${res.txHash}`;
        const see = $('[data-step="4"] a[href="board.html"]'); if (see) { see.href = 'pair.html?t=' + encodeURIComponent(form.ticker); see.textContent = 'Open the pair'; }
        show(4);
      } catch (e) { err.hidden = false; err.textContent = e?.message || 'The transaction was rejected.'; }
      finally { deployBtn.disabled = false; paintDeploy(); }
    });
  }

  /* =====================================================================
     MY PLAYGROUND — launches and positions
     ===================================================================== */
  if (page === 'playground') {
    const root = $('#mine');
    const paint = async () => {
      if (!wallet) {
        root.innerHTML = `<div class="bd-mine-connect"><h2>Connect to see your playground.</h2><p>Your launches, your positions and the fees you have earned.</p><button class="bd-btn bd-btn-primary" id="mine-connect" type="button">Connect wallet</button></div>`;
        $('#mine-connect').addEventListener('click', connect); return;
      }
      const [pairs, launchedT, holdings] = await Promise.all([adapter.pairs(), adapter.launched(wallet.address), adapter.holdings(wallet.address)]);
      const launched = launchedT.map(t => pairs.find(p => p.ticker === t)).filter(Boolean);
      const positions = holdings.map(h => ({ ...h, p: pairs.find(p => p.ticker === h.ticker) })).filter(x => x.p);
      const valueUsd = positions.reduce((s, x) => s + x.amount * priceUsd(x.p), 0);
      const fees = launched.reduce((s, p) => s + p.volume * CONFIG.swapFeeRate * CONFIG.creatorShareRate, 0);
      root.innerHTML = `
        <div class="bd-mine-summary">
          <div class="bd-stat"><span class="bd-label">Positions</span><b>${fmtUsd(valueUsd)}</b></div>
          <div class="bd-stat"><span class="bd-label">Pairs held</span><b>${positions.length}</b></div>
          <div class="bd-stat"><span class="bd-label">Launched</span><b>${launched.length}</b></div>
          <div class="bd-stat"><span class="bd-label">Creator fees</span><b>${fmtUsd(fees)}</b></div>
        </div>
        <h3>Launched by you</h3>
        ${launched.length ? `<div class="bd-pairs">${launched.map(pairTile).join('')}</div><div style="margin-top:12px"><button class="bd-btn bd-btn-ghost bd-btn-sm" id="claim" type="button">Claim ${fmtUsd(fees)} in fees</button></div>`
          : `<div class="bd-mine-empty">Nothing launched from ${shortAddr(wallet.address)} yet.<br><a class="bd-btn bd-btn-primary bd-btn-sm" href="launch.html">Launch a pair</a></div>`}
        <h3>Positions</h3>
        ${positions.length ? `<div style="overflow-x:auto"><table class="bd-trades"><thead><tr><th>Pair</th><th class="is-num">Amount</th><th class="is-num">Value in stock</th><th class="is-num">Value</th><th class="is-num">24h</th><th></th></tr></thead><tbody>
          ${positions.map(({ p, amount }) => { const st = stockOf(p.stock); return `<tr><td style="font-family:var(--font-body)"><div class="bd-cell-pair">${avatar(p)}<div><b>${esc(p.name)}</b><span>$${esc(p.ticker)} / ${st.sym}</span></div></div></td><td class="is-num">${fmtNum(amount)}</td><td class="is-num">${fmtNum(amount * priceShares(p))} ${st.sym}</td><td class="is-num">${fmtUsd(amount * priceUsd(p))}</td><td class="is-num ${p.change >= 0 ? 'bd-up' : 'bd-down'}">${fmtPct(p.change)}</td><td class="is-num"><a class="bd-btn bd-btn-xs bd-btn-gold" href="${pairHref(p)}">Trade</a></td></tr>`; }).join('')}
        </tbody></table></div>`
          : `<div class="bd-mine-empty">No positions yet. Buy into a pair and it shows up here.<br><a class="bd-btn bd-btn-ghost bd-btn-sm" href="board.html">Explore the pairs</a></div>`}`;
      $('#claim')?.addEventListener('click', () => toast(`Claimed ${fmtUsd(fees)} in creator fees`));
    };
    document.addEventListener('bonded:wallet', paint); paint();
  }

  /* =====================================================================
     DOCS — active section in the sidebar
     ===================================================================== */
  if (page === 'docs') {
    const side = $$('#docs-side a[data-scroll]');
    const io = new IntersectionObserver(entries => entries.forEach(en => { if (en.isIntersecting) side.forEach(a => a.classList.toggle('is-active', a.dataset.scroll === en.target.id)); }), { rootMargin: '-20% 0px -70% 0px' });
    side.forEach(a => { const t = document.getElementById(a.dataset.scroll); if (t) io.observe(t); });
  }
})();
