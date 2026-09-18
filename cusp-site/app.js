/* Cusp — vault list, deposit drawer, theme, menu.
   VAULTS below is the only source of truth for the list: every row, every
   figure and everything in the deposit drawer is derived from it. All of it is
   sample data for a design mock. */

const VAULTS = [
  { t: 'NVDA',  name: 'NVIDIA',            apr: 31.4, tvl: 9_820_000, price: 182.44, chg:  1.82, fees24: 8_450, state: 'range',       cap: 12_000_000, tier: 0.30, band: 2.4, reb: '3h ago',  depositors: 1_284, age: 118 },
  { t: 'TSLA',  name: 'Tesla',             apr: 27.8, tvl: 7_140_000, price: 271.06, chg: -2.35, fees24: 5_430, state: 'rebalancing', cap: 10_000_000, tier: 0.30, band: 3.1, reb: 'queued',  depositors:   962, age: 118 },
  { t: 'HOOD',  name: 'Robinhood Markets', apr: 24.6, tvl: 5_960_000, price:  96.18, chg:  0.94, fees24: 4_010, state: 'range',       cap:  8_000_000, tier: 0.30, band: 2.8, reb: '11h ago', depositors:   871, age: 118 },
  { t: 'COIN',  name: 'Coinbase Global',   apr: 22.1, tvl: 4_380_000, price: 318.72, chg: -1.12, fees24: 2_650, state: 'range',       cap:  8_000_000, tier: 0.30, band: 3.0, reb: '6h ago',  depositors:   604, age:  96 },
  { t: 'AAPL',  name: 'Apple',             apr: 17.9, tvl: 6_510_000, price: 241.35, chg:  0.41, fees24: 3_190, state: 'range',       cap: 10_000_000, tier: 0.30, band: 1.8, reb: '19h ago', depositors: 1_146, age: 118 },
  { t: 'MSFT',  name: 'Microsoft',         apr: 16.2, tvl: 5_240_000, price: 512.90, chg:  0.28, fees24: 2_320, state: 'range',       cap:  9_000_000, tier: 0.30, band: 1.6, reb: '1d ago',  depositors:   803, age: 118 },
  { t: 'AMZN',  name: 'Amazon',            apr: 15.4, tvl: 3_870_000, price: 229.61, chg: -0.62, fees24: 1_630, state: 'range',       cap:  8_000_000, tier: 0.30, band: 1.9, reb: '14h ago', depositors:   517, age:  74 },
  { t: 'META',  name: 'Meta Platforms',    apr: 14.1, tvl: 2_940_000, price: 648.20, chg:  1.06, fees24: 1_140, state: 'range',       cap:  6_000_000, tier: 0.30, band: 2.2, reb: '9h ago',  depositors:   398, age:  74 },
  { t: 'GOOGL', name: 'Alphabet',          apr: 12.7, tvl: 2_110_000, price: 204.88, chg:  0.17, fees24:   735, state: 'range',       cap:  6_000_000, tier: 0.30, band: 1.7, reb: '2d ago',  depositors:   276, age:  21 },
  { t: 'PLTR',  name: 'Palantir',          apr:  0.0, tvl:   650_000, price: 174.05, chg: -4.08, fees24:     0, state: 'paused',      cap:  4_000_000, tier: 0.30, band: 4.0, reb: 'halted',  depositors:    88, age:  12 },
];

// the share price a vault would have after its life at its own APR — it is what
// turns a USDG amount into shares and back again
VAULTS.forEach(v => { v.px = +(1 + (v.apr / 100) * (v.age / 365)).toFixed(4); });

const STATE_TEXT = { range: 'In range', rebalancing: 'Rebalancing', paused: 'Paused' };

/* ---------- formatting ---------- */

const usd = n =>
  n >= 1e6 ? '$' + (n / 1e6).toFixed(2) + 'M'
  : n >= 1e3 ? '$' + Math.round(n / 1e3) + 'K'
  : '$' + n.toFixed(0);

