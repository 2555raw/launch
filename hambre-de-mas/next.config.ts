import type { NextConfig } from 'next'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL) : null
const isLocalSupabase = supabaseUrl ? ['localhost', '127.0.0.1'].includes(supabaseUrl.hostname) : false

// Analítica opcional: solo se añade a la CSP si está configurada (y solo se
// carga tras el consentimiento, ver CookieConsent).
const analytics = [
  ...(process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN ? ['https://plausible.io'] : []),
  ...(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ? ['https://www.googletagmanager.com', 'https://*.google-analytics.com'] : []),
].join(' ')

// Política de seguridad de contenidos. El pago se hace en la página de Stripe
// (redirección), así que no hace falta cargar sus scripts.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : '') + (analytics ? ` ${analytics}` : ''),
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${supabaseUrl ? ` ${supabaseUrl.origin}` : ''}${analytics ? ` ${analytics}` : ''}`,
  "font-src 'self'",
  `connect-src 'self'${supabaseUrl ? ` ${supabaseUrl.origin}` : ''}${analytics ? ` ${analytics}` : ''}`,
  "frame-ancestors 'none'",
  "form-action 'self' https://checkout.stripe.com",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(self "https://checkout.stripe.com")' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Las fotos de producto (máx. 5 MB) se suben con una acción del servidor.
    serverActions: { bodySizeLimit: '6mb' },
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    qualities: [70, 75, 85],
    remotePatterns: supabaseUrl
      ? [
          {
            protocol: supabaseUrl.protocol.replace(':', '') as 'http' | 'https',
            hostname: supabaseUrl.hostname,
            port: supabaseUrl.port,
            pathname: '/storage/v1/object/public/**',
          },
        ]
      : [],
    // Solo en desarrollo con Supabase local: permite optimizar imágenes de 127.0.0.1.
    dangerouslyAllowLocalIP: isLocalSupabase && process.env.NODE_ENV !== 'production',
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
