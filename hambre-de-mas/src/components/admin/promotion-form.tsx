'use client'

import { useActionState, useEffect, useRef } from 'react'
import { savePromotion } from '@/app/actions/admin'
import { Button } from '@/components/ui/button'
import { Label, Notice, field } from './ui'

export function PromotionForm() {
  const [state, action, pending] = useActionState(savePromotion, null)
  const ref = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (state?.ok) ref.current?.reset()
  }, [state])
  return (
    <form ref={ref} action={action} className="grid gap-3 sm:grid-cols-2">
      <div>
        <Label htmlFor="code">Código</Label>
        <input id="code" name="code" required placeholder="VERANO15" className={`${field} mt-1 font-mono uppercase`} />
      </div>
      <div>
        <Label htmlFor="kind">Tipo</Label>
        <select id="kind" name="kind" className={`${field} mt-1`}>
          <option value="percent">Porcentaje</option>
          <option value="fixed">Importe fijo (€)</option>
        </select>
      </div>
      <div>
        <Label htmlFor="value">Valor (% o €)</Label>
        <input id="value" name="value" inputMode="decimal" required className={`${field} mt-1`} />
      </div>
      <div>
        <Label htmlFor="minSubtotal">Pedido mínimo (€)</Label>
        <input id="minSubtotal" name="minSubtotal" inputMode="decimal" defaultValue="0" className={`${field} mt-1`} />
      </div>
      <div>
        <Label htmlFor="startsAt">Empieza</Label>
        <input id="startsAt" name="startsAt" type="datetime-local" className={`${field} mt-1`} />
      </div>
      <div>
        <Label htmlFor="endsAt">Termina</Label>
        <input id="endsAt" name="endsAt" type="datetime-local" className={`${field} mt-1`} />
      </div>
      <div>
        <Label htmlFor="maxRedemptions">Usos máximos</Label>
        <input id="maxRedemptions" name="maxRedemptions" inputMode="numeric" placeholder="Sin límite" className={`${field} mt-1`} />
      </div>
      <div>
        <Label htmlFor="description">Descripción interna</Label>
        <input id="description" name="description" className={`${field} mt-1`} />
      </div>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="isActive" defaultChecked className="size-4 accent-chef-ink" /> Activa
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button size="sm" disabled={pending}>{pending ? 'Guardando…' : 'Crear promoción'}</Button>
        <Notice state={state} />
      </div>
    </form>
  )
}
