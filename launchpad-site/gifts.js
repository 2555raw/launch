/* Shop backend: gift card catalog, checkout, payments (wallet on BNB Chain,
 * any crypto through NOWPayments, cards through Stripe), on-chain and webhook
 * verification, fulfilment through Bitrefill, email delivery, buyer orders,
 * catalog overrides and the admin API. State lives in store.giftOrders,
 * store.catalogOverrides and store.adminLog (persisted by server.js).
 *
 * Env: MERCHANT_ADDRESS, BSC_RPC, GIFT_MARGIN, BITREFILL_*, NOWPAYMENTS_*,
 * STRIPE_*, RESEND_API_KEY, MAIL_FROM, ADMIN_KEY, SITE_URL, BRAND_NAME. */
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const bitrefill = require('./services/bitrefill');
const nowp = require('./services/nowpayments');
const stripe = require('./services/stripe');
const email = require('./services/email');

const USDT = '0x55d398326f99059ff775485246999027b3197955';
const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const MARGIN = Number(process.env.GIFT_MARGIN ?? 0.04);
const RPC = process.env.BSC_RPC || 'https://bsc-dataseed.binance.org';
const MERCHANT = (process.env.MERCHANT_ADDRESS || '').toLowerCase();
const BRAND = process.env.BRAND_NAME || 'BNB Bite';
const ADMIN_KEY = process.env.ADMIN_KEY || '';
const siteUrl = (req) => (process.env.SITE_URL || `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers['x-forwarded-host'] || req.headers.host}`).replace(/\/$/, '');

const CATALOG = [
  ['starbucks', 'starbucks-usa', 'Starbucks', 'US', 'USD', 5, 500], ['chipotle', 'chipotle-usa', 'Chipotle', 'US', 'USD', 5, 250],
  ['tacobell', 'taco-bell-usa', 'Taco Bell', 'US', 'USD', 5, 500], ['kfc', 'kfc-usa', 'KFC', 'US', 'USD', 70, 100],
  ['pizzahut', 'pizza-hut-usa', 'Pizza Hut', 'US', 'USD', 5, 50], ['burgerking', 'burger-king-usa', 'Burger King', 'US', 'USD', 5, 1000],
  ['dominos', 'dominos-usa', "Domino's", 'US', 'USD', 5, 100], ['doordash', 'doordash-usa', 'DoorDash', 'US', 'USD', 5, 200],
  ['ubereats', 'uber-eats-usa', 'Uber Eats', 'US', 'USD', 20, 500], ['olivegarden', 'olive-garden-usa', 'Olive Garden', 'US', 'USD', 10, 2000],
  ['texasroadhouse', 'texas-roadhouse-usa', 'Texas Roadhouse', 'US', 'USD', 5, 100], ['timhortons', 'tim-hortons-canada', 'Tim Hortons', 'CA', 'CAD', 5, 100]
].map(([rid, id, name, country, currency, min, max]) => ({ rid, id, name, country, currency, min, max, packages: null, inStock: true }));

const supplyReady = () => bitrefill.configured();
const methods = () => ({ wallet: Boolean(MERCHANT), crypto: nowp.configured(), card: stripe.configured() });

