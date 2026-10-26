'use client'

import { useActionState } from 'react'
import { updateProfile } from '@/app/actions/account'
import { Button } from '@/components/ui/button'
import { FormField, FormMessage } from './auth-forms'

export function ProfileForm({ fullName, phone, marketingOptIn }: { fullName: string; phone: string; marketingOptIn: boolean }) {
  const [state, action, pending] = useActionState(updateProfile, null)
  return (
    <form action={action} className="space-y-4">
      <FormField label="Nombre y apellidos" name="fullName" defaultValue={fullName} autoComplete="name" required error={state?.fields?.fullName} />
      <FormField label="Teléfono" name="phone" type="tel" defaultValue={phone} autoComplete="tel" error={state?.fields?.phone} />
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="marketingOptIn" defaultChecked={marketingOptIn} className="mt-0.5 size-4 accent-chef-ink" />
        Quiero recibir novedades y promociones por email.
      </label>
      <FormMessage state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? 'Guardando…' : 'Guardar cambios'}
      </Button>
    </form>
  )
}
