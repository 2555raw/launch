/* AnyChain — static files plus the small API the launchpad needs.
 *
 * The browser does everything that needs a signature (the user's wallet signs every
 * transaction; this server never sees a private key). The server only does what a
 * browser can't do safely or can't do at all:
 *
 *   GET  /api/health          what is configured (Pinata, RPC)
 *   GET  /api/prices          SOL / ETH / BNB / ARC (AI Rig Complex) in USD (CoinGecko, cached 30 s)
 *   POST /api/sol-rpc         Solana JSON-RPC, forwarded to SOLANA_RPC_URL, read + send only
 *   POST /api/ipfs            stores the token image (and, for pump.fun, its metadata): IPFS via Pinata, else /media
 *   GET  /media/<sha256>.<ext>  self-hosted token images and metadata
 *   POST /api/launches        report a launch; verified on-chain, then listed
 *   GET  /api/launches        every token launched from AnyChain, with market data
 *   POST /api/auth/nonce      a one-time message for the wallet to sign
 *   POST /api/auth/verify     checks the signature, returns a 30-day session token
 *   GET  /api/account         the signed-in wallet's launches, tracked tokens and activity
 *   PUT  /api/account         saves them (so they follow the wallet across devices)
 *   POST /api/pump/create     asks PumpPortal for an unsigned pump.fun create tx
 *   POST /api/pump/sell       asks PumpPortal for an unsigned sell tx (a % of the wallet's tokens)
 *   POST /api/sol/swap        unsigned buy (SOL amount) or sell (% of tokens) for any Solana token (Jupiter)
 *   POST /api/sol/trade       the same through PumpPortal, used when Jupiter has no route
 *   GET  /api/evm/quote       best swap route on Robinhood Chain, Base or BNB Chain (KyberSwap aggregator)
 *   POST /api/evm/build       calldata for that route, for the user's wallet to send
 *   GET  /api/token/:addrs    market data from DexScreener (cached 15 s)
 *   GET  /api/trending        tokens trending on DexScreener on Solana, Robinhood Chain, Base, BNB (cached 60 s)
 *
 * No dependencies; needs Node 18+ for fetch, FormData and Blob.
 *
 * Environment:
 *   PORT            default 8080
 *   SOLANA_RPC_URL  default https://api.mainnet-beta.solana.com (rate-limited: use your own)
 *   PINATA_JWT      optional: token images and metadata go to IPFS through Pinata. Without it they
 *                   are stored on this server (DATA_DIR / the Railway volume) and served from /media
 *   DATA_DIR        where self-hosted media lives; defaults to the Railway volume, else ./data
 *   PUBLIC_URL      base URL written into self-hosted metadata; defaults to the Railway domain
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const PORT = process.env.PORT || 8080;
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const PINATA_JWT = process.env.PINATA_JWT || '';
const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || process.env.DATA_DIR || path.join(ROOT, 'data');
const ACCOUNTS_DIR = path.join(DATA_DIR, 'anychain-accounts');
const MEDIA_DIR = path.join(DATA_DIR, 'anychain-media');
const MEDIA_CAP = 400 * 1024 * 1024;   // stop accepting uploads before the volume fills
const MEDIA_TYPES = { png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', json: 'application/json; charset=utf-8' };

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json'
};

/* Only these files are served; the server source, contracts and scripts are not. */
const PUBLIC = new Set(['/index.html', '/styles.css', '/app.js', '/chain.js', '/erc20.js', '/sw.js', '/manifest.webmanifest',
  '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png', '/icons/favicon-32.png', '/icons/og.png',
  '/vendor/solana-web3-1.99.0.min.js', '/vendor/ethers-6.17.0.min.js', '/vendor/mp4-muxer-5.2.1.js']);

/* Solana RPC methods the page uses. Anything else is refused, so the endpoint
   can't be borrowed as a general-purpose RPC. */
const RPC_METHODS = new Set([
  'getBalance', 'getLatestBlockhash', 'sendTransaction', 'simulateTransaction',
  'getSignatureStatuses', 'getTokenAccountsByOwner', 'getParsedTokenAccountsByOwner',
  'getTokenAccountBalance', 'getAccountInfo'
]);

/* PumpPortal's local (self-signed) API creates on pump.fun only; bonk.fun creation
   there goes through its custodial Lightning wallet, which AnyChain does not use. */
const POOLS = new Set(['pump']);
const KYBER = { rh: 'robinhood', base: 'base', bnb: 'bsc' };
const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const EVM = /^0x[0-9a-fA-F]{40}$/;

/* ---------- helpers ---------- */

const send = (res, status, body, type = 'application/json; charset=utf-8') => {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};
const fail = (res, status, error) => send(res, status, { error });

