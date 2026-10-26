import type { EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { safeNext } from '@/lib/auth/session'
import { isSupabaseConfigured } from '@/lib/env'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * Destino de los enlaces de los emails de Supabase (confirmar cuenta,
 * recuperar contraseña). Acepta tanto el flujo PKCE (?code=) como el de
 * token_hash (plantillas personalizadas).
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl
  const next = safeNext(url.searchParams.get('next'))
  const fail = NextResponse.redirect(new URL('/cuenta/acceder?error=enlace', url.origin))
  if (!isSupabaseConfigured()) return fail

  const supabase = await createSupabaseServerClient()
  const code = url.searchParams.get('code')
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type') as EmailOtpType | null

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) return fail
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (error) return fail
  } else {
    return fail
  }
  return NextResponse.redirect(new URL(next, url.origin))
}
