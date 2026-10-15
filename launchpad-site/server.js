/* Tricker Launchpad — el servidor.
 *
 * Sirve la página y expone la API con la que funciona de verdad:
 *   GET  /api/launches               la mesa, con fase y recaudación calculadas ahora
 *   GET  /api/launches/:id           un lanzamiento
 *   GET  /api/quotes                 cotización real de la matriz de cada cadena
 *   POST /api/auth/nonce             { address }            → { message }
 *   POST /api/auth/verify            { address, signature } → { token, address }
 *   GET  /api/me                     (Bearer token)          → la cartera y sus aportaciones
 *   POST /api/launches/:id/contribute (Bearer token) { amount } → la aportación y el lanzamiento
 *
 * El estado vive en un único fichero JSON (DATA_DIR/launchpad.json), escrito de
 * forma atómica en cada cambio. En Railway, montar un volumen en DATA_DIR hace
 * que sobreviva a los despliegues. No hay base de datos que arrancar.
 *
 * La identidad es la cartera: el cliente firma un mensaje con su wallet
 * (EIP-191, personal_sign) y el servidor recupera la dirección de la firma.
 * Nadie puede aportar en nombre de una dirección que no controla.
 *
 * Lo que este servidor NO hace: mover dinero. Una aportación es un compromiso
 * registrado a nombre de una cartera; la liquidación on-chain no está
 * conectada y la página lo dice. */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const CATALOG = require('./launches');
const { shopApi } = require('./gifts');
const gifts = require('./gifts');
const community = require('./community');
const sol = require('./evm');
const body0 = () => true;
const { getAddress } = require('ethers'); const isAddress = (a) => sol.isPk(a);
const zlib = require('zlib');

const ROOT = __dirname;
const PORT = process.env.PORT || 8080;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'launchpad.json');
const SEED_DEMO = /^(1|true|yes)$/i.test(process.env.SEED_DEMO || '');
const SESSION_DAYS = 7;
const HOUR = 3600 * 1000;

/* ---------- estado ---------- */

const store = { seededAt: null, launches: {}, contributions: [], sessions: {} };

