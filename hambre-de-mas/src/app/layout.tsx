import type { Metadata, Viewport } from 'next'
import { Inter, Montserrat } from 'next/font/google'
import { CartProvider } from '@/components/cart/cart-context'
import { CookieConsent } from '@/components/legal/cookie-consent'
import { MotionProvider } from '@/components/motion/motion-provider'
import { site } from '@/lib/config/site'
import { I18nProvider } from '@/lib/i18n/client'
import { OG_LOCALE } from '@/lib/i18n/config'
import { getI18n } from '@/lib/i18n/server'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-montserrat',
  display: 'swap',
})

export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await getI18n()
  const description = t(site.description)
  return {
    metadataBase: new URL(site.url),
    title: {
      default: `${site.name} · ${t({ es: 'Kits de cocina para adolescentes', en: 'Cooking kits for teens' })}`,
      template: `%s · ${site.name}`,
    },
    description,
    applicationName: site.name,
    openGraph: {
      type: 'website',
      locale: OG_LOCALE[locale],
      alternateLocale: Object.values(OG_LOCALE).filter((l) => l !== OG_LOCALE[locale]),
      siteName: site.name,
      title: `${site.name} · ${t(site.tagline)}`,
      description,
      images: [{ url: '/demo/home/hero-ramen.jpg', width: 2000, height: 2000, alt: t({ es: 'Bol de ramen casero', en: 'Bowl of homemade ramen' }) }],
    },
    twitter: { card: 'summary_large_image' },
    formatDetection: { telephone: false },
  }
}

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale } = await getI18n()
  return (
    <html lang={locale} className={`${inter.variable} ${montserrat.variable}`}>
      <body className="min-h-dvh">
        <I18nProvider locale={locale}>
          <MotionProvider>
            <CartProvider>
              {children}
              <CookieConsent />
            </CartProvider>
          </MotionProvider>
        </I18nProvider>
      </body>
    </html>
  )
}
