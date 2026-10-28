'use client'

import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/cn'
import { site } from '@/lib/config/site'
import { useI18n } from '@/lib/i18n/client'

/** Logotipo de la guía de identidad: el gorro de chef con el nombre en curva. */
export function Logo({ className }: { className?: string }) {
  const { t } = useI18n()
  return (
    <Link href="/" className={cn('group flex items-center', className)} aria-label={`${site.name}, ${t({ es: 'ir al inicio', en: 'go to home page' })}`}>
      <Image src="/brand/logo-720.png" alt="" width={720} height={653} priority sizes="64px" className="hat-anim h-12 w-auto" />
    </Link>
  )
}
