import { CheckIcon } from '@/components/ui/icons'

const COLORS = ['bg-chef', 'bg-hoja-ink', 'bg-teja', 'bg-ambar', 'bg-ink']

/** Nombre de quien opina, con su inicial en un círculo y la marca de compra verificada. */
export function ReviewAuthor({ name, verifiedLabel, meta }: { name: string; verifiedLabel: string | null; meta?: React.ReactNode }) {
  const clean = name.trim() || '?'
  const color = COLORS[[...clean].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % COLORS.length]
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden className={`grid size-10 shrink-0 place-items-center rounded-full font-display text-[15px] font-bold text-white uppercase ${color}`}>
        {[...clean][0]}
      </span>
      <div className="min-w-0 text-[13px] leading-tight">
        <p className="truncate text-[15px] font-semibold text-ink">{clean}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-ash-ink">
          {verifiedLabel && (
            <span className="inline-flex items-center gap-1 font-medium text-hoja-ink">
              <CheckIcon size={13} strokeWidth={2.4} /> {verifiedLabel}
            </span>
          )}
          {meta}
        </p>
      </div>
    </div>
  )
}
