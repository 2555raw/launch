/* Serves Yuelong: the static site, plus a small API backed by an on-chain indexer.
 *
 *   GET  /api/config                  networks with a deployment, contract addresses, pairs
 *   GET  /api/markets                 every coin on every live network
 *   GET  /api/token/:chainId/:curve   one coin, its recent trades
 *   GET  /api/feed                    latest trades across networks
 *   GET  /api/stats                   totals for the hero
 *   POST /api/poke/:chainId           a page just traded: index now instead of on the next poll
 *   POST /api/upload                  a coin image (PNG, JPG, WebP or GIF, 2 MB max)
 *   GET  /u/<sha256>.<ext>            an uploaded image
 *   POST /api/admin/deployment        the owner saves a deployment (header x-admin-key = ADMIN_KEY)
 *   GET  /health                      Railway's healthcheck
 *
 * State (index, uploads, deployments saved from /admin.html) lives in DATA_DIR, a Railway
 * volume in production. Railway sets PORT; 8080 is the fallback its domain points at. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { JsonRpcProvider, Contract, getAddress, isAddress } = require('ethers');
const { NETWORKS, byChainId } = require('./server/networks');
const { Indexer } = require('./server/indexer');
const ABI = require('./assets/chain/abi.json');

const ROOT = __dirname;
const PORT = process.env.PORT || 8080;
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
const UPLOADS = path.join(DATA_DIR, 'uploads');
const ADMIN_KEY = process.env.ADMIN_KEY || '';
fs.mkdirSync(UPLOADS, { recursive: true });

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

/* only what the site needs is public: not the server, the contracts' workspace, the README or the painting sources */
const PRIVATE = /^\/(server\.js|server\/|package(-lock)?\.json|README\.md|deployments\.json|data\/|contracts\/|node_modules\/|assets\/src\/)/;

/* ---------------------------------------------------------------- deployments and indexers */

const DEPLOY_FILE = path.join(DATA_DIR, 'deployments.json');
const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (_) { return {}; } };

/* the repo's deployments.json is the default; what the owner saves from /admin.html wins */
const deployments = () => ({ ...readJson(path.join(ROOT, 'deployments.json')), ...readJson(DEPLOY_FILE) });

const indexers = {};
function startIndexers() {
  const deps = deployments();
  for (const [id, dep] of Object.entries(deps)) {
    const net = byChainId(id);
    if (!net || dep.hidden || (net.local && !process.env.LOCAL_CHAIN)) continue;
    const cur = indexers[id];
    if (cur && cur.dep.factory === dep.factory) { cur.dep = dep; continue; }
    if (cur) cur.stop();
    indexers[id] = new Indexer(net, dep, DATA_DIR).start();
    console.log(`indexing ${net.name} (${id}) factory ${dep.factory} from block ${dep.startBlock}`);
  }
  for (const id of Object.keys(indexers)) if (!deps[id] || deps[id].hidden) { indexers[id].stop(); delete indexers[id]; }
}

/* USD prices for the native coins, refreshed every five minutes; the site works without them */
const usd = {};
async function refreshPrices() {
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bittensor,ethereum&vs_currencies=usd', { signal: AbortSignal.timeout(8000) });
    const j = await r.json();
    if (j.bittensor?.usd) usd.TAO = j.bittensor.usd;
    if (j.ethereum?.usd) usd.ETH = j.ethereum.usd;
  } catch (_) { /* offline or rate-limited: keep the last value */ }
}

function config() {
  const deps = deployments();
  const networks = Object.keys(indexers).map((id) => {
    const net = byChainId(id); const dep = deps[id];
    return {
      key: net.key, chainId: net.chainId, name: net.name, short: net.short, native: net.native, rpc: net.rpc, explorer: net.explorer,
      testnet: !!net.testnet, factory: dep.factory, router: dep.router, wnative: dep.wnative, graduator: dep.graduator,
      launchFee: dep.launchFee || '0', pairs: dep.pairs || [], usd: usd[net.native] || null,
    };
  });
  networks.sort((a, b) => a.testnet - b.testnet);
  return { live: networks.length > 0, networks, known: NETWORKS.filter((n) => !n.local || process.env.LOCAL_CHAIN).map(({ key, chainId, name, short, native, rpc, explorer, testnet }) => ({ key, chainId, name, short, native, rpc, explorer, testnet: !!testnet })) };
}

/* ---------------------------------------------------------------- helpers */

const send = (res, code, body, headers = {}) => {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers });
  res.end(JSON.stringify(body));
};

function readBody(req, max) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', (c) => { size += c.length; if (size > max) { reject(Object.assign(new Error('too large'), { code: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/* a small per-IP budget for the endpoints that write */
const buckets = new Map();
function allow(req, name, perMinute) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const k = name + ip, now = Date.now();
  const b = buckets.get(k) || { n: 0, t: now };
  if (now - b.t > 60_000) { b.n = 0; b.t = now; }
  b.n += 1; buckets.set(k, b);
  if (buckets.size > 5000) buckets.clear();
  return b.n <= perMinute;
}

