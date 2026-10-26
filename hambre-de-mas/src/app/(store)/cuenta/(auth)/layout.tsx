import Image from 'next/image'

/** Marco común de las pantallas de acceso: tarjeta centrada y limpia. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container-page flex justify-center py-12 sm:py-20">
      <div className="w-full max-w-md">
        <Image src="/brand/logo-320.png" alt="" width={320} height={290} className="mx-auto mb-6 h-20 w-auto" priority />
        {children}
      </div>
    </div>
  )
}
