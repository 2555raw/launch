import Link from 'next/link'
import { AdminHeader, table } from '@/components/admin/ui'
import { ButtonLink } from '@/components/ui/button'
import { ProductImage } from '@/components/ui/product-image'
import { cn } from '@/lib/cn'
import { formatPrice } from '@/lib/money'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const metadata = { title: 'Productos' }

const statusLabel: Record<string, string> = { draft: 'Borrador', published: 'Publicado', archived: 'Archivado' }

export default async function AdminProductsPage() {
  const supabase = await createSupabaseServerClient()
  const { data: products } = await supabase
    .from('products')
    .select('id, name, slug, status, price_cents, total_stock, sales_count, is_demo, is_featured, category:categories(name), images:product_images(url, position), variants:product_variants(id)')
    .order('created_at', { ascending: false })

  return (
    <>
      <AdminHeader
        title="Productos"
        description="Crea, edita y publica kits. Los marcados como demo vienen de los datos de ejemplo."
        actions={<ButtonLink href="/admin/productos/nuevo" size="sm">Nuevo producto</ButtonLink>}
      />
      <div className={table.wrap}>
        <table className={table.table}>
          <thead>
            <tr>
              <th className={table.th}>Producto</th>
              <th className={table.th}>Categoría</th>
              <th className={table.th}>Estado</th>
              <th className={table.th}>Desde</th>
              <th className={table.th}>Stock</th>
              <th className={table.th}>Vendidos</th>
            </tr>
          </thead>
          <tbody>
            {(products ?? []).map((p) => {
              const img = [...(p.images ?? [])].sort((a, b) => a.position - b.position)[0]
              return (
                <tr key={p.id} className="hover:bg-mist/60">
                  <td className={table.td}>
                    <Link href={`/admin/productos/${p.id}`} className="flex items-center gap-3 font-medium hover:text-teja">
                      <span className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-mist">
                        {img && <ProductImage src={img.url} alt="" fill sizes="40px" className="object-cover" />}
                      </span>
                      <span>
                        {p.name}
                        <span className="block text-xs font-normal text-ash-ink">
                          {p.variants?.length ?? 0} variantes{p.is_demo ? ' · demo' : ''}{p.is_featured ? ' · destacado' : ''}
                        </span>
                      </span>
                    </Link>
                  </td>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <td className={table.td}>{(p.category as any)?.name ?? '—'}</td>
                  <td className={table.td}>
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-1 text-xs font-medium',
                        p.status === 'published' ? 'bg-hoja/15 text-hoja-deep' : p.status === 'draft' ? 'bg-almendra text-teja' : 'bg-mist text-ash-ink',
                      )}
                    >
                      {statusLabel[p.status]}
                    </span>
                  </td>
                  <td className={`${table.td} tabular-nums`}>{formatPrice(p.price_cents)}</td>
                  <td className={cn(table.td, 'tabular-nums', p.total_stock <= 5 && 'font-semibold text-teja')}>{p.total_stock}</td>
                  <td className={`${table.td} tabular-nums`}>{p.sales_count}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
