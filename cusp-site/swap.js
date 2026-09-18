/* Cusp — the swap page.
   Four invented aggregators quote the same trade, the best one wins, and the
   swap moves the balances of the shared demo wallet. Every price and every
   provider here is made up; the arithmetic between them is not. */

/* The token marks: ETH's diamond and the ₿ are drawn here, the two stock
   tokens borrow the brand paths from logos.js, and USDG carries a letter
   because a stablecoin's mark is not mine to invent. */
const GLYPH = {
  ETH:  '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l5.6 9.3L12 15 6.4 11.8 12 2.5zM12 16.4l5.6-3.3L12 21.5l-5.6-8.4 5.6 3.3z"/></svg>',
  WBTC: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.3 10.3c.2-1.4-.9-2.2-2.4-2.7l.5-1.9-1.2-.3-.5 1.9-.9-.2.5-1.9-1.2-.3-.5 1.9-2.4-.6-.3 1.3s.9.2.9.2c.5.1.6.4.6.7l-1.4 5.6c-.1.2-.2.4-.6.3 0 0-.9-.2-.9-.2l-.6 1.4 2.3.6-.5 1.9 1.2.3.5-1.9.9.2-.5 1.9 1.2.3.5-1.9c2 .4 3.6.2 4.2-1.6.5-1.5 0-2.4-1.1-2.9.8-.2 1.4-.7 1.6-1.9zm-2.8 3.9c-.4 1.5-2.9.7-3.7.5l.6-2.6c.8.2 3.4.6 3.1 2.1zm.4-3.9c-.3 1.4-2.4.7-3.1.5l.6-2.3c.7.2 2.9.5 2.5 1.8z"/></svg>',
  USDG: '<svg viewBox="0 0 24 24"><text x="12" y="16.5" text-anchor="middle" font-family="inherit" font-size="12" font-weight="700" fill="currentColor">G</text></svg>',
};

const TOKENS = {
  ETH:   { name: 'Ether',         px: 3420.18, dp: 4, c: '#5A6BC4', on: '#fff' },
  USDG:  { name: 'Global Dollar', px: 1.0000,  dp: 2, c: '#1D9E68', on: '#fff' },
  WBTC:  { name: 'Wrapped BTC',   px: 96480.5, dp: 6, c: '#E08A2B', on: '#fff' },
  xNVDA: { name: 'NVIDIA token',  px: 182.44,  dp: 4, c: '#F1F7E8', on: '#76B900', logo: 'NVDA' },
  xTSLA: { name: 'Tesla token',   px: 271.06,  dp: 4, c: '#FBEDED', on: '#CC0000', logo: 'TSLA' },
};

function tokenMark(sym) {
  const t = TOKENS[sym];
  const inner = t.logo && typeof LOGOS !== 'undefined' && LOGOS[t.logo]
    ? `<svg viewBox="${LOGOS[t.logo].vb}" fill="currentColor"><path d="${LOGOS[t.logo].p}"/></svg>`
    : (GLYPH[sym] || '');
  return `<span class="tr-tok-ic" style="background:${t.c};color:${t.on}">${inner}</span>`;
}

/* Four routers with their own spread and their own gas. The jitter is what
   makes a refresh mean something: in a real one the pools have moved. */
const PROVIDERS = [
  { id: 'kestrel', name: 'Kestrel',  c: '#2F9E7A', spread: 0.0012, gas: 0.42 },
  { id: 'zeroth',  name: 'Zeroth',   c: '#232330', spread: 0.0018, gas: 0.31 },
  { id: 'nordway', name: 'Nordway',  c: '#C2412F', spread: 0.0009, gas: 0.58 },
  { id: 'lattice', name: 'Lattice',  c: '#4B4BD6', spread: 0.0021, gas: 0.27 },
];

const PROTOCOL_FEE = 0.0008;   // 8 bps, quoted into every route

let jitter = {};
function reroll() {
  PROVIDERS.forEach(p => { jitter[p.id] = 1 - (Math.random() * 0.0016); });
}
reroll();

