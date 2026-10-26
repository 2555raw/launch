import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy-session'

/**
 * Refresca la sesión de Supabase y hace redirecciones optimistas en las zonas
 * privadas. La autorización de verdad se comprueba otra vez en cada página y
 * acción del servidor, y en la base de datos (RLS).
 */
export async function proxy(request: NextRequest) {
  const { response, userId } = await updateSession(request)
  const { pathname, search } = request.nextUrl

  const isPrivate =
    pathname.startsWith('/admin') ||
    (pathname.startsWith('/cuenta') && !/^\/cuenta\/(acceder|registro|recuperar)(\/|$)/.test(pathname))

  if (isPrivate && !userId) {
    const login = new URL('/cuenta/acceder', request.url)
    login.searchParams.set('next', pathname + search)
    return NextResponse.redirect(login)
  }
  return response
}

export const config = {
  // Solo donde hace falta sesión: así el catálogo puede servirse cacheado.
  matcher: ['/cuenta/:path*', '/admin/:path*', '/checkout/:path*', '/auth/:path*', '/producto/:path*', '/api/checkout'],
}
