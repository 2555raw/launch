'use client'

import { CatalogSkeleton } from '@/components/ui/skeleton'
import { useI18n } from '@/lib/i18n/client'

export default function Loading() {
  const { t } = useI18n()
  return <CatalogSkeleton label={t({ es: 'Cargando kits', en: 'Loading kits' })} />
}
