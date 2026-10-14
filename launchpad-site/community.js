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
const sol = require('./evm');

const BRAND = process.env.BRAND_NAME || 'fork';
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
  return sol.poolInfo(cluster, r);
}

/* ---- status ---- */
const blocks = () => sol.slots();
const social = require('./services/social');
const SITE = () => (process.env.SITE_URL || '').replace(/\/$/, '');

/* ---- X bot: posts new coins and graduations once each (store.social.seen) ---- */
function coinView(r, cluster) { const dec = r.payDecimals; const u = (v) => Number(v) / 10 ** dec; return { brand: BRAND, cluster, address: r.address, name: r.name, symbol: r.symbol, restaurant: r.restaurant, unit: r.payMint ? (r.paySymbol || 'stock') : (cluster === '56' ? 'BNB' : 'tBNB'), target: u(r.target), raised: u(r.raised), closeAt: r.closeAt * 1000, openAt: r.openAt * 1000, graduated: r.graduated, finalized: r.finalized }; }
async function runSocial(store, save) {
  store.social ||= { seen: {}, log: [] }; const cluster = sol.DEFAULT_CLUSTER; let d; try { d = await sol.coins(cluster, store); } catch { return; }
  if (!d.coins.length) return; const now = Date.now(); let changed = false;
  for (const r of d.coins) {
    const c = coinView(r, cluster); const k = cluster + ':' + r.address;
    const events = []; if (now - c.openAt < 24 * 3600 * 1000 && !store.social.seen[k + ':launch']) events.push(['launch', social.launchText(c, SITE())]);
    if (c.graduated && !store.social.seen[k + ':graduated']) events.push(['graduated', social.graduatedText(c, SITE())]);
    for (const [kind, text] of events) {
      store.social.seen[k + ':' + kind] = now; changed = true;
      if (!social.configured()) continue;
      try { const r2 = await social.post(text); store.social.log.unshift({ at: now, kind, coin: r.address, id: r2.id || null, text }); } catch (e) { store.social.log.unshift({ at: now, kind, coin: r.address, error: e.message, text }); }
      store.social.log = store.social.log.slice(0, 50);
    }
  }
  if (changed) await save();
}

/* ---- weekly newsletter: digest of the week, one email per subscriber, unsubscribe by signed link ---- */
const NL_SECRET = () => process.env.NEWSLETTER_SECRET || process.env.ADMIN_KEY || 'fork-newsletter';
const nlToken = (email) => crypto.createHmac('sha256', NL_SECRET()).update(String(email).toLowerCase()).digest('hex').slice(0, 32);
const unsubUrl = (email) => `${SITE()}/api/newsletter/unsubscribe?e=${encodeURIComponent(email)}&t=${nlToken(email)}`;
async function digest(store) {
  const cluster = sol.DEFAULT_CLUSTER; let coins = []; try { coins = (await sol.coins(cluster, store)).coins.map((r) => coinView(r, cluster)); } catch {}
  const week = Date.now() - 7 * 24 * 3600 * 1000;
  const launched = coins.filter((c) => c.openAt > week).sort((a, b) => b.openAt - a.openAt);
  const graduated = coins.filter((c) => c.graduated).sort((a, b) => b.closeAt - a.closeAt).slice(0, 5);
  const closing = coins.filter((c) => !c.finalized && c.closeAt > Date.now() && c.closeAt < Date.now() + 7 * 24 * 3600 * 1000).sort((a, b) => a.closeAt - b.closeAt);
  const delivered = Object.values(store.giftOrders || {}).filter((o) => o.status === 'delivered' && o.createdAt > week).length;
  return { launched, graduated, closing, delivered, site: SITE(), at: Date.now() };
}
function digestHtml(d, email) {
  const row = (c, extra) => `<tr><td style="padding:8px 0;border-bottom:1px solid #eee"><a href="${esc(d.site)}/coin/${esc(c.cluster)}/${esc(c.address)}" style="color:#111;font-weight:600;text-decoration:none">$${esc(c.symbol)}</a> <span style="color:#555">· ${esc(c.name)} · ${esc(c.restaurant)}</span></td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;color:#555;font-family:ui-monospace,Menlo,monospace;font-size:13px">${esc(extra)}</td></tr>`;
  const sec = (title, rows) => rows.length ? `<h3 style="margin:22px 0 6px;font-size:15px">${esc(title)}</h3><table style="width:100%;border-collapse:collapse">${rows.join('')}</table>` : '';
  const fmt = (c) => `${c.target.toLocaleString('en-US', { maximumFractionDigits: 3 })} ${c.unit}`;
  const body = sec('New coins this week', d.launched.map((c) => row(c, 'target ' + fmt(c)))) + sec('Graduated', d.graduated.map((c) => row(c, `${c.raised.toLocaleString('en-US', { maximumFractionDigits: 3 })} ${c.unit} raised`))) + sec('Closing in the next 7 days', d.closing.map((c) => row(c, new Date(c.closeAt).toUTCString().slice(5, 16))));
  const empty = !d.launched.length && !d.graduated.length && !d.closing.length;
  return `<div style="font-family:system-ui,Segoe UI,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#111"><h2 style="margin:24px 0 4px">${esc(BRAND)} · this week</h2><p style="color:#555;margin:0 0 8px">${new Date(d.at).toUTCString().slice(0, 16)}</p>${empty ? `<p style="color:#333">Quiet week on the launchpad. <a href="${esc(d.site)}/launch" style="color:#111">Create the first coin</a> of the next one.</p>` : body}${d.delivered ? `<p style="color:#555;margin-top:20px">${d.delivered} gift card${d.delivered === 1 ? '' : 's'} delivered this week. <a href="${esc(d.site)}/gifts" style="color:#111">Gift cards for crypto</a>.</p>` : ''}<p style="color:#999;font-size:12px;margin-top:28px">You get this because you subscribed on ${esc(BRAND)}. <a href="${esc(unsubUrl(email))}" style="color:#999">Unsubscribe</a>.</p></div>`;
}
async function sendDigest(store, save, { to } = {}) {
  const d = await digest(store); const subs = to ? [{ email: to }] : (store.newsletter || []); let sent = 0, failed = 0;
  if (!email.configured()) return { sent: 0, failed: 0, reason: 'email not configured', subscribers: subs.length };
  for (const s of subs) { try { await email.send({ to: s.email, subject: `${BRAND} · this week on the launchpad`, html: digestHtml(d, s.email), text: `${BRAND} weekly digest. New: ${d.launched.map((c) => c.symbol).join(', ') || 'none'}. Unsubscribe: ${unsubUrl(s.email)}` }); sent++; } catch (e) { failed++; console.error('digest', s.email, e.message); } }
  if (!to) { store.newsletterLastSent = Date.now(); await save(); }
  return { sent, failed, subscribers: subs.length };
}
function digestDue(store) { const day = Number(process.env.NEWSLETTER_DAY ?? 1); const now = new Date(); const last = store.newsletterLastSent || 0; return now.getUTCDay() === day && now.getUTCHours() >= 9 && Date.now() - last > 6 * 24 * 3600 * 1000 && (store.newsletter || []).length > 0; }

