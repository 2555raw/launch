/* Sends the one-time sign-in codes. Resend is the default transport
 * (RESEND_API_KEY + EMAIL_FROM); without a key the email tab says so and the
 * other two doors still work. */
const KEY = process.env.RESEND_API_KEY || '';
const FROM = process.env.EMAIL_FROM || 'seekr <seek@seekr.website>';

const configured = () => Boolean(KEY);

async function sendCode(to, code, purpose) {
  if (!KEY) throw Object.assign(new Error('Email codes are not set up on this server yet. Use a username or a wallet.'), { status: 503 });
  const subject = purpose === 'link' ? `Your seekr code to add this email: ${code}` : `Your seekr sign-in code: ${code}`;
  const text = `${code}\n\nThis code ${purpose === 'link' ? 'adds this email to your seekr account' : 'signs you in to seekr'}. It works once and expires in 10 minutes.\nIf you did not ask for it, ignore this email.`;
  const html = `<div style="font-family:system-ui,sans-serif;max-width:420px;margin:auto;padding:24px"><p style="font-size:15px;color:#333">Your seekr code</p><p style="font-size:34px;font-weight:700;letter-spacing:6px;margin:8px 0 16px">${code}</p><p style="font-size:13px;color:#666">It ${purpose === 'link' ? 'adds this email to your account' : 'signs you in'}, works once and expires in 10 minutes. If you did not ask for it, ignore this email.</p></div>`;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], subject, text, html })
  });
  if (!r.ok) {
    let msg = `Could not send the email (${r.status})`;
    try { const j = await r.json(); msg = j.message || msg; } catch { /* keep msg */ }
    throw Object.assign(new Error(msg), { status: 502 });
  }
}

module.exports = { configured, sendCode };
