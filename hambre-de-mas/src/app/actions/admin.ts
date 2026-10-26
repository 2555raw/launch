'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/session'
import { isStripeConfigured } from '@/lib/env'
import { createOrdersService } from '@/lib/orders/service'
import { getStripe } from '@/lib/stripe/client'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  categoryInputSchema,
  fieldErrors,
  firstError,
  fulfillmentSchema,
  productInputSchema,
  promotionInputSchema,
} from '@/lib/validation/schemas'

/**
 * Acciones del panel. Cada una comprueba en el servidor que quien llama es
 * administrador (requireAdmin) y, además, casi todas usan el cliente con la
 * sesión del usuario, así que la base de datos vuelve a comprobarlo con RLS.
 */

export type AdminState = { ok?: boolean; message?: string; fields?: Record<string, string> } | null

const refreshStore = () => revalidatePath('/', 'layout')

// ---------------------------------------------------------------------------
// Productos
// ---------------------------------------------------------------------------

export async function saveProduct(_prev: AdminState, formData: FormData): Promise<AdminState> {
  await requireAdmin()
  let raw: unknown
  try {
    raw = JSON.parse(formData.get('payload')?.toString() ?? '')
  } catch {
    return { message: 'Datos del formulario no válidos.' }
  }
  const parsed = productInputSchema.safeParse(raw)
  if (!parsed.success) return { message: firstError(parsed.error), fields: fieldErrors(parsed.error) }
  const p = parsed.data
  const productId = formData.get('id')?.toString() || null
  const supabase = await createSupabaseServerClient()

  const row = {
    name: p.name,
    slug: p.slug,
    subtitle: p.subtitle ?? null,
    description: p.description,
    category_id: p.categoryId ?? null,
    status: p.status,
    tax_rate_bps: p.taxRateBps,
    is_featured: p.isFeatured,
    badge: p.badge ?? null,
    attributes: {
      ...(p.minutes != null ? { minutes: p.minutes } : {}),
      ...(p.difficulty != null ? { difficulty: p.difficulty } : {}),
      ...(p.heat ? { heat: p.heat } : {}),
    },
    tags: p.tags,
    includes: p.includes,
    specs: p.specs,
    seo_title: p.seoTitle ?? null,
    seo_description: p.seoDescription ?? null,
  }

  let id = productId
  if (id) {
    const { error } = await supabase.from('products').update(row).eq('id', id)
    if (error) return { message: error.code === '23505' ? 'Ya existe un producto con ese slug.' : `No se pudo guardar: ${error.message}` }
  } else {
    const { data, error } = await supabase.from('products').insert(row).select('id').single()
    if (error) return { message: error.code === '23505' ? 'Ya existe un producto con ese slug.' : `No se pudo crear: ${error.message}` }
    id = data.id as string
  }

  // Variantes: actualiza las existentes, crea las nuevas y borra las quitadas.
  const { data: existing } = await supabase.from('product_variants').select('id, stock').eq('product_id', id)
  const keep = new Set(p.variants.map((v) => v.id).filter(Boolean))
  const toDelete = (existing ?? []).filter((v) => !keep.has(v.id)).map((v) => v.id)
  if (toDelete.length) {
    const { error } = await supabase.from('product_variants').delete().in('id', toDelete)
    if (error) return { message: `No se pudieron borrar variantes: ${error.message}` }
  }
  for (const [position, v] of p.variants.entries()) {
    const fields = {
      sku: v.sku,
      name: v.name,
      price_cents: v.price,
      compare_at_price_cents: v.compareAt,
      is_active: v.isActive,
      position,
    }
    if (v.id) {
      const { error } = await supabase.from('product_variants').update(fields).eq('id', v.id).eq('product_id', id)
      if (error) return { message: error.code === '23505' ? `El SKU ${v.sku} ya existe.` : `Variante ${v.name}: ${error.message}` }
      const current = existing?.find((e) => e.id === v.id)
      if (current && current.stock !== v.stock) {
        const { error: stockError } = await supabase.rpc('admin_set_stock', { p_variant_id: v.id, p_stock: v.stock })
        if (stockError) return { message: `Stock de ${v.name}: ${stockError.message}` }
      }
    } else {
      const { error } = await supabase.from('product_variants').insert({ ...fields, product_id: id, stock: v.stock })
      if (error) return { message: error.code === '23505' ? `El SKU ${v.sku} ya existe.` : `Variante ${v.name}: ${error.message}` }
    }
  }

  refreshStore()
  if (!productId) redirect(`/admin/productos/${id}?creado=1`)
  return { ok: true, message: 'Producto guardado.' }
}

