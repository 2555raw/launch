/* X (Twitter) posting through the v2 API with OAuth 1.0a user context.
 * Needs X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET (an app with
 * read+write on the account that will post). Without them nothing is posted
 * and the status page says so. */
'use strict';
const crypto = require('crypto');
const ENV = () => ({ key: process.env.X_API_KEY || '', secret: process.env.X_API_SECRET || '', token: process.env.X_ACCESS_TOKEN || '', tokenSecret: process.env.X_ACCESS_SECRET || '' });
const API = process.env.X_API || 'https://api.x.com/2';
const configured = () => { const e = ENV(); return Boolean(e.key && e.secret && e.token && e.tokenSecret); };
const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

/* OAuth 1.0a Authorization header for a request (body is JSON, so only the oauth_* params are signed) */
function oauthHeader(method, url, { nonce, timestamp } = {}) {
  const e = ENV();
  const p = { oauth_consumer_key: e.key, oauth_nonce: nonce || crypto.randomBytes(16).toString('hex'), oauth_signature_method: 'HMAC-SHA1', oauth_timestamp: timestamp || String(Math.floor(Date.now() / 1000)), oauth_token: e.token, oauth_version: '1.0' };
  const base = [method.toUpperCase(), enc(url), enc(Object.keys(p).sort().map((k) => `${enc(k)}=${enc(p[k])}`).join('&'))].join('&');
  const sig = crypto.createHmac('sha1', `${enc(e.secret)}&${enc(e.tokenSecret)}`).update(base).digest('base64');
  return 'OAuth ' + Object.entries({ ...p, oauth_signature: sig }).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${enc(k)}="${enc(v)}"`).join(', ');
}
async function post(text) {
  if (!configured()) return { posted: false, reason: 'not configured' };
  const url = API + '/tweets';
  const r = await fetch(url, { method: 'POST', headers: { authorization: oauthHeader('POST', url), 'content-type': 'application/json' }, body: JSON.stringify({ text: String(text).slice(0, 280) }), signal: AbortSignal.timeout(10000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`x ${r.status} ${(j.detail || j.title || '')}`.trim());
  return { posted: true, id: j.data && j.data.id };
}
/* copy for the two events the watcher posts about */
const fmtAmt = (v, unit) => `${Number(v).toLocaleString('en-US', { maximumFractionDigits: 4 })} ${unit}`;
function launchText(c, site) { return `New coin on ${c.brand}: $${c.symbol} (${c.name}), paired with ${c.restaurant}. Raise paid in ${c.unit}, target ${fmtAmt(c.target, c.unit)}, closes ${new Date(c.closeAt).toUTCString().slice(0, 16)}.\n${site}/coin/${c.cluster}/${c.address}`; }
function graduatedText(c, site) { return `$${c.symbol} graduated: ${fmtAmt(c.raised, c.unit)} raised, pool open, buyers can claim.\n${site}/coin/${c.cluster}/${c.address}`; }
module.exports = { configured, oauthHeader, post, launchText, graduatedText };
