import type { MovementType, OrderPriority, OrderStatus, ReceiptStatus, ReturnClassification, ReturnStatus, ShipmentStatus, StockState, ZoneType } from '@/domain'

export type Tone = 'neutral' | 'blue' | 'green' | 'orange' | 'yellow' | 'red' | 'navy' | 'purple'

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: Tone }> = {
  pendiente: { label: 'Pendiente', tone: 'yellow' },
  en_preparacion: { label: 'En preparación', tone: 'blue' },
  parcialmente_preparado: { label: 'Parcialmente preparado', tone: 'orange' },
  preparado: { label: 'Preparado', tone: 'green' },
  en_expedicion: { label: 'En expedición', tone: 'navy' },
  enviado: { label: 'Enviado', tone: 'green' },
  cancelado: { label: 'Cancelado', tone: 'red' },
}

export const ORDER_PRIORITY: Record<OrderPriority, { label: string; tone: Tone }> = {
  baja: { label: 'Baja', tone: 'neutral' },
  normal: { label: 'Normal', tone: 'blue' },
  alta: { label: 'Alta', tone: 'orange' },
  urgente: { label: 'Urgente', tone: 'red' },
}

export const RECEIPT_STATUS: Record<ReceiptStatus, { label: string; tone: Tone }> = {
  borrador: { label: 'Borrador', tone: 'neutral' },
  pendiente: { label: 'Pendiente de recepción', tone: 'yellow' },
  en_recepcion: { label: 'En recepción', tone: 'blue' },
  control_calidad: { label: 'En control de calidad', tone: 'purple' },
  parcial: { label: 'Parcialmente recibida', tone: 'orange' },
  completada: { label: 'Completada', tone: 'green' },
  incidencia: { label: 'Incidencia', tone: 'red' },
}

export const SHIPMENT_STATUS: Record<ShipmentStatus, { label: string; tone: Tone }> = {
  pendiente: { label: 'Pendiente de salida', tone: 'yellow' },
  confirmada: { label: 'Expedida', tone: 'green' },
  cancelada: { label: 'Cancelada', tone: 'red' },
}

export const RETURN_STATUS: Record<ReturnStatus, { label: string; tone: Tone }> = {
  registrada: { label: 'Pendiente de inspección', tone: 'yellow' },
  inspeccionada: { label: 'Inspeccionada', tone: 'blue' },
  cerrada: { label: 'Cerrada', tone: 'green' },
}

export const RETURN_CLASS: Record<ReturnClassification, { label: string; tone: Tone }> = {
  pendiente_inspeccion: { label: 'Pendiente de inspección', tone: 'yellow' },
  apta: { label: 'Apta para stock', tone: 'green' },
  danada: { label: 'Dañada', tone: 'red' },
  obsoleta: { label: 'Obsoleta', tone: 'neutral' },
  devolucion_proveedor: { label: 'Devolución a proveedor', tone: 'orange' },
}

export const STOCK_STATE: Record<StockState, { label: string; tone: Tone }> = {
  disponible: { label: 'Disponible', tone: 'green' },
  cuarentena: { label: 'Cuarentena', tone: 'purple' },
  danado: { label: 'Dañado', tone: 'red' },
  obsoleto: { label: 'Obsoleto', tone: 'neutral' },
  devolucion_proveedor: { label: 'Dev. proveedor', tone: 'orange' },
}

export const MOVEMENT_TYPE: Record<MovementType, { label: string; tone: Tone }> = {
  entrada: { label: 'Entrada', tone: 'green' },
  salida: { label: 'Salida', tone: 'navy' },
  transferencia: { label: 'Transferencia', tone: 'blue' },
  picking: { label: 'Picking', tone: 'blue' },
  devolucion: { label: 'Devolución', tone: 'orange' },
  ajuste: { label: 'Ajuste', tone: 'yellow' },
  reserva: { label: 'Reserva', tone: 'neutral' },
  liberacion: { label: 'Liberación', tone: 'neutral' },
  bloqueo: { label: 'Bloqueo', tone: 'red' },
  cuarentena: { label: 'Cuarentena', tone: 'purple' },
}

export const ZONE_TYPE: Record<ZoneType, { label: string; color: string; fill: string }> = {
  recepcion: { label: 'Recepción', color: '#2563eb', fill: '#dbeafe' },
  muelles_entrada: { label: 'Muelles de descarga', color: '#475569', fill: '#e2e8f0' },
  calidad: { label: 'Control de calidad', color: '#7c3aed', fill: '#ede9fe' },
  almacenamiento: { label: 'Almacenamiento', color: '#1e3a8a', fill: '#eef2ff' },
  picking: { label: 'Picking', color: '#0891b2', fill: '#cffafe' },
  consolidacion: { label: 'Consolidación y embalaje', color: '#0d9488', fill: '#ccfbf1' },
  expedicion: { label: 'Expedición', color: '#16a34a', fill: '#dcfce7' },
  muelles_salida: { label: 'Muelles de carga', color: '#475569', fill: '#e2e8f0' },
  devoluciones: { label: 'Devoluciones', color: '#ea580c', fill: '#ffedd5' },
  auxiliar: { label: 'Auxiliar', color: '#a16207', fill: '#fef9c3' },
  oficinas: { label: 'Oficinas', color: '#64748b', fill: '#f1f5f9' },
}

export const TEMPERATURE: Record<string, { label: string; short: string; color: string }> = {
  ambiente: { label: 'Ambiente (15-25 °C)', short: 'Ambiente', color: '#64748b' },
  fresco: { label: 'Fresco (8-13 °C)', short: 'Fresco', color: '#0891b2' },
  refrigerado: { label: 'Refrigerado (0-4 °C)', short: 'Refrigerado', color: '#2563eb' },
  congelado: { label: 'Congelado (-18 °C)', short: 'Congelado', color: '#4f46e5' },
}

export const FORM: Record<string, string> = { caja: 'Caja', palet: 'Palet', bidon: 'Bidón', bandeja: 'Bandeja', rollo: 'Rollo', saco: 'Saco', jaula: 'Jaula / contenedor' }
export const SIZE: Record<string, string> = { S: 'Pequeña (S)', M: 'Mediana (M)', L: 'Grande (L)' }
export const ROTATION: Record<string, string> = { alta: 'Alta', media: 'Media', baja: 'Baja' }
export const SPECIAL: Record<string, string> = { ninguno: 'Ninguno', fragil: 'Frágil', peligroso: 'Peligroso', perecedero: 'Perecedero', voluminoso: 'Voluminoso' }

export const LOCATION_STATUS: Record<string, { label: string; tone: Tone; fill: string }> = {
  libre: { label: 'Libre', tone: 'neutral', fill: '#e2e8f0' },
  parcial: { label: 'Parcialmente ocupada', tone: 'blue', fill: '#60a5fa' },
  completa: { label: 'Completa', tone: 'navy', fill: '#1e3a8a' },
  bloqueada: { label: 'Bloqueada', tone: 'red', fill: '#ef4444' },
}