// your own balances, to the cent under $1,000 and to the dollar above it
const dollars = n => '$' + n.toLocaleString('en-US', {
  minimumFractionDigits: n < 1000 ? 2 : 0, maximumFractionDigits: n < 1000 ? 2 : 0,
});

const money = n => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = n => n.toFixed(1) + '%';
const addr = t => '0x' + [...('cusp' + t)].map(c => c.charCodeAt(0).toString(16)).join('') + 'a41d';

/* ---------- the demo wallet ----------
   The storage, the address and the balances live in wallet.js, which the swap
   page shares. What is here is the vault side of it: the positions, and the TVL
   they add to. */

const START_USDG = SEED_USDG;

const held = t => (wallet && wallet.pos[t]) || 0;
const valueOf = v => held(v.t) * v.px;
const deposited = () => VAULTS.reduce((n, v) => n + valueOf(v), 0);

function load() {
  if (!walletLoad()) return;
  // the positions are the saved half; the TVL they sit in is rebuilt from them
  for (const [t, sh] of Object.entries(wallet.pos)) {
    const v = VAULTS.find(x => x.t === t);
    if (!v || !(sh > 0)) { delete wallet.pos[t]; continue; }
    v.tvl += sh * v.px;
    v.depositors += 1;
  }
}

const save = walletSave;

function connect() {
  walletConnect();
  paint();
  toast('Demo wallet connected with ' + money(SEED_USDG) + ' USDG of play money.');
}

function disconnect() {
  for (const [t, sh] of Object.entries(wallet ? wallet.pos : {})) {
    const v = VAULTS.find(x => x.t === t);
    if (v) { v.tvl -= sh * v.px; v.depositors -= 1; }
  }
  walletForget();
  closeDrawer();
  paint();
  toast('Disconnected. The demo wallet is gone.');
}

/* ---------- moving money ---------- */

function depositInto(v, amt) {
  if (!wallet) return toast('Connect the demo wallet first.');
  if (v.state === 'paused') return toast('Deposits into this vault are paused.');
  if (!(amt > 0)) return toast('Enter an amount above zero.');
  if (amt > wallet.usdg) return toast('That is more than the ' + money(wallet.usdg) + ' in the wallet.');
  const room = v.cap - v.tvl;
  if (amt > room) return toast('Only ' + usd(room) + ' left under this vault\'s cap.');

  if (!held(v.t)) v.depositors += 1;
  wallet.usdg -= amt;
  wallet.pos[v.t] = held(v.t) + amt / v.px;
  v.tvl += amt;
  save(); paint();
  toast('Deposited ' + money(amt) + ' into USDG / x' + v.t + '.');
}

const DUST = 1e-4;   // Max is a rounded string, so anything under this is all of it

function withdrawFrom(v, shares, quiet) {
  if (!wallet) return;
  const have = held(v.t);
  if (!(shares > 0)) return toast('Enter an amount above zero.');
  let sh = Math.min(shares, have);
  if (have - sh < DUST) sh = have;
  const back = sh * v.px;
  wallet.usdg += back;
  v.tvl -= back;
  if (sh >= have) { delete wallet.pos[v.t]; v.depositors -= 1; }
  else wallet.pos[v.t] = have - sh;
  save(); paint();
  if (!quiet) toast('Redeemed ' + money(back) + ' from USDG / x' + v.t + '.');
}

function withdrawAll() {
  const ts = Object.keys(wallet ? wallet.pos : {});
  if (!ts.length) return;
  let back = 0;
  ts.forEach(t => {
    const v = VAULTS.find(x => x.t === t);
    back += held(t) * v.px;
    withdrawFrom(v, held(t), true);
  });
  closeDrawer();
  toast('Redeemed ' + money(back) + ' across ' + ts.length + ' vault' + (ts.length > 1 ? 's' : '') + '.');
}

/* ---------- list ---------- */

