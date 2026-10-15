import { getLocale, t } from './i18n'

export const fmtInt = (n: number) => new Intl.NumberFormat(getLocale()).format(n)
export const fmtNum = (n: number, d = 1) => new Intl.NumberFormat(getLocale(), { maximumFractionDigits: d }).format(n)
export const fmtDate = (iso?: string) => (iso ? new Intl.DateTimeFormat(getLocale(), { dateStyle: 'medium' }).format(new Date(iso)) : '—')
export const fmtDateTime = (iso?: string) => (iso ? new Intl.DateTimeFormat(getLocale(), { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso)) : '—')
export const fmtPct = (n: number) => `${Math.round(n)} %`
export const today = () => new Date().toISOString().slice(0, 10)
export const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)
export const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.round(diff / 60000)
  if (m < 1) return t('ahora mismo')
  if (m < 60) return t('hace {n} min', { n: m })
  const h = Math.round(m / 60)
  if (h < 24) return t('hace {n} h', { n: h })
  const d = Math.round(h / 24)
  return t('hace {n} d', { n: d })
}
export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ')
