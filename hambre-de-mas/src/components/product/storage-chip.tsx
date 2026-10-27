'use client'

import { JarIcon, SnowflakeIcon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'
import { useI18n } from '@/lib/i18n/client'

/** Indica si el kit es 100 % de despensa o incluye frescos refrigerados. */
export function StorageChip({ storage, className }: { storage?: 'seco' | 'fresco'; className?: string }) {
  const { t } = useI18n()
  if (!storage) return null
  const fresh = storage === 'fresco'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium',
        fresh ? 'bg-[#E4F1FB] text-[#14507A]' : 'bg-almendra text-teja',
        className,
      )}
    >
      {fresh ? <SnowflakeIcon size={15} /> : <JarIcon size={15} />}
      {fresh
        ? t({ es: 'Incluye frescos · envío refrigerado', en: 'Includes fresh food · ships chilled' })
        : t({ es: '100 % seco · de despensa', en: '100% dry · cupboard-friendly' })}
    </span>
  )
}
