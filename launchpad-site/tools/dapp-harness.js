/* Browser test of the dapp page against a fake BNB Chain wallet and a fake server.
   The fake server keeps an in-memory copy of the KuaiFactory state (raises, paid
   amounts, pool) and answers the same API the real server exposes (/api/config,
   /api/coins, /api/coins/ix/*, /api/feed, /api/rpc, gifts, auth…). The fake
   window.ethereum (MetaMask-shaped) answers JSON-RPC through the same fake
   chain, signs messages and "sends" the calldata the server prepared; the page's
   flows are exercised end to end: connect, create a coin, buy, cap handling,
   finalize, claim, swap, gift cards paid in BNB, sign-in, comments.
   Usage: node dapp-harness.js <dir with index.html or launchpad.html> <outDir>
   Needs playwright and ethers (node_modules). */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const DIR = process.argv[2], OUT = process.argv[3];
const PAGE_FILE = ['launchpad.html', 'index.html'].map((f) => path.join(DIR, f)).find((f) => fs.existsSync(f));
let page = fs.readFileSync(PAGE_FILE, 'utf8');
page = page.replace('https://cdnjs.cloudflare.com/ajax/libs/ethers/6.13.4/ethers.umd.min.js', '/ethers.umd.min.js');
page = page.replace("const DEFAULT_CHAIN = '56';", "const DEFAULT_CHAIN = '97';");

const ME = '0x1111111111111111111111111111111111111111';
const MER = '0x00000000000000000000000000000000000000aa';
const FACTORY = '0x000000000000000000000000000000000000fac7';
const MCDX = '0x80a77a372c1e12accda84299492f404902e2da67';   // McDonald's xStock on BNB Chain
const USDT = '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd';
const WEI = 10n ** 18n;
const SUPPLY = 1_000_000_000n * WEI;
const STAKING = '0x00000000000000000000000000000000000057a1'; const KUAI = '0x000000000000000000000000000000000000c0de';
const stk = { balance: 1000n * WEI, staked: 0n, total: 5000n * WEI, pending: WEI / 20n, pool: WEI / 50n, fees: WEI / 10n, paid: 0n, burned: 12345n * WEI };
const profs = {};
const chain = { bnb: 3n * WEI, raises: [], paid: {}, buys: {}, n: 0, block: 1000, txs: {}, sent: [] };
const now = () => Math.floor(Date.now() / 1000);
const hex = (n) => '0x' + BigInt(n).toString(16);
const txHash = () => '0x' + (++chain.n).toString(16).padStart(64, '0');
const paidKey = (raise, who) => raise.toLowerCase() + ':' + who.toLowerCase();
const TAG = { create: '0x01', buy: '0x02', finalize: '0x03', claim: '0x04', refund: '0x05', swap: '0x06', approve: '0x07', cashout: '0x08' };
const calls = (kind, to, value = 0n) => [{ to, data: TAG[kind], value: value.toString() }];
const view = (r) => ({ address: r.address, creator: r.creator, coinMint: r.coinMint, payMint: r.payMint, payDecimals: 18, paySymbol: 'tBNB', name: r.name, symbol: r.symbol, restaurant: r.restaurant, target: String(r.target), raised: String(r.raised), min: String(r.min), cap: String(r.cap), openAt: r.openAt, closeAt: r.closeAt, closedAt: r.closedAt, finalized: r.finalized, graduated: r.graduated, buyers: r.buyers, poolCoin: String(r.poolCoin), poolPay: String(r.poolPay) });
function pushBuy(r, who, amount) { (chain.buys[r.address] ||= []).push({ sig: txHash(), kind: 'buy', who, amount: String(amount), total: String(r.raised), ts: Date.now(), slot: ++chain.block }); }
function create(q) {
  const i = chain.raises.length + 1; const target = BigInt(q.get('target'));
  const r = { address: '0x' + i.toString(16).padStart(40, '0'), coinMint: '0x' + i.toString(16).padStart(39, '0') + 'e', creator: ME, payMint: null, name: q.get('name'), symbol: q.get('symbol'), restaurant: q.get('restaurant'), target, min: target / 3n, cap: target / 10n, openAt: now(), closeAt: now() + Number(q.get('duration')), raised: 0n, closedAt: 0, finalized: false, graduated: false, buyers: 0, poolCoin: 0n, poolPay: 0n, claimedTotal: 0n };
  chain.raises.push(r); return calls('create', FACTORY);
}
function buy(r, who, amount) {
  if (r.closedAt || r.finalized || now() >= r.closeAt) throw new Error('closed');
  const k = paidKey(r.address, who); const p = chain.paid[k] || (chain.paid[k] = { amount: 0n, claimed: false });
  const room = r.target - r.raised, wroom = r.cap - p.amount; if (amount > wroom) amount = wroom; if (amount > room) amount = room; if (amount <= 0n) throw new Error('cap');
  if (p.amount === 0n) r.buyers++; p.amount += amount; r.raised += amount; chain.bnb -= amount; pushBuy(r, who, amount);
  if (r.raised >= r.target) r.closedAt = now();
  return calls('buy', r.address, amount);
}
function finalize(r) {
  if (r.finalized) throw new Error('done'); if (!r.closedAt && now() < r.closeAt) throw new Error('open');
  r.finalized = true; if (!r.closedAt) r.closedAt = now(); r.graduated = r.raised >= r.min;
  if (r.graduated) { r.poolCoin = SUPPLY * 2000n / 10000n; r.poolPay = r.raised - r.raised / 100n; }
  return calls('finalize', r.address);
}
function claim(r, who) { const p = chain.paid[paidKey(r.address, who)]; if (!p || p.claimed || !r.graduated) throw new Error('nothing'); p.claimed = true; r.claimedTotal += SUPPLY * 8000n / 10000n * p.amount / r.raised; return calls('claim', r.address); }
function swap(r, who, amountIn, coinToPay) {
  if (!r.graduated) throw new Error('no pool'); const feeIn = amountIn - amountIn / 400n;
  if (coinToPay) { const out = r.poolPay * feeIn / (r.poolCoin + feeIn); r.poolCoin += amountIn; r.poolPay -= out; } else { const out = r.poolCoin * feeIn / (r.poolPay + feeIn); r.poolPay += amountIn; r.poolCoin -= out; chain.bnb -= amountIn; }
  (chain.buys[r.address] ||= []).push({ sig: txHash(), kind: 'swap', who, amount: String(amountIn), total: null, ts: Date.now(), slot: ++chain.block });
  return calls('swap', r.address, coinToPay ? 0n : amountIn);
}
function sendTx(p) {
  const h = txHash(); chain.block++; if (p.value) chain.bnb -= BigInt(p.value); chain.sent.push({ to: p.to, data: p.data || '0x', value: p.value || '0x0' });
  chain.txs[h] = { hash: h, to: p.to, from: ME, data: p.data || '0x', input: p.data || '0x', value: p.value || '0x0', blockNumber: hex(chain.block), blockHash: '0x' + '11'.repeat(32), nonce: hex(chain.n), gas: hex(500000), gasPrice: hex(3000000000), transactionIndex: '0x0', type: '0x0', chainId: '0x61', v: '0x0', r: '0x0', s: '0x0' };
  return h;
}
function rpc(body) {
  const { method, params } = body;
  switch (method) {
    case 'eth_chainId': return '0x61';
    case 'net_version': return '97';
    case 'eth_accounts': case 'eth_requestAccounts': return [ME];
    case 'eth_blockNumber': return hex(chain.block);
    case 'eth_getBalance': return hex(chain.bnb);
    case 'eth_gasPrice': case 'eth_maxPriorityFeePerGas': return hex(3000000000);
    case 'eth_estimateGas': return hex(500000);
    case 'eth_getTransactionCount': return hex(chain.n);
    case 'eth_feeHistory': return { baseFeePerGas: [hex(3000000000)], gasUsedRatio: [0.5], oldestBlock: hex(chain.block) };
    case 'eth_getBlockByNumber': return { number: hex(chain.block), hash: '0x' + '11'.repeat(32), parentHash: '0x' + '22'.repeat(32), timestamp: hex(now()), gasLimit: hex(30000000), gasUsed: hex(0), baseFeePerGas: hex(3000000000), miner: ME, nonce: '0x0000000000000000', difficulty: '0x0', extraData: '0x', transactions: [] };
    case 'eth_getLogs': return [];
    case 'eth_call': return '0x';
    case 'eth_sendTransaction': return sendTx(params[0]);
    case 'eth_getTransactionByHash': return chain.txs[params[0]] || null;
    case 'eth_getTransactionReceipt': { const tx = chain.txs[params[0]]; if (!tx) return null; return { transactionHash: tx.hash, blockNumber: tx.blockNumber, blockHash: tx.blockHash, from: ME, to: tx.to, status: '0x1', logs: [], gasUsed: hex(21000), cumulativeGasUsed: hex(21000), effectiveGasPrice: hex(3000000000), logsBloom: '0x' + '00'.repeat(256), transactionIndex: '0x0', type: '0x0', contractAddress: null }; }
    default: throw new Error('unsupported rpc ' + method);
  }
}

