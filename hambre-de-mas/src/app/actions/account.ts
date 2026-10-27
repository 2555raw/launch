'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth/session'
import { getI18n } from '@/lib/i18n/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { fieldErrors, firstError, profileSchema, savedAddressSchema } from '@/lib/validation/schemas'

export type FormState = { ok?: boolean; message?: string; fields?: Record<string, string> } | null

/** Todas estas acciones usan la sesión del cliente: RLS limita cada fila a su dueño. */

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser('/cuenta')
  const { locale, t } = await getI18n()
  const parsed = profileSchema.safeParse({
    fullName: formData.get('fullName'),
    phone: formData.get('phone') ?? '',
    cookingLevel: formData.get('cookingLevel') ?? '',
    avoidAllergens: formData.getAll('avoidAllergens'),
    marketingOptIn: formData.get('marketingOptIn') === 'on',
  })
  if (!parsed.success) return { message: firstError(parsed.error, locale), fields: fieldErrors(parsed.error, locale) }
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: parsed.data.fullName,
      phone: parsed.data.phone ?? null,
      cooking_level: parsed.data.cookingLevel,
      avoid_allergens: parsed.data.avoidAllergens,
      marketing_opt_in: parsed.data.marketingOptIn,
    })
    .eq('id', user.id)
  if (error) return { message: t({ es: 'No hemos podido guardar los cambios.', en: "We couldn't save your changes." }) }
  revalidatePath('/cuenta')
  return { ok: true, message: t({ es: 'Datos guardados.', en: 'Details saved.' }) }
}

export async function saveAddress(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser('/cuenta/direcciones')
  const { locale, t } = await getI18n()
  const parsed = savedAddressSchema.safeParse({
    label: formData.get('label') ?? '',
    fullName: formData.get('fullName'),
    phone: formData.get('phone') ?? '',
    line1: formData.get('line1'),
    line2: formData.get('line2') ?? '',
    city: formData.get('city'),
    province: formData.get('province'),
    postalCode: formData.get('postalCode'),
    country: 'ES',
    isDefault: formData.get('isDefault') === 'on',
  })
  if (!parsed.success) return { message: firstError(parsed.error, locale), fields: fieldErrors(parsed.error, locale) }
  const a = parsed.data
  const row = {
    user_id: user.id,
    label: a.label ?? null,
    full_name: a.fullName,
    phone: a.phone ?? null,
    line1: a.line1,
    line2: a.line2 ?? null,
    city: a.city,
    province: a.province,
    postal_code: a.postalCode,
    country: a.country,
    is_default: a.isDefault,
  }
  const supabase = await createSupabaseServerClient()
  const id = formData.get('id')?.toString()
  const { error } = id ? await supabase.from('addresses').update(row).eq('id', id) : await supabase.from('addresses').insert(row)
  if (error) return { message: t({ es: 'No hemos podido guardar la dirección.', en: "We couldn't save the address." }) }
  revalidatePath('/cuenta/direcciones')
  return { ok: true, message: t({ es: 'Dirección guardada.', en: 'Address saved.' }) }
}

export async function deleteAddress(formData: FormData) {
  await requireUser('/cuenta/direcciones')
  const id = formData.get('id')?.toString()
  if (!id) return
  const supabase = await createSupabaseServerClient()
  await supabase.from('addresses').delete().eq('id', id)
  revalidatePath('/cuenta/direcciones')
}

export async function makeDefaultAddress(formData: FormData) {
  await requireUser('/cuenta/direcciones')
  const id = formData.get('id')?.toString()
  if (!id) return
  const supabase = await createSupabaseServerClient()
  await supabase.from('addresses').update({ is_default: true }).eq('id', id)
  revalidatePath('/cuenta/direcciones')
}
