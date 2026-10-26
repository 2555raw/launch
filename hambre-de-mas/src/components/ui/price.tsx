import { cn } from '@/lib/cn'
import { formatPrice } from '@/lib/money'

export function Price({
  cents,
  compareAt,
  from = false,
  className,
  size = 'md',
}: {
  cents: number
  compareAt?: number | null
  from?: boolean
  className?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const onSale = compareAt != null && compareAt > cents
  return (
    <p className={cn('flex flex-wrap items-baseline gap-x-2', className)}>
      <span
        className={cn(
          'font-semibold tabular-nums',
          onSale ? 'text-teja' : 'text-ink',
          size === 'lg' && 'text-2xl',
          size === 'md' && 'text-[15px]',
          size === 'sm' && 'text-sm',
        )}
      >
        {from && <span className="font-normal text-ash-ink">Desde </span>}
        {formatPrice(cents)}
      </span>
      {onSale && (
        <span className={cn('text-ash-ink line-through tabular-nums', size === 'lg' ? 'text-base' : 'text-sm')}>
          <span className="sr-only">Antes </span>
          {formatPrice(compareAt)}
        </span>
      )}
    </p>
  )
}
