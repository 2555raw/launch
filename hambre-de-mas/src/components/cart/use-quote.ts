'use client'

import { useEffect, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n/client'
import type { Quote } from '@/lib/pricing/quote'
import { useCart } from './cart-context'

/**
 * Pide al servidor el presupuesto del carrito cada vez que cambia y ajusta
 * las cantidades máximas según el stock real.
 */
export function useCartQuote({ enabled = true }: { enabled?: boolean } = {}) {
  const { items, promoCode, hydrated, syncFromServer } = useCart()
  const { locale, t } = useI18n()
  const [quote, setQuote] = useState<Quote | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const request = useRef(0)

  // El idioma también cuenta: los nombres y avisos llegan traducidos del servidor.
  const key = JSON.stringify({ items: items.map((i) => [i.variantId, i.quantity]), promoCode, locale })

  useEffect(() => {
    if (!enabled || !hydrated || items.length === 0) return
    const id = ++request.current
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/cart/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
            promoCode: promoCode ?? undefined,
          }),
        })
        if (!res.ok) throw new Error('quote')
        const data = (await res.json()) as { quote: Quote }
        if (id !== request.current) return
        setQuote(data.quote)
        setError(null)
        syncFromServer(
          data.quote.lines.map((l) => ({ variantId: l.variantId, maxQuantity: l.availableQuantity, priceCents: l.unitPriceCents || undefined })),
        )
      } catch {
        if (id === request.current) setError(t({ es: 'No hemos podido actualizar los precios. Revisa tu conexión.', en: "We couldn't update the prices. Check your connection." }))
      } finally {
        if (id === request.current) setLoading(false)
      }
    }, 250)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` resume items, promoCode e idioma
  }, [key, enabled, hydrated])

  // Con la cesta vacía no hay presupuesto que mostrar.
  return items.length === 0 ? { quote: null, loading: false, error: null } : { quote, loading, error }
}
