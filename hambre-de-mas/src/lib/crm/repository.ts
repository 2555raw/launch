import 'server-only'
import { getBaseCatalog, isDemoMode } from '@/lib/catalog'
import { formatOrderNumber } from '@/lib/orders/mapper'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { demoCrmCustomers } from './demo'
import { customerId } from './id'
import type { CrmCustomer, CrmData } from './types'

/**
 * Clientes del CRM. En la vista previa (sin base de datos), los de ejemplo.
 * Con Supabase: todos los emails que han pagado un pedido, tienen cuenta o
 * están en la newsletter, con sus pedidos pagados y el seguimiento (notas,
 * tareas y etiquetas). Se lee con la sesión del administrador (RLS).
 */
export async function getCrmData(): Promise<CrmData> {
  if (isDemoMode()) return { demo: true, customers: demoCrmCustomers() }

  const supabase = await createSupabaseServerClient()
  const [orders, profiles, newsletter, notes, tasks, tags, catalog] = await Promise.all([
    supabase
      .from('orders')
      .select('id, number, email, customer_name, phone, shipping_address, total_cents, paid_at, created_at, items:order_items(product_name, product_slug, quantity)')
      .eq('status', 'paid')
      .order('created_at', { ascending: false })
      .limit(5000),
    supabase.from('profiles').select('email, full_name, phone, created_at, role').limit(5000),
    supabase.from('newsletter_subscribers').select('email, created_at').is('unsubscribed_at', null).limit(5000),
    supabase.from('crm_notes').select('id, email, body, author, created_at').order('created_at', { ascending: false }),
    supabase.from('crm_tasks').select('id, email, title, due_date, done, created_at').order('created_at', { ascending: false }),
    supabase.from('crm_tags').select('email, tag'),
    getBaseCatalog().listProducts({ limit: 500 }),
  ])
  for (const r of [orders, profiles, newsletter, notes, tasks, tags]) if (r.error) throw new Error(`[crm] ${r.error.message}`)

  const levelOf = new Map(catalog.items.map((p) => [p.slug, p.category]))
  const byEmail = new Map<string, CrmCustomer>()
  const get = (rawEmail: string, since: string) => {
    const email = rawEmail.trim().toLowerCase()
    let c = byEmail.get(email)
    if (!c) {
      c = { id: customerId(email), email, name: email.split('@')[0]!, phone: null, city: null, province: null, hasAccount: false, newsletter: false, since, orders: [], tags: [], notes: [], tasks: [] }
      byEmail.set(email, c)
    }
    if (since < c.since) c.since = since
    return c
  }

  for (const p of profiles.data ?? []) {
    // Las cuentas del equipo (admin) no son clientes
    if (!p.email || p.role === 'admin') continue
    const c = get(p.email, p.created_at)
    c.hasAccount = true
    if (p.full_name) c.name = p.full_name
    c.phone ??= p.phone
  }
  for (const s of newsletter.data ?? []) get(s.email, s.created_at).newsletter = true
  // Los pedidos van del más reciente al más antiguo: el nombre y la dirección más recientes ganan
  for (const o of orders.data ?? []) {
    const date = o.paid_at ?? o.created_at
    const c = get(o.email, date)
    if (!c.hasAccount || c.name === c.email.split('@')[0]) c.name = o.customer_name
    c.phone ??= o.phone
    const address = (o.shipping_address ?? {}) as { city?: string; province?: string }
    c.city ??= address.city ?? null
    c.province ??= address.province ?? null
    c.orders.push({
      id: o.id,
      number: formatOrderNumber(o.number),
      date,
      totalCents: o.total_cents,
      items: (o.items ?? []).map((i: { product_name: string; product_slug: string | null; quantity: number }) => {
        const category = i.product_slug ? levelOf.get(i.product_slug) : null
        return { name: i.product_name, slug: i.product_slug, quantity: i.quantity, level: category?.level ?? null, levelName: category?.name ?? null }
      }),
    })
  }
  for (const n of notes.data ?? []) byEmail.get(n.email)?.notes.push({ id: n.id, body: n.body, author: n.author, createdAt: n.created_at })
  for (const t of tasks.data ?? []) byEmail.get(t.email)?.tasks.push({ id: t.id, title: t.title, dueDate: t.due_date, done: t.done, createdAt: t.created_at })
  for (const t of tags.data ?? []) byEmail.get(t.email)?.tags.push(t.tag)

  return { demo: false, customers: [...byEmail.values()] }
}
