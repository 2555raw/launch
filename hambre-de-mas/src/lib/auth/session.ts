import 'server-only'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { isSupabaseConfigured } from '@/lib/env'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export type SessionUser = { id: string; email: string | null }
export type Profile = {
  id: string
  email: string | null
  fullName: string | null
  phone: string | null
  role: 'customer' | 'admin'
  marketingOptIn: boolean
}

/**
 * Usuario de la petición actual, validado contra el servidor de Auth
 * (getUser no se fía de la cookie sin comprobarla).
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  if (!isSupabaseConfigured()) return null
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  return data.user ? { id: data.user.id, email: data.user.email ?? null } : null
})

export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getCurrentUser()
  if (!user) return null
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
  if (!data) return null
  return {
    id: data.id,
    email: data.email ?? user.email,
    fullName: data.full_name,
    phone: data.phone,
    role: data.role,
    marketingOptIn: data.marketing_opt_in,
  }
})

/** Para páginas privadas: redirige al acceso si no hay sesión. */
export async function requireUser(next: string) {
  const user = await getCurrentUser()
  if (!user) redirect(`/cuenta/acceder?next=${encodeURIComponent(next)}`)
  return user
}

/**
 * Para el panel: exige sesión y rol admin. La base de datos vuelve a
 * comprobarlo en cada consulta con RLS (is_admin()).
 */
export async function requireAdmin(next = '/admin') {
  const user = await requireUser(next)
  const profile = await getProfile()
  if (profile?.role !== 'admin') redirect('/admin/sin-acceso')
  return { user, profile }
}

/** Solo permite redirecciones internas tras el login (evita open redirects). */
export function safeNext(next: string | null | undefined, fallback = '/cuenta') {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback
  return next
}
