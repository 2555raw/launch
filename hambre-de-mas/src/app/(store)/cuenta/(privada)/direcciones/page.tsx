import type { Metadata } from 'next'
import { deleteAddress, makeDefaultAddress } from '@/app/actions/account'
import { AddressForm } from '@/components/account/address-form'
import { requireUser } from '@/lib/auth/session'
import { getI18n } from '@/lib/i18n/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n()
  return { title: t({ es: 'Mis direcciones', en: 'My addresses' }), robots: { index: false } }
}

export default async function AddressesPage() {
  await requireUser('/cuenta/direcciones')
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.from('addresses').select('*').order('is_default', { ascending: false }).order('created_at')
  const addresses = data ?? []
  const { t } = await getI18n()

  return (
    <section aria-labelledby="direcciones" className="space-y-8">
      <h2 id="direcciones" className="font-display text-2xl font-bold">
        {t({ es: 'Direcciones de envío', en: 'Delivery addresses' })}
      </h2>
      {addresses.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2">
          {addresses.map((a) => (
            <li key={a.id} className="flex flex-col rounded-[22px] bg-mist p-5 text-sm">
              <p className="flex items-center gap-2 font-semibold">
                {a.label ?? t({ es: 'Dirección', en: 'Address' })}
                {a.is_default && <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] font-medium text-white">{t({ es: 'Predeterminada', en: 'Default' })}</span>}
              </p>
              <p className="mt-2 text-ash-ink">
                {a.full_name}
                <br />
                {a.line1}
                {a.line2 ? `, ${a.line2}` : ''}
                <br />
                {a.postal_code} {a.city} ({a.province})
                {a.phone && (
                  <>
                    <br />
                    {a.phone}
                  </>
                )}
              </p>
              <div className="mt-4 flex gap-4">
                {!a.is_default && (
                  <form action={makeDefaultAddress}>
                    <input type="hidden" name="id" value={a.id} />
                    <button className="text-teja hover:underline">{t({ es: 'Hacer predeterminada', en: 'Make default' })}</button>
                  </form>
                )}
                <form action={deleteAddress}>
                  <input type="hidden" name="id" value={a.id} />
                  <button className="text-ash-ink hover:text-teja">{t({ es: 'Eliminar', en: 'Delete' })}</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="max-w-xl">
        <h3 className="mb-4 font-semibold">{t({ es: 'Añadir dirección', en: 'Add an address' })}</h3>
        <AddressForm />
      </div>
    </section>
  )
}
