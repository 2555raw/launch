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
/* The list people actually choose from, most-used first. Optimism, BNB Smart
   Chain and Hyperliquid are off it: the first two are covered by Base and
   Arbitrum for everything this wallet does, and Hyperliquid never had a
   stablecoin entry, so it could only ever hold HYPE.
   They stay defined in chains.js on purpose rather than being deleted. Old
   payments carry a chain id, and a wallet that forgets what chain 10 was would
   show "Chain 10" in someone's history instead of "Optimism". */
const CHAIN_ORDER = [4663, 'sol', 8453, 1, 42161, 137];

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
  payees: NS + '.payees',
  /* The recovery phrase, sealed with a key the browser will not hand back.
     See vault.js. Present only for a wallet started without a password. */
  sealed: NS + '.sealed',
  /* Set once the person has actually seen their twelve words, so the banner
     can stop nagging someone who has already done the thing it asks for. */
  saved:  NS + '.phrasesaved'
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

let prefs = Object.assign({ chainId: 8453, rpc: {}, accounts: [{ i: 0, name: '' }], active: 0,
  card: { name: '', stickers: [] } }, read(K.prefs, {}));
/* An older stored prefs has no card, and a hand-edited one could have
   anything, so it is put back into shape rather than trusted. */
if (!prefs.card || typeof prefs.card !== 'object') prefs.card = { name: '', stickers: [] };
if (typeof prefs.card.name !== 'string') prefs.card.name = '';
if (typeof prefs.card.coin !== 'string') prefs.card.coin = 'ETH';
if (typeof prefs.card.title !== 'string') prefs.card.title = '';
if (!Array.isArray(prefs.card.stickers)) prefs.card.stickers = [];
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
let launchWanted = false;
let plan = 'classic';
let linked = null;            // { info, provider, address } — an external wallet

const chain = () => CHAINS[prefs.chainId];
/* Solana is not an EVM chain. Nothing that touches ethers — the provider, a
   contract, an address check, a signature — applies when this is true, so it
   guards every one of those rather than being assumed anywhere. */
const isSol = () => chain().family === 'sol';

/* ── Reaching a node ───────────────────────────────────────────────────────
   Public RPC endpoints are free, and they behave like it: a 429 when you lean
   on them, a 502 when they are unwell, a dropped connection when they are
   gone. None of that means anything is wrong with the wallet, but all of it
   used to reach the screen as "Couldn't read the balance", which is how a
   working wallet gets mistaken for a broken one.

   ethers already retries a 429 on its own, and consults nothing for the rest,
   so the rest is handled here. Only reads are retried. Re-sending a signed
   transaction would be safe on the chain — it carries the same nonce, so the
   second copy is rejected — but the node reports that rejection as an error,
   and a wallet that turns a payment it already sent into a failure message is
   worse than one that says nothing at all. */
const RETRYABLE_READS = new Set([
  'eth_chainId', 'eth_blockNumber', 'eth_getBalance', 'eth_call', 'eth_estimateGas',
  'eth_getTransactionCount', 'eth_getTransactionReceipt', 'eth_getTransactionByHash',
  'eth_getBlockByNumber', 'eth_getBlockByHash', 'eth_gasPrice', 'eth_feeHistory',
  'eth_getLogs', 'eth_getCode', 'eth_maxPriorityFeePerGas'
]);
const TRIES = 3;
const backoff = i => new Promise(r => setTimeout(r, 250 * Math.pow(2, i)));
const transient = e => {
  const c = e && e.code;
  if (c === 'SERVER_ERROR' || c === 'NETWORK_ERROR' || c === 'TIMEOUT') return true;
  /* A connection dropped mid-flight never reaches ethers' error codes: fetch
     rejects with a bare TypeError. */
  return !c && e instanceof TypeError;
};

class RetryingProvider extends E.JsonRpcProvider {
  async _send(payload) {
    const calls = Array.isArray(payload) ? payload : [payload];
    const readOnly = calls.every(c => RETRYABLE_READS.has(c.method));
    let last;
    for (let i = 0; ; i++) {
      try { return await super._send(payload); }
      catch (e) {
        last = e;
        if (!readOnly || i >= TRIES - 1 || !transient(e)) throw e;
        await backoff(i);
      }
    }
  }
}

/* Every provider in the wallet is built here, so none of them is left with
   ethers' default five-minute timeout — long enough for a wedged node to look
   like a frozen app. */
function makeProvider(url, chainId) {
  const req = new E.FetchRequest(url);
  req.timeout = 15000;
  const p = new RetryingProvider(req, E.Network.from(Number(chainId)), { staticNetwork: true });
  checkChainId(p, url, chainId);
  return p;
}

/* staticNetwork tells ethers to believe the chain id in the table rather than
   asking the node, which saves a round trip on every single call. The cost is
   that nothing ever checks the table is right. A node that answers for a
   different chain than the one named — a typo'd custom RPC, an endpoint that
   moved, a table entry that was wrong from the start — would be signed
   against anyway, and a transaction signed for the wrong chain is not a
   recoverable mistake.
   So the id is asked for exactly once per endpoint, out of band, and a
   disagreement is said out loud rather than discovered later. */
const chainIdChecked = new Map();
/* The warning belongs to one chain, so switching away from that chain takes it
   down; switching back re-checks and puts it up again if it is still true. */
function clearChainWarn() {
  const bar = $('#chainWarn');
  if (bar && bar.dataset.for !== String(prefs.chainId)) bar.hidden = true;
}
function checkChainId(p, url, want) {
  const key = want + '|' + url;
  if (chainIdChecked.has(key)) return;
  chainIdChecked.set(key, true);
  /* Asked with a plain fetch rather than through the provider on purpose.
     ethers batches concurrent calls into one JSON-RPC array, so a probe sent
     through it rides along with whatever real work is in flight — and a node
     that handles batches poorly would then fail the balance read because of a
     diagnostic. A check on the wallet's health must not be able to break the
     wallet. */
  fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] })
  }).then(r => r.json()).then(j => {
    if (!j || !j.result) throw new Error('no answer');
    const got = Number(BigInt(j.result));
    if (got === Number(want)) return;
    chainIdChecked.set(key, false);
    const c = CHAINS[want];
    console.warn('Ward: ' + url + ' reports chain ' + got + ', not ' + want);
    /* Not a toast. A toast is gone in under three seconds, and this is the
       one message in the wallet that has to still be on screen when someone
       reaches for the send button. */
    const bar = $('#chainWarn');
    if (bar) {
      bar.textContent = tr('w.wrongchain', { net: (c && c.name) || want, got: got });
      bar.hidden = false;
      bar.dataset.for = String(want);
    }
  }).catch(() => {
    /* Unreachable is not the same as wrong, and the balance read that follows
       will report it in its own words. */
    chainIdChecked.delete(key);
  });
}

/* Both families write a balance as an integer of the smallest unit, so one
   formatter serves both; ethers is not reached for just because a chain
   happens to be EVM. */
const units = (v, decimals) => {
  const d = BigInt(decimals);
  const base = 10n ** d;
  const a = BigInt(v);
  const frac = (a % base).toString().padStart(Number(d), '0').replace(/0+$/, '');
  return (a / base) + (frac ? '.' + frac : '');
};
const SOL = window.WARD_SOL;

/* The Solana account for the account index in use. Derived from the same
   twelve words, on the path Phantom and Solflare use, so it is the same
   account in all three. A wallet imported from a private key has no phrase
   and therefore no Solana account — the same limit that already stops it
   having more than one EVM account. */