const readBody = (req, limit) => new Promise((resolve, reject) => {
  const chunks = [];
  let size = 0;
  req.on('data', (c) => {
    size += c.length;
    if (size > limit) { reject(Object.assign(new Error('Request too large'), { status: 413 })); req.destroy(); return; }
    chunks.push(c);
  });
  req.on('end', () => resolve(Buffer.concat(chunks)));
  req.on('error', reject);
});
const readJson = async (req, limit = 64 * 1024) => {
  try { return JSON.parse((await readBody(req, limit)).toString('utf8')); } catch (e) {
    if (e.status) throw e;
    throw Object.assign(new Error('Body must be JSON'), { status: 400 });
  }
};

const cache = new Map();
const cached = async (key, ttl, fn) => {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < ttl) return hit.v;
  const v = await fn();
  if (Array.isArray(v) && !v.length) return v;   // never pin an empty answer for the whole TTL
  cache.set(key, { t: Date.now(), v });
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  return v;
};

const fetchJson = async (url, init) => {
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch (_) { json = null; }
  if (!r.ok) throw Object.assign(new Error((json && (json.error?.message || json.error || json.message)) || `${r.status} ${r.statusText}`), { status: 502 });
  return json;
};

const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, max);

/* ---------- API ---------- */

const pinataUpload = async (blob, filename) => {
  const form = new FormData();
  form.append('network', 'public');
  form.append('file', blob, filename);
  const json = await fetchJson('https://uploads.pinata.cloud/v3/files', {
    method: 'POST', headers: { authorization: `Bearer ${PINATA_JWT}` }, body: form
  });
  const cid = json?.data?.cid;
  if (!cid) throw Object.assign(new Error('Pinata did not return a CID'), { status: 502 });
  return `https://ipfs.io/ipfs/${cid}`;
};

/* Without Pinata, files are content-addressed on disk and served from /media. */
const publicBase = (req) => process.env.PUBLIC_URL?.replace(/\/$/, '')
  || (process.env.RAILWAY_PUBLIC_DOMAIN && `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`)
  || `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers['x-forwarded-host'] || req.headers.host}`;

const dirSize = () => {
  try { return fs.readdirSync(MEDIA_DIR).reduce((a, f) => a + fs.statSync(path.join(MEDIA_DIR, f)).size, 0); } catch (_) { return 0; }
};
const storeLocal = (req, bytes, ext) => {
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
  if (dirSize() + bytes.length > MEDIA_CAP) throw Object.assign(new Error('Media storage is full'), { status: 507 });
  const name = `${crypto.createHash('sha256').update(bytes).digest('hex')}.${ext}`;
  const file = path.join(MEDIA_DIR, name);
  if (!fs.existsSync(file)) fs.writeFileSync(file, bytes);
  return `${publicBase(req)}/media/${name}`;
};
const store = async (req, bytes, ext) => (PINATA_JWT
  ? pinataUpload(new Blob([bytes], { type: MEDIA_TYPES[ext] }), ext === 'json' ? 'metadata.json' : `image.${ext}`)
  : storeLocal(req, bytes, ext));

/* A few uploads per address per hour is plenty for launching. */
const uploads = new Map();
const allowUpload = (req) => {
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const now = Date.now();
  const recent = (uploads.get(ip) || []).filter((t) => now - t < 3600e3);
  if (recent.length >= 20) return false;
  recent.push(now);
  uploads.set(ip, recent);
  if (uploads.size > 5000) uploads.delete(uploads.keys().next().value);
  return true;
};

/* ---------- tokens launched from AnyChain ----------
   After a launch the page reports it. The server checks the transaction on-chain — it succeeded,
   and it created that token — before listing it, so the list can't be filled with made-up tokens. */
