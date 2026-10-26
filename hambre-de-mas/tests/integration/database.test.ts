/**
 * Pruebas contra un Supabase real (local). Comprueban lo que de verdad
 * protege la tienda: RLS, reservas de stock atómicas e idempotencia de pagos.
 *
 *   npm run stack:up            # o `supabase start`
 *   npm run test:integration
 *
 * Variables: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 * SUPABASE_SERVICE_ROLE_KEY y DATABASE_URL (se leen de .env.local).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

function loadEnv() {
  try {
    for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]
    }
  } catch {
    // sin .env.local: se usan las variables del entorno
  }
}
loadEnv()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const options = { auth: { persistSession: false, autoRefreshToken: false } }

const run = Date.now().toString(36)
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const service = createClient(url, serviceKey, options)
const anon = createClient(url, anonKey, options)

let productId: string
let draftProductId: string
let variantId: string
let alice: { client: SupabaseClient; id: string }
let bob: { client: SupabaseClient; id: string }
let admin: { client: SupabaseClient; id: string }

async function signUp(name: string) {
  const client = createClient(url, anonKey, options)
  const { data, error } = await client.auth.signUp({ email: `${name}-${run}@test.local`, password: 'contraseña-segura-1' })
  if (error || !data.user) throw error ?? new Error('sin usuario')
  return { client, id: data.user.id }
}

const orderPayload = (over: Record<string, unknown> = {}) => ({
  user_id: alice.id,
  email: `alice-${run}@test.local`,
  customer_name: 'Alice',
  phone: null,
  shipping_address: { fullName: 'Alice', line1: 'Calle 1', city: 'Madrid', province: 'Madrid', postalCode: '28001', country: 'ES' },
  promotion_id: null,
  subtotal_cents: 2000,
  discount_cents: 0,
  shipping_cents: 495,
  tax_cents: 0,
  total_cents: 2495,
  items: [{ variant_id: variantId, quantity: 1, unit_price_cents: 2000 }],
  ...over,
})

const stockOf = async (id = variantId) => (await db.query('select stock from product_variants where id = $1', [id])).rows[0].stock as number

beforeAll(async () => {
  const product = await db.query(
    `insert into products (slug, name, status, description) values ($1, 'Kit de prueba', 'published', 'test') returning id`,
    [`kit-prueba-${run}`],
  )
  productId = product.rows[0].id
  const draft = await db.query(`insert into products (slug, name, status) values ($1, 'Borrador', 'draft') returning id`, [`borrador-${run}`])
  draftProductId = draft.rows[0].id
  const variant = await db.query(
    `insert into product_variants (product_id, sku, name, price_cents, stock) values ($1, $2, 'Única', 2000, 3) returning id`,
    [productId, `TEST-${run}`],
  )
  variantId = variant.rows[0].id
  await db.query(`insert into product_variants (product_id, sku, name, price_cents, stock) values ($1, $2, 'Única', 1000, 5)`, [draftProductId, `DRAFT-${run}`])

  alice = await signUp('alice')
  bob = await signUp('bob')
  admin = await signUp('admin')
  await db.query(`update profiles set role = 'admin' where id = $1`, [admin.id])
})

afterAll(async () => {
  await db.query('delete from orders where email like $1', [`%-${run}@test.local`])
  await db.query('delete from products where id = any($1)', [[productId, draftProductId]])
  await db.query('delete from auth.users where email like $1', [`%-${run}@test.local`])
  await db.end()
})

describe('RLS del catálogo', () => {
  it('los anónimos ven productos publicados pero no borradores', async () => {
    const { data } = await anon.from('products').select('id').in('id', [productId, draftProductId])
    expect(data?.map((p) => p.id)).toEqual([productId])
  })

  it('los anónimos no pueden leer promociones ni pedidos', async () => {
    const promos = await anon.from('promotions').select('code')
    expect(promos.error?.code).toBe('42501')
    const orders = await anon.from('orders').select('id')
    expect(orders.error?.code).toBe('42501')
  })

  it('un cliente no puede modificar productos ni stock', async () => {
    const { data } = await alice.client.from('products').update({ name: 'Hackeado' }).eq('id', productId).select()
    expect(data ?? []).toHaveLength(0)
    const stock = await alice.client.from('product_variants').update({ stock: 999 }).eq('id', variantId)
    expect(stock.error).not.toBeNull()
    const rpc = await alice.client.rpc('admin_set_stock', { p_variant_id: variantId, p_stock: 999 })
    expect(rpc.error).not.toBeNull()
    expect(await stockOf()).toBe(3)
  })

  it('un admin sí puede, y el cambio de stock queda registrado', async () => {
    const { error } = await admin.client.rpc('admin_set_stock', { p_variant_id: variantId, p_stock: 4 })
    expect(error).toBeNull()
    const moves = await db.query(`select reason, delta from inventory_movements where variant_id = $1 order by id desc limit 1`, [variantId])
    expect(moves.rows[0]).toEqual({ reason: 'manual', delta: 1 })
    await admin.client.rpc('admin_set_stock', { p_variant_id: variantId, p_stock: 3 })
  })
})

describe('RLS de clientes', () => {
  it('nadie puede ascenderse a admin', async () => {
    const { error } = await alice.client.from('profiles').update({ role: 'admin' }).eq('id', alice.id)
    expect(error).not.toBeNull()
    const ok = await alice.client.from('profiles').update({ full_name: 'Alice Nueva' }).eq('id', alice.id)
    expect(ok.error).toBeNull()
    const role = await db.query('select role from profiles where id = $1', [alice.id])
    expect(role.rows[0].role).toBe('customer')
  })

  it('cada cliente solo ve sus direcciones', async () => {
    const insert = await alice.client.from('addresses').insert({
      user_id: alice.id,
      full_name: 'Alice',
      line1: 'Calle 1',
      city: 'Madrid',
      province: 'Madrid',
      postal_code: '28001',
    })
    expect(insert.error).toBeNull()
    const spoof = await bob.client.from('addresses').insert({
      user_id: alice.id,
      full_name: 'Bob',
      line1: 'Calle 2',
      city: 'Madrid',
      province: 'Madrid',
      postal_code: '28001',
    })
    expect(spoof.error).not.toBeNull()
    const { data } = await bob.client.from('addresses').select('id')
    expect(data).toEqual([])
  })

  it('los clientes no pueden crear pedidos ni marcarlos como pagados', async () => {
    const create = await alice.client.rpc('create_order', { p_order: orderPayload() })
    expect(create.error).not.toBeNull()
    const insert = await alice.client.from('orders').insert({ email: 'x@x.es', customer_name: 'x', shipping_address: {}, subtotal_cents: 100, total_cents: 100 })
    expect(insert.error).not.toBeNull()
  })
})

describe('pedidos y stock', () => {
  it('rechaza precios que no coinciden con la base de datos', async () => {
    const { error } = await service.rpc('create_order', {
      p_order: orderPayload({ subtotal_cents: 1, total_cents: 496, items: [{ variant_id: variantId, quantity: 1, unit_price_cents: 1 }] }),
    })
    expect(error?.message).toBe('price_changed')
    expect(await stockOf()).toBe(3)
  })

  it('no vende más unidades de las que hay, ni con compras simultáneas', async () => {
    const attempts = await Promise.all(Array.from({ length: 8 }, () => service.rpc('create_order', { p_order: orderPayload() })))
    const ok = attempts.filter((a) => !a.error)
    const failed = attempts.filter((a) => a.error)
    expect(ok).toHaveLength(3)
    expect(failed.every((a) => a.error?.message === 'insufficient_stock')).toBe(true)
    expect(await stockOf()).toBe(0)

    // Liberar los pedidos devuelve el stock, y hacerlo dos veces no duplica nada.
    for (const a of ok) {
      expect((await service.rpc('release_order', { p_order_id: a.data.id, p_status: 'expired' })).data).toBe('expired')
      expect((await service.rpc('release_order', { p_order_id: a.data.id, p_status: 'expired' })).data).toBe('expired')
    }
    expect(await stockOf()).toBe(3)
  })

  it('confirmar un pago es idempotente y sí se puede ver desde la cuenta', async () => {
    const { data: order } = await service.rpc('create_order', { p_order: orderPayload() })
    await db.query('update orders set stripe_checkout_session_id = $1 where id = $2', [`cs_test_${run}`, order.id])
    const pay = () =>
      service.rpc('mark_order_paid', {
        p_order_id: order.id,
        p_session_id: `cs_test_${run}`,
        p_payment_intent_id: `pi_${run}`,
        p_amount_total: 2495,
        p_currency: 'eur',
      })
    expect((await pay()).data).toBe('paid')
    expect((await pay()).data).toBe('already_paid')
    const sales = await db.query('select sales_count from products where id = $1', [productId])
    expect(sales.rows[0].sales_count).toBe(1)

    const own = await alice.client.from('orders').select('id, status').eq('id', order.id)
    expect(own.data).toEqual([{ id: order.id, status: 'paid' }])
    const other = await bob.client.from('orders').select('id').eq('id', order.id)
    expect(other.data).toEqual([])

    // Un pedido pagado ya no se puede "caducar" y su stock no vuelve.
    expect((await service.rpc('release_order', { p_order_id: order.id, p_status: 'expired' })).data).toBe('paid')
    expect(await stockOf()).toBe(2)
  })

  it('si el importe cobrado no cuadra, el pedido queda en revisión', async () => {
    const { data: order } = await service.rpc('create_order', { p_order: orderPayload() })
    const { data } = await service.rpc('mark_order_paid', {
      p_order_id: order.id,
      p_session_id: `cs_otro_${run}`,
      p_payment_intent_id: `pi_otro_${run}`,
      p_amount_total: 100,
      p_currency: 'eur',
    })
    expect(data).toBe('requires_review')
  })

  it('un cliente solo puede cambiar el envío si es admin', async () => {
    const { data: order } = await service.rpc('create_order', { p_order: orderPayload() })
    const byCustomer = await alice.client.from('orders').update({ fulfillment_status: 'shipped' }).eq('id', order.id).select()
    expect(byCustomer.data ?? []).toHaveLength(0)
    const byCustomerTotal = await alice.client.from('orders').update({ total_cents: 1 }).eq('id', order.id)
    expect(byCustomerTotal.error).not.toBeNull()
    const byAdmin = await admin.client.from('orders').update({ fulfillment_status: 'preparing' }).eq('id', order.id).select('fulfillment_status')
    expect(byAdmin.data).toEqual([{ fulfillment_status: 'preparing' }])
  })
})

describe('opiniones', () => {
  it('solo compradores, y siempre pendientes de moderar', async () => {
    const byBob = await bob.client.from('reviews').insert({ product_id: productId, rating: 5, body: 'Me encantó el kit de prueba', author_name: 'Bob' })
    expect(byBob.error).not.toBeNull()

    const byAlice = await alice.client
      .from('reviews')
      .insert({ product_id: productId, rating: 5, body: 'Me encantó el kit de prueba', author_name: 'Alice' })
      .select('status, is_verified')
    expect(byAlice.error).toBeNull()
    expect(byAlice.data).toEqual([{ status: 'pending', is_verified: true }])

    const publicView = await anon.from('reviews').select('id').eq('product_id', productId)
    expect(publicView.data).toEqual([])
  })
})

describe('almacenamiento de imágenes', () => {
  it('solo los admin pueden subir fotos de producto', async () => {
    const file = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' })
    const byCustomer = await alice.client.storage.from('product-images').upload(`${productId}/cliente-${run}.jpg`, file, { contentType: 'image/jpeg' })
    expect(byCustomer.error).not.toBeNull()
    const byAdmin = await admin.client.storage.from('product-images').upload(`${productId}/admin-${run}.jpg`, file, { contentType: 'image/jpeg' })
    expect(byAdmin.error).toBeNull()
    await admin.client.storage.from('product-images').remove([`${productId}/admin-${run}.jpg`])
  })
})
