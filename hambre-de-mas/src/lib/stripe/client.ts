import 'server-only'
import Stripe from 'stripe'
import { serverEnv } from '@/lib/env'

let cached: Stripe | null = null

/**
 * Cliente de Stripe del servidor. La clave secreta nunca llega al navegador:
 * el pago se hace en la página alojada de Stripe Checkout.
 */
export function getStripe(): Stripe {
  if (cached) return cached
  const key = serverEnv.stripeSecretKey()
  if (!key) throw new Error('Falta STRIPE_SECRET_KEY')

  // Solo para pruebas automáticas: permite apuntar a un servidor falso de
  // Stripe. Se ignora con claves de producción (sk_live_...).
  const testBase = process.env.STRIPE_API_BASE_URL
  const override =
    testBase && key.startsWith('sk_test_')
      ? (() => {
          const url = new URL(testBase)
          return { host: url.hostname, port: Number(url.port || 80), protocol: url.protocol.replace(':', '') as 'http' | 'https' }
        })()
      : {}

  cached = new Stripe(key, { appInfo: { name: 'hambre-de-mas' }, maxNetworkRetries: 2, ...override })
  return cached
}
