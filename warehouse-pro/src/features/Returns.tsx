import { ClipboardCheck, Plus, RotateCcw, Send, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge, Button, Card, ConfirmDialog, DataTable, Field, Input, Modal, PageHeader, Select, Stat, Tabs, Textarea, type Column } from '@/components/ui'
import { AUX_LOCATION_ID, RETURNS_LOCATION_ID, ops, stockEntriesAt, values, type Return, type ReturnClassification } from '@/domain'
import { useState$, useWarehouse } from '@/store/useWarehouse'
import { t } from '@/lib/i18n'
import { fmtDateTime, fmtInt } from '@/lib/format'
import { RETURN_CLASS, RETURN_STATUS, STOCK_STATE } from '@/lib/labels'
import { compatibleLocations } from '@/lib/suggest'
import { navigate } from '@/lib/router'

const PACKAGING = { intacto: 'Intacto', abierto: 'Abierto', danado: 'Dañado' }

export function Returns({ params }: { params: Record<string, string> }) {
  const state = useState$()
  const dispatch = useWarehouse((s) => s.dispatch)
  const [tab, setTab] = useState<'pendientes' | 'cerradas' | 'todas'>('pendientes')
  const [creating, setCreating] = useState(!!params.nueva)
  const [inspecting, setInspecting] = useState<Return | null>(null)
  const [cls, setCls] = useState<Exclude<ReturnClassification, 'pendiente_inspeccion'>>('apta')
  const [notes, setNotes] = useState('')
  const [dest, setDest] = useState('')
  const [dispose, setDispose] = useState<{ locationId: string; productId: string; qty: number; state: 'danado' | 'obsoleto' | 'devolucion_proveedor' } | null>(null)
  const [disposeReason, setDisposeReason] = useState('')
  const returns = useMemo(() => values(state.returns).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [state])
  const pending = returns.filter((r) => r.status !== 'cerrada')
  const closed = returns.filter((r) => r.status === 'cerrada')
  const rows = tab === 'pendientes' ? pending : tab === 'cerradas' ? closed : returns
  const columns: Column<Return>[] = [
    { key: 'number', header: t('Nº'), sort: (r) => r.number, render: (r) => <span className="font-mono text-xs font-semibold">{r.number}</span> },
    { key: 'date', header: t('Fecha'), sort: (r) => r.createdAt, render: (r) => <span className="text-xs">{fmtDateTime(r.createdAt)}</span> },
    { key: 'order', header: t('Pedido original'), render: (r) => r.orderId ? <button onClick={(e) => { e.stopPropagation(); navigate('pedidos', { pedido: r.orderId! }) }} className="font-mono text-xs hover:underline">{state.orders[r.orderId]?.number}</button> : <span className="text-xs text-slate-400">{t('Sin pedido')}</span> },
    { key: 'product', header: t('Producto'), sort: (r) => state.products[r.productId]?.sku ?? '', render: (r) => <div><span className="font-mono text-xs font-semibold">{state.products[r.productId]?.sku}</span><div className="text-xs text-slate-500">{state.products[r.productId]?.name}</div></div> },
    { key: 'qty', header: t('Cantidad'), sort: (r) => r.quantity, className: 'text-right tabular-nums font-semibold', render: (r) => fmtInt(r.quantity) },
    { key: 'reason', header: t('Motivo'), render: (r) => <span className="text-xs">{r.reason}</span> },
    { key: 'pack', header: t('Embalaje'), render: (r) => <Badge tone={r.packagingState === 'intacto' ? 'green' : r.packagingState === 'abierto' ? 'yellow' : 'red'}>{t(PACKAGING[r.packagingState])}</Badge> },
    { key: 'class', header: t('Clasificación'), sort: (r) => r.classification, render: (r) => <Badge tone={RETURN_CLASS[r.classification].tone}>{t(RETURN_CLASS[r.classification].label)}</Badge> },
    { key: 'dest', header: t('Destino final'), render: (r) => <span className="font-mono text-xs">{r.destinationLocationId ? state.locations[r.destinationLocationId]?.code : '—'}</span> },
    { key: 'status', header: t('Estado'), sort: (r) => r.status, render: (r) => <Badge tone={RETURN_STATUS[r.status].tone} dot>{t(RETURN_STATUS[r.status].label)}</Badge> },
    { key: 'actions', header: '', render: (r) => <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
      {r.status === 'registrada' && <Button size="sm" icon={<ClipboardCheck className="h-4 w-4" />} onClick={() => { setInspecting(r); setCls('apta'); setNotes(''); setDest('') }}>{t('Inspeccionar')}</Button>}
      {r.status === 'inspeccionada' && r.classification === 'devolucion_proveedor' && <Button size="sm" variant="outline" icon={<Send className="h-4 w-4" />} onClick={() => dispatch((s) => ops.closeReturnToSupplier(s, r.id), t('Mercancía enviada al proveedor'))}>{t('Enviar al proveedor')}</Button>}
    </div> },
  ]
  const auxStock = [...stockEntriesAt(state, AUX_LOCATION_ID), ...stockEntriesAt(state, RETURNS_LOCATION_ID)].filter((e) => e.state !== 'disponible')
  const candidates = inspecting ? compatibleLocations(state, inspecting.productId, inspecting.quantity) : []
  return (
    <div className="space-y-4">
      <PageHeader title={t('Devoluciones')} description={t('Flujo de retornos: registro → inspección → clasificación. Solo la mercancía apta vuelve al stock disponible')} actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>{t('Registrar devolución')}</Button>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t('Pendientes de inspección')} value={fmtInt(returns.filter((r) => r.status === 'registrada').length)} tone="orange" /><Stat label={t('Pendientes de envío a proveedor')} value={fmtInt(returns.filter((r) => r.status === 'inspeccionada').length)} /><Stat label={t('Reincorporadas al stock')} value={fmtInt(returns.filter((r) => r.classification === 'apta').length)} tone="green" /><Stat label={t('Dañadas / obsoletas')} value={fmtInt(returns.filter((r) => ['danada', 'obsoleta'].includes(r.classification)).length)} tone="red" />
      </div>
      <Card bodyClass="p-0" title={<Tabs tabs={[{ id: 'pendientes', label: t('En curso'), count: pending.length }, { id: 'cerradas', label: t('Cerradas'), count: closed.length }, { id: 'todas', label: t('Todas'), count: returns.length }]} value={tab} onChange={setTab} />}>
        <DataTable rows={rows} columns={columns} rowKey={(r) => r.id} emptyTitle={t('No hay devoluciones')} emptyDescription={t('Registra una devolución de cliente para iniciar su inspección.')} />
      </Card>
      <Card title={t('Mercancía no disponible en zonas de devoluciones y auxiliar')} subtitle={t('Dañada, obsoleta o pendiente de devolver al proveedor. Puede retirarse con una operación documentada.')} bodyClass="p-0">
        {auxStock.length === 0 ? <p className="p-4 text-center text-xs text-slate-400">{t('No hay mercancía retenida')}</p> : (
          <table className="w-full text-sm"><thead><tr><th className="th">{t('Ubicación')}</th><th className="th">{t('Producto')}</th><th className="th">{t('Estado')}</th><th className="th text-right">{t('Unidades')}</th><th className="th"></th></tr></thead><tbody>
            {auxStock.map((e) => <tr key={e.id}><td className="td font-mono text-xs">{state.locations[e.locationId]?.code}</td><td className="td"><span className="font-mono text-xs font-semibold">{state.products[e.productId]?.sku}</span> <span className="text-xs text-slate-500">{state.products[e.productId]?.name}</span></td><td className="td"><Badge tone={STOCK_STATE[e.state].tone}>{t(STOCK_STATE[e.state].label)}</Badge></td><td className="td text-right tabular-nums">{fmtInt(e.quantity)}</td><td className="td text-right">{e.state !== 'cuarentena' && <Button size="sm" variant="ghost" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDispose({ locationId: e.locationId, productId: e.productId, qty: e.quantity, state: e.state as 'danado' })}>{t('Retirar')}</Button>}</td></tr>)}
          </tbody></table>
        )}
      </Card>

      <NewReturnModal open={creating} onClose={() => setCreating(false)} />

      <Modal open={!!inspecting} onClose={() => setInspecting(null)} title={inspecting ? `${t('Inspección')} ${inspecting.number} · ${state.products[inspecting.productId]?.sku}` : ''} size="md" footer={<><Button variant="outline" onClick={() => setInspecting(null)}>{t('Cancelar')}</Button><Button onClick={() => { if (!inspecting) return; const r = dispatch((s) => ops.inspectReturn(s, inspecting.id, cls, notes, dest || undefined), t('Devolución clasificada')); if (r.ok) setInspecting(null) }} disabled={cls === 'apta' && !dest}>{t('Confirmar inspección')}</Button></>}>
        {inspecting && (
          <div className="space-y-3">
            <div className="rounded-lg bg-slate-50 p-3 text-sm"><b>{fmtInt(inspecting.quantity)} × {state.products[inspecting.productId]?.name}</b><div className="text-xs text-slate-500">{t('Motivo')}: {inspecting.reason} · {t('Embalaje')}: {t(PACKAGING[inspecting.packagingState])}</div></div>
            <Field label={t('Resultado de la inspección')}>
              <Select value={cls} onChange={(e) => setCls(e.target.value as typeof cls)}>
                <option value="apta">{t('Apta para volver al stock')}</option><option value="danada">{t('Dañada (zona auxiliar, no disponible)')}</option><option value="obsoleta">{t('Obsoleta (zona auxiliar, no disponible)')}</option><option value="devolucion_proveedor">{t('Pendiente de devolución al proveedor')}</option>
              </Select>
            </Field>
            {cls === 'apta' && <Field label={t('Ubicación de destino')} hint={t('Solo ubicaciones compatibles con la temperatura y el tamaño del producto')}>
              <Select value={dest} onChange={(e) => setDest(e.target.value)}><option value="">{t('Selecciona destino…')}</option>{candidates.slice(0, 60).map((c) => <option key={c.loc.id} value={c.loc.id} disabled={!!c.reason}>{c.loc.code} · {c.free} {t('libres')}{c.sameProduct ? ` · ${t('mismo SKU')}` : ''}{c.reason ? ` · ✕ ${c.reason}` : ''}</option>)}</Select>
            </Field>}
            <Field label={t('Notas de inspección')}><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('Estado del producto, temperatura, precinto…')} /></Field>
          </div>
        )}
      </Modal>
      <ConfirmDialog open={!!dispose} onClose={() => setDispose(null)} danger title={t('Retirar mercancía')} confirmLabel={t('Retirar')} message={dispose ? t('Se retirarán {n} unidades de {sku} ({state}) del almacén. Quedará registrado como salida documentada.', { n: dispose.qty, sku: state.products[dispose.productId]?.sku ?? '', state: t(STOCK_STATE[dispose.state].label) }) : ''} onConfirm={() => { if (dispose) { const r = dispatch((s) => ops.disposeStock(s, dispose.locationId, dispose.productId, dispose.qty, dispose.state, disposeReason), t('Mercancía retirada')); if (r.ok) { setDispose(null); setDisposeReason('') } } }}>
        <Field label={t('Motivo (destrucción, reciclaje, devolución…)')}><Input value={disposeReason} onChange={(e) => setDisposeReason(e.target.value)} autoFocus /></Field>
      </ConfirmDialog>
    </div>
  )
}

function NewReturnModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const state = useState$()
  const dispatch = useWarehouse((s) => s.dispatch)
  const [orderId, setOrderId] = useState('')
  const [productId, setProductId] = useState('')
  const [qty, setQty] = useState(1)
  const [reason, setReason] = useState('')
  const [pack, setPack] = useState<Return['packagingState']>('intacto')
  const sentOrders = values(state.orders).filter((o) => o.status === 'enviado')
  const order = orderId ? state.orders[orderId] : null
  const products = order ? order.lines.map((l) => state.products[l.productId]).filter(Boolean) : values(state.products).filter((p) => p.status === 'activo').sort((a, b) => a.sku.localeCompare(b.sku))
  const maxQty = order && productId ? (order.lines.find((l) => l.productId === productId)?.quantityPicked ?? 0) - values(state.returns).filter((r) => r.orderId === order.id && r.productId === productId).reduce((a, r) => a + r.quantity, 0) : Infinity
  const valid = productId && qty > 0 && Number.isInteger(qty) && qty <= maxQty && reason.trim()
  const submit = () => {
    const r = dispatch((s) => ops.createReturn(s, { orderId: orderId || undefined, productId, quantity: qty, reason, packagingState: pack }), t('Devolución registrada en zona de devoluciones (pendiente de inspección)'))
    if (r.ok) { setOrderId(''); setProductId(''); setQty(1); setReason(''); onClose() }
  }
  return (
    <Modal open={open} onClose={onClose} title={t('Registrar devolución')} size="md" footer={<><Button variant="outline" onClick={onClose}>{t('Cancelar')}</Button><Button onClick={submit} disabled={!valid} icon={<RotateCcw className="h-4 w-4" />}>{t('Registrar')}</Button></>}>
      <div className="space-y-3">
        <Field label={t('Pedido original (opcional)')}><Select value={orderId} onChange={(e) => { setOrderId(e.target.value); setProductId('') }}><option value="">{t('Sin pedido asociado')}</option>{sentOrders.map((o) => <option key={o.id} value={o.id}>{o.number} · {o.customer}</option>)}</Select></Field>
        <Field label={t('Producto')}><Select value={productId} onChange={(e) => setProductId(e.target.value)}><option value="">{t('Selecciona un producto…')}</option>{products.map((p) => <option key={p.id} value={p.id}>{p.sku} · {p.name}</option>)}</Select></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('Cantidad')} error={Number.isFinite(maxQty) && qty > maxQty ? t('El pedido solo permite devolver {n} uds', { n: maxQty }) : undefined} hint={Number.isFinite(maxQty) && productId ? t('Máximo devolvible: {n}', { n: maxQty }) : undefined}><Input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} /></Field>
          <Field label={t('Estado del embalaje')}><Select value={pack} onChange={(e) => setPack(e.target.value as typeof pack)}>{Object.entries(PACKAGING).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}</Select></Field>
        </div>
        <Field label={t('Motivo de la devolución')}><Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('Producto dañado, error de pedido, caducidad corta…')} /></Field>
        <p className="text-xs text-slate-500">{t('La mercancía entrará físicamente en la zona de devoluciones en estado cuarentena. No estará disponible hasta que la inspección la apruebe.')}</p>
      </div>
    </Modal>
  )
}
