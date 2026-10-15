import { useEffect } from 'react'
import { useWarehouse } from '@/store/useWarehouse'
import { useRoute } from '@/lib/router'
import { Shell } from '@/components/Shell'
import { Spinner, Toasts } from '@/components/ui'
import { Dashboard } from '@/features/Dashboard'
import { WarehouseMap } from '@/features/map/WarehouseMap'
import { Inventory } from '@/features/Inventory'
import { Receipts } from '@/features/Receipts'
import { Locations } from '@/features/Locations'
import { Orders } from '@/features/Orders'
import { Shipments } from '@/features/Shipments'
import { Transfers } from '@/features/Transfers'
import { Returns } from '@/features/Returns'
import { HistoryPage } from '@/features/History'
import { Reports } from '@/features/Reports'
import { SettingsPage } from '@/features/Settings'
import { t, useI18n } from '@/lib/i18n'
import '@/lib/translations'

export default function App() {
  const init = useWarehouse((s) => s.init)
  const loading = useWarehouse((s) => s.loading)
  const route = useRoute()
  const lang = useI18n((s) => s.lang)
  useEffect(() => { init() }, [init])
  useEffect(() => { document.documentElement.lang = lang === 'zh' ? 'zh-CN' : lang }, [lang])

  const pages = {
    dashboard: <Dashboard />,
    mapa: <WarehouseMap params={route.params} />,
    inventario: <Inventory params={route.params} />,
    recepcion: <Receipts params={route.params} />,
    ubicaciones: <Locations params={route.params} />,
    pedidos: <Orders params={route.params} />,
    expediciones: <Shipments params={route.params} />,
    transferencias: <Transfers params={route.params} />,
    devoluciones: <Returns params={route.params} />,
    historial: <HistoryPage params={route.params} />,
    informes: <Reports />,
    configuracion: <SettingsPage />,
  }

  return (
    <>
      <div key={lang} className="h-full"><Shell page={route.page}>{loading ? <Spinner label={t('Cargando el almacén desde el almacenamiento local…')} /> : <div key={route.page} className="animate-fade-in">{pages[route.page]}</div>}</Shell></div>
      <Toasts />
    </>
  )
}
