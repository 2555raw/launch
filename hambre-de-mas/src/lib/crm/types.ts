/** Datos del CRM: clientes agrupados por email (con o sin cuenta), sus pedidos y el seguimiento. */

export type CrmOrder = {
  id: string
  number: string
  /** ISO. */
  date: string
  totalCents: number
  items: { name: string; slug: string | null; quantity: number; level: number | null; levelName: string | null }[]
}

export type CrmNote = { id: string; body: string; author: string; createdAt: string }

export type CrmTask = { id: string; title: string; dueDate: string | null; done: boolean; createdAt: string }

export type CrmCustomer = {
  /** Identificador estable (resumen del email): va en la URL en lugar del email. */
  id: string
  email: string
  name: string
  phone: string | null
  city: string | null
  province: string | null
  hasAccount: boolean
  newsletter: boolean
  /** Fecha de alta (cuenta, newsletter o primer pedido). ISO. */
  since: string
  orders: CrmOrder[]
  tags: string[]
  notes: CrmNote[]
  tasks: CrmTask[]
}

export type Segment = 'vip' | 'recurrente' | 'nuevo' | 'una-compra' | 'en-riesgo' | 'sin-compras'

export type CrmData = { demo: boolean; customers: CrmCustomer[] }
