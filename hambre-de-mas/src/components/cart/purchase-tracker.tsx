'use client'

import { useEffect } from 'react'
import { trackPurchase, type TrackedItem } from '@/lib/tracking'

/** Envía la compra a Analytics y la conversión a Google Ads (si el cliente lo ha aceptado). */
export function PurchaseTracker({ order }: { order: { id: string; totalCents: number; shippingCents: number; taxCents: number; coupon: string | null; items: TrackedItem[] } }) {
  useEffect(() => {
    // gtag se carga tras el consentimiento: se espera un momento por si aún no está
    const timer = setTimeout(() => trackPurchase(order), 1500)
    return () => clearTimeout(timer)
  }, [order])
  return null
}
