import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { serverEnv } from '@/lib/env'

/**
 * Firma corta para enlaces que actúan sobre un pedido sin sesión (p. ej. la
 * URL de "pago cancelado"), para que nadie pueda cancelar pedidos ajenos
 * adivinando su id.
 */
function secret() {
  const value = process.env.ORDER_TOKEN_SECRET || serverEnv.stripeWebhookSecret() || serverEnv.serviceRoleKey()
  if (!value) throw new Error('Falta ORDER_TOKEN_SECRET')
  return value
}

export function signOrderId(orderId: string) {
  return createHmac('sha256', secret()).update(`order:${orderId}`).digest('base64url').slice(0, 32)
}

export function verifyOrderToken(orderId: string, token: string | null | undefined) {
  if (!token) return false
  const expected = Buffer.from(signOrderId(orderId))
  const given = Buffer.from(token)
  return expected.length === given.length && timingSafeEqual(expected, given)
}
