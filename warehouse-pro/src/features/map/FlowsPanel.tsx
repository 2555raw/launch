import { Modal } from '@/components/ui'
import { t } from '@/lib/i18n'

function MiniWarehouse({ kind }: { kind: 'u' | 'recta' }) {
  const racks = [60, 110, 160, 210, 260]
  const path = kind === 'u'
    ? 'M 40 215 L 40 60 L 320 60 L 320 215'
    : 'M 180 225 L 180 20'
  return (
    <svg viewBox="0 0 360 240" className="w-full rounded-lg border border-slate-200 bg-slate-50">
      <rect x="20" y="20" width="320" height="190" rx="4" fill="#fff" stroke="#334155" strokeWidth="3" />
      {racks.map((x) => <g key={x}><rect x={x} y="55" width="14" height="110" fill="#c7d2fe" stroke="#1e3a8a" strokeWidth="1" /><rect x={x + 22} y="55" width="14" height="110" fill="#c7d2fe" stroke="#1e3a8a" strokeWidth="1" /></g>)}
      <rect x="25" y="175" width="120" height="30" fill="#dbeafe" stroke="#2563eb" /><text x="85" y="194" textAnchor="middle" fontSize="9" fontWeight="700" fill="#1e40af">{t('Recepción')}</text>
      {kind === 'u' ? (
        <>
          <rect x="215" y="175" width="120" height="30" fill="#dcfce7" stroke="#16a34a" /><text x="275" y="194" textAnchor="middle" fontSize="9" fontWeight="700" fill="#166534">{t('Expedición')}</text>
          <rect x="40" y="210" width="30" height="8" fill="#334155" /><rect x="80" y="210" width="30" height="8" fill="#334155" /><rect x="250" y="210" width="30" height="8" fill="#334155" /><rect x="290" y="210" width="30" height="8" fill="#334155" />
        </>
      ) : (
        <>
          <rect x="215" y="25" width="120" height="30" fill="#dcfce7" stroke="#16a34a" /><text x="275" y="44" textAnchor="middle" fontSize="9" fontWeight="700" fill="#166534">{t('Expedición')}</text>
          <rect x="40" y="210" width="30" height="8" fill="#334155" /><rect x="80" y="210" width="30" height="8" fill="#334155" /><rect x="250" y="12" width="30" height="8" fill="#334155" /><rect x="290" y="12" width="30" height="8" fill="#334155" />
        </>
      )}
      <path d={path} fill="none" stroke="#f97316" strokeWidth="14" strokeLinejoin="round" strokeLinecap="round" opacity="0.25" />
      <path d={path} fill="none" stroke="#f97316" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round" className="flow-path" markerEnd="url(#flow-arrow)" />
      <defs><marker id="flow-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#f97316" /></marker></defs>
    </svg>
  )
}

export function FlowsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title={t('Ingeniería de flujos: diseño en U frente a línea recta')} size="xl">
      <p className="mb-4 text-sm text-slate-600">{t('El layout define la velocidad del almacén. BETO S.L. utiliza un flujo en U: recepción y expedición comparten el mismo frente de muelles, lo que facilita el cross-docking y el uso compartido de personal y carretillas. El flujo en línea recta separa físicamente entradas y salidas en frentes opuestos.')}</p>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="card p-4">
          <div className="mb-2 flex items-center gap-2"><span className="rounded bg-electric-600 px-2 py-0.5 text-xs font-bold text-white">{t('ACTIVO')}</span><h3 className="text-base font-bold text-navy-900">{t('Flujo en U')}</h3></div>
          <MiniWarehouse kind="u" />
          <ul className="mt-3 space-y-1 text-sm text-slate-600">
            <li>• {t('Recepción y expedición en el mismo frente.')}</li>
            <li>• {t('Facilita el cruce de muelles (cross-docking).')}</li>
            <li>• {t('Optimiza personal y carretillas compartidos.')}</li>
            <li>• {t('Los productos de alta rotación se sitúan en el fondo de la U, junto a picking y expedición.')}</li>
          </ul>
        </div>
        <div className="card p-4">
          <h3 className="mb-2 text-base font-bold text-navy-900">{t('Flujo en línea recta')}</h3>
          <MiniWarehouse kind="recta" />
          <ul className="mt-3 space-y-1 text-sm text-slate-600">
            <li>• {t('Accesos independientes para entradas y salidas.')}</li>
            <li>• {t('Evita cuellos de botella al separar físicamente los flujos.')}</li>
            <li>• {t('Ideal para procesos de manufactura o adaptación intermedia.')}</li>
            <li>• {t('Requiere más superficie de muelles y doble dotación de personal.')}</li>
          </ul>
        </div>
      </div>
      <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
        <b>{t('Reglas de distribución aplicadas en este plano')}:</b> {t('pasillos rectos orientados a las puertas de acceso, sin estanterías pegadas a las paredes salvo donde hay puertas, sentido único de circulación por pasillo (direccionalidad), anchura de pasillo compatible con carretilla retráctil y codificación en peine: módulos impares a la izquierda, pares a la derecha, niveles numerados desde el suelo.')}
      </div>
    </Modal>
  )
}
