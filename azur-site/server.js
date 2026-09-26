/* Serves the AZUR site, plus four small endpoints:
 *
 *   POST /api/waitlist   store an email on the waitlist
 *   GET  /api/prices     live prices for the hero pills (cached for a minute)
 *   POST /api/hit        count a page view (no cookies, no raw IPs kept)
 *   GET  /admin          views, referrers and the waitlist, behind ADMIN_KEY
 *
 * No dependencies. Data lives in DATA_DIR as plain files: waitlist.jsonl (one
 * sign-up per line) and stats.json. Mount a volume there so it survives
 * redeploys. Railway sets PORT; 8080 is what its generated domain points at. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const PORT = process.env.PORT || 8080;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const ADMIN_KEY = process.env.ADMIN_KEY || '';
const WAITLIST = path.join(DATA_DIR, 'waitlist.jsonl');
const STATS = path.join(DATA_DIR, 'stats.json');

fs.mkdirSync(DATA_DIR, { recursive: true });

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

/* ------------------------------------------------------------ helpers */

function json(res, code, body) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readBody(req, limit = 2048) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  return (fwd ? String(fwd).split(',')[0] : req.socket.remoteAddress || '').trim();
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ------------------------------------------------------------ waitlist */

const emails = new Set();
try {
  fs.readFileSync(WAITLIST, 'utf8').split('\n').filter(Boolean).forEach((line) => {
    try { emails.add(JSON.parse(line).email); } catch (e) { /* skip a broken line */ }
  });
} catch (e) { /* no file yet */ }

/* at most 10 sign-up attempts per IP every 10 minutes (offices and phone networks share IPs) */
const attempts = new Map();
function limited(ip) {
  const now = Date.now();
  const list = (attempts.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  list.push(now);
  attempts.set(ip, list);
  return list.length > 10;
}

const EMAIL = /^[^\s@"<>]{1,64}@[^\s@"<>]{1,190}\.[a-z]{2,24}$/i;

async function joinWaitlist(req, res) {
  let data;
  try { data = JSON.parse(await readBody(req)); } catch (e) { return json(res, 400, { error: 'Send a JSON body.' }); }
  /* the hidden "website" field is only ever filled in by bots */
  if (data.website) return json(res, 200, { ok: true, position: emails.size });
  const email = String(data.email || '').trim().toLowerCase();
  if (!EMAIL.test(email)) return json(res, 400, { error: 'That email address does not look right.' });
  if (limited(clientIp(req))) return json(res, 429, { error: 'Too many tries. Wait a few minutes and try again.' });
  if (emails.has(email)) return json(res, 200, { ok: true, already: true, position: [...emails].indexOf(email) + 1 });
  emails.add(email);
  const row = { email, source: String(data.source || '').slice(0, 40), at: new Date().toISOString() };
  fs.appendFile(WAITLIST, JSON.stringify(row) + '\n', (err) => { if (err) console.error('waitlist write failed', err); });
  bump('signups');
  return json(res, 200, { ok: true, position: emails.size });
}

/* ------------------------------------------------------------ prices */

/* Stocks come from Stooq (change is measured against today's open), crypto from
   CoinGecko (24h change). Both are free and need no key. */
const STOCKS = { GOOGL: 'googl.us', HOOD: 'hood.us', AAPL: 'aapl.us', TSLA: 'tsla.us', NVDA: 'nvda.us' };
const COINS = { BTC: 'bitcoin', ETH: 'ethereum' };
let priceCache = { at: 0, data: {} };

async function fetchText(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(5000), headers: { 'user-agent': 'azur-site/1.0' } });
  if (!r.ok) throw new Error(url + ' ' + r.status);
  return r.text();
}

async function loadPrices() {
  const out = {};
  await Promise.all(Object.entries(STOCKS).map(async ([t, sym]) => {
    try {
      const csv = await fetchText('https://stooq.com/q/l/?s=' + sym + '&f=sd2t2ohlc&h&e=csv');
      const [, row] = csv.trim().split('\n');
      const cols = row.split(',');
      const open = parseFloat(cols[3]), close = parseFloat(cols[6]);
      if (open > 0 && close > 0) out[t] = { price: close, change: (close - open) / open * 100 };
    } catch (e) { console.error('price', t, e.message); }
  }));
  try {
    const body = JSON.parse(await fetchText('https://api.coingecko.com/api/v3/simple/price?ids=' +
      Object.values(COINS).join(',') + '&vs_currencies=usd&include_24hr_change=true'));
    for (const [t, id] of Object.entries(COINS)) {
      const c = body[id];
      if (c && c.usd) out[t] = { price: c.usd, change: c.usd_24h_change || 0 };
    }
  } catch (e) { console.error('price crypto', e.message); }
  return out;
}

