import { AlertTriangle, Ban, CheckCheck, ClipboardList, Map as MapIcon, Play, Plus, RefreshCw, Trash2, Truck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card, ConfirmDialog, DataTable, Field, Input, Modal, PageHeader, Progress, Select, Stat, Tabs, Textarea, type Column } from '@/components/ui'
import { ops, orderProgress, orderShortages, pickingSortKey, productStock, values, type Order, type OrderPriority } from '@/domain'
import { useState$, useWarehouse } from '@/store/useWarehouse'
import { t } from '@/lib/i18n'
import { fmtDate, fmtInt, today } from '@/lib/format'
import { ORDER_PRIORITY, ORDER_STATUS } from '@/lib/labels'
import { navigate } from '@/lib/router'

type Tab = 'activos' | 'preparados' | 'enviados' | 'todos'

export function Orders({ params }: { params: Record<string, string> }) {
  const state = useState$()
  const dispatch = useWarehouse((s) => s.dispatch)
  const [tab, setTab] = useState<Tab>('activos')
  const [creating, setCreating] = useState(!!params.nuevo)
  const [detailId, setDetailId] = useState<string | null>(params.pedido ?? null)
  const [cancelId, setCancelId] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  useEffect(() => { if (params.pedido) setDetailId(params.pedido) }, [params.pedido])
  const orders = useMemo(() => values(state.orders).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [state])
  const prio = { urgente: 0, alta: 1, normal: 2, baja: 3 }
  const active = orders.filter((o) => ['pendiente', 'en_preparacion', 'parcialmente_preparado'].includes(o.status)).sort((a, b) => prio[a.priority] - prio[b.priority])
  const ready = orders.filter((o) => ['preparado', 'en_expedicion'].includes(o.status))
  const sent = orders.filter((o) => ['enviado', 'cancelado'].includes(o.status))
  const rows = tab === 'activos' ? active : tab === 'preparados' ? ready : tab === 'enviados' ? sent : orders
  const columns: Column<Order>[] = [
    { key: 'number', header: t('Nº pedido'), sort: (o) => o.number, render: (o) => <span className="font-mono text-xs font-semibold">{o.number}</span> },
    { key: 'customer', header: t('Cliente / destinatario'), sort: (o) => o.customer, render: (o) => <span className="font-medium">{o.customer}</span> },
    { key: 'date', header: t('Fecha'), sort: (o) => o.date, render: (o) => <span className="text-xs">{fmtDate(o.date)}</span> },
    { key: 'priority', header: t('Prioridad'), sort: (o) => prio[o.priority], render: (o) => <Badge tone={ORDER_PRIORITY[o.priority].tone}>{t(ORDER_PRIORITY[o.priority].label)}</Badge> },
    { key: 'lines', header: t('Líneas / uds'), render: (o) => <span className="text-xs tabular-nums">{o.lines.length} · {fmtInt(o.lines.reduce((a, l) => a + l.quantityRequested, 0))}</span> },
    { key: 'shortage', header: t('Faltantes'), render: (o) => { const s = orderShortages(state, o); return s.length && !['enviado', 'cancelado'].includes(o.status) ? <Badge tone="red"><AlertTriangle className="h-3 w-3" />{fmtInt(s.reduce((a, x) => a + x.missing, 0))}</Badge> : <span className="text-xs text-slate-300">—</span> } },
    { key: 'progress', header: t('Progreso'), sort: (o) => orderProgress(o), render: (o) => <div className="w-28"><div className="text-[11px] tabular-nums">{orderProgress(o)} %</div><Progress value={orderProgress(o)} tone={orderProgress(o) === 100 ? 'green' : 'blue'} className="h-1.5" /></div> },
    { key: 'status', header: t('Estado'), sort: (o) => o.status, render: (o) => <Badge tone={ORDER_STATUS[o.status].tone} dot>{t(ORDER_STATUS[o.status].label)}</Badge> },
  ]
  const detail = detailId ? state.orders[detailId] : null
  return (
    <div className="space-y-4">
      <PageHeader title={t('Preparación de pedidos')} description={t('Reserva de existencias, lista de picking optimizada por pasillos y confirmación de recogidas')} actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>{t('Nuevo pedido')}</Button>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t('Pendientes')} value={fmtInt(orders.filter((o) => o.status === 'pendiente').length)} /><Stat label={t('En preparación')} value={fmtInt(orders.filter((o) => ['en_preparacion', 'parcialmente_preparado'].includes(o.status)).length)} /><Stat label={t('Preparados')} value={fmtInt(orders.filter((o) => o.status === 'preparado').length)} tone="green" /><Stat label={t('Con faltantes')} value={fmtInt(active.filter((o) => orderShortages(state, o).length).length)} tone="red" />
      </div>
      <Card bodyClass="p-0" title={<Tabs tabs={[{ id: 'activos', label: t('En cola'), count: active.length }, { id: 'preparados', label: t('Preparados / en expedición'), count: ready.length }, { id: 'enviados', label: t('Enviados y cancelados'), count: sent.length }, { id: 'todos', label: t('Todos'), count: orders.length }]} value={tab} onChange={setTab} />}>
        <DataTable rows={rows} columns={columns} rowKey={(o) => o.id} onRowClick={(o) => setDetailId(o.id)} emptyTitle={t('No hay pedidos')} emptyDescription={t('Crea un pedido para reservar stock y generar su lista de picking.')} />
      </Card>
      <NewOrderModal open={creating} onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); setDetailId(id) }} />
      <Modal open={!!detail} onClose={() => setDetailId(null)} title={detail ? `${detail.number} · ${detail.customer}` : ''} size="xl" footer={detail && <>
        {!['enviado', 'cancelado', 'en_expedicion'].includes(detail.status) && <Button variant="ghost" icon={<Ban className="h-4 w-4" />} onClick={() => setCancelId(detail.id)}>{t('Cancelar pedido')}</Button>}
        {orderShortages(state, detail).length > 0 && ['pendiente', 'en_preparacion', 'parcialmente_preparado'].includes(detail.status) && <Button variant="outline" icon={<RefreshCw className="h-4 w-4" />} onClick={() => dispatch((s) => ops.reallocateOrder(s, detail.id), t('Reservas actualizadas'))}>{t('Completar reservas')}</Button>}
        {detail.status !== 'enviado' && detail.status !== 'cancelado' && <Button variant="outline" icon={<MapIcon className="h-4 w-4" />} onClick={() => navigate('mapa', { ruta: detail.id })}>{t('Ver ruta en el plano')}</Button>}
        {detail.status === 'pendiente' && <Button icon={<Play className="h-4 w-4" />} onClick={() => dispatch((s) => ops.startPicking(s, detail.id), t('Preparación iniciada'))} disabled={!detail.lines.some((l) => l.quantityReserved > 0)}>{t('Iniciar preparación')}</Button>}
        {['en_preparacion', 'parcialmente_preparado', 'pendiente'].includes(detail.status) && detail.lines.some((l) => l.reservations.some((r) => r.quantity > r.picked)) && <Button variant="secondary" icon={<CheckCheck className="h-4 w-4" />} onClick={() => dispatch((s) => ops.pickAll(s, detail.id), t('Todas las líneas recogidas'))}>{t('Recoger todo')}</Button>}
        {detail.status === 'preparado' && <Button variant="success" icon={<Truck className="h-4 w-4" />} onClick={() => navigate('expediciones', { nueva: detail.id })}>{t('Crear expedición')}</Button>}
        {detail.status === 'en_expedicion' && detail.shipmentId && <Button variant="outline" icon={<Truck className="h-4 w-4" />} onClick={() => navigate('expediciones', { expedicion: detail.shipmentId! })}>{t('Ver expedición')}</Button>}
      </>}>
        {detail && <OrderDetail order={detail} />}
      </Modal>
      <ConfirmDialog open={!!cancelId} onClose={() => setCancelId(null)} danger title={t('Cancelar pedido')} confirmLabel={t('Cancelar pedido')} message={t('Se liberarán todas las reservas y la mercancía ya recogida volverá a sus ubicaciones de origen.')} onConfirm={() => { if (cancelId) { const r = dispatch((s) => ops.cancelOrder(s, cancelId, cancelReason || t('Cancelado por el usuario')), t('Pedido cancelado: reservas liberadas')); if (r.ok) setCancelId(null) } setCancelReason('') }}>
        <Field label={t('Motivo')}><Input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} autoFocus /></Field>
      </ConfirmDialog>
    </div>
  )
}

