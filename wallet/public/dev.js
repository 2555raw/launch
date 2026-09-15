/* Ward — what has been paid in.
 *
 * This page reads the chain and nothing else. There is no server behind it and
 * no account: you give it an address, it asks each network's public node what
 * that address holds and which USDC transfers landed in it, and it draws the
 * answer. The address is kept in this browser's localStorage so the page opens
 * blank for anyone else, but that is tidiness, not secrecy: the same facts are
 * on every block explorer. Nothing here can spend anything, because nothing
 * here has a key. */

(() => {
'use strict';

const E = window.ethers;
const CHAINS = window.WARD_CHAINS;
const $ = s => document.querySelector(s);

const KEY = 'ward.v1.watch';
const TRANSFER = E.id('Transfer(address,address,uint256)');
const ERC20 = ['function balanceOf(address) view returns (uint256)'];
const PRICES = window.WARD_PLAN_PRICES;

/* An incoming amount that matches a tier's price to the cent is almost
   certainly someone buying that tier, so the row says so. It is a match on
   the number and nothing more, which is why the wording is "looks like":
   anyone can send any amount, and the wallet is what actually grants the
   plan, off the buyer's own receipt. */
function looksLike(value, decimals) {
  const usd = Number(E.formatUnits(value, decimals));
  for (const [id, price] of Object.entries(PRICES)) {
    if (Math.abs(usd - price) < 0.005) return id;
  }
  return null;
}

const LIVE = Object.keys(CHAINS).map(Number);

/* Public nodes cap how many blocks one eth_getLogs may cover, and they differ
   on where the cap is, so the scan walks backwards in windows this size. */
const WINDOW = 800;
/* How far back one pass looks, per chain, in blocks. Chains produce blocks at
   very different rates, so this is expressed in hours and converted. */
const HOURS = 72;
const BLOCK_SECONDS = { 1: 12, 10: 2, 137: 2, 8453: 2, 42161: 0.25 };

let watching = null;
let scanned = {};   // chainId -> block we have scanned back to
let rows = [];
let passes = 0;     // how many windows back the scan has walked

const usdOf = (v, d) => (Number(E.formatUnits(v, d))).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function providerFor(id) {
  return new E.JsonRpcProvider(CHAINS[id].rpc, E.Network.from(id), { staticNetwork: true });
}

/* ── the lock ──────────────────────────────────────────────────────────────
   The address is not stored in the clear. It is sealed with AES-GCM under a
   key derived from the passphrase with PBKDF2, so this page cannot draw
   anything for someone who does not have that passphrase: it does not know
   which address to ask the chains about. There is no reset, because there is
   nowhere a reset could come from — no server, no account, no copy. */
const ITERATIONS = 310000;
const enc = new TextEncoder();
const dec = new TextDecoder();
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = str => Uint8Array.from(atob(str), ch => ch.charCodeAt(0));

async function keyFrom(pass, salt) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

async function seal(addr, pass) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFrom(pass, salt);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(addr));
  return JSON.stringify({ v: 1, salt: b64(salt), iv: b64(iv), ct: b64(ct) });
}

/* A wrong passphrase fails the AES-GCM tag rather than returning rubbish, so
   "it threw" and "wrong passphrase" are the same answer. */
async function unseal(blob, pass) {
  const box = JSON.parse(blob);
  const key = await keyFrom(pass, unb64(box.salt));
  const out = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, key, unb64(box.ct));
  return dec.decode(out);
}

const store = {
  get() { try { return localStorage.getItem(KEY); } catch { return null; } },
  set(v) { try { localStorage.setItem(KEY, v); } catch { /* private window: this session only */ } },
  clear() { try { localStorage.removeItem(KEY); } catch { /* nothing to remove */ } }
};

function startWatching(addr) {
  watching = addr;
  $('#setup').hidden = true;
  $('#unlock').hidden = true;
  $('#body').hidden = false;
  $('#lockBtn').hidden = false;
  $('#watching').textContent = addr;
  $('#watching').title = addr;
  $('#bodyFine').innerHTML =
    'Read straight off the chain, live. The lock keeps this page to you; it cannot keep the chain to you. ' +
    'Anyone who already has this address can read the same figures on a block explorer, with or without this page. ' +
    'What no one can do is move the money. Amounts are USDC, which is worth a dollar, so the figures are dollars.';
  reload();
}

