/* Bitrefill supply: live product data, invoice from account balance, order
 * polling. BITREFILL_API_KEY (Bearer) or BITREFILL_API_ID + _SECRET (Basic). */
'use strict';
const API = process.env.BITREFILL_API || 'https://api.bitrefill.com/v2';
const TEST = /^(1|true|yes)$/i.test(process.env.GIFT_TEST || '');
function auth() {
  if (process.env.BITREFILL_API_KEY) return 'Bearer ' + process.env.BITREFILL_API_KEY;
  if (process.env.BITREFILL_API_ID && process.env.BITREFILL_API_SECRET) return 'Basic ' + Buffer.from(`${process.env.BITREFILL_API_ID}:${process.env.BITREFILL_API_SECRET}`).toString('base64');
  return null;
}
const configured = () => Boolean(auth());
async function br(method, path, body) {
  const res = await fetch(API + path, { method, headers: { authorization: auth(), 'content-type': 'application/json', accept: 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`bitrefill ${res.status} ${j.message || j.error_code || ''}`.trim());
  return j.data ?? j;
}
const live = { at: 0, pending: null };
async function refreshCatalog(CATALOG) {
  if (!auth() || Date.now() - live.at < 15 * 60 * 1000) return;
  if (live.pending) return live.pending;
  live.pending = (async () => {
    for (const p of CATALOG) {
      try {
        const d = await br('GET', `/products/${encodeURIComponent(p.id)}`);
        p.inStock = d.in_stock !== false; p.currency = d.currency || p.currency; if (d.image) p.image = d.image;
        if (Array.isArray(d.packages) && d.packages.length) p.packages = d.packages.map((k) => ({ id: k.id, value: Number(k.value), price: Number(k.price) }));
        if (d.range && d.range.min != null) { p.min = Number(d.range.min); p.max = Number(d.range.max); p.step = Number(d.range.step) || 1; }
      } catch (e) { console.error('bitrefill: product', p.id, e.message); }
    }
    live.at = Date.now(); live.pending = null;
  })();
  return live.pending;
}
/* Creates the invoice (paid from balance) and polls the order. Mutates `order`. */
async function fulfil(order, product, save) {
  if (order.fulfil && order.fulfil.started) return pollOrder(order, save);
  order.fulfil = { started: Date.now() }; order.status = 'processing'; await save();
  try {
    const item = TEST ? { product_id: 'test-gift-card-code', value: order.value, quantity: 1 } : { product_id: product.id, quantity: 1 };
    if (!TEST) { const pk = product.packages && product.packages.find((k) => k.value === order.value); if (pk) item.package_id = pk.id; else item.value = order.value; }
    const inv = await br('POST', '/invoices', { products: [item], payment_method: 'balance', auto_pay: true });
    order.fulfil.invoiceId = inv.id; order.fulfil.bitrefillOrderId = inv.orders && inv.orders[0] && inv.orders[0].id; await save();
    await pollOrder(order, save);
  } catch (e) { order.status = 'failed'; order.error = e.message; console.error('bitrefill: fulfil', order.id, e.message); await save(); }
}
async function pollOrder(order, save, rounds = 10) {
  const oid = order.fulfil && order.fulfil.bitrefillOrderId; if (!oid || order.status !== 'processing') return;
  for (let i = 0; i < rounds; i++) {
    let o; try { o = await br('GET', `/orders/${encodeURIComponent(oid)}`); } catch (e) { console.error('bitrefill: poll', e.message); return; }
    if (o.status === 'delivered') {
      const ri = o.redemption_info; order.redemption = typeof ri === 'string' ? { instructions: ri } : (ri || {});
      if (o.product && o.product._href) order.redemption.link = order.redemption.link || o.product._href;
      order.status = 'delivered'; order.deliveredAt = Date.now(); await save(); return;
    }
    if (o.status === 'failed' || o.status === 'refunded') { order.status = 'failed'; order.error = 'bitrefill ' + o.status; await save(); return; }
    await new Promise((r) => setTimeout(r, 2000));
  }
}
async function balance() { const d = await br('GET', '/accounts/balance'); return d; }
module.exports = { configured, refreshCatalog, fulfil, pollOrder, balance, TEST };
