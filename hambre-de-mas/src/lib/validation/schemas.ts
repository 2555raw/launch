import { z } from 'zod'
import { ALLERGEN_CODES, type Allergen } from '@/lib/allergens'
import { commerce, isShippablePostalCode } from '@/lib/config/commerce'
import type { Locale } from '@/lib/i18n/config'
import { VALIDATION_EN } from './messages-en'

const allergenList = z.array(z.enum(ALLERGEN_CODES as [Allergen, ...Allergen[]])).max(14).default([])

/** Esquemas de validación compartidos por formularios, acciones y API. */

const trimmed = (max: number, label: string) =>
  z.string({ error: `${label} es obligatorio` }).trim().min(1, { error: `${label} es obligatorio` }).max(max, {
    error: `${label} es demasiado largo`,
  })

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined))

export const emailSchema = z
  .string({ error: 'Escribe tu email' })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Escribe un email válido' }))

export const phoneSchema = z
  .string()
  .trim()
  .max(30)
  .refine((v) => v === '' || /^\+?[0-9\s-]{9,20}$/.test(v), { error: 'Escribe un teléfono válido' })
  .optional()
  .transform((v) => (v ? v : undefined))

export const promoCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .max(32)
  .regex(/^[A-Z0-9_-]*$/, { error: 'Código no válido' })
  .optional()
  .transform((v) => (v ? v : undefined))

export const cartItemSchema = z.object({
  variantId: z.uuid({ error: 'Producto no válido' }),
  quantity: z.coerce.number().int().min(1).max(99),
})

export const cartRequestSchema = z.object({
  items: z.array(cartItemSchema).max(50, { error: 'Demasiados productos en el carrito' }),
  promoCode: promoCodeSchema,
})

export const addressSchema = z.object({
  fullName: trimmed(120, 'El nombre'),
  phone: phoneSchema,
  line1: trimmed(160, 'La dirección'),
  line2: optionalTrimmed(160),
  city: trimmed(80, 'La ciudad'),
  province: trimmed(80, 'La provincia'),
  postalCode: z
    .string()
    .trim()
    .regex(/^[0-9]{5}$/, { error: 'El código postal tiene 5 cifras' })
    .refine(isShippablePostalCode, {
      error: 'De momento solo enviamos a la Península y Baleares',
    }),
  country: z.literal('ES').default('ES'),
})

export const checkoutSchema = z.object({
  items: z.array(cartItemSchema).min(1, { error: 'Tu carrito está vacío' }).max(50),
  promoCode: promoCodeSchema,
  email: emailSchema,
  address: addressSchema,
  acceptTerms: z.literal(true, { error: 'Tienes que aceptar las condiciones de compra' }),
  newsletter: z.boolean().optional().default(false),
  saveAddress: z.boolean().optional().default(false),
  gift: z.boolean().optional().default(false),
  giftMessage: optionalTrimmed(300),
})

export type CheckoutInput = z.infer<typeof checkoutSchema>

export const passwordSchema = z
  .string()
  .min(8, { error: 'La contraseña necesita al menos 8 caracteres' })
  .max(72, { error: 'La contraseña es demasiado larga' })

/** Edad en años cumplidos a partir de una fecha AAAA-MM-DD. */
export function ageFrom(birthDate: string, today = new Date()) {
  const [y, m, d] = birthDate.split('-').map(Number)
  if (!y || !m || !d) return Number.NaN
  let age = today.getFullYear() - y
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age -= 1
  return age
}

/** Edad mínima para crear una cuenta; por debajo de 14 hace falta permiso de un adulto (art. 7 LOPDGDD). */
export const MIN_SIGNUP_AGE = 10
export const GUARDIAN_CONSENT_AGE = 14

