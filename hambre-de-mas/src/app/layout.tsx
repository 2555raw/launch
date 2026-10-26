import type { Metadata, Viewport } from 'next'
import { Inter, Montserrat } from 'next/font/google'
import { CartProvider } from '@/components/cart/cart-context'
import { CookieConsent } from '@/components/legal/cookie-consent'
import { MotionProvider } from '@/components/motion/motion-provider'
import { site } from '@/lib/config/site'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-montserrat',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} · Kits de cocina para adolescentes`,
    template: `%s · ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  openGraph: {
    type: 'website',
    locale: 'es_ES',
    siteName: site.name,
    title: `${site.name} · ${site.tagline}`,
    description: site.description,
    images: [{ url: '/demo/home/hero-ramen.jpg', width: 2000, height: 2000, alt: 'Bol de ramen casero' }],
  },
  twitter: { card: 'summary_large_image' },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} ${montserrat.variable}`}>
      <body className="min-h-dvh">
        <MotionProvider>
          <CartProvider>
            {children}
            <CookieConsent />
          </CartProvider>
        </MotionProvider>
      </body>
    </html>
  )
}
