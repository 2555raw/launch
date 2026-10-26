const euro = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })

/** 1690 -> "16,90 €" */
export function formatPrice(cents: number) {
  return euro.format(cents / 100)
}

export function percentOff(price: number, compareAt: number | null | undefined) {
  if (!compareAt || compareAt <= price) return 0
  return Math.round(((compareAt - price) / compareAt) * 100)
}
