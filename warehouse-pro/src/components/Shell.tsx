import { ArrowLeftRight, BarChart3, Boxes, ClipboardList, History, LayoutDashboard, Map, Menu, PackageCheck, PackageOpen, RotateCcw, Settings, Truck, Warehouse, X, Save, Search } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { navigate, type Page } from '@/lib/router'
import { cx, timeAgo } from '@/lib/format'
import { useWarehouse } from '@/store/useWarehouse'
import { GlobalSearch } from './GlobalSearch'
import { LANGS, t, useI18n } from '@/lib/i18n'

export const NAV: { id: Page; label: string; icon: ReactNode; key: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4.5 w-4.5" />, key: '1' },
  { id: 'mapa', label: 'Mapa del almacén', icon: <Map className="h-4.5 w-4.5" />, key: '2' },
  { id: 'inventario', label: 'Inventario', icon: <Boxes className="h-4.5 w-4.5" />, key: '3' },
  { id: 'recepcion', label: 'Recepción de mercancía', icon: <PackageOpen className="h-4.5 w-4.5" />, key: '4' },
  { id: 'ubicaciones', label: 'Ubicaciones y estanterías', icon: <Warehouse className="h-4.5 w-4.5" />, key: '5' },
  { id: 'pedidos', label: 'Preparación de pedidos', icon: <ClipboardList className="h-4.5 w-4.5" />, key: '6' },
  { id: 'expediciones', label: 'Expediciones', icon: <Truck className="h-4.5 w-4.5" />, key: '7' },
  { id: 'transferencias', label: 'Transferencias internas', icon: <ArrowLeftRight className="h-4.5 w-4.5" />, key: '8' },
  { id: 'devoluciones', label: 'Devoluciones', icon: <RotateCcw className="h-4.5 w-4.5" />, key: '9' },
  { id: 'historial', label: 'Historial de movimientos', icon: <History className="h-4.5 w-4.5" />, key: '0' },
  { id: 'informes', label: 'Informes y estadísticas', icon: <BarChart3 className="h-4.5 w-4.5" />, key: '' },
  { id: 'configuracion', label: 'Configuración', icon: <Settings className="h-4.5 w-4.5" />, key: '' },
]

export function Shell({ page, children }: { page: Page; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const saving = useWarehouse((s) => s.saving)
  const lastSavedAt = useWarehouse((s) => s.lastSavedAt)
  const repoKind = useWarehouse((s) => s.repoKind)
  const state = useWarehouse((s) => s.state)
  const lang = useI18n((s) => s.lang)
  const setLang = useI18n((s) => s.setLang)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen(true); return }
      if (typing) return
      if (e.key === '/') { e.preventDefault(); setSearchOpen(true); return }
      if (e.altKey) {
        const item = NAV.find((n) => n.key && n.key === e.key)
        if (item) { e.preventDefault(); navigate(item.id) }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const current = NAV.find((n) => n.id === page)
  const pendingOrders = state ? Object.values(state.orders).filter((o) => ['pendiente', 'en_preparacion', 'parcialmente_preparado'].includes(o.status)).length : 0
  const pendingReceipts = state ? Object.values(state.receipts).filter((r) => ['pendiente', 'en_recepcion', 'control_calidad'].includes(r.status)).length : 0
  const pendingReturns = state ? Object.values(state.returns).filter((r) => r.status === 'registrada').length : 0
  const readyShip = state ? Object.values(state.orders).filter((o) => o.status === 'preparado').length + Object.values(state.shipments).filter((s) => s.status === 'pendiente').length : 0
  const counts: Partial<Record<Page, number>> = { pedidos: pendingOrders, recepcion: pendingReceipts, devoluciones: pendingReturns, expediciones: readyShip }

  const sidebar = (
    <nav className="flex h-full flex-col bg-navy-950 text-slate-300">
      <div className="flex items-center gap-3 px-4 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white p-1.5 shadow"><img src="./logo.svg" alt="" className="h-full w-full" /></div>
        <div className="min-w-0">
          <div className="truncate text-base font-extrabold tracking-[0.2em] text-white">BETO</div>
          <div className="truncate text-[11px] text-slate-400">{t('Gestión de almacén')} · {state?.settings.warehouseName?.replace(/^BETO S\.L\.\s*·\s*/, '') ?? ''}</div>
        </div>
        <button className="ml-auto rounded p-1 text-slate-400 hover:text-white lg:hidden" onClick={() => setOpen(false)} aria-label={t("Cerrar menú")}><X className="h-5 w-5" /></button>
      </div>
      <ul className="flex-1 space-y-0.5 overflow-y-auto px-2 py-1">
        {NAV.map((n) => (
          <li key={n.id}>
            <a href={`#/${n.id}`} onClick={() => setOpen(false)} className={cx('group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all', page === n.id ? 'bg-electric-600 text-white shadow-md shadow-electric-600/30' : 'hover:bg-navy-800 hover:text-white')}>
              <span className={cx('transition-transform group-hover:scale-110', page === n.id && 'text-white')}>{n.icon}</span>
              <span className="flex-1 truncate">{t(n.label)}</span>
              {counts[n.id] ? <span className={cx('rounded-full px-1.5 text-[10px] font-bold', page === n.id ? 'bg-white/20 text-white' : 'bg-warn-500 text-white')}>{counts[n.id]}</span> : null}
              {n.key && <span className="hidden text-[10px] text-slate-500 group-hover:inline">Alt+{n.key}</span>}
            </a>
          </li>
        ))}
      </ul>
      <div className="border-t border-navy-800 px-4 py-3 text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5"><Save className={cx('h-3.5 w-3.5', saving ? 'animate-pulse text-warn-500' : 'text-ok-500')} />{saving ? t('Guardando…') : lastSavedAt ? `${t('Guardado')} ${timeAgo(lastSavedAt)}` : t('Sin cambios')}</div>
        <div className="mt-0.5">{t('Persistencia local')}: {repoKind}</div>
        {state?.demo && <div className="mt-1 inline-block rounded bg-yellow-500/20 px-1.5 py-0.5 font-semibold text-yellow-300">{t('Datos de demostración')}</div>}
      </div>
    </nav>
  )

  return (
    <div className="flex h-full min-h-screen">
      <aside className="hidden w-64 shrink-0 lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-navy-950/60 animate-fade-in" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 animate-slide-in-right">{sidebar}</aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur">
          <button className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)} aria-label={t("Abrir menú")}><Menu className="h-5 w-5" /></button>
          <div className="flex items-center gap-2 text-sm text-slate-500"><span className="text-electric-600">{current?.icon}</span><span className="font-semibold text-slate-800">{current && t(current.label)}</span></div>
          <button onClick={() => setSearchOpen(true)} className="ml-auto flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 transition hover:border-slate-300 hover:bg-white">
            <Search className="h-4 w-4" /><span className="hidden sm:inline">{t('Buscar SKU, ubicación, pedido…')}</span><span className="kbd ml-1 hidden sm:inline-flex">Ctrl K</span>
          </button>
          <select aria-label={t('Idioma')} value={lang} onChange={(e) => setLang(e.target.value as typeof lang)} className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-2 text-sm text-slate-700 hover:border-slate-300">
            {LANGS.map((l) => <option key={l.id} value={l.id}>{l.flag} {l.label}</option>)}
          </select>
          <div className="hidden items-center gap-2 text-xs text-slate-500 md:flex"><PackageCheck className="h-4 w-4 text-ok-500" />{state?.settings.currentUser}</div>
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}
