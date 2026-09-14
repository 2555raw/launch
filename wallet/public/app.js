/* Ward — self-custody wallet.
 *
 * Everything that matters happens in this file and in the browser of whoever
 * opens it: the key is generated here, encrypted here and signed here. The only
 * thing that leaves is JSON-RPC to the chain you picked; the private key never
 * does, not even encrypted.
 *
 * That is also why ethers is served from /vendor instead of a CDN: a
 * third-party script on a page holding private keys is an open door. */

(() => {
'use strict';

const E = window.ethers;

/* ── Plan payments ─────────────────────────────────────────────────────────
   Paid plans are an ordinary USDC transfer to this address, on the network the
   user is on. Set it to an address you control; until you do, the upgrade
   buttons say so instead of pretending to charge. */
const TREASURY = '';

const PLANS = {
  classic: {
    name: 'Classic', price: 0, tier: 'classic',
    line: 'The wallet, free forever',
    perks: [
      'Self-custody wallet across six networks',
      'Unlimited payments and payment requests',
      'Top up from MetaMask, Coinbase Wallet, Phantom and more',
      'Encrypted on your device with your own password'
    ]
  },
  gold: {
    name: 'Gold', price: 19.99, tier: 'gold',
    line: 'For people who get paid through it',
    perks: [
      'Everything in Classic',
      'The Gold card',
      'Saved payees — stop retyping addresses',
      'Your name on every payment request',
      'Export your activity as a CSV'
    ]
  },
  platinum: {
    name: 'Platinum', price: 49.99, tier: 'plat',
    line: 'For running more than one set of books',
    perks: [
      'Everything in Gold',
      'The Platinum card',
      'Several accounts from the same recovery phrase',
      'One backup still covers all of them'
    ]
  }
};
const PLAN_ORDER = ['classic', 'gold', 'platinum'];
const rank = p => PLAN_ORDER.indexOf(p);

/* ── Networks ──────────────────────────────────────────────────────────────
   All real chains. The ones flagged test are real too — same protocol, same
   blocks — their coin just isn't worth anything, which makes them the right
   place to prove a payment works before risking money. */
const CHAINS = {
  8453: {
    name: 'Base', short: 'Base', coin: 'ETH', color: '#2151F5',
    rpc: 'https://mainnet.base.org', explorer: 'https://basescan.org',
    blurb: 'Fast, with fees in cents',
    tokens: [
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', color: '#2775CA' },
      { symbol: 'USDT', name: 'Tether USD', decimals: 6, address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', color: '#26A17B' }
    ]
  },
  137: {
    name: 'Polygon', short: 'Polygon', coin: 'POL', color: '#8247E5',
    rpc: 'https://polygon-rpc.com', explorer: 'https://polygonscan.com',
    blurb: 'Tiny fees, widely used for getting paid',
    tokens: [
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', color: '#2775CA' },
      { symbol: 'USDT', name: 'Tether USD', decimals: 6, address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', color: '#26A17B' }
    ]
  },
  42161: {
    name: 'Arbitrum One', short: 'Arbitrum', coin: 'ETH', color: '#12AAFF',
    rpc: 'https://arb1.arbitrum.io/rpc', explorer: 'https://arbiscan.io',
    blurb: 'Cheap, and deep on liquidity',
    tokens: [
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', color: '#2775CA' },
      { symbol: 'USDT', name: 'Tether USD', decimals: 6, address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', color: '#26A17B' }
    ]
  },
  10: {
    name: 'Optimism', short: 'Optimism', coin: 'ETH', color: '#FF0420',
    rpc: 'https://mainnet.optimism.io', explorer: 'https://optimistic.etherscan.io',
    blurb: 'Quick, low fees',
    tokens: [
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', color: '#2775CA' },
      { symbol: 'USDT', name: 'Tether USD', decimals: 6, address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', color: '#26A17B' }
    ]
  },
  1: {
    name: 'Ethereum', short: 'Ethereum', coin: 'ETH', color: '#627EEA',
    rpc: 'https://ethereum-rpc.publicnode.com', explorer: 'https://etherscan.io',
    blurb: 'The main one — fees run higher',
    tokens: [
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', color: '#2775CA' },
      { symbol: 'USDT', name: 'Tether USD', decimals: 6, address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', color: '#26A17B' }
    ]
  },
  84532: {
    name: 'Base Sepolia', short: 'Base Sepolia', coin: 'ETH', color: '#7B8794', test: true,
    rpc: 'https://sepolia.base.org', explorer: 'https://sepolia.basescan.org',
    blurb: 'Practice here — the money is worthless on purpose',
    tokens: [
      { symbol: 'USDC', name: 'Test USDC', decimals: 6, address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', color: '#2775CA' }
    ]
  },
  11155111: {
    name: 'Sepolia', short: 'Sepolia', coin: 'ETH', color: '#7B8794', test: true,
    rpc: 'https://ethereum-sepolia-rpc.publicnode.com', explorer: 'https://sepolia.etherscan.io',
    blurb: "Ethereum's test network",
    tokens: [
      { symbol: 'USDC', name: 'Test USDC', decimals: 6, address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', color: '#2775CA' }
    ]
  }
};
const CHAIN_ORDER = [8453, 137, 42161, 10, 1, 84532, 11155111];

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'event Transfer(address indexed from, address indexed to, uint256 value)'
];
const ERC20 = new E.Interface(ERC20_ABI);

/* ── Storage ───────────────────────────────────────────────────────────────
   Four things in localStorage: the encrypted keystore, the address (public
   anyway), preferences and a local copy of the activity. Nothing in the clear. */
const NS = 'ward.v1';
const FIELDS = ['keystore', 'address', 'prefs', 'activity', 'plan', 'payees'];
const K = {
  store:  NS + '.keystore',
  addr:   NS + '.address',
  prefs:  NS + '.prefs',
  acts:   NS + '.activity',
  plan:   NS + '.plan',
  payees: NS + '.payees'
};
/* The product has been renamed twice. Someone who made a wallet under an older
   name keeps it: losing a keystore to a rename would lose their money. */
const LEGACY_NS = ['quiver.v1', 'calma.v1'];

const read = (k, fb) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const drop = k => { try { localStorage.removeItem(k); } catch {} };

(function migrate() {
  if (read(K.store, null)) return;
  for (const ns of LEGACY_NS) {
    if (!read(ns + '.keystore', null)) continue;
    FIELDS.forEach(f => {
      const v = read(ns + '.' + f, null);
      if (v !== null) write(NS + '.' + f, v);
    });
    return;
  }
})();

let prefs = Object.assign({ chainId: 8453, rpc: {}, accounts: [{ i: 0, name: 'Account 1' }], active: 0 }, read(K.prefs, {}));
if (!CHAINS[prefs.chainId]) prefs.chainId = 8453;
if (!Array.isArray(prefs.accounts) || !prefs.accounts.length) prefs.accounts = [{ i: 0, name: 'Account 1' }];
const savePrefs = () => write(K.prefs, prefs);

/* ── Session state (memory only, never persisted) ─────────────────────────── */
let wallet = null;            // decrypted signer for the active account
let rootPhrase = null;        // recovery phrase, for deriving further accounts
let pendingMnemonic = null;
let pendingImport = null;
let lockTimer = null;
let balances = { native: null, tokens: {} };
let draft = null;
let prefill = null;
let plan = 'classic';
let linked = null;            // { info, provider, address } — an external wallet

const chain = () => CHAINS[prefs.chainId];
const rpcUrl = () => (prefs.rpc[prefs.chainId] || '').trim() || chain().rpc;
const has = need => rank(plan) >= rank(need);

let _provider = null, _providerKey = '';
function provider() {
  const key = prefs.chainId + '|' + rpcUrl();
  if (_provider && _providerKey === key) return _provider;
  _providerKey = key;
  _provider = new E.JsonRpcProvider(rpcUrl(), E.Network.from(Number(prefs.chainId)), { staticNetwork: true });
  return _provider;
}

/* ── Screen helpers ────────────────────────────────────────────────────────── */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

function show(name) {
  $$('.view').forEach(v => v.classList.toggle('on', v.dataset.view === name));
  const chrome = ['welcome', 'create', 'verify', 'password', 'import', 'unlock'].indexOf(name) === -1;
  $('#bar').hidden = !chrome;
  window.scrollTo({ top: 0, behavior: 'auto' });
  if (name === 'receive') paintReceive();
  if (name === 'activity') { paintActivity($('#allList'), 100); $('#exportCsv').hidden = !has('gold'); }
  if (name === 'settings') { $('#rpcInput').value = prefs.rpc[prefs.chainId] || ''; paintPlanRow(); }
  if (name === 'plans') paintPlans();
  if (name === 'deposit') paintDeposit();
  if (name === 'charge') $('#fromField').hidden = !has('gold');
  if (name === 'send') paintPayees();
}

function toast(msg) {
  const wrap = $('#toasts');
  /* More than two at once and they stop being notices and become a wall. */
  while (wrap.children.length >= 2) wrap.firstElementChild.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

function fail(node, msg) {
  const el = typeof node === 'string' ? $(node) : node;
  if (!msg) { el.hidden = true; return; }
  el.textContent = msg;
  el.hidden = false;
}

async function copy(text, said) {
  try {
    if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
    else {
      const t = document.createElement('textarea');
      t.value = text; t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove();
    }
    toast(said || 'Copied');
  } catch { toast("Couldn't copy"); }
}

async function share(text, title) {
  if (navigator.share) { try { await navigator.share({ title, text }); return; } catch {} }
  copy(text, 'Copied — paste it wherever you need');
}

const short = a => a ? a.slice(0, 6) + '···' + a.slice(-4) : '';

/* Trims trailing zeros without falling into scientific notation. Always returns
   the machine form, with a dot — that is the one that gets parsed. */
function trim(str, max = 6) {
  if (!str.includes('.')) return str;
  let [i, d] = str.split('.');
  d = d.slice(0, max).replace(/0+$/, '');
  return d ? i + '.' + d : i;
}

const NUM = new Intl.NumberFormat('en-US', { maximumFractionDigits: 20 });
function fmt(plain) {
  if (plain == null || plain === '—' || plain === '…') return plain;
  const n = Number(plain);
  return isFinite(n) ? NUM.format(n) : plain;
}

/* Accepts what people actually type — 1.5, 1,5 and 1,234.56 alike. */
function parseAmount(raw) {
  const v = String(raw).trim().replace(/\s/g, '');
  if (v.includes('.') && v.includes(',')) return v.replace(/,/g, '');
  if (v.includes(',')) return /,\d{3}\b/.test(v) ? v.replace(/,/g, '') : v.replace(',', '.');
  return v;
}

function openSheet(id) { $(id).hidden = false; document.body.style.overflow = 'hidden'; }
function closeSheet(id) { $(id).hidden = true; document.body.style.overflow = ''; }
function closeAllSheets() { $$('.sheet-wrap').forEach(s => { if (s.id !== 'statusSheet') s.hidden = true; }); document.body.style.overflow = ''; }

function qrInto(box, text, cell) {
  box.innerHTML = '';
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  box.innerHTML = qr.createImgTag(cell || 6, 0);
  const img = box.querySelector('img');
  if (img) { img.alt = 'QR code'; img.removeAttribute('width'); img.removeAttribute('height'); }
}

/* ── Auto-lock ─────────────────────────────────────────────────────────────
   Half an hour of a phone left on a table should not cost anyone anything. */
const LOCK_MS = 5 * 60 * 1000;
function touch() {
  if (!wallet) return;
  clearTimeout(lockTimer);
  lockTimer = setTimeout(() => lock(true), LOCK_MS);
}
function lock(auto) {
  wallet = null;
  rootPhrase = null;
  clearTimeout(lockTimer);
  balances = { native: null, tokens: {} };
  closeAllSheets();
  show('unlock');
  $('#unlockPw').value = '';
  fail('#unlockErr', '');
  if (auto) toast('Locked after inactivity');
}
['click', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, touch, { passive: true }));

/* ── Plans ─────────────────────────────────────────────────────────────────
   A paid plan is one real USDC transfer to the treasury. The receipt is what
   proves it, so on every unlock the stored hash is re-checked against the
   chain: the entitlement cannot be granted by editing localStorage, only by a
   transaction that actually happened. */
const TRANSFER_TOPIC = E.id('Transfer(address,address,uint256)');

async function verifyPlan() {
  plan = 'classic';
  const rec = read(K.plan, null);
  if (!rec || !rec.hash || !TREASURY || !wallet) return paintTier();
  if (Date.now() > rec.expires) { drop(K.plan); return paintTier(); }
  if (rec.address && rec.address.toLowerCase() !== wallet.address.toLowerCase()) return paintTier();

  const c = CHAINS[rec.chainId];
  const want = PLANS[rec.plan];
  if (!c || !want) return paintTier();

  try {
    const p = new E.JsonRpcProvider(prefs.rpc[rec.chainId] || c.rpc, E.Network.from(Number(rec.chainId)), { staticNetwork: true });
    const r = await p.getTransactionReceipt(rec.hash);
    if (!r || r.status !== 1) return paintTier();

    const usdc = c.tokens.find(t => t.symbol === 'USDC');
    const need = E.parseUnits(String(want.price), usdc ? usdc.decimals : 6);
    const paid = r.logs.some(l =>
      l.topics[0] === TRANSFER_TOPIC &&
      usdc && l.address.toLowerCase() === usdc.address.toLowerCase() &&
      ('0x' + l.topics[1].slice(26)).toLowerCase() === wallet.address.toLowerCase() &&
      ('0x' + l.topics[2].slice(26)).toLowerCase() === TREASURY.toLowerCase() &&
      E.toBigInt(l.data) >= need);
    if (paid) plan = rec.plan;
  } catch { /* an unreachable node is not proof of non-payment; stay on Classic */ }
  paintTier();
}

function paintTier() {
  const t = PLANS[plan].tier;
  const root = document.documentElement.style;
  ['a', 'b', 'c', 'ink', 'veil', 'veil2'].forEach(k =>
    root.setProperty(`--tier-${k}`, `var(--${t}-${k})`));
  $('#tierBadge').textContent = PLANS[plan].name;
  $('#plansCta').textContent = plan === 'platinum' ? 'Your plan' : 'Compare plans';
  $('#acctSwitch').hidden = !has('platinum');
  $('#exportCsv').hidden = !has('gold');
  $('#fromField').hidden = !has('gold');
  paintPayees();
}

function paintPlans() {
  const box = $('#planList');
  box.innerHTML = '';
  PLAN_ORDER.forEach(id => {
    const p = PLANS[id];
    const card = document.createElement('article');
    card.className = 'plan ' + p.tier + (id === plan ? ' current' : '');
    const price = p.price ? `$${p.price}<small>/month</small>` : 'Free';
    card.innerHTML =
      `<div class="tcard ${p.tier}">` +
        '<div class="tc-sheen"></div>' +
        '<div class="tc-top"><span class="tc-brand"><span class="mark sm"></span>Ward</span><span class="tc-net"></span></div>' +
        '<span class="tc-chip"><i></i><i></i><i></i></span>' +
        '<div class="tc-bot"><span class="tc-addr"></span><span class="tc-name"></span></div>' +
      '</div>' +
      `<h3></h3><p class="plan-line"></p><p class="plan-price">${price}</p><ul class="perks"></ul>`;
    card.querySelector('.tc-net').textContent = chain().short;
    card.querySelector('.tc-addr').textContent = wallet ? short(wallet.address) : '0x···';
    card.querySelector('.tc-name').textContent = p.name;
    card.querySelector('h3').textContent = p.name;
    card.querySelector('.plan-line').textContent = p.line;
    const ul = card.querySelector('.perks');
    p.perks.forEach(x => { const li = document.createElement('li'); li.textContent = x; ul.appendChild(li); });

    const btn = document.createElement('button');
    btn.className = 'btn ' + (id === plan ? 'ghost' : 'primary') + ' wide';
    if (id === plan) { btn.textContent = 'Current plan'; btn.disabled = true; }
    else if (rank(id) < rank(plan)) { btn.textContent = 'Included'; btn.disabled = true; }
    else if (!TREASURY) { btn.textContent = 'Upgrades not set up yet'; btn.disabled = true; }
    else { btn.textContent = `Pay $${p.price} for a month`; btn.addEventListener('click', () => buyPlan(id)); }
    card.appendChild(btn);
    box.appendChild(card);
  });

  const note = $('#treasuryNote');
  if (!TREASURY) {
    note.innerHTML = '<b>Upgrades are switched off.</b> Paid plans need an address to pay into; set <code>TREASURY</code> at the top of app.js to one you control, and the buttons start working.';
    note.hidden = false;
  } else note.hidden = true;
}

function paintPlanRow() {
  const p = PLANS[plan];
  const rec = read(K.plan, null);
  const row = $('#planRow');
  row.innerHTML = `<span class="pr-badge ${p.tier}"></span><div class="li-mid"><b></b><small></small></div>`;
  row.querySelector('.pr-badge').textContent = p.name[0];
  row.querySelector('b').textContent = p.name;
  row.querySelector('small').textContent = plan === 'classic'
    ? 'Free forever'
    : 'Runs out ' + new Date(rec.expires).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const go = document.createElement('button');
  go.className = 'link-btn';
  go.textContent = plan === 'platinum' ? 'See plans' : 'Upgrade';
  go.addEventListener('click', () => show('plans'));
  row.appendChild(go);
}

async function buyPlan(id) {
  const p = PLANS[id], c = chain();
  const usdc = c.tokens.find(t => t.symbol === 'USDC');
  if (!usdc) return toast('Switch to a network with USDC first');

  const value = E.parseUnits(String(p.price), usdc.decimals);
  const held = balances.tokens.USDC;
  if (held != null && value > held) return toast(`You need $${p.price} USDC on ${c.short}`);

  try {
    const fee = await feeFor({ to: usdc.address, data: ERC20.encodeFunctionData('transfer', [TREASURY, value]) });
    draft = {
      to: TREASURY, tok: usdc, value, raw: String(p.price), fee, symbol: 'USDC',
      planBuy: id
    };
    $('#cfTitle').textContent = `Upgrade to ${p.name}`;
    $('#cfAmount').textContent = `$${p.price} USDC`;
    $('#cfTo').textContent = short(TREASURY);
    $('#cfNet').textContent = c.name + (c.test ? ' (test)' : '');
    $('#cfFee').textContent = '≈ ' + fmt(trim(E.formatEther(fee.cost), 7)) + ' ' + c.coin;
    $('#cfAfter').textContent = '30 days of ' + p.name;
    fail('#cfErr', '');
    $('#cfSend').disabled = false;
    $('#cfSend').textContent = 'Sign and pay';
    openSheet('#confirmSheet');
  } catch (err) { toast(friendly(err)); }
}

/* ── Creating a wallet ─────────────────────────────────────────────────────── */
function paintSeed(box, words) {
  box.innerHTML = '';
  words.forEach((w, i) => {
    const d = document.createElement('div');
    d.className = 'word';
    d.innerHTML = '<span class="n"></span><span class="w"></span>';
    d.querySelector('.n').textContent = i + 1;
    d.querySelector('.w').textContent = w;
    box.appendChild(d);
  });
}

function startCreate() {
  const w = E.Wallet.createRandom();
  pendingMnemonic = w.mnemonic.phrase;
  paintSeed($('#seedGrid'), pendingMnemonic.split(' '));
  $('#seedGrid').classList.remove('hidden');
  $('#blurSeed').textContent = 'Hide';
  $('#seedSaved').checked = false;
  $('#toVerify').disabled = true;
  show('create');
}

let verifyIdx = [];
function startVerify() {
  const words = pendingMnemonic.split(' ');
  const pool = [...words.keys()];
  verifyIdx = [];
  for (let i = 0; i < 3; i++) verifyIdx.push(...pool.splice(Math.floor(Math.random() * pool.length), 1));
  verifyIdx.sort((a, b) => a - b);

  const box = $('#verifyFields');
  box.innerHTML = '';
  verifyIdx.forEach(i => {
    const row = document.createElement('label');
    row.className = 'vf';
    row.innerHTML = '<b></b><input type="text" spellcheck="false" autocapitalize="none" autocomplete="off">';
    row.querySelector('b').textContent = 'Word ' + (i + 1);
    const inp = row.querySelector('input');
    inp.addEventListener('input', () => {
      row.classList.toggle('ok', inp.value.trim().toLowerCase() === words[i]);
    });
    box.appendChild(row);
  });
  fail('#verifyErr', '');
  show('verify');
}

function pwScore(p) {
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return Math.min(s, 4);
}
function paintPw() {
  const p = $('#pw1').value;
  const s = p ? pwScore(p) : 0;
  $('#pwBar').style.width = p ? [6, 28, 52, 76, 100][s] + '%' : '0';
  $('#pwBar').style.background = ['var(--danger)', 'var(--danger)', 'var(--warn)', 'var(--ok)', 'var(--brand)'][s];
  $('#pwLabel').textContent = ['', 'Very weak', 'Weak', 'Good', 'Excellent'][s] || ' ';
}

async function persist(signer, password) {
  write(K.store, await signer.encrypt(password));
  write(K.addr, signer.address);
  wallet = signer;
  rootPhrase = signer.mnemonic ? signer.mnemonic.phrase : null;
  touch();
}

/* ── Accounts (Platinum) ───────────────────────────────────────────────────
   Extra accounts are further keys derived from the same phrase, so the one
   backup the user already wrote down keeps covering all of them. */
const PATH = i => "m/44'/60'/0'/0/" + i;

function useAccount(i) {
  if (!rootPhrase) return toast('This wallet was imported from a private key, so it has no extra accounts');
  wallet = E.HDNodeWallet.fromPhrase(rootPhrase, undefined, PATH(i));
  prefs.active = i; savePrefs();
  write(K.addr, wallet.address);
  const acc = prefs.accounts.find(a => a.i === i);
  $('#acctName').textContent = acc ? acc.name : 'Account ' + (i + 1);
  $('#addrShort').textContent = short(wallet.address);
  balances = { native: null, tokens: {} };
  refresh();
  paintActivity($('#recentList'), 4);
}

function paintAccounts() {
  const list = $('#acctList');
  list.innerHTML = '';
  prefs.accounts.forEach(a => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = a.i === prefs.active ? 'sel' : '';
    b.innerHTML = '<span class="nl-mid"><b></b><small></small></span>';
    b.querySelector('b').textContent = a.name;
    let addr = '';
    try { addr = E.HDNodeWallet.fromPhrase(rootPhrase, undefined, PATH(a.i)).address; } catch {}
    b.querySelector('small').textContent = short(addr);
    b.addEventListener('click', () => { useAccount(a.i); closeSheet('#acctSheet'); });
    li.appendChild(b);
    list.appendChild(li);
  });
}

/* ── Balances ──────────────────────────────────────────────────────────────── */
async function refresh() {
  if (!wallet) return;
  const c = chain(), p = provider(), addr = wallet.address;
  const mine = ++refresh.gen;

  $('.bal-label').textContent = 'Balance on ' + c.short;
  $('#totalBal').innerHTML = '<span class="skeleton w-40"></span>';
  paintTokens(true);

  try {
    const native = await p.getBalance(addr);
    if (mine !== refresh.gen) return;
    balances.native = native;
    $('#totalBal').textContent = fmt(trim(E.formatEther(native), 6)) + ' ' + c.coin;
  } catch {
    if (mine !== refresh.gen) return;
    $('#totalBal').textContent = '—';
    toast("Couldn't read the balance. Connection?");
  }

  balances.tokens = {};
  await Promise.all(c.tokens.map(async t => {
    try {
      const bal = await new E.Contract(t.address, ERC20_ABI, p).balanceOf(addr);
      if (mine === refresh.gen) balances.tokens[t.symbol] = bal;
    } catch { /* one unreadable token must not take down the screen */ }
  }));
  if (mine !== refresh.gen) return;
  paintTokens(false);
  fillTokenSelects();
}
refresh.gen = 0;

const coinBadge = (symbol, color) => `<span class="coin" style="background:${color}">${symbol.slice(0, 4)}</span>`;

function paintTokens(loading) {
  const c = chain(), list = $('#tokenList');
  list.innerHTML = '';
  [{ symbol: c.coin, name: c.name, color: c.color, native: true }].concat(c.tokens).forEach(t => {
    let amt = '…';
    if (!loading) {
      if (t.native) amt = balances.native == null ? '—' : fmt(trim(E.formatEther(balances.native), 6));
      else amt = balances.tokens[t.symbol] == null ? '—' : fmt(trim(E.formatUnits(balances.tokens[t.symbol], t.decimals), 6));
    }
    const li = document.createElement('li');
    li.innerHTML = coinBadge(t.symbol, t.color) + '<div class="tok-mid"><b></b><small></small></div><div class="tok-amt"></div>';
    li.querySelector('b').textContent = t.symbol;
    li.querySelector('small').textContent = t.native ? 'Network coin' : t.name;
    li.querySelector('.tok-amt').textContent = amt;
    list.appendChild(li);
  });
}

function fillTokenSelects() {
  const c = chain();
  [$('#tokenSelect'), $('#chargeToken'), $('#depToken')].forEach(sel => {
    if (!sel) return;
    const keep = sel.value;
    sel.innerHTML = '';
    const opts = [{ v: 'native', l: c.coin + ' · ' + c.short + ' coin' }]
      .concat(c.tokens.map(t => ({ v: t.symbol, l: t.symbol + ' · ' + t.name })));
    opts.forEach(o => {
      const el = document.createElement('option');
      el.value = o.v; el.textContent = o.l;
      sel.appendChild(el);
    });
    if (opts.some(o => o.v === keep)) sel.value = keep;
  });
}

const tokenByKey = key => key === 'native' ? null : chain().tokens.find(t => t.symbol === key) || null;

/* ── Saved payees (Gold) ───────────────────────────────────────────────────── */
const payees = () => read(K.payees, []);
function savePayee(addr, name) {
  const l = payees().filter(p => p.addr.toLowerCase() !== addr.toLowerCase());
  l.unshift({ addr, name: name || short(addr) });
  write(K.payees, l.slice(0, 12));
}
function paintPayees() {
  const row = $('#payeeRow');
  if (!row) return;
  const l = has('gold') ? payees() : [];
  row.innerHTML = '';
  row.hidden = !l.length;
  l.forEach(p => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'payee';
    b.textContent = p.name;
    b.title = p.addr;
    b.addEventListener('click', () => { $('#toInput').value = p.addr; resolveTo(p.addr); });
    row.appendChild(b);
  });
}

/* ── Activity ──────────────────────────────────────────────────────────────── */
const acts = () => read(K.acts, []);
function pushAct(a) { const l = acts(); l.unshift(a); write(K.acts, l.slice(0, 80)); }
function patchAct(hash, patch) {
  const l = acts(); const i = l.findIndex(x => x.hash === hash);
  if (i > -1) { Object.assign(l[i], patch); write(K.acts, l); }
}
const myActs = () => acts().filter(a => a.from && wallet && a.from.toLowerCase() === wallet.address.toLowerCase());

function paintActivity(list, limit) {
  const rows = myActs().slice(0, limit);
  list.innerHTML = '';
  if (!rows.length) {
    list.innerHTML = '<li class="empty">No payments from here yet.</li>';
    return;
  }
  rows.forEach(a => {
    const c = CHAINS[a.chainId];
    const cls = a.status === 'ok' ? 'ok' : a.status === 'fail' ? 'fail' : 'pend';
    const tag = a.status === 'ok' ? 'Confirmed' : a.status === 'fail' ? 'Rejected' : 'On its way';
    const icon = cls === 'pend'
      ? '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 8v4.5l3 1.6"/></svg>'
      : cls === 'ok'
        ? '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'
        : '<svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7L7 17"/></svg>';
    const li = document.createElement('li');
    li.innerHTML = `<span class="act-badge ${cls}">${icon}</span>` +
      '<div class="tok-mid"><b></b><small></small></div>' +
      `<div class="tok-amt"><div></div><span class="st-tag ${cls}">${tag}</span></div>`;
    li.querySelector('b').textContent = a.kind === 'plan' ? PLANS[a.plan].name + ' plan' : 'To ' + short(a.to);
    li.querySelector('small').textContent = (c ? c.short : 'Chain ' + a.chainId) + ' · ' +
      new Date(a.ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    li.querySelector('.tok-amt div').textContent = '−' + fmt(a.amount) + ' ' + a.symbol;
    if (c) {
      li.style.cursor = 'pointer';
      li.addEventListener('click', () => window.open(c.explorer + '/tx/' + a.hash, '_blank', 'noopener'));
    }
    list.appendChild(li);
  });
}

function exportCsv() {
  const rows = [['date', 'network', 'to', 'amount', 'coin', 'status', 'tx']];
  myActs().forEach(a => {
    const c = CHAINS[a.chainId];
    rows.push([new Date(a.ts).toISOString(), c ? c.name : a.chainId, a.to, a.amount, a.symbol, a.status, a.hash]);
  });
  const csv = rows.map(r => r.map(f => `"${String(f).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = 'ward-activity.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('CSV downloaded');
}

/* Payments left hanging (tab closed, slow network) are reconciled against the
   chain on the way back: the blockchain is the source of truth, not this list. */
async function reconcile() {
  for (const a of acts().filter(x => x.status === 'pending')) {
    const c = CHAINS[a.chainId];
    if (!c) continue;
    try {
      const p = new E.JsonRpcProvider(prefs.rpc[a.chainId] || c.rpc, E.Network.from(Number(a.chainId)), { staticNetwork: true });
      const r = await p.getTransactionReceipt(a.hash);
      if (r) patchAct(a.hash, { status: r.status === 1 ? 'ok' : 'fail' });
    } catch {}
  }
  if (wallet) { paintActivity($('#recentList'), 4); paintActivity($('#allList'), 100); }
}

/* ── Sending ───────────────────────────────────────────────────────────────── */
let resolveSeq = 0;
async function resolveTo(raw) {
  const v = String(raw).trim();
  const hint = $('#toHint');
  if (!v) { hint.textContent = ''; hint.className = 'hint'; return null; }
  if (E.isAddress(v)) {
    hint.textContent = 'Valid address';
    hint.className = 'hint good';
    return E.getAddress(v);
  }
  if (/^[\w-]+(\.[\w-]+)+$/.test(v)) {
    const seq = ++resolveSeq;
    hint.textContent = 'Looking up ' + v + '…';
    hint.className = 'hint';
    try {
      const mp = new E.JsonRpcProvider(CHAINS[1].rpc, E.Network.from(1), { staticNetwork: true });
      const addr = await mp.resolveName(v);
      if (seq !== resolveSeq) return null;
      if (addr) { hint.textContent = v + ' → ' + short(addr); hint.className = 'hint good'; return addr; }
      hint.textContent = "That name doesn't point anywhere"; hint.className = 'hint bad';
      return null;
    } catch {
      if (seq === resolveSeq) { hint.textContent = "Couldn't look that name up"; hint.className = 'hint bad'; }
      return null;
    }
  }
  hint.textContent = "That's neither an address nor a .eth name";
  hint.className = 'hint bad';
  return null;
}

async function feeFor(tx) {
  const p = provider();
  const [fd, gas] = await Promise.all([p.getFeeData(), p.estimateGas(Object.assign({ from: wallet.address }, tx))]);
  const price = fd.maxFeePerGas || fd.gasPrice;
  const limit = (gas * 120n) / 100n;      // headroom: an exact limit runs short
  return { limit, price, cost: limit * (price || 0n), fd };
}

async function review() {
  fail('#sendErr', '');
  const to = await resolveTo($('#toInput').value);
  if (!to) return fail('#sendErr', 'Check the recipient before going on.');

  const tok = tokenByKey($('#tokenSelect').value);
  const c = chain();
  const raw = parseAmount($('#amtInput').value);
  if (!raw || !/^\d*\.?\d*$/.test(raw) || Number(raw) <= 0) return fail('#sendErr', 'Enter an amount greater than zero.');

  let value;
  try { value = tok ? E.parseUnits(raw, tok.decimals) : E.parseEther(raw); }
  catch { return fail('#sendErr', `That amount has too many decimals for ${tok ? tok.symbol : c.coin}.`); }

  const held = tok ? balances.tokens[tok.symbol] : balances.native;
  if (held != null && value > held) return fail('#sendErr', `You don't have that much ${tok ? tok.symbol : c.coin} on ${c.short}.`);

  $('#reviewBtn').disabled = true;
  $('#reviewBtn').textContent = 'Working out the fee…';
  try {
    const tx = tok
      ? { to: tok.address, data: ERC20.encodeFunctionData('transfer', [to, value]) }
      : { to, value };
    const fee = await feeFor(tx);

    if (!tok && balances.native != null && value + fee.cost > balances.native)
      throw new Error(`You're short of ${c.coin} to cover the amount plus the fee. Try MAX.`);
    if (tok && balances.native != null && fee.cost > balances.native)
      throw new Error(`You need a little ${c.coin} on ${c.short} to pay the network fee.`);

    draft = { to, tok, value, raw, fee, symbol: tok ? tok.symbol : c.coin };

    $('#cfTitle').textContent = 'Confirm the payment';
    $('#cfAmount').textContent = fmt(trim(raw, 8)) + ' ' + draft.symbol;
    $('#cfTo').textContent = short(to);
    $('#cfNet').textContent = c.name + (c.test ? ' (test)' : '');
    $('#cfFee').textContent = '≈ ' + fmt(trim(E.formatEther(fee.cost), 7)) + ' ' + c.coin;
    $('#cfAfter').textContent = tok
      ? (balances.tokens[tok.symbol] != null ? fmt(trim(E.formatUnits(balances.tokens[tok.symbol] - value, tok.decimals), 6)) + ' ' + tok.symbol : '—')
      : (balances.native != null ? fmt(trim(E.formatEther(balances.native - value - fee.cost), 6)) + ' ' + c.coin : '—');
    fail('#cfErr', '');
    $('#cfSend').disabled = false;
    $('#cfSend').textContent = 'Sign and send';
    openSheet('#confirmSheet');
  } catch (err) {
    fail('#sendErr', friendly(err));
  } finally {
    $('#reviewBtn').disabled = false;
    $('#reviewBtn').textContent = 'Review payment';
  }
}

function friendly(err) {
  const m = (err && (err.shortMessage || err.reason || err.message) || '').toString();
  if (/user rejected|user denied|4001/i.test(m)) return 'You turned the request down in the other wallet.';
  if (/insufficient funds/i.test(m)) return 'Not enough balance for the amount plus the network fee.';
  if (/transfer amount exceeds balance/i.test(m)) return "You don't have that many tokens on this network.";
  if (/could not detect network|network|fetch|timeout/i.test(m)) return "Couldn't reach the network. Check your connection or change the RPC in Settings.";
  if (/nonce/i.test(m)) return 'Another payment of yours is still in flight. Wait for it to confirm and try again.';
  if (/replacement fee too low/i.test(m)) return 'There is already an identical payment pending. Wait for it to confirm.';
  return m || 'Something went wrong.';
}

async function doSend() {
  if (!draft || !wallet) return;
  $('#cfSend').disabled = true;
  $('#cfSend').textContent = 'Signing…';
  const c = chain();

  try {
    const signer = wallet.connect(provider());
    const over = { gasLimit: draft.fee.limit };
    if (draft.fee.fd.maxFeePerGas) {
      over.maxFeePerGas = draft.fee.fd.maxFeePerGas;
      over.maxPriorityFeePerGas = draft.fee.fd.maxPriorityFeePerGas;
    } else over.gasPrice = draft.fee.price;

    const tx = draft.tok
      ? await new E.Contract(draft.tok.address, ERC20_ABI, signer).transfer(draft.to, draft.value, over)
      : await signer.sendTransaction(Object.assign({ to: draft.to, value: draft.value }, over));

    const buying = draft.planBuy;
    closeSheet('#confirmSheet');
    statusSheet('sending', tx.hash);

    pushAct({
      hash: tx.hash, chainId: Number(prefs.chainId), from: wallet.address, to: draft.to,
      amount: trim(draft.raw, 8), symbol: draft.symbol, ts: Date.now(), status: 'pending',
      kind: buying ? 'plan' : 'send', plan: buying || undefined
    });

    let receipt = null;
    try { receipt = await tx.wait(1, 120000); } catch {}

    if (receipt && receipt.status === 1) {
      patchAct(tx.hash, { status: 'ok' });
      if (buying) {
        write(K.plan, {
          plan: buying, hash: tx.hash, chainId: Number(prefs.chainId),
          address: wallet.address, paidAt: Date.now(),
          expires: Date.now() + 30 * 24 * 3600 * 1000
        });
        await verifyPlan();
        statusSheet('plan', tx.hash, `${PLANS[buying].name} is on for the next 30 days.`);
      } else {
        if (has('gold')) savePayee(draft.to);
        statusSheet('ok', tx.hash);
      }
    } else if (receipt) {
      patchAct(tx.hash, { status: 'fail' });
      statusSheet('fail', tx.hash, "The network rejected it. Your money didn't move, apart from the fee.");
    } else {
      statusSheet('slow', tx.hash);
    }

    $('#toInput').value = ''; $('#amtInput').value = ''; $('#toHint').textContent = '';
    $('#payNote').hidden = true; prefill = null;
    draft = null;
    refresh();
    paintActivity($('#recentList'), 4);
    paintPayees();
  } catch (err) {
    fail('#cfErr', friendly(err));
    $('#cfSend').disabled = false;
    $('#cfSend').textContent = 'Sign and send';
  }
}

function statusSheet(state, hash, msg) {
  const c = chain();
  const icon = $('#stIcon'), link = $('#stLink'), done = $('#stDone');
  openSheet('#statusSheet');
  icon.className = 'status-icon';
  link.hidden = !hash;
  if (hash) link.href = c.explorer + '/tx/' + hash;
  done.hidden = state === 'sending';

  if (state === 'sending') {
    icon.innerHTML = '<span class="spin"></span>';
    $('#stTitle').textContent = 'Sending…';
    $('#stText').textContent = 'Your payment is on the network. It usually takes a few seconds.';
  } else if (state === 'ok' || state === 'plan') {
    icon.className = 'status-icon ok';
    icon.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
    $('#stTitle').textContent = state === 'plan' ? 'Plan active' : 'Payment confirmed';
    $('#stText').textContent = msg || `It's recorded on ${c.name} now. That's final.`;
  } else if (state === 'slow') {
    icon.innerHTML = '<svg viewBox="0 0 24 24" style="stroke:var(--warn)"><circle cx="12" cy="12" r="8.5"/><path d="M12 8v4.5l3 1.6"/></svg>';
    $('#stTitle').textContent = 'Still on its way';
    $('#stText').textContent = 'The network is slow. It was sent and will confirm on its own; you can follow it in the explorer.';
  } else {
    icon.className = 'status-icon fail';
    icon.innerHTML = '<svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7L7 17"/></svg>';
    $('#stTitle').textContent = "Didn't go through";
    $('#stText').textContent = msg || 'Try again.';
  }
}

async function useMax() {
  const tok = tokenByKey($('#tokenSelect').value);
  if (tok) {
    const b = balances.tokens[tok.symbol];
    if (b == null) return toast("I don't know your balance yet");
    $('#amtInput').value = trim(E.formatUnits(b, tok.decimals), tok.decimals);
    return;
  }
  if (balances.native == null) return toast("I don't know your balance yet");
  $('#maxBtn').textContent = '…';
  try {
    const to = E.isAddress($('#toInput').value.trim()) ? $('#toInput').value.trim() : wallet.address;
    const fee = await feeFor({ to, value: 1n });
    const left = balances.native - fee.cost;
    if (left <= 0n) { $('#amtInput').value = '0'; toast('The fee would take your whole balance'); }
    else $('#amtInput').value = trim(E.formatEther(left), 8);
    $('#amtHint').textContent = 'The estimated network fee is left out.';
  } catch { toast("Couldn't estimate the fee"); }
  finally { $('#maxBtn').textContent = 'MAX'; }
}

/* ── Topping up from another wallet ────────────────────────────────────────
   Wallets announce themselves under EIP-6963, which is how MetaMask, Coinbase
   Wallet, Phantom, Rainbow and the rest can coexist in one browser — the old
   window.ethereum is a single slot they used to fight over. Ward never sees
   the other wallet's keys: it asks, the other wallet signs. */
const found = new Map();

window.addEventListener('eip6963:announceProvider', e => {
  const d = e.detail;
  if (d && d.info && d.provider) { found.set(d.info.uuid, d); paintDeposit(); }
});
function scanWallets() {
  window.dispatchEvent(new Event('eip6963:requestProvider'));
  /* Wallets that predate EIP-6963, and Phantom's EVM side, still need asking. */
  if (window.ethereum && !found.size) {
    found.set('legacy', { info: { uuid: 'legacy', name: window.ethereum.isMetaMask ? 'MetaMask' : 'Browser wallet', icon: '' }, provider: window.ethereum });
  }
  const ph = window.phantom && window.phantom.ethereum;
  if (ph && ![...found.values()].some(f => /phantom/i.test(f.info.name))) {
    found.set('phantom', { info: { uuid: 'phantom', name: 'Phantom', icon: '' }, provider: ph });
  }
}

function paintDeposit() {
  const list = $('#walletList');
  if (!list) return;
  $('#depIntro').hidden = !!linked;
  $('#depForm').hidden = !linked;
  if (linked) return;

  list.innerHTML = '';
  const all = [...found.values()];
  if (!all.length) {
    $('#walletHint').textContent = 'No wallet extension detected in this browser.';
    return;
  }
  $('#walletHint').textContent = '';
  all.forEach(w => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    const ic = w.info.icon
      ? `<img class="li-icon" src="${w.info.icon}" alt="">`
      : '<span class="li-icon gen"></span>';
    b.innerHTML = ic + '<span class="li-mid"><b></b><small>Connect and top up</small></span>';
    b.querySelector('b').textContent = w.info.name;
    b.addEventListener('click', () => linkWallet(w));
    li.appendChild(b);
    list.appendChild(li);
  });
}

async function linkWallet(w) {
  const c = chain();
  try {
    const accounts = await w.provider.request({ method: 'eth_requestAccounts' });
    if (!accounts || !accounts.length) throw new Error('No account was shared.');

    const hex = '0x' + Number(prefs.chainId).toString(16);
    try {
      await w.provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex }] });
    } catch (err) {
      /* 4902 means the wallet has never heard of this chain; offer to add it. */
      if (err && (err.code === 4902 || (err.data && err.data.originalError && err.data.originalError.code === 4902))) {
        await w.provider.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: hex, chainName: c.name,
            nativeCurrency: { name: c.coin, symbol: c.coin, decimals: 18 },
            rpcUrls: [c.rpc], blockExplorerUrls: [c.explorer]
          }]
        });
      } else throw err;
    }

    linked = { info: w.info, provider: w.provider, address: E.getAddress(accounts[0]) };
    w.provider.on && w.provider.on('accountsChanged', a => {
      if (!a || !a.length) { linked = null; paintDeposit(); return; }
      linked.address = E.getAddress(a[0]); paintDeposit(); linkedBalance();
    });

    $('#linkedName').textContent = w.info.name;
    $('#linkedAddr').textContent = short(linked.address);
    $('#linkedIcon').innerHTML = w.info.icon ? `<img src="${w.info.icon}" alt="">` : '';
    fillTokenSelects();
    paintDeposit();
    linkedBalance();
    toast('Connected to ' + w.info.name);
  } catch (err) {
    toast(friendly(err));
  }
}

