import { getI18n } from '@/lib/i18n/server'

/** Aviso visible cuando la tienda funciona sin base de datos (modo demo). */
export async function DemoBanner() {
  const { t } = await getI18n()
  return (
    <div className="bg-ink px-4 py-2 text-center text-[12px] text-white/85">
      <strong className="font-semibold text-white">{t({ es: 'Modo demostración.', en: 'Demo mode.' })}</strong>{' '}
      {t({
        es: 'Catálogo de ejemplo sin base de datos: puedes navegar y llenar la cesta, pero no hacer pedidos. Configura Supabase y Stripe para activarlo (ver README).',
        en: "Sample catalogue with no database: you can browse and fill the bag, but you can't place orders. Set up Supabase and Stripe to enable it (see README).",
      })}
    </div>
  )
}