/* ---- prices: BNB/USD and CAD/USD, cached 2 min ---- */
const px = { at: 0, bnb: 0, cadPerUsd: 0 };
async function prices() {
  if (Date.now() - px.at < 120000 && px.bnb) return px;
  try { const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=binancecoin,tether&vs_currencies=usd,cad'); const j = await r.json(); const bnb = Number(j.binancecoin?.usd); const cad = Number(j.tether?.cad) || Number(j.binancecoin?.cad) / bnb; if (bnb > 0) { px.bnb = bnb; px.cadPerUsd = cad > 0 ? cad : px.cadPerUsd || 1.37; px.at = Date.now(); } }
  catch (e) { console.error('prices', e.message); }
  if (!px.bnb) throw new Error('no price feed');
  return px;
}
function priceOf(p, value) { const faceUsd = p.currency === 'CAD' ? value / px.cadPerUsd : value; const priceUsd = Math.ceil(faceUsd * (1 + MARGIN) * 100) / 100; return { faceUsd: Math.round(faceUsd * 100) / 100, priceUsd }; }
function walletAmounts(priceUsd) { const bnb = Math.ceil(priceUsd / px.bnb * 1e6) / 1e6; return { BNB: { amount: bnb, wei: (BigInt(Math.round(bnb * 1e6)) * 10n ** 12n).toString() }, USDT: { amount: priceUsd, wei: (BigInt(Math.round(priceUsd * 100)) * 10n ** 16n).toString() } }; }

/* ---- on-chain payment check ---- */
async function rpc(method, params) { const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) }); const j = await r.json(); if (j.error) throw new Error(j.error.message); return j.result; }
async function verifyPayment(order, txHash) {
  const [tx, rc] = await Promise.all([rpc('eth_getTransactionByHash', [txHash]), rpc('eth_getTransactionReceipt', [txHash])]);
  if (!tx) throw new Error('transaction not found');
  if (!rc || !rc.blockNumber) throw new Error('not confirmed yet');
  if (rc.status !== '0x1') throw new Error('transaction failed');
  const want = order.pay.amounts; const to = (tx.to || '').toLowerCase();
  if (to === MERCHANT) { const v = BigInt(tx.value); if (v * 1000n < BigInt(want.BNB.wei) * 995n) throw new Error('amount below quote'); return { token: 'BNB', from: tx.from, amount: v.toString() }; }
  if (to === USDT) {
    const log = (rc.logs || []).find((l) => l.address.toLowerCase() === USDT && l.topics[0] === TRANSFER && ('0x' + l.topics[2].slice(26)).toLowerCase() === MERCHANT);
    if (!log) throw new Error('no USDT transfer to the merchant in this transaction');
    const v = BigInt(log.data); if (v * 1000n < BigInt(want.USDT.wei) * 995n) throw new Error('amount below quote');
    return { token: 'USDT', from: tx.from, amount: v.toString() };
  }
  throw new Error('transaction does not pay the merchant');
}

