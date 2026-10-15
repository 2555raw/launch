import { ArrowLeftRight, Map as MapIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge, Button, Card, DataTable, Input, PageHeader, Select, type Column } from '@/components/ui'
import { values, type Transfer } from '@/domain'
import { useState$ } from '@/store/useWarehouse'
import { t } from '@/lib/i18n'
import { fmtDateTime, fmtInt } from '@/lib/format'
import { navigate } from '@/lib/router'
import { TransferForm } from './transfers/TransferForm'

export function Transfers({ params }: { params: Record<string, string> }) {
  const state = useState$()
  const [q, setQ] = useState('')
  const [productId, setProductId] = useState('')
  const [formKey, setFormKey] = useState(0)
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return values(state.transfers).filter((tr) => (!productId || tr.productId === productId) && (!needle || tr.number.toLowerCase().includes(needle) || state.locations[tr.fromLocationId]?.code.toLowerCase().includes(needle) || state.locations[tr.toLocationId]?.code.toLowerCase().includes(needle) || tr.user.toLowerCase().includes(needle))).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [state, q, productId])
  const columns: Column<Transfer>[] = [
    { key: 'number', header: t('Nº'), sort: (r) => r.number, render: (r) => <span className="font-mono text-xs font-semibold">{r.number}</span> },
    { key: 'date', header: t('Fecha y hora'), sort: (r) => r.createdAt, render: (r) => <span className="text-xs">{fmtDateTime(r.createdAt)}</span> },
    { key: 'product', header: t('Producto'), sort: (r) => state.products[r.productId]?.sku ?? '', render: (r) => <div><span className="font-mono text-xs">{state.products[r.productId]?.sku}</span><div className="text-xs text-slate-500">{state.products[r.productId]?.name}</div></div> },
    { key: 'from', header: t('Origen'), render: (r) => <button onClick={() => navigate('mapa', { loc: r.fromLocationId })} className="font-mono text-xs hover:underline">{state.locations[r.fromLocationId]?.code}</button> },
    { key: 'to', header: t('Destino'), render: (r) => <button onClick={() => navigate('mapa', { loc: r.toLocationId })} className="font-mono text-xs hover:underline">{state.locations[r.toLocationId]?.code}</button> },
    { key: 'qty', header: t('Cantidad'), sort: (r) => r.quantity, className: 'text-right tabular-nums font-semibold', render: (r) => fmtInt(r.quantity) },
    { key: 'reason', header: t('Motivo'), render: (r) => <span className="text-xs text-slate-600">{r.reason}</span> },
    { key: 'user', header: t('Usuario'), render: (r) => <span className="text-xs">{r.user}</span> },
    { key: 'status', header: t('Resultado'), render: (r) => <Badge tone={r.status === 'completada' ? 'green' : 'red'}>{r.status === 'completada' ? t('Completada') : t('Fallida')}</Badge> },
  ]
  return (
    <div className="space-y-4">
      <PageHeader title={t('Transferencias internas')} description={t('Movimientos entre ubicaciones como una única operación lógica: origen y destino se actualizan a la vez o no se actualiza nada')} actions={<Button variant="outline" icon={<MapIcon className="h-4 w-4" />} onClick={() => navigate('mapa')}>{t('Mover en el plano')}</Button>} />
      <div className="grid gap-4 lg:grid-cols-5">
        <Card title={t('Nueva transferencia')} subtitle={t('Comprueba el disponible del origen y la capacidad, temperatura y tamaño del destino')} className="lg:col-span-2">
          <TransferForm key={formKey + (params.nueva ?? '')} state={state} compact onDone={() => setFormKey((k) => k + 1)} />
        </Card>
        <Card title={t('Historial de transferencias')} subtitle={t('{n} registros', { n: rows.length })} className="lg:col-span-3" bodyClass="p-0" actions={<div className="flex gap-2"><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Nº, ubicación, usuario')} className="w-40" /><Select value={productId} onChange={(e) => setProductId(e.target.value)} className="w-44"><option value="">{t('Todos los productos')}</option>{values(state.products).map((p) => <option key={p.id} value={p.id}>{p.sku}</option>)}</Select></div>}>
          <DataTable rows={rows} columns={columns} rowKey={(r) => r.id} pageSize={12} emptyTitle={t('Sin transferencias')} emptyDescription={t('Las transferencias realizadas en el plano o mediante el formulario aparecerán aquí.')} />
        </Card>
      </div>
      <p className="flex items-center gap-2 text-xs text-slate-500"><ArrowLeftRight className="h-4 w-4" />{t('Cada transferencia genera un movimiento en el historial con fecha, hora, usuario y motivo. Los intentos rechazados también quedan registrados como error.')}</p>
    </div>
  )
}
