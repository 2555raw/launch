/* Asanka Pad — a launchpad for coins paired with West African dishes.
   Everything here is a simulation: the wallet, the SOL, the other traders and the
   prices. Coins trade on a pump-style bonding curve (constant product over virtual
   reserves) and "graduate" once the curve has raised GRAD_SOL. Nothing touches a
   blockchain and no real money moves. */

(() => {
  'use strict';

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  /* ---------- curve parameters ---------- */

  const SOL_USD = 150;                 // fixed demo price of SOL
  const TOTAL = 1_000_000_000;         // supply of every coin
  const V_SOL0 = 30;                   // virtual SOL reserve at launch
  const V_TOK0 = 1_073_000_000;        // virtual token reserve at launch
  const GRAD_SOL = 85;                 // real SOL raised when the curve completes
  const FEE = 0.01;                    // 1 % on every trade
  const CREATE_FEE = 0.02;             // SOL to launch a coin
  const START_SOL = 10;                // demo balance of a new wallet
  const KEY = 'asanka-pad-v1';

  /* ---------- the dishes a coin can be paired with ---------- */

  const DISHES = [
    { art: 'fufu:light', name: 'Fufu & light soup', region: 'Ghana' },
    { art: 'fufu:groundnut', name: 'Fufu & groundnut soup', region: 'Ghana' },
    { art: 'fufu:palmnut:fish', name: 'Fufu & palm nut soup', region: 'Ghana' },
    { art: 'fufu:egusi', name: 'Egusi soup', region: 'Nigeria' },
    { art: 'jollof:chicken', name: 'Jollof rice', region: 'Nigeria' },
    { art: 'jollof:fish', name: 'Thieboudienne', region: 'Senegal' },
    { art: 'jollof:beef', name: 'Suya jollof', region: 'Nigeria' },
    { art: 'jollof:veg', name: 'Waakye', region: 'Ghana' },
    { art: 'suya', name: 'Suya', region: 'Nigeria' },
    { art: 'injera', name: 'Injera & wat', region: 'Ethiopia' },
    { art: 'side:puffpuff', name: 'Puff-puff', region: 'Nigeria' },
    { art: 'side:kelewele', name: 'Kelewele', region: 'Ghana' },
    { art: 'side:dodo', name: 'Dodo', region: 'Nigeria' },
    { art: 'side:shito', name: 'Shito', region: 'Ghana' },
    { art: 'drink:sobolo', name: 'Sobolo / Bissap', region: 'Senegal' },
    { art: 'drink:ginger', name: 'Ginger beer', region: 'Ghana' },
  ];
  const REGIONS = ['Ghana', 'Nigeria', 'Senegal', 'Ethiopia', 'Cameroon', 'Mali', "Côte d'Ivoire"];

  const SEEDS = [
    ['FUFU', 'Fufu Coin', 'fufu:light', 'Ghana', .93, 'Pounded by hand, pumped by hand. Every buy is another hit of the pestle.'],
    ['JOLLOF', 'Jollof Wars', 'jollof:chicken', 'Nigeria', 1, 'Ghana vs Nigeria, settled on-chain. Smoky bottom of the pot included.'],
    ['SUYA', 'Suya Szn', 'suya', 'Nigeria', .74, 'Spiced on the grill, hot on the curve. Peanut, chili, no brakes.'],
    ['DODO', 'Dodo DAO', 'side:dodo', 'Nigeria', .66, 'Fried plantain governance. Every vote is sweet.'],
    ['EGUSI', 'Egusi Gang', 'fufu:egusi', 'Nigeria', .61, 'Melon seeds, spinach and a community that never sells.'],
    ['INJERA', 'Injera Inu', 'injera', 'Ethiopia', .52, 'The plate you can eat. The coin you can hold.'],
    ['PUFF', 'Puff Puff Pass', 'side:puffpuff', 'Nigeria', .45, 'Sweet, round and passed around the table.'],
    ['KELE', 'Kelewele', 'side:kelewele', 'Ghana', .38, 'Accra night-market energy. Ginger, clove and chili.'],
    ['THIEB', 'Thieb', 'jollof:fish', 'Senegal', .27, "Senegal's national dish, now riding the curve."],
    ['ABENK', 'Abenkwan', 'fufu:palmnut:fish', 'Ghana', .22, 'Palm nut soup for patient holders. It simmers for hours.'],
    ['SHITO', 'Shito Sauce', 'side:shito', 'Ghana', .15, 'Black pepper sauce. Small jar, big heat.'],
    ['BISSAP', 'Bissap', 'drink:sobolo', 'Senegal', .09, 'Hibiscus, ginger, served cold. Liquidity included.'],
  ];

  const BOT_LAUNCHES = [
    ['WAAKYE', 'Waakye Wagmi', 'jollof:veg', 'Ghana', 'Rice and beans for the whole timeline.'],
    ['BANKU', 'Banku Bros', 'side:fufu', 'Ghana', 'Fermented, patient, unbothered.'],
    ['YASSA', 'Yassa', 'jollof:chicken', 'Senegal', 'Onions, lemon and a lot of conviction.'],
    ['MAFE', 'Mafé Money', 'fufu:groundnut', 'Mali', 'Peanut stew that compounds.'],
    ['NDOLE', 'Ndolé', 'fufu:egusi', 'Cameroon', 'Bitter leaves, sweet chart.'],
    ['DORO', 'Doro Wat', 'injera', 'Ethiopia', 'Berbere-spiced and slow-cooked.'],
    ['ATTIEKE', 'Attiéké', 'jollof:fish', "Côte d'Ivoire", 'Cassava couscous with grilled fish. Light and fast.'],
    ['AKARA', 'Akara', 'side:puffpuff', 'Nigeria', 'Bean fritters for breakfast degens.'],
    ['REDRED', 'Red Red', 'side:dodo', 'Ghana', 'Beans in palm oil. Red candles only.'],
    ['PEPPER', 'Pepper Soup', 'fufu:light', 'Nigeria', 'Clears your sinuses and your doubts.'],
    ['CHAPMAN', 'Chapman', 'drink:ginger', 'Nigeria', 'The mocktail of the curve.'],
    ['TUO', 'Tuo Zaafi', 'side:fufu', 'Ghana', 'From the north, with green soup.'],
  ];

  const REPLIES = [
    'the pestle never stops', 'bought the dip. literally dipped it in the soup', 'this smells like graduation',
    'Ghana jollof > Nigeria jollof, fight me', 'dev is cooking (actually cooking)', 'holding until the soup is ready',
    'who else came here hungry', 'fufu is the new stable', 'chart looks like a fufu ball: round and heavy',
    'LP locked? asking for my grandma', 'ate this for lunch, aped after', 'no rug, only a straw mat',
  ];

  /* ---------- helpers ---------- */

  const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const newAddr = () => Array.from({ length: 44 }, () => B58[Math.floor(Math.random() * 58)]).join('');
  const short = (a) => `${a.slice(0, 4)}…${a.slice(-4)}`;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const expo = (mean) => -Math.log(1 - Math.random()) * mean;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const usd = (n) => {
    if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
    return `$${n.toFixed(0)}`;
  };
  const sol = (n) => `${n >= 100 ? n.toFixed(1) : n >= 1 ? n.toFixed(2) : n.toFixed(3)} SOL`;
  const tokens = (n) => {
    if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
    return n.toFixed(0);
  };
  const pct = (n) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
  const ago = (t) => {
    const s = Math.max(1, Math.round((Date.now() - t) / 1000));
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.round(s / 60)}m ago`;
    if (s < 86400) return `${Math.round(s / 3600)}h ago`;
    return `${Math.round(s / 86400)}d ago`;
  };

  const store = {
    get() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) { return null; } },
    set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (_) { /* storage blocked or full */ } },
    clear() { try { localStorage.removeItem(KEY); } catch (_) { /* storage blocked */ } },
  };

  /* ---------- the curve ---------- */

  const price = (t) => t.vSol / t.vTok;                         // SOL per token
  const mcap = (t) => price(t) * TOTAL * SOL_USD;               // USD
  const progress = (t) => clamp(t.realSol / GRAD_SOL, 0, 1);
  const GRAD_MCAP = (() => { const vs = V_SOL0 + GRAD_SOL; return (vs / ((V_SOL0 * V_TOK0) / vs)) * TOTAL * SOL_USD; })();

  const quoteBuy = (t, solIn) => {
    const s = Math.min(solIn * (1 - FEE), GRAD_SOL - t.realSol);
    if (s <= 0) return { s: 0, out: 0, spent: 0 };
    const out = t.vTok - (t.vSol * t.vTok) / (t.vSol + s);
    return { s, out, spent: s / (1 - FEE) };
  };
  const quoteSell = (t, tokIn) => {
    const gross = t.vSol - (t.vSol * t.vTok) / (t.vTok + tokIn);
    return { gross, out: gross * (1 - FEE) };
  };

  function makeToken({ ticker, name, art, region, desc, creator, createdAt }) {
    const t = {
      id: `${ticker}-${Math.random().toString(36).slice(2, 7)}`,
      ticker, name, art, region, desc, creator, createdAt,
      vSol: V_SOL0, vTok: V_TOK0, realSol: 0, graduated: false,
      history: [], trades: [], holders: {}, replies: [],
    };
    t.history.push({ t: createdAt, p: price(t) });
    return t;
  }

  function record(t, trade) {
    t.trades.unshift(trade);
    if (t.trades.length > 80) t.trades.length = 80;
    t.history.push({ t: trade.t, p: price(t) });
    if (t.history.length > 500) t.history.splice(1, t.history.length - 500);
    tape.unshift({ ...trade, ticker: t.ticker, id: t.id });
    if (tape.length > 24) tape.length = 24;
  }

  function buy(t, who, solIn, at = Date.now()) {
    if (t.graduated) return 0;
    const q = quoteBuy(t, solIn);
    if (q.out <= 0) return 0;
    t.vSol += q.s; t.vTok -= q.out; t.realSol += q.s;
    t.holders[who] = (t.holders[who] || 0) + q.out;
    record(t, { side: 'buy', who, sol: q.spent, tok: q.out, t: at });
    if (t.realSol >= GRAD_SOL - 1e-9) { t.graduated = true; t.graduatedAt = at; }
    return q.spent;
  }

  function sell(t, who, tokIn, at = Date.now()) {
    if (t.graduated) return 0;
    const held = t.holders[who] || 0;
    const amt = Math.min(tokIn, held);
    if (amt <= 0) return 0;
    const q = quoteSell(t, amt);
    t.vTok += amt; t.vSol -= q.gross; t.realSol = Math.max(0, t.realSol - q.gross);
    t.holders[who] = held - amt;
    if (t.holders[who] < 1) delete t.holders[who];
    record(t, { side: 'sell', who, sol: q.out, tok: amt, t: at });
    return q.out;
  }

  /* ---------- state ---------- */

  let tape = [];
  const BOTS = Array.from({ length: 90 }, newAddr);
  let state = store.get();

  function seedState() {
    const now = Date.now();
    tape = [];
    const list = SEEDS.map(([ticker, name, art, region, target, desc], i) => {
      const createdAt = now - (6 + i * 5 + Math.random() * 20) * 3600e3;
      const t = makeToken({ ticker, name, art, region, desc, creator: pick(BOTS), createdAt });
      let clock = createdAt;
      let guard = 0;
      while (t.realSol < target * GRAD_SOL - 0.01 && !t.graduated && guard++ < 2000) {
        clock += 1;
        const holders = Object.keys(t.holders);
        if (holders.length && Math.random() < .27) { const h = pick(holders); sell(t, h, t.holders[h] * (.3 + Math.random() * .7), clock); }
        else buy(t, pick(BOTS), clamp(expo(.9), .05, 5), clock);
      }
      // spread the simulated trades over the coin's lifetime
      const end = now - (1 + Math.random() * 20) * 60e3;
      const t0 = createdAt, t1 = clock;
      const map = (x) => (t1 === t0 ? end : createdAt + ((x - t0) / (t1 - t0)) * (end - createdAt));
      t.history.forEach((h) => { h.t = map(h.t); });
      t.trades.forEach((tr) => { tr.t = map(tr.t); });
      if (t.graduatedAt) t.graduatedAt = map(t.graduatedAt);
      t.replies = Array.from({ length: 2 + Math.floor(Math.random() * 4) }, (_, k) => ({
        who: pick(BOTS), text: REPLIES[(i * 3 + k) % REPLIES.length], t: end - k * 900e3 - Math.random() * 600e3,
      })).sort((a, b) => b.t - a.t);
      return t;
    });
    tape = list.flatMap((t) => t.trades.slice(0, 3).map((tr) => ({ ...tr, ticker: t.ticker, id: t.id })))
      .sort((a, b) => b.t - a.t).slice(0, 24);
    return { v: 1, tokens: list, wallet: null, launched: 0 };
  }

  if (!state || state.v !== 1 || !Array.isArray(state.tokens)) state = seedState();
  else tape = state.tokens.flatMap((t) => t.trades.slice(0, 3).map((tr) => ({ ...tr, ticker: t.ticker, id: t.id })))
    .sort((a, b) => b.t - a.t).slice(0, 24);

  let saveTimer = null;
  const save = () => {
    if (saveTimer) return;
    saveTimer = setTimeout(() => { saveTimer = null; store.set(state); }, 1200);
  };

  const byId = (id) => state.tokens.find((t) => t.id === id);

  /* ---------- theme (shared with the store) ---------- */

  const SUN  = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4"/></svg>';
  const MOON = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/></svg>';
  const themeBtn = $('#theme');
  const sysLight = window.matchMedia?.('(prefers-color-scheme: light)');
  const theme = () => document.documentElement.dataset.theme || (sysLight?.matches ? 'light' : 'dark');
  const paintTheme = () => { themeBtn.innerHTML = theme() === 'dark' ? SUN : MOON; drawChart(); };
  try { const s = localStorage.getItem('asanka-pad-theme'); if (s === 'light' || s === 'dark') document.documentElement.dataset.theme = s; } catch (_) { /* storage blocked */ }
  themeBtn.addEventListener('click', () => {
    const next = theme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('asanka-pad-theme', next); } catch (_) { /* storage blocked */ }
    paintTheme();
  });
  sysLight?.addEventListener?.('change', paintTheme);

  /* ---------- illustrations ---------- */

  const artCache = {};
  let artSeq = 0;
  function art(spec) {
    const A = window.AsankaArt;
    if (!A) return '';
    if (!artCache[spec]) {
      const [kind, a, b] = spec.split(':');
      const seed = [...spec].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);
      const P = '__P__';
      let s = '';
      if (kind === 'fufu') s = A.fufu(P, seed, a, { fish: b === 'fish' });
      else if (kind === 'jollof') s = A.jollof(P, seed, a);
      else if (kind === 'drink') s = A.drink(P, seed, a);
      else if (kind === 'suya') s = A.suya(P, seed);
      else if (kind === 'injera') s = A.injera(P, seed);
      else if (kind === 'stick') s = A.stickman(P, a);
      else if (kind === 'side') s = ({ kelewele: A.kelewele, dodo: A.dodo, shito: A.shito, puffpuff: A.puffpuff }[a] || (() => A.fufuSide(P)))(P, seed);
      artCache[spec] = s;
    }
    return artCache[spec].replaceAll('__P__', `p${++artSeq}`);
  }

  /* ---------- derived numbers ---------- */

  const change24 = (t) => {
    const cutoff = Date.now() - 86400e3;
    const base = t.history.find((h) => h.t >= cutoff) || t.history[0];
    const ref = t.history.filter((h) => h.t < cutoff).pop() || base;
    return ((price(t) - ref.p) / ref.p) * 100;
  };
  const vol = (t, ms) => t.trades.filter((tr) => tr.t >= Date.now() - ms).reduce((s, tr) => s + tr.sol, 0);
  const heat = (t) => vol(t, 3600e3) * 3 + vol(t, 6 * 3600e3) + (t.graduated ? -50 : 0) + Math.max(0, 6 - (Date.now() - t.createdAt) / 3600e3);

  /* ---------- wallet ---------- */

  const walletBtn = $('#wallet-btn');
  const walletPop = $('#wallet-pop');

  function connect() {
    if (!state.wallet) {
      state.wallet = { addr: newAddr(), sol: START_SOL };
      toast(`Demo wallet connected with <b>${START_SOL} SOL</b> of play money.`);
      save();
    }
    renderWallet();
    return state.wallet;
  }

  function renderWallet() {
    const w = state.wallet;
    walletBtn.innerHTML = w
      ? `<span class="lp-wallet-dot"></span><span class="lp-mono">${sol(w.sol)}</span><span class="lp-wallet-addr">${short(w.addr)}</span>`
      : 'Connect <span class="lp-hide-sm">demo wallet</span>';
    walletBtn.classList.toggle('is-on', !!w);
    if (!w) { walletPop.hidden = true; return; }
    const holds = state.tokens.map((t) => ({ t, n: t.holders[w.addr] || 0 })).filter((h) => h.n > 0);
    const value = holds.reduce((s, h) => s + h.n * price(h.t), 0);
    $('#wp-addr').textContent = short(w.addr);
    $('#wp-sol').textContent = sol(w.sol);
    $('#wp-value').textContent = `${sol(value)} in coins · ${usd((w.sol + value) * SOL_USD)} total`;
    $('#wp-holds').innerHTML = holds.length
      ? holds.map((h) => `<li><button type="button" data-open="${h.t.id}"><span class="lp-hold-art">${art(h.t.art)}</span><b>$${esc(h.t.ticker)}</b><span class="lp-mono">${tokens(h.n)}</span><span class="lp-mono lp-dim">${sol(h.n * price(h.t))}</span></button></li>`).join('')
      : '<li class="lp-empty-line">No coins yet. Buy one or launch your own.</li>';
  }

  walletBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!state.wallet) { connect(); return; }
    walletPop.hidden = !walletPop.hidden;
    walletBtn.setAttribute('aria-expanded', String(!walletPop.hidden));
    if (!walletPop.hidden) renderWallet();
  });
  document.addEventListener('click', (e) => {
    if (!walletPop.hidden && !e.target.closest('#wallet-pop, #wallet-btn')) { walletPop.hidden = true; walletBtn.setAttribute('aria-expanded', 'false'); }
  });
  $('#wp-topup').addEventListener('click', () => { state.wallet.sol += START_SOL; renderWallet(); save(); toast(`Added <b>${START_SOL} SOL</b> of play money.`); });
  $('#wp-disconnect').addEventListener('click', () => { state.wallet = null; walletPop.hidden = true; renderWallet(); save(); });
  $('#wp-reset').addEventListener('click', () => {
    store.clear();
    state = seedState();
    walletPop.hidden = true;
    renderAll();
    toast('Demo data reset.');
  });

  /* ---------- toast ---------- */

  const toastEl = $('#toast');
  let toastTimer;
  function toast(html) {
    toastEl.innerHTML = html;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), 3200);
  }

  /* ---------- tape, stats, king ---------- */

  function renderTape() {
    const items = tape.slice(0, 16).map((tr) =>
      `<button type="button" class="lp-tape-item is-${tr.side}" data-open="${tr.id}"><span class="lp-mono">${short(tr.who)}</span> ${tr.side === 'buy' ? 'bought' : 'sold'} <b class="lp-mono">${sol(tr.sol)}</b> of <b>$${esc(tr.ticker)}</b></button>`).join('');
    $('#tape').innerHTML = `<div class="lp-tape-run">${items}${items}</div>`;
  }

  function renderStats() {
    const day = state.tokens.reduce((s, t) => s + vol(t, 86400e3), 0);
    $('#st-coins').textContent = state.tokens.length;
    $('#st-vol').textContent = usd(day * SOL_USD);
    $('#st-grad').textContent = state.tokens.filter((t) => t.graduated).length;
  }

  function renderKing() {
    const king = [...state.tokens].filter((t) => !t.graduated).sort((a, b) => mcap(b) - mcap(a))[0];
    if (!king) return;
    const box = $('#king');
    box.dataset.open = king.id;
    box.innerHTML = `
      <div class="lp-king-crown">King of the pot</div>
      <div class="lp-king-art">${art(king.art)}</div>
      <div class="lp-king-body">
        <div class="lp-king-name"><h2>${esc(king.name)}</h2><span class="lp-ticker">$${esc(king.ticker)}</span></div>
        <p>${esc(king.desc)}</p>
        <div class="lp-king-row">
          <span><small>Market cap</small><b class="lp-mono">${usd(mcap(king))}</b></span>
          <span><small>24h</small><b class="lp-mono ${change24(king) >= 0 ? 'lp-up' : 'lp-down'}">${pct(change24(king))}</b></span>
          <span><small>Curve</small><b class="lp-mono">${(progress(king) * 100).toFixed(1)}%</b></span>
        </div>
        <div class="lp-bar"><i style="width:${progress(king) * 100}%"></i></div>
      </div>`;
  }

  /* ---------- grid ---------- */

  let sortMode = 'trending';
  let region = 'all';
  let query = '';

  const cardHTML = (t) => {
    const ch = change24(t);
    return `
      <article class="lp-card${t.graduated ? ' is-grad' : ''}" data-id="${t.id}" data-open="${t.id}" tabindex="0" role="button" aria-label="Open ${esc(t.name)}">
        <div class="lp-card-art">${art(t.art)}</div>
        <div class="lp-card-body">
          <div class="lp-card-top">
            <h3>${esc(t.name)}</h3>
            <span class="lp-ticker">$${esc(t.ticker)}</span>
          </div>
          <p class="lp-card-by">by <span class="lp-mono">${short(t.creator)}</span> · <span data-f="age">${ago(t.createdAt)}</span> · ${esc(t.region)}</p>
          <p class="lp-card-desc">${esc(t.desc)}</p>
          <div class="lp-card-stats">
            <span class="lp-mono"><small>MC</small> <b data-f="mc">${usd(mcap(t))}</b></span>
            <span class="lp-mono lp-chip ${ch >= 0 ? 'lp-up' : 'lp-down'}" data-f="ch">${pct(ch)}</span>
            <span class="lp-card-replies"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/></svg> <span data-f="rep">${t.replies.length}</span></span>
          </div>
          ${t.graduated
            ? '<div class="lp-grad-tag">Graduated · curve complete</div>'
            : `<div class="lp-bar lp-bar-sm"><i data-f="bar" style="width:${progress(t) * 100}%"></i></div><p class="lp-card-curve"><span data-f="pr">${(progress(t) * 100).toFixed(1)}%</span> of the curve</p>`}
        </div>
      </article>`;
  };

  function visibleTokens() {
    let list = state.tokens.filter((t) => (region === 'all' || t.region === region)
      && (!query || `${t.name} ${t.ticker} ${t.region}`.toLowerCase().includes(query)));
    if (sortMode === 'graduated') list = list.filter((t) => t.graduated);
    if (sortMode === 'near') list = list.filter((t) => !t.graduated);
    const key = {
      trending: (t) => heat(t), new: (t) => t.createdAt, mcap: (t) => mcap(t),
      near: (t) => progress(t), graduated: (t) => t.graduatedAt || 0,
    }[sortMode];
    return list.sort((a, b) => key(b) - key(a));
  }

  function renderGrid() {
    const list = visibleTokens();
    $('#grid').innerHTML = list.length ? list.map(cardHTML).join('')
      : `<div class="lp-empty"><div class="lp-empty-art">${art('stick:fufu')}</div><p><b>Nothing on the stove here.</b><br>Try another filter, or launch the first coin for this dish.</p><button class="lp-btn lp-btn-gold" type="button" data-create>Launch a coin</button></div>`;
    $('#grid-count').textContent = `${list.length} coin${list.length === 1 ? '' : 's'}`;
  }

  function updateCard(t, side) {
    const card = $(`.lp-card[data-id="${t.id}"]`);
    if (!card) return;
    const ch = change24(t);
    const set = (f, v) => { const el = $(`[data-f="${f}"]`, card); if (el) el.textContent = v; };
    set('mc', usd(mcap(t)));
    set('rep', t.replies.length);
    set('pr', `${(progress(t) * 100).toFixed(1)}%`);
    const chEl = $('[data-f="ch"]', card);
    if (chEl) { chEl.textContent = pct(ch); chEl.className = `lp-mono lp-chip ${ch >= 0 ? 'lp-up' : 'lp-down'}`; }
    const bar = $('[data-f="bar"]', card);
    if (bar) bar.style.width = `${progress(t) * 100}%`;
    if (t.graduated && !card.classList.contains('is-grad')) card.outerHTML = cardHTML(t);
    else if (side) {
      card.classList.remove('flash-buy', 'flash-sell');
      void card.offsetWidth;
      card.classList.add(`flash-${side}`);
    }
  }

  $$('.lp-sort').forEach((b) => b.addEventListener('click', () => {
    sortMode = b.dataset.sort;
    $$('.lp-sort').forEach((x) => { x.classList.toggle('is-active', x === b); x.setAttribute('aria-pressed', String(x === b)); });
    renderGrid();
  }));
  $('#regions').innerHTML = ['all', ...REGIONS].map((r) =>
    `<button type="button" class="lp-region${r === 'all' ? ' is-active' : ''}" data-region="${esc(r)}">${r === 'all' ? 'All regions' : esc(r)}</button>`).join('');
  $('#regions').addEventListener('click', (e) => {
    const b = e.target.closest('[data-region]');
    if (!b) return;
    region = b.dataset.region;
    $$('.lp-region').forEach((x) => x.classList.toggle('is-active', x === b));
    renderGrid();
  });
  $('#search').addEventListener('input', (e) => { query = e.target.value.trim().toLowerCase(); renderGrid(); });

  /* ---------- coin detail ---------- */

  const detail = $('#detail');
  let openId = null;
  let tradeSide = 'buy';

  function openToken(id) {
    const t = byId(id);
    if (!t) return;
    openId = id;
    tradeSide = 'buy';
    $('#d-amount').value = '';
    if (!detail.open) detail.showModal();
    renderDetail(true);
  }

  detail.addEventListener('close', () => { openId = null; });
  $('#d-close').addEventListener('click', () => detail.close());
  detail.addEventListener('click', (e) => { if (e.target === detail) detail.close(); });

  function renderDetail(full = false) {
    const t = byId(openId);
    if (!t) return;
    const w = state.wallet;
    const ch = change24(t);
    if (full) {
      $('#d-art').innerHTML = art(t.art);
      $('#d-name').textContent = t.name;
      $('#d-ticker').textContent = `$${t.ticker}`;
      $('#d-by').innerHTML = `by <span class="lp-mono">${short(t.creator)}</span>${w && t.creator === w.addr ? ' (you)' : ''} · launched ${ago(t.createdAt)} · paired with ${esc((DISHES.find((d) => d.art === t.art) || {}).name || 'a dish')} · ${esc(t.region)}`;
      $('#d-desc').textContent = t.desc;
    }
    $('#d-mc').textContent = usd(mcap(t));
    $('#d-price').textContent = `$${(price(t) * SOL_USD).toPrecision(3)}`;
    const chEl = $('#d-ch');
    chEl.textContent = pct(ch);
    chEl.className = `lp-mono ${ch >= 0 ? 'lp-up' : 'lp-down'}`;
    $('#d-vol').textContent = usd(vol(t, 86400e3) * SOL_USD);

    const pr = progress(t);
    $('#d-bar').style.width = `${pr * 100}%`;
    $('#d-curve').innerHTML = t.graduated
      ? `<b>Curve complete.</b> ${esc(t.ticker)} raised ${GRAD_SOL} SOL and graduated at ${usd(GRAD_MCAP)}. On a live launchpad its liquidity would now move to a DEX; here trading on the curve is closed.`
      : `<b>${(pr * 100).toFixed(1)}%</b> of the bonding curve. ${sol(GRAD_SOL - t.realSol)} more to graduate at a ${usd(GRAD_MCAP)} market cap. ${sol(t.realSol)} is in the curve.`;

    // trade panel
    const held = w ? t.holders[w.addr] || 0 : 0;
    $$('.lp-side').forEach((b) => b.classList.toggle('is-active', b.dataset.side === tradeSide));
    $('#d-trade').classList.toggle('is-sell', tradeSide === 'sell');
    $('#d-unit').textContent = tradeSide === 'buy' ? 'SOL' : `$${t.ticker}`;
    $('#d-quick').innerHTML = (tradeSide === 'buy' ? ['0.1', '0.5', '1', '2'] : ['25%', '50%', '75%', '100%'])
      .map((q) => `<button type="button" data-quick="${q}">${tradeSide === 'buy' ? `${q} SOL` : q}</button>`).join('');
    $('#d-bal').textContent = w
      ? (tradeSide === 'buy' ? `Balance ${sol(w.sol)}` : `You hold ${tokens(held)} $${t.ticker}`)
      : 'Connect the demo wallet to trade';
    $('#d-submit').textContent = !w ? 'Connect demo wallet' : t.graduated ? 'Curve complete' : tradeSide === 'buy' ? `Buy $${t.ticker}` : `Sell $${t.ticker}`;
    $('#d-submit').disabled = !!(w && t.graduated);
    estimate();

    // holders
    const entries = Object.entries(t.holders).sort((a, b) => b[1] - a[1]);
    const curveHeld = TOTAL - entries.reduce((s, [, n]) => s + n, 0);
    const rows = [[t.graduated ? 'Liquidity pool' : 'Bonding curve', curveHeld, true], ...entries.slice(0, 9).map(([a, n]) => [a, n, false])];
    $('#d-holders').innerHTML = rows.map(([a, n, pool], i) => `
      <li><span class="lp-mono lp-dim">${i + 1}.</span><span class="lp-mono">${pool ? a : short(a)}${!pool && a === t.creator ? ' <em>dev</em>' : ''}${!pool && w && a === w.addr ? ' <em>you</em>' : ''}</span><span class="lp-mono">${((n / TOTAL) * 100).toFixed(2)}%</span></li>`).join('');
    $('#d-holders-n').textContent = `${entries.length} holders`;

    // trades and thread
    $('#d-trades').innerHTML = t.trades.slice(0, 30).map((tr) => `
      <tr class="is-${tr.side}"><td class="lp-mono">${short(tr.who)}${w && tr.who === w.addr ? ' <em>you</em>' : ''}</td><td>${tr.side}</td><td class="lp-mono">${sol(tr.sol)}</td><td class="lp-mono">${tokens(tr.tok)}</td><td class="lp-dim">${ago(tr.t)}</td></tr>`).join('');
    $('#d-thread').innerHTML = t.replies.length ? t.replies.map((r) => `
      <li><div class="lp-reply-head"><span class="lp-mono">${short(r.who)}</span>${w && r.who === w.addr ? ' <em>you</em>' : ''}<span class="lp-dim">${ago(r.t)}</span></div><p>${esc(r.text)}</p></li>`).join('')
      : '<li class="lp-empty-line">No replies yet. Say something nice about the dish.</li>';
    $('#d-thread-n').textContent = t.replies.length;
    drawChart();
  }

  $$('.lp-side').forEach((b) => b.addEventListener('click', () => { tradeSide = b.dataset.side; $('#d-amount').value = ''; renderDetail(); }));

  $('#d-quick').addEventListener('click', (e) => {
    const q = e.target.closest('[data-quick]');
    if (!q) return;
    const t = byId(openId);
    const w = state.wallet;
    if (tradeSide === 'buy') $('#d-amount').value = q.dataset.quick;
    else {
      const held = w ? t.holders[w.addr] || 0 : 0;
      $('#d-amount').value = Math.floor(held * parseFloat(q.dataset.quick) / 100);
    }
    estimate();
  });
  $('#d-amount').addEventListener('input', estimate);

  function estimate() {
    const t = byId(openId);
    const out = $('#d-est');
    const amt = parseFloat($('#d-amount').value);
    if (!t || !(amt > 0)) { out.textContent = tradeSide === 'buy' ? 'Enter an amount of SOL' : 'Enter an amount of tokens'; return; }
    if (tradeSide === 'buy') {
      const q = quoteBuy(t, amt);
      const impact = q.out ? ((q.s / q.out) / price(t) - 1) * 100 : 0;
      out.innerHTML = q.out
        ? `You receive ≈ <b class="lp-mono">${tokens(q.out)} $${esc(t.ticker)}</b> · ${((q.out / TOTAL) * 100).toFixed(2)}% of supply · impact ${impact.toFixed(1)}%${q.spent < amt - 1e-9 ? ` · only ${sol(q.spent)} fits before graduation` : ''}`
        : 'The curve is complete.';
    } else {
      const q = quoteSell(t, amt);
      out.innerHTML = `You receive ≈ <b class="lp-mono">${sol(q.out)}</b> after the 1% fee`;
    }
  }

  $('#d-trade').addEventListener('submit', (e) => {
    e.preventDefault();
    const t = byId(openId);
    if (!state.wallet) { connect(); renderDetail(); return; }
    const w = state.wallet;
    const amt = parseFloat($('#d-amount').value);
    const msg = $('#d-msg');
    msg.textContent = '';
    if (!(amt > 0)) { msg.textContent = 'Enter an amount first.'; return; }
    if (tradeSide === 'buy') {
      if (amt > w.sol) { msg.textContent = `You only have ${sol(w.sol)}. Top up the demo wallet from the wallet menu.`; return; }
      const spent = buy(t, w.addr, amt);
      if (!spent) { msg.textContent = 'This curve is complete.'; return; }
      w.sol -= spent;
      toast(`Bought <b>$${esc(t.ticker)}</b> for ${sol(spent)}.${t.graduated ? ' Your buy completed the curve. It graduated!' : ''}`);
    } else {
      const held = t.holders[w.addr] || 0;
      if (amt > held + 1e-6) { msg.textContent = `You hold ${tokens(held)} $${t.ticker}.`; return; }
      const got = sell(t, w.addr, amt);
      w.sol += got;
      toast(`Sold ${tokens(amt)} <b>$${esc(t.ticker)}</b> for ${sol(got)}.`);
    }
    $('#d-amount').value = '';
    afterTrade(t, tradeSide);
  });

  $('#d-reply').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#d-reply-text');
    const text = input.value.trim();
    if (!text) return;
    const w = connect();
    byId(openId).replies.unshift({ who: w.addr, text: text.slice(0, 280), t: Date.now() });
    input.value = '';
    renderDetail();
    updateCard(byId(openId));
    save();
  });

  /* ---------- chart: candles from the price history ---------- */

  function drawChart() {
    const canvas = $('#d-chart');
    const t = byId(openId);
    if (!canvas || !t || !detail.open) return;
    const css = getComputedStyle(document.documentElement);
    const C = (v) => css.getPropertyValue(v).trim();
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const pad = { l: 8, r: 64, t: 14, b: 22 };
    const n = Math.max(24, Math.min(60, Math.floor((W - pad.l - pad.r) / 11)));
    const t0 = t.history[0].t, t1 = Math.max(Date.now(), t0 + 60e3);
    const step = (t1 - t0) / n;
    const candles = [];
    let last = t.history[0].p, hi = 0;
    for (let i = 0; i < n; i++) {
      const a = t0 + i * step, b = a + step;
      const pts = t.history.filter((h) => h.t >= a && h.t < b).map((h) => h.p);
      const o = last, c = pts.length ? pts[pts.length - 1] : last;
      candles.push({ o, c, h: Math.max(o, c, ...pts), l: Math.min(o, c, ...pts) });
      last = c;
    }
    const toM = (p) => p * TOTAL * SOL_USD;
    let lo = Infinity; hi = -Infinity;
    candles.forEach((k) => { lo = Math.min(lo, toM(k.l)); hi = Math.max(hi, toM(k.h)); });
    if (hi - lo < 1) { hi += 50; lo -= 50; }
    const padY = (hi - lo) * .08; hi += padY; lo = Math.max(0, lo - padY);
    const y = (m) => pad.t + (1 - (m - lo) / (hi - lo)) * (H - pad.t - pad.b);

    // grid and market-cap axis
    ctx.font = '11px "JetBrains Mono", ui-monospace, monospace';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 4; i++) {
      const m = lo + ((hi - lo) * i) / 4, yy = y(m);
      ctx.strokeStyle = C('--line'); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pad.l, Math.round(yy) + .5); ctx.lineTo(W - pad.r, Math.round(yy) + .5); ctx.stroke();
      ctx.fillStyle = C('--muted'); ctx.fillText(usd(m), W - pad.r + 8, yy);
    }
    // candles
    const cw = (W - pad.l - pad.r) / n;
    candles.forEach((k, i) => {
      const up = k.c >= k.o;
      ctx.strokeStyle = ctx.fillStyle = up ? C('--up') : C('--down');
      const x = pad.l + i * cw + cw / 2;
      ctx.beginPath(); ctx.moveTo(Math.round(x) + .5, y(toM(k.h))); ctx.lineTo(Math.round(x) + .5, y(toM(k.l))); ctx.stroke();
      const top = y(toM(Math.max(k.o, k.c))), bot = y(toM(Math.min(k.o, k.c)));
      ctx.fillRect(x - cw * .32, top, cw * .64, Math.max(1.5, bot - top));
    });
    // last price line
    const lm = toM(price(t)), ly = y(lm);
    ctx.setLineDash([4, 4]); ctx.strokeStyle = C('--gold-ink');
    ctx.beginPath(); ctx.moveTo(pad.l, ly); ctx.lineTo(W - pad.r, ly); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = C('--gold'); ctx.fillRect(W - pad.r + 2, ly - 9, pad.r - 4, 18);
    ctx.fillStyle = '#1B120C'; ctx.fillText(usd(lm), W - pad.r + 8, ly);
    // time labels
    ctx.fillStyle = C('--muted'); ctx.textBaseline = 'alphabetic';
    ctx.fillText(ago(t0).replace(' ago', ''), pad.l, H - 6);
    ctx.textAlign = 'right'; ctx.fillText('now', W - pad.r, H - 6); ctx.textAlign = 'left';
  }
  window.addEventListener('resize', () => drawChart());

  /* ---------- launch a coin ---------- */

  const create = $('#create');
  const form = $('#create-form');
  $('#c-dishes').innerHTML = DISHES.map((d, i) => `
    <label class="lp-dish"><input type="radio" name="dish" value="${i}"${i === 0 ? ' checked' : ''}><span><span class="lp-dish-art">${art(d.art)}</span><b>${esc(d.name)}</b><small>${esc(d.region)}</small></span></label>`).join('');
  $('#c-region').innerHTML = REGIONS.map((r) => `<option>${esc(r)}</option>`).join('');

  function openCreate() {
    form.reset();
    $('#c-region').value = DISHES[0].region;
    $('#c-msg').textContent = '';
    previewCreate();
    create.showModal();
    $('#c-name').focus();
  }
  document.addEventListener('click', (e) => { if (e.target.closest('[data-create]')) { e.preventDefault(); openCreate(); } });
  $('#c-close').addEventListener('click', () => create.close());
  create.addEventListener('click', (e) => { if (e.target === create) create.close(); });

  form.addEventListener('change', (e) => {
    if (e.target.name === 'dish') $('#c-region').value = DISHES[+e.target.value].region;
    previewCreate();
  });
  form.addEventListener('input', (e) => {
    if (e.target.id === 'c-ticker') e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
    previewCreate();
  });

  function previewCreate() {
    const d = DISHES[+form.elements.dish.value];
    const name = $('#c-name').value.trim() || 'Your coin';
    const ticker = $('#c-ticker').value || 'TICKER';
    const initial = parseFloat($('#c-buy').value) || 0;
    const fake = makeToken({ ticker, name, art: d.art, region: $('#c-region').value, desc: '', creator: '', createdAt: Date.now() });
    const q = quoteBuy(fake, initial);
    $('#c-preview').innerHTML = `
      <div class="lp-preview-art">${art(d.art)}</div>
      <div><b>${esc(name)}</b> <span class="lp-ticker">$${esc(ticker)}</span><p class="lp-dim">Paired with ${esc(d.name)} · ${esc($('#c-region').value)}</p></div>`;
    $('#c-cost').innerHTML = `Launch fee <b class="lp-mono">${sol(CREATE_FEE)}</b>${initial > 0 ? ` + first buy <b class="lp-mono">${sol(initial)}</b> → you get ≈ <b class="lp-mono">${tokens(q.out)}</b> (${((q.out / TOTAL) * 100).toFixed(2)}% of supply)` : ''}. Starts at a ${usd(V_SOL0 / V_TOK0 * TOTAL * SOL_USD)} market cap.`;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const msg = $('#c-msg');
    const name = $('#c-name').value.trim();
    const ticker = $('#c-ticker').value.trim();
    const desc = $('#c-desc').value.trim();
    const initial = parseFloat($('#c-buy').value) || 0;
    if (name.length < 2) { msg.textContent = 'Give the coin a name of at least 2 characters.'; $('#c-name').focus(); return; }
    if (ticker.length < 2) { msg.textContent = 'The ticker needs 2 to 10 letters or numbers.'; $('#c-ticker').focus(); return; }
    if (state.tokens.some((t) => t.ticker === ticker)) { msg.textContent = `$${ticker} is taken. Pick another ticker.`; $('#c-ticker').focus(); return; }
    if (initial < 0 || initial > 20) { msg.textContent = 'The first buy can be between 0 and 20 SOL.'; return; }
    const w = connect();
    if (w.sol < CREATE_FEE + initial) { msg.textContent = `You need ${sol(CREATE_FEE + initial)} and have ${sol(w.sol)}. Top up from the wallet menu.`; return; }
    const d = DISHES[+form.elements.dish.value];
    const t = makeToken({ ticker, name, art: d.art, region: $('#c-region').value, desc: desc || `A coin paired with ${d.name}.`, creator: w.addr, createdAt: Date.now() });
    w.sol -= CREATE_FEE;
    state.tokens.unshift(t);
    state.launched = (state.launched || 0) + 1;
    if (initial > 0) w.sol -= buy(t, w.addr, initial);
    create.close();
    sortMode = 'new';
    $$('.lp-sort').forEach((x) => { x.classList.toggle('is-active', x.dataset.sort === 'new'); x.setAttribute('aria-pressed', String(x.dataset.sort === 'new')); });
    renderAll();
    save();
    toast(`<b>$${esc(ticker)}</b> is live on the curve.`);
    openToken(t.id);
  });

  /* ---------- open a coin from anywhere ---------- */

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-open]');
    if (!el || e.target.closest('[data-create]')) return;
    walletPop.hidden = true;
    openToken(el.dataset.open);
  });
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-open][role="button"]')) { e.preventDefault(); openToken(e.target.dataset.open); }
  });

  /* ---------- other traders (bots) ---------- */

  function afterTrade(t, side) {
    updateCard(t, side);
    renderTape();
    renderStats();
    renderKing();
    renderWallet();
    if (openId === t.id) renderDetail();
    save();
  }

  function botTick() {
    if (document.hidden) return;
    const live = state.tokens.filter((x) => !x.graduated);
    if (!live.length) return;
    // hotter coins trade more often
    const weights = live.map((x) => 1 + heat(x));
    let r = Math.random() * weights.reduce((a, b) => a + b, 0);
    const t = live.find((x, i) => (r -= weights[i]) <= 0) || live[0];
    const holders = Object.keys(t.holders).filter((a) => !state.wallet || a !== state.wallet.addr);
    const side = holders.length && Math.random() < .3 ? 'sell' : 'buy';
    if (side === 'buy') buy(t, pick(BOTS), clamp(expo(.45), .02, 3));
    else { const a = pick(holders); sell(t, a, t.holders[a] * (.2 + Math.random() * .8)); }
    if (Math.random() < .06) t.replies.unshift({ who: pick(BOTS), text: pick(REPLIES), t: Date.now() });
    afterTrade(t, side);
  }

  function botLaunch() {
    if (document.hidden || state.tokens.length >= 40) return;
    const fresh = BOT_LAUNCHES.filter(([tk]) => !state.tokens.some((t) => t.ticker === tk));
    if (!fresh.length) return;
    const [ticker, name, a, reg, desc] = pick(fresh);
    const t = makeToken({ ticker, name, art: a, region: reg, desc, creator: pick(BOTS), createdAt: Date.now() });
    buy(t, t.creator, clamp(expo(.8), .1, 2));
    state.tokens.push(t);
    tape.unshift({ side: 'buy', who: t.creator, sol: t.trades[0].sol, tok: t.trades[0].tok, t: Date.now(), ticker: t.ticker, id: t.id });
    renderGrid(); renderTape(); renderStats();
    save();
  }

  /* ---------- boot ---------- */

  function renderAll() {
    renderWallet();
    renderTape();
    renderStats();
    renderKing();
    renderGrid();
  }

  renderAll();
  paintTheme();
  $('#grad-mcap').textContent = usd(GRAD_MCAP);
  $('#grad-sol').textContent = `${GRAD_SOL} SOL`;
  $('#start-mcap').textContent = usd(V_SOL0 / V_TOK0 * TOTAL * SOL_USD);
  $('#hero-stick').innerHTML = art('stick:fufu');

  setInterval(botTick, 2400);
  setInterval(botLaunch, 50000);
  setInterval(() => {
    $$('.lp-card [data-f="age"]').forEach((el) => {
      const t = byId(el.closest('.lp-card').dataset.id);
      if (t) el.textContent = ago(t.createdAt);
    });
  }, 30000);
})();
