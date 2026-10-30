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
import type { Locale } from '@/lib/i18n/config'
import { dayLabel } from '@/lib/preorder'
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
  /** Nivel del kit (1, 2, 3) o null. */
  level: number | null
  /** Nombre del nivel (p. ej. «Primer bocado»). */
  levelName?: string | null
  /** Edición por encargo: día en que se envía (AAAA-MM-DD). */
  preorderRelease?: string | null
}

/** Descuento por llevar varios kits del mismo nivel. */
export type BundleResult = { level: number; name: string | null; kits: number; discountCents: number }

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
  /** Descuento total: packs por nivel + código promocional. */
  discountCents: number
  /** Packs por nivel aplicados. */
  bundles: BundleResult[]
  bundleDiscountCents: number
  /** Si falta poco para un pack: cuántos kits faltan y de qué nivel. */
  bundleHint: { level: number; name: string | null; missing: number; percent: number } | null
  promotionDiscountCents: number
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
  /** Kits del mismo nivel para el pack (0 o sin definir: sin packs). */
  bundleMinKits?: number
  /** Porcentaje de descuento del pack. */
  bundlePercent?: number
}

export type QuoteInput = {
  requested: QuoteRequestLine[]
  variants: VariantForQuote[]
  promotionCode?: string | null
  promotion?: Promotion | null
  now?: Date
  config: QuoteConfig
  /** Idioma de los mensajes para el cliente (por defecto, español). */
  locale?: Locale
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
  locale: Locale = 'es',
): PromotionResult {
  const tr = (es: string, en: string) => (locale === 'en' ? en : es)
  const fail = (message: string): PromotionResult => ({
    code,
    applied: false,
    discountCents: 0,
    message,
    promotionId: promotion?.id ?? null,
  })

  if (!promotion || !promotion.isActive) return fail(tr('Este código no existe o ya no está activo.', "This code doesn't exist or is no longer active."))
  if (promotion.startsAt && new Date(promotion.startsAt) > now) return fail(tr('Este código todavía no está activo.', "This code isn't active yet."))
  if (promotion.endsAt && new Date(promotion.endsAt) <= now) return fail(tr('Este código ha caducado.', 'This code has expired.'))
  if (promotion.maxRedemptions != null && promotion.timesRedeemed >= promotion.maxRedemptions) {
    return fail(tr('Este código ya se ha agotado.', 'This code has been used up.'))
  }
  if (subtotalCents < promotion.minSubtotalCents) {
    const missing = (promotion.minSubtotalCents - subtotalCents) / 100
    return fail(
      tr(`Añade ${missing.toFixed(2).replace('.', ',')} € más para usar este código.`, `Add €${missing.toFixed(2)} more to use this code.`),
    )
  }

  let discount =
    promotion.kind === 'percent'
      ? Math.round((subtotalCents * Math.min(promotion.value, 100)) / 100)
      : Math.min(promotion.value, subtotalCents)
  // Nunca dejar el pedido por debajo del cobro mínimo.
  discount = Math.max(0, Math.min(discount, subtotalCents - MIN_CHARGE_CENTS))
  if (discount <= 0) return fail(tr('Este código no se puede aplicar a este pedido.', "This code can't be applied to this order."))

  return {
    code: promotion.code,
    applied: true,
    discountCents: discount,
    // La descripción del código está en español: en inglés se usa un texto genérico.
    message: locale === 'en' ? `Code ${promotion.code} applied` : (promotion.description ?? 'Descuento aplicado'),
    promotionId: promotion.id,
  }
}