function showGate() {
  const has = !!store.get();
  $('#setup').hidden = has;
  $('#unlock').hidden = !has;
  $('#body').hidden = true;
  $('#lockBtn').hidden = true;
  (has ? $('#pw') : $('#addrInput')).focus();
}

function say(sel, msg) {
  const el = $(sel);
  el.textContent = msg;
  el.hidden = !msg;
}

$('#setupForm').addEventListener('submit', async e => {
  e.preventDefault();
  const raw = $('#addrInput').value.trim();
  const p1 = $('#pw1').value, p2 = $('#pw2').value;
  if (!E.isAddress(raw)) return say('#setupErr', 'That is not an address. It should be 42 characters starting 0x.');
  if (p1.length < 8) return say('#setupErr', 'Use a passphrase of at least 8 characters.');
  if (p1 !== p2) return say('#setupErr', 'The two passphrases are not the same.');
  say('#setupErr', '');

  const btn = e.target.querySelector('button');
  btn.disabled = true; btn.textContent = 'Locking…';
  try {
    store.set(await seal(E.getAddress(raw), p1));
    startWatching(E.getAddress(raw));
  } catch {
    say('#setupErr', "This browser wouldn't do the encryption. It needs a secure connection (https).");
  } finally {
    btn.disabled = false; btn.textContent = 'Lock it and watch';
  }
});

$('#unlockForm').addEventListener('submit', async e => {
  e.preventDefault();
  const pass = $('#pw').value;
  if (!pass) return;
  const btn = e.target.querySelector('button');
  btn.disabled = true; btn.textContent = 'Unlocking…';
  say('#unlockErr', '');
  try {
    const addr = await unseal(store.get(), pass);
    $('#pw').value = '';
    startWatching(addr);
  } catch {
    say('#unlockErr', 'That passphrase does not open it.');
  } finally {
    btn.disabled = false; btn.textContent = 'Unlock';
  }
});

/* Locking is only ever a reload: the address lives in a variable, so leaving
   the page is enough to forget it. */
$('#lockBtn').addEventListener('click', () => location.reload());

$('#startOver').addEventListener('click', () => {
  store.clear();
  location.reload();
});

$('#reload').addEventListener('click', () => reload());
$('#more').addEventListener('click', () => scan(true));

/* ── held right now ────────────────────────────────────────────────────────── */
async function paintBalances() {
  const box = $('#balances');
  box.innerHTML = '';
  const cards = {};
  LIVE.forEach(id => {
    const c = CHAINS[id];
    const el = document.createElement('article');
    el.className = 'dv-card';
    el.innerHTML = '<p class="dv-net"><span class="dv-dot"></span><span class="dv-name"></span></p>' +
                   '<p class="dv-amt">…</p><p class="dv-sub">…</p>';
    el.querySelector('.dv-dot').style.background = c.color;
    el.querySelector('.dv-name').textContent = c.short;
    box.appendChild(el);
    cards[id] = el;
  });

  await Promise.all(LIVE.map(async id => {
    const c = CHAINS[id], el = cards[id];
    const usdc = c.tokens.find(t => t.symbol === 'USDC');
    try {
      const p = providerFor(id);
      const [native, token] = await Promise.all([
        p.getBalance(watching),
        usdc ? new E.Contract(usdc.address, ERC20, p).balanceOf(watching) : Promise.resolve(null)
      ]);
      el.querySelector('.dv-amt').textContent = token == null ? '—' : '$' + usdOf(token, usdc.decimals);
      el.querySelector('.dv-sub').textContent =
        Number(E.formatEther(native)).toFixed(4).replace(/0+$/, '').replace(/\.$/, '') + ' ' + c.coin + ' for fees';
      el.classList.toggle('dv-has', token != null && token > 0n);
    } catch {
      el.querySelector('.dv-amt').textContent = 'n/a';
      el.querySelector('.dv-sub').textContent = 'Node unreachable';
    }
  }));
}

