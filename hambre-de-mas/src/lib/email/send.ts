import 'server-only'
import { serverEnv } from '@/lib/env'

/**
 * Envío de emails transaccionales con Resend (https://resend.com) si hay
 * RESEND_API_KEY. Sin clave, se registra en consola y no se envía nada:
 * Stripe puede mandar igualmente su recibo de pago si lo activas en el panel.
 */
export async function sendEmail(message: { to: string; subject: string; html: string; text: string }) {
  const key = serverEnv.resendApiKey()
  const from = serverEnv.emailFrom()
  if (!key || !from) {
    console.info(`[email] (sin proveedor configurado) para ${message.to}: ${message.subject}`)
    return { sent: false as const }
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [message.to], subject: message.subject, html: message.html, text: message.text }),
  })
  if (!res.ok) {
    console.error('[email] error de Resend', res.status, await res.text().catch(() => ''))
    return { sent: false as const }
  }
  return { sent: true as const }
}
