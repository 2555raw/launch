'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button, buttonClass } from '@/components/ui/button'
import { LockIcon } from '@/components/ui/icons'
import { ProductImage } from '@/components/ui/product-image'
import { cn } from '@/lib/cn'
import { formatPrice } from '@/lib/money'
import type { Quote } from '@/lib/pricing/quote'
import type { Address } from '@/lib/types'
import { useCart } from './cart-context'
import { OrderSummary, PromoCodeField } from './order-summary'
import { useCartQuote } from './use-quote'

type Props = {
  paymentsEnabled: boolean
  testMode: boolean
  user: { email: string | null; fullName: string | null; phone: string | null } | null
  addresses: Address[]
}

const provinces = [
  'A Coruña', 'Álava', 'Albacete', 'Alicante', 'Almería', 'Asturias', 'Ávila', 'Badajoz', 'Barcelona', 'Burgos', 'Cáceres', 'Cádiz',
  'Cantabria', 'Castellón', 'Ciudad Real', 'Córdoba', 'Cuenca', 'Girona', 'Granada', 'Guadalajara', 'Gipuzkoa', 'Huelva', 'Huesca',
  'Illes Balears', 'Jaén', 'La Rioja', 'León', 'Lleida', 'Lugo', 'Madrid', 'Málaga', 'Murcia', 'Navarra', 'Ourense', 'Palencia',
  'Pontevedra', 'Salamanca', 'Segovia', 'Sevilla', 'Soria', 'Tarragona', 'Teruel', 'Toledo', 'Valencia', 'Valladolid', 'Bizkaia',
  'Zamora', 'Zaragoza',
]

const input =
  'h-12 w-full rounded-xl border border-line-strong bg-white px-4 text-[15px] transition-colors placeholder:text-ash focus:border-ink focus:outline-none aria-[invalid=true]:border-teja'

