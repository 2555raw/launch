/* Gift cards sold from this site: the visitor pays on BNB Chain (BNB or USDT
 * to MERCHANT_ADDRESS), the server verifies the transaction on-chain, orders
 * the card from Bitrefill's API with the account balance and hands the
 * redemption code back. Nothing is custodied here: the only state is the
 * list of orders (tx hash, product, status, code).
 *
 *   BITREFILL_API_KEY      Bearer token (personal) or
 *   BITREFILL_API_ID / BITREFILL_API_SECRET   Basic auth (business)
 *   MERCHANT_ADDRESS       BNB Chain address that receives payments
 *   BSC_RPC                JSON-RPC (default bsc-dataseed)
 *   GIFT_MARGIN            fee on top of face value, default 0.04 (4 %)
 *   GIFT_TEST=1            order Bitrefill's test product instead of the real one
 *
 * Without BITREFILL_* + MERCHANT_ADDRESS the catalog reports configured:false
 * and the page falls back to linking the Bitrefill listing. */
'use strict';
const crypto = require('crypto');

const API = process.env.BITREFILL_API || 'https://api.bitrefill.com/v2';
const USDT = '0x55d398326f99059ff775485246999027b3197955'; // BEP-20 USDT, 18 decimals
const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const MARGIN = Number(process.env.GIFT_MARGIN ?? 0.04);
const RPC = process.env.BSC_RPC || 'https://bsc-dataseed.binance.org';
const MERCHANT = (process.env.MERCHANT_ADDRESS || '').toLowerCase();
const TEST = /^(1|true|yes)$/i.test(process.env.GIFT_TEST || '');

/* Catalog: restaurant id -> Bitrefill product. Ranges are the listing values
 * seen on 2026-10-12; live packages replace them when the API is configured. */
const CATALOG = [
  ['starbucks', 'starbucks-usa', 'Starbucks', 'US', 'USD', 5, 500], ['chipotle', 'chipotle-usa', 'Chipotle', 'US', 'USD', 5, 250],
  ['tacobell', 'taco-bell-usa', 'Taco Bell', 'US', 'USD', 5, 500], ['kfc', 'kfc-usa', 'KFC', 'US', 'USD', 70, 100],
  ['pizzahut', 'pizza-hut-usa', 'Pizza Hut', 'US', 'USD', 5, 50], ['burgerking', 'burger-king-usa', 'Burger King', 'US', 'USD', 5, 1000],
  ['dominos', 'dominos-usa', "Domino's", 'US', 'USD', 5, 100], ['doordash', 'doordash-usa', 'DoorDash', 'US', 'USD', 5, 200],
  ['ubereats', 'uber-eats-usa', 'Uber Eats', 'US', 'USD', 20, 500], ['olivegarden', 'olive-garden-usa', 'Olive Garden', 'US', 'USD', 10, 2000],
  ['texasroadhouse', 'texas-roadhouse-usa', 'Texas Roadhouse', 'US', 'USD', 5, 100], ['timhortons', 'tim-hortons-canada', 'Tim Hortons', 'CA', 'CAD', 5, 100]
].map(([rid, id, name, country, currency, min, max]) => ({ rid, id, name, country, currency, min, max, packages: null, inStock: true }));

function auth() {
  if (process.env.BITREFILL_API_KEY) return 'Bearer ' + process.env.BITREFILL_API_KEY;
  if (process.env.BITREFILL_API_ID && process.env.BITREFILL_API_SECRET) return 'Basic ' + Buffer.from(`${process.env.BITREFILL_API_ID}:${process.env.BITREFILL_API_SECRET}`).toString('base64');
  return null;
}
const configured = () => Boolean(auth() && MERCHANT);

