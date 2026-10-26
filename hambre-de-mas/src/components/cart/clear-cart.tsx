'use client'

import { useEffect } from 'react'
import { useCart } from './cart-context'

/** Vacía la cesta cuando el pedido ya está pagado. */
export function ClearCartOnMount() {
  const { clear, hydrated } = useCart()
  useEffect(() => {
    if (hydrated) clear()
  }, [hydrated, clear])
  return null
}