const rows = document.getElementById('rows');
const empty = document.getElementById('empty');
const q = document.getElementById('q');
const sort = document.getElementById('sort');
const chips = document.getElementById('chips');
let filter = 'all';

function matches(v) {
  const term = q.value.trim().toLowerCase();
  if (term && !(v.t + ' ' + v.name).toLowerCase().includes(term)) return false;
  if (filter === 'all') return true;
  if (filter === 'new') return v.age <= 30;
  return v.state === filter;
}

const mark = v => `
  <span class="cs-ticker" style="--brand:${LOGOS[v.t].c};--brand-dk:${LOGOS[v.t].d}">
    <svg viewBox="${LOGOS[v.t].vb}" aria-hidden="true"><path d="${LOGOS[v.t].p}"${LOGOS[v.t].evenodd ? ' fill-rule="evenodd"' : ''}/></svg>
  </span>`;

function actionFor(v) {
  if (held(v.t)) return `<button class="cs-btn cs-btn-line" data-open="${v.t}" type="button">Manage</button>`;
  if (v.state === 'paused') return `<button class="cs-btn cs-btn-line" type="button" disabled>Paused</button>`;
  return `<button class="cs-btn cs-btn-fill" data-open="${v.t}" type="button">Deposit</button>`;
}

function renderList() {
  const list = VAULTS.filter(matches).sort((a, b) => {
    switch (sort.value) {
      case 'tvl': return b.tvl - a.tvl;
      case 'fees': return b.fees24 - a.fees24;
      case 'name': return a.t.localeCompare(b.t);
      default: return b.apr - a.apr;
    }
  });

  const open = new Set([...rows.querySelectorAll('details[open]')].map(d => d.dataset.t));

  rows.innerHTML = list.map(v => {
    const used = Math.min(v.tvl / v.cap, 1);
    const low = v.price * (1 - v.band / 100);
    const high = v.price * (1 + v.band / 100);
    const mine = valueOf(v);
    return `
    <details class="cs-row" data-t="${v.t}"${open.has(v.t) ? ' open' : ''}>
      <summary>
        <div class="cs-vault">
          ${mark(v)}
          <span class="cs-vault-t">
            <b>USDG / x${v.t}</b>
            <span>${v.name} · ${v.tier.toFixed(2)}% pool${v.age <= 30 ? ' · new' : ''}</span>
          </span>
          ${mine ? `<span class="cs-held">${dollars(mine)}</span>` : ''}
        </div>
        <div class="cs-apr"><span class="cs-cell-k">Fee APR 24h</span>${v.state === 'paused' ? '—' : pct(v.apr)}</div>
        <div class="cs-num"><span class="cs-cell-k">TVL</span>${usd(v.tvl)}<i>${v.depositors.toLocaleString('en-US')} depositors</i></div>
        <div class="cs-num"><span class="cs-cell-k">Oracle price</span>${money(v.price)}<i style="color:${v.chg < 0 ? 'var(--down)' : 'var(--ok)'}">${v.chg > 0 ? '+' : ''}${v.chg.toFixed(2)}%</i></div>
        <div><span class="cs-cell-k">Range</span><span class="cs-state ${v.state}"><i></i>${STATE_TEXT[v.state]}</span></div>
        <div class="cs-cap">
          <span class="cs-cell-k">Capacity</span>
          <span class="cs-cap-bar"><span style="width:${(used * 100).toFixed(1)}%"></span></span>
          <span class="cs-cap-t">${usd(v.tvl)} / ${usd(v.cap)}</span>
        </div>
        <div class="cs-row-act">${actionFor(v)}</div>
      </summary>
      <div class="cs-detail">
        <div>
          <span class="cs-label">Position band</span>
          <b>${money(low)} — ${money(high)}</b>
          <p>±${v.band.toFixed(1)}% around the oracle price.</p>
        </div>
        <div>
          <span class="cs-label">${mine ? 'Your position' : 'Last rebalance'}</span>
          <b>${mine ? dollars(mine) : v.reb}</b>
          <p>${mine ? held(v.t).toFixed(4) + ' c' + v.t + ' at ' + money(v.px) + ' a share.' : 'Re-centred only against a fresh feed.'}</p>
        </div>
        <div>
          <span class="cs-label">Fees · 24h</span>
          <b>${usd(v.fees24)}</b>
          <p>70% compounded · 20% burned · 10% treasury.</p>
        </div>
        <div>
          <span class="cs-label">Vault contract</span>
          <b class="cs-addr">${addr(v.t)}</b>
          <p><button class="cs-linkbtn" data-copy="${addr(v.t)}" type="button">Copy address</button> · verified on Blockscout.</p>
        </div>
      </div>
    </details>`;
  }).join('');

  empty.hidden = list.length > 0;
}

