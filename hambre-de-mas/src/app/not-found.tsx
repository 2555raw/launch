import Image from 'next/image'
import Link from 'next/link'
import { buttonClass } from '@/components/ui/button'

export default function NotFound() {
  return (
    <main id="contenido" className="grid min-h-dvh place-items-center px-4">
      <div className="max-w-md text-center">
        <Image src="/brand/logo-320.png" alt="" width={320} height={290} className="mx-auto h-24 w-auto" />
        <p className="mt-6 eyebrow">Error 404</p>
        <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight">Esta receta no existe.</h1>
        <p className="mt-3 text-ash-ink">Puede que el enlace esté mal o que el kit ya no esté a la venta.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className={buttonClass('primary', 'lg')}>
            Ir al inicio
          </Link>
          <Link href="/tienda" className={buttonClass('secondary', 'lg')}>
            Ver la tienda
          </Link>
        </div>
      </div>
    </main>
  )
}
