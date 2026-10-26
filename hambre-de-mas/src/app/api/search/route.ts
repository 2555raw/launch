import { NextResponse, type NextRequest } from 'next/server'
import { getCatalog } from '@/lib/catalog'

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.slice(0, 80) ?? ''
  if (q.trim().length < 2) return NextResponse.json({ results: [] })
  const { items } = await getCatalog().listProducts({ q, limit: 6, sort: 'popular' })
  return NextResponse.json(
    {
      results: items.map((p) => ({
        slug: p.slug,
        name: p.name,
        subtitle: p.subtitle,
        priceCents: p.priceCents,
        imageUrl: p.image?.url ?? null,
      })),
    },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
  )
}
