import { z } from 'zod'
import { commerce, isShippablePostalCode } from '@/lib/config/commerce'

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
})

export type CheckoutInput = z.infer<typeof checkoutSchema>

export const passwordSchema = z
  .string()
  .min(8, { error: 'La contraseña necesita al menos 8 caracteres' })
  .max(72, { error: 'La contraseña es demasiado larga' })

export const signUpSchema = z.object({
  fullName: trimmed(120, 'El nombre'),
  email: emailSchema,
  password: passwordSchema,
  acceptPrivacy: z.literal(true, { error: 'Tienes que aceptar la política de privacidad' }),
})

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { error: 'Escribe tu contraseña' }),
})

export const profileSchema = z.object({
  fullName: trimmed(120, 'El nombre'),
  phone: phoneSchema,
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
  tags: z.array(z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/).max(30)).max(20).default([]),
  includes: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
  specs: z.array(z.object({ label: z.string().trim().min(1).max(60), value: z.string().trim().min(1).max(400) })).max(20).default([]),
  seoTitle: optionalTrimmed(70),
  seoDescription: optionalTrimmed(170),
  variants: z.array(variantInputSchema).min(1, { error: 'Añade al menos una variante' }).max(30),
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
export function firstError(error: z.ZodError) {
  return error.issues[0]?.message ?? 'Revisa los datos del formulario'
}

/** Errores por campo (ruta con puntos) para pintarlos junto a cada input. */
export function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.')
    if (!out[key]) out[key] = issue.message
  }
  return out
}

export const MAX_QUANTITY = commerce.maxQuantityPerLine