const LAUNCHES_FILE = path.join(DATA_DIR, 'anychain-launches.json');
let registry = [];
try { registry = JSON.parse(fs.readFileSync(LAUNCHES_FILE, 'utf8')); } catch (_) { /* first run */ }
const saveRegistry = () => {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(LAUNCHES_FILE + '.tmp', JSON.stringify(registry));
    fs.renameSync(LAUNCHES_FILE + '.tmp', LAUNCHES_FILE);
  } catch (e) { console.error('could not save launches:', e.message); }
};
const EVM_RPC = { rh: 'https://rpc.mainnet.chain.robinhood.com', base: 'https://base-rpc.publicnode.com', bnb: 'https://bsc-rpc.publicnode.com' };
const PONS = ['0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e', '0xe33e9e479df8802cb0866d5d05258bec4cf62948'];
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const SITE_CHAIN = { pump: 'sol', pons: 'rh', base: 'base', bnb: 'bnb' };
const rpcCall = async (url, method, params) => {
  const j = await fetchJson(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  return j?.result;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* the creator's address when the transaction really created the token, null when it didn't,
   undefined when the transaction couldn't be read (RPC busy, not indexed yet) */
const verifyLaunch = async ({ site, address, tx }) => {
  for (let i = 0; i < 6; i++) {   // a just-confirmed transaction (or a busy public RPC) can take a few seconds
    if (i) await sleep(1500 * i);
    if (site === 'pump') {
      const t = await rpcCall(SOLANA_RPC_URL, 'getTransaction', [tx, { encoding: 'json', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }]).catch(() => null);
      if (!t) continue;
      if (t.meta?.err) return null;
      const keys = [...(t.transaction?.message?.accountKeys || []), ...(t.meta?.loadedAddresses?.writable || []), ...(t.meta?.loadedAddresses?.readonly || [])];
      // a create, not a buy of an existing token: pump.fun logs Create/CreateV2 and the mint is new
      const created = (t.meta?.logMessages || []).some((m) => /Instruction: Create(V2)?$/.test(m));
      const minted = (t.meta?.postTokenBalances || []).some((b) => b.mint === address) && !(t.meta?.preTokenBalances || []).some((b) => b.mint === address);
      return created && minted && keys.includes(address) ? keys[0] : null;
    }
    const r = await rpcCall(EVM_RPC[SITE_CHAIN[site]], 'eth_getTransactionReceipt', [tx]).catch(() => null);
    if (!r) continue;
    if (r.status !== '0x1') return null;
    const a = address.toLowerCase();
    // Pons: the factory/router call that minted the token (a Transfer from the zero address), not a later trade
    const ZERO = '0x' + '0'.repeat(64);
    const ok = site === 'pons'
      ? PONS.includes(String(r.to).toLowerCase()) && (r.logs || []).some((l) => String(l.address).toLowerCase() === a && l.topics?.[0] === TRANSFER_TOPIC && l.topics?.[1] === ZERO)
      : String(r.contractAddress).toLowerCase() === a;
    return ok ? r.from : null;
  }
  return undefined;
};

/* Launches made before the public list existed live in the synced accounts: verify them and add
   them once, at start-up, in the background. Imported tokens (site 'import') are not AnyChain launches. */
const backfillLaunches = async () => {
  let files = [];
  try { files = fs.readdirSync(ACCOUNTS_DIR).filter((f) => f.endsWith('.json')); } catch (_) { return; }
  let added = 0;
  for (const f of files) {
    let data;
    try { data = JSON.parse(fs.readFileSync(path.join(ACCOUNTS_DIR, f), 'utf8')); } catch (_) { continue; }
    for (const l of data.launches || []) {
      const chain = SITE_CHAIN[l.site];
      if (!chain || !l.addr || !l.tx) continue;
      if (registry.some((r) => r.chain === chain && r.address.toLowerCase() === String(l.addr).toLowerCase())) continue;
      const creator = await verifyLaunch({ site: l.site, address: String(l.addr), tx: String(l.tx) }).catch(() => null);
      if (!creator) continue;
      const image = clean(l.image, 300);
      registry.push({ chain, site: l.site, address: String(l.addr), tx: String(l.tx), creator,
        name: clean(l.name, 32), symbol: clean(l.ticker, 10).toUpperCase(), image: /^https:\/\//.test(image) ? image : null, created: Number(l.created) || Date.now() });
      added++;
    }
  }
  if (added) { registry.sort((a, b) => a.created - b.created); saveRegistry(); console.log(`launch list: added ${added} earlier launches`); }
};

/* ---------- accounts: sign in with a wallet ----------
   The wallet signs a one-time message; the server checks the signature
   (ed25519 for Solana, secp256k1 for EVM) and hands back a session token
   signed with a server secret. No password, no email, no keys. */

let ethersLib = null;
const ethersNode = () => ethersLib || (ethersLib = require('./vendor/ethers-6.17.0.min.js'));

const B58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const b58decode = (s) => {
  let n = 0n;
  for (const ch of s) {
    const i = B58_ALPHABET.indexOf(ch);
    if (i < 0) throw new Error('bad base58');
    n = n * 58n + BigInt(i);
  }
  const hex = n.toString(16);
  const body = Buffer.from(hex.length % 2 ? '0' + hex : hex, 'hex');
  const lead = s.match(/^1*/)[0].length;
  return Buffer.concat([Buffer.alloc(lead), n === 0n ? Buffer.alloc(0) : body]);
};

const sessionSecret = (() => {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const file = path.join(DATA_DIR, 'anychain-session.key');
  try { return fs.readFileSync(file, 'utf8').trim(); } catch (_) { /* first run */ }
  const key = crypto.randomBytes(32).toString('hex');
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(file, key, { mode: 0o600 }); } catch (_) { /* memory only */ }
  return key;
})();

const nonces = new Map();   // account -> { message, exp }
const accountId = (kind, address) => (kind === 'evm' ? `evm:${address.toLowerCase()}` : `sol:${address}`);
const signToken = (account, exp) => {
  const body = Buffer.from(JSON.stringify({ a: account, e: exp })).toString('base64url');
  return `${body}.${crypto.createHmac('sha256', sessionSecret).update(body).digest('base64url')}`;
};
const readToken = (req) => {
  const m = /^Bearer (.+)\.(.+)$/.exec(req.headers.authorization || '');
  if (!m) return null;
  const want = crypto.createHmac('sha256', sessionSecret).update(m[1]).digest();
  const got = Buffer.from(m[2], 'base64url');
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return null;
  try {
    const { a, e } = JSON.parse(Buffer.from(m[1], 'base64url').toString());
    return e > Date.now() ? a : null;
  } catch (_) { return null; }
};
const accountFile = (account) => path.join(ACCOUNTS_DIR, `${crypto.createHash('sha256').update(account).digest('hex')}.json`);

const api = {
  'POST /api/auth/nonce': async (req, res) => {
    const b = await readJson(req);
    const kind = b.kind === 'evm' ? 'evm' : 'sol';
    if (!(kind === 'evm' ? EVM : B58).test(b.address || '')) return fail(res, 400, 'Invalid address');
    const account = accountId(kind, b.address);
    const nonce = crypto.randomBytes(16).toString('hex');
    const message = `AnyChain sign-in\n\nWallet: ${b.address}\nNonce: ${nonce}\nIssued: ${new Date().toISOString()}\n\nSigning proves you own this wallet so your launches sync across devices. It is free and does not move any funds.`;
    nonces.set(account, { message, nonce, exp: Date.now() + 5 * 60e3 });
    if (nonces.size > 10000) nonces.delete(nonces.keys().next().value);
    send(res, 200, { message, nonce });
  },

  'POST /api/auth/verify': async (req, res) => {
    const b = await readJson(req);
    const kind = b.kind === 'evm' ? 'evm' : 'sol';
    if (!(kind === 'evm' ? EVM : B58).test(b.address || '')) return fail(res, 400, 'Invalid address');
    const account = accountId(kind, b.address);
    const pending = nonces.get(account);
    if (!pending || pending.exp < Date.now()) return fail(res, 400, 'Sign-in expired, try again');
    nonces.delete(account);
    let ok = false;
    try {
      if (kind === 'sol') {
        const pub = b58decode(b.address);
        const key = crypto.createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: pub.toString('base64url') }, format: 'jwk' });
        let signed = Buffer.from(pending.message);
        if (b.signedMessage) {
          /* Sign In With Solana: the wallet wrote the message; it must name this site, this wallet and our nonce */
          signed = Buffer.from(String(b.signedMessage), 'base64');
          const text = signed.toString('utf8');
          const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
          const lines = text.split('\n');
          if (lines[0] !== `${host} wants you to sign in with your Solana account:` || lines[1] !== b.address || !lines.includes(`Nonce: ${pending.nonce}`)) throw new Error('bad SIWS message');
        }
        ok = pub.length === 32 && crypto.verify(null, signed, key, Buffer.from(String(b.signature), 'base64'));
      } else {
        ok = ethersNode().verifyMessage(pending.message, String(b.signature)).toLowerCase() === b.address.toLowerCase();
      }
    } catch (_) { ok = false; }
    if (!ok) return fail(res, 401, 'Signature does not match this wallet');
    const exp = Date.now() + 30 * 24 * 3600e3;
    send(res, 200, { token: signToken(account, exp), account, exp });
  },

  'GET /api/account': async (req, res) => {
    const account = readToken(req);
    if (!account) return fail(res, 401, 'Not signed in');
    try { send(res, 200, JSON.parse(fs.readFileSync(accountFile(account), 'utf8'))); } catch (_) { send(res, 200, { launches: [], tracked: [], activity: [], removed: [] }); }
  },

  'PUT /api/account': async (req, res) => {
    const account = readToken(req);
    if (!account) return fail(res, 401, 'Not signed in');
    const b = await readJson(req, 2 * 1024 * 1024);
    const data = {
      launches: Array.isArray(b.launches) ? b.launches.slice(0, 1000) : [],
      tracked: Array.isArray(b.tracked) ? b.tracked.slice(0, 500) : [],
      activity: Array.isArray(b.activity) ? b.activity.slice(0, 100) : [],
      removed: Array.isArray(b.removed) ? b.removed.slice(-2000).map(String) : [],
      updatedAt: Date.now()
    };
    fs.mkdirSync(ACCOUNTS_DIR, { recursive: true });
    const file = accountFile(account);
    fs.writeFileSync(`${file}.tmp`, JSON.stringify(data));
    fs.renameSync(`${file}.tmp`, file);
    send(res, 200, { ok: true, updatedAt: data.updatedAt });
  },

  'GET /api/health': async (req, res) => send(res, 200, {
    ok: true,
    pinata: !!PINATA_JWT,
    uploads: true,
    customRpc: !!process.env.SOLANA_RPC_URL
  }),

  'GET /api/prices': async (req, res) => {
    const baseGas = await cached('base-gas', 30000, async () => {
      const j = await fetchJson('https://base-rpc.publicnode.com', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_gasPrice', params: [] }) });
      return Number(BigInt(j.result)) / 1e9;   // gwei
    }).catch(() => null);
    const data = await cached('prices', 30000, () => fetchJson(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana,ethereum,binancecoin,ai-rig-complex&vs_currencies=usd&include_24hr_change=true'));
    send(res, 200, {
      sol: { usd: data.solana?.usd, change: data.solana?.usd_24h_change },
      eth: { usd: data.ethereum?.usd, change: data.ethereum?.usd_24h_change },
      bnb: { usd: data.binancecoin?.usd, change: data.binancecoin?.usd_24h_change },
      arc: { usd: data['ai-rig-complex']?.usd, change: data['ai-rig-complex']?.usd_24h_change },
      /* Base has no token of its own: its "price" is what a plain transfer costs (21k gas, paid in ETH) */
      base: baseGas == null || !data.ethereum?.usd ? null
        : { gwei: baseGas, txUsd: baseGas * 1e-9 * 21000 * data.ethereum.usd }
    });
  },

  'POST /api/sol-rpc': async (req, res) => {
    const body = await readJson(req, 256 * 1024);
    if (!body || body.jsonrpc !== '2.0' || !RPC_METHODS.has(body.method)) return fail(res, 400, 'Method not allowed');
    const r = await fetch(SOLANA_RPC_URL, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: body.id ?? 1, method: body.method, params: body.params ?? [] }),
      signal: AbortSignal.timeout(20000)
    });
    send(res, r.status, await r.text());
  },

  'POST /api/ipfs': async (req, res) => {
    if (!allowUpload(req)) return fail(res, 429, 'Too many uploads from this address, try again later');
    const b = await readJson(req, 6 * 1024 * 1024);
    const name = clean(b.name, 32);
    const symbol = clean(b.symbol, 10);
    if (!name || !symbol) return fail(res, 400, 'Name and symbol are required');
    const m = /^data:(image\/(png|jpeg|gif|webp));base64,([A-Za-z0-9+/=]+)$/.exec(b.image || '');
    if (!m) return fail(res, 400, 'Image must be a PNG, JPG, GIF or WEBP');
    const bytes = Buffer.from(m[3], 'base64');
    if (bytes.length > 4 * 1024 * 1024) return fail(res, 413, 'Image must be 4 MB or less');

    const image = await store(req, bytes, m[2] === 'jpeg' ? 'jpg' : m[2]);
    if (b.imageOnly) return send(res, 200, { image });   // Pons takes a logo URI, not a metadata file
    const meta = { name, symbol, description: clean(b.description, 1000), image, showName: true, createdOn: 'AnyChain' };
    for (const k of ['twitter', 'telegram', 'website']) {
      const v = clean(b[k], 200);
      if (v && /^https?:\/\//i.test(v)) meta[k] = v;
    }
    const uri = await store(req, Buffer.from(JSON.stringify(meta)), 'json');
    send(res, 200, { uri, image });
  },

  'POST /api/pump/create': async (req, res) => {
    const b = await readJson(req);
    if (!B58.test(b.publicKey || '') || !B58.test(b.mint || '')) return fail(res, 400, 'Invalid wallet or mint address');
    if (!POOLS.has(b.pool)) return fail(res, 400, 'Unknown launch site');
    const amount = Number(b.amount);
    if (!(amount >= 0 && amount <= 1000)) return fail(res, 400, 'Dev buy must be between 0 and 1000 SOL');
    const uri = clean(b.uri, 300);
    if (!/^https?:\/\//.test(uri)) return fail(res, 400, 'Metadata URI missing');

    const r = await fetch('https://pumpportal.fun/api/trade-local', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        publicKey: b.publicKey,
        action: 'create',
        tokenMetadata: { name: clean(b.name, 32), symbol: clean(b.symbol, 10), uri },
        mint: b.mint,
        denominatedInSol: 'true',
        amount,
        slippage: Math.min(50, Math.max(1, Number(b.slippage) || 10)),
        priorityFee: Math.min(0.01, Math.max(0, Number(b.priorityFee) || 0.0005)),
        pool: b.pool
      }),
      signal: AbortSignal.timeout(20000)
    });
    const buf = Buffer.from(await r.arrayBuffer());
    if (r.status !== 200) return fail(res, 502, `PumpPortal: ${buf.toString('utf8').slice(0, 300) || r.statusText}`);
    send(res, 200, buf, 'application/octet-stream');
  },

  'POST /api/pump/sell': async (req, res) => {
    const b = await readJson(req);
    if (!B58.test(b.publicKey || '') || !B58.test(b.mint || '')) return fail(res, 400, 'Invalid wallet or mint address');
    const pct = Math.round(Number(b.percent));
    if (!(pct >= 1 && pct <= 100)) return fail(res, 400, 'Percent must be 1–100');
    const r = await fetch('https://pumpportal.fun/api/trade-local', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        publicKey: b.publicKey,
        action: 'sell',
        mint: b.mint,
        denominatedInSol: 'false',
        amount: `${pct}%`,
        slippage: Math.min(50, Math.max(1, Number(b.slippage) || 15)),
        priorityFee: Math.min(0.01, Math.max(0, Number(b.priorityFee) || 0.0005)),
        pool: 'auto'
      }),
      signal: AbortSignal.timeout(20000)
    });
    const buf = Buffer.from(await r.arrayBuffer());
    if (r.status !== 200) return fail(res, 502, `PumpPortal: ${buf.toString('utf8').slice(0, 300) || r.statusText}`);
    send(res, 200, buf, 'application/octet-stream');
  },

  /* Tokens trending on DexScreener (top boosts + latest profiles) on the chains
     AnyChain launches to, with live market data, busiest first. */
  'GET /api/trending': async (req, res) => {
    const CHAINS = { solana: 'sol', robinhood: 'rh', base: 'base', bsc: 'bnb' };
    const list = await cached('trending', 60000, async () => {
      const [boosts, profiles] = await Promise.all([
        fetchJson('https://api.dexscreener.com/token-boosts/top/v1').catch(() => []),
        fetchJson('https://api.dexscreener.com/token-profiles/latest/v1').catch(() => [])
      ]);
      const seen = new Map();
      for (const t of [...(boosts || []), ...(profiles || [])]) {
        if (!CHAINS[t.chainId] || !t.tokenAddress || seen.has(t.tokenAddress)) continue;
        const icon = !t.icon ? null : /^https:\/\//.test(t.icon) ? t.icon
          : `https://cdn.dexscreener.com/cms/images/${encodeURIComponent(t.icon)}?width=64&height=64&fit=crop&quality=95&format=auto`;
        seen.set(t.tokenAddress, { address: t.tokenAddress, chain: CHAINS[t.chainId], icon, url: t.url });
      }
      const tokens = [...seen.values()].slice(0, 30);
      if (!tokens.length) return [];
      const data = await fetchJson(`https://api.dexscreener.com/latest/dex/tokens/${tokens.map((t) => t.address).join(',')}`);
      const best = {};
      for (const p of data?.pairs || []) {
        const a = p.baseToken?.address;
        const t = tokens.find((x) => x.address.toLowerCase() === a?.toLowerCase());
        if (!t || CHAINS[p.chainId] !== t.chain) continue;
        if (best[t.address] && (best[t.address].liquidity?.usd || 0) >= (p.liquidity?.usd || 0)) continue;
        best[t.address] = p;
      }
      return tokens.filter((t) => best[t.address]).map((t) => {
        const p = best[t.address];
        return {
          ...t, name: p.baseToken.name, symbol: p.baseToken.symbol, dex: p.dexId,
          priceUsd: Number(p.priceUsd) || 0, marketCap: p.marketCap || p.fdv || 0,
          volume24h: p.volume?.h24 || 0, change24h: p.priceChange?.h24 ?? 0, liquidity: p.liquidity?.usd || 0,
          icon: t.icon || p.info?.imageUrl || null
        };
      }).sort((a, b) => b.volume24h - a.volume24h);
    });
    send(res, 200, list);
  },

  /* Any Solana token through Jupiter, which routes across every Solana DEX and
     the pump.fun curve. Sells are a % of the wallet's balance, read here. */
  'POST /api/sol/swap': async (req, res) => {
    const b = await readJson(req);
    if (!B58.test(b.publicKey || '') || !B58.test(b.mint || '')) return fail(res, 400, 'Invalid wallet or token address');
    const SOL = 'So11111111111111111111111111111111111111112';
    const buy = b.action === 'buy';
    let amount;
    if (buy) {
      const sol = Number(b.amount);
      if (!(sol > 0 && sol <= 1000)) return fail(res, 400, 'Buy amount must be between 0 and 1000 SOL');
      amount = BigInt(Math.round(sol * 1e9));
    } else {
      const pct = Math.round(Number(b.percent));
      if (!(pct >= 1 && pct <= 100)) return fail(res, 400, 'Percent must be 1–100');
      const r = await fetch(SOLANA_RPC_URL, { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getParsedTokenAccountsByOwner', params: [b.publicKey, { mint: b.mint }, { encoding: 'jsonParsed' }] }),
        signal: AbortSignal.timeout(15000) }).then((x) => x.json());
      const raw = (r.result?.value || []).reduce((a, acc) => a + BigInt(acc.account?.data?.parsed?.info?.tokenAmount?.amount || '0'), 0n);
      amount = raw * BigInt(pct) / 100n;
      if (amount === 0n) return fail(res, 400, 'This wallet holds none of this token');
    }
    const slippageBps = Math.min(5000, Math.max(10, Math.round((Number(b.slippage) || 10) * 100)));
    const quote = await fetchJson(`https://lite-api.jup.ag/swap/v1/quote?inputMint=${buy ? SOL : b.mint}&outputMint=${buy ? b.mint : SOL}&amount=${amount}&slippageBps=${slippageBps}`)
      .catch(() => null);
    if (!quote?.outAmount) return fail(res, 404, 'No Jupiter route');
    const swap = await fetchJson('https://lite-api.jup.ag/swap/v1/swap', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ quoteResponse: quote, userPublicKey: b.publicKey, dynamicComputeUnitLimit: true, prioritizationFeeLamports: 'auto' })
    });
    if (!swap?.swapTransaction) return fail(res, 502, 'Jupiter could not build the swap');
    send(res, 200, { tx: swap.swapTransaction });
  },

  'POST /api/sol/trade': async (req, res) => {
    const b = await readJson(req);
    if (!B58.test(b.publicKey || '') || !B58.test(b.mint || '')) return fail(res, 400, 'Invalid wallet or token address');
    const buy = b.action === 'buy';
    let amount;
    if (buy) {
      amount = Number(b.amount);
      if (!(amount > 0 && amount <= 1000)) return fail(res, 400, 'Buy amount must be between 0 and 1000 SOL');
    } else {
      const pct = Math.round(Number(b.percent));
      if (!(pct >= 1 && pct <= 100)) return fail(res, 400, 'Percent must be 1–100');
      amount = `${pct}%`;
    }
    const r = await fetch('https://pumpportal.fun/api/trade-local', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        publicKey: b.publicKey, action: buy ? 'buy' : 'sell', mint: b.mint,
        denominatedInSol: buy ? 'true' : 'false', amount,
        slippage: Math.min(50, Math.max(1, Number(b.slippage) || 10)),
        priorityFee: Math.min(0.01, Math.max(0, Number(b.priorityFee) || 0.0005)),
        pool: 'auto'
      }),
      signal: AbortSignal.timeout(20000)
    });
    const buf = Buffer.from(await r.arrayBuffer());
    if (r.status !== 200) return fail(res, 502, `PumpPortal: ${buf.toString('utf8').slice(0, 300) || r.statusText}`);
    send(res, 200, buf, 'application/octet-stream');
  },

  /* EVM swaps go through the KyberSwap aggregator, which routes across the DEXs
     of each chain, Pons bonding curves included on Robinhood Chain. */
  'GET /api/evm/quote': async (req, res) => {
    const q = new URL(req.url, 'http://x').searchParams;
    const chain = KYBER[q.get('chain')];
    const tokenIn = (q.get('tokenIn') || '').toLowerCase();
    const tokenOut = (q.get('tokenOut') || '').toLowerCase();
    const amountIn = q.get('amountIn') || '';
    if (!chain || !EVM.test(tokenIn) || !EVM.test(tokenOut) || !/^[1-9]\d{0,40}$/.test(amountIn)) return fail(res, 400, 'Bad quote request');
    const j = await fetchJson(`https://aggregator-api.kyberswap.com/${chain}/api/v1/routes?tokenIn=${tokenIn}&tokenOut=${tokenOut}&amountIn=${amountIn}`,
      { headers: { 'x-client-id': 'anychain' } });
    if (j.code !== 0 || !j.data?.routeSummary) return fail(res, 404, 'No route for this token yet');
    send(res, 200, { routeSummary: j.data.routeSummary, routerAddress: j.data.routerAddress });
  },

  'POST /api/evm/build': async (req, res) => {
    const b = await readJson(req, 256 * 1024);
    const chain = KYBER[b.chain];
    if (!chain || !EVM.test(b.sender || '') || !b.routeSummary) return fail(res, 400, 'Bad build request');
    const j = await fetchJson(`https://aggregator-api.kyberswap.com/${chain}/api/v1/route/build`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-client-id': 'anychain' },
      body: JSON.stringify({
        routeSummary: b.routeSummary, sender: b.sender, recipient: b.sender, source: 'anychain',
        slippageTolerance: Math.min(5000, Math.max(10, Math.round(Number(b.slippageBps) || 1000)))
      })
    });
    if (j.code !== 0 || !j.data?.data) return fail(res, 502, j.message || 'Could not build the swap');
    send(res, 200, { to: j.data.routerAddress, data: j.data.data, amountIn: j.data.amountIn, amountOut: j.data.amountOut });
  },

  'POST /api/launches': async (req, res) => {
    if (!allowUpload(req)) return fail(res, 429, 'Too many requests from this address, try again later');
    const b = await readJson(req);
    const site = String(b.site || '');
    const chain = SITE_CHAIN[site];
    const address = String(b.address || '');
    const tx = String(b.tx || '');
    if (!chain) return fail(res, 400, 'Unknown launchpad');
    if (chain === 'sol' ? !(B58.test(address) && /^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(tx)) : !(EVM.test(address) && /^0x[0-9a-fA-F]{64}$/.test(tx))) return fail(res, 400, 'Bad address or transaction');
    const key = `${chain}:${address.toLowerCase()}`;
    const known = registry.find((l) => `${l.chain}:${l.address.toLowerCase()}` === key);
    if (known) return send(res, 200, known);
    const creator = await verifyLaunch({ site, address, tx });
    if (creator === undefined) return fail(res, 503, 'Could not read the transaction yet, try again in a minute');
    if (!creator) return fail(res, 422, 'That transaction did not create this token');
    const image = clean(b.image, 300);
    const entry = {
      chain, site, address, tx, creator,
      name: clean(b.name, 32) || address.slice(0, 6), symbol: clean(b.symbol, 10).toUpperCase() || '?',
      image: /^https:\/\//.test(image) ? image : null,
      created: Date.now()
    };
    registry.push(entry);
    saveRegistry();
    send(res, 201, entry);
  },

  /* newest first, with DexScreener market data (30 addresses per request, cached) */
  'GET /api/launches': async (req, res) => {
    const list = registry.slice(-300).reverse();
    const market = {};
    for (let i = 0; i < list.length; i += 30) {
      const addrs = list.slice(i, i + 30).map((l) => l.address);
      const data = await cached(`tok:${addrs.join(',')}`, 30000, () =>
        fetchJson(`https://api.dexscreener.com/latest/dex/tokens/${addrs.join(',')}`)).catch(() => null);
      for (const p of data?.pairs || []) {
        const k = p.baseToken?.address?.toLowerCase();
        const liq = p.liquidity?.usd || 0;
        if (!k || (market[k] && market[k].liquidity >= liq)) continue;
        market[k] = { priceUsd: Number(p.priceUsd) || 0, marketCap: p.marketCap || p.fdv || 0, change24h: p.priceChange?.h24 ?? 0, volume24h: p.volume?.h24 || 0, liquidity: liq, url: p.url };
      }
    }
    send(res, 200, { total: registry.length, launches: list.map((l) => ({ ...l, market: market[l.address.toLowerCase()] || null })) });
  },

  'GET /api/token': async (req, res, rest) => {
    const addrs = [...new Set(decodeURIComponent(rest).split(',').map((s) => s.trim()).filter((s) => B58.test(s) || EVM.test(s)))].slice(0, 30);
    if (!addrs.length) return fail(res, 400, 'No valid addresses');
    const data = await cached(`tok:${addrs.join(',')}`, 15000, () =>
      fetchJson(`https://api.dexscreener.com/latest/dex/tokens/${addrs.join(',')}`));
    const out = {};
    for (const p of data?.pairs || []) {
      const addr = addrs.find((a) => a.toLowerCase() === p.baseToken?.address?.toLowerCase());
      if (!addr) continue;
      const liq = p.liquidity?.usd || 0;
      if (out[addr] && out[addr].liquidity >= liq) continue;
      out[addr] = {
        priceUsd: Number(p.priceUsd) || 0,
        marketCap: p.marketCap || p.fdv || 0,
        change24h: p.priceChange?.h24 ?? 0,
        volume24h: p.volume?.h24 || 0,
        liquidity: liq,
        dex: p.dexId,
        chain: p.chainId,
        url: p.url,
        name: p.baseToken?.name,
        symbol: p.baseToken?.symbol
      };
    }
    send(res, 200, out);
  }
};

