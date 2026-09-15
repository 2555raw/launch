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
   buyer is on. It is the owner's address and it is public by necessity: it is
   where people pay, so it ships in this file and anyone can read it. That is
   fine. It receives, it cannot spend: spending needs the key, which is not
   here and never will be.

   Change it only to an address whose key you hold. A typo here sends every
   payment somewhere no one can reach, and nothing on a chain can be undone. */
const TREASURY = '0xB5530232ee1DEA37C57Dc72e7aBD7b551C62c3B6';

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
    name: 'Gold', price: window.WARD_PLAN_PRICES.gold, tier: 'gold',
    line: 'For people who get paid through it',
    perks: [
      'Everything in Classic',
      'The Gold card',
      'Saved payees, so you stop retyping addresses',
      'Your name on every payment request',
      'Export your activity as a CSV'
    ]
  },
  platinum: {
    name: 'Platinum', price: window.WARD_PLAN_PRICES.platinum, tier: 'plat',
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
const CHAINS = window.WARD_CHAINS;
const CHAIN_ORDER = [8453, 137, 42161, 10, 1];

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

let prefs = Object.assign({ chainId: 8453, rpc: {}, accounts: [{ i: 0, name: '' }], active: 0 }, read(K.prefs, {}));
if (!CHAINS[prefs.chainId]) prefs.chainId = 8453;
if (!Array.isArray(prefs.accounts) || !prefs.accounts.length) prefs.accounts = [{ i: 0, name: '' }];
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
/* Set when the landing page's Get Gold / Get Platinum link is followed, so the
   purchase opens by itself once the wallet is unlocked. */
let planWanted = null;
let topUpWanted = false;
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

/* ── Language ──────────────────────────────────────────────────────────────
   The dictionary is app-i18n.js; the choice is shared with the landing page
   through ward.v1.lang, so picking Spanish on the front page opens the wallet
   in Spanish. English is the default and only a deliberate choice changes it:
   guessing from navigator.language put people in a language they had not asked
   for. */
const DICT = window.WARD_APP_I18N || {};
const HTML_LANG = { en: 'en', es: 'es', zh: 'zh-Hans', ru: 'ru' };
const LANG_KEY = 'ward.v1.lang';
const LANGS = [
  { id: 'en', short: 'EN', name: 'English' },
  { id: 'es', short: 'ES', name: 'Español' },
  { id: 'zh', short: '中文', name: '中文（简体）' },
  { id: 'ru', short: 'RU', name: 'Русский' }
];

let lang = 'en';
try { const saved = localStorage.getItem(LANG_KEY); if (saved && DICT[saved]) lang = saved; } catch { /* storage blocked */ }

/* tr('w.balanceon', { net: 'Base' }). Falls back to English, and then to the key
   itself, so a missing translation shows English rather than nothing. */
/* Dates follow the chosen language. Numbers deliberately do not: a comma as
   the decimal separator is how 1.284 ETH gets read as 1284. */
const DATE_LOCALE = { en: 'en-GB', es: 'es-ES', zh: 'zh-CN', ru: 'ru-RU' };
const dateLocale = () => DATE_LOCALE[lang] || 'en-GB';

function tr(key, vars) {
  let str = (DICT[lang] && DICT[lang][key]) || (DICT.en && DICT.en[key]) || key;
  if (vars) for (const k of Object.keys(vars)) str = str.split('{' + k + '}').join(vars[k]);
  return str;
}

function applyLang(id) {
  if (!DICT[id]) return;
  lang = id;
  try { localStorage.setItem(LANG_KEY, id); } catch { /* this session only */ }
  document.documentElement.lang = HTML_LANG[id] || id;

  $$('[data-i18n]').forEach(el => { const v = tr(el.dataset.i18n); if (v) el.innerHTML = v; });
  $$('[data-i18n-ph]').forEach(el => { const v = tr(el.dataset.i18nPh); if (v) el.placeholder = v; });
  $$('[data-i18n-label]').forEach(el => { const v = tr(el.dataset.i18nLabel); if (v) el.setAttribute('aria-label', v); });

  const now = LANGS.find(l => l.id === id);
  if ($('#langNow')) $('#langNow').textContent = now ? now.short : id.toUpperCase();
  $$('#langList button').forEach(b => b.classList.toggle('sel', b.dataset.lang === id));

  /* Everything the app writes itself has to be redrawn, or half the screen
     stays in the language it was drawn in. */
  $('#versionLine').textContent = tr('w.everythingruns', { v: E.version || '6' });
  $('.bal-label').textContent = tr('w.balanceon', { net: chain().short });
  paintNet();
  paintNetList();
  fillTokenSelects();
  paintTier();
  if (wallet) { refresh(); paintActivity($('#recentList'), 4); }
  if (!$('[data-view="plans"]').classList.contains('on')) return;
  paintPlans();
}

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
    toast(said || tr('w.copied'));
  } catch { toast(tr('w.couldntcopy')); }
}