let solAcct = null;
async function solKeys() {
  if (!rootPhrase) return null;
  const want = Number(prefs.active) || 0;
  if (solAcct && solAcct.i === want) return solAcct;
  const seed = E.Mnemonic.fromPhrase(rootPhrase).computeSeed();
  const k = await SOL.fromSeed(seed, want);
  solAcct = { i: want, secret: k.secret, pub: k.pub, address: k.address };
  return solAcct;
}
/* What to show, share and put in a QR code: the Solana address on Solana, the
   EVM one everywhere else. */
const myAddress = () => (isSol() ? (solAcct ? solAcct.address : null) : (wallet ? wallet.address : null));
/* The chip on the home card. Until the Solana key is derived there is no
   address to show, and an ellipsis is the only honest thing to put there —
   showing the EVM one would be showing an address that cannot receive what
   the screen says it can. */
/* Turns off the parts of the wallet that are EVM-only when an EVM chain is
   not what is selected. A button that cannot work is worse than one that is
   not there, and worse still is one that looks like it worked. */
function paintChainMode() {
  const sol = isSol();
  $$('[data-evm-only]').forEach(el => { el.hidden = sol; });
  if ($('#depSolNote')) $('#depSolNote').hidden = !sol;
  /* A plan bought on an EVM chain stays yours while you are looking at Solana,
     so the tier is repainted rather than cleared. What Solana cannot do is
     sell you one; paintPlans says so on the buttons. */
  paintTier();
}

function paintAddr() {
  const a = myAddress();
  if ($('#addrShort')) $('#addrShort').textContent = a ? short(a) : '…';
}
const rpcUrl = () => (prefs.rpc[prefs.chainId] || '').trim() || chain().rpc;
const has = need => rank(plan) >= rank(need);

