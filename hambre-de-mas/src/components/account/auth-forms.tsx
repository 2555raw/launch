'use client'

import Link from 'next/link'
import { startTransition, useActionState, useState, type FormEvent } from 'react'
import { requestPasswordReset, signIn, signInWithProvider, signUp, updatePassword, type AuthState } from '@/app/actions/auth'
import { AllergenIcon } from '@/components/product/allergen-icons'
import { ALLERGENS, allergenLabel } from '@/lib/allergens'
import { authProviders } from '@/lib/auth/providers'
import { GUARDIAN_CONSENT_AGE, ageFrom } from '@/lib/validation/schemas'
import { cn } from '@/lib/cn'
import { useI18n } from '@/lib/i18n/client'

/**
 * Envía el formulario sin que React lo vacíe después: si el servidor devuelve
 * un error, lo que la persona ya había escrito se queda en su sitio.
 */
function keepValues(action: (data: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    startTransition(() => action(data))
  }
}

export const inputClass =
  'h-12 w-full rounded-xl border border-line-strong bg-white px-4 text-[15px] transition-colors placeholder:text-ash focus:border-ink focus:outline-none aria-[invalid=true]:border-teja'

export function FormField({
  label,
  name,
  error,
  hint,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; error?: string; hint?: string }) {
  return (
    <div className={className}>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined}
        className={inputClass}
        {...props}
      />
      {hint && !error && (
        <p id={`${name}-hint`} className="mt-1 text-xs text-ash-ink">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${name}-error`} className="mt-1 text-xs text-teja" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export function FormMessage({ state }: { state: AuthState }) {
  if (!state?.message) return null
  return (
    <p
      className={cn('rounded-2xl px-4 py-3 text-sm', state.ok ? 'bg-hoja/15 text-hoja-deep' : 'bg-almendra-soft text-teja')}
      role={state.ok ? 'status' : 'alert'}
    >
      {state.message}
    </p>
  )
}

/* ------------------------------------------------------------------------
 * Pantallas de acceso (fondo oscuro, ver auth-stage.tsx)
 * ---------------------------------------------------------------------- */

const darkInput =
  'h-12 w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 text-[15px] text-white transition-colors placeholder:text-white/30 focus:border-white/40 focus:bg-white/[0.08] focus:outline-none aria-[invalid=true]:border-chef [color-scheme:dark]'

const darkCheck = 'mt-0.5 size-[18px] shrink-0 rounded-md accent-chef'

function AuthField({
  label,
  name,
  error,
  hint,
  aside,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; error?: string; hint?: string; aside?: React.ReactNode }) {
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={name} className="text-[11px] font-semibold tracking-[0.12em] text-white/55 uppercase">
          {label}
        </label>
        {aside}
      </div>
      <input
        id={name}
        name={name}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined}
        className={darkInput}
        {...props}
      />
      {hint && !error && (
        <p id={`${name}-hint`} className="mt-1 text-xs text-white/40">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${name}-error`} className="mt-1 text-xs text-[#ff8a7a]" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

function AuthMessage({ state }: { state: AuthState }) {
  if (!state?.message) return null
  return (
    <p
      className={cn(
        'rounded-xl px-4 py-3 text-sm',
        state.ok ? 'bg-hoja/15 text-[#b9e39f] ring-1 ring-hoja/30' : 'bg-chef/15 text-[#ffb3a8] ring-1 ring-chef/30',
      )}
      role={state.ok ? 'status' : 'alert'}
    >
      {state.message}
    </p>
  )
}

const primary =
  'btn-sheen inline-flex h-12 w-full items-center justify-center rounded-xl bg-chef-ink text-[15px] font-semibold text-white transition-[background-color,transform] hover:bg-chef active:scale-[0.99] disabled:opacity-50'

export function AuthHeading({ title, lead }: { title: string; lead?: string }) {
  return (
    <div className="mb-6">
      <h1 className="font-display text-[26px] leading-tight font-bold tracking-tight">{title}</h1>
      {lead && <p className="mt-1.5 text-sm text-white/55">{lead}</p>}
    </div>
  )
}

export function AuthDivider() {
  const { t } = useI18n()
  return (
    <div className="my-5 flex items-center gap-3 text-xs text-white/40">
      <span className="h-px flex-1 bg-white/10" /> {t({ es: 'o', en: 'or' })} <span className="h-px flex-1 bg-white/10" />
    </div>
  )
}

export function SignInForm({ next }: { next: string }) {
  const { t } = useI18n()
  const [state, action, pending] = useActionState(signIn, null)
  return (
    <form action={action} onSubmit={keepValues(action)} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <AuthField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder={t({ es: 'tu@email.com', en: 'you@email.com' })}
        required
        error={state?.fields?.email}
      />
      <AuthField
        label={t({ es: 'Contraseña', en: 'Password' })}
        name="password"
        type="password"
        autoComplete="current-password"
        placeholder="••••••••"
        required
        error={state?.fields?.password}
        aside={
          <Link href="/cuenta/recuperar" className="text-xs text-white/55 underline-offset-2 hover:text-white hover:underline">
            {t({ es: '¿La has olvidado?', en: 'Forgot it?' })}
          </Link>
        }
      />
      <AuthMessage state={state} />
      <button type="submit" className={primary} disabled={pending}>
        {pending ? t({ es: 'Entrando…', en: 'Signing in…' }) : t({ es: 'Iniciar sesión', en: 'Sign in' })}
      </button>
    </form>
  )
}

export function SignUpForm({ next }: { next: string }) {
  const { locale, t } = useI18n()
  const [state, action, pending] = useActionState(signUp, null)
  const [birthDate, setBirthDate] = useState('')
  const [level, setLevel] = useState('')
  const age = birthDate ? ageFrom(birthDate) : Number.NaN
  const needsGuardian = Number.isFinite(age) && age < GUARDIAN_CONSENT_AGE
  const f = state?.fields ?? {}
  if (state?.ok) return <AuthMessage state={state} />

  const legend = 'mb-3 flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-white/55 uppercase'
  const step = 'grid size-5 place-items-center rounded-full bg-white/10 text-[10px] text-white'

  return (
    <form action={action} onSubmit={keepValues(action)} className="space-y-7" noValidate>
      <input type="hidden" name="next" value={next} />

      <fieldset className="space-y-4">
        <legend className={legend}>
          <span className={step}>1</span> {t({ es: 'Tu acceso', en: 'Your login' })}
        </legend>
        <AuthField label="Email" name="email" type="email" autoComplete="email" placeholder={t({ es: 'tu@email.com', en: 'you@email.com' })} required error={f.email} />
        <AuthField
          label={t({ es: 'Contraseña', en: 'Password' })}
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          hint={t({ es: 'Mínimo 8 caracteres.', en: 'At least 8 characters.' })}
          error={f.password}
        />
      </fieldset>

      <fieldset className="space-y-4">
        <legend className={legend}>
          <span className={step}>2</span> {t({ es: 'Sobre ti', en: 'About you' })}
        </legend>
        <AuthField label={t({ es: 'Nombre y apellidos', en: 'Full name' })} name="fullName" autoComplete="name" required error={f.fullName} />
        <div className="grid gap-4 sm:grid-cols-2">
          <AuthField
            label={t({ es: 'Fecha de nacimiento', en: 'Date of birth' })}
            name="birthDate"
            type="date"
            autoComplete="bday"
            required
            max={new Date().toISOString().slice(0, 10)}
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            error={f.birthDate}
          />
          <AuthField label={t({ es: 'Teléfono (opcional)', en: 'Phone (optional)' })} name="phone" type="tel" autoComplete="tel" error={f.phone} />
        </div>
        {needsGuardian && (
          <label className="flex animate-fade-in items-start gap-3 rounded-xl bg-almendra/10 p-4 text-sm text-almendra ring-1 ring-almendra/20">
            <input type="checkbox" name="guardianConsent" className={darkCheck} />
            <span>
              {t({
                es: 'Tengo menos de 14 años y mi madre, padre o tutor me da permiso para crear esta cuenta y ha leído la política de privacidad.',
                en: "I'm under 14 and my parent or guardian gives me permission to create this account and has read the privacy policy.",
              })}
            </span>
          </label>
        )}
        {f.guardianConsent && <p className="text-xs text-[#ff8a7a]">{f.guardianConsent}</p>}
      </fieldset>

      <fieldset>
        <legend className={legend}>
          <span className={step}>3</span> {t({ es: 'Tu nivel en la cocina', en: 'Your cooking level' })}
        </legend>
        <div className="grid grid-cols-3 gap-2" role="radiogroup">
          {(
            [
              ['1', t({ es: 'Empiezo', en: 'Beginner' }), t({ es: 'Nunca he cocinado', en: 'Never cooked' })],
              ['2', t({ es: 'Me defiendo', en: 'Getting there' }), t({ es: 'Sartén y cazo, sí', en: 'Pans and pots, yes' })],
              ['3', t({ es: 'Voy a por todas', en: 'Bring it on' }), t({ es: 'Recetas del mundo', en: 'World recipes' })],
            ] as const
          ).map(([value, title, text]) => (
            <label
              key={value}
              className={cn(
                'cursor-pointer rounded-xl border p-3 text-center transition-colors',
                level === value ? 'border-chef bg-chef/15' : 'border-white/10 bg-white/[0.03] hover:border-white/25',
              )}
            >
              <input type="radio" name="cookingLevel" value={value} checked={level === value} onChange={() => setLevel(value)} className="sr-only" />
              <span className="block font-display text-2xl font-extrabold text-chef">{value}</span>
              <span className="block text-[13px] font-semibold">{title}</span>
              <span className="block text-[11px] text-white/45">{text}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className={legend}>
          <span className={step}>4</span> {t({ es: 'Alérgenos que evitas (opcional)', en: 'Allergens you avoid (optional)' })}
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {ALLERGENS.map((a) => (
            <label key={a.code} className="cursor-pointer">
              <input type="checkbox" name="avoidAllergens" value={a.code} className="peer sr-only" />
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] py-1 pr-3 pl-1 text-xs text-white/75 transition-colors peer-checked:border-chef peer-checked:bg-chef/15 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-white/60">
                <AllergenIcon code={a.code} size={20} /> {allergenLabel(a.code, locale)}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-3 border-t border-white/10 pt-5 text-sm text-white/75">
        <label className="flex items-start gap-3">
          <input type="checkbox" name="marketingOptIn" className={darkCheck} />
          <span>{t({ es: 'Quiero recibir recetas nuevas y promociones por email (opcional).', en: 'Send me new recipes and offers by email (optional).' })}</span>
        </label>
        <label className="flex items-start gap-3">
          <input type="checkbox" name="acceptPrivacy" className={darkCheck} required />
          <span>
            {t({ es: 'He leído y acepto la', en: 'I have read and accept the' })}{' '}
            <Link href="/legal/privacidad" target="_blank" className="font-medium text-white underline underline-offset-2">
              {t({ es: 'política de privacidad', en: 'privacy policy' })}
            </Link>
            .
          </span>
        </label>
        {f.acceptPrivacy && <p className="text-xs text-[#ff8a7a]">{f.acceptPrivacy}</p>}
      </div>

      <AuthMessage state={state} />
      <button type="submit" className={primary} disabled={pending}>
        {pending ? t({ es: 'Creando cuenta…', en: 'Creating account…' }) : t({ es: 'Crear mi cuenta', en: 'Create my account' })}
      </button>
    </form>
  )
}


/** Botones «Continuar con Google / Apple» (solo si están activados en Supabase y en NEXT_PUBLIC_AUTH_PROVIDERS). */
export function SocialButtons({ next }: { next: string }) {
  const { t } = useI18n()
  if (authProviders.length === 0) return null
  return (
    <div className="space-y-2.5">
      {authProviders.map((provider) => (
        <form key={provider} action={signInWithProvider}>
          <input type="hidden" name="provider" value={provider} />
          <input type="hidden" name="next" value={next} />
          <button
            type="submit"
            className="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-[15px] font-semibold text-white transition-colors hover:border-white/25 hover:bg-white/[0.08]"
          >
            {provider === 'google' ? <GoogleMark /> : <AppleMark />}
            {t({ es: 'Continuar con', en: 'Continue with' })} {provider === 'google' ? 'Google' : 'Apple'}
          </button>
        </form>
      ))}
    </div>
  )
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#4285F4" d="M22.6 12.3c0-.8-.1-1.5-.2-2.3H12v4.3h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2-1.9 3.3-4.7 3.3-8z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1-3.7 1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z" />
    </svg>
  )
}

function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path
        fill="currentColor"
        d="M16.4 12.6c0-2.4 2-3.6 2.1-3.6a4.6 4.6 0 0 0-3.6-2c-1.5-.2-3 .9-3.7.9-.8 0-2-.9-3.2-.8a4.8 4.8 0 0 0-4 2.4c-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8s1.9.8 3.2.7c1.3 0 2.1-1.2 2.9-2.4.9-1.3 1.3-2.6 1.3-2.7-.1 0-2.3-.9-2.3-3.9zM14.1 5.4c.7-.8 1.1-1.9 1-3a4.4 4.4 0 0 0-2.9 1.5c-.6.7-1.2 1.8-1 2.9 1.1.1 2.2-.6 2.9-1.4z"
      />
    </svg>
  )
}

export function ResetRequestForm() {
  const { t } = useI18n()
  const [state, action, pending] = useActionState(requestPasswordReset, null)
  if (state?.ok) return <AuthMessage state={state} />
  return (
    <form action={action} onSubmit={keepValues(action)} className="space-y-4" noValidate>
      <AuthField label="Email" name="email" type="email" autoComplete="email" placeholder={t({ es: 'tu@email.com', en: 'you@email.com' })} required />
      <AuthMessage state={state} />
      <button type="submit" className={primary} disabled={pending}>
        {pending ? t({ es: 'Enviando…', en: 'Sending…' }) : t({ es: 'Enviar enlace', en: 'Send link' })}
      </button>
    </form>
  )
}

export function NewPasswordForm() {
  const { t } = useI18n()
  const [state, action, pending] = useActionState(updatePassword, null)
  if (state?.ok) {
    return (
      <div className="space-y-4">
        <AuthMessage state={state} />
        <Link href="/cuenta" className={primary}>
          {t({ es: 'Ir a mi cuenta', en: 'Go to my account' })}
        </Link>
      </div>
    )
  }
  return (
    <form action={action} onSubmit={keepValues(action)} className="space-y-4" noValidate>
      <AuthField
        label={t({ es: 'Nueva contraseña', en: 'New password' })}
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        hint={t({ es: 'Mínimo 8 caracteres.', en: 'At least 8 characters.' })}
      />
      <AuthField label={t({ es: 'Repite la contraseña', en: 'Repeat the password' })} name="confirm" type="password" autoComplete="new-password" required minLength={8} />
      <AuthMessage state={state} />
      <button type="submit" className={primary} disabled={pending}>
        {pending ? t({ es: 'Guardando…', en: 'Saving…' }) : t({ es: 'Guardar contraseña', en: 'Save password' })}
      </button>
    </form>
  )
}
