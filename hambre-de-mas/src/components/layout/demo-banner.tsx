import { getI18n } from '@/lib/i18n/server'

/** Aviso visible cuando la tienda funciona sin base de datos (modo demo). */
export async function DemoBanner() {
  const { t } = await getI18n()
  return (
    <div className="bg-ink px-4 py-2 text-center text-[12px] text-white/85">
      <strong className="font-semibold text-white">{t({ es: 'Prototipo.', en: 'Prototype.' })}</strong>{' '}
      {t({
        es: 'Tienda de demostración: el catálogo, las opiniones y las compras que ves son de ejemplo y no se hacen pedidos reales.',
        en: 'Demo shop: the catalogue, reviews and purchases you see are examples and no real orders are placed.',
      })}
    </div>
  )
}
