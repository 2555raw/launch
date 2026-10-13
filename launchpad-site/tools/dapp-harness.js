/* Browser test of the dapp page against a fake wallet.
   The fake window.ethereum keeps an in-memory chain: one BentoFactory and the
   raises it creates. It decodes eth_call / eth_sendTransaction with the ABIs
   the page itself uses (ethers is served locally), so the page's contract
   calls are exercised end to end: connect, create a coin, buy, cap handling,
   finalize, claim. Usage: node dapp-harness.js <dir with index.html or launchpad.html> <outDir>
   Needs playwright (npx playwright install chromium) and ethers (node_modules). */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const DIR = process.argv[2], OUT = process.argv[3];
const PAGE_FILE = ['launchpad.html', 'index.html'].map((f) => path.join(DIR, f)).find((f) => fs.existsSync(f));
let page = fs.readFileSync(PAGE_FILE, 'utf8');
page = page.replace('https://cdnjs.cloudflare.com/ajax/libs/ethers/6.13.4/ethers.umd.min.js', '/ethers.umd.min.js');
page = page.replace('const DEFAULT_CHAIN = 56;', 'const DEFAULT_CHAIN = 97;');
// point the testnet factory at a fake address so the page loads the board
page = page.replace("explorer: 'https://testnet.bscscan.com', symbol: 'tBNB', factory: ''", "explorer: 'https://testnet.bscscan.com', symbol: 'tBNB', factory: '0x000000000000000000000000000000000000FAC7'");

