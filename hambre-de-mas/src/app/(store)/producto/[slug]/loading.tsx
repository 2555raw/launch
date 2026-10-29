'use client'

import { ProductPageSkeleton } from '@/components/ui/skeleton'
import { useI18n } from '@/lib/i18n/client'

export default function Loading() {
  const { t } = useI18n()
  return <ProductPageSkeleton label={t({ es: 'Cargando el kit', en: 'Loading the kit' })} />
}