/* ---------- the figures at the top, and your own positions ---------- */

function renderStats() {
  const live = VAULTS.filter(v => v.state !== 'paused');
  const aprs = live.map(v => v.apr).sort((a, b) => a - b);
  const mid = aprs.length % 2 ? aprs[(aprs.length - 1) / 2]
                              : (aprs[aprs.length / 2 - 1] + aprs[aprs.length / 2]) / 2;
  document.getElementById('k-tvl').textContent = usd(VAULTS.reduce((n, v) => n + v.tvl, 0));
  document.getElementById('k-fees').textContent = '$' + VAULTS.reduce((n, v) => n + v.fees24, 0).toLocaleString('en-US');
  document.getElementById('k-n').textContent = String(VAULTS.length);
  document.getElementById('k-n-sub').textContent =
    VAULTS.filter(v => v.state === 'range').length + ' in range · ' +
    VAULTS.filter(v => v.state === 'rebalancing').length + ' rebalancing';
  document.getElementById('k-apr').textContent = pct(mid);
}

const mine = document.getElementById('mine');
const mineRows = document.getElementById('mine-rows');

function renderMine() {
  const ts = Object.keys(wallet ? wallet.pos : {});
  mine.hidden = ts.length === 0;
  if (!ts.length) return;
  mineRows.innerHTML = ts.map(t => {
    const v = VAULTS.find(x => x.t === t);
    return `
      <div class="cs-mine-row">
        ${mark(v)}
        <span class="cs-mine-t"><b>USDG / x${v.t}</b><span>${held(t).toFixed(4)} c${v.t}</span></span>
        <span class="cs-mine-v">${dollars(valueOf(v))}</span>
        <span class="cs-mine-apr">${v.state === 'paused' ? '—' : pct(v.apr)}</span>
        <button class="cs-btn cs-btn-line" data-open="${v.t}" type="button">Manage</button>
      </div>`;
  }).join('');
}

/* ---------- wallet chrome ---------- */

const connectBtn = document.getElementById('connect');
const chip = document.getElementById('chip');
const pop = document.getElementById('pop');

function renderWallet() {
  const on = !!wallet;
  connectBtn.hidden = on;
  chip.hidden = !on;
  if (!on) { pop.hidden = true; return; }
  document.getElementById('chip-addr').textContent = shortAddr(wallet.addr);
  document.getElementById('chip-av').style.background =
    `linear-gradient(135deg, #${wallet.addr.slice(2, 8)}, #${wallet.addr.slice(-6)})`;
  document.getElementById('pop-usdg').textContent = money(wallet.usdg);
  document.getElementById('pop-dep').textContent = dollars(deposited());
  document.getElementById('pop-n').textContent = String(Object.keys(wallet.pos).length);
}

connectBtn.addEventListener('click', connect);
document.getElementById('chip-main').addEventListener('click', e => {
  e.stopPropagation();
  pop.hidden = !pop.hidden;
  e.currentTarget.setAttribute('aria-expanded', String(!pop.hidden));
});
document.getElementById('chip-copy').addEventListener('click', () => copy(wallet.addr, 'Address copied.'));
document.getElementById('pop-disc').addEventListener('click', disconnect);
document.getElementById('pop-reset').addEventListener('click', () => {
  disconnect();
  connect();
});
document.addEventListener('click', e => {
  if (!pop.hidden && !chip.contains(e.target)) pop.hidden = true;
});

