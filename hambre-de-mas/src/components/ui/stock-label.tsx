import { cn } from '@/lib/cn'

export function stockState(stock: number) {
  if (stock <= 0) return { tone: 'out', label: 'Agotado' } as const
  if (stock <= 5) return { tone: 'low', label: `¡Últimas ${stock} unidades!` } as const
  return { tone: 'in', label: 'En stock · envío en 24-72 h' } as const
}

export function StockLabel({ stock, className }: { stock: number; className?: string }) {
  const s = stockState(stock)
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
