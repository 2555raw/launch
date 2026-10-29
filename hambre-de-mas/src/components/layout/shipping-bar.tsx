import { TruckIcon } from '@/components/ui/icons'
import { commerce } from '@/lib/config/commerce'
import { getI18n } from '@/lib/i18n/server'
import { formatPrice } from '@/lib/money'

/** Franja superior con el umbral de envío gratis (el cálculo real está en src/lib/pricing/quote.ts). */
export async function ShippingBar() {
  if (commerce.freeShippingThresholdCents <= 0) return null
  const { locale, t } = await getI18n()
  const threshold = formatPrice(commerce.freeShippingThresholdCents, locale).replace(/[,.]00/, '')
  return (
    <p className="flex items-center justify-center gap-2 bg-chef-ink px-4 py-2 text-center text-[12.5px] font-medium text-white">
      <TruckIcon size={15} />
      {t({ es: `Envío gratis en pedidos desde ${threshold}`, en: `Free shipping on orders from ${threshold}` })}
    </p>
  )
}
