import 'server-only'
import { getCatalog } from '@/lib/catalog'
import { commerce } from '@/lib/config/commerce'
import { computeQuote, type QuoteConfig, type QuoteRequestLine } from './quote'
import { findPromotion } from './promotions'

export const quoteConfig: QuoteConfig = {
  shippingCents: commerce.shippingCents,
  freeShippingThresholdCents: commerce.freeShippingThresholdCents,
  shippingTaxRateBps: commerce.shippingTaxRateBps,
  maxQuantityPerLine: commerce.maxQuantityPerLine,
}

/** Presupuesto calculado íntegramente con datos del servidor. */
export async function quoteCart(items: QuoteRequestLine[], promoCode?: string | null) {
  const catalog = getCatalog()
  const [variants, promotion] = await Promise.all([
    catalog.getVariantsForQuote(items.map((i) => i.variantId)),
    promoCode ? findPromotion(promoCode) : Promise.resolve(null),
  ])
  return computeQuote({ requested: items, variants, promotion, promotionCode: promoCode, config: quoteConfig })
}