export async function deleteProduct(formData: FormData) {
  await requireAdmin()
  const id = formData.get('id')?.toString()
  if (!id) return
  const supabase = await createSupabaseServerClient()
  // Si tiene pedidos, mejor archivarlo para conservar el historial.
  const { count } = await supabase.from('order_items').select('id', { count: 'exact', head: true }).eq('product_id', id)
  if ((count ?? 0) > 0) {
    await supabase.from('products').update({ status: 'archived' }).eq('id', id)
  } else {
    const { data: images } = await supabase.from('product_images').select('storage_path').eq('product_id', id)
    const paths = (images ?? []).map((i) => i.storage_path).filter(Boolean) as string[]
    if (paths.length) await supabase.storage.from('product-images').remove(paths)
    await supabase.from('products').delete().eq('id', id)
  }
  refreshStore()
  redirect('/admin/productos')
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const IMAGE_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' }

export async function uploadProductImage(_prev: AdminState, formData: FormData): Promise<AdminState> {
  await requireAdmin()
  const productId = formData.get('productId')?.toString()
  const file = formData.get('file')
  const alt = formData.get('alt')?.toString().trim().slice(0, 200) ?? ''
  if (!productId || !(file instanceof File) || file.size === 0) return { message: 'Elige una imagen.' }
  const ext = IMAGE_TYPES[file.type]
  if (!ext) return { message: 'Formato no admitido. Usa JPG, PNG, WebP o AVIF.' }
  if (file.size > MAX_IMAGE_BYTES) return { message: 'La imagen pesa más de 5 MB.' }

  const supabase = await createSupabaseServerClient()
  const path = `${productId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('product-images').upload(path, file, { contentType: file.type, cacheControl: '31536000' })
  if (error) return { message: `No se pudo subir: ${error.message}` }
  const { data: publicUrl } = supabase.storage.from('product-images').getPublicUrl(path)
  const { count } = await supabase.from('product_images').select('id', { count: 'exact', head: true }).eq('product_id', productId)
  const { error: rowError } = await supabase
    .from('product_images')
    .insert({ product_id: productId, url: publicUrl.publicUrl, alt, storage_path: path, position: count ?? 0 })
  if (rowError) {
    await supabase.storage.from('product-images').remove([path])
    return { message: `No se pudo guardar la imagen: ${rowError.message}` }
  }
  refreshStore()
  return { ok: true, message: 'Imagen subida.' }
}

export async function updateImage(formData: FormData) {
  await requireAdmin()
  const id = formData.get('id')?.toString()
  const intent = formData.get('intent')?.toString()
  if (!id) return
  const supabase = await createSupabaseServerClient()
  const { data: image } = await supabase.from('product_images').select('*').eq('id', id).single()
  if (!image) return

  if (intent === 'delete') {
    if (image.storage_path) await supabase.storage.from('product-images').remove([image.storage_path])
    await supabase.from('product_images').delete().eq('id', id)
  } else if (intent === 'alt') {
    await supabase.from('product_images').update({ alt: formData.get('alt')?.toString().slice(0, 200) ?? '' }).eq('id', id)
  } else if (intent === 'up' || intent === 'down') {
    const { data: all } = await supabase.from('product_images').select('id, position').eq('product_id', image.product_id).order('position').order('created_at')
    const list = all ?? []
    const index = list.findIndex((i) => i.id === id)
    const swap = intent === 'up' ? index - 1 : index + 1
    if (index >= 0 && swap >= 0 && swap < list.length) {
      const reordered = [...list]
      ;[reordered[index], reordered[swap]] = [reordered[swap]!, reordered[index]!]
      await Promise.all(reordered.map((img, position) => supabase.from('product_images').update({ position }).eq('id', img.id)))
    }
  }
  refreshStore()
  revalidatePath(`/admin/productos/${image.product_id}`)
}

// ---------------------------------------------------------------------------
// Inventario
// ---------------------------------------------------------------------------

export async function setStock(_prev: AdminState, formData: FormData): Promise<AdminState> {
  await requireAdmin('/admin/inventario')
  const variantId = formData.get('variantId')?.toString()
  const stock = Number.parseInt(formData.get('stock')?.toString() ?? '', 10)
  if (!variantId || !Number.isFinite(stock) || stock < 0) return { message: 'Stock no válido.' }
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc('admin_set_stock', { p_variant_id: variantId, p_stock: stock })
  if (error) return { message: error.message }
  refreshStore()
  return { ok: true, message: 'Guardado' }
}

// ---------------------------------------------------------------------------
// Categorías
// ---------------------------------------------------------------------------

export async function saveCategory(_prev: AdminState, formData: FormData): Promise<AdminState> {
  await requireAdmin('/admin/categorias')
  const parsed = categoryInputSchema.safeParse({
    name: formData.get('name'),
    slug: formData.get('slug'),
    tagline: formData.get('tagline') ?? '',
    description: formData.get('description') ?? '',
    level: formData.get('level') ?? '',
    accent: formData.get('accent'),
    imageUrl: formData.get('imageUrl') ?? '',
    position: formData.get('position') ?? 0,
    isPublished: formData.get('isPublished') === 'on',
  })
  if (!parsed.success) return { message: firstError(parsed.error), fields: fieldErrors(parsed.error) }
  const c = parsed.data
  const row = {
    name: c.name,
    slug: c.slug,
    tagline: c.tagline ?? null,
    description: c.description ?? null,
    level: c.level,
    accent: c.accent,
    image_url: c.imageUrl ?? null,
    position: c.position,
    is_published: c.isPublished,
  }
  const supabase = await createSupabaseServerClient()
  const id = formData.get('id')?.toString()
  const { error } = id ? await supabase.from('categories').update(row).eq('id', id) : await supabase.from('categories').insert(row)
  if (error) return { message: error.code === '23505' ? 'Ya existe una categoría con ese slug.' : error.message }
  refreshStore()
  return { ok: true, message: id ? 'Categoría guardada.' : 'Categoría creada.' }
}

export async function deleteCategory(formData: FormData) {
  await requireAdmin('/admin/categorias')
  const id = formData.get('id')?.toString()
  if (!id) return
  const supabase = await createSupabaseServerClient()
  await supabase.from('categories').delete().eq('id', id)
  refreshStore()
}

// ---------------------------------------------------------------------------
// Promociones
// ---------------------------------------------------------------------------

export async function savePromotion(_prev: AdminState, formData: FormData): Promise<AdminState> {
  await requireAdmin('/admin/promociones')
  const parsed = promotionInputSchema.safeParse({
    code: formData.get('code'),
    description: formData.get('description') ?? '',
    kind: formData.get('kind'),
    value: formData.get('value'),
    minSubtotal: formData.get('minSubtotal') || 0,
    startsAt: formData.get('startsAt') ?? '',
    endsAt: formData.get('endsAt') ?? '',
    maxRedemptions: formData.get('maxRedemptions') ?? '',
    isActive: formData.get('isActive') === 'on',
  })
  if (!parsed.success) return { message: firstError(parsed.error), fields: fieldErrors(parsed.error) }
  const p = parsed.data
  const toDate = (v?: string) => (v ? new Date(v).toISOString() : null)
  const row = {
    code: p.code,
    description: p.description ?? null,
    kind: p.kind,
    value: p.kind === 'percent' ? Math.round(p.value) : Math.round(p.value * 100),
    min_subtotal_cents: Math.round(p.minSubtotal * 100),
    starts_at: toDate(p.startsAt),
    ends_at: toDate(p.endsAt),
    max_redemptions: p.maxRedemptions,
    is_active: p.isActive,
  }
  const supabase = await createSupabaseServerClient()
  const id = formData.get('id')?.toString()
  const { error } = id ? await supabase.from('promotions').update(row).eq('id', id) : await supabase.from('promotions').insert(row)
  if (error) return { message: error.code === '23505' ? 'Ese código ya existe.' : error.message }
  revalidatePath('/admin/promociones')
  return { ok: true, message: id ? 'Promoción guardada.' : 'Promoción creada.' }
}

export async function togglePromotion(formData: FormData) {
  await requireAdmin('/admin/promociones')
  const id = formData.get('id')?.toString()
  if (!id) return
  const supabase = await createSupabaseServerClient()
  await supabase.from('promotions').update({ is_active: formData.get('active') === 'true' }).eq('id', id)
  revalidatePath('/admin/promociones')
}

// ---------------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------------

export async function updateFulfillment(_prev: AdminState, formData: FormData): Promise<AdminState> {
  await requireAdmin('/admin/pedidos')
  const parsed = fulfillmentSchema.safeParse({
    orderId: formData.get('orderId'),
    fulfillmentStatus: formData.get('fulfillmentStatus'),
    trackingCarrier: formData.get('trackingCarrier') ?? '',
    trackingNumber: formData.get('trackingNumber') ?? '',
    trackingUrl: formData.get('trackingUrl') ?? '',
    adminNotes: formData.get('adminNotes') ?? '',
  })
  if (!parsed.success) return { message: firstError(parsed.error), fields: fieldErrors(parsed.error) }
  const f = parsed.data
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase
    .from('orders')
    .update({
      fulfillment_status: f.fulfillmentStatus,
      tracking_carrier: f.trackingCarrier ?? null,
      tracking_number: f.trackingNumber ?? null,
      tracking_url: f.trackingUrl ?? null,
      admin_notes: f.adminNotes ?? null,
    })
    .eq('id', f.orderId)
  if (error) return { message: error.message }
  revalidatePath(`/admin/pedidos/${f.orderId}`)
  return { ok: true, message: 'Envío actualizado.' }
}

/** Cancela un pedido pendiente de pago y devuelve su stock. */
export async function cancelPendingOrder(formData: FormData) {
  const { user } = await requireAdmin('/admin/pedidos')
  const id = formData.get('orderId')?.toString()
  if (!id) return
  const orders = createOrdersService()
  const order = await orders.getById(id)
  if (order?.status !== 'pending') return
  if (order.stripeCheckoutSessionId && isStripeConfigured()) {
    await getStripe()
      .checkout.sessions.expire(order.stripeCheckoutSessionId)
      .catch(() => undefined)
  }
  await orders.release(id, 'cancelled', `Cancelado desde el panel por ${user.email ?? user.id}`)
  refreshStore()
  revalidatePath(`/admin/pedidos/${id}`)
}

/**
 * Reembolso total a través de Stripe. El estado "reembolsado" lo pone el
 * webhook charge.refunded cuando Stripe lo confirma.
 */
export async function refundOrder(_prev: AdminState, formData: FormData): Promise<AdminState> {
  await requireAdmin('/admin/pedidos')
  const id = formData.get('orderId')?.toString()
  if (!id) return { message: 'Pedido no válido.' }
  if (!isStripeConfigured()) return { message: 'Stripe no está configurado.' }
  const order = await createOrdersService().getById(id)
  if (!order || !['paid', 'requires_review'].includes(order.status) || !order.stripePaymentIntentId) {
    return { message: 'Solo se pueden reembolsar pedidos pagados.' }
  }
  try {
    await getStripe().refunds.create(
      { payment_intent: order.stripePaymentIntentId, reason: 'requested_by_customer', metadata: { order_id: order.id } },
      { idempotencyKey: `refund-${order.id}` },
    )
  } catch (error) {
    return { message: `Stripe rechazó el reembolso: ${(error as Error).message}` }
  }
  revalidatePath(`/admin/pedidos/${id}`)
  return { ok: true, message: 'Reembolso solicitado. El estado cambiará cuando Stripe lo confirme.' }
}

// ---------------------------------------------------------------------------
// Opiniones
// ---------------------------------------------------------------------------

export async function moderateReview(formData: FormData) {
  await requireAdmin('/admin/opiniones')
  const id = formData.get('id')?.toString()
  const intent = formData.get('intent')?.toString()
  if (!id) return
  const supabase = await createSupabaseServerClient()
  if (intent === 'delete') await supabase.from('reviews').delete().eq('id', id)
  else if (intent === 'approved' || intent === 'rejected') await supabase.from('reviews').update({ status: intent }).eq('id', id)
  refreshStore()
}
