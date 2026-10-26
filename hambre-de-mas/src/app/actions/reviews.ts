'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth/session'
import { isSupabaseConfigured } from '@/lib/env'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { firstError, reviewSchema } from '@/lib/validation/schemas'

export type ReviewState = { ok: boolean; message: string } | null

/**
 * Publica una opinión. La base de datos solo la acepta si quien la escribe
 * ha comprado el producto (RLS + has_purchased) y siempre queda pendiente de
 * moderación.
 */
export async function submitReview(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  if (!isSupabaseConfigured()) return { ok: false, message: 'Las opiniones se activan al conectar la base de datos.' }
  const user = await getCurrentUser()
  if (!user) return { ok: false, message: 'Inicia sesión para escribir tu opinión.' }

  const parsed = reviewSchema.safeParse({
    productId: formData.get('productId'),
    rating: formData.get('rating'),
    title: formData.get('title') ?? undefined,
    body: formData.get('body'),
    authorName: formData.get('authorName'),
  })
  if (!parsed.success) return { ok: false, message: firstError(parsed.error) }

  const supabase = await createSupabaseServerClient()
  const { data: purchased } = await supabase.rpc('has_purchased', { p_product_id: parsed.data.productId })
  if (!purchased) return { ok: false, message: 'Solo pueden opinar quienes han comprado este kit.' }

  const { error } = await supabase.from('reviews').insert({
    product_id: parsed.data.productId,
    rating: parsed.data.rating,
    title: parsed.data.title ?? null,
    body: parsed.data.body,
    author_name: parsed.data.authorName,
  })
  if (error) {
    if (error.code === '23505') return { ok: false, message: 'Ya has opinado sobre este kit.' }
    return { ok: false, message: 'No hemos podido guardar tu opinión.' }
  }
  revalidatePath('/admin/opiniones')
  return { ok: true, message: '¡Gracias! Publicaremos tu opinión cuando la revisemos.' }
}
