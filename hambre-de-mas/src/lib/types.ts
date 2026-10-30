// Tipos de dominio compartidos entre servidor y cliente.
import type { Allergen } from '@/lib/allergens'
import type { Locale } from '@/lib/i18n/config'

export type Accent = 'chef' | 'teja' | 'hoja' | 'almendra'

/** Textos traducidos por idioma (el español va en los campos normales). */
export type Translations<T> = Partial<Record<Exclude<Locale, 'es'>, T>>

export type CategoryTranslation = Partial<{ name: string; tagline: string; description: string }>

export type ProductTranslation = Partial<{
  name: string
  subtitle: string
  badge: string
  description: string
  includes: string[]
  specs: { label: string; value: string }[]
  recipe: Recipe
  /** Nombre de cada variante, por SKU. */
  variants: Record<string, string>
  /** Texto alternativo de cada imagen, en el orden de la galería. */
  imageAlts: string[]
  seoTitle: string
  seoDescription: string
}>

export type Category = {
  id: string
  slug: string
  name: string
  tagline: string | null
  description: string | null
  level: number | null
  accent: Accent
  imageUrl: string | null
  position: number
  translations?: Translations<CategoryTranslation>
}

export type ProductImage = {
  id: string
  url: string
  alt: string
  position: number
}

export type Variant = {
  id: string
  sku: string
  name: string
  priceCents: number
  compareAtPriceCents: number | null
  stock: number
  isActive: boolean
  position: number
}

export type Heat = 'sin-fuego' | 'microondas' | 'sarten' | 'cazo' | 'horno'

export type ProductAttributes = {
  minutes?: number
  difficulty?: number
  heat?: Heat
  /** seco: todo de despensa · fresco: incluye refrigerados */
  storage?: 'seco' | 'fresco'
  /** Valores nutricionales aproximados por ración. */
  nutrition?: Nutrition
  /** Edición que solo se puede encargar hasta su fecha de salida. */
  preorder?: Preorder
}

export type Preorder = {
  /** Día de salida (AAAA-MM-DD, hora de España). */
  releaseDate: string
}

export type Nutrition = {
  kcal: number
  /** Gramos por ración. */
  protein: number
  carbs: number
  fat: number
}

export type Recipe = {
  youAdd: string[]
  steps: { title: string; text: string }[]
  tips: string[]
}

/** Lo necesario para pintar una tarjeta de producto. */
export type ProductSummary = {
  id: string
  slug: string
  name: string
  subtitle: string | null
  priceCents: number
  compareAtPriceCents: number | null
  badge: string | null
  isFeatured: boolean
  isDemo: boolean
  totalStock: number
  salesCount: number
  publishedAt: string | null
  attributes: ProductAttributes
  tags: string[]
  /** Alérgenos que contiene el kit. */
  allergens: Allergen[]
  category: Pick<Category, 'slug' | 'name' | 'level' | 'accent' | 'translations'> | null
  image: ProductImage | null
  hoverImage: ProductImage | null
  variantCount: number
  /** Variante que añade el botón rápido de la tarjeta: la más barata con stock (o null si no queda). */
  quickAdd: { variantId: string; sku: string; name: string; priceCents: number; stock: number } | null
  translations?: Translations<ProductTranslation>
}

export type ProductDetail = ProductSummary & {
  description: string
  includes: string[]
  /** Foto de cada elemento de `includes` (mismo orden; null si no hay). */
  includeImages: (string | null)[]
  specs: { label: string; value: string }[]
  /** Puede contener trazas de… */
  allergenTraces: Allergen[]
  /** Alérgenos de los ingredientes frescos que añade el cliente. */
  recipeAllergens: Allergen[]
  recipe: Recipe
  taxRateBps: number
  images: ProductImage[]
  variants: Variant[]
  seoTitle: string | null
  seoDescription: string | null
  categoryId: string | null
}

export type Review = {
  id: string
  rating: number
  title: string | null
  body: string
  authorName: string
  isVerified: boolean
  createdAt: string
}

export type SortKey = 'featured' | 'newest' | 'price-asc' | 'price-desc' | 'popular'

export type ProductFilter = {
  category?: string
  q?: string
  minPrice?: number
  maxPrice?: number
  tags?: string[]
  /** Excluir productos que contengan (o puedan contener) estos alérgenos. */
  excludeAllergens?: Allergen[]
  difficulty?: number[]
  maxMinutes?: number
  inStock?: boolean
  featured?: boolean
  /** Solo novedades: publicados en los últimos NEW_ARRIVAL_DAYS días. */
  newArrivals?: boolean
  sort?: SortKey
  limit?: number
  offset?: number
}

/** Datos de una variante que el servidor usa para validar el carrito. */
export type VariantForQuote = {
  variantId: string
  sku: string
  variantName: string
  priceCents: number
  compareAtPriceCents: number | null
  stock: number
  isActive: boolean
  productId: string
  productSlug: string
  productName: string
  productPublished: boolean
  taxRateBps: number
  imageUrl: string | null
  /** Si el kit aún solo se puede encargar, su día de salida (AAAA-MM-DD): no se puede comprar. */
  preorderRelease?: string | null
  /** Nivel de la categoría del kit (1, 2, 3) o null; decide los packs por nivel. */
  categoryLevel?: number | null
  /** Nombre del nivel (p. ej. «Primer bocado»), para el texto de los packs. */
  categoryName?: string | null
  categoryTranslations?: Translations<CategoryTranslation>
  translations?: Translations<ProductTranslation>
}

export type Promotion = {
  id: string
  code: string
  description: string | null
  kind: 'percent' | 'fixed'
  value: number
  minSubtotalCents: number
  startsAt: string | null
  endsAt: string | null
  maxRedemptions: number | null
  timesRedeemed: number
  isActive: boolean
}

export type ShippingAddress = {
  fullName: string
  phone?: string | null
  line1: string
  line2?: string | null
  city: string
  province: string
  postalCode: string
  country: string
}

export type OrderStatus = 'pending' | 'paid' | 'cancelled' | 'expired' | 'refunded' | 'requires_review'
export type FulfillmentStatus = 'unfulfilled' | 'preparing' | 'shipped' | 'delivered' | 'returned'

export type OrderItem = {
  id: string
  productId: string | null
  variantId: string | null
  productName: string
  productSlug: string | null
  variantName: string
  sku: string
  imageUrl: string | null
  unitPriceCents: number
  quantity: number
  taxRateBps: number
  lineTotalCents: number
}

export type Order = {
  id: string
  number: number
  userId: string | null
  email: string
  customerName: string
  phone: string | null
  shippingAddress: ShippingAddress
  status: OrderStatus
  fulfillmentStatus: FulfillmentStatus
  subtotalCents: number
  discountCents: number
  shippingCents: number
  taxCents: number
  totalCents: number
  promotionCode: string | null
  stripeCheckoutSessionId: string | null
  stripePaymentIntentId: string | null
  trackingCarrier: string | null
  trackingNumber: string | null
  trackingUrl: string | null
  adminNotes: string | null
  /** Regalo: sin precios en el paquete y, si lo hay, con mensaje en la tarjeta. */
  isGift: boolean
  giftMessage: string | null
  /** Idioma en el que compró (para los emails). */
  locale: 'es' | 'en'
  shippedAt: string | null
  deliveredAt: string | null
  reviewRequestedAt: string | null
  paidAt: string | null
  createdAt: string
  expiresAt: string
  items: OrderItem[]
}

export type Address = ShippingAddress & {
  id: string
  label: string | null
  isDefault: boolean
}
