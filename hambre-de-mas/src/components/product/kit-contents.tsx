'use client'

import Image from 'next/image'
import { QrIcon, SnowflakeIcon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'
import { useI18n } from '@/lib/i18n/client'

/** Sobrecito de especias (papel con la parte de arriba dentada). */
export function SachetIcon({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className={className}>
      <path d="M5 6l1.2-1.5L7.4 6l1.2-1.5L9.8 6l1.2-1.5L12.2 6l1.2-1.5L14.6 6l1.2-1.5L17 6l1.2-1.5L19 6v13a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19z" fill="currentColor" opacity=".18" />
      <path d="M5 6l1.2-1.5L7.4 6l1.2-1.5L9.8 6l1.2-1.5L12.2 6l1.2-1.5L14.6 6l1.2-1.5L17 6l1.2-1.5L19 6v13a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="12" cy="13" r="2.6" fill="currentColor" />
    </svg>
  )
}

function PackIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden>
      <path d="M4 8l8-4 8 4v8l-8 4-8-4z" />
      <path d="M4 8l8 4 8-4M12 12v8" />
    </svg>
  )
}

const FRESH =
  /fresc|salmón|pollo|carne|mozzarella|albahaca|limón|lima|nata|mantequilla|yogur natural|obleas|^col\b|zanahoria|aguacate|mango|pepino\b|edamame|pimiento|^cebolla$|guanciale|huevos|pecorino|codillo|lombarda|romero|fresh|salmon|chicken|lemon|butter|cream|wrappers|minced|avocado|cucumber|green pepper|^onion$|eggs|knuckle|red cabbage|rosemary/i

type Kind = 'sobre' | 'fresco' | 'tarjeta' | 'despensa'

export function classifyKitItem(item: string, storage?: 'seco' | 'fresco'): Kind {
  if (/^sobres? |sachets?\b/i.test(item)) return 'sobre'
  if (/tarjeta|recipe card|qr recipe/i.test(item)) return 'tarjeta'
  if (storage === 'fresco' && FRESH.test(item)) return 'fresco'
  return 'despensa'
}

const kinds: Record<Kind, { label: { es: string; en: string }; className: string; icon: React.ReactNode }> = {
  sobre: { label: { es: 'Sobre individual', en: 'Single sachet' }, className: 'bg-almendra text-teja', icon: <SachetIcon /> },
  fresco: { label: { es: 'Fresco · refrigerado', en: 'Fresh · chilled' }, className: 'bg-[#E4F1FB] text-[#14507A]', icon: <SnowflakeIcon size={20} /> },
  tarjeta: { label: { es: 'Con QR', en: 'With QR' }, className: 'bg-ink text-white', icon: <QrIcon size={20} /> },
  despensa: { label: { es: 'De despensa', en: 'Cupboard' }, className: 'bg-mist text-ink', icon: <PackIcon /> },
}

/**
 * «Qué trae el kit»: cada elemento con su foto (si la hay) y una marca según
 * cómo viene: sobre individual, fresco, de despensa o tarjeta con QR.
 */
export function KitContents({
  items,
  images = [],
  storage,
}: {
  items: string[]
  images?: (string | null)[]
  storage?: 'seco' | 'fresco'
}) {
  const { t } = useI18n()
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((item, i) => {
        const kind = kinds[classifyKitItem(item, storage)]
        const photo = images[i]
        return (
          <li key={item} className="flex items-center gap-3.5 rounded-2xl border border-line p-2.5 pr-3">
            {photo ? (
              <span className="relative size-16 shrink-0">
                <span className="absolute inset-0 overflow-hidden rounded-xl bg-mist">
                  <Image src={photo} alt="" fill sizes="64px" className="object-cover" />
                </span>
                <span
                  className={cn('absolute -right-1.5 -bottom-1.5 grid size-6 place-items-center rounded-full ring-2 ring-white [&_svg]:size-3.5', kind.className)}
                  aria-hidden
                >
                  {kind.icon}
                </span>
              </span>
            ) : (
              <span className={cn('grid size-16 shrink-0 place-items-center rounded-xl', kind.className)}>{kind.icon}</span>
            )}
            <span className="min-w-0">
              <span className="block text-[15px] leading-snug font-medium">{item}</span>
              <span className="block text-xs text-ash-ink">{t(kind.label)}</span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}
