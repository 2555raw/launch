'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth/session'
import { isSupabaseConfigured } from '@/lib/env'
import { getI18n } from '@/lib/i18n/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { firstError, reviewSchema } from '@/lib/validation/schemas'

export type ReviewState = { ok: boolean; message: string; code?: 'auth' } | null

/**
 * Publica una opinión. La base de datos solo la acepta si quien la escribe
 * ha comprado el producto (RLS + has_purchased) y siempre queda pendiente de
 * moderación.
 */
export async function submitReview(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const { locale, t } = await getI18n()
  if (!isSupabaseConfigured())
    return { ok: false, message: t({ es: 'Las opiniones se activan al conectar la base de datos.', en: 'Reviews are enabled once the database is connected.' }) }
  const user = await getCurrentUser()
  if (!user) return { ok: false, code: 'auth', message: t({ es: 'Inicia sesión para escribir tu opinión.', en: 'Sign in to write your review.' }) }

  const parsed = reviewSchema.safeParse({
    productId: formData.get('productId'),
    rating: formData.get('rating'),
    title: formData.get('title') ?? undefined,
    body: formData.get('body'),
    authorName: formData.get('authorName'),
  })
  if (!parsed.success) return { ok: false, message: firstError(parsed.error, locale) }

  const supabase = await createSupabaseServerClient()
  const { data: purchased } = await supabase.rpc('has_purchased', { p_product_id: parsed.data.productId })
  if (!purchased) return { ok: false, message: t({ es: 'Solo pueden opinar quienes han comprado este kit.', en: 'Only people who bought this kit can review it.' }) }

  const { error } = await supabase.from('reviews').insert({
    product_id: parsed.data.productId,
    rating: parsed.data.rating,
    title: parsed.data.title ?? null,
    body: parsed.data.body,
    author_name: parsed.data.authorName,
  })
  if (error) {
    if (error.code === '23505') return { ok: false, message: t({ es: 'Ya has opinado sobre este kit.', en: "You've already reviewed this kit." }) }
    return { ok: false, message: t({ es: 'No hemos podido guardar tu opinión.', en: "We couldn't save your review." }) }
  }
  revalidatePath('/admin/opiniones')
  return { ok: true, message: t({ es: '¡Gracias! Publicaremos tu opinión cuando la revisemos.', en: "Thanks! We'll publish your review once we've checked it." }) }
}
