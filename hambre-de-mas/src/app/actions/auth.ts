'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { safeNext } from '@/lib/auth/session'
import { site } from '@/lib/config/site'
import { isSupabaseConfigured } from '@/lib/env'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { NEWSLETTER_CONSENT } from '@/lib/config/consent'
import { createOrdersService } from '@/lib/orders/service'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { isServiceRoleConfigured } from '@/lib/supabase/service'
import { emailSchema, fieldErrors, firstError, passwordSchema, signInSchema, signUpSchema } from '@/lib/validation/schemas'

export type AuthState = { ok?: boolean; message?: string; fields?: Record<string, string> } | null

const notConfigured: AuthState = { message: 'Las cuentas se activan al conectar Supabase (ver README).' }

async function limited(key: string) {
  return !rateLimit(`${key}:${clientIp(await headers())}`, 8, 60_000)
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!isSupabaseConfigured()) return notConfigured
  if (await limited('login')) return { message: 'Demasiados intentos. Espera un minuto.' }
  const parsed = signInSchema.safeParse({ email: formData.get('email'), password: formData.get('password') })
  if (!parsed.success) return { message: firstError(parsed.error), fields: fieldErrors(parsed.error) }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) {
    return {
      message: error.code === 'email_not_confirmed' ? 'Confirma tu email antes de entrar (revisa tu bandeja).' : 'Email o contraseña incorrectos.',
    }
  }
  redirect(safeNext(formData.get('next')?.toString()))
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!isSupabaseConfigured()) return notConfigured
  if (await limited('signup')) return { message: 'Demasiados intentos. Espera un minuto.' }
  const parsed = signUpSchema.safeParse({
    fullName: formData.get('fullName'),
    email: formData.get('email'),
    password: formData.get('password'),
    birthDate: formData.get('birthDate'),
    phone: formData.get('phone') ?? '',
    cookingLevel: formData.get('cookingLevel') ?? '',
    avoidAllergens: formData.getAll('avoidAllergens'),
    marketingOptIn: formData.get('marketingOptIn') === 'on',
    guardianConsent: formData.get('guardianConsent') === 'on',
    acceptPrivacy: formData.get('acceptPrivacy') === 'on',
  })
  if (!parsed.success) return { message: firstError(parsed.error), fields: fieldErrors(parsed.error) }
  const d = parsed.data

  const next = safeNext(formData.get('next')?.toString())
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.signUp({
    email: d.email,
    password: d.password,
    options: {
      // El trigger handle_new_user copia estos datos al perfil.
      data: {
        full_name: d.fullName,
        phone: d.phone ?? null,
        birth_date: d.birthDate,
        guardian_consent: d.guardianConsent,
        cooking_level: d.cookingLevel ?? null,
        avoid_allergens: d.avoidAllergens,
        marketing_opt_in: d.marketingOptIn,
      },
      emailRedirectTo: `${site.url}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  })
  if (error) {
    if (error.code === 'user_already_exists') return { message: 'Ya existe una cuenta con este email. ¿Quieres iniciar sesión?' }
    if (error.code === 'weak_password') return { message: 'Esa contraseña es demasiado débil. Prueba con una más larga.' }
    return { message: 'No hemos podido crear la cuenta. Inténtalo de nuevo.' }
  }
  if (d.marketingOptIn && isServiceRoleConfigured()) {
    await createOrdersService().subscribeNewsletter(d.email, NEWSLETTER_CONSENT)
  }
  // Con confirmación por email activada, Supabase no devuelve sesión.
  if (!data.session) {
    return { ok: true, message: `Te hemos enviado un email a ${d.email}. Abre el enlace para activar tu cuenta.` }
  }
  redirect(next)
}

/** Proveedores de acceso social activados (Google, Apple), separados por comas. */
const enabledProviders = () =>
  (process.env.NEXT_PUBLIC_AUTH_PROVIDERS ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter((p): p is 'google' | 'apple' => p === 'google' || p === 'apple')

export async function signInWithProvider(formData: FormData) {
  const provider = formData.get('provider')?.toString()
  const next = safeNext(formData.get('next')?.toString())
  if (!isSupabaseConfigured() || !enabledProviders().includes(provider as 'google')) redirect('/cuenta/acceder?error=proveedor')
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: provider as 'google' | 'apple',
    options: { redirectTo: `${site.url}/auth/confirm?next=${encodeURIComponent(next)}` },
  })
  if (error || !data.url) redirect('/cuenta/acceder?error=proveedor')
  redirect(data.url)
}

export async function requestPasswordReset(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!isSupabaseConfigured()) return notConfigured
  if (await limited('reset')) return { message: 'Demasiados intentos. Espera un minuto.' }
  const parsed = emailSchema.safeParse(formData.get('email'))
  if (!parsed.success) return { message: firstError(parsed.error) }
  const supabase = await createSupabaseServerClient()
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${site.url}/auth/confirm?next=/cuenta/restablecer`,
  })
  // Misma respuesta exista o no la cuenta, para no revelar qué emails están registrados.
  return { ok: true, message: 'Si hay una cuenta con ese email, te llegará un enlace para crear una contraseña nueva.' }
}

export async function updatePassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!isSupabaseConfigured()) return notConfigured
  const password = formData.get('password')?.toString() ?? ''
  const confirm = formData.get('confirm')?.toString() ?? ''
  const parsed = passwordSchema.safeParse(password)
  if (!parsed.success) return { message: firstError(parsed.error) }
  if (password !== confirm) return { message: 'Las contraseñas no coinciden.' }
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) return { message: 'El enlace ha caducado. Pide uno nuevo.' }
  const { error } = await supabase.auth.updateUser({ password })
  if (error) {
    return { message: error.code === 'same_password' ? 'La nueva contraseña debe ser distinta de la anterior.' : 'No hemos podido cambiar la contraseña.' }
  }
  return { ok: true, message: 'Contraseña actualizada. Ya puedes usarla para entrar.' }
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient()
    await supabase.auth.signOut()
  }
  redirect('/')
}