/* ---------- the deposit / withdraw drawer ---------- */

const drawer = document.getElementById('drawer');
const scrim = document.getElementById('scrim');
const amount = document.getElementById('d-amount');
const seg = document.getElementById('d-seg');
const kv = document.getElementById('d-kv');
const go = document.getElementById('d-go');
let current = null;
let mode = 'deposit';

function drawerRow(k, v) { return `<div><dt>${k}</dt><dd>${v}</dd></div>`; }

function fillDrawer() {
  if (!current) return;
  const v = current;
  const n = Math.max(Number(amount.value) || 0, 0);
  const have = held(v.t);
  const room = Math.max(v.cap - v.tvl, 0);
  const pausedDeposit = v.state === 'paused';

  document.getElementById('d-field-k').textContent = mode === 'deposit' ? 'You deposit' : 'You redeem';
  document.getElementById('d-unit').textContent = mode === 'deposit' ? 'USDG' : 'c' + v.t;
  document.getElementById('d-avail').textContent = mode === 'deposit'
    ? (wallet ? money(wallet.usdg) + ' USDG in the wallet · ' + usd(room) + ' left under the cap'
              : 'No wallet connected yet')
    : (have ? have.toFixed(4) + ' c' + v.t + ' held · ' + dollars(have * v.px) : 'Nothing held in this vault');

  kv.innerHTML = mode === 'deposit'
    ? drawerRow('Swapped into the Stock Token', money(n / 2) + ' → x' + v.t)
      + drawerRow('Shares you receive', (n / v.px).toFixed(4) + ' c' + v.t)
      + drawerRow('Share price', money(v.px))
      + drawerRow('Fee APR · 24h', pausedDeposit ? '—' : pct(v.apr))
    : drawerRow('USDG you receive', money(n * v.px))
      + drawerRow('Share price', money(v.px))
      + drawerRow('Left in the vault after', Math.max(have - n, 0).toFixed(4) + ' c' + v.t)
      + drawerRow('Redemptions', 'Open, pause or not');

  if (!wallet) { go.disabled = true; go.textContent = 'Connect a wallet to ' + mode; return; }
  if (mode === 'deposit') {
    go.disabled = pausedDeposit || !(n > 0) || n > wallet.usdg || n > room;
    go.textContent = pausedDeposit ? 'Deposits are paused' : 'Deposit ' + money(n) + ' USDG';
  } else {
    go.disabled = !(n > 0) || n > have + 1e-9;
    go.textContent = 'Redeem ' + (n || 0).toFixed(4) + ' c' + v.t;
  }
}

function setMode(next) {
  mode = next;
  [...seg.children].forEach(b => b.classList.toggle('on', b.dataset.mode === next));
  const v = current;
  amount.value = next === 'deposit'
    ? Math.min(1000, wallet ? wallet.usdg : 1000)
    : (v ? +held(v.t).toFixed(4) : 0);
  amount.step = next === 'deposit' ? '100' : '0.0001';
  fillDrawer();
}

function openDrawer(ticker) {
  current = VAULTS.find(v => v.t === ticker);
  if (!current) return;
  document.getElementById('d-name').textContent = 'USDG / x' + current.t;
  setMode(held(current.t) && current.state === 'paused' ? 'withdraw' : 'deposit');
  drawer.classList.add('on');
  drawer.setAttribute('aria-hidden', 'false');
  scrim.hidden = false;
  amount.focus();
}

function closeDrawer() {
  drawer.classList.remove('on');
  drawer.setAttribute('aria-hidden', 'true');
  scrim.hidden = true;
}