async function linkedBalance() {
  if (!linked) return;
  const c = chain();
  $('#linkedBal').textContent = 'Reading its balance…';
  try {
    const tok = tokenByKey($('#depToken').value);
    const p = provider();
    const b = tok
      ? await new E.Contract(tok.address, ERC20_ABI, p).balanceOf(linked.address)
      : await p.getBalance(linked.address);
    const txt = tok ? trim(E.formatUnits(b, tok.decimals), 6) : trim(E.formatEther(b), 6);
    linked.balance = b; linked.tok = tok;
    $('#linkedBal').textContent = `Available there: ${fmt(txt)} ${tok ? tok.symbol : c.coin}`;
  } catch { $('#linkedBal').textContent = ''; }
}

async function depositIn() {
  if (!linked || !wallet) return;
  fail('#depErr', '');
  const tok = tokenByKey($('#depToken').value);
  const c = chain();
  const raw = parseAmount($('#depAmt').value);
  if (!raw || !/^\d*\.?\d*$/.test(raw) || Number(raw) <= 0) return fail('#depErr', 'Enter an amount greater than zero.');

  let value;
  try { value = tok ? E.parseUnits(raw, tok.decimals) : E.parseEther(raw); }
  catch { return fail('#depErr', 'Too many decimals for that coin.'); }

  const btn = $('#depSend');
  btn.disabled = true; btn.textContent = 'Waiting for the other wallet…';
  try {
    const tx = tok
      ? { from: linked.address, to: tok.address, data: ERC20.encodeFunctionData('transfer', [wallet.address, value]) }
      : { from: linked.address, to: wallet.address, value: '0x' + value.toString(16) };
    const hash = await linked.provider.request({ method: 'eth_sendTransaction', params: [tx] });

    statusSheet('sending', hash);
    $('#stTitle').textContent = 'Topping up…';
    $('#stText').textContent = `${fmt(trim(raw, 8))} ${tok ? tok.symbol : c.coin} on the way from ${linked.info.name}.`;

    let r = null;
    for (let i = 0; i < 60 && !r; i++) {
      try { r = await provider().getTransactionReceipt(hash); } catch {}
      if (!r) await new Promise(s => setTimeout(s, 2000));
    }
    if (r && r.status === 1) {
      statusSheet('ok', hash, 'The funds are in your Ward wallet.');
      $('#stTitle').textContent = 'Topped up';
      $('#depAmt').value = '';
      refresh(); linkedBalance();
    } else if (r) statusSheet('fail', hash, 'The network rejected the transfer.');
    else statusSheet('slow', hash);
  } catch (err) {
    fail('#depErr', friendly(err));
  } finally {
    btn.disabled = false; btn.textContent = 'Send to my Ward wallet';
  }
}

