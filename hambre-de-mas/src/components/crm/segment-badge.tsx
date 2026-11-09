import { SEGMENTS } from '@/lib/crm/segments'
import type { Segment } from '@/lib/crm/types'
import { cn } from '@/lib/cn'

export function SegmentBadge({ segment, className }: { segment: Segment; className?: string }) {
  const s = SEGMENTS.find((x) => x.key === segment)!
  return <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap', s.tone, className)}>{s.label}</span>
}

/** «hoy», «ayer», «hace 5 días», «hace 3 meses». */
export function ago(iso: string | null, now = new Date()) {
  if (!iso) return '—'
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'hoy'
  if (days === 1) return 'ayer'
  if (days < 45) return `hace ${days} días`
  const months = Math.round(days / 30)
  return `hace ${months} ${months === 1 ? 'mes' : 'meses'}`
}
