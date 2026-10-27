import type { Metadata } from 'next'
import { CheckoutForm } from '@/components/cart/checkout-form'
import { getCurrentUser, getProfile } from '@/lib/auth/session'
import { isStripeConfigured, isStripeTestMode } from '@/lib/env'
import { getI18n } from '@/lib/i18n/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { isServiceRoleConfigured } from '@/lib/supabase/service'
import type { Address } from '@/lib/types'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n()
  return { title: t({ es: 'Finalizar compra', en: 'Checkout' }), robots: { index: false } }
}

/* eslint-disable @typescript-eslint/no-explicit-any -- filas sin tipar de PostgREST */

export default async function CheckoutPage() {
  const user = await getCurrentUser()
  const profile = user ? await getProfile() : null
  let addresses: Address[] = []
  if (user) {
    const supabase = await createSupabaseServerClient()
    const { data } = await supabase.from('addresses').select('*').order('is_default', { ascending: false }).order('created_at')
    addresses = (data ?? []).map((a: any) => ({
      id: a.id,
      label: a.label,
      fullName: a.full_name,
      phone: a.phone,
      line1: a.line1,
      line2: a.line2,
      city: a.city,
      province: a.province,
      postalCode: a.postal_code,
      country: a.country,
      isDefault: a.is_default,
    }))
  }

  return (
    <CheckoutForm
      paymentsEnabled={isServiceRoleConfigured() && isStripeConfigured()}
      testMode={isStripeTestMode()}
      user={user ? { email: user.email, fullName: profile?.fullName ?? null, phone: profile?.phone ?? null } : null}
      addresses={addresses}
    />
  )
}