/* ── Receive and request ───────────────────────────────────────────────────── */
function paintReceive() {
  if (!wallet) return;
  const c = chain();
  $('#addrFull').textContent = wallet.address;
  $('#recvNet').textContent = c.name + (c.test ? ' (test network)' : '') + ' only';
  $('#recvDot').style.background = c.color;
  qrInto($('#qrBox'), 'ethereum:' + wallet.address + '@' + prefs.chainId, 6);
}

function payLink() {
  const amt = parseAmount($('#chargeAmt').value);
  const note = $('#chargeNote').value.trim();
  const from = has('gold') ? $('#chargeFrom').value.trim() : '';
  const p = new URLSearchParams({ to: wallet.address, chain: String(prefs.chainId), token: $('#chargeToken').value });
  if (amt && Number(amt) > 0) p.set('amount', amt);
  if (note) p.set('note', note);
  if (from) p.set('from', from.slice(0, 32));
  return location.origin + location.pathname + '#/pay?' + p.toString();
}

function readPayHash() {
  const h = location.hash || '';
  const i = h.indexOf('?');
  if (!h.startsWith('#/pay') || i < 0) return null;
  const q = new URLSearchParams(h.slice(i + 1));
  const to = q.get('to');
  if (!to || !E.isAddress(to)) return null;
  const cid = Number(q.get('chain'));
  return {
    to: E.getAddress(to),
    chainId: CHAINS[cid] ? cid : prefs.chainId,
    token: q.get('token') || 'native',
    amount: q.get('amount') || '',
    note: (q.get('note') || '').slice(0, 60),
    from: (q.get('from') || '').slice(0, 32)
  };
}

