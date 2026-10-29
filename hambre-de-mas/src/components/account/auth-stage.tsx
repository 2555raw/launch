import Image from 'next/image'
import Link from 'next/link'
import { ArrowRightIcon, ChevronLeftIcon } from '@/components/ui/icons'
import { getI18n } from '@/lib/i18n/server'
import { LocaleSwitcher } from '@/components/layout/locale-switcher'

/**
 * Escenario de las pantallas de acceso: fondo claro de la tienda con un remolino de
 * caracteres (como los fideos de un bol visto desde arriba) que gira muy
 * despacio, y la tarjeta del formulario en el centro. El dibujo se genera en
 * el servidor y la animación es CSS: no necesita JavaScript.
 */

const CHARS = ' .·:-=+*#%@'

/** Dibujo ASCII determinista: un anillo de espiral y un halo de puntos. */
export function asciiSwirl(cols = 168, rows = 76) {
  const cx = cols / 2
  const cy = rows / 2
  const lines: string[] = []
  for (let y = 0; y < rows; y++) {
    let line = ''
    for (let x = 0; x < cols; x++) {
      // Las celdas de texto son más altas que anchas: se corrige el aspecto.
      const dx = (x - cx) * 0.5
      const dy = y - cy
      const r = Math.hypot(dx, dy)
      const theta = Math.atan2(dy, dx)
      const swirl = 0.5 + 0.5 * Math.sin(r * 0.62 - theta * 3)
      const band = Math.exp(-(((r - 21) / 8.5) ** 2))
      const halo = Math.exp(-(((r - 34) / 2.2) ** 2)) * (0.5 + 0.5 * Math.sin(theta * 22))
      const grain = (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1
      const value = Math.max(swirl * band, halo * 0.45) - Math.abs(grain) * 0.12
      line += CHARS[Math.max(0, Math.min(CHARS.length - 1, Math.round(value * (CHARS.length - 1))))]
    }
    lines.push(line.trimEnd())
  }
  return lines.join('\n')
}

const art = asciiSwirl()

export async function AuthStage({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  const { t } = await getI18n()
  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-almendra-soft text-ink">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 grid place-items-center">
        <pre className="auth-swirl font-mono text-[9px] leading-[1.05] text-chef/35 select-none sm:text-[11px]">{art}</pre>
        <div className="absolute size-[520px] rounded-full bg-white/80 blur-[100px]" />
      </div>

      <header className="flex items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" className="inline-flex items-center gap-1 text-[13px] text-ash-ink transition-colors hover:text-ink">
          <ChevronLeftIcon size={16} />
          {t({ es: 'Volver a la tienda', en: 'Back to the shop' })}
        </Link>
        <LocaleSwitcher />
      </header>

      <main id="contenido" className="flex flex-1 items-start justify-center px-4 pt-2 pb-16 sm:items-center sm:pt-0">
        <div
          className={`w-full ${wide ? 'max-w-[540px]' : 'max-w-[440px]'} overflow-hidden rounded-[28px] border border-line bg-white shadow-[0_40px_100px_-30px_rgb(191_45_17/0.35)]`}
        >
          <Link href="/" className="flex flex-col items-center gap-1 border-b border-line px-6 pt-7 pb-5" aria-label="Hambre de Más">
            <span className="flex items-center gap-2.5">
              <span className="grid size-10 place-items-center rounded-full bg-white ring-1 ring-line">
                <Image src="/brand/logo-320.png" alt="" width={320} height={290} className="hat-anim h-7 w-auto" priority />
              </span>
              <span className="font-display text-[22px] font-extrabold tracking-tight">
                Hambre de <span className="text-chef">Más</span>
              </span>
            </span>
            <span className="text-[11px] text-ash">{t({ es: 'kits de cocina para adolescentes', en: 'cooking kits for teens' })}</span>
          </Link>
          {children}
          <footer className="border-t border-line bg-mist/60 px-6 py-4 text-center text-[12px] text-ash-ink">
            <p>{t({ es: 'Tus datos son privados. No los vendemos ni los compartimos.', en: 'Your data is private. We never sell or share it.' })}</p>
            <p className="mt-1.5 space-x-3">
              <Link href="/legal/privacidad" className="underline underline-offset-2 hover:text-ink">
                {t({ es: 'Privacidad', en: 'Privacy' })}
              </Link>
              <Link href="/legal/condiciones" className="underline underline-offset-2 hover:text-ink">
                {t({ es: 'Condiciones', en: 'Terms' })}
              </Link>
              <Link href="/legal/cookies" className="underline underline-offset-2 hover:text-ink">
                Cookies
              </Link>
            </p>
          </footer>
        </div>
      </main>

      <aside className="pointer-events-auto absolute right-8 bottom-8 hidden w-72 border-t border-chef/20 pt-4 text-[13px] xl:block">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-teja uppercase">{t({ es: 'Tu cocina, tu nivel', en: 'Your kitchen, your level' })}</p>
        <p className="mt-2 leading-relaxed text-ash-ink">
          {t({
            es: 'Con tu cuenta sigues tus pedidos, guardas direcciones y te recomendamos kits según tu nivel y tus alérgenos.',
            en: 'With an account you can track orders, save addresses and get kit picks for your level and allergens.',
          })}
        </p>
        <Link href="/#como-funciona" className="mt-3 inline-flex items-center gap-1 font-medium text-ink hover:text-teja">
          {t({ es: 'Cómo funciona', en: 'How it works' })} <ArrowRightIcon size={14} />
        </Link>
      </aside>
    </div>
  )
}
