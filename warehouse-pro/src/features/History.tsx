import { Download, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge, Button, Card, DataTable, Input, PageHeader, Select, type Column } from '@/components/ui'
import { movementsSorted, values, type Movement } from '@/domain'
import { useState$, useWarehouse } from '@/store/useWarehouse'
import { t } from '@/lib/i18n'
import { fmtDateTime, fmtInt, daysAgo } from '@/lib/format'
import { MOVEMENT_TYPE } from '@/lib/labels'
import { downloadCsv, toCsv } from '@/lib/csv'
import { navigate } from '@/lib/router'
import { dayKey } from '@/lib/analytics'

export function HistoryPage({ params }: { params: Record<string, string> }) {
  const state = useState$()
  const notify = useWarehouse((s) => s.notify)
  const [from, setFrom] = useState(params.desde ?? daysAgo(30))
  const [to, setTo] = useState(params.hasta ?? '')
  const [type, setType] = useState(params.tipo ?? '')
  const [sku, setSku] = useState(params.sku ?? '')
  const [loc, setLoc] = useState(params.ubicacion ? state.locations[params.ubicacion]?.code ?? '' : '')
  const [ref, setRef] = useState(params.ref ?? '')
  const [result, setResult] = useState('')
  const rows = useMemo(() => movementsSorted(state).filter((m) => {
    const d = dayKey(m.timestamp)
    if (from && d < from) return false
    if (to && d > to) return false
    if (type && m.type !== type) return false
    if (sku && !m.sku.toLowerCase().includes(sku.toLowerCase())) return false
    if (loc) { const l = loc.toUpperCase(); const f = m.fromLocationId ? state.locations[m.fromLocationId]?.code ?? '' : ''; const tt = m.toLocationId ? state.locations[m.toLocationId]?.code ?? '' : ''; if (!f.includes(l) && !tt.includes(l)) return false }
    if (ref && !m.reference.toLowerCase().includes(ref.toLowerCase())) return false
    if (result && m.result !== result) return false
    return true
  }), [state, from, to, type, sku, loc, ref, result])
  const columns: Column<Movement>[] = [
    { key: 'id', header: 'ID', render: (m) => <span className="font-mono text-[10px] text-slate-400">{m.id.slice(-8)}</span> },
    { key: 'ts', header: t('Fecha y hora'), sort: (m) => m.timestamp, render: (m) => <span className="whitespace-nowrap text-xs">{fmtDateTime(m.timestamp)}</span> },
    { key: 'type', header: t('Operación'), sort: (m) => m.type, render: (m) => <Badge tone={MOVEMENT_TYPE[m.type].tone}>{t(MOVEMENT_TYPE[m.type].label)}</Badge> },
    { key: 'sku', header: 'SKU', sort: (m) => m.sku, render: (m) => m.productId ? <button onClick={() => navigate('inventario', { producto: m.productId! })} className="font-mono text-xs font-semibold hover:underline">{m.sku}</button> : <span className="text-xs text-slate-400">—</span> },
    { key: 'qty', header: t('Cantidad'), sort: (m) => m.quantity, className: 'text-right tabular-nums font-semibold', render: (m) => m.quantity ? fmtInt(m.quantity) : '' },
    { key: 'from', header: t('Origen'), render: (m) => m.fromLocationId ? <button onClick={() => navigate('mapa', { loc: m.fromLocationId! })} className="font-mono text-xs hover:underline">{state.locations[m.fromLocationId]?.code ?? m.fromLocationId}</button> : <span className="text-slate-300">—</span> },
    { key: 'to', header: t('Destino'), render: (m) => m.toLocationId ? <button onClick={() => navigate('mapa', { loc: m.toLocationId! })} className="font-mono text-xs hover:underline">{state.locations[m.toLocationId]?.code ?? m.toLocationId}</button> : <span className="text-slate-300">—</span> },
    { key: 'ref', header: t('Referencia'), sort: (m) => m.reference, render: (m) => <span className="font-mono text-xs">{m.reference}</span> },
    { key: 'user', header: t('Usuario'), render: (m) => <span className="text-xs">{m.user}</span> },
    { key: 'result', header: t('Resultado'), render: (m) => <Badge tone={m.result === 'ok' ? 'green' : 'red'}>{m.result === 'ok' ? t('Correcto') : t('Error')}</Badge> },
    { key: 'notes', header: t('Observaciones'), render: (m) => <span className="block max-w-xs truncate text-xs text-slate-500" title={m.notes}>{m.notes}</span> },
  ]
  const exportCsv = () => {
    downloadCsv(`movimientos_${from || 'inicio'}_${to || 'hoy'}.csv`, toCsv(rows.map((m) => ({ id: m.id, fecha_hora: m.timestamp, tipo: m.type, sku: m.sku, cantidad: m.quantity, origen: m.fromLocationId ? state.locations[m.fromLocationId]?.code : '', destino: m.toLocationId ? state.locations[m.toLocationId]?.code : '', referencia: m.reference, usuario: m.user, resultado: m.result, observaciones: m.notes }))))
    notify('success', t('Historial exportado'), t('{n} movimientos', { n: rows.length }))
  }
  return (
    <div className="space-y-4">
      <PageHeader title={t('Historial de movimientos')} description={t('Registro inmutable: los movimientos confirmados no se editan; las correcciones se documentan como ajustes')} actions={<Button variant="outline" icon={<Download className="h-4 w-4" />} onClick={exportCsv} disabled={!rows.length}>{t('Exportar CSV')}</Button>} />
      <Card bodyClass="p-0">
        <div className="grid grid-cols-2 gap-2 border-b border-slate-100 p-3 md:grid-cols-4 xl:grid-cols-8">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label={t('Desde')} />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label={t('Hasta')} />
          <Select value={type} onChange={(e) => setType(e.target.value)}><option value="">{t('Todos los tipos')}</option>{Object.entries(MOVEMENT_TYPE).map(([k, v]) => <option key={k} value={k}>{t(v.label)}</option>)}</Select>
          <div className="relative"><Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" /><Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="SKU" className="pl-8" /></div>
          <Input value={loc} onChange={(e) => setLoc(e.target.value)} placeholder={t('Ubicación')} className="font-mono" />
          <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder={t('Referencia (PED, REC, TRF…)')} />
          <Select value={result} onChange={(e) => setResult(e.target.value)}><option value="">{t('Cualquier resultado')}</option><option value="ok">{t('Correcto')}</option><option value="error">{t('Error')}</option></Select>
          <Button variant="ghost" onClick={() => { setFrom(''); setTo(''); setType(''); setSku(''); setLoc(''); setRef(''); setResult('') }}>{t('Limpiar filtros')}</Button>
        </div>
        <div className="border-b border-slate-100 px-3 py-1.5 text-xs text-slate-500">{t('{n} movimientos', { n: rows.length })} · {t('total de unidades')}: {fmtInt(rows.reduce((a, m) => a + m.quantity, 0))}</div>
        <DataTable rows={rows} columns={columns} rowKey={(m) => m.id} pageSize={25} dense emptyTitle={t('No hay movimientos en el periodo')} initialSort={{ key: 'ts', dir: 'desc' }} />
      </Card>
      <p className="text-xs text-slate-400">{t('Registros totales en el sistema')}: {fmtInt(values(state.movements).length)}</p>
    </div>
  )
}
