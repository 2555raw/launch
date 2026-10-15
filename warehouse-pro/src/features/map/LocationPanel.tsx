import { GripVertical, History, Lock, LockOpen, MapPin, Move, Route, Thermometer, Weight, X } from 'lucide-react'
import { useState, type PointerEvent as RPointerEvent } from 'react'
import { Badge, Button, ConfirmDialog, Field, Input, Modal, Progress, Stat } from '@/components/ui'
import { availableAt, locationStatus, occupiedAt, ops, reservedAt, stockEntriesAt, weightAt, type Location, type WarehouseState } from '@/domain'
import { useRole, useWarehouse } from '@/store/useWarehouse'
import { LOCATION_STATUS, SIZE, STOCK_STATE, TEMPERATURE, ZONE_TYPE } from '@/lib/labels'
import { t } from '@/lib/i18n'
import { fmtInt, fmtNum } from '@/lib/format'
import { navigate } from '@/lib/router'
import { TransferForm } from '../transfers/TransferForm'
import { ModuleElevation } from './ModuleElevation'

interface Props {
  state: WarehouseState
  loc: Location
  onClose: () => void
  onStartDrag: (productId: string, fromLocationId: string, maxQty: number, e: RPointerEvent<HTMLElement>) => void
  onRouteFrom: () => void
  routeFromId: string | null
  onSelectLocation: (id: string) => void
}

