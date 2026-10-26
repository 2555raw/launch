import { moderateReview } from '@/app/actions/admin'
import { AdminHeader } from '@/components/admin/ui'
import { StarIcon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const metadata = { title: 'Opiniones' }

const statusLabel: Record<string, string> = { pending: 'Pendiente', approved: 'Publicada', rejected: 'Rechazada' }

export default async function ReviewsAdminPage() {
  const supabase = await createSupabaseServerClient()
  const { data: reviews } = await supabase
    .from('reviews')
    .select('*, product:products(name, slug)')
    .order('status', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <>
      <AdminHeader title="Opiniones" description="Solo compradores verificados pueden opinar. Nada se publica sin tu aprobación." />
      {(reviews ?? []).length === 0 ? (
        <p className="rounded-[22px] bg-white p-8 text-center text-sm text-ash-ink shadow-card">Todavía no hay opiniones.</p>
      ) : (
        <ul className="space-y-4">
          {(reviews ?? []).map((r) => (
            <li key={r.id} className="rounded-[22px] bg-white p-5 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex text-chef" aria-label={`${r.rating} de 5`}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <StarIcon key={i} size={14} filled={i < r.rating} />
                    ))}
                  </span>
                  <span className="text-sm font-medium">{r.product?.name}</span>
                </div>
                <span
                  className={cn(
                    'rounded-full px-2.5 py-1 text-xs font-medium',
                    r.status === 'approved' ? 'bg-hoja/15 text-hoja-deep' : r.status === 'pending' ? 'bg-almendra text-teja' : 'bg-mist text-ash-ink',
                  )}
                >
                  {statusLabel[r.status]}
                </span>
              </div>
              {r.title && <p className="mt-3 font-semibold">{r.title}</p>}
              <p className="mt-1 text-sm text-ink/80">{r.body}</p>
              <p className="mt-2 text-xs text-ash-ink">
                {r.author_name} · {r.is_verified ? 'compra verificada' : 'sin compra verificada'} · {new Date(r.created_at).toLocaleDateString('es-ES')}
              </p>
              <div className="mt-4 flex gap-2">
                {(['approved', 'rejected', 'delete'] as const).map((intent) => (
                  <form key={intent} action={moderateReview}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="intent" value={intent} />
                    <button
                      disabled={r.status === intent}
                      className={cn(
                        'rounded-full px-3 py-1.5 text-xs font-medium disabled:opacity-40',
                        intent === 'approved' ? 'bg-ink text-white' : 'bg-mist text-ink hover:bg-line',
                      )}
                    >
                      {intent === 'approved' ? 'Publicar' : intent === 'rejected' ? 'Rechazar' : 'Borrar'}
                    </button>
                  </form>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
