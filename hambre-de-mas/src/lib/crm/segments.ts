import { commerce } from '@/lib/config/commerce'
import type { CrmCustomer, Segment } from './types'

const DAY = 86_400_000

/** Reglas de los segmentos (también se explican en la pantalla). */
export const SEGMENT_RULES = {
  vipSpentCents: 15000,
  vipOrders: 4,
  newDays: 30,
  riskDays: 60,
}

export const SEGMENTS: { key: Segment; label: string; hint: string; tone: string }[] = [
  { key: 'vip', label: 'VIP', hint: `Han gastado ${SEGMENT_RULES.vipSpentCents / 100} € o más, o tienen ${SEGMENT_RULES.vipOrders}+ pedidos`, tone: 'bg-ink text-white' },
  { key: 'recurrente', label: 'Recurrentes', hint: 'Han repetido: 2 pedidos o más', tone: 'bg-hoja/20 text-hoja-deep' },
  { key: 'nuevo', label: 'Nuevos', hint: `Primer pedido en los últimos ${SEGMENT_RULES.newDays} días`, tone: 'bg-almendra text-teja' },
  { key: 'una-compra', label: 'Una compra', hint: `Un solo pedido, hace más de ${SEGMENT_RULES.newDays} días`, tone: 'bg-white text-ink ring-1 ring-line' },
  { key: 'en-riesgo', label: 'En riesgo', hint: `Sin comprar desde hace más de ${SEGMENT_RULES.riskDays} días`, tone: 'bg-chef-ink text-white' },
  { key: 'sin-compras', label: 'Sin compras', hint: 'Con cuenta o newsletter, pero aún no han comprado', tone: 'bg-mist text-ash-ink' },
]

export function customerStats(c: CrmCustomer, now = new Date()) {
  const orders = [...c.orders].sort((a, b) => b.date.localeCompare(a.date))
  const spentCents = orders.reduce((s, o) => s + o.totalCents, 0)
  const last = orders[0] ? new Date(orders[0].date) : null
  const first = orders.at(-1) ? new Date(orders.at(-1)!.date) : null
  const daysSinceLast = last ? Math.floor((now.getTime() - last.getTime()) / DAY) : null
  // Nivel que más compra (por unidades)
  const levels = new Map<string, { level: number | null; units: number }>()
  for (const o of orders)
    for (const i of o.items) {
      if (!i.levelName) continue
      const cur = levels.get(i.levelName) ?? { level: i.level, units: 0 }
      levels.set(i.levelName, { level: cur.level, units: cur.units + i.quantity })
    }
  const favorite = [...levels.entries()].sort((a, b) => b[1].units - a[1].units)[0]
  return {
    orderCount: orders.length,
    spentCents,
    avgTicketCents: orders.length ? Math.round(spentCents / orders.length) : 0,
    lastOrder: last,
    firstOrder: first,
    daysSinceLast,
    favoriteLevel: favorite ? { name: favorite[0], level: favorite[1].level } : null,
  }
}

export function segmentsOf(c: CrmCustomer, now = new Date()): Segment[] {
  const s = customerStats(c, now)
  if (s.orderCount === 0) return ['sin-compras']
  const out: Segment[] = []
  if (s.spentCents >= SEGMENT_RULES.vipSpentCents || s.orderCount >= SEGMENT_RULES.vipOrders) out.push('vip')
  if (s.orderCount >= 2) out.push('recurrente')
  if (s.firstOrder && now.getTime() - s.firstOrder.getTime() <= SEGMENT_RULES.newDays * DAY && s.orderCount === 1) out.push('nuevo')
  if (s.daysSinceLast != null && s.daysSinceLast > SEGMENT_RULES.riskDays) out.push('en-riesgo')
  if (s.orderCount === 1 && !out.includes('nuevo') && !out.includes('en-riesgo')) out.push('una-compra')
  return out
}

