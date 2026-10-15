import { AlertTriangle, CheckCircle2, Info, Inbox, Loader2, X, XCircle, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode, type SelectHTMLAttributes, type InputHTMLAttributes, type TextareaHTMLAttributes, type ButtonHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import { cx } from '@/lib/format'
import type { Tone } from '@/lib/labels'
import { useWarehouse } from '@/store/useWarehouse'
import { t } from '@/lib/i18n'

// ---------- Botones ----------
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline'
export function Button({ variant = 'primary', size = 'md', icon, loading, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; icon?: ReactNode; loading?: boolean }) {
  const base = 'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-electric-500/40 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] whitespace-nowrap'
  const sizes = { sm: 'h-8 px-2.5 text-xs', md: 'h-9 px-3.5 text-sm', lg: 'h-11 px-5 text-base' }
  const variants: Record<Variant, string> = {
    primary: 'bg-electric-600 text-white shadow-sm hover:bg-electric-500',
    secondary: 'bg-navy-800 text-white shadow-sm hover:bg-navy-700',
    ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
    outline: 'border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50',
    danger: 'bg-danger-600 text-white shadow-sm hover:bg-danger-500',
    success: 'bg-ok-600 text-white shadow-sm hover:bg-ok-500',
  }
  return (
    <button className={cx(base, sizes[size], variants[variant], className)} {...rest} disabled={rest.disabled || loading}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  )
}

// ---------- Badge ----------
const toneClass: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  blue: 'bg-electric-100 text-electric-600 ring-electric-400/30',
  green: 'bg-ok-100 text-ok-600 ring-ok-500/30',
  orange: 'bg-warn-100 text-warn-600 ring-warn-500/30',
  yellow: 'bg-yellow-100 text-yellow-800 ring-yellow-500/30',
  red: 'bg-danger-100 text-danger-600 ring-danger-500/30',
  navy: 'bg-navy-800 text-white ring-navy-900/40',
  purple: 'bg-violet-100 text-violet-700 ring-violet-400/30',
}
export function Badge({ tone = 'neutral', children, dot, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset whitespace-nowrap', toneClass[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

// ---------- Card / KPI ----------
export function Card({ title, subtitle, actions, children, className, bodyClass }: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={cx('card animate-fade-in overflow-hidden', className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div>
            {title && <h3 className="text-sm font-semibold text-slate-800">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cx('p-4', bodyClass)}>{children}</div>
    </section>
  )
}

export function Kpi({ label, value, hint, icon, tone = 'blue', onClick }: { label: string; value: ReactNode; hint?: ReactNode; icon: ReactNode; tone?: Tone; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag onClick={onClick} className={cx('card animate-slide-up flex items-center gap-3 p-4 text-left', onClick && 'cursor-pointer transition-transform hover:-translate-y-0.5 hover:shadow-md')}>
      <div className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-lg', toneClass[tone])}>{icon}</div>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label ?? t('Cargando…')}</div>
        <div className="text-2xl font-bold tabular-nums text-slate-900">{value}</div>
        {hint && <div className="truncate text-xs text-slate-500">{hint}</div>}
      </div>
    </Tag>
  )
}

// ---------- Formularios ----------
export function Field({ label, error, hint, children, className }: { label: string; error?: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="label">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-danger-600 animate-shake">{error}</span> : hint ? <span className="mt-1 block text-xs text-slate-400">{hint}</span> : null}
    </label>
  )
}
export function Input({ className, ref, ...rest }: InputHTMLAttributes<HTMLInputElement> & { ref?: React.Ref<HTMLInputElement> }) {
  return <input ref={ref} className={cx('input', className)} {...rest} />
}
export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx('input min-h-20 py-2', className)} {...rest} />
}
export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx('input appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%2364748b%27 stroke-width=%272.5%27%3E%3Cpath d=%27m6 9 6 6 6-6%27/%3E%3C/svg%3E")] bg-[length:12px] bg-[right_10px_center] bg-no-repeat pr-8', className)} {...rest}>{children}</select>
}

// ---------- Modal ----------
export function Modal({ open, onClose, title, children, footer, size = 'md' }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/50 p-0 backdrop-blur-[2px] animate-fade-in sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" className={cx('card flex max-h-[92vh] w-full flex-col animate-slide-up rounded-b-none sm:rounded-b-xl', widths[size])}>
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={t("Cerrar")}><X className="h-5 w-5" /></button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel, danger, children }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; message?: ReactNode; confirmLabel?: string; danger?: boolean; children?: ReactNode }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm" footer={<><Button variant="outline" onClick={onClose}>{t('Cancelar')}</Button><Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} autoFocus>{confirmLabel ?? t('Confirmar')}</Button></>}>
      {message && <p className="text-sm text-slate-600">{message}</p>}
      {children}
    </Modal>
  )
}