function applyPrefill() {
  if (!prefill || !wallet) return;
  if (prefill.chainId !== prefs.chainId) {
    prefs.chainId = prefill.chainId; savePrefs(); paintNet(); refresh();
  }
  fillTokenSelects();
  $('#toInput').value = prefill.to;
  const known = prefill.token === 'native' || !!tokenByKey(prefill.token);
  $('#tokenSelect').value = known ? prefill.token : 'native';
  $('#amtInput').value = prefill.amount;
  resolveTo(prefill.to);
  const c = CHAINS[prefill.chainId];
  const note = $('#payNote');
  note.innerHTML = '<b></b><span></span>';
  note.querySelector('b').textContent = prefill.from ? prefill.from + ' is asking you to pay' : "You're being asked to pay";
  note.querySelector('span').textContent =
    (prefill.note ? prefill.note + ' · ' : '') + `Payment on ${c.short}. Check the amount and confirm.`;
  note.hidden = false;
  show('send');
  history.replaceState(null, '', location.pathname);
}

/* ── Network ───────────────────────────────────────────────────────────────── */
function paintNet() {
  const c = chain();
  $('#netName').textContent = c.short;
  $('#netDot').style.background = c.color;
}

function paintNetList() {
  const list = $('#netList');
  list.innerHTML = '';
  CHAIN_ORDER.forEach(id => {
    const c = CHAINS[id];
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = id === Number(prefs.chainId) ? 'sel' : '';
    b.innerHTML = `<span class="dot" style="background:${c.color};width:11px;height:11px"></span>` +
      '<span class="nl-mid"><b></b><small></small></span>' +
      (c.test ? '<span class="test-tag">TEST</span>' : '');
    b.querySelector('b').textContent = c.name;
    b.querySelector('small').textContent = c.blurb;
    b.addEventListener('click', () => {
      prefs.chainId = id; savePrefs();
      linked = null;
      paintNet(); fillTokenSelects(); closeSheet('#netSheet'); refresh(); verifyPlan();
      toast("You're on " + c.name + ' now');
    });
    li.appendChild(b);
    list.appendChild(li);
  });
}

