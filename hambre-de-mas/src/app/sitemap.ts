import type { MetadataRoute } from 'next'
import { legalPages } from '@/components/legal/legal-content'
import { getCatalog } from '@/lib/catalog'
import { site } from '@/lib/config/site'

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { products, categories } = await getCatalog().listSitemapEntries()
  const now = new Date()
  return [
    { url: site.url, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${site.url}/tienda`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    ...categories.map((slug) => ({ url: `${site.url}/categoria/${slug}`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.8 })),
    ...products.map((p) => ({ url: `${site.url}/producto/${p.slug}`, lastModified: new Date(p.updatedAt), changeFrequency: 'weekly' as const, priority: 0.7 })),
    { url: `${site.url}/test-nivel`, changeFrequency: 'monthly' as const, priority: 0.6 },
    { url: `${site.url}/comparar`, changeFrequency: 'weekly' as const, priority: 0.5 },
    { url: `${site.url}/preguntas-frecuentes`, changeFrequency: 'monthly' as const, priority: 0.5 },
    { url: `${site.url}/quienes-somos`, changeFrequency: 'yearly' as const, priority: 0.4 },
    { url: `${site.url}/contacto`, changeFrequency: 'yearly' as const, priority: 0.3 },
    ...Object.keys(legalPages).map((slug) => ({ url: `${site.url}/legal/${slug}`, changeFrequency: 'yearly' as const, priority: 0.2 })),
  ]
}
