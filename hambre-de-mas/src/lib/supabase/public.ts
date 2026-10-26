import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { supabaseAnonKey, supabaseUrl } from '@/lib/env'

/**
 * Cliente anónimo sin cookies para leer el catálogo público. Al no depender
 * de la sesión, las páginas que lo usan se pueden cachear (ISR).
 */
export function createSupabasePublicClient() {
  const url = supabaseUrl()
  const key = supabaseAnonKey()
  if (!url || !key) throw new Error('Supabase no está configurado')
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}