export const signUpSchema = z
  .object({
    fullName: trimmed(120, 'El nombre'),
    email: emailSchema,
    password: passwordSchema,
    birthDate: z.string({ error: 'Indica tu fecha de nacimiento' }).regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Indica tu fecha de nacimiento' }),
    phone: phoneSchema,
    cookingLevel: z
      .union([z.literal(''), z.enum(['1', '2', '3'])])
      .optional()
      .transform((v) => (v ? v : undefined)),
    avoidAllergens: allergenList,
    marketingOptIn: z.boolean().default(false),
    guardianConsent: z.boolean().default(false),
    acceptPrivacy: z.literal(true, { error: 'Tienes que aceptar la política de privacidad' }),
  })
  .superRefine((data, ctx) => {
    const age = ageFrom(data.birthDate)
    if (!Number.isFinite(age) || age > 110 || age < 0) {
      ctx.addIssue({ code: 'custom', path: ['birthDate'], message: 'Revisa la fecha de nacimiento' })
    } else if (age < MIN_SIGNUP_AGE) {
      ctx.addIssue({ code: 'custom', path: ['birthDate'], message: `Para crear una cuenta tienes que tener al menos ${MIN_SIGNUP_AGE} años` })
    } else if (age < GUARDIAN_CONSENT_AGE && !data.guardianConsent) {
      ctx.addIssue({ code: 'custom', path: ['guardianConsent'], message: 'Con menos de 14 años necesitas el permiso de tu madre, padre o tutor' })
    }
  })

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { error: 'Escribe tu contraseña' }),
})

export const profileSchema = z.object({
  fullName: trimmed(120, 'El nombre'),
  phone: phoneSchema,
  cookingLevel: z
    .union([z.literal(''), z.enum(['1', '2', '3'])])
    .optional()
    .transform((v) => (v ? Number(v) : null)),
  avoidAllergens: allergenList,
  marketingOptIn: z.boolean().default(false),
})

export const savedAddressSchema = addressSchema.extend({
  label: optionalTrimmed(40),
  isDefault: z.boolean().default(false),
})

export const newsletterSchema = z.object({
  email: emailSchema,
  consent: z.literal(true, { error: 'Necesitamos tu consentimiento' }),
})

export const reviewSchema = z.object({
  productId: z.uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  title: optionalTrimmed(100),
  body: z.string().trim().min(10, { error: 'Cuéntanos un poco más (mínimo 10 caracteres)' }).max(2000),
  authorName: trimmed(60, 'El nombre'),
})

// ---------------------------------------------------------------------------
// Panel de administración
// ---------------------------------------------------------------------------

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, { error: 'Solo minúsculas, números y guiones' })
  .max(80)

const euros = (label: string) =>
  z.coerce
    .number({ error: `${label} no es un número` })
    .min(0.5, { error: `${label}: mínimo 0,50 €` })
    .max(10000)
    .transform((v) => Math.round(v * 100))

const optionalEuros = z
  .union([z.literal(''), z.coerce.number().positive().max(10000)])
  .optional()
  .transform((v) => (v === '' || v == null ? null : Math.round(Number(v) * 100)))

export const variantInputSchema = z
  .object({
    id: z.uuid().optional().or(z.literal('').transform(() => undefined)),
    sku: z.string().trim().min(1).max(64),
    name: trimmed(80, 'El nombre de la variante'),
    price: euros('El precio'),
    compareAt: optionalEuros,
    stock: z.coerce.number().int().min(0).max(1_000_000),
    isActive: z.boolean().default(true),
  })
  .refine((v) => v.compareAt == null || v.compareAt > v.price, {
    error: 'El precio anterior debe ser mayor que el actual',
    path: ['compareAt'],
  })

const optionalLines = (max: number, length: number) => z.array(z.string().trim().min(1).max(length)).max(max).optional()

/** Textos en inglés del producto (todos opcionales: lo que falte se muestra en español). */
export const productTranslationInputSchema = z.object({
  name: optionalTrimmed(120),
  subtitle: optionalTrimmed(200),
  badge: optionalTrimmed(24),
  description: optionalTrimmed(5000),
  includes: optionalLines(30, 120),
  specs: z.array(z.object({ label: z.string().trim().min(1).max(60), value: z.string().trim().min(1).max(400) })).max(20).optional(),
  recipe: z
    .object({
      youAdd: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
      steps: z.array(z.object({ title: z.string().trim().min(1).max(80), text: z.string().trim().min(1).max(800) })).max(30).default([]),
      tips: z.array(z.string().trim().min(1).max(300)).max(10).default([]),
    })
    .optional(),
  variants: z.record(z.string().trim().max(40), z.string().trim().min(1).max(80)).optional(),
})

