import type { Page } from './router'

export type RoleId = 'jefe' | 'recepcion' | 'preparador' | 'expedicion'
export type Capability =
  | 'config' | 'demo.reset' | 'products.edit' | 'products.import' | 'locations.edit' | 'locations.block' | 'adjust'
  | 'receipts' | 'orders.create' | 'orders.cancel' | 'picking' | 'shipments' | 'transfers' | 'returns.register' | 'returns.inspect' | 'reports'

export interface Role {
  id: RoleId
  label: string
  description: string
  defaultUser: string
  color: string
  pages: Page[]
  caps: Capability[]
  /** Página de inicio del puesto */
  home: Page
}

const ALL_PAGES: Page[] = ['dashboard', 'mapa', 'inventario', 'recepcion', 'ubicaciones', 'pedidos', 'expediciones', 'transferencias', 'devoluciones', 'historial', 'informes', 'configuracion']

export const ROLES: Role[] = [
  {
    id: 'jefe', label: 'Jefe de almacén', description: 'Acceso completo: configuración, informes, bloqueos, ajustes y todas las operaciones.', defaultUser: 'Jordi (jefe de almacén)', color: '#1e3a8a',
    pages: ALL_PAGES, home: 'dashboard',
    caps: ['config', 'demo.reset', 'products.edit', 'products.import', 'locations.edit', 'locations.block', 'adjust', 'receipts', 'orders.create', 'orders.cancel', 'picking', 'shipments', 'transfers', 'returns.register', 'returns.inspect', 'reports'],
  },
  {
    id: 'recepcion', label: 'Operario de recepción', description: 'Entradas de mercancía, control de calidad, ubicación y registro de devoluciones.', defaultUser: 'Eva (recepción)', color: '#2563eb',
    pages: ['dashboard', 'mapa', 'recepcion', 'inventario', 'ubicaciones', 'transferencias', 'devoluciones', 'historial'], home: 'recepcion',
    caps: ['receipts', 'transfers', 'returns.register', 'returns.inspect'],
  },
  {
    id: 'preparador', label: 'Preparador de pedidos', description: 'Lista de picking, recogidas, rutas en el plano y reposición entre ubicaciones.', defaultUser: 'Lucía (picking)', color: '#0891b2',
    pages: ['dashboard', 'mapa', 'pedidos', 'inventario', 'transferencias', 'historial'], home: 'pedidos',
    caps: ['picking', 'transfers'],
  },
  {
    id: 'expedicion', label: 'Responsable de expedición', description: 'Consolidación, creación y confirmación de expediciones, transportistas y retornos de cliente.', defaultUser: 'Raúl (expedición)', color: '#16a34a',
    pages: ['dashboard', 'mapa', 'expediciones', 'pedidos', 'devoluciones', 'inventario', 'historial'], home: 'expediciones',
    caps: ['shipments', 'orders.create', 'returns.register'],
  },
]

export const DEFAULT_ROLE: RoleId = 'jefe'
export const roleById = (id?: string): Role => ROLES.find((r) => r.id === id) ?? ROLES[0]
