// Servidor FALSO de Stripe, SOLO para pruebas automáticas (e2e/integración).
//
// Imita lo mínimo de la API que usa la tienda (cupones, sesiones de Checkout,
// caducar sesión) y una "página de pago" con dos botones. Al pagar, envía a la
// tienda un webhook checkout.session.completed firmado exactamente como lo
// firma Stripe (HMAC-SHA256 con STRIPE_WEBHOOK_SECRET), así que la ruta real
// /api/webhooks/stripe lo verifica igual que en producción.
//
// La tienda solo habla con este servidor si STRIPE_API_BASE_URL apunta aquí y
// la clave es sk_test_... (ver src/lib/stripe/client.ts).
import { createHmac, randomBytes } from 'node:crypto'
import http from 'node:http'

const port = Number(process.env.FAKE_STRIPE_PORT ?? 12111)
const webhookUrl = process.env.WEBHOOK_URL ?? 'http://localhost:3000/api/webhooks/stripe'
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? 'whsec_test_local'

const sessions = new Map()
const coupons = new Map()
const id = (prefix) => `${prefix}_test_${randomBytes(12).toString('hex')}`

/** Convierte line_items[0][price_data][unit_amount]=1 en objetos anidados. */
function parseForm(body) {
  const out = {}
  for (const [rawKey, value] of new URLSearchParams(body)) {
    const keys = rawKey.split(/\[|\]\[|\]/).filter(Boolean)
    let node = out
    keys.forEach((k, i) => {
      const last = i === keys.length - 1
      const nextIsIndex = /^\d+$/.test(keys[i + 1] ?? '')
      if (last) node[k] = value
      else node = node[k] ??= nextIsIndex ? [] : {}
    })
  }
  return out
}

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

async function sendWebhook(type, object) {
  const event = { id: id('evt'), object: 'event', type, created: Math.floor(Date.now() / 1000), data: { object }, livemode: false, api_version: '2025-01-01' }
  const payload = JSON.stringify(event)
  const t = Math.floor(Date.now() / 1000)
  const signature = createHmac('sha256', webhookSecret).update(`${t}.${payload}`).digest('hex')
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'stripe-signature': `t=${t},v1=${signature}` },
    body: payload,
  })
  console.log(`[fake-stripe] webhook ${type} -> ${res.status} ${await res.text()}`)
  return res.status
}

const readBody = (req) =>
  new Promise((resolve) => {
    let data = ''
    req.on('data', (c) => (data += c))
    req.on('end', () => resolve(data))
  })

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`)
    const body = await readBody(req)

    if (url.pathname === '/health') return json(res, 200, { ok: true })

    if (req.method === 'POST' && url.pathname === '/v1/coupons') {
      const p = parseForm(body)
      const coupon = { id: id('co'), object: 'coupon', amount_off: Number(p.amount_off), currency: p.currency, duration: p.duration, valid: true }
      coupons.set(coupon.id, coupon)
      return json(res, 200, coupon)
    }

    if (req.method === 'POST' && url.pathname === '/v1/checkout/sessions') {
      const p = parseForm(body)
      const items = (p.line_items ?? []).map((li) => ({ amount: Number(li.price_data.unit_amount) * Number(li.quantity), name: li.price_data.product_data.name, quantity: Number(li.quantity) }))
      const shipping = Number(p.shipping_options?.[0]?.shipping_rate_data?.fixed_amount?.amount ?? 0)
      const discount = (p.discounts ?? []).reduce((s, d) => s + (coupons.get(d.coupon)?.amount_off ?? 0), 0)
      const subtotal = items.reduce((s, i) => s + i.amount, 0)
      const sid = id('cs')
      const session = {
        id: sid,
        object: 'checkout.session',
        mode: 'payment',
        status: 'open',
        payment_status: 'unpaid',
        amount_subtotal: subtotal,
        amount_total: subtotal - discount + shipping,
        currency: p.currency ?? 'eur',
        customer_email: p.customer_email,
        client_reference_id: p.client_reference_id,
        metadata: p.metadata ?? {},
        payment_intent: null,
        success_url: p.success_url,
        cancel_url: p.cancel_url,
        expires_at: Number(p.expires_at),
        url: `http://localhost:${port}/pay/${sid}`,
        _items: items,
        _shipping: shipping,
        _discount: discount,
      }
      sessions.set(sid, session)
      return json(res, 200, session)
    }

    const retrieve = url.pathname.match(/^\/v1\/checkout\/sessions\/([^/]+)$/)
    if (req.method === 'GET' && retrieve) {
      const s = sessions.get(retrieve[1])
      return s ? json(res, 200, s) : json(res, 404, { error: { type: 'invalid_request_error', message: 'No such checkout.session' } })
    }

    const expire = url.pathname.match(/^\/v1\/checkout\/sessions\/([^/]+)\/expire$/)
    if (req.method === 'POST' && expire) {
      const s = sessions.get(expire[1])
      if (!s) return json(res, 404, { error: { type: 'invalid_request_error', message: 'No such checkout.session' } })
      if (s.status === 'open') {
        s.status = 'expired'
        setTimeout(() => sendWebhook('checkout.session.expired', s), 50)
      }
      return json(res, 200, s)
    }

    const pay = url.pathname.match(/^\/pay\/([^/]+)(\/confirm)?$/)
    if (pay) {
      const s = sessions.get(pay[1])
      if (!s) {
        res.writeHead(404)
        return res.end('Sesión no encontrada')
      }
      if (req.method === 'POST' && pay[2]) {
        s.status = 'complete'
        s.payment_status = 'paid'
        s.payment_intent = id('pi')
        await sendWebhook('checkout.session.completed', s)
        res.writeHead(303, { location: s.success_url.replace('{CHECKOUT_SESSION_ID}', s.id) })
        return res.end()
      }
      const fmt = (c) => (c / 100).toFixed(2).replace('.', ',') + ' €'
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      return res.end(`<!doctype html><html lang="es"><meta charset="utf-8"><title>Stripe de pruebas</title>
<body style="font-family:system-ui;max-width:480px;margin:60px auto;padding:0 16px">
<p style="color:#635bff;font-weight:700">STRIPE FALSO · SOLO PRUEBAS</p>
<h1>Pagar ${fmt(s.amount_total)}</h1>
<ul>${s._items.map((i) => `<li>${i.name} × ${i.quantity}: ${fmt(i.amount)}</li>`).join('')}</ul>
<p>Envío: ${fmt(s._shipping)} · Descuento: −${fmt(s._discount)}</p>
<form method="post" action="/pay/${s.id}/confirm"><button id="pagar" style="font-size:18px;padding:12px 24px">Pagar</button></form>
<p><a id="cancelar" href="${s.cancel_url}">Volver a la tienda</a></p></body></html>`)
    }

    json(res, 404, { error: { type: 'invalid_request_error', message: `Ruta no soportada: ${req.method} ${url.pathname}` } })
  })
  .listen(port, () => console.log(`[fake-stripe] escuchando en :${port}`))