const SHIM = `<script>
(function () {
  const ME = '0x1111111111111111111111111111111111111111';
  const FACTORY = '0x000000000000000000000000000000000000fac7';
  const chain = { balance: 3n * 10n ** 18n, raises: [], txs: {}, n: 0, logs: [], id: '0x61' };
  const MERCHANT = '0x00000000000000000000000000000000000000aa'; const USDT = '0x55d398326f99059ff775485246999027b3197955';
  const hex = (n) => '0x' + BigInt(n).toString(16);
  const FABI = ['function createCoin(string name, string symbol, string restaurantId, uint256 target, uint256 durationSeconds) returns (address)', 'function count() view returns (uint256)', 'function all(uint256 from, uint256 n) view returns (address[])', 'function stockOf(string) view returns (address)', 'function enabled(string) view returns (bool)'];
  const EABI = ['function symbol() view returns (string)', 'function decimals() view returns (uint8)', 'function balanceOf(address) view returns (uint256)', 'function allowance(address,address) view returns (uint256)', 'function approve(address,uint256) returns (bool)'];
  const STOCK = '0x80a77a372c1e12accda84299492f404902e2da67'; const stock = { bal: 5n * 10n ** 18n, allow: {} };
  const RABI = ['function info() view returns (address token, address payToken, string name, string symbol, string restaurantId, address creator, uint256 target, uint256 minimum, uint256 cap, uint256 openAt, uint256 closeAt, uint256 raised, uint256 closedAt, uint256 buyers, bool finalized, bool graduated)', 'function buyWith(uint256 amount)', 'function paid(address) view returns (uint256)', 'function claimable(address) view returns (uint256)', 'function claimed(address) view returns (bool)', 'function buy() payable', 'function finalize()', 'function claim()', 'function refund()', 'event Bought(address indexed buyer, uint256 amount, uint256 raised)'];
  let FI, RI, EI;
  const iface = () => { if (!FI) { FI = new ethers.Interface(FABI); RI = new ethers.Interface(RABI); EI = new ethers.Interface(EABI); } };
  const now = () => BigInt(Math.floor(Date.now() / 1000));
  function call(to, data, value) {
    iface();
    to = to.toLowerCase();
    if (to === MERCHANT) { chain.balance -= BigInt(value || 0); return '0x'; }
    if (to === USDT) { return '0x'; }
    if (to === STOCK) {
      const fn = EI.parseTransaction({ data });
      if (fn.name === 'symbol') return EI.encodeFunctionResult('symbol', ['MCDx']);
      if (fn.name === 'decimals') return EI.encodeFunctionResult('decimals', [18]);
      if (fn.name === 'balanceOf') return EI.encodeFunctionResult('balanceOf', [stock.bal]);
      if (fn.name === 'allowance') return EI.encodeFunctionResult('allowance', [stock.allow[fn.args[1].toLowerCase()] || 0n]);
      if (fn.name === 'approve') { stock.allow[fn.args[0].toLowerCase()] = fn.args[1]; return EI.encodeFunctionResult('approve', [true]); }
    }
    if (to === FACTORY) {
      const fn = FI.parseTransaction({ data });
      if (fn.name === 'stockOf') return FI.encodeFunctionResult('stockOf', [fn.args[0] === 'mcdonalds' ? STOCK : ethers.ZeroAddress]);
      if (fn.name === 'enabled') return FI.encodeFunctionResult('enabled', [true]);
      if (fn.name === 'count') return FI.encodeFunctionResult('count', [chain.raises.length]);
      if (fn.name === 'all') return FI.encodeFunctionResult('all', [chain.raises.slice(Number(fn.args[0]), Number(fn.args[0]) + Number(fn.args[1])).map((r) => r.addr)]);
      if (fn.name === 'createCoin') {
        const target = fn.args[3];
        const r = { payToken: fn.args[2] === 'mcdonalds' ? STOCK : ethers.ZeroAddress, addr: '0x' + (chain.raises.length + 1).toString(16).padStart(40, '0'), token: '0x' + (chain.raises.length + 1).toString(16).padStart(39, '0') + 'e', name: fn.args[0], symbol: fn.args[1], rest: fn.args[2], creator: ME,
          target, min: target / 3n, cap: target / 10n, openAt: now(), closeAt: now() + fn.args[4], raised: 0n, closedAt: 0n, buyers: 0, finalized: false, graduated: false, paid: {}, claimed: {} };
        chain.raises.push(r); return FI.encodeFunctionResult('createCoin', [r.addr]);
      }
    }
    const r = chain.raises.find((x) => x.addr === to);
    if (!r) throw new Error('unknown contract ' + to);
    const fn = RI.parseTransaction({ data });
    if (fn.name === 'info') return RI.encodeFunctionResult('info', [r.token, r.payToken, r.name, r.symbol, r.rest, r.creator, r.target, r.min, r.cap, r.openAt, r.closeAt, r.raised, r.closedAt, r.buyers, r.finalized, r.graduated]);
    if (fn.name === 'paid') return RI.encodeFunctionResult('paid', [r.paid[fn.args[0].toLowerCase()] || 0n]);
    if (fn.name === 'claimable') { const p = r.paid[fn.args[0].toLowerCase()] || 0n; const v = (!r.graduated || r.claimed[fn.args[0].toLowerCase()] || r.raised === 0n) ? 0n : (800000000n * 10n ** 18n) * p / r.raised; return RI.encodeFunctionResult('claimable', [v]); }
    if (fn.name === 'claimed') return RI.encodeFunctionResult('claimed', [Boolean(r.claimed[fn.args[0].toLowerCase()])]);
    if (fn.name === 'buy' || fn.name === 'buyWith') {
      if (r.closedAt !== 0n || r.finalized) throw new Error('closed');
      let amount = fn.name === 'buy' ? BigInt(value || 0) : fn.args[0];
      if (fn.name === 'buyWith' && (stock.allow[r.addr] || 0n) < amount) throw new Error('allowance'); const room = r.target - r.raised; const wroom = r.cap - (r.paid[ME.toLowerCase()] || 0n);
      if (amount > wroom) amount = wroom; if (amount > room) amount = room; if (amount <= 0n) throw new Error('cap');
      if (!(r.paid[ME.toLowerCase()] || 0n)) r.buyers++;
      r.paid[ME.toLowerCase()] = (r.paid[ME.toLowerCase()] || 0n) + amount; r.raised += amount; { const ev = RI.encodeEventLog('Bought', [ME, amount, r.raised]); chain.logs.push({ address: r.addr, topics: ev.topics, data: ev.data, blockNumber: hex(101 + chain.n), blockHash: '0x' + '11'.repeat(32), transactionHash: '0x' + (chain.n + 1).toString(16).padStart(64, '0'), transactionIndex: '0x0', logIndex: hex(chain.logs.length), removed: false }); } if (fn.name === 'buy') chain.balance -= amount; else stock.bal -= amount;
      if (r.raised >= r.target) r.closedAt = now();
      return '0x';
    }
    if (fn.name === 'finalize') { if (r.finalized) throw new Error('done'); if (r.closedAt === 0n && now() < r.closeAt) throw new Error('open'); r.finalized = true; if (!r.closedAt) r.closedAt = now(); r.graduated = r.raised >= r.min; return '0x'; }
    if (fn.name === 'claim') { r.claimed[ME.toLowerCase()] = true; return '0x'; }
    if (fn.name === 'refund') { chain.balance += r.paid[ME.toLowerCase()] || 0n; r.paid[ME.toLowerCase()] = 0n; return '0x'; }
    throw new Error('unknown fn ' + fn.name);
  }
  const listeners = {};
  window.ethereum = {
    isMetaMask: true,
    on(ev, fn) { (listeners[ev] ||= []).push(fn); },
    removeListener() {},
    async request({ method, params }) {
      switch (method) {
        case 'eth_chainId': return chain.id;
        case 'net_version': return '97';
        case 'eth_requestAccounts': case 'eth_accounts': return [ME];
        case 'eth_getBalance': return hex(chain.balance);
        case 'eth_blockNumber': return hex(100 + chain.n);
        case 'eth_gasPrice': case 'eth_maxPriorityFeePerGas': return hex(3000000000);
        case 'eth_estimateGas': return hex(500000);
        case 'eth_getTransactionCount': return hex(chain.n);
        case 'eth_feeHistory': return { baseFeePerGas: [hex(3000000000)], gasUsedRatio: [0.5], oldestBlock: hex(100) };
        case 'eth_getBlockByNumber': return { number: hex(100 + chain.n), hash: '0x' + '11'.repeat(32), parentHash: '0x' + '22'.repeat(32), timestamp: hex(now()), gasLimit: hex(30000000), gasUsed: hex(0), baseFeePerGas: hex(3000000000), miner: ME, nonce: '0x0000000000000000', difficulty: '0x0', extraData: '0x', transactions: [] };
        case 'eth_getLogs': { const f = params[0]; const addrs = (Array.isArray(f.address) ? f.address : [f.address]).filter(Boolean).map((a) => a.toLowerCase()); const fb = f.fromBlock && f.fromBlock !== 'latest' ? Number(BigInt(f.fromBlock)) : 0; const tb = f.toBlock && f.toBlock !== 'latest' ? Number(BigInt(f.toBlock)) : 1e9; return chain.logs.filter((l) => (!addrs.length || addrs.includes(l.address.toLowerCase())) && Number(BigInt(l.blockNumber)) >= fb && Number(BigInt(l.blockNumber)) <= tb && (!f.topics || !f.topics[0] || f.topics[0] === l.topics[0])); }
        case 'eth_call': return call(params[0].to, params[0].data, params[0].value);
        case 'personal_sign': return '0x' + 'ab'.repeat(65);
        case 'wallet_switchEthereumChain': { chain.id = params[0].chainId; (listeners.chainChanged || []).forEach((f) => f(chain.id)); return null; }
        case 'eth_sendTransaction': {
          const p = params[0]; const data = call(p.to, p.data, p.value);
          chain.n++; const h = '0x' + chain.n.toString(16).padStart(64, '0');
          chain.txs[h] = { hash: h, to: p.to, from: ME, data: p.data || '0x', value: p.value || '0x0', blockNumber: hex(100 + chain.n), blockHash: '0x' + '11'.repeat(32), nonce: hex(chain.n), gas: hex(500000), gasPrice: hex(3000000000), input: p.data || '0x', transactionIndex: '0x0', type: '0x0', chainId: '0x61', v: '0x0', r: '0x0', s: '0x0' };
          return h;
        }
        case 'eth_getTransactionByHash': return chain.txs[params[0]] || null;
        case 'eth_getTransactionReceipt': { const tx = chain.txs[params[0]]; if (!tx) return null; return { transactionHash: tx.hash, blockNumber: tx.blockNumber, blockHash: tx.blockHash, from: ME, to: tx.to, status: '0x1', logs: [], gasUsed: hex(21000), cumulativeGasUsed: hex(21000), effectiveGasPrice: hex(3000000000), logsBloom: '0x' + '00'.repeat(256), transactionIndex: '0x0', type: '0x0', contractAddress: null }; }
        default: throw new Error('unsupported ' + method);
      }
    }
  };
  window.__chain = chain;
})();
</script>`;

