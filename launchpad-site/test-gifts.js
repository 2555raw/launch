/* End-to-end test of the shop backend against fake providers (BNB RPC,
 * Bitrefill, NOWPayments, Stripe, Resend): wallet, any-crypto and card
 * checkouts, webhooks with signatures, fulfilment, email, buyer orders,
 * admin API. */
'use strict';
const http = require('http'); const assert = require('assert'); const path = require('path'); const fs = require('fs'); const os = require('os'); const crypto = require('crypto');
const { ethers } = require('ethers');
const createWallet = () => ethers.Wallet.createRandom();
const MERCHANT = createWallet().address; const USDT = '0x55d398326f99059fF775485246999027B3197955', TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const PAYER = createWallet().address; const hex = (n) => '0x' + BigInt(n).toString(16);
const newSig = () => '0x' + crypto.randomBytes(32).toString('hex');
/* fake BNB transactions: a BNB transfer to the merchant or a USDT Transfer log to it */
const txs = {};
const addTx = (hash, { sol = 0n, usdc = 0n, failed = false }) => { const logs = usdc > 0n ? [{ address: USDT, topics: [TRANSFER, ethers.zeroPadValue(PAYER, 32), ethers.zeroPadValue(MERCHANT, 32)], data: ethers.toBeHex(usdc * 10n ** 12n, 32), blockNumber: '0x100', transactionHash: hash, transactionIndex: '0x0', blockHash: '0x' + '22'.repeat(32), logIndex: '0x0', removed: false }] : [];
  txs[hash] = { tx: { hash, from: PAYER, to: usdc > 0n ? USDT : MERCHANT, value: hex(sol), nonce: '0x1', gas: '0x5208', gasPrice: '0x1', input: '0x', blockNumber: '0x100', blockHash: '0x' + '22'.repeat(32), transactionIndex: '0x0', type: '0x0', chainId: '0x38', v: '0x0', r: '0x0', s: '0x0' }, rc: { transactionHash: hash, blockNumber: '0x100', blockHash: '0x' + '22'.repeat(32), from: PAYER, to: usdc > 0n ? USDT : MERCHANT, status: failed ? '0x0' : '0x1', logs, gasUsed: '0x5208', cumulativeGasUsed: '0x5208', effectiveGasPrice: '0x1', logsBloom: '0x' + '00'.repeat(256), transactionIndex: '0x0', type: '0x0', contractAddress: null } }; };
const lamports = (bnb) => BigInt(Math.round(bnb * 1e6)) * 10n ** 12n;
const body = (req) => new Promise((r) => { let b = ''; req.on('data', (c) => b += c); req.on('end', () => r(b)); });
const json = (res, code, data) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(data)); };
const rpcS = http.createServer(async (req, res) => { const j = JSON.parse(await body(req)); const one = (q) => { const t = txs[q.params && q.params[0]]; const result = q.method === 'eth_getTransactionByHash' ? (t ? t.tx : null) : q.method === 'eth_getTransactionReceipt' ? (t ? t.rc : null) : q.method === 'eth_chainId' ? '0x38' : q.method === 'eth_blockNumber' ? '0x200' : q.method === 'eth_getBalance' ? '0x0' : null; return { jsonrpc: '2.0', id: q.id, result }; }; res.end(JSON.stringify(Array.isArray(j) ? j.map(one) : one(j))); });
const brOrders = {}; let inv = 0;
const brS = http.createServer(async (req, res) => { const b = await body(req); assert.strictEqual(req.headers.authorization, 'Bearer k-test'); const u = req.url; const out = (c, d) => json(res, c, { meta: {}, data: d });
  if (req.method === 'GET' && u.startsWith('/products/')) { const id = decodeURIComponent(u.slice(10)); return out(200, { id, in_stock: true, currency: id.endsWith('canada') ? 'CAD' : 'USD', packages: id === 'starbucks-usa' ? [{ id: 1, value: 10, price: 10 }, { id: 2, value: 25, price: 25 }] : null, range: id === 'starbucks-usa' ? null : { min: 5, max: 100, step: 1 } }); }
  if (req.method === 'GET' && u === '/accounts/balance') return out(200, { balance: 120, currency: 'USD' });
  if (req.method === 'POST' && u === '/invoices') { const bd = JSON.parse(b); assert.strictEqual(bd.payment_method, 'balance'); const it = bd.products[0]; const oid = 'ord' + (++inv); brOrders[oid] = { id: oid, status: 'processing', polls: 0, product: { id: it.product_id, value: String(it.value || (it.package_id === 2 ? 25 : 10)), currency: 'USD', _href: 'https://www.bitrefill.com/x' } }; return out(200, { id: 'inv' + inv, status: 'pending', orders: [{ id: oid, status: 'processing' }] }); }
  if (req.method === 'GET' && u.startsWith('/orders/')) { const o = brOrders[u.slice(8)]; if (!o) return out(404, {}); o.polls++; if (o.polls >= 2) { o.status = 'delivered'; o.redemption_info = `Code 6032-1234-5678-9012 PIN 4321 for ${o.product.value} ${o.product.currency}`; } return out(200, o); }
  out(404, {}); });
