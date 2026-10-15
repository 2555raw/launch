import { ArrowRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button, Field, Input, Select, Textarea } from '@/components/ui'
import { availableAt, checkCanReceive, occupiedAt, ops, stockEntriesOf, values, type WarehouseState } from '@/domain'
import { useWarehouse } from '@/store/useWarehouse'
import { t } from '@/lib/i18n'
import { STOCK_STATE } from '@/lib/labels'
import { fmtInt } from '@/lib/format'

/** Formulario de transferencia (alternativa al arrastrar y soltar, apto para táctil). */
export function TransferForm({ state, initial, onDone, compact }: { state: WarehouseState; initial?: { productId?: string; fromLocationId?: string; toLocationId?: string }; onDone?: () => void; compact?: boolean }) {
  const dispatch = useWarehouse((s) => s.dispatch)
  const [productId, setProductId] = useState(initial?.productId ?? '')
  const [from, setFrom] = useState(initial?.fromLocationId ?? '')
  const [to, setTo] = useState(initial?.toLocationId ?? '')
  const [qty, setQty] = useState(1)
  const [stockState, setStockState] = useState<'disponible' | 'danado' | 'obsoleto' | 'cuarentena' | 'devolucion_proveedor'>('disponible')
  const [reason, setReason] = useState('')
  const [user, setUser] = useState(state.settings.currentUser)
  const [busy, setBusy] = useState(false)

  const products = useMemo(() => values(state.products).filter((p) => p.status === 'activo').sort((a, b) => a.sku.localeCompare(b.sku)), [state])
  const origins = useMemo(() => (productId ? stockEntriesOf(state, productId).filter((e) => e.state === stockState) : []), [state, productId, stockState])
  const available = from && productId ? (stockState === 'disponible' ? availableAt(state, from, productId) : origins.filter((e) => e.locationId === from).reduce((a, e) => a + e.quantity, 0)) : 0
  const destinations = useMemo(() => values(state.locations).filter((l) => l.kind !== 'muelle' && l.id !== from).sort((a, b) => a.code.localeCompare(b.code)), [state, from])
  const destReason = to && productId ? checkCanReceive(state, to, productId, qty || 1) : null
  const qtyError = !Number.isInteger(qty) || qty <= 0 ? t('La cantidad debe ser un entero positivo') : qty > available ? t('Supera el disponible en origen ({n})', { n: available }) : undefined
  const canSubmit = productId && from && to && !qtyError && !destReason

  const submit = () => {
    setBusy(true)
    const r = dispatch((s) => ops.transferStock(s, { productId, fromLocationId: from, toLocationId: to, quantity: qty, reason, user, state: stockState }), t('Transferencia completada'))
    if (!r.ok) dispatch((s) => ops.logFailedAttempt(s, 'transferencia', { productId, quantity: qty, fromLocationId: from, toLocationId: to, reference: 'FORMULARIO', error: r.error.message, user }))
    setBusy(false)
    if (r.ok) { setQty(1); setReason(''); onDone?.() }
  }

  return (
    <div className={compact ? 'space-y-3' : 'grid gap-3 md:grid-cols-2'}>
      <Field label={t('Producto')} className={compact ? '' : 'md:col-span-2'}>
        <Select value={productId} onChange={(e) => { setProductId(e.target.value); setFrom(''); setQty(1) }}>
          <option value="">{t('Selecciona un producto…')}</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.sku} · {p.name}</option>)}
        </Select>
      </Field>
      <Field label={t('Estado de la mercancía')}>
        <Select value={stockState} onChange={(e) => { setStockState(e.target.value as typeof stockState); setFrom('') }}>
          {(['disponible', 'danado', 'obsoleto', 'cuarentena', 'devolucion_proveedor'] as const).map((s) => <option key={s} value={s}>{t(STOCK_STATE[s].label)}</option>)}
        </Select>
      </Field>
      <Field label={t('Ubicación de origen')} hint={from ? t('Disponible: {n}', { n: fmtInt(available) }) : productId ? t('{n} ubicaciones con stock', { n: origins.length }) : undefined}>
        <Select value={from} onChange={(e) => setFrom(e.target.value)} disabled={!productId}>
          <option value="">{t('Selecciona origen…')}</option>
          {origins.map((e) => <option key={e.id} value={e.locationId}>{state.locations[e.locationId]?.code} · {e.quantity} {t('uds')}{e.state === 'disponible' ? ` (${t('disp.')} ${availableAt(state, e.locationId, productId)})` : ''}</option>)}
        </Select>
      </Field>
      <Field label={t('Ubicación de destino')} error={destReason ?? undefined} hint={to ? t('Ocupación: {o}/{c}', { o: occupiedAt(state, to), c: state.locations[to]?.capacity ?? 0 }) : undefined}>
        <Select value={to} onChange={(e) => setTo(e.target.value)} aria-invalid={!!destReason}>
          <option value="">{t('Selecciona destino…')}</option>
          {destinations.map((l) => <option key={l.id} value={l.id}>{l.code} · {t(state.zones[l.zoneId]?.name ?? '')} · {l.capacity - occupiedAt(state, l.id)} {t('libres')}{l.blocked ? ` · ${t('BLOQUEADA')}` : ''}</option>)}
        </Select>
      </Field>
      <Field label={t('Cantidad')} error={from ? qtyError : undefined}>
        <Input type="number" min={1} max={available} value={qty} onChange={(e) => setQty(Number(e.target.value))} aria-invalid={!!qtyError && !!from} />
      </Field>
      <Field label={t('Usuario responsable')}><Input value={user} onChange={(e) => setUser(e.target.value)} /></Field>
      <Field label={t('Motivo')} className={compact ? '' : 'md:col-span-2'}><Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('Reposición de picking, consolidación, reubicación por rotación…')} /></Field>
      <div className={compact ? '' : 'md:col-span-2 flex justify-end'}>
        <Button onClick={submit} disabled={!canSubmit} loading={busy} icon={<ArrowRight className="h-4 w-4" />} className={compact ? 'w-full' : ''}>{t('Confirmar transferencia')}</Button>
      </div>
    </div>
  )
}