/* ---------- formatting ---------- */

const fmt = (n, dp) => n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: dp });
const usd = n => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ---------- state ---------- */

const $ = id => document.getElementById(id);
let pay = 'ETH';
let get = 'USDG';
let slip = 0.5;

/* ---------- token pickers ---------- */

function options(sel, chosen, other) {
  sel.innerHTML = Object.keys(TOKENS)
    .map(s => `<option value="${s}"${s === chosen ? ' selected' : ''}${s === other ? ' disabled' : ''}>${s} — ${TOKENS[s].name}</option>`)
    .join('');
}

function face(el, sym) {
  el.innerHTML = tokenMark(sym) +
    `<span class="tr-tok-t"><b>${sym}</b><span>${TOKENS[sym].name}</span></span>`;
}

/* ---------- quoting ---------- */

function quotes(amountIn) {
  const inUsd = amountIn * TOKENS[pay].px;
  const gross = inUsd / TOKENS[get].px;
  return PROVIDERS.map(p => {
    const out = gross * (1 - p.spread) * (1 - PROTOCOL_FEE) * (jitter[p.id] || 1);
    return { ...p, out, gasUsd: p.gas };
  }).sort((a, b) => b.out - a.out);
}

function paint() {
  const amt = Number($('pay').value) || 0;
  const outEl = $('get');
  const rows = amt > 0 ? quotes(amt) : [];
  const best = rows[0];

  // what you receive
  if (best) {
    outEl.textContent = fmt(best.out, TOKENS[get].dp);
    outEl.classList.remove('dim');
  } else {
    outEl.textContent = '—';
    outEl.classList.add('dim');
  }

  // the summary
  $('s-min').textContent = best ? fmt(best.out * (1 - slip / 100), TOKENS[get].dp) + ' ' + get : '—';
  $('s-rate').textContent = amt > 0
    ? `1 ${pay} = ${fmt(TOKENS[pay].px / TOKENS[get].px, TOKENS[get].dp)} ${get}`
    : '—';
  const route = $('s-route');
  route.textContent = best ? best.name : 'Comparing aggregators';
  route.classList.toggle('best', !!best);

  // the competition
  $('stage-h').textContent = best
    ? `${best.name} wins this one.`
    : 'Four providers. One best price.';
  $('stage-p').textContent = best
    ? `${rows.length} routes compared · ${fmt(best.out, TOKENS[get].dp)} ${get} before network fees.`
    : "Enter an amount to compare what you'll receive.";
  $('quotes').innerHTML = rows.map((r, i) => `
    <div class="tr-quote${i === 0 ? ' win' : ''}">
      <span class="tr-face" style="background:${r.c}">${r.name.slice(0, 2)}</span>
      <span class="tr-quote-t">
        <b>${r.name}</b>
        <span><i></i>${i === 0 ? 'Best price' : '−' + fmt((1 - r.out / best.out) * 100, 3) + '%'}</span>
      </span>
      <span class="tr-quote-v">${fmt(r.out, TOKENS[get].dp)}<small>~${usd(r.gasUsd)} gas</small></span>
    </div>`).join('');
  if (!rows.length) {
    $('quotes').innerHTML = PROVIDERS.map(p => `
      <div class="tr-quote">
        <span class="tr-face" style="background:${p.c}">${p.name.slice(0, 2)}</span>
        <span class="tr-quote-t"><b>${p.name}</b><span><i></i>Ready to compare</span></span>
      </div>`).join('');
  }

  // the wallet line and the button
  const bal = balanceOf(pay);
  $('pay-bal').textContent = wallet
    ? fmt(bal, TOKENS[pay].dp) + ' ' + pay + ' · ' + usd(bal * TOKENS[pay].px)
    : 'Connect to see balance';
  $('max').hidden = !wallet;

  const go = $('go');
  if (!wallet) { go.disabled = false; go.lastChild.textContent = ' Connect wallet'; }
  else if (!(amt > 0)) { go.disabled = true; go.lastChild.textContent = ' Enter an amount'; }
  else if (amt > bal) { go.disabled = true; go.lastChild.textContent = ' Not enough ' + pay; }
  else { go.disabled = false; go.lastChild.textContent = ' Swap ' + fmt(amt, TOKENS[pay].dp) + ' ' + pay; }

  renderChip();
}

