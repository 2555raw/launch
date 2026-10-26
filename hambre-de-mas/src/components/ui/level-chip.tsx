import { cn } from '@/lib/cn'
import type { Accent } from '@/lib/types'

const styles: Record<Accent, string> = {
  chef: 'bg-chef/10 text-teja',
  teja: 'bg-teja text-white',
  hoja: 'bg-hoja/20 text-hoja-deep',
  almendra: 'bg-almendra text-teja',
}

const dots: Record<Accent, string> = {
  chef: 'bg-chef',
  teja: 'bg-teja',
  hoja: 'bg-hoja',
  almendra: 'bg-[#f2b68a]',
}

export function LevelChip({
  level,
  accent,
  name,
  overlay = false,
  className,
}: {
  level: number | null
  accent: Accent
  name?: string
  /** Versión neutra para ir encima de una foto. */
  overlay?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase',
        overlay ? 'bg-white/90 text-ink backdrop-blur' : styles[accent],
        className,
      )}
    >
      {overlay && <span aria-hidden className={cn('size-1.5 rounded-full', dots[accent])} />}
      {level ? `Nivel ${level}` : (name ?? 'Especial')}
    </span>
  )
}

export function Badge({ children, tone = 'teja' }: { children: React.ReactNode; tone?: 'teja' | 'ink' | 'hoja' }) {
  return (
    <span
      className={cn(
        'text-[12px] font-semibold',
        tone === 'teja' && 'text-teja',
        tone === 'ink' && 'text-ink',
        tone === 'hoja' && 'text-hoja-ink',
      )}
    >
      {children}
    </span>
  )
}
