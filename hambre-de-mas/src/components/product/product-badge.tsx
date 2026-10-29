import { SparkIcon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'

const isNew = (badge: string) => /^(nuevo|new)$/i.test(badge.trim())
const isBestSeller = (badge: string) => /^(más vendido|best seller)$/i.test(badge.trim())

/** Etiqueta del kit: «Nuevo» en rojo (con brillo), «Más vendido» en negro y el resto en texto. */
export function ProductBadge({ badge, className }: { badge: string; className?: string }) {
  // El brillo necesita un contenedor posicionado; si ya viene «absolute» no se pisa
  const positioned = className?.includes('absolute') ? null : 'relative'
  if (isNew(badge)) {
    return (
      <span className={cn(positioned, 'badge-new inline-flex items-center gap-1 rounded-full bg-chef-ink px-2.5 py-1 text-[11px] font-bold tracking-wide text-white uppercase shadow-sm', className)}>
        <SparkIcon size={12} /> {badge}
      </span>
    )
  }
  if (isBestSeller(badge)) {
    return (
      <span className={cn('inline-flex items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-[11px] font-bold tracking-wide text-white uppercase shadow-sm', className)}>
        <span aria-hidden className="text-[13px] leading-none">🔥</span> {badge}
      </span>
    )
  }
  return <span className={cn('text-[12px] font-semibold text-teja', className)}>{badge}</span>
}
