import { cn } from '@/lib/cn'

export function AdminHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-ash-ink">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Card({ title, children, className, actions }: { title?: string; children: React.ReactNode; className?: string; actions?: React.ReactNode }) {
  return (
    <section className={cn('rounded-[22px] bg-white p-5 shadow-card ring-1 ring-black/[0.03] sm:p-6', className)}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-[15px] font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  )
}

export function Stat({ label, value, hint, tone = 'ink' }: { label: string; value: string; hint?: string; tone?: 'ink' | 'teja' | 'hoja' }) {
  return (
    <div className="rounded-[22px] bg-white p-5 shadow-card ring-1 ring-black/[0.03]">
      <p className="text-xs text-ash-ink">{label}</p>
      <p className={cn('mt-1 font-display text-2xl font-extrabold tabular-nums', tone === 'teja' && 'text-teja', tone === 'hoja' && 'text-hoja-ink')}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ash-ink">{hint}</p>}
    </div>
  )
}

export const table = {
  wrap: 'overflow-x-auto rounded-[22px] bg-white shadow-card ring-1 ring-black/[0.03]',
  table: 'w-full min-w-[640px] text-left text-sm',
  th: 'border-b border-line px-4 py-3 text-xs font-medium text-ash-ink',
  td: 'border-b border-line px-4 py-3 align-middle',
}

export const field =
  'h-10 w-full rounded-lg border border-line-strong bg-white px-3 text-sm focus:border-ink focus:outline-none aria-[invalid=true]:border-teja'

export function Label({ children, className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn('block text-xs font-medium text-ink/80', className)} {...props}>
      {children}
    </label>
  )
}

export function Notice({ state }: { state: { ok?: boolean; message?: string } | null }) {
  if (!state?.message) return null
  return (
    <p className={cn('rounded-xl px-3 py-2 text-sm', state.ok ? 'bg-hoja/15 text-hoja-deep' : 'bg-almendra-soft text-teja')} role={state.ok ? 'status' : 'alert'}>
      {state.message}
    </p>
  )
}
