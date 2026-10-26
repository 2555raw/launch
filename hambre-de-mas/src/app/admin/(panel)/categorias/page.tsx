import { deleteCategory } from '@/app/actions/admin'
import { CategoryForm } from '@/components/admin/category-form'
import { AdminHeader, Card } from '@/components/admin/ui'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const metadata = { title: 'Categorías' }

export default async function CategoriesPage() {
  const supabase = await createSupabaseServerClient()
  const { data: categories } = await supabase.from('categories').select('*, products(count)').order('position')
  return (
    <>
      <AdminHeader title="Categorías" description="Los niveles y colecciones de la tienda." />
      <div className="grid gap-6 2xl:grid-cols-2">
        {(categories ?? []).map((c) => (
          <Card key={c.id} title={`${c.name}${c.is_published ? '' : ' (oculta)'}`} actions={<span className="text-xs text-ash-ink">{c.products?.[0]?.count ?? 0} productos</span>}>
            <CategoryForm category={c} />
            <form action={deleteCategory} className="mt-3">
              <input type="hidden" name="id" value={c.id} />
              <button className="text-xs text-ash-ink hover:text-teja">Borrar categoría (sus productos quedarán sin categoría)</button>
            </form>
          </Card>
        ))}
        <Card title="Nueva categoría">
          <CategoryForm />
        </Card>
      </div>
    </>
  )
}