async function prices(req, res) {
  if (Date.now() - priceCache.at > 60 * 1000) {
    const fresh = await loadPrices();
    /* keep the last good value for anything that failed this time */
    priceCache = { at: Date.now(), data: Object.assign({}, priceCache.data, fresh) };
  }
  json(res, 200, { at: priceCache.at, prices: priceCache.data });
}

/* ------------------------------------------------------------ page views */

/* Unique visitors are counted with a hash of IP + browser + a salt that changes
   every day, so no IP is stored and nobody can be followed across days. */
let stats = { days: {}, signups: {} };
try { stats = Object.assign(stats, JSON.parse(fs.readFileSync(STATS, 'utf8'))); } catch (e) { /* first run */ }
let dirty = false;
const today = () => new Date().toISOString().slice(0, 10);
let salt = { day: '', value: '' };
const seenToday = new Set();

function day(d) {
  if (!stats.days[d]) stats.days[d] = { views: 0, visitors: 0, pages: {}, refs: {} };
  return stats.days[d];
}
function bump(kind) {
  const d = today();
  stats[kind][d] = (stats[kind][d] || 0) + 1;
  dirty = true;
}

async function hit(req, res) {
  let data = {};
  try { data = JSON.parse(await readBody(req, 1024) || '{}'); } catch (e) { /* count it anyway */ }
  const d = today();
  if (salt.day !== d) { salt = { day: d, value: crypto.randomBytes(16).toString('hex') }; seenToday.clear(); }
  const id = crypto.createHash('sha256').update(salt.value + clientIp(req) + (req.headers['user-agent'] || '')).digest('hex');
  const rec = day(d);
  rec.views++;
  if (!seenToday.has(id)) { seenToday.add(id); rec.visitors++; }
  const page = String(data.path || '/').slice(0, 60).replace(/\.html$/, '') || '/';
  rec.pages[page] = (rec.pages[page] || 0) + 1;
  let ref = '';
  try { ref = data.ref ? new URL(data.ref).hostname : ''; } catch (e) { /* not a URL */ }
  if (ref && ref !== req.headers.host) rec.refs[ref] = (rec.refs[ref] || 0) + 1;
  dirty = true;
  res.writeHead(204).end();
}

setInterval(() => {
  if (!dirty) return;
  dirty = false;
  fs.writeFile(STATS, JSON.stringify(stats), (err) => { if (err) console.error('stats write failed', err); });
}, 15 * 1000).unref();

/* ------------------------------------------------------------ admin */

function authorised(url) {
  const key = url.searchParams.get('key') || '';
  if (!ADMIN_KEY || key.length !== ADMIN_KEY.length) return false;
  return crypto.timingSafeEqual(Buffer.from(key), Buffer.from(ADMIN_KEY));
}

