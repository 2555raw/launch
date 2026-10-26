/**
 * Reglas comerciales. Todos los importes en céntimos e IVA incluido.
 * Se pueden ajustar con variables de entorno sin tocar código.
 */

// Las variables se leen por su nombre literal para que Next.js las incluya en el navegador.
const int = (raw: string | undefined, fallback: number) => {
  const value = raw ? Number.parseInt(raw, 10) : Number.NaN
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

export const commerce = {
  currency: 'eur' as const,
  /** Gastos de envío estándar (Península y Baleares). */
  shippingCents: int(process.env.NEXT_PUBLIC_SHIPPING_CENTS, 495),
  /** A partir de este subtotal (ya descontado) el envío es gratis. */
  freeShippingThresholdCents: int(process.env.NEXT_PUBLIC_FREE_SHIPPING_THRESHOLD_CENTS, 4000),
  /** IVA aplicado a los gastos de envío, en puntos básicos (2100 = 21 %). Revísalo con tu asesoría. */
  shippingTaxRateBps: int(process.env.SHIPPING_TAX_RATE_BPS, 2100),
  /** Unidades máximas de una misma variante por pedido. */
  maxQuantityPerLine: 10,
  /** Duración de la sesión de pago de Stripe (mínimo 30 minutos). */
  checkoutSessionMinutes: 30,
  /** El stock se reserva unos minutos más que la sesión de pago. */
  reservationMinutes: 35,
  /** Plazos orientativos que se muestran en la ficha de producto. */
  deliveryEstimate: '24-72 h laborables',
  returnDays: 14,
}

/**
 * Códigos postales a los que se envía: Península y Baleares.
 * Canarias (35, 38), Ceuta (51) y Melilla (52) tienen otro régimen fiscal
 * (IGIC / IPSI) y aduanas, así que quedan fuera hasta configurarlos.
 */
export const excludedPostalPrefixes = ['35', '38', '51', '52']

export function isShippablePostalCode(postalCode: string) {
  if (!/^[0-9]{5}$/.test(postalCode)) return false
  const province = Number.parseInt(postalCode.slice(0, 2), 10)
  if (province < 1 || province > 52) return false
  return !excludedPostalPrefixes.includes(postalCode.slice(0, 2))
}
