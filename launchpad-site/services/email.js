/* Transactional email through Resend (RESEND_API_KEY, MAIL_FROM). Without a
 * key nothing is sent and the order page remains the delivery channel. */
'use strict';
const KEY = process.env.RESEND_API_KEY || '';
const FROM = process.env.MAIL_FROM || 'BNB Bite <orders@example.com>';
const API = process.env.RESEND_API || 'https://api.resend.com';
const configured = () => Boolean(KEY);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
async function send({ to, subject, html, text }) {
  if (!KEY || !to) return { sent: false, reason: KEY ? 'no recipient' : 'not configured' };
  const res = await fetch(API + '/emails', { method: 'POST', headers: { authorization: 'Bearer ' + KEY, 'content-type': 'application/json' }, body: JSON.stringify({ from: FROM, to: [to], subject, html, text }) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`resend ${res.status} ${j.message || ''}`.trim());
  return { sent: true, id: j.id };
}
function giftEmail(order, brand, siteUrl) {
  const rd = order.redemption || {}; const money = `${order.value} ${order.currency}`;
  const html = `<div style="font-family:system-ui,Segoe UI,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#111">
    <h2 style="margin:24px 0 8px">${esc(brand)} · ${esc(order.name)} gift card</h2>
    <p style="color:#555;margin:0 0 20px">Value <b>${esc(money)}</b>${order.recipient && order.recipient.message ? ` · a message from the sender:</p><blockquote style="border-left:3px solid #F0B90B;margin:0 0 20px;padding:8px 14px;color:#333">${esc(order.recipient.message)}</blockquote><p>` : '</p>'}
    ${rd.code ? `<p style="font-size:13px;color:#555;margin:0 0 4px">Card code</p><p style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:22px;letter-spacing:.04em;margin:0 0 12px">${esc(rd.code)}${rd.pin ? ` · PIN ${esc(rd.pin)}` : ''}</p>` : ''}
    ${rd.instructions ? `<p style="white-space:pre-wrap;color:#333">${esc(rd.instructions)}</p>` : ''}
    ${rd.link ? `<p><a href="${esc(rd.link)}">Redemption page</a></p>` : ''}
    <p style="color:#777;font-size:13px;margin-top:28px">Order ${esc(order.id)} · <a href="${esc(siteUrl)}/?order=${esc(order.id)}">view on ${esc(brand)}</a>. Gift cards are issued by Bitrefill and are final. Keep this email: codes cannot be re-issued.</p></div>`;
  const text = `${brand} · ${order.name} gift card ${money}\n${rd.code ? 'Code: ' + rd.code + (rd.pin ? ' PIN ' + rd.pin : '') + '\n' : ''}${rd.instructions || ''}\n${rd.link || ''}\nOrder ${order.id}`;
  return { subject: `Your ${order.name} gift card (${money})`, html, text };
}
module.exports = { configured, send, giftEmail };