function load() {
  try {
    Object.assign(store, JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')));
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  const now = Date.now();
  if (!store.seededAt) store.seededAt = now;
  /* todo lanzamiento del catálogo tiene fechas; las que ya existen no se tocan */
  for (const l of CATALOG) {
    if (!store.launches[l.id]) {
      store.launches[l.id] = {
        openAt: store.seededAt + l.openIn * HOUR,
        closeAt: store.seededAt + l.closeIn * HOUR,
        closedAt: null
      };
    }
  }
  if (SEED_DEMO && !store.demoSeeded) seedDemo();
  save();
}

let saving = Promise.resolve();
function save() {
  /* escritura atómica y en serie: nunca un fichero a medias, nunca dos a la vez */
  saving = saving.then(() => new Promise((resolve) => {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = DATA_FILE + '.' + process.pid + '.tmp';
    fs.writeFile(tmp, JSON.stringify(store), (err) => {
      if (err) { console.error('save:', err.message); return resolve(); }
      fs.rename(tmp, DATA_FILE, (err2) => { if (err2) console.error('save:', err2.message); resolve(); });
    });
  }));
  return saving;
}

/* Aportaciones de demostración, sólo si SEED_DEMO está puesto. Van marcadas
   como demo en el fichero y en la API, y salen de direcciones que no existen. */
function seedDemo() {
  const rnd = (a, b) => a + Math.random() * (b - a);
  for (const l of CATALOG) {
    const st = store.launches[l.id];
    if (st.openAt > Date.now()) continue;
    const target = l.closeIn < 0
      ? (l.id === 'pizzahut' ? l.min * 0.62 : l.goal)
      : l.goal * rnd(0.18, 0.72);
    let raised = 0, n = 0;
    while (raised < target && n < 400) {
      const amount = Math.min(l.walletCap, Math.round(rnd(25, l.walletCap * 0.6)), Math.round(target - raised));
      if (amount <= 0) break;
      store.contributions.push({
        id: crypto.randomUUID(), launch: l.id, demo: true,
        address: '0x' + crypto.randomBytes(20).toString('hex'),
        amount, at: Math.round(rnd(st.openAt, Math.min(st.closeAt, Date.now())))
      });
      raised += amount; n++;
    }
    if (raised >= l.goal) st.closedAt = Math.max(...store.contributions.filter(c => c.launch === l.id).map(c => c.at));
  }
  store.demoSeeded = true;
}

/* ---------- lanzamientos ---------- */

function phaseOf(l, st, now = Date.now()) {
  if (now < st.openAt) return 'soon';
  if (st.closedAt || now >= st.closeAt) return 'done';
  return 'live';
}

function view(l, now = Date.now()) {
  const st = store.launches[l.id];
  const rows = store.contributions.filter(c => c.launch === l.id);
  const raised = Math.round(rows.reduce((s, c) => s + c.amount, 0) * 100) / 100;
  const demo = rows.some(c => c.demo);
  const phase = phaseOf(l, st, now);
  const { openIn, closeIn, ...fixed } = l;
  return {
    ...fixed,
    openAt: st.openAt, closeAt: st.closedAt || st.closeAt, closedEarly: Boolean(st.closedAt),
    phase, raised, backers: new Set(rows.map(c => c.address)).size,
    progress: Math.min(1, raised / l.goal),
    outcome: phase === 'done' ? (raised >= l.min ? 'ok' : 'failed') : null,
    fdv: Math.round(l.price * l.supply),
    demo
  };
}

function byId(id) { return CATALOG.find(l => l.id === id); }

/* ---------- cotizaciones reales ---------- */

const quotes = { at: 0, data: null, pending: null };
const QUOTE_TTL = 60 * 1000;

async function fetchQuotes() {
  const symbols = [...new Set(CATALOG.map(l => l.parent).filter(Boolean))];
  const out = {};
  await Promise.all(symbols.map(async (s) => {
    try {
      const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?range=1d&interval=1d`, {
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; TrickerLaunchpad/1.0)' },
        signal: AbortSignal.timeout(8000)
      });
      if (!r.ok) return;
      const m = (await r.json())?.chart?.result?.[0]?.meta;
      if (!m || typeof m.regularMarketPrice !== 'number') return;
      const prev = m.chartPreviousClose ?? m.previousClose;
      out[s] = {
        symbol: s, name: m.longName || m.shortName || s, price: m.regularMarketPrice, currency: m.currency || 'USD',
        change: typeof m.regularMarketChangePercent === 'number' ? m.regularMarketChangePercent
          : (typeof prev === 'number' && prev ? (m.regularMarketPrice / prev - 1) * 100 : null),
        time: m.regularMarketTime ? m.regularMarketTime * 1000 : null
      };
    } catch (e) { /* sin dato: la interfaz dirá que no está disponible */ }
  }));
  return out;
}

/* CoinGecko through the server: one request per minute for everyone instead of
   one per visitor (the free tier answers 429 quickly otherwise). Stale data is
   served when CoinGecko fails. */
const CG = { prices: { at: 0, data: null, pending: null }, charts: new Map() };
/* The page keys prices by the CoinGecko id of each pair's own token; many xStocks have no
   market data there, so the same share's other on-chain issues (Ondo, Dinari, Robinhood,
   Reality) stand in. They are 1:1 mirrors of the same stock, so the price is the same. */
const CG_ALT = {
  'starbucks-xstock': ['starbucks-ondo-tokenized-stock', 'starbucks-rstock', 'starbucks-dinari-tokenized-stock'],
  'chipotle-mexican-grill-xstock': ['chipotle-ondo-tokenized-stock', 'chipotle-mexican-grill-rstock'],
  'yum-brands-xstock': ['yum-brands-dinari-tokenized-stock', 'yum-brands-rstock'],
  'restaurant-brands-international-xstock': ['restaurant-brands-international-rstock'],
  'doordash-xstock': ['doordash-ondo-tokenized-stock', 'doordash-rstock'],
  'domino-s-pizza-xstock': ['domino-s-pizza-inc-rstock'],
  'darden-restaurants-xstock': ['darden-restaurants-inc-rstock'],
  'texas-roadhouse-xstock': ['texas-roadhouse-inc-rstock'],
  'mcdonald-s-xstock': ['mcdonald-s-ondo-tokenized-stock', 'mcdonald-s-rstock'],
  'uber-ondo-tokenized-stock': ['uber-technologies-rstock', 'uber-xstock'],
  'wendy-s-bstocks-tokenized-stock': ['wendy-s-rstock'],
  'haidilao-international-xstock': [], 'meituan-xstock': [], 'mixue-xstock': [],
};
function cgIds() {
  try { const pairs = JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts', 'pairs.json'), 'utf8')); return ['binancecoin', ...new Set(Object.values(pairs).map((p) => p && p.cg).filter(Boolean))]; } catch { return ['binancecoin']; }
}
const cgAllIds = () => [...new Set(cgIds().flatMap((id) => [id, ...(CG_ALT[id] || [])]))];
/* collapse the raw CoinGecko answer onto the primary ids: first id with a price wins */
function cgCollapse(raw) {
  const out = {}; for (const id of cgIds()) { const hit = [id, ...(CG_ALT[id] || [])].map((k) => raw[k]).find((v) => v && v.usd != null); if (hit) out[id] = { usd: hit.usd, usd_24h_change: hit.usd_24h_change ?? null }; }
  return out;
}
async function cgFetch(u) { const r = await fetch(u, { headers: { accept: 'application/json', ...(process.env.COINGECKO_API_KEY ? { 'x-cg-demo-api-key': process.env.COINGECKO_API_KEY } : {}) }, signal: AbortSignal.timeout(9000) }); if (!r.ok) throw new Error('coingecko ' + r.status); return r.json(); }
function cgPrices() {
  const c = CG.prices; if (c.data && Date.now() - c.at < 60 * 1000) return Promise.resolve(c.data);
  if (!c.pending) c.pending = cgFetch(`https://api.coingecko.com/api/v3/simple/price?ids=${cgAllIds().join(',')}&vs_currencies=usd&include_24hr_change=true`).then((d) => { c.data = cgCollapse(d); c.at = Date.now(); return c.data; }).catch(() => c.data).finally(() => { c.pending = null; });
  return c.pending;
}
function cgChart(cg, days) {
  const k = cg + ':' + days; const ttl = days === 1 ? 2 * 60 * 1000 : 15 * 60 * 1000; const c = CG.charts.get(k) || { at: 0, data: null, pending: null }; CG.charts.set(k, c);
  if (c.data && Date.now() - c.at < ttl) return Promise.resolve(c.data);
  if (!c.pending) c.pending = cgFetch(`https://api.coingecko.com/api/v3/coins/${encodeURIComponent(cg)}/market_chart?vs_currency=usd&days=${days}`).then((d) => { c.data = { prices: d.prices || [] }; c.at = Date.now(); return c.data; }).catch(() => c.data).finally(() => { c.pending = null; });
  return c.pending;
}

function getQuotes() {
  if (quotes.data && Date.now() - quotes.at < QUOTE_TTL) return Promise.resolve(quotes.data);
  if (!quotes.pending) {
    quotes.pending = fetchQuotes().then((d) => {
      if (Object.keys(d).length) { quotes.data = d; quotes.at = Date.now(); }
      quotes.pending = null;
      return quotes.data || {};
    });
  }
  return quotes.pending;
}

/* ---------- identidad por wallet ---------- */

const nonces = new Map(); // address → { nonce, at }

function loginMessage(address, nonce) {
  return `kuai\n\nSign in with this wallet. This costs nothing and authorizes no transaction.\n\nWallet: ${address}\nNonce: ${nonce}`;
}

function sessionOf(req) {
  const m = /^Bearer\s+([A-Za-z0-9_-]{20,})$/.exec(req.headers.authorization || '');
  if (!m) return null;
  const s = store.sessions[m[1]];
  if (!s) return null;
  if (s.expires < Date.now()) { delete store.sessions[m[1]]; save(); return null; }
  return s;
}

function pruneSessions() {
  const now = Date.now();
  let dirty = false;
  for (const [t, s] of Object.entries(store.sessions)) if (s.expires < now) { delete store.sessions[t]; dirty = true; }
  for (const [a, n] of nonces) if (now - n.at > 10 * 60 * 1000) nonces.delete(a);
  if (dirty) save();
}
setInterval(pruneSessions, 15 * 60 * 1000).unref();

/* ---------- utilidades HTTP ---------- */

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml; charset=utf-8'
};
const PRIVATE = new Set(['server.js', 'launches.js', 'gifts.js', 'factory.js', 'community.js', 'evm.js', 'test.js', 'test-gifts.js', 'package.json', 'package-lock.json', '.gitignore']);

function gzipOk(req, type, body) { return req && /\bgzip\b/.test(req.headers['accept-encoding'] || '') && /^(text\/|application\/(json|javascript)|image\/svg)/.test(type) && body.length > 1024; }
function send(res, code, body, headers = {}) {
  const json = typeof body !== 'string' && !Buffer.isBuffer(body);
  const type = json ? 'application/json; charset=utf-8' : (headers['content-type'] || 'text/plain; charset=utf-8');
  let out = json ? JSON.stringify(body) : body;
  const h = { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'same-origin', ...headers };
  if (gzipOk(res.req, type, out)) { out = zlib.gzipSync(out); h['content-encoding'] = 'gzip'; h.vary = 'accept-encoding'; }
  res.writeHead(code, h);
  res.end(out);
}
const fail = (res, code, error) => send(res, code, { error });

function readJson(req, limit = 8 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks)) : {}); } catch { reject(new Error('bad json')); } });
    req.on('error', reject);
  });
}

