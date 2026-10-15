import { AlertTriangle, ArrowDownRight, ArrowLeftRight, ArrowUpRight, Boxes, CalendarClock, ClipboardList, Gauge, Layers, Lock, MapPinned, PackageOpen, PackagePlus, Plus, RotateCcw, Truck, Warehouse } from 'lucide-react'
import type { ReactNode } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts'
import { Badge, Button, Card, EmptyState } from '@/components/ui'
import { useState$ } from '@/store/useWarehouse'
import { lowStockProducts, movementsSorted, occupancyByZone, occupiedAt, orderShortages, values, warehouseOccupancy } from '@/domain'
import { dailySeries } from '@/lib/analytics'
import { cx, fmtInt, fmtPct, timeAgo, today } from '@/lib/format'
import { navigate } from '@/lib/router'
import { MOVEMENT_TYPE, ORDER_STATUS, ZONE_TYPE } from '@/lib/labels'
import { t } from '@/lib/i18n'
import { getLocale } from '@/lib/i18n'

const PIE = ['#1e3a8a', '#2f7cff', '#16a34a', '#f97316', '#eab308', '#dc2626', '#7c3aed']

function Ring({ pct, size = 132 }: { pct: number; size?: number }) {
  const r = size / 2 - 10, c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="12" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={pct > 85 ? '#f97316' : '#5b9bff'} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${c * pct / 100} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dasharray 0.8s ease' }} />
      <text x="50%" y="50%" textAnchor="middle" dy="6" fontSize="26" fontWeight="800" fill="#fff" fontFamily="Inter, system-ui">{Math.round(pct)}%</text>
      <text x="50%" y="50%" textAnchor="middle" dy="24" fontSize="10" fill="#bfd0f2" fontFamily="Inter, system-ui">{t('ocupación')}</text>
    </svg>
  )
}

function Spark({ data, color }: { data: number[]; color: string }) {
  const w = 96, h = 28, max = Math.max(1, ...data)
  const pts = data.map((v, i) => `${(i / Math.max(1, data.length - 1)) * w},${h - (v / max) * (h - 4) - 2}`).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0 opacity-90">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={color} opacity="0.12" />
    </svg>
  )
}

