import { Lock, LockOpen, Map as MapIcon, Plus, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge, Button, Card, ConfirmDialog, DataTable, Field, Input, Modal, PageHeader, Progress, Select, Stat, type Column } from '@/components/ui'
import { locationStatus, occupiedAt, ops, stockEntriesAt, values, warehouseOccupancy, type Location } from '@/domain'
import { useState$, useWarehouse } from '@/store/useWarehouse'
import { t } from '@/lib/i18n'
import { fmtInt, fmtPct } from '@/lib/format'
import { LOCATION_STATUS, SIZE, TEMPERATURE } from '@/lib/labels'
import { navigate } from '@/lib/router'

export function Locations({ params }: { params: Record<string, string> }) {
  const state = useState$()
  const dispatch = useWarehouse((s) => s.dispatch)
  const [q, setQ] = useState(params.q ?? '')
  const [zone, setZone] = useState('')
  const [status, setStatus] = useState(params.estado ?? '')
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ code: '', zoneId: 'Z-B', capacity: 100, maxWeightKg: 800, sizeClass: 'M', kind: 'estanteria' })
  const [editing, setEditing] = useState<Location | null>(null)
  const [edit, setEdit] = useState({ capacity: 0, maxWeightKg: 0, sizeClass: 'M' })
  const [blocking, setBlocking] = useState<Location | null>(null)
  const [blockReason, setBlockReason] = useState('')
  const [deleting, setDeleting] = useState<Location | null>(null)
  const occ = warehouseOccupancy(state)

  const rows = useMemo(() => {
    const needle = q.trim().toUpperCase()
    return values(state.locations).filter((l) => (!needle || l.code.includes(needle)) && (!zone || l.zoneId === zone) && (!status || locationStatus(state, l) === status)).sort((a, b) => a.code.localeCompare(b.code))
  }, [state, q, zone, status])

  const columns: Column<Location>[] = [
    { key: 'code', header: t('Código'), sort: (l) => l.code, render: (l) => <button onClick={(e) => { e.stopPropagation(); navigate('mapa', { loc: l.id }) }} className="font-mono text-xs font-bold text-navy-800 hover:underline">{l.code}</button> },
    { key: 'zone', header: t('Zona'), sort: (l) => l.zoneId, render: (l) => <span className="text-xs">{t(state.zones[l.zoneId]?.name ?? '')}</span> },
    { key: 'pos', header: t('Pasillo / módulo / nivel'), render: (l) => <span className="text-xs tabular-nums">{l.aisle ? `P${String(l.aisle).padStart(2, '0')}` : '—'} · {String(l.module).padStart(2, '0')} · N{l.level}</span> },
    { key: 'kind', header: t('Tipo'), render: (l) => <Badge tone="neutral">{t({ estanteria: 'Estantería', suelo: 'Suelo', muelle: 'Muelle', estacion: 'Estación' }[l.kind])}</Badge> },
    { key: 'cond', header: t('Condiciones'), render: (l) => <span className="text-xs text-slate-500">{t(TEMPERATURE[state.zones[l.zoneId]?.temperature ?? 'ambiente'].short)} · {l.sizeClass}{l.maxWeightKg ? ` · ${l.maxWeightKg} kg` : ''}</span> },
    { key: 'occ', header: t('Ocupación'), sort: (l) => occupiedAt(state, l.id) / l.capacity, render: (l) => { const o = occupiedAt(state, l.id); return <div className="w-32"><div className="flex justify-between text-[11px] tabular-nums"><span>{fmtInt(o)}/{fmtInt(l.capacity)}</span><span>{fmtPct((o / l.capacity) * 100)}</span></div><Progress value={(o / l.capacity) * 100} tone={l.blocked ? 'red' : o >= l.capacity ? 'navy' : 'blue'} className="h-1.5" /></div> } },
    { key: 'products', header: t('Productos'), render: (l) => <div className="flex max-w-[260px] flex-wrap gap-1">{stockEntriesAt(state, l.id).map((e) => <span key={e.id} className="rounded bg-slate-100 px-1 font-mono text-[10px]">{state.products[e.productId]?.sku} ×{e.quantity}</span>)}</div> },
    { key: 'status', header: t('Estado'), sort: (l) => locationStatus(state, l), render: (l) => { const s = locationStatus(state, l); return <Badge tone={LOCATION_STATUS[s].tone} dot>{t(LOCATION_STATUS[s].label)}</Badge> } },
    { key: 'actions', header: '', render: (l) => <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
      {l.blocked ? <Button size="sm" variant="ghost" icon={<LockOpen className="h-4 w-4" />} onClick={() => dispatch((s) => ops.unblockLocation(s, l.id), t('Ubicación desbloqueada'))} aria-label={t('Desbloquear')} /> : <Button size="sm" variant="ghost" icon={<Lock className="h-4 w-4" />} onClick={() => setBlocking(l)} aria-label={t('Bloquear')} />}
      <Button size="sm" variant="ghost" icon={<MapIcon className="h-4 w-4" />} onClick={() => navigate('mapa', { loc: l.id })} aria-label={t('Ver en el plano')} />
      <Button size="sm" variant="ghost" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDeleting(l)} disabled={occupiedAt(state, l.id) > 0} aria-label={t('Eliminar')} />
    </div> },
  ]

  const codeValid = /^[A-Z]{1,4}-\d{2}-\d{2}-\d{2}$/.test(form.code.toUpperCase())
  return (
    <div className="space-y-4">
      <PageHeader title={t('Ubicaciones y estanterías')} description={t('Codificación ZONA-PASILLO-MÓDULO-NIVEL · módulos impares a la izquierda y pares a la derecha del pasillo')} actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>{t('Nueva ubicación')}</Button>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label={t('Ubicaciones de estantería')} value={fmtInt(occ.total)} /><Stat label={t('Libres')} value={fmtInt(occ.free)} tone="green" /><Stat label={t('Parciales')} value={fmtInt(occ.partial)} /><Stat label={t('Completas')} value={fmtInt(occ.full)} /><Stat label={t('Bloqueadas')} value={fmtInt(occ.blocked)} tone={occ.blocked ? 'red' : undefined} />
      </div>
      <Card bodyClass="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs"><Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Buscar código (B-03-04-02)')} className="pl-8 font-mono" /></div>
          <Select value={zone} onChange={(e) => setZone(e.target.value)} className="w-auto"><option value="">{t('Todas las zonas')}</option>{values(state.zones).map((z) => <option key={z.id} value={z.id}>{t(z.name)}</option>)}</Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto"><option value="">{t('Todos los estados')}</option>{Object.entries(LOCATION_STATUS).map(([k, v]) => <option key={k} value={k}>{t(v.label)}</option>)}</Select>
          <span className="ml-auto text-xs text-slate-500">{t('{n} ubicaciones', { n: rows.length })}</span>
        </div>
        <DataTable rows={rows} columns={columns} rowKey={(l) => l.id} pageSize={20} onRowClick={(l) => { setEditing(l); setEdit({ capacity: l.capacity, maxWeightKg: l.maxWeightKg ?? 0, sizeClass: l.sizeClass }) }} emptyTitle={t('Sin ubicaciones que coincidan')} />
      </Card>

      <Modal open={creating} onClose={() => setCreating(false)} title={t('Nueva ubicación')} size="sm" footer={<><Button variant="outline" onClick={() => setCreating(false)}>{t('Cancelar')}</Button><Button disabled={!codeValid} onClick={() => { const r = dispatch((s) => ops.createLocation(s, { code: form.code, zoneId: form.zoneId, capacity: Number(form.capacity), maxWeightKg: Number(form.maxWeightKg) || undefined, kind: form.kind as Location['kind'], sizeClass: form.sizeClass as Location['sizeClass'] }), t('Ubicación creada')); if (r.ok) setCreating(false) }}>{t('Crear')}</Button></>}>
        <div className="space-y-3">
          <Field label={t('Código')} error={form.code && !codeValid ? t('Formato ZONA-PASILLO-MODULO-NIVEL, p. ej. B-03-11-01') : undefined}><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="B-03-11-01" className="font-mono" autoFocus /></Field>
          <Field label={t('Zona')}><Select value={form.zoneId} onChange={(e) => setForm({ ...form, zoneId: e.target.value })}>{values(state.zones).filter((z) => z.type !== 'oficinas').map((z) => <option key={z.id} value={z.id}>{t(z.name)}</option>)}</Select></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('Capacidad (uds)')}><Input type="number" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} /></Field>
            <Field label={t('Peso máximo (kg)')}><Input type="number" min={0} value={form.maxWeightKg} onChange={(e) => setForm({ ...form, maxWeightKg: Number(e.target.value) })} /></Field>
            <Field label={t('Tamaño admitido')}><Select value={form.sizeClass} onChange={(e) => setForm({ ...form, sizeClass: e.target.value })}>{Object.entries(SIZE).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}</Select></Field>
            <Field label={t('Tipo')}><Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}><option value="estanteria">{t('Estantería')}</option><option value="suelo">{t('Suelo')}</option><option value="estacion">{t('Estación')}</option></Select></Field>
          </div>
        </div>
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing ? `${t('Editar')} ${editing.code}` : ''} size="sm" footer={<><Button variant="outline" onClick={() => setEditing(null)}>{t('Cancelar')}</Button><Button onClick={() => { if (!editing) return; const r = dispatch((s) => ops.updateLocation(s, editing.id, { capacity: Number(edit.capacity), maxWeightKg: Number(edit.maxWeightKg), sizeClass: edit.sizeClass as Location['sizeClass'] }), t('Ubicación actualizada')); if (r.ok) setEditing(null) }}>{t('Guardar')}</Button></>}>
        {editing && <div className="space-y-3">
          <p className="text-xs text-slate-500">{t('Ocupación actual')}: {fmtInt(occupiedAt(state, editing.id))} {t('uds')} · {t(state.zones[editing.zoneId]?.name ?? '')}</p>
          <Field label={t('Capacidad (uds)')} hint={t('No puede ser inferior a la ocupación actual')}><Input type="number" min={1} value={edit.capacity} onChange={(e) => setEdit({ ...edit, capacity: Number(e.target.value) })} autoFocus /></Field>
          <Field label={t('Peso máximo (kg)')}><Input type="number" min={0} value={edit.maxWeightKg} onChange={(e) => setEdit({ ...edit, maxWeightKg: Number(e.target.value) })} /></Field>
          <Field label={t('Tamaño admitido')}><Select value={edit.sizeClass} onChange={(e) => setEdit({ ...edit, sizeClass: e.target.value })}>{Object.entries(SIZE).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}</Select></Field>
        </div>}
      </Modal>
      <ConfirmDialog open={!!blocking} onClose={() => setBlocking(null)} danger confirmLabel={t('Bloquear')} title={blocking ? t('Bloquear ubicación {code}', { code: blocking.code }) : ''} onConfirm={() => { if (blocking) dispatch((s) => ops.blockLocation(s, blocking.id, blockReason), t('Ubicación bloqueada')); setBlocking(null); setBlockReason('') }}>
        <Field label={t('Motivo del bloqueo')}><Input value={blockReason} onChange={(e) => setBlockReason(e.target.value)} autoFocus /></Field>
      </ConfirmDialog>
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} danger confirmLabel={t('Eliminar')} title={t('Eliminar ubicación')} message={deleting ? t('Se eliminará la ubicación {code}. Solo es posible si está vacía.', { code: deleting.code }) : ''} onConfirm={() => { if (deleting) dispatch((s) => ops.deleteLocation(s, deleting.id), t('Ubicación eliminada')); setDeleting(null) }} />
    </div>
  )
}
