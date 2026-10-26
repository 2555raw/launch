/**
 * Datos públicos de la tienda y de la empresa.
 *
 * Los datos legales se leen de variables de entorno NEXT_PUBLIC_COMPANY_*.
 * Mientras falten, las páginas legales muestran un aviso de "pendiente" en
 * lugar de inventarse nada.
 */

// Next.js solo sustituye process.env.NEXT_PUBLIC_* en el navegador cuando se
// escriben literalmente, por eso cada variable se lee por su nombre completo.
const env = (value: string | undefined) => (value && value.trim() !== '' ? value.trim() : null)

export const site = {
  name: 'Hambre de Más',
  shortName: 'Hambre de Más',
  tagline: 'Cocina lo que te flipa.',
  description:
    'Kits de cocina para adolescentes. Eliges tu nivel, te llega a casa con los ingredientes secos y la receta con vídeo, y desbloqueas el siguiente plato.',
  url: (env(process.env.NEXT_PUBLIC_SITE_URL) ?? 'http://localhost:3000').replace(/\/$/, ''),
  locale: 'es-ES',
  currency: 'EUR',
  social: {
    instagram: env(process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM) ?? 'https://www.instagram.com/hambredemas',
    tiktok: env(process.env.NEXT_PUBLIC_SOCIAL_TIKTOK) ?? 'https://www.tiktok.com/@hambredemas',
  },
} as const

export const company = {
  legalName: env(process.env.NEXT_PUBLIC_COMPANY_LEGAL_NAME),
  taxId: env(process.env.NEXT_PUBLIC_COMPANY_TAX_ID),
  address: env(process.env.NEXT_PUBLIC_COMPANY_ADDRESS),
  email: env(process.env.NEXT_PUBLIC_COMPANY_EMAIL),
  phone: env(process.env.NEXT_PUBLIC_COMPANY_PHONE),
  registry: env(process.env.NEXT_PUBLIC_COMPANY_REGISTRY),
  supportHours: env(process.env.NEXT_PUBLIC_SUPPORT_HOURS) ?? 'De lunes a viernes, de 9:00 a 18:00',
}

export const isCompanyInfoComplete = Boolean(
  company.legalName && company.taxId && company.address && company.email,
)

/** Muestra el dato o un marcador visible de que falta configurarlo. */
export function companyField(value: string | null, label: string) {
  return value ?? `[PENDIENTE: ${label}]`
}
