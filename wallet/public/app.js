/* Calma — wallet no custodia.
 *
 * Todo lo que importa pasa en este archivo y en el navegador de quien lo abre:
 * la clave se genera aquí, se cifra aquí y se firma aquí. La única salida a la
 * red son llamadas JSON-RPC al nodo de la cadena elegida; la clave privada no
 * sale nunca, ni siquiera cifrada.
 *
 * Por eso ethers va servido desde /vendor y no desde una CDN: un script de
 * terceros en una página que maneja claves es una puerta abierta. */

(() => {
'use strict';

const E = window.ethers;

/* ── Redes ─────────────────────────────────────────────────────────────────
   Todas son cadenas reales. Las marcadas test: true también lo son — mismo
   protocolo, mismos bloques — solo que su moneda no vale dinero, así que
   sirven para comprobar que un cobro funciona antes de arriesgar nada. */
const CHAINS = {
  8453: {
    name: 'Base', short: 'Base', coin: 'ETH', color: '#2151F5',
    rpc: 'https://mainnet.base.org', explorer: 'https://basescan.org',
    blurb: 'Rápida y con comisiones de céntimos',
    tokens: [
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', color: '#2775CA' },
      { symbol: 'USDT', name: 'Tether USD', decimals: 6, address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', color: '#26A17B' }
    ]
  },
  137: {
    name: 'Polygon', short: 'Polygon', coin: 'POL', color: '#8247E5',
    rpc: 'https://polygon-rpc.com', explorer: 'https://polygonscan.com',
    blurb: 'Comisiones mínimas, muy usada para cobros',
    tokens: [
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', color: '#2775CA' },
      { symbol: 'USDT', name: 'Tether USD', decimals: 6, address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', color: '#26A17B' }
    ]
  },
  42161: {
    name: 'Arbitrum One', short: 'Arbitrum', coin: 'ETH', color: '#12AAFF',
    rpc: 'https://arb1.arbitrum.io/rpc', explorer: 'https://arbiscan.io',
    blurb: 'Barata y con mucha liquidez',
    tokens: [
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', color: '#2775CA' },
      { symbol: 'USDT', name: 'Tether USD', decimals: 6, address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', color: '#26A17B' }
    ]
  },
  10: {
    name: 'Optimism', short: 'Optimism', coin: 'ETH', color: '#FF0420',
    rpc: 'https://mainnet.optimism.io', explorer: 'https://optimistic.etherscan.io',
    blurb: 'Rápida, comisiones bajas',
    tokens: [
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', color: '#2775CA' },
      { symbol: 'USDT', name: 'Tether USD', decimals: 6, address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', color: '#26A17B' }
    ]
  },
  1: {
    name: 'Ethereum', short: 'Ethereum', coin: 'ETH', color: '#627EEA',
    rpc: 'https://ethereum-rpc.publicnode.com', explorer: 'https://etherscan.io',
    blurb: 'La principal — comisiones más altas',
    tokens: [
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', color: '#2775CA' },
      { symbol: 'USDT', name: 'Tether USD', decimals: 6, address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', color: '#26A17B' }
    ]
  },
  84532: {
    name: 'Base Sepolia', short: 'Base Sepolia', coin: 'ETH', color: '#7B8794', test: true,
    rpc: 'https://sepolia.base.org', explorer: 'https://sepolia.basescan.org',
    blurb: 'Para probar sin gastar — el dinero aquí no vale nada',
    tokens: [
      { symbol: 'USDC', name: 'USDC de prueba', decimals: 6, address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', color: '#2775CA' }
    ]
  },
  11155111: {
    name: 'Sepolia', short: 'Sepolia', coin: 'ETH', color: '#7B8794', test: true,
    rpc: 'https://ethereum-sepolia-rpc.publicnode.com', explorer: 'https://sepolia.etherscan.io',
    blurb: 'La red de pruebas de Ethereum',
    tokens: [
      { symbol: 'USDC', name: 'USDC de prueba', decimals: 6, address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', color: '#2775CA' }
    ]
  }
};
const CHAIN_ORDER = [8453, 137, 42161, 10, 1, 84532, 11155111];

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)'
];

/* ── Almacenamiento ────────────────────────────────────────────────────────
   Solo tres cosas en localStorage: el keystore cifrado, la dirección (que es
   pública de todos modos) y las preferencias. Nada en claro. */
const K = {
  store: 'calma.v1.keystore',
  addr:  'calma.v1.address',
  prefs: 'calma.v1.prefs',
  acts:  'calma.v1.activity'
};

const read = (k, fb) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

let prefs = Object.assign({ chainId: 8453, rpc: {} }, read(K.prefs, {}));
if (!CHAINS[prefs.chainId]) prefs.chainId = 8453;
const savePrefs = () => write(K.prefs, prefs);

/* ── Estado de sesión (solo en memoria, nunca persistido) ─────────────────── */
let wallet = null;            // firmante descifrado; se borra al bloquear
let pendingMnemonic = null;   // frase recién creada, viva hasta cifrarla
let pendingImport = null;     // wallet importada, a la espera de contraseña
let lockTimer = null;
let balances = { native: null, tokens: {} };
let draft = null;             // pago preparado, a la espera de confirmación
let prefill = null;           // cobro llegado por enlace

const chain = () => CHAINS[prefs.chainId];
const rpcUrl = () => (prefs.rpc[prefs.chainId] || '').trim() || chain().rpc;

let _provider = null, _providerKey = '';
function provider() {
  const key = prefs.chainId + '|' + rpcUrl();
  if (_provider && _providerKey === key) return _provider;
  _providerKey = key;
  _provider = new E.JsonRpcProvider(rpcUrl(), E.Network.from(Number(prefs.chainId)), { staticNetwork: true });
  return _provider;
}

/* ── Utilidades de pantalla ────────────────────────────────────────────────── */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

function show(name) {
  $$('.view').forEach(v => v.classList.toggle('on', v.dataset.view === name));
  const chrome = ['welcome', 'create', 'verify', 'password', 'import', 'unlock'].indexOf(name) === -1;
  $('#bar').hidden = !chrome;
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  if (name === 'receive') paintReceive();
  if (name === 'activity') paintActivity($('#allList'), 100);
  if (name === 'settings') $('#rpcInput').value = prefs.rpc[prefs.chainId] || '';
}

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  $('#toasts').appendChild(el);
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
    toast(said || 'Copiado');
  } catch { toast('No se pudo copiar'); }
}

async function share(text, title) {
  if (navigator.share) { try { await navigator.share({ title, text }); return; } catch {} }
  copy(text, 'Copiado — ya puedes pegarlo');
}

const short = a => a ? a.slice(0, 6) + '···' + a.slice(-4) : '';

/* Recorta ceros a la derecha sin caer en notación científica. */
function trim(str, max = 6) {
  if (!str.includes('.')) return str;
  let [i, d] = str.split('.');
  d = d.slice(0, max).replace(/0+$/, '');
  return d ? i + '.' + d : i;
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
  if (img) { img.alt = 'Código QR'; img.removeAttribute('width'); img.removeAttribute('height'); }
}

/* ── Bloqueo automático ────────────────────────────────────────────────────
   Media hora de móvil olvidado en una mesa no debería costarle nada a nadie. */
const LOCK_MS = 5 * 60 * 1000;
function touch() {
  if (!wallet) return;
  clearTimeout(lockTimer);
  lockTimer = setTimeout(() => lock(true), LOCK_MS);
}
function lock(auto) {
  wallet = null;
  clearTimeout(lockTimer);
  balances = { native: null, tokens: {} };
  closeAllSheets();
  show('unlock');
  $('#unlockPw').value = '';
  fail('#unlockErr', '');
  if (auto) toast('Bloqueada por inactividad');
}
['click', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, touch, { passive: true }));

/* ── Alta de wallet ────────────────────────────────────────────────────────── */
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
  $('#blurSeed').textContent = 'Ocultar';
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
    row.querySelector('b').textContent = 'Palabra ' + (i + 1);
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
  const pct = [6, 28, 52, 76, 100][s];
  const col = ['var(--danger)', 'var(--danger)', 'var(--warn)', 'var(--ok)', 'var(--brand)'][s];
  const txt = ['', 'Muy débil', 'Débil', 'Bien', 'Excelente'][s];
  $('#pwBar').style.width = p ? pct + '%' : '0';
  $('#pwBar').style.background = col;
  $('#pwLabel').textContent = txt || ' ';
}

async function persist(signer, password) {
  const json = await signer.encrypt(password);
  write(K.store, json);
  write(K.addr, signer.address);
  wallet = signer;
  touch();
}

/* ── Saldos ────────────────────────────────────────────────────────────────── */
async function refresh() {
  if (!wallet) return;
  const c = chain(), p = provider(), addr = wallet.address;
  const mine = ++refresh.gen;

  $('.bal-label').textContent = 'Saldo en ' + c.short;
  $('#totalBal').innerHTML = '<span class="skeleton w-40"></span>';
  paintTokens(true);

  try {
    const native = await p.getBalance(addr);
    if (mine !== refresh.gen) return;
    balances.native = native;
    $('#totalBal').textContent = trim(E.formatEther(native), 6) + ' ' + c.coin;
  } catch (err) {
    if (mine !== refresh.gen) return;
    $('#totalBal').textContent = '—';
    toast('No se pudo leer el saldo. ¿Conexión?');
  }

  balances.tokens = {};
  await Promise.all(c.tokens.map(async t => {
    try {
      const bal = await new E.Contract(t.address, ERC20_ABI, p).balanceOf(addr);
      if (mine === refresh.gen) balances.tokens[t.symbol] = bal;
    } catch { /* un token ilegible no debe tumbar la pantalla */ }
  }));
  if (mine !== refresh.gen) return;
  paintTokens(false);
  fillTokenSelects();
}
refresh.gen = 0;

function coinBadge(symbol, color) {
  return `<span class="coin" style="background:${color}">${symbol.slice(0, 4)}</span>`;
}

function paintTokens(loading) {
  const c = chain(), list = $('#tokenList');
  list.innerHTML = '';
  const rows = [{ symbol: c.coin, name: c.name, color: c.color, native: true }].concat(c.tokens);
  rows.forEach(t => {
    let amt = '…';
    if (!loading) {
      if (t.native) amt = balances.native == null ? '—' : trim(E.formatEther(balances.native), 6);
      else amt = balances.tokens[t.symbol] == null ? '—' : trim(E.formatUnits(balances.tokens[t.symbol], t.decimals), 6);
    }
    const li = document.createElement('li');
    li.innerHTML = coinBadge(t.symbol, t.color) +
      `<div class="tok-mid"><b></b><small></small></div><div class="tok-amt"></div>`;
    li.querySelector('b').textContent = t.symbol;
    li.querySelector('small').textContent = t.native ? 'Moneda de la red' : t.name;
    li.querySelector('.tok-amt').textContent = amt;
    list.appendChild(li);
  });
}

function fillTokenSelects() {
  const c = chain();
  [$('#tokenSelect'), $('#chargeToken')].forEach(sel => {
    const keep = sel.value;
    sel.innerHTML = '';
    const opts = [{ v: 'native', l: c.coin + ' · moneda de ' + c.short }]
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

/* ── Actividad ─────────────────────────────────────────────────────────────── */
const acts = () => read(K.acts, []);
function pushAct(a) { const l = acts(); l.unshift(a); write(K.acts, l.slice(0, 80)); }
function patchAct(hash, patch) {
  const l = acts(); const i = l.findIndex(x => x.hash === hash);
  if (i > -1) { Object.assign(l[i], patch); write(K.acts, l); }
}

function paintActivity(list, limit) {
  const mine = acts().filter(a => a.from && wallet && a.from.toLowerCase() === wallet.address.toLowerCase());
  const rows = mine.slice(0, limit);
  list.innerHTML = '';
  if (!rows.length) {
    list.innerHTML = '<li class="empty">Todavía no has hecho ningún pago desde aquí.</li>';
    return;
  }
  rows.forEach(a => {
    const c = CHAINS[a.chainId];
    const cls = a.status === 'ok' ? 'ok' : a.status === 'fail' ? 'fail' : 'pend';
    const tag = a.status === 'ok' ? 'Confirmado' : a.status === 'fail' ? 'Rechazado' : 'En camino';
    const icon = cls === 'pend'
      ? '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 8v4.5l3 1.6"/></svg>'
      : cls === 'ok'
        ? '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'
        : '<svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7L7 17"/></svg>';
    const li = document.createElement('li');
    li.innerHTML =
      `<span class="act-badge ${cls}">${icon}</span>` +
      `<div class="tok-mid"><b></b><small></small></div>` +
      `<div class="tok-amt"><div></div><span class="st-tag ${cls}">${tag}</span></div>`;
    li.querySelector('b').textContent = 'A ' + short(a.to);
    li.querySelector('small').textContent = (c ? c.short : 'Red ' + a.chainId) + ' · ' +
      new Date(a.ts).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    li.querySelector('.tok-amt div').textContent = '−' + a.amount + ' ' + a.symbol;
    if (c) {
      li.style.cursor = 'pointer';
      li.addEventListener('click', () => window.open(c.explorer + '/tx/' + a.hash, '_blank', 'noopener'));
    }
    list.appendChild(li);
  });
}

/* Los pagos que quedaron en el aire (pestaña cerrada, red lenta) se reconcilian
   contra la cadena al volver: la blockchain es la fuente de verdad, no esta lista. */
async function reconcile() {
  for (const a of acts().filter(x => x.status === 'pending')) {
    const c = CHAINS[a.chainId];
    if (!c) continue;
    try {
      const p = new E.JsonRpcProvider((prefs.rpc[a.chainId] || c.rpc), E.Network.from(Number(a.chainId)), { staticNetwork: true });
      const r = await p.getTransactionReceipt(a.hash);
      if (r) patchAct(a.hash, { status: r.status === 1 ? 'ok' : 'fail' });
    } catch {}
  }
  if (wallet) { paintActivity($('#recentList'), 4); paintActivity($('#allList'), 100); }
}

/* ── Envío ─────────────────────────────────────────────────────────────────── */
let resolveSeq = 0;
async function resolveTo(raw) {
  const v = raw.trim();
  const hint = $('#toHint');
  if (!v) { hint.textContent = ''; hint.className = 'hint'; return null; }
  if (E.isAddress(v)) {
    hint.textContent = 'Dirección válida';
    hint.className = 'hint good';
    return E.getAddress(v);
  }
  if (/^[\w-]+(\.[\w-]+)+$/.test(v)) {
    const seq = ++resolveSeq;
    hint.textContent = 'Buscando ' + v + '…';
    hint.className = 'hint';
    try {
      const mp = new E.JsonRpcProvider(CHAINS[1].rpc, E.Network.from(1), { staticNetwork: true });
      const addr = await mp.resolveName(v);
      if (seq !== resolveSeq) return null;
      if (addr) { hint.textContent = v + ' → ' + short(addr); hint.className = 'hint good'; return addr; }
      hint.textContent = 'Ese nombre no apunta a ninguna dirección'; hint.className = 'hint bad';
      return null;
    } catch {
      if (seq === resolveSeq) { hint.textContent = 'No se pudo consultar el nombre'; hint.className = 'hint bad'; }
      return null;
    }
  }
  hint.textContent = 'No parece una dirección ni un nombre .eth';
  hint.className = 'hint bad';
  return null;
}

async function feeFor(tx) {
  const p = provider();
  const [fd, gas] = await Promise.all([p.getFeeData(), p.estimateGas(Object.assign({ from: wallet.address }, tx))]);
  const price = fd.maxFeePerGas || fd.gasPrice;
  const limit = (gas * 120n) / 100n;      // margen: un límite justo se queda corto
  return { limit, price, cost: limit * (price || 0n), fd };
}

async function review() {
  fail('#sendErr', '');
  const to = await resolveTo($('#toInput').value);
  if (!to) return fail('#sendErr', 'Revisa el destinatario antes de continuar.');

  const key = $('#tokenSelect').value;
  const tok = tokenByKey(key);
  const c = chain();
  const raw = $('#amtInput').value.trim().replace(',', '.');
  if (!raw || !/^\d*\.?\d*$/.test(raw) || Number(raw) <= 0) return fail('#sendErr', 'Escribe una cantidad mayor que cero.');

  let value;
  try { value = tok ? E.parseUnits(raw, tok.decimals) : E.parseEther(raw); }
  catch { return fail('#sendErr', 'Esa cantidad tiene demasiados decimales para ' + (tok ? tok.symbol : c.coin) + '.'); }

  const have = tok ? balances.tokens[tok.symbol] : balances.native;
  if (have != null && value > have) return fail('#sendErr', 'No tienes tanto ' + (tok ? tok.symbol : c.coin) + ' en ' + c.short + '.');

  $('#reviewBtn').disabled = true;
  $('#reviewBtn').textContent = 'Calculando comisión…';
  try {
    const tx = tok
      ? { to: tok.address, data: new E.Interface(ERC20_ABI).encodeFunctionData('transfer', [to, value]) }
      : { to, value };
    const fee = await feeFor(tx);

    if (!tok && balances.native != null && value + fee.cost > balances.native)
      throw new Error('Te falta ' + c.coin + ' para cubrir la cantidad más la comisión. Prueba con MÁX.');
    if (tok && balances.native != null && fee.cost > balances.native)
      throw new Error('Necesitas algo de ' + c.coin + ' en ' + c.short + ' para pagar la comisión de red.');

    draft = { to, tok, value, raw, fee, symbol: tok ? tok.symbol : c.coin };

    $('#cfAmount').textContent = trim(raw, 8) + ' ' + draft.symbol;
    $('#cfTo').textContent = short(to);
    $('#cfNet').textContent = c.name + (c.test ? ' (prueba)' : '');
    $('#cfFee').textContent = '≈ ' + trim(E.formatEther(fee.cost), 7) + ' ' + c.coin;
    const after = tok
      ? (balances.tokens[tok.symbol] != null ? trim(E.formatUnits(balances.tokens[tok.symbol] - value, tok.decimals), 6) + ' ' + tok.symbol : '—')
      : (balances.native != null ? trim(E.formatEther(balances.native - value - fee.cost), 6) + ' ' + c.coin : '—');
    $('#cfAfter').textContent = after;
    fail('#cfErr', '');
    $('#cfSend').disabled = false;
    $('#cfSend').textContent = 'Firmar y enviar';
    openSheet('#confirmSheet');
  } catch (err) {
    fail('#sendErr', friendly(err));
  } finally {
    $('#reviewBtn').disabled = false;
    $('#reviewBtn').textContent = 'Revisar pago';
  }
}

function friendly(err) {
  const m = (err && (err.shortMessage || err.reason || err.message) || '').toString();
  if (/insufficient funds/i.test(m)) return 'Saldo insuficiente para la cantidad más la comisión de red.';
  if (/transfer amount exceeds balance/i.test(m)) return 'No tienes tantos tokens en esta red.';
  if (/could not detect network|network|fetch|timeout/i.test(m)) return 'No se pudo hablar con la red. Revisa tu conexión o cambia el RPC en Ajustes.';
  if (/nonce/i.test(m)) return 'Hay otro pago tuyo en camino. Espera a que confirme e inténtalo de nuevo.';
  if (/replacement fee too low/i.test(m)) return 'Ya hay un pago pendiente igual. Espera a que confirme.';
  return m || 'Algo no salió bien.';
}

async function doSend() {
  if (!draft || !wallet) return;
  $('#cfSend').disabled = true;
  $('#cfSend').textContent = 'Firmando…';
  const c = chain();

  try {
    const signer = wallet.connect(provider());
    const overrides = { gasLimit: draft.fee.limit };
    if (draft.fee.fd.maxFeePerGas) {
      overrides.maxFeePerGas = draft.fee.fd.maxFeePerGas;
      overrides.maxPriorityFeePerGas = draft.fee.fd.maxPriorityFeePerGas;
    } else {
      overrides.gasPrice = draft.fee.price;
    }

    const tx = draft.tok
      ? await new E.Contract(draft.tok.address, ERC20_ABI, signer).transfer(draft.to, draft.value, overrides)
      : await signer.sendTransaction(Object.assign({ to: draft.to, value: draft.value }, overrides));

    closeSheet('#confirmSheet');
    statusSheet('sending', tx.hash);

    pushAct({
      hash: tx.hash, chainId: Number(prefs.chainId), from: wallet.address, to: draft.to,
      amount: trim(draft.raw, 8), symbol: draft.symbol, ts: Date.now(), status: 'pending'
    });

    let receipt = null;
    try { receipt = await tx.wait(1, 120000); } catch {}

    if (receipt && receipt.status === 1) {
      patchAct(tx.hash, { status: 'ok' });
      statusSheet('ok', tx.hash);
    } else if (receipt) {
      patchAct(tx.hash, { status: 'fail' });
      statusSheet('fail', tx.hash, 'La red rechazó la transacción. No se movió tu dinero, salvo la comisión.');
    } else {
      statusSheet('slow', tx.hash);
    }

    $('#toInput').value = ''; $('#amtInput').value = ''; $('#toHint').textContent = '';
    $('#payNote').hidden = true; prefill = null;
    draft = null;
    refresh();
    paintActivity($('#recentList'), 4);
  } catch (err) {
    fail('#cfErr', friendly(err));
    $('#cfSend').disabled = false;
    $('#cfSend').textContent = 'Firmar y enviar';
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
    $('#stTitle').textContent = 'Enviando…';
    $('#stText').textContent = 'Tu pago está en la red. Suele tardar unos segundos.';
  } else if (state === 'ok') {
    icon.className = 'status-icon ok';
    icon.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
    $('#stTitle').textContent = 'Pago confirmado';
    $('#stText').textContent = 'Ya está registrado en ' + c.name + '. Es definitivo.';
  } else if (state === 'slow') {
    icon.className = 'status-icon';
    icon.innerHTML = '<svg viewBox="0 0 24 24" style="stroke:var(--warn)"><circle cx="12" cy="12" r="8.5"/><path d="M12 8v4.5l3 1.6"/></svg>';
    $('#stTitle').textContent = 'Sigue en camino';
    $('#stText').textContent = 'La red va lenta. El pago se envió y se confirmará solo; puedes seguirlo en el explorador.';
  } else {
    icon.className = 'status-icon fail';
    icon.innerHTML = '<svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7L7 17"/></svg>';
    $('#stTitle').textContent = 'No se completó';
    $('#stText').textContent = msg || 'Inténtalo de nuevo.';
  }
}

async function useMax() {
  const tok = tokenByKey($('#tokenSelect').value);
  if (tok) {
    const b = balances.tokens[tok.symbol];
    if (b == null) return toast('Aún no sé tu saldo');
    $('#amtInput').value = trim(E.formatUnits(b, tok.decimals), tok.decimals);
    return;
  }
  if (balances.native == null) return toast('Aún no sé tu saldo');
  $('#maxBtn').textContent = '…';
  try {
    const to = E.isAddress($('#toInput').value.trim()) ? $('#toInput').value.trim() : wallet.address;
    const fee = await feeFor({ to, value: 1n });
    const left = balances.native - fee.cost;
    if (left <= 0n) { $('#amtInput').value = '0'; toast('La comisión se lleva todo tu saldo'); }
    else $('#amtInput').value = trim(E.formatEther(left), 8);
    $('#amtHint').textContent = 'Dejamos fuera la comisión de red estimada.';
  } catch { toast('No se pudo estimar la comisión'); }
  finally { $('#maxBtn').textContent = 'MÁX'; }
}

/* ── Recibir y cobrar ──────────────────────────────────────────────────────── */
function paintReceive() {
  if (!wallet) return;
  const c = chain();
  $('#addrFull').textContent = wallet.address;
  $('#recvNet').textContent = 'Solo ' + c.name + (c.test ? ' (red de prueba)' : '');
  $('#recvDot').style.background = c.color;
  qrInto($('#qrBox'), 'ethereum:' + wallet.address + '@' + prefs.chainId, 6);
}

function payLink() {
  const key = $('#chargeToken').value;
  const amt = $('#chargeAmt').value.trim().replace(',', '.');
  const note = $('#chargeNote').value.trim();
  const p = new URLSearchParams({ to: wallet.address, chain: String(prefs.chainId), token: key });
  if (amt && Number(amt) > 0) p.set('amount', amt);
  if (note) p.set('note', note);
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
    note: (q.get('note') || '').slice(0, 60)
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
  note.querySelector('b').textContent = 'Te están cobrando';
  note.querySelector('span').textContent =
    (prefill.note ? prefill.note + ' · ' : '') + 'Pago en ' + c.short + '. Revisa la cantidad y confirma.';
  note.hidden = false;
  show('send');
  history.replaceState(null, '', location.pathname);
}

/* ── Red ───────────────────────────────────────────────────────────────────── */
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
      `<span class="nl-mid"><b></b><small></small></span>` +
      (c.test ? '<span class="test-tag">PRUEBA</span>' : '');
    b.querySelector('b').textContent = c.name;
    b.querySelector('small').textContent = c.blurb;
    b.addEventListener('click', () => {
      prefs.chainId = id; savePrefs();
      paintNet(); fillTokenSelects(); closeSheet('#netSheet'); refresh();
      toast('Ahora estás en ' + c.name);
    });
    li.appendChild(b);
    list.appendChild(li);
  });
}

/* ── Arranque ──────────────────────────────────────────────────────────────── */
function enterWallet() {
  paintNet();
  fillTokenSelects();
  $('#addrShort').textContent = short(wallet.address);
  show('home');
  refresh();
  paintActivity($('#recentList'), 4);
  reconcile();
  touch();
  if (prefill) applyPrefill();
}

function boot() {
  $('#versionLine').textContent = 'Calma · ethers ' + (E.version || '6') + ' · todo se ejecuta en tu navegador';
  prefill = readPayHash();
  paintNet();
  paintNetList();
  fillTokenSelects();
  if (read(K.store, null)) show('unlock');
  else show('welcome');
}

/* ── Enlaces de la interfaz ────────────────────────────────────────────────── */
$$('[data-go]').forEach(b => b.addEventListener('click', () => show(b.dataset.go)));
/* Solo este botón genera una frase nueva. Volver atrás desde la verificación
   muestra la misma frase: regenerarla dejaría inservible lo que ya apuntaron. */
$('#startCreate').addEventListener('click', startCreate);
$$('[data-close-sheet]').forEach(b => b.addEventListener('click', () => closeAllSheets()));

$('#brandHome').addEventListener('click', () => wallet && show('home'));
$('#netPill').addEventListener('click', () => { paintNetList(); openSheet('#netSheet'); });
$('#lockBtn').addEventListener('click', () => lock(false));
$('#lockNow').addEventListener('click', () => lock(false));

$('#copySeed').addEventListener('click', () => copy(pendingMnemonic, 'Frase copiada — pégala en tu gestor y bórrala del portapapeles'));
$('#blurSeed').addEventListener('click', () => {
  const g = $('#seedGrid'); g.classList.toggle('hidden');
  $('#blurSeed').textContent = g.classList.contains('hidden') ? 'Mostrar' : 'Ocultar';
});
$('#seedSaved').addEventListener('change', e => { $('#toVerify').disabled = !e.target.checked; });
$('#toVerify').addEventListener('click', startVerify);

$('#toPass').addEventListener('click', () => {
  const words = pendingMnemonic.split(' ');
  const inputs = $$('#verifyFields input');
  const bad = verifyIdx.some((idx, i) => inputs[i].value.trim().toLowerCase() !== words[idx]);
  if (bad) return fail('#verifyErr', 'Alguna palabra no coincide. Míralas otra vez con calma.');
  fail('#verifyErr', '');
  pendingImport = null;
  $('#pw1').value = ''; $('#pw2').value = ''; paintPw(); fail('#pwErr', '');
  show('password');
});

$('#pw1').addEventListener('input', paintPw);
$('#passBack').addEventListener('click', () => show(pendingImport ? 'import' : 'verify'));

$('#doCreate').addEventListener('click', async () => {
  const a = $('#pw1').value, b = $('#pw2').value;
  if (a.length < 8) return fail('#pwErr', 'Usa al menos 8 caracteres.');
  if (a !== b) return fail('#pwErr', 'Las dos contraseñas no son iguales.');
  fail('#pwErr', '');
  const btn = $('#doCreate');
  btn.disabled = true; btn.textContent = 'Cifrando…';
  try {
    const signer = pendingImport || E.HDNodeWallet.fromPhrase(pendingMnemonic);
    await persist(signer, a);
    pendingMnemonic = null; pendingImport = null;
    $('#pw1').value = ''; $('#pw2').value = '';
    enterWallet();
    toast('Wallet lista');
  } catch (err) {
    fail('#pwErr', friendly(err));
  } finally { btn.disabled = false; btn.textContent = 'Cifrar y abrir'; }
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
      return fail('#importErr', 'Eso no es una frase válida ni una clave privada. Revisa el orden y la ortografía de las palabras.');
    }
  } catch {
    return fail('#importErr', 'No se pudo leer. Comprueba que esté completo.');
  }
  $('#importInput').value = '';
  pendingMnemonic = null;
  $('#pw1').value = ''; $('#pw2').value = ''; paintPw(); fail('#pwErr', '');
  show('password');
});

$('#doUnlock').addEventListener('click', async () => {
  const pw = $('#unlockPw').value;
  if (!pw) return fail('#unlockErr', 'Escribe tu contraseña.');
  const btn = $('#doUnlock');
  btn.disabled = true; btn.textContent = 'Abriendo…';
  fail('#unlockErr', '');
  try {
    wallet = await E.Wallet.fromEncryptedJson(read(K.store, ''), pw);
    $('#unlockPw').value = '';
    enterWallet();
  } catch {
    fail('#unlockErr', 'Contraseña incorrecta.');
  } finally { btn.disabled = false; btn.textContent = 'Abrir'; }
});
$('#unlockPw').addEventListener('keydown', e => { if (e.key === 'Enter') $('#doUnlock').click(); });

$('#forgot').addEventListener('click', () => {
  toast('Recupérala con tus 12 palabras: Importar wallet');
  setTimeout(() => show('import'), 900);
});

$('#addrChip').addEventListener('click', () => copy(wallet.address, 'Dirección copiada'));
$('#copyAddr').addEventListener('click', () => copy(wallet.address, 'Dirección copiada'));
$('#shareAddr').addEventListener('click', () => share(wallet.address, 'Mi dirección'));

$('#toInput').addEventListener('change', e => resolveTo(e.target.value));
$('#toInput').addEventListener('blur', e => resolveTo(e.target.value));
$('#tokenSelect').addEventListener('change', () => { $('#amtHint').textContent = ''; });
$('#maxBtn').addEventListener('click', useMax);
$('#reviewBtn').addEventListener('click', review);
$('#cfSend').addEventListener('click', doSend);
$('#stDone').addEventListener('click', () => { closeSheet('#statusSheet'); show('home'); });

$('#makeLink').addEventListener('click', () => {
  const url = payLink();
  $('#linkText').textContent = url;
  qrInto($('#chargeQr'), url, 4);
  $('#linkOut').hidden = false;
  $('#linkOut').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});
$('#copyLink').addEventListener('click', () => copy($('#linkText').textContent, 'Enlace de cobro copiado'));
$('#shareLink').addEventListener('click', () => share($('#linkText').textContent, 'Cobro'));

$('#saveRpc').addEventListener('click', () => {
  const v = $('#rpcInput').value.trim();
  /* Solo https, salvo un nodo propio en la misma máquina: mandar una clave
     firmada por http abierto sería regalar el tráfico a la red local. */
  const okUrl = /^https:\/\//i.test(v) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(v);
  if (v && !okUrl) return toast('El RPC debe empezar por https://');
  if (v) prefs.rpc[prefs.chainId] = v; else delete prefs.rpc[prefs.chainId];
  savePrefs(); _provider = null;
  toast(v ? 'RPC guardado' : 'Vuelves al nodo público');
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
  btn.disabled = true; btn.textContent = 'Descifrando…';
  try {
    const w = await E.Wallet.fromEncryptedJson(read(K.store, ''), $('#seedPw').value);
    if (!w.mnemonic) { fail('#seedErr', 'Esta wallet se importó con clave privada: no tiene frase.'); return; }
    paintSeed($('#seedShow'), w.mnemonic.phrase.split(' '));
    $('#seedShow').dataset.phrase = w.mnemonic.phrase;
    $('#seedGateWrap').hidden = true;
    $('#seedShowWrap').hidden = false;
  } catch {
    fail('#seedErr', 'Contraseña incorrecta.');
  } finally { btn.disabled = false; btn.textContent = 'Mostrar'; $('#seedPw').value = ''; }
});
$('#seedCopy2').addEventListener('click', () => copy($('#seedShow').dataset.phrase, 'Frase copiada'));

$('#exportKs').addEventListener('click', () => {
  const blob = new Blob([read(K.store, '')], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'calma-' + short(read(K.addr, '')).replace(/·/g, '') + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('Copia cifrada descargada — sigue necesitando tu contraseña');
});

$('#wipe').addEventListener('click', () => {
  if (!confirm('Se borrará la wallet cifrada de este dispositivo.\n\nSin tu frase de recuperación NO podrás volver a entrar ni recuperar los fondos. ¿Seguro?')) return;
  if (!confirm('Última comprobación: ¿tienes tus 12 palabras guardadas?')) return;
  [K.store, K.addr, K.acts].forEach(k => localStorage.removeItem(k));
  wallet = null;
  location.reload();
});

/* Escape cierra cualquier hoja salvo la del pago en curso: ahí no hay nada que
   cancelar, la transacción ya está en la red. */
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
