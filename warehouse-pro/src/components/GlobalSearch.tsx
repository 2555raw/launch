import { Boxes, ClipboardList, MapPin, PackageOpen, Truck } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Modal } from './ui'
import { useWarehouse } from '@/store/useWarehouse'
import { navigate } from '@/lib/router'
import { Input } from './ui'
import { t } from '@/lib/i18n'

export function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const state = useWarehouse((s) => s.state)
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { if (open) { setQ(''); setIdx(0); setTimeout(() => ref.current?.focus(), 30) } }, [open])
  const results = useMemo(() => {
    if (!state || q.trim().length < 2) return []
    const needle = q.trim().toLowerCase()
    const out: { id: string; icon: React.ReactNode; title: string; sub: string; go: () => void }[] = []
    for (const p of Object.values(state.products)) if (p.sku.toLowerCase().includes(needle) || p.name.toLowerCase().includes(needle) || p.barcode.includes(needle)) out.push({ id: p.id, icon: <Boxes className="h-4 w-4" />, title: `${p.sku} · ${p.name}`, sub: t('Producto'), go: () => navigate('inventario', { producto: p.id }) })
    for (const l of Object.values(state.locations)) if (l.code.toLowerCase().includes(needle)) out.push({ id: l.id, icon: <MapPin className="h-4 w-4" />, title: l.code, sub: `${t('Ubicación')} · ${t(state.zones[l.zoneId]?.name ?? '')}`, go: () => navigate('mapa', { loc: l.id }) })
    for (const o of Object.values(state.orders)) if (o.number.toLowerCase().includes(needle) || o.customer.toLowerCase().includes(needle)) out.push({ id: o.id, icon: <ClipboardList className="h-4 w-4" />, title: `${o.number} · ${o.customer}`, sub: t('Pedido'), go: () => navigate('pedidos', { pedido: o.id }) })
    for (const r of Object.values(state.receipts)) if (r.number.toLowerCase().includes(needle) || r.supplier.toLowerCase().includes(needle)) out.push({ id: r.id, icon: <PackageOpen className="h-4 w-4" />, title: `${r.number} · ${r.supplier}`, sub: t('Recepción'), go: () => navigate('recepcion', { recepcion: r.id }) })
    for (const s of Object.values(state.shipments)) if (s.number.toLowerCase().includes(needle) || s.trackingRef.toLowerCase().includes(needle)) out.push({ id: s.id, icon: <Truck className="h-4 w-4" />, title: `${s.number} · ${s.recipient}`, sub: t('Expedición'), go: () => navigate('expediciones', { expedicion: s.id }) })
    return out.slice(0, 12)
  }, [q, state])
  return (
    <Modal open={open} onClose={onClose} title={t("Búsqueda rápida")} size="md">
      <Input ref={ref} value={q} onChange={(e) => { setQ(e.target.value); setIdx(0) }} placeholder={t("SKU, nombre, código de barras, ubicación, pedido, recepción…")} onKeyDown={(e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(results.length - 1, i + 1)) }
        if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)) }
        if (e.key === 'Enter' && results[idx]) { results[idx].go(); onClose() }
      }} />
      <ul className="mt-3 max-h-80 divide-y divide-slate-100 overflow-y-auto">
        {results.map((r, i) => (
          <li key={r.id}><button onClick={() => { r.go(); onClose() }} className={`flex w-full items-center gap-3 px-2 py-2 text-left text-sm transition ${i === idx ? 'bg-electric-100/60' : 'hover:bg-slate-50'}`}><span className="text-electric-600">{r.icon}</span><span className="flex-1 truncate font-medium text-slate-800">{r.title}</span><span className="text-xs text-slate-400">{r.sub}</span></button></li>
        ))}
        {q.length >= 2 && results.length === 0 && <li className="px-2 py-6 text-center text-sm text-slate-400">{t('Sin coincidencias para')} «{q}»</li>}
        {q.length < 2 && <li className="px-2 py-6 text-center text-xs text-slate-400">{t('Escribe al menos 2 caracteres. Navega con ↑ ↓ y abre con Intro.')}</li>}
      </ul>
    </Modal>
  )
}
