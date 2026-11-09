'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import { table } from '@/components/admin/ui'
import { SEGMENTS } from '@/lib/crm/segments'
import type { Segment } from '@/lib/crm/types'
import { cn } from '@/lib/cn'
import { formatPrice } from '@/lib/money'
import { ago, SegmentBadge } from './segment-badge'

export type CustomerRow = {
  id: string
  name: string
  email: string
  city: string | null
  segments: Segment[]
  orderCount: number
  spentCents: number
  lastOrder: string | null
  favoriteLevel: string | null
  tags: string[]
  openTasks: number
}

const SORTS = {
  gasto: { label: 'Más gasto', fn: (a: CustomerRow, b: CustomerRow) => b.spentCents - a.spentCents },
  reciente: { label: 'Compra más reciente', fn: (a: CustomerRow, b: CustomerRow) => (b.lastOrder ?? '').localeCompare(a.lastOrder ?? '') },
  pedidos: { label: 'Más pedidos', fn: (a: CustomerRow, b: CustomerRow) => b.orderCount - a.orderCount },
  nombre: { label: 'Nombre', fn: (a: CustomerRow, b: CustomerRow) => a.name.localeCompare(b.name, 'es') },
} as const

/** Lista de clientes con buscador, filtro por segmento (en la URL) y orden. */
export function CustomerTable({ rows }: { rows: CustomerRow[] }) {
  const router = useRouter()
  const params = useSearchParams()
  const segment = (params.get('segmento') as Segment | null) ?? null
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<keyof typeof SORTS>('gasto')

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return rows
      .filter((r) => !segment || r.segments.includes(segment))
      .filter((r) => !needle || [r.name, r.email, r.city ?? '', ...r.tags].some((v) => v.toLowerCase().includes(needle)))
      .sort(SORTS[sort].fn)
  }, [rows, q, sort, segment])

  const setSegment = (s: Segment | null) => router.replace(s ? `/crm?segmento=${s}` : '/crm', { scroll: false })

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, email, ciudad o etiqueta"
          aria-label="Buscar clientes"
          className="h-10 min-w-0 flex-1 rounded-full bg-white px-4 text-sm ring-1 ring-line focus:ring-2 focus:ring-ink focus:outline-none sm:max-w-sm"
        />
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setSegment(null)}
            className={cn('h-8 rounded-full px-3 text-xs font-semibold', !segment ? 'bg-ink text-white' : 'bg-white text-ink ring-1 ring-line hover:ring-ink')}
          >
            Todos
          </button>
          {SEGMENTS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSegment(segment === s.key ? null : s.key)}
              className={cn('h-8 rounded-full px-3 text-xs font-semibold', segment === s.key ? 'bg-ink text-white' : 'bg-white text-ink ring-1 ring-line hover:ring-ink')}
            >
              {s.label}
            </button>
          ))}
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as keyof typeof SORTS)}
          aria-label="Ordenar"
          className="ml-auto h-8 rounded-full bg-white px-3 text-xs font-semibold ring-1 ring-line"
        >
          {Object.entries(SORTS).map(([key, s]) => (
            <option key={key} value={key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className={table.wrap}>
        <table className={table.table}>
          <thead>
            <tr>
              <th className={table.th}>Cliente</th>
              <th className={table.th}>Segmento</th>
              <th className={cn(table.th, 'text-right')}>Pedidos</th>
              <th className={cn(table.th, 'text-right')}>Gastado</th>
              <th className={table.th}>Último pedido</th>
              <th className={table.th}>Nivel favorito</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className="cursor-pointer hover:bg-mist/60" onClick={() => router.push(`/crm/${r.id}`)}>
                <td className={table.td}>
                  <Link href={`/crm/${r.id}`} className="block font-medium hover:text-teja" onClick={(e) => e.stopPropagation()}>
                    {r.name}
                    {r.openTasks > 0 && (
                      <span className="ml-2 rounded-full bg-almendra px-1.5 py-0.5 text-[10px] font-semibold text-teja" title="Tareas pendientes">
                        {r.openTasks} {r.openTasks === 1 ? 'tarea' : 'tareas'}
                      </span>
                    )}
                  </Link>
                  <span className="block text-xs text-ash-ink">
                    {r.email}
                    {r.city ? ` · ${r.city}` : ''}
                  </span>
                </td>
                <td className={table.td}>
                  <span className="flex flex-wrap gap-1">
                    {r.segments.map((s) => (
                      <SegmentBadge key={s} segment={s} />
                    ))}
                  </span>
                </td>
                <td className={cn(table.td, 'text-right tabular-nums')}>{r.orderCount}</td>
                <td className={cn(table.td, 'text-right font-medium tabular-nums')}>{formatPrice(r.spentCents)}</td>
                <td className={cn(table.td, 'text-ash-ink')}>{ago(r.lastOrder)}</td>
                <td className={cn(table.td, 'text-ash-ink')}>{r.favoriteLevel ?? '—'}</td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={6} className={cn(table.td, 'py-10 text-center text-ash-ink')}>
                  No hay clientes con estos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-ash-ink">
        {shown.length} de {rows.length} clientes
      </p>
    </div>
  )
}
