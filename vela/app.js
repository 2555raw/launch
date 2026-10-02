/* Vela — launchpad dashboard.
   Everything on screen is real: launches you made (or imported) from your own
   wallet, balances read from the chains, prices from CoinGecko and market data
   from DexScreener. Your launch history is kept in this browser (localStorage);
   wallets and chains are reached through window.VelaChain (chain.js). */

(() => {
  'use strict';

  const C = window.VelaChain;
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const HOUR = 36e5;
  const DAY = 24 * HOUR;

  /* ---------- icons ---------- */

  const ICONS = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    panel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
    filter: '<path d="M4 5h16l-6 7.5V19l-4 1.5v-8z"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    wallet: '<path d="M19 7V5.5A1.5 1.5 0 0 0 17.5 4H5a2 2 0 0 0 0 4h14a1 1 0 0 1 1 1v3h-3a2 2 0 0 0 0 4h3v3a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V6"/>',
    store: '<path d="M4 10v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9"/><path d="M3 6l1.5-3h15L21 6v1.5a2.5 2.5 0 0 1-4.5 1.5 2.5 2.5 0 0 1-4.5 0 2.5 2.5 0 0 1-4.5 0A2.5 2.5 0 0 1 3 7.5z"/><path d="M9 20v-5h6v5"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    archive: '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><path d="M10 12h4"/>',
    grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
    download: '<path d="M12 4v11"/><path d="m8 11 4 4 4-4"/><path d="M5 20h14"/>',
    upload: '<path d="M12 20V9"/><path d="m8 13 4-4 4 4"/><path d="M5 4h14"/>',
    rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    line: '<path d="M4 4v16h16"/><path d="m7 15 4-4 3 3 5-6"/>',
    bars: '<path d="M4 20h16"/><path d="M7 16v-5M12 16V7M17 16v-8"/>',
    pie: '<path d="M21 12A9 9 0 1 1 12 3v9z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21a2 2 0 0 1 2-2h13"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
    reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>'
  };
  const icon = (name) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  const paintIcons = (root = document) => $$('i[data-i]', root).forEach((el) => {
    if (!el.firstChild) el.innerHTML = icon(el.dataset.i);
  });

  /* ---------- formatting ---------- */

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const usd = (v, dp = 0) => '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  const signed = (v, dp = 0) => (v < -0.004 ? '-' : '+') + usd(v, dp);
  const money = (v) => usd(v, Math.abs(v) < 100 ? 2 : 0);
  const compact = (v) => {
    const a = Math.abs(v);
    const s = v < 0 ? '-' : '';
    if (a >= 1e9) return `${s}$${+(a / 1e9).toFixed(2)}B`;
    if (a >= 1e6) return `${s}$${+(a / 1e6).toFixed(a >= 1e7 ? 1 : 2)}M`;
    if (a >= 1e3) return `${s}$${+(a / 1e3).toFixed(a >= 1e4 ? 1 : 2)}K`;
    return `${s}$${a < 10 && a % 1 ? a.toFixed(2) : Math.round(a)}`;
  };
  const qty = (v) => {
    const a = Math.abs(v);
    if (a >= 1e9) return `${+(v / 1e9).toFixed(2)}B`;
    if (a >= 1e6) return `${+(v / 1e6).toFixed(2)}M`;
    if (a >= 1e3) return `${+(v / 1e3).toFixed(2)}K`;
    return `${+v.toFixed(a < 1 ? 4 : 2)}`;
  };
  const price = (v) => {
    if (!v) return '—';
    if (v >= 1) return usd(v, 2);
    const dp = Math.min(12, 2 - Math.floor(Math.log10(v)) + 1);
    return '$' + v.toFixed(dp);
  };
  const num = (v, dp = 3) => v.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dateShort = (t) => { const d = new Date(t); return `${MONTHS[d.getMonth()]} ${d.getDate()}`; };
  const dateLong = (t) => { const d = new Date(t); return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; };
  const ago = (t) => {
    const s = (Date.now() - t) / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  };
  const age = (t) => {
    const h = (Date.now() - t) / HOUR;
    return h < 1 ? `${Math.max(1, Math.round(h * 60))}m` : h < 48 ? `${Math.round(h)}h` : `${Math.round(h / 24)}d`;
  };
  const short = (a) => (a ? `${a.slice(0, 5)}…${a.slice(-4)}` : '');

  /* ---------- chains & sites ---------- */

  /* Slot order of the validated chart palette: rh, base, sol, bnb. */
  const CHAINS = {
    rh:   { name: 'Robinhood', unit: 'ETH', short: 'RH',   color: 'var(--c-rh)',   logo: 'img/robinhood.png' },
    base: { name: 'Base',      unit: 'ETH', short: 'BASE', color: 'var(--c-base)', logo: 'img/base.png' },
    sol:  { name: 'Solana',    unit: 'SOL', short: 'SOL',  color: 'var(--c-sol)',  logo: 'img/sol.png' },
    bnb:  { name: 'BNB Chain', unit: 'BNB', short: 'BNB',  color: 'var(--c-bnb)',  logo: 'img/bnb.png' }
  };
  const CHAIN_IDS = Object.keys(CHAINS);
  const EVM_IDS = ['rh', 'base', 'bnb'];
  const isEvm = (c) => EVM_IDS.includes(c);
  const DEX_CHAIN = { solana: 'sol', robinhood: 'rh', base: 'base', bsc: 'bnb' };

  const SITES = [
    { id: 'pump', name: 'pump.fun', chain: 'sol', live: true, logo: 'img/pump.png',
      how: 'Bonding-curve launch on Solana. The image and metadata go to IPFS, PumpPortal builds the create transaction and your wallet signs it.',
      needs: 'A Solana wallet with SOL for the dev buy plus about 0.03 SOL in fees.' },
    { id: 'rh', name: 'Robinhood', chain: 'rh', live: true, logo: 'img/robinhood.png',
      how: 'Robinhood Chain, the Ethereum L2 by Robinhood. Deploys a fixed-supply ERC-20 from your wallet: no owner, no mint, no tax. Add liquidity on a Robinhood Chain DEX to make it tradable.',
      needs: 'An EVM wallet with ETH on Robinhood Chain for gas. Vela adds the network to your wallet if it is missing.' },
    { id: 'base', name: 'Base', chain: 'base', live: true, logo: 'img/base.png',
      how: 'The same fixed-supply ERC-20, on Base. Gas is a few cents. Add liquidity on Uniswap or Aerodrome.',
      needs: 'An EVM wallet with ETH on Base for gas.' },
    { id: 'bnb', name: 'BNB Chain', chain: 'bnb', live: true, logo: 'img/bnb.png',
      how: 'The same fixed-supply ERC-20, on BNB Chain. Add liquidity on PancakeSwap to make it tradable.',
      needs: 'An EVM wallet with BNB for gas.' },
    { id: 'bonk', name: 'bonk.fun', chain: 'sol', live: false,
      why: 'Its API only creates tokens from a custodial PumpPortal wallet. Vela only launches from your own wallet, so it is left out.' },
    { id: 'fourmeme', name: 'four.meme', chain: 'bnb', live: false,
      why: 'four.meme has no public creation API yet. Use BNB Chain above for a plain BEP-20.' }
  ];
  const siteName = (id) => (SITES.find((s) => s.id === id) || { name: 'Imported' }).name;

  /* ---------- state ---------- */

  const STORE_KEY = 'vela-data-v1';
  const UI_KEY = 'vela-ui-v1';
  const LOOK_KEY = 'vela-look';

  const read = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) || fallback; } catch (_) { return fallback; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* storage blocked */ } };

  const state = Object.assign({ launches: [], tracked: [], activity: [], sol: null, evm: null }, read(STORE_KEY, {}));
  const save = () => write(STORE_KEY, state);

  const ui = Object.assign({ range: 'all', chain: 'all', status: 'live', cumMode: 'area', dailyMode: 'bar', collapsed: false }, read(UI_KEY, {}));
  const saveUi = () => write(UI_KEY, ui);

  /* live data, never stored */
  const live = { prices: {}, balances: {}, balErr: {}, health: null, latency: null };

  const log = (text) => {
    state.activity.unshift({ t: Date.now(), text });
    state.activity = state.activity.slice(0, 60);
  };
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const usdOf = (chain) => (live.prices[chain === 'sol' ? 'sol' : chain === 'bnb' ? 'bnb' : 'eth'] || {}).usd || 0;
  const inChain = (x) => ui.chain === 'all' || x.chain === ui.chain;
  const pnlOf = (l) => (l.holdings || 0) * (l.priceUsd || 0) + (l.realizedUsd || 0) - (l.costUsd || 0);
  const holdUsd = (l) => (l.holdings || 0) * (l.priceUsd || 0);

  /* ---------- toasts & tooltip ---------- */

  const toast = (msg, err = false) => {
    const el = document.createElement('div');
    el.className = 'toast' + (err ? ' is-err' : '');
    el.textContent = msg;
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), err ? 5000 : 2800);
  };

  const tip = $('#tip');
  const showTip = (html, x, y) => {
    tip.innerHTML = html;
    tip.hidden = false;
    const r = tip.getBoundingClientRect();
    let left = x + 14;
    let top = y - r.height - 10;
    if (left + r.width > innerWidth - 8) left = x - r.width - 14;
    if (top < 8) top = y + 16;
    tip.style.left = `${Math.max(8, left)}px`;
    tip.style.top = `${top}px`;
  };
  const hideTip = () => { tip.hidden = true; };

  const copy = (text, what) => {
    try {
      navigator.clipboard.writeText(text).then(() => toast(`${what} copied`), () => toast(text));
    } catch (_) { toast(text); }
  };

  /* ---------- small pieces ---------- */

  const avatar = (l) => {
    const h = [...(l.name || '?')].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
    const inner = l.image
      ? `<img src="${esc(l.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
      : esc((l.ticker || l.name || '?').slice(0, 2).toUpperCase());
    return `<span class="avatar" style="${l.image ? '' : `background:hsl(${h} 62% 68%)`}">${inner}` +
      `<span class="chain-pip" style="background:${CHAINS[l.chain].color}" title="${CHAINS[l.chain].name}"></span></span>`;
  };
  const logoImg = (src, cls = 'logo') => `<img class="${cls}" src="${src}" alt="" width="16" height="16">`;
  const chainChip = (c) => `<span class="chain-chip">${logoImg(CHAINS[c].logo)}${CHAINS[c].name}</span>`;
  const pnlCell = (v) => `<span class="${v < -0.004 ? 'neg' : 'pos'}">${signed(v, Math.abs(v) < 100 ? 2 : 0)}</span>`;

  /* ---------- sidebar ---------- */

  const renderLaunchList = () => {
    const q = $('#search').value.trim().toLowerCase();
    let list = state.launches.slice();
    if (ui.status === 'live') list = list.filter((l) => !l.archived);
    if (ui.status === 'archived') list = list.filter((l) => l.archived);
    if (q) list = list.filter((l) => `${l.name} ${l.ticker} ${l.addr}`.toLowerCase().includes(q));
    list.sort((a, b) => (!!a.archived - !!b.archived) || b.created - a.created);
    $('#launchList').innerHTML = list.length
      ? list.map((l) => `
        <button class="launch" type="button" data-launch="${l.id}" title="${esc(l.name)}">
          ${avatar(l)}
          <span class="launch-txt"><b>${esc(l.ticker)}</b><span>${esc(l.name)} · ${esc(siteName(l.site))}</span></span>
          <span class="badge ${l.archived ? 'badge-arch' : 'badge-live'}">${l.archived ? 'Archived' : 'Live'}</span>
        </button>`).join('')
      : `<div class="launches-empty">${q ? 'No launches match' : state.launches.length ? 'Nothing here' : 'No launches yet.<br>Create one below.'}</div>`;
    $('#archivedCount').textContent = state.launches.filter((l) => l.archived).length;
  };

  const renderFunder = () => {
    const s = state.sol;
    const e = state.evm;
    if (s) {
      $('#funderName').textContent = s.name;
      $('#funderBal').innerHTML = live.balances.sol != null ? `${num(live.balances.sol)} <span class="dim">SOL</span>` : '';
    } else if (e) {
      $('#funderName').textContent = e.name;
      $('#funderBal').innerHTML = live.balances.base != null ? `${num(live.balances.base)} <span class="dim">ETH</span>` : '';
    } else {
      $('#funderName').textContent = 'Connect Wallet';
      $('#funderBal').textContent = '';
    }
    const sec = (fam, w, label, has) => `
      <div class="pop-label">${label}</div>
      ${w
        ? `<button type="button" data-copy="${esc(w.address)}"><span class="chain-dot" style="background:${fam === 'sol' ? CHAINS.sol.color : CHAINS.rh.color}"></span>${esc(w.name)} · ${short(w.address)}</button>
           <button type="button" data-disconnect="${fam}">Disconnect</button>`
        : `<button type="button" data-connect="${fam}">${has ? `Connect ${label} wallet` : `Install a ${label} wallet`}</button>`}`;
    $('#funderPop').innerHTML = sec('sol', s, 'Solana', C.hasSol()) + sec('evm', e, 'EVM', C.hasEvm());
  };

  /* ---------- range bucketing ---------- */

  const startOfMonth = (t) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); };
  const addMonth = (t) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime(); };
  const startOfDay = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const startOfHour = (t) => { const d = new Date(t); d.setMinutes(0, 0, 0); return d.getTime(); };

  const allEvents = () => {
    const out = [];
    state.launches.forEach((l) => { if (inChain(l)) (l.events || []).forEach((e) => out.push({ t: e.t, v: e.v, chain: l.chain })); });
    return out;
  };

  /* Monthly buckets for all-time and 1Y, daily for 1M and 7D, hourly for 1D. */
  const bucketsFor = (range, events) => {
    const now = Date.now();
    const out = [];
    const push = (t0, t1, label, tipLabel) => out.push({ t0, t1, label, tipLabel, v: 0, byChain: { rh: 0, base: 0, sol: 0, bnb: 0 } });

    if (range === 'all' || range === '1y') {
      /* all-time starts a month before the first event, so the line has a zero to rise from */
      const first = range === 'all'
        ? startOfMonth(startOfMonth(Math.min(now, ...events.map((e) => e.t))) - DAY)
        : startOfMonth(now - 364 * DAY);
      const multiYear = new Date(first).getFullYear() !== new Date(now).getFullYear();
      for (let t = first; t <= now; t = addMonth(t)) {
        const d = new Date(t);
        const m = MONTHS[d.getMonth()];
        push(t, addMonth(t), multiYear && (d.getMonth() === 0 || t === first) ? `${m} ’${String(d.getFullYear()).slice(2)}` : m, `${m} ${d.getFullYear()}`);
      }
    } else if (range === '1m' || range === '7d') {
      const n = range === '1m' ? 30 : 7;
      for (let i = n - 1; i >= 0; i--) {
        const t = startOfDay(now - i * DAY);
        push(t, t + DAY, dateShort(t), dateLong(t));
      }
    } else {
      for (let i = 23; i >= 0; i--) {
        const t = startOfHour(now - i * HOUR);
        const hh = String(new Date(t).getHours()).padStart(2, '0');
        push(t, t + HOUR, `${hh}:00`, `${dateShort(t)}, ${hh}:00`);
      }
    }
    events.forEach((e) => {
      const b = out.find((x) => e.t >= x.t0 && e.t < x.t1);
      if (b) { b.v += e.v; b.byChain[e.chain] += e.v; }
    });
    return out;
  };

  const PERIOD = { all: 'Monthly', '1y': 'Monthly', '1m': 'Daily', '7d': 'Daily', '1d': 'Hourly' };
  const SPAN = { '1y': 365 * DAY, '1m': 30 * DAY, '7d': 7 * DAY, '1d': DAY };

  /* ---------- charts (colours come from the theme's tokens) ---------- */

  const niceStep = (span) => {
    const raw = span / 4;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const f = raw / mag;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
  };
  const scaleFor = (values) => {
    let lo = Math.min(0, ...values);
    let hi = Math.max(0, ...values);
    if (lo === hi) hi = lo + 100;
    const step = niceStep(hi - lo);
    lo = Math.floor(lo / step) * step;
    hi = Math.ceil(hi / step) * step;
    const ticks = [];
    for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
    return { lo, hi, ticks };
  };

  /* A bar with its far end rounded and its base square on the zero line. */
  const barPath = (x, w, y0, y1) => {
    const h = Math.abs(y1 - y0);
    const r = Math.min(4, w / 2, h);
    if (h < 0.5) return '';
    if (y1 < y0) return `M${x},${y0}V${y1 + r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 + r}V${y0}Z`;
    return `M${x},${y0}V${y1 - r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 - r}V${y0}Z`;
  };

  const tipHtml = (title, value, note) =>
    `<div>${esc(title)}</div><b class="${value < -0.004 ? 'neg' : ''}">${signed(value, Math.abs(value) < 100 ? 2 : 0)}</b>${note ? `<div class="dim">${esc(note)}</div>` : ''}`;

  const drawSeries = (el, buckets, values, mode, note) => {
    const W = el.clientWidth;
    const H = el.clientHeight;
    if (!W || !H) return;
    const narrow = W < 420;
    const pad = { l: narrow ? 46 : 56, r: 8, t: 14, b: 34 };
    const pw = W - pad.l - pad.r;
    const ph = H - pad.t - pad.b;
    const { lo, hi, ticks } = scaleFor(values);
    const y = (v) => pad.t + ph - ((v - lo) / (hi - lo)) * ph;
    const n = values.length;
    const gid = `g-${el.id}`;

    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(note)}">`;
    svg += `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--accent-fill);stop-opacity:.34"/><stop offset="1" style="stop-color:var(--accent-fill);stop-opacity:.03"/></linearGradient></defs>`;
    ticks.forEach((t) => {
      svg += `<line class="${t === 0 ? 'zero' : 'grid'}" x1="${pad.l}" x2="${W - pad.r}" y1="${y(t)}" y2="${y(t)}"/>`;
      svg += `<text x="${pad.l - 10}" y="${y(t) + 4}" text-anchor="end">${compact(t)}</text>`;
    });

    const every = Math.ceil(n / Math.max(2, Math.floor(pw / (narrow ? 52 : 68))));
    const band = pw / n;
    const xAt = mode === 'bar' || n === 1 ? (i) => pad.l + band * i + band / 2 : (i) => pad.l + (pw * i) / (n - 1);
    buckets.forEach((b, i) => {
      if (i % every === 0) svg += `<text x="${xAt(i)}" y="${H - 10}" text-anchor="middle">${esc(b.label)}</text>`;
    });

    if (mode === 'bar') {
      const bw = Math.max(1, Math.min(band - 2, band * 0.78, 260));
      values.forEach((v, i) => {
        const d = barPath(pad.l + band * i + (band - bw) / 2, bw, y(0), y(v));
        if (d) svg += `<path class="bar" data-i="${i}" d="${d}" style="fill:${v < 0 ? 'var(--neg)' : 'var(--accent-fill)'}"/>`;
        svg += `<rect class="hot" data-i="${i}" x="${pad.l + band * i}" y="${pad.t}" width="${band}" height="${ph}" fill="transparent"/>`;
      });
    } else {
      const pts = values.map((v, i) => [xAt(i), y(v)]);
      const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
      if (n > 1) {
        svg += `<path d="${line}L${pts[n - 1][0]},${y(0)}L${pts[0][0]},${y(0)}Z" fill="url(#${gid})"/>`;
        svg += `<path d="${line}" fill="none" style="stroke:var(--accent-fill)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
      } else {
        svg += `<circle cx="${pts[0][0]}" cy="${pts[0][1]}" r="4" style="fill:var(--accent-fill)"/>`;
      }
      svg += `<line class="cross" x1="0" x2="0" y1="${pad.t}" y2="${pad.t + ph}" visibility="hidden"/>`;
      svg += `<circle class="dot" r="4.5" style="fill:var(--accent-fill);stroke:var(--card)" stroke-width="2" visibility="hidden"/>`;
      svg += `<rect class="hot area-hot" x="${pad.l}" y="${pad.t}" width="${pw}" height="${ph}" fill="transparent"/>`;
    }
    svg += '</svg>';

    const empty = values.every((v) => v === 0);
    el.innerHTML = svg + (empty ? `<div class="chart-empty">${state.launches.length ? 'No P&amp;L in this period' : 'Your P&amp;L shows here after your first launch'}</div>` : '');

    const root = el.firstChild;
    if (mode === 'bar') {
      $$('.hot', root).forEach((r) => {
        const i = +r.dataset.i;
        r.addEventListener('pointermove', (e) => {
          el.classList.add('is-hovering');
          $$('.bar', root).forEach((b) => b.classList.toggle('is-hot', +b.dataset.i === i));
          showTip(tipHtml(buckets[i].tipLabel, values[i], note), e.clientX, e.clientY);
        });
      });
      root.addEventListener('pointerleave', () => { el.classList.remove('is-hovering'); hideTip(); });
    } else {
      const hot = $('.area-hot', root);
      const cross = $('.cross', root);
      const dot = $('.dot', root);
      hot.addEventListener('pointermove', (e) => {
        const box = root.getBoundingClientRect();
        const px = (e.clientX - box.left) * (W / box.width);
        const i = n === 1 ? 0 : Math.max(0, Math.min(n - 1, Math.round(((px - pad.l) / pw) * (n - 1))));
        const cx = xAt(i);
        cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.setAttribute('visibility', 'visible');
        dot.setAttribute('cx', cx); dot.setAttribute('cy', y(values[i])); dot.setAttribute('visibility', 'visible');
        showTip(tipHtml(buckets[i].tipLabel, values[i], note), e.clientX, e.clientY);
      });
      hot.addEventListener('pointerleave', () => {
        cross.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); hideTip();
      });
    }
  };

  const arc = (cx, cy, r0, r1, a0, a1) => {
    const p = (r, a) => [cx + r * Math.sin(a), cy - r * Math.cos(a)];
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const [x0, y0] = p(r1, a0); const [x1, y1] = p(r1, a1);
    const [x2, y2] = p(r0, a1); const [x3, y3] = p(r0, a0);
    return `M${x0},${y0}A${r1},${r1} 0 ${large} 1 ${x1},${y1}L${x2},${y2}A${r0},${r0} 0 ${large} 0 ${x3},${y3}Z`;
  };

  const drawDonut = (el, byChain, title) => {
    const ids = CHAIN_IDS.filter((c) => ui.chain === 'all' || c === ui.chain);
    const total = ids.reduce((a, c) => a + byChain[c], 0);
    const pos = ids.reduce((a, c) => a + Math.max(0, byChain[c]), 0);
    const share = (c) => (pos && byChain[c] > 0 ? `${Math.round((byChain[c] / pos) * 100)}% of gains` : byChain[c] < 0 ? 'net loss' : '—');
    let a = 0;
    let arcs = '';
    ids.forEach((c) => {
      const v = Math.max(0, byChain[c]);
      if (!v || !pos) return;
      const sweep = (v / pos) * Math.PI * 2;
      arcs += `<path class="seg-arc" data-c="${c}" d="${arc(110, 110, 72, 104, a, a + sweep - (sweep >= Math.PI * 2 - 1e-6 ? 1e-4 : 0))}" style="fill:${CHAINS[c].color};stroke:var(--card)" stroke-width="2"/>`;
      a += sweep;
    });
    if (!arcs) arcs = '<circle cx="110" cy="110" r="88" fill="none" style="stroke:var(--line)" stroke-width="32"/>';
    el.innerHTML = `
      <div class="donut-wrap">
        <svg viewBox="0 0 220 220" role="img" aria-label="${esc(title)} by chain">
          ${arcs}
          <text x="110" y="104" text-anchor="middle" style="font-size:11.5px;fill:var(--muted)">${esc(title)}</text>
          <text x="110" y="126" text-anchor="middle" style="font-weight:700;font-size:19px;fill:${total < -0.004 ? 'var(--neg)' : 'var(--ink)'}">${signed(total, Math.abs(total) < 100 ? 2 : 0)}</text>
        </svg>
        <div class="legend">${ids.map((c) => `
          <div class="legend-row"><span class="sw" style="background:${CHAINS[c].color}"></span>
            <span>${CHAINS[c].name}<small>${share(c)}</small></span>
            <b class="${byChain[c] < -0.004 ? 'neg' : ''}">${signed(byChain[c], Math.abs(byChain[c]) < 100 ? 2 : 0)}</b></div>`).join('')}
        </div>
      </div>`;
    const wrap = el.firstElementChild;
    $$('.seg-arc', wrap).forEach((p) => {
      const c = p.dataset.c;
      p.addEventListener('pointermove', (e) => {
        wrap.classList.add('is-hovering');
        $$('.seg-arc', wrap).forEach((q) => q.classList.toggle('is-hot', q === p));
        showTip(tipHtml(CHAINS[c].name, byChain[c], share(c)), e.clientX, e.clientY);
      });
      p.addEventListener('pointerleave', () => { wrap.classList.remove('is-hovering'); hideTip(); });
    });
  };

  /* ---------- dashboard ---------- */

  const walletUsd = () => {
    let total = 0;
    if (state.sol && live.balances.sol != null) total += live.balances.sol * usdOf('sol');
    if (state.evm) EVM_IDS.forEach((c) => { if (live.balances[c] != null) total += live.balances[c] * usdOf(c); });
    return total;
  };

  const renderDashboard = () => {
    const events = allEvents();
    const buckets = bucketsFor(ui.range, events);
    const start = buckets[0].t0;
    const total = buckets.reduce((a, b) => a + b.v, 0);

    const pnlEl = $('#kpiPnl');
    pnlEl.textContent = signed(total, Math.abs(total) < 100 ? 2 : 0);
    pnlEl.className = 'kpi-val ' + (total < -0.004 ? 'neg' : 'pos');
    if (ui.range === 'all') {
      $('#kpiPnlSub').textContent = events.length ? `since ${MONTHS[new Date(start).getMonth()]} ${new Date(start).getFullYear()} · unrealized + realized` : 'no launches yet';
    } else {
      const prev = events.filter((e) => e.t >= start - SPAN[ui.range] && e.t < start).reduce((a, e) => a + e.v, 0);
      $('#kpiPnlSub').textContent = `${signed(total - prev)} vs previous ${ui.range === '1d' ? 'day' : 'period'}`;
    }

    const mine = state.launches.filter(inChain);
    const inRange = mine.filter((l) => l.created >= start);
    $('#kpiLaunches').textContent = inRange.length;
    const sites = new Set(inRange.map((l) => l.site)).size;
    $('#kpiLaunchesSub').textContent = `${inRange.filter((l) => !l.archived).length} live · ${sites} site${sites === 1 ? '' : 's'}`;

    const held = mine.filter((l) => !l.archived);
    const hv = held.reduce((a, l) => a + holdUsd(l), 0);
    $('#kpiHold').textContent = money(hv);
    $('#kpiHoldSub').textContent = held.length ? `dev tokens in ${held.filter((l) => l.holdings > 0).length} live launch${held.length === 1 ? '' : 'es'}` : 'nothing held yet';

    $('#kpiBal').textContent = money(walletUsd());
    const parts = [];
    if (state.sol && live.balances.sol != null) parts.push(`${num(live.balances.sol)} SOL`);
    if (state.evm) EVM_IDS.forEach((c) => { if (live.balances[c] > 0) parts.push(`${num(live.balances[c], 4)} ${CHAINS[c].unit} (${CHAINS[c].short})`); });
    $('#kpiBalSub').textContent = state.sol || state.evm ? (parts.join(' · ') || 'no funds yet') : 'connect a wallet';

    const unit = PERIOD[ui.range];
    $('#dailyTitle').textContent = `${unit} P&L`;

    let run = 0;
    const cum = buckets.map((b) => (run += b.v));
    const byChain = { rh: 0, base: 0, sol: 0, bnb: 0 };
    buckets.forEach((b) => CHAIN_IDS.forEach((c) => { byChain[c] += b.byChain[c]; }));

    if (ui.cumMode === 'donut') drawDonut($('#chartCum'), byChain, 'Total P&L');
    else drawSeries($('#chartCum'), buckets, cum, ui.cumMode, 'Cumulative P&L');
    if (ui.dailyMode === 'donut') drawDonut($('#chartDaily'), byChain, 'Total P&L');
    else drawSeries($('#chartDaily'), buckets, buckets.map((b) => b.v), ui.dailyMode, `${unit} P&L`);

    const recent = state.launches.filter((l) => !l.archived && inChain(l)).sort((a, b) => b.created - a.created);
    $('#recentMeta').textContent = `${recent.length} LIVE · ${state.launches.length} TOTAL`;
    $('#recentList').innerHTML = recent.length ? recent.slice(0, 6).map((l) => {
      const p = pnlOf(l);
      return `
        <button class="row" type="button" data-launch="${l.id}">
          ${avatar(l)}
          <span class="row-main"><b>${esc(l.ticker)} <span class="dim" style="font-weight:400">${esc(l.name)}</span></b><span>${esc(siteName(l.site))} · ${age(l.created)} ago</span></span>
          <span class="fig hide-sm">${l.mcap ? compact(l.mcap) : '—'}<small>mcap</small></span>
          <span class="fig">${pnlCell(p)}<small>P&amp;L</small></span>
          <span class="state ${l.priceUsd ? '' : 'off'}" title="${l.priceUsd ? 'Trading' : 'No market data yet'}"></span>
        </button>`;
    }).join('') : `<div class="rows-empty">No launches yet.<br><button class="btn btn-primary" type="button" data-create="pump">${icon('rocket')}<span>Create your first launch</span></button></div>`;

    const liveSites = SITES.filter((s) => s.live).length;
    $('#sitesMeta').textContent = `${liveSites}/${SITES.length} SITES LIVE`;
    $('#sitesList').innerHTML = SITES.map((s) => `
      <button class="row site-row" type="button" ${s.live ? `data-create="${s.id}"` : `data-soon="${s.id}"`} title="${esc(s.live ? `Launch on ${s.name}` : s.why)}">
        <span class="row-main row-logo">${s.logo ? logoImg(s.logo, 'site-logo') : `<span class="site-logo site-initial">${esc(s.name.slice(0, 1).toUpperCase())}</span>`}<span><b>${esc(s.name)}</b><span>${s.live ? (s.id === 'pump' ? 'Bonding curve' : 'ERC-20 deploy') : 'Not available'}</span></span></span>
        ${chainChip(s.chain)}
        <span class="state ${s.live ? '' : 'off'}"></span>
      </button>`).join('');
  };

  /* ---------- secondary views ---------- */

  const renderWallets = () => {
    const card = (fam) => {
      const w = state[fam];
      const title = fam === 'sol' ? 'Solana' : 'EVM · Robinhood, Base, BNB Chain';
      if (!w) {
        const has = fam === 'sol' ? C.hasSol() : C.hasEvm();
        return `
          <div class="card wallet-card">
            <h3>${icon('wallet').replace('<svg', '<svg width="16" height="16"')}${title}</h3>
            <p class="dim" style="margin:0;font-size:13px">${has ? 'Not connected.' : fam === 'sol' ? 'No Solana wallet in this browser. Install Phantom or Solflare.' : 'No EVM wallet in this browser. Install MetaMask or Rabby.'}</p>
            <div class="wallet-actions">${has ? `<button class="btn btn-primary" type="button" data-connect="${fam}">Connect</button>` : ''}</div>
          </div>`;
      }
      const rows = (fam === 'sol' ? ['sol'] : EVM_IDS).map((c) => `
        <div class="bal-row"><span><span class="chain-dot" style="background:${CHAINS[c].color}"></span>${CHAINS[c].name}</span>
          <span>${live.balances[c] != null ? `${num(live.balances[c], 4)} ${CHAINS[c].unit} <span class="dim">· ${money(live.balances[c] * usdOf(c))}</span>`
            : live.balErr[c] ? '<span class="dim">RPC unavailable</span>' : '…'}</span></div>`).join('');
      return `
        <div class="card wallet-card">
          <h3>${icon('wallet').replace('<svg', '<svg width="16" height="16"')}${esc(w.name)} <span class="badge badge-live">Connected</span></h3>
          <div class="addr">${esc(w.address)}</div>
          ${rows}
          <div class="wallet-actions">
            <button class="btn btn-ghost" type="button" data-copy="${esc(w.address)}">${icon('copy')}<span>Copy address</span></button>
            <button class="btn btn-ghost" type="button" data-disconnect="${fam}">Disconnect</button>
          </div>
        </div>`;
    };
    $('#walletCards').innerHTML = card('sol') + card('evm');
  };

  const renderSites = () => {
    $('#siteCards').innerHTML = SITES.map((s) => `
      <div class="card offer ${s.live ? '' : 'is-soon'}">
        <span class="offer-ico">${s.logo ? logoImg(s.logo, 'site-logo lg') : esc(s.name.slice(0, 2).toUpperCase())}</span>
        <h3>${esc(s.name)} ${s.live ? '<span class="badge badge-live">Live</span>' : '<span class="badge badge-arch">Unavailable</span>'}</h3>
        <p>${esc(s.live ? s.how : s.why)}</p>
        ${s.live ? `<p style="flex:0">${esc(s.needs)}</p>` : ''}
        ${s.id === 'pump' && live.health && !live.health.pinata ? '<p class="note warn" style="flex:0">This server has no PINATA_JWT, so pump.fun launches are off until it is set.</p>' : ''}
        <div class="offer-foot">
          ${chainChip(s.chain)}
          ${s.live ? `<button class="btn btn-primary" type="button" data-create="${s.id}">Launch</button>` : ''}
        </div>
      </div>`).join('');
  };

  const renderTracker = () => {
    const own = state.launches.filter((l) => !l.archived && inChain(l)).map((l) => ({ ...l, own: true }));
    const rows = own.concat(state.tracked.filter(inChain));
    $('#trackTable').innerHTML = rows.length ? `
      <thead><tr><th>Token</th><th>Chain</th><th>Age</th><th class="num">Price</th><th class="num">Market cap</th><th class="num">24h</th><th class="num">Liquidity</th><th class="num">Your P&amp;L</th><th></th></tr></thead>
      <tbody>${rows.map((l) => `
        <tr>
          <td><span class="who">${avatar(l)}<span><b>${esc(l.ticker || '?')}</b><br><span class="addr">${short(l.addr)}</span></span></span></td>
          <td>${chainChip(l.chain)}</td>
          <td class="dim">${age(l.created)}</td>
          <td class="num">${price(l.priceUsd)}</td>
          <td class="num">${l.mcap ? compact(l.mcap) : '—'}</td>
          <td class="num ${l.change == null ? 'dim' : l.change < 0 ? 'neg' : 'pos'}">${l.change == null ? '—' : `${l.change > 0 ? '+' : ''}${l.change}%`}</td>
          <td class="num">${l.liquidity ? compact(l.liquidity) : '—'}</td>
          <td class="num">${l.own ? pnlCell(pnlOf(l)) : '<span class="dim">—</span>'}</td>
          <td class="act">${l.own ? `<button type="button" data-launch="${l.id}">View</button>`
            : `<a href="${C.dexscreener(l.chain, l.addr)}" target="_blank" rel="noopener"><button type="button">Chart</button></a><button type="button" data-untrack="${l.id}">Remove</button>`}</td>
        </tr>`).join('')}</tbody>` : '<tbody><tr><td class="table-empty">Nothing here yet. Launch a token or paste an address above to follow one.</td></tr></tbody>';
  };

  const renderArchived = () => {
    const rows = state.launches.filter((l) => l.archived && inChain(l)).sort((a, b) => b.created - a.created);
    $('#archTable').innerHTML = rows.length ? `
      <thead><tr><th>Token</th><th>Site</th><th>Launched</th><th class="num">Cost</th><th class="num">Holdings</th><th class="num">P&amp;L</th><th></th></tr></thead>
      <tbody>${rows.map((l) => `
        <tr>
          <td><span class="who">${avatar(l)}<b>${esc(l.ticker)}</b></span></td>
          <td>${esc(siteName(l.site))}</td>
          <td class="dim">${dateLong(l.created)}</td>
          <td class="num">${money(l.costUsd || 0)}</td>
          <td class="num">${money(holdUsd(l))}</td>
          <td class="num">${pnlCell(pnlOf(l))}</td>
          <td class="act"><button type="button" data-launch="${l.id}">View</button><button type="button" data-unarchive="${l.id}">Restore</button></td>
        </tr>`).join('')}</tbody>` : '<tbody><tr><td class="table-empty">No archived launches.</td></tr></tbody>';
  };

  /* ---------- views & routing ---------- */

  const VIEWS = ['dashboard', 'wallets', 'sites', 'tracker', 'archived'];
  let view = 'dashboard';

  const renderView = () => {
    ({ dashboard: renderDashboard, wallets: renderWallets, sites: renderSites, tracker: renderTracker, archived: renderArchived })[view]();
  };
  const renderAll = () => { renderLaunchList(); renderFunder(); renderView(); };

  const go = (name) => {
    view = VIEWS.includes(name) ? name : 'dashboard';
    $$('.view').forEach((v) => { v.hidden = v.dataset.view !== view; });
    $$('.features-list a').forEach((a) => a.classList.toggle('is-on', a.dataset.view === view));
    $('#rangeSeg').hidden = view !== 'dashboard';
    $('#chainSeg').hidden = view === 'wallets' || view === 'sites';
    $('#app').classList.remove('is-menu');
    $('#scrim').hidden = true;
    hideTip();
    renderView();
    $('#main').scrollTop = 0;
  };
  addEventListener('hashchange', () => go(location.hash.slice(1)));

  /* ---------- data refresh ---------- */

  const refreshPrices = async () => {
    try { live.prices = await C.prices(); } catch (_) { /* keep last */ }
    renderPrices();
  };

  const refreshBalances = async () => {
    const jobs = [];
    const read = (c, p) => p.then((v) => { live.balances[c] = v; live.balErr[c] = false; }, () => { live.balErr[c] = true; });
    if (state.sol) jobs.push(read('sol', C.solBalance(state.sol.address)));
    if (state.evm) EVM_IDS.forEach((c) => jobs.push(read(c, C.evmBalance(c, state.evm.address))));
    await Promise.allSettled(jobs);
  };

  /* Pull market data and dev holdings for every launch, then record any change in
     P&L as an event: the charts are the running sum of those events. */
  const refreshLaunches = async () => {
    const addrs = state.launches.map((l) => l.addr).concat(state.tracked.map((t) => t.addr));
    if (!addrs.length) return;
    let m = {};
    try { m = await C.market(addrs); } catch (_) { /* market down: keep last values */ }
    const apply = (x) => {
      const d = m[x.addr];
      if (!d) return;
      Object.assign(x, { priceUsd: d.priceUsd, mcap: d.marketCap, change: d.change24h, liquidity: d.liquidity });
      if (DEX_CHAIN[d.chain]) x.chain = DEX_CHAIN[d.chain];
    };
    state.launches.forEach(apply);
    state.tracked.forEach((t) => { apply(t); if (m[t.addr]?.symbol) { t.ticker = m[t.addr].symbol; t.name = m[t.addr].name; } });

    await Promise.allSettled(state.launches.filter((l) => l.owner).map(async (l) => {
      l.holdings = l.chain === 'sol' ? await C.solTokenBalance(l.owner, l.addr) : await C.evmTokenBalance(l.chain, l.addr, l.owner);
    }));

    const now = Date.now();
    state.launches.forEach((l) => {
      if (l.holdings > 0 && !l.priceUsd) return;   // value unknown until a market exists
      const p = pnlOf(l);
      const last = l.lastPnl || 0;
      if (Math.abs(p - last) >= 0.01) {
        l.events = (l.events || []).concat({ t: now, v: Math.round((p - last) * 100) / 100 });
        l.lastPnl = p;
      }
    });
    save();
  };

  let refreshing = null;
  const refresh = () => {
    if (!refreshing) {
      refreshing = (async () => {
        await Promise.allSettled([refreshPrices(), refreshBalances()]);
        await refreshLaunches().catch(() => {});
      })().finally(() => {
        refreshing = null;
        if (tip.hidden) renderAll(); else renderLaunchList();
      });
    }
    return refreshing;
  };

  /* ---------- wallets ---------- */

  const connect = async (fam) => {
    try {
      const w = fam === 'sol' ? await C.connectSol() : await C.connectEvm();
      if (!w) throw new Error('No account returned');
      state[fam] = w;
      log(`Connected ${w.name} ${short(w.address)}`);
      save();
      closePops();
      renderAll();
      toast(`${w.name} connected`);
      refresh();
      return w;
    } catch (e) {
      toast(e.message, true);
      return null;
    }
  };
  const disconnect = async (fam) => {
    const w = state[fam];
    if (fam === 'sol') await C.disconnectSol(); else await C.disconnectEvm();
    state[fam] = null;
    if (fam === 'sol') delete live.balances.sol; else EVM_IDS.forEach((c) => delete live.balances[c]);
    if (w) log(`Disconnected ${w.name}`);
    save();
    closePops();
    renderAll();
  };

  /* ---------- modals ---------- */

  const modal = $('#modal');
  let lastFocus = null;
  let busy = false;

  const openModal = (title, body, onMount, wide = false) => {
    if (busy) return;
    lastFocus = document.activeElement;
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = body;
    $('.modal-box', modal).classList.toggle('wide', wide);
    paintIcons($('#modalBody'));
    modal.hidden = false;
    onMount?.($('#modalBody'));
    ($('#modalBody input:not([type=file]), #modalBody button') || $('[data-close]', modal)).focus();
  };
  const closeModal = () => {
    if (busy) { toast('Wait for the transaction to finish'); return; }
    modal.hidden = true;
    lastFocus?.focus?.();
  };
  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.closest('[data-close]')) closeModal();
  });

  const fieldErr = (form, name, msg) => {
    const f = form.querySelector(`[name="${name}"]`).closest('.field');
    let err = f.querySelector('.err');
    if (!err) { err = document.createElement('span'); err.className = 'err'; f.appendChild(err); }
    err.textContent = msg;
  };

  /* A step list that the launch and sell flows narrate into. */
  const stepper = (el) => {
    const items = [];
    return {
      step(text) {
        const prev = items[items.length - 1];
        if (prev) prev.className = 'is-done';
        const li = document.createElement('li');
        li.className = 'is-now';
        li.textContent = text;
        el.appendChild(li);
        items.push(li);
      },
      done() { items.forEach((li) => { li.className = 'is-done'; }); },
      fail(msg) {
        const li = items[items.length - 1] || el.appendChild(document.createElement('li'));
        if (!items.length) items.push(li);
        li.className = 'is-err';
        li.textContent = msg;
      }
    };
  };

  const readImage = (file) => new Promise((resolve, reject) => {
    if (!/^image\/(png|jpeg|gif|webp)$/.test(file.type)) { reject(new Error('Use a PNG, JPG, GIF or WEBP image')); return; }
    if (file.size > 4 * 1024 * 1024) { reject(new Error('Image must be 4 MB or less')); return; }
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('Could not read the image'));
    r.readAsDataURL(file);
  });

  const openCreate = (siteId = 'pump') => {
    let site = SITES.find((s) => s.id === siteId && s.live) || SITES[0];
    let imageData = null;

    openModal('Create Launch', `
      <form class="form" id="createForm" novalidate>
        <div class="field"><span>Launch on</span>
          <div class="site-pick">${SITES.filter((s) => s.live).map((s) => `
            <button type="button" data-site="${s.id}">${logoImg(s.logo, 'site-logo')}<span class="site-txt"><b>${esc(s.name)}</b><span>${s.id === 'pump' ? 'Solana' : CHAINS[s.chain].name}</span></span></button>`).join('')}
          </div>
        </div>
        <div class="row2">
          <label class="field"><span>Token name</span><input name="name" maxlength="32" placeholder="e.g. Nebula" required></label>
          <label class="field"><span>Ticker</span><input name="ticker" maxlength="10" placeholder="NEB" required style="text-transform:uppercase"></label>
        </div>
        <div data-for="pump">
          <div class="form">
            <label class="field"><span>Description</span><textarea name="desc" maxlength="1000" placeholder="What is this token about?"></textarea></label>
            <div class="field"><span>Image</span>
              <label class="image-pick"><span class="thumb" id="thumb">${icon('image').replace('<svg', '<svg width="18" height="18"')}</span>
                <span id="thumbTxt">Choose an image · PNG, JPG, GIF or WEBP, up to 4 MB</span>
                <input type="file" name="image" accept="image/png,image/jpeg,image/gif,image/webp"></label>
            </div>
            <label class="field"><span>Dev buy (SOL)</span><input name="buy" inputmode="decimal" value="0.1"></label>
            <details class="adv"><summary>Socials and transaction settings</summary>
              <div class="form">
                <label class="field"><span>X / Twitter</span><input name="twitter" placeholder="https://x.com/…"></label>
                <label class="field"><span>Telegram</span><input name="telegram" placeholder="https://t.me/…"></label>
                <label class="field"><span>Website</span><input name="website" placeholder="https://…"></label>
                <div class="row2">
                  <label class="field"><span>Slippage %</span><input name="slippage" inputmode="decimal" value="10"></label>
                  <label class="field"><span>Priority fee (SOL)</span><input name="prio" inputmode="decimal" value="0.0005"></label>
                </div>
              </div>
            </details>
          </div>
        </div>
        <div data-for="evm">
          <label class="field"><span>Total supply</span><input name="supply" inputmode="numeric" value="1000000000"></label>
        </div>
        <div class="note" id="siteNote"></div>
        <ul class="steps" id="steps"></ul>
        <div class="form-foot" id="createFoot">
          <button class="btn btn-ghost" type="button" data-close>Cancel</button>
          <button class="btn btn-primary" type="submit" id="launchBtn">${icon('rocket')}<span>Launch</span></button>
        </div>
      </form>`, (body) => {
      const form = $('#createForm', body);

      const setSite = (s) => {
        site = s;
        $$('[data-site]', form).forEach((b) => b.classList.toggle('is-on', b.dataset.site === s.id));
        $('[data-for="pump"]', form).hidden = s.id !== 'pump';
        $('[data-for="evm"]', form).hidden = s.id === 'pump';
        const w = s.chain === 'sol' ? state.sol : state.evm;
        const bal = live.balances[s.chain];
        const note = $('#siteNote', form);
        note.className = 'note';
        if (s.id === 'pump' && live.health && !live.health.pinata) {
          note.className = 'note warn';
          note.textContent = 'This server has no PINATA_JWT set, so the token image and metadata can’t be uploaded. pump.fun launches are off until it is.';
        } else if (!w) {
          note.innerHTML = `${esc(s.needs)} You’ll be asked to connect when you press Launch.`;
        } else {
          note.innerHTML = `From <b>${esc(w.name)}</b> ${short(w.address)}${bal != null ? ` · ${num(bal, 4)} ${CHAINS[s.chain].unit}` : ''}. ${esc(s.needs)}`;
        }
      };
      setSite(site);

      form.addEventListener('click', (e) => {
        const b = e.target.closest('[data-site]');
        if (b && !busy) setSite(SITES.find((s) => s.id === b.dataset.site));
      });
      form.name.addEventListener('input', () => {
        if (!form.ticker.dataset.touched) form.ticker.value = form.name.value.replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase();
      });
      form.ticker.addEventListener('input', () => { form.ticker.dataset.touched = '1'; });
      form.image.addEventListener('change', async () => {
        const f = form.image.files[0];
        if (!f) return;
        try {
          imageData = await readImage(f);
          $('#thumb', form).innerHTML = `<img src="${imageData}" alt="">`;
          $('#thumbTxt', form).textContent = f.name;
        } catch (err) {
          imageData = null;
          toast(err.message, true);
        }
      });

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (busy) return;
        $$('.err', form).forEach((x) => x.remove());
        const name = form.name.value.trim();
        const ticker = form.ticker.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        let ok = true;
        if (!name) { fieldErr(form, 'name', 'Give the token a name'); ok = false; }
        if (!ticker) { fieldErr(form, 'ticker', 'Letters and numbers only'); ok = false; }

        const opts = { name, symbol: ticker };
        if (site.id === 'pump') {
          const buy = parseFloat(form.buy.value);
          if (!imageData) { toast('Choose an image for the token', true); ok = false; }
          if (!(buy >= 0) || buy > 1000) { fieldErr(form, 'buy', 'Enter 0 – 1000 SOL'); ok = false; }
          const links = ['twitter', 'telegram', 'website'];
          links.forEach((k) => { const v = form[k].value.trim(); if (v && !/^https?:\/\//i.test(v)) { fieldErr(form, k, 'Start with https://'); ok = false; } });
          if (live.health && !live.health.pinata) ok = false;
          Object.assign(opts, {
            description: form.desc.value.trim(), image: imageData, devBuy: buy,
            twitter: form.twitter.value.trim(), telegram: form.telegram.value.trim(), website: form.website.value.trim(),
            slippage: parseFloat(form.slippage.value) || 10, priorityFee: parseFloat(form.prio.value) || 0.0005
          });
          if (ok && state.sol && live.balances.sol != null && live.balances.sol < buy + 0.03) {
            fieldErr(form, 'buy', `Not enough SOL: ${num(live.balances.sol)} in the wallet, needs about ${num(buy + 0.03)}`); ok = false;
          }
        } else {
          const supply = form.supply.value.replace(/[_,\s]/g, '');
          if (!/^[1-9]\d{0,14}$/.test(supply)) { fieldErr(form, 'supply', 'Whole number between 1 and 999 trillion'); ok = false; }
          opts.supply = supply;
        }
        if (!ok) return;

        const fam = site.chain === 'sol' ? 'sol' : 'evm';
        if (!state[fam] && !(await connect(fam))) return;

        busy = true;
        form.querySelectorAll('input, textarea, button').forEach((x) => { x.disabled = true; });
        $('#steps', form).innerHTML = '';
        const st = stepper($('#steps', form));
        const chain = site.chain;
        try {
          let res;
          let costUsd;
          if (site.id === 'pump') {
            const before = await C.solBalance(state.sol.address).catch(() => null);
            res = await C.launchPump(opts, st.step);
            const after = await C.solBalance(res.owner).catch(() => null);
            costUsd = (before != null && after != null && before > after ? before - after : opts.devBuy) * usdOf('sol');
          } else {
            res = await C.launchEvm(chain, opts, st.step);
            costUsd = res.gasNative * usdOf(chain);
          }
          st.done();
          const l = {
            id: uid(), site: site.id, chain, addr: res.address, name, ticker, image: res.image || null,
            created: Date.now(), archived: false, owner: res.owner, tx: res.signature,
            costUsd: Math.round(costUsd * 100) / 100, realizedUsd: 0, holdings: null, priceUsd: null,
            events: costUsd ? [{ t: Date.now(), v: -Math.round(costUsd * 100) / 100 }] : [], lastPnl: -Math.round(costUsd * 100) / 100
          };
          state.launches.push(l);
          log(`Launched ${ticker} on ${site.name}`);
          save();
          busy = false;
          ui.status = 'live'; saveUi(); syncFilter();
          renderAll();
          toast(`${ticker} is live on ${site.name}`);
          $('#createFoot', form).innerHTML = `
            <a class="btn btn-ghost" href="${C.explorerTx(chain, res.signature)}" target="_blank" rel="noopener">Transaction</a>
            ${site.id === 'pump' ? `<a class="btn btn-ghost" href="https://pump.fun/coin/${res.address}" target="_blank" rel="noopener">pump.fun page</a>`
              : chain === 'rh' ? `<a class="btn btn-ghost" href="${C.explorerToken(chain, res.address)}" target="_blank" rel="noopener">View token</a>`
              : `<a class="btn btn-ghost" href="${chain === 'bnb' ? 'https://pancakeswap.finance' : 'https://app.uniswap.org'}" target="_blank" rel="noopener">Add liquidity</a>`}
            <button class="btn btn-primary" type="button" data-close>Done</button>`;
          refresh();
        } catch (err) {
          busy = false;
          st.fail(err.message || 'Launch failed');
          if (err.signature) $('#steps', form).insertAdjacentHTML('beforeend', `<li><a class="link-btn" href="${C.explorerTx(chain, err.signature)}" target="_blank" rel="noopener">Open the transaction in the explorer</a></li>`);
          form.querySelectorAll('input, textarea, button').forEach((x) => { x.disabled = false; });
        }
      });
    });
  };

  const openImport = () => {
    openModal('Import Token', `
      <form class="form" id="importForm" novalidate>
        <p class="dim" style="margin:0;font-size:13px">Add a token you launched somewhere else, so Vela tracks its P&amp;L.</p>
        <label class="field"><span>Chain</span><select name="chain">${CHAIN_IDS.map((c) => `<option value="${c}" ${c === 'sol' ? 'selected' : ''}>${CHAINS[c].name}</option>`).join('')}</select></label>
        <label class="field"><span>Token address</span><input name="addr" placeholder="Mint / contract address" spellcheck="false" autocomplete="off"></label>
        <div class="row2">
          <label class="field"><span>Name (optional)</span><input name="name" maxlength="32"></label>
          <label class="field"><span>What it cost you, USD (optional)</span><input name="cost" inputmode="decimal" placeholder="0"></label>
        </div>
        <p class="dim" style="margin:0;font-size:12.5px">Holdings are read from your connected wallet on that chain.</p>
        <div class="form-foot">
          <button class="btn btn-ghost" type="button" data-close>Cancel</button>
          <button class="btn btn-primary" type="submit">${icon('download')}<span>Import</span></button>
        </div>
      </form>`, (body) => {
      const form = $('#importForm', body);
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        $$('.err', form).forEach((x) => x.remove());
        const chain = form.chain.value;
        const addr = form.addr.value.trim();
        const valid = chain === 'sol' ? /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr) : /^0x[0-9a-fA-F]{40}$/.test(addr);
        if (!valid) { fieldErr(form, 'addr', chain === 'sol' ? 'Not a Solana address' : 'Not an EVM address (0x + 40 hex)'); return; }
        if (state.launches.some((l) => l.addr.toLowerCase() === addr.toLowerCase())) { fieldErr(form, 'addr', 'Already in your launches'); return; }
        const cost = Math.max(0, parseFloat(form.cost.value) || 0);
        const name = form.name.value.trim() || `Token ${addr.slice(0, 4)}`;
        const owner = chain === 'sol' ? state.sol?.address : state.evm?.address;
        state.launches.push({
          id: uid(), site: 'import', chain, addr, name, ticker: name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'TOKEN',
          image: null, created: Date.now(), archived: false, owner: owner || null, tx: null,
          costUsd: cost, realizedUsd: 0, holdings: null, priceUsd: null,
          events: cost ? [{ t: Date.now(), v: -cost }] : [], lastPnl: -cost
        });
        log(`Imported ${short(addr)} on ${CHAINS[chain].name}`);
        save();
        closeModal();
        renderAll();
        toast(owner ? 'Token imported' : 'Imported — connect a wallet to read your holdings');
        refresh();
      });
    });
  };

  const openLaunch = (id) => {
    const l = state.launches.find((x) => x.id === id);
    if (!l) return;
    const p = pnlOf(l);
    const canSell = l.site === 'pump' && state.sol && l.owner === state.sol.address && l.holdings > 0;
    openModal(l.name, `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">${avatar(l)}
        <div><b>${esc(l.ticker)}</b> <span class="badge ${l.archived ? 'badge-arch' : 'badge-live'}">${l.archived ? 'Archived' : 'Live'}</span>
        <div class="mono dim" style="letter-spacing:0">${short(l.addr)} · ${esc(siteName(l.site))}</div></div></div>
      <div class="stats">
        <div class="stat"><span>Chain</span><b>${CHAINS[l.chain].name}</b></div>
        <div class="stat"><span>Launched</span><b>${dateLong(l.created)}</b></div>
        <div class="stat"><span>Cost (dev buy + fees)</span><b>${money(l.costUsd || 0)}</b></div>
        <div class="stat"><span>Price</span><b>${price(l.priceUsd)}</b></div>
        <div class="stat"><span>Dev holdings</span><b>${l.holdings != null ? qty(l.holdings) : '—'}</b> <span class="dim">${l.priceUsd ? money(holdUsd(l)) : ''}</span></div>
        <div class="stat"><span>Market cap</span><b>${l.mcap ? compact(l.mcap) : '—'}</b></div>
        <div class="stat"><span>Realized</span><b>${money(l.realizedUsd || 0)}</b></div>
        <div class="stat"><span>P&amp;L</span><b>${pnlCell(p)}</b></div>
      </div>
      <div class="links">
        <a href="${C.explorerToken(l.chain, l.addr)}" target="_blank" rel="noopener">Explorer</a>
        <a href="${C.dexscreener(l.chain, l.addr)}" target="_blank" rel="noopener">DexScreener</a>
        ${l.site === 'pump' ? `<a href="https://pump.fun/coin/${esc(l.addr)}" target="_blank" rel="noopener">pump.fun</a>` : ''}
        ${l.tx ? `<a href="${C.explorerTx(l.chain, l.tx)}" target="_blank" rel="noopener">Launch tx</a>` : ''}
      </div>
      ${canSell ? `<div class="sell"><span>Sell dev tokens</span>
        <button class="btn btn-ghost" type="button" data-sell="25">25%</button>
        <button class="btn btn-ghost" type="button" data-sell="50">50%</button>
        <button class="btn btn-danger" type="button" data-sell="100">100%</button></div>` : ''}
      <ul class="steps" id="sellSteps" style="margin-bottom:12px"></ul>
      <div class="form-foot">
        <button class="btn btn-ghost" type="button" id="copyAddr">${icon('copy')}<span>Copy address</span></button>
        ${l.archived
          ? `<button class="btn btn-danger" type="button" id="removeLaunch">Remove from Vela</button><button class="btn btn-ghost" type="button" data-unarchive="${l.id}">Restore</button>`
          : `<button class="btn btn-ghost" type="button" id="archiveLaunch">${icon('archive')}<span>Archive</span></button>`}
      </div>`, (body) => {
      $('#copyAddr', body).addEventListener('click', () => copy(l.addr, 'Address'));
      $('#archiveLaunch', body)?.addEventListener('click', () => {
        l.archived = true; log(`Archived ${l.ticker}`); save(); closeModal(); renderAll(); toast(`${l.ticker} archived`);
      });
      const rm = $('#removeLaunch', body);
      rm?.addEventListener('click', () => {
        if (!rm.dataset.armed) { rm.dataset.armed = '1'; rm.textContent = 'Click again to remove'; return; }
        state.launches = state.launches.filter((x) => x.id !== l.id);
        log(`Removed ${l.ticker} from Vela`); save(); closeModal(); renderAll();
      });
      $$('[data-sell]', body).forEach((b) => b.addEventListener('click', async () => {
        if (busy) return;
        const pct = +b.dataset.sell;
        busy = true;
        $$('[data-sell]', body).forEach((x) => { x.disabled = true; });
        const st = stepper($('#sellSteps', body));
        try {
          const before = await C.solBalance(state.sol.address);
          await C.sellPump(l.addr, pct, st.step);
          const after = await C.solBalance(state.sol.address);
          const got = Math.max(0, after - before) * usdOf('sol');
          l.realizedUsd = Math.round(((l.realizedUsd || 0) + got) * 100) / 100;
          st.done();
          log(`Sold ${pct}% of ${l.ticker} for ${money(got)}`);
          save();
          busy = false;
          toast(`Sold ${pct}% of ${l.ticker}`);
          await refresh();
        } catch (err) {
          busy = false;
          st.fail(err.message || 'Sale failed');
          $$('[data-sell]', body).forEach((x) => { x.disabled = false; });
        }
      }));
    });
  };

  const openActivity = () => {
    openModal('Activity', state.activity.length
      ? `<ul class="activity">${state.activity.slice(0, 40).map((a) => `<li><span>${esc(a.text)}</span><time>${ago(a.t)}</time></li>`).join('')}</ul>`
      : '<p class="dim">Nothing yet. Connect a wallet or create a launch.</p>');
  };

  const openDocs = () => {
    openModal('How Vela works', `
      <div class="form" style="font-size:13.5px;color:var(--prose)">
        <p style="margin:0"><b>1. Connect.</b> Phantom or Solflare for Solana, MetaMask or Rabby for Robinhood Chain, Base and BNB Chain. Vela never sees your keys; your wallet signs every transaction.</p>
        <p style="margin:0"><b>2. Create Launch.</b> On <b>pump.fun</b> the image and metadata go to IPFS, the create transaction is built by PumpPortal, and your wallet signs it together with a fresh mint key. On <b>Robinhood Chain, Base or BNB Chain</b> Vela deploys a plain fixed-supply ERC-20 from your wallet; add liquidity on a DEX to make it tradable.</p>
        <p style="margin:0"><b>3. Track.</b> P&amp;L = your dev tokens × the DexScreener price + what you sold − what the launch cost you (dev buy and fees, measured from your wallet balance). It refreshes every minute while Vela is open.</p>
        <p style="margin:0"><b>Where data lives.</b> Your launch list is stored in this browser. Clearing site data forgets it, though the tokens stay on-chain and can be imported again.</p>
        <p class="note" style="margin:0">Launching a token costs real money and is irreversible. Check the name, ticker and amount before you sign.</p>
      </div>`);
  };

  /* ---------- customize (theme / style / layout) ---------- */

  const THEMES = [
    { id: 'default', name: 'Default', bg: '#0b0c0f', pane: '#121317', ink: '#eceef2', primary: '#6e6cf6' },
    { id: 'dark', name: 'Dark', bg: '#09090b', pane: '#111113', ink: '#f2f2f3', primary: '#4f6ef7' },
    { id: 'legacy', name: 'Legacy', bg: '#101218', pane: '#161922', ink: '#e9ecf5', primary: '#98abff' },
    { id: 'emerald', name: 'Emerald', bg: '#0a0d0c', pane: '#111614', ink: '#ebf2ee', primary: '#3ccf7a' },
    { id: 'midnight', name: 'Midnight', bg: '#07070d', pane: '#0e0e1a', ink: '#ecebf7', primary: '#8b5cf6' },
    { id: 'light', name: 'Light', bg: '#f6f7f9', pane: '#ffffff', ink: '#12141a', primary: '#4f5ef7' },
    { id: 'light-blue', name: 'Light Blue', bg: '#eef4fd', pane: '#ffffff', ink: '#0f1a2e', primary: '#3b82f6' },
    { id: 'light-rose', name: 'Light Rose', bg: '#fcf1f4', pane: '#ffffff', ink: '#2a1219', primary: '#e0508a' },
    { id: 'custom', name: 'Custom', bg: '#0b0c0f', pane: '#121317', ink: '#eceef2', primary: null }
  ];
  const LOOK_DEFAULT = { theme: 'default', primary: null, radius: 'default', font: 'inter', density: 'comfortable', side: 'left', statusbar: 'on', charts: 'side' };
  let look = Object.assign({}, LOOK_DEFAULT, read(LOOK_KEY, {}));

  const applyLook = () => {
    const d = document.documentElement;
    const theme = look.theme === 'custom' ? 'default' : look.theme;
    d.setAttribute('data-theme', theme);
    ['radius', 'font', 'density', 'side', 'statusbar', 'charts'].forEach((k) => d.setAttribute(`data-${k}`, look[k]));
    if (look.primary) d.style.setProperty('--user-primary', look.primary); else d.style.removeProperty('--user-primary');
    write(LOOK_KEY, { ...look, theme: look.theme });
    if (view === 'dashboard') renderDashboard();
  };
  const themePrimary = () => (THEMES.find((t) => t.id === look.theme)?.primary) || '#6e6cf6';
  const HEX = /^#?[0-9a-f]{6}$/i;

  const openCustomize = () => {
    const segOf = (key, opts) => `<div class="seg" data-look="${key}">${opts.map(([v, label]) => `<button type="button" data-v="${v}" class="${look[key] === v ? 'is-on' : ''}">${label}</button>`).join('')}</div>`;
    openModal('Customize', `
      <div class="tabs" role="tablist">
        <button type="button" class="is-on" data-tab="theme">Theme</button>
        <button type="button" data-tab="style">Style</button>
        <button type="button" data-tab="layout">Layout</button>
      </div>
      <div data-pane="theme">
        <div class="themes">${THEMES.map((t) => `
          <button type="button" class="theme-opt ${look.theme === t.id ? 'is-on' : ''}" data-theme-id="${t.id}">
            <div class="theme-prev" style="background:${t.bg}">
              <div class="dots"><span style="background:${t.primary || 'var(--primary)'}"></span><span style="background:${t.primary || 'var(--primary)'};opacity:.6"></span></div>
              <div class="pane" style="background:${t.pane}"><i style="background:${t.ink};width:55%"></i><i style="background:${t.ink};opacity:.55;width:80%"></i><i style="background:${t.ink};opacity:.3;width:40%"></i></div>
            </div>${t.name}</button>`).join('')}
        </div>
        <div class="opt-group" style="margin:18px 0 0">
          <span>Primary Color</span>
          <div class="color-row">
            <label class="color-field"><input type="color" id="primaryPick" value="${look.primary || themePrimary()}"><input type="text" id="primaryHex" maxlength="7" value="${(look.primary || themePrimary()).replace('#', '').toUpperCase()}" aria-label="Primary colour hex"></label>
            <button class="icon-btn" type="button" id="primaryReset" title="Use the theme’s colour" aria-label="Reset primary colour">${icon('reset')}</button>
          </div>
        </div>
      </div>
      <div data-pane="style" hidden>
        <div class="opt-group"><span>Corners</span>${segOf('radius', [['sharp', 'Sharp'], ['default', 'Default'], ['round', 'Round']])}</div>
        <div class="opt-group"><span>Font</span>${segOf('font', [['inter', 'Inter'], ['mono', 'Mono'], ['system', 'System']])}</div>
        <div class="opt-group"><span>Density</span>${segOf('density', [['comfortable', 'Comfortable'], ['compact', 'Compact']])}</div>
      </div>
      <div data-pane="layout" hidden>
        <div class="opt-group"><span>Sidebar</span>${segOf('side', [['left', 'Left'], ['right', 'Right']])}</div>
        <div class="opt-group"><span>Status bar</span>${segOf('statusbar', [['on', 'Show'], ['off', 'Hide']])}</div>
        <div class="opt-group"><span>Charts</span>${segOf('charts', [['side', 'Side by side'], ['stacked', 'Stacked']])}</div>
      </div>
      <div class="custom-foot">
        <button class="btn btn-ghost" type="button" id="lookExport">Export</button>
        <label class="btn btn-ghost" style="cursor:pointer">Import<input type="file" id="lookImport" accept="application/json,.json" hidden></label>
        <button class="btn btn-done" type="button" data-close>Done</button>
      </div>`, (body) => {
      const syncPrimary = () => {
        const v = look.primary || themePrimary();
        $('#primaryPick', body).value = v;
        $('#primaryHex', body).value = v.replace('#', '').toUpperCase();
      };
      body.addEventListener('click', (e) => {
        const tab = e.target.closest('[data-tab]');
        if (tab) {
          $$('[data-tab]', body).forEach((b) => b.classList.toggle('is-on', b === tab));
          $$('[data-pane]', body).forEach((p) => { p.hidden = p.dataset.pane !== tab.dataset.tab; });
          return;
        }
        const th = e.target.closest('[data-theme-id]');
        if (th) {
          look.theme = th.dataset.themeId;
          if (look.theme !== 'custom') look.primary = null;
          $$('[data-theme-id]', body).forEach((b) => b.classList.toggle('is-on', b === th));
          applyLook(); syncPrimary();
          return;
        }
        const opt = e.target.closest('[data-look] [data-v]');
        if (opt) {
          const key = opt.parentElement.dataset.look;
          look[key] = opt.dataset.v;
          $$('[data-v]', opt.parentElement).forEach((b) => b.classList.toggle('is-on', b === opt));
          applyLook();
        }
      });
      const setPrimary = (hex) => {
        look.primary = hex;
        applyLook();
      };
      $('#primaryPick', body).addEventListener('input', (e) => { setPrimary(e.target.value); $('#primaryHex', body).value = e.target.value.slice(1).toUpperCase(); });
      $('#primaryHex', body).addEventListener('input', (e) => {
        const v = e.target.value.trim();
        if (HEX.test(v)) { const hex = '#' + v.replace('#', '').toLowerCase(); setPrimary(hex); $('#primaryPick', body).value = hex; }
      });
      $('#primaryReset', body).addEventListener('click', () => { look.primary = null; applyLook(); syncPrimary(); });
      $('#lookExport', body).addEventListener('click', () => {
        const blob = new Blob([JSON.stringify({ vela: 'look', version: 1, ...look }, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'vela-theme.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      });
      $('#lookImport', body).addEventListener('change', async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        try {
          const j = JSON.parse(await f.text());
          const next = { ...LOOK_DEFAULT };
          if (THEMES.some((t) => t.id === j.theme)) next.theme = j.theme;
          if (j.primary && HEX.test(j.primary)) next.primary = '#' + j.primary.replace('#', '').toLowerCase();
          const allowed = { radius: ['sharp', 'default', 'round'], font: ['inter', 'mono', 'system'], density: ['comfortable', 'compact'], side: ['left', 'right'], statusbar: ['on', 'off'], charts: ['side', 'stacked'] };
          Object.entries(allowed).forEach(([k, vals]) => { if (vals.includes(j[k])) next[k] = j[k]; });
          look = next;
          applyLook();
          closeModal();
          openCustomize();
          toast('Theme imported');
        } catch (_) { toast('That file is not a Vela theme', true); }
      });
    }, true);
  };

  /* ---------- controls ---------- */

  const closePops = () => $$('.pop').forEach((p) => { p.hidden = true; });
  const togglePop = (pop) => { const open = pop.hidden; closePops(); pop.hidden = !open; };
  const syncFilter = () => $$('#filterPop [data-status]').forEach((b) => b.classList.toggle('is-on', b.dataset.status === ui.status));

  const buildChainSeg = () => {
    $('#chainSeg').innerHTML = '<button type="button" data-chain="all">All</button>' + CHAIN_IDS.map((c) =>
      `<button type="button" data-chain="${c}" title="${CHAINS[c].name}">${logoImg(CHAINS[c].logo)}${CHAINS[c].short}</button>`).join('');
  };
  const syncSegs = () => {
    $$('#rangeSeg button').forEach((b) => b.classList.toggle('is-on', b.dataset.range === ui.range));
    $$('#chainSeg button').forEach((b) => b.classList.toggle('is-on', b.dataset.chain === ui.chain));
    $$('.chart-modes').forEach((g) => {
      const mode = g.dataset.chart === 'cum' ? ui.cumMode : ui.dailyMode;
      $$('button', g).forEach((b) => b.classList.toggle('is-on', b.dataset.mode === mode));
    });
  };

  document.addEventListener('click', (e) => {
    const t = e.target;
    const el = (sel) => t.closest(sel);
    if (!el('.pop-wrap')) closePops();

    if (el('[data-range]')) { ui.range = el('[data-range]').dataset.range; saveUi(); syncSegs(); renderDashboard(); return; }
    if (el('[data-chain]')) { ui.chain = el('[data-chain]').dataset.chain; saveUi(); syncSegs(); renderView(); return; }
    if (el('.chart-modes button')) {
      const b = el('.chart-modes button');
      if (b.parentElement.dataset.chart === 'cum') ui.cumMode = b.dataset.mode; else ui.dailyMode = b.dataset.mode;
      saveUi(); syncSegs(); renderDashboard(); return;
    }
    if (el('[data-launch]')) { openLaunch(el('[data-launch]').dataset.launch); return; }
    if (el('[data-create]')) { if (!modal.hidden) closeModal(); openCreate(el('[data-create]').dataset.create); return; }
    if (el('[data-soon]')) { toast(SITES.find((s) => s.id === el('[data-soon]').dataset.soon).why); return; }
    if (el('a[data-view]')) {
      e.preventDefault();
      const v = el('a[data-view]').dataset.view;
      if (location.hash.slice(1) === v) go(v); else location.hash = v;
      return;
    }
    if (el('#filterBtn')) { togglePop($('#filterPop')); return; }
    if (el('[data-status]')) { ui.status = el('[data-status]').dataset.status; saveUi(); syncFilter(); renderLaunchList(); closePops(); return; }
    if (el('#funderBtn')) { togglePop($('#funderPop')); return; }
    if (el('[data-connect]')) {
      const fam = el('[data-connect]').dataset.connect;
      if (fam === 'sol' ? !C.hasSol() : !C.hasEvm()) {
        window.open(fam === 'sol' ? 'https://phantom.com/download' : 'https://metamask.io/download/', '_blank', 'noopener');
        return;
      }
      connect(fam); return;
    }
    if (el('[data-disconnect]')) { disconnect(el('[data-disconnect]').dataset.disconnect); return; }
    if (el('[data-copy]')) { copy(el('[data-copy]').dataset.copy, 'Address'); return; }
    if (el('[data-unarchive]')) {
      const l = state.launches.find((x) => x.id === el('[data-unarchive]').dataset.unarchive);
      if (l) { l.archived = false; log(`Restored ${l.ticker}`); save(); if (!modal.hidden) closeModal(); renderAll(); toast(`${l.ticker} restored`); }
      return;
    }
    if (el('[data-untrack]')) {
      state.tracked = state.tracked.filter((x) => x.id !== el('[data-untrack]').dataset.untrack);
      save(); renderTracker();
    }
  });

  $('#search').addEventListener('input', renderLaunchList);
  $('#featuresToggle').addEventListener('click', (e) => {
    const b = e.currentTarget;
    const open = b.getAttribute('aria-expanded') !== 'true';
    b.setAttribute('aria-expanded', String(open));
    $('#featuresList').hidden = !open;
  });
  $('#collapse').addEventListener('click', () => {
    ui.collapsed = !ui.collapsed; saveUi();
    $('#app').classList.toggle('is-collapsed', ui.collapsed);
  });
  $('#burger').addEventListener('click', () => { $('#app').classList.add('is-menu'); $('#scrim').hidden = false; });
  $('#scrim').addEventListener('click', () => { $('#app').classList.remove('is-menu'); $('#scrim').hidden = true; });
  $('#createBtn').addEventListener('click', () => openCreate());
  $('#importBtn').addEventListener('click', openImport);
  $('#refreshBtn').addEventListener('click', () => { refresh().then(() => toast('Refreshed')); });
  $('#activityBtn').addEventListener('click', openActivity);
  $('#docsBtn').addEventListener('click', openDocs);
  $('#settingsBtn').addEventListener('click', openCustomize);

  $('#trackForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const addr = $('#trackInput').value.trim();
    const chain = /^0x[0-9a-fA-F]{40}$/.test(addr) ? (isEvm(ui.chain) ? ui.chain : 'base')
      : /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr) ? 'sol' : null;
    if (!chain) { toast('That doesn’t look like a token address', true); return; }
    if (state.tracked.concat(state.launches).some((x) => x.addr.toLowerCase() === addr.toLowerCase())) { toast('Already tracking that token'); return; }
    state.tracked.push({ id: uid(), addr, chain, created: Date.now(), name: null, ticker: null });
    $('#trackInput').value = '';
    save(); renderTracker(); toast('Tracking — loading market data');
    refresh();
  });

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (innerWidth <= 860) { $('#app').classList.add('is-menu'); $('#scrim').hidden = false; }
      if (ui.collapsed) { ui.collapsed = false; $('#app').classList.remove('is-collapsed'); saveUi(); }
      $('#search').focus();
      $('#search').select();
    }
    if (e.key === 'Escape') {
      if (!modal.hidden) closeModal();
      closePops(); hideTip();
      $('#app').classList.remove('is-menu'); $('#scrim').hidden = true;
    }
  });

  let resizeTimer;
  new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (view === 'dashboard') renderDashboard(); }, 80);
  }).observe($('#main'));

  /* ---------- status bar ---------- */

  const TREND = {
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>',
    down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 7 6 6 4-4 8 8"/><path d="M15 17h6v-6"/></svg>'
  };
  const TICKERS = [['sol', 'Solana'], ['bnb', 'BNB'], ['eth', 'Ethereum'], ['arc', 'AI Rig Complex (ARC)']];
  const renderPrices = () => {
    $('#prices').innerHTML = TICKERS.map(([k, name]) => {
      const p = live.prices[k];
      if (!p?.usd) return '';
      const ch = p.change || 0;
      const up = ch >= 0;
      const val = p.usd >= 1 ? usd(p.usd) : price(p.usd);
      return `<span class="coin" title="${name} · ${up ? '+' : ''}${ch.toFixed(2)}% in 24h">${logoImg(`img/${k}.png`)}<b>${val}</b><i class="${up ? 'up' : 'down'}">${TREND[up ? 'up' : 'down']}</i></span>`;
    }).join('');
  };

  const ping = async () => {
    const t0 = performance.now();
    try {
      live.health = await C.health();
      live.latency = Math.round(performance.now() - t0);
      $('#apiDot').className = 'live-dot';
      $('#apiStatus').className = 'sb-ok';
      $('#apiStatus').innerHTML = `All Services are Live<b> • ${live.latency}ms</b>`;
    } catch (_) {
      live.health = null;
      $('#apiDot').className = 'live-dot off';
      $('#apiStatus').className = 'sb-ok off';
      $('#apiStatus').textContent = 'Vela server offline — run `node server.js`';
    }
  };

  /* ---------- boot ---------- */

  const restoreWallets = async () => {
    const [s, e] = await Promise.all([
      state.sol ? C.connectSol(true) : null,
      state.evm ? C.connectEvm(true) : null
    ]);
    state.sol = s;
    state.evm = e;
    save();
    C.onAccountsChanged((fam, address) => {
      if (!address) { state[fam] = null; }
      else if (state[fam] && state[fam].address !== address) { state[fam] = { ...state[fam], address }; log(`Switched to ${short(address)}`); }
      save(); renderAll(); refresh();
    });
  };

  paintIcons();
  buildChainSeg();
  syncSegs();
  syncFilter();
  applyLook();
  $('#app').classList.toggle('is-collapsed', !!ui.collapsed);
  renderAll();
  go(location.hash.slice(1));

  ping().then(() => { if (view === 'sites') renderSites(); });
  restoreWallets().finally(refresh);
  setInterval(ping, 20000);
  setInterval(() => { if (!document.hidden && !busy) refresh(); }, 60000);
})();