function imageType(buf) {
  if (buf.length > 8 && buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') return 'png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (buf.length > 6 && buf.toString('ascii', 0, 4) === 'GIF8') return 'gif';
  return null;
}

const keyOk = (k) => {
  if (!ADMIN_KEY || typeof k !== 'string') return false;
  const a = crypto.createHash('sha256').update(k).digest(), b = crypto.createHash('sha256').update(ADMIN_KEY).digest();
  return crypto.timingSafeEqual(a, b);
};

/* the owner's deployment is checked against the chain before the site trusts it */
async function verifyDeployment(body) {
  const net = byChainId(body.chainId);
  if (!net) throw new Error('Unknown chain ' + body.chainId);
  for (const k of ['factory', 'router', 'wnative', 'graduator']) if (!isAddress(body[k])) throw new Error(`${k} is not an address`);
  const provider = new JsonRpcProvider(net.rpc, net.chainId, { staticNetwork: true });
  const factory = new Contract(body.factory, ABI.YuelongFactory, provider);
  const router = new Contract(body.router, ABI.YuelongRouter, provider);
  const [fw, fg, rw, fee] = await Promise.all([factory.wnative(), factory.graduator(), router.wnative(), factory.launchFee()]);
  if (fw.toLowerCase() !== body.wnative.toLowerCase()) throw new Error('factory.wnative() does not match');
  if (fg.toLowerCase() !== body.graduator.toLowerCase()) throw new Error('factory.graduator() does not match');
  if (rw.toLowerCase() !== body.wnative.toLowerCase()) throw new Error('router.wnative() does not match');
  const erc20 = ['function decimals() view returns (uint8)', 'function symbol() view returns (string)'];
  const pairs = [];
  for (const p of (Array.isArray(body.pairs) && body.pairs.length ? body.pairs : [{ address: body.wnative }]).slice(0, 12)) {
    if (!isAddress(p.address)) continue;
    const s = await factory.stocks(p.address);
    if (!s.enabled) throw new Error(`pair ${p.address} is not enabled on the factory`);
    const native = p.address.toLowerCase() === body.wnative.toLowerCase();
    const t = new Contract(p.address, erc20, provider);
    const [dec, sym] = await Promise.all([t.decimals(), t.symbol().catch(() => '?')]);
    pairs.push({ address: getAddress(p.address), symbol: native ? net.native : String(p.symbol || sym).slice(0, 12), decimals: Number(dec), native });
  }
  const head = await provider.getBlockNumber();
  const startBlock = Math.max(0, Math.min(Number(body.startBlock) || 0, head));
  return {
    chainId: net.chainId, factory: getAddress(body.factory), router: getAddress(body.router), wnative: getAddress(body.wnative),
    graduator: getAddress(body.graduator), treasury: isAddress(body.treasury) ? getAddress(body.treasury) : null,
    startBlock, pairs, launchFee: String(fee), savedAt: new Date().toISOString(),
  };
}

/* ---------------------------------------------------------------- API */

async function api(req, res, rel) {
  const parts = rel.split('/').filter(Boolean).slice(1); // after "api"
  const all = Object.values(indexers);

  if (req.method === 'GET' && parts[0] === 'config') return send(res, 200, config());

  if (req.method === 'GET' && parts[0] === 'markets') {
    const list = all.flatMap((ix) => ix.tokens()).sort((a, b) => b.createdAt - a.createdAt || b.block - a.block);
    return send(res, 200, { tokens: list });
  }

  if (req.method === 'GET' && parts[0] === 'token' && parts.length === 3) {
    const ix = indexers[parts[1]];
    const tk = ix && isAddress(parts[2]) ? ix.token(parts[2]) : null;
    // not indexed (yet): a coin launched seconds ago shows up on the next poll
    if (!tk) return send(res, ix ? 200 : 404, { token: null, indexed: ix ? ix.state.lastBlock : null, head: ix ? ix.head : null });
    return send(res, 200, { token: tk, trades: ix.trades(parts[2], 500), head: ix.head, indexed: ix.state.lastBlock });
  }

  if (req.method === 'GET' && parts[0] === 'feed') {
    const trades = all.flatMap((ix) => ix.recentTrades(30)).sort((a, b) => b.t - a.t).slice(0, 30);
    return send(res, 200, { trades });
  }

  if (req.method === 'GET' && parts[0] === 'stats') {
    const per = all.map((ix) => ix.stats());
    const nets = config().networks;
    const volumeUsd = per.reduce((s, x) => {
      const n = nets.find((m) => m.chainId === x.chainId);
      return s + (n && n.usd ? Number(BigInt(x.volume) / 10n ** 12n) / 1e6 * n.usd : 0);
    }, 0);
    return send(res, 200, {
      launches: per.reduce((s, x) => s + x.launches, 0), graduated: per.reduce((s, x) => s + x.graduated, 0),
      traders: per.reduce((s, x) => s + x.traders, 0), volumeUsd, networks: per,
    });
  }

  if (req.method === 'POST' && parts[0] === 'poke') {
    if (!allow(req, 'poke', 30)) return send(res, 429, { error: 'slow down' });
    const ix = indexers[parts[1]];
    if (ix) ix.poke();
    return send(res, 200, { ok: !!ix });
  }

  if (req.method === 'POST' && parts[0] === 'upload') {
    if (!allow(req, 'upload', 10)) return send(res, 429, { error: 'Too many uploads. Try again in a minute.' });
    let buf;
    try { buf = await readBody(req, 2 * 1024 * 1024); } catch (e) { return send(res, e.code === 413 ? 413 : 400, { error: e.code === 413 ? 'That image is over 2 MB.' : 'Upload failed.' }); }
    const ext = imageType(buf);
    if (!ext) return send(res, 415, { error: 'Only PNG, JPG, WebP or GIF images.' });
    const name = crypto.createHash('sha256').update(buf).digest('hex') + '.' + ext;
    const file = path.join(UPLOADS, name);
    if (!fs.existsSync(file)) fs.writeFileSync(file, buf);
    return send(res, 200, { url: '/u/' + name });
  }

  if (parts[0] === 'admin') {
    if (!allow(req, 'admin', 10)) return send(res, 429, { error: 'Too many attempts. Wait a minute.' });
    if (!ADMIN_KEY) return send(res, 503, { error: 'ADMIN_KEY is not set on the server.' });
    if (!keyOk(req.headers['x-admin-key'])) return send(res, 401, { error: 'Wrong admin key.' });
    if (req.method === 'GET' && parts[1] === 'check') return send(res, 200, { ok: true, deployments: deployments() });
    if (req.method === 'POST' && parts[1] === 'deployment') {
      let body;
      try { body = JSON.parse((await readBody(req, 64 * 1024)).toString('utf8')); } catch (_) { return send(res, 400, { error: 'Bad JSON.' }); }
      const saved = readJson(DEPLOY_FILE);
      if (body.remove) { delete saved[body.chainId]; }
      else if (body.hide !== undefined && saved[body.chainId]) { saved[body.chainId].hidden = !!body.hide; }
      else {
        try { saved[Number(body.chainId)] = await verifyDeployment(body); }
        catch (e) { return send(res, 400, { error: String(e.shortMessage || e.message).slice(0, 300) }); }
      }
      fs.writeFileSync(DEPLOY_FILE, JSON.stringify(saved, null, 2));
      startIndexers();
      return send(res, 200, { ok: true, deployments: deployments() });
    }
  }

  return send(res, 404, { error: 'not found' });
}

/* ---------------------------------------------------------------- server */

http.createServer(async (req, res) => {
  let rel;
  try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); }
  catch (_) { res.writeHead(400).end('Bad request'); return; }

  if (rel === '/health') { res.writeHead(200, { 'content-type': 'text/plain' }).end('ok'); return; }
  if (rel.startsWith('/api/')) {
    try { await api(req, res, rel); }
    catch (e) { console.error(e); if (!res.headersSent) send(res, 500, { error: 'server error' }); }
    return;
  }

  const up = rel.match(/^\/u\/([a-f0-9]{64}\.(png|jpg|webp|gif))$/);
  if (up) {
    fs.readFile(path.join(UPLOADS, up[1]), (err, body) => {
      if (err) { res.writeHead(404).end('Not found'); return; }
      res.writeHead(200, { 'content-type': TYPES['.' + up[2]], 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'" });
      res.end(body);
    });
    return;
  }

  if (rel === '/' || rel.endsWith('/')) rel += 'index.html';
  if (PRIVATE.test(rel)) { res.writeHead(404).end('Not found'); return; }

  /* keep the request inside the directory, whatever it asks for */
  const file = path.join(ROOT, path.normalize(rel));
  if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403).end('Forbidden'); return; }

  fs.readFile(file, (err, body) => {
    if (err) {
      fs.readFile(path.join(ROOT, 'index.html'), (e2, home) => {
        res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
        res.end(e2 ? 'Not found' : home);
      });
      return;
    }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'content-type': TYPES[ext] || 'application/octet-stream',
      'cache-control': ext === '.html' ? 'no-cache' : ext === '.woff2' ? 'public, max-age=31536000, immutable' : ext === '.js' || ext === '.css' || ext === '.json' ? 'no-cache' : 'public, max-age=3600',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin'
    });
    res.end(body);
  });
}).listen(PORT, () => {
  console.log(`Yuelong on :${PORT}, data in ${DATA_DIR}`);
  startIndexers();
  refreshPrices();
  setInterval(refreshPrices, 5 * 60_000).unref();
});
