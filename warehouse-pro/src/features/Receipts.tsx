import { CheckCircle2, ClipboardCheck, FlaskConical, PackageOpen, Plus, Sparkles, Trash2, Wand2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card, ConfirmDialog, DataTable, Field, Input, Modal, PageHeader, Select, Stat, Tabs, Textarea, type Column } from '@/components/ui'
import { ops, values, type Receipt, type ReceiptLine } from '@/domain'
import { useState$, useWarehouse } from '@/store/useWarehouse'
import { t } from '@/lib/i18n'
import { fmtDate, fmtInt, today } from '@/lib/format'
import { RECEIPT_STATUS } from '@/lib/labels'
import { compatibleLocations, suggestLocation } from '@/lib/suggest'
import { navigate } from '@/lib/router'

type Tab = 'activas' | 'completadas' | 'todas'

export function Receipts({ params }: { params: Record<string, string> }) {
  const state = useState$()
  const dispatch = useWarehouse((s) => s.dispatch)
  const [tab, setTab] = useState<Tab>('activas')
  const [creating, setCreating] = useState(!!params.nueva)
  const [detailId, setDetailId] = useState<string | null>(params.recepcion ?? null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  useEffect(() => { if (params.recepcion) setDetailId(params.recepcion) }, [params.recepcion])

  const receipts = useMemo(() => values(state.receipts).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [state])
  const active = receipts.filter((r) => ['borrador', 'pendiente', 'en_recepcion', 'control_calidad'].includes(r.status))
  const done = receipts.filter((r) => ['completada', 'parcial', 'incidencia'].includes(r.status))
  const rows = tab === 'activas' ? active : tab === 'completadas' ? done : receipts
  const columns: Column<Receipt>[] = [
    { key: 'number', header: t('Nº'), sort: (r) => r.number, render: (r) => <span className="font-mono text-xs font-semibold">{r.number}</span> },
    { key: 'supplier', header: t('Proveedor'), sort: (r) => r.supplier, render: (r) => <div><div className="font-medium">{r.supplier}</div><div className="text-[11px] text-slate-400">{r.documentRef}</div></div> },
    { key: 'date', header: t('Fecha'), sort: (r) => r.date, render: (r) => <span className="text-xs">{fmtDate(r.date)}</span> },
    { key: 'lines', header: t('Líneas'), render: (r) => <span className="text-xs">{r.lines.length} · {fmtInt(r.lines.reduce((a, l) => a + l.quantityExpected, 0))} {t('uds esperadas')}</span> },
    { key: 'received', header: t('Recibido'), render: (r) => <span className="text-xs tabular-nums">{fmtInt(r.lines.reduce((a, l) => a + l.quantityReceived, 0))}</span> },
    { key: 'qc', header: t('Calidad'), render: (r) => r.requiresQc ? <Badge tone="purple"><FlaskConical className="h-3 w-3" />{t('Requerido')}</Badge> : <Badge tone="neutral">{t('No')}</Badge> },
    { key: 'status', header: t('Estado'), sort: (r) => r.status, render: (r) => <Badge tone={RECEIPT_STATUS[r.status].tone} dot>{t(RECEIPT_STATUS[r.status].label)}</Badge> },
  ]
  const detail = detailId ? state.receipts[detailId] : null

  return (
    <div className="space-y-4">
      <PageHeader title={t('Recepción de mercancía')} description={t('El stock disponible solo aumenta al confirmar la entrada y superar el control de calidad configurado')} actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>{t('Nueva recepción')}</Button>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t('Pendientes')} value={fmtInt(receipts.filter((r) => r.status === 'pendiente').length)} /><Stat label={t('En recepción')} value={fmtInt(receipts.filter((r) => r.status === 'en_recepcion').length)} /><Stat label={t('En control de calidad')} value={fmtInt(receipts.filter((r) => r.status === 'control_calidad').length)} tone="orange" /><Stat label={t('Con incidencia')} value={fmtInt(receipts.filter((r) => r.status === 'incidencia').length)} tone="red" />
      </div>
      <Card bodyClass="p-0" title={<Tabs tabs={[{ id: 'activas', label: t('Activas'), count: active.length }, { id: 'completadas', label: t('Finalizadas'), count: done.length }, { id: 'todas', label: t('Todas'), count: receipts.length }]} value={tab} onChange={setTab} />}>
        <DataTable rows={rows} columns={columns} rowKey={(r) => r.id} onRowClick={(r) => setDetailId(r.id)} emptyTitle={t('No hay recepciones')} emptyDescription={t('Crea una recepción para registrar la entrada de mercancía de un proveedor.')} />
      </Card>

      <NewReceiptModal open={creating} onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); setDetailId(id) }} />

      <Modal open={!!detail} onClose={() => setDetailId(null)} title={detail ? `${detail.number} · ${detail.supplier}` : ''} size="xl" footer={detail && <ReceiptActions receipt={detail} onConfirm={() => setConfirmOpen(true)} onDelete={() => setDeleteId(detail.id)} />}>
        {detail && <ReceiptDetail receipt={detail} />}
      </Modal>
      <ConfirmDialog open={confirmOpen} onClose={() => setConfirmOpen(false)} title={t('Confirmar recepción')} confirmLabel={t('Confirmar y ubicar')} message={t('Se ubicará la mercancía recibida en sus destinos, la dañada o rechazada pasará a la zona auxiliar y se registrarán los movimientos de entrada. Esta operación no se puede repetir.')} onConfirm={() => { if (detail) { const r = dispatch((s) => ops.confirmReceipt(s, detail.id), t('Recepción confirmada: inventario actualizado')); if (r.ok) { setConfirmOpen(false); const pend = values(r.state.orders).filter((o) => ['pendiente', 'en_preparacion', 'parcialmente_preparado'].includes(o.status) && o.lines.some((l) => l.quantityReserved < l.quantityRequested)); for (const o of pend) dispatch((s) => ops.reallocateOrder(s, o.id)) } } }} />
      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} danger title={t('Eliminar recepción')} confirmLabel={t('Eliminar')} message={t('Solo se pueden eliminar recepciones pendientes que no hayan generado stock.')} onConfirm={() => { if (deleteId) { const r = dispatch((s) => ops.deleteReceipt(s, deleteId), t('Recepción eliminada')); if (r.ok) setDetailId(null) } setDeleteId(null) }} />
    </div>
  )
}

