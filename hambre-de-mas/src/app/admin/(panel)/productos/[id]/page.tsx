import Link from 'next/link'
import { notFound } from 'next/navigation'
import { deleteProduct } from '@/app/actions/admin'
import { ImageManager } from '@/components/admin/image-manager'
import { ProductForm } from '@/components/admin/product-form'
import { AdminHeader, Card } from '@/components/admin/ui'
import { Button } from '@/components/ui/button'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const metadata = { title: 'Editar producto' }

export default async function EditProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ creado?: string }> }) {
  const { id } = await params
  const { creado } = await searchParams
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const supabase = await createSupabaseServerClient()
  const [{ data: product }, { data: categories }] = await Promise.all([
    supabase.from('products').select('*, images:product_images(*), variants:product_variants(*)').eq('id', id).maybeSingle(),
    supabase.from('categories').select('id, name').order('position'),
  ])
  if (!product) notFound()
  const images = [...(product.images ?? [])].sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at))

  return (
    <>
      <Link href="/admin/productos" className="text-sm text-teja hover:underline">
        ← Productos
      </Link>
      <AdminHeader
        title={product.name}
        description={product.is_demo ? 'Producto de demostración: sustitúyelo por uno real o bórralo.' : `/producto/${product.slug}`}
        actions={
          product.status === 'published' ? (
            <Link href={`/producto/${product.slug}`} target="_blank" className="text-sm text-teja hover:underline">
              Ver en la tienda ↗
            </Link>
          ) : undefined
        }
      />
      {creado && <p className="mb-6 rounded-xl bg-hoja/15 px-4 py-3 text-sm text-hoja-deep">Producto creado. Ahora añade sus fotos.</p>}
      <div className="grid gap-6 2xl:grid-cols-[1.6fr_1fr]">
        <ProductForm categories={categories ?? []} product={product} />
        <div className="space-y-6">
          <Card title="Imágenes">
            <ImageManager productId={product.id} images={images} />
          </Card>
          <Card title="Zona peligrosa">
            <p className="mb-3 text-sm text-ash-ink">Si el producto tiene pedidos se archivará en lugar de borrarse, para conservar el historial.</p>
            <form action={deleteProduct}>
              <input type="hidden" name="id" value={product.id} />
              <Button variant="secondary" size="sm">Borrar o archivar producto</Button>
            </form>
          </Card>
        </div>
      </div>
    </>
  )
}
