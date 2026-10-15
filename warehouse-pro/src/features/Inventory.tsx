import { Archive, ArchiveRestore, Download, Edit3, Eye, History, Map as MapIcon, Plus, Search, Upload } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Badge, Button, Card, ConfirmDialog, DataTable, Field, Input, Modal, PageHeader, Select, Stat, Tabs, type Column } from '@/components/ui'
import { ops, productStock, values, type Product, type ProductStockSummary, type WarehouseState } from '@/domain'
import { useState$, useWarehouse } from '@/store/useWarehouse'
import { t } from '@/lib/i18n'
import { fmtDate, fmtInt, fmtNum } from '@/lib/format'
import { downloadCsv, parseCsv, toCsv } from '@/lib/csv'
import { FORM, MOVEMENT_TYPE, ROTATION, SIZE, SPECIAL, STOCK_STATE, TEMPERATURE } from '@/lib/labels'
import { navigate } from '@/lib/router'

type Row = { product: Product; stock: ProductStockSummary }

const emptyForm = { sku: '', name: '', barcode: '', category: 'Quesos', unit: 'ud', minStock: 10, weightKg: 1, volumeM3: 0.01, lot: '', expiryDate: '', rotation: 'media', special: 'ninguno', temperature: 'ambiente', form: 'caja', size: 'M', imageUrl: '', initialLocation: '', initialQty: 0 }
type FormState = typeof emptyForm

function validate(f: FormState, state: WarehouseState, editingId?: string) {
  const e: Partial<Record<keyof FormState, string>> = {}
  if (f.sku.trim().length < 2) e.sku = t('SKU obligatorio (mínimo 2 caracteres)')
  else if (values(state.products).some((p) => p.sku === f.sku.trim().toUpperCase() && p.id !== editingId)) e.sku = t('Este SKU ya existe')
  if (f.name.trim().length < 2) e.name = t('Nombre obligatorio')
  if (!Number.isInteger(Number(f.minStock)) || Number(f.minStock) < 0) e.minStock = t('Entero ≥ 0')
  if (Number(f.weightKg) < 0) e.weightKg = t('No puede ser negativo')
  if (Number(f.volumeM3) < 0) e.volumeM3 = t('No puede ser negativo')
  if (!editingId && Number(f.initialQty) < 0) e.initialQty = t('No puede ser negativo')
  if (!editingId && Number(f.initialQty) > 0 && !f.initialLocation) e.initialLocation = t('Indica la ubicación inicial')
  return e
}