function ReceiptActions({ receipt: r, onConfirm, onDelete }: { receipt: Receipt; onConfirm: () => void; onDelete: () => void }) {
  const dispatch = useWarehouse((s) => s.dispatch)
  const st = r.status
  return (
    <>
      {['pendiente', 'borrador'].includes(st) && <Button variant="ghost" icon={<Trash2 className="h-4 w-4" />} onClick={onDelete}>{t('Eliminar')}</Button>}
      {['pendiente', 'borrador'].includes(st) && <Button icon={<PackageOpen className="h-4 w-4" />} onClick={() => dispatch((s) => ops.startReceiving(s, r.id), t('Recepción iniciada: registra las cantidades recibidas'))}>{t('Iniciar recepción')}</Button>}
      {st === 'en_recepcion' && r.requiresQc && <Button variant="secondary" icon={<FlaskConical className="h-4 w-4" />} onClick={() => dispatch((s) => ops.sendReceiptToQc(s, r.id), t('Mercancía en control de calidad (cuarentena)'))}>{t('Enviar a control de calidad')}</Button>}
      {st === 'en_recepcion' && !r.requiresQc && <Button variant="success" icon={<CheckCircle2 className="h-4 w-4" />} onClick={onConfirm}>{t('Confirmar recepción')}</Button>}
      {st === 'control_calidad' && <Button variant="success" icon={<ClipboardCheck className="h-4 w-4" />} onClick={onConfirm} disabled={r.lines.some((l) => l.quantityReceived > 0 && l.qcResult === 'pendiente')}>{t('Confirmar recepción')}</Button>}
      {['completada', 'parcial', 'incidencia'].includes(st) && <Button variant="outline" onClick={() => navigate('historial', { ref: r.number })}>{t('Ver movimientos')}</Button>}
    </>
  )
}