async function br(method, path, body) {
  const res = await fetch(API + path, { method, headers: { authorization: auth(), 'content-type': 'application/json', accept: 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`bitrefill ${res.status} ${j.message || j.error_code || ''}`.trim());
  return j.data ?? j;
}

/* ---- live product data, cached 15 min ---- */
const live = { at: 0, pending: null };
async function refreshCatalog() {
  if (!auth()) return;
  if (Date.now() - live.at < 15 * 60 * 1000) return;
  if (live.pending) return live.pending;
  live.pending = (async () => {
    for (const p of CATALOG) {
      try {
        const d = await br('GET', `/products/${encodeURIComponent(p.id)}`);
        p.inStock = d.in_stock !== false; p.currency = d.currency || p.currency;
        if (Array.isArray(d.packages) && d.packages.length) p.packages = d.packages.map((k) => ({ id: k.id, value: Number(k.value), price: Number(k.price) }));
        if (d.range && d.range.min != null) { p.min = Number(d.range.min); p.max = Number(d.range.max); p.step = Number(d.range.step) || 1; }
      } catch (e) { console.error('gifts: product', p.id, e.message); }
    }
    live.at = Date.now(); live.pending = null;
  })();
  return live.pending;
}

/* ---- prices: BNB/USD and CAD/USD from CoinGecko, cached 2 min ---- */
const px = { at: 0, bnb: 0, cadPerUsd: 0 };
async function prices() {
  if (Date.now() - px.at < 120000 && px.bnb) return px;
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=binancecoin,tether&vs_currencies=usd,cad');
    const j = await r.json(); const bnb = Number(j.binancecoin?.usd); const cad = Number(j.tether?.cad) || Number(j.binancecoin?.cad) / bnb;
    if (bnb > 0) { px.bnb = bnb; px.cadPerUsd = cad > 0 ? cad : px.cadPerUsd || 1.37; px.at = Date.now(); }
  } catch (e) { console.error('gifts: prices', e.message); }
  if (!px.bnb) throw new Error('no price feed');
  return px;
}

/* ---- quotes live 15 minutes in memory ---- */
const quotes = new Map();
function makeQuote(p, value) {
  const faceUsd = p.currency === 'CAD' ? value / px.cadPerUsd : value;
  const priceUsd = Math.ceil(faceUsd * (1 + MARGIN) * 100) / 100;
  const bnb = Math.ceil(priceUsd / px.bnb * 1e6) / 1e6;
  const q = { id: crypto.randomBytes(12).toString('hex'), productId: p.id, rid: p.rid, name: p.name, value, currency: p.currency, faceUsd: Math.round(faceUsd * 100) / 100, margin: MARGIN, priceUsd,
    pay: { BNB: { amount: bnb, wei: BigInt(Math.round(bnb * 1e6)) * 10n ** 12n }, USDT: { amount: priceUsd, wei: BigInt(Math.round(priceUsd * 100)) * 10n ** 16n } }, merchant: MERCHANT, expiresAt: Date.now() + 15 * 60 * 1000 };
  quotes.set(q.id, q);
  for (const [k, v] of quotes) if (v.expiresAt < Date.now()) quotes.delete(k);
  return q;
}
const pub = (q) => ({ ...q, pay: { BNB: { amount: q.pay.BNB.amount, wei: q.pay.BNB.wei.toString() }, USDT: { amount: q.pay.USDT.amount, wei: q.pay.USDT.wei.toString() } } });

/* ---- on-chain payment check ---- */
async function rpc(method, params) {
  const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  const j = await r.json(); if (j.error) throw new Error(j.error.message); return j.result;
}
async function verifyPayment(q, txHash) {
  const [tx, rc] = await Promise.all([rpc('eth_getTransactionByHash', [txHash]), rpc('eth_getTransactionReceipt', [txHash])]);
  if (!tx) throw new Error('transaction not found');
  if (!rc || !rc.blockNumber) throw new Error('not confirmed yet');
  if (rc.status !== '0x1') throw new Error('transaction failed');
  const to = (tx.to || '').toLowerCase();
  if (to === MERCHANT) { const v = BigInt(tx.value); if (v * 1000n < q.pay.BNB.wei * 995n) throw new Error('amount below quote'); return { token: 'BNB', from: tx.from, amount: v.toString() }; }
  if (to === USDT) {
    const log = (rc.logs || []).find((l) => l.address.toLowerCase() === USDT && l.topics[0] === TRANSFER && ('0x' + l.topics[2].slice(26)).toLowerCase() === MERCHANT);
    if (!log) throw new Error('no USDT transfer to the merchant in this transaction');
    const v = BigInt(log.data); if (v * 1000n < q.pay.USDT.wei * 995n) throw new Error('amount below quote');
    return { token: 'USDT', from: tx.from, amount: v.toString() };
  }
  throw new Error('transaction does not pay the merchant');
}

/* ---- fulfilment ---- */
async function fulfil(order, store, save) {
  try {
    const p = CATALOG.find((x) => x.id === order.productId);
    const item = TEST ? { product_id: 'test-gift-card-code', value: order.value, quantity: 1 } : { product_id: p.id, quantity: 1 };
    if (!TEST) { const pk = p.packages && p.packages.find((k) => k.value === order.value); if (pk) item.package_id = pk.id; else item.value = order.value; }
    const inv = await br('POST', '/invoices', { products: [item], payment_method: 'balance', auto_pay: true });
    order.invoiceId = inv.id; order.bitrefillOrderId = inv.orders && inv.orders[0] && inv.orders[0].id; order.status = 'processing'; save();
    await pollOrder(order, store, save);
  } catch (e) { order.status = 'failed'; order.error = e.message; console.error('gifts: fulfil', order.id, e.message); save(); }
}
async function pollOrder(order, store, save) {
  if (!order.bitrefillOrderId) return;
  for (let i = 0; i < 10; i++) {
    const o = await br('GET', `/orders/${encodeURIComponent(order.bitrefillOrderId)}`);
    if (o.status === 'delivered') { order.status = 'delivered'; order.deliveredAt = Date.now(); const ri = o.redemption_info; order.redemption = typeof ri === 'string' ? { instructions: ri } : (ri || {}); if (o.product && o.product._href) order.redemption.link = order.redemption.link || o.product._href; save(); return; }
    if (o.status === 'failed' || o.status === 'refunded') { order.status = 'failed'; order.error = 'bitrefill ' + o.status; save(); return; }
    await new Promise((r) => setTimeout(r, 2000));
  }
}

/* ---- HTTP ---- */
function publicOrder(o) { return { id: o.id, rid: o.rid, productId: o.productId, name: o.name, value: o.value, currency: o.currency, priceUsd: o.priceUsd, token: o.token, txHash: o.txHash, status: o.status, error: o.error || null, createdAt: o.createdAt, deliveredAt: o.deliveredAt || null, redemption: o.status === 'delivered' ? o.redemption : null }; }

async function giftsApi(req, res, url, { send, fail, readJson, limited, store, save }) {
  const p = url.pathname; store.giftOrders ||= {};
  if (req.method === 'GET' && p === '/api/gifts/catalog') {
    await refreshCatalog().catch(() => {});
    return send(res, 200, { configured: configured(), test: TEST, merchant: MERCHANT || null, margin: MARGIN, products: CATALOG.map((x) => ({ rid: x.rid, id: x.id, name: x.name, country: x.country, currency: x.currency, min: x.min, max: x.max, step: x.step || 1, packages: x.packages && x.packages.map((k) => k.value), inStock: x.inStock })) });
  }
  let m;
  if (req.method === 'GET' && (m = /^\/api\/gifts\/orders\/([a-f0-9]{24})$/.exec(p))) {
    const o = store.giftOrders[m[1]]; if (!o) return fail(res, 404, 'no such order');
    if (o.status === 'processing' && configured()) await pollOrder(o, store, save).catch(() => {});
    return send(res, 200, publicOrder(o));
  }
  if (req.method !== 'POST') return fail(res, 404, 'no such route');
  if (limited(req)) return fail(res, 429, 'too many requests, slow down');
  let body; try { body = await readJson(req); } catch (e) { return fail(res, 400, e.message); }
  if (p === '/api/gifts/quote') {
    if (!configured()) return fail(res, 503, 'in-site checkout is not enabled on this deployment');
    const prod = CATALOG.find((x) => x.id === body.productId); const value = Number(body.value);
    if (!prod) return fail(res, 400, 'unknown product'); if (!prod.inStock) return fail(res, 409, 'out of stock');
    if (!(value > 0)) return fail(res, 400, 'bad value');
    if (prod.packages ? !prod.packages.some((k) => k.value === value) : (value < prod.min || value > prod.max)) return fail(res, 400, `value must be ${prod.packages ? 'one of ' + prod.packages.map((k) => k.value).join(', ') : `between ${prod.min} and ${prod.max}`}`);
    try { await prices(); } catch (e) { return fail(res, 503, e.message); }
    return send(res, 200, pub(makeQuote(prod, value)));
  }
  if (p === '/api/gifts/order') {
    if (!configured()) return fail(res, 503, 'in-site checkout is not enabled on this deployment');
    const q = quotes.get(String(body.quoteId || '')); if (!q || q.expiresAt < Date.now()) return fail(res, 410, 'quote expired, ask for a new one');
    const txHash = String(body.txHash || '').toLowerCase(); if (!/^0x[0-9a-f]{64}$/.test(txHash)) return fail(res, 400, 'bad tx hash');
    if (Object.values(store.giftOrders).some((o) => o.txHash === txHash)) return fail(res, 409, 'this transaction was already used');
    let paid; try { paid = await verifyPayment(q, txHash); } catch (e) { return fail(res, 402, e.message); }
    const order = { id: crypto.randomBytes(12).toString('hex'), rid: q.rid, productId: q.productId, name: q.name, value: q.value, currency: q.currency, priceUsd: q.priceUsd, token: paid.token, paidWei: paid.amount, payer: paid.from, txHash, status: 'paid', createdAt: Date.now() };
    store.giftOrders[order.id] = order; quotes.delete(q.id); await save();
    await fulfil(order, store, save);
    return send(res, 201, publicOrder(order));
  }
  return fail(res, 404, 'no such route');
}

module.exports = { giftsApi, CATALOG, configured, verifyPayment, makeQuote, quotes, px, _test: { USDT, TRANSFER } };
