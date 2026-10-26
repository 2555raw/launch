import Link from 'next/link'
import { ProductForm } from '@/components/admin/product-form'
import { AdminHeader } from '@/components/admin/ui'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const metadata = { title: 'Nuevo producto' }

export default async function NewProductPage() {
  const supabase = await createSupabaseServerClient()
  const { data: categories } = await supabase.from('categories').select('id, name').order('position')
  return (
    <>
      <Link href="/admin/productos" className="text-sm text-teja hover:underline">
        ← Productos
      </Link>
      <AdminHeader title="Nuevo producto" description="Guárdalo como borrador y añade las fotos antes de publicarlo." />
      <ProductForm categories={categories ?? []} />
    </>
  )
}
