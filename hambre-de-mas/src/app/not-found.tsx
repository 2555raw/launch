import Image from 'next/image'
import Link from 'next/link'
import { buttonClass } from '@/components/ui/button'
import { getI18n } from '@/lib/i18n/server'

export default async function NotFound() {
  const { t } = await getI18n()
  return (
    <main id="contenido" className="grid min-h-dvh place-items-center px-4">
      <div className="max-w-md text-center">
        <Image src="/brand/logo-320.png" alt="" width={320} height={290} className="mx-auto h-24 w-auto" />
        <p className="mt-6 eyebrow">Error 404</p>
        <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight">{t({ es: 'Esta receta no existe.', en: "This recipe doesn't exist." })}</h1>
        <p className="mt-3 text-ash-ink">
          {t({ es: 'Puede que el enlace esté mal o que el kit ya no esté a la venta.', en: 'The link may be wrong, or the kit may no longer be on sale.' })}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className={buttonClass('primary', 'lg')}>
            {t({ es: 'Ir al inicio', en: 'Go home' })}
          </Link>
          <Link href="/tienda" className={buttonClass('secondary', 'lg')}>
            {t({ es: 'Ver la tienda', en: 'Visit the shop' })}
          </Link>
        </div>
      </div>
    </main>
  )
}