async function share(text, title) {
  if (navigator.share) { try { await navigator.share({ title, text }); return; } catch {} }
  copy(text, 'Copied. Paste it wherever you need');
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
  if (plain == null || plain === 'n/a' || plain === '…') return plain;
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
  if (auto) toast(tr('w.lockedidle'));
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
  $('#plansCta').textContent = plan === 'platinum' ? tr('w.yourplan') : tr('w.compareplans');
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
        '<svg class="chip"><use href="#emv"/></svg>' +
        '<div class="tc-bot"><span class="tc-addr"></span><span class="tc-name"></span></div>' +
      '</div>' +
      `<h3></h3><p class="plan-line"></p><p class="plan-price">${price}</p><ul class="perks"></ul>`;
    card.querySelector('.tc-net').textContent = chain().short;
    card.querySelector('.tc-addr').textContent = wallet ? short(wallet.address) : '0x0000 ···· 0000';
    card.querySelector('.tc-name').textContent = p.name;
    card.querySelector('h3').textContent = p.name;
    card.querySelector('.plan-line').textContent = p.line;
    const ul = card.querySelector('.perks');
    p.perks.forEach(x => { const li = document.createElement('li'); li.textContent = x; ul.appendChild(li); });

    const btn = document.createElement('button');
    btn.className = 'btn ' + (id === plan ? 'ghost' : 'primary') + ' wide';
    if (id === plan) { btn.textContent = tr('w.plancurrent'); btn.disabled = true; }
    else if (rank(id) < rank(plan)) { btn.textContent = tr('w.planincluded'); btn.disabled = true; }
    else if (!TREASURY) { btn.textContent = tr('w.planoff'); btn.disabled = true; }
    else { btn.textContent = tr('w.planbuy', { price: p.price }); btn.addEventListener('click', () => buyPlan(id)); }
    card.appendChild(btn);
    box.appendChild(card);
  });

  const note = $('#treasuryNote');
  if (!TREASURY) {
    note.innerHTML = tr('w.treasurynote');
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
    ? tr('w.freeforever')
    : tr('w.runsout', { date: new Date(rec.expires).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' }) });
  const go = document.createElement('button');
  go.className = 'link-btn';
  go.textContent = plan === 'platinum' ? tr('w.seeplans') : tr('w.upgrade');
  go.addEventListener('click', () => show('plans'));
  row.appendChild(go);
}

async function buyPlan(id) {
  const p = PLANS[id], c = chain();
  const usdc = c.tokens.find(t => t.symbol === 'USDC');
  if (!usdc) return toast(tr('w.switchusdc'));

  const value = E.parseUnits(String(p.price), usdc.decimals);
  const held = balances.tokens.USDC;
  if (held != null && value > held) return toast(tr('w.needusdc', { price: p.price, net: c.short }));

  try {
    const fee = await feeFor({ to: usdc.address, data: ERC20.encodeFunctionData('transfer', [TREASURY, value]) });
    draft = {
      to: TREASURY, tok: usdc, value, raw: String(p.price), fee, symbol: 'USDC',
      planBuy: id
    };
    $('#cfTitle').textContent = tr('w.upgradeto', { plan: p.name });
    $('#cfAmount').textContent = `$${p.price} USDC`;
    $('#cfTo').textContent = short(TREASURY);
    $('#cfNet').textContent = c.name;
    $('#cfFee').textContent = '≈ ' + fmt(trim(E.formatEther(fee.cost), 7)) + ' ' + c.coin;
    $('#cfAfter').textContent = tr('w.daysof', { plan: p.name });
    fail('#cfErr', '');
    $('#cfSend').disabled = false;
    $('#cfSend').textContent = tr('w.signandpay');
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
  $('#blurSeed').textContent = tr('w.hide');
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
    row.querySelector('b').textContent = tr('w.wordn', { n: i + 1 });
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
  if (!rootPhrase) return toast(tr('w.nophrasekey'));
  wallet = E.HDNodeWallet.fromPhrase(rootPhrase, undefined, PATH(i));
  prefs.active = i; savePrefs();
  write(K.addr, wallet.address);
  const acc = prefs.accounts.find(a => a.i === i);
  $('#acctName').textContent = acc && acc.name ? acc.name : tr('w.accountn', { n: i + 1 });
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
    b.querySelector('b').textContent = a.name || tr('w.accountn', { n: a.i + 1 });
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

  $('.bal-label').textContent = tr('w.balanceon', { net: c.short });
  $('#totalBal').innerHTML = '<span class="skeleton w-40"></span>';
  paintTokens(true);

  try {
    const native = await p.getBalance(addr);
    if (mine !== refresh.gen) return;
    balances.native = native;
    $('#totalBal').textContent = fmt(trim(E.formatEther(native), 6)) + ' ' + c.coin;
  } catch {
    if (mine !== refresh.gen) return;
    $('#totalBal').textContent = tr('w.unavailable');
    toast(tr('w.couldntread'));
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
      if (t.native) amt = balances.native == null ? tr('w.na') : fmt(trim(E.formatEther(balances.native), 6));
      else amt = balances.tokens[t.symbol] == null ? tr('w.na') : fmt(trim(E.formatUnits(balances.tokens[t.symbol], t.decimals), 6));
    }
    const li = document.createElement('li');
    li.innerHTML = coinBadge(t.symbol, t.color) + '<div class="tok-mid"><b></b><small></small></div><div class="tok-amt"></div>';
    li.querySelector('b').textContent = t.symbol;
    li.querySelector('small').textContent = t.native ? tr('w.networkcoin') : t.name;
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
    const opts = [{ v: 'native', l: c.coin + ' · ' + tr('w.nativecoin', { net: c.short }) }]
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
    list.innerHTML = '<li class="empty"></li>';
    list.querySelector('.empty').textContent = tr('w.nopayments');
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
      new Date(a.ts).toLocaleString(dateLocale(), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
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
  toast(tr('w.csvdone'));
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
    hint.textContent = tr('w.lookingup', { name: v });
    hint.className = 'hint';
    try {
      const mp = new E.JsonRpcProvider(CHAINS[1].rpc, E.Network.from(1), { staticNetwork: true });
      const addr = await mp.resolveName(v);
      if (seq !== resolveSeq) return null;
      if (addr) { hint.textContent = v + ' → ' + short(addr); hint.className = 'hint good'; return addr; }
      hint.textContent = tr('w.namenowhere'); hint.className = 'hint bad';
      return null;
    } catch {
      if (seq === resolveSeq) { hint.textContent = tr('w.namelookupfail'); hint.className = 'hint bad'; }
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
  if (!to) return fail('#sendErr', tr('w.checkrecipient'));

  const tok = tokenByKey($('#tokenSelect').value);
  const c = chain();
  const raw = parseAmount($('#amtInput').value);
  if (!raw || !/^\d*\.?\d*$/.test(raw) || Number(raw) <= 0) return fail('#sendErr', tr('w.amountzero'));

  let value;
  try { value = tok ? E.parseUnits(raw, tok.decimals) : E.parseEther(raw); }
  catch { return fail('#sendErr', tr('w.toomanydec', { sym: tok ? tok.symbol : c.coin })); }

  const held = tok ? balances.tokens[tok.symbol] : balances.native;
  if (held != null && value > held) return fail('#sendErr', `You don't have that much ${tok ? tok.symbol : c.coin} on ${c.short}.`);

  $('#reviewBtn').disabled = true;
  $('#reviewBtn').textContent = tr('w.workingfee');
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

    $('#cfTitle').textContent = tr('w.confirmthepaym');
    $('#cfAmount').textContent = fmt(trim(raw, 8)) + ' ' + draft.symbol;
    $('#cfTo').textContent = short(to);
    $('#cfNet').textContent = c.name;
    $('#cfFee').textContent = '≈ ' + fmt(trim(E.formatEther(fee.cost), 7)) + ' ' + c.coin;
    $('#cfAfter').textContent = tok
      ? (balances.tokens[tok.symbol] != null ? fmt(trim(E.formatUnits(balances.tokens[tok.symbol] - value, tok.decimals), 6)) + ' ' + tok.symbol : tr('w.na'))
      : (balances.native != null ? fmt(trim(E.formatEther(balances.native - value - fee.cost), 6)) + ' ' + c.coin : tr('w.na'));
    fail('#cfErr', '');
    $('#cfSend').disabled = false;
    $('#cfSend').textContent = tr('w.signandsend');
    openSheet('#confirmSheet');
  } catch (err) {
    fail('#sendErr', friendly(err));
  } finally {
    $('#reviewBtn').disabled = false;
    $('#reviewBtn').textContent = tr('w.reviewpayment');
  }
}

function friendly(err) {
  const m = (err && (err.shortMessage || err.reason || err.message) || '').toString();
  if (/user rejected|user denied|4001/i.test(m)) return tr('w.errrejected');
  if (/insufficient funds/i.test(m)) return tr('w.errfunds');
  if (/transfer amount exceeds balance/i.test(m)) return tr('w.errtokens');
  if (/could not detect network|network|fetch|timeout/i.test(m)) return tr('w.errnetwork');
  if (/nonce/i.test(m)) return tr('w.errnonce');
  if (/replacement fee too low/i.test(m)) return tr('w.errreplace');
  /* An error we have no wording for is shown as the node sent it, in English,
     rather than swallowed: a raw message is more use than a shrug. */
  return m || tr('w.errunknown');
}

async function doSend() {
  if (!draft || !wallet) return;
  $('#cfSend').disabled = true;
  $('#cfSend').textContent = tr('w.signing');
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
    $('#cfSend').textContent = tr('w.signandsend');
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
    $('#stTitle').textContent = tr('w.sending');
    $('#stText').textContent = tr('w.onthenetwork');
  } else if (state === 'ok' || state === 'plan') {
    icon.className = 'status-icon ok';
    icon.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
    $('#stTitle').textContent = state === 'plan' ? tr('w.planactive') : tr('w.paymentconfirmed');
    $('#stText').textContent = msg || tr('w.recordedon', { net: c.name });
  } else if (state === 'slow') {
    icon.innerHTML = '<svg viewBox="0 0 24 24" style="stroke:var(--warn)"><circle cx="12" cy="12" r="8.5"/><path d="M12 8v4.5l3 1.6"/></svg>';
    $('#stTitle').textContent = tr('w.stillonway');
    $('#stText').textContent = tr('w.networkslow');
  } else {
    icon.className = 'status-icon fail';
    icon.innerHTML = '<svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7L7 17"/></svg>';
    $('#stTitle').textContent = tr('w.didntgo');
    $('#stText').textContent = msg || tr('w.tryagain');
  }
}

async function useMax() {
  const tok = tokenByKey($('#tokenSelect').value);
  if (tok) {
    const b = balances.tokens[tok.symbol];
    if (b == null) return toast(tr('w.nobalyet'));
    $('#amtInput').value = trim(E.formatUnits(b, tok.decimals), tok.decimals);
    return;
  }
  if (balances.native == null) return toast(tr('w.nobalyet'));
  $('#maxBtn').textContent = '…';
  try {
    const to = E.isAddress($('#toInput').value.trim()) ? $('#toInput').value.trim() : wallet.address;
    const fee = await feeFor({ to, value: 1n });
    const left = balances.native - fee.cost;
    if (left <= 0n) { $('#amtInput').value = '0'; toast(tr('w.feeeatsall')); }
    else $('#amtInput').value = trim(E.formatEther(left), 8);
    $('#amtHint').textContent = tr('w.feeleftout');
  } catch { toast(tr('w.nofeeest')); }
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
    $('#walletHint').textContent = tr('w.noextension');
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
    toast(tr('w.connectedto', { name: w.info.name }));
  } catch (err) {
    toast(friendly(err));
  }
}

async function linkedBalance() {
  if (!linked) return;
  const c = chain();
  $('#linkedBal').textContent = tr('w.readingbal');
  try {
    const tok = tokenByKey($('#depToken').value);
    const p = provider();
    const b = tok
      ? await new E.Contract(tok.address, ERC20_ABI, p).balanceOf(linked.address)
      : await p.getBalance(linked.address);
    const txt = tok ? trim(E.formatUnits(b, tok.decimals), 6) : trim(E.formatEther(b), 6);
    linked.balance = b; linked.tok = tok;
    $('#linkedBal').textContent = tr('w.availablethere', { amt: fmt(txt) + ' ' + (tok ? tok.symbol : c.coin) });
  } catch { $('#linkedBal').textContent = ''; }
}

async function depositIn() {
  if (!linked || !wallet) return;
  fail('#depErr', '');
  const tok = tokenByKey($('#depToken').value);
  const c = chain();
  const raw = parseAmount($('#depAmt').value);
  if (!raw || !/^\d*\.?\d*$/.test(raw) || Number(raw) <= 0) return fail('#depErr', tr('w.amountzero'));

  let value;
  try { value = tok ? E.parseUnits(raw, tok.decimals) : E.parseEther(raw); }
  catch { return fail('#depErr', tr('w.deptoomany')); }

  const btn = $('#depSend');
  btn.disabled = true; btn.textContent = tr('w.waitingother');
  try {
    const tx = tok
      ? { from: linked.address, to: tok.address, data: ERC20.encodeFunctionData('transfer', [wallet.address, value]) }
      : { from: linked.address, to: wallet.address, value: '0x' + value.toString(16) };
    const hash = await linked.provider.request({ method: 'eth_sendTransaction', params: [tx] });

    statusSheet('sending', hash);
    $('#stTitle').textContent = tr('w.toppingup');
    $('#stText').textContent = tr('w.onthewayfrom', { amt: fmt(trim(raw, 8)) + ' ' + (tok ? tok.symbol : c.coin), who: linked.info.name });

    let r = null;
    for (let i = 0; i < 60 && !r; i++) {
      try { r = await provider().getTransactionReceipt(hash); } catch {}
      if (!r) await new Promise(s => setTimeout(s, 2000));
    }
    if (r && r.status === 1) {
      statusSheet('ok', hash, tr('w.fundsarein'));
      $('#stTitle').textContent = tr('w.toppedup');
      $('#depAmt').value = '';
      refresh(); linkedBalance();
    } else if (r) statusSheet('fail', hash, tr('w.netrejected'));
    else statusSheet('slow', hash);
  } catch (err) {
    fail('#depErr', friendly(err));
  } finally {
    btn.disabled = false; btn.textContent = tr('w.sendtomywardwa');
  }
}

/* ── Receive and request ───────────────────────────────────────────────────── */
function paintReceive() {
  if (!wallet) return;
  const c = chain();
  $('#addrFull').textContent = wallet.address;
  $('#recvNet').textContent = c.name + ' only';
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

/* "#/topup" — the wallet marks on the landing page link straight here, so
   clicking Phantom means the screen that links Phantom. */
const wantsTopUp = () => (location.hash || '').startsWith('#/topup');

/* "#/plan?id=gold" — the plan buttons on the landing page link straight here so
   that "Get Gold" means the confirm screen, not a wallet home the buyer then
   has to find the plans in. */
function readPlanHash() {
  const h = location.hash || '';
  const i = h.indexOf('?');
  if (!h.startsWith('#/plan') || i < 0) return null;
  const id = new URLSearchParams(h.slice(i + 1)).get('id');
  return id && PLANS[id] && PLANS[id].price ? id : null;
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
  note.querySelector('b').textContent = prefill.from ? tr('w.askingyoutopay', { who: prefill.from }) : tr('w.beingasked');
  note.querySelector('span').textContent =
    (prefill.note ? prefill.note + ' · ' : '') + tr('w.checkamount', { net: c.short });
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

/* The chain table's blurbs are written in English next to the RPC they
   describe. The translations live in the dictionary, keyed by chain id, and the
   table is the fallback for any that is missing. */
const blurbFor = (id, c) => {
  const k = 'w.blurb' + id;
  const d = DICT[lang];
  return (d && d[k]) || c.blurb;
};

function paintLangList() {
  const list = $('#langList');
  list.innerHTML = '';
  LANGS.forEach(l => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.lang = l.id;
    b.className = l.id === lang ? 'sel' : '';
    b.innerHTML = '<span class="nl-mid"><b></b></span>';
    b.querySelector('b').textContent = l.name;
    b.addEventListener('click', () => { applyLang(l.id); paintLangList(); closeSheet('#langSheet'); });
    li.appendChild(b);
    list.appendChild(li);
  });
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
      '<span class="nl-mid"><b></b><small></small></span>';
    b.querySelector('b').textContent = c.name;
    b.querySelector('small').textContent = blurbFor(id, c);
    b.addEventListener('click', () => {
      prefs.chainId = id; savePrefs();
      linked = null;
      paintNet(); fillTokenSelects(); closeSheet('#netSheet'); refresh(); verifyPlan();
      toast(tr('w.youreon', { net: c.name }));
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
  $('#acctName').textContent = acc && acc.name ? acc.name : tr('w.accountn', { n: 1 });
  $('#addrShort').textContent = short(wallet.address);
  show('home');
  refresh();
  paintActivity($('#recentList'), 4);
  reconcile();
  verifyPlan();
  scanWallets();
  touch();
  if (prefill) applyPrefill();
  if (planWanted) applyPlanWanted();
  else if (topUpWanted) { topUpWanted = false; history.replaceState(null, '', location.pathname); show('deposit'); }
}

/* The buyer arrives here from the landing page wanting one specific plan. Open
   the plans screen either way, so a wallet that already has the plan, or an
   upgrade that is not set up, lands somewhere that explains itself rather than
   on a confirm box that cannot work. */
async function applyPlanWanted() {
  const id = planWanted;
  planWanted = null;
  history.replaceState(null, '', location.pathname);
  show('plans');
  if (!TREASURY) return;
  await verifyPlan();
  if (id === plan || rank(id) < rank(plan)) return;
  buyPlan(id);
}

function boot() {
  applyLang(lang);
  $('#versionLine').textContent = tr('w.everythingruns', { v: E.version || '6' });
  prefill = readPayHash();
  planWanted = readPlanHash();
  topUpWanted = wantsTopUp();
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
$('#langPill').addEventListener('click', () => { paintLangList(); openSheet('#langSheet'); });
$('#lockBtn').addEventListener('click', () => lock(false));
$('#lockNow').addEventListener('click', () => lock(false));

$('#acctSwitch').addEventListener('click', () => { paintAccounts(); openSheet('#acctSheet'); });
$('#addAcct').addEventListener('click', () => {
  if (!rootPhrase) return toast(tr('w.nophrase'));
  const i = Math.max(...prefs.accounts.map(a => a.i)) + 1;
  prefs.accounts.push({ i, name: tr('w.accountn', { n: i + 1 }) });
  savePrefs();
  useAccount(i);
  paintAccounts();
  closeSheet('#acctSheet');
});

$('#copySeed').addEventListener('click', () => copy(pendingMnemonic, 'Phrase copied. Paste it into your manager, then clear the clipboard'));
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
    toast(tr('w.walletready'));
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
  toast(tr('w.recoverwith12'));
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
  if (v && !ok) return toast(tr('w.rpchttps'));
  if (v) prefs.rpc[prefs.chainId] = v; else delete prefs.rpc[prefs.chainId];
  savePrefs(); _provider = null;
  toast(v ? tr('w.rpcsaved') : tr('w.rpcpublic'));
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
  toast(tr('w.backupdone'));
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
  if (wantsTopUp()) {
    topUpWanted = true;
    if (wallet) { topUpWanted = false; history.replaceState(null, '', location.pathname); show('deposit'); }
    return;
  }
  const id = readPlanHash();
  if (id) { planWanted = id; if (wallet) applyPlanWanted(); return; }
  const p = readPayHash();
  if (!p) return;
  prefill = p;
  if (wallet) applyPrefill();
});

boot();
})();
