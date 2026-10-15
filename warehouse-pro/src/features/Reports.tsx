import { Download } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts'
import { Badge, Button, Card, Input, PageHeader, Select, Stat } from '@/components/ui'
import { lowStockProducts, occupancyByZone, orderShortages, values } from '@/domain'
import { useState$, useWarehouse } from '@/store/useWarehouse'
import { t } from '@/lib/i18n'
import { daysAgo, fmtDate, fmtInt, fmtPct, today } from '@/lib/format'
import { dailySeries, filterMovements, pickingProductivity, productRotation, stockEvolution } from '@/lib/analytics'
import { downloadCsv, toCsv } from '@/lib/csv'
import { MOVEMENT_TYPE, ORDER_STATUS, RECEIPT_STATUS, ZONE_TYPE } from '@/lib/labels'
import { navigate } from '@/lib/router'

const tooltipStyle = { borderRadius: 8, fontSize: 12, border: '1px solid #e2e8f0' }
const PIE_COLORS = ['#1e3a8a', '#2f7cff', '#16a34a', '#f97316', '#eab308', '#dc2626', '#7c3aed', '#0891b2', '#64748b', '#0d9488']

export function Reports() {
  const state = useState$()
  const notify = useWarehouse((s) => s.notify)
  const [from, setFrom] = useState(daysAgo(14))
  const [to, setTo] = useState(today())
  const [preset, setPreset] = useState('14')
  const applyPreset = (p: string) => { setPreset(p); if (p !== 'custom') { setFrom(daysAgo(Number(p) - 1)); setTo(today()) } }
  const days = Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1)

  const series = useMemo(() => dailySeries(state, days, from, to).map((d) => ({ ...d, label: d.day.slice(5).replace('-', '/') })), [state, days, from, to])
  const evolution = useMemo(() => stockEvolution(state, days).map((d) => ({ ...d, label: d.day.slice(5).replace('-', '/') })), [state, days])
  const rotation = useMemo(() => productRotation(state, from, to), [state, from, to])
  const top = [...rotation].filter((r) => r.out > 0).sort((a, b) => b.out - a.out).slice(0, 8)
  const idle = rotation.filter((r) => r.moves === 0)
  const low = lowStockProducts(state)
  const zones = occupancyByZone(state).filter((z) => z.zone.type !== 'oficinas')
  const picking = pickingProductivity(state, from, to)
  const pendingOrders = values(state.orders).filter((o) => ['pendiente', 'en_preparacion', 'parcialmente_preparado'].includes(o.status))
  const incidents = values(state.receipts).filter((r) => ['incidencia', 'parcial'].includes(r.status) && r.date >= from && r.date <= to)
  const movs = filterMovements(values(state.movements), { from, to })
  const byType = Object.keys(MOVEMENT_TYPE).map((k) => ({ name: t(MOVEMENT_TYPE[k as keyof typeof MOVEMENT_TYPE].label), value: movs.filter((m) => m.type === k && m.result === 'ok').length })).filter((x) => x.value > 0)
  const ordersByStatus = Object.keys(ORDER_STATUS).map((k) => ({ name: t(ORDER_STATUS[k as keyof typeof ORDER_STATUS].label), value: values(state.orders).filter((o) => o.status === k).length })).filter((x) => x.value > 0)

  const exportAll = () => {
    downloadCsv(`informe_movimientos_${from}_${to}.csv`, toCsv(series.map(({ day, entradas, salidas, picking: pk, transferencias, devoluciones, ajustes, movimientos }) => ({ dia: day, entradas, salidas, picking: pk, transferencias, devoluciones, ajustes, movimientos }))))
    downloadCsv(`informe_rotacion_${from}_${to}.csv`, toCsv(rotation.map((r) => ({ sku: r.product.sku, nombre: r.product.name, salidas: r.out, movimientos: r.moves, ultimo_movimiento: r.last ?? '' }))))
    downloadCsv(`informe_ocupacion_${today()}.csv`, toCsv(zones.map((z) => ({ zona: z.zone.code, nombre: z.zone.name, ubicaciones: z.locations, capacidad: z.capacity, ocupado: z.occupied, porcentaje: z.pct }))))
    notify('success', t('Informes exportados'), t('Se han descargado 3 ficheros CSV'))
  }

  return (
    <div className="space-y-4">
      <PageHeader title={t('Informes y estadísticas')} description={t('Todos los gráficos se calculan desde el historial y el estado real del almacén')} actions={<>
        <Select value={preset} onChange={(e) => applyPreset(e.target.value)} className="w-40"><option value="7">{t('Últimos 7 días')}</option><option value="14">{t('Últimos 14 días')}</option><option value="30">{t('Últimos 30 días')}</option><option value="custom">{t('Personalizado')}</option></Select>
        <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPreset('custom') }} className="w-36" /><Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPreset('custom') }} className="w-36" />
        <Button variant="outline" icon={<Download className="h-4 w-4" />} onClick={exportAll}>{t('Exportar CSV')}</Button>
      </>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <Stat label={t('Movimientos en el periodo')} value={fmtInt(movs.length)} /><Stat label={t('Entradas (uds)')} value={fmtInt(series.reduce((a, d) => a + d.entradas, 0))} tone="green" /><Stat label={t('Salidas (uds)')} value={fmtInt(series.reduce((a, d) => a + d.salidas, 0))} /><Stat label={t('Líneas de picking')} value={fmtInt(picking.total)} /><Stat label={t('Pedidos pendientes')} value={fmtInt(pendingOrders.length)} tone={pendingOrders.length ? 'orange' : undefined} /><Stat label={t('Incidencias de recepción')} value={fmtInt(incidents.length)} tone={incidents.length ? 'red' : undefined} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t('Evolución del stock total')} subtitle={t('Reconstruida desde los movimientos')} bodyClass="p-2"><div className="h-60"><ResponsiveContainer><AreaChart data={evolution} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}><defs><linearGradient id="st" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2f7cff" stopOpacity={0.5} /><stop offset="1" stopColor="#2f7cff" stopOpacity={0.05} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} domain={['auto', 'auto']} /><RTooltip contentStyle={tooltipStyle} /><Area type="monotone" dataKey="stock" name={t('Unidades')} stroke="#1e3a8a" fill="url(#st)" strokeWidth={2} animationDuration={800} /></AreaChart></ResponsiveContainer></div></Card>
        <Card title={t('Entradas y salidas por día')} bodyClass="p-2"><div className="h-60"><ResponsiveContainer><BarChart data={series} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><RTooltip contentStyle={tooltipStyle} /><Legend wrapperStyle={{ fontSize: 12 }} /><Bar dataKey="entradas" name={t('Entradas')} fill="#16a34a" radius={[4, 4, 0, 0]} animationDuration={700} /><Bar dataKey="salidas" name={t('Salidas')} fill="#1e3a8a" radius={[4, 4, 0, 0]} animationDuration={700} /><Bar dataKey="devoluciones" name={t('Devoluciones')} fill="#f97316" radius={[4, 4, 0, 0]} animationDuration={700} /></BarChart></ResponsiveContainer></div></Card>
        <Card title={t('Movimientos por periodo')} subtitle={t('Número de operaciones registradas por día y tipo')} bodyClass="p-2"><div className="h-60"><ResponsiveContainer><LineChart data={series} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><RTooltip contentStyle={tooltipStyle} /><Legend wrapperStyle={{ fontSize: 12 }} /><Line type="monotone" dataKey="movimientos" name={t('Movimientos')} stroke="#2f7cff" strokeWidth={2} dot={false} animationDuration={800} /><Line type="monotone" dataKey="picking" name={t('Picking (uds)')} stroke="#0891b2" strokeWidth={2} dot={false} animationDuration={800} /><Line type="monotone" dataKey="transferencias" name={t('Transferencias (uds)')} stroke="#7c3aed" strokeWidth={2} dot={false} animationDuration={800} /></LineChart></ResponsiveContainer></div></Card>
        <Card title={t('Ocupación por zona')} bodyClass="p-2"><div className="h-60"><ResponsiveContainer><BarChart data={zones.map((z) => ({ name: z.zone.code, pct: z.pct, ocupado: z.occupied, capacidad: z.capacity, color: ZONE_TYPE[z.zone.type].color }))} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} /><XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} unit="%" /><YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={40} axisLine={false} tickLine={false} /><RTooltip contentStyle={tooltipStyle} formatter={(v, _n, p) => [`${v} % (${(p.payload as { ocupado: number }).ocupado}/${(p.payload as { capacidad: number }).capacidad})`, t('Ocupación')]} /><Bar dataKey="pct" name={t('Ocupación')} radius={[0, 4, 4, 0]} animationDuration={800}>{zones.map((z, i) => <Cell key={i} fill={ZONE_TYPE[z.zone.type].color} />)}</Bar></BarChart></ResponsiveContainer></div></Card>
        <Card title={t('Productos con mayor rotación')} subtitle={t('Unidades salidas o recogidas en el periodo')} bodyClass="p-2"><div className="h-60"><ResponsiveContainer><BarChart data={top.map((r) => ({ name: r.product.sku, uds: r.out }))} margin={{ top: 8, right: 8, left: -10, bottom: 30 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><RTooltip contentStyle={tooltipStyle} /><Bar dataKey="uds" name={t('Unidades')} fill="#2f7cff" radius={[4, 4, 0, 0]} animationDuration={800} /></BarChart></ResponsiveContainer></div></Card>
        <div className="grid grid-cols-2 gap-4">
          <Card title={t('Operaciones por tipo')} bodyClass="p-2"><div className="h-52"><ResponsiveContainer><PieChart><Pie data={byType} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={2} animationDuration={800}>{byType.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><RTooltip contentStyle={tooltipStyle} /><Legend wrapperStyle={{ fontSize: 10 }} /></PieChart></ResponsiveContainer></div></Card>
          <Card title={t('Pedidos por estado')} bodyClass="p-2"><div className="h-52"><ResponsiveContainer><PieChart><Pie data={ordersByStatus} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={2} animationDuration={800}>{ordersByStatus.map((_, i) => <Cell key={i} fill={PIE_COLORS[(i + 2) % PIE_COLORS.length]} />)}</Pie><RTooltip contentStyle={tooltipStyle} /><Legend wrapperStyle={{ fontSize: 10 }} /></PieChart></ResponsiveContainer></div></Card>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={t('Alertas de stock mínimo')} subtitle={t('{n} referencias', { n: low.length })} bodyClass="p-0"><ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto">{low.map(({ product, stock }) => <li key={product.id} className="flex items-center gap-2 px-4 py-2 text-sm"><span className="font-mono text-xs font-semibold">{product.sku}</span><span className="flex-1 truncate text-xs text-slate-500">{product.name}</span><span className="font-bold tabular-nums text-danger-600">{fmtInt(stock.available)}</span><span className="text-xs text-slate-400">/ {fmtInt(product.minStock)}</span></li>)}{low.length === 0 && <li className="p-4 text-center text-xs text-slate-400">{t('Sin alertas')}</li>}</ul></Card>
        <Card title={t('Productos sin movimiento en el periodo')} subtitle={t('{n} referencias', { n: idle.length })} bodyClass="p-0"><ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto">{idle.map((r) => <li key={r.product.id} className="flex items-center gap-2 px-4 py-2 text-sm"><span className="font-mono text-xs font-semibold">{r.product.sku}</span><span className="flex-1 truncate text-xs text-slate-500">{r.product.name}</span><Badge tone="neutral">{t(r.product.category)}</Badge></li>)}{idle.length === 0 && <li className="p-4 text-center text-xs text-slate-400">{t('Todas las referencias han tenido movimiento')}</li>}</ul></Card>
        <Card title={t('Productividad de picking')} subtitle={t('{n} líneas · {u} unidades', { n: picking.total, u: picking.units })} bodyClass="p-0"><ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto">{picking.byUser.map((u) => <li key={u.user} className="flex items-center gap-2 px-4 py-2 text-sm"><span className="flex-1 font-medium">{u.user}</span><span className="text-xs text-slate-500">{u.lines} {t('líneas')}</span><span className="font-bold tabular-nums">{fmtInt(u.units)} {t('uds')}</span></li>)}{picking.byUser.length === 0 && <li className="p-4 text-center text-xs text-slate-400">{t('Sin picking en el periodo')}</li>}</ul></Card>
        <Card title={t('Pedidos pendientes')} subtitle={t('{n} en cola', { n: pendingOrders.length })} bodyClass="p-0"><ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto">{pendingOrders.map((o) => <li key={o.id}><button onClick={() => navigate('pedidos', { pedido: o.id })} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-slate-50"><span className="font-mono text-xs font-semibold">{o.number}</span><span className="flex-1 truncate text-xs text-slate-500">{o.customer}</span>{orderShortages(state, o).length > 0 && <Badge tone="red">{t('faltantes')}</Badge>}<Badge tone={ORDER_STATUS[o.status].tone}>{t(ORDER_STATUS[o.status].label)}</Badge></button></li>)}{pendingOrders.length === 0 && <li className="p-4 text-center text-xs text-slate-400">{t('Sin pedidos pendientes')}</li>}</ul></Card>
        <Card title={t('Incidencias de recepción')} subtitle={t('{n} en el periodo', { n: incidents.length })} bodyClass="p-0" className="lg:col-span-2"><ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto">{incidents.map((r) => <li key={r.id}><button onClick={() => navigate('recepcion', { recepcion: r.id })} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-slate-50"><span className="font-mono text-xs font-semibold">{r.number}</span><span className="flex-1 truncate text-xs text-slate-500">{r.supplier} · {fmtDate(r.date)}</span><span className="text-xs text-slate-500">{r.lines.filter((l) => l.quantityReceived !== l.quantityExpected || l.quantityDamaged > 0 || l.qcResult === 'rechazado').map((l) => `${state.products[l.productId]?.sku}: ${l.quantityReceived}/${l.quantityExpected}${l.quantityDamaged ? ` (${l.quantityDamaged} ${t('dañadas')})` : ''}`).join(' · ')}</span><Badge tone={RECEIPT_STATUS[r.status].tone}>{t(RECEIPT_STATUS[r.status].label)}</Badge></button></li>)}{incidents.length === 0 && <li className="p-4 text-center text-xs text-slate-400">{t('Sin incidencias')}</li>}</ul></Card>
      </div>
      <p className="text-xs text-slate-400">{t('Periodo')}: {fmtDate(from)} – {fmtDate(to)} · {t('ocupación global')} {fmtPct(zones.reduce((a, z) => a + z.occupied, 0) / Math.max(1, zones.reduce((a, z) => a + z.capacity, 0)) * 100)}</p>
    </div>
  )
}