/* ── Boot ──────────────────────────────────────────────────────────────────── */
function enterWallet() {
  paintNet();
  fillTokenSelects();
  const acc = prefs.accounts.find(a => a.i === prefs.active);
  $('#acctName').textContent = acc ? acc.name : 'Account 1';
  $('#addrShort').textContent = short(wallet.address);
  show('home');
  refresh();
  paintActivity($('#recentList'), 4);
  reconcile();
  verifyPlan();
  scanWallets();
  touch();
  if (prefill) applyPrefill();
}

function boot() {
  $('#versionLine').textContent = 'Ward · ethers ' + (E.version || '6') + ' · everything runs in your browser';
  prefill = readPayHash();
  paintNet();
  paintNetList();
  fillTokenSelects();
  paintTier();
  scanWallets();
  show(read(K.store, null) ? 'unlock' : 'welcome');
}

/* ── Wiring ────────────────────────────────────────────────────────────────── */
$$('[data-go]').forEach(b => b.addEventListener('click', () => show(b.dataset.go)));
/* Only this button makes a new phrase. Stepping back from the check shows the
   same one: regenerating would void what they already wrote down. */
$('#startCreate').addEventListener('click', startCreate);
$$('[data-close-sheet]').forEach(b => b.addEventListener('click', () => closeAllSheets()));