function OrderDetail({ order: o }: { order: Order }) {
  const state = useState$()
  const dispatch = useWarehouse((s) => s.dispatch)
  const [qtys, setQtys] = useState<Record<string, number>>({})
  const shortages = orderShortages(state, o)
  const canPick = ['en_preparacion', 'parcialmente_preparado', 'pendiente'].includes(o.status)
  // Lista de picking ordenada por recorrido (serpentina por pasillos)
  const pickList = o.lines.flatMap((l) => l.reservations.map((r) => ({ line: l, res: r, loc: state.locations[r.locationId] }))).filter((x) => x.loc).sort((a, b) => pickingSortKey(a.loc) - pickingSortKey(b.loc))
  const progress = orderProgress(o)
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat label={t('Estado')} value={<Badge tone={ORDER_STATUS[o.status].tone} dot>{t(ORDER_STATUS[o.status].label)}</Badge>} /><Stat label={t('Prioridad')} value={<Badge tone={ORDER_PRIORITY[o.priority].tone}>{t(ORDER_PRIORITY[o.priority].label)}</Badge>} /><Stat label={t('Fecha')} value={fmtDate(o.date)} /><Stat label={t('Unidades')} value={fmtInt(o.lines.reduce((a, l) => a + l.quantityRequested, 0))} /><Stat label={t('Progreso')} value={`${progress} %`} tone={progress === 100 ? 'green' : undefined} />
      </div>
      <Progress value={progress} tone={progress === 100 ? 'green' : 'blue'} />
      {shortages.length > 0 && !['enviado', 'cancelado'].includes(o.status) && (
        <div className="rounded-lg bg-danger-100 p-3 text-xs text-danger-600"><AlertTriangle className="mr-1 inline h-4 w-4" /><b>{t('Mercancía faltante')}:</b> {shortages.map((s) => `${s.product?.sku} (${t('faltan')} ${s.missing})`).join(', ')}. {t('El pedido no se marcará como preparado hasta cubrir todas las líneas.')}</div>
      )}
      <div>
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('Líneas del pedido')}</h4>
        <div className="overflow-x-auto rounded-lg border border-slate-200"><table className="w-full text-sm"><thead><tr><th className="th">{t('Producto')}</th><th className="th text-right">{t('Solicitado')}</th><th className="th text-right">{t('Reservado')}</th><th className="th text-right">{t('Recogido')}</th><th className="th text-right">{t('Disponible global')}</th><th className="th">{t('Estado')}</th></tr></thead><tbody>
          {o.lines.map((l) => { const p = state.products[l.productId]; const st = productStock(state, l.productId); return <tr key={l.id}><td className="td"><div className="flex items-center gap-2"><img src={p?.imageUrl} alt="" className="h-7 w-7 rounded" /><div><div className="font-mono text-xs font-semibold">{p?.sku}</div><div className="text-xs text-slate-500">{p?.name}</div></div></div></td><td className="td text-right tabular-nums">{fmtInt(l.quantityRequested)}</td><td className="td text-right tabular-nums">{fmtInt(l.quantityReserved)}</td><td className="td text-right tabular-nums font-semibold">{fmtInt(l.quantityPicked)}</td><td className="td text-right tabular-nums text-slate-500">{fmtInt(st.available)}</td><td className="td">{l.quantityPicked >= l.quantityRequested ? <Badge tone="green">{t('Completa')}</Badge> : l.quantityReserved < l.quantityRequested ? <Badge tone="red">{t('Faltan {n}', { n: l.quantityRequested - l.quantityReserved })}</Badge> : l.quantityPicked > 0 ? <Badge tone="orange">{t('Parcial')}</Badge> : <Badge tone="yellow">{t('Reservada')}</Badge>}</td></tr> })}
        </tbody></table></div>
      </div>
      {pickList.length > 0 && (
        <div>
          <h4 className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"><ClipboardList className="h-4 w-4" />{t('Lista de picking (orden de recorrido recomendado)')}</h4>
          <ol className="space-y-1.5">
            {pickList.map((x, i) => {
              const pending = x.res.quantity - x.res.picked
              const p = state.products[x.line.productId]
              const key = x.line.id + x.res.locationId
              const q = qtys[key] ?? pending
              return (
                <li key={key} className={`flex flex-wrap items-center gap-3 rounded-lg border p-2 transition ${pending === 0 ? 'border-ok-500/30 bg-ok-100/40' : 'border-slate-200 bg-white'}`}>
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${pending === 0 ? 'bg-ok-500 text-white' : 'bg-warn-500 text-white'}`}>{i + 1}</span>
                  <button onClick={() => navigate('mapa', { loc: x.loc.id })} className="font-mono text-sm font-bold text-navy-800 hover:underline">{x.loc.code}</button>
                  <span className="text-xs text-slate-500">P{String(x.loc.aisle).padStart(2, '0')} · {t(state.zones[x.loc.zoneId]?.name ?? '')}</span>
                  <span className="font-mono text-xs">{p?.sku}</span><span className="truncate text-xs text-slate-600">{p?.name}</span>
                  <span className="ml-auto text-xs tabular-nums">{t('recogido')} <b>{x.res.picked}</b> / {x.res.quantity}</span>
                  {canPick && pending > 0 && <div className="flex items-center gap-1"><Input type="number" min={1} max={pending} value={q} onChange={(e) => setQtys({ ...qtys, [key]: Number(e.target.value) })} className="w-20" /><Button size="sm" variant="success" onClick={() => dispatch((s) => ops.confirmPick(s, o.id, x.line.id, x.res.locationId, q), t('Recogida confirmada'))} disabled={!(q > 0 && q <= pending)}>{t('Confirmar')}</Button></div>}
                  {pending === 0 && <Badge tone="green">{t('Recogido')}</Badge>}
                </li>
              )
            })}
          </ol>
        </div>
      )}
      {o.notes && <p className="text-xs text-slate-500">{t('Observaciones')}: {o.notes}</p>}
    </div>
  )
}

function NewOrderModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const state = useState$()
  const dispatch = useWarehouse((s) => s.dispatch)
  const [customer, setCustomer] = useState('')
  const [priority, setPriority] = useState<OrderPriority>('normal')
  const [date, setDate] = useState(today())
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<{ productId: string; qty: number }[]>([{ productId: '', qty: 1 }])
  const products = useMemo(() => values(state.products).filter((p) => p.status === 'activo').sort((a, b) => a.sku.localeCompare(b.sku)), [state])
  const valid = customer.trim() && lines.every((l) => l.productId && Number.isInteger(l.qty) && l.qty > 0) && new Set(lines.map((l) => l.productId)).size === lines.length
  const submit = () => {
    const r = dispatch((s) => ops.createOrder(s, { customer, priority, date, notes, lines: lines.map((l) => ({ productId: l.productId, quantity: l.qty })) }), t('Pedido creado y stock reservado'))
    if (r.ok) { const created = values(r.state.orders).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]; setCustomer(''); setLines([{ productId: '', qty: 1 }]); setNotes(''); onCreated(created.id) }
  }
  return (
    <Modal open={open} onClose={onClose} title={t('Nuevo pedido')} size="lg" footer={<><Button variant="outline" onClick={onClose}>{t('Cancelar')}</Button><Button onClick={submit} disabled={!valid}>{t('Crear pedido y reservar')}</Button></>}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t('Cliente o destinatario')} className="sm:col-span-2"><Input value={customer} onChange={(e) => setCustomer(e.target.value)} autoFocus /></Field>
        <Field label={t('Prioridad')}><Select value={priority} onChange={(e) => setPriority(e.target.value as OrderPriority)}>{Object.entries(ORDER_PRIORITY).map(([k, v]) => <option key={k} value={k}>{t(v.label)}</option>)}</Select></Field>
        <Field label={t('Fecha')}><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label={t('Observaciones')} className="sm:col-span-2"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-9" /></Field>
      </div>
      <h4 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('Productos')}</h4>
      <div className="space-y-2">
        {lines.map((l, i) => { const st = l.productId ? productStock(state, l.productId) : null; return (
          <div key={i} className="flex items-center gap-2 animate-fade-in">
            <Select value={l.productId} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, productId: e.target.value } : x)))} className="flex-1"><option value="">{t('Selecciona un producto…')}</option>{products.map((p) => <option key={p.id} value={p.id}>{p.sku} · {p.name} ({t('disp.')} {productStock(state, p.id).available})</option>)}</Select>
            <Input type="number" min={1} value={l.qty} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, qty: Number(e.target.value) } : x)))} className="w-24" aria-invalid={!!st && l.qty > st.available} />
            {st && <span className={`w-24 text-xs ${l.qty > st.available ? 'text-danger-600' : 'text-ok-600'}`}>{l.qty > st.available ? t('faltan {n}', { n: l.qty - st.available }) : t('disponible')}</span>}
            <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => setLines(lines.filter((_, j) => j !== i))} disabled={lines.length === 1} aria-label={t('Quitar línea')} />
          </div>
        ) })}
        <Button variant="outline" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setLines([...lines, { productId: '', qty: 1 }])}>{t('Añadir línea')}</Button>
        <p className="text-xs text-slate-500">{t('Si no hay stock suficiente, el pedido se crea igualmente con las líneas marcadas como faltantes y podrá completarse cuando llegue mercancía.')}</p>
      </div>
    </Modal>
  )
}
