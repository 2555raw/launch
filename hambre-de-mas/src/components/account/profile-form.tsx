'use client'

import { useActionState } from 'react'
import { updateProfile } from '@/app/actions/account'
import { AllergenIcon } from '@/components/product/allergen-icons'
import { Button } from '@/components/ui/button'
import { ALLERGENS, allergenLabel } from '@/lib/allergens'
import { useI18n } from '@/lib/i18n/client'
import { FormField, FormMessage, inputClass } from './auth-forms'

type Props = {
  fullName: string
  phone: string
  marketingOptIn: boolean
  cookingLevel: number | null
  avoidAllergens: string[]
}

export function ProfileForm({ fullName, phone, marketingOptIn, cookingLevel, avoidAllergens }: Props) {
  const { locale, t } = useI18n()
  const [state, action, pending] = useActionState(updateProfile, null)
  return (
    <form action={action} className="space-y-5">
      <FormField label={t({ es: 'Nombre y apellidos', en: 'Full name' })} name="fullName" defaultValue={fullName} autoComplete="name" required error={state?.fields?.fullName} />
      <FormField label={t({ es: 'Teléfono', en: 'Phone' })} name="phone" type="tel" defaultValue={phone} autoComplete="tel" error={state?.fields?.phone} />
      <div>
        <label htmlFor="cookingLevel" className="mb-1.5 block text-sm font-medium">
          {t({ es: 'Tu nivel en la cocina', en: 'Your cooking level' })}
        </label>
        <select id="cookingLevel" name="cookingLevel" defaultValue={cookingLevel ? String(cookingLevel) : ''} className={inputClass}>
          <option value="">{t({ es: 'Sin indicar', en: 'Not set' })}</option>
          <option value="1">{t({ es: 'Primer bocado · Empiezo', en: 'First bite · Beginner' })}</option>
          <option value="2">{t({ es: 'Con ganas · Me defiendo', en: 'Getting hungry · Getting there' })}</option>
          <option value="3">{t({ es: 'Hambre de más · Voy a por todas', en: 'Hungry for more · Bring it on' })}</option>
        </select>
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">{t({ es: 'Alérgenos que evitas', en: 'Allergens you avoid' })}</legend>
        <div className="flex flex-wrap gap-2">
          {ALLERGENS.map((a) => (
            <label key={a.code} className="cursor-pointer">
              <input type="checkbox" name="avoidAllergens" value={a.code} defaultChecked={avoidAllergens.includes(a.code)} className="peer sr-only" />
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line py-1 pr-3 pl-1 text-xs font-medium transition-colors peer-checked:border-chef peer-checked:bg-almendra-soft peer-checked:text-teja peer-focus-visible:ring-2 peer-focus-visible:ring-chef-ink">
                <AllergenIcon code={a.code} size={22} /> {allergenLabel(a.code, locale)}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="marketingOptIn" defaultChecked={marketingOptIn} className="mt-0.5 size-4 accent-chef-ink" />
        {t({ es: 'Quiero recibir novedades y promociones por email.', en: 'Send me news and offers by email.' })}
      </label>
      <FormMessage state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? t({ es: 'Guardando…', en: 'Saving…' }) : t({ es: 'Guardar cambios', en: 'Save changes' })}
      </Button>
    </form>
  )
}