function readWaitlist() {
  try {
    return fs.readFileSync(WAITLIST, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
  } catch (e) { return []; }
}

function adminCsv(res) {
  const rows = readWaitlist();
  const csv = 'email,source,joined\n' + rows.map((r) => [r.email, r.source, r.at].map((v) => '"' + String(v || '').replace(/"/g, '""') + '"').join(',')).join('\n');
  res.writeHead(200, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="azur-waitlist.csv"', 'cache-control': 'no-store' });
  res.end(csv);
}

function adminPage(res, key) {
  const days = [];
  for (let i = 13; i >= 0; i--) days.push(new Date(Date.now() - i * 864e5).toISOString().slice(0, 10));
  const rows = days.map((d) => ({ d, v: (stats.days[d] || {}).views || 0, u: (stats.days[d] || {}).visitors || 0, s: stats.signups[d] || 0 }));
  const max = Math.max(1, ...rows.map((r) => r.v));
  const sum = (k) => rows.reduce((n, r) => n + r[k], 0);
  const merge = (field) => {
    const acc = {};
    days.forEach((d) => Object.entries((stats.days[d] || {})[field] || {}).forEach(([k, n]) => { acc[k] = (acc[k] || 0) + n; }));
    return Object.entries(acc).sort((a, b) => b[1] - a[1]).slice(0, 8);
  };
  const list = readWaitlist().slice(-50).reverse();
  const table = (pairs, empty) => pairs.length
    ? '<table>' + pairs.map(([k, n]) => '<tr><td>' + esc(k) + '</td><td class="n">' + n + '</td></tr>').join('') + '</table>'
    : '<p class="empty">' + empty + '</p>';
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>AZUR Admin</title><style>
:root{color-scheme:dark;--bg:#07090d;--card:#0e131d;--line:#1d2533;--ink:#e8ecf3;--muted:#8792a6;--blue:#5aa2ff}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;padding:32px 16px}
.w{max-width:960px;margin:0 auto;display:grid;gap:16px}h1{margin:0;font-size:24px}p.sub{margin:4px 0 0;color:var(--muted)}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}.k,.c{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px}
.k span{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.06em}.k b{display:block;font-size:28px;margin-top:4px;font-variant-numeric:tabular-nums}
.bars{display:flex;align-items:flex-end;gap:6px;height:140px;margin-top:12px}.bar{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:4px;height:100%}
.bar i{display:block;width:100%;background:linear-gradient(#5aa2ff,#2f7bff);border-radius:4px 4px 0 0;min-height:2px}.bar small{font-size:10px;color:var(--muted)}
.two{display:grid;grid-template-columns:1fr 1fr;gap:16px}@media(max-width:700px){.two{grid-template-columns:1fr}}
h2{margin:0 0 8px;font-size:15px}table{width:100%;border-collapse:collapse}td{padding:6px 0;border-bottom:1px solid var(--line);word-break:break-all}td.n{text-align:right;font-variant-numeric:tabular-nums;color:var(--blue);padding-left:12px}
.empty{color:var(--muted);margin:0}a.btn{display:inline-block;margin-top:10px;padding:9px 14px;border-radius:10px;background:#2f7bff;color:#fff;text-decoration:none;font-weight:600}
</style></head><body><div class="w">
<div><h1>AZUR admin</h1><p class="sub">Last 14 days. No cookies, no stored IPs.</p></div>
<div class="kpis">
<div class="k"><span>Page views</span><b>${sum('v')}</b></div>
<div class="k"><span>Unique visitors</span><b>${sum('u')}</b></div>
<div class="k"><span>Waitlist sign-ups</span><b>${sum('s')}</b></div>
<div class="k"><span>Waitlist total</span><b>${emails.size}</b></div>
</div>
<div class="c"><h2>Page views per day</h2><div class="bars">${rows.map((r) => `<div class="bar" title="${r.d}: ${r.v} views, ${r.u} visitors, ${r.s} sign-ups"><i style="height:${Math.round(r.v / max * 100)}%"></i><small>${r.d.slice(8)}</small></div>`).join('')}</div></div>
<div class="two"><div class="c"><h2>Top pages</h2>${table(merge('pages'), 'No views yet.')}</div>
<div class="c"><h2>Where visitors come from</h2>${table(merge('refs'), 'No referrers yet.')}</div></div>
<div class="c"><h2>Latest sign-ups</h2>${list.length ? '<table>' + list.map((r) => `<tr><td>${esc(r.email)}</td><td class="n">${esc(r.at.slice(0, 16).replace('T', ' '))}</td></tr>`).join('') + '</table>' : '<p class="empty">No sign-ups yet.</p>'}
<a class="btn" href="/admin/waitlist.csv?key=${encodeURIComponent(key)}">Download all as CSV</a></div>
</div></body></html>`;
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(html);
}

/* ------------------------------------------------------------ static files */

function serveFile(req, res, rel) {
  if (rel === '/' || rel.endsWith('/')) rel += 'index.html';
  /* /docs, /privacy and /terms work without the .html */
  else if (!path.extname(rel)) rel += '.html';

  /* keep the request inside the directory, and never serve the data folder or the server */
  const file = path.join(ROOT, path.normalize(rel));
  if (!file.startsWith(ROOT + path.sep) || file.startsWith(DATA_DIR) || /server\.js$|package\.json$/.test(file)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('404 — nothing here');
    return;
  }

  fs.readFile(file, (err, body) => {
    if (err) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('404 — nothing here');
      return;
    }
    res.writeHead(200, {
      'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'cache-control': path.extname(file) === '.html' ? 'no-cache' : 'public, max-age=3600'
    });
    res.end(body);
  });
}

http.createServer(async (req, res) => {
  let url;
  try { url = new URL(req.url, 'http://x'); } catch (e) { res.writeHead(400).end(); return; }
  let rel;
  try { rel = decodeURIComponent(url.pathname); } catch (e) { res.writeHead(400).end(); return; }

  try {
    if (rel === '/health') return void res.writeHead(200, { 'content-type': 'text/plain' }).end('ok');
    if (rel === '/api/waitlist' && req.method === 'POST') return void await joinWaitlist(req, res);
    if (rel === '/api/prices' && req.method === 'GET') return void await prices(req, res);
    if (rel === '/api/hit' && req.method === 'POST') return void await hit(req, res);
    if (rel === '/admin' || rel === '/admin/waitlist.csv') {
      if (!authorised(url)) return void res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('404 — nothing here');
      return void (rel === '/admin' ? adminPage(res, url.searchParams.get('key')) : adminCsv(res));
    }
    if (rel.startsWith('/api/')) return json(res, 404, { error: 'Not found' });
    serveFile(req, res, rel);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) json(res, 500, { error: 'Something went wrong. Try again.' });
  }
}).listen(PORT, () => console.log(`AZUR on :${PORT}`));
