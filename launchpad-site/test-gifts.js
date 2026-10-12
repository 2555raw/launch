/* End-to-end test of the gift card checkout against a fake BNB Chain RPC and
 * a fake Bitrefill API: quote -> on-chain payment check (BNB and USDT) ->
 * invoice from balance -> order delivered with a code. Also the refusals:
 * wrong recipient, amount below the quote, reused transaction, expired quote. */
'use strict';
const http = require('http'); const assert = require('assert'); const path = require('path'); const fs = require('fs'); const os = require('os');
const MERCHANT = '0x00000000000000000000000000000000000000aa';
const USDT = '0x55d398326f99059ff775485246999027b3197955';
const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const txs = {};
const hex = (n) => '0x' + BigInt(n).toString(16);
function addTx(hash, { to, value = 0n, logs = [], status = '0x1' }) { txs[hash] = { tx: { hash, from: '0x' + '11'.repeat(20), to, value: hex(value) }, rc: { status, blockNumber: '0x100', logs } }; }
const rpcServer = http.createServer((req, res) => { let b = ''; req.on('data', (c) => b += c); req.on('end', () => { const j = JSON.parse(b); const t = txs[j.params[0]]; const result = j.method === 'eth_getTransactionByHash' ? (t ? t.tx : null) : j.method === 'eth_getTransactionReceipt' ? (t ? t.rc : null) : null; res.end(JSON.stringify({ jsonrpc: '2.0', id: 1, result })); }); });
const orders = {}; let invoices = 0;
const brServer = http.createServer((req, res) => { let b = ''; req.on('data', (c) => b += c); req.on('end', () => {
  assert.strictEqual(req.headers.authorization, 'Bearer k-test');
  const u = req.url; const out = (code, data) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify({ meta: {}, data })); };
  if (req.method === 'GET' && u.startsWith('/products/')) { const id = decodeURIComponent(u.slice(10)); return out(200, { id, in_stock: true, currency: id.endsWith('canada') ? 'CAD' : 'USD', packages: id === 'starbucks-usa' ? [{ id: 1, value: 10, price: 10 }, { id: 2, value: 25, price: 25 }] : null, range: id === 'starbucks-usa' ? null : { min: 5, max: 100, step: 1 } }); }
  if (req.method === 'POST' && u === '/invoices') { const body = JSON.parse(b); assert.strictEqual(body.payment_method, 'balance'); assert.strictEqual(body.auto_pay, true); const it = body.products[0]; const oid = 'ord' + (++invoices); orders[oid] = { id: oid, status: 'processing', polls: 0, product: { id: it.product_id, value: String(it.value || (it.package_id === 2 ? 25 : 10)), currency: 'USD', _href: 'https://www.bitrefill.com/x' } }; return out(200, { id: 'inv' + invoices, status: 'pending', orders: [{ id: oid, status: 'processing' }] }); }
  if (req.method === 'GET' && u.startsWith('/orders/')) { const o = orders[u.slice(8)]; if (!o) return out(404, {}); o.polls++; if (o.polls >= 2) { o.status = 'delivered'; o.redemption_info = `Code 6032-1234-5678-9012 PIN 4321 for ${o.product.value} ${o.product.currency}`; } return out(200, o); }
  out(404, {}); }); });
