'use client'

import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/cn'
import { site } from '@/lib/config/site'
import { useI18n } from '@/lib/i18n/client'

/** Logotipo de la guía de identidad (gorro de chef) con el nombre al lado. */
export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { t } = useI18n()
  return (
    <Link href="/" className={cn('group flex items-center gap-2', className)} aria-label={`${site.name}, ${t({ es: 'ir al inicio', en: 'go to home page' })}`}>
      <Image
        src="/brand/logo-320.png"
        alt=""
        width={320}
        height={290}
        priority
        className="hat-anim h-9 w-auto"
      />
      {!compact && (
        <span className="font-display text-[15px] leading-none font-extrabold tracking-tight text-ink">
          Hambre de <span className="text-chef">Más</span>
        </span>
      )}
    </Link>
  )
}