// ---------- Estado vacío / carga ----------
export function EmptyState({ title, description, action, icon }: { title: string; description?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center animate-fade-in">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">{icon ?? <Inbox className="h-6 w-6" />}</div>
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {description && <p className="max-w-sm text-xs text-slate-500">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

// ---------- Toasts ----------
export function Toasts() {
  const toasts = useWarehouse((s) => s.toasts)
  const dismiss = useWarehouse((s) => s.dismissToast)
  const icons = { success: <CheckCircle2 className="h-5 w-5 text-ok-500" />, error: <XCircle className="h-5 w-5 text-danger-500" />, info: <Info className="h-5 w-5 text-electric-500" />, warning: <AlertTriangle className="h-5 w-5 text-warn-500" /> }
  return createPortal(
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(92vw,380px)] flex-col gap-2">
      {toasts.map((toast) => (
        <div key={toast.id} role="status" className="card pointer-events-auto flex items-start gap-3 p-3 shadow-lg animate-slide-in-right">
          {icons[toast.kind]}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-800">{toast.title}</p>
            {toast.message && <p className="text-xs text-slate-600">{toast.message}</p>}
          </div>
          <button onClick={() => dismiss(toast.id)} className="text-slate-400 hover:text-slate-700" aria-label={t("Cerrar aviso")}><X className="h-4 w-4" /></button>
        </div>
      ))}
    </div>,
    document.body,
  )
}

// ---------- Tooltip ----------
export function Tooltip({ text, children }: { text: string; children: ReactNode }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-navy-950 px-2 py-1 text-[11px] text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">{text}</span>
    </span>
  )
}

// ---------- Tabs ----------
export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)} className={cx('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all', value === t.id ? 'bg-white text-navy-800 shadow-sm' : 'text-slate-500 hover:text-slate-800')}>
          {t.label}
          {t.count !== undefined && <span className={cx('rounded-full px-1.5 text-[10px]', value === t.id ? 'bg-electric-100 text-electric-600' : 'bg-slate-200 text-slate-600')}>{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

// ---------- Progreso ----------
export function Progress({ value, tone = 'blue', className }: { value: number; tone?: 'blue' | 'green' | 'orange' | 'red' | 'navy'; className?: string }) {
  const colors = { blue: 'bg-electric-500', green: 'bg-ok-500', orange: 'bg-warn-500', red: 'bg-danger-500', navy: 'bg-navy-800' }
  return (
    <div className={cx('h-2 w-full overflow-hidden rounded-full bg-slate-200', className)}>
      <div className={cx('h-full rounded-full transition-[width] duration-500 ease-out', colors[tone])} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  )
}

// ---------- Tabla con ordenación y paginación ----------
export interface Column<T> { key: string; header: string; render?: (row: T) => ReactNode; sort?: (row: T) => string | number; className?: string; width?: string }

export function DataTable<T>({ rows, columns, rowKey, pageSize = 15, emptyTitle, emptyDescription, onRowClick, dense, initialSort }: { rows: T[]; columns: Column<T>[]; rowKey: (row: T) => string; pageSize?: number; emptyTitle?: string; emptyDescription?: string; onRowClick?: (row: T) => void; dense?: boolean; initialSort?: { key: string; dir: 'asc' | 'desc' } }) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(initialSort ?? null)
  const [page, setPage] = useState(0)
  const sorted = useMemo(() => {
    if (!sort) return rows
    const col = columns.find((c) => c.key === sort.key)
    if (!col?.sort) return rows
    const s = col.sort
    return [...rows].sort((a, b) => {
      const va = s(a), vb = s(b)
      const r = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'es')
      return sort.dir === 'asc' ? r : -r
    })
  }, [rows, sort, columns])
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(page, pages - 1)
  const visible = sorted.slice(safePage * pageSize, (safePage + 1) * pageSize)
  const prevLen = useRef(rows.length)
  useEffect(() => { if (prevLen.current !== rows.length) { setPage(0); prevLen.current = rows.length } }, [rows.length])
  const toggle = (key: string) => setSort((s) => (s?.key === key ? (s.dir === 'asc' ? { key, dir: 'desc' } : null) : { key, dir: 'asc' }))
  return (
    <div className="flex flex-col">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={cx('th', c.sort && 'cursor-pointer hover:text-slate-800', c.className)} style={{ width: c.width }} onClick={() => c.sort && toggle(c.key)} aria-sort={sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                  <span className="inline-flex items-center gap-1">{c.header}{c.sort && (sort?.key === c.key ? (sort.dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={rowKey(row)} className={cx('tr-hover', onRowClick && 'cursor-pointer')} onClick={() => onRowClick?.(row)}>
                {columns.map((c) => <td key={c.key} className={cx('td', dense && 'py-1.5', c.className)}>{c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '')}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <EmptyState title={emptyTitle ?? t('Sin resultados')} description={emptyDescription} />}
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
          <span>{sorted.length} {t('registros')} · {t('página')} {safePage + 1} {t('de')} {pages}</span>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={safePage === 0} icon={<ChevronLeft className="h-4 w-4" />} aria-label={t("Página anterior")} />
            <Button size="sm" variant="ghost" onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={safePage >= pages - 1} icon={<ChevronRight className="h-4 w-4" />} aria-label={t("Página siguiente")} />
          </div>
        </div>
      )}
    </div>
  )
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-navy-900 sm:text-2xl">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Spinner({ label }: { label?: string }) {
  return <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin text-electric-500" />{label ?? t('Cargando…')}</div>
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: Tone }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label ?? t('Cargando…')}</div>
      <div className={cx('text-base font-bold tabular-nums', tone === 'red' ? 'text-danger-600' : tone === 'green' ? 'text-ok-600' : tone === 'orange' ? 'text-warn-600' : 'text-slate-900')}>{value}</div>
    </div>
  )
}
