'use client'

import { useActionState } from 'react'
import { updateProfile } from '@/app/actions/account'
import { AllergenIcon } from '@/components/product/allergen-icons'
import { Button } from '@/components/ui/button'
import { ALLERGENS } from '@/lib/allergens'
import { FormField, FormMessage, inputClass } from './auth-forms'

type Props = {
  fullName: string
  phone: string
  marketingOptIn: boolean
  cookingLevel: number | null
  avoidAllergens: string[]
}

export function ProfileForm({ fullName, phone, marketingOptIn, cookingLevel, avoidAllergens }: Props) {
  const [state, action, pending] = useActionState(updateProfile, null)
  return (
    <form action={action} className="space-y-5">
      <FormField label="Nombre y apellidos" name="fullName" defaultValue={fullName} autoComplete="name" required error={state?.fields?.fullName} />
      <FormField label="Teléfono" name="phone" type="tel" defaultValue={phone} autoComplete="tel" error={state?.fields?.phone} />
      <div>
        <label htmlFor="cookingLevel" className="mb-1.5 block text-sm font-medium">
          Tu nivel en la cocina
        </label>
        <select id="cookingLevel" name="cookingLevel" defaultValue={cookingLevel ? String(cookingLevel) : ''} className={inputClass}>
          <option value="">Sin indicar</option>
          <option value="1">Nivel 1 · Empiezo</option>
          <option value="2">Nivel 2 · Me defiendo</option>
          <option value="3">Nivel 3 · Voy a por todas</option>
        </select>
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Alérgenos que evitas</legend>
        <div className="flex flex-wrap gap-2">
          {ALLERGENS.map((a) => (
            <label key={a.code} className="cursor-pointer">
              <input type="checkbox" name="avoidAllergens" value={a.code} defaultChecked={avoidAllergens.includes(a.code)} className="peer sr-only" />
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line py-1 pr-3 pl-1 text-xs font-medium transition-colors peer-checked:border-chef peer-checked:bg-almendra-soft peer-checked:text-teja peer-focus-visible:ring-2 peer-focus-visible:ring-chef-ink">
                <AllergenIcon code={a.code} size={22} /> {a.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
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
