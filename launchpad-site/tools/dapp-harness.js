/* Browser test of the dapp page against a fake Solana wallet and a fake server.
   The fake server keeps an in-memory copy of the Sol Bite program state (raises,
   paid accounts, pool) and answers the same API the real server exposes
   (/api/config, /api/coins, /api/coins/ix/*, /api/feed, /api/rpc, gifts, auth…).
   The fake window.solana (Phantom-shaped) signs messages and "sends"
   transactions; the page's flows are exercised end to end: connect, create a
   coin, buy, cap handling, finalize, claim, swap, gift cards paid in SOL,
   sign-in, comments. Usage: node dapp-harness.js <dir with index.html or launchpad.html> <outDir>
   Needs playwright and @solana/web3.js (node_modules). */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Keypair, PublicKey } = require('@solana/web3.js');

const DIR = process.argv[2], OUT = process.argv[3];
const PAGE_FILE = ['launchpad.html', 'index.html'].map((f) => path.join(DIR, f)).find((f) => fs.existsSync(f));
let page = fs.readFileSync(PAGE_FILE, 'utf8');
page = page.replace('https://cdn.jsdelivr.net/npm/@solana/web3.js@1.95.3/lib/index.iife.min.js', '/solana-web3.iife.js');

const PID = 'GuN42keYrbBSgthwZJgw8oEEc4QCzzCnaSQdsQZut2Ub';
const ME = Keypair.generate().publicKey.toBase58();
const MER = Keypair.generate().publicKey.toBase58();
const MCDX = 'XsqE9cRRpzxcGKDXj1BJ7Xmg4GRhZoyY1KpmGSxAWT2';   // McDonald's xStock (Token-2022, 8 decimals)
const USDC = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
const SUPPLY = 1_000_000_000n * 1_000_000n;
const chain = { lamports: 3n * 10n ** 9n, stock: 5n * 10n ** 8n, raises: [], paid: {}, buys: {}, n: 0, slot: 1000 };
const now = () => Math.floor(Date.now() / 1000);
const pk = (s) => new PublicKey(s);
const pda = (seeds) => PublicKey.findProgramAddressSync(seeds, pk(PID))[0].toBase58();
const sig = () => { chain.n++; const b = Buffer.alloc(64); b[0] = 9; b.writeUInt32BE(chain.n, 60); return b58(b); };
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58(bytes) { let n = 0n; for (const b of bytes) n = (n << 8n) + BigInt(b); let out = ''; while (n > 0n) { out = B58[Number(n % 58n)] + out; n /= 58n; } for (const b of bytes) { if (b === 0) out = '1' + out; else break; } return out; }
const ixJson = (tag, keys) => ({ programId: PID, keys: keys.map(([p, s, w]) => ({ pubkey: p, isSigner: Boolean(s), isWritable: Boolean(w) })), data: Buffer.from([tag]).toString('base64') });
const view = (r) => ({ ...r, target: String(r.target), raised: String(r.raised), min: String(r.min), cap: String(r.cap), poolCoin: String(r.poolCoin), poolPay: String(r.poolPay), claimedTotal: String(r.claimedTotal) });
const paidKey = (raise, who) => raise + ':' + who;
function pushBuy(r, who, amount) { (chain.buys[r.address] ||= []).push({ sig: sig(), kind: 'buy', who, amount: String(amount), total: String(r.raised), ts: Date.now(), slot: ++chain.slot }); }