/* ---------- server ---------- */

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  let rel = decodeURIComponent(url.pathname);

  if (rel.startsWith('/api/')) {
    const m = /^\/api\/token\/(.+)$/.exec(rel);
    const key = m ? `${req.method} /api/token` : `${req.method} ${rel}`;
    const handler = api[key];
    if (!handler) return fail(res, 404, 'Not found');
    try {
      await handler(req, res, m ? m[1] : '');
    } catch (e) {
      if (!res.headersSent) fail(res, e.status || 500, e.message || 'Server error');
    }
    return;
  }

  const media = /^\/media\/([a-f0-9]{64}\.(png|jpg|gif|webp|json))$/.exec(rel);
  if (media) {
    fs.readFile(path.join(MEDIA_DIR, media[1]), (err, body) => {
      if (err) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found'); return; }
      res.writeHead(200, { 'content-type': MEDIA_TYPES[media[2]], 'cache-control': 'public, max-age=31536000, immutable', 'access-control-allow-origin': '*' });
      res.end(body);
    });
    return;
  }

  if (rel === '/') rel = '/index.html';
  if (!PUBLIC.has(rel) && !/^\/img\/(hero\/)?[a-z]+\.(png|svg)$/.test(rel)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('404 — nothing here');
    return;
  }
  fs.readFile(path.join(ROOT, rel), (err, body) => {
    if (err) { res.writeHead(err.code === 'ENOENT' ? 404 : 500).end(err.code === 'ENOENT' ? 'Not found' : 'Read error'); return; }
    const headers = { 'content-type': TYPES[path.extname(rel)] || 'application/octet-stream' };
    if (rel === '/sw.js' || rel === '/index.html') headers['cache-control'] = 'no-cache';   // updates reach installed apps
    else if (rel.startsWith('/vendor/')) headers['cache-control'] = 'public, max-age=31536000, immutable';
    else if (rel.startsWith('/img/')) headers['cache-control'] = 'public, max-age=86400';
    res.writeHead(200, headers);
    res.end(body);
  });
}).listen(PORT, () => { console.log(`AnyChain on http://localhost:${PORT}`); backfillLaunches(); });
