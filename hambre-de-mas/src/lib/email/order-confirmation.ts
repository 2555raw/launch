import 'server-only'
import { site } from '@/lib/config/site'
import type { Locale } from '@/lib/i18n/config'
import { formatPrice } from '@/lib/money'
import { formatOrderNumber } from '@/lib/orders/mapper'
import type { Order } from '@/lib/types'
import { sendEmail } from './send'

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

export async function sendOrderConfirmation(order: Order, locale: Locale = 'es') {
  const en = locale === 'en'
  const tr = (es: string, english: string) => (en ? english : es)
  const price = (cents: number) => formatPrice(cents, locale)
  const number = formatOrderNumber(order.number)
  const rows = order.items
    .map(
      (i) =>
        `<tr><td style="padding:6px 0">${escape(i.productName)} · ${escape(i.variantName)} × ${i.quantity}</td><td style="padding:6px 0;text-align:right">${price(i.lineTotalCents)}</td></tr>`,
    )
    .join('')
  const a = order.shippingAddress
  const firstName = escape(order.customerName.split(' ')[0] ?? '')
  const html = `<!doctype html><html lang="${locale}"><body style="font-family:Inter,Arial,sans-serif;color:#1d1d1f;background:#f5f5f7;padding:24px">
<div style="max-width:560px;margin:auto;background:#fff;border-radius:18px;padding:32px">
<p style="color:#bf2d11;font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-size:12px">${escape(site.name)}</p>
<h1 style="font-size:26px;margin:8px 0 4px">${tr(`¡Gracias, ${firstName}!`, `Thanks, ${firstName}!`)}</h1>
<p style="color:#6e6e73">${tr(
    `Hemos recibido el pago de tu pedido <strong>${number}</strong>. Te avisaremos cuando salga hacia tu casa.`,
    `We've received payment for your order <strong>${number}</strong>. We'll let you know when it's on its way.`,
  )}</p>
<table style="width:100%;border-collapse:collapse;margin:24px 0;font-size:14px">${rows}
<tr><td style="padding:6px 0;color:#6e6e73">${tr('Envío', 'Shipping')}</td><td style="text-align:right;color:#6e6e73">${order.shippingCents ? price(order.shippingCents) : tr('Gratis', 'Free')}</td></tr>
${order.discountCents ? `<tr><td style="padding:6px 0;color:#6e6e73">${tr('Descuento', 'Discount')}</td><td style="text-align:right;color:#6e6e73">−${price(order.discountCents)}</td></tr>` : ''}
<tr><td style="padding:10px 0;font-weight:700;border-top:1px solid #e5e5ea">${tr('Total (IVA incl.)', 'Total (VAT incl.)')}</td><td style="text-align:right;font-weight:700;border-top:1px solid #e5e5ea">${price(order.totalCents)}</td></tr></table>
<p style="font-size:14px;color:#6e6e73">${tr('Envío a', 'Shipping to')}: ${escape(a.fullName)}, ${escape(a.line1)}${a.line2 ? ', ' + escape(a.line2) : ''}, ${escape(a.postalCode)} ${escape(a.city)} (${escape(a.province)})</p>
<p style="font-size:14px"><a style="color:#bf2d11" href="${site.url}/cuenta/pedidos">${tr('Ver mis pedidos', 'See my orders')}</a></p>
</div></body></html>`
  const text = tr(
    `Gracias por tu pedido ${number}. Total: ${price(order.totalCents)}. Te avisaremos cuando salga hacia tu casa.`,
    `Thanks for your order ${number}. Total: ${price(order.totalCents)}. We'll let you know when it's on its way.`,
  )
  const subject = tr(`Pedido ${number} confirmado · ${site.name}`, `Order ${number} confirmed · ${site.name}`)
  return sendEmail({ to: order.email, subject, html, text })
}