seg.addEventListener('click', e => {
  const b = e.target.closest('button[data-mode]');
  if (b) setMode(b.dataset.mode);
});
document.getElementById('d-max').addEventListener('click', () => {
  if (!wallet || !current) return;
  amount.value = mode === 'deposit'
    ? +Math.min(wallet.usdg, Math.max(current.cap - current.tvl, 0)).toFixed(2)
    : +held(current.t).toFixed(4);
  fillDrawer();
});
go.addEventListener('click', () => {
  const n = Number(amount.value) || 0;
  if (mode === 'deposit') depositInto(current, n); else withdrawFrom(current, n);
  setMode(mode);
});
amount.addEventListener('input', fillDrawer);
scrim.addEventListener('click', closeDrawer);
document.getElementById('d-close').addEventListener('click', closeDrawer);
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeDrawer(); pop.hidden = true; } });

/* the buttons live inside a <summary>, so swallow the click before it toggles the row */
document.addEventListener('click', e => {
  const open = e.target.closest('button[data-open]');
  if (open) { e.preventDefault(); e.stopPropagation(); openDrawer(open.dataset.open); return; }
  const cp = e.target.closest('button[data-copy]');
  if (cp) { e.preventDefault(); e.stopPropagation(); copy(cp.dataset.copy, 'Address copied.'); }
});
document.getElementById('mine-clear').addEventListener('click', withdrawAll);

/* ---------- contracts ---------- */

const CONTRACTS = [
  ['Vault factory', 'factory'],
  ['Deposit router', 'router'],
  ['Oracle adapter', 'oracle'],
  ['CUSP token', 'token'],
  ['Treasury timelock', 'treasury'],
];

document.getElementById('contracts-list').innerHTML = CONTRACTS.map(([k, seed]) => `
  <div class="cs-contract">
    <span class="cs-label">${k}</span>
    <b class="cs-addr">${addr(seed)}</b>
    <button class="cs-linkbtn" data-copy="${addr(seed)}" type="button">Copy</button>
  </div>`).join('');

/* ---------- toasts and the clipboard ---------- */

const toasts = document.getElementById('toasts');

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'cs-toast';
  el.textContent = msg;
  toasts.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 3200);
}

function copy(text, msg) {
  const fallback = () => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); toast(msg); } catch (_) { toast('Copy it by hand: ' + text); }
    ta.remove();
  };
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => toast(msg), fallback);
  } else fallback();
}

/* ---------- one paint for all of it ---------- */

function paint() {
  renderStats();
  renderWallet();
  renderMine();
  renderList();
  if (current && drawer.classList.contains('on')) fillDrawer();
}

q.addEventListener('input', renderList);
sort.addEventListener('change', renderList);
chips.addEventListener('click', e => {
  const b = e.target.closest('button[data-filter]');
  if (!b) return;
  filter = b.dataset.filter;
  chips.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
  renderList();
});

/* ---------- menu and active tab ---------- */

const nav = document.querySelector('.cs-nav');
const burger = document.getElementById('burger');
burger.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  burger.setAttribute('aria-expanded', String(open));
});

const tabs = [...document.querySelectorAll('.cs-tabs a')];
tabs.forEach(a => a.addEventListener('click', () => {
  nav.classList.remove('open');
  burger.setAttribute('aria-expanded', 'false');
}));

const anchors = tabs.filter(a => a.getAttribute('href').startsWith('#'));
const sections = anchors.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
if ('IntersectionObserver' in window && sections.length) {
  const spy = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      anchors.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + en.target.id));
    });
  }, { rootMargin: '-40% 0px -55% 0px' });
  sections.forEach(s => spy.observe(s));
}

/* ---------- one entrance on scroll ---------- */

document.body.classList.add('cs-js');
const risers = document.querySelectorAll('.cs-tile, .cs-steps li, .cs-card, .cs-close-in');
risers.forEach(el => el.classList.add('cs-rise'));
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      en.target.classList.add('in');
      obs.unobserve(en.target);
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  risers.forEach(el => io.observe(el));
} else {
  risers.forEach(el => el.classList.add('in'));
}

load();
paint();
