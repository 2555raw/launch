import { Ban, CheckCircle2, Plus, Truck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card, ConfirmDialog, DataTable, Field, Input, Modal, PageHeader, Stat, Tabs, Textarea, type Column } from '@/components/ui'
import { ops, values, type Shipment } from '@/domain'
import { useRole, useState$, useWarehouse } from '@/store/useWarehouse'
import { t } from '@/lib/i18n'
import { fmtDate, fmtDateTime, fmtInt, today } from '@/lib/format'
import { ORDER_STATUS, SHIPMENT_STATUS } from '@/lib/labels'
import { navigate } from '@/lib/router'

type Tab = 'pendientes' | 'expedidas' | 'todas'

export function Shipments({ params }: { params: Record<string, string> }) {
  const state = useState$()
  const dispatch = useWarehouse((s) => s.dispatch)
  const { can } = useRole()
  const [tab, setTab] = useState<Tab>('pendientes')
  const [creating, setCreating] = useState(!!params.nueva)
  const [detailId, setDetailId] = useState<string | null>(params.expedicion ?? null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [cancelId, setCancelId] = useState<string | null>(null)
  useEffect(() => { if (params.expedicion) setDetailId(params.expedicion) }, [params.expedicion])
  useEffect(() => { if (params.nueva) setCreating(true) }, [params.nueva])
  const shipments = useMemo(() => values(state.shipments).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [state])
  const pending = shipments.filter((s) => s.status === 'pendiente')
  const done = shipments.filter((s) => s.status === 'confirmada')
  const readyOrders = values(state.orders).filter((o) => o.status === 'preparado')
  const rows = tab === 'pendientes' ? pending : tab === 'expedidas' ? done : shipments
  const units = (s: Shipment) => s.orderIds.reduce((a, id) => a + (state.orders[id]?.lines.reduce((b, l) => b + l.quantityPicked, 0) ?? 0), 0)
  const columns: Column<Shipment>[] = [
    { key: 'number', header: t('Nº'), sort: (s) => s.number, render: (s) => <span className="font-mono text-xs font-semibold">{s.number}</span> },
    { key: 'recipient', header: t('Destinatario'), sort: (s) => s.recipient, render: (s) => <span className="font-medium">{s.recipient}</span> },
    { key: 'orders', header: t('Pedidos'), render: (s) => <div className="flex flex-wrap gap-1">{s.orderIds.map((id) => <span key={id} className="rounded bg-slate-100 px-1 font-mono text-[10px]">{state.orders[id]?.number}</span>)}</div> },
    { key: 'units', header: t('Unidades'), sort: units, className: 'text-right tabular-nums', render: (s) => fmtInt(units(s)) },
    { key: 'carrier', header: t('Transportista'), sort: (s) => s.carrier, render: (s) => <div><div className="text-xs">{s.carrier}</div><div className="font-mono text-[10px] text-slate-400">{s.trackingRef}</div></div> },
    { key: 'date', header: t('Fecha de salida'), sort: (s) => s.date, render: (s) => <span className="text-xs">{fmtDate(s.date)}</span> },
    { key: 'status', header: t('Estado'), sort: (s) => s.status, render: (s) => <Badge tone={SHIPMENT_STATUS[s.status].tone} dot>{t(SHIPMENT_STATUS[s.status].label)}</Badge> },
  ]
  const detail = detailId ? state.shipments[detailId] : null
  return (
    <div className="space-y-4">
      <PageHeader title={t('Expediciones')} description={t('Control de salidas: revisión, transportista, referencia de envío y confirmación final idempotente')} actions={can('shipments') && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)} disabled={readyOrders.length === 0} title={readyOrders.length === 0 ? t('No hay pedidos preparados') : undefined}>{t('Nueva expedición')}</Button>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t('Pedidos preparados sin expedición')} value={fmtInt(readyOrders.length)} tone={readyOrders.length ? 'orange' : undefined} /><Stat label={t('Pendientes de salida')} value={fmtInt(pending.length)} /><Stat label={t('Expedidas hoy')} value={fmtInt(done.filter((s) => s.confirmedAt?.slice(0, 10) === today()).length)} tone="green" /><Stat label={t('Unidades expedidas (total)')} value={fmtInt(done.reduce((a, s) => a + units(s), 0))} />
      </div>
      {readyOrders.length > 0 && <div className="flex flex-wrap items-center gap-2 rounded-lg border border-warn-500/30 bg-warn-100 px-3 py-2 text-xs text-warn-600"><Truck className="h-4 w-4" />{t('Pedidos preparados listos para expedir')}: {readyOrders.map((o) => <button key={o.id} onClick={() => navigate('pedidos', { pedido: o.id })} className="rounded bg-white px-1.5 py-0.5 font-mono font-semibold hover:bg-warn-500/20">{o.number}</button>)}{can('shipments') && <Button size="sm" className="ml-auto" onClick={() => setCreating(true)}>{t('Crear expedición')}</Button>}</div>}
      <Card bodyClass="p-0" title={<Tabs tabs={[{ id: 'pendientes', label: t('Pendientes'), count: pending.length }, { id: 'expedidas', label: t('Expedidas'), count: done.length }, { id: 'todas', label: t('Todas'), count: shipments.length }]} value={tab} onChange={setTab} />}>
        <DataTable rows={rows} columns={columns} rowKey={(s) => s.id} onRowClick={(s) => setDetailId(s.id)} emptyTitle={t('No hay expediciones')} emptyDescription={t('Prepara un pedido y crea una expedición para registrar su salida.')} />
      </Card>
      <NewShipmentModal open={creating} initialOrderId={params.nueva && state.orders[params.nueva] ? params.nueva : undefined} onClose={() => { setCreating(false); if (params.nueva) navigate('expediciones') }} onCreated={(id) => { setCreating(false); setDetailId(id); if (params.nueva) navigate('expediciones', { expedicion: id }) }} />
      <Modal open={!!detail} onClose={() => setDetailId(null)} title={detail ? `${detail.number} · ${detail.recipient}` : ''} size="lg" footer={detail && <>
        {can('shipments') && detail.status === 'pendiente' && <Button variant="ghost" icon={<Ban className="h-4 w-4" />} onClick={() => setCancelId(detail.id)}>{t('Cancelar expedición')}</Button>}
        {detail.status === 'confirmada' && <Button variant="outline" onClick={() => navigate('historial', { ref: detail.number })}>{t('Ver movimientos de salida')}</Button>}
        {can('shipments') && detail.status === 'pendiente' && <Button variant="success" icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => setConfirmId(detail.id)}>{t('Confirmar salida')}</Button>}
        {can('shipments') && detail.status === 'confirmada' && <Button variant="success" icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => dispatch((s) => ops.confirmShipment(s, detail.id))} title={t('Prueba de idempotencia: no vuelve a descontar stock')}>{t('Confirmar de nuevo (prueba)')}</Button>}
      </>}>
        {detail && <ShipmentDetail shipment={detail} />}
      </Modal>
      <ConfirmDialog open={!!confirmId} onClose={() => setConfirmId(null)} title={t('Confirmar expedición')} confirmLabel={t('Confirmar salida de mercancía')} message={t('Se descontará definitivamente el stock de la zona de expedición, los pedidos pasarán a «Enviado» y se registrarán los movimientos de salida. Una expedición confirmada no puede volver a descontar stock.')} onConfirm={() => { if (confirmId) dispatch((s) => ops.confirmShipment(s, confirmId), t('Expedición confirmada: mercancía enviada')); setConfirmId(null) }} />
      <ConfirmDialog open={!!cancelId} onClose={() => setCancelId(null)} danger title={t('Cancelar expedición')} confirmLabel={t('Cancelar expedición')} message={t('Los pedidos volverán al estado «Preparado» y la mercancía regresará a consolidación.')} onConfirm={() => { if (cancelId) dispatch((s) => ops.cancelShipment(s, cancelId), t('Expedición cancelada')); setCancelId(null) }} />
    </div>
  )
}

