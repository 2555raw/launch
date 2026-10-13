/* NOWPayments: pay in 300+ cryptocurrencies. The visitor gets an address and
 * an amount in the coin they chose; NOWPayments confirms on its side, calls
 * our IPN and we also poll. NOWPAYMENTS_API_KEY, NOWPAYMENTS_IPN_SECRET,
 * NOWPAYMENTS_SANDBOX=1 to use the sandbox. */
'use strict';
const crypto = require('crypto');
const SANDBOX = /^(1|true|yes)$/i.test(process.env.NOWPAYMENTS_SANDBOX || '');
const API = process.env.NOWPAYMENTS_API || (SANDBOX ? 'https://api-sandbox.nowpayments.io/v1' : 'https://api.nowpayments.io/v1');
const KEY = process.env.NOWPAYMENTS_API_KEY || '';
const IPN = process.env.NOWPAYMENTS_IPN_SECRET || '';
const configured = () => Boolean(KEY);
async function np(method, path, body) {
  const res = await fetch(API + path, { method, headers: { 'x-api-key': KEY, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`nowpayments ${res.status} ${j.message || j.code || ''}`.trim());
  return j;
}
/* A curated, ordered list of popular coins with display names; anything else
 * NOWPayments supports is still accepted by code. */
const POPULAR = [['btc', 'Bitcoin'], ['eth', 'Ethereum'], ['usdttrc20', 'USDT (Tron)'], ['usdterc20', 'USDT (Ethereum)'], ['usdtbsc', 'USDT (BNB Chain)'], ['usdc', 'USDC'], ['bnbbsc', 'BNB'], ['sol', 'Solana'], ['xrp', 'XRP'], ['ltc', 'Litecoin'], ['doge', 'Dogecoin'], ['trx', 'Tron'], ['ton', 'Toncoin'], ['ada', 'Cardano'], ['matic', 'Polygon'], ['avax', 'Avalanche'], ['dot', 'Polkadot'], ['xmr', 'Monero'], ['shib', 'Shiba Inu'], ['dai', 'DAI']];
const cur = { at: 0, list: [] };
async function currencies() {
  if (!KEY) return [];
  if (Date.now() - cur.at < 60 * 60 * 1000 && cur.list.length) return cur.list;
  try { const j = await np('GET', '/currencies'); const set = new Set((j.currencies || []).map((c) => String(c).toLowerCase())); cur.list = POPULAR.filter(([c]) => set.has(c)).map(([code, name]) => ({ code, name })); cur.at = Date.now(); }
  catch (e) { console.error('nowpayments: currencies', e.message); if (!cur.list.length) cur.list = POPULAR.map(([code, name]) => ({ code, name })); }
  return cur.list;
}
async function estimate(usd, currency) { const j = await np('GET', `/estimate?amount=${usd}&currency_from=usd&currency_to=${encodeURIComponent(currency)}`); return Number(j.estimated_amount); }
async function createPayment(order, currency, ipnUrl) {
  const j = await np('POST', '/payment', { price_amount: order.priceUsd, price_currency: 'usd', pay_currency: currency, order_id: order.id, order_description: `${order.name} gift card ${order.value} ${order.currency}`, ipn_callback_url: ipnUrl || undefined, is_fixed_rate: true });
  return { provider: 'nowpayments', providerId: String(j.payment_id), payAddress: j.pay_address, payAmount: Number(j.pay_amount), payCurrency: j.pay_currency, network: j.network || null, memo: j.payin_extra_id || null, expiresAt: j.expiration_estimate_date ? Date.parse(j.expiration_estimate_date) : Date.now() + 20 * 60 * 1000, status: j.payment_status };
}
async function status(paymentId) { const j = await np('GET', `/payment/${encodeURIComponent(paymentId)}`); return { status: j.payment_status, actuallyPaid: Number(j.actually_paid || 0), payAmount: Number(j.pay_amount || 0), outcome: j.outcome_amount }; }
/* IPN signature: HMAC-SHA512 of the JSON body with keys sorted. */
function verifyIpn(rawBody, sig) {
  if (!IPN || !sig) return false;
  let obj; try { obj = JSON.parse(rawBody); } catch { return false; }
  const sorted = JSON.stringify(sortKeys(obj)); const h = crypto.createHmac('sha512', IPN).update(sorted).digest('hex');
  try { return crypto.timingSafeEqual(Buffer.from(h), Buffer.from(String(sig))); } catch { return false; }
}
function sortKeys(v) { if (Array.isArray(v)) return v.map(sortKeys); if (v && typeof v === 'object') return Object.keys(v).sort().reduce((o, k) => { o[k] = sortKeys(v[k]); return o; }, {}); return v; }
const PAID = new Set(['finished', 'confirmed', 'sending']);
module.exports = { configured, currencies, estimate, createPayment, status, verifyIpn, PAID, SANDBOX };