/* MetaMask-shaped wallet: everything stateful goes through the fake chain on the server. */
const SHIM = `<script>
(function () {
  const ME = '${ME}'; const listeners = {}; let id = 0; window.__sent = []; let chainId = '0x61';
  const remote = async (method, params) => { const r = await fetch('/api/rpc', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }) }); const j = await r.json(); if (j.error) { const e = new Error(j.error.message); e.code = j.error.code; throw e; } return j.result; };
  window.ethereum = {
    isMetaMask: true,
    on(ev, fn) { (listeners[ev] ||= []).push(fn); }, removeListener() {},
    async request({ method, params }) {
      switch (method) {
        case 'eth_chainId': return chainId;
        case 'eth_requestAccounts': case 'eth_accounts': return [ME];
        case 'personal_sign': return '0x' + 'ab'.repeat(65);
        case 'wallet_switchEthereumChain': chainId = params[0].chainId; (listeners.chainChanged || []).forEach((f) => f(chainId)); return null;
        case 'eth_sendTransaction': window.__sent.push({ to: params[0].to, data: params[0].data || '0x', value: params[0].value || '0x0' }); return remote(method, params);
        default: return remote(method, params);
      }
    }
  };
})();
</script>`;

const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>[hidden]{display:none!important}body{margin:0}</style><script src="/ethers.umd.min.js"></script>${SHIM}</head><body>${page.replace('<script src="/ethers.umd.min.js"></script>', '')}</body></html>`;
const ADDR = '0x[0-9a-fA-F]{40}';
const isHash = (s) => /^0x[0-9a-fA-F]{64}$/.test(s || '');

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://h'); const u = decodeURIComponent(url.pathname); const q = url.searchParams;
  const out = (code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
  if (u === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(html); }
  if (u === '/ethers.umd.min.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(fs.readFileSync(path.join(__dirname, '..', 'node_modules', 'ethers', 'dist', 'ethers.umd.min.js'))); }
  if (u === '/__close') { const r = chain.raises[0]; r.raised = r.target; r.closedAt = now(); return out(200, { ok: true }); }
  if (u === '/__sent') return out(200, chain.sent);
  if (u.startsWith('/api/')) {
    const mk = (o) => ({ id: o.id, rid: o.rid, productId: o.productId, name: o.rid, value: o.value, currency: 'USD', faceUsd: o.value, priceUsd: Math.ceil(o.value * (o.pay.method === 'wallet' ? 1.02 : 1.04) * 100) / 100, margin: o.pay.method === 'wallet' ? 0.02 : 0.04, discount: o.pay.method === 'wallet' ? 0.02 : 0, deliverAt: o.deliverAt || null, forMe: Boolean(o.forMe), ref: o.ref || null, status: o.status, error: null, createdAt: o.createdAt, recipient: { email: o.email, message: o.message || '' }, buyer: { address: null }, pay: o.pay, redemption: o.status === 'delivered' ? { code: '6032-1234-5678-9012', pin: '4321', instructions: 'Redeem at starbucks.com/card', link: 'https://www.bitrefill.com/x' } : null, emailSent: o.status === 'delivered' });
    global.__orders ||= {}; global.__comments ||= [];
    let m;
    if (u === '/api/config') return out(200, { chain: 'bnb', paths: false, cluster: '97', clusters: { 56: { programId: null, usdt: '0x55d398326f99059fF775485246999027B3197955' }, 97: { programId: FACTORY, usdt: USDT } }, rpc: '/api/rpc', merchant: MER, social: { x: 'https://x.com/kuai' } });
    if (u === '/api/rpc') { let b = ''; req.on('data', (c) => b += c); req.on('end', () => { const j = JSON.parse(b); const one = (r) => { try { return { jsonrpc: '2.0', id: r.id, result: rpc(r) }; } catch (e) { return { jsonrpc: '2.0', id: r.id, error: { code: -32601, message: e.message } }; } }; out(200, Array.isArray(j) ? j.map(one) : one(j)); }); return; }
    if (u === '/api/coins') return out(200, { cluster: '97', programId: FACTORY, feeTo: MER, now: Date.now(), coins: chain.raises.map(view) });
    if ((m = new RegExp(`^/api/coins/(${ADDR})$`).exec(u))) { const r = chain.raises.find((x) => x.address === m[1].toLowerCase()); if (!r) return out(404, { error: 'no such coin' }); const p = q.get('buyer') ? chain.paid[paidKey(r.address, q.get('buyer'))] : null; return out(200, { coin: view(r), paid: p ? { amount: String(p.amount), claimed: p.claimed, claimable: p.claimed || !r.graduated ? '0' : String(SUPPLY * 8000n / 10000n * p.amount / r.raised), allowance: null, balance: null } : null }); }
    if ((m = new RegExp(`^/api/coins/(${ADDR})/buys$`).exec(u))) return out(200, { items: [...(chain.buys[m[1].toLowerCase()] || [])].reverse() });
    if (u === '/api/feed') { const items = []; for (const r of chain.raises) for (const b of chain.buys[r.address] || []) if (b.kind === 'buy') items.push({ ...b, raise: r.address, symbol: r.symbol }); items.sort((a, b) => b.ts - a.ts || b.slot - a.slot); return out(200, { cluster: '97', items: items.slice(0, Number(q.get('limit')) || 50) }); }
    if (u === '/api/buys') { const items = []; for (const r of chain.raises) for (const b of chain.buys[r.address] || []) if (b.kind === 'buy' && b.who.toLowerCase() === String(q.get('wallet')).toLowerCase()) items.push({ ...b, raise: r.address, symbol: r.symbol }); return out(items.length || true ? 200 : 200, { items }); }
    if ((m = /^\/api\/coins\/ix\/(create|approve|buy|finalize|claim|refund|swap|cashout)$/.exec(u))) {
      try {
        if (m[1] === 'create') return out(200, { calls: create(q) });
        const r = chain.raises.find((x) => x.address === String(q.get('raise')).toLowerCase()); if (!r) return out(404, { error: 'no such coin' }); const who = q.get('wallet');
        if (m[1] === 'buy') return out(200, { calls: buy(r, who, BigInt(q.get('amount'))) });
        if (m[1] === 'approve') return out(200, { calls: calls('approve', MCDX) });
        if (m[1] === 'finalize') return out(200, { calls: finalize(r) });
        if (m[1] === 'claim') return out(200, { calls: claim(r, who) });
        if (m[1] === 'cashout') { if (!r.graduated) return out(400, { error: 'no pool' }); const outWei = BigInt(q.get('outWei')); chain.bnb += outWei; return out(200, { calls: [{ to: r.coinMint, data: TAG.approve, value: '0' }, { to: '0x' + 'ab'.repeat(20), data: TAG.cashout, value: '0' }], amountIn: '1000', maxIn: '1030' }); }
        if (m[1] === 'swap') return out(200, { calls: swap(r, who, BigInt(q.get('amountIn')), q.get('coinToPay') === '1'), quote: '0', minOut: '0' });
        return out(400, { error: 'refund not simulated' });
      } catch (e) { return out(400, { error: e.message }); }
    }
    if (u === '/api/pool') { const r = chain.raises.find((x) => x.address === String(q.get('raise')).toLowerCase()); if (!r || !r.graduated) return out(200, { graduated: false }); const coin = Number(r.poolCoin) / 1e18, pay = Number(r.poolPay) / 1e18; const price = pay / coin; return out(200, { graduated: true, pair: '0x' + 'ab'.repeat(20), price, unit: 'tBNB', payToken: r.payMint, liquidity: pay, marketCap: price * 1e9, token: r.coinMint, symbol: r.symbol, points: [[Date.now() - 60000, price * 0.9], [Date.now(), price]] }); }
    if (u === '/api/prices') return out(200, { binancecoin: { usd: 600, usd_24h_change: 2.5 }, 'mcdonald-s-xstock': { usd: 300, usd_24h_change: -0.4 } });
    if (u === '/api/gifts/catalog') return out(200, { supply: true, configured: true, methods: { wallet: true, crypto: true, card: true }, margin: 0.04, walletDiscount: 0.02, refShare: 0.25, countries: ['US', 'CA'], merchant: MER, email: true, products: [['starbucks', 'starbucks-usa', [10, 25, 50, 100], 'US', 'USD'], ['chipotle', 'chipotle-usa', null, 'US', 'USD'], ['burgerking', 'burger-king-usa', null, 'US', 'USD'], ['timhortons', 'tim-hortons-canada', null, 'CA', 'CAD']].map(([rid, id, packages, country, currency]) => ({ rid, id, name: rid, country, currency, min: 5, max: 250, step: 1, packages, inStock: true, available: true })) });
    if (u === '/api/gifts/preview') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end('<h2>preview</h2>'); }
    if (u === '/api/status') return out(200, { brand: 'kuai', time: Date.now(), uptimeSec: 3600, supply: true, methods: { wallet: true, crypto: true, card: false }, email: true, chains: { 56: { block: 45000000, factory: null, ok: true }, 97: { block: chain.block, factory: FACTORY, ok: true } }, cluster: '97', ordersDelivered: 2, ordersPending: 0, lastDelivered: [{ rid: 'starbucks', value: 25, currency: 'USD', at: Date.now(), method: 'wallet' }], alerts: 1, subscribers: 3 });
    if (u === '/api/news') return out(200, { items: [{ title: 'McDonald\'s opens 500 new stores', link: 'https://example.com/news', at: Date.now() - 3600000, source: 'Example News' }] });
    if (u === '/api/alerts/count') return out(200, { count: 1 });
    if (u === '/api/me/referrals') return out(200, { address: ME, share: 0.25, orders: 2, delivered: 1, earnedUsd: 0.25, paidUsd: 0, pendingUsd: 0.25, payouts: [], recent: [], link: 'http://x.test/gifts?ref=' + ME });
    if (req.method === 'GET' && u.startsWith('/api/comments/')) return out(200, { comments: global.__comments });
    if (u === '/api/gifts/currencies') return out(200, { currencies: [{ code: 'btc', name: 'Bitcoin' }, { code: 'eth', name: 'Ethereum' }, { code: 'bnbbsc', name: 'BNB' }] });
    if (u === '/api/stake') { const k = String(q.get('wallet') || '').toLowerCase(); return out(200, { cluster: '97', staking: STAKING, stakerBps: 7000, payout: 'tBNB', deployed: true, token: KUAI, tokenSymbol: 'KUAI', tokenDecimals: 18, owner: MER, totalStaked: String(stk.total), rewardReserve: String(stk.pending), buybackPool: String(stk.pool), unaccounted: '0', lifetimeFees: String(stk.fees), lifetimePaid: String(stk.paid), lifetimeBurned: String(stk.burned), waiting: '0', lifetimeBuyback: '0', you: k === ME.toLowerCase() ? { staked: String(stk.staked), pending: String(stk.pending), balance: String(stk.balance), allowance: '0' } : null }); }
    if ((m = /^\/api\/stake\/ix\/(approve|stake|unstake|claim)$/.exec(u))) { const a = BigInt(q.get('amount') || '0');
      if (m[1] === 'stake') { if (a <= 0n || a > stk.balance) return out(400, { error: 'amount' }); stk.balance -= a; stk.staked += a; stk.total += a; return out(200, { calls: [{ to: KUAI, data: '0x0a', value: '0' }, { to: STAKING, data: '0x0b', value: '0' }] }); }
      if (m[1] === 'unstake') { if (a <= 0n || a > stk.staked) return out(400, { error: 'amount' }); stk.balance += a; stk.staked -= a; stk.total -= a; return out(200, { calls: [{ to: STAKING, data: '0x0c', value: '0' }] }); }
      if (m[1] === 'claim') { chain.bnb += stk.pending; stk.paid += stk.pending; stk.pending = 0n; return out(200, { calls: [{ to: STAKING, data: '0x0d', value: '0' }] }); }
      return out(400, { error: 'no' }); }
    if (u === '/api/profiles') return out(200, { profiles: Object.fromEntries(Object.entries(profs).map(([k, v]) => [k, { name: v.name, avatar: v.avatar }])) });
    if ((m = /^\/api\/profile\/(0x[0-9a-fA-F]{40})$/.exec(u))) { const v = profs[m[1].toLowerCase()]; return out(200, v ? { address: m[1], ...v } : { address: m[1], name: null, thesis: '', avatar: null, updates: [] }); }
    if (u === '/api/catalog') return out(200, { overrides: { mcdonalds: { blurb: 'Big Mac since 1967' } } });
    let b = ''; req.on('data', (c) => b += c); req.on('end', () => { const j = b ? JSON.parse(b) : {}; let m;
      if (u === '/api/gifts/checkout') { const id = (Object.keys(global.__orders).length + 1).toString(16).padStart(24, 'a'); const price = Math.ceil(j.value * 1.04 * 100) / 100;
        const pay = j.method === 'wallet' ? { method: 'wallet', merchant: MER, cluster: '97', payUrl: `ethereum:${MER}@97?value=170000000000000000`, amounts: { BNB: { amount: 0.17, wei: '170000000000000000' }, USDT: { amount: price, wei: String(BigInt(Math.round(price * 100)) * 10n ** 16n) } }, expiresAt: Date.now() + 900000 } : j.method === 'crypto' ? { method: 'crypto', provider: 'nowpayments', payAddress: 'bc1qharnessaddress000', payAmount: 0.00042, payCurrency: j.currency || 'btc', network: 'btc', expiresAt: Date.now() + 1200000, providerStatus: 'waiting' } : { method: 'card', provider: 'stripe', url: 'https://checkout.stripe.com/c/pay/cs_test' };
        global.__orders[id] = { id, rid: j.productId.replace('-usa', '').replace('burger-king', 'burgerking'), productId: j.productId, value: j.value, email: j.email, message: j.message, status: 'pending', createdAt: Date.now(), pay, polls: 0, deliverAt: j.deliverAt ? new Date(j.deliverAt).getTime() : null, forMe: Boolean(j.forMe), ref: j.ref || null }; return out(201, mk(global.__orders[id])); }
      if ((m = /^\/api\/gifts\/orders\/([a-f0-9]{24})\/tx$/.exec(u))) { const o = global.__orders[m[1]]; if (!o) return out(404, { error: 'no' }); if (!isHash(j.txHash)) return out(400, { error: 'bad tx hash' }); o.status = 'delivered'; o.pay = { ...o.pay, token: 'BNB', txHash: j.txHash }; return out(200, mk(o)); }
      if ((m = /^\/api\/gifts\/orders\/([a-f0-9]{24})\/claim$/.exec(u))) { const o = global.__orders[m[1]]; return o ? out(200, mk(o)) : out(404, { error: 'no' }); }
      if ((m = /^\/api\/gifts\/orders\/([a-f0-9]{24})$/.exec(u))) { const o = global.__orders[m[1]]; if (!o) return out(404, { error: 'no' }); if (o.status === 'pending' && o.pay.method === 'crypto') { o.polls++; if (o.polls >= 2) o.status = 'delivered'; else o.pay.providerStatus = 'confirming'; } return out(200, mk(o)); }
      if (u.startsWith('/api/comments/')) { if (!req.headers.authorization) return out(401, { error: 'sign in' }); const c = { id: 'c1', address: ME, text: j.text, at: Date.now() }; global.__comments.push(c); return out(201, c); }
      if (u === '/api/alerts') return out(201, { ok: true, id: 'a1', willEmail: true });
      if (u === '/api/newsletter') return out(201, { ok: true });
      if (u === '/api/support') return out(201, { ok: true, id: 's1' });
      if (u === '/api/auth/nonce') return out(200, { message: 'kuai\n\nSign in with this wallet: ' + j.address });
      if (u === '/api/auth/verify') { if (!/^0x[0-9a-f]{130}$/i.test(j.signature || '')) return out(400, { error: 'bad signature' }); return out(200, { token: 'harness-token-00000000000000', address: j.address }); }
      if (u === '/api/me/profile' || u === '/api/me/updates') { if (!req.headers.authorization) return out(401, { error: 'sign in' }); const k = ME.toLowerCase(); const v = (profs[k] ||= { name: null, thesis: '', avatar: null, updates: [] });
        if (u === '/api/me/profile') { if (j.name !== undefined) v.name = j.name || null; if (j.thesis !== undefined) v.thesis = j.thesis; if (j.avatar !== undefined) v.avatar = j.avatar ? 'data:' + 'x' : null; } else v.updates.unshift({ id: 'u' + (v.updates.length + 1).toString(16).padStart(15, '0'), text: j.text, at: Date.now() });
        return out(u === '/api/me/updates' ? 201 : 200, { address: ME, ...v }); }
      if (u === '/api/me/orders') return out(200, { address: ME, orders: Object.values(global.__orders).map(mk) });
      out(404, { error: 'no' }); });
    return;
  }
  const f = path.join(DIR, u);
  if (f.startsWith(DIR) && fs.existsSync(f) && fs.statSync(f).isFile()) { res.writeHead(200, { 'content-type': u.endsWith('.webp') ? 'image/webp' : 'image/png' }); return res.end(fs.readFileSync(f)); }
  res.writeHead(404); res.end();
});
(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
  const pg = await browser.newPage({ viewport: { width: Number(process.env.W || 1380), height: Number(process.env.H || 900) } });
  const errors = []; global.__pg = pg; global.__errors = errors;
  pg.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  pg.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404') && !m.text().includes('429') && !m.text().includes('coingecko') && !m.text().includes('ERR_FAILED')) errors.push('console: ' + m.text()); });
  await pg.goto(base);
  await pg.waitForTimeout(800);
  const R = {};
  R.emptyBoard = await pg.locator('#rows').textContent();
  R.brand = await pg.evaluate(() => document.title);
  R.landing = await pg.evaluate(() => ({ on: document.body.classList.contains('is-landing'), title: document.querySelector('.L-title').textContent.trim(), ctas: document.querySelectorAll('.L-ctas a').length, eye: document.querySelector('#L-eye').textContent, mark: Boolean(document.querySelector('.L-mark svg')), pills: document.querySelectorAll('.L-foot .L-pill').length, nav: [...document.querySelectorAll('.L-nav a')].map((a) => a.textContent).join('|'), ctaTxt: [...document.querySelectorAll('.L-ctas a')].map((a) => a.textContent).join('|'), hdrHidden: getComputedStyle(document.querySelector('.hdr')).display === 'none' }));
  await pg.waitForTimeout(1200); await pg.screenshot({ path: path.join(OUT, 'shot-landing.png') });
  await pg.locator('.L-btn-primary').click();
  await pg.waitForFunction(() => !document.body.classList.contains('is-landing') && !document.querySelector('#dashboard').hidden, null, { timeout: 6000 });
  R.landingTo = await pg.evaluate(() => location.hash); await pg.evaluate(() => { location.hash = '#explore'; }); await pg.waitForFunction(() => !document.querySelector('#explore').hidden, null, { timeout: 6000 });
  R.landingExit = await pg.evaluate(() => ({ hash: location.hash, view: document.querySelector('main').dataset.view }));
  await pg.waitForTimeout(600); R.board = await pg.evaluate(() => ({ tabs: document.querySelectorAll('#board [data-bmode]').length, chips: document.querySelectorAll('#bd-cats button').length, pairs: document.querySelectorAll('#bd-grid .bcard.pair').length, rank: document.querySelectorAll('#srank button').length, rankHead: document.querySelector('#srank-h').textContent, ticker: document.querySelectorAll('#tk button').length, scrollY: window.scrollY, status: document.querySelector('.bd-status').textContent.replace(/\s+/g, ' ').trim() })); await pg.screenshot({ path: path.join(OUT, 'shot-board-empty.png') });
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
  await pg.waitForFunction(() => location.hash === '#coins', null, { timeout: 15000 });
  await pg.evaluate(() => { location.hash = '#explore'; }); await pg.waitForTimeout(500); R.boardCoins = await pg.evaluate(() => ({ cards: document.querySelectorAll('#bd-grid .bcard:not(.pair)').length, first: document.querySelector('#bd-grid .bcard .nm').textContent.trim(), status: document.querySelector('.bd-status').textContent.replace(/\s+/g, ' ').trim() })); await pg.locator('#board [data-bmode="people"]').click(); await pg.waitForTimeout(200); R.boardPeople = await pg.locator('#bd-grid .bcard.person').count(); await pg.locator('#board [data-bmode="coins"]').click(); await pg.locator('.side [data-stab="new"]').click(); await pg.waitForTimeout(200); R.sideNew = await pg.locator('#srank button').count(); await pg.screenshot({ path: path.join(OUT, 'shot-board.png') }); await pg.locator('.side [data-stab="stocks"]').click();
  await pg.evaluate(() => { location.hash = '#coins'; }); await pg.waitForTimeout(400);
  await pg.locator('#coin-tabs [data-tab="trending"]').click();
  R.created = await pg.evaluate(() => { const r = document.querySelector('#rows .row'); return { id: r.dataset.id, name: r.querySelector('.row-name b').textContent, small: r.querySelector('.row-name small').textContent, tag: r.querySelector('.tag').textContent }; });
  R.createTx = await pg.evaluate(() => window.__sent[0].data + '@' + window.__sent[0].to.slice(-4));
  // dashboard: one card per restaurant; buy 0.02 of the live McDonald's coin from its card
  await pg.evaluate(() => { location.hash = '#dashboard'; }); await pg.waitForSelector('#dash-body .dcard', { timeout: 8000 });
  R.dashboard = await pg.evaluate(() => ({ cards: document.querySelectorAll('#dash-body .dcard').length, hero: document.querySelector('#dash-body .hero2 h1').textContent, tiles: [...document.querySelectorAll('#dash-body .htiles b')].map((b) => b.textContent), buyBtns: document.querySelectorAll('#dash-body [data-dbuy]').length, active: document.querySelector('.side a.is-on')?.getAttribute('href') }));
  await pg.locator('[data-damt="mcdonalds"]').fill('0.02'); await pg.locator('[data-dbuy][data-rid="mcdonalds"]').click();
  await pg.waitForFunction(() => /Bought/.test(document.querySelector('#toast').textContent), null, { timeout: 15000 }); R.dashBuy = await pg.locator('#toast').textContent();
  await pg.locator('.dfil [data-dcat="pizza"]').click(); await pg.waitForTimeout(150); R.dashPizza = await pg.locator('#dash-body .dcard').count(); await pg.locator('.dfil [data-dcat="all"]').click();
  R.network = await pg.evaluate(() => ({ calcRows: document.querySelectorAll('#dash-body .nw .tbl')[0]?.querySelectorAll('tbody tr').length || 0, best: document.querySelectorAll('#dash-body .best').length, yours: document.querySelectorAll('#dash-body .nw')[1]?.querySelectorAll('tbody tr').length || 0, sections: document.querySelectorAll('#dash-body .nw').length, note: document.querySelector('#dash-body .dc-note')?.textContent }));
  await pg.locator('[data-nwsize="0.5"]').click(); await pg.waitForTimeout(150); R.network.size05 = await pg.evaluate(() => document.querySelectorAll('#dash-body .nw .tbl')[0]?.querySelector('tbody tr td:nth-child(5)')?.textContent);
  R.exHero = await pg.evaluate(() => { location.hash = '#explore'; return null; }); await pg.waitForTimeout(400); R.exHero = await pg.evaluate(() => ({ h: document.querySelector('#ex-hero .hero2 h1')?.textContent, tiles: document.querySelectorAll('#ex-hero .htiles > div').length })); await pg.evaluate(() => { location.hash = '#dashboard'; }); await pg.waitForTimeout(300);
  await pg.screenshot({ path: path.join(OUT, 'shot-dashboard.png') });
  await pg.evaluate(() => { location.hash = '#coins'; }); await pg.waitForTimeout(300);
  // buy 0.05 then try over the cap (cap = 0.1)
  await pg.locator('#rows .row:not(.rcard) .row-img').first().click();
  await pg.waitForSelector('#amt');
  R.needsApprove = await pg.locator('[data-approve]').count();
  await pg.locator('#amt').fill('0.05');
  await pg.locator('[data-buy]').click();
  await pg.waitForFunction(() => document.querySelector('#rows .row .you')?.textContent.includes('0.07'), null, { timeout: 15000 });
  R.afterBuy = { you: await pg.locator('#rows .row .you').textContent(), cash: await pg.locator('#p-cash').textContent(), small: await pg.locator('#rows .row .row-name small').textContent() };
  await pg.locator('#amt').fill('0.5');   // over the per-wallet cap: the program clips to 0.05 more
  await pg.locator('[data-buy]').click();
  await pg.waitForFunction(() => document.querySelector('#rows .row .you')?.textContent.includes('0.1'), null, { timeout: 15000 });
  R.afterCap = { you: await pg.locator('#rows .row .you').textContent(), cash: await pg.locator('#p-cash').textContent() };
  R.cartN = await pg.locator('#cart-n').textContent();
  await pg.waitForFunction(() => document.querySelectorAll('#act .buy-r').length === 3, null, { timeout: 15000 });
  R.activity = { buys: await pg.locator('#act .buy-r').count(), chart: await pg.locator('#act svg.chart').count(), first: await pg.locator('#act .buy-r').first().textContent() };
  await pg.locator('#amt').fill('0.02'); await pg.waitForTimeout(100);
  R.sim = await pg.locator('#sim').textContent();
  R.shareBtn = await pg.locator('[data-share]').count();
  R.alertBox = await pg.locator('.alert-box').count(); await pg.locator('#aemail').fill('watch@example.com'); await pg.locator('[data-alert]').click(); await pg.waitForFunction(() => document.querySelector('#toast').classList.contains('is-on'), null, { timeout: 5000 }); R.alertToast = await pg.locator('#toast').textContent();
  R.commentsBox = await pg.locator('#comments').count();
  R.explorerLinks = await pg.evaluate(() => [...document.querySelectorAll('#drawer a[href*="bscscan.com"]')].length);
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
  await pg.locator('#q').fill('https://testnet.bscscan.com/address/' + R.created.id);
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
  await pg.locator('#lb-body .lb-row').first().click(); await pg.waitForSelector('#drawer [data-profile]'); await pg.locator('#drawer [data-profile]').click(); await pg.waitForTimeout(600); R.profile = { visible: await pg.evaluate(() => !document.querySelector('#profile').hidden), created: await pg.locator('#profile-body .lb-col').first().locator('.lb-row').count(), hash: await pg.evaluate(() => location.hash) }; await pg.screenshot({ path: path.join(OUT, 'shot-profile.png') });
  await pg.evaluate(() => { location.hash = '#status'; }); await pg.waitForTimeout(600); R.status = { tiles: await pg.locator('.st-tile').count(), last: await pg.locator('.st-row').count(), text: await pg.locator('#status-body').textContent() };
  await pg.evaluate(() => { location.hash = '#help'; }); await pg.waitForTimeout(300); await pg.locator('#support-form [name="email"]').fill('me@example.com'); await pg.locator('#support-form [name="message"]').fill('Where is my card? Order a1b2'); await pg.locator('#support-form button').click(); await pg.waitForFunction(() => /Sent/.test(document.querySelector('#support-note').textContent), null, { timeout: 5000 }); R.support = await pg.locator('#support-note').textContent();
  await pg.locator('#nl-email').fill('news@example.com'); await pg.locator('#nl-go').click(); await pg.waitForFunction(() => /Subscribed/.test(document.querySelector('#nl-note').textContent), null, { timeout: 5000 }); R.newsletter = await pg.locator('#nl-note').textContent();
  await pg.evaluate(() => { location.hash = '#r/mcdonalds'; }); await pg.waitForSelector('#news .news a', { timeout: 5000 }); R.news = await pg.locator('#news .news a b').first().textContent(); await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
  await pg.evaluate(() => { location.hash = '#pairs'; }); await pg.waitForTimeout(300);
  await pg.locator('#pairs-list .pair').first().click(); await pg.waitForSelector('#drawer .vbox', { timeout: 5000 }); R.verifyBox = { links: await pg.locator('#drawer .vlinks a').count(), text: await pg.locator('#drawer .vbox small').first().textContent(), alt: await pg.locator('#drawer .vbox small a').count() }; await pg.screenshot({ path: path.join(OUT, 'shot-pair-sheet.png') }); await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
  R.pairs = { n: await pg.locator('#pairs-list .pair').count(), label: await pg.locator('#pairs-n').textContent(), first: await pg.locator('#pairs-list .pair').first().textContent(), status: await pg.locator('#contracts').textContent() };
  await pg.evaluate(() => window.scrollTo(0, 0)); await pg.waitForTimeout(400); await pg.screenshot({ path: path.join(OUT, 'shot-cover.png') });
  await pg.evaluate(() => { location.hash = '#pairs'; }); await pg.waitForTimeout(400); await pg.screenshot({ path: path.join(OUT, 'shot-pairs.png') });
  await pg.evaluate(() => { location.hash = '#coins'; }); await pg.waitForTimeout(300);
  R.icons = await pg.locator('.cats .ic img').count();
  R.logos = await pg.evaluate(() => { const im = [...document.querySelectorAll('#rows .row .logo img')]; return { n: im.length, ok: im.filter((i) => i.complete && i.naturalWidth > 0 && /^\/logos\//.test(new URL(i.src).pathname)).length, mono: document.querySelectorAll('#rows .row .logo.is-mono').length }; });
  R.mark = await pg.locator('.brand .mark').count();
  // force close (fake chain: raised = target) then finalize, claim, swap
  await pg.evaluate(() => fetch('/__close'));
  await pg.keyboard.press('Escape');
  await pg.waitForTimeout(300);
  await pg.evaluate(() => document.querySelector('#refresh').click());
  await pg.waitForTimeout(500);
  await pg.locator('#rows .row:not(.rcard) .row-img').first().click();
  await pg.waitForFunction(() => document.querySelector('[data-finalize]'), null, { timeout: 15000 });
  await pg.keyboard.press('Escape');
  await pg.waitForTimeout(300);
  await pg.evaluate(() => { location.hash = '#coins'; }); await pg.waitForTimeout(300); await pg.locator('#coin-tabs [data-tab="graduated"]').click();
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
  R.sentKinds = await pg.evaluate(() => window.__sent.map((c) => c.data));
  await pg.keyboard.press('Escape');
  await pg.waitForTimeout(300);
  await pg.evaluate(() => { location.hash = '#coins'; }); await pg.waitForTimeout(300); await pg.locator('#coin-tabs [data-tab="graduated"]').click();
  await pg.waitForSelector('#rows .row .tag');
  R.graduatedTag = await pg.locator('#rows .row .tag').textContent();
  await pg.screenshot({ path: path.join(OUT, 'dapp.png') });
  await pg.evaluate(() => { location.hash = '#gifts'; }); await pg.waitForTimeout(400);
  // gift card bought on the site: amount -> recipient -> wallet -> BNB payment -> code
  R.giftInSite = await pg.locator('#gift-grid .gift .cta.in').count();
  await pg.locator('#gift-grid .gift[data-open="g:starbucks"]').click();
  await pg.waitForSelector('[data-gamt="25"]');
  await pg.locator('[data-gamt="25"]').click();
  await pg.locator('#gemail').fill('friend@example.com'); await pg.locator('#gmsg').fill('Enjoy!');
  await pg.locator('[data-gm="wallet"]').click();
  R.giftSum = await pg.locator('.gs-sum').textContent();
  R.giftPreview = await pg.locator('a[href^="/api/gifts/preview"]').count();
  await pg.locator('[data-gwhen="later"]').click(); await pg.waitForSelector('#gdate'); const tomorrow = new Date(Date.now() + 86400000); await pg.locator('#gdate').fill(tomorrow.toISOString().slice(0, 16)); R.giftWhen = await pg.locator('#gdate').inputValue();
  await pg.locator('[data-gnext]').click();
  await pg.waitForSelector('[data-gpay="BNB"]', { timeout: 10000 });
  R.giftPending = await pg.locator('.gs-stat').first().textContent();
  R.giftQr = await pg.locator('#gqr img, #gqr canvas').count();
  await pg.locator('[data-gpay="BNB"]').click();
  await pg.waitForSelector('.code b', { timeout: 20000 });
  R.giftCode = await pg.locator('.code b').textContent();
  R.giftScheduled = await pg.evaluate(() => /scheduled for/.test(document.querySelector('#drawer').textContent));
  await pg.screenshot({ path: path.join(OUT, 'shot-gift.png') });
  R.giftHash = await pg.evaluate(() => location.hash);
  R.giftSaved = await pg.evaluate(() => JSON.parse(localStorage.getItem('bento.gifts') || '[]').length);
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
  // any crypto: address + QR, then provider confirms
  await pg.locator('#gift-grid .gift[data-open="g:chipotle"]').click();
  await pg.waitForSelector('#gcustom'); await pg.locator('#gcustom').fill('40'); await pg.locator('#gcustom').dispatchEvent('change');
  await pg.locator('#gemail').fill('me@example.com'); await pg.locator('[data-gm="crypto"]').click(); await pg.waitForSelector('#gcur'); await pg.locator('#gcur').selectOption('eth');
  await pg.locator('[data-gnext]').click();
  await pg.waitForSelector('.gs-crypto .addr', { timeout: 10000 });
  R.cryptoPay = { addr: await pg.locator('.gs-crypto .addr').textContent(), amt: await pg.locator('.gs-crypto .amt').textContent(), qr: await pg.locator('#gqr img, #gqr canvas').count() };
  await pg.screenshot({ path: path.join(OUT, 'shot-crypto.png') });
  await pg.waitForSelector('.code b', { timeout: 20000 });
  R.cryptoDelivered = await pg.locator('.gs-stat.delivered').count();
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
  // pay a gift card with the graduated coin: swap on PancakeSwap (fake) then BNB payment
  await pg.locator('#gift-grid .gift[data-open="g:burgerking"]').click();
  await pg.waitForSelector('#gcustom'); await pg.locator('#gcustom').fill('30'); await pg.locator('#gcustom').dispatchEvent('change');
  await pg.locator('#gemail').fill('me@example.com'); await pg.locator('[data-gm="wallet"]').click(); await pg.locator('[data-gnext]').click();
  await pg.waitForSelector('[data-gpaycoin]', { timeout: 10000 });
  R.coinPay = { options: await pg.locator('#gcoin option').count(), first: await pg.locator('#gcoin option').first().textContent(), onramp: await pg.locator('.gs-crypto, .gs-pay').count() >= 1 && await pg.evaluate(() => Boolean(document.querySelector('#drawer a[href*="testnet-faucet"]'))) };
  const cashBefore = await pg.locator('#p-cash').textContent();
  await pg.locator('[data-gpaycoin]').click();
  await pg.waitForSelector('.code b', { timeout: 20000 });
  R.coinPay.code = await pg.locator('.code b').textContent(); R.coinPay.sent = await pg.evaluate(() => window.__sent.slice(-3).map((c) => c.data)); R.coinPay.cashBefore = cashBefore; R.coinPay.cashAfter = await pg.locator('#p-cash').textContent();
  await pg.screenshot({ path: path.join(OUT, 'shot-gift-coin.png') });
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
  // account sheet: sign in with the wallet (personal_sign), list orders
  await pg.locator('.side [data-open="a:"]').click(); await pg.waitForSelector('[data-acct-sign]');
  await pg.locator('[data-acct-sign]').click(); await pg.waitForSelector('.gs-list [data-gorder]', { timeout: 10000 });
  R.account = { orders: await pg.locator('.gs-list [data-gorder]').count(), hash: await pg.evaluate(() => location.hash) };
  await pg.waitForSelector('.ref-box', { timeout: 5000 }); R.referral = await pg.locator('.ref-box input').inputValue();
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
  // analytics
  await pg.evaluate(() => { location.hash = '#analytics'; }); await pg.waitForSelector('#an-body .tiles', { timeout: 8000 }); await pg.waitForTimeout(600);
  R.analytics = await pg.evaluate(() => ({ h: document.querySelector('#an-body h1').textContent, tiles: [...document.querySelectorAll('#an-body .tiles b')].slice(0, 8).map((b) => b.textContent), acts: document.querySelectorAll('#an-body .act-row[data-open]').length, chart: document.querySelectorAll('#an-body .an-chart svg').length, share: document.querySelectorAll('#an-body .share-row').length }));
  await pg.locator('[data-antab="launches"]').click(); await pg.waitForTimeout(150); R.analytics.launches = await pg.locator('#an-body .g2 .pn').nth(2).locator('.act-row').count();
  await pg.screenshot({ path: path.join(OUT, 'shot-analytics.png') });
  // terminal
  await pg.evaluate(() => { location.hash = '#terminal'; }); await pg.waitForSelector('#tm-body .tbl', { timeout: 8000 });
  R.terminal = await pg.evaluate(() => ({ coinRows: document.querySelectorAll('#tm-body .tbl')[0].querySelectorAll('tbody tr').length, restRows: document.querySelectorAll('#tm-body .tbl')[1].querySelectorAll('tbody tr').length, tiles: document.querySelectorAll('#tm-body .tiles > div').length, splits: document.querySelectorAll('#tm-body .split').length }));
  await pg.locator('#tm-target').fill('20'); await pg.locator('#tm-buy').fill('1'); await pg.waitForTimeout(150); R.terminal.calc = await pg.evaluate(() => [...document.querySelectorAll('#tm-body .calc-out b')].map((b) => b.textContent));
  await pg.screenshot({ path: path.join(OUT, 'shot-terminal.png') });
  // stake: stake 100 $KUAI, claim BNB, unstake everything with MAX
  await pg.evaluate(() => { location.hash = '#stake'; }); await pg.waitForSelector('#stk-body [data-stkgo]', { timeout: 8000 }); await pg.waitForTimeout(400);
  R.stake = { before: await pg.evaluate(() => [...document.querySelectorAll('#stk-body .stk-two b')].map((b) => b.textContent)), ca: await pg.locator('#stk-body .stk-ca .ca span').textContent(), summary: await pg.locator('#stk-body .kv2 > div').count() };
  await pg.locator('#stk-amt').fill('100'); await pg.locator('[data-stkgo]').click();
  await pg.waitForFunction(() => /100/.test(document.querySelector('#stk-body .stk-two b')?.textContent || ''), null, { timeout: 15000 }); R.stake.staked = await pg.locator('#stk-body .stk-two b').first().textContent();
  await pg.locator('[data-stkclaim]').click(); await pg.waitForFunction(() => /0\.0000/.test(document.querySelectorAll('#stk-body .stk-two b')[1]?.textContent || ''), null, { timeout: 15000 }); R.stake.claimed = await pg.locator('#stk-body .stk-two b').nth(1).textContent();
  await pg.locator('[data-stkmode="unstake"]').click(); await pg.locator('[data-stkmax]').click(); R.stake.max = await pg.locator('#stk-amt').inputValue(); await pg.locator('[data-stkgo]').click();
  await pg.waitForFunction(() => /^0 /.test(document.querySelector('#stk-body .stk-two b')?.textContent || ''), null, { timeout: 15000 }); R.stake.after = await pg.locator('#stk-body .stk-two b').first().textContent();
  R.stake.sent = await pg.evaluate(() => window.__sent.slice(-4).map((c) => c.data));
  await pg.screenshot({ path: path.join(OUT, 'shot-stake.png') });
  // profile: the signed-in wallet edits its own profile and posts an update
  await pg.evaluate(() => { location.hash = '#profile'; }); await pg.waitForSelector('#pf-name', { timeout: 8000 });
  await pg.locator('#pf-name').fill('Burger Whale'); await pg.locator('#pf-thesis').fill('Fast food is a hedge.'); await pg.locator('[data-pf-save]').click();
  await pg.waitForFunction(() => document.querySelector('.pf-top h2')?.textContent.includes('Burger Whale'), null, { timeout: 8000 });
  await pg.locator('#pf-upd').fill('Bought more $ARCHES'); await pg.locator('[data-pf-post]').click(); await pg.waitForSelector('.upd p', { timeout: 8000 });
  R.profile2 = await pg.evaluate(() => ({ name: document.querySelector('.pf-top h2').textContent, thesis: document.querySelector('.pf-top .th')?.textContent, upd: document.querySelector('.upd p').textContent, pl: document.querySelectorAll('.pf-grid .tbl tbody tr').length, hash: location.hash }));
  await pg.screenshot({ path: path.join(OUT, 'shot-profile-edit.png') });
  await pg.evaluate(() => { location.hash = '#explore'; }); await pg.waitForTimeout(500); R.boardName = await pg.evaluate(() => document.querySelector('#bd-grid .bc-f .by button')?.textContent);
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
  await pg.evaluate(() => { location.hash = '#gifts'; }); await pg.waitForTimeout(400); R.countries = { chips: await pg.locator('#gift-countries button').count(), all: await pg.locator('#gift-grid .gift').count(), bitrefillLink: await pg.locator('#giftshop .sec-h a.all').count() };
  await pg.locator('#gift-grid .gift[data-open="g:starbucks"]').click(); await pg.waitForSelector('#gforme'); R.forMe = await pg.locator('#gforme').count(); await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
  await pg.evaluate(() => { location.hash = '#coins'; }); await pg.waitForTimeout(300); await pg.locator('#coin-tabs [data-tab="graduated"]').click(); await pg.locator('#rows .row:not(.rcard) .row-img').first().click(); await pg.waitForSelector('#ctext', { timeout: 5000 }); await pg.locator('#ctext').fill('Great coin, LFG'); await pg.locator('[data-cpost]').click(); await pg.waitForSelector('.cm', { timeout: 5000 }); R.comment = await pg.locator('.cm p').first().textContent(); await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
  await pg.locator('.side [data-open="a:"]').click(); await pg.waitForSelector('.gs-list [data-gorder]');
  await pg.screenshot({ path: path.join(OUT, 'shot-account.png') });
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
  await pg.evaluate(() => { location.hash = '#docs'; }); await pg.waitForTimeout(300);
  R.faq = await pg.locator('#faq-list details').count();
  R.views = await pg.evaluate(() => ({ docs: !document.querySelector('#docs').hidden, home: document.querySelector('#explore').hidden, title: document.title }));
  await pg.evaluate(() => { location.hash = '#explore'; }); await pg.waitForTimeout(300);
  await pg.evaluate(() => { location.hash = '#r/mcdonalds'; }); await pg.waitForTimeout(400);
  R.override = await pg.evaluate(() => document.body.innerHTML.includes('Big Mac since 1967'));
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
  await pg.evaluate(() => { location.hash = '#coins'; }); await pg.waitForTimeout(300);
  await pg.locator('#lang2 [data-lang="zh"]').click();
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
  await pg.evaluate(() => { location.hash = '#home'; }); await pg.waitForTimeout(1500); R.landingPhone = await pg.evaluate(() => ({ on: document.body.classList.contains('is-landing'), hScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, title: document.querySelector('.L-title').textContent.trim() })); await pg.screenshot({ path: path.join(OUT, 'shot-landing-phone.png') });
  await pg.locator('.L-nav [data-go="dashboard"]').click(); await pg.waitForFunction(() => !document.querySelector('#dashboard').hidden, null, { timeout: 6000 }); R.landingNav = await pg.evaluate(() => document.querySelector('main').dataset.view);
  await pg.setViewportSize({ width: 1380, height: 900 });
  // docs in the Seam layout and the legal pages
  await pg.evaluate(() => { location.hash = '#docs'; }); await pg.waitForSelector('#docs-body .dz-card', { timeout: 6000 });
  R.docs = await pg.evaluate(() => ({ h: document.querySelector('#docs-body h1').textContent, cards: document.querySelectorAll('#docs-body .dz-card').length, toc: document.querySelectorAll('#docs-body [data-dscroll]').length, fees: document.querySelectorAll('#docs-body .dz-tbl tr').length }));
  await pg.locator('[data-dscroll="dz-fees"]').click(); await pg.waitForTimeout(700); R.docs.scrolled = await pg.evaluate(() => Math.abs(document.getElementById('dz-fees').getBoundingClientRect().top) < 140);
  await pg.screenshot({ path: path.join(OUT, 'shot-docs.png') });
  await pg.locator('.tk-r [data-doc="terms"]').click(); await pg.waitForSelector('#legal-body h1', { timeout: 6000 });
  R.legal = { terms: await pg.evaluate(() => ({ h: document.querySelector('#legal-body h1').textContent, secs: document.querySelectorAll('#legal-body section').length, hash: location.hash, title: document.title, modal: !document.querySelector('#modal').hidden })) };
  await pg.waitForTimeout(1200); await pg.screenshot({ path: path.join(OUT, 'shot-terms.png') });
  await pg.locator('#legal-body .lg-nav [data-doc="privacy"]').click(); await pg.waitForFunction(() => location.hash === '#privacy' && document.querySelectorAll('#legal-body section').length === 7, null, { timeout: 6000 });
  R.legal.privacy = await pg.evaluate(() => ({ h: document.querySelector('#legal-body h1').textContent, secs: document.querySelectorAll('#legal-body section').length, hash: location.hash }));
  await pg.evaluate(() => { location.hash = '#risk'; }); await pg.waitForTimeout(300); R.legal.risk = await pg.evaluate(() => ({ h: document.querySelector('#legal-body h1').textContent, secs: document.querySelectorAll('#legal-body section h2').length }));
  R.ticker = await pg.evaluate(() => ({ pills: document.querySelectorAll('#tk button').length, h: document.querySelector('#bottom').getBoundingClientRect().height, font: getComputedStyle(document.body).fontFamily.split(',')[0] }));
  // every section loads directly from its URL
  R.direct = {}; for (const v of ['dashboard', 'analytics', 'terminal', 'stake', 'profile', 'terms', 'docs']) { const p2 = await browser.newPage({ viewport: { width: 1380, height: 900 } }); const errs2 = []; p2.on('pageerror', (e) => errs2.push(e.message)); await p2.goto(base + '#' + v); await p2.waitForTimeout(900);
    R.direct[v] = await p2.evaluate((v) => { const sec = document.getElementById(v === 'terms' ? 'legal' : v); return { shown: sec && !sec.hidden, heading: (sec && (sec.querySelector('h1') || sec.querySelector('.pf-card b') || sec.querySelector('h2')) || {}).textContent || null }; }, v); R.direct[v].errors = errs2; await p2.close(); }
  R.residue = await pg.evaluate(() => (document.body.innerText.match(/\b(SOL|Solana|Phantom|Solscan|Sol Bite|USDC|Bento)\b/g) || []).slice(0, 10));
  R.errors = errors;
  console.log(JSON.stringify(R, null, 1));
  await browser.close(); server.close();
})().catch(async (e) => { console.error('HARNESS FAIL', e); try { const pg = global.__pg; if (pg) { console.error('ERRORS', JSON.stringify(global.__errors)); console.error('SENT', JSON.stringify(await pg.evaluate(() => window.__sent))); console.error('ACT', await pg.evaluate(() => (document.querySelector('#act') || {}).outerHTML?.slice(0, 600))); console.error('DRAWER', await pg.evaluate(() => document.querySelector('#drawer').className + ' ' + location.hash + ' | ' + document.querySelector('#drawer').innerHTML.slice(0, 300))); console.error('ROWS', await pg.evaluate(() => document.querySelector('#rows').innerHTML.slice(0, 400))); console.error('TOAST', await pg.evaluate(() => document.querySelector('#toast').textContent)); console.error('BTNS', await pg.evaluate(() => [...document.querySelectorAll('#drawer button, #drawer .tag, #drawer .err')].map((b) => b.outerHTML.slice(0, 90)).join(' | '))); } } catch (x) { console.error(x); } process.exit(1); });
