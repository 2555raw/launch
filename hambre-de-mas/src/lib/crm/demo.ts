import 'server-only'
import { demoCategories, demoProducts } from '@/data/demo-catalog'
import { customerId } from './id'
import type { CrmCustomer, CrmOrder } from './types'

/**
 * Clientes de EJEMPLO para enseñar el CRM en la vista previa (sin base de
 * datos). Los nombres son inventados y los emails usan example.com, un dominio
 * reservado que no pertenece a nadie. Las fechas son relativas a hoy, así los
 * segmentos (nuevos, en riesgo…) tienen sentido cualquier día.
 */

const FIRST = ['Lucía', 'Martín', 'Sofía', 'Hugo', 'Paula', 'Daniel', 'Carmen', 'Javier', 'Elena', 'Pablo', 'Marta', 'Álvaro', 'Laura', 'Diego', 'Irene', 'Sergio', 'Nerea', 'Adrián', 'Claudia', 'Raúl', 'Alba', 'Mario', 'Sara', 'Iker', 'Noa', 'Rubén', 'Julia', 'Marcos', 'Carla', 'Óscar', 'Inés', 'Gonzalo', 'Ainhoa', 'Bruno', 'Vega', 'Nicolás', 'Lola', 'Andrés', 'Olivia']
const LAST = ['García', 'López', 'Martín', 'Sánchez', 'Romero', 'Navarro', 'Torres', 'Gil', 'Ruiz', 'Molina', 'Ortega', 'Castro', 'Vidal', 'Rubio', 'Serrano', 'Ramos', 'Iglesias', 'Delgado', 'Marín', 'Cano']
const PLACES: [string, string][] = [
  ['Madrid', 'Madrid'], ['Barcelona', 'Barcelona'], ['Valencia', 'Valencia'], ['Sevilla', 'Sevilla'], ['Málaga', 'Málaga'], ['Bilbao', 'Bizkaia'],
  ['Zaragoza', 'Zaragoza'], ['Murcia', 'Murcia'], ['Alicante', 'Alicante'], ['A Coruña', 'A Coruña'], ['Oviedo', 'Asturias'], ['Granada', 'Granada'],
  ['Valladolid', 'Valladolid'], ['Pamplona', 'Navarra'], ['Salamanca', 'Salamanca'], ['Santander', 'Cantabria'], ['Palma', 'Illes Balears'], ['Getafe', 'Madrid'],
]
const TAGS = ['vegetariano', 'alergia frutos secos', 'compra para su hijo/a', 'regalo', 'gym', 'sin gluten', 'le encanta lo picante']

/** Tipo de cliente: cuántos pedidos y hace cuántos días el último / el primero. */
type Profile = { kind: string; orders: [number, number]; lastDays: [number, number]; spanDays: number }
const PROFILES: [Profile, number][] = [
  [{ kind: 'vip', orders: [4, 7], lastDays: [2, 20], spanDays: 300 }, 6],
  [{ kind: 'recurrente', orders: [2, 3], lastDays: [3, 45], spanDays: 150 }, 9],
  [{ kind: 'nuevo', orders: [1, 1], lastDays: [1, 25], spanDays: 0 }, 8],
  [{ kind: 'riesgo', orders: [1, 3], lastDays: [70, 200], spanDays: 120 }, 7],
  [{ kind: 'ocasional', orders: [1, 1], lastDays: [35, 55], spanDays: 0 }, 4],
  [{ kind: 'sin-compras', orders: [0, 0], lastDays: [0, 0], spanDays: 0 }, 5],
]

