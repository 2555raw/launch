/* Vesica — the swap page.
   Four invented aggregators quote the same trade, the best one wins, and the
   swap moves the balances of the shared demo wallet. Every price and every
   provider here is made up; the arithmetic between them is not. */

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

const quotes = amountIn => quoteRoutes(pay, get, amountIn);

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
  // below one unit of what the field can show, the button would read "Swap 0 ETH"
  else if (!(amt >= 10 ** -TOKENS[pay].dp)) { go.disabled = true; go.lastChild.textContent = ' Enter an amount'; }
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

$('connect').addEventListener('click', async () => {
  await walletConnect();
  paint();
  toast(wallet.real
    ? 'Connected ' + shortAddr(wallet.addr) + ' on ' + wallet.chain +
      '. The balances here are play money — nothing is signed.'
    : 'Demo wallet connected: ' + fmt(SEED_BAL.ETH, 4) + ' ETH and ' + usd(SEED_USDG) + ' USDG of play money.');
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
  if (!wallet) { walletConnect().then(() => { paint(); toast('Wallet connected. The balances here are play money.'); }); return; }
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
  el.className = "tr-toast";
  el.textContent = msg;
  $('toasts').appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 3400);
}

/* ---------- go ---------- */

$('faces').innerHTML = PROVIDERS.map(p =>
  `<span class="tr-face" style="background:${p.c}" title="${p.name}">${p.name.slice(0, 2)}</span>`).join('');

/* the nav's quick trade hands the pair and the size over in the query, so
   arriving here from any page lands on the trade the reader had set up */
(function fromTheQuery() {
  const q = new URLSearchParams(location.search);
  const a = q.get('pay'), b = q.get('get'), n = parseFloat(q.get('amt'));
  if (a && TOKENS[a]) pay = a;
  if (b && TOKENS[b] && b !== pay) get = b;
  if (n > 0) $('pay').value = String(n);
})();

walletLoad();
sync();
