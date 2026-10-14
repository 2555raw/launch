/* Shop backend: gift card catalog, checkout, payments (wallet on Solana,
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
const sol = require('./solana');
const nowp = require('./services/nowpayments');
const stripe = require('./services/stripe');
const email = require('./services/email');

const MARGIN = Number(process.env.GIFT_MARGIN ?? 0.04);
const DISCOUNT = Math.min(MARGIN, Math.max(0, Number(process.env.GIFT_WALLET_DISCOUNT ?? 0.02))); // off the margin when paying with a Solana wallet
const REF_SHARE = Math.min(1, Math.max(0, Number(process.env.GIFT_REF_SHARE ?? 0.25)));       // share of the margin paid to the referrer
const MERCHANT = sol.MERCHANT;
const BRAND = process.env.BRAND_NAME || 'Sol Bite';
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

/* ---- prices: SOL/USD and CAD/USD, cached 2 min ---- */
const px = { at: 0, sol: 0, cadPerUsd: 0 };
async function prices() {
  if (Date.now() - px.at < 120000 && px.sol) return px;
  try { const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana,tether&vs_currencies=usd,cad'); const j = await r.json(); const s = Number(j.solana?.usd); const cad = Number(j.tether?.cad) || Number(j.solana?.cad) / s; if (s > 0) { px.sol = s; px.cadPerUsd = cad > 0 ? cad : px.cadPerUsd || 1.37; px.at = Date.now(); } }
  catch (e) { console.error('prices', e.message); }
  if (!px.sol) throw new Error('no price feed');
  return px;
}
function priceOf(p, value, method) { const faceUsd = p.currency === 'CAD' ? value / px.cadPerUsd : value; const m = method === 'wallet' ? MARGIN - DISCOUNT : MARGIN; const priceUsd = Math.ceil(faceUsd * (1 + m) * 100) / 100; return { faceUsd: Math.round(faceUsd * 100) / 100, priceUsd, margin: m }; }
function walletAmounts(priceUsd) { const s = Math.ceil(priceUsd / px.sol * 1e6) / 1e6; return { SOL: { amount: s, lamports: String(Math.round(s * 1e9)) }, USDC: { amount: priceUsd, units: String(Math.round(priceUsd * 1e6)) } }; }

/* ---- on-chain payment check: a Solana transaction paying the merchant in SOL or USDC ---- */
const verifyPayment = (order, signature) => sol.verifyPayment(order, signature);

/* ---- orders ---- */
const valid = (s) => typeof s === 'string' && s.length < 400;
const isEmail = (s) => typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) && s.length < 200;
function publicOrder(o) {
  const pay = o.pay || {};
  return { id: o.id, rid: o.rid, productId: o.productId, name: o.name, value: o.value, currency: o.currency, faceUsd: o.faceUsd, priceUsd: o.priceUsd, margin: o.margin, discount: o.discount || 0, status: o.status, error: o.error || null, createdAt: o.createdAt, paidAt: o.paidAt || null, deliveredAt: o.deliveredAt || null, deliverAt: o.deliverAt || null, forMe: Boolean(o.forMe), ref: o.ref || null,
    recipient: o.recipient ? { email: o.recipient.email || null, message: o.recipient.message || '' } : null, buyer: o.buyer ? { address: o.buyer.address || null } : null,
    pay: { method: pay.method, token: pay.token || null, txHash: pay.signature || pay.txHash || null, signature: pay.signature || null, reference: pay.reference || null, payUrl: pay.payUrl || null, cluster: pay.cluster || null, provider: pay.provider || null, payAddress: pay.payAddress || null, payAmount: pay.payAmount || null, payCurrency: pay.payCurrency || null, network: pay.network || null, memo: pay.memo || null, url: pay.url || null, expiresAt: pay.expiresAt || null, amounts: pay.amounts || null, merchant: pay.method === 'wallet' ? MERCHANT : null, providerStatus: pay.providerStatus || null },
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
  if (order.deliverAt && Date.now() < order.deliverAt) return; // scheduled: the minute job sends it when due
  try { const m = email.giftEmail(order, BRAND, site || process.env.SITE_URL || ''); const to = order.recipient && order.recipient.email; if (to) { await email.send({ to, ...m }); order.emailSent = true; await save(); } }
  catch (e) { console.error('email', order.id, e.message); order.emailError = e.message; await save(); }
}
/* Minute job: scheduled emails that are now due, and pending orders that expired. */
function startJobs(store, save) {
  const tick = async () => { try {
    const now = Date.now();
    for (const o of Object.values(store.giftOrders || {})) {
      if (o.status === 'delivered' && !o.emailSent && o.deliverAt && o.deliverAt <= now && o.recipient && o.recipient.email) await deliverEmail(o, save);
      if (o.status === 'pending' && o.pay && o.pay.method === 'wallet' && o.pay.expiresAt && now > o.pay.expiresAt + 60 * 60 * 1000) { o.status = 'expired'; await save(); }
    }
  } catch (e) { console.error('gift jobs', e.message); } };
  const t = setInterval(tick, 60 * 1000); t.unref(); return tick;
}
/* Referral earnings for an address: a share of the margin on delivered orders it referred. */
function referrals(store, address) {
  const me = String(address || ''); const rows = Object.values(store.giftOrders || {}).filter((o) => o.ref === me);
  const delivered = rows.filter((o) => o.status === 'delivered');
  const earned = delivered.reduce((a, o) => a + Math.max(0, o.priceUsd - o.faceUsd) * REF_SHARE, 0);
  const paid = ((store.refPayouts || {})[me] || []).reduce((a, p) => a + Number(p.amountUsd || 0), 0);
  return { address: me, share: REF_SHARE, orders: rows.length, delivered: delivered.length, earnedUsd: Math.round(earned * 100) / 100, paidUsd: Math.round(paid * 100) / 100, pendingUsd: Math.round((earned - paid) * 100) / 100, payouts: (store.refPayouts || {})[me] || [],
    recent: delivered.slice(-10).reverse().map((o) => ({ at: o.deliveredAt || o.paidAt || o.createdAt, rid: o.rid, faceUsd: o.faceUsd, earnedUsd: Math.round(Math.max(0, o.priceUsd - o.faceUsd) * REF_SHARE * 100) / 100 })) };
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
    } else if (order.status === 'pending' && pay.method === 'wallet' && pay.reference && !pay.signature) {
      // Solana Pay: a wallet paid the QR; the transaction carries our reference key
      const sig = await sol.findReference(pay.reference, pay.cluster); if (sig) { const paid = await sol.verifyPayment(order, sig, pay.cluster); await markPaid(order, { token: paid.token, signature: sig, payer: paid.from, paidUnits: paid.amount }, store, save); }
      else if (pay.expiresAt && Date.now() > pay.expiresAt + 60 * 60 * 1000) { order.status = 'expired'; await save(); }
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
    return send(res, 200, { configured: supplyReady(), supply: supplyReady(), methods: methods(), test: bitrefill.TEST, sandbox: nowp.SANDBOX, merchant: MERCHANT || null, margin: MARGIN, walletDiscount: DISCOUNT, refShare: REF_SHARE, countries: [...new Set(CATALOG.map((x) => x.country))], brand: BRAND, email: email.configured(),
      products: CATALOG.map((x) => ({ rid: x.rid, id: x.id, name: x.name, country: x.country, currency: x.currency, min: x.min, max: x.max, step: x.step || 1, packages: x.packages && x.packages.map((k) => k.value), inStock: x.inStock, available: supplyReady() && x.inStock && Object.values(methods()).some(Boolean) })) });
  }
  if (req.method === 'GET' && p === '/api/gifts/currencies') return send(res, 200, { currencies: await nowp.currencies() });
  if (req.method === 'GET' && p === '/api/gifts/preview') {
    const q = url.searchParams; const prod = CATALOG.find((x) => x.rid === q.get('rid')) || CATALOG[0]; const value = Number(q.get('value')) || prod.min;
    const sample = { id: 'preview', name: prod.name, value, currency: prod.currency, recipient: { message: valid(q.get('message') || '') ? String(q.get('message') || '').slice(0, 300) : '' }, redemption: { code: '•••• •••• •••• ••••', instructions: 'The real code and redemption steps appear here once the order is paid.' } };
    const m = email.giftEmail(sample, BRAND, siteUrl(req));
    return send(res, 200, `<!doctype html><meta charset="utf-8"><title>${m.subject}</title><body style="margin:0;padding:16px;background:#f4f4f4">${m.html}</body>`, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; img-src https: data:" });
  }
  if (req.method === 'GET' && p === '/api/me/referrals') { const s = sessionOf(req); if (!s) return fail(res, 401, 'sign in first'); return send(res, 200, { ...referrals(store, s.address), link: siteUrl(req) + '/gifts?ref=' + s.address }); }
  if (req.method === 'GET' && p === '/api/catalog') return send(res, 200, { overrides: store.catalogOverrides });
  if (req.method === 'GET' && (m = /^\/api\/gifts\/orders\/([a-f0-9]{24})$/.exec(p))) {
    const o = store.giftOrders[m[1]]; if (!o) return fail(res, 404, 'no such order');
    await refresh(o, store, save, req); return send(res, 200, publicOrder(o));
  }
  if (req.method === 'GET' && p === '/api/me/orders') {
    const s = sessionOf(req); if (!s) return fail(res, 401, 'sign in first');
    const mine = Object.values(store.giftOrders).filter((o) => o.buyer && o.buyer.address === s.address).sort((a, b) => b.createdAt - a.createdAt);
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
    if (req.method === 'GET' && p === '/api/admin/referrals') { const by = {}; for (const o of Object.values(store.giftOrders)) if (o.ref) by[o.ref] = true; return send(res, 200, { share: REF_SHARE, referrers: Object.keys(by).map((a) => referrals(store, a)).sort((x, y) => y.pendingUsd - x.pendingUsd) }); }
    if (req.method === 'GET' && p === '/api/admin/orders') { const all = Object.values(store.giftOrders).sort((a, b) => b.createdAt - a.createdAt).slice(0, 500); return send(res, 200, { orders: all.map((o) => ({ ...publicOrder(o), recipient: o.recipient, buyer: o.buyer, redemption: o.redemption || null, fulfil: o.fulfil || null, notes: o.notes || [] })) }); }
    if (req.method !== 'POST') return fail(res, 404, 'no such route');
    let body; try { body = JSON.parse(await readRaw(req, 3 * 1024 * 1024) || '{}'); } catch { return fail(res, 400, 'bad json'); }
    if ((m = /^\/api\/admin\/orders\/([a-f0-9]{24})\/(retry|status|email)$/.exec(p))) {
      const o = store.giftOrders[m[1]]; if (!o) return fail(res, 404, 'no such order');
      if (m[2] === 'retry') { if (!['paid', 'failed', 'processing'].includes(o.status)) return fail(res, 409, 'only paid, processing or failed orders can be retried'); o.status = 'paid'; o.error = null; o.fulfil = null; await save(); await bitrefill.fulfil(o, CATALOG.find((x) => x.id === o.productId), save); await deliverEmail(o, save, siteUrl(req)); adminLog(store, { action: 'retry', order: o.id }); return send(res, 200, publicOrder(o)); }
      if (m[2] === 'status') { const allowed = ['pending', 'paid', 'processing', 'delivered', 'failed', 'expired', 'refunded']; if (!allowed.includes(body.status)) return fail(res, 400, 'bad status'); (o.notes ||= []).push({ at: Date.now(), from: o.status, to: body.status, note: valid(body.note) ? body.note : '' }); o.status = body.status; await save(); adminLog(store, { action: 'status', order: o.id, to: body.status }); return send(res, 200, publicOrder(o)); }
      if (m[2] === 'email') { o.emailSent = false; await deliverEmail(o, save, siteUrl(req)); return send(res, 200, { sent: Boolean(o.emailSent), error: o.emailError || null }); }
    }
    if ((m = /^\/api\/admin\/referrals\/([1-9A-HJ-NP-Za-km-z]{32,44})\/paid$/.exec(p))) { const amt = Number(body.amountUsd); if (!(amt > 0)) return fail(res, 400, 'amountUsd required'); ((store.refPayouts ||= {})[m[1]] ||= []).push({ at: Date.now(), amountUsd: Math.round(amt * 100) / 100, txHash: valid(body.txHash) ? body.txHash : null, note: valid(body.note) ? body.note : '' }); await save(); adminLog(store, { action: 'ref-payout', address: m[1], amountUsd: amt }); return send(res, 200, referrals(store, m[1])); }
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
    const s = sessionOf(req);
    const forMe = body.forMe === true && Boolean(s);
    if (!forMe && !isEmail(body.email)) return fail(res, 400, s ? 'a valid recipient email is required (or tick "keep it in my account")' : 'a valid recipient email is required');
    const method = String(body.method || ''); const avail = methods(); if (!avail[method]) return fail(res, 400, `payment method ${method || '(none)'} is not available`);
    let deliverAt = null; if (body.deliverAt) { deliverAt = new Date(body.deliverAt).getTime(); if (!Number.isFinite(deliverAt)) return fail(res, 400, 'bad deliverAt'); if (deliverAt > Date.now() + 366 * 24 * 3600 * 1000) return fail(res, 400, 'deliverAt must be within a year'); if (deliverAt < Date.now() + 60 * 1000) deliverAt = null; }
    const ref = sol.isPk(body.ref) && (!s || body.ref !== s.address) ? body.ref : null;
    try { await prices(); } catch (e) { return fail(res, 503, e.message); }
    const { faceUsd, priceUsd, margin } = priceOf(prod, value, method);
    const order = { id: crypto.randomBytes(12).toString('hex'), kind: 'gift', rid: prod.rid, productId: prod.id, name: prod.name, value, currency: prod.currency, faceUsd, priceUsd, margin, discount: method === 'wallet' ? DISCOUNT : 0, deliverAt, forMe, ref,
      recipient: { email: forMe ? (isEmail(body.email) ? body.email.trim() : null) : body.email.trim(), message: valid(body.message) ? body.message.trim().slice(0, 300) : '' }, buyer: { address: s ? s.address : null, email: isEmail(body.buyerEmail) ? body.buyerEmail : (isEmail(body.email) ? body.email.trim() : null) },
      pay: { method }, status: 'pending', createdAt: Date.now() };
    try {
      if (method === 'wallet') { order.pay = { method, amounts: walletAmounts(priceUsd), reference: sol.newReference(), cluster: sol.DEFAULT_CLUSTER, expiresAt: Date.now() + 15 * 60 * 1000 }; order.pay.payUrl = sol.payUrl(sol.DEFAULT_CLUSTER, order); }
      else if (method === 'crypto') { const cur = String(body.currency || 'btc').toLowerCase(); if (!/^[a-z0-9]{2,20}$/.test(cur)) return fail(res, 400, 'bad currency'); order.pay = { method, ...(await nowp.createPayment(order, cur, siteUrl(req) + '/api/webhooks/nowpayments')) }; }
      else if (method === 'card') order.pay = { method, ...(await stripe.createSession(order, siteUrl(req))) };
    } catch (e) { return fail(res, 502, e.message); }
    store.giftOrders[order.id] = order; await save();
    return send(res, 201, publicOrder(order));
  }
  if ((m = /^\/api\/gifts\/orders\/([a-f0-9]{24})\/tx$/.exec(p))) {
    const o = store.giftOrders[m[1]]; if (!o) return fail(res, 404, 'no such order');
    if (o.pay.method !== 'wallet') return fail(res, 400, 'not a wallet order'); if (o.status !== 'pending') return fail(res, 409, 'order is ' + o.status);
    const signature = String(body.signature || body.txHash || ''); if (!/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(signature)) return fail(res, 400, 'bad transaction signature');
    if (Object.values(store.giftOrders).some((x) => x.pay && x.pay.signature === signature)) return fail(res, 409, 'this transaction was already used');
    let paid; try { paid = await verifyPayment(o, signature); } catch (e) { return fail(res, 402, e.message); }
    await markPaid(o, { token: paid.token, signature, payer: paid.from, paidUnits: paid.amount }, store, save);
    return send(res, 200, publicOrder(o));
  }
  if ((m = /^\/api\/gifts\/orders\/([a-f0-9]{24})\/claim$/.exec(p))) {
    /* attaches an order bought while signed out to the wallet now signed in */
    const o = store.giftOrders[m[1]]; const s = sessionOf(req); if (!o || !s) return fail(res, o ? 401 : 404, o ? 'sign in first' : 'no such order');
    if (!o.buyer.address) { o.buyer.address = s.address; await save(); } return send(res, 200, publicOrder(o));
  }
  return fail(res, 404, 'no such route');
}

module.exports = { shopApi, CATALOG, px, verifyPayment, isAdmin, startJobs, referrals, deliverEmail, DISCOUNT, REF_SHARE };
