'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/ui/icons'
import { ProductImage } from '@/components/ui/product-image'
import { cn } from '@/lib/cn'
import { useI18n } from '@/lib/i18n/client'
import type { ProductImage as Img } from '@/lib/types'

export function Gallery({ images, name }: { images: Img[]; name: string }) {
  const { t } = useI18n()
  const [index, setIndex] = useState(0)
  const current = images[index]
  const go = (delta: number) => setIndex((i) => (i + delta + images.length) % images.length)

  if (!current) {
    return <div className="aspect-square rounded-[32px] bg-mist" aria-label={t({ es: 'Sin imagen', en: 'No image' })} />
  }

  return (
    <div className="flex flex-col gap-4 lg:sticky lg:top-20">
      <div
        className="group relative aspect-square overflow-hidden rounded-[32px] bg-mist"
        role="region"
        aria-roledescription={t({ es: 'carrusel', en: 'carousel' })}
        aria-label={t({ es: `Imágenes de ${name}`, en: `Images of ${name}` })}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') go(1)
          if (e.key === 'ArrowLeft') go(-1)
        }}
      >
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.28, 0.11, 0.32, 1] }}
            className="absolute inset-0"
          >
            <ProductImage
              src={current.url}
              alt={current.alt || name}
              fill
              priority={index === 0}
              sizes="(min-width: 1024px) 55vw, 100vw"
              className="object-cover"
            />
          </motion.div>
        </AnimatePresence>

        <p className="absolute bottom-4 left-4 rounded-full bg-white/85 px-2.5 py-1 text-[11px] font-medium text-ink/75 backdrop-blur">
          {t({ es: 'Sugerencia de presentación', en: 'Serving suggestion' })}
        </p>
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              className="absolute top-1/2 left-4 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-ink opacity-0 shadow-card backdrop-blur transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              aria-label={t({ es: 'Imagen anterior', en: 'Previous image' })}
            >
              <ChevronLeftIcon size={18} />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              className="absolute top-1/2 right-4 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-ink opacity-0 shadow-card backdrop-blur transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              aria-label={t({ es: 'Imagen siguiente', en: 'Next image' })}
            >
              <ChevronRightIcon size={18} />
            </button>
            <p className="absolute right-4 bottom-4 rounded-full bg-ink/60 px-2.5 py-1 text-xs text-white backdrop-blur" aria-live="polite">
              {index + 1} / {images.length}
            </p>
          </>
        )}
      </div>

      {images.length > 1 && (
        <ul className="flex gap-3" aria-label={t({ es: 'Miniaturas', en: 'Thumbnails' })}>
          {images.map((img, i) => (
            <li key={img.id}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={t({ es: `Ver imagen ${i + 1}: ${img.alt || name}`, en: `View image ${i + 1}: ${img.alt || name}` })}
                aria-current={i === index}
                className={cn(
                  'relative block size-18 overflow-hidden rounded-2xl bg-mist ring-2 ring-offset-2 transition-[box-shadow,opacity] sm:size-20',
                  i === index ? 'ring-ink' : 'opacity-70 ring-transparent hover:opacity-100',
                )}
              >
                <ProductImage src={img.url} alt="" fill sizes="80px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
