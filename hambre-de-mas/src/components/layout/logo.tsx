'use client'

import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/cn'
import { site } from '@/lib/config/site'
import { useI18n } from '@/lib/i18n/client'

/**
 * Logotipo de la guía de identidad: el gorro de chef con el nombre en curva.
 * Con `badge`, en escritorio cuelga de la cabecera dentro de un círculo blanco, como un sello.
 */
export function Logo({ className, badge = false }: { className?: string; badge?: boolean }) {
  const { t } = useI18n()
  return (
    <Link
      href="/"
      className={cn('group flex items-center', badge && 'relative z-10 self-start lg:mt-2', className)}
      aria-label={`${site.name}, ${t({ es: 'ir al inicio', en: 'go to home page' })}`}
    >
      <span
        className={cn(
          'flex items-center',
          badge && 'lg:size-[112px] lg:justify-center lg:rounded-full lg:bg-white lg:shadow-[0_10px_30px_-12px_rgb(29_29_31/0.35)] lg:ring-1 lg:ring-line',
        )}
      >
        <Image
          src="/brand/logo-720.png"
          alt=""
          width={720}
          height={653}
          priority
          sizes={badge ? '(min-width: 1024px) 112px, 64px' : '64px'}
          className={cn('hat-anim w-auto', badge ? 'mt-1 h-14 lg:mt-0 lg:h-[84px]' : 'h-11 translate-y-px')}
        />
      </span>
    </Link>
  )
}