const npPayments = {}; let npId = 1000;
const npS = http.createServer(async (req, res) => { const b = await body(req); assert.strictEqual(req.headers['x-api-key'], 'np-test'); const u = req.url;
  if (u === '/currencies') return json(res, 200, { currencies: ['btc', 'eth', 'sol', 'usdttrc20', 'bnbbsc', 'doge'] });
  if (u.startsWith('/estimate')) return json(res, 200, { estimated_amount: 0.0004 });
  if (req.method === 'POST' && u === '/payment') { const bd = JSON.parse(b); const id = String(++npId); npPayments[id] = { payment_id: id, payment_status: 'waiting', pay_address: 'bc1qtestaddress', pay_amount: 0.00042, pay_currency: bd.pay_currency, order_id: bd.order_id, price_amount: bd.price_amount }; return json(res, 201, npPayments[id]); }
  if (req.method === 'GET' && u.startsWith('/payment/')) { const pmt = npPayments[u.slice(9)]; return pmt ? json(res, 200, pmt) : json(res, 404, {}); }
  json(res, 404, {}); });
const stS = http.createServer(async (req, res) => { const b = await body(req); assert.strictEqual(req.headers.authorization, 'Bearer sk_test_x'); const u = req.url;
  if (req.method === 'POST' && u === '/checkout/sessions') { assert.ok(decodeURIComponent(b).includes('[unit_amount]=2600')); return json(res, 200, { id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1', expires_at: Math.floor(Date.now() / 1000) + 3600, payment_status: 'unpaid' }); }
  if (req.method === 'GET' && u.startsWith('/checkout/sessions/')) return json(res, 200, { id: 'cs_test_1', status: 'open', payment_status: 'unpaid', metadata: {} });
  json(res, 404, {}); });
const mails = []; const mailS = http.createServer(async (req, res) => { const b = JSON.parse(await body(req)); mails.push(b); json(res, 200, { id: 'em_1' }); });
const xPosts = []; const xS = http.createServer(async (req, res) => { const b = await body(req); const h = req.headers.authorization || ''; assert.ok(h.startsWith('OAuth ') && h.includes('oauth_signature=') && h.includes('oauth_consumer_key="x-key"'), 'OAuth 1.0a header'); if (req.method === 'POST' && req.url === '/tweets') { xPosts.push(JSON.parse(b)); return json(res, 201, { data: { id: 'tw' + xPosts.length, text: xPosts.at(-1).text } }); } json(res, 404, {}); });
(async () => {
  for (const s of [rpcS, brS, npS, stS, mailS, xS]) await new Promise((r) => s.listen(0, r));
  Object.assign(process.env, { RATE_LIMIT: '100000', DEFAULT_CHAIN: '56', BSC_RPC: `http://127.0.0.1:${rpcS.address().port}`, BSC_TESTNET_RPC: `http://127.0.0.1:${rpcS.address().port}`, BITREFILL_API: `http://127.0.0.1:${brS.address().port}`, BITREFILL_API_KEY: 'k-test', MERCHANT_ADDRESS: MERCHANT, GIFT_MARGIN: '0.04',
    NOWPAYMENTS_API: `http://127.0.0.1:${npS.address().port}`, NOWPAYMENTS_API_KEY: 'np-test', NOWPAYMENTS_IPN_SECRET: 'ipn-secret', STRIPE_API: `http://127.0.0.1:${stS.address().port}`, STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: 'whsec_x',
    RESEND_API: `http://127.0.0.1:${mailS.address().port}`, RESEND_API_KEY: 're_test', X_API: `http://127.0.0.1:${xS.address().port}`, X_API_KEY: 'x-key', X_API_SECRET: 'x-secret', X_ACCESS_TOKEN: 'x-token', X_ACCESS_SECRET: 'x-token-secret', ADMIN_KEY: 'admin-secret', SITE_URL: 'https://shop.test', DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'shop-')), PORT: '0' });
  const gifts = require('./gifts'); gifts.px.at = Date.now(); gifts.px.bnb = 100; gifts.px.cadPerUsd = 1.4;
  const { start } = require('./server'); const server = await start(0); const base = `http://127.0.0.1:${server.address().port}`;
  const j = async (p, b, headers = {}) => { const r = await fetch(base + p, b !== undefined ? { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof b === 'string' ? b : JSON.stringify(b) } : { headers }); return { code: r.status, body: await r.json() }; };
  let passed = 0; const ok = (c, m) => { assert.ok(c, m); passed++; console.log('  ok ' + m); };

  const cat = await j('/api/gifts/catalog'); ok(cat.body.supply && cat.body.methods.wallet && cat.body.methods.crypto && cat.body.methods.card && cat.body.email, 'catalog reports supply, three payment methods and email');
  ok((await j('/api/gifts/currencies')).body.currencies.some((c) => c.code === 'btc'), 'crypto currency list');
  let r = await j('/api/gifts/checkout', { productId: 'starbucks-usa', value: 25, method: 'wallet' }); ok(r.code === 400 && /email/.test(r.body.error), 'checkout requires a recipient email');
  r = await j('/api/gifts/checkout', { productId: 'starbucks-usa', value: 25, email: 'friend@example.com', message: 'Enjoy!', method: 'wallet' }); const w = r.body;
  ok(r.code === 201 && w.status === 'pending' && w.priceUsd === 25.5 && w.pay.amounts.BNB.amount === 0.255 && w.pay.amounts.USDT.wei === '25500000000000000000' && w.pay.merchant === MERCHANT && /^ethereum:/.test(w.pay.payUrl), 'wallet checkout: pending order with BNB and USDT amounts and an EIP-681 pay link (2% wallet discount)');
  const s1 = newSig(); addTx(s1, { sol: lamports(0.25) }); r = await j(`/api/gifts/orders/${w.id}/tx`, { signature: s1 }); ok(r.code === 402 && /below/.test(r.body.error), 'BNB below the quote is refused');
  const s2 = newSig(); addTx(s2, { sol: lamports(0.255) }); r = await j(`/api/gifts/orders/${w.id}/tx`, { signature: s2 });
  ok(r.code === 200 && r.body.status === 'delivered' && /6032/.test(r.body.redemption.instructions) && r.body.pay.token === 'BNB' && r.body.pay.signature === s2, 'BNB payment verified on-chain -> Bitrefill -> delivered');
  ok(mails.length === 1 && mails[0].to[0] === 'friend@example.com' && /6032-1234/.test(mails[0].html) && /Enjoy!/.test(mails[0].html), 'recipient got the code and the message by email');
  r = await j(`/api/gifts/orders/${w.id}/tx`, { signature: s2 }); ok(r.code === 409, 'a delivered order cannot be paid again');
  // USDT path
  r = await j('/api/gifts/checkout', { productId: 'starbucks-usa', value: 10, email: 'usdt@example.com', method: 'wallet' }); const u = r.body; const s3 = newSig(); addTx(s3, { usdc: 10200000n }); r = await j(`/api/gifts/orders/${u.id}/tx`, { txHash: s3 }); ok(r.code === 200 && r.body.status === 'delivered' && r.body.pay.token === 'USDT', 'USDT transfer to the merchant is accepted');
  r = await j('/api/gifts/checkout', { productId: 'starbucks-usa', value: 10, email: 'qr@example.com', method: 'wallet' }); const qr = r.body; const s4 = newSig(); addTx(s4, { usdc: 10200000n }); r = await j(`/api/gifts/orders/${qr.id}/tx`, { txHash: s4 }); ok(r.body.status === 'delivered' && r.body.pay.signature === s4, 'a second USDT order pays by transaction hash');
  const s5 = newSig(); addTx(s5, { sol: lamports(1), failed: true }); r = await j('/api/gifts/checkout', { productId: 'starbucks-usa', value: 10, email: 'f@example.com', method: 'wallet' }); r = await j(`/api/gifts/orders/${r.body.id}/tx`, { signature: s5 }); ok(r.code === 402 && /failed/.test(r.body.error), 'a failed transaction is refused');
  // any crypto through NOWPayments
  r = await j('/api/gifts/checkout', { productId: 'chipotle-usa', value: 40, email: 'me@example.com', method: 'crypto', currency: 'btc' }); const c = r.body;
  ok(r.code === 201 && c.pay.provider === 'nowpayments' && c.pay.payAddress === 'bc1qtestaddress' && c.pay.payCurrency === 'btc' && c.status === 'pending', 'crypto checkout returns a BTC address and amount');
  r = await j(`/api/gifts/orders/${c.id}`); ok(r.body.status === 'pending' && r.body.pay.providerStatus === 'waiting', 'order polls the provider while waiting');
  const pm = Object.values(npPayments).find((x) => x.order_id === c.id); pm.payment_status = 'finished'; pm.actually_paid = 0.00042;
  r = await j(`/api/gifts/orders/${c.id}`); ok(r.body.status === 'delivered' && r.body.redemption.instructions, 'provider says finished -> paid -> delivered');
  // IPN path with signature
  r = await j('/api/gifts/checkout', { productId: 'dominos-usa', value: 20, email: 'ipn@example.com', method: 'crypto', currency: 'eth' }); const c2 = r.body;
  const ipnBody = { payment_id: Number(Object.values(npPayments).find((x) => x.order_id === c2.id).payment_id), payment_status: 'finished', order_id: c2.id, actually_paid: 0.01 };
  const sortKeys = (v) => Array.isArray(v) ? v.map(sortKeys) : v && typeof v === 'object' ? Object.keys(v).sort().reduce((o, k) => (o[k] = sortKeys(v[k]), o), {}) : v;
  const sig = crypto.createHmac('sha512', 'ipn-secret').update(JSON.stringify(sortKeys(ipnBody))).digest('hex');
  r = await j('/api/webhooks/nowpayments', ipnBody, { 'x-nowpayments-sig': 'bad' }); ok(r.code === 401, 'IPN with a bad signature is rejected');
  r = await j('/api/webhooks/nowpayments', ipnBody, { 'x-nowpayments-sig': sig }); ok(r.code === 200 && (await j(`/api/gifts/orders/${c2.id}`)).body.status === 'delivered', 'signed IPN marks the order paid and fulfils it');
  // card through Stripe
  r = await j('/api/gifts/checkout', { productId: 'starbucks-usa', value: 25, email: 'card@example.com', method: 'card' }); const k = r.body;
  ok(r.code === 201 && k.pay.provider === 'stripe' && /checkout\.stripe\.com/.test(k.pay.url), 'card checkout returns a Stripe Checkout url');
  const ev = JSON.stringify({ type: 'checkout.session.completed', data: { object: { id: 'cs_test_1', payment_status: 'paid', metadata: { order_id: k.id } } } }); const t = Math.floor(Date.now() / 1000);
  const v1 = crypto.createHmac('sha256', 'whsec_x').update(`${t}.${ev}`).digest('hex');
  r = await j('/api/webhooks/stripe', ev, { 'stripe-signature': `t=${t},v1=deadbeef` }); ok(r.code === 401, 'Stripe webhook with a bad signature is rejected');
  r = await j('/api/webhooks/stripe', ev, { 'stripe-signature': `t=${t},v1=${v1}` }); ok(r.code === 200 && (await j(`/api/gifts/orders/${k.id}`)).body.status === 'delivered', 'signed Stripe webhook pays and fulfils the card order');
  // buyer account
  const wallet = createWallet(); const n = await j('/api/auth/nonce', { address: wallet.address }); const sgn = await wallet.signMessage(n.body.message); const tok = (await j('/api/auth/verify', { address: wallet.address, signature: sgn })).body.token;
  r = await j('/api/gifts/checkout', { productId: 'starbucks-usa', value: 10, email: 'acc@example.com', method: 'wallet' }, { authorization: 'Bearer ' + tok }); ok(r.body.buyer.address === wallet.address, 'signed-in checkout stores the buyer wallet');
  r = await j('/api/me/orders', undefined, { authorization: 'Bearer ' + tok }); ok(r.code === 200 && r.body.orders.length === 1, 'buyer can list their own orders');
  r = await j(`/api/gifts/orders/${w.id}/claim`, {}, { authorization: 'Bearer ' + tok }); ok(r.body.buyer.address === wallet.address && (await j('/api/me/orders', undefined, { authorization: 'Bearer ' + tok })).body.orders.length === 2, 'an order bought signed out can be claimed');
  // admin
  ok((await j('/api/admin/summary')).code === 401, 'admin API needs the key');
  const A = { 'x-admin-key': 'admin-secret' }; r = await j('/api/admin/summary', undefined, A); ok(r.code === 200 && r.body.orders === 8 && r.body.byStatus.delivered === 6 && r.body.bitrefillBalance.balance === 120, 'admin summary with counts and Bitrefill balance');
  r = await j('/api/admin/orders', undefined, A); ok(r.body.orders[0].redemption !== undefined && r.body.orders.length === 8, 'admin sees every order with redemption data');
  r = await j(`/api/admin/orders/${w.id}/status`, { status: 'refunded', note: 'customer request' }, A); ok(r.body.status === 'refunded', 'admin can change a status with a note');
  r = await j('/api/admin/catalog', { overrides: { mcdonalds: { blurb: 'Big Mac since 1967', hidden: false } } }, A); ok(r.body.overrides.mcdonalds.blurb === 'Big Mac since 1967' && (await j('/api/catalog')).body.overrides.mcdonalds, 'catalog overrides are public after admin saves them');
  const png = 'data:image/png;base64,' + Buffer.from('\x89PNG\r\n\x1a\n' + 'x'.repeat(100), 'latin1').toString('base64'); r = await j('/api/admin/upload', { dataUrl: png }, A);
  ok(r.code === 201 && /^\/uploads\/[a-f0-9]{16}\.png$/.test(r.body.url) && (await fetch(base + r.body.url)).status === 200, 'admin can upload a photo and it is served');
  await new Promise((r) => setTimeout(r, 300)); const saved = JSON.parse(fs.readFileSync(path.join(process.env.DATA_DIR, 'launchpad.json'), 'utf8')); ok(Object.keys(saved.giftOrders).length === 8 && saved.adminLog.length >= 3, 'orders and admin log persisted');
  // scheduled delivery, keep-in-account, wallet discount, referrals
  r = await j('/api/gifts/catalog'); ok(r.body.walletDiscount === 0.02 && r.body.refShare === 0.25 && r.body.countries.includes('CA'), 'catalog reports the wallet discount, referral share and countries');
  const ref = createWallet().address;
  r = await j('/api/gifts/checkout', { productId: 'starbucks-usa', value: 25, email: 'later@example.com', method: 'wallet', deliverAt: new Date(Date.now() + 3600 * 1000).toISOString(), ref }); const sch = r.body;
  ok(r.code === 201 && sch.priceUsd === 25.5 && sch.discount === 0.02 && sch.deliverAt > Date.now() && sch.ref === ref, 'wallet checkout applies the 2% discount, keeps deliverAt and the referrer');
  const mailsBefore = mails.length; const s6 = newSig(); addTx(s6, { sol: lamports(0.255) }); r = await j(`/api/gifts/orders/${sch.id}/tx`, { signature: s6 });
  ok(r.body.status === 'delivered' && r.body.redemption.instructions && mails.length === mailsBefore && !r.body.emailSent, 'scheduled order is delivered now but the email waits for its time');
  const giftsMod = require('./gifts'); const st = require('./server').store; st.giftOrders[sch.id].deliverAt = Date.now() - 1000; await giftsMod.startJobs(st, async () => {})(); ok(mails.length === mailsBefore + 1 && mails[mails.length - 1].to[0] === 'later@example.com', 'the minute job sends the scheduled email once it is due');
  r = await j('/api/gifts/checkout', { productId: 'starbucks-usa', value: 10, method: 'wallet', forMe: true }); ok(r.code === 400, 'keep-in-account needs a signed-in wallet');
  r = await j('/api/gifts/checkout', { productId: 'starbucks-usa', value: 10, method: 'wallet', forMe: true }, { authorization: 'Bearer ' + tok }); ok(r.code === 201 && r.body.forMe && r.body.recipient.email === null && r.body.buyer.address === wallet.address, 'signed-in buyer can keep the card in the account without an email');
  r = await j('/api/me/referrals', undefined, { authorization: 'Bearer ' + tok }); ok(r.code === 200 && /\/gifts\?ref=0x/.test(r.body.link) && r.body.earnedUsd === 0, 'buyer gets a referral link');
  const w2 = createWallet(); const n3 = await j('/api/auth/nonce', { address: w2.address }); const tok2 = (await j('/api/auth/verify', { address: w2.address, signature: await w2.signMessage(n3.body.message) })).body.token;
  r = await j('/api/gifts/checkout', { productId: 'chipotle-usa', value: 20, email: 'r@example.com', method: 'wallet', ref: w2.address }); const s7 = newSig(); addTx(s7, { sol: lamports(0.204) }); await j(`/api/gifts/orders/${r.body.id}/tx`, { signature: s7 });
  r = await j('/api/me/referrals', undefined, { authorization: 'Bearer ' + tok2 }); ok(r.body.delivered === 1 && r.body.earnedUsd === 0.1 && r.body.pendingUsd === 0.1, 'referrer earns 25% of the margin on a delivered order (20 * 2% * 25% = 0.10)');
  r = await j(`/api/admin/referrals/${w2.address}/paid`, { amountUsd: 0.1, txHash: 'sig' }, A); ok(r.body.pendingUsd === 0 && (await j('/api/admin/referrals', undefined, A)).body.referrers.length >= 1, 'admin records a referral payout');
  r = await fetch(base + '/api/gifts/preview?rid=starbucks&value=25&message=Hola'); ok(r.status === 200 && /text\/html/.test(r.headers.get('content-type')) && /Hola/.test(await r.text()), 'email preview renders the message');
  // community: comments, alerts, newsletter, support, status
  const coin = createWallet().address;
  r = await j(`/api/comments/${coin}`, { text: 'hello' }); ok(r.code === 401, 'comments need a signed-in wallet');
  r = await j(`/api/comments/${coin}`, { text: '  gm   everyone ' }, { authorization: 'Bearer ' + tok }); ok(r.code === 201 && r.body.text === 'gm everyone' && r.body.address === wallet.address, 'signed-in wallet posts a comment');
  r = await j(`/api/comments/${coin}`, { text: 'again' }, { authorization: 'Bearer ' + tok }); ok(r.code === 429, 'one comment every 20 seconds per wallet');
  r = await j(`/api/comments/${coin}`); ok(r.body.comments.length === 1, 'comments are listed publicly');
  r = await j('/api/alerts', { email: 'alert@example.com', coin, chain: '97' }); ok(r.code === 201 && r.body.willEmail === true && (await j(`/api/alerts/count?coin=${coin}`)).body.count === 1, 'alert subscription stored');
  r = await j('/api/newsletter', { email: 'news@example.com', lang: 'es' }); r = await j('/api/newsletter', { email: 'NEWS@example.com' }); ok(r.code === 201 && (await j('/api/admin/newsletter', undefined, A)).body.subscribers.length === 1, 'newsletter deduplicates emails');
  r = await j('/api/support', { email: 'help@example.com', subject: 'Order', message: 'Where is my card?', order: w.id }); ok(r.code === 201 && (await j('/api/admin/support', undefined, A)).body.requests[0].order === w.id, 'support request stored with the order id');
  // X bot and weekly newsletter digest
  r = await j('/api/admin/social', undefined, A); ok(r.code === 200 && r.body.configured === true && r.body.log.length === 0, 'X bot reports configured with an empty log');
  r = await j('/api/admin/social/test', { text: 'hello from the tests' }, A); ok(r.code === 200 && r.body.posted === true && r.body.id === 'tw1' && xPosts[0].text === 'hello from the tests', 'admin can post a test tweet (OAuth 1.0a signed)');
  r = await j('/api/admin/social/run', {}, A); ok(r.code === 200 && (await j('/api/admin/social', undefined, A)).body.log[0].kind === 'test', 'social run with no coins posts nothing new');
  { const pv = await fetch(base + '/api/admin/newsletter/preview', { headers: A }); const html = await pv.text(); ok(pv.status === 200 && html.includes('Unsubscribe') && html.includes('this week'), 'newsletter digest preview renders'); }
  { const n0 = mails.length; r = await j('/api/admin/newsletter/send', {}, A); ok(r.code === 200 && r.body.sent === 1 && mails.length === n0 + 1 && /this week/.test(mails.at(-1).subject) && mails.at(-1).to.includes('news@example.com') && mails.at(-1).html.includes('/api/newsletter/unsubscribe?e='), 'weekly digest goes to each subscriber with an unsubscribe link'); }
  { const { nlToken } = require('./community'); const bad = await fetch(base + '/api/newsletter/unsubscribe?e=news%40example.com&t=' + '0'.repeat(32)); const good = await fetch(base + '/api/newsletter/unsubscribe?e=news%40example.com&t=' + nlToken('news@example.com')); ok(bad.status === 400 && good.status === 200 && (await j('/api/admin/newsletter', undefined, A)).body.subscribers.length === 0, 'unsubscribe link needs the signed token and removes the subscriber'); }
  r = await j('/api/status'); ok(r.code === 200 && r.body.supply === true && r.body.social === true && r.body.ordersDelivered >= 5 && r.body.lastDelivered[0].rid, 'public status lists supply, the X bot and latest deliveries');
  console.log(`\n${passed} passed`); server.close(); for (const s of [rpcS, brS, npS, stS, mailS, xS]) s.close(); process.exit(0);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