/* program logic mirrored from contracts/solana/src/lib.rs (the parts the page exercises) */
function create(q) {
  const target = BigInt(q.get('target')); const payMint = q.get('payMint') === 'SOL' ? null : q.get('payMint'); const coinMint = q.get('coinMint');
  const address = pda([Buffer.from('raise'), pk(coinMint).toBuffer()]);
  const r = { address, bump: 255, creator: q.get('wallet'), coinMint, payMint, payDecimals: payMint ? 8 : 9, payIs2022: q.get('pay2022') === '1', name: q.get('name'), symbol: q.get('symbol'), restaurant: q.get('restaurant'),
    target, raised: 0n, min: target / 3n, cap: target / 10n, openAt: now(), closeAt: now() + Number(q.get('duration')), closedAt: 0, finalized: false, graduated: false, buyers: 0, poolCoin: 0n, poolPay: 0n, claimedTotal: 0n };
  chain.raises.push(r);
  return ixJson(1, [[q.get('wallet'), 1, 1], [address, 0, 1], [coinMint, 1, 1]]);
}
function buy(r, who, amount) {
  if (r.closedAt || r.finalized) throw new Error('closed');
  const k = paidKey(r.address, who); const p = chain.paid[k] || { amount: 0n, claimed: false };
  let a = amount; const room = r.target - r.raised; const wroom = r.cap - p.amount; if (a > wroom) a = wroom; if (a > room) a = room; if (a <= 0n) throw new Error('cap');
  if (p.amount === 0n) r.buyers++; p.amount += a; chain.paid[k] = p; r.raised += a; if (r.payMint) chain.stock -= a; else chain.lamports -= a;
  pushBuy(r, who, a); if (r.raised >= r.target) r.closedAt = now();
  return ixJson(2, [[who, 1, 1], [r.address, 0, 1]]);
}
function finalize(r, who) {
  if (r.finalized) throw new Error('done'); if (!r.closedAt && now() < r.closeAt) throw new Error('open');
  r.finalized = true; if (!r.closedAt) r.closedAt = now(); r.graduated = r.raised >= r.min;
  if (r.graduated) { const fee = r.raised / 100n; r.poolPay = (r.raised - fee) * 2000n / 10000n; r.poolCoin = SUPPLY * 2000n / 10000n; }
  return ixJson(3, [[who, 1, 0], [r.address, 0, 1]]);
}
function claim(r, who) { const p = chain.paid[paidKey(r.address, who)]; if (!p || p.claimed || !r.graduated) throw new Error('nothing'); p.claimed = true; r.claimedTotal += SUPPLY * 8000n / 10000n * p.amount / r.raised; return ixJson(4, [[who, 1, 1], [r.address, 0, 1]]); }
function swap(r, who, amountIn, coinToPay) {
  if (!r.graduated) throw new Error('no pool'); const feeIn = amountIn - amountIn / 100n;
  if (coinToPay) { const out = r.poolPay * feeIn / (r.poolCoin + feeIn); r.poolCoin += amountIn; r.poolPay -= out; } else { const out = r.poolCoin * feeIn / (r.poolPay + feeIn); r.poolPay += amountIn; r.poolCoin -= out; if (r.payMint) chain.stock -= amountIn; else chain.lamports -= amountIn; }
  (chain.buys[r.address] ||= []).push({ sig: sig(), kind: 'swap', who, amount: String(amountIn), total: null, ts: Date.now(), slot: ++chain.slot });
  return ixJson(6, [[who, 1, 1], [r.address, 0, 1]]);
}
function rpc(body) {
  const { method, params } = body; const ctx = { context: { slot: chain.slot } };
  switch (method) {
    case 'getLatestBlockhash': return { ...ctx, value: { blockhash: '11111111111111111111111111111111', lastValidBlockHeight: chain.slot + 150 } };
    case 'getBlockHeight': case 'getSlot': return chain.slot;
    case 'getSignatureStatuses': return { ...ctx, value: params[0].map(() => ({ slot: chain.slot, confirmations: 1, err: null, confirmationStatus: 'confirmed' })) };
    case 'getBalance': return { ...ctx, value: Number(chain.lamports) };
    case 'getParsedTokenAccountsByOwner': { const is2022 = params[1] && params[1].programId === 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'; return { ...ctx, value: is2022 ? [{ pubkey: ME, account: { data: { parsed: { info: { mint: MCDX, tokenAmount: { uiAmount: Number(chain.stock) / 1e8, amount: String(chain.stock), decimals: 8 } } } } } }] : [] }; }
    case 'getAccountInfo': return { ...ctx, value: null };
    default: throw new Error('unsupported rpc ' + method);
  }
}

const SHIM = `<script>
(function () {
  const ME = '${ME}'; let PK = null; const listeners = {}; let n = 0;
  const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const b58 = (bytes) => { let v = 0n; for (const b of bytes) v = (v << 8n) + BigInt(b); let out = ''; while (v > 0n) { out = B58[Number(v % 58n)] + out; v /= 58n; } for (const b of bytes) { if (b === 0) out = '1' + out; else break; } return out; };
  const sig = () => { const b = new Uint8Array(64); n++; b[63] = n & 255; b[62] = (n >> 8) & 255; b[0] = 7; return b; };
  window.__sent = [];
  window.solana = {
    isPhantom: true, isConnected: false, publicKey: null,
    on(ev, fn) { (listeners[ev] ||= []).push(fn); }, off() {}, removeListener() {},
    async connect() { PK = new solanaWeb3.PublicKey(ME); this.publicKey = PK; this.isConnected = true; return { publicKey: PK }; },
    async disconnect() { this.isConnected = false; this.publicKey = null; },
    async signMessage(msg) { return { signature: sig(), publicKey: PK }; },
    async signAndSendTransaction(tx) { const ixs = tx.instructions.map((ix) => ({ programId: ix.programId.toBase58(), tag: ix.data[0], keys: ix.keys.map((k) => k.pubkey.toBase58()) })); window.__sent.push(ixs); const r = await fetch('/__sent', { method: 'POST', body: JSON.stringify(ixs) }); return { signature: b58(sig()) }; },
    async signTransaction(tx) { return tx; }
  };
})();
</script>`;

const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>[hidden]{display:none!important}body{margin:0}</style><script src="/solana-web3.iife.js"></script>${SHIM}</head><body>${page.replace('<script src="/solana-web3.iife.js"></script>', '')}</body></html>`;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://h'); const u = decodeURIComponent(url.pathname); const q = url.searchParams;
  const out = (code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
  if (u === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(html); }
  if (u === '/solana-web3.iife.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(fs.readFileSync([path.join(__dirname, 'solana-web3.iife.js'), path.join(__dirname, '..', 'node_modules', '@solana', 'web3.js', 'lib', 'index.iife.min.js')].find((f) => fs.existsSync(f)))); }
  if (u === '/__sent' || u === '/__close') { let b = ''; req.on('data', (c) => b += c); req.on('end', () => { if (u === '/__close') { const r = chain.raises[0]; r.raised = r.target; r.closedAt = now(); } out(200, { ok: true }); }); return; }
  if (u.startsWith('/api/')) {
    const mk = (o) => ({ id: o.id, rid: o.rid, productId: o.productId, name: o.rid, value: o.value, currency: 'USD', faceUsd: o.value, priceUsd: Math.ceil(o.value * (o.pay.method === 'wallet' ? 1.02 : 1.04) * 100) / 100, margin: o.pay.method === 'wallet' ? 0.02 : 0.04, discount: o.pay.method === 'wallet' ? 0.02 : 0, deliverAt: o.deliverAt || null, forMe: Boolean(o.forMe), ref: o.ref || null, status: o.status, error: null, createdAt: o.createdAt, recipient: { email: o.email, message: o.message || '' }, buyer: { address: null }, pay: o.pay, redemption: o.status === 'delivered' ? { code: '6032-1234-5678-9012', pin: '4321', instructions: 'Redeem at starbucks.com/card', link: 'https://www.bitrefill.com/x' } : null, emailSent: o.status === 'delivered' });
    global.__orders ||= {}; global.__comments ||= [];
    let m;
    if (u === '/api/config') return out(200, { chain: 'solana', paths: false, cluster: 'devnet', clusters: { 'mainnet-beta': { programId: null, usdc: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' }, devnet: { programId: PID, usdc: USDC } }, rpc: '/api/rpc', merchant: MER, social: { x: 'https://x.com/solbite' } });
    if (u === '/api/rpc') { let b = ''; req.on('data', (c) => b += c); req.on('end', () => { const j = JSON.parse(b); const one = (r) => { try { return { jsonrpc: '2.0', id: r.id, result: rpc(r) }; } catch (e) { return { jsonrpc: '2.0', id: r.id, error: { code: -32601, message: e.message } }; } }; out(200, Array.isArray(j) ? j.map(one) : one(j)); }); return; }
    if (u === '/api/coins') return out(200, { cluster: 'devnet', programId: PID, feeTo: MER, now: Date.now(), coins: chain.raises.map(view) });
    if ((m = /^\/api\/coins\/([1-9A-HJ-NP-Za-km-z]{32,44})$/.exec(u))) { const r = chain.raises.find((x) => x.address === m[1]); if (!r) return out(404, { error: 'no such coin' }); const p = q.get('buyer') ? chain.paid[paidKey(r.address, q.get('buyer'))] : null; return out(200, { coin: view(r), paid: p ? { amount: String(p.amount), claimed: p.claimed } : null }); }
    if ((m = /^\/api\/coins\/([1-9A-HJ-NP-Za-km-z]{32,44})\/buys$/.exec(u))) return out(200, { items: [...(chain.buys[m[1]] || [])].reverse() });
    if (u === '/api/feed') { const items = []; for (const r of chain.raises) for (const b of chain.buys[r.address] || []) if (b.kind === 'buy') items.push({ ...b, raise: r.address, symbol: r.symbol }); items.sort((a, b) => b.ts - a.ts || b.slot - a.slot); return out(200, { cluster: 'devnet', items: items.slice(0, Number(q.get('limit')) || 50) }); }
    if (u === '/api/buys') { const items = []; for (const r of chain.raises) for (const b of chain.buys[r.address] || []) if (b.kind === 'buy' && b.who === q.get('wallet')) items.push({ ...b, raise: r.address, symbol: r.symbol }); return out(200, { items }); }
    if ((m = /^\/api\/coins\/ix\/(create|buy|finalize|claim|refund|swap)$/.exec(u))) {
      try {
        if (m[1] === 'create') return out(200, { ix: create(q) });
        const r = chain.raises.find((x) => x.address === q.get('raise')); if (!r) return out(404, { error: 'no such coin' }); const who = q.get('wallet');
        if (m[1] === 'buy') return out(200, { ix: buy(r, who, BigInt(q.get('amount'))) });
        if (m[1] === 'finalize') return out(200, { ix: finalize(r, who) });
        if (m[1] === 'claim') return out(200, { ix: claim(r, who) });
        if (m[1] === 'swap') return out(200, { ix: swap(r, who, BigInt(q.get('amountIn')), q.get('coinToPay') === '1'), quote: '0', minOut: '0' });
        return out(400, { error: 'refund not simulated' });
      } catch (e) { return out(400, { error: e.message }); }
    }
    if (u === '/api/pool') { const r = chain.raises.find((x) => x.address === q.get('raise')); if (!r || !r.graduated) return out(200, { graduated: false }); const coin = Number(r.poolCoin) / 1e6, pay = Number(r.poolPay) / 10 ** r.payDecimals; const price = pay / coin; return out(200, { graduated: true, pair: r.address, price, unit: r.payMint ? null : 'SOL', payToken: r.payMint, liquidity: pay, marketCap: price * 1e9, token: r.coinMint, symbol: r.symbol, points: [[Date.now() - 60000, price * 0.9], [Date.now(), price]] }); }
    if (u === '/api/prices') return out(200, { solana: { usd: 150, usd_24h_change: 2.5 }, 'mcdonalds-xstock': { usd: 300, usd_24h_change: -0.4 } });
    if (u === '/api/gifts/catalog') return out(200, { supply: true, configured: true, methods: { wallet: true, crypto: true, card: true }, margin: 0.04, walletDiscount: 0.02, refShare: 0.25, countries: ['US', 'CA'], merchant: MER, email: true, products: [['starbucks', 'starbucks-usa', [10, 25, 50, 100], 'US', 'USD'], ['chipotle', 'chipotle-usa', null, 'US', 'USD'], ['burgerking', 'burger-king-usa', null, 'US', 'USD'], ['timhortons', 'tim-hortons-canada', null, 'CA', 'CAD']].map(([rid, id, packages, country, currency]) => ({ rid, id, name: rid, country, currency, min: 5, max: 250, step: 1, packages, inStock: true, available: true })) });
    if (u === '/api/gifts/preview') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end('<h2>preview</h2>'); }
    if (u === '/api/status') return out(200, { brand: 'Sol Bite', time: Date.now(), uptimeSec: 3600, supply: true, methods: { wallet: true, crypto: true, card: false }, email: true, chains: { 'mainnet-beta': { block: 300000000, factory: null, ok: true }, devnet: { block: chain.slot, factory: PID, ok: true } }, cluster: 'devnet', ordersDelivered: 2, ordersPending: 0, lastDelivered: [{ rid: 'starbucks', value: 25, currency: 'USD', at: Date.now(), method: 'wallet' }], alerts: 1, subscribers: 3 });
    if (u === '/api/news') return out(200, { items: [{ title: 'McDonald\'s opens 500 new stores', link: 'https://example.com/news', at: Date.now() - 3600000, source: 'Example News' }] });
    if (u === '/api/alerts/count') return out(200, { count: 1 });
    if (u === '/api/me/referrals') return out(200, { address: ME, share: 0.25, orders: 2, delivered: 1, earnedUsd: 0.25, paidUsd: 0, pendingUsd: 0.25, payouts: [], recent: [], link: 'http://x.test/gifts?ref=' + ME });
    if (req.method === 'GET' && u.startsWith('/api/comments/')) return out(200, { comments: global.__comments });
    if (u === '/api/gifts/currencies') return out(200, { currencies: [{ code: 'btc', name: 'Bitcoin' }, { code: 'eth', name: 'Ethereum' }, { code: 'sol', name: 'Solana' }] });
    if (u === '/api/catalog') return out(200, { overrides: { mcdonalds: { blurb: 'Big Mac since 1967' } } });
    let b = ''; req.on('data', (c) => b += c); req.on('end', () => { const j = b ? JSON.parse(b) : {}; let m;
      if (u === '/api/gifts/checkout') { const id = (Object.keys(global.__orders).length + 1).toString(16).padStart(24, 'a'); const price = Math.ceil(j.value * 1.04 * 100) / 100;
        const pay = j.method === 'wallet' ? { method: 'wallet', merchant: MER, cluster: 'devnet', reference: Keypair.generate().publicKey.toBase58(), payUrl: `solana:${MER}?amount=0.17&reference=x&label=Sol%20Bite`, amounts: { SOL: { amount: 0.17, lamports: '170000000' }, USDC: { amount: price, units: String(Math.round(price * 1e6)) } }, expiresAt: Date.now() + 900000 } : j.method === 'crypto' ? { method: 'crypto', provider: 'nowpayments', payAddress: 'bc1qharnessaddress000', payAmount: 0.00042, payCurrency: j.currency || 'btc', network: 'btc', expiresAt: Date.now() + 1200000, providerStatus: 'waiting' } : { method: 'card', provider: 'stripe', url: 'https://checkout.stripe.com/c/pay/cs_test' };
        global.__orders[id] = { id, rid: j.productId.replace('-usa', '').replace('burger-king', 'burgerking'), productId: j.productId, value: j.value, email: j.email, message: j.message, status: 'pending', createdAt: Date.now(), pay, polls: 0, deliverAt: j.deliverAt ? new Date(j.deliverAt).getTime() : null, forMe: Boolean(j.forMe), ref: j.ref || null }; return out(201, mk(global.__orders[id])); }
      if ((m = /^\/api\/gifts\/orders\/([a-f0-9]{24})\/tx$/.exec(u))) { const o = global.__orders[m[1]]; if (!o) return out(404, { error: 'no' }); if (!/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(j.signature || '')) return out(400, { error: 'bad signature' }); o.status = 'delivered'; o.pay = { ...o.pay, token: 'SOL', signature: j.signature }; return out(200, mk(o)); }
      if ((m = /^\/api\/gifts\/orders\/([a-f0-9]{24})\/claim$/.exec(u))) { const o = global.__orders[m[1]]; return o ? out(200, mk(o)) : out(404, { error: 'no' }); }
      if ((m = /^\/api\/gifts\/orders\/([a-f0-9]{24})$/.exec(u))) { const o = global.__orders[m[1]]; if (!o) return out(404, { error: 'no' }); if (o.status === 'pending' && o.pay.method === 'crypto') { o.polls++; if (o.polls >= 2) o.status = 'delivered'; else o.pay.providerStatus = 'confirming'; } return out(200, mk(o)); }
      if (u.startsWith('/api/comments/')) { if (!req.headers.authorization) return out(401, { error: 'sign in' }); const c = { id: 'c1', address: ME, text: j.text, at: Date.now() }; global.__comments.push(c); return out(201, c); }
      if (u === '/api/alerts') return out(201, { ok: true, id: 'a1', willEmail: true });
      if (u === '/api/newsletter') return out(201, { ok: true });
      if (u === '/api/support') return out(201, { ok: true, id: 's1' });
      if (u === '/api/auth/nonce') return out(200, { message: 'Sol Bite\n\nSign in with this wallet: ' + j.address });
      if (u === '/api/auth/verify') { if (!/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(j.signature || '')) return out(400, { error: 'bad signature' }); return out(200, { token: 'harness-token-00000000000000', address: j.address }); }
      if (u === '/api/me/orders') return out(200, { address: ME, orders: Object.values(global.__orders).map(mk) });
      out(404, { error: 'no' }); });
    return;
  }
  const f = path.join(DIR, u);
  if (f.startsWith(DIR) && fs.existsSync(f) && fs.statSync(f).isFile()) { res.writeHead(200, { 'content-type': 'image/png' }); return res.end(fs.readFileSync(f)); }
  res.writeHead(404); res.end();
});

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  const pg = await browser.newPage({ viewport: { width: 1380, height: 900 } });
  const errors = []; global.__pg = pg; global.__errors = errors;
  pg.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  pg.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404') && !m.text().includes('429') && !m.text().includes('coingecko') && !m.text().includes('ERR_FAILED')) errors.push('console: ' + m.text()); });
  await pg.goto(base);
  await pg.waitForTimeout(800);
  const R = {};
  R.emptyBoard = await pg.locator('#rows').textContent();
  R.brand = await pg.evaluate(() => document.title);
  await pg.locator('#connect').click();
  await pg.waitForFunction(() => !document.querySelector('#player').hidden, null, { timeout: 8000 });
  R.addr = await pg.locator('#p-addr').textContent();
  R.cash = await pg.locator('#p-cash').textContent();
  // create a coin (launch view) paired with McDonald's xStock
  await pg.evaluate(() => { location.hash = '#launch'; }); await pg.waitForTimeout(300);
  await pg.locator('#c-name').fill('Golden Arches Club');
  await pg.locator('#c-tick').fill('arches');
  await pg.locator('#c-rest').selectOption('mcdonalds');
  await pg.locator('#c-goal').fill('1');
  await pg.locator('#c-go').click();
  await pg.waitForFunction(() => document.querySelectorAll('#rows .row').length === 1, null, { timeout: 15000 });
  await pg.locator('.side [data-tab="trending"]').click();
  R.created = await pg.evaluate(() => { const r = document.querySelector('#rows .row'); return { id: r.dataset.id, name: r.querySelector('.row-name b').textContent, small: r.querySelector('.row-name small').textContent, tag: r.querySelector('.tag').textContent }; });
  R.createTx = await pg.evaluate(() => window.__sent[0].map((ix) => ix.tag + '@' + ix.programId.slice(0, 4)));
  // buy 0.05 then try over the cap (cap = 0.1)
  await pg.locator('#rows .row:not(.rcard) .row-img').first().click();
  await pg.waitForSelector('#amt');
  R.needsApprove = await pg.locator('[data-approve]').count();
  await pg.locator('#amt').fill('0.05');
  await pg.locator('[data-buy]').click();
  await pg.waitForFunction(() => document.querySelector('#rows .row .you')?.textContent.includes('0.05'), null, { timeout: 15000 });
  R.afterBuy = { you: await pg.locator('#rows .row .you').textContent(), cash: await pg.locator('#p-cash').textContent(), small: await pg.locator('#rows .row .row-name small').textContent() };
  await pg.locator('#amt').fill('0.5');   // over the per-wallet cap: the program clips to 0.05 more
  await pg.locator('[data-buy]').click();
  await pg.waitForFunction(() => document.querySelector('#rows .row .you')?.textContent.includes('0.1'), null, { timeout: 15000 });
  R.afterCap = { you: await pg.locator('#rows .row .you').textContent(), cash: await pg.locator('#p-cash').textContent() };
  R.cartN = await pg.locator('#cart-n').textContent();
  await pg.waitForFunction(() => document.querySelectorAll('#act .buy-r').length === 2, null, { timeout: 15000 });
  R.activity = { buys: await pg.locator('#act .buy-r').count(), chart: await pg.locator('#act svg.chart').count(), first: await pg.locator('#act .buy-r').first().textContent() };
  await pg.locator('#amt').fill('0.02'); await pg.waitForTimeout(100);
  R.sim = await pg.locator('#sim').textContent();
  R.shareBtn = await pg.locator('[data-share]').count();
  R.alertBox = await pg.locator('.alert-box').count(); await pg.locator('#aemail').fill('watch@example.com'); await pg.locator('[data-alert]').click(); await pg.waitForFunction(() => document.querySelector('#toast').classList.contains('is-on'), null, { timeout: 5000 }); R.alertToast = await pg.locator('#toast').textContent();
  R.commentsBox = await pg.locator('#comments').count();
  R.explorerLinks = await pg.evaluate(() => [...document.querySelectorAll('#drawer a[href*="solscan.io"]')].length);
  await pg.screenshot({ path: path.join(OUT, 'shot-drawer.png') });
  R.hash = await pg.evaluate(() => location.hash);
  await pg.waitForFunction(() => !document.querySelector('#feed').hidden, null, { timeout: 15000 });
  R.feed = { items: await pg.locator('#feed-s .feed-c').first().locator('.feed-i').count(), text: await pg.locator('#feed-s .feed-i').first().textContent() };
  await pg.keyboard.press('Escape');
  await pg.waitForTimeout(200);
  R.hashClosed = await pg.evaluate(() => location.hash);
  // deep link reopens the coin; address search (solscan URL) opens it too
  await pg.evaluate((h) => { location.hash = h; }, R.hash);
  await pg.waitForFunction(() => document.querySelector('#drawer').classList.contains('is-open'), null, { timeout: 5000 });
  R.deepLink = await pg.locator('#drawer .who b').textContent();
  await pg.keyboard.press('Escape');
  await pg.locator('#q').fill('https://solscan.io/account/' + R.created.id + '?cluster=devnet');
  await pg.waitForFunction(() => document.querySelector('#drawer').classList.contains('is-open'), null, { timeout: 5000 });
  R.addrSearch = await pg.locator('#drawer .who b').textContent();
  await pg.keyboard.press('Escape');
  await pg.locator('#q').fill('');
  await pg.locator('#q').fill(MCDX);
  await pg.waitForFunction(() => document.querySelector('#drawer .who b')?.textContent.includes("McDonald"), null, { timeout: 5000 });
  R.stockSearch = await pg.locator('#drawer .who b').textContent();
  await pg.keyboard.press('Escape');
  await pg.locator('#q').fill('');
  await pg.evaluate(() => { location.hash = '#calendar'; }); await pg.waitForTimeout(500); R.calendar = await pg.locator('#cal-body .cal-row').count();
  await pg.evaluate(() => { location.hash = '#leaderboard'; }); await pg.waitForTimeout(800); R.leaderboard = { coins: await pg.locator('#lb-body .lb-col').first().locator('.lb-row').count(), buyers: await pg.locator('#lb-body .lb-col').nth(1).locator('.lb-row').count() }; await pg.screenshot({ path: path.join(OUT, 'shot-leaderboard.png') });
  await pg.locator('#lb-body .lb-row').first().click(); await pg.waitForSelector('[data-profile]'); await pg.locator('#drawer [data-profile]').click(); await pg.waitForTimeout(600); R.profile = { visible: await pg.evaluate(() => !document.querySelector('#profile').hidden), created: await pg.locator('#profile-body .lb-col').first().locator('.lb-row').count(), hash: await pg.evaluate(() => location.hash) }; await pg.screenshot({ path: path.join(OUT, 'shot-profile.png') });
  await pg.evaluate(() => { location.hash = '#status'; }); await pg.waitForTimeout(600); R.status = { tiles: await pg.locator('.st-tile').count(), last: await pg.locator('.st-row').count(), text: await pg.locator('#status-body').textContent() };
  await pg.evaluate(() => { location.hash = '#help'; }); await pg.waitForTimeout(300); await pg.locator('#support-form [name="email"]').fill('me@example.com'); await pg.locator('#support-form [name="message"]').fill('Where is my card? Order a1b2'); await pg.locator('#support-form button').click(); await pg.waitForFunction(() => /Sent/.test(document.querySelector('#support-note').textContent), null, { timeout: 5000 }); R.support = await pg.locator('#support-note').textContent();
  await pg.locator('#nl-email').fill('news@example.com'); await pg.locator('#nl-go').click(); await pg.waitForFunction(() => /Subscribed/.test(document.querySelector('#nl-note').textContent), null, { timeout: 5000 }); R.newsletter = await pg.locator('#nl-note').textContent();
  await pg.evaluate(() => { location.hash = '#r/mcdonalds'; }); await pg.waitForSelector('#news .news a', { timeout: 5000 }); R.news = await pg.locator('#news .news a b').first().textContent(); await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
  await pg.evaluate(() => { location.hash = '#pairs'; }); await pg.waitForTimeout(300);
  R.pairs = { n: await pg.locator('#pairs-list .pair').count(), label: await pg.locator('#pairs-n').textContent(), first: await pg.locator('#pairs-list .pair').first().textContent(), status: await pg.locator('#contracts').textContent() };
  await pg.evaluate(() => window.scrollTo(0, 0)); await pg.waitForTimeout(400); await pg.screenshot({ path: path.join(OUT, 'shot-cover.png') });
  await pg.evaluate(() => { location.hash = '#pairs'; }); await pg.waitForTimeout(400); await pg.screenshot({ path: path.join(OUT, 'shot-pairs.png') });
  await pg.evaluate(() => { location.hash = '#coins'; }); await pg.waitForTimeout(300);
  R.icons = await pg.locator('.cats .ic img').count();
  R.mark = await pg.locator('.brand .mark').count();
  // force close (fake program: raised = target) then finalize, claim, swap
  await pg.evaluate(() => fetch('/__close', { method: 'POST', body: '{}' }));
  await pg.keyboard.press('Escape');
  await pg.waitForTimeout(300);
  await pg.locator('#refresh').click();
  await pg.waitForTimeout(500);
  await pg.locator('#rows .row:not(.rcard) .row-img').first().click();
  await pg.waitForFunction(() => document.querySelector('[data-finalize]'), null, { timeout: 15000 });
  await pg.keyboard.press('Escape');
  await pg.waitForTimeout(300);
  await pg.locator('.side [data-tab="graduated"]').click();
  await pg.waitForSelector('#rows .row .tag');
  R.pendingTag = await pg.locator('#rows .row .tag').textContent();
  await pg.locator('#rows .row:not(.rcard) .row-img').first().click();
  await pg.waitForSelector('[data-finalize]');
  await pg.locator('[data-finalize]').click();
  await pg.waitForFunction(() => document.querySelector('[data-claim]'), null, { timeout: 15000 });
  R.claimBtn = await pg.locator('[data-claim]').textContent();
  await pg.waitForSelector('#pool .pool', { timeout: 5000 }); R.pool = await pg.locator('#pool .pool').textContent();
  await pg.locator('[data-claim]').click();
  await pg.waitForFunction(() => !document.querySelector('[data-claim]'), null, { timeout: 15000 });
  await pg.waitForSelector('#swap-amt', { timeout: 5000 }); await pg.locator('#swap-amt').fill('0.01'); await pg.locator('[data-swap]').first().click();
  await pg.waitForFunction(() => /Swapped|swap/i.test(document.querySelector('#toast').textContent), null, { timeout: 15000 }); R.swapToast = await pg.locator('#toast').textContent();
  R.sentKinds = await pg.evaluate(() => window.__sent.map((ixs) => ixs.map((ix) => ix.tag).join('+')));
  await pg.keyboard.press('Escape');
  await pg.waitForTimeout(300);
  await pg.locator('.side [data-tab="graduated"]').click();
  await pg.waitForSelector('#rows .row .tag');
  R.graduatedTag = await pg.locator('#rows .row .tag').textContent();
  await pg.screenshot({ path: path.join(OUT, 'dapp.png') });
  await pg.evaluate(() => { location.hash = '#home'; }); await pg.waitForTimeout(300);
  // gift card bought on the site: amount -> recipient -> wallet -> SOL payment -> code
  R.giftInSite = await pg.locator('#gift-rail .gift .cta.in').count();
  await pg.locator('#gift-rail .gift[data-open="g:starbucks"]').click();
  await pg.waitForSelector('[data-gamt="25"]');
  await pg.locator('[data-gamt="25"]').click();
  await pg.locator('#gemail').fill('friend@example.com'); await pg.locator('#gmsg').fill('Enjoy!');
  await pg.locator('[data-gm="wallet"]').click();
  R.giftSum = await pg.locator('.gs-sum').textContent();
  R.giftPreview = await pg.locator('a[href^="/api/gifts/preview"]').count();
  await pg.locator('[data-gwhen="later"]').click(); await pg.waitForSelector('#gdate'); const tomorrow = new Date(Date.now() + 86400000); await pg.locator('#gdate').fill(tomorrow.toISOString().slice(0, 16)); R.giftWhen = await pg.locator('#gdate').inputValue();
  await pg.locator('[data-gnext]').click();
  await pg.waitForSelector('[data-gpay="SOL"]', { timeout: 10000 });
  R.giftPending = await pg.locator('.gs-stat').first().textContent();
  R.giftQr = await pg.locator('#gqr img, #gqr canvas').count();
  await pg.locator('[data-gpay="SOL"]').click();
  await pg.waitForSelector('.code b', { timeout: 20000 });
  R.giftCode = await pg.locator('.code b').textContent();
  R.giftScheduled = await pg.evaluate(() => /scheduled for/.test(document.querySelector('#drawer').textContent));
  await pg.screenshot({ path: path.join(OUT, 'shot-gift.png') });
  R.giftHash = await pg.evaluate(() => location.hash);
  R.giftSaved = await pg.evaluate(() => JSON.parse(localStorage.getItem('bento.gifts') || '[]').length);
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
  // any crypto: address + QR, then provider confirms
  await pg.locator('#gift-rail .gift[data-open="g:chipotle"]').click();
  await pg.waitForSelector('#gcustom'); await pg.locator('#gcustom').fill('40'); await pg.locator('#gcustom').dispatchEvent('change');
  await pg.locator('#gemail').fill('me@example.com'); await pg.locator('[data-gm="crypto"]').click(); await pg.waitForSelector('#gcur'); await pg.locator('#gcur').selectOption('eth');
  await pg.locator('[data-gnext]').click();
  await pg.waitForSelector('.gs-crypto .addr', { timeout: 10000 });
  R.cryptoPay = { addr: await pg.locator('.gs-crypto .addr').textContent(), amt: await pg.locator('.gs-crypto .amt').textContent(), qr: await pg.locator('#gqr img, #gqr canvas').count() };
  await pg.screenshot({ path: path.join(OUT, 'shot-crypto.png') });
  await pg.waitForSelector('.code b', { timeout: 20000 });
  R.cryptoDelivered = await pg.locator('.gs-stat.delivered').count();
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
  // account sheet: sign in with the wallet (ed25519 message), list orders
  await pg.locator('.side [data-open="a:"]').click(); await pg.waitForSelector('[data-acct-sign]');
  await pg.locator('[data-acct-sign]').click(); await pg.waitForSelector('.gs-list [data-gorder]', { timeout: 10000 });
  R.account = { orders: await pg.locator('.gs-list [data-gorder]').count(), hash: await pg.evaluate(() => location.hash) };
  await pg.waitForSelector('.ref-box', { timeout: 5000 }); R.referral = await pg.locator('.ref-box input').inputValue();
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
  await pg.evaluate(() => { location.hash = '#gifts'; }); await pg.waitForTimeout(400); R.countries = { chips: await pg.locator('#gift-countries button').count(), all: await pg.locator('#gift-grid .gift').count() }; await pg.locator('#gift-countries [data-country="CA"]').click(); await pg.waitForTimeout(200); R.countries.ca = await pg.locator('#gift-grid .gift').count(); await pg.locator('#gift-countries [data-country="all"]').click();
  await pg.locator('#gift-grid .gift[data-open="g:starbucks"]').click(); await pg.waitForSelector('#gforme'); R.forMe = await pg.locator('#gforme').count(); await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
  await pg.locator('.side [data-tab="graduated"]').click(); await pg.locator('#rows .row:not(.rcard) .row-img').first().click(); await pg.waitForSelector('#ctext', { timeout: 5000 }); await pg.locator('#ctext').fill('Great coin, LFG'); await pg.locator('[data-cpost]').click(); await pg.waitForSelector('.cm', { timeout: 5000 }); R.comment = await pg.locator('.cm p').first().textContent(); await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
  await pg.locator('.side [data-open="a:"]').click(); await pg.waitForSelector('.gs-list [data-gorder]');
  await pg.screenshot({ path: path.join(OUT, 'shot-account.png') });
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
  await pg.evaluate(() => { location.hash = '#docs'; }); await pg.waitForTimeout(300);
  R.faq = await pg.locator('#faq-list details').count();
  R.views = await pg.evaluate(() => ({ docs: !document.querySelector('#docs').hidden, home: document.querySelector('#explore').hidden, title: document.title }));
  await pg.evaluate(() => { location.hash = '#home'; }); await pg.waitForTimeout(300);
  await pg.evaluate(() => { location.hash = '#r/mcdonalds'; }); await pg.waitForTimeout(400);
  R.override = await pg.evaluate(() => document.body.innerHTML.includes('Big Mac since 1967'));
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
  await pg.evaluate(() => { location.hash = '#coins'; }); await pg.waitForTimeout(300);
  await pg.locator('[data-lang="zh"]').click();
  await pg.waitForTimeout(100);
  R.zhTag = await pg.locator('#rows .row .tag').textContent();
  await pg.setViewportSize({ width: 390, height: 844 });
  await pg.waitForTimeout(150);
  R.hScroll = await pg.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  await pg.evaluate(() => window.scrollTo(0, 0)); await pg.waitForTimeout(300); await pg.screenshot({ path: path.join(OUT, 'shot-phone.png') });
  R.mbar = { visible: await pg.locator('#mbar').isVisible(), bottomBar: await pg.evaluate(() => getComputedStyle(document.querySelector('#bottom')).bottom) };
  await pg.locator('#mbar [data-mb="create"]').click();
  await pg.waitForTimeout(600);
  R.mbarCreate = await pg.evaluate(() => !document.querySelector('#launch').hidden && document.querySelector('#explore').hidden);
  await pg.screenshot({ path: path.join(OUT, 'dapp-phone.png') });
  await pg.setViewportSize({ width: 1380, height: 900 });
  R.residue = await pg.evaluate(() => (document.body.innerText.match(/\b(BNB|Bento|BentoFactory|MetaMask|BscScan)\b/g) || []).slice(0, 10));
  R.errors = errors;
  console.log(JSON.stringify(R, null, 1));
  await browser.close(); server.close();
})().catch(async (e) => { console.error('HARNESS FAIL', e); try { const pg = global.__pg; if (pg) { console.error('ERRORS', JSON.stringify(global.__errors)); console.error('SENT', JSON.stringify(await pg.evaluate(() => window.__sent))); console.error('ACT', await pg.evaluate(() => (document.querySelector('#act') || {}).outerHTML?.slice(0, 600))); console.error('DRAWER', await pg.evaluate(() => document.querySelector('#drawer').className + ' ' + location.hash + ' | ' + document.querySelector('#drawer').innerHTML.slice(0, 300))); console.error('ROWS', await pg.evaluate(() => document.querySelector('#rows').innerHTML.slice(0, 400))); console.error('TOAST', await pg.evaluate(() => document.querySelector('#toast').textContent)); } } catch (x) { console.error(x); } process.exit(1); });
