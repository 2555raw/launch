/* Community and content endpoints: comments per coin (signed-in wallets),
 * email alerts per coin (graduation, refund, closing soon), newsletter,
 * support requests, a public status, restaurant news headlines (Google News
 * RSS, cached) and the built-in pool price of graduated coins (sampled on
 * demand, kept as a small history per coin).
 *
 * State: store.comments, store.alerts, store.newsletter, store.support,
 * store.poolSamples. Alerts are emailed through services/email when
 * RESEND_API_KEY is set; without it they are stored and nothing is sent. */
'use strict';
const crypto = require('crypto');
const email = require('./services/email');
const sol = require('./solana');

const BRAND = process.env.BRAND_NAME || 'Sol Bite';
const SUPPORT_EMAIL = (process.env.SUPPORT_EMAIL || '').trim();
const isEmail = (s) => typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) && s.length < 200;
const isAddr = (s) => sol.isPk(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/* ---- alerts: the watcher reads the coin index ---- */
async function raiseInfo(cluster, addr, store) {
  const d = await sol.coins(cluster, store); const r = d.coins.find((x) => x.address === addr); if (!r) throw new Error('no such coin');
  return { token: r.coinMint, payToken: r.payMint, name: r.name, symbol: r.symbol, closeAt: r.closeAt * 1000, closedAt: r.closedAt * 1000, finalized: r.finalized, graduated: r.graduated };
}
function alertMail(kind, a, info, site) {
  const link = `${site}/coin/${a.chain}/${a.coin}`; // chain = cluster
  const subj = { graduated: `${info.symbol} graduated`, refund: `${info.symbol} closed below its minimum: refunds are open`, closing: `${info.symbol} closes in less than 2 hours` }[kind];
  const body = { graduated: `${info.name} (${info.symbol}) reached its target and graduated: the pool is live and buyers can claim their tokens.`, refund: `${info.name} (${info.symbol}) closed without reaching its minimum. Everyone who bought can get a full refund from the contract.`, closing: `${info.name} (${info.symbol}) closes in less than two hours.` }[kind];
  return { subject: `${BRAND} · ${subj}`, html: `<div style="font-family:system-ui,Segoe UI,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#111"><h2 style="margin:24px 0 8px">${esc(subj)}</h2><p style="color:#333">${esc(body)}</p><p><a href="${esc(link)}" style="display:inline-block;background:#F0B90B;color:#111;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:600">Open ${esc(info.symbol)} on ${esc(BRAND)}</a></p><p style="color:#777;font-size:13px;margin-top:28px">You asked for this alert on ${esc(BRAND)}. Coins are unaudited contracts created by users; nothing here is financial advice.</p></div>`, text: `${subj}\n\n${body}\n${link}` };
}
async function runAlerts(store, save) {
  const list = store.alerts || []; if (!list.length) return;
  const keys = new Map(); for (const a of list) keys.set(a.chain + ':' + a.coin, a);
  const site = (process.env.SITE_URL || '').replace(/\/$/, '');
  for (const key of keys.keys()) {
    const [chain, coin] = key.split(':'); let info; try { info = await raiseInfo(chain, coin, store); } catch { continue; }
    const now = Date.now(); const kinds = [];
    if (info.finalized) kinds.push(info.graduated ? 'graduated' : 'refund');
    else if (!info.closedAt && info.closeAt - now > 0 && info.closeAt - now < 2 * 3600 * 1000) kinds.push('closing');
    if (!kinds.length) continue;
    for (const a of list.filter((x) => x.chain === chain && x.coin === coin)) {
      for (const k of kinds) { if (a.sent[k]) continue; a.sent[k] = now; if (email.configured()) { try { await email.send({ to: a.email, ...alertMail(k, a, info, site) }); } catch (e) { console.error('alert', e.message); } } }
    }
    await save();
  }
}

/* ---- news: Google News RSS, 30-minute cache ---- */
const NEWS = new Map();
async function news(q) {
  const k = q.toLowerCase(); const c = NEWS.get(k); if (c && Date.now() - c.at < 30 * 60 * 1000) return c.items;
  try {
    const r = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; SolBite/1.0)' }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(String(r.status)); const xml = await r.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 6).map((m) => { const x = m[1]; const g = (tag) => { const mm = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`).exec(x); return mm ? mm[1].trim() : ''; }; return { title: g('title').replace(/\s+-\s+[^-]+$/, ''), link: g('link'), at: Date.parse(g('pubDate')) || null, source: g('source') }; }).filter((i) => i.title && i.link);
    NEWS.set(k, { at: Date.now(), items }); return items;
  } catch (e) { if (c) return c.items; NEWS.set(k, { at: Date.now() - 25 * 60 * 1000, items: [] }); return []; }
}

