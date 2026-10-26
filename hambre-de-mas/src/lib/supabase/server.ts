import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAnonKey, supabaseUrl } from '@/lib/env'

/**
 * Cliente con la sesión del usuario (cookies). Respeta RLS: úsalo para todo
 * lo que haga un cliente o un administrador identificado.
 */
export async function createSupabaseServerClient() {
  const url = supabaseUrl()
  const key = supabaseAnonKey()
  if (!url || !key) throw new Error('Supabase no está configurado')
  const cookieStore = await cookies()

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Llamado desde un Server Component: el proxy ya refresca la sesión.
        }
      },
    },
  })
}
