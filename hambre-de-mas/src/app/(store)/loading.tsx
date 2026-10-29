'use client'

import { Bone, ProductCardSkeleton } from '@/components/ui/skeleton'
import { useI18n } from '@/lib/i18n/client'

/** Esqueleto mientras carga una página de la tienda (las más específicas tienen el suyo). */
export default function Loading() {
  const { t } = useI18n()
  return (
    <div className="container-page pt-12 pb-24" aria-busy="true" aria-label={t({ es: 'Cargando', en: 'Loading' })}>
      <Bone className="h-4 w-24" />
      <Bone className="mt-4 h-14 w-2/3 rounded-2xl" />
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}
