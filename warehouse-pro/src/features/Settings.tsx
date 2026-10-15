import { AlertTriangle, Database, Download, RefreshCw, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button, Card, ConfirmDialog, Field, Input, PageHeader, Select } from '@/components/ui'
import { integrityIssues, ops, values } from '@/domain'
import { useState$, useWarehouse } from '@/store/useWarehouse'
import { LANGS, t, useI18n } from '@/lib/i18n'
import { ROLES } from '@/lib/roles'
import { fmtInt } from '@/lib/format'

export function SettingsPage() {
  const state = useState$()
  const dispatch = useWarehouse((s) => s.dispatch)
  const resetDemo = useWarehouse((s) => s.resetDemo)
  const clearAll = useWarehouse((s) => s.clearAll)
  const repoKind = useWarehouse((s) => s.repoKind)
  const notify = useWarehouse((s) => s.notify)
  const lang = useI18n((s) => s.lang)
  const setLang = useI18n((s) => s.setLang)
  const [resetOpen, setResetOpen] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)
  const [form, setForm] = useState({ ...state.settings })
  const fileRef = useRef<HTMLInputElement>(null)
  const issues = integrityIssues(state)
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `warehouse-pro_${new Date().toISOString().slice(0, 10)}.json`; a.click()
  }
  const importJson = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text())
      if (!parsed.products || !parsed.locations || !parsed.stock) throw new Error(t('El fichero no contiene un estado válido'))
      const r = dispatch(() => ({ ...parsed, updatedAt: new Date().toISOString() }), t('Copia de seguridad restaurada'))
      if (!r.ok) throw r.error
    } catch (e) { notify('error', t('No se pudo importar'), e instanceof Error ? e.message : String(e)) }
  }
  const counts = { productos: values(state.products).length, ubicaciones: values(state.locations).length, stock: values(state.stock).length, pedidos: values(state.orders).length, recepciones: values(state.receipts).length, expediciones: values(state.shipments).length, transferencias: values(state.transfers).length, devoluciones: values(state.returns).length, movimientos: values(state.movements).length }
  return (
    <div className="space-y-4">
      <PageHeader title={t('Configuración')} description={t('Parámetros del almacén, idioma, datos de demostración y copias de seguridad')} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t('Parámetros generales')}>
          <div className="space-y-3">
            <Field label={t('Nombre del almacén / empresa')}><Input value={form.warehouseName} onChange={(e) => setForm({ ...form, warehouseName: e.target.value })} /></Field>
            <Field label={t('Puesto de trabajo')} hint={t('Determina las secciones y acciones disponibles')}><Select value={form.currentRole ?? 'jefe'} onChange={(e) => setForm({ ...form, currentRole: e.target.value })}>{ROLES.map((r) => <option key={r.id} value={r.id}>{t(r.label)} · {t(r.description)}</option>)}</Select></Field>
            <Field label={t('Usuario operativo actual')} hint={t('Se registra como responsable en los movimientos')}><Input value={form.currentUser} onChange={(e) => setForm({ ...form, currentUser: e.target.value })} /></Field>
            <Field label={t('Control de calidad por defecto en recepciones')}><Select value={form.defaultRequiresQc ? '1' : '0'} onChange={(e) => setForm({ ...form, defaultRequiresQc: e.target.value === '1' })}><option value="1">{t('Requerido (cuarentena)')}</option><option value="0">{t('No requerido')}</option></Select></Field>
            <Field label={t('Idioma de la interfaz')}><Select value={lang} onChange={(e) => setLang(e.target.value as typeof lang)}>{LANGS.map((l) => <option key={l.id} value={l.id}>{l.flag} {l.label}</option>)}</Select></Field>
            <Button onClick={() => dispatch((s) => ops.updateSettings(s, form), t('Configuración guardada'))}>{t('Guardar configuración')}</Button>
          </div>
        </Card>
        <Card title={t('Datos y persistencia')} subtitle={`${t('Almacenamiento')}: ${repoKind} · ${t('versión del modelo')} ${state.version}`}>
          <div className="mb-3 grid grid-cols-3 gap-2 text-xs">{Object.entries(counts).map(([k, v]) => <div key={k} className="rounded-lg bg-slate-50 px-2 py-1.5"><div className="text-slate-500">{t(k)}</div><div className="font-bold tabular-nums">{fmtInt(v)}</div></div>)}</div>
          <div className={`mb-3 rounded-lg p-3 text-xs ${issues.length ? 'bg-danger-100 text-danger-600' : 'bg-ok-100 text-ok-600'}`}><Database className="mr-1 inline h-4 w-4" />{issues.length ? `${t('Incoherencias detectadas')}: ${issues.join(' · ')}` : t('Comprobación de integridad correcta: sin cantidades negativas, reservas dentro del stock y capacidades respetadas.')}</div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" icon={<Download className="h-4 w-4" />} onClick={exportJson}>{t('Exportar copia (JSON)')}</Button>
            <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
            <Button variant="outline" icon={<Upload className="h-4 w-4" />} onClick={() => fileRef.current?.click()}>{t('Importar copia')}</Button>
            <Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} onClick={() => setResetOpen(true)}>{t('Restaurar almacén de ejemplo')}</Button>
            <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setClearOpen(true)}>{t('Vaciar almacén')}</Button>
          </div>
          <p className="mt-3 text-xs text-slate-500"><AlertTriangle className="mr-1 inline h-3.5 w-3.5 text-warn-500" />{t('Versión local: los datos se guardan en el navegador (IndexedDB) de este equipo. Para varios trabajadores compartiendo el mismo inventario se necesita un backend con base de datos, autenticación y sincronización; la capa de datos está preparada para sustituirse por una API.')}</p>
        </Card>
      </div>
      <Card title={t('Atajos de teclado')}>
        <ul className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <li><span className="kbd">Ctrl</span> + <span className="kbd">K</span> {t('o')} <span className="kbd">/</span> · {t('búsqueda rápida')}</li>
          <li><span className="kbd">Alt</span> + <span className="kbd">1</span>…<span className="kbd">0</span> · {t('cambiar de sección')}</li>
          <li><span className="kbd">Esc</span> · {t('cerrar ventana')}</li>
          <li><span className="kbd">Rueda</span> · {t('zoom en el plano')}</li>
        </ul>
      </Card>
      <ConfirmDialog open={resetOpen} onClose={() => setResetOpen(false)} title={t('Restaurar almacén de ejemplo')} confirmLabel={t('Restaurar')} danger message={t('Se sustituirá TODO el contenido actual por los datos de demostración (32 referencias, 6 pasillos, pedidos, recepciones y movimientos de ejemplo). Esta acción no se puede deshacer.')} onConfirm={() => { resetDemo(); setResetOpen(false) }} />
      <ConfirmDialog open={clearOpen} onClose={() => setClearOpen(false)} title={t('Vaciar almacén')} confirmLabel={t('Vaciar')} danger message={t('Se eliminarán productos, stock, pedidos y movimientos. Se conservarán las zonas y ubicaciones del plano.')} onConfirm={() => { clearAll(); setClearOpen(false) }} />
    </div>
  )
}
