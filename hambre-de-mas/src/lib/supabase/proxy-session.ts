import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAnonKey, supabaseUrl } from '@/lib/env'

/**
 * Refresca la sesión de Supabase en cada petición (lo recomendado por
 * @supabase/ssr) y devuelve el usuario para hacer redirecciones optimistas.
 * La autorización real se vuelve a comprobar en cada página y acción del
 * servidor, y en la base de datos con RLS.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  const url = supabaseUrl()
  const key = supabaseAnonKey()
  if (!url || !key) return { response, userId: null as string | null }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v))
      },
    },
  })

  const { data } = await supabase.auth.getUser()
  return { response, userId: data.user?.id ?? null }
}