/* un cubo por IP para las escrituras: 30 por minuto y basta (RATE_LIMIT lo cambia) */
const RATE_LIMIT = Number(process.env.RATE_LIMIT) || 30;
const buckets = new Map();
function limited(req) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '?';
  const now = Date.now();
  const b = buckets.get(ip) || { n: 0, at: now };
  if (now - b.at > 60 * 1000) { b.n = 0; b.at = now; }
  b.n++; buckets.set(ip, b);
  return b.n > RATE_LIMIT;
}

function serveStatic(req, res, rel) {
  // La raíz es el dapp de BNB Chain (dapp/index.html y dapp/logos); la mesa
  // clásica sigue en /index.html, /app.js y /styles.css.
  if (rel === '/' || rel === '/dapp' || rel === '/dapp/' || rel === '/dapp/index.html') return servePage(req, res, '/');
  if (PAGE_ROUTE.test(rel)) return servePage(req, res, rel.replace(/\/$/, ''));
  if (rel === '/sitemap.xml') return send(res, 200, sitemap(req), { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' });
  if (rel === '/robots.txt') return send(res, 200, `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nSitemap: ${(process.env.SITE_URL || `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers['x-forwarded-host'] || req.headers.host}`).replace(/\/$/, '')}/sitemap.xml\n`, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' });
  if (rel === '/admin' || rel === '/admin/') rel = '/dapp/admin.html';
  else if (rel.startsWith('/logos/') || rel.startsWith('/photos/') || rel.startsWith('/icons/')) rel = '/dapp' + rel;
  else if (rel === '/manifest.webmanifest') rel = '/dapp/manifest.webmanifest';
  else if (rel === '/sw.js') { return fs.readFile(path.join(ROOT, 'dapp', 'sw.js'), (err, body) => { if (err) return fail(res, 404, 'nothing here'); res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-cache', 'service-worker-allowed': '/' }); res.end(body); }); }
  else if (/^\/uploads\/[a-f0-9]{16}\.(jpg|png|webp)$/.test(rel)) { const up = path.join(DATA_DIR, rel); return fs.readFile(up, (err, body) => { if (err) return fail(res, 404, 'nothing here'); res.writeHead(200, { 'content-type': TYPES[path.extname(up)] || 'application/octet-stream', 'cache-control': 'public, max-age=86400' }); res.end(body); }); }
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(ROOT, path.normalize(rel));
  if (!file.startsWith(ROOT + path.sep) || PRIVATE.has(path.basename(file)) || file.includes(path.sep + 'data' + path.sep) || file.includes('node_modules') || file.includes(path.sep + 'services' + path.sep)) {
    return fail(res, 404, 'nothing here');
  }
  fs.readFile(file, (err, body) => {
    if (err) return fail(res, 404, 'nothing here');
    const ext = path.extname(file).toLowerCase();
    const type = TYPES[ext] || 'application/octet-stream';
    let out = body;
    const h = { 'content-type': type, 'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=86400', 'x-content-type-options': 'nosniff' };
    if (gzipOk(req, type, out)) { out = zlib.gzipSync(out); h['content-encoding'] = 'gzip'; h.vary = 'accept-encoding'; }
    res.writeHead(200, h);
    res.end(out);
  });
}

/* ---------- the dapp page: one document, many URLs ----------
   /, /gifts, /coins, /launch, /docs, /pairs, /account, /r/<id>, /gift/<id> and
   /coin/<chain>/<addr> all serve dapp/index.html, wrapped in a proper document
   (doctype, charset, viewport) with the title, description and Open Graph tags
   of that URL, and window.SOL_CFG so the page routes by path. */
const PAGE = { at: 0, html: '', rest: {} };
function pageSource() {
  const f = path.join(ROOT, 'dapp', 'index.html');
  const st = fs.statSync(f);
  if (st.mtimeMs !== PAGE.at) {
    PAGE.at = st.mtimeMs; PAGE.html = fs.readFileSync(f, 'utf8'); PAGE.rest = {};
    const m = /const RESTAURANTS = \[([\s\S]*?)\]\.map\(/.exec(PAGE.html) || /const RESTAURANTS = \[([\s\S]*?)\n  \];/.exec(PAGE.html);
    if (m) for (const row of m[1].matchAll(/\['([a-z0-9_-]+)','[^']*',("(?:[^"\\]|\\.)*"|'[^']*'),'[^']*',("(?:[^"\\]|\\.)*"|'[^']*'),'([a-z]+)'/g)) PAGE.rest[row[1]] = { name: JSON.parse(row[2].startsWith("'") ? '"' + row[2].slice(1, -1) + '"' : row[2]), parent: JSON.parse(row[3].startsWith("'") ? '"' + row[3].slice(1, -1) + '"' : row[3]), cat: row[4] };
    const z = /const NAME_ZH = \{([^}]*)\}/.exec(PAGE.html);
    if (z) for (const row of z[1].matchAll(/([a-z0-9_-]+): '([^']*)'/g)) if (PAGE.rest[row[1]]) PAGE.rest[row[1]].zh = row[2];
  }
  return PAGE;
}
const VIEW_META = {
  '': ['kuai', 'Restaurant gift cards paid with any crypto or card, and a BNB Chain launchpad where every coin is paired with a real tokenized restaurant stock.'],
  explore: ['Explore · kuai', 'Restaurants with a tokenized stock, the coins paired with them and gift cards for crypto, in one place.'],
  terms: ['Terms · kuai', 'The terms for using kuai: your wallet, the contracts, gift cards, content and brands.'],
  privacy: ['Privacy · kuai', 'What kuai stores, what it never stores, the services it uses and how to delete your data.'],
  risk: ['Risk notice · kuai', 'You can lose everything you put in. Read this before buying a coin on kuai.'],
  refund: ['Refund policy · kuai', 'Gift cards are final once issued; what happens when a card cannot be issued after you paid.'],
  cookies: ['Cookies · kuai', 'kuai sets no tracking cookies. What your browser stores and why.'],
  dashboard: ['Dashboard · kuai', 'Eighteen restaurants with a tokenized stock on BNB Chain, their live coins and the staking pool, on one screen.'],
  analytics: ['Analytics · kuai', 'Raised, graduated, buyers and fees, read live from the kuai contracts on BNB Chain.'],
  terminal: ['Terminal · kuai', 'Every kuai coin and restaurant in one table: raise, buyers, pool price and the fee split.'],
  stake: ['Stake $KUAI · kuai', 'Stake the house coin and earn 70% of every graduation fee in BNB; 30% buys back $KUAI and burns it.'],
  profile: ['Your profile · kuai', 'Sign in with your wallet to set a name, avatar and thesis, post updates and show your P/L.'],
  gifts: ['Gift cards for crypto · kuai', 'Buy restaurant eGift cards with BNB, USDT, Bitcoin, 300+ cryptocurrencies or a card. Delivered by email, inside kuai.'],
  coins: ['All coins · kuai', 'Every coin launched on kuai, each paired with a tokenized restaurant stock on BNB Chain.'],
  launch: ['Create a coin · kuai', 'Launch a coin paired with a real restaurant stock token. The raise is paid in that token and opens a locked liquidity pool when it graduates.'],
  docs: ['How the launchpad works · kuai', 'Paired raises, graduation, refunds and the fixed parameters of every kuai coin.'],
  pairs: ['Verified pairs on BNB Chain · kuai', 'The tokenized restaurant stocks (xStocks, bStocks, Ondo) verified on-chain that kuai coins pair with.'],
  account: ['Your account · kuai', 'Your gift card orders and coins on kuai.'],
  leaderboard: ['Leaderboard · kuai', 'Top coins by amount raised and the most active buyers on kuai this week.'],
  calendar: ['Calendar · kuai', 'Upcoming closes and graduations of kuai coins.'],
  guides: ['Guides · kuai', 'How to buy crypto, how to pay a gift card with USDT, what a tokenized stock is, and how a paired raise works.'],
  'guides/buy-crypto': ['How to buy crypto and set up a wallet · kuai', 'Three steps to get BNB or USDT with MetaMask or Binance, then use it on kuai.'],
  'guides/gift-card-usdt': ['Buy a Starbucks gift card with USDT · kuai', 'Step by step: choose the card, pay with USDT or any crypto, get the code by email in minutes.'],
  'guides/tokenized-stocks': ['What is a tokenized stock? · kuai', 'MCDx, SBUXx and the other restaurant stock tokens on BNB Chain: who issues them, how they track the stock, where they trade.'],
  'guides/paired-raise': ['How a paired raise works · kuai', 'Target, minimum, cap per wallet, graduation to a locked pool and refunds, explained with an example.'],
  status: ['Status · kuai', 'Live status of gift card supply, payments, email and BNB Chain, with the latest deliveries.'],
  help: ['Help · kuai', 'Answers to common questions and a way to reach us about an order or a coin.']
};
const escAttr = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function pageFor(req, rel) {
  const src = pageSource();
  const base = (process.env.SITE_URL || `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers['x-forwarded-host'] || req.headers.host}`).replace(/\/$/, '');
  let title = VIEW_META[''][0], desc = VIEW_META[''][1], image = '', m;
  const key = rel.replace(/^\/+|\/+$/g, '');
  if (VIEW_META[key]) { [title, desc] = VIEW_META[key]; }
  else if ((m = /^(r|gift)\/([a-z0-9_-]+)$/.exec(key)) && src.rest[m[2]]) {
    const r = src.rest[m[2]];
    title = (m[1] === 'gift' ? `${r.name} gift card for crypto` : `${r.name} on kuai`) + ' · kuai';
    desc = m[1] === 'gift' ? `Buy a ${r.name} eGift card with BNB, USDT, Bitcoin or any crypto. Emailed within minutes.` : `${r.name} (${r.parent}): live stock price, the tokenized stock on BNB Chain and the coins paired with it.`;
    if (fs.existsSync(path.join(ROOT, 'dapp', 'photos', m[2] + '.webp'))) image = `${base}/photos/${m[2]}.webp`;
  }
  else if (/^coin\/\d+\/0x[0-9a-fA-F]{40}$/.test(key)) { title = 'Coin · kuai'; desc = 'A coin launched on kuai, paired with a tokenized restaurant stock on BNB Chain.'; }
  else if ((m = /^u\/(0x[0-9a-fA-F]{40})$/.exec(key))) { title = `${m[1].slice(0, 6)}…${m[1].slice(-4)} · kuai`; desc = 'Coins created and bought by this wallet on kuai.'; }
  if (!image) image = `${base}/photos/all.webp`;
  let html = src.html
    .replace(/<title>[^<]*<\/title>/, `<title>${escAttr(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${escAttr(desc)}">`)
    .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${escAttr(title)}">`)
    .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${escAttr(desc)}">`)
    .replace('<meta property="og:type" content="website">', `<meta property="og:type" content="website"><meta property="og:url" content="${escAttr(base + rel)}"><meta property="og:image" content="${escAttr(image)}"><meta name="twitter:image" content="${escAttr(image)}"><link rel="canonical" href="${escAttr(base + rel)}">`);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" href="/icons/icon-192.png"><link rel="icon" href="/icons/icon-192.png" type="image/png"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="kuai"><script>window.SOL_CFG={paths:true}</script>\n${html}\n</html>`;
}
const PAGE_ROUTE = /^\/(terms|privacy|risk|refund|cookies|explore|dashboard|analytics|terminal|stake|profile|gifts|coins|launch|docs|pairs|account|leaderboard|calendar|guides|guides\/[a-z0-9-]+|status|help|r\/[a-z0-9_-]+|gift\/[a-z0-9_-]+|coin\/\d+\/0x[0-9a-fA-F]{40}|u\/0x[0-9a-fA-F]{40})\/?$/;
function servePage(req, res, rel) {
  let html; try { html = pageFor(req, rel); } catch (e) { console.error('page', e.message); return fail(res, 500, 'page unavailable'); }
  send(res, 200, html, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' });
}
function sitemap(req) {
  const base = (process.env.SITE_URL || `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers['x-forwarded-host'] || req.headers.host}`).replace(/\/$/, '');
  const src = pageSource();
  const urls = ['/', '/explore', '/dashboard', '/analytics', '/terminal', '/stake', '/terms', '/privacy', '/risk', '/refund', '/cookies', '/gifts', '/coins', '/launch', '/docs', '/pairs', '/leaderboard', '/calendar', '/guides', '/guides/buy-crypto', '/guides/gift-card-usdt', '/guides/tokenized-stocks', '/guides/paired-raise', '/status', '/help', ...Object.keys(src.rest).flatMap((id) => [`/r/${id}`, `/gift/${id}`])];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${escAttr(base + u)}</loc></url>`).join('\n')}\n</urlset>\n`;
}

/* ---------- la API ---------- */

async function api(req, res, url) {
  const p = url.pathname;
  const now = Date.now();

  if (req.method === 'GET' && p === '/api/launches') {
    return send(res, 200, { now, launches: CATALOG.map(l => view(l, now)) });
  }

  let m;
  if (req.method === 'GET' && (m = /^\/api\/launches\/([a-z0-9-]+)$/.exec(p))) {
    const l = byId(m[1]);
    return l ? send(res, 200, view(l, now)) : fail(res, 404, 'no such launch');
  }

  if (req.method === 'GET' && p === '/api/config') return send(res, 200, sol.config(store), { 'cache-control': 'public, max-age=30' });
  if (p === '/api/rpc' || p === '/api/coins' || p.startsWith('/api/coins/') || p === '/api/buys' || p === '/api/feed' || p === '/api/stake' || p.startsWith('/api/stake/')) return sol.chainApi(req, res, url, { send, fail, readJson, limited, store, save, sessionOf });
  if (req.method === 'GET' && p === '/api/prices') { const j = await cgPrices(); return j ? send(res, 200, j, { 'cache-control': 'public, max-age=60' }) : fail(res, 503, 'prices unavailable'); }
  if (req.method === 'GET' && p === '/api/chart') {
    const cg = String(url.searchParams.get('cg') || ''); const days = Number(url.searchParams.get('days'));
    if (!/^[a-z0-9-]{1,60}$/.test(cg) || ![1, 7, 30].includes(days)) return fail(res, 400, 'cg and days (1, 7 or 30) required');
    const j = await cgChart(cg, days); return j ? send(res, 200, j, { 'cache-control': 'public, max-age=120' }) : fail(res, 503, 'chart unavailable');
  }
  if (p === '/api/admin/staking') {
    if (!gifts.isAdmin(req)) return fail(res, 401, 'admin key required');
    if (req.method === 'GET') { const out = {}; for (const c of Object.keys(sol.CLUSTERS)) { try { out[c] = await sol.stakeInfo(c, store); } catch (e) { out[c] = { cluster: c, staking: sol.stakingOf(c, store), error: e.message }; } out[c].record = (store.staking || {})[c] || null; } return send(res, 200, { chains: out }); }
    let body; try { body = await readJson(req); } catch (e) { return fail(res, 400, e.message); } const c = sol.cluster(body.cluster);
    try {
      if (body.deploy) { const rec = await sol.deployStaking(c, store, save); (store.adminLog ||= []).push({ at: Date.now(), action: 'deploy-staking', cluster: c, address: rec.address }); await save(); return send(res, 200, { ok: true, ...rec }); }
      if (body.address) { if (!sol.isPk(body.address)) return fail(res, 400, 'address required'); (store.staking ||= {})[c] = { ...(store.staking[c] || {}), address: getAddress(body.address), at: Date.now() }; await save(); return send(res, 200, { ok: true }); }
      if (body.action) { const r = await sol.keeper(c, store, body.action, body.token); await save(); return send(res, 200, r); }
      return fail(res, 400, 'deploy, address or action required');
    } catch (e) { return fail(res, 400, e.shortMessage || e.message); }
  }
  if (p === '/api/admin/program') {
    if (!gifts.isAdmin(req)) return fail(res, process.env.ADMIN_KEY ? 401 : 503, process.env.ADMIN_KEY ? 'admin key required' : 'ADMIN_KEY is not set');
    if (req.method === 'GET') { const cfg = sol.config(store); const out = {}; for (const c of Object.keys(sol.CLUSTERS)) { try { out[c] = await sol.coins(c, store); } catch (e) { out[c] = { error: e.message }; } } const dep = await sol.deployStatus(store); return send(res, 200, { cluster: cfg.cluster, clusters: cfg.clusters, merchant: cfg.merchant, deployer: dep.deployer, deploy: dep.chains, index: Object.fromEntries(Object.entries(out).map(([c, d]) => [c, { programId: d.programId || null, coins: d.coins ? d.coins.length : null, feeTo: d.feeTo || null, error: d.error || null }])) }); }
    if (req.method === 'POST' && body0(req)) { let body; try { body = await readJson(req); } catch (e) { return fail(res, 400, e.message); } if (body.deploy) { try { const rec = await sol.deployFactory(sol.cluster(body.cluster), store, save); (store.adminLog ||= []).push({ at: Date.now(), action: 'deploy-factory', cluster: sol.cluster(body.cluster), address: rec.address }); await save(); return send(res, 200, { ok: true, ...rec }); } catch (e) { return fail(res, 400, e.message); } } const c = sol.cluster(body.cluster); if (!sol.isPk(body.programId)) return fail(res, 400, 'programId required'); (store.programs ||= {})[c] = body.programId; await save(); (store.adminLog ||= []).push({ at: Date.now(), action: 'program', cluster: c, programId: body.programId }); return send(res, 200, { ok: true, cluster: c, programId: body.programId }); }
  }

  if (req.method === 'GET' && p === '/api/quotes') {
    const data = await getQuotes();
    return send(res, 200, { at: quotes.at || null, available: Object.keys(data).length > 0, quotes: data });
  }

  if (p === '/api/profiles' || p.startsWith('/api/profile/') || p === '/api/me/profile' || p.startsWith('/api/me/updates') || p.startsWith('/api/admin/profiles/')) return community.profileApi(req, res, url, { send, fail, readJson, limited, store, save, sessionOf, isAdmin: gifts.isAdmin });
  if (p.startsWith('/api/comments/') || p.startsWith('/api/alerts') || p === '/api/newsletter' || p.startsWith('/api/newsletter/') || p === '/api/support' || p === '/api/status' || p === '/api/news' || p === '/api/pool' || /^\/api\/admin\/(newsletter|support|alerts|comments|social)/.test(p)) return community.communityApi(req, res, url, { send, fail, readJson, limited, store, save, sessionOf, isAdmin: gifts.isAdmin, shop: { supply: () => require('./services/bitrefill').configured(), methods: () => ({ wallet: Boolean(process.env.MERCHANT_ADDRESS), crypto: require('./services/nowpayments').configured(), card: require('./services/stripe').configured() }) } });
  if (p.startsWith('/api/gifts/') || p.startsWith('/api/admin/') || p.startsWith('/api/webhooks/') || p === '/api/catalog' || p === '/api/me/orders' || p === '/api/me/referrals') return shopApi(req, res, url, { send, fail, readJson, limited, store, save, sessionOf, dataDir: DATA_DIR });

  if (req.method === 'GET' && p === '/api/me') {
    const s = sessionOf(req);
    if (!s) return fail(res, 401, 'sign in first');
    const mine = store.contributions.filter(c => c.address === s.address).sort((a, b) => b.at - a.at);
    return send(res, 200, { address: s.address, contributions: mine });
  }

  if (req.method !== 'POST') return fail(res, 404, 'no such route');
  if (limited(req)) return fail(res, 429, 'too many requests, slow down');

  let body;
  try { body = await readJson(req); } catch (e) { return fail(res, 400, e.message); }

  if (p === '/api/auth/nonce') {
    if (!isAddress(body.address)) return fail(res, 400, 'that is not an address');
    const address = getAddress(body.address);
    const nonce = crypto.randomBytes(16).toString('hex');
    nonces.set(address, { nonce, at: now });
    return send(res, 200, { address, message: loginMessage(address, nonce) });
  }

  if (p === '/api/auth/verify') {
    if (!isAddress(body.address) || typeof body.signature !== 'string') return fail(res, 400, 'address and signature, please');
    const address = getAddress(body.address);
    const n = nonces.get(address);
    if (!n || now - n.at > 10 * 60 * 1000) return fail(res, 400, 'ask for a fresh nonce');
    if (!sol.verifySignature(address, loginMessage(address, n.nonce), body.signature)) return fail(res, 401, 'the signature is not from that wallet');
    nonces.delete(address);
    const token = crypto.randomBytes(32).toString('base64url');
    store.sessions[token] = { address, expires: now + SESSION_DAYS * 24 * HOUR };
    await save();
    return send(res, 200, { token, address, expires: store.sessions[token].expires });
  }

  if ((m = /^\/api\/launches\/([a-z0-9-]+)\/contribute$/.exec(p))) {
    const s = sessionOf(req);
    if (!s) return fail(res, 401, 'sign in first');
    const l = byId(m[1]);
    if (!l) return fail(res, 404, 'no such launch');
    const st = store.launches[l.id];
    if (phaseOf(l, st, now) !== 'live') return fail(res, 409, 'this launch is not open');

    const amount = Math.round(Number(body.amount) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0) return fail(res, 400, 'amount must be a positive number');

    const mine = store.contributions.filter(c => c.launch === l.id && c.address === s.address).reduce((a, c) => a + c.amount, 0);
    if (mine + amount > l.walletCap + 1e-9) {
      return fail(res, 409, `wallet cap is ${l.walletCap} USDC on this launch; you can still add ${Math.max(0, Math.round((l.walletCap - mine) * 100) / 100)}`);
    }
    const raised = store.contributions.filter(c => c.launch === l.id).reduce((a, c) => a + c.amount, 0);
    const room = Math.round((l.goal - raised) * 100) / 100;
    if (amount > room + 1e-9) return fail(res, 409, `only ${room} USDC left before the goal`);

    const c = { id: crypto.randomUUID(), launch: l.id, address: s.address, amount, at: now };
    store.contributions.push(c);
    if (raised + amount >= l.goal - 1e-9) st.closedAt = now;   // tope duro: la ventana cierra
    await save();
    return send(res, 201, { contribution: c, launch: view(l, now) });
  }

  return fail(res, 404, 'no such route');
}

/* ---------- arranque ---------- */

function handler(req, res) {
  let url;
  try { url = new URL(req.url, 'http://x'); } catch { return fail(res, 400, 'bad url'); }
  if (url.pathname.startsWith('/api/')) {
    api(req, res, url).catch((e) => { console.error(e); fail(res, 500, 'something broke on our side'); });
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return fail(res, 405, 'method not allowed');
  let rel;
  try { rel = decodeURIComponent(url.pathname); } catch { return fail(res, 400, 'bad path'); }
  serveStatic(req, res, rel);
}

function start(port = PORT) {
  load();
  gifts.startJobs(store, save); community.startJobs(store, save);
  const server = http.createServer(handler);
  return new Promise((resolve) => server.listen(port, () => {
    console.log(`kuai on :${server.address().port} · data in ${DATA_FILE}${SEED_DEMO ? ' · demo seeded' : ''}`);
    resolve(server);
  }));
}

if (require.main === module) start();

module.exports = { start, store, view, phaseOf, loginMessage, CATALOG, DATA_FILE, pageFor };