$('#brandHome').addEventListener('click', () => wallet && show('home'));
$('#netPill').addEventListener('click', () => { paintNetList(); openSheet('#netSheet'); });
$('#lockBtn').addEventListener('click', () => lock(false));
$('#lockNow').addEventListener('click', () => lock(false));

$('#acctSwitch').addEventListener('click', () => { paintAccounts(); openSheet('#acctSheet'); });
$('#addAcct').addEventListener('click', () => {
  if (!rootPhrase) return toast('This wallet has no recovery phrase, so it has no extra accounts');
  const i = Math.max(...prefs.accounts.map(a => a.i)) + 1;
  prefs.accounts.push({ i, name: 'Account ' + (i + 1) });
  savePrefs();
  useAccount(i);
  paintAccounts();
  closeSheet('#acctSheet');
});

$('#copySeed').addEventListener('click', () => copy(pendingMnemonic, 'Phrase copied — paste it into your manager and clear the clipboard'));
$('#blurSeed').addEventListener('click', () => {
  const g = $('#seedGrid'); g.classList.toggle('hidden');
  $('#blurSeed').textContent = g.classList.contains('hidden') ? 'Show' : 'Hide';
});
$('#seedSaved').addEventListener('change', e => { $('#toVerify').disabled = !e.target.checked; });
$('#toVerify').addEventListener('click', startVerify);

