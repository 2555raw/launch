'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { authProviders } from '@/lib/auth/providers'
import { safeNext } from '@/lib/auth/session'
import { site } from '@/lib/config/site'
import { getI18n } from '@/lib/i18n/server'
import { isSupabaseConfigured } from '@/lib/env'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { NEWSLETTER_CONSENT } from '@/lib/config/consent'
import { createOrdersService } from '@/lib/orders/service'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { isServiceRoleConfigured } from '@/lib/supabase/service'
import { emailSchema, fieldErrors, firstError, passwordSchema, signInSchema, signUpSchema } from '@/lib/validation/schemas'

export type AuthState = { ok?: boolean; message?: string; fields?: Record<string, string> } | null

async function notConfigured(): Promise<AuthState> {
  const { t } = await getI18n()
  return { message: t({ es: 'Las cuentas se activan al conectar Supabase (ver README).', en: 'Accounts are enabled once Supabase is connected (see README).' }) }
}

async function tooMany(): Promise<AuthState> {
  const { t } = await getI18n()
  return { message: t({ es: 'Demasiados intentos. Espera un minuto.', en: 'Too many attempts. Please wait a minute.' }) }
}

async function limited(key: string) {
  return !rateLimit(`${key}:${clientIp(await headers())}`, 8, 60_000)
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!isSupabaseConfigured()) return notConfigured()
  if (await limited('login')) return tooMany()
  const { locale, t } = await getI18n()
  const parsed = signInSchema.safeParse({ email: formData.get('email'), password: formData.get('password') })
  if (!parsed.success) return { message: firstError(parsed.error, locale), fields: fieldErrors(parsed.error, locale) }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) {
    return {
      message:
        error.code === 'email_not_confirmed'
          ? t({ es: 'Confirma tu email antes de entrar (revisa tu bandeja).', en: 'Confirm your email before signing in (check your inbox).' })
          : t({ es: 'Email o contraseña incorrectos.', en: 'Wrong email or password.' }),
    }
  }
  redirect(safeNext(formData.get('next')?.toString()))
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!isSupabaseConfigured()) return notConfigured()
  if (await limited('signup')) return tooMany()
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
  const { locale, t } = await getI18n()
  if (!parsed.success) return { message: firstError(parsed.error, locale), fields: fieldErrors(parsed.error, locale) }
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
    if (error.code === 'user_already_exists')
      return { message: t({ es: 'Ya existe una cuenta con este email. ¿Quieres iniciar sesión?', en: 'There is already an account with this email. Want to sign in?' }) }
    if (error.code === 'weak_password')
      return { message: t({ es: 'Esa contraseña es demasiado débil. Prueba con una más larga.', en: 'That password is too weak. Try a longer one.' }) }
    return { message: t({ es: 'No hemos podido crear la cuenta. Inténtalo de nuevo.', en: "We couldn't create your account. Please try again." }) }
  }
  if (d.marketingOptIn && isServiceRoleConfigured()) {
    await createOrdersService().subscribeNewsletter(d.email, NEWSLETTER_CONSENT)
  }
  // Con confirmación por email activada, Supabase no devuelve sesión.
  if (!data.session) {
    return {
      ok: true,
      message: t({
        es: `Te hemos enviado un email a ${d.email}. Abre el enlace para activar tu cuenta.`,
        en: `We've sent an email to ${d.email}. Open the link to activate your account.`,
      }),
    }
  }
  redirect(next)
}


export async function signInWithProvider(formData: FormData) {
  const provider = formData.get('provider')?.toString()
  const next = safeNext(formData.get('next')?.toString())
  if (!isSupabaseConfigured() || !authProviders.includes(provider as 'google')) redirect('/cuenta/acceder?error=proveedor')
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: provider as 'google' | 'apple',
    options: { redirectTo: `${site.url}/auth/confirm?next=${encodeURIComponent(next)}` },
  })
  if (error || !data.url) redirect('/cuenta/acceder?error=proveedor')
  redirect(data.url)
}

export async function requestPasswordReset(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!isSupabaseConfigured()) return notConfigured()
  if (await limited('reset')) return tooMany()
  const { locale, t } = await getI18n()
  const parsed = emailSchema.safeParse(formData.get('email'))
  if (!parsed.success) return { message: firstError(parsed.error, locale) }
  const supabase = await createSupabaseServerClient()
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${site.url}/auth/confirm?next=/cuenta/restablecer`,
  })
  // Misma respuesta exista o no la cuenta, para no revelar qué emails están registrados.
  return {
    ok: true,
    message: t({
      es: 'Si hay una cuenta con ese email, te llegará un enlace para crear una contraseña nueva.',
      en: "If there's an account with that email, you'll get a link to create a new password.",
    }),
  }
}

export async function updatePassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!isSupabaseConfigured()) return notConfigured()
  const { locale, t } = await getI18n()
  const password = formData.get('password')?.toString() ?? ''
  const confirm = formData.get('confirm')?.toString() ?? ''
  const parsed = passwordSchema.safeParse(password)
  if (!parsed.success) return { message: firstError(parsed.error, locale) }
  if (password !== confirm) return { message: t({ es: 'Las contraseñas no coinciden.', en: "The passwords don't match." }) }
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) return { message: t({ es: 'El enlace ha caducado. Pide uno nuevo.', en: 'The link has expired. Request a new one.' }) }
  const { error } = await supabase.auth.updateUser({ password })
  if (error) {
    return {
      message:
        error.code === 'same_password'
          ? t({ es: 'La nueva contraseña debe ser distinta de la anterior.', en: 'Your new password must be different from the old one.' })
          : t({ es: 'No hemos podido cambiar la contraseña.', en: "We couldn't change your password." }),
    }
  }
  return { ok: true, message: t({ es: 'Contraseña actualizada. Ya puedes usarla para entrar.', en: 'Password updated. You can now use it to sign in.' }) }
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient()
    await supabase.auth.signOut()
  }
  redirect('/')
}
