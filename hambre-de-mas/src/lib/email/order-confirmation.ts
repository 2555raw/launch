import 'server-only'
import { site } from '@/lib/config/site'
import { formatPrice } from '@/lib/money'
import { formatOrderNumber } from '@/lib/orders/mapper'
import type { Order } from '@/lib/types'
import { sendEmail } from './send'

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

export async function sendOrderConfirmation(order: Order) {
  const number = formatOrderNumber(order.number)
  const rows = order.items
    .map(
      (i) =>
        `<tr><td style="padding:6px 0">${escape(i.productName)} · ${escape(i.variantName)} × ${i.quantity}</td><td style="padding:6px 0;text-align:right">${formatPrice(i.lineTotalCents)}</td></tr>`,
    )
    .join('')
  const a = order.shippingAddress
  const html = `<!doctype html><html lang="es"><body style="font-family:Inter,Arial,sans-serif;color:#1d1d1f;background:#f5f5f7;padding:24px">
<div style="max-width:560px;margin:auto;background:#fff;border-radius:18px;padding:32px">
<p style="color:#bf2d11;font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-size:12px">${escape(site.name)}</p>
<h1 style="font-size:26px;margin:8px 0 4px">¡Gracias, ${escape(order.customerName.split(' ')[0] ?? '')}!</h1>
<p style="color:#6e6e73">Hemos recibido el pago de tu pedido <strong>${number}</strong>. Te avisaremos cuando salga hacia tu casa.</p>
<table style="width:100%;border-collapse:collapse;margin:24px 0;font-size:14px">${rows}
<tr><td style="padding:6px 0;color:#6e6e73">Envío</td><td style="text-align:right;color:#6e6e73">${order.shippingCents ? formatPrice(order.shippingCents) : 'Gratis'}</td></tr>
${order.discountCents ? `<tr><td style="padding:6px 0;color:#6e6e73">Descuento</td><td style="text-align:right;color:#6e6e73">−${formatPrice(order.discountCents)}</td></tr>` : ''}
<tr><td style="padding:10px 0;font-weight:700;border-top:1px solid #e5e5ea">Total (IVA incl.)</td><td style="text-align:right;font-weight:700;border-top:1px solid #e5e5ea">${formatPrice(order.totalCents)}</td></tr></table>
<p style="font-size:14px;color:#6e6e73">Envío a: ${escape(a.fullName)}, ${escape(a.line1)}${a.line2 ? ', ' + escape(a.line2) : ''}, ${escape(a.postalCode)} ${escape(a.city)} (${escape(a.province)})</p>
<p style="font-size:14px"><a style="color:#bf2d11" href="${site.url}/cuenta/pedidos">Ver mis pedidos</a></p>
</div></body></html>`
  const text = `Gracias por tu pedido ${number}. Total: ${formatPrice(order.totalCents)}. Te avisaremos cuando salga hacia tu casa.`
  return sendEmail({ to: order.email, subject: `Pedido ${number} confirmado · ${site.name}`, html, text })
}