/* ---- orders ---- */
const valid = (s) => typeof s === 'string' && s.length < 400;
const isEmail = (s) => typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) && s.length < 200;
function publicOrder(o) {
  const pay = o.pay || {};
  return { id: o.id, rid: o.rid, productId: o.productId, name: o.name, value: o.value, currency: o.currency, faceUsd: o.faceUsd, priceUsd: o.priceUsd, margin: o.margin, status: o.status, error: o.error || null, createdAt: o.createdAt, paidAt: o.paidAt || null, deliveredAt: o.deliveredAt || null,
    recipient: o.recipient ? { email: o.recipient.email, message: o.recipient.message || '' } : null, buyer: o.buyer ? { address: o.buyer.address || null } : null,
    pay: { method: pay.method, token: pay.token || null, txHash: pay.txHash || null, provider: pay.provider || null, payAddress: pay.payAddress || null, payAmount: pay.payAmount || null, payCurrency: pay.payCurrency || null, network: pay.network || null, memo: pay.memo || null, url: pay.url || null, expiresAt: pay.expiresAt || null, amounts: pay.amounts || null, merchant: pay.method === 'wallet' ? MERCHANT : null, providerStatus: pay.providerStatus || null },
    redemption: o.status === 'delivered' ? o.redemption : null, emailSent: Boolean(o.emailSent) };
}
async function markPaid(order, info, store, save) {
  if (order.status !== 'pending') return;
  order.status = 'paid'; order.paidAt = Date.now(); Object.assign(order.pay, info); await save();
  const product = CATALOG.find((x) => x.id === order.productId);
  await bitrefill.fulfil(order, product, save);
  await deliverEmail(order, save);
}
async function deliverEmail(order, save, site) {
  if (order.status !== 'delivered' || order.emailSent || !email.configured()) return;
  try { const m = email.giftEmail(order, BRAND, site || process.env.SITE_URL || ''); const to = order.recipient && order.recipient.email; if (to) { await email.send({ to, ...m }); order.emailSent = true; await save(); } }
  catch (e) { console.error('email', order.id, e.message); order.emailError = e.message; await save(); }
}
/* Refreshes a pending/processing order against its provider. */
async function refresh(order, store, save, req) {
  const pay = order.pay || {};
  try {
    if (order.status === 'pending' && pay.method === 'crypto' && pay.providerId) {
      if (pay.expiresAt && Date.now() > pay.expiresAt + 30 * 60 * 1000 && pay.providerStatus !== 'confirming') { }
      const st = await nowp.status(pay.providerId); pay.providerStatus = st.status;
      if (nowp.PAID.has(st.status)) await markPaid(order, { paidAmount: st.actuallyPaid }, store, save);
      else if (st.status === 'expired' || st.status === 'failed') { order.status = st.status === 'expired' ? 'expired' : 'failed'; order.error = 'payment ' + st.status; await save(); }
      else await save();
    } else if (order.status === 'pending' && pay.method === 'card' && pay.providerId) {
      const s = await stripe.getSession(pay.providerId); pay.providerStatus = s.status;
      if (s.paid) await markPaid(order, {}, store, save); else if (s.status === 'expired') { order.status = 'expired'; await save(); } else await save();
    } else if (order.status === 'processing') { await bitrefill.pollOrder(order, save, 3); await deliverEmail(order, save, req && siteUrl(req)); }
    else if (order.status === 'delivered' && !order.emailSent) await deliverEmail(order, save, req && siteUrl(req));
  } catch (e) { console.error('refresh', order.id, e.message); }
}
const adminLog = (store, entry) => { (store.adminLog ||= []).push({ at: Date.now(), ...entry }); if (store.adminLog.length > 2000) store.adminLog.splice(0, store.adminLog.length - 2000); };
function isAdmin(req) { const k = req.headers['x-admin-key']; if (!ADMIN_KEY || !k) return false; try { return crypto.timingSafeEqual(Buffer.from(String(k)), Buffer.from(ADMIN_KEY)); } catch { return false; } }
function readRaw(req, limit = 256 * 1024) { return new Promise((resolve, reject) => { let size = 0; const chunks = []; req.on('data', (c) => { size += c.length; if (size > limit) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); }); req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8'))); req.on('error', reject); }); }

/* ---- HTTP ---- */
async function shopApi(req, res, url, h) {
  const { send, fail, limited, store, save, sessionOf } = h; const p = url.pathname; store.giftOrders ||= {}; store.catalogOverrides ||= {};
  let m;
  /* public, GET */
  if (req.method === 'GET' && p === '/api/gifts/catalog') {
    await bitrefill.refreshCatalog(CATALOG).catch(() => {});
    return send(res, 200, { configured: supplyReady(), supply: supplyReady(), methods: methods(), test: bitrefill.TEST, sandbox: nowp.SANDBOX, merchant: MERCHANT || null, margin: MARGIN, brand: BRAND, email: email.configured(),
      products: CATALOG.map((x) => ({ rid: x.rid, id: x.id, name: x.name, country: x.country, currency: x.currency, min: x.min, max: x.max, step: x.step || 1, packages: x.packages && x.packages.map((k) => k.value), inStock: x.inStock, available: supplyReady() && x.inStock && Object.values(methods()).some(Boolean) })) });
  }
  if (req.method === 'GET' && p === '/api/gifts/currencies') return send(res, 200, { currencies: await nowp.currencies() });
  if (req.method === 'GET' && p === '/api/catalog') return send(res, 200, { overrides: store.catalogOverrides });
  if (req.method === 'GET' && (m = /^\/api\/gifts\/orders\/([a-f0-9]{24})$/.exec(p))) {
    const o = store.giftOrders[m[1]]; if (!o) return fail(res, 404, 'no such order');
    await refresh(o, store, save, req); return send(res, 200, publicOrder(o));
  }
  if (req.method === 'GET' && p === '/api/me/orders') {
    const s = sessionOf(req); if (!s) return fail(res, 401, 'sign in first');
    const mine = Object.values(store.giftOrders).filter((o) => o.buyer && o.buyer.address && o.buyer.address.toLowerCase() === s.address.toLowerCase()).sort((a, b) => b.createdAt - a.createdAt);
    return send(res, 200, { address: s.address, orders: mine.map(publicOrder) });
  }
  /* admin */
  if (p.startsWith('/api/admin/')) {
    if (!isAdmin(req)) return fail(res, ADMIN_KEY ? 401 : 503, ADMIN_KEY ? 'admin key required' : 'ADMIN_KEY is not set');
    if (req.method === 'GET' && p === '/api/admin/summary') {
      const all = Object.values(store.giftOrders); const by = {}; for (const o of all) by[o.status] = (by[o.status] || 0) + 1;
      const revenue = all.filter((o) => ['paid', 'processing', 'delivered'].includes(o.status)).reduce((a, o) => a + (o.priceUsd - o.faceUsd), 0);
      let balance = null; if (bitrefill.configured()) { try { balance = await bitrefill.balance(); } catch (e) { balance = { error: e.message }; } }
      return send(res, 200, { orders: all.length, byStatus: by, marginUsd: Math.round(revenue * 100) / 100, salesUsd: Math.round(all.filter((o) => o.status === 'delivered').reduce((a, o) => a + o.priceUsd, 0) * 100) / 100, supply: supplyReady(), methods: methods(), email: email.configured(), bitrefillBalance: balance, contributions: (store.contributions || []).length, log: (store.adminLog || []).slice(-50).reverse() });
    }
    if (req.method === 'GET' && p === '/api/admin/orders') { const all = Object.values(store.giftOrders).sort((a, b) => b.createdAt - a.createdAt).slice(0, 500); return send(res, 200, { orders: all.map((o) => ({ ...publicOrder(o), recipient: o.recipient, buyer: o.buyer, redemption: o.redemption || null, fulfil: o.fulfil || null, notes: o.notes || [] })) }); }
    if (req.method !== 'POST') return fail(res, 404, 'no such route');
    let body; try { body = JSON.parse(await readRaw(req, 3 * 1024 * 1024) || '{}'); } catch { return fail(res, 400, 'bad json'); }
    if ((m = /^\/api\/admin\/orders\/([a-f0-9]{24})\/(retry|status|email)$/.exec(p))) {
      const o = store.giftOrders[m[1]]; if (!o) return fail(res, 404, 'no such order');
      if (m[2] === 'retry') { if (!['paid', 'failed', 'processing'].includes(o.status)) return fail(res, 409, 'only paid, processing or failed orders can be retried'); o.status = 'paid'; o.error = null; o.fulfil = null; await save(); await bitrefill.fulfil(o, CATALOG.find((x) => x.id === o.productId), save); await deliverEmail(o, save, siteUrl(req)); adminLog(store, { action: 'retry', order: o.id }); return send(res, 200, publicOrder(o)); }
      if (m[2] === 'status') { const allowed = ['pending', 'paid', 'processing', 'delivered', 'failed', 'expired', 'refunded']; if (!allowed.includes(body.status)) return fail(res, 400, 'bad status'); (o.notes ||= []).push({ at: Date.now(), from: o.status, to: body.status, note: valid(body.note) ? body.note : '' }); o.status = body.status; await save(); adminLog(store, { action: 'status', order: o.id, to: body.status }); return send(res, 200, publicOrder(o)); }
      if (m[2] === 'email') { o.emailSent = false; await deliverEmail(o, save, siteUrl(req)); return send(res, 200, { sent: Boolean(o.emailSent), error: o.emailError || null }); }
    }
    if (p === '/api/admin/catalog') { if (!body || typeof body.overrides !== 'object') return fail(res, 400, 'overrides object required'); for (const [rid, v] of Object.entries(body.overrides)) { if (!/^[a-z0-9_-]{1,40}$/.test(rid)) continue; if (v === null) { delete store.catalogOverrides[rid]; continue; } const o = {}; for (const k of ['name', 'nameZh', 'photo', 'cat', 'blurb']) if (valid(v[k])) o[k] = v[k]; if (typeof v.hidden === 'boolean') o.hidden = v.hidden; store.catalogOverrides[rid] = { ...(store.catalogOverrides[rid] || {}), ...o }; } await save(); adminLog(store, { action: 'catalog', keys: Object.keys(body.overrides) }); return send(res, 200, { overrides: store.catalogOverrides }); }
    if (p === '/api/admin/upload') {
      const mm = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(body.dataUrl || '')); if (!mm) return fail(res, 400, 'dataUrl must be a jpeg, png or webp image');
      const buf = Buffer.from(mm[2], 'base64'); if (buf.length > 2 * 1024 * 1024) return fail(res, 413, 'image over 2 MB');
      const dir = path.join(h.dataDir, 'uploads'); fs.mkdirSync(dir, { recursive: true }); const name = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16) + '.' + (mm[1] === 'jpeg' ? 'jpg' : mm[1]); fs.writeFileSync(path.join(dir, name), buf);
      adminLog(store, { action: 'upload', file: name }); await save(); return send(res, 201, { url: '/uploads/' + name });
    }
    return fail(res, 404, 'no such route');
  }
  /* webhooks: raw body, signature checked, no rate limit */
  if (req.method === 'POST' && p === '/api/webhooks/nowpayments') {
    const raw = await readRaw(req); if (!nowp.verifyIpn(raw, req.headers['x-nowpayments-sig'])) return fail(res, 401, 'bad signature');
    const j = JSON.parse(raw); const o = store.giftOrders[String(j.order_id || '')]; if (!o) return fail(res, 404, 'unknown order');
    o.pay.providerStatus = j.payment_status; if (nowp.PAID.has(j.payment_status)) await markPaid(o, { paidAmount: Number(j.actually_paid || 0) }, store, save); else if (j.payment_status === 'expired') { if (o.status === 'pending') o.status = 'expired'; await save(); } else await save();
    return send(res, 200, { ok: true });
  }
  if (req.method === 'POST' && p === '/api/webhooks/stripe') {
    const raw = await readRaw(req); const ev = stripe.verifyWebhook(raw, req.headers['stripe-signature']); if (!ev) return fail(res, 401, 'bad signature');
    if (ev.type === 'checkout.session.completed' || ev.type === 'checkout.session.async_payment_succeeded') { const s = ev.data && ev.data.object; const o = store.giftOrders[String((s.metadata && s.metadata.order_id) || s.client_reference_id || '')]; if (o && s.payment_status === 'paid') await markPaid(o, {}, store, save); }
    if (ev.type === 'checkout.session.expired') { const s = ev.data.object; const o = store.giftOrders[String((s.metadata && s.metadata.order_id) || '')]; if (o && o.status === 'pending') { o.status = 'expired'; await save(); } }
    return send(res, 200, { received: true });
  }
  /* public, POST */
  if (req.method !== 'POST') return fail(res, 404, 'no such route');
  if (limited(req)) return fail(res, 429, 'too many requests, slow down');
  let body; try { body = JSON.parse(await readRaw(req) || '{}'); } catch { return fail(res, 400, 'bad json'); }

  if (p === '/api/gifts/checkout') {
    if (!supplyReady()) return fail(res, 503, 'gift card supply is not configured on this deployment');
    const prod = CATALOG.find((x) => x.id === body.productId); const value = Number(body.value);
    if (!prod) return fail(res, 400, 'unknown product'); if (!prod.inStock) return fail(res, 409, 'out of stock');
    if (!(value > 0)) return fail(res, 400, 'bad value');
    if (prod.packages ? !prod.packages.some((k) => k.value === value) : (value < prod.min || value > prod.max)) return fail(res, 400, `value must be ${prod.packages ? 'one of ' + prod.packages.map((k) => k.value).join(', ') : `between ${prod.min} and ${prod.max}`}`);
    if (!isEmail(body.email)) return fail(res, 400, 'a valid recipient email is required');
    const method = String(body.method || ''); const avail = methods(); if (!avail[method]) return fail(res, 400, `payment method ${method || '(none)'} is not available`);
    try { await prices(); } catch (e) { return fail(res, 503, e.message); }
    const { faceUsd, priceUsd } = priceOf(prod, value);
    const s = sessionOf(req);
    const order = { id: crypto.randomBytes(12).toString('hex'), kind: 'gift', rid: prod.rid, productId: prod.id, name: prod.name, value, currency: prod.currency, faceUsd, priceUsd, margin: MARGIN,
      recipient: { email: body.email.trim(), message: valid(body.message) ? body.message.trim().slice(0, 300) : '' }, buyer: { address: s ? s.address : null, email: isEmail(body.buyerEmail) ? body.buyerEmail : body.email.trim() },
      pay: { method }, status: 'pending', createdAt: Date.now() };
    try {
      if (method === 'wallet') order.pay = { method, amounts: walletAmounts(priceUsd), expiresAt: Date.now() + 15 * 60 * 1000 };
      else if (method === 'crypto') { const cur = String(body.currency || 'btc').toLowerCase(); if (!/^[a-z0-9]{2,20}$/.test(cur)) return fail(res, 400, 'bad currency'); order.pay = { method, ...(await nowp.createPayment(order, cur, siteUrl(req) + '/api/webhooks/nowpayments')) }; }
      else if (method === 'card') order.pay = { method, ...(await stripe.createSession(order, siteUrl(req))) };
    } catch (e) { return fail(res, 502, e.message); }
    store.giftOrders[order.id] = order; await save();
    return send(res, 201, publicOrder(order));
  }
  if ((m = /^\/api\/gifts\/orders\/([a-f0-9]{24})\/tx$/.exec(p))) {
    const o = store.giftOrders[m[1]]; if (!o) return fail(res, 404, 'no such order');
    if (o.pay.method !== 'wallet') return fail(res, 400, 'not a wallet order'); if (o.status !== 'pending') return fail(res, 409, 'order is ' + o.status);
    const txHash = String(body.txHash || '').toLowerCase(); if (!/^0x[0-9a-f]{64}$/.test(txHash)) return fail(res, 400, 'bad tx hash');
    if (Object.values(store.giftOrders).some((x) => x.pay && x.pay.txHash === txHash)) return fail(res, 409, 'this transaction was already used');
    let paid; try { paid = await verifyPayment(o, txHash); } catch (e) { return fail(res, 402, e.message); }
    await markPaid(o, { token: paid.token, txHash, payer: paid.from, paidWei: paid.amount }, store, save);
    return send(res, 200, publicOrder(o));
  }
  if ((m = /^\/api\/gifts\/orders\/([a-f0-9]{24})\/claim$/.exec(p))) {
    /* attaches an order bought while signed out to the wallet now signed in */
    const o = store.giftOrders[m[1]]; const s = sessionOf(req); if (!o || !s) return fail(res, o ? 401 : 404, o ? 'sign in first' : 'no such order');
    if (!o.buyer.address) { o.buyer.address = s.address; await save(); } return send(res, 200, publicOrder(o));
  }
  return fail(res, 404, 'no such route');
}

module.exports = { shopApi, CATALOG, px, verifyPayment, isAdmin, _test: { USDT, TRANSFER } };