function startJobs(store, save) {
  const t = setInterval(() => runAlerts(store, save).catch((e) => console.error('alerts', e.message)), 2 * 60 * 1000); t.unref();
  const t2 = setInterval(() => runSocial(store, save).catch((e) => console.error('social', e.message)), 5 * 60 * 1000); t2.unref();
  const t3 = setInterval(() => { if (digestDue(store)) sendDigest(store, save).then((r) => console.log('newsletter digest', JSON.stringify(r))).catch((e) => console.error('digest', e.message)); }, 60 * 60 * 1000); t3.unref();
}

async function communityApi(req, res, url, h) {
  const { send, fail, limited, store, save, sessionOf, readJson, isAdmin, shop } = h; const p = url.pathname; let m;
  store.comments ||= {}; store.alerts ||= []; store.newsletter ||= []; store.support ||= []; store.poolSamples ||= {};
  if (req.method === 'GET') {
    if ((m = /^\/api\/comments\/(0x[0-9a-fA-F]{40})$/.exec(p))) { const rows = store.comments[m[1]] || []; return send(res, 200, { comments: rows.slice(-100).map((c) => ({ id: c.id, address: c.address, text: c.text, at: c.at })) }); }
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
      return send(res, 200, { brand: BRAND, time: Date.now(), uptimeSec: Math.round(process.uptime()), supply: shop.supply(), methods: shop.methods(), email: email.configured(), social: social.configured(), newsletterLastSent: store.newsletterLastSent || null, chains: Object.fromEntries(Object.keys(sol.CLUSTERS).map((c) => [c, { block: b[c], factory: (sol.programOf(c, store) || { toBase58: () => null }).toBase58(), ok: b[c] != null }])), cluster: sol.DEFAULT_CLUSTER, ordersDelivered: delivered.length, ordersPending: orders.filter((o) => ['pending', 'paid', 'processing'].includes(o.status)).length, lastDelivered: delivered.slice(-10).reverse().map((o) => ({ rid: o.rid, value: o.value, currency: o.currency, at: o.deliveredAt || o.paidAt || o.createdAt, method: o.pay && o.pay.method })), alerts: store.alerts.length, subscribers: store.newsletter.length }, { 'cache-control': 'public, max-age=30' });
    }
    if (p === '/api/newsletter/unsubscribe') {
      const e = String(url.searchParams.get('e') || '').toLowerCase(); const t = String(url.searchParams.get('t') || ''); const ok = e && t.length === 32 && crypto.timingSafeEqual(Buffer.from(t), Buffer.from(nlToken(e)));
      if (ok) { const before = store.newsletter.length; store.newsletter = store.newsletter.filter((x) => x.email.toLowerCase() !== e); if (store.newsletter.length !== before) await save(); }
      res.writeHead(ok ? 200 : 400, { 'content-type': 'text/html; charset=utf-8' }); return res.end(`<!doctype html><meta charset="utf-8"><title>${esc(BRAND)}</title><body style="font-family:system-ui,sans-serif;background:#0B0B10;color:#fff;display:grid;place-items:center;height:100vh;margin:0"><div style="text-align:center"><h1 style="font-size:22px">${ok ? 'Unsubscribed' : 'Invalid link'}</h1><p style="color:#aaa">${ok ? 'You will not get the weekly digest any more.' : 'This unsubscribe link is not valid.'}</p><p><a href="/" style="color:#fff">Back to ${esc(BRAND)}</a></p></div>`);
    }
    if (p.startsWith('/api/admin/')) {
      if (!isAdmin(req)) return fail(res, 401, 'admin key required');
      if (p === '/api/admin/newsletter') return send(res, 200, { subscribers: store.newsletter });
      if (p === '/api/admin/newsletter.csv') return send(res, 200, 'email,lang,at\n' + store.newsletter.map((s) => `${s.email},${s.lang || ''},${new Date(s.at).toISOString()}`).join('\n') + '\n', { 'content-type': 'text/csv; charset=utf-8' });
      if (p === '/api/admin/support') return send(res, 200, { requests: store.support.slice().reverse() });
      if (p === '/api/admin/alerts') return send(res, 200, { alerts: store.alerts });
      if (p === '/api/admin/social') { store.social ||= { seen: {}, log: [] }; return send(res, 200, { configured: social.configured(), log: store.social.log.slice(0, 20), seen: Object.keys(store.social.seen).length }); }
      if (p === '/api/admin/newsletter/preview') { const d = await digest(store); res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(digestHtml(d, 'you@example.com')); }
    }
    return fail(res, 404, 'no such route');
  }
  if (req.method !== 'POST') return fail(res, 404, 'no such route');
  if (p.startsWith('/api/admin/')) {
    if (!isAdmin(req)) return fail(res, 401, 'admin key required');
    let body; try { body = await readJson(req, 64 * 1024); } catch (e) { return fail(res, 400, e.message); }
    if ((m = /^\/api\/admin\/comments\/(0x[0-9a-fA-F]{40})\/([a-f0-9]{16})\/delete$/.exec(p))) { const k = m[1]; store.comments[k] = (store.comments[k] || []).filter((c) => c.id !== m[2]); await save(); return send(res, 200, { ok: true }); }
    if ((m = /^\/api\/admin\/support\/([a-f0-9]{16})\/status$/.exec(p))) { const r = store.support.find((x) => x.id === m[1]); if (!r) return fail(res, 404, 'no such request'); if (!['open', 'answered', 'closed'].includes(body.status)) return fail(res, 400, 'bad status'); r.status = body.status; r.note = typeof body.note === 'string' ? body.note.slice(0, 500) : r.note; await save(); return send(res, 200, r); }
    if (p === '/api/admin/alerts/run') { await runAlerts(store, save); return send(res, 200, { ok: true, alerts: store.alerts.length }); }
    if (p === '/api/admin/social/test') { const text = String(body.text || `${BRAND} is live: restaurant gift cards for crypto and a BNB Chain launchpad where every coin is paired with a real restaurant stock. ${SITE()}`).slice(0, 280); try { const r = await social.post(text); store.social ||= { seen: {}, log: [] }; store.social.log.unshift({ at: Date.now(), kind: 'test', id: r.id || null, text, posted: r.posted, reason: r.reason }); await save(); return send(res, 200, r); } catch (e) { return fail(res, 502, e.message); } }
    if (p === '/api/admin/social/run') { await runSocial(store, save); return send(res, 200, { ok: true }); }
    if (p === '/api/admin/newsletter/send') { const r = await sendDigest(store, save, { to: body.to && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.to) ? body.to : undefined }); return send(res, 200, r); }
    return fail(res, 404, 'no such route');
  }
  if (limited(req)) return fail(res, 429, 'too many requests, slow down');
  let body; try { body = await readJson(req, 16 * 1024); } catch (e) { return fail(res, 400, e.message); }
  if ((m = /^\/api\/comments\/(0x[0-9a-fA-F]{40})$/.exec(p))) {
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

module.exports = { communityApi, startJobs, runAlerts, runSocial, digest, digestHtml, sendDigest, nlToken, news, poolPrice };
