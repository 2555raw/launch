import { AlertTriangle, ArrowLeftRight, Boxes, ClipboardList, Gauge, Layers, MapPinned, PackageOpen, PackagePlus, Plus, RotateCcw, Truck, Warehouse, CalendarClock, Lock } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts'
import { Badge, Button, Card, Kpi, EmptyState } from '@/components/ui'
import { useState$ } from '@/store/useWarehouse'
import { lowStockProducts, movementsSorted, orderShortages, values, warehouseOccupancy } from '@/domain'
import { dailySeries } from '@/lib/analytics'
import { fmtInt, fmtPct, timeAgo, today } from '@/lib/format'
import { navigate } from '@/lib/router'
import { MOVEMENT_TYPE } from '@/lib/labels'
import { t } from '@/lib/i18n'

export function Dashboard() {
  const state = useState$()
  const products = values(state.products).filter((p) => p.status === 'activo')
  const totalUnits = values(state.stock).reduce((a, s) => a + s.quantity, 0)
  const occ = warehouseOccupancy(state)
  const orders = values(state.orders)
  const pendingOrders = orders.filter((o) => ['pendiente', 'en_preparacion', 'parcialmente_preparado'].includes(o.status))
  const pendingReceipts = values(state.receipts).filter((r) => ['pendiente', 'en_recepcion', 'control_calidad'].includes(r.status))
  const shipmentsToday = values(state.shipments).filter((s) => s.status === 'confirmada' && s.confirmedAt?.slice(0, 10) === today())
  const pendingShipments = values(state.shipments).filter((s) => s.status === 'pendiente')
  const low = lowStockProducts(state)
  const movs = movementsSorted(state).slice(0, 8)
  const series = dailySeries(state, 14).map((d) => ({ ...d, label: d.day.slice(5).replace('-', '/') }))
  const blocked = values(state.locations).filter((l) => l.blocked)
  const incidents = values(state.receipts).filter((r) => r.status === 'incidencia')
  const shortages = pendingOrders.filter((o) => orderShortages(state, o).length > 0)
  const returnsPending = values(state.returns).filter((r) => r.status === 'registrada')
  const expiring = products.filter((p) => p.expiryDate && new Date(p.expiryDate).getTime() - Date.now() < 15 * 86400000)
  const ready = orders.filter((o) => o.status === 'preparado')

  const alerts: { tone: 'red' | 'orange' | 'yellow' | 'blue'; icon: React.ReactNode; text: string; go: () => void }[] = []
  if (low.length) alerts.push({ tone: 'red', icon: <AlertTriangle className="h-4 w-4" />, text: t('{n} referencias por debajo del stock mínimo', { n: low.length }), go: () => navigate('inventario', { filtro: 'bajo_minimo' }) })
  if (shortages.length) alerts.push({ tone: 'orange', icon: <ClipboardList className="h-4 w-4" />, text: t('{n} pedidos con mercancía faltante', { n: shortages.length }), go: () => navigate('pedidos') })
  if (incidents.length) alerts.push({ tone: 'orange', icon: <PackageOpen className="h-4 w-4" />, text: t('{n} recepciones con incidencia', { n: incidents.length }), go: () => navigate('recepcion') })
  if (returnsPending.length) alerts.push({ tone: 'yellow', icon: <RotateCcw className="h-4 w-4" />, text: t('{n} devoluciones pendientes de inspección', { n: returnsPending.length }), go: () => navigate('devoluciones') })
  if (expiring.length) alerts.push({ tone: 'yellow', icon: <CalendarClock className="h-4 w-4" />, text: t('{n} referencias caducan en menos de 15 días', { n: expiring.length }), go: () => navigate('inventario', { filtro: 'caducidad' }) })
  if (blocked.length) alerts.push({ tone: 'blue', icon: <Lock className="h-4 w-4" />, text: t('{n} ubicaciones bloqueadas', { n: blocked.length }), go: () => navigate('ubicaciones', { estado: 'bloqueada' }) })
  if (ready.length) alerts.push({ tone: 'blue', icon: <Truck className="h-4 w-4" />, text: t('{n} pedidos preparados listos para expedir', { n: ready.length }), go: () => navigate('expediciones') })

  const quick = [
    { label: t('Recibir mercancía'), icon: <PackagePlus className="h-5 w-5" />, go: () => navigate('recepcion', { nueva: '1' }), tone: 'bg-electric-600' },
    { label: t('Mover productos'), icon: <ArrowLeftRight className="h-5 w-5" />, go: () => navigate('transferencias', { nueva: '1' }), tone: 'bg-navy-800' },
    { label: t('Nuevo pedido'), icon: <ClipboardList className="h-5 w-5" />, go: () => navigate('pedidos', { nuevo: '1' }), tone: 'bg-ok-600' },
    { label: t('Añadir producto'), icon: <Plus className="h-5 w-5" />, go: () => navigate('inventario', { nuevo: '1' }), tone: 'bg-warn-500' },
  ]
  const modules = [
    { label: t('Expediciones'), desc: t('{n} pendientes de salida', { n: pendingShipments.length + ready.length }), icon: <Truck className="h-6 w-6" />, go: () => navigate('expediciones') },
    { label: t('Organización del almacén'), desc: t('{n} ubicaciones · {p} ocupación', { n: occ.total, p: fmtPct(occ.pct) }), icon: <MapPinned className="h-6 w-6" />, go: () => navigate('mapa') },
    { label: t('Preparación de pedidos'), desc: t('{n} pedidos en cola', { n: pendingOrders.length }), icon: <ClipboardList className="h-6 w-6" />, go: () => navigate('pedidos') },
    { label: t('Retornos'), desc: t('{n} por inspeccionar', { n: returnsPending.length }), icon: <RotateCcw className="h-6 w-6" />, go: () => navigate('devoluciones') },
  ]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-900">{t('Dashboard')}</h1>
          <p className="text-sm text-slate-500">{state.settings.warehouseName} · {t('resumen operativo en tiempo real')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {quick.map((q) => <button key={q.label} onClick={q.go} className={`flex items-center gap-2 rounded-lg ${q.tone} px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]`}>{q.icon}{q.label}</button>)}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {modules.map((m) => (
          <button key={m.label} onClick={m.go} className="card group flex animate-slide-up items-center gap-3 border-l-4 border-l-electric-500 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy-900 text-white transition group-hover:bg-electric-600">{m.icon}</div>
            <div className="min-w-0"><div className="truncate text-sm font-bold text-slate-900">{m.label}</div><div className="truncate text-xs text-slate-500">{m.desc}</div></div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label={t('Referencias SKU')} value={fmtInt(products.length)} icon={<Boxes className="h-5 w-5" />} onClick={() => navigate('inventario')} />
        <Kpi label={t('Unidades en stock')} value={fmtInt(totalUnits)} icon={<Layers className="h-5 w-5" />} tone="navy" onClick={() => navigate('inventario')} />
        <Kpi label={t('Ocupación')} value={fmtPct(occ.pct)} hint={`${fmtInt(occ.occupied)} / ${fmtInt(occ.capacity)} ${t('uds')}`} icon={<Gauge className="h-5 w-5" />} tone={occ.pct > 85 ? 'orange' : 'green'} onClick={() => navigate('mapa')} />
        <Kpi label={t('Ubicaciones libres')} value={fmtInt(occ.free)} hint={t('{n} ocupadas · {b} bloqueadas', { n: occ.partial + occ.full, b: occ.blocked })} icon={<Warehouse className="h-5 w-5" />} tone="neutral" onClick={() => navigate('ubicaciones')} />
        <Kpi label={t('Pedidos pendientes')} value={fmtInt(pendingOrders.length)} icon={<ClipboardList className="h-5 w-5" />} tone="yellow" onClick={() => navigate('pedidos')} />
        <Kpi label={t('Recepciones pendientes')} value={fmtInt(pendingReceipts.length)} icon={<PackageOpen className="h-5 w-5" />} tone="purple" onClick={() => navigate('recepcion')} />
        <Kpi label={t('Expediciones hoy')} value={fmtInt(shipmentsToday.length)} hint={t('{n} pendientes', { n: pendingShipments.length })} icon={<Truck className="h-5 w-5" />} tone="green" onClick={() => navigate('expediciones')} />
        <Kpi label={t('Bajo mínimo')} value={fmtInt(low.length)} icon={<AlertTriangle className="h-5 w-5" />} tone={low.length ? 'red' : 'green'} onClick={() => navigate('inventario', { filtro: 'bajo_minimo' })} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={t('Entradas y salidas · últimos 14 días')} subtitle={t('Unidades por día calculadas desde el historial')} className="lg:col-span-2" bodyClass="p-2">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <RTooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #e2e8f0' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="entradas" name={t('Entradas')} fill="#16a34a" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={700} />
                <Bar dataKey="salidas" name={t('Salidas')} fill="#1e3a8a" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={700} />
                <Bar dataKey="picking" name={t('Picking')} fill="#2f7cff" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={700} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title={t('Alertas operativas')} subtitle={t('{n} alertas activas', { n: alerts.length })} bodyClass="p-2">
          {alerts.length === 0 ? <EmptyState title={t('Sin alertas')} description={t('El almacén funciona con normalidad.')} /> : (
            <ul className="space-y-1">
              {alerts.map((a, i) => (
                <li key={i}><button onClick={a.go} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition hover:bg-slate-50"><Badge tone={a.tone}>{a.icon}</Badge><span className="text-slate-700">{a.text}</span></button></li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={t('Últimos movimientos')} actions={<Button size="sm" variant="ghost" onClick={() => navigate('historial')}>{t('Ver historial')}</Button>} className="lg:col-span-2" bodyClass="p-0">
          <ul className="divide-y divide-slate-100">
            {movs.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-4 py-2 text-sm animate-fade-in">
                <Badge tone={MOVEMENT_TYPE[m.type].tone}>{t(MOVEMENT_TYPE[m.type].label)}</Badge>
                <span className="font-mono text-xs text-slate-700">{m.sku}</span>
                <span className="font-semibold tabular-nums">{m.quantity ? fmtInt(m.quantity) : ''}</span>
                <span className="hidden truncate text-xs text-slate-500 sm:inline">{m.fromLocationId ? state.locations[m.fromLocationId]?.code : ''}{m.fromLocationId && m.toLocationId ? ' → ' : ''}{m.toLocationId ? state.locations[m.toLocationId]?.code : ''}</span>
                <span className="ml-auto whitespace-nowrap text-xs text-slate-400">{timeAgo(m.timestamp)}</span>
              </li>
            ))}
            {movs.length === 0 && <EmptyState title={t('Sin movimientos registrados')} />}
          </ul>
        </Card>
        <Card title={t('Stock bajo mínimo')} actions={<Button size="sm" variant="ghost" onClick={() => navigate('inventario', { filtro: 'bajo_minimo' })}>{t('Ver todos')}</Button>} bodyClass="p-0">
          <ul className="divide-y divide-slate-100">
            {low.slice(0, 7).map(({ product, stock }) => (
              <li key={product.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                <img src={product.imageUrl} alt="" className="h-8 w-8 rounded-md" />
                <div className="min-w-0 flex-1"><div className="truncate font-medium text-slate-800">{product.name}</div><div className="font-mono text-[11px] text-slate-500">{product.sku}</div></div>
                <div className="text-right"><div className="font-bold tabular-nums text-danger-600">{fmtInt(stock.available)}</div><div className="text-[11px] text-slate-400">{t('mín.')} {fmtInt(product.minStock)}</div></div>
              </li>
            ))}
            {low.length === 0 && <EmptyState title={t('Ningún producto bajo mínimo')} />}
          </ul>
        </Card>
      </div>
    </div>
  )
}