/* ---------- doing the swap ---------- */

function swap() {
  const amt = Number($('pay').value) || 0;
  const bal = balanceOf(pay);
  if (!(amt > 0) || amt > bal) return;
  const best = quotes(amt)[0];
  setBalance(pay, bal - amt);
  setBalance(get, balanceOf(get) + best.out);
  walletSave();
  reroll();
  $('pay').value = '';
  paint();
  toast(`Swapped ${fmt(amt, TOKENS[pay].dp)} ${pay} for ${fmt(best.out, TOKENS[get].dp)} ${get} via ${best.name}.`);
}

/* ---------- wallet chrome ---------- */

function renderChip() {
  const on = !!wallet;
  $('chip').hidden = !on;
  $('connect').hidden = on;
  if (on) $('chip-addr').textContent = shortAddr(wallet.addr);
}

$('connect').addEventListener('click', () => {
  walletConnect();
  paint();
  toast('Demo wallet connected: ' + fmt(SEED_BAL.ETH, 4) + ' ETH and ' + usd(SEED_USDG) + ' USDG of play money.');
});

$('chip-copy').addEventListener('click', () => {
  const text = wallet.addr;
  const done = () => toast('Address copied.');
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(done, () => toast('Copy it by hand: ' + text));
  } else {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (_) { toast('Copy it by hand: ' + text); }
    ta.remove();
  }
});

/* ---------- wiring ---------- */

$('pay').addEventListener('input', paint);

$('pay-tok').addEventListener('change', e => {
  pay = e.target.value;
  if (pay === get) get = Object.keys(TOKENS).find(s => s !== pay);
  sync();
});
$('get-tok').addEventListener('change', e => {
  get = e.target.value;
  if (get === pay) pay = Object.keys(TOKENS).find(s => s !== get);
  sync();
});

$('flip').addEventListener('click', () => {
  [pay, get] = [get, pay];
  sync();
});

$('slip').addEventListener('click', e => {
  const b = e.target.closest('button[data-s]');
  if (!b) return;
  slip = Number(b.dataset.s);
  $('slip-own').value = slip;
  [...$('slip').querySelectorAll('button')].forEach(x => x.classList.toggle('on', x === b));
  paint();
});
$('slip-own').addEventListener('input', e => {
  const n = Number(e.target.value);
  if (!(n > 0)) return;
  slip = Math.min(n, 50);
  [...$('slip').querySelectorAll('button')].forEach(x => x.classList.toggle('on', Number(x.dataset.s) === slip));
  paint();
});

$('refresh').addEventListener('click', () => {
  reroll();
  paint();
  toast('Quotes refreshed across four providers.');
});

$('go').addEventListener('click', () => {
  if (!wallet) { walletConnect(); paint(); toast('Demo wallet connected with play money.'); return; }
  swap();
});

$('max').addEventListener('click', () => {
  $('pay').value = +balanceOf(pay).toFixed(TOKENS[pay].dp);
  paint();
});

function sync() {
  options($('pay-tok'), pay, get);
  options($('get-tok'), get, pay);
  face($('pay-face'), pay);
  face($('get-face'), get);
  paint();
}

/* ---------- toasts ---------- */

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'tr-toast';
  el.textContent = msg;
  $('toasts').appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 3400);
}

/* ---------- go ---------- */

$('faces').innerHTML = PROVIDERS.map(p =>
  `<span class="tr-face" style="background:${p.c}" title="${p.name}">${p.name.slice(0, 2)}</span>`).join('');

walletLoad();
sync();
