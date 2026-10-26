'use client'

import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import Script from 'next/script'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

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
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.28, 0.11, 0.32, 1] }}
            className="fixed inset-x-3 bottom-3 z-[90] mx-auto max-w-2xl rounded-[22px] bg-white p-5 shadow-float ring-1 ring-line sm:inset-x-6 sm:bottom-6 sm:p-6"
          >
            <h2 id="cookies-titulo" className="font-display text-lg font-bold">
              Tu privacidad, tus reglas
            </h2>
            <p id="cookies-texto" className="mt-1 text-sm text-ash-ink">
              Usamos cookies técnicas para que la tienda funcione (sesión y cesta).
              {hasAnalyticsProvider
                ? ' Con tu permiso, también cookies de analítica para entender qué kits os gustan más.'
                : ' Ahora mismo no usamos cookies de analítica ni de publicidad.'}{' '}
              <Link href="/legal/cookies" className="text-teja underline underline-offset-2">
                Política de cookies
              </Link>
            </p>

            {details && (
              <div className="mt-4 space-y-3 rounded-2xl bg-mist p-4 text-sm">
                <label className="flex items-start gap-3">
                  <input type="checkbox" checked disabled className="mt-0.5 size-4 accent-chef-ink" />
                  <span>
                    <strong className="font-semibold">Técnicas</strong> · Siempre activas. Sesión de usuario, cesta y esta misma preferencia.
                  </span>
                </label>
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={analyticsChoice}
                    disabled={!hasAnalyticsProvider}
                    onChange={(e) => setAnalyticsChoice(e.target.checked)}
                    className="mt-0.5 size-4 accent-chef-ink"
                  />
                  <span>
                    <strong className="font-semibold">Analítica</strong> ·{' '}
                    {hasAnalyticsProvider ? 'Estadísticas anónimas de uso.' : 'No hay ninguna herramienta de analítica configurada.'}
                  </span>
                </label>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="dark" onClick={() => decide(true)}>
                Aceptar todas
              </Button>
              <Button size="sm" variant="dark" onClick={() => decide(false)}>
                Rechazar opcionales
              </Button>
              {details ? (
                <Button size="sm" variant="secondary" onClick={() => decide(analyticsChoice)}>
                  Guardar selección
                </Button>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => setDetails(true)}>
                  Configurar
                </Button>
              )}
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  )
}

export function CookieSettingsLink({ className }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS))}>
      Configurar cookies
    </button>
  )
}
