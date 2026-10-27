'use client'

import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { buttonClass } from '@/components/ui/button'
import { BagIcon, CloseIcon } from '@/components/ui/icons'
import { commerce } from '@/lib/config/commerce'
import { formatPrice } from '@/lib/money'
import { useCart } from './cart-context'
import { CartLine } from './cart-line'

const ease = [0.28, 0.11, 0.32, 1] as const

/** Panel lateral que se abre al añadir algo a la cesta. */
export function CartDrawer() {
  const { items, drawerOpen, closeDrawer, estimatedSubtotal, count } = useCart()
  const pathname = usePathname()
  const panelRef = useRef<HTMLDivElement>(null)
  const remaining = Math.max(0, commerce.freeShippingThresholdCents - estimatedSubtotal)
  const progress = Math.min(1, estimatedSubtotal / commerce.freeShippingThresholdCents)

  useEffect(() => {
    closeDrawer()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al cambiar de ruta
  }, [pathname])

  useEffect(() => {
    if (!drawerOpen) return
    const previous = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeDrawer()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      previous?.focus?.()
    }
  }, [drawerOpen, closeDrawer])

  return (
    <AnimatePresence>
      {drawerOpen && (
        <>
          <motion.div
            key="velo"
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[70] bg-ink/30 backdrop-blur-[2px]"
            onClick={closeDrawer}
          />
          <motion.div
            key="panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cesta-titulo"
            tabIndex={-1}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.42, ease }}
            className="fixed inset-y-0 right-0 z-[80] flex w-full max-w-md flex-col bg-white shadow-float focus:outline-none sm:rounded-l-[28px]"
          >
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <h2 id="cesta-titulo" className="font-display text-2xl font-bold">
                Tu cesta {count > 0 && <span className="text-chef">({count})</span>}
              </h2>
              <button
                type="button"
                onClick={closeDrawer}
                className="grid size-9 place-items-center rounded-full bg-mist text-ink transition-colors hover:bg-line"
                aria-label="Cerrar cesta"
              >
                <CloseIcon size={18} />
              </button>
            </div>

            {items.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
                <span className="grid size-16 place-items-center rounded-full bg-almendra-soft text-teja">
                  <BagIcon size={28} />
                </span>
                <p className="font-display text-xl font-bold">Tu cesta está vacía</p>
                <p className="text-sm text-ash-ink">¿Con hambre de más? Empieza por el nivel 1 o ve directo al ramen.</p>
                <Link href="/tienda" className={buttonClass('primary', 'md')} onClick={closeDrawer}>
                  Ver los kits
                </Link>
              </div>
            ) : (
              <>
                <div className="px-6 pb-4">
                  <p className="text-sm text-ash-ink" aria-live="polite">
                    {remaining > 0 ? (
                      <>
                        Te faltan <strong className="text-ink">{formatPrice(remaining)}</strong> para el envío gratis.
                      </>
                    ) : (
                      <strong className="text-hoja-ink">¡Tienes envío gratis!</strong>
                    )}
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-mist">
                    <motion.div
                      className="h-full rounded-full bg-hoja"
                      initial={false}
                      animate={{ width: `${progress * 100}%` }}
                      transition={{ duration: 0.5, ease }}
                    />
                  </div>
                </div>
                <ul className="flex-1 divide-y divide-line overflow-y-auto px-6">
                  <AnimatePresence initial={false}>
                    {items.map((item) => (
                      <CartLine key={item.variantId} item={item} compact />
                    ))}
                  </AnimatePresence>
                </ul>
                <div className="border-t border-line px-6 pt-4 pb-6">
                  <div className="mb-1 flex items-baseline justify-between">
                    <span className="text-[15px]">Subtotal</span>
                    <span className="text-lg font-semibold tabular-nums">{formatPrice(estimatedSubtotal)}</span>
                  </div>
                  <p className="mb-4 text-xs text-ash-ink">IVA incluido. Envío y descuentos se calculan en la cesta.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Link href="/cesta" className={buttonClass('secondary', 'md')} onClick={closeDrawer}>
                      Ver cesta
                    </Link>
                    <Link href="/checkout" className={buttonClass('primary', 'md')} onClick={closeDrawer}>
                      Pagar
                    </Link>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
