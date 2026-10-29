import { getI18n } from '@/lib/i18n/server'

/** Nota discreta al pie cuando la tienda funciona sin base de datos (modo demo). */
export async function DemoBanner() {
  const { t } = await getI18n()
  return (
    <p className="bg-mist px-4 pb-6 text-center text-[11px] text-ash">
      <strong className="font-semibold">{t({ es: 'Prototipo.', en: 'Prototype.' })}</strong>{' '}
      {t({
        es: 'Tienda de demostración: el catálogo, las opiniones y las compras que ves son de ejemplo y no se hacen pedidos reales.',
        en: 'Demo shop: the catalogue, reviews and purchases you see are examples and no real orders are placed.',
      })}
    </p>
  )
}