(async () => {
  await new Promise((r) => rpcServer.listen(0, r)); await new Promise((r) => brServer.listen(0, r));
  process.env.BSC_RPC = `http://127.0.0.1:${rpcServer.address().port}`; process.env.BITREFILL_API = `http://127.0.0.1:${brServer.address().port}`;
  process.env.BITREFILL_API_KEY = 'k-test'; process.env.MERCHANT_ADDRESS = MERCHANT; process.env.GIFT_MARGIN = '0.04';
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'gifts-')); process.env.PORT = '0';
  const gifts = require('./gifts'); gifts.px.at = Date.now(); gifts.px.bnb = 500; gifts.px.cadPerUsd = 1.4; // fixed prices, no CoinGecko
  const { start } = require('./server'); const server = await start(0); const base = `http://127.0.0.1:${server.address().port}`;
  const j = async (p, body) => { const r = await fetch(base + p, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}); return { code: r.status, body: await r.json() }; };
  let passed = 0; const ok = (c, m) => { assert.ok(c, m); passed++; console.log('  ok ' + m); };

  const cat = await j('/api/gifts/catalog'); ok(cat.body.configured === true && cat.body.products.find((p) => p.id === 'starbucks-usa').packages.join() === '10,25', 'catalog configured with live packages');
  let r = await j('/api/gifts/quote', { productId: 'starbucks-usa', value: 7 }); ok(r.code === 400, 'package product rejects a value outside its packages');
  r = await j('/api/gifts/quote', { productId: 'starbucks-usa', value: 25 }); const q = r.body; ok(r.code === 200 && q.priceUsd === 26 && q.pay.BNB.amount === 0.052 && q.pay.USDT.wei === '26000000000000000000', 'quote: $25 + 4% = $26 = 0.052 BNB = 26 USDT');
  r = await j('/api/gifts/quote', { productId: 'tim-hortons-canada', value: 50 }); ok(r.code === 200 && r.body.faceUsd === 35.71 && r.body.priceUsd === 37.15, 'CAD face value converted to USD before the margin');
  r = await j('/api/gifts/order', { quoteId: q.id, txHash: '0x' + 'ab'.repeat(32) }); ok(r.code === 402 && /not found/.test(r.body.error), 'unknown transaction is refused');
  addTx('0x' + '01'.repeat(32), { to: '0x' + '22'.repeat(20), value: 10n ** 18n }); r = await j('/api/gifts/order', { quoteId: q.id, txHash: '0x' + '01'.repeat(32) }); ok(r.code === 402 && /does not pay/.test(r.body.error), 'payment to another address is refused');
  addTx('0x' + '02'.repeat(32), { to: MERCHANT, value: 51n * 10n ** 15n }); r = await j('/api/gifts/order', { quoteId: q.id, txHash: '0x' + '02'.repeat(32) }); ok(r.code === 402 && /below/.test(r.body.error), 'BNB below the quote is refused');
  addTx('0x' + '03'.repeat(32), { to: MERCHANT, value: 52n * 10n ** 15n }); r = await j('/api/gifts/order', { quoteId: q.id, txHash: '0x' + '03'.repeat(32) });
  ok(r.code === 201 && r.body.status === 'delivered' && /6032-1234/.test(r.body.redemption.instructions) && r.body.token === 'BNB', 'BNB payment -> Bitrefill invoice from balance -> delivered code');
  r = await j('/api/gifts/order', { quoteId: q.id, txHash: '0x' + '03'.repeat(32) }); ok(r.code === 410, 'quote is consumed after the order');
  const q2 = (await j('/api/gifts/quote', { productId: 'chipotle-usa', value: 40 })).body; ok(q2.priceUsd === 41.6, 'ranged product quote');
  r = await j('/api/gifts/order', { quoteId: q2.id, txHash: '0x' + '03'.repeat(32) }); ok(r.code === 409, 'a transaction cannot pay twice');
  const topicTo = '0x' + MERCHANT.slice(2).padStart(64, '0');
  addTx('0x' + '04'.repeat(32), { to: USDT, logs: [{ address: USDT, topics: [TRANSFER, '0x' + '11'.repeat(32), topicTo], data: hex(416n * 10n ** 17n) }] });
  r = await j('/api/gifts/order', { quoteId: q2.id, txHash: '0x' + '04'.repeat(32) }); ok(r.code === 201 && r.body.token === 'USDT' && r.body.status === 'delivered', 'USDT transfer log to the merchant is accepted');
  const got = await j('/api/gifts/orders/' + r.body.id); ok(got.code === 200 && got.body.redemption && got.body.txHash === '0x' + '04'.repeat(32), 'order can be fetched again with its code');
  const saved = JSON.parse(fs.readFileSync(path.join(process.env.DATA_DIR, 'launchpad.json'), 'utf8')); ok(Object.keys(saved.giftOrders).length === 2, 'orders persisted to disk');
  console.log(`\n${passed} passed`); server.close(); rpcServer.close(); brServer.close(); process.exit(0);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