/* ── payments in ───────────────────────────────────────────────────────────── */
async function scanChain(id, deeper) {
  const c = CHAINS[id];
  const usdc = c.tokens.find(t => t.symbol === 'USDC');
  if (!usdc) return [];
  const p = providerFor(id);
  const head = await p.getBlockNumber();

  const secs = BLOCK_SECONDS[id] || 2;
  const span = Math.ceil((HOURS * 3600) / secs);
  const from = deeper && scanned[id] != null ? Math.max(0, scanned[id] - span) : Math.max(0, head - span);
  const to = deeper && scanned[id] != null ? scanned[id] - 1 : head;
  if (to < from) return [];

  /* Topic 2 is the recipient, so the node does the filtering and we only ever
     get back transfers that landed in this address. */
  const topics = [TRANSFER, null, E.zeroPadValue(watching, 32)];
  const found = [];
  for (let end = to; end >= from; end -= WINDOW) {
    const start = Math.max(from, end - WINDOW + 1);
    try {
      const logs = await p.getLogs({ address: usdc.address, topics, fromBlock: start, toBlock: end });
      logs.forEach(l => found.push({
        chainId: id, hash: l.transactionHash, block: l.blockNumber,
        from: E.getAddress('0x' + l.topics[1].slice(26)),
        value: E.toBigInt(l.data), decimals: usdc.decimals
      }));
    } catch { /* one refused window must not abandon the rest of the range */ }
  }
  scanned[id] = from;
  return found;
}

async function scan(deeper) {
  const note = $('#scanNote'), more = $('#more');
  note.textContent = deeper ? 'Looking further back…' : 'Reading the chains…';
  more.disabled = true;

  const batches = await Promise.all(LIVE.map(id => scanChain(id, deeper).catch(() => [])));
  batches.flat().forEach(r => {
    if (!rows.some(x => x.hash === r.hash && x.from === r.from && x.value === r.value)) rows.push(r);
  });
  rows.sort((a, b) => b.block - a.block);

  /* Timestamps are a second call per block, so they are fetched only for what
     is actually on screen. */
  await Promise.all(rows.slice(0, 60).filter(r => r.ts == null).map(async r => {
    try { const b = await providerFor(r.chainId).getBlock(r.block); r.ts = b ? b.timestamp * 1000 : 0; }
    catch { r.ts = 0; }
  }));

  paintFeed();
  passes += 1;
  note.textContent = rows.length
    ? rows.length + (rows.length === 1 ? ' payment found' : ' payments found') +
      ' in the last ' + (HOURS * passes) + ' hours'
    : 'Nothing in the last ' + (HOURS * passes) + ' hours';
  more.hidden = false;
  more.disabled = false;
}

function paintFeed() {
  const box = $('#feed');
  box.innerHTML = '';
  if (!rows.length) {
    const p = document.createElement('p');
    p.className = 'dv-empty';
    p.textContent = 'No USDC has arrived at this address in the window looked at so far.';
    box.appendChild(p);
    return;
  }
  rows.slice(0, 60).forEach(r => {
    const c = CHAINS[r.chainId];
    const tier = looksLike(r.value, r.decimals);

    const el = document.createElement('article');
    el.className = 'dv-row';
    el.innerHTML =
      '<div class="dv-sum">' +
        '<span class="dv-in">+$<span class="dv-v"></span></span>' +
        '<span class="dv-tier"></span>' +
        '<span class="dv-when"></span>' +
      '</div>' +
      '<p class="dv-paid">Paid by</p>' +
      '<div class="dv-who">' +
        '<code class="dv-from"></code>' +
        '<button class="dv-copy" type="button">Copy</button>' +
      '</div>' +
      '<p class="dv-meta"><span class="dv-chain"></span> · <a class="dv-tx" target="_blank" rel="noopener noreferrer">See the transaction</a></p>';

    el.querySelector('.dv-v').textContent = usdOf(r.value, r.decimals);
    el.querySelector('.dv-from').textContent = r.from;

    const tag = el.querySelector('.dv-tier');
    if (tier) { tag.textContent = 'looks like ' + tier[0].toUpperCase() + tier.slice(1); tag.classList.add('is-' + tier); }
    else tag.remove();

    el.querySelector('.dv-when').textContent = r.ts
      ? new Date(r.ts).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
      : '';
    el.querySelector('.dv-chain').textContent = c.short + ' · block ' + r.block.toLocaleString('en-US');
    el.querySelector('.dv-tx').href = c.explorer + '/tx/' + r.hash;

    /* The address is the point of this row: it is who to send the card to, so
       it is here in full and one click from the clipboard. */
    const copy = el.querySelector('.dv-copy');
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(r.from); copy.textContent = 'Copied'; }
      catch { copy.textContent = 'Select it by hand'; }
      setTimeout(() => { copy.textContent = 'Copy'; }, 1600);
    });

    box.appendChild(el);
  });
}

function reload() {
  rows = [];
  scanned = {};
  passes = 0;
  paintBalances();
  scan(false);
}

/* ── start ─────────────────────────────────────────────────────────────────── */
showGate();
})();
