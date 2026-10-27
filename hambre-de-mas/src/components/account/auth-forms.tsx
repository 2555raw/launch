'use client'

import Link from 'next/link'
import { startTransition, useActionState, useState, type FormEvent } from 'react'
import { requestPasswordReset, signIn, signInWithProvider, signUp, updatePassword, type AuthState } from '@/app/actions/auth'
import { AllergenIcon } from '@/components/product/allergen-icons'
import { ALLERGENS } from '@/lib/allergens'
import { GUARDIAN_CONSENT_AGE, ageFrom } from '@/lib/validation/schemas'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

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

export function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signIn, null)
  return (
    <form action={action} onSubmit={keepValues(action)} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <FormField label="Email" name="email" type="email" autoComplete="email" required error={state?.fields?.email} />
      <FormField label="Contraseña" name="password" type="password" autoComplete="current-password" required error={state?.fields?.password} />
      <div className="text-right">
        <Link href="/cuenta/recuperar" className="text-sm text-teja hover:underline">
          ¿Has olvidado la contraseña?
        </Link>
      </div>
      <FormMessage state={state} />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? 'Entrando…' : 'Iniciar sesión'}
      </Button>
    </form>
  )
}

export function SignUpForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signUp, null)
  const [birthDate, setBirthDate] = useState('')
  const [level, setLevel] = useState('')
  const age = birthDate ? ageFrom(birthDate) : Number.NaN
  const needsGuardian = Number.isFinite(age) && age < GUARDIAN_CONSENT_AGE
  const f = state?.fields ?? {}
  if (state?.ok) return <FormMessage state={state} />

  return (
    <form action={action} onSubmit={keepValues(action)} className="space-y-8" noValidate>
      <input type="hidden" name="next" value={next} />

      <fieldset className="space-y-4">
        <legend className="mb-3 font-display text-lg font-bold">1 · Tu acceso</legend>
        <FormField label="Email" name="email" type="email" autoComplete="email" required error={f.email} />
        <FormField
          label="Contraseña"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          hint="Mínimo 8 caracteres."
          error={f.password}
        />
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-3 font-display text-lg font-bold">2 · Sobre ti</legend>
        <FormField label="Nombre y apellidos" name="fullName" autoComplete="name" required error={f.fullName} />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Fecha de nacimiento"
            name="birthDate"
            type="date"
            autoComplete="bday"
            required
            max={new Date().toISOString().slice(0, 10)}
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            error={f.birthDate}
          />
          <FormField label="Teléfono (opcional)" name="phone" type="tel" autoComplete="tel" error={f.phone} />
        </div>
        {needsGuardian && (
          <label className="flex animate-fade-in items-start gap-3 rounded-2xl bg-almendra-soft p-4 text-sm text-teja">
            <input type="checkbox" name="guardianConsent" className="mt-0.5 size-4 shrink-0 accent-chef-ink" />
            <span>
              Tengo menos de 14 años y mi madre, padre o tutor me da permiso para crear esta cuenta y ha leído la política de privacidad.
            </span>
          </label>
        )}
        {f.guardianConsent && <p className="text-xs text-teja">{f.guardianConsent}</p>}
      </fieldset>

      <fieldset>
        <legend className="mb-1 font-display text-lg font-bold">3 · Tu nivel en la cocina</legend>
        <p className="mb-3 text-sm text-ash-ink">Te recomendaremos kits a tu medida. Lo puedes cambiar cuando quieras.</p>
        <div className="grid grid-cols-3 gap-2" role="radiogroup">
          {[
            ['1', 'Empiezo', 'Nunca he cocinado'],
            ['2', 'Me defiendo', 'Sartén y cazo, sí'],
            ['3', 'Voy a por todas', 'Recetas del mundo'],
          ].map(([value, title, text]) => (
            <label
              key={value}
              className={cn(
                'cursor-pointer rounded-2xl border-2 p-3 text-center transition-colors',
                level === value ? 'border-chef bg-almendra-soft' : 'border-line hover:border-line-strong',
              )}
            >
              <input type="radio" name="cookingLevel" value={value} checked={level === value} onChange={() => setLevel(value ?? "")} className="sr-only" />
              <span className="block font-display text-2xl font-extrabold text-chef">{value}</span>
              <span className="block text-sm font-semibold">{title}</span>
              <span className="block text-[11px] text-ash-ink">{text}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1 font-display text-lg font-bold">4 · Alérgenos que evitas (opcional)</legend>
        <p className="mb-3 text-sm text-ash-ink">Te avisaremos en los kits que los contengan.</p>
        <div className="flex flex-wrap gap-2">
          {ALLERGENS.map((a) => (
            <label key={a.code} className="cursor-pointer">
              <input type="checkbox" name="avoidAllergens" value={a.code} className="peer sr-only" />
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line py-1 pr-3 pl-1 text-xs font-medium transition-colors peer-checked:border-chef peer-checked:bg-almendra-soft peer-checked:text-teja peer-focus-visible:ring-2 peer-focus-visible:ring-chef-ink">
                <AllergenIcon code={a.code} size={22} /> {a.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-3 border-t border-line pt-6">
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="marketingOptIn" className="mt-0.5 size-4 shrink-0 accent-chef-ink" />
          <span>Quiero recibir recetas nuevas y promociones por email (opcional).</span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="acceptPrivacy" className="mt-0.5 size-4 shrink-0 accent-chef-ink" required />
          <span>
            He leído y acepto la{' '}
            <Link href="/legal/privacidad" target="_blank" className="text-teja underline underline-offset-2">
              política de privacidad
            </Link>
            .
          </span>
        </label>
        {f.acceptPrivacy && <p className="text-xs text-teja">{f.acceptPrivacy}</p>}
      </div>

      <FormMessage state={state} />
      <Button type="submit" size="lg" className="btn-sheen w-full" disabled={pending}>
        {pending ? 'Creando cuenta…' : 'Crear mi cuenta'}
      </Button>
    </form>
  )
}

const providers = (process.env.NEXT_PUBLIC_AUTH_PROVIDERS ?? '')
  .split(',')
  .map((p) => p.trim())
  .filter((p) => p === 'google' || p === 'apple')

/** Botones «Continuar con Google / Apple» (solo si están activados en Supabase y en NEXT_PUBLIC_AUTH_PROVIDERS). */
export function SocialButtons({ next }: { next: string }) {
  if (providers.length === 0) return null
  return (
    <div className="space-y-3">
      {providers.map((provider) => (
        <form key={provider} action={signInWithProvider}>
          <input type="hidden" name="provider" value={provider} />
          <input type="hidden" name="next" value={next} />
          <Button type="submit" variant="secondary" size="lg" className="w-full">
            {provider === 'google' ? <GoogleMark /> : <AppleMark />}
            Continuar con {provider === 'google' ? 'Google' : 'Apple'}
          </Button>
        </form>
      ))}
      <div className="flex items-center gap-3 py-2 text-xs text-ash-ink">
        <span className="h-px flex-1 bg-line" /> o con tu email <span className="h-px flex-1 bg-line" />
      </div>
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
  const [state, action, pending] = useActionState(requestPasswordReset, null)
  if (state?.ok) return <FormMessage state={state} />
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormField label="Email" name="email" type="email" autoComplete="email" required />
      <FormMessage state={state} />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? 'Enviando…' : 'Enviar enlace'}
      </Button>
    </form>
  )
}

export function NewPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, null)
  if (state?.ok) {
    return (
      <div className="space-y-4">
        <FormMessage state={state} />
        <Link href="/cuenta" className="text-sm text-teja hover:underline">
          Ir a mi cuenta
        </Link>
      </div>
    )
  }
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormField label="Nueva contraseña" name="password" type="password" autoComplete="new-password" required minLength={8} hint="Mínimo 8 caracteres." />
      <FormField label="Repite la contraseña" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
      <FormMessage state={state} />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? 'Guardando…' : 'Guardar contraseña'}
      </Button>
    </form>
  )
}