function ShipmentDetail({ shipment: s }: { shipment: Shipment }) {
  const state = useState$()
  const orders = s.orderIds.map((id) => state.orders[id]).filter(Boolean)
  const agg = new Map<string, number>()
  for (const o of orders) for (const l of o.lines) agg.set(l.productId, (agg.get(l.productId) ?? 0) + l.quantityPicked)
  const expLocs = values(state.locations).filter((l) => l.zoneId === 'Z-EXP')
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label={t('Estado')} value={<Badge tone={SHIPMENT_STATUS[s.status].tone} dot>{t(SHIPMENT_STATUS[s.status].label)}</Badge>} /><Stat label={t('Transportista')} value={s.carrier} /><Stat label={t('Referencia de envío')} value={<span className="font-mono">{s.trackingRef || '—'}</span>} /><Stat label={t('Fecha de salida')} value={fmtDate(s.date)} />
      </div>
      {s.confirmedAt && <p className="rounded-lg bg-ok-100 p-2 text-xs text-ok-600"><CheckCircle2 className="mr-1 inline h-4 w-4" />{t('Confirmada el')} {fmtDateTime(s.confirmedAt)}. {t('El stock ya se ha descontado; repetir la confirmación no tiene efecto.')}</p>}
      <div>
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('Pedidos incluidos')}</h4>
        <ul className="flex flex-wrap gap-2">{orders.map((o) => <li key={o.id}><button onClick={() => navigate('pedidos', { pedido: o.id })} className="flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1 text-xs hover:border-electric-400"><span className="font-mono font-semibold">{o.number}</span><span>{o.customer}</span><Badge tone={ORDER_STATUS[o.status].tone}>{t(ORDER_STATUS[o.status].label)}</Badge></button></li>)}</ul>
      </div>
      <div>
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('Revisión de productos y cantidades')}</h4>
        <table className="w-full text-sm"><thead><tr><th className="th">{t('Producto')}</th><th className="th text-right">{t('Unidades')}</th><th className="th">{t('Ubicación actual')}</th></tr></thead><tbody>
          {[...agg.entries()].map(([pid, qty]) => { const p = state.products[pid]; const where = s.status === 'pendiente' ? expLocs.filter((l) => values(state.stock).some((e) => e.locationId === l.id && e.productId === pid)).map((l) => l.code).join(', ') : t('Enviado'); return <tr key={pid}><td className="td"><div className="flex items-center gap-2"><img src={p?.imageUrl} alt="" className="h-7 w-7 rounded" /><div><div className="font-mono text-xs font-semibold">{p?.sku}</div><div className="text-xs text-slate-500">{p?.name}</div></div></div></td><td className="td text-right font-semibold tabular-nums">{fmtInt(qty)}</td><td className="td font-mono text-xs">{where || '—'}</td></tr> })}
        </tbody></table>
      </div>
      {s.notes && <p className="text-xs text-slate-500">{t('Observaciones')}: {s.notes}</p>}
    </div>
  )
}