const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>[hidden]{display:none!important}body{margin:0}</style><script src="/ethers.umd.min.js"></script>${SHIM}</head><body>${page.replace('<script src="/ethers.umd.min.js"></script>', '')}</body></html>`;

const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(html); }
  if (u.startsWith('/api/')) {
    const out = (code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
    const MER = '0x00000000000000000000000000000000000000aa';
    const mk = (o) => ({ id: o.id, rid: o.rid, productId: o.productId, name: o.rid, value: o.value, currency: 'USD', faceUsd: o.value, priceUsd: Math.ceil(o.value * (o.pay.method === 'wallet' ? 1.02 : 1.04) * 100) / 100, margin: o.pay.method === 'wallet' ? 0.02 : 0.04, discount: o.pay.method === 'wallet' ? 0.02 : 0, deliverAt: o.deliverAt || null, forMe: Boolean(o.forMe), ref: o.ref || null, status: o.status, error: null, createdAt: o.createdAt, recipient: { email: o.email, message: o.message || '' }, buyer: { address: null }, pay: o.pay, redemption: o.status === 'delivered' ? { code: '6032-1234-5678-9012', pin: '4321', instructions: 'Redeem at starbucks.com/card', link: 'https://www.bitrefill.com/x' } : null, emailSent: o.status === 'delivered' });
    global.__orders ||= {};
    if (u === '/api/gifts/catalog') return out(200, { supply: true, configured: true, methods: { wallet: true, crypto: true, card: true }, margin: 0.04, walletDiscount: 0.02, refShare: 0.25, countries: ['US', 'CA'], merchant: MER, email: true, products: [['starbucks', 'starbucks-usa', [10, 25, 50, 100], 'US', 'USD'], ['chipotle', 'chipotle-usa', null, 'US', 'USD'], ['burgerking', 'burger-king-usa', null, 'US', 'USD'], ['timhortons', 'tim-hortons-canada', null, 'CA', 'CAD']].map(([rid, id, packages, country, currency]) => ({ rid, id, name: rid, country, currency, min: 5, max: 250, step: 1, packages, inStock: true, available: true })) });
    if (u === '/api/config') return out(200, { paths: false, factories: {}, defaultChain: 97, social: { x: 'https://x.com/bnbbite' } });
    if (u === '/api/gifts/preview') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end('<h2>preview</h2>'); }
    if (u === '/api/status') return out(200, { brand: 'BNB Bite', time: Date.now(), uptimeSec: 3600, supply: true, methods: { wallet: true, crypto: true, card: false }, email: true, chains: { 56: { block: 1, factory: null, ok: true }, 97: { block: 2, factory: '0x000000000000000000000000000000000000FAC7', ok: true } }, ordersDelivered: 2, ordersPending: 0, lastDelivered: [{ rid: 'starbucks', value: 25, currency: 'USD', at: Date.now(), method: 'wallet' }], alerts: 1, subscribers: 3 });
    if (u === '/api/news') return out(200, { items: [{ title: 'McDonald\'s opens 500 new stores', link: 'https://example.com/news', at: Date.now() - 3600000, source: 'Example News' }] });
    if (u === '/api/pool') return out(200, { graduated: true, pair: '0x00000000000000000000000000000000000000ab', price: 0.001, liquidity: 1, marketCap: 1000000, token: '0x000000000000000000000000000000000000001e', points: [[Date.now() - 60000, 0.0009], [Date.now(), 0.001]] });
    if (u === '/api/alerts/count') return out(200, { count: 1 });
    if (u === '/api/me/referrals') return out(200, { address: '0x1111111111111111111111111111111111111111', share: 0.25, orders: 2, delivered: 1, earnedUsd: 0.25, paidUsd: 0, pendingUsd: 0.25, payouts: [], recent: [], link: 'http://x.test/gifts?ref=0x1111111111111111111111111111111111111111' });
    global.__comments ||= [];
    if (req.method === 'GET' && u.startsWith('/api/comments/')) return out(200, { comments: global.__comments });
    if (u === '/api/gifts/currencies') return out(200, { currencies: [{ code: 'btc', name: 'Bitcoin' }, { code: 'eth', name: 'Ethereum' }, { code: 'sol', name: 'Solana' }] });
    if (u === '/api/catalog') return out(200, { overrides: { mcdonalds: { blurb: 'Big Mac since 1967' } } });
    let b = ''; req.on('data', (c) => b += c); req.on('end', () => { const j = b ? JSON.parse(b) : {}; let m;
      if (u === '/api/gifts/checkout') { const id = (Object.keys(global.__orders).length + 1).toString(16).padStart(24, 'a'); const price = Math.ceil(j.value * 1.04 * 100) / 100;
        const pay = j.method === 'wallet' ? { method: 'wallet', merchant: MER, amounts: { BNB: { amount: 0.05, wei: '50000000000000000' }, USDT: { amount: price, wei: String(BigInt(Math.round(price * 100)) * 10n ** 16n) } }, expiresAt: Date.now() + 900000 } : j.method === 'crypto' ? { method: 'crypto', provider: 'nowpayments', payAddress: 'bc1qharnessaddress000', payAmount: 0.00042, payCurrency: j.currency || 'btc', network: 'btc', expiresAt: Date.now() + 1200000, providerStatus: 'waiting' } : { method: 'card', provider: 'stripe', url: 'https://checkout.stripe.com/c/pay/cs_test' };
        global.__orders[id] = { id, rid: j.productId.replace('-usa', '').replace('burger-king', 'burgerking'), productId: j.productId, value: j.value, email: j.email, message: j.message, status: 'pending', createdAt: Date.now(), pay, polls: 0, deliverAt: j.deliverAt ? new Date(j.deliverAt).getTime() : null, forMe: Boolean(j.forMe), ref: j.ref || null }; return out(201, mk(global.__orders[id])); }
      if ((m = /^\/api\/gifts\/orders\/([a-f0-9]{24})\/tx$/.exec(u))) { const o = global.__orders[m[1]]; if (!o) return out(404, { error: 'no' }); o.status = 'delivered'; o.pay = { ...o.pay, token: 'BNB', txHash: j.txHash }; return out(200, mk(o)); }
      if ((m = /^\/api\/gifts\/orders\/([a-f0-9]{24})\/claim$/.exec(u))) { const o = global.__orders[m[1]]; return o ? out(200, mk(o)) : out(404, { error: 'no' }); }
      if ((m = /^\/api\/gifts\/orders\/([a-f0-9]{24})$/.exec(u))) { const o = global.__orders[m[1]]; if (!o) return out(404, { error: 'no' }); if (o.status === 'pending' && o.pay.method === 'crypto') { o.polls++; if (o.polls >= 2) o.status = 'delivered'; else o.pay.providerStatus = 'confirming'; } return out(200, mk(o)); }
      if (u.startsWith('/api/comments/')) { if (!req.headers.authorization) return out(401, { error: 'sign in' }); const c = { id: 'c1', address: '0x1111111111111111111111111111111111111111', text: j.text, at: Date.now() }; global.__comments.push(c); return out(201, c); }
      if (u === '/api/alerts') return out(201, { ok: true, id: 'a1', willEmail: true });
      if (u === '/api/newsletter') return out(201, { ok: true });
      if (u === '/api/support') return out(201, { ok: true, id: 's1' });
      if (u === '/api/auth/nonce') return out(200, { message: 'Sign in to harness: ' + j.address });
      if (u === '/api/auth/verify') return out(200, { token: 'harness-token-00000000000000', address: j.address });
      if (u === '/api/me/orders') return out(200, { address: '0x1111111111111111111111111111111111111111', orders: Object.values(global.__orders).map(mk) });
      out(404, { error: 'no' }); });
    return;
  }
  if (u === '/ethers.umd.min.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(fs.readFileSync([path.join(__dirname, 'ethers.umd.min.js'), path.join(__dirname, '..', 'node_modules', 'ethers', 'dist', 'ethers.umd.min.js')].find((f) => fs.existsSync(f)))); }
  const f = path.join(DIR, u);
  if (f.startsWith(DIR) && fs.existsSync(f)) { res.writeHead(200, { 'content-type': 'image/png' }); return res.end(fs.readFileSync(f)); }
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
  await pg.locator('#connect').click();
  await pg.waitForFunction(() => !document.querySelector('#player').hidden, null, { timeout: 8000 });
  R.addr = await pg.locator('#p-addr').textContent();
  R.cash = await pg.locator('#p-cash').textContent();
  // create a coin (launch view)
  await pg.evaluate(() => { location.hash = '#launch'; }); await pg.waitForTimeout(300);
  await pg.locator('#c-name').fill('Golden Arches Club');
  await pg.locator('#c-tick').fill('arches');
  await pg.locator('#c-rest').selectOption('mcdonalds');
  await pg.locator('#c-goal').fill('1');
  await pg.locator('#c-go').click();
  await pg.waitForFunction(() => document.querySelectorAll('#rows .row').length === 1, null, { timeout: 15000 });
  await pg.locator('.side [data-tab="trending"]').click();
  R.created = await pg.evaluate(() => { const r = document.querySelector('#rows .row'); return { id: r.dataset.id, name: r.querySelector('.row-name b').textContent, small: r.querySelector('.row-name small').textContent, tag: r.querySelector('.tag').textContent }; });
  // buy 0.05 then try over the cap (cap = 0.1)
  await pg.locator('#rows .row:not(.rcard) .row-img').first().click();
  await pg.waitForSelector('#amt');
  R.needsApprove = await pg.locator('[data-approve]').count();
  await pg.locator('[data-approve]').click();
  await pg.waitForFunction(() => !document.querySelector('[data-approve]'), null, { timeout: 15000 });
  await pg.locator('#amt').fill('0.05');
  await pg.locator('[data-buy]').click();
  await pg.waitForFunction(() => document.querySelector('#rows .row .you')?.textContent.includes('0.05'), null, { timeout: 15000 });
  R.afterBuy = { you: await pg.locator('#rows .row .you').textContent(), cash: await pg.locator('#p-cash').textContent(), small: await pg.locator('#rows .row .row-name small').textContent() };
  await pg.locator('#amt').fill('0.5');   // over the per-wallet cap: the contract clips to 0.05 more
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
  await pg.screenshot({ path: path.join(OUT, 'shot-drawer.png') });
  R.hash = await pg.evaluate(() => location.hash);
  await pg.waitForFunction(() => !document.querySelector('#feed').hidden, null, { timeout: 15000 });
  R.feed = { items: await pg.locator('#feed-s .feed-c').first().locator('.feed-i').count(), text: await pg.locator('#feed-s .feed-i').first().textContent() };
  await pg.keyboard.press('Escape');
  await pg.waitForTimeout(200);
  R.hashClosed = await pg.evaluate(() => location.hash);
  // deep link reopens the coin; address search opens it too
  await pg.evaluate((h) => { location.hash = h; }, R.hash);
  await pg.waitForFunction(() => document.querySelector('#drawer').classList.contains('is-open'), null, { timeout: 5000 });
  R.deepLink = await pg.locator('#drawer .who b').textContent();
  await pg.keyboard.press('Escape');
  await pg.locator('#q').fill('https://testnet.bscscan.com/address/' + R.created.id);
  await pg.waitForFunction(() => document.querySelector('#drawer').classList.contains('is-open'), null, { timeout: 5000 });
  R.addrSearch = await pg.locator('#drawer .who b').textContent();
  await pg.keyboard.press('Escape');
  await pg.locator('#q').fill('');
  await pg.locator('#q').fill('0x80a77a372c1e12accda84299492f404902e2da67');
  await pg.waitForFunction(() => document.querySelector('#drawer .who b')?.textContent.includes("McDonald"), null, { timeout: 5000 });
  R.stockSearch = await pg.locator('#drawer .who b').textContent();
  await pg.keyboard.press('Escape');
  await pg.locator('#q').fill('');
  await pg.evaluate(() => { location.hash = '#calendar'; }); await pg.waitForTimeout(500); R.calendar = await pg.locator('#cal-body .cal-row').count();
  await pg.evaluate(() => { location.hash = '#leaderboard'; }); await pg.waitForTimeout(800); R.leaderboard = { coins: await pg.locator('#lb-body .lb-col').first().locator('.lb-row').count(), buyers: await pg.locator('#lb-body .lb-col').nth(1).locator('.lb-row').count() }; await pg.screenshot({ path: path.join(OUT, 'shot-leaderboard.png') });
  await pg.locator('#lb-body .lb-row').first().click(); await pg.waitForSelector('[data-profile]'); await pg.locator('#drawer [data-profile]').click(); await pg.waitForTimeout(600); R.profile = { visible: await pg.evaluate(() => !document.querySelector('#profile').hidden), created: await pg.locator('#profile-body .lb-col').first().locator('.lb-row').count(), hash: await pg.evaluate(() => location.hash) }; await pg.screenshot({ path: path.join(OUT, 'shot-profile.png') });
  await pg.evaluate(() => { location.hash = '#status'; }); await pg.waitForTimeout(600); R.status = { tiles: await pg.locator('.st-tile').count(), last: await pg.locator('.st-row').count() };
  await pg.evaluate(() => { location.hash = '#help'; }); await pg.waitForTimeout(300); await pg.locator('#support-form [name="email"]').fill('me@example.com'); await pg.locator('#support-form [name="message"]').fill('Where is my card? Order a1b2'); await pg.locator('#support-form button').click(); await pg.waitForFunction(() => /Sent/.test(document.querySelector('#support-note').textContent), null, { timeout: 5000 }); R.support = await pg.locator('#support-note').textContent();
  await pg.locator('#nl-email').fill('news@example.com'); await pg.locator('#nl-form button').click(); await pg.waitForFunction(() => /Subscribed/.test(document.querySelector('#nl-note').textContent), null, { timeout: 5000 }); R.newsletter = await pg.locator('#nl-note').textContent();
  await pg.evaluate(() => { location.hash = '#r/mcdonalds'; }); await pg.waitForSelector('#news .news a', { timeout: 5000 }); R.news = await pg.locator('#news .news a b').first().textContent(); await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
  await pg.evaluate(() => { location.hash = '#pairs'; }); await pg.waitForTimeout(300);
  R.pairs = { n: await pg.locator('#pairs-list .pair').count(), label: await pg.locator('#pairs-n').textContent(), first: await pg.locator('#pairs-list .pair').first().textContent(), status: await pg.locator('#contracts').textContent() };
  await pg.evaluate(() => window.scrollTo(0, 0)); await pg.waitForTimeout(400); await pg.screenshot({ path: path.join(OUT, 'shot-cover.png') });
  await pg.evaluate(() => { location.hash = '#pairs'; }); await pg.waitForTimeout(400); await pg.screenshot({ path: path.join(OUT, 'shot-pairs.png') });
  await pg.evaluate(() => { location.hash = '#coins'; }); await pg.waitForTimeout(300);
  R.icons = await pg.locator('.cats .ic img').count();
  R.mark = await pg.locator('.brand .mark').count();
  // force close + finalize (fake chain: set closedAt) then claim
  await pg.evaluate(() => { const r = window.__chain.raises[0]; r.raised = r.target; r.closedAt = BigInt(Math.floor(Date.now() / 1000)); });
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
  await pg.keyboard.press('Escape');
  await pg.waitForTimeout(300);
  await pg.locator('.side [data-tab="graduated"]').click();
  await pg.waitForSelector('#rows .row .tag');
  R.graduatedTag = await pg.locator('#rows .row .tag').textContent();
  await pg.screenshot({ path: path.join(OUT, 'dapp.png') });
  await pg.evaluate(() => { location.hash = '#home'; }); await pg.waitForTimeout(300);
  // gift card bought on the site: amount -> recipient -> wallet -> BNB payment -> code
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
  await pg.waitForSelector('[data-gpay="BNB"]', { timeout: 10000 });
  R.giftPending = await pg.locator('.gs-stat').first().textContent();
  await pg.locator('[data-gpay="BNB"]').click();
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
  // account sheet: sign in with the wallet, list orders
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
  R.errors = errors;
  console.log(JSON.stringify(R, null, 1));
  await browser.close(); server.close();
})().catch(async (e) => { console.error('HARNESS FAIL', e); try { const pg = global.__pg; if (pg) { console.error('ERRORS', JSON.stringify(global.__errors)); console.error('ACT', await pg.evaluate(() => (document.querySelector('#act') || {}).outerHTML?.slice(0, 600))); console.error('LOGS', await pg.evaluate(() => window.__chain.logs.length)); console.error('DRAWER', await pg.evaluate(() => document.querySelector('#drawer').className + ' ' + location.hash + ' | ' + document.querySelector('#drawer').innerHTML.slice(0, 300))); console.error('ROWS', await pg.evaluate(() => document.querySelector('#rows').innerHTML.slice(0, 400))); console.error('GIFTS', await pg.evaluate(() => document.querySelector('#gift-rail').innerHTML.slice(0, 300))); } } catch (x) { console.error(x); } process.exit(1); });
