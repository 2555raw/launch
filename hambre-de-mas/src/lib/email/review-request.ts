import 'server-only'
import { site } from '@/lib/config/site'
import { formatOrderNumber } from '@/lib/orders/mapper'
import type { Order } from '@/lib/types'
import { sendEmail } from './send'

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

/** Email que pide opinión de cada kit del pedido, con enlace directo a la sección de opiniones. */
export function buildReviewRequestEmail(order: Order) {
  const en = order.locale === 'en'
  const tr = (es: string, english: string) => (en ? english : es)
  const firstName = escape(order.customerName.split(' ')[0] ?? '')
  const products = [...new Map(order.items.filter((i) => i.productSlug).map((i) => [i.productSlug!, i])).values()]
  const link = (slug: string) => `${site.url}/producto/${slug}#opiniones`
  const rows = products
    .map(
      (i) =>
        `<tr><td style="padding:10px 0;border-top:1px solid #e5e5ea">${escape(i.productName)}</td><td style="padding:10px 0;border-top:1px solid #e5e5ea;text-align:right"><a href="${link(i.productSlug!)}" style="display:inline-block;background:#d63327;color:#fff;text-decoration:none;border-radius:999px;padding:8px 16px;font-weight:600;font-size:14px">${tr('Opinar', 'Review')}</a></td></tr>`,
    )
    .join('')
  const subject = tr(`¿Qué tal te ha salido, ${order.customerName.split(' ')[0]}?`, `How did it turn out, ${order.customerName.split(' ')[0]}?`)
  const html = `<!doctype html><html lang="${order.locale}"><body style="font-family:Inter,Arial,sans-serif;color:#1d1d1f;background:#f5f5f7;padding:24px">
<div style="max-width:560px;margin:auto;background:#fff;border-radius:18px;padding:32px">
<p style="color:#bf2d11;font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-size:12px">${escape(site.name)}</p>
<h1 style="font-size:26px;margin:8px 0 4px">${tr(`¿Qué tal te ha salido, ${firstName}?`, `How did it turn out, ${firstName}?`)}</h1>
<p style="color:#6e6e73">${tr(
    `Tu pedido <strong>${formatOrderNumber(order.number)}</strong> ya está en casa. Cuéntanos qué tal la receta: tu opinión ayuda a otros a elegir su kit y a nosotros a mejorarlo.`,
    `Your order <strong>${formatOrderNumber(order.number)}</strong> has arrived. Tell us how the recipe went: your review helps others pick their kit and helps us improve it.`,
  )}</p>
<table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:15px">${rows}</table>
<p style="font-size:13px;color:#6e6e73">${tr(
    'Para opinar, entra con el email con el que hiciste la compra. Solo publicamos opiniones de compras verificadas.',
    'To leave a review, sign in with the email you used to order. We only publish reviews from verified purchases.',
  )}</p>
</div></body></html>`
  const text = [
    tr(`¿Qué tal te ha salido, ${order.customerName.split(' ')[0]}?`, `How did it turn out, ${order.customerName.split(' ')[0]}?`),
    '',
    tr(`Tu pedido ${formatOrderNumber(order.number)} ya está en casa. Cuéntanos qué tal:`, `Your order ${formatOrderNumber(order.number)} has arrived. Tell us how it went:`),
    ...products.map((i) => `- ${i.productName}: ${link(i.productSlug!)}`),
  ].join('\n')
  return { to: order.email, subject, html, text }
}

export async function sendReviewRequest(order: Order) {
  return sendEmail(buildReviewRequestEmail(order))
}