export function Inventory({ params }: { params: Record<string, string> }) {
  const state = useState$()
  const dispatch = useWarehouse((s) => s.dispatch)
  const notify = useWarehouse((s) => s.notify)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [loc, setLoc] = useState('')
  const [avail, setAvail] = useState<'' | 'con_stock' | 'sin_stock' | 'reservado'>('')
  const [alert, setAlert] = useState(params.filtro ?? '')
  const [tab, setTab] = useState<'activos' | 'archivados'>('activos')
  const [editing, setEditing] = useState<{ id?: string; form: FormState } | null>(params.nuevo ? { form: { ...emptyForm } } : null)
  const [detail, setDetail] = useState<string | null>(params.producto ?? null)
  const [archiveId, setArchiveId] = useState<string | null>(null)
  const [importPreview, setImportPreview] = useState<{ rows: Record<string, string>[]; errors: string[] } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => { if (params.producto) setDetail(params.producto) }, [params.producto])

  const categories = useMemo(() => [...new Set(values(state.products).map((p) => p.category))].sort(), [state])
  const rows: Row[] = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return values(state.products)
      .filter((p) => (tab === 'activos' ? p.status === 'activo' : p.status === 'archivado'))
      .filter((p) => !needle || p.sku.toLowerCase().includes(needle) || p.name.toLowerCase().includes(needle) || p.barcode.includes(needle))
      .filter((p) => !cat || p.category === cat)
      .map((p) => ({ product: p, stock: productStock(state, p.id) }))
      .filter((r) => !loc || r.stock.locations.some((l) => l.locationId === loc || l.code.startsWith(loc)))
      .filter((r) => avail === '' || (avail === 'con_stock' ? r.stock.available > 0 : avail === 'sin_stock' ? r.stock.available === 0 : r.stock.reserved > 0))
      .filter((r) => alert === '' || (alert === 'bajo_minimo' ? r.stock.available < r.product.minStock : alert === 'caducidad' ? !!r.product.expiryDate && new Date(r.product.expiryDate).getTime() - Date.now() < 15 * 86400000 : alert === 'danado' ? r.stock.damaged > 0 : true))
  }, [state, q, cat, loc, avail, alert, tab])

  const columns: Column<Row>[] = [
    { key: 'img', header: '', render: (r) => <img src={r.product.imageUrl} alt="" className="h-8 w-8 rounded-md" />, width: '40px' },
    { key: 'sku', header: 'SKU', sort: (r) => r.product.sku, render: (r) => <span className="font-mono text-xs font-semibold text-navy-800">{r.product.sku}</span> },
    { key: 'name', header: t('Producto'), sort: (r) => r.product.name, render: (r) => <div><div className="font-medium text-slate-800">{r.product.name}</div><div className="text-[11px] text-slate-400">{r.product.barcode}</div></div> },
    { key: 'cat', header: t('Categoría'), sort: (r) => r.product.category, render: (r) => <Badge tone="neutral">{t(r.product.category)}</Badge> },
    { key: 'cond', header: t('Conservación'), render: (r) => <span className="text-xs" style={{ color: TEMPERATURE[r.product.temperature].color }}>{t(TEMPERATURE[r.product.temperature].short)} · {t(FORM[r.product.form])} · {r.product.size}</span> },
    { key: 'total', header: t('Total'), sort: (r) => r.stock.total, className: 'text-right tabular-nums', render: (r) => fmtInt(r.stock.total) },
    { key: 'reserved', header: t('Reservado'), sort: (r) => r.stock.reserved, className: 'text-right tabular-nums', render: (r) => <span className={r.stock.reserved ? 'text-warn-600' : ''}>{fmtInt(r.stock.reserved)}</span> },
    { key: 'available', header: t('Disponible'), sort: (r) => r.stock.available, className: 'text-right tabular-nums', render: (r) => <span className={`font-bold ${r.stock.available < r.product.minStock ? 'text-danger-600' : 'text-ok-600'}`}>{fmtInt(r.stock.available)}</span> },
    { key: 'min', header: t('Mínimo'), sort: (r) => r.product.minStock, className: 'text-right tabular-nums', render: (r) => fmtInt(r.product.minStock) },
    { key: 'locs', header: t('Ubicaciones'), render: (r) => <div className="flex max-w-[220px] flex-wrap gap-1">{r.stock.locations.slice(0, 3).map((l) => <button key={l.locationId + l.state} onClick={(e) => { e.stopPropagation(); navigate('mapa', { loc: l.locationId }) }} className="rounded bg-slate-100 px-1 font-mono text-[10px] hover:bg-electric-100">{l.code}</button>)}{r.stock.locations.length > 3 && <span className="text-[10px] text-slate-400">+{r.stock.locations.length - 3}</span>}</div> },
    { key: 'lot', header: t('Lote / caducidad'), sort: (r) => r.product.expiryDate ?? '', render: (r) => <span className={`text-xs ${r.product.expiryDate && new Date(r.product.expiryDate).getTime() - Date.now() < 15 * 86400000 ? 'font-semibold text-warn-600' : 'text-slate-500'}`}>{r.product.lot ?? '—'}{r.product.expiryDate ? ` · ${fmtDate(r.product.expiryDate)}` : ''}</span> },
    { key: 'status', header: t('Estado'), render: (r) => r.product.status === 'archivado' ? <Badge tone="neutral">{t('Archivado')}</Badge> : r.stock.available < r.product.minStock ? <Badge tone="red">{t('Bajo mínimo')}</Badge> : r.stock.damaged > 0 ? <Badge tone="orange">{t('Con dañados')}</Badge> : <Badge tone="green">{t('Correcto')}</Badge> },
    { key: 'actions', header: '', render: (r) => <div className="flex gap-1"><Button size="sm" variant="ghost" icon={<Eye className="h-4 w-4" />} onClick={(e) => { e.stopPropagation(); setDetail(r.product.id) }} aria-label={t('Ver ficha')} /><Button size="sm" variant="ghost" icon={<Edit3 className="h-4 w-4" />} onClick={(e) => { e.stopPropagation(); openEdit(r.product) }} aria-label={t('Editar')} /></div> },
  ]

  const openEdit = (p: Product) => setEditing({ id: p.id, form: { ...emptyForm, sku: p.sku, name: p.name, barcode: p.barcode, category: p.category, unit: p.unit, minStock: p.minStock, weightKg: p.weightKg, volumeM3: p.volumeM3, lot: p.lot ?? '', expiryDate: p.expiryDate ?? '', rotation: p.rotation, special: p.special, temperature: p.temperature, form: p.form, size: p.size, imageUrl: p.imageUrl ?? '' } })

  const exportCsv = () => {
    const data = rows.map(({ product: p, stock: s }) => ({ sku: p.sku, nombre: p.name, codigo_barras: p.barcode, categoria: p.category, unidad: p.unit, total: s.total, reservado: s.reserved, disponible: s.available, stock_minimo: p.minStock, ubicaciones: s.locations.map((l) => `${l.code}:${l.quantity}`).join('|'), lote: p.lot ?? '', caducidad: p.expiryDate ?? '', peso_kg: p.weightKg, volumen_m3: p.volumeM3, temperatura: p.temperature, forma: p.form, tamano: p.size, rotacion: p.rotation, estado: p.status }))
    downloadCsv(`inventario_${new Date().toISOString().slice(0, 10)}.csv`, toCsv(data))
    notify('success', t('Inventario exportado'), t('{n} referencias', { n: data.length }))
  }

  const onImportFile = async (file: File) => {
    const text = await file.text()
    const parsed = parseCsv(text)
    const errors: string[] = []
    const seen = new Set<string>()
    const valid = parsed.filter((r, i) => {
      const sku = (r.sku ?? '').toUpperCase()
      if (!sku) { errors.push(t('Fila {n}: falta el SKU', { n: i + 2 })); return false }
      if (seen.has(sku)) { errors.push(t('Fila {n}: SKU repetido en el fichero ({sku})', { n: i + 2, sku })); return false }
      seen.add(sku)
      if (values(state.products).some((p) => p.sku === sku)) { errors.push(t('Fila {n}: el SKU {sku} ya existe', { n: i + 2, sku })); return false }
      if (!r.nombre) { errors.push(t('Fila {n}: falta el nombre', { n: i + 2 })); return false }
      if (r.stock_minimo && (!/^\d+$/.test(r.stock_minimo))) { errors.push(t('Fila {n}: stock mínimo no válido', { n: i + 2 })); return false }
      return true
    })
    setImportPreview({ rows: valid, errors })
  }
  const confirmImport = () => {
    if (!importPreview) return
    let count = 0
    for (const r of importPreview.rows) {
      const res = dispatch((s) => ops.createProduct(s, { sku: r.sku, name: r.nombre, barcode: r.codigo_barras || undefined, category: r.categoria || 'General', unit: r.unidad || 'ud', minStock: Number(r.stock_minimo || 0), weightKg: Number(r.peso_kg || 0), volumeM3: Number(r.volumen_m3 || 0), lot: r.lote || undefined, expiryDate: r.caducidad || undefined, rotation: (['alta', 'media', 'baja'].includes(r.rotacion) ? r.rotacion : 'media') as Product['rotation'], special: 'ninguno', temperature: (['ambiente', 'fresco', 'refrigerado', 'congelado'].includes(r.temperatura) ? r.temperatura : 'ambiente') as Product['temperature'], form: (Object.keys(FORM).includes(r.forma) ? r.forma : 'caja') as Product['form'], size: (['S', 'M', 'L'].includes(r.tamano) ? r.tamano : 'M') as Product['size'] }))
      if (res.ok) count++
    }
    notify('success', t('Importación completada'), t('{n} productos creados', { n: count }))
    setImportPreview(null)
  }

  const save = () => {
    if (!editing) return
    const f = editing.form
    const errs = validate(f, state, editing.id)
    if (Object.keys(errs).length) { setEditing({ ...editing, form: { ...f } }); setFormErrors(errs); return }
    const input = { sku: f.sku, name: f.name, barcode: f.barcode || undefined, category: f.category, unit: f.unit, minStock: Number(f.minStock), weightKg: Number(f.weightKg), volumeM3: Number(f.volumeM3), lot: f.lot || undefined, expiryDate: f.expiryDate || undefined, rotation: f.rotation as Product['rotation'], special: f.special as Product['special'], temperature: f.temperature as Product['temperature'], form: f.form as Product['form'], size: f.size as Product['size'], imageUrl: f.imageUrl || `img/${f.category.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s.*/, '')}.svg` }
    const r = editing.id ? dispatch((s) => ops.updateProduct(s, editing.id!, input), t('Producto actualizado')) : dispatch((s) => ops.createProduct(s, input, Number(f.initialQty) > 0 ? { locationId: f.initialLocation, quantity: Number(f.initialQty) } : undefined), t('Producto creado'))
    if (r.ok) { setEditing(null); setFormErrors({}) }
  }
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const setF = (k: keyof FormState, v: string | number) => editing && setEditing({ ...editing, form: { ...editing.form, [k]: v } })

  const totals = { skus: rows.length, units: rows.reduce((a, r) => a + r.stock.total, 0), available: rows.reduce((a, r) => a + r.stock.available, 0), low: rows.filter((r) => r.stock.available < r.product.minStock).length }
  const detailProduct = detail ? state.products[detail] : null
  const detailStock = detailProduct ? productStock(state, detailProduct.id) : null
  const detailMovs = detailProduct ? values(state.movements).filter((m) => m.productId === detailProduct.id).sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 30) : []

  return (
    <div className="space-y-4">
      <PageHeader title={t('Inventario')} description={t('Referencias, existencias por ubicación, reservas y alertas')} actions={<>
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && onImportFile(e.target.files[0])} />
        <Button variant="outline" icon={<Upload className="h-4 w-4" />} onClick={() => fileRef.current?.click()}>{t('Importar CSV')}</Button>
        <Button variant="outline" icon={<Download className="h-4 w-4" />} onClick={exportCsv} disabled={rows.length === 0}>{t('Exportar CSV')}</Button>
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => { setEditing({ form: { ...emptyForm } }); setFormErrors({}) }}>{t('Añadir producto')}</Button>
      </>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t('Referencias')} value={fmtInt(totals.skus)} /><Stat label={t('Unidades totales')} value={fmtInt(totals.units)} /><Stat label={t('Disponibles')} value={fmtInt(totals.available)} tone="green" /><Stat label={t('Bajo mínimo')} value={fmtInt(totals.low)} tone={totals.low ? 'red' : undefined} />
      </div>
      <Card bodyClass="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs"><Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Buscar por nombre, SKU o código de barras')} className="pl-8" /></div>
          <Select value={cat} onChange={(e) => setCat(e.target.value)} className="w-auto"><option value="">{t('Todas las categorías')}</option>{categories.map((c) => <option key={c} value={c}>{t(c)}</option>)}</Select>
          <Select value={loc} onChange={(e) => setLoc(e.target.value)} className="w-auto"><option value="">{t('Cualquier ubicación')}</option>{values(state.zones).map((z) => <option key={z.id} value={z.code + '-'}>{t('Zona')} {z.code}</option>)}</Select>
          <Select value={avail} onChange={(e) => setAvail(e.target.value as typeof avail)} className="w-auto"><option value="">{t('Disponibilidad')}</option><option value="con_stock">{t('Con stock disponible')}</option><option value="sin_stock">{t('Sin disponible')}</option><option value="reservado">{t('Con reservas')}</option></Select>
          <Select value={alert} onChange={(e) => setAlert(e.target.value)} className="w-auto"><option value="">{t('Todas las alertas')}</option><option value="bajo_minimo">{t('Bajo mínimo')}</option><option value="caducidad">{t('Caducidad < 15 días')}</option><option value="danado">{t('Con unidades dañadas')}</option></Select>
          <div className="ml-auto"><Tabs tabs={[{ id: 'activos', label: t('Activos'), count: values(state.products).filter((p) => p.status === 'activo').length }, { id: 'archivados', label: t('Archivados'), count: values(state.products).filter((p) => p.status === 'archivado').length }]} value={tab} onChange={setTab} /></div>
        </div>
        <DataTable rows={rows} columns={columns} rowKey={(r) => r.product.id} onRowClick={(r) => setDetail(r.product.id)} emptyTitle={t('No hay productos que coincidan')} emptyDescription={t('Prueba con otros filtros o crea un producto nuevo.')} initialSort={{ key: 'sku', dir: 'asc' }} />
      </Card>

      {/* Ficha de producto */}
      <Modal open={!!detailProduct} onClose={() => setDetail(null)} title={detailProduct ? `${detailProduct.sku} · ${detailProduct.name}` : ''} size="lg" footer={detailProduct && <>
        {detailProduct.status === 'activo' ? <Button variant="outline" icon={<Archive className="h-4 w-4" />} onClick={() => setArchiveId(detailProduct.id)}>{t('Archivar')}</Button> : <Button variant="outline" icon={<ArchiveRestore className="h-4 w-4" />} onClick={() => dispatch((s) => ops.restoreProduct(s, detailProduct.id), t('Producto restaurado'))}>{t('Restaurar')}</Button>}
        <Button variant="outline" icon={<MapIcon className="h-4 w-4" />} onClick={() => navigate('mapa', { sku: detailProduct.id })}>{t('Ver en el plano')}</Button>
        <Button variant="outline" icon={<History className="h-4 w-4" />} onClick={() => navigate('historial', { sku: detailProduct.sku })}>{t('Historial completo')}</Button>
        <Button icon={<Edit3 className="h-4 w-4" />} onClick={() => { openEdit(detailProduct); setDetail(null) }}>{t('Editar')}</Button>
      </>}>
        {detailProduct && detailStock && (
          <div className="space-y-4">
            <div className="flex gap-4">
              <img src={detailProduct.imageUrl} alt="" className="h-24 w-24 rounded-xl border border-slate-200" />
              <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label={t('Total')} value={fmtInt(detailStock.total)} /><Stat label={t('Disponible')} value={fmtInt(detailStock.available)} tone={detailStock.available < detailProduct.minStock ? 'red' : 'green'} /><Stat label={t('Reservado')} value={fmtInt(detailStock.reserved)} tone="orange" /><Stat label={t('Cuarentena / dañado')} value={`${fmtInt(detailStock.quarantine)} / ${fmtInt(detailStock.damaged)}`} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
              <div><span className="text-slate-500">{t('Código de barras')}:</span> <span className="font-mono">{detailProduct.barcode}</span></div>
              <div><span className="text-slate-500">{t('Categoría')}:</span> {t(detailProduct.category)}</div>
              <div><span className="text-slate-500">{t('Stock mínimo')}:</span> {fmtInt(detailProduct.minStock)} {detailProduct.unit}</div>
              <div><span className="text-slate-500">{t('Temperatura')}:</span> {t(TEMPERATURE[detailProduct.temperature].label)}</div>
              <div><span className="text-slate-500">{t('Forma')}:</span> {t(FORM[detailProduct.form])} · {t(SIZE[detailProduct.size])}</div>
              <div><span className="text-slate-500">{t('Peso / volumen')}:</span> {fmtNum(detailProduct.weightKg, 2)} kg · {fmtNum(detailProduct.volumeM3, 3)} m³</div>
              <div><span className="text-slate-500">{t('Rotación')}:</span> {t(ROTATION[detailProduct.rotation])}</div>
              <div><span className="text-slate-500">{t('Manipulación')}:</span> {t(SPECIAL[detailProduct.special])}</div>
              <div><span className="text-slate-500">{t('Lote / caducidad')}:</span> {detailProduct.lot ?? '—'} · {fmtDate(detailProduct.expiryDate)}</div>
            </div>
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('Ubicaciones')}</h4>
              <div className="flex flex-wrap gap-1.5">{detailStock.locations.map((l) => <button key={l.locationId + l.state} onClick={() => navigate('mapa', { loc: l.locationId })} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs hover:border-electric-400"><span className="font-mono font-semibold">{l.code}</span><span>×{fmtInt(l.quantity)}</span><Badge tone={STOCK_STATE[l.state].tone}>{t(STOCK_STATE[l.state].label)}</Badge></button>)}{detailStock.locations.length === 0 && <span className="text-xs text-slate-400">{t('Sin stock ubicado')}</span>}</div>
            </div>
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('Últimos movimientos')}</h4>
              <ul className="max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-100">
                {detailMovs.map((m) => <li key={m.id} className="flex items-center gap-2 px-2 py-1.5 text-xs"><Badge tone={MOVEMENT_TYPE[m.type].tone}>{t(MOVEMENT_TYPE[m.type].label)}</Badge><span className="font-semibold tabular-nums">{fmtInt(m.quantity)}</span><span className="font-mono text-slate-500">{m.fromLocationId ? state.locations[m.fromLocationId]?.code : ''}{m.fromLocationId && m.toLocationId ? ' → ' : ''}{m.toLocationId ? state.locations[m.toLocationId]?.code : ''}</span><span className="truncate text-slate-400">{m.reference}</span><span className="ml-auto whitespace-nowrap text-slate-400">{fmtDate(m.timestamp)}</span></li>)}
                {detailMovs.length === 0 && <li className="p-3 text-center text-xs text-slate-400">{t('Sin movimientos')}</li>}
              </ul>
            </div>
          </div>
        )}
      </Modal>
      <ConfirmDialog open={!!archiveId} onClose={() => setArchiveId(null)} danger confirmLabel={t('Archivar')} title={t('Archivar producto')} message={t('El producto dejará de estar disponible para pedidos y recepciones. Solo se puede archivar si no tiene stock ni reservas.')} onConfirm={() => { if (archiveId) { const r = dispatch((s) => ops.archiveProduct(s, archiveId), t('Producto archivado')); if (r.ok) setDetail(null) } setArchiveId(null) }} />

      {/* Alta / edición */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? t('Editar producto') : t('Nuevo producto')} size="lg" footer={<><Button variant="outline" onClick={() => setEditing(null)}>{t('Cancelar')}</Button><Button onClick={save}>{editing?.id ? t('Guardar cambios') : t('Crear producto')}</Button></>}>
        {editing && (
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" onSubmit={(e) => { e.preventDefault(); save() }}>
            <Field label="SKU" error={formErrors.sku}><Input value={editing.form.sku} onChange={(e) => setF('sku', e.target.value.toUpperCase())} placeholder="QUE-MAN-008" aria-invalid={!!formErrors.sku} autoFocus /></Field>
            <Field label={t('Nombre')} error={formErrors.name} className="sm:col-span-2"><Input value={editing.form.name} onChange={(e) => setF('name', e.target.value)} aria-invalid={!!formErrors.name} /></Field>
            <Field label={t('Código de barras')} hint={t('Se genera uno si se deja vacío')}><Input value={editing.form.barcode} onChange={(e) => setF('barcode', e.target.value)} /></Field>
            <Field label={t('Categoría')}><Input list="cats" value={editing.form.category} onChange={(e) => setF('category', e.target.value)} /><datalist id="cats">{categories.map((c) => <option key={c} value={c} />)}</datalist></Field>
            <Field label={t('Unidad')}><Input value={editing.form.unit} onChange={(e) => setF('unit', e.target.value)} /></Field>
            <Field label={t('Stock mínimo')} error={formErrors.minStock}><Input type="number" min={0} value={editing.form.minStock} onChange={(e) => setF('minStock', e.target.value)} aria-invalid={!!formErrors.minStock} /></Field>
            <Field label={t('Peso (kg)')} error={formErrors.weightKg}><Input type="number" step="0.01" min={0} value={editing.form.weightKg} onChange={(e) => setF('weightKg', e.target.value)} /></Field>
            <Field label={t('Volumen (m³)')} error={formErrors.volumeM3}><Input type="number" step="0.001" min={0} value={editing.form.volumeM3} onChange={(e) => setF('volumeM3', e.target.value)} /></Field>
            <Field label={t('Temperatura de conservación')}><Select value={editing.form.temperature} onChange={(e) => setF('temperature', e.target.value)}>{Object.entries(TEMPERATURE).map(([k, v]) => <option key={k} value={k}>{t(v.label)}</option>)}</Select></Field>
            <Field label={t('Forma logística')}><Select value={editing.form.form} onChange={(e) => setF('form', e.target.value)}>{Object.entries(FORM).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}</Select></Field>
            <Field label={t('Tamaño de unidad')} hint={t('L solo en nivel 1 y suelo; S en cualquier hueco')}><Select value={editing.form.size} onChange={(e) => setF('size', e.target.value)}>{Object.entries(SIZE).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}</Select></Field>
            <Field label={t('Rotación')}><Select value={editing.form.rotation} onChange={(e) => setF('rotation', e.target.value)}>{Object.entries(ROTATION).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}</Select></Field>
            <Field label={t('Manipulación especial')}><Select value={editing.form.special} onChange={(e) => setF('special', e.target.value)}>{Object.entries(SPECIAL).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}</Select></Field>
            <Field label={t('Lote')}><Input value={editing.form.lot} onChange={(e) => setF('lot', e.target.value)} /></Field>
            <Field label={t('Fecha de caducidad')}><Input type="date" value={editing.form.expiryDate} onChange={(e) => setF('expiryDate', e.target.value)} /></Field>
            <Field label={t('Imagen (URL opcional)')} className="sm:col-span-2"><Input value={editing.form.imageUrl} onChange={(e) => setF('imageUrl', e.target.value)} placeholder="https://…" /></Field>
            {!editing.id && <>
              <Field label={t('Stock inicial')} error={formErrors.initialQty}><Input type="number" min={0} value={editing.form.initialQty} onChange={(e) => setF('initialQty', e.target.value)} /></Field>
              <Field label={t('Ubicación inicial')} error={formErrors.initialLocation} className="sm:col-span-2"><Select value={editing.form.initialLocation} onChange={(e) => setF('initialLocation', e.target.value)}><option value="">{t('Sin ubicar (se ubicará en recepción)')}</option>{values(state.locations).filter((l) => l.kind !== 'muelle' && !l.blocked).sort((a, b) => a.code.localeCompare(b.code)).map((l) => <option key={l.id} value={l.id}>{l.code} · {t(state.zones[l.zoneId]?.name ?? '')}</option>)}</Select></Field>
            </>}
          </form>
        )}
      </Modal>

      <Modal open={!!importPreview} onClose={() => setImportPreview(null)} title={t('Importar productos desde CSV')} size="lg" footer={<><Button variant="outline" onClick={() => setImportPreview(null)}>{t('Cancelar')}</Button><Button onClick={confirmImport} disabled={!importPreview?.rows.length}>{t('Importar {n} productos', { n: importPreview?.rows.length ?? 0 })}</Button></>}>
        {importPreview && (
          <div className="space-y-3 text-sm">
            <p className="text-slate-600">{t('Columnas reconocidas')}: <code className="rounded bg-slate-100 px-1 text-xs">sku; nombre; codigo_barras; categoria; unidad; stock_minimo; peso_kg; volumen_m3; lote; caducidad; temperatura; forma; tamano; rotacion</code></p>
            {importPreview.errors.length > 0 && <div className="rounded-lg bg-danger-100 p-3 text-xs text-danger-600"><b>{t('{n} filas descartadas', { n: importPreview.errors.length })}:</b><ul className="mt-1 list-inside list-disc">{importPreview.errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}</ul></div>}
            <div className="max-h-64 overflow-auto rounded-lg border border-slate-200"><table className="w-full text-xs"><thead><tr><th className="th">SKU</th><th className="th">{t('Nombre')}</th><th className="th">{t('Categoría')}</th><th className="th">{t('Mínimo')}</th></tr></thead><tbody>{importPreview.rows.map((r) => <tr key={r.sku}><td className="td font-mono">{r.sku}</td><td className="td">{r.nombre}</td><td className="td">{r.categoria}</td><td className="td">{r.stock_minimo}</td></tr>)}</tbody></table></div>
          </div>
        )}
      </Modal>
    </div>
  )
}
