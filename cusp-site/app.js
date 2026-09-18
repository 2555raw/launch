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

/* The brand marks, inlined so the page still has no network dependency and no
   build step. Paths from Simple Icons (CC0) except AMZN and MSFT, which come
   from Font Awesome Free (CC BY 4.0) — Simple Icons does not carry those two —
   and COIN, whose symbol is drawn here because Simple Icons ships the wordmark.
   The logos are the trademarks of their owners and are here only to identify
   the stock behind each pool.
     c  the brand's own hex, used on the light theme
     d  the same mark lifted enough to survive the dark ground, where an
        official black or navy simply vanishes */
const LOGOS = {
  NVDA: { vb: '0 0 24 24', c: '#76B900', d: '#76B900', p: 'M8.948 8.798v-1.43a6.7 6.7 0 0 1 .424-.018c3.922-.124 6.493 3.374 6.493 3.374s-2.774 3.851-5.75 3.851c-.398 0-.787-.062-1.158-.185v-4.346c1.528.185 1.837.857 2.747 2.385l2.04-1.714s-1.492-1.952-4-1.952a6.016 6.016 0 0 0-.796.035m0-4.735v2.138l.424-.027c5.45-.185 9.01 4.47 9.01 4.47s-4.08 4.964-8.33 4.964c-.37 0-.733-.035-1.095-.097v1.325c.3.035.61.062.91.062 3.957 0 6.82-2.023 9.593-4.408.459.371 2.34 1.263 2.73 1.652-2.633 2.208-8.772 3.984-12.253 3.984-.335 0-.653-.018-.971-.053v1.864H24V4.063zm0 10.326v1.131c-3.657-.654-4.673-4.46-4.673-4.46s1.758-1.944 4.673-2.262v1.237H8.94c-1.528-.186-2.73 1.245-2.73 1.245s.68 2.412 2.739 3.11M2.456 10.9s2.164-3.197 6.5-3.533V6.201C4.153 6.59 0 10.653 0 10.653s2.35 6.802 8.948 7.42v-1.237c-4.84-.6-6.492-5.936-6.492-5.936z' },
  TSLA: { vb: '0 0 24 24', c: '#CC0000', d: '#E82127', p: 'M12 5.362l2.475-3.026s4.245.09 8.471 2.054c-1.082 1.636-3.231 2.438-3.231 2.438-.146-1.439-1.154-1.79-4.354-1.79L12 24 8.619 5.034c-3.18 0-4.188.354-4.335 1.792 0 0-2.146-.795-3.229-2.43C5.28 2.431 9.525 2.34 9.525 2.34L12 5.362l-.004.002H12v-.002zm0-3.899c3.415-.03 7.326.528 11.328 2.28.535-.968.672-1.395.672-1.395C19.625.612 15.528.015 12 0 8.472.015 4.375.61 0 2.349c0 0 .195.525.672 1.396C4.674 1.989 8.585 1.435 12 1.46v.003z' },
  HOOD: { vb: '0 0 24 24', c: '#7E9E00', d: '#CCFF00', p: 'M2.84 24h.53c.096 0 .192-.048.224-.128C7.591 13.696 11.94 8.656 14.67 5.638c.112-.128.064-.225-.096-.225h-4.88a.55.55 0 0 0-.45.225L5.746 9.972c-.514.642-.642 1.236-.642 2.086v4.43c-1.14 3.194-1.862 5.361-2.392 7.32-.032.125.016.192.129.192M20.447.646c-.754-.802-4.157-.834-5.73-.224a3 3 0 0 0-.786.465 41 41 0 0 0-3.323 3.178c-.112.113-.064.225.097.225h5.409c.497 0 .786.289.786.786v6.1c0 .16.128.208.225.064l3.258-4.254c.53-.69.69-.898.835-1.861.192-1.413.08-3.58-.77-4.479m-6.982 16.18 2.231-3.676a.7.7 0 0 0 .064-.29V6.73c0-.16-.112-.225-.224-.097-3.355 3.74-5.971 7.672-8.395 12.407-.06.12.016.225.16.177l5.009-1.54c.565-.174.882-.402 1.155-.852' },
  COIN: { vb: '0 0 24 24', c: '#0052FF', d: '#4D86FF', p: 'M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-4 9.2c0-.663.537-1.2 1.2-1.2h5.6c.663 0 1.2.537 1.2 1.2v5.6c0 .663-.537 1.2-1.2 1.2H9.2c-.663 0-1.2-.537-1.2-1.2V9.2z', evenodd: true },
  AAPL: { vb: '0 0 24 24', c: '#000000', d: '#F6F0F4', p: 'M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701' },
  MSFT: { vb: '0 0 448 512', c: '#737373', d: '#A9A9A9', p: 'M0 32l214.6 0 0 214.6-214.6 0 0-214.6zm233.4 0l214.6 0 0 214.6-214.6 0 0-214.6zM0 265.4l214.6 0 0 214.6-214.6 0 0-214.6zm233.4 0l214.6 0 0 214.6-214.6 0 0-214.6z' },
  AMZN: { vb: '0 0 448 512', c: '#E88B00', d: '#FF9900', p: 'M257.7 162.7c-48.7 1.8-169.5 15.5-169.5 117.5 0 109.5 138.3 114 183.5 43.2 6.5 10.2 35.4 37.5 45.3 46.8l56.8-56s-32.3-25.3-32.3-52.8l0-147.1C341.5 89 317 32 229.2 32 141.2 32 94.5 87 94.5 136.3l73.5 6.8c16.3-49.5 54.2-49.5 54.2-49.5 40.7-.1 35.5 29.8 35.5 69.1zm0 86.8c0 80-84.2 68-84.2 17.2 0-47.2 50.5-56.7 84.2-57.8l0 40.6zM393.7 413c-7.7 10-70 67-174.5 67S34.7 408.5 10.2 379c-6.8-7.7 1-11.3 5.5-8.3 73.3 44.5 187.8 117.8 372.5 30.3 7.5-3.7 13.3 2 5.5 12zm39.8 2.2c-6.5 15.8-16 26.8-21.2 31-5.5 4.5-9.5 2.7-6.5-3.8s19.3-46.5 12.7-55c-6.5-8.3-37-4.3-48-3.2-10.8 1-13 2-14-.3-2.3-5.7 21.7-15.5 37.5-17.5 15.7-1.8 41-.8 46 5.7 3.7 5.1 0 27.1-6.5 43.1z' },
  META: { vb: '0 0 24 24', c: '#0467DF', d: '#2E86F0', p: 'M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a6.624 6.624 0 0 0 .265.86 5.297 5.297 0 0 0 .371.761c.696 1.159 1.818 1.927 3.593 1.927 1.497 0 2.633-.671 3.965-2.444.76-1.012 1.144-1.626 2.663-4.32l.756-1.339.186-.325c.061.1.121.196.183.3l2.152 3.595c.724 1.21 1.665 2.556 2.47 3.314 1.046.987 1.992 1.22 3.06 1.22 1.075 0 1.876-.355 2.455-.843a3.743 3.743 0 0 0 .81-.973c.542-.939.861-2.127.861-3.745 0-2.72-.681-5.357-2.084-7.45-1.282-1.912-2.957-2.93-4.716-2.93-1.047 0-2.088.467-3.053 1.308-.652.57-1.257 1.29-1.82 2.05-.69-.875-1.335-1.547-1.958-2.056-1.182-.966-2.315-1.303-3.454-1.303zm10.16 2.053c1.147 0 2.188.758 2.992 1.999 1.132 1.748 1.647 4.195 1.647 6.4 0 1.548-.368 2.9-1.839 2.9-.58 0-1.027-.23-1.664-1.004-.496-.601-1.343-1.878-2.832-4.358l-.617-1.028a44.908 44.908 0 0 0-1.255-1.98c.07-.109.141-.224.211-.327 1.12-1.667 2.118-2.602 3.358-2.602zm-10.201.553c1.265 0 2.058.791 2.675 1.446.307.327.737.871 1.234 1.579l-1.02 1.566c-.757 1.163-1.882 3.017-2.837 4.338-1.191 1.649-1.81 1.817-2.486 1.817-.524 0-1.038-.237-1.383-.794-.263-.426-.464-1.13-.464-2.046 0-2.221.63-4.535 1.66-6.088.454-.687.964-1.226 1.533-1.533a2.264 2.264 0 0 1 1.088-.285z' },
  GOOGL: { vb: '0 0 24 24', c: '#4285F4', d: '#4285F4', p: 'M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z' },
  PLTR: { vb: '0 0 24 24', c: '#101113', d: '#E8E3E8', p: 'M20.147 18L12 21.178 3.853 18 2.5 20.343 12 24l9.5-3.657L20.147 18zM12 0a9.5 9.5 0 1 0 0 19 9.5 9.5 0 0 0 0-19zm0 16.078a6.568 6.568 0 1 1 0-13.136 6.568 6.568 0 0 1 0 13.136z' },
};

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
          <span class="cs-ticker" style="--brand:${LOGOS[v.t].c};--brand-dk:${LOGOS[v.t].d}">
            <svg viewBox="${LOGOS[v.t].vb}" aria-hidden="true"><path d="${LOGOS[v.t].p}"${LOGOS[v.t].evenodd ? ' fill-rule="evenodd"' : ''}/></svg>
          </span>
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