$('#toPass').addEventListener('click', () => {
  const words = pendingMnemonic.split(' ');
  const inputs = $$('#verifyFields input');
  if (verifyIdx.some((idx, i) => inputs[i].value.trim().toLowerCase() !== words[idx]))
    return fail('#verifyErr', "One of the words doesn't match. Take another careful look.");
  fail('#verifyErr', '');
  pendingImport = null;
  $('#pw1').value = ''; $('#pw2').value = ''; paintPw(); fail('#pwErr', '');
  show('password');
});

$('#pw1').addEventListener('input', paintPw);
$('#passBack').addEventListener('click', () => show(pendingImport ? 'import' : 'verify'));

$('#doCreate').addEventListener('click', async () => {
  const a = $('#pw1').value, b = $('#pw2').value;
  if (a.length < 8) return fail('#pwErr', 'Use at least 8 characters.');
  if (a !== b) return fail('#pwErr', "The two passwords don't match.");
  fail('#pwErr', '');
  const btn = $('#doCreate');
  btn.disabled = true; btn.textContent = 'Encrypting…';
  try {
    await persist(pendingImport || E.HDNodeWallet.fromPhrase(pendingMnemonic), a);
    pendingMnemonic = null; pendingImport = null;
    $('#pw1').value = ''; $('#pw2').value = '';
    enterWallet();
    toast('Wallet ready');
  } catch (err) {
    fail('#pwErr', friendly(err));
  } finally { btn.disabled = false; btn.textContent = 'Encrypt and open'; }
});