export const productInputSchema = z.object({
  name: trimmed(120, 'El nombre'),
  slug: slugSchema,
  subtitle: optionalTrimmed(200),
  description: z.string().trim().max(5000).default(''),
  categoryId: z.uuid().optional().or(z.literal('').transform(() => undefined)),
  status: z.enum(['draft', 'published', 'archived']),
  taxRateBps: z.coerce.number().int().min(0).max(10000),
  isFeatured: z.boolean().default(false),
  badge: optionalTrimmed(24),
  minutes: z.coerce.number().int().min(0).max(1440).optional(),
  difficulty: z.coerce.number().int().min(1).max(3).optional(),
  heat: z.enum(['sin-fuego', 'microondas', 'sarten', 'cazo', 'horno']).optional(),
  storage: z.enum(['seco', 'fresco']).optional(),
  recipe: z
    .object({
      youAdd: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
      steps: z.array(z.object({ title: z.string().trim().min(1).max(80), text: z.string().trim().min(1).max(800) })).max(30).default([]),
      tips: z.array(z.string().trim().min(1).max(300)).max(10).default([]),
    })
    .default({ youAdd: [], steps: [], tips: [] }),
  tags: z.array(z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/).max(30)).max(20).default([]),
  allergens: allergenList,
  allergenTraces: allergenList,
  recipeAllergens: allergenList,
  includes: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
  specs: z.array(z.object({ label: z.string().trim().min(1).max(60), value: z.string().trim().min(1).max(400) })).max(20).default([]),
  seoTitle: optionalTrimmed(70),
  seoDescription: optionalTrimmed(170),
  variants: z.array(variantInputSchema).min(1, { error: 'Añade al menos una variante' }).max(30),
  translationEn: productTranslationInputSchema.optional(),
})

export type ProductInput = z.infer<typeof productInputSchema>

export const categoryInputSchema = z.object({
  name: trimmed(80, 'El nombre'),
  slug: slugSchema,
  tagline: optionalTrimmed(160),
  description: optionalTrimmed(1000),
  level: z
    .union([z.literal(''), z.coerce.number().int().min(1).max(9)])
    .optional()
    .transform((v) => (v === '' || v == null ? null : Number(v))),
  accent: z.enum(['chef', 'teja', 'hoja', 'almendra']),
  imageUrl: optionalTrimmed(1000),
  position: z.coerce.number().int().min(0).max(1000).default(0),
  isPublished: z.boolean().default(true),
})

export const promotionInputSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{3,32}$/, { error: 'De 3 a 32 caracteres: letras, números, - o _' }),
    description: optionalTrimmed(200),
    kind: z.enum(['percent', 'fixed']),
    value: z.coerce.number().positive({ error: 'El valor debe ser mayor que cero' }),
    minSubtotal: z.coerce.number().min(0).max(100000).default(0),
    startsAt: optionalTrimmed(40),
    endsAt: optionalTrimmed(40),
    maxRedemptions: z
      .union([z.literal(''), z.coerce.number().int().positive()])
      .optional()
      .transform((v) => (v === '' || v == null ? null : Number(v))),
    isActive: z.boolean().default(true),
  })
  .refine((p) => p.kind !== 'percent' || p.value <= 100, { error: 'Un porcentaje no puede pasar de 100', path: ['value'] })

export const fulfillmentSchema = z.object({
  orderId: z.uuid(),
  fulfillmentStatus: z.enum(['unfulfilled', 'preparing', 'shipped', 'delivered', 'returned']),
  trackingCarrier: optionalTrimmed(60),
  trackingNumber: optionalTrimmed(80),
  trackingUrl: z
    .union([z.literal(''), z.url({ protocol: /^https?$/ })])
    .optional()
    .transform((v) => (v ? v : undefined)),
  adminNotes: optionalTrimmed(2000),
})

/** Primer mensaje de error de un resultado de Zod, para mostrar al usuario. */
/** Traduce un mensaje de validación al idioma del cliente (si hay traducción). */
export function localizeMessage(message: string, locale: Locale = 'es') {
  return locale === 'en' ? (VALIDATION_EN[message] ?? message) : message
}

export function firstError(error: z.ZodError, locale: Locale = 'es') {
  return localizeMessage(error.issues[0]?.message ?? 'Revisa los datos del formulario', locale)
}

/** Errores por campo (ruta con puntos) para pintarlos junto a cada input. */
export function fieldErrors(error: z.ZodError, locale: Locale = 'es') {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.')
    if (!out[key]) out[key] = localizeMessage(issue.message, locale)
  }
  return out
}

export const MAX_QUANTITY = commerce.maxQuantityPerLine
