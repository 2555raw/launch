/**
 * Modelo de datos de WAREHOUSE PRO.
 * Todas las entidades tienen identificadores estables (id) y códigos legibles.
 * La capa de dominio es pura: no depende de React ni del almacenamiento.
 */

export type ISODate = string

export type ProductStatus = 'activo' | 'archivado'
export type Rotation = 'alta' | 'media' | 'baja'
export type SpecialHandling = 'ninguno' | 'fragil' | 'peligroso' | 'perecedero' | 'voluminoso'
/** Temperatura de conservación requerida/ofrecida */
export type TemperatureClass = 'ambiente' | 'fresco' | 'refrigerado' | 'congelado'
/** Forma logística de la unidad de manipulación */
export type PackagingForm = 'caja' | 'palet' | 'bidon' | 'bandeja' | 'rollo' | 'saco' | 'jaula'
/** Clase de tamaño: S cabe en cualquier hueco, L solo en huecos grandes (nivel 1 / suelo) */
export type SizeClass = 'S' | 'M' | 'L'

export interface Product {
  id: string
  sku: string
  name: string
  barcode: string
  category: string
  imageUrl?: string
  unit: string
  minStock: number
  weightKg: number
  volumeM3: number
  lot?: string
  expiryDate?: ISODate
  rotation: Rotation
  special: SpecialHandling
  /** Condiciones de almacenamiento: cada producto se almacena distinto */
  temperature: TemperatureClass
  form: PackagingForm
  size: SizeClass
  status: ProductStatus
  createdAt: ISODate
  updatedAt: ISODate
}

export type ZoneType =
  | 'recepcion'
  | 'muelles_entrada'
  | 'calidad'
  | 'almacenamiento'
  | 'picking'
  | 'consolidacion'
  | 'expedicion'
  | 'muelles_salida'
  | 'devoluciones'
  | 'auxiliar'
  | 'oficinas'

export interface Zone {
  id: string
  code: string
  name: string
  type: ZoneType
  description: string
  /** Geometría en el plano (unidades del plano) */
  x: number
  y: number
  w: number
  h: number
  /** Las zonas de almacenamiento pueden tener una rotación objetivo */
  rotation?: Rotation
  /** Temperatura que ofrece la zona (cámaras). Si no se indica, ambiente. */
  temperature?: TemperatureClass
}

export type LocationKind = 'estanteria' | 'suelo' | 'muelle' | 'estacion'

export interface Location {
  id: string
  /** Código único: ZONA-PASILLO-MODULO-NIVEL (p. ej. A-01-03-02) */
  code: string
  zoneId: string
  aisle: number
  module: number
  level: number
  kind: LocationKind
  capacity: number
  maxWeightKg?: number
  /** Tamaño máximo de unidad admitido (S < M < L) */
  sizeClass: SizeClass
  blocked: boolean
  blockReason?: string
  /** Geometría en el plano */
  x: number
  y: number
  w: number
  h: number
  /** Punto de acceso desde el pasillo (para rutas) */
  accessX: number
  accessY: number
}

/** Estado físico de la mercancía almacenada en una ubicación */
export type StockState = 'disponible' | 'cuarentena' | 'danado' | 'obsoleto' | 'devolucion_proveedor'

export interface StockEntry {
  id: string
  locationId: string
  productId: string
  quantity: number
  state: StockState
  lot?: string
}

export type OrderStatus =
  | 'pendiente'
  | 'en_preparacion'
  | 'parcialmente_preparado'
  | 'preparado'
  | 'en_expedicion'
  | 'enviado'
  | 'cancelado'

export type OrderPriority = 'baja' | 'normal' | 'alta' | 'urgente'

export interface Reservation {
  locationId: string
  quantity: number
  picked: number
}

export interface OrderLine {
  id: string
  productId: string
  quantityRequested: number
  /** Cantidad reservada (suma de reservas por ubicación) */
  quantityReserved: number
  quantityPicked: number
  reservations: Reservation[]
}

export interface Order {
  id: string
  number: string
  customer: string
  date: ISODate
  priority: OrderPriority
  status: OrderStatus
  lines: OrderLine[]
  notes: string
  shipmentId?: string
  createdAt: ISODate
  updatedAt: ISODate
}

export type ReceiptStatus =
  | 'borrador'
  | 'pendiente'
  | 'en_recepcion'
  | 'control_calidad'
  | 'parcial'
  | 'completada'
  | 'incidencia'

export type QcResult = 'pendiente' | 'aprobado' | 'rechazado'

export interface ReceiptLine {
  id: string
  productId: string
  quantityExpected: number
  quantityReceived: number
  quantityDamaged: number
  destinationLocationId?: string
  qcResult: QcResult
  notes: string
  /** Se marca cuando la línea ya ha generado stock (idempotencia) */
  putAway: boolean
}

export interface Receipt {
  id: string
  number: string
  supplier: string
  documentRef: string
  date: ISODate
  status: ReceiptStatus
  requiresQc: boolean
  lines: ReceiptLine[]
  notes: string
  createdAt: ISODate
  updatedAt: ISODate
  confirmedAt?: ISODate
}

export type ShipmentStatus = 'pendiente' | 'confirmada' | 'cancelada'

export interface Shipment {
  id: string
  number: string
  orderIds: string[]
  recipient: string
  carrier: string
  trackingRef: string
  date: ISODate
  notes: string
  status: ShipmentStatus
  createdAt: ISODate
  confirmedAt?: ISODate
}

export interface Transfer {
  id: string
  number: string
  productId: string
  fromLocationId: string
  toLocationId: string
  quantity: number
  reason: string
  user: string
  status: 'completada' | 'fallida'
  error?: string
  createdAt: ISODate
}

export type ReturnClassification =
  | 'pendiente_inspeccion'
  | 'apta'
  | 'danada'
  | 'obsoleta'
  | 'devolucion_proveedor'

export type ReturnStatus = 'registrada' | 'inspeccionada' | 'cerrada'

export interface Return {
  id: string
  number: string
  orderId?: string
  productId: string
  quantity: number
  reason: string
  packagingState: 'intacto' | 'abierto' | 'danado'
  inspectionNotes: string
  classification: ReturnClassification
  destinationLocationId?: string
  status: ReturnStatus
  user: string
  createdAt: ISODate
  closedAt?: ISODate
}

export type MovementType =
  | 'entrada'
  | 'salida'
  | 'transferencia'
  | 'picking'
  | 'devolucion'
  | 'ajuste'
  | 'reserva'
  | 'liberacion'
  | 'bloqueo'
  | 'cuarentena'

export interface Movement {
  id: string
  timestamp: ISODate
  type: MovementType
  productId?: string
  sku: string
  quantity: number
  fromLocationId?: string
  toLocationId?: string
  reference: string
  user: string
  result: 'ok' | 'error'
  notes: string
}

export interface Settings {
  warehouseName: string
  currentUser: string
  defaultRequiresQc: boolean
  autoReserve: boolean
  demoDataLabel: string
}

export interface WarehouseState {
  version: number
  demo: boolean
  products: Record<string, Product>
  zones: Record<string, Zone>
  locations: Record<string, Location>
  stock: Record<string, StockEntry>
  orders: Record<string, Order>
  receipts: Record<string, Receipt>
  shipments: Record<string, Shipment>
  transfers: Record<string, Transfer>
  returns: Record<string, Return>
  movements: Record<string, Movement>
  settings: Settings
  counters: Record<string, number>
  updatedAt: ISODate
}
