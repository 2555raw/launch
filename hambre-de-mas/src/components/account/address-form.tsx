'use client'

import { useActionState, useEffect, useRef } from 'react'
import { saveAddress } from '@/app/actions/account'
import { Button } from '@/components/ui/button'
import { FormField, FormMessage } from './auth-forms'

export function AddressForm() {
  const [state, action, pending] = useActionState(saveAddress, null)
  const ref = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (state?.ok) ref.current?.reset()
  }, [state])
  const f = state?.fields ?? {}
  return (
    <form ref={ref} action={action} className="grid gap-4 sm:grid-cols-2">
      <FormField label="Nombre de la dirección (opcional)" name="label" placeholder="Casa, casa de la abuela…" className="sm:col-span-2" />
      <FormField label="Nombre y apellidos" name="fullName" autoComplete="name" required error={f.fullName} className="sm:col-span-2" />
      <FormField label="Dirección" name="line1" autoComplete="address-line1" required error={f.line1} className="sm:col-span-2" />
      <FormField label="Piso, puerta… (opcional)" name="line2" autoComplete="address-line2" className="sm:col-span-2" />
      <FormField label="Código postal" name="postalCode" inputMode="numeric" maxLength={5} autoComplete="postal-code" required error={f.postalCode} />
      <FormField label="Ciudad" name="city" autoComplete="address-level2" required error={f.city} />
      <FormField label="Provincia" name="province" autoComplete="address-level1" required error={f.province} />
      <FormField label="Teléfono" name="phone" type="tel" autoComplete="tel" error={f.phone} />
      <label className="flex items-center gap-3 text-sm sm:col-span-2">
        <input type="checkbox" name="isDefault" className="size-4 accent-chef-ink" /> Usar como predeterminada
      </label>
      <div className="space-y-3 sm:col-span-2">
        <FormMessage state={state} />
        <Button type="submit" disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar dirección'}
        </Button>
      </div>
    </form>
  )
}
