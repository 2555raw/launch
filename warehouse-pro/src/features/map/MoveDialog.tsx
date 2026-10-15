import { ArrowRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button, Field, Input, Modal, Textarea } from '@/components/ui'
import { checkCanReceive, occupiedAt, ops, type WarehouseState } from '@/domain'
import { useWarehouse } from '@/store/useWarehouse'
import { t } from '@/lib/i18n'
import { fmtInt } from '@/lib/format'

export interface MoveRequest { productId: string; fromLocationId: string; toLocationId: string; maxQty: number }

export function MoveDialog({ req, state, onClose, onDone }: { req: MoveRequest | null; state: WarehouseState; onClose: () => void; onDone?: (toId: string) => void }) {
  const dispatch = useWarehouse((s) => s.dispatch)
  const [qty, setQty] = useState(1)
  const [reason, setReason] = useState('')
  useEffect(() => { if (req) { setQty(req.maxQty); setReason('') } }, [req])
  if (!req) return null
  const p = state.products[req.productId]
  const from = state.locations[req.fromLocationId]
  const to = state.locations[req.toLocationId]
  const reasonBlock = checkCanReceive(state, to.id, p.id, qty || 1)
  const invalid = !Number.isInteger(qty) || qty <= 0 || qty > req.maxQty
  const confirm = () => {
    const r = dispatch((s) => ops.transferStock(s, { productId: p.id, fromLocationId: from.id, toLocationId: to.id, quantity: qty, reason: reason || t('Movimiento en el plano (arrastrar y soltar)') }), t('Movimiento registrado: {q} uds de {sku} a {to}', { q: qty, sku: p.sku, to: to.code }))
    if (r.ok) { onDone?.(to.id); onClose() }
    else dispatch((s) => ops.logFailedAttempt(s, 'transferencia', { productId: p.id, quantity: qty, fromLocationId: from.id, toLocationId: to.id, reference: 'MAPA', error: r.error.message }))
  }
  return (
    <Modal open onClose={onClose} title={t('Confirmar movimiento de mercancía')} size="sm" footer={<><Button variant="outline" onClick={onClose}>{t('Cancelar')}</Button><Button onClick={confirm} disabled={invalid || !!reasonBlock} autoFocus>{t('Confirmar traslado')}</Button></>}>
      <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
        <img src={p.imageUrl} alt="" className="h-12 w-12 rounded-lg" />
        <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-slate-900">{p.name}</div><div className="font-mono text-xs text-slate-500">{p.sku}</div></div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 text-sm">
        <div className="rounded-lg border border-warn-500/40 bg-warn-100 px-3 py-2 font-mono font-bold text-warn-600">{from.code}</div>
        <ArrowRight className="h-5 w-5 text-slate-400" />
        <div className="rounded-lg border border-ok-500/40 bg-ok-100 px-3 py-2 font-mono font-bold text-ok-600">{to.code}</div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Field label={t('Cantidad a mover')} hint={t('Disponible en origen: {n}', { n: fmtInt(req.maxQty) })} error={invalid ? t('Introduce un entero entre 1 y {n}', { n: req.maxQty }) : reasonBlock ?? undefined}>
          <Input type="number" min={1} max={req.maxQty} value={qty} onChange={(e) => setQty(Number(e.target.value))} aria-invalid={invalid || !!reasonBlock} autoFocus onFocus={(e) => e.target.select()} />
        </Field>
        <div className="text-xs text-slate-500">
          <div>{t('Capacidad destino')}: <b>{to.capacity}</b></div>
          <div>{t('Libre en destino')}: <b>{to.capacity - occupiedAt(state, to.id)}</b></div>
          <div>{t('Quedarán en origen')}: <b>{req.maxQty - (invalid ? 0 : qty)}</b></div>
        </div>
      </div>
      <Field label={t('Motivo (opcional)')}><Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('Reubicación, reposición de picking, consolidación…')} /></Field>
    </Modal>
  )
}