function NewShipmentModal({ open, onClose, onCreated, initialOrderId }: { open: boolean; onClose: () => void; onCreated: (id: string) => void; initialOrderId?: string }) {
  const state = useState$()
  const dispatch = useWarehouse((s) => s.dispatch)
  const ready = values(state.orders).filter((o) => o.status === 'preparado')
  const [selected, setSelected] = useState<string[]>(initialOrderId ? [initialOrderId] : [])
  const [recipient, setRecipient] = useState('')
  const [carrier, setCarrier] = useState('')
  const [tracking, setTracking] = useState('')
  const [date, setDate] = useState(today())
  const [notes, setNotes] = useState('')
  useEffect(() => { if (open) { setSelected(initialOrderId ? [initialOrderId] : []); setRecipient(initialOrderId ? state.orders[initialOrderId]?.customer ?? '' : '') } }, [open, initialOrderId, state.orders])
  const toggle = (id: string) => { const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]; setSelected(next); if (!recipient && next.length) setRecipient(state.orders[next[0]]?.customer ?? '') }
  const valid = selected.length > 0 && recipient.trim() && carrier.trim()
  const submit = () => {
    const r = dispatch((s) => ops.createShipment(s, { orderIds: selected, recipient, carrier, trackingRef: tracking, date, notes }), t('Expedición creada: mercancía trasladada a la zona de expedición'))
    if (r.ok) { const created = values(r.state.shipments).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]; setCarrier(''); setTracking(''); setNotes(''); onCreated(created.id) }
  }
  return (
    <Modal open={open} onClose={onClose} title={t('Nueva expedición')} size="lg" footer={<><Button variant="outline" onClick={onClose}>{t('Cancelar')}</Button><Button onClick={submit} disabled={!valid}>{t('Crear expedición')}</Button></>}>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('Pedidos preparados')}</h4>
      {ready.length === 0 ? <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">{t('No hay pedidos en estado «Preparado».')}</p> : (
        <ul className="mb-4 max-h-56 space-y-1 overflow-y-auto">
          {ready.map((o) => <li key={o.id}><label className={`flex cursor-pointer items-center gap-3 rounded-lg border p-2 text-sm transition ${selected.includes(o.id) ? 'border-electric-500 bg-electric-100/50' : 'border-slate-200 hover:bg-slate-50'}`}><input type="checkbox" checked={selected.includes(o.id)} onChange={() => toggle(o.id)} className="h-4 w-4 accent-electric-600" /><span className="font-mono font-semibold">{o.number}</span><span className="flex-1">{o.customer}</span><span className="text-xs text-slate-500">{fmtInt(o.lines.reduce((a, l) => a + l.quantityPicked, 0))} {t('uds')}</span></label></li>)}
        </ul>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('Destinatario')}><Input value={recipient} onChange={(e) => setRecipient(e.target.value)} /></Field>
        <Field label={t('Transportista')}><Input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="SEUR Frío, DHL, Correos Express…" list="carriers" /><datalist id="carriers"><option value="SEUR Frío" /><option value="DHL" /><option value="Correos Express" /><option value="Transporte propio" /></datalist></Field>
        <Field label={t('Referencia de envío')}><Input value={tracking} onChange={(e) => setTracking(e.target.value)} className="font-mono" /></Field>
        <Field label={t('Fecha de salida')}><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label={t('Observaciones')} className="sm:col-span-2"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('Cadena de frío, muelle asignado, instrucciones de carga…')} /></Field>
      </div>
    </Modal>
  )
}
