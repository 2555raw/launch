/** Aviso visible cuando la tienda funciona sin base de datos (modo demo). */
export function DemoBanner() {
  return (
    <div className="bg-ink px-4 py-2 text-center text-[12px] text-white/85">
      <strong className="font-semibold text-white">Modo demostración.</strong> Catálogo de ejemplo sin base de datos: puedes navegar y
      llenar la cesta, pero no hacer pedidos. Configura Supabase y Stripe para activarlo (ver README).
    </div>
  )
}