$('#doImport').addEventListener('click', () => {
  const raw = $('#importInput').value.trim().replace(/\s+/g, ' ').toLowerCase();
  fail('#importErr', '');
  try {
    if (/^(0x)?[0-9a-f]{64}$/.test(raw.replace(/\s/g, ''))) {
      const pk = raw.replace(/\s/g, '');
      pendingImport = new E.Wallet(pk.startsWith('0x') ? pk : '0x' + pk);
    } else if (E.Mnemonic.isValidMnemonic(raw)) {
      pendingImport = E.HDNodeWallet.fromPhrase(raw);
    } else {
      return fail('#importErr', "That's neither a valid phrase nor a private key. Check the order and spelling of the words.");
    }
  } catch {
    return fail('#importErr', "Couldn't read that. Check it's complete.");
  }
  $('#importInput').value = '';
  pendingMnemonic = null;
  $('#pw1').value = ''; $('#pw2').value = ''; paintPw(); fail('#pwErr', '');
  show('password');
});

$('#doUnlock').addEventListener('click', async () => {
  const pw = $('#unlockPw').value;
  if (!pw) return fail('#unlockErr', 'Type your password.');
  const btn = $('#doUnlock');
  btn.disabled = true; btn.textContent = 'Opening…';
  fail('#unlockErr', '');
  try {
    const w = await E.Wallet.fromEncryptedJson(read(K.store, ''), pw);
    rootPhrase = w.mnemonic ? w.mnemonic.phrase : null;
    wallet = (rootPhrase && prefs.active) ? E.HDNodeWallet.fromPhrase(rootPhrase, undefined, PATH(prefs.active)) : w;
    $('#unlockPw').value = '';
    enterWallet();
  } catch {
    fail('#unlockErr', 'Wrong password.');
  } finally { btn.disabled = false; btn.textContent = 'Open'; }
});
$('#unlockPw').addEventListener('keydown', e => { if (e.key === 'Enter') $('#doUnlock').click(); });

$('#forgot').addEventListener('click', () => {
  toast('Recover it with your 12 words: Import a wallet');
  setTimeout(() => show('import'), 900);
});

$('#addrChip').addEventListener('click', () => copy(wallet.address, 'Address copied'));
$('#copyAddr').addEventListener('click', () => copy(wallet.address, 'Address copied'));
$('#shareAddr').addEventListener('click', () => share(wallet.address, 'My address'));

$('#toInput').addEventListener('change', e => resolveTo(e.target.value));
$('#toInput').addEventListener('blur', e => resolveTo(e.target.value));
$('#tokenSelect').addEventListener('change', () => { $('#amtHint').textContent = ''; });
$('#maxBtn').addEventListener('click', useMax);
$('#reviewBtn').addEventListener('click', review);
$('#cfSend').addEventListener('click', doSend);
$('#stDone').addEventListener('click', () => { closeSheet('#statusSheet'); show('home'); });
$('#exportCsv').addEventListener('click', exportCsv);

$('#depToken').addEventListener('change', linkedBalance);
$('#depSend').addEventListener('click', depositIn);
$('#depMax').addEventListener('click', () => {
  if (linked && linked.balance != null) {
    const t = linked.tok;
    /* Native coin: leave a little behind or there is nothing left to pay the
       fee with, and the transfer fails on the other wallet's side. */
    const keep = t ? 0n : (linked.balance / 50n);
    const left = linked.balance - keep;
    $('#depAmt').value = left > 0n ? trim(t ? E.formatUnits(left, t.decimals) : E.formatEther(left), 8) : '0';
  }
});
$('#unlinkBtn').addEventListener('click', () => { linked = null; paintDeposit(); });

$('#makeLink').addEventListener('click', () => {
  const url = payLink();
  $('#linkText').textContent = url;
  qrInto($('#chargeQr'), url, 4);
  $('#linkOut').hidden = false;
  $('#linkOut').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});
$('#copyLink').addEventListener('click', () => copy($('#linkText').textContent, 'Payment link copied'));
$('#shareLink').addEventListener('click', () => share($('#linkText').textContent, 'Payment request'));

$('#saveRpc').addEventListener('click', () => {
  const v = $('#rpcInput').value.trim();
  /* https only, except a node on this same machine: sending signed traffic over
     open http would hand it to the local network. */
  const ok = /^https:\/\//i.test(v) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(v);
  if (v && !ok) return toast('The RPC must start with https://');
  if (v) prefs.rpc[prefs.chainId] = v; else delete prefs.rpc[prefs.chainId];
  savePrefs(); _provider = null;
  toast(v ? 'RPC saved' : 'Back to the public node');
  refresh();
});

$('#revealSeed').addEventListener('click', () => {
  $('#seedGateWrap').hidden = false;
  $('#seedShowWrap').hidden = true;
  $('#seedPw').value = ''; fail('#seedErr', '');
  openSheet('#seedSheet');
});
$('#seedGo').addEventListener('click', async () => {
  const btn = $('#seedGo');
  btn.disabled = true; btn.textContent = 'Decrypting…';
  try {
    const w = await E.Wallet.fromEncryptedJson(read(K.store, ''), $('#seedPw').value);
    if (!w.mnemonic) { fail('#seedErr', 'This wallet was imported from a private key, so it has no phrase.'); return; }
    paintSeed($('#seedShow'), w.mnemonic.phrase.split(' '));
    $('#seedShow').dataset.phrase = w.mnemonic.phrase;
    $('#seedGateWrap').hidden = true;
    $('#seedShowWrap').hidden = false;
  } catch {
    fail('#seedErr', 'Wrong password.');
  } finally { btn.disabled = false; btn.textContent = 'Show'; $('#seedPw').value = ''; }
});
$('#seedCopy2').addEventListener('click', () => copy($('#seedShow').dataset.phrase, 'Phrase copied'));

$('#exportKs').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([read(K.store, '')], { type: 'application/json' }));
  a.download = 'ward-' + short(read(K.addr, '')).replace(/·/g, '') + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('Encrypted backup downloaded — it still needs your password');
});

$('#wipe').addEventListener('click', () => {
  if (!confirm('This will erase the encrypted wallet from this device.\n\nWithout your recovery phrase you will NOT be able to get back in, or recover the funds. Sure?')) return;
  if (!confirm('Last check: do you have your 12 words saved?')) return;
  [K.store, K.addr, K.acts, K.plan, K.payees].forEach(drop);
  wallet = null;
  location.reload();
});

/* Escape closes any sheet except a payment in flight: there is nothing to
   cancel there, the transaction is already on the network. */
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const st = $('#statusSheet');
  if (!st.hidden && $('#stDone').hidden) return;
  if (!st.hidden) { closeSheet('#statusSheet'); show('home'); return; }
  closeAllSheets();
});

window.addEventListener('hashchange', () => {
  const p = readPayHash();
  if (!p) return;
  prefill = p;
  if (wallet) applyPrefill();
});

boot();
})();
