'use client'

import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import Script from 'next/script'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n/client'

/**
 * Banner de consentimiento de cookies.
 *
 * - Las cookies técnicas (sesión, cesta en localStorage) no necesitan consentimiento.
 * - La analítica solo se carga si el usuario la acepta expresamente, y
 *   solo si hay un proveedor configurado (Plausible o Google Analytics 4).
 * - "Rechazar" está al mismo nivel que "Aceptar", como pide la guía de la AEPD.
 * - Se puede cambiar la decisión en cualquier momento desde el pie de página.
 */

const COOKIE = 'hdm_consent'
const VERSION = 1
export const OPEN_COOKIE_SETTINGS = 'hdm:open-cookie-settings'

type Consent = { v: number; analytics: boolean; at: string }

function readConsent(): Consent | null {
  const raw = document.cookie.split('; ').find((c) => c.startsWith(`${COOKIE}=`))
  if (!raw) return null
  try {
    const parsed = JSON.parse(decodeURIComponent(raw.slice(COOKIE.length + 1))) as Consent
    return parsed.v === VERSION ? parsed : null
  } catch {
    return null
  }
}

function writeConsent(analytics: boolean) {
  const value: Consent = { v: VERSION, analytics, at: new Date().toISOString() }
  const secure = location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(value))}; Path=/; Max-Age=${60 * 60 * 24 * 180}; SameSite=Lax${secure}`
  return value
}

const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN
const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
export const hasAnalyticsProvider = Boolean(plausibleDomain || gaId)

export function CookieConsent() {
  const { t } = useI18n()
  const [consent, setConsent] = useState<Consent | null>(null)
  const [open, setOpen] = useState(false)
  const [details, setDetails] = useState(false)
  const [analyticsChoice, setAnalyticsChoice] = useState(false)

  useEffect(() => {
    const current = readConsent()
    // La cookie solo puede leerse en el navegador, tras montar.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización con un sistema externo (document.cookie)
    setConsent(current)
    setAnalyticsChoice(current?.analytics ?? false)
    if (!current) setOpen(true)
    const reopen = () => {
      setDetails(true)
      setOpen(true)
    }
    window.addEventListener(OPEN_COOKIE_SETTINGS, reopen)
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS, reopen)
  }, [])

  const decide = (analytics: boolean) => {
    const previous = consent?.analytics
    setConsent(writeConsent(analytics))
    setOpen(false)
    // Si se retira el consentimiento, recargar para descargar los scripts.
    if (previous && !analytics) location.reload()
  }

  return (
    <>
      {consent?.analytics && plausibleDomain && (
        <Script src="https://plausible.io/js/script.js" data-domain={plausibleDomain} strategy="afterInteractive" />
      )}
      {consent?.analytics && gaId && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
          <Script id="ga-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${gaId}',{anonymize_ip:true});`}
          </Script>
        </>
      )}

      <AnimatePresence>
        {open && (
          <motion.section
            role="dialog"
            aria-labelledby="cookies-titulo"
            aria-describedby="cookies-texto"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.28, 0.11, 0.32, 1] }}
            className="fixed inset-x-3 bottom-3 z-[90] rounded-2xl bg-white p-4 text-[13px] shadow-float ring-1 ring-line sm:right-auto sm:bottom-5 sm:left-5 sm:max-w-[360px]"
          >
            <div className="flex items-start gap-3">
              <CookieMark />
              <div className="min-w-0">
                <h2 id="cookies-titulo" className="text-sm font-semibold text-ink">
                  {t({ es: 'Usamos cookies', en: 'We use cookies' })}
                </h2>
                <p id="cookies-texto" className="mt-0.5 leading-snug text-ash-ink">
                  {hasAnalyticsProvider
                    ? t({ es: 'Técnicas para que la tienda funcione y, si aceptas, de analítica.', en: 'Essential ones to run the shop and, if you accept, analytics.' })
                    : t({ es: 'Solo técnicas, para que la tienda funcione (sesión y cesta).', en: 'Only essential ones, to run the shop (session and bag).' })}{' '}
                  <Link href="/legal/cookies" className="text-teja underline underline-offset-2">
                    {t({ es: 'Más info', en: 'Learn more' })}
                  </Link>
                </p>
              </div>
            </div>

            {details && (
              <div className="mt-3 space-y-2 rounded-xl bg-mist p-3 text-xs">
                <label className="flex items-start gap-2.5">
                  <input type="checkbox" checked disabled className="mt-0.5 size-3.5 accent-chef-ink" />
                  <span>
                    <strong className="font-semibold">{t({ es: 'Técnicas', en: 'Essential' })}</strong> ·{' '}
                    {t({ es: 'Siempre activas: sesión, cesta y esta preferencia.', en: 'Always on: session, bag and this choice.' })}
                  </span>
                </label>
                <label className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={analyticsChoice}
                    disabled={!hasAnalyticsProvider}
                    onChange={(e) => setAnalyticsChoice(e.target.checked)}
                    className="mt-0.5 size-3.5 accent-chef-ink"
                  />
                  <span>
                    <strong className="font-semibold">{t({ es: 'Analítica', en: 'Analytics' })}</strong> ·{' '}
                    {hasAnalyticsProvider
                      ? t({ es: 'Estadísticas anónimas de uso.', en: 'Anonymous usage statistics.' })
                      : t({ es: 'No hay ninguna configurada.', en: 'None set up.' })}
                  </span>
                </label>
              </div>
            )}

            {/* Aceptar y rechazar con el mismo peso, como pide la guía de la AEPD. */}
            <div className="mt-3 flex items-center gap-2">
              <Button size="sm" variant="dark" className="h-8 flex-1 px-3 text-[13px]" onClick={() => decide(true)}>
                {t({ es: 'Aceptar', en: 'Accept' })}
              </Button>
              <Button size="sm" variant="dark" className="h-8 flex-1 px-3 text-[13px]" onClick={() => decide(false)}>
                {t({ es: 'Rechazar', en: 'Reject' })}
              </Button>
              {details ? (
                <Button size="sm" variant="secondary" className="h-8 px-3 text-[13px]" onClick={() => decide(analyticsChoice)}>
                  {t({ es: 'Guardar', en: 'Save' })}
                </Button>
              ) : (
                <Button size="sm" variant="ghost" className="h-8 px-3 text-[13px]" onClick={() => setDetails(true)}>
                  {t({ es: 'Configurar', en: 'Settings' })}
                </Button>
              )}
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  )
}

function CookieMark() {
  return (
    <svg viewBox="0 0 24 24" className="mt-0.5 size-6 shrink-0 text-chef-ink" aria-hidden>
      <path
        d="M12 3a9 9 0 1 0 9 9 3 3 0 0 1-3.5-3A3 3 0 0 1 14 5.5 3 3 0 0 1 12 3Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="8.5" cy="11" r="1.1" fill="currentColor" />
      <circle cx="12" cy="15.5" r="1.1" fill="currentColor" />
      <circle cx="15.8" cy="13.2" r="0.9" fill="currentColor" />
      <circle cx="9" cy="16" r="0.8" fill="currentColor" />
    </svg>
  )
}

export function CookieSettingsLink({ className }: { className?: string }) {
  const { t } = useI18n()
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS))}>
      {t({ es: 'Configurar cookies', en: 'Cookie settings' })}
    </button>
  )
}
