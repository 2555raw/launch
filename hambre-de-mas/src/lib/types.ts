// Tipos de dominio compartidos entre servidor y cliente.

export type Accent = 'chef' | 'teja' | 'hoja' | 'almendra'

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
  category: Pick<Category, 'slug' | 'name' | 'level' | 'accent'> | null
  image: ProductImage | null
  hoverImage: ProductImage | null
  variantCount: number
}

export type ProductDetail = ProductSummary & {
  description: string
  includes: string[]
  specs: { label: string; value: string }[]
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
  difficulty?: number[]
  maxMinutes?: number
  inStock?: boolean
  featured?: boolean
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
