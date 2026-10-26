/**
 * Cálculo del presupuesto del carrito.
 *
 * Es una función pura: recibe lo que pide el cliente (solo ids y cantidades)
 * y los datos que el servidor ha leído de la base de datos, y devuelve
 * importes, descuentos, envío e IVA. Los precios del navegador nunca entran
 * aquí, así que no se pueden manipular.
 *
 * Todos los importes son céntimos con IVA incluido.
 */
import type { Promotion, VariantForQuote } from '@/lib/types'

export type QuoteRequestLine = { variantId: string; quantity: number }

export type QuoteLineStatus = 'ok' | 'adjusted' | 'unavailable' | 'not_found'

export type QuoteLine = {
  variantId: string
  productId: string | null
  productSlug: string | null
  productName: string
  variantName: string
  sku: string | null
  imageUrl: string | null
  unitPriceCents: number
  compareAtPriceCents: number | null
  requestedQuantity: number
  quantity: number
  availableQuantity: number
  lineTotalCents: number
  taxRateBps: number
  status: QuoteLineStatus
  message: string | null
}

export type PromotionResult = {
  code: string
  applied: boolean
  discountCents: number
  message: string
  promotionId: string | null
}

export type Quote = {
  lines: QuoteLine[]
  itemCount: number
  subtotalCents: number
  discountCents: number
  shippingCents: number
  taxCents: number
  taxes: { rateBps: number; amountCents: number }[]
  totalCents: number
  freeShippingRemainingCents: number
  promotion: PromotionResult | null
  /** True si todas las líneas se pueden comprar tal y como se pidieron. */
  isClean: boolean
  /** True si hay al menos una línea comprable. */
  isPurchasable: boolean
}

export type QuoteConfig = {
  shippingCents: number
  freeShippingThresholdCents: number
  shippingTaxRateBps: number
  maxQuantityPerLine: number
}

export type QuoteInput = {
  requested: QuoteRequestLine[]
  variants: VariantForQuote[]
  promotionCode?: string | null
  promotion?: Promotion | null
  now?: Date
  config: QuoteConfig
}

/** Stripe no cobra importes inferiores a 0,50 €. */
export const MIN_CHARGE_CENTS = 50

const includedTax = (amount: number, rateBps: number) =>
  rateBps <= 0 ? 0 : Math.round((amount * rateBps) / (10000 + rateBps))

/** Junta líneas repetidas de la misma variante y descarta cantidades inválidas. */
export function normalizeRequest(requested: QuoteRequestLine[]): QuoteRequestLine[] {
  const merged = new Map<string, number>()
  for (const line of requested) {
    const quantity = Math.floor(Number(line.quantity))
    if (!line.variantId || !Number.isFinite(quantity) || quantity <= 0) continue
    merged.set(line.variantId, (merged.get(line.variantId) ?? 0) + quantity)
  }
  return [...merged].map(([variantId, quantity]) => ({ variantId, quantity }))
}

export function evaluatePromotion(
  promotion: Promotion | null | undefined,
  code: string,
  subtotalCents: number,
  now: Date,
): PromotionResult {
  const fail = (message: string): PromotionResult => ({
    code,
    applied: false,
    discountCents: 0,
    message,
    promotionId: promotion?.id ?? null,
  })

  if (!promotion || !promotion.isActive) return fail('Este código no existe o ya no está activo.')
  if (promotion.startsAt && new Date(promotion.startsAt) > now) return fail('Este código todavía no está activo.')
  if (promotion.endsAt && new Date(promotion.endsAt) <= now) return fail('Este código ha caducado.')
  if (promotion.maxRedemptions != null && promotion.timesRedeemed >= promotion.maxRedemptions) {
    return fail('Este código ya se ha agotado.')
  }
  if (subtotalCents < promotion.minSubtotalCents) {
    const missing = promotion.minSubtotalCents - subtotalCents
    return fail(`Añade ${(missing / 100).toFixed(2).replace('.', ',')} € más para usar este código.`)
  }

  let discount =
    promotion.kind === 'percent'
      ? Math.round((subtotalCents * Math.min(promotion.value, 100)) / 100)
      : Math.min(promotion.value, subtotalCents)
  // Nunca dejar el pedido por debajo del cobro mínimo.
  discount = Math.max(0, Math.min(discount, subtotalCents - MIN_CHARGE_CENTS))
  if (discount <= 0) return fail('Este código no se puede aplicar a este pedido.')

  return {
    code: promotion.code,
    applied: true,
    discountCents: discount,
    message: promotion.description ?? 'Descuento aplicado',
    promotionId: promotion.id,
  }
}