/** Siguiente paso recomendado para cada cliente, con el email ya escrito. */
export function nextAction(c: CrmCustomer, now = new Date()): { title: string; subject: string; body: string } | null {
  const segments = segmentsOf(c, now)
  const s = customerStats(c, now)
  const first = c.name.split(' ')[0] ?? c.name
  const next =
    s.favoriteLevel?.level === 1 ? 'Con ganas' : s.favoriteLevel?.level === 2 ? 'Hambre de más' : null
  if (segments.includes('sin-compras'))
    return {
      title: 'Darle un empujón para el primer pedido',
      subject: 'Tu primer kit, con un 10 % de descuento',
      body: `Hola ${first}:\n\nPara tu primer pedido tienes un 10 % de descuento con el código BIENVENIDA10. Si no sabes por dónde empezar, el test de nivel te recomienda un kit en un minuto.\n\nUn saludo,\nHambre de Más`,
    }
  if (segments.includes('en-riesgo'))
    return {
      title: 'Recuperar al cliente: hace tiempo que no compra',
      subject: '¡Te echamos de menos en la cocina!',
      body: `Hola ${first}:\n\nHace un tiempo que no cocinamos juntos. Tienes 5 € de descuento en pedidos desde 40 € con el código HAMBRE5. Hay kits nuevos esperándote.\n\nUn saludo,\nHambre de Más`,
    }
  if (segments.includes('vip'))
    return {
      title: 'Agradecerle y proponerle la caja sorpresa',
      subject: 'Gracias por cocinar tanto con nosotros',
      body: `Hola ${first}:\n\nGracias por tus pedidos. Como ya conoces bien los kits, te proponemos la caja sorpresa: un kit nuevo cada mes que no está en la tienda.\n\nUn saludo,\nHambre de Más`,
    }
  if (segments.includes('una-compra'))
    return {
      title: 'Animarle a repetir con un pack',
      subject: '¿Repetimos?',
      body: `Hola ${first}:\n\n¿Qué tal tu kit? Si te llevas ${commerce.bundleMinKits} kits del mismo nivel, tienes un ${commerce.bundlePercent} % de descuento automático en la cesta.${next ? ` Y si quieres subir de nivel, te esperan los kits ${next}.` : ''}\n\nUn saludo,\nHambre de Más`,
    }
  if (segments.includes('nuevo'))
    return {
      title: next ? `Proponerle el siguiente nivel: ${next}` : 'Preguntarle qué tal su primer kit',
      subject: next ? `¿Listo para ${next}?` : '¿Qué tal tu primer kit?',
      body: next
        ? `Hola ${first}:\n\n¿Qué tal salió tu primer kit? Si te ha gustado, el siguiente paso es ${next}: recetas un poco más retadoras, con todo medido igual.\n\nUn saludo,\nHambre de Más`
        : `Hola ${first}:\n\n¿Qué tal salió tu primer kit? Nos ayudaría mucho que nos dejaras tu opinión en la ficha del producto.\n\nUn saludo,\nHambre de Más`,
    }
  return null
}

/** Cifras generales del CRM. */
export function crmKpis(customers: CrmCustomer[], now = new Date()) {
  const buyers = customers.filter((c) => c.orders.length > 0)
  const orders = buyers.reduce((n, c) => n + c.orders.length, 0)
  const revenue = buyers.reduce((n, c) => n + customerStats(c, now).spentCents, 0)
  const count = (seg: Segment) => customers.filter((c) => segmentsOf(c, now).includes(seg)).length
  return {
    customers: customers.length,
    buyers: buyers.length,
    repeatRate: buyers.length ? buyers.filter((c) => c.orders.length >= 2).length / buyers.length : 0,
    avgTicketCents: orders ? Math.round(revenue / orders) : 0,
    avgValueCents: buyers.length ? Math.round(revenue / buyers.length) : 0,
    revenueCents: revenue,
    bySegment: Object.fromEntries(SEGMENTS.map((s) => [s.key, count(s.key)])) as Record<Segment, number>,
    openTasks: customers.reduce((n, c) => n + c.tasks.filter((t) => !t.done).length, 0),
  }
}
