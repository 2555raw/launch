/* Stripe Checkout for card payments: the card form lives on Stripe's hosted
 * page, nothing sensitive touches this server. STRIPE_SECRET_KEY,
 * STRIPE_WEBHOOK_SECRET. Test keys (sk_test_…) work the same way. */
'use strict';
const crypto = require('crypto');
const KEY = process.env.STRIPE_SECRET_KEY || '';
const WH = process.env.STRIPE_WEBHOOK_SECRET || '';
const API = process.env.STRIPE_API || 'https://api.stripe.com/v1';
const configured = () => Boolean(KEY);
const form = (obj, prefix = '') => Object.entries(obj).flatMap(([k, v]) => { const key = prefix ? `${prefix}[${k}]` : k; return v && typeof v === 'object' ? form(v, key) : [`${encodeURIComponent(key)}=${encodeURIComponent(v)}`]; }).join('&');
async function st(method, path, body) {
  const res = await fetch(API + path, { method, headers: { authorization: 'Bearer ' + KEY, 'content-type': 'application/x-www-form-urlencoded' }, body: body ? form(body) : undefined });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`stripe ${res.status} ${(j.error && j.error.message) || ''}`.trim());
  return j;
}
async function createSession(order, baseUrl) {
  const s = await st('POST', '/checkout/sessions', { mode: 'payment', 'line_items[0]': { quantity: 1, price_data: { currency: 'usd', unit_amount: Math.round(order.priceUsd * 100), product_data: { name: `${order.name} gift card · ${order.value} ${order.currency}` } } },
    success_url: `${baseUrl}/?order=${order.id}&session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${baseUrl}/?order=${order.id}&cancelled=1`, client_reference_id: order.id, 'metadata[order_id]': order.id, customer_email: order.buyer && order.buyer.email || undefined });
  return { provider: 'stripe', providerId: s.id, url: s.url, expiresAt: (s.expires_at || 0) * 1000 || Date.now() + 24 * 3600 * 1000 };
}
async function getSession(id) { const s = await st('GET', `/checkout/sessions/${encodeURIComponent(id)}`); return { paid: s.payment_status === 'paid', status: s.status, orderId: (s.metadata && s.metadata.order_id) || s.client_reference_id }; }
function verifyWebhook(rawBody, header) {
  if (!WH || !header) return null;
  const parts = Object.fromEntries(String(header).split(',').map((p) => p.split('=')));
  const t = parts.t, v1 = parts.v1; if (!t || !v1) return null;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return null;
  const h = crypto.createHmac('sha256', WH).update(`${t}.${rawBody}`).digest('hex');
  try { if (!crypto.timingSafeEqual(Buffer.from(h), Buffer.from(v1))) return null; } catch { return null; }
  try { return JSON.parse(rawBody); } catch { return null; }
}
module.exports = { configured, createSession, getSession, verifyWebhook };
