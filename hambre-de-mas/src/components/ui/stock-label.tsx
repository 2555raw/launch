'use client'

import { cn } from '@/lib/cn'
import { useI18n } from '@/lib/i18n/client'
import type { Locale } from '@/lib/i18n/config'

export function stockState(stock: number, locale: Locale = 'es') {
  const en = locale === 'en'
  if (stock <= 0) return { tone: 'out', label: en ? 'Sold out' : 'Agotado' } as const
  if (stock <= 5) return { tone: 'low', label: en ? `Only ${stock} left!` : `¡Últimas ${stock} unidades!` } as const
  return { tone: 'in', label: en ? 'In stock · ships in 24–72 h' : 'En stock · envío en 24-72 h' } as const
}

export function StockLabel({ stock, className }: { stock: number; className?: string }) {
  const { locale } = useI18n()
  const s = stockState(stock, locale)
  return (
    <p
      className={cn(
        'flex items-center gap-2 text-sm',
        s.tone === 'in' && 'text-hoja-ink',
        s.tone === 'low' && 'text-ambar',
        s.tone === 'out' && 'text-ash-ink',
        className,
      )}
      role="status"
    >
      <span
        aria-hidden
        className={cn(
          'size-2 rounded-full',
          s.tone === 'in' && 'bg-hoja',
          s.tone === 'low' && 'bg-ambar',
          s.tone === 'out' && 'bg-ash',
        )}
      />
      {s.label}
    </p>
  )
}