function random(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const DAY = 86_400_000
const slugify = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function demoCrmCustomers(now = new Date()): CrmCustomer[] {
  const rand = random(20261109)
  const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)]!
  const between = ([a, b]: [number, number]) => a + Math.floor(rand() * (b - a + 1))
  // Hoy a mediodía: el mismo resultado durante todo el día
  const today = new Date(now)
  today.setHours(12, 0, 0, 0)
  const level = new Map(demoCategories.map((c) => [c.slug, c]))
  const kits = demoProducts.filter((p) => !p.attributes.preorder)
  let orderNumber = 1040

  const customers: CrmCustomer[] = []
  let n = 0
  for (const [profile, count] of PROFILES) {
    for (let k = 0; k < count; k++, n++) {
      const first = FIRST[n % FIRST.length]!
      const last = pick(LAST)
      const name = `${first} ${last}`
      const email = `${slugify(first)}.${slugify(last)}${n}@example.com`
      const [city, province] = pick(PLACES)
      const orderCount = between(profile.orders)
      const lastDays = between(profile.lastDays)
      const orders: CrmOrder[] = Array.from({ length: orderCount }, (_, i) => {
        // Pedidos repartidos hacia atrás desde el último
        const daysAgo = lastDays + (orderCount > 1 ? Math.round((profile.spanDays * i) / (orderCount - 1 || 1) * (0.6 + rand() * 0.4)) : 0)
        const lines = 1 + Math.floor(rand() * (profile.kind === 'vip' ? 3 : 2))
        const items = Array.from({ length: lines }, () => {
          const p = pick(kits)
          const variant = rand() < 0.7 ? p.variants[0]! : (p.variants[1] ?? p.variants[0]!)
          const cat = level.get(p.category)
          return { name: p.name, slug: p.slug, quantity: 1, level: cat?.level ?? null, levelName: cat?.name ?? null, price: variant.price }
        })
        const subtotal = items.reduce((s, i) => s + i.price, 0)
        const shipping = subtotal >= 4000 ? 0 : 495
        return {
          id: `demo-${n}-${i}`,
          number: `HDM-${String(orderNumber++).padStart(6, '0')}`,
          date: new Date(today.getTime() - daysAgo * DAY).toISOString(),
          totalCents: subtotal + shipping,
          items: items.map((i) => ({ name: i.name, slug: i.slug, quantity: i.quantity, level: i.level, levelName: i.levelName })),
        }
      })
      const firstOrderDays = orders.length ? Math.max(...orders.map((o) => (today.getTime() - new Date(o.date).getTime()) / DAY)) : 0
      const since = new Date(today.getTime() - (firstOrderDays + between([0, 20])) * DAY).toISOString()
      const tags = rand() < 0.45 ? [pick(TAGS)] : []
      customers.push({
        id: customerId(email),
        email,
        name,
        phone: rand() < 0.5 ? `6${String(Math.floor(rand() * 1e8)).padStart(8, '0')}` : null,
        city,
        province,
        hasAccount: profile.kind === 'sin-compras' ? rand() < 0.6 : rand() < 0.55,
        newsletter: rand() < 0.5,
        since,
        orders,
        tags,
        notes: [],
        tasks: [],
      })
    }
  }

  // Un poco de historial de seguimiento ya escrito, para que el CRM no se vea vacío
  const vip = customers[0]!
  vip.notes.push({ id: 'n1', author: 'Equipo', body: 'Compra casi siempre para sus dos hijos. Pidió más kits sin gluten.', createdAt: new Date(today.getTime() - 9 * DAY).toISOString() })
  vip.tasks.push({ id: 't1', title: 'Avisarle cuando salga el kit sin gluten nuevo', dueDate: new Date(today.getTime() + 5 * DAY).toISOString().slice(0, 10), done: false, createdAt: new Date(today.getTime() - 9 * DAY).toISOString() })
  const risk = customers.find((c) => c.email.includes('@') && c.orders.length && (today.getTime() - new Date(c.orders[0]!.date).getTime()) / DAY > 70)
  risk?.tasks.push({ id: 't2', title: 'Enviarle el código HAMBRE5 para que vuelva', dueDate: new Date(today.getTime() + 1 * DAY).toISOString().slice(0, 10), done: false, createdAt: new Date(today.getTime() - 2 * DAY).toISOString() })
  const fresh = customers.find((c) => c.orders.length === 1 && (today.getTime() - new Date(c.orders[0]!.date).getTime()) / DAY < 10)
  fresh?.notes.push({ id: 'n2', author: 'Equipo', body: 'Escribió por Instagram: el ramen le salió muy bien, quiere probar algo con horno.', createdAt: new Date(today.getTime() - 1 * DAY).toISOString() })
  return customers
}
