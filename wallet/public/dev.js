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

/* Live networks only. A test chain's "money" is worthless on purpose, so
   counting it as income would be a lie. */
const LIVE = Object.keys(CHAINS).map(Number).filter(id => !CHAINS[id].test);

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

const short = a => a.slice(0, 6) + '…' + a.slice(-4);
const usdOf = (v, d) => (Number(E.formatUnits(v, d))).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function providerFor(id) {
  return new E.JsonRpcProvider(CHAINS[id].rpc, E.Network.from(id), { staticNetwork: true });
}

/* ── the gate ──────────────────────────────────────────────────────────────── */
function startWatching(addr) {
  watching = addr;
  try { localStorage.setItem(KEY, addr); } catch { /* private window; this session only */ }
  $('#gate').hidden = true;
  $('#body').hidden = false;
  $('#forget').hidden = false;
  $('#watching').textContent = addr;
  $('#watching').title = addr;
  $('#bodyFine').innerHTML =
    'Read straight off the chain, live. Every line below is public: anyone holding this address can see the same on a block explorer, ' +
    'with or without this page. What no one can do is move it. Amounts are USDC, which is worth a dollar, so the figures are dollars.';
  reload();
}

$('#watchForm').addEventListener('submit', e => {
  e.preventDefault();
  const raw = $('#addrInput').value.trim();
  const err = $('#gateErr');
  if (!E.isAddress(raw)) {
    err.textContent = "That is not an address. It should be 42 characters starting 0x.";
    err.hidden = false;
    return;
  }
  err.hidden = true;
  startWatching(E.getAddress(raw));
});

$('#forget').addEventListener('click', () => {
  try { localStorage.removeItem(KEY); } catch { /* nothing to remove */ }
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
    const el = document.createElement('a');
    el.className = 'dv-row';
    el.href = c.explorer + '/tx/' + r.hash;
    el.target = '_blank';
    el.rel = 'noopener noreferrer';
    el.innerHTML = '<span class="dv-in">+$<span class="dv-v"></span></span>' +
                   '<span class="dv-mid"><b></b><small></small></span>' +
                   '<span class="dv-when"></span>';
    el.querySelector('.dv-v').textContent = usdOf(r.value, r.decimals);
    el.querySelector('b').textContent = 'From ' + short(r.from);
    el.querySelector('small').textContent = c.short + ' · block ' + r.block.toLocaleString('en-US');
    el.querySelector('.dv-when').textContent = r.ts
      ? new Date(r.ts).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
      : '';
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
let saved = null;
try { saved = localStorage.getItem(KEY); } catch { /* storage blocked; ask again */ }
if (saved && E.isAddress(saved)) startWatching(E.getAddress(saved));
})();
