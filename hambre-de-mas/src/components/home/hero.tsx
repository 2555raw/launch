'use client'

import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import Link from 'next/link'
import { useRef } from 'react'
import { ButtonLink } from '@/components/ui/button'
import { ArrowRightIcon, ClockIcon, PlayIcon, ShieldIcon, TruckIcon } from '@/components/ui/icons'
import { ProductImage } from '@/components/ui/product-image'
import { formatPrice } from '@/lib/money'
import type { ProductSummary } from '@/lib/types'

const ease = [0.28, 0.11, 0.32, 1] as const

export function Hero({ product }: { product: ProductSummary | null }) {
  const ref = useRef<HTMLElement>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const imageScale = useTransform(scrollYProgress, [0, 1], [1, reduce ? 1 : 1.08])
  const cardY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : -40])

  const image = product?.image?.url ?? '/demo/home/hero-ramen.jpg'

  return (
    <section ref={ref} className="relative overflow-hidden bg-white">
      <div className="container-page grid items-center gap-12 pt-10 pb-16 sm:pt-14 lg:min-h-[min(760px,calc(100dvh-3.5rem))] lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:py-16">
        <div className="relative z-10 max-w-xl">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease }}
            className="eyebrow"
          >
            Kits de cocina para adolescentes
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.08, ease }}
            className="mt-4 font-display text-[44px] leading-[1.02] font-extrabold tracking-[-0.035em] text-balance sm:text-6xl lg:text-[80px]"
          >
            Cocina lo que te <span className="text-chef">flipa.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.16, ease }}
            className="mt-6 max-w-md text-lg leading-relaxed text-ash-ink sm:text-xl"
          >
            Elige tu nivel, recibe los ingredientes en casa y sigue el vídeo paso a paso. Cada receta que clavas desbloquea la siguiente.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.24, ease }}
            className="mt-9 flex flex-wrap items-center gap-3"
          >
            <ButtonLink href="/tienda" size="lg">
              Comprar kits
            </ButtonLink>
            <Link
              href="/#como-funciona"
              className="group inline-flex h-13 items-center gap-1.5 px-4 text-[17px] font-medium text-teja"
            >
              Descubre cómo funciona
              <ArrowRightIcon size={18} className="transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </motion.div>
          <motion.ul
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-ash-ink"
          >
            <li className="flex items-center gap-2">
              <TruckIcon size={17} className="text-ink" /> Envío gratis desde 40 €
            </li>
            <li className="flex items-center gap-2">
              <PlayIcon size={17} className="text-ink" /> Vídeo con QR en cada kit
            </li>
            <li className="flex items-center gap-2">
              <ShieldIcon size={17} className="text-ink" /> Pago seguro
            </li>
          </motion.ul>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.1, delay: 0.1, ease }}
          className="relative mx-auto w-full max-w-[560px] lg:max-w-none"
        >
          <div className="absolute -inset-6 -z-10 rounded-[48px] bg-almendra-soft sm:-inset-10" aria-hidden />
          <div className="relative aspect-square overflow-hidden rounded-[36px] bg-mist shadow-float">
            <motion.div style={{ scale: imageScale }} className="absolute inset-0">
              <ProductImage
                src={image}
                alt={product?.image?.alt ?? 'Bol de ramen casero'}
                fill
                priority
                sizes="(min-width: 1024px) 45vw, 92vw"
                className="object-cover"
              />
            </motion.div>
          </div>

          {product && (
            <motion.div
              style={{ y: cardY }}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.55, ease }}
              className="absolute -bottom-6 left-4 right-4 sm:right-auto sm:left-[-1.5rem] sm:w-[300px]"
            >
              <Link
                href={`/producto/${product.slug}`}
                className="group block rounded-[22px] bg-white/90 p-5 shadow-float ring-1 ring-black/5 backdrop-blur-xl transition-transform duration-500 hover:-translate-y-1"
              >
                <p className="text-[11px] font-semibold tracking-wide text-teja uppercase">
                  {product.category?.level ? `Nivel ${product.category.level}` : 'Destacado'}
                  {product.badge ? ` · ${product.badge}` : ''}
                </p>
                <p className="mt-1 font-display text-lg font-bold">{product.name}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[15px] tabular-nums">
                    <span className="text-ash-ink">Desde </span>
                    <strong className="font-semibold">{formatPrice(product.priceCents)}</strong>
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-chef-ink px-3 py-1.5 text-xs font-medium text-white transition-colors group-hover:bg-teja">
                    Comprar <ArrowRightIcon size={13} />
                  </span>
                </div>
              </Link>
            </motion.div>
          )}

          {product?.attributes.minutes ? (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.75, ease }}
              className="absolute top-5 right-5 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3.5 py-2 text-[13px] font-medium shadow-card backdrop-blur"
            >
              <ClockIcon size={15} /> {product.attributes.minutes} min
            </motion.span>
          ) : null}
        </motion.div>
      </div>
    </section>
  )
}