export function computeQuote({ requested, variants, promotion, promotionCode, now = new Date(), config }: QuoteInput): Quote {
  const byId = new Map(variants.map((v) => [v.variantId, v]))
  const lines: QuoteLine[] = []

  for (const req of normalizeRequest(requested)) {
    const variant = byId.get(req.variantId)
    if (!variant) {
      lines.push({
        variantId: req.variantId,
        productId: null,
        productSlug: null,
        productName: 'Producto no disponible',
        variantName: '',
        sku: null,
        imageUrl: null,
        unitPriceCents: 0,
        compareAtPriceCents: null,
        requestedQuantity: req.quantity,
        quantity: 0,
        availableQuantity: 0,
        lineTotalCents: 0,
        taxRateBps: 0,
        status: 'not_found',
        message: 'Este producto ya no está a la venta.',
      })
      continue
    }

    const sellable = variant.isActive && variant.productPublished
    const available = sellable ? Math.max(0, Math.min(variant.stock, config.maxQuantityPerLine)) : 0
    const quantity = Math.min(req.quantity, available)
    let status: QuoteLineStatus = 'ok'
    let message: string | null = null
    if (available === 0) {
      status = 'unavailable'
      message = sellable ? 'Agotado. Elimínalo para continuar.' : 'Ya no está a la venta.'
    } else if (quantity < req.quantity) {
      status = 'adjusted'
      message =
        variant.stock < config.maxQuantityPerLine || variant.stock < req.quantity
          ? `Solo quedan ${available} ${available === 1 ? 'unidad' : 'unidades'}.`
          : `Máximo ${config.maxQuantityPerLine} unidades por pedido.`
    }

    lines.push({
      variantId: variant.variantId,
      productId: variant.productId,
      productSlug: variant.productSlug,
      productName: variant.productName,
      variantName: variant.variantName,
      sku: variant.sku,
      imageUrl: variant.imageUrl,
      unitPriceCents: variant.priceCents,
      compareAtPriceCents: variant.compareAtPriceCents,
      requestedQuantity: req.quantity,
      quantity,
      availableQuantity: available,
      lineTotalCents: variant.priceCents * quantity,
      taxRateBps: variant.taxRateBps,
      status,
      message,
    })
  }

  const billable = lines.filter((l) => l.quantity > 0)
  const subtotalCents = billable.reduce((sum, l) => sum + l.lineTotalCents, 0)
  const itemCount = billable.reduce((sum, l) => sum + l.quantity, 0)

  const code = promotionCode?.trim().toUpperCase() ?? ''
  const promotionResult = code ? evaluatePromotion(promotion, code, subtotalCents, now) : null
  const discountCents = promotionResult?.applied ? promotionResult.discountCents : 0

  const afterDiscount = subtotalCents - discountCents
  const shippingCents =
    billable.length === 0 || afterDiscount >= config.freeShippingThresholdCents ? 0 : config.shippingCents

  // IVA incluido: el descuento se reparte entre líneas en proporción a su importe.
  const taxByRate = new Map<number, number>()
  let discountLeft = discountCents
  billable.forEach((line, index) => {
    const share =
      index === billable.length - 1
        ? discountLeft
        : subtotalCents === 0
          ? 0
          : Math.round((discountCents * line.lineTotalCents) / subtotalCents)
    discountLeft -= share
    const tax = includedTax(line.lineTotalCents - share, line.taxRateBps)
    taxByRate.set(line.taxRateBps, (taxByRate.get(line.taxRateBps) ?? 0) + tax)
  })
  if (shippingCents > 0) {
    const tax = includedTax(shippingCents, config.shippingTaxRateBps)
    taxByRate.set(config.shippingTaxRateBps, (taxByRate.get(config.shippingTaxRateBps) ?? 0) + tax)
  }
  const taxes = [...taxByRate]
    .filter(([, amount]) => amount > 0)
    .sort(([a], [b]) => a - b)
    .map(([rateBps, amountCents]) => ({ rateBps, amountCents }))
  const taxCents = taxes.reduce((sum, t) => sum + t.amountCents, 0)

  return {
    lines,
    itemCount,
    subtotalCents,
    discountCents,
    shippingCents,
    taxCents,
    taxes,
    totalCents: afterDiscount + shippingCents,
    freeShippingRemainingCents: billable.length === 0 ? config.freeShippingThresholdCents : Math.max(0, config.freeShippingThresholdCents - afterDiscount),
    promotion: promotionResult,
    isClean: lines.every((l) => l.status === 'ok'),
    isPurchasable: billable.length > 0 && afterDiscount + shippingCents >= MIN_CHARGE_CENTS,
  }
}
