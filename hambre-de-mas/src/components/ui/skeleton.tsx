import { cn } from '@/lib/cn'

/** Bloque gris con un brillo que lo recorre (ver .skeleton en globals.css). */
export function Bone({ className }: { className?: string }) {
  return <div aria-hidden className={cn('skeleton rounded-full', className)} />
}

/** Silueta de una tarjeta de kit: foto cuadrada, nombre, subtítulo, alérgenos y precio. */
export function ProductCardSkeleton() {
  return (
    <div aria-hidden className="overflow-hidden rounded-[var(--radius-tile)] bg-white shadow-card ring-1 ring-black/[0.03]">
      <div className="skeleton aspect-square" />
      <div className="space-y-2.5 p-5 sm:p-6">
        <Bone className="h-5 w-3/4" />
        <Bone className="h-3.5 w-full" />
        <Bone className="h-3.5 w-2/3" />
        <div className="flex gap-1.5 pt-2">
          {Array.from({ length: 7 }, (_, i) => (
            <Bone key={i} className="size-5" />
          ))}
        </div>
        <div className="flex justify-between pt-3">
          <Bone className="h-5 w-24" />
          <Bone className="h-4 w-14" />
        </div>
      </div>
    </div>
  )
}

/** Tienda y categorías: título, filtros a la izquierda y rejilla de tarjetas. */
export function CatalogSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true" aria-label={label}>
      <div className="container-page pt-10 pb-10 sm:pt-14">
        <Bone className="h-3.5 w-20" />
        <Bone className="mt-4 h-12 w-2/3 rounded-2xl sm:h-14" />
      </div>
      <div className="container-page grid gap-10 pb-24 lg:grid-cols-[230px_1fr]">
        <div className="hidden space-y-4 lg:block">
          <Bone className="h-5 w-16" />
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Bone className="size-[18px]" />
              <Bone className="h-3.5 w-28" />
            </div>
          ))}
          <Bone className="mt-6 h-5 w-24" />
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Bone className="size-[18px] rounded-[5px]" />
              <Bone className="h-3.5 w-24" />
            </div>
          ))}
        </div>
        <div>
          <div className="mb-6 flex justify-between">
            <Bone className="h-4 w-16" />
            <Bone className="h-9 w-48" />
          </div>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Ficha de kit: galería a la izquierda y datos, precio y botones a la derecha. */
export function ProductPageSkeleton({ label }: { label: string }) {
  return (
    <div className="container-page pt-6 pb-24" aria-busy="true" aria-label={label}>
      <Bone className="h-3.5 w-56" />
      <div className="mt-6 grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        <div className="skeleton aspect-square rounded-[32px]" />
        <div className="space-y-4">
          <div className="flex gap-2">
            <Bone className="h-6 w-28" />
            <Bone className="h-6 w-24" />
          </div>
          <Bone className="h-12 w-4/5 rounded-2xl" />
          <Bone className="h-4 w-full" />
          <Bone className="h-4 w-3/4" />
          <div className="flex gap-2 pt-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Bone key={i} className="h-8 w-24" />
            ))}
          </div>
          <div className="grid grid-cols-4 gap-2 pt-2">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="skeleton h-14 rounded-2xl" />
            ))}
          </div>
          <Bone className="mt-6 h-9 w-32" />
          <div className="grid grid-cols-2 gap-3">
            <div className="skeleton h-20 rounded-[16px]" />
            <div className="skeleton h-20 rounded-[16px]" />
          </div>
          <div className="grid gap-3 pt-2 sm:grid-cols-2">
            <Bone className="h-14" />
            <Bone className="h-14" />
          </div>
        </div>
      </div>
    </div>
  )
}