function ReceiptDetail({ receipt: r }: { receipt: Receipt }) {
  const state = useState$()
  const dispatch = useWarehouse((s) => s.dispatch)
  const editable = ['en_recepcion', 'control_calidad'].includes(r.status)
  const steps: Receipt['status'][] = ['pendiente', 'en_recepcion', ...(r.requiresQc ? ['control_calidad' as const] : []), 'completada']
  const stepIdx = ['completada', 'parcial', 'incidencia'].includes(r.status) ? steps.length - 1 : steps.indexOf(r.status)
  const update = (line: ReceiptLine, patch: Parameters<typeof ops.recordReceiptLine>[3]) => dispatch((s) => ops.recordReceiptLine(s, r.id, line.id, patch))
  const autoAssign = () => {
    for (const l of r.lines) {
      const good = l.quantityReceived - l.quantityDamaged
      if (good > 0 && !l.putAway) { const loc = suggestLocation(state, l.productId, good); if (loc) dispatch((s) => ops.recordReceiptLine(s, r.id, l.id, { destinationLocationId: loc.id })) }
    }
  }
  return (
    <div className="space-y-4">
      <ol className="flex flex-wrap items-center gap-2 text-xs">
        {steps.map((s, i) => <li key={s} className="flex items-center gap-2"><span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition ${i < stepIdx ? 'bg-ok-500 text-white' : i === stepIdx ? 'bg-electric-600 text-white ring-4 ring-electric-100' : 'bg-slate-200 text-slate-500'}`}>{i + 1}</span><span className={i === stepIdx ? 'font-semibold text-slate-800' : 'text-slate-500'}>{t(RECEIPT_STATUS[s].label)}</span>{i < steps.length - 1 && <span className="h-px w-6 bg-slate-300" />}</li>)}
        <li className="ml-auto"><Badge tone={RECEIPT_STATUS[r.status].tone} dot>{t(RECEIPT_STATUS[r.status].label)}</Badge></li>
      </ol>
      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <Stat label={t('Documento')} value={r.documentRef || '—'} /><Stat label={t('Fecha')} value={fmtDate(r.date)} /><Stat label={t('Control de calidad')} value={r.requiresQc ? t('Requerido') : t('No requerido')} /><Stat label={t('Confirmada')} value={r.confirmedAt ? fmtDate(r.confirmedAt) : '—'} />
      </div>
      {r.status === 'control_calidad' && <p className="rounded-lg bg-violet-50 p-3 text-xs text-violet-700"><FlaskConical className="mr-1 inline h-4 w-4" />{t('La mercancía recibida está físicamente en la ubicación de cuarentena (QC) y no cuenta como disponible. Aprueba o rechaza cada línea y asigna destino a las aprobadas.')}</p>}
      {r.status === 'en_recepcion' && <p className="rounded-lg bg-electric-100 p-3 text-xs text-electric-600">{t('Registra las cantidades realmente recibidas y las dañadas. Las diferencias con lo esperado se marcan automáticamente.')}</p>}
      <div className="flex items-center justify-between"><h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('Líneas')}</h4>{editable && <Button size="sm" variant="outline" icon={<Wand2 className="h-4 w-4" />} onClick={autoAssign}>{t('Sugerir ubicaciones')}</Button>}</div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead><tr><th className="th">{t('Producto')}</th><th className="th text-right">{t('Esperado')}</th><th className="th">{t('Recibido')}</th><th className="th">{t('Dañado')}</th><th className="th">{t('Diferencia')}</th>{r.requiresQc && <th className="th">{t('Calidad')}</th>}<th className="th">{t('Ubicación destino')}</th><th className="th">{t('Notas')}</th></tr></thead>
          <tbody>
            {r.lines.map((l) => {
              const p = state.products[l.productId]
              const good = l.quantityReceived - l.quantityDamaged
              const diff = l.quantityReceived - l.quantityExpected
              const cands = good > 0 ? compatibleLocations(state, l.productId, good) : []
              return (
                <tr key={l.id} className={l.putAway ? 'bg-ok-100/40' : ''}>
                  <td className="td"><div className="flex items-center gap-2"><img src={p?.imageUrl} alt="" className="h-8 w-8 rounded" /><div><div className="font-mono text-xs font-semibold">{p?.sku}</div><div className="text-xs text-slate-500">{p?.name}</div></div></div></td>
                  <td className="td text-right tabular-nums">{fmtInt(l.quantityExpected)}</td>
                  <td className="td">{editable && !l.putAway ? <Input type="number" min={0} value={l.quantityReceived} onChange={(e) => update(l, { quantityReceived: Math.max(0, Number(e.target.value)) })} className="w-24" /> : <span className="tabular-nums">{fmtInt(l.quantityReceived)}</span>}</td>
                  <td className="td">{editable && !l.putAway ? <Input type="number" min={0} max={l.quantityReceived} value={l.quantityDamaged} onChange={(e) => update(l, { quantityDamaged: Math.max(0, Number(e.target.value)) })} className="w-20" /> : <span className="tabular-nums text-danger-600">{fmtInt(l.quantityDamaged)}</span>}</td>
                  <td className="td">{diff === 0 ? <Badge tone="green">{t('Completa')}</Badge> : diff < 0 ? <Badge tone="orange">{t('Faltan {n}', { n: -diff })}</Badge> : <Badge tone="yellow">{t('Sobran {n}', { n: diff })}</Badge>}{l.quantityDamaged > 0 && <Badge tone="red" className="ml-1">{t('Daños')}</Badge>}</td>
                  {r.requiresQc && <td className="td">{r.status === 'control_calidad' && !l.putAway && l.quantityReceived > 0 ? <div className="flex gap-1"><Button size="sm" variant={l.qcResult === 'aprobado' ? 'success' : 'outline'} onClick={() => dispatch((s) => ops.resolveQc(s, r.id, l.id, 'aprobado'))}>{t('Aprobar')}</Button><Button size="sm" variant={l.qcResult === 'rechazado' ? 'danger' : 'outline'} onClick={() => dispatch((s) => ops.resolveQc(s, r.id, l.id, 'rechazado'))}>{t('Rechazar')}</Button></div> : <Badge tone={l.qcResult === 'aprobado' ? 'green' : l.qcResult === 'rechazado' ? 'red' : 'neutral'}>{t({ pendiente: 'Pendiente', aprobado: 'Aprobado', rechazado: 'Rechazado' }[l.qcResult])}</Badge>}</td>}
                  <td className="td">{editable && !l.putAway && good > 0 && l.qcResult !== 'rechazado' ? (
                    <Select value={l.destinationLocationId ?? ''} onChange={(e) => update(l, { destinationLocationId: e.target.value })} className="w-56" aria-invalid={!l.destinationLocationId}>
                      <option value="">{t('Selecciona destino…')}</option>
                      {cands.slice(0, 60).map((c) => <option key={c.loc.id} value={c.loc.id} disabled={!!c.reason}>{c.loc.code} · {c.free} {t('libres')}{c.sameProduct ? ` · ${t('mismo SKU')}` : ''}{c.reason ? ` · ✕ ${c.reason}` : ''}</option>)}
                    </Select>
                  ) : <span className="font-mono text-xs">{l.destinationLocationId ? state.locations[l.destinationLocationId]?.code : '—'}</span>}
                    {l.putAway && <Badge tone="green" className="ml-1"><Sparkles className="h-3 w-3" />{t('Ubicado')}</Badge>}</td>
                  <td className="td">{editable && !l.putAway ? <Input value={l.notes} onChange={(e) => update(l, { notes: e.target.value })} className="w-32" placeholder={t('Incidencias…')} /> : <span className="text-xs text-slate-500">{l.notes}</span>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {r.notes && <p className="text-xs text-slate-500">{t('Observaciones')}: {r.notes}</p>}
    </div>
  )
}

function NewReceiptModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const state = useState$()
  const dispatch = useWarehouse((s) => s.dispatch)
  const [supplier, setSupplier] = useState('')
  const [docRef, setDocRef] = useState('')
  const [date, setDate] = useState(today())
  const [requiresQc, setRequiresQc] = useState(state.settings.defaultRequiresQc)
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<{ productId: string; qty: number }[]>([{ productId: '', qty: 10 }])
  const products = useMemo(() => values(state.products).filter((p) => p.status === 'activo').sort((a, b) => a.sku.localeCompare(b.sku)), [state])
  const valid = supplier.trim() && lines.length > 0 && lines.every((l) => l.productId && Number.isInteger(l.qty) && l.qty > 0) && new Set(lines.map((l) => l.productId)).size === lines.length
  const submit = () => {
    const r = dispatch((s) => ops.createReceipt(s, { supplier, documentRef: docRef, date, requiresQc, notes, lines: lines.map((l) => ({ productId: l.productId, quantityExpected: l.qty })) }), t('Recepción creada'))
    if (r.ok) { const created = values(r.state.receipts).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]; setSupplier(''); setDocRef(''); setLines([{ productId: '', qty: 10 }]); onCreated(created.id) }
  }
  return (
    <Modal open={open} onClose={onClose} title={t('Nueva recepción de mercancía')} size="lg" footer={<><Button variant="outline" onClick={onClose}>{t('Cancelar')}</Button><Button onClick={submit} disabled={!valid}>{t('Crear recepción')}</Button></>}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t('Proveedor')} className="sm:col-span-2"><Input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder={t('Nombre del proveedor')} autoFocus /></Field>
        <Field label={t('Fecha prevista')}><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label={t('Referencia documental (albarán / pedido de compra)')} className="sm:col-span-2"><Input value={docRef} onChange={(e) => setDocRef(e.target.value)} placeholder="ALB-2026-0001" /></Field>
        <Field label={t('Control de calidad')}><Select value={requiresQc ? '1' : '0'} onChange={(e) => setRequiresQc(e.target.value === '1')}><option value="1">{t('Requerido (cuarentena)')}</option><option value="0">{t('No requerido')}</option></Select></Field>
        <Field label={t('Observaciones')} className="sm:col-span-3"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      </div>
      <h4 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('Productos esperados')}</h4>
      <div className="space-y-2">
        {lines.map((l, i) => (
          <div key={i} className="flex items-center gap-2 animate-fade-in">
            <Select value={l.productId} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, productId: e.target.value } : x)))} className="flex-1"><option value="">{t('Selecciona un producto…')}</option>{products.map((p) => <option key={p.id} value={p.id}>{p.sku} · {p.name}</option>)}</Select>
            <Input type="number" min={1} value={l.qty} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, qty: Number(e.target.value) } : x)))} className="w-24" aria-invalid={!(l.qty > 0)} />
            <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => setLines(lines.filter((_, j) => j !== i))} disabled={lines.length === 1} aria-label={t('Quitar línea')} />
          </div>
        ))}
        <Button variant="outline" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setLines([...lines, { productId: '', qty: 10 }])}>{t('Añadir línea')}</Button>
        {new Set(lines.map((l) => l.productId)).size !== lines.length && <p className="text-xs text-danger-600">{t('Hay productos repetidos en las líneas.')}</p>}
      </div>
    </Modal>
  )
}
