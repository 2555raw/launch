'use client'

import { useActionState, useEffect, useRef } from 'react'
import { saveAddress } from '@/app/actions/account'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n/client'
import { FormField, FormMessage } from './auth-forms'

export function AddressForm() {
  const { t } = useI18n()
  const [state, action, pending] = useActionState(saveAddress, null)
  const ref = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (state?.ok) ref.current?.reset()
  }, [state])
  const f = state?.fields ?? {}
  return (
    <form ref={ref} action={action} className="grid gap-4 sm:grid-cols-2">
      <FormField
        label={t({ es: 'Nombre de la dirección (opcional)', en: 'Address name (optional)' })}
        name="label"
        placeholder={t({ es: 'Casa, casa de la abuela…', en: "Home, grandma's…" })}
        className="sm:col-span-2" />
      <FormField label={t({ es: 'Nombre y apellidos', en: 'Full name' })} name="fullName" autoComplete="name" required error={f.fullName} className="sm:col-span-2" />
      <FormField label={t({ es: 'Dirección', en: 'Address' })} name="line1" autoComplete="address-line1" required error={f.line1} className="sm:col-span-2" />
      <FormField label={t({ es: 'Piso, puerta… (opcional)', en: 'Flat, floor… (optional)' })} name="line2" autoComplete="address-line2" className="sm:col-span-2" />
      <FormField label={t({ es: 'Código postal', en: 'Postcode' })} name="postalCode" inputMode="numeric" maxLength={5} autoComplete="postal-code" required error={f.postalCode} />
      <FormField label={t({ es: 'Ciudad', en: 'City' })} name="city" autoComplete="address-level2" required error={f.city} />
      <FormField label={t({ es: 'Provincia', en: 'Province' })} name="province" autoComplete="address-level1" required error={f.province} />
      <FormField label={t({ es: 'Teléfono', en: 'Phone' })} name="phone" type="tel" autoComplete="tel" error={f.phone} />
      <label className="flex items-center gap-3 text-sm sm:col-span-2">
        <input type="checkbox" name="isDefault" className="size-4 accent-chef-ink" /> {t({ es: 'Usar como predeterminada', en: 'Use as default' })}
      </label>
      <div className="space-y-3 sm:col-span-2">
        <FormMessage state={state} />
        <Button type="submit" disabled={pending}>
          {pending ? t({ es: 'Guardando…', en: 'Saving…' }) : t({ es: 'Guardar dirección', en: 'Save address' })}
        </Button>
      </div>
    </form>
  )
}
