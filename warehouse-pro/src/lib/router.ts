import { useEffect, useState } from 'react'

export type Page =
  | 'dashboard' | 'mapa' | 'inventario' | 'recepcion' | 'ubicaciones' | 'pedidos' | 'expediciones'
  | 'transferencias' | 'devoluciones' | 'historial' | 'informes' | 'configuracion'

export interface Route { page: Page; params: Record<string, string> }

const PAGES: Page[] = ['dashboard', 'mapa', 'inventario', 'recepcion', 'ubicaciones', 'pedidos', 'expediciones', 'transferencias', 'devoluciones', 'historial', 'informes', 'configuracion']

export function parseHash(hash: string): Route {
  const h = hash.replace(/^#\/?/, '')
  const [path, query = ''] = h.split('?')
  const page = (PAGES.includes(path as Page) ? path : 'dashboard') as Page
  const params: Record<string, string> = {}
  new URLSearchParams(query).forEach((v, k) => (params[k] = v))
  return { page, params }
}

export function navigate(page: Page, params: Record<string, string> = {}) {
  const q = new URLSearchParams(params).toString()
  window.location.hash = `/${page}${q ? `?${q}` : ''}`
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash))
  useEffect(() => {
    const on = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}
