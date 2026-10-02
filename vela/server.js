/* Vela — static files plus the small API the launchpad needs.
 *
 * The browser does everything that needs a signature (the user's wallet signs every
 * transaction; this server never sees a private key). The server only does what a
 * browser can't do safely or can't do at all:
 *
 *   GET  /api/health          what is configured (Pinata, RPC)
 *   GET  /api/prices          SOL / ETH / BNB / ARC (AI Rig Complex) in USD (CoinGecko, cached 30 s)
 *   POST /api/sol-rpc         Solana JSON-RPC, forwarded to SOLANA_RPC_URL, read + send only
 *   POST /api/ipfs            uploads the token image (and, for pump.fun, its metadata) to IPFS through Pinata
 *   POST /api/pump/create     asks PumpPortal for an unsigned pump.fun create tx
 *   POST /api/pump/sell       asks PumpPortal for an unsigned sell tx (a % of the wallet's tokens)
 *   GET  /api/token/:addrs    market data from DexScreener (cached 15 s)
 *   GET  /api/trending        tokens trending on DexScreener on Solana, Robinhood Chain, Base, BNB (cached 60 s)
 *
 * No dependencies; needs Node 18+ for fetch, FormData and Blob.
 *
 * Environment:
 *   PORT            default 8080
 *   SOLANA_RPC_URL  default https://api.mainnet-beta.solana.com (rate-limited: use your own)
 *   PINATA_JWT      required for pump.fun launches and for Pons logos (they go to IPFS)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = process.env.PORT || 8080;
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const PINATA_JWT = process.env.PINATA_JWT || '';

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

/* Only these files are served; the server source, contracts and scripts are not. */
const PUBLIC = new Set(['/index.html', '/styles.css', '/app.js', '/chain.js', '/erc20.js',
  '/vendor/solana-web3-1.99.0.min.js', '/vendor/ethers-6.17.0.min.js']);

/* Solana RPC methods the page uses. Anything else is refused, so the endpoint
   can't be borrowed as a general-purpose RPC. */
const RPC_METHODS = new Set([
  'getBalance', 'getLatestBlockhash', 'sendTransaction', 'simulateTransaction',
  'getSignatureStatuses', 'getTokenAccountsByOwner', 'getParsedTokenAccountsByOwner',
  'getTokenAccountBalance', 'getAccountInfo'
]);

/* PumpPortal's local (self-signed) API creates on pump.fun only; bonk.fun creation
   there goes through its custodial Lightning wallet, which Vela does not use. */
const POOLS = new Set(['pump']);
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

const api = {
  'GET /api/health': async (req, res) => send(res, 200, {
    ok: true,
    pinata: !!PINATA_JWT,
    customRpc: !!process.env.SOLANA_RPC_URL
  }),

  'GET /api/prices': async (req, res) => {
    const data = await cached('prices', 30000, () => fetchJson(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana,ethereum,binancecoin,ai-rig-complex&vs_currencies=usd&include_24hr_change=true'));
    send(res, 200, {
      sol: { usd: data.solana?.usd, change: data.solana?.usd_24h_change },
      eth: { usd: data.ethereum?.usd, change: data.ethereum?.usd_24h_change },
      bnb: { usd: data.binancecoin?.usd, change: data.binancecoin?.usd_24h_change },
      arc: { usd: data['ai-rig-complex']?.usd, change: data['ai-rig-complex']?.usd_24h_change }
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
    if (!PINATA_JWT) return fail(res, 503, 'IPFS uploads are not configured: set PINATA_JWT on the server');
    const b = await readJson(req, 6 * 1024 * 1024);
    const name = clean(b.name, 32);
    const symbol = clean(b.symbol, 10);
    if (!name || !symbol) return fail(res, 400, 'Name and symbol are required');
    const m = /^data:(image\/(png|jpeg|gif|webp));base64,([A-Za-z0-9+/=]+)$/.exec(b.image || '');
    if (!m) return fail(res, 400, 'Image must be a PNG, JPG, GIF or WEBP');
    const bytes = Buffer.from(m[3], 'base64');
    if (bytes.length > 4 * 1024 * 1024) return fail(res, 413, 'Image must be 4 MB or less');

    const image = await pinataUpload(new Blob([bytes], { type: m[1] }), `${symbol}.${m[2] === 'jpeg' ? 'jpg' : m[2]}`);
    if (b.imageOnly) return send(res, 200, { image });   // Pons takes a logo URI, not a metadata file
    const meta = { name, symbol, description: clean(b.description, 1000), image, showName: true, createdOn: 'Vela' };
    for (const k of ['twitter', 'telegram', 'website']) {
      const v = clean(b[k], 200);
      if (v && /^https?:\/\//i.test(v)) meta[k] = v;
    }
    const uri = await pinataUpload(new Blob([JSON.stringify(meta)], { type: 'application/json' }), 'metadata.json');
    send(res, 200, { uri, image });
  },

  'POST /api/pump/create': async (req, res) => {
    const b = await readJson(req);
    if (!B58.test(b.publicKey || '') || !B58.test(b.mint || '')) return fail(res, 400, 'Invalid wallet or mint address');
    if (!POOLS.has(b.pool)) return fail(res, 400, 'Unknown launch site');
    const amount = Number(b.amount);
    if (!(amount >= 0 && amount <= 1000)) return fail(res, 400, 'Dev buy must be between 0 and 1000 SOL');
    const uri = clean(b.uri, 300);
    if (!/^https:\/\//.test(uri)) return fail(res, 400, 'Metadata URI missing');

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
     Vela launches to, with live market data, busiest first. */
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

  if (rel === '/') rel = '/index.html';
  if (!PUBLIC.has(rel) && !/^\/img\/[a-z]+\.png$/.test(rel)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('404 — nothing here');
    return;
  }
  fs.readFile(path.join(ROOT, rel), (err, body) => {
    if (err) { res.writeHead(err.code === 'ENOENT' ? 404 : 500).end(err.code === 'ENOENT' ? 'Not found' : 'Read error'); return; }
    const headers = { 'content-type': TYPES[path.extname(rel)] || 'application/octet-stream' };
    if (rel.startsWith('/vendor/')) headers['cache-control'] = 'public, max-age=31536000, immutable';
    else if (rel.startsWith('/img/')) headers['cache-control'] = 'public, max-age=86400';
    res.writeHead(200, headers);
    res.end(body);
  });
}).listen(PORT, () => console.log(`Vela on http://localhost:${PORT}`));