/* ---- built-in pool price of a graduated coin (reserves live in the Raise account) ---- */
async function poolPrice(cluster, raise, store) {
  const d = await sol.coins(cluster, store); const r = d.coins.find((x) => x.address === raise); if (!r) throw new Error('no such coin'); if (!r.graduated) return { graduated: false };
  const coin = Number(r.poolCoin) / 1e6; const pay = Number(r.poolPay) / 10 ** r.payDecimals; const price = coin > 0 ? pay / coin : 0;
  return { graduated: true, pair: r.address, price, unit: r.payMint ? null : 'SOL', payToken: r.payMint, liquidity: pay, marketCap: price * 1e9, token: r.coinMint, symbol: r.symbol };
}

/* ---- status ---- */
const blocks = () => sol.slots();

function startJobs(store, save) {
  const t = setInterval(() => runAlerts(store, save).catch((e) => console.error('alerts', e.message)), 2 * 60 * 1000); t.unref();
}

async function communityApi(req, res, url, h) {
  const { send, fail, limited, store, save, sessionOf, readJson, isAdmin, shop } = h; const p = url.pathname; let m;
  store.comments ||= {}; store.alerts ||= []; store.newsletter ||= []; store.support ||= []; store.poolSamples ||= {};
  if (req.method === 'GET') {
    if ((m = /^\/api\/comments\/([1-9A-HJ-NP-Za-km-z]{32,44})$/.exec(p))) { const rows = store.comments[m[1]] || []; return send(res, 200, { comments: rows.slice(-100).map((c) => ({ id: c.id, address: c.address, text: c.text, at: c.at })) }); }
    if (p === '/api/alerts/count') { const coin = String(url.searchParams.get('coin') || ''); return send(res, 200, { count: store.alerts.filter((a) => a.coin === coin).length }); }
    if (p === '/api/news') { const q = String(url.searchParams.get('q') || '').trim().slice(0, 60); if (q.length < 2) return fail(res, 400, 'q required'); return send(res, 200, { items: await news(q) }, { 'cache-control': 'public, max-age=600' }); }
    if (p === '/api/pool') {
      const chain = sol.cluster(url.searchParams.get('chain') || url.searchParams.get('cluster')); const raise = String(url.searchParams.get('raise') || ''); if (!isAddr(raise)) return fail(res, 400, 'raise required');
      const key = chain + ':' + raise; const hist = store.poolSamples[key] || []; const last = hist[hist.length - 1];
      let cur; try { cur = await poolPrice(chain, raise, store); } catch (e) { return fail(res, 502, e.message); } if (cur.graduated && cur.price > 0 && (!last || Date.now() - last[0] > 5 * 60 * 1000)) { hist.push([Date.now(), cur.price]); if (hist.length > 600) hist.splice(0, hist.length - 600); store.poolSamples[key] = hist; await save(); }
      return send(res, 200, { ...cur, points: hist }, { 'cache-control': 'public, max-age=60' });
    }
    if (p === '/api/status') {
      const b = await blocks(); const orders = Object.values(store.giftOrders || {}); const delivered = orders.filter((o) => o.status === 'delivered');
      return send(res, 200, { brand: BRAND, time: Date.now(), uptimeSec: Math.round(process.uptime()), supply: shop.supply(), methods: shop.methods(), email: email.configured(), chains: Object.fromEntries(Object.keys(sol.CLUSTERS).map((c) => [c, { block: b[c], factory: (sol.programOf(c, store) || { toBase58: () => null }).toBase58(), ok: b[c] != null }])), cluster: sol.DEFAULT_CLUSTER, ordersDelivered: delivered.length, ordersPending: orders.filter((o) => ['pending', 'paid', 'processing'].includes(o.status)).length, lastDelivered: delivered.slice(-10).reverse().map((o) => ({ rid: o.rid, value: o.value, currency: o.currency, at: o.deliveredAt || o.paidAt || o.createdAt, method: o.pay && o.pay.method })), alerts: store.alerts.length, subscribers: store.newsletter.length }, { 'cache-control': 'public, max-age=30' });
    }
    if (p.startsWith('/api/admin/')) {
      if (!isAdmin(req)) return fail(res, 401, 'admin key required');
      if (p === '/api/admin/newsletter') return send(res, 200, { subscribers: store.newsletter });
      if (p === '/api/admin/newsletter.csv') return send(res, 200, 'email,lang,at\n' + store.newsletter.map((s) => `${s.email},${s.lang || ''},${new Date(s.at).toISOString()}`).join('\n') + '\n', { 'content-type': 'text/csv; charset=utf-8' });
      if (p === '/api/admin/support') return send(res, 200, { requests: store.support.slice().reverse() });
      if (p === '/api/admin/alerts') return send(res, 200, { alerts: store.alerts });
    }
    return fail(res, 404, 'no such route');
  }
  if (req.method !== 'POST') return fail(res, 404, 'no such route');
  if (p.startsWith('/api/admin/')) {
    if (!isAdmin(req)) return fail(res, 401, 'admin key required');
    let body; try { body = await readJson(req, 64 * 1024); } catch (e) { return fail(res, 400, e.message); }
    if ((m = /^\/api\/admin\/comments\/([1-9A-HJ-NP-Za-km-z]{32,44})\/([a-f0-9]{16})\/delete$/.exec(p))) { const k = m[1]; store.comments[k] = (store.comments[k] || []).filter((c) => c.id !== m[2]); await save(); return send(res, 200, { ok: true }); }
    if ((m = /^\/api\/admin\/support\/([a-f0-9]{16})\/status$/.exec(p))) { const r = store.support.find((x) => x.id === m[1]); if (!r) return fail(res, 404, 'no such request'); if (!['open', 'answered', 'closed'].includes(body.status)) return fail(res, 400, 'bad status'); r.status = body.status; r.note = typeof body.note === 'string' ? body.note.slice(0, 500) : r.note; await save(); return send(res, 200, r); }
    if (p === '/api/admin/alerts/run') { await runAlerts(store, save); return send(res, 200, { ok: true, alerts: store.alerts.length }); }
    return fail(res, 404, 'no such route');
  }
  if (limited(req)) return fail(res, 429, 'too many requests, slow down');
  let body; try { body = await readJson(req, 16 * 1024); } catch (e) { return fail(res, 400, e.message); }
  if ((m = /^\/api\/comments\/([1-9A-HJ-NP-Za-km-z]{32,44})$/.exec(p))) {
    const s = sessionOf(req); if (!s) return fail(res, 401, 'sign in with your wallet to comment');
    const text = typeof body.text === 'string' ? body.text.trim().replace(/\s+/g, ' ') : ''; if (text.length < 1 || text.length > 500) return fail(res, 400, 'comment must be 1 to 500 characters');
    const k = m[1]; const rows = (store.comments[k] ||= []); const last = rows.filter((c) => c.address === s.address).pop(); if (last && Date.now() - last.at < 20 * 1000) return fail(res, 429, 'one comment every 20 seconds');
    const c = { id: crypto.randomBytes(8).toString('hex'), address: s.address, text, at: Date.now() }; rows.push(c); if (rows.length > 500) rows.splice(0, rows.length - 500); await save();
    return send(res, 201, c);
  }
  if (p === '/api/alerts') {
    if (!isEmail(body.email)) return fail(res, 400, 'a valid email is required'); const coin = String(body.coin || ''); const chain = sol.cluster(body.chain || body.cluster); if (!isAddr(coin)) return fail(res, 400, 'coin address required');
    const e = body.email.trim().toLowerCase(); let a = store.alerts.find((x) => x.email === e && x.coin === coin && x.chain === chain);
    if (!a) { a = { id: crypto.randomBytes(8).toString('hex'), email: e, coin, chain, at: Date.now(), sent: {} }; store.alerts.push(a); await save(); }
    return send(res, 201, { ok: true, id: a.id, willEmail: email.configured() });
  }
  if (p === '/api/newsletter') {
    if (!isEmail(body.email)) return fail(res, 400, 'a valid email is required'); const e = body.email.trim().toLowerCase();
    if (!store.newsletter.some((x) => x.email === e)) { store.newsletter.push({ email: e, lang: ['en', 'zh', 'es'].includes(body.lang) ? body.lang : 'en', at: Date.now() }); await save(); }
    return send(res, 201, { ok: true });
  }
  if (p === '/api/support') {
    const subject = typeof body.subject === 'string' ? body.subject.trim().slice(0, 120) : ''; const message = typeof body.message === 'string' ? body.message.trim().slice(0, 4000) : '';
    if (!isEmail(body.email) || message.length < 5) return fail(res, 400, 'email and a message are required');
    const r = { id: crypto.randomBytes(8).toString('hex'), email: body.email.trim(), subject: subject || '(no subject)', message, order: typeof body.order === 'string' && /^[a-f0-9]{24}$/.test(body.order) ? body.order : null, at: Date.now(), status: 'open' };
    store.support.push(r); await save();
    if (SUPPORT_EMAIL && email.configured()) { try { await email.send({ to: SUPPORT_EMAIL, subject: `[${BRAND} support] ${r.subject}`, html: `<p><b>From:</b> ${esc(r.email)}${r.order ? ` · order ${esc(r.order)}` : ''}</p><p style="white-space:pre-wrap">${esc(r.message)}</p>`, text: `From: ${r.email}\n${r.order ? 'Order ' + r.order + '\n' : ''}\n${r.message}` }); r.forwarded = true; await save(); } catch (e) { console.error('support mail', e.message); } }
    return send(res, 201, { ok: true, id: r.id });
  }
  return fail(res, 404, 'no such route');
}

module.exports = { communityApi, startJobs, runAlerts, news, poolPrice };