function Kpi2({ label, value, hint, icon, color, spark, trend, onClick }: { label: string; value: ReactNode; hint?: ReactNode; icon: ReactNode; color: string; spark?: number[]; trend?: number; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="card group flex animate-slide-up flex-col gap-2 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg text-white" style={{ background: color }}>{icon}</span>
        {trend !== undefined && Number.isFinite(trend) && <span className={cx('flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold', trend >= 0 ? 'bg-ok-100 text-ok-600' : 'bg-danger-100 text-danger-600')}>{trend >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}{Math.abs(Math.round(trend))}%</span>}
      </div>
      <div className="flex items-end justify-between gap-2">
        <div><div className="text-2xl font-extrabold tabular-nums leading-none text-slate-900">{value}</div><div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div></div>
        {spark && <Spark data={spark} color={color} />}
      </div>
      {hint && <div className="text-[11px] text-slate-500">{hint}</div>}
    </button>
  )
}

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
  const series14 = dailySeries(state, 14).map((d) => ({ ...d, label: d.day.slice(5).replace('-', '/') }))
  const last7 = series14.slice(-7), prev7 = series14.slice(0, 7)
  const sum = (arr: typeof series14, k: 'entradas' | 'salidas' | 'movimientos' | 'picking') => arr.reduce((a, d) => a + d[k], 0)
  const trend = (k: 'entradas' | 'salidas' | 'movimientos' | 'picking') => { const p = sum(prev7, k); return p ? ((sum(last7, k) - p) / p) * 100 : NaN }
  const blocked = values(state.locations).filter((l) => l.blocked)
  const incidents = values(state.receipts).filter((r) => r.status === 'incidencia')
  const shortages = pendingOrders.filter((o) => orderShortages(state, o).length > 0)
  const returnsPending = values(state.returns).filter((r) => r.status === 'registrada')
  const expiring = products.filter((p) => p.expiryDate && new Date(p.expiryDate).getTime() - Date.now() < 15 * 86400000)
  const ready = orders.filter((o) => o.status === 'preparado')
  const zones = occupancyByZone(state).filter((z) => ['almacenamiento', 'picking'].includes(z.zone.type))
  const ordersByStatus = Object.keys(ORDER_STATUS).map((k) => ({ name: t(ORDER_STATUS[k as keyof typeof ORDER_STATUS].label), value: orders.filter((o) => o.status === k).length })).filter((x) => x.value > 0)
  const dateLabel = new Intl.DateTimeFormat(getLocale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())

  const alerts: { tone: 'red' | 'orange' | 'yellow' | 'blue'; icon: ReactNode; text: string; go: () => void }[] = []
  if (low.length) alerts.push({ tone: 'red', icon: <AlertTriangle className="h-4 w-4" />, text: t('{n} referencias por debajo del stock mínimo', { n: low.length }), go: () => navigate('inventario', { filtro: 'bajo_minimo' }) })
  if (shortages.length) alerts.push({ tone: 'orange', icon: <ClipboardList className="h-4 w-4" />, text: t('{n} pedidos con mercancía faltante', { n: shortages.length }), go: () => navigate('pedidos') })
  if (incidents.length) alerts.push({ tone: 'orange', icon: <PackageOpen className="h-4 w-4" />, text: t('{n} recepciones con incidencia', { n: incidents.length }), go: () => navigate('recepcion') })
  if (returnsPending.length) alerts.push({ tone: 'yellow', icon: <RotateCcw className="h-4 w-4" />, text: t('{n} devoluciones pendientes de inspección', { n: returnsPending.length }), go: () => navigate('devoluciones') })
  if (expiring.length) alerts.push({ tone: 'yellow', icon: <CalendarClock className="h-4 w-4" />, text: t('{n} referencias caducan en menos de 15 días', { n: expiring.length }), go: () => navigate('inventario', { filtro: 'caducidad' }) })
  if (blocked.length) alerts.push({ tone: 'blue', icon: <Lock className="h-4 w-4" />, text: t('{n} ubicaciones bloqueadas', { n: blocked.length }), go: () => navigate('ubicaciones', { estado: 'bloqueada' }) })
  if (ready.length) alerts.push({ tone: 'blue', icon: <Truck className="h-4 w-4" />, text: t('{n} pedidos preparados listos para expedir', { n: ready.length }), go: () => navigate('expediciones') })

  const quick = [
    { label: t('Recibir mercancía'), icon: <PackagePlus className="h-4 w-4" />, go: () => navigate('recepcion', { nueva: '1' }) },
    { label: t('Mover productos'), icon: <ArrowLeftRight className="h-4 w-4" />, go: () => navigate('transferencias', { nueva: '1' }) },
    { label: t('Nuevo pedido'), icon: <ClipboardList className="h-4 w-4" />, go: () => navigate('pedidos', { nuevo: '1' }) },
    { label: t('Añadir producto'), icon: <Plus className="h-4 w-4" />, go: () => navigate('inventario', { nuevo: '1' }) },
  ]
  const modules = [
    { label: t('Expediciones'), desc: t('{n} pendientes de salida', { n: pendingShipments.length + ready.length }), icon: <Truck className="h-6 w-6" />, go: () => navigate('expediciones'), color: '#16a34a', pct: orders.length ? (orders.filter((o) => o.status === 'enviado').length / orders.length) * 100 : 0 },
    { label: t('Organización del almacén'), desc: t('{n} ubicaciones · {p} ocupación', { n: occ.total, p: fmtPct(occ.pct) }), icon: <MapPinned className="h-6 w-6" />, go: () => navigate('mapa'), color: '#1d6ff2', pct: occ.pct },
    { label: t('Preparación de pedidos'), desc: t('{n} pedidos en cola', { n: pendingOrders.length }), icon: <ClipboardList className="h-6 w-6" />, go: () => navigate('pedidos'), color: '#1e3a8a', pct: pendingOrders.length ? (pendingOrders.filter((o) => o.status !== 'pendiente').length / pendingOrders.length) * 100 : 0 },
    { label: t('Retornos'), desc: t('{n} por inspeccionar', { n: returnsPending.length }), icon: <RotateCcw className="h-6 w-6" />, go: () => navigate('devoluciones'), color: '#f97316', pct: values(state.returns).length ? (values(state.returns).filter((r) => r.status === 'cerrada').length / values(state.returns).length) * 100 : 0 },
  ]

  return (
    <div className="space-y-5">
      {/* Cabecera */}
      <section className="relative overflow-hidden rounded-2xl bg-navy-950 p-6 text-white shadow-lg animate-fade-in" style={{ background: 'radial-gradient(1200px 400px at 10% -20%, #27479e 0%, #10204a 45%, #0b1630 100%)' }}>
        <div className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full bg-electric-500/20 blur-3xl" />
        <div className="pointer-events-none absolute right-40 bottom-0 h-40 w-40 rounded-full bg-ok-500/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white p-2.5 shadow-lg"><img src="./logo.svg" alt="" className="h-full w-full" /></div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-electric-400">BETO · {t('Gestión de almacén')}</div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">{state.settings.warehouseName}</h1>
            <p className="mt-1 text-sm capitalize text-slate-300">{dateLabel} · {t('resumen operativo en tiempo real')}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {quick.map((q) => <button key={q.label} onClick={q.go} className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/15 backdrop-blur transition hover:bg-electric-600 hover:ring-electric-400 active:scale-[0.98]">{q.icon}{q.label}</button>)}
            </div>
          </div>
          <div className="flex items-center gap-5">
            <Ring pct={occ.pct} />
            <div className="hidden grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid">
              <div><div className="text-2xl font-bold tabular-nums">{fmtInt(products.length)}</div><div className="text-[11px] uppercase tracking-wide text-slate-400">{t('Referencias SKU')}</div></div>
              <div><div className="text-2xl font-bold tabular-nums">{fmtInt(totalUnits)}</div><div className="text-[11px] uppercase tracking-wide text-slate-400">{t('Unidades en stock')}</div></div>
              <div><div className="text-2xl font-bold tabular-nums">{fmtInt(occ.free)}</div><div className="text-[11px] uppercase tracking-wide text-slate-400">{t('Ubicaciones libres')}</div></div>
              <div><div className="text-2xl font-bold tabular-nums text-warn-500">{fmtInt(alerts.length)}</div><div className="text-[11px] uppercase tracking-wide text-slate-400">{t('Alertas operativas')}</div></div>
            </div>
          </div>
        </div>
      </section>

      {/* Módulos prioritarios */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {modules.map((m) => (
          <button key={m.label} onClick={m.go} className="card group relative flex animate-slide-up flex-col gap-3 overflow-hidden p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl text-white shadow" style={{ background: m.color }}>{m.icon}</div><div className="min-w-0"><div className="truncate text-sm font-bold text-slate-900">{m.label}</div><div className="truncate text-xs text-slate-500">{m.desc}</div></div></div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.min(100, m.pct)}%`, background: m.color }} /></div>
          </button>
        ))}
      </div>

      {/* KPIs con tendencia */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi2 label={t('Entradas (uds)')} value={fmtInt(sum(last7, 'entradas'))} hint={t('Últimos 7 días')} icon={<PackageOpen className="h-4 w-4" />} color="#16a34a" spark={last7.map((d) => d.entradas)} trend={trend('entradas')} onClick={() => navigate('recepcion')} />
        <Kpi2 label={t('Salidas (uds)')} value={fmtInt(sum(last7, 'salidas'))} hint={t('Últimos 7 días')} icon={<Truck className="h-4 w-4" />} color="#1e3a8a" spark={last7.map((d) => d.salidas)} trend={trend('salidas')} onClick={() => navigate('expediciones')} />
        <Kpi2 label={t('Líneas de picking')} value={fmtInt(sum(last7, 'picking'))} hint={t('{n} pedidos en cola', { n: pendingOrders.length })} icon={<ClipboardList className="h-4 w-4" />} color="#2f7cff" spark={last7.map((d) => d.picking)} trend={trend('picking')} onClick={() => navigate('pedidos')} />
        <Kpi2 label={t('Movimientos')} value={fmtInt(sum(last7, 'movimientos'))} hint={t('Últimos 7 días')} icon={<Layers className="h-4 w-4" />} color="#7c3aed" spark={last7.map((d) => d.movimientos)} trend={trend('movimientos')} onClick={() => navigate('historial')} />
        <Kpi2 label={t('Pedidos pendientes')} value={fmtInt(pendingOrders.length)} hint={t('{n} con faltantes', { n: shortages.length })} icon={<ClipboardList className="h-4 w-4" />} color="#eab308" onClick={() => navigate('pedidos')} />
        <Kpi2 label={t('Recepciones pendientes')} value={fmtInt(pendingReceipts.length)} hint={t('{n} con incidencia', { n: incidents.length })} icon={<PackagePlus className="h-4 w-4" />} color="#7c3aed" onClick={() => navigate('recepcion')} />
        <Kpi2 label={t('Expediciones hoy')} value={fmtInt(shipmentsToday.length)} hint={t('{n} pendientes', { n: pendingShipments.length })} icon={<Gauge className="h-4 w-4" />} color="#16a34a" onClick={() => navigate('expediciones')} />
        <Kpi2 label={t('Bajo mínimo')} value={fmtInt(low.length)} hint={t('{n} caducan pronto', { n: expiring.length })} icon={<AlertTriangle className="h-4 w-4" />} color={low.length ? '#dc2626' : '#16a34a'} onClick={() => navigate('inventario', { filtro: 'bajo_minimo' })} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={t('Entradas y salidas · últimos 14 días')} subtitle={t('Unidades por día calculadas desde el historial')} className="lg:col-span-2" bodyClass="p-2">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series14} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#16a34a" stopOpacity={0.5} /><stop offset="1" stopColor="#16a34a" stopOpacity={0.02} /></linearGradient>
                  <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1e3a8a" stopOpacity={0.5} /><stop offset="1" stopColor="#1e3a8a" stopOpacity={0.02} /></linearGradient>
                  <linearGradient id="gPick" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2f7cff" stopOpacity={0.4} /><stop offset="1" stopColor="#2f7cff" stopOpacity={0.02} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <RTooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #e2e8f0' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="entradas" name={t('Entradas')} stroke="#16a34a" fill="url(#gIn)" strokeWidth={2} animationDuration={800} />
                <Area type="monotone" dataKey="salidas" name={t('Salidas')} stroke="#1e3a8a" fill="url(#gOut)" strokeWidth={2} animationDuration={800} />
                <Area type="monotone" dataKey="picking" name={t('Picking')} stroke="#2f7cff" fill="url(#gPick)" strokeWidth={2} animationDuration={800} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title={t('Alertas operativas')} subtitle={t('{n} alertas activas', { n: alerts.length })} bodyClass="p-2">
          {alerts.length === 0 ? <EmptyState title={t('Sin alertas')} description={t('El almacén funciona con normalidad.')} /> : (
            <ul className="space-y-1">
              {alerts.map((a, i) => <li key={i}><button onClick={a.go} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition hover:bg-slate-50"><Badge tone={a.tone}>{a.icon}</Badge><span className="text-slate-700">{a.text}</span></button></li>)}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={t('Ocupación por zona')} subtitle={t('Zonas de almacenamiento y picking')} bodyClass="p-2" actions={<Button size="sm" variant="ghost" onClick={() => navigate('mapa')}>{t('Ver en el plano')}</Button>}>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={zones.map((z) => ({ name: z.zone.code, pct: z.pct, color: ZONE_TYPE[z.zone.type].color }))} layout="vertical" margin={{ top: 4, right: 28, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={44} axisLine={false} tickLine={false} />
                <RTooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #e2e8f0' }} formatter={(v) => [`${v} %`, t('Ocupación')]} />
                <Bar dataKey="pct" radius={[0, 4, 4, 0]} animationDuration={800}>{zones.map((z, i) => <Cell key={i} fill={ZONE_TYPE[z.zone.type].color} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title={t('Pedidos por estado')} bodyClass="p-2">
          <div className="h-56"><ResponsiveContainer><PieChart><Pie data={ordersByStatus} dataKey="value" nameKey="name" innerRadius={46} outerRadius={76} paddingAngle={2} animationDuration={800}>{ordersByStatus.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}</Pie><RTooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #e2e8f0' }} /><Legend wrapperStyle={{ fontSize: 11 }} /></PieChart></ResponsiveContainer></div>
        </Card>
        <Card title={t('Plano del almacén')} subtitle={t('Vista rápida de ocupación')} bodyClass="p-2">
          <button onClick={() => navigate('mapa')} className="block w-full rounded-lg bg-slate-50 transition hover:bg-electric-100/40" aria-label={t('Ver en el plano')}>
            <svg viewBox="0 0 1600 980" className="h-52 w-full">
              <rect x="20" y="10" width="1560" height="860" rx="8" fill="#f8fafc" stroke="#334155" strokeWidth="6" />
              {values(state.zones).map((z) => <rect key={z.id} x={z.x} y={z.y} width={z.w} height={z.h} rx="8" fill={ZONE_TYPE[z.type].fill} stroke={ZONE_TYPE[z.type].color} strokeWidth="2" />)}
              {values(state.locations).filter((l) => l.kind !== 'muelle').map((l) => { const o = occupiedAt(state, l.id); const p = Math.min(1, o / l.capacity); return <rect key={l.id} x={l.x} y={l.y} width={l.w} height={l.h} fill={l.blocked ? '#ef4444' : o === 0 ? '#e2e8f0' : `rgb(${Math.round(147 + (30 - 147) * p)},${Math.round(197 + (58 - 197) * p)},${Math.round(253 + (138 - 253) * p)})`} /> })}
            </svg>
          </button>
          <div className="mt-2 flex flex-wrap justify-center gap-1 text-[11px]"><Badge tone="neutral">{t('{n} ubicaciones', { n: occ.total })}</Badge><Badge tone="blue">{fmtInt(occ.partial + occ.full)} {t('ocupadas')}</Badge><Badge tone="red">{fmtInt(occ.blocked)} {t('bloqueadas')}</Badge></div>
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
      <div className="flex items-center gap-2 text-xs text-slate-400"><Boxes className="h-3.5 w-3.5" /><Warehouse className="h-3.5 w-3.5" />{t('Todos los indicadores se calculan del estado real del almacén y cambian tras cada operación.')}</div>
    </div>
  )
}
