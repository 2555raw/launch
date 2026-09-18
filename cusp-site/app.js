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

const STATE_TEXT = { range: 'In range', rebalancing: 'Rebalancing', paused: 'Paused' };

/* ---------- formatting ---------- */

const usd = n =>
  n >= 1e6 ? '$' + (n / 1e6).toFixed(2) + 'M'
  : n >= 1e3 ? '$' + Math.round(n / 1e3) + 'K'
  : '$' + n.toFixed(0);

const money = n => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = n => n.toFixed(1) + '%';
const addr = t => '0x' + [...('cusp' + t)].map(c => c.charCodeAt(0).toString(16)).join('') + 'a41d';

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

function render() {
  const list = VAULTS.filter(matches).sort((a, b) => {
    switch (sort.value) {
      case 'tvl': return b.tvl - a.tvl;
      case 'fees': return b.fees24 - a.fees24;
      case 'name': return a.t.localeCompare(b.t);
      default: return b.apr - a.apr;
    }
  });

  rows.innerHTML = list.map(v => {
    const used = Math.min(v.tvl / v.cap, 1);
    const low = v.price * (1 - v.band / 100);
    const high = v.price * (1 + v.band / 100);
    return `
    <details class="cs-row">
      <summary>
        <div class="cs-vault">
          <span class="cs-ticker">${v.t.slice(0, 4)}</span>
          <span class="cs-vault-t">
            <b>USDG / x${v.t}</b>
            <span>${v.name} · ${v.tier.toFixed(2)}% pool${v.age <= 30 ? ' · new' : ''}</span>
          </span>
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
        <div class="cs-row-act">
          <button class="cs-btn ${v.state === 'paused' ? 'cs-btn-line' : 'cs-btn-fill'}" data-deposit="${v.t}" type="button" ${v.state === 'paused' ? 'disabled' : ''}>
            ${v.state === 'paused' ? 'Paused' : 'Deposit'}
          </button>
        </div>
      </summary>
      <div class="cs-detail">
        <div>
          <span class="cs-label">Position band</span>
          <b>${money(low)} — ${money(high)}</b>
          <p>±${v.band.toFixed(1)}% around the oracle price.</p>
        </div>
        <div>
          <span class="cs-label">Last rebalance</span>
          <b>${v.reb}</b>
          <p>Re-centred only against a fresh feed.</p>
        </div>
        <div>
          <span class="cs-label">Fees · 24h</span>
          <b>${usd(v.fees24)}</b>
          <p>70% compounded · 20% burned · 10% treasury.</p>
        </div>
        <div>
          <span class="cs-label">Vault contract</span>
          <b class="cs-addr">${addr(v.t)}</b>
          <p>Verified on Blockscout.</p>
        </div>
      </div>
    </details>`;
  }).join('');

  empty.hidden = list.length > 0;
}

q.addEventListener('input', render);
sort.addEventListener('change', render);
chips.addEventListener('click', e => {
  const b = e.target.closest('button[data-filter]');
  if (!b) return;
  filter = b.dataset.filter;
  chips.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
  render();
});

/* ---------- deposit drawer ---------- */

const drawer = document.getElementById('drawer');
const scrim = document.getElementById('scrim');
const amount = document.getElementById('d-amount');
let current = null;

function fillDrawer() {
  if (!current) return;
  const n = Math.max(Number(amount.value) || 0, 0);
  document.getElementById('d-half').textContent = money(n / 2) + ' → x' + current.t;
  document.getElementById('d-shares').textContent = (n / 1.0642).toFixed(2) + ' c' + current.t;
  document.getElementById('d-apr').textContent = pct(current.apr);
  document.getElementById('d-room').textContent = usd(Math.max(current.cap - current.tvl, 0));
}

function openDrawer(ticker) {
  current = VAULTS.find(v => v.t === ticker);
  if (!current) return;
  document.getElementById('d-name').textContent = 'USDG / x' + current.t;
  fillDrawer();
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

// the button lives inside a <summary>, so swallow the click before it toggles the row
rows.addEventListener('click', e => {
  const b = e.target.closest('button[data-deposit]');
  if (!b) return;
  e.preventDefault();
  e.stopPropagation();
  openDrawer(b.dataset.deposit);
});

amount.addEventListener('input', fillDrawer);
scrim.addEventListener('click', closeDrawer);
document.getElementById('d-close').addEventListener('click', closeDrawer);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

/* ---------- theme ---------- */

const root = document.documentElement;
try {
  const saved = localStorage.getItem('cusp-theme');
  if (saved) root.dataset.theme = saved;
} catch (_) { /* storage blocked — dark stays */ }

document.getElementById('theme').addEventListener('click', () => {
  const next = root.dataset.theme === 'light' ? 'dark' : 'light';
  root.dataset.theme = next;
  try { localStorage.setItem('cusp-theme', next); } catch (_) {}
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

const sections = tabs.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
if ('IntersectionObserver' in window && sections.length) {
  const spy = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      tabs.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + en.target.id));
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

render();
