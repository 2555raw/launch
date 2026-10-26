import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { serverEnv, supabaseUrl } from '@/lib/env'

let cached: SupabaseClient | null = null

/**
 * Cliente con la service role: se salta RLS. Solo para operaciones del
 * servidor que no pertenecen a un usuario concreto (crear pedidos, webhooks
 * de Stripe, validar promociones). Nunca se importa desde el navegador
 * (`server-only` lo impide en tiempo de compilación).
 */
export function createSupabaseServiceClient() {
  if (cached) return cached
  const url = supabaseUrl()
  const key = serverEnv.serviceRoleKey()
  if (!url || !key) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY')
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  return cached
}

export function isServiceRoleConfigured() {
  return Boolean(supabaseUrl() && serverEnv.serviceRoleKey())
}