let _provider = null, _providerKey = '';
function provider() {
  const key = prefs.chainId + '|' + rpcUrl();
  if (_provider && _providerKey === key) return _provider;
  _providerKey = key;
  _provider = makeProvider(rpcUrl(), prefs.chainId);
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
const DICT = window.WARD_APP_I18N || { en: {} };
const LANGS = window.WARD_LANGS || [{ id: 'en', short: 'EN', name: 'English', html: 'en', date: 'en-GB' }];
const LOADER = window.WARD_LANG;
const LANG_KEY = 'ward.v1.lang';
const langMeta = id => LANGS.find(l => l.id === id) || null;

let lang = 'en';
try {
  const saved = localStorage.getItem(LANG_KEY);
  if (saved && langMeta(saved)) {
    lang = saved;
    /* English is the only dictionary that ships with the page. If this browser
       kept a copy of the chosen one from last time, take it now, before the
       first paint, so the wallet does not open in English and correct itself a
       moment later. The fetch below replaces it either way. */
    const c = LOADER && LOADER.cached('app', saved);
    if (c) DICT[saved] = c;
  }
} catch { /* storage blocked */ }

/* tr('w.balanceon', { net: 'Base' }). Falls back to English, and then to the key
   itself, so a missing translation shows English rather than nothing. */
/* Dates follow the chosen language. Numbers deliberately do not: a comma as
   the decimal separator is how 1.284 ETH gets read as 1284. */
const dateLocale = () => { const m = langMeta(lang); return (m && m.date) || 'en-GB'; };

function tr(key, vars) {
  let str = (DICT[lang] && DICT[lang][key]) || (DICT.en && DICT.en[key]) || key;
  if (vars) for (const k of Object.keys(vars)) str = str.split('{' + k + '}').join(vars[k]);
  return str;
}

/* What the wallet is meant to be showing. A second pick made while the first
   is still in the air must not be overwritten when that one lands. */
let chosenLang = lang;

/* Picks a language, loading it if this browser has never seen it. Paints from
   the copy kept here if there is one, then again when the fetch answers. A
   language that will not load leaves English standing rather than a screen
   half in one language and half in another. */
function useLang(id) {
  if (!langMeta(id)) return;
  chosenLang = id;
  try { localStorage.setItem(LANG_KEY, id); } catch { /* this session only */ }
  if (DICT[id]) applyLang(id);
  else {
    const c = LOADER && LOADER.cached('app', id);
    if (c) { DICT[id] = c; applyLang(id); }
    /* Nothing to paint from yet. Mark the choice in the list so the tap is
       acknowledged, and let the fetch bring the words. */
    else { lang = id; paintLangList(); }
  }
  if (!LOADER) return;
  LOADER.load('app', id).then(d => {
    if (!d || chosenLang !== id) return;
    /* Revalidating costs one cheap 304 and usually changes nothing. Repainting
       anyway would re-read the balance off the network for no reason. */
    if (DICT[id] && JSON.stringify(DICT[id]) === JSON.stringify(d)) return;
    DICT[id] = d;
    applyLang(id);
  });
}

/* The theme button's label is the only string theme.js needs, and it lives in
   whichever dictionary the page happens to have. */
window.WARD_THEME_LABEL = dark => tr(dark ? 'w.today' : 'w.tonight');

function applyLang(id) {
  if (!DICT[id]) return;
  lang = id;
  const meta = langMeta(id);
  document.documentElement.lang = (meta && meta.html) || id;
  /* Arabic reads right to left, so the wallet is laid out that way rather than
     merely filled with Arabic words. Addresses, amounts and transaction hashes
     stay left to right wherever they appear; the CSS marks those. */
  document.documentElement.dir = meta && meta.rtl ? 'rtl' : 'ltr';

  $$('[data-i18n]').forEach(el => { const v = tr(el.dataset.i18n); if (v) el.innerHTML = v; });
  $$('[data-i18n-ph]').forEach(el => { const v = tr(el.dataset.i18nPh); if (v) el.placeholder = v; });
  $$('[data-i18n-label]').forEach(el => { const v = tr(el.dataset.i18nLabel); if (v) el.setAttribute('aria-label', v); });

  if ($('#langNow')) $('#langNow').textContent = meta ? meta.short : id.toUpperCase();
  if (window.WARD_THEME) window.WARD_THEME.paint();
  paintLangList();

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

/* Everything that has to happen when the network changes, in one place: the
   launch screen needs to move the wallet to Solana too, and a second copy of
   this list would be a second thing to forget to update. */
function switchChain(id) {
  const c = CHAINS[id];
  if (!c) return;
  prefs.chainId = id; savePrefs();
  linked = null;
  paintNet(); fillTokenSelects(); verifyPlan();
  paintAddr(); paintChainMode(); clearChainWarn();
  /* The card names the network and lists that network's coins, so it is
     wrong the moment the network changes under it. The launch screen is the
     same: the network pill sits in the bar on every screen, so someone can
     move off Solana while looking at a launch form that only works there. */
  paintCard();
  if ($('[data-view="launch"]').classList.contains('on')) paintLaunch();
  refresh().then(paintCard);
  toast(tr('w.youreon', { net: c.name }));
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
  if (name === 'card') paintCard();
  if (name === 'deposit') paintDeposit();
  if (name === 'charge') $('#fromField').hidden = !has('gold');
  if (name === 'send') paintPayees();
  if (name === 'launch') paintLaunch();
}

/* ── launching a coin ───────────────────────────────────────────────────── */
/* The screen has three states and only one of them is a form you can submit:
   wrong network, launchpad not configured, and ready. They are checked in that
   order because each makes the next one irrelevant. */
/* Two launchpads now, on two chains. Solana goes through Meteora's curve;
   Robinhood Chain goes through Pons, which owns its own configurations, so
   nothing has to be set up before a launch can happen there. */
const isPons = () => Number(prefs.chainId) === 4663;
const canLaunchHere = () => isSol() || isPons();

function paintLaunch() {
  /* Four states, checked in this order because each makes the next
     irrelevant: no wallet at all, a chain with no launchpad, nothing to
     launch against, ready. */
  const none = !wallet && !phLinked;
  const wrong = !none && !canLaunchHere();
  const unset = isPons()
    ? false                                   /* Pons needs no setup of ours */
    : (!window.WARD_DBC || !window.WARD_DBC.config);
  $('#launchNoWallet').hidden = !none;
  $('#launchWrongChain').hidden = none || !wrong;
  $('#launchNoConfig').hidden = none || wrong || !unset;
  $('#launchForm').hidden = none || wrong;
  const row = $('#lcSigner');
  if (row) row.hidden = none || wrong || isPons();
  paintSigner();
}

/* The button turns on only when the form is complete, the box is ticked, there
   is a wallet to sign with and something to launch against. */
function launchGate() {
  const filled = $('#lcName').value.trim() && $('#lcSym').value.trim() && $('#lcDesc').value.trim();
  const ready = isPons() ? !!wallet : ((wallet || phLinked) && window.WARD_DBC && window.WARD_DBC.config);
  const ok = !!(canLaunchHere() && ready && filled && $('#lcAgree').checked);
  $('#lcGo').disabled = !ok;
  $('#lcNameCount').textContent = $('#lcName').value.length + '/64';
  $('#lcSymCount').textContent = $('#lcSym').value.length + '/16';
}

/* The picture, read locally. Ward has nowhere to publish it, so this is a
   preview and nothing more; saying so on the screen beats letting someone
   believe they uploaded something. */
const MAX_PIC = 2 * 1024 * 1024;
function takePicture(file) {
  if (!file) return;
  if (!/^image\/(jpeg|png|gif)$/.test(file.type)) { toast(tr('w.lcbadkind')); return; }
  if (file.size > MAX_PIC) { toast(tr('w.lcbigpic')); return; }
  const r = new FileReader();
  r.onload = () => {
    const box = $('#lcPrevBox');
    box.innerHTML = '';
    const img = document.createElement('img');
    img.src = r.result;
    img.alt = '';
    box.appendChild(img);
  };
  r.readAsDataURL(file);
}

/* Launching through Pons. The terms are read from the factory at this moment
   rather than assumed: whether launching is open, what it charges, which curve
   configuration is live, and the economics to pin so an owner re-peg cannot
   land underneath a launch already in flight. */
async function doLaunchPons() {
  const PONS = window.WARD_PONS;
  const btn = $('#lcGo');
  btn.disabled = true;
  try {
    if (!wallet) throw new Error(tr('w.nosolkey'));
    const p = provider();
    const me = wallet.address;
    const terms = await PONS.discover(p, me, E);
    if (!terms.open) throw new Error(tr(terms.noConfig ? 'w.pnoconfig' : 'w.pclosed'));

    const call = PONS.launchCall(E, {
      name: $('#lcName').value.trim(),
      symbol: $('#lcSym').value.trim().toUpperCase(),
      description: $('#lcDesc').value.trim(),
      logo: $('#lcUri').value.trim(),
      twitter: $('#lcX').value.trim(),
      telegram: $('#lcTg').value.trim(),
      website: $('#lcSite').value.trim(),
      creator: me,
      launchConfigId: terms.launchConfigId,
      pairToken: terms.pairToken,
      expectedEconomics: terms.expectedEconomics,
      launchFee: terms.launchFee
    });

    const signer = wallet.connect(p);
    const tx = await signer.sendTransaction(call);
    statusSheet('sending', tx.hash);
    pushAct({
      hash: tx.hash, chainId: prefs.chainId, from: me, to: PONS.FACTORY,
      amount: '1', symbol: $('#lcSym').value.trim().toUpperCase(),
      ts: Date.now(), status: 'pending', kind: 'launch'
    });
    const r = await tx.wait();
    if (r && r.status === 1) { patchAct(tx.hash, { status: 'ok' }); statusSheet('ok', tx.hash); }
    else { patchAct(tx.hash, { status: 'failed' }); statusSheet('failed', tx.hash); }
    refresh();
  } catch (e) {
    statusSheet('failed', null, friendly(e));
  } finally { launchGate(); }
}

/* ── signing a launch with Phantom ─────────────────────────────────────────
   The coin is then created by the account people already know, and Ward never
   holds the key that made it. */
const PH = window.WARD_PHANTOM;
let phLinked = null;

function paintSigner() {
  const name = $('#lcSignerName');
  if (!name) return;
  name.textContent = phLinked ? 'Phantom · ' + short(phLinked) : tr('w.lcthiswallet');
  $('#lcPhantom').hidden = !!phLinked;
  $('#lcUnlinkPh').hidden = !phLinked;
  launchGate();
}

async function linkPhantom() {
  if (!PH || !PH.available()) { toast(tr('w.lcphnone')); return; }
  try {
    phLinked = await PH.connect();
    /* Phantom is a Solana wallet, so linking one says which network this
       launch is for. Leaving the wallet on Base and then telling them to
       switch would be asking a question they already answered. */
    if (!isSol()) switchChain('sol');
    /* Switching account inside Phantom must move the address Ward is about to
       put on a coin, not leave a stale one on screen. */
    PH.onChange(a => { phLinked = a; paintLaunch(); });
    /* A linked Phantom is a signer, so the whole screen changes state: the
       "you need a wallet" notice no longer applies and the form appears. */
    paintLaunch();
    toast(tr('w.lcphlinked'));
  } catch {
    toast(tr('w.lcphfail'));
  }
}

function wireLaunch() {
  $('#lcPhantom').addEventListener('click', linkPhantom);
  $('#lcUnlinkPh').addEventListener('click', async () => {
    if (PH) await PH.disconnect();
    phLinked = null; paintLaunch();
  });
  ['#lcName', '#lcSym', '#lcDesc'].forEach(s => $(s).addEventListener('input', launchGate));
  $('#lcAgree').addEventListener('change', launchGate);
  $('#launchToSol').addEventListener('click', () => { switchChain('sol'); paintLaunch(); });
  $('#launchToPons').addEventListener('click', () => { switchChain(4663); paintLaunch(); });
  $('#launchForm').addEventListener('submit', e => { e.preventDefault(); doLaunch(); });

  $('#lcFile').addEventListener('change', e => takePicture(e.target.files[0]));
  const drop = $('#lcDrop');
  ['dragenter', 'dragover'].forEach(n => drop.addEventListener(n, e => {
    e.preventDefault(); drop.classList.add('over');
  }));
  ['dragleave', 'drop'].forEach(n => drop.addEventListener(n, e => {
    e.preventDefault(); drop.classList.remove('over');
  }));
  drop.addEventListener('drop', e => takePicture(e.dataTransfer.files[0]));
}

async function doLaunch() {
  if (isPons()) return doLaunchPons();
  const DBC = window.WARD_DBC;
  /* A disabled button is a hint, not a guarantee. */
  if (!DBC || !DBC.config) { toast(tr('w.launchoffttl')); return; }

  const btn = $('#lcGo');
  btn.disabled = true;
  try {
    const k = phLinked ? null : await solKeys();
    if (!k && !phLinked) throw new Error(tr('w.nosolkey'));
    const payer = phLinked ? SOL.b58decode(phLinked) : k.pub;
    SOL.setRpc((prefs.rpc[prefs.chainId] || '').trim() || chain().rpc);

    /* The coin's own key. It signs once, here, to let the program create the
       mint at its address, and then it is never needed again — the coin is not
       owned by it afterwards. */
    const mint = await SOL.parts.newKeypair();

    const ix = await DBC.initializeIx({
      config: SOL.b58decode(DBC.config),
      baseMint: mint.pub,
      quoteMint: DBC.WSOL,
      creator: payer,
      payer,
      name: $('#lcName').value.trim(),
      symbol: $('#lcSym').value.trim().toUpperCase(),
      uri: $('#lcUri').value.trim()
    });

    const msg = SOL.parts.buildMessage(payer, [ix], await SOL.parts.blockhash());
    /* Two signatures either way. With Phantom it signs for the creator and the
       mint's is added beside it; signAndSendTransaction cannot be used here
       because it refuses a transaction that already carries one. */
    const sig = phLinked
      ? await PH.signWithOthers(msg, [{ pub: mint.pub, secret: mint.secret }])
      : await SOL.parts.submit(await SOL.parts.signedBy(
          [{ pub: k.pub, secret: k.secret }, { pub: mint.pub, secret: mint.secret }], msg));

    statusSheet('sending', sig);
    pushAct({
      hash: sig, chainId: prefs.chainId, from: phLinked || k.address, to: mint.address,
      amount: '1', symbol: $('#lcSym').value.trim().toUpperCase(),
      ts: Date.now(), status: 'pending', kind: 'launch'
    });

    /* Asked rather than assumed, the same as a payment: a slow node leaves it
       pending instead of claiming a coin exists that does not. */
    let done = false;
    for (let i = 0; i < 20 && !done; i++) {
      await new Promise(r => setTimeout(r, 1200));
      done = await SOL.confirmed(sig);
    }
    if (done) { patchAct(sig, { status: 'ok' }); statusSheet('ok', sig); }
    else statusSheet('slow', sig);
    refresh();
  } catch (e) {
    statusSheet('failed', null, (e && e.message) || tr('w.errunknown'));
  } finally {
    launchGate();
  }
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

/* A plan can also be paid from a wallet the buyer already has, which means the
   payment does not come from the Ward address that gets the plan. Something has
   to tie the two together, or anyone could copy a stranger's transaction hash
   out of a block explorer and claim their plan.

   That something is a signature. The paying wallet signs this sentence, naming
   the Ward address it is paying for, and only the holder of the paying key can
   produce it. Verification then asks for both: a payment from that address, and
   its signature over this exact text.
   
   What it does not stop is the payer using one payment for two wallets of their
   own, since they can sign for both. Closing that needs a server keeping a list
   of spent transactions, and there is no server here. */
const planMessage = (rec, wardAddress) =>
  ['Ward plan authorisation',
   'Plan: ' + rec.plan,
   'For wallet: ' + E.getAddress(wardAddress),
   'Paying to: ' + E.getAddress(TREASURY),
   'Chain: ' + Number(rec.chainId)].join('\n');

/* Thirty days from the block the payment landed in, not from a date written
   next to it: the stored record is editable and a block timestamp is not. */
const PLAN_DAYS = 30;

async function verifyPlan() {
  plan = 'classic';
  const rec = read(K.plan, null);
  if (!rec || !rec.hash || !TREASURY || !wallet) return paintTier();
  if (rec.address && rec.address.toLowerCase() !== wallet.address.toLowerCase()) return paintTier();

  const c = CHAINS[rec.chainId];
  const want = PLANS[rec.plan];
  if (!c || !want) return paintTier();
  /* A plan is only ever recorded against an EVM chain, because that is the
     only place it can be paid and the only place the proof can be read back.
     A record naming anything else did not come from here. */
  if (c.family === 'sol') return paintTier();

  /* Which address had to have paid. Normally this wallet; for a payment made
     from another wallet, whichever address signed for this one. */
  let payer = wallet.address;
  if (rec.payer && rec.sig) {
    try {
      if (E.verifyMessage(planMessage(rec, wallet.address), rec.sig).toLowerCase() !== rec.payer.toLowerCase()) return paintTier();
      payer = rec.payer;
    } catch { return paintTier(); }
  }

  try {
    const p = makeProvider(prefs.rpc[rec.chainId] || c.rpc, rec.chainId);
    const r = await p.getTransactionReceipt(rec.hash);
    if (!r || r.status !== 1) return paintTier();

    const usdc = c.tokens.find(t => t.symbol === 'USDC');
    const need = E.parseUnits(String(want.price), usdc ? usdc.decimals : 6);
    const paid = r.logs.some(l =>
      l.topics[0] === TRANSFER_TOPIC &&
      usdc && l.address.toLowerCase() === usdc.address.toLowerCase() &&
      ('0x' + l.topics[1].slice(26)).toLowerCase() === payer.toLowerCase() &&
      ('0x' + l.topics[2].slice(26)).toLowerCase() === TREASURY.toLowerCase() &&
      E.toBigInt(l.data) >= need);
    if (!paid) return paintTier();

    const block = await p.getBlock(r.blockNumber);
    const until = block ? (block.timestamp * 1000) + PLAN_DAYS * 24 * 3600 * 1000 : 0;
    if (!until || Date.now() > until) { drop(K.plan); return paintTier(); }
    if (rec.expires !== until) { rec.expires = until; write(K.plan, rec); }
    plan = rec.plan;
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
    card.querySelector('.tc-addr').textContent = myAddress() ? short(myAddress()) : '0x0000 ···· 0000';
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
    /* A plan is one USDC payment on an EVM chain, and it is proved by reading
       that transaction back off the chain. Solana carries neither the payment
       nor the proof, so the button says so instead of failing later. */
    else if (isSol()) { btn.textContent = tr('w.planevmonly'); btn.disabled = true; }
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

/* Paying a plan from a wallet the buyer already has, rather than from this
   one. The Ward wallet never holds the money and never signs the transfer: the
   other wallet does both, and signs the sentence that says who it is paying
   for. */
async function payPlanFrom(w, id) {
  const p = PLANS[id], c = chain();
  const usdc = c.tokens.find(t => t.symbol === 'USDC');
  if (!usdc) return toast(tr('w.switchusdc'));

  const btn = $('#cfOther');
  btn.disabled = true;
  btn.textContent = tr('w.waitingother');
  try {
    const accounts = await w.provider.request({ method: 'eth_requestAccounts' });
    if (!accounts || !accounts.length) throw new Error('No account was shared.');
    const payer = E.getAddress(accounts[0]);

    const hex = '0x' + Number(prefs.chainId).toString(16);
    try {
      await w.provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex }] });
    } catch (err) {
      if (err && (err.code === 4902 || (err.data && err.data.originalError && err.data.originalError.code === 4902))) {
        await w.provider.request({ method: 'wallet_addEthereumChain', params: [{
          chainId: hex, chainName: c.name,
          nativeCurrency: { name: c.coin, symbol: c.coin, decimals: 18 },
          rpcUrls: [c.rpc], blockExplorerUrls: [c.explorer]
        }] });
      } else throw err;
    }

    /* The signature first. If the payer refuses it there is nothing to undo;
       if the payment went first, a refusal here would cost them the money. */
    const draftRec = { plan: id, chainId: Number(prefs.chainId) };
    const msg = planMessage(draftRec, wallet.address);
    const sig = await w.provider.request({ method: 'personal_sign', params: [msg, payer] });
    if (E.verifyMessage(msg, sig).toLowerCase() !== payer.toLowerCase()) throw new Error('That signature does not match the account.');

    const value = E.parseUnits(String(p.price), usdc.decimals);
    const hash = await w.provider.request({ method: 'eth_sendTransaction', params: [{
      from: payer, to: usdc.address,
      data: ERC20.encodeFunctionData('transfer', [TREASURY, value])
    }] });

    closeSheet('#confirmSheet');
    statusSheet('sending', hash);
    $('#stTitle').textContent = tr('w.toppingup');
    $('#stText').textContent = tr('w.onthewayfrom', { amt: '$' + p.price + ' USDC', who: w.info.name });

    write(K.plan, {
      plan: id, hash, chainId: Number(prefs.chainId),
      address: wallet.address, payer, sig, paidAt: Date.now(),
      expires: Date.now() + PLAN_DAYS * 24 * 3600 * 1000
    });

    let r = null;
    for (let i = 0; i < 60 && !r; i++) {
      try { r = await provider().getTransactionReceipt(hash); } catch { /* not mined yet */ }
      if (!r) await new Promise(done => setTimeout(done, 2000));
    }
    if (r && r.status === 1) {
      await verifyPlan();
      statusSheet(plan === id ? 'plan' : 'fail', hash, plan === id ? undefined : tr('w.planunconfirmed'));
    } else if (r) statusSheet('fail', hash, tr('w.netrejected'));
    else statusSheet('slow', hash);
  } catch (err) {
    fail('#cfErr', friendly(err));
  } finally {
    btn.disabled = false;
    btn.textContent = tr('w.paywithother');
  }
}

function paintPayFrom(id) {
  const btn = $('#cfOther');
  scanWallets();
  const all = [...found.values()];
  btn.hidden = !all.length;
  if (!all.length) return;
  btn.disabled = false;
  btn.textContent = tr('w.paywithother');
  btn.onclick = () => {
    if (all.length === 1) return payPlanFrom(all[0], id);
    /* More than one is installed, so the buyer picks which. */
    paintWalletPick(w => payPlanFrom(w, id));
    openSheet('#walletSheet');
  };
}

function paintWalletPick(onPick) {
  const list = $('#pickList');
  list.innerHTML = '';
  [...found.values()].forEach(w => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = (w.info.icon ? `<img class="li-icon" src="${w.info.icon}" alt="">` : '<span class="li-icon gen"></span>') +
      '<span class="li-mid"><b></b></span>';
    b.querySelector('b').textContent = w.info.name;
    b.addEventListener('click', () => { closeSheet('#walletSheet'); onPick(w); });
    li.appendChild(b);
    list.appendChild(li);
  });
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
    paintPayFrom(id);
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

/* ── starting without a password ───────────────────────────────────────────
   A real key, made the same way as any other; what it skips is choosing a
   password and meeting twelve words before you have decided you care. The
   phrase is sealed with a non-extractable browser key instead. The cost is
   real, so the wallet says so until the phrase is written down. */
const VAULT = window.WARD_VAULT;
const isQuick = () => !!read(K.sealed, null);
const phraseSaved = () => read(K.saved, false);

async function quickStart() {
  if (!VAULT || !VAULT.supported()) throw new Error(tr('w.qnosupport'));
  const signer = E.HDNodeWallet.createRandom();
  write(K.sealed, await VAULT.seal(signer.mnemonic.phrase));
  write(K.addr, signer.address);
  wallet = signer;
  rootPhrase = signer.mnemonic.phrase;
  touch();
  enterWallet();
}

/* Opening one on a later visit: no password, and no unlock screen. */
async function quickOpen() {
  const phrase = await VAULT.unseal(read(K.sealed, null));
  if (!phrase) return false;
  wallet = E.HDNodeWallet.fromPhrase(phrase);
  rootPhrase = phrase;
  touch();
  return true;
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
  /* A different account index is a different Solana key, so the old one must
     not linger on screen while the new one derives. */
  solAcct = null;
  paintAddr();
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
  const c = chain();
  const mine = ++refresh.gen;

  $('.bal-label').textContent = tr('w.balanceon', { net: c.short });
  $('#totalBal').innerHTML = '<span class="skeleton w-40"></span>';
  paintTokens(true);

  if (isSol()) return refreshSol(mine, c);

  const p = provider(), addr = wallet.address;
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
      if (t.native) amt = balances.native == null ? tr('w.na') : fmt(trim(units(balances.native, c.decimals || 18), 6));
      else amt = balances.tokens[t.symbol] == null ? tr('w.na') : fmt(trim(units(balances.tokens[t.symbol], t.decimals), 6));
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
/* Payments are listed for whichever address made them, and the two families
   write addresses differently: EVM hex is compared case-insensitively, base58
   is not — case is meaning there, and lowercasing one would match the wrong
   account. */
const myActs = () => acts().filter(a => {
  if (!a.from) return false;
  if (solAcct && a.from === solAcct.address) return true;
  return wallet && a.from.toLowerCase() === wallet.address.toLowerCase();
});

/* The same shape as the EVM refresh above, and deliberately a separate
   function: the two share a screen and nothing else. */
async function refreshSol(mine, c) {
  const k = await solKeys();
  if (mine !== refresh.gen) return;
  paintAddr();
  if (!k) {
    /* No phrase, so no Solana account: a wallet imported from a private key
       has an EVM key and nothing else. */
    $('#totalBal').textContent = tr('w.na');
    balances.native = null; balances.tokens = {};
    paintTokens(false); fillTokenSelects();
    toast(tr('w.nosolkey'));
    return;
  }
  SOL.setRpc((prefs.rpc[prefs.chainId] || '').trim() || c.rpc);

  try {
    const native = await SOL.balance(k.address);
    if (mine !== refresh.gen) return;
    balances.native = native;
    $('#totalBal').textContent = fmt(trim(SOL.fromLamports(native, c.decimals), 6)) + ' ' + c.coin;
  } catch {
    if (mine !== refresh.gen) return;
    $('#totalBal').textContent = tr('w.unavailable');
    toast(tr('w.couldntread'));
  }

  balances.tokens = {};
  await Promise.all(c.tokens.map(async t => {
    try {
      const bal = await SOL.tokenBalance(k.address, t.address);
      if (mine === refresh.gen) balances.tokens[t.symbol] = bal;
    } catch { /* one unreadable token must not take down the screen */ }
  }));
  if (mine !== refresh.gen) return;
  paintTokens(false);
  fillTokenSelects();
}

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
      const p = makeProvider(prefs.rpc[a.chainId] || c.rpc, a.chainId);
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
  /* A Solana address is base58 and has no checksum to appeal to, and there
     are no .eth names here either. All this can say is that the shape is
     right; whether it is the right account is for the person reading it. */
  if (isSol()) {
    if (SOL.isAddress(v)) {
      hint.textContent = tr('w.validaddress');
      hint.className = 'hint good';
      return v;
    }
    hint.textContent = tr('w.notasoladdress');
    hint.className = 'hint bad';
    return null;
  }
  if (E.isAddress(v)) {
    hint.textContent = tr('w.validaddress');
    hint.className = 'hint good';
    return E.getAddress(v);
  }
  if (/^[\w-]+(\.[\w-]+)+$/.test(v)) {
    const seq = ++resolveSeq;
    hint.textContent = tr('w.lookingup', { name: v });
    hint.className = 'hint';
    try {
      const mp = makeProvider(CHAINS[1].rpc, 1);
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

/* Solana has no gas market to estimate against: a transfer costs the base
   fee per signature, and there is one signature. A token transfer may also
   have to open an account for the recipient, which carries a rent deposit —
   about 0.00204 SOL, and it belongs to them, not to us. */
const SOL_FEE = 5000n;
const ATA_RENT = 2039280n;

async function reviewSol() {
  const c = chain();
  const to = await resolveTo($('#toInput').value);
  if (!to) return fail('#sendErr', tr('w.checkrecipient'));

  const tok = tokenByKey($('#tokenSelect').value);
  const decimals = tok ? tok.decimals : c.decimals;
  const symbol = tok ? tok.symbol : c.coin;

  const raw = parseAmount($('#amtInput').value);
  if (!raw || Number(raw) <= 0) return fail('#sendErr', tr('w.amountzero'));

  let value;
  try { value = SOL.toLamports(raw, decimals); }
  catch { return fail('#sendErr', tr('w.toomanydec', { sym: symbol })); }

  const held = tok ? balances.tokens[tok.symbol] : balances.native;
  if (held != null && value > held) return fail('#sendErr', tr('w.errtokens'));

  /* A token transfer still costs SOL: the signature, and the rent for the
     recipient's token account if they do not have one yet. That deposit is
     theirs, not ours to keep, but it has to be on hand. */
  const fee = tok ? SOL_FEE + ATA_RENT : SOL_FEE;
  if (!tok && balances.native != null && value + fee > balances.native)
    return fail('#sendErr', tr('w.errfunds'));
  if (tok && balances.native != null && fee > balances.native)
    return fail('#sendErr', tr('w.needsolforfee', { coin: c.coin }));

  draft = { to, tok, value, raw, symbol, sol: true, decimals,
            fee: { cost: fee, text: fmt(trim(SOL.fromLamports(fee, c.decimals), 9)) + ' ' + c.coin } };

  $('#cfTitle').textContent = tr('w.confirmthepaym');
  $('#cfAmount').textContent = fmt(trim(raw, 8)) + ' ' + symbol;
  $('#cfTo').textContent = short(to);
  $('#cfNet').textContent = c.name;
  $('#cfFee').textContent = draft.fee.text + (tok ? ' ' + tr('w.plusrent') : '');
  $('#cfAfter').textContent = held == null
    ? tr('w.na')
    : fmt(trim(SOL.fromLamports(held - value - (tok ? 0n : fee), decimals), 6)) + ' ' + symbol;
  openSheet('#confirmSheet');
}

async function doSendSol() {
  const c = chain();
  try {
    const k = await solKeys();
    if (!k) throw new Error(tr('w.nosolkey'));
    SOL.setRpc((prefs.rpc[prefs.chainId] || '').trim() || c.rpc);
    const sig = draft.tok
      ? await SOL.sendToken(k.secret, k.pub, draft.to, draft.tok.address, draft.value, draft.decimals)
      : await SOL.send(k.secret, k.pub, draft.to, draft.value);

    closeSheet('#confirmSheet');
    statusSheet('sending', sig);
    pushAct({
      hash: sig, chainId: prefs.chainId, from: k.address, to: draft.to,
      amount: trim(draft.raw, 8), symbol: draft.symbol, ts: Date.now(),
      status: 'pending', kind: 'send'
    });

    /* Solana confirms in about a second, but the node is asked rather than
       assumed, and a slow one leaves the payment pending rather than claiming
       something that has not happened. */
    let done = false;
    for (let i = 0; i < 20 && !done; i++) {
      await new Promise(r => setTimeout(r, 1200));
      try { done = await SOL.confirmed(sig); } catch (e) { throw e; }
    }
    if (done) { patchAct(sig, { status: 'ok' }); statusSheet('ok', sig); }
    else statusSheet('slow', sig);
    refresh();
  } catch (e) {
    patchAct(draft && draft.hash, { status: 'failed' });
    statusSheet('failed', null, (e && e.message) || tr('w.errunknown'));
  } finally {
    $('#cfSend').disabled = false;
    $('#cfSend').textContent = tr('w.signandsend');
    draft = null;
  }
}

async function review() {
  if (isSol()) return reviewSol();
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
    $('#cfOther').hidden = true;
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
  if (draft.sol) return doSendSol();
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

  $('#stDone').dataset.card = '';
  if (state === 'sending') {
    icon.innerHTML = '<span class="spin"></span>';
    $('#stTitle').textContent = tr('w.sending');
    $('#stText').textContent = tr('w.onthenetwork');
  } else if (state === 'ok' || state === 'plan') {
    icon.className = 'status-icon ok';
    icon.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
    $('#stTitle').textContent = state === 'plan' ? tr('w.planactive') : tr('w.paymentconfirmed');
    /* A plan changes the face of the card, so that is where the button goes. */
    $('#stDone').textContent = state === 'plan' ? tr('w.seeyourcard') : tr('w.done');
    $('#stDone').dataset.card = state === 'plan' ? '1' : '';
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
  $('#addrFull').textContent = myAddress() || '…';
  $('#recvNet').textContent = c.name + ' only';
  $('#recvDot').style.background = c.color;

  /* Which coins this exact address can receive, spelled out. On an EVM chain
     the native coin and its tokens all arrive at the same address — a token
     balance is a row in a contract, not a separate account — so there is no
     such thing as a "USDC address" to show instead. Saying so here is the
     difference between money arriving and money being sent somewhere that
     looks plausible. */
  const coins = [c.coin].concat(c.tokens.map(t => t.symbol));
  $('#recvTakes').textContent = tr('w.recvtakes', { coins: coins.join(', '), net: c.name });

  /* The mistake that cannot be undone. Wrong EVM network is recoverable — the
     address is the same on all of them, so the money is simply on another
     chain — but crossing between Solana and the EVM side is not. */
  $('#recvWarn').textContent = isSol() ? tr('w.recvwarnsol') : tr('w.recvwarnevm');
  /* A Solana address is not an ethereum: URI, and a wallet reading one would
     be pointed at the wrong chain entirely. */
  qrInto($('#qrBox'), isSol() ? (myAddress() || '') : 'ethereum:' + wallet.address + '@' + prefs.chainId, 6);
}

function payLink() {
  const amt = parseAmount($('#chargeAmt').value);
  const note = $('#chargeNote').value.trim();
  const from = has('gold') ? $('#chargeFrom').value.trim() : '';
  const p = new URLSearchParams({ to: myAddress(), chain: String(prefs.chainId), token: $('#chargeToken').value });
  if (amt && Number(amt) > 0) p.set('amount', amt);
  if (note) p.set('note', note);
  if (from) p.set('from', from.slice(0, 32));
  return location.origin + location.pathname + '#/pay?' + p.toString();
}

/* "#/topup" — the wallet marks on the landing page link straight here, so
   clicking Phantom means the screen that links Phantom. */
const wantsTopUp = () => (location.hash || '').startsWith('#/topup');

/* "#/launch" — "Launchpad" on the landing page means the screen that makes a
   coin, not a wallet home the person then has to find it in. With no wallet
   yet it survives creating one and opens straight afterwards. */
const wantsLaunch = () => (location.hash || '').startsWith('#/launch');

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

/* ── The card's face ───────────────────────────────────────────────────────
   Cosmetic, and only here: the name and the stickers live in this browser and
   are never part of a payment. Nothing on the chain knows or cares. */
/* Five stickers, drawn here rather than taken from the emoji set. An emoji is
   a different picture on every operating system and none of them mean anything
   in particular; these are cut from what the page actually says. Each is a disc
   in its own colour with a white die-cut ring, so it reads as something stuck
   on rather than printed, and so it stays legible on the indigo card, the gold
   one and the graphite one alike. */
const STICKER_ART = {
  /* The mark itself. The same shape as the header, so the card is plainly this
     wallet's card. */
  mark: ['#5250E4', '<g transform="translate(8.6 8.6) scale(.715)" fill="none" stroke="#fff" ' +
    'stroke-width="5" stroke-linecap="round"><path d="M19.6 7.6A8.9 8.9 0 1 0 24.9 16"/>' +
    '<path d="M24.9 16h-5.6"/></g><circle cx="25.9" cy="13.8" r="2.3" fill="#fff"/>'],
  /* "Only your key fits" is the whole of the front page, so the key is the one
     sticker that had to exist. */
  key: ['#D9982F', '<g fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round">' +
    '<circle cx="20" cy="14.2" r="4.6"/><path d="M20 18.8v11.4"/><path d="M20 24.6h4.2"/>' +
    '<path d="M20 28.6h3.2"/></g>'],
  /* The wards in a warded lock: the obstruction that asks nobody's permission.
     It is where the name comes from. */
  shield: ['#2C8F72', '<path d="M20 9.4l8.4 3.1v6.9c0 5.6-3.5 9.4-8.4 11.4-4.9-2-8.4-5.8-8.4-11.4v-6.9z" ' +
    'fill="#fff"/><circle cx="20" cy="18.6" r="2.4" fill="#2C8F72"/>' +
    '<path d="M18.5 20.4h3l.9 4.4h-4.8z" fill="#2C8F72"/>'],
  /* "A couple of seconds later it sits in a block, and it is yours." */
  block: ['#414A73', '<g fill="none" stroke="#fff" stroke-width="2.6" stroke-linejoin="round" ' +
    'stroke-linecap="round"><path d="M20 9.6 29.6 15v10L20 30.4 10.4 25V15z"/>' +
    '<path d="M10.4 15 20 20.5 29.6 15"/><path d="M20 20.5v9.9"/></g>'],
  /* Seconds instead of days, which is the other half of why settlement being
     final is worth the trade. */
  bolt: ['#C6455F', '<path d="M23.2 8.8 12.6 23h6.2l-1.8 8.6L27.4 17h-6.1z" fill="#fff"/>']
};
const STICKERS = Object.keys(STICKER_ART);
const MAX_STICKERS = 2;

/* One SVG string per sticker, used both on the card and in the picker; the
   size comes from CSS so the same markup serves both. */
function stickerSvg(key) {
  const art = STICKER_ART[key];
  if (!art) return '';
  return '<svg class="st" viewBox="0 0 40 40" aria-hidden="true">' +
    '<circle cx="20" cy="20" r="18.6" fill="' + art[0] + '" stroke="#fff" stroke-width="2.2"/>' +
    art[1] + '</svg>';
}

/* The honorific printed before the name. Stored as one of these keys, never as
   the words themselves, so the card follows the language the wallet is in
   rather than freezing whichever one it was set in. Mx is here because a card
   that prints a gendered title should offer a way out of choosing one. */
const CARD_TITLES = ['', 'mr', 'mrs', 'mx'];
const titleWord = key => (key ? tr('w.title' + key) : '');

/* Stickers used to be emoji and are drawings now, so anything saved under the
   old scheme is not a sticker any more and is dropped rather than left to paint
   as nothing. The check runs every load, because stored preferences are only
   ever as trustworthy as the last version that wrote them. */
prefs.card.stickers = prefs.card.stickers.filter(k => STICKERS.indexOf(k) >= 0).slice(0, MAX_STICKERS);
if (CARD_TITLES.indexOf(prefs.card.title) < 0) prefs.card.title = '';

/* Which coin the card shows. The list used to be four coins picked by hand,
   which meant choosing one also changed the network under you. It is the
   current network's own coins now — its native one first, then its tokens —
   so the network is chosen on the card's own network chip and the coins
   follow it, rather than the other way round. */
const cardCoins = () => {
  const c = chain();
  return [{ key: c.coin, symbol: null }].concat(c.tokens.map(t => ({ key: t.symbol, symbol: t.symbol })));
};
/* A coin saved on one network usually does not exist on the next, so a stored
   choice that is not on this chain falls back to what every chain has: its
   own native coin. */
const cardCoin = () => {
  const list = cardCoins();
  return list.find(x => x.key === prefs.card.coin) || list[0];
};

function paintCardFaces() {
  const c = prefs.card;
  const name = (c.name || '').trim();
  /* The title only makes sense in front of a name, so an empty name hides it
     rather than leaving a lone "Mr" embossed on the card. */
  const line = name ? ((titleWord(c.title) ? titleWord(c.title) + ' ' : '') + name) : '';
  [['#bcName', '#bcStickers'], ['#cardName', '#cardStickers']].forEach(([n, st]) => {
    const el = $(n);
    if (el) { el.textContent = line; el.hidden = !line; }
    const box = $(st);
    if (box) box.innerHTML = c.stickers.map(stickerSvg).join('');
  });
}

function paintCard() {
  const c = chain();
  $('#cardTier').textContent = PLANS[plan].name;
  $('#cardNet').textContent = c.short;
  const pickedCoin = cardCoin();
  const tok = pickedCoin.symbol ? c.tokens.find(t => t.symbol === pickedCoin.symbol) : null;
  const held = tok ? balances.tokens[tok.symbol] : balances.native;
  $('#cardBalLabel').textContent = tr('w.balanceon', { net: c.short });
  $('#cardBal').textContent = held == null
    ? tr('w.na')
    : fmt(trim(units(held, tok ? tok.decimals : (c.decimals || 18)), 6)) + ' ' + (tok ? tok.symbol : c.coin);

  const coins = $('#coinPick');
  coins.innerHTML = '';
  cardCoins().forEach(coin => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = coin.key;
    b.className = coin.key === pickedCoin.key ? 'on' : '';
    b.addEventListener('click', () => pickCardCoin(coin));
    coins.appendChild(b);
  });
  $('#cardAddr').textContent = myAddress() ? short(myAddress()) : '…';
  $('#cardNameInput').value = prefs.card.name;

  const pick = $('#stickerPick');
  pick.innerHTML = '';
  STICKERS.forEach(sticker => {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = stickerSvg(sticker);
    b.setAttribute('aria-label', tr('w.st' + sticker));
    b.setAttribute('aria-pressed', String(prefs.card.stickers.includes(sticker)));
    b.className = prefs.card.stickers.includes(sticker) ? 'on' : '';
    b.addEventListener('click', () => toggleSticker(sticker));
    pick.appendChild(b);
  });

  const titles = $('#titlePick');
  titles.innerHTML = '';
  CARD_TITLES.forEach(key => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = key ? titleWord(key) : tr('w.titlenone');
    b.className = key === prefs.card.title ? 'on' : '';
    b.setAttribute('aria-pressed', String(key === prefs.card.title));
    b.addEventListener('click', () => {
      prefs.card.title = key;
      savePrefs();
      paintCard();
    });
    titles.appendChild(b);
  });
  paintCardFaces();
}

function pickCardCoin(coin) {
  prefs.card.coin = coin.key;
  savePrefs();
  paintCard();
}

function toggleSticker(sticker) {
  const list = prefs.card.stickers;
  const at = list.indexOf(sticker);
  if (at >= 0) list.splice(at, 1);
  /* Two is the limit, so a third pushes the oldest one off rather than being
     silently ignored. */
  else { list.push(sticker); if (list.length > MAX_STICKERS) list.shift(); }
  savePrefs();
  paintCard();
}

function paintLangList() {
  const list = $('#langList');
  list.innerHTML = '';
  LANGS.forEach(l => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.lang = l.id;
    b.className = l.id === chosenLang ? 'sel' : '';
    b.innerHTML = '<span class="nl-mid"><b></b></span><span class="nl-tick" aria-hidden="true"></span>';
    const n = b.querySelector('b');
    n.textContent = l.name;
    /* Each name is written in its own language, so it is tagged with that
       language or the browser reaches for the wrong font to draw it. */
    n.lang = l.html || l.id;
    if (l.rtl) n.dir = 'rtl';
    b.addEventListener('click', () => { useLang(l.id); closeSheet('#langSheet'); });
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
    b.addEventListener('click', () => { switchChain(id); closeSheet('#netSheet'); });
    li.appendChild(b);
    list.appendChild(li);
  });
}

/* ── Boot ──────────────────────────────────────────────────────────────────── */
function enterWallet() {
  paintQuickWarn();
  paintNet();
  fillTokenSelects();
  const acc = prefs.accounts.find(a => a.i === prefs.active);
  $('#acctName').textContent = acc && acc.name ? acc.name : tr('w.accountn', { n: 1 });
  paintAddr();
  paintChainMode();
  paintCardFaces();
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
  else if (launchWanted) { launchWanted = false; history.replaceState(null, '', location.pathname); show('launch'); }
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
  useLang(lang);
  $('#versionLine').textContent = tr('w.everythingruns', { v: E.version || '6' });
  prefill = readPayHash();
  planWanted = readPlanHash();
  topUpWanted = wantsTopUp();
  launchWanted = wantsLaunch();
  paintNet();
  paintNetList();
  fillTokenSelects();
  paintTier();
  scanWallets();
  /* A wallet started without a password has no unlock screen: the key that
     opens it is already in this browser, so asking for something the person
     never set would be theatre. It still has to be opened asynchronously, so
     the welcome screen goes up first and is replaced when it lands. */
  if (isQuick()) {
    show('welcome');
    quickOpen().then(ok => {
      if (!ok) { drop(K.sealed); show('welcome'); return toast(tr('w.qlostkey')); }
      enterWallet();
      if (launchWanted) { launchWanted = false; history.replaceState(null, '', location.pathname); show('launch'); }
    }).catch(() => { show('welcome'); toast(tr('w.qlostkey')); });
    return;
  }
  /* Someone who clicked "Launchpad" with no wallet yet should land on the
     launch screen and read why it cannot start, rather than on a welcome page
     that never mentions the thing they came for. Locked wallets still unlock
     first; the screen opens on its own afterwards. */
  if (launchWanted && !read(K.store, null)) show('launch');
  else show(read(K.store, null) ? 'unlock' : 'welcome');
}

/* ── Wiring ────────────────────────────────────────────────────────────────── */
$$('[data-go]').forEach(b => b.addEventListener('click', () => show(b.dataset.go)));
wireLaunch();

/* One tap to a working wallet. Both buttons do the same thing; one is on the
   welcome screen and one is on the launch screen, which is where someone who
   came for the launchpad actually lands. */
async function startQuick(btn) {
  if (btn) btn.disabled = true;
  try {
    await quickStart();
    paintQuickWarn();
    if (launchWanted) { launchWanted = false; history.replaceState(null, '', location.pathname); show('launch'); }
    toast(tr('w.walletready'));
  } catch (e) {
    toast((e && e.message) || tr('w.errunknown'));
  } finally { if (btn) btn.disabled = false; }
}
$('#quickGo').addEventListener('click', e => startQuick(e.currentTarget));
$('#quickGoLaunch').addEventListener('click', e => startQuick(e.currentTarget));

/* Shown whenever the wallet is one of these and the phrase has not been seen.
   Not dismissable: it is describing a condition, not announcing news. */
function paintQuickWarn() {
  const w = $('#quickWarn');
  if (w) w.hidden = !(wallet && isQuick() && !phraseSaved());
}
/* Only this button makes a new phrase. Stepping back from the check shows the
   same one: regenerating would void what they already wrote down. */
$('#startCreate').addEventListener('click', startCreate);
$$('[data-close-sheet]').forEach(b => b.addEventListener('click', () => closeAllSheets()));

$('#brandHome').addEventListener('click', () => wallet && show('home'));
$('#netPill').addEventListener('click', () => { paintNetList(); openSheet('#netSheet'); });
/* The chip on the card face is the other way in. It is where you are looking
   when you are deciding what the card should show. */
$('#cardNet').addEventListener('click', () => { paintNetList(); openSheet('#netSheet'); });
$('#langPill').addEventListener('click', () => { paintLangList(); openSheet('#langSheet'); });
$('#cardEdit').addEventListener('click', () => show('card'));
$('#cardNameInput').addEventListener('input', e => {
  prefs.card.name = e.target.value.slice(0, 22);
  savePrefs();
  paintCardFaces();
});
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

$('#addrChip').addEventListener('click', () => copy(myAddress(), 'Address copied'));
$('#copyAddr').addEventListener('click', () => copy(myAddress(), 'Address copied'));
$('#shareAddr').addEventListener('click', () => share(myAddress(), 'My address'));

$('#toInput').addEventListener('change', e => resolveTo(e.target.value));
$('#toInput').addEventListener('blur', e => resolveTo(e.target.value));
$('#tokenSelect').addEventListener('change', () => { $('#amtHint').textContent = ''; });
$('#maxBtn').addEventListener('click', useMax);
$('#reviewBtn').addEventListener('click', review);
$('#cfSend').addEventListener('click', doSend);
$('#stDone').addEventListener('click', e => {
  closeSheet('#statusSheet');
  show(e.currentTarget.dataset.card ? 'card' : 'home');
});
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
  /* A wallet started without a password has none to ask for, so the field goes
     and the prompt stops asking for something that was never set. */
  const quick = isQuick();
  $('#seedPw').closest('.field').hidden = quick;
  $('#seedGateWrap').querySelector('.sub').textContent =
    tr(quick ? 'w.qshowsub' : 'w.typeyourpasswo');
  openSheet('#seedSheet');
});
$('#seedGo').addEventListener('click', async () => {
  const btn = $('#seedGo');
  btn.disabled = true; btn.textContent = 'Decrypting…';
  try {
    /* A wallet started without a password has none to ask for. Its phrase is
       sealed with the browser's own key, so the vault opens it directly. */
    let phrase;
    if (isQuick()) {
      phrase = await VAULT.unseal(read(K.sealed, null));
      if (!phrase) { fail('#seedErr', tr('w.qlostkey')); return; }
    } else {
      const w = await E.Wallet.fromEncryptedJson(read(K.store, ''), $('#seedPw').value);
      if (!w.mnemonic) { fail('#seedErr', 'This wallet was imported from a private key, so it has no phrase.'); return; }
      phrase = w.mnemonic.phrase;
    }
    paintSeed($('#seedShow'), phrase.split(' '));
    $('#seedShow').dataset.phrase = phrase;
    $('#seedGateWrap').hidden = true;
    $('#seedShowWrap').hidden = false;
    /* They have now seen the words, which is the thing the banner was asking
       for. Whether they wrote them down is not something a browser can know. */
    write(K.saved, true);
    paintQuickWarn();
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
  if (wantsLaunch()) {
    launchWanted = true;
    if (wallet) { launchWanted = false; history.replaceState(null, '', location.pathname); show('launch'); }
    return;
  }
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