export function LocationPanel({ state, loc, onClose, onStartDrag, onRouteFrom, routeFromId, onSelectLocation }: Props) {
  const dispatch = useWarehouse((s) => s.dispatch)
  const { can } = useRole()
  const [blockOpen, setBlockOpen] = useState(false)
  const [blockReason, setBlockReason] = useState('')
  const [moveFor, setMoveFor] = useState<string | null>(null)
  const st = locationStatus(state, loc)
  const occ = occupiedAt(state, loc.id)
  const entries = stockEntriesAt(state, loc.id)
  const zone = state.zones[loc.zoneId]
  const pct = Math.round((occ / loc.capacity) * 100)
  const temp = zone?.temperature ?? 'ambiente'
  return (
    <div className="flex h-full flex-col animate-slide-in-right">
      <header className="flex items-start justify-between gap-2 border-b border-slate-100 p-4">
        <div>
          <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-electric-600" /><h2 className="font-mono text-lg font-bold text-navy-900">{loc.code}</h2></div>
          <p className="text-xs text-slate-500">{t(zone?.name ?? '')} · {t(ZONE_TYPE[zone?.type ?? 'almacenamiento'].label)}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            <Badge tone={LOCATION_STATUS[st].tone} dot>{t(LOCATION_STATUS[st].label)}</Badge>
            <Badge tone="neutral"><Thermometer className="h-3 w-3" />{t(TEMPERATURE[temp].short)}</Badge>
            <Badge tone="neutral">{t(SIZE[loc.sizeClass])}</Badge>
          </div>
        </div>
        <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={t('Cerrar panel')}><X className="h-5 w-5" /></button>
      </header>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div>
          <div className="mb-1 flex justify-between text-xs text-slate-500"><span>{t('Ocupación')}</span><span className="font-semibold tabular-nums text-slate-800">{fmtInt(occ)} / {fmtInt(loc.capacity)} {t('uds')} ({pct} %)</span></div>
          <Progress value={pct} tone={st === 'bloqueada' ? 'red' : pct >= 100 ? 'navy' : pct > 80 ? 'orange' : 'blue'} />
          {loc.blocked && <p className="mt-2 rounded-lg bg-danger-100 px-3 py-2 text-xs text-danger-600"><Lock className="mr-1 inline h-3 w-3" />{t('Bloqueada')}: {loc.blockReason}</p>}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Stat label={t('Pasillo')} value={loc.aisle ? `P${String(loc.aisle).padStart(2, '0')}` : '—'} />
          <Stat label={t('Módulo')} value={loc.module ? String(loc.module).padStart(2, '0') : '—'} />
          <Stat label={t('Nivel')} value={loc.level} />
        </div>
        {loc.maxWeightKg && <div className="flex items-center gap-2 text-xs text-slate-500"><Weight className="h-3.5 w-3.5" />{t('Peso')}: {fmtNum(weightAt(state, loc.id))} / {fmtInt(loc.maxWeightKg)} kg</div>}
        <ModuleElevation state={state} loc={loc} onSelect={onSelectLocation} />

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('Mercancía almacenada')} ({entries.length})</h3>
          {entries.length === 0 ? <p className="rounded-lg bg-slate-50 p-3 text-center text-xs text-slate-400">{t('Ubicación vacía')}</p> : (
            <ul className="space-y-2">
              {entries.map((e) => {
                const p = state.products[e.productId]
                const movable = e.state === 'disponible' ? availableAt(state, loc.id, e.productId) : e.quantity
                const reserved = e.state === 'disponible' ? reservedAt(state, loc.id, e.productId) : 0
                return (
                  <li key={e.id} className="card group flex items-center gap-2 p-2 transition hover:border-electric-400">
                    <button className="cursor-grab touch-none rounded p-1 text-slate-300 hover:bg-slate-100 hover:text-electric-600 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-30" disabled={movable <= 0 || e.state !== 'disponible' || !can('transfers')} onPointerDown={(ev) => movable > 0 && can('transfers') && onStartDrag(e.productId, loc.id, movable, ev)} aria-label={t('Arrastrar al plano')} title={t('Arrastra esta mercancía a otra ubicación del plano')}>
                      <GripVertical className="h-5 w-5" />
                    </button>
                    <img src={p?.imageUrl} alt="" className="h-9 w-9 rounded-md" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-800">{p?.name}</div>
                      <div className="flex items-center gap-1 font-mono text-[11px] text-slate-500">{p?.sku}{e.lot && <span className="text-slate-400">· {t('lote')} {e.lot}</span>}</div>
                      <div className="mt-0.5 flex flex-wrap gap-1"><Badge tone={STOCK_STATE[e.state].tone}>{t(STOCK_STATE[e.state].label)}</Badge>{reserved > 0 && <Badge tone="yellow">{t('{n} reservadas', { n: reserved })}</Badge>}</div>
                    </div>
                    <div className="text-right"><div className="text-base font-bold tabular-nums text-slate-900">{fmtInt(e.quantity)}</div><div className="text-[10px] text-slate-400">{t('disp.')} {fmtInt(Math.max(0, movable))}</div></div>
                    {can('transfers') && <Button size="sm" variant="ghost" icon={<Move className="h-4 w-4" />} onClick={() => setMoveFor(e.productId)} aria-label={t('Mover mediante formulario')} title={t('Mover mediante formulario')} />}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
      <footer className="grid grid-cols-2 gap-2 border-t border-slate-100 p-3">
        {!can('locations.block') ? <Button variant="outline" size="sm" icon={<Lock className="h-4 w-4" />} disabled title={t('Solo el jefe de almacén puede bloquear ubicaciones')}>{loc.blocked ? t('Bloqueada') : t('Bloquear')}</Button>
          : loc.blocked ? <Button variant="outline" size="sm" icon={<LockOpen className="h-4 w-4" />} onClick={() => dispatch((s) => ops.unblockLocation(s, loc.id), t('Ubicación desbloqueada'))}>{t('Desbloquear')}</Button>
          : <Button variant="outline" size="sm" icon={<Lock className="h-4 w-4" />} onClick={() => setBlockOpen(true)}>{t('Bloquear')}</Button>}
        <Button variant="outline" size="sm" icon={<Route className="h-4 w-4" />} onClick={onRouteFrom}>{routeFromId && routeFromId !== loc.id ? t('Ruta hasta aquí') : t('Ruta desde aquí')}</Button>
        <Button variant="ghost" size="sm" icon={<History className="h-4 w-4" />} onClick={() => navigate('historial', { ubicacion: loc.id })}>{t('Historial')}</Button>
        <Button variant="ghost" size="sm" onClick={() => navigate('ubicaciones', { q: loc.code })}>{t('Editar ficha')}</Button>
      </footer>
      <ConfirmDialog open={blockOpen} onClose={() => setBlockOpen(false)} title={t('Bloquear ubicación {code}', { code: loc.code })} danger confirmLabel={t('Bloquear')} onConfirm={() => { dispatch((s) => ops.blockLocation(s, loc.id, blockReason), t('Ubicación bloqueada')); setBlockOpen(false); setBlockReason('') }}>
        <p className="mb-3 text-sm text-slate-600">{t('Una ubicación bloqueada no acepta nuevas entradas ni movimientos de destino. El stock actual se conserva.')}</p>
        <Field label={t('Motivo del bloqueo')}><Input value={blockReason} onChange={(e) => setBlockReason(e.target.value)} placeholder={t('Mantenimiento, inventario, daño estructural…')} autoFocus /></Field>
      </ConfirmDialog>
      <Modal open={!!moveFor} onClose={() => setMoveFor(null)} title={t('Mover mercancía desde {code}', { code: loc.code })} size="md">
        {moveFor && <TransferForm state={state} initial={{ productId: moveFor, fromLocationId: loc.id }} onDone={() => setMoveFor(null)} />}
      </Modal>
    </div>
  )
}
