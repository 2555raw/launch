'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { MinusIcon, PlusIcon, TrashIcon } from '@/components/ui/icons'
import { ProductImage } from '@/components/ui/product-image'
import { cn } from '@/lib/cn'
import { commerce } from '@/lib/config/commerce'
import { formatPrice } from '@/lib/money'
import type { QuoteLine } from '@/lib/pricing/quote'
import { useCart, type CartItem } from './cart-context'

export function QuantityStepper({
  value,
  max,
  onChange,
  label,
  size = 'md',
}: {
  value: number
  max: number
  onChange: (n: number) => void
  label: string
  size?: 'sm' | 'md'
}) {
  const limit = Math.max(1, Math.min(max, commerce.maxQuantityPerLine))
  return (
    <div
      className={cn('inline-flex items-center rounded-full bg-mist', size === 'sm' ? 'h-8' : 'h-11')}
      role="group"
      aria-label={`Cantidad de ${label}`}
    >
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={value <= 1}
        className={cn('grid place-items-center rounded-full transition-colors hover:bg-line disabled:opacity-30', size === 'sm' ? 'size-8' : 'size-11')}
        aria-label="Quitar una unidad"
      >
        <MinusIcon size={size === 'sm' ? 14 : 16} />
      </button>
      <output className={cn('text-center font-medium tabular-nums', size === 'sm' ? 'w-6 text-sm' : 'w-8')} aria-live="polite">
        {value}
      </output>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={value >= limit}
        className={cn('grid place-items-center rounded-full transition-colors hover:bg-line disabled:opacity-30', size === 'sm' ? 'size-8' : 'size-11')}
        aria-label="Añadir una unidad"
      >
        <PlusIcon size={size === 'sm' ? 14 : 16} />
      </button>
    </div>
  )
}

export function CartLine({ item, quoteLine, compact = false }: { item: CartItem; quoteLine?: QuoteLine; compact?: boolean }) {
  const { setQuantity, removeItem } = useCart()
  const unavailable = quoteLine && quoteLine.availableQuantity === 0
  const unitPrice = quoteLine?.unitPriceCents || item.priceCents

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, paddingTop: 0, paddingBottom: 0 }}
      transition={{ duration: 0.3, ease: [0.28, 0.11, 0.32, 1] }}
      className={cn('flex gap-4 overflow-hidden', compact ? 'py-4' : 'py-6')}
    >
      <Link
        href={`/producto/${item.slug}`}
        className={cn('relative shrink-0 overflow-hidden rounded-2xl bg-mist', compact ? 'size-20' : 'size-24 sm:size-32')}
      >
        {item.imageUrl && <ProductImage src={item.imageUrl} alt={item.name} fill sizes="128px" className="object-cover" />}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={`/producto/${item.slug}`} className={cn('block font-semibold hover:text-teja', compact ? 'text-sm' : 'text-[17px]')}>
              {item.name}
            </Link>
            <p className="text-sm text-ash-ink">{item.variantName}</p>
          </div>
          <p className={cn('font-semibold tabular-nums', compact ? 'text-sm' : 'text-[17px]', unavailable && 'text-ash line-through')}>
            {formatPrice(unitPrice * item.quantity)}
          </p>
        </div>
        {quoteLine?.message && (
          <p className={cn('mt-1 text-xs', unavailable ? 'text-teja' : 'text-ambar')} role="status">
            {quoteLine.message}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between gap-3 pt-3">
          {unavailable ? (
            <span className="text-xs text-ash-ink">No disponible</span>
          ) : (
            <QuantityStepper
              value={item.quantity}
              max={quoteLine?.availableQuantity ?? item.maxQuantity}
              onChange={(n) => setQuantity(item.variantId, n)}
              label={`${item.name} ${item.variantName}`}
              size="sm"
            />
          )}
          <button
            type="button"
            onClick={() => removeItem(item.variantId)}
            className="inline-flex items-center gap-1 text-xs text-ash-ink transition-colors hover:text-teja"
          >
            <TrashIcon size={15} /> Eliminar
          </button>
        </div>
      </div>
    </motion.li>
  )
}
