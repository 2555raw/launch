/* UnyHooks — live $UHOOKS market data on the landing page.

   Does nothing until CONTRACT is set in config.js. Then, every minute while
   the page is visible:
     price, 24h change, market cap, liquidity, volume  DexScreener (its most liquid pair)
     24h price line                                     GeckoTerminal hourly candles for that pair
     holders                                            the Blockscout explorer, when it answers
   Each source is optional: whatever fails is shown as "—" and the rest still
   renders. "Buy" opens the Uniswap app on Robinhood Chain with $UHOOKS as the
   token to receive, unless BUY_URL says otherwise. */

(() => {
  'use strict';

  const CONFIG = window.UNYHOOKS || {};
  const NET = CONFIG.NETWORK || {};
  const CA = (CONFIG.CONTRACT || '').trim();
  const box = document.getElementById('market');
  if (!box || !/^0x[0-9a-fA-F]{40}$/.test(CA)) return;

  const $ = (id) => document.getElementById(id);
  const usd = (n, compact = true) => (n === null || n === undefined || !Number.isFinite(Number(n)) ? '—'
    : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: compact ? 'compact' : 'standard', maximumFractionDigits: compact ? 2 : 2 }).format(Number(n)));
  // Small token prices keep four significant digits: $0.0006657, not $0.00.
  const price = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v) || v <= 0) return '—';
    if (v >= 1) return usd(v, false);
    return `$${v.toPrecision(4).replace(/0+$/, '').replace(/\.$/, '')}`;
  };
  const count = (n) => (Number.isFinite(Number(n)) && n !== null ? new Intl.NumberFormat('en-US').format(Number(n)) : '—');

  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Links that come from the data sources are used only if they are plain https.
  const safeUrl = (u, fallback) => (typeof u === 'string' && /^https:\/\//.test(u) ? u : fallback);

  const getJson = async (url, ms = 12000) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
      const res = await fetch(url, { signal: ctrl.signal, headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error(String(res.status));
      return await res.json();
    } finally {
      clearTimeout(t);
    }
  };

  const buyUrl = CONFIG.BUY_URL || `https://app.uniswap.org/swap?chain=${encodeURIComponent(NET.uniswapChain || 'robinhood')}&outputCurrency=${CA}`;
  $('mk-buy').href = buyUrl;
  box.hidden = false;

  /* ---------- sources ---------- */

  const dexscreener = async () => {
    const pairs = await getJson(`https://api.dexscreener.com/tokens/v1/${NET.dexscreenerChain || 'robinhood'}/${CA}`);
    const list = Array.isArray(pairs) ? pairs : (pairs && pairs.pairs) || [];
    if (!list.length) return null;
    return list.slice().sort((a, b) => ((b.liquidity && b.liquidity.usd) || 0) - ((a.liquidity && a.liquidity.usd) || 0))[0];
  };

  const candles = async (pairAddress) => {
    const net = NET.geckoterminalNetwork || 'robinhood';
    const d = await getJson(`https://api.geckoterminal.com/api/v2/networks/${net}/pools/${pairAddress}/ohlcv/hour?aggregate=1&limit=24&currency=usd&token=${CA}`);
    const rows = (d && d.data && d.data.attributes && d.data.attributes.ohlcv_list) || [];
    // [time, open, high, low, close, volume], newest first
    return rows.map((r) => ({ t: r[0] * 1000, close: Number(r[4]) })).filter((r) => r.close > 0).reverse();
  };

  const holders = async () => {
    const d = await getJson(`${NET.explorerUrl}/api/v2/tokens/${CA}`);
    const n = d && (d.holders_count ?? d.holders);
    return n === undefined || n === null ? null : Number(n);
  };

  /* ---------- the 24h line ---------- */

  const W = 320;
  const H = 72;
  const PAD = 4;
  let points = [];

  const drawSpark = (series, up) => {
    const svg = $('mk-spark');
    if (series.length < 2) { svg.innerHTML = ''; points = []; $('mk-dot').hidden = true; return; }
    const lo = Math.min(...series.map((p) => p.close));
    const hi = Math.max(...series.map((p) => p.close));
    const span = hi - lo || hi || 1;
    const x = (i) => PAD + (i / (series.length - 1)) * (W - PAD * 2);
    const y = (v) => PAD + (1 - (v - lo) / span) * (H - PAD * 2);
    points = series.map((p, i) => ({ x: x(i), y: y(p.close), ...p }));
    const line = points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const area = `${line} L${points[points.length - 1].x.toFixed(1)} ${H} L${points[0].x.toFixed(1)} ${H} Z`;
    const color = up ? 'var(--ok)' : 'var(--pink)';
    const end = points[points.length - 1];
    svg.innerHTML = `
      <defs><linearGradient id="mk-fill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${up ? '#0C9F6B' : '#EC1586'}" stop-opacity=".18"/>
        <stop offset="1" stop-color="${up ? '#0C9F6B' : '#EC1586'}" stop-opacity="0"/>
      </linearGradient></defs>
      <line x1="0" x2="${W}" y1="${H - 0.5}" y2="${H - 0.5}" stroke="var(--line)" stroke-width="1"/>
      <path d="${area}" fill="url(#mk-fill)"/>
      <path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
      <line id="mk-cross" x1="0" x2="0" y1="0" y2="${H}" stroke="var(--line-hi)" stroke-width="1" vector-effect="non-scaling-stroke" visibility="hidden"/>
`;
    // The end point is an HTML dot: the SVG stretches to the box, which would squash a circle.
    const dot = $('mk-dot');
    dot.hidden = false;
    dot.style.left = `${(end.x / W) * 100}%`;
    dot.style.top = `${(end.y / H) * 72}px`;
    dot.style.background = up ? '#0C9F6B' : '#EC1586';
  };

  const tip = $('mk-tip');
  const spark = $('mk-spark');
  const hour = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
  spark.addEventListener('pointermove', (e) => {
    if (!points.length) return;
    const r = spark.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * W;
    const p = points.reduce((best, q) => (Math.abs(q.x - sx) < Math.abs(best.x - sx) ? q : best), points[0]);
    const cross = document.getElementById('mk-cross');
    if (cross) { cross.setAttribute('x1', p.x); cross.setAttribute('x2', p.x); cross.setAttribute('visibility', 'visible'); }
    tip.hidden = false;
    tip.textContent = `${hour.format(p.t)} · ${price(p.close)}`;
    tip.style.left = `${(p.x / W) * 100}%`;
  });
  spark.addEventListener('pointerleave', () => {
    tip.hidden = true;
    const cross = document.getElementById('mk-cross');
    if (cross) cross.setAttribute('visibility', 'hidden');
  });

  /* ---------- refresh ---------- */

  let pair = null;
  const refresh = async () => {
    const [p, h] = await Promise.allSettled([dexscreener(), holders()]);
    pair = p.status === 'fulfilled' ? p.value : pair;

    $('mk-holders').textContent = h.status === 'fulfilled' && h.value !== null ? count(h.value) : '—';

    if (!pair) {
      box.classList.add('is-waiting');
      $('mk-price').textContent = 'Not trading yet';
      $('mk-chg').textContent = '';
      $('mk-updated').textContent = p.status === 'rejected' ? 'Market data is unavailable right now.' : 'Live data appears here once the first pool trades.';
      return;
    }
    box.classList.remove('is-waiting');
    $('mk-price').textContent = price(pair.priceUsd);
    const chg = pair.priceChange && Number(pair.priceChange.h24);
    const chgEl = $('mk-chg');
    if (Number.isFinite(chg)) {
      chgEl.textContent = `${chg >= 0 ? '▲' : '▼'} ${Math.abs(chg).toFixed(2)}% 24h`;
      chgEl.className = `uh-chg ${chg >= 0 ? 'is-up' : 'is-down'}`;
    } else {
      chgEl.textContent = '';
    }
    $('mk-mcap').textContent = usd(pair.marketCap ?? pair.fdv);
    $('mk-liq').textContent = usd(pair.liquidity && pair.liquidity.usd);
    $('mk-vol').textContent = usd(pair.volume && pair.volume.h24);
    const pairUrl = safeUrl(pair.url, `https://dexscreener.com/${NET.dexscreenerChain || 'robinhood'}/${CA}`);
    $('mk-chart').href = pairUrl;
    if (!CONFIG.BUY_URL) $('mk-buy').href = buyUrl;

    try {
      const series = /^0x[0-9a-fA-F]+$/.test(pair.pairAddress || '') ? await candles(pair.pairAddress) : [];
      const up = series.length > 1 ? series[series.length - 1].close >= series[0].close : (chg || 0) >= 0;
      drawSpark(series, up);
    } catch (_) {
      drawSpark([], true);
    }
    const now = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date());
    $('mk-updated').innerHTML = `Updated ${esc(now)} · data from <a href="${esc(pairUrl)}" target="_blank" rel="noopener">DexScreener</a> and GeckoTerminal`;
  };

  refresh();
  setInterval(() => { if (!document.hidden) refresh(); }, 60000);
})();