export function computeQuote({ requested, variants, promotion, promotionCode, now = new Date(), config, locale = 'es' }: QuoteInput): Quote {
  const tr = (es: string, en: string) => (locale === 'en' ? en : es)
  const byId = new Map(variants.map((v) => [v.variantId, v]))
  const lines: QuoteLine[] = []

  for (const req of normalizeRequest(requested)) {
    const variant = byId.get(req.variantId)
    if (!variant) {
      lines.push({
        variantId: req.variantId,
        productId: null,
        productSlug: null,
        productName: tr('Producto no disponible', 'Product unavailable'),
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
        message: tr('Este producto ya no está a la venta.', 'This product is no longer on sale.'),
        level: null,
      })
      continue
    }

    // Las ediciones por encargo se pagan al encargarlas; cerrado el plazo, no se venden hasta que salen
    const preorderClosed = Boolean(variant.preorderRelease) && !variant.preorderOpen
    const sellable = variant.isActive && variant.productPublished && !preorderClosed
    const available = sellable ? Math.max(0, Math.min(variant.stock, config.maxQuantityPerLine)) : 0
    const quantity = Math.min(req.quantity, available)
    let status: QuoteLineStatus = 'ok'
    let message: string | null = null
    if (available === 0) {
      status = 'unavailable'
      message = sellable
        ? tr('Agotado. Elimínalo para continuar.', 'Sold out. Remove it to continue.')
        : preorderClosed
          ? tr('Se acabó el plazo para encargarla. Elimínala para continuar.', 'Pre-orders for it have closed. Remove it to continue.')
          : tr('Ya no está a la venta.', 'No longer on sale.')
    } else if (quantity < req.quantity) {
      status = 'adjusted'
      message =
        variant.stock < config.maxQuantityPerLine || variant.stock < req.quantity
          ? tr(`Solo quedan ${available} ${available === 1 ? 'unidad' : 'unidades'}.`, `Only ${available} left.`)
          : tr(`Máximo ${config.maxQuantityPerLine} unidades por pedido.`, `Maximum ${config.maxQuantityPerLine} per order.`)
    } else if (variant.preorderRelease) {
      const day = dayLabel(variant.preorderRelease, locale)
      message = tr(`Encargo: se envía el ${day}.`, `Pre-order: ships on ${day}.`)
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
      level: variant.categoryLevel ?? null,
      levelName: variant.categoryName ?? null,
      preorderRelease: available > 0 ? (variant.preorderRelease ?? null) : null,
    })
  }

  const billable = lines.filter((l) => l.quantity > 0)
  const subtotalCents = billable.reduce((sum, l) => sum + l.lineTotalCents, 0)
  const itemCount = billable.reduce((sum, l) => sum + l.quantity, 0)

  // Packs: con bundleMinKits kits del mismo nivel, un bundlePercent menos en esos kits
  const bundles: BundleResult[] = []
  let bundleHint: Quote['bundleHint'] = null
  const minKits = config.bundleMinKits ?? 0
  const percent = Math.min(config.bundlePercent ?? 0, 50)
  if (minKits > 0 && percent > 0) {
    const byLevel = new Map<number, { name: string | null; kits: number; cents: number }>()
    for (const line of billable) {
      if (line.level == null) continue
      const group = byLevel.get(line.level) ?? { name: line.levelName ?? null, kits: 0, cents: 0 }
      group.kits += line.quantity
      group.cents += line.lineTotalCents
      byLevel.set(line.level, group)
    }
    for (const [level, group] of [...byLevel].sort(([a], [b]) => a - b)) {
      if (group.kits >= minKits) bundles.push({ level, name: group.name, kits: group.kits, discountCents: Math.round((group.cents * percent) / 100) })
      else if (!bundleHint || minKits - group.kits < bundleHint.missing) bundleHint = { level, name: group.name, missing: minKits - group.kits, percent }
    }
    if (bundles.length > 0) bundleHint = null
  }
  // Nunca por debajo del cobro mínimo
  const bundleDiscountCents = Math.max(0, Math.min(bundles.reduce((sum, b) => sum + b.discountCents, 0), subtotalCents - MIN_CHARGE_CENTS))

  // El código promocional se calcula sobre lo que queda tras el pack
  const code = promotionCode?.trim().toUpperCase() ?? ''
  const promotionResult = code ? evaluatePromotion(promotion, code, subtotalCents - bundleDiscountCents, now, locale) : null
  const promotionDiscountCents = promotionResult?.applied ? promotionResult.discountCents : 0
  const discountCents = bundleDiscountCents + promotionDiscountCents

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
    bundles,
    bundleDiscountCents,
    bundleHint,
    promotionDiscountCents,
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
