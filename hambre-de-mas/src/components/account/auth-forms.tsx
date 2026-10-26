'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { requestPasswordReset, signIn, signUp, updatePassword, type AuthState } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

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
    <form action={action} className="space-y-4" noValidate>
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
  if (state?.ok) return <FormMessage state={state} />
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <FormField label="Nombre y apellidos" name="fullName" autoComplete="name" required error={state?.fields?.fullName} />
      <FormField label="Email" name="email" type="email" autoComplete="email" required error={state?.fields?.email} />
      <FormField
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        hint="Mínimo 8 caracteres."
        error={state?.fields?.password}
      />
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="acceptPrivacy" className="mt-0.5 size-4 shrink-0 accent-chef-ink" required />
        <span>
          He leído la{' '}
          <Link href="/legal/privacidad" target="_blank" className="text-teja underline underline-offset-2">
            política de privacidad
          </Link>
          . Si tengo menos de 14 años, cuento con el permiso de mi madre, padre o tutor.
        </span>
      </label>
      {state?.fields?.acceptPrivacy && <p className="text-xs text-teja">{state.fields.acceptPrivacy}</p>}
      <FormMessage state={state} />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? 'Creando cuenta…' : 'Crear cuenta'}
      </Button>
    </form>
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
