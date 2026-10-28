/**
 * Acceso centralizado a las variables de entorno y a qué integraciones están
 * configuradas. Las claves secretas solo se leen en el servidor.
 */

const read = (...names: string[]) => {
  for (const name of names) {
    const value = process.env[name]
    if (value && value.trim() !== '') return value.trim()
  }
  return null
}

const clean = (value: string | undefined) => (value && value.trim() !== '' ? value.trim() : null)

// Las públicas se leen por nombre literal para que Next.js las incluya en el navegador.
export const supabaseUrl = () => clean(process.env.NEXT_PUBLIC_SUPABASE_URL)
export const supabaseAnonKey = () =>
  clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ?? clean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl() && supabaseAnonKey())
}

export function isStripeConfigured() {
  return Boolean(read('STRIPE_SECRET_KEY') && read('STRIPE_WEBHOOK_SECRET'))
}

/** True si las claves de Stripe son de modo test (sk_test_...). */
export function isStripeTestMode() {
  return (read('STRIPE_SECRET_KEY') ?? '').startsWith('sk_test_')
}

/** True si el asistente de ayuda puede usar Claude; si no, responde con las preguntas frecuentes. */
export function isAssistantConfigured() {
  return Boolean(read('ANTHROPIC_API_KEY'))
}

export const serverEnv = {
  serviceRoleKey: () => read('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY'),
  stripeSecretKey: () => read('STRIPE_SECRET_KEY'),
  stripeWebhookSecret: () => read('STRIPE_WEBHOOK_SECRET'),
  resendApiKey: () => read('RESEND_API_KEY'),
  emailFrom: () => read('EMAIL_FROM'),
  cronSecret: () => read('CRON_SECRET'),
  anthropicApiKey: () => read('ANTHROPIC_API_KEY'),
}
