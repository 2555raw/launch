'use client'

import { useActionState } from 'react'
import { setStock } from '@/app/actions/admin'
import { cn } from '@/lib/cn'
import { field } from './ui'

export function StockInput({ variantId, stock }: { variantId: string; stock: number }) {
  const [state, action, pending] = useActionState(setStock, null)
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="variantId" value={variantId} />
      <label htmlFor={`stock-${variantId}`} className="sr-only">
        Stock
      </label>
      <input
        id={`stock-${variantId}`}
        name="stock"
        type="number"
        min={0}
        defaultValue={stock}
        className={cn(field, 'h-8 w-20 tabular-nums', stock <= 5 && 'border-teja/50 text-teja')}
      />
      <button className="rounded-lg bg-mist px-2.5 py-1 text-xs hover:bg-line" disabled={pending}>
        {pending ? '…' : 'Guardar'}
      </button>
      {state?.message && <span className={cn('text-xs', state.ok ? 'text-hoja-ink' : 'text-teja')}>{state.message}</span>}
    </form>
  )
}