function Field({ label, name, error, className, children }: { label: string; name: string; error?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${name}-error`} className="mt-1 text-xs text-teja" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export function CheckoutForm({ paymentsEnabled, testMode, user, addresses }: Props) {
  const router = useRouter()
  const { items, promoCode, hydrated, syncFromServer } = useCart()
  const { quote, loading } = useCartQuote()
  const defaultAddress = addresses.find((a) => a.isDefault) ?? addresses[0]
  const [form, setForm] = useState({
    email: user?.email ?? '',
    fullName: defaultAddress?.fullName ?? user?.fullName ?? '',
    phone: defaultAddress?.phone ?? user?.phone ?? '',
    line1: defaultAddress?.line1 ?? '',
    line2: defaultAddress?.line2 ?? '',
    city: defaultAddress?.city ?? '',
    province: defaultAddress?.province ?? '',
    postalCode: defaultAddress?.postalCode ?? '',
  })
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [newsletter, setNewsletter] = useState(false)
  const [saveAddress, setSaveAddress] = useState(Boolean(user) && addresses.length === 0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [serverQuote, setServerQuote] = useState<Quote | null>(null)

  useEffect(() => {
    if (hydrated && items.length === 0 && !submitting) router.replace('/cesta')
  }, [hydrated, items.length, router, submitting])

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const pickAddress = (a: Address) =>
    setForm((f) => ({
      ...f,
      fullName: a.fullName,
      phone: a.phone ?? '',
      line1: a.line1,
      line2: a.line2 ?? '',
      city: a.city,
      province: a.province,
      postalCode: a.postalCode,
    }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    setFormError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
          promoCode: promoCode ?? undefined,
          email: form.email,
          address: {
            fullName: form.fullName,
            phone: form.phone,
            line1: form.line1,
            line2: form.line2,
            city: form.city,
            province: form.province,
            postalCode: form.postalCode,
            country: 'ES',
          },
          acceptTerms,
          newsletter,
          saveAddress,
        }),
      })
      const data = (await res.json()) as { url?: string; message?: string; fields?: Record<string, string>; quote?: Quote }
      if (res.ok && data.url) {
        window.location.assign(data.url)
        return
      }
      if (data.fields) setErrors(data.fields)
      if (data.quote) {
        setServerQuote(data.quote)
        syncFromServer(data.quote.lines.map((l) => ({ variantId: l.variantId, maxQuantity: l.availableQuantity })))
      }
      setFormError(data.message ?? 'No hemos podido iniciar el pago.')
      setSubmitting(false)
    } catch {
      setFormError('Sin conexión con el servidor. Inténtalo de nuevo.')
      setSubmitting(false)
    }
  }

  const shownQuote = quote ?? serverQuote
  const err = (k: string) => errors[k] ?? errors[`address.${k}`]

  return (
    <form onSubmit={submit} noValidate className="container-page grid gap-12 pt-10 pb-24 lg:grid-cols-[1fr_400px]">
      <div className="space-y-10">
        <header>
          <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">Finalizar compra.</h1>
          {!user && (
            <p className="mt-3 text-[15px] text-ash-ink">
              Compras como invitado.{' '}
              <Link href="/cuenta/acceder?next=/checkout" className="text-teja hover:underline">
                Inicia sesión
              </Link>{' '}
              para guardar tus direcciones y ver tus pedidos.
            </p>
          )}
        </header>

        {!paymentsEnabled && (
          <div className="rounded-2xl bg-almendra-soft p-5 text-sm text-teja" role="status">
            <strong className="font-semibold">Pagos no activados.</strong> Esta tienda todavía no tiene configurados Supabase y Stripe, así que
            no se pueden hacer pedidos. Consulta el README para activarlos.
          </div>
        )}
        {paymentsEnabled && testMode && (
          <div className="rounded-2xl bg-mist p-5 text-sm text-ash-ink" role="status">
            <strong className="font-semibold text-ink">Modo de prueba de Stripe.</strong> No se hará ningún cargo real. Usa la tarjeta
            4242 4242 4242 4242, cualquier fecha futura y cualquier CVC.
          </div>
        )}

        <section aria-labelledby="contacto" className="space-y-4">
          <h2 id="contacto" className="font-display text-2xl font-bold">
            Contacto
          </h2>
          <Field label="Email" name="email" error={err('email')}>
            <input id="email" type="email" autoComplete="email" required value={form.email} onChange={set('email')} className={input} aria-invalid={Boolean(err('email'))} aria-describedby={err('email') ? 'email-error' : undefined} />
          </Field>
          <p className="text-xs text-ash-ink">Te enviaremos aquí la confirmación del pedido.</p>
        </section>

        <section aria-labelledby="envio" className="space-y-4">
          <h2 id="envio" className="font-display text-2xl font-bold">
            Dirección de envío
          </h2>
          {addresses.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {addresses.map((a) => (
                <button key={a.id} type="button" onClick={() => pickAddress(a)} className={buttonClass('secondary', 'sm')}>
                  {a.label ?? a.line1}
                </button>
              ))}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre y apellidos" name="fullName" error={err('fullName')} className="sm:col-span-2">
              <input id="fullName" autoComplete="name" required value={form.fullName} onChange={set('fullName')} className={input} aria-invalid={Boolean(err('fullName'))} />
            </Field>
            <Field label="Dirección" name="line1" error={err('line1')} className="sm:col-span-2">
              <input id="line1" autoComplete="address-line1" required value={form.line1} onChange={set('line1')} placeholder="Calle, número" className={input} aria-invalid={Boolean(err('line1'))} />
            </Field>
            <Field label="Piso, puerta… (opcional)" name="line2" className="sm:col-span-2">
              <input id="line2" autoComplete="address-line2" value={form.line2} onChange={set('line2')} className={input} />
            </Field>
            <Field label="Código postal" name="postalCode" error={err('postalCode')}>
              <input id="postalCode" inputMode="numeric" autoComplete="postal-code" maxLength={5} required value={form.postalCode} onChange={set('postalCode')} className={input} aria-invalid={Boolean(err('postalCode'))} />
            </Field>
            <Field label="Ciudad" name="city" error={err('city')}>
              <input id="city" autoComplete="address-level2" required value={form.city} onChange={set('city')} className={input} aria-invalid={Boolean(err('city'))} />
            </Field>
            <Field label="Provincia" name="province" error={err('province')}>
              <select id="province" autoComplete="address-level1" required value={form.province} onChange={set('province')} className={input} aria-invalid={Boolean(err('province'))}>
                <option value="">Elige provincia</option>
                {provinces.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </Field>
            <Field label="Teléfono (para el repartidor)" name="phone" error={err('phone')}>
              <input id="phone" type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} className={input} aria-invalid={Boolean(err('phone'))} />
            </Field>
          </div>
          <p className="text-xs text-ash-ink">Enviamos a Península y Baleares. Canarias, Ceuta y Melilla, próximamente.</p>
          {user && (
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} className="size-4 accent-chef-ink" />
              Guardar esta dirección en mi cuenta
            </label>
          )}
        </section>

        <section aria-label="Consentimientos" className="space-y-3 border-t border-line pt-6">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-chef-ink"
              aria-invalid={Boolean(err('acceptTerms'))}
            />
            <span>
              He leído y acepto las{' '}
              <Link href="/legal/condiciones" target="_blank" className="text-teja underline underline-offset-2">
                condiciones de compra
              </Link>{' '}
              y la{' '}
              <Link href="/legal/privacidad" target="_blank" className="text-teja underline underline-offset-2">
                política de privacidad
              </Link>
              .
            </span>
          </label>
          {err('acceptTerms') && <p className="text-xs text-teja">{err('acceptTerms')}</p>}
          <label className="flex items-start gap-3 text-sm text-ash-ink">
            <input type="checkbox" checked={newsletter} onChange={(e) => setNewsletter(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-chef-ink" />
            Quiero recibir novedades y promociones por email (opcional).
          </label>
        </section>
      </div>

      <aside aria-label="Tu pedido">
        <div className="sticky top-20 rounded-[28px] bg-mist p-6">
          <h2 className="mb-4 font-display text-xl font-bold">Tu pedido</h2>
          <ul className="mb-5 space-y-3">
            {items.map((item) => {
              const line = shownQuote?.lines.find((l) => l.variantId === item.variantId)
              return (
                <li key={item.variantId} className="flex items-center gap-3">
                  <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-white">
                    {item.imageUrl && <ProductImage src={item.imageUrl} alt="" fill sizes="56px" className="object-cover" />}
                    <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-ink text-[10px] font-semibold text-white">
                      {item.quantity}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="block truncate font-medium">{item.name}</span>
                    <span className="block text-ash-ink">{item.variantName}</span>
                    {line?.message && <span className="block text-xs text-teja">{line.message}</span>}
                  </span>
                  <span className="text-sm tabular-nums">{formatPrice((line?.unitPriceCents || item.priceCents) * item.quantity)}</span>
                </li>
              )
            })}
          </ul>
          <OrderSummary quote={shownQuote} loading={loading}>
            <PromoCodeField />
            {formError && (
              <p className="rounded-2xl bg-almendra-soft px-4 py-3 text-sm text-teja" role="alert">
                {formError}
              </p>
            )}
            <Button type="submit" size="lg" className="w-full" disabled={!paymentsEnabled || submitting || loading || !shownQuote?.isPurchasable}>
              <LockIcon size={18} />
              {submitting ? 'Conectando con Stripe…' : shownQuote ? `Pagar ${formatPrice(shownQuote.totalCents)}` : 'Pagar'}
            </Button>
            <p className={cn('text-center text-xs text-ash-ink')}>
              Te llevaremos a la página segura de Stripe para pagar. Nunca vemos ni guardamos los datos de tu tarjeta.
            </p>
          </OrderSummary>
        </div>
      </aside>
    </form>
  )
}
