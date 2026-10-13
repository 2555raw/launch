/* End-to-end test of the shop backend against fake providers (BNB RPC,
 * Bitrefill, NOWPayments, Stripe, Resend): wallet, any-crypto and card
 * checkouts, webhooks with signatures, fulfilment, email, buyer orders,
 * admin API. */
'use strict';
const http = require('http'); const assert = require('assert'); const path = require('path'); const fs = require('fs'); const os = require('os'); const crypto = require('crypto');
const { ethers } = require('ethers');
const MERCHANT = '0x00000000000000000000000000000000000000aa', USDT = '0x55d398326f99059ff775485246999027b3197955', TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const hex = (n) => '0x' + BigInt(n).toString(16);
const txs = {}; const addTx = (hash, { to, value = 0n, logs = [], status = '0x1' }) => { txs[hash] = { tx: { hash, from: '0x' + '11'.repeat(20), to, value: hex(value) }, rc: { status, blockNumber: '0x100', logs } }; };
const body = (req) => new Promise((r) => { let b = ''; req.on('data', (c) => b += c); req.on('end', () => r(b)); });
const json = (res, code, data) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(data)); };
const rpcS = http.createServer(async (req, res) => { const j = JSON.parse(await body(req)); const t = txs[j.params[0]]; res.end(JSON.stringify({ jsonrpc: '2.0', id: 1, result: j.method === 'eth_getTransactionByHash' ? (t ? t.tx : null) : j.method === 'eth_getTransactionReceipt' ? (t ? t.rc : null) : null })); });
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
(async () => {
  for (const s of [rpcS, brS, npS, stS, mailS]) await new Promise((r) => s.listen(0, r));
  Object.assign(process.env, { BSC_RPC: `http://127.0.0.1:${rpcS.address().port}`, BITREFILL_API: `http://127.0.0.1:${brS.address().port}`, BITREFILL_API_KEY: 'k-test', MERCHANT_ADDRESS: MERCHANT, GIFT_MARGIN: '0.04',
    NOWPAYMENTS_API: `http://127.0.0.1:${npS.address().port}`, NOWPAYMENTS_API_KEY: 'np-test', NOWPAYMENTS_IPN_SECRET: 'ipn-secret', STRIPE_API: `http://127.0.0.1:${stS.address().port}`, STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: 'whsec_x',
    RESEND_API: `http://127.0.0.1:${mailS.address().port}`, RESEND_API_KEY: 're_test', ADMIN_KEY: 'admin-secret', SITE_URL: 'https://shop.test', DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'shop-')), PORT: '0' });
  const gifts = require('./gifts'); gifts.px.at = Date.now(); gifts.px.bnb = 500; gifts.px.cadPerUsd = 1.4;
  const { start } = require('./server'); const server = await start(0); const base = `http://127.0.0.1:${server.address().port}`;
  const j = async (p, b, headers = {}) => { const r = await fetch(base + p, b !== undefined ? { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof b === 'string' ? b : JSON.stringify(b) } : { headers }); return { code: r.status, body: await r.json() }; };
  let passed = 0; const ok = (c, m) => { assert.ok(c, m); passed++; console.log('  ok ' + m); };

  const cat = await j('/api/gifts/catalog'); ok(cat.body.supply && cat.body.methods.wallet && cat.body.methods.crypto && cat.body.methods.card && cat.body.email, 'catalog reports supply, three payment methods and email');
  ok((await j('/api/gifts/currencies')).body.currencies.some((c) => c.code === 'btc'), 'crypto currency list');
  let r = await j('/api/gifts/checkout', { productId: 'starbucks-usa', value: 25, method: 'wallet' }); ok(r.code === 400 && /email/.test(r.body.error), 'checkout requires a recipient email');
  r = await j('/api/gifts/checkout', { productId: 'starbucks-usa', value: 25, email: 'friend@example.com', message: 'Enjoy!', method: 'wallet' }); const w = r.body;
  ok(r.code === 201 && w.status === 'pending' && w.priceUsd === 26 && w.pay.amounts.BNB.amount === 0.052 && w.pay.merchant === MERCHANT, 'wallet checkout: pending order with BNB and USDT amounts');
  addTx('0x' + '01'.repeat(32), { to: MERCHANT, value: 51n * 10n ** 15n }); r = await j(`/api/gifts/orders/${w.id}/tx`, { txHash: '0x' + '01'.repeat(32) }); ok(r.code === 402 && /below/.test(r.body.error), 'BNB below the quote is refused');
  addTx('0x' + '02'.repeat(32), { to: MERCHANT, value: 52n * 10n ** 15n }); r = await j(`/api/gifts/orders/${w.id}/tx`, { txHash: '0x' + '02'.repeat(32) });
  ok(r.code === 200 && r.body.status === 'delivered' && /6032/.test(r.body.redemption.instructions) && r.body.pay.token === 'BNB', 'wallet payment verified on-chain -> Bitrefill -> delivered');
  ok(mails.length === 1 && mails[0].to[0] === 'friend@example.com' && /6032-1234/.test(mails[0].html) && /Enjoy!/.test(mails[0].html), 'recipient got the code and the message by email');
  r = await j(`/api/gifts/orders/${w.id}/tx`, { txHash: '0x' + '02'.repeat(32) }); ok(r.code === 409, 'a delivered order cannot be paid again');
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
  const wallet = ethers.Wallet.createRandom(); const n = await j('/api/auth/nonce', { address: wallet.address }); const sgn = await wallet.signMessage(n.body.message); const tok = (await j('/api/auth/verify', { address: wallet.address, signature: sgn })).body.token;
  r = await j('/api/gifts/checkout', { productId: 'starbucks-usa', value: 10, email: 'acc@example.com', method: 'wallet' }, { authorization: 'Bearer ' + tok }); ok(r.body.buyer.address === wallet.address, 'signed-in checkout stores the buyer wallet');
  r = await j('/api/me/orders', undefined, { authorization: 'Bearer ' + tok }); ok(r.code === 200 && r.body.orders.length === 1, 'buyer can list their own orders');
  r = await j(`/api/gifts/orders/${w.id}/claim`, {}, { authorization: 'Bearer ' + tok }); ok(r.body.buyer.address === wallet.address && (await j('/api/me/orders', undefined, { authorization: 'Bearer ' + tok })).body.orders.length === 2, 'an order bought signed out can be claimed');
  // admin
  ok((await j('/api/admin/summary')).code === 401, 'admin API needs the key');
  const A = { 'x-admin-key': 'admin-secret' }; r = await j('/api/admin/summary', undefined, A); ok(r.code === 200 && r.body.orders === 5 && r.body.byStatus.delivered === 4 && r.body.bitrefillBalance.balance === 120, 'admin summary with counts and Bitrefill balance');
  r = await j('/api/admin/orders', undefined, A); ok(r.body.orders[0].redemption !== undefined && r.body.orders.length === 5, 'admin sees every order with redemption data');
  r = await j(`/api/admin/orders/${w.id}/status`, { status: 'refunded', note: 'customer request' }, A); ok(r.body.status === 'refunded', 'admin can change a status with a note');
  r = await j('/api/admin/catalog', { overrides: { mcdonalds: { blurb: 'Big Mac since 1967', hidden: false } } }, A); ok(r.body.overrides.mcdonalds.blurb === 'Big Mac since 1967' && (await j('/api/catalog')).body.overrides.mcdonalds, 'catalog overrides are public after admin saves them');
  const png = 'data:image/png;base64,' + Buffer.from('\x89PNG\r\n\x1a\n' + 'x'.repeat(100), 'latin1').toString('base64'); r = await j('/api/admin/upload', { dataUrl: png }, A);
  ok(r.code === 201 && /^\/uploads\/[a-f0-9]{16}\.png$/.test(r.body.url) && (await fetch(base + r.body.url)).status === 200, 'admin can upload a photo and it is served');
  await new Promise((r) => setTimeout(r, 300)); const saved = JSON.parse(fs.readFileSync(path.join(process.env.DATA_DIR, 'launchpad.json'), 'utf8')); ok(Object.keys(saved.giftOrders).length === 5 && saved.adminLog.length >= 3, 'orders and admin log persisted');
  console.log(`\n${passed} passed`); server.close(); for (const s of [rpcS, brS, npS, stS, mailS]) s.close(); process.exit(0);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
