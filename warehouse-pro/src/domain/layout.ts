import type { Location, Zone } from './types'

/**
 * Plano del almacén (vista superior, unidades del plano).
 * Diseño en "U" (PDF: recepción y expedición en el mismo frente, muelles abajo):
 *  - Franja superior: auxiliares aisladas (devoluciones, obsoletos/palets vacíos, oficinas).
 *  - Centro: almacenamiento con 6 pasillos rectos de sentido único (codificación en peine,
 *    módulos impares a la izquierda y pares a la derecha; niveles desde el suelo).
 *  - Derecha: zona de picking y consolidación/embalaje, próxima a expedición.
 *  - Abajo izquierda: muelles de descarga, recepción y control de calidad.
 *  - Abajo derecha: expedición y muelles de carga.
 * Flujo: Recepción → Calidad → Almacenamiento → Picking → Consolidación → Expedición.
 */
export const MAP_W = 1600
export const MAP_H = 980

export const AISLES = 6
export const MODULES_PER_SIDE = 5
export const LEVELS = 4

export const zonesLayout: Zone[] = [
  { id: 'Z-DEV', code: 'DEV', name: 'Zona de devoluciones', type: 'devoluciones', description: 'Recepción e inspección de retornos. Aislada del flujo principal.', x: 40, y: 30, w: 300, h: 110 },
  { id: 'Z-AUX', code: 'AUX', name: 'Zona auxiliar', type: 'auxiliar', description: 'Palets vacíos, material obsoleto y embalajes.', x: 360, y: 30, w: 300, h: 110 },
  { id: 'Z-OFI', code: 'OFI', name: 'Oficinas y servicios', type: 'oficinas', description: 'Oficina de almacén, vestuarios y servicios.', x: 1060, y: 30, w: 500, h: 110 },
  { id: 'Z-D', code: 'D', name: 'Cámara refrigerada D · 0-4 °C', type: 'almacenamiento', description: 'Quesos y salmón fresco. Pasillo 06, cámara aislada con control de temperatura.', x: 40, y: 170, w: 170, h: 470, temperature: 'refrigerado' },
  { id: 'Z-C', code: 'C', name: 'Cámara fresca C · 8-13 °C', type: 'almacenamiento', description: 'Fruta tropical (piñas): ventilada, sin frío extremo para evitar daño por frío. Pasillo 05.', x: 220, y: 170, w: 170, h: 470, temperature: 'fresco' },
  { id: 'Z-B', code: 'B', name: 'Almacenamiento B · Ambiente, rotación media/baja', type: 'almacenamiento', description: 'Plásticos y recipientes voluminosos en reserva. Pasillos 03 y 04.', x: 400, y: 170, w: 300, h: 470, rotation: 'baja', temperature: 'ambiente' },
  { id: 'Z-A', code: 'A', name: 'Almacenamiento A · Ambiente, alta rotación', type: 'almacenamiento', description: 'Alta rotación junto al picking. Pasillos 01 y 02.', x: 710, y: 170, w: 320, h: 470, rotation: 'alta', temperature: 'ambiente' },
  { id: 'Z-CNG', code: 'CNG', name: 'Cámara de congelación · -18 °C', type: 'almacenamiento', description: 'Salmón congelado en jaulas sobre suelo. Acceso por esclusa.', x: 680, y: 30, w: 360, h: 110, temperature: 'congelado' },
  { id: 'Z-PCK', code: 'PCK', name: 'Zona de picking', type: 'picking', description: 'Estanterías dinámicas de picking manual.', x: 1070, y: 170, w: 230, h: 470 },
  { id: 'Z-CON', code: 'CON', name: 'Consolidación y embalaje', type: 'consolidacion', description: 'Agrupación de pedidos, embalaje y etiquetado.', x: 1320, y: 170, w: 240, h: 470 },
  { id: 'Z-REC', code: 'REC', name: 'Zona de recepción', type: 'recepcion', description: 'Descarga, control documental y clasificación de entradas.', x: 40, y: 680, w: 520, h: 180 },
  { id: 'Z-QC', code: 'QC', name: 'Control de calidad', type: 'calidad', description: 'Mercancía en cuarentena pendiente de inspección.', x: 580, y: 680, w: 240, h: 180 },
  { id: 'Z-EXP', code: 'EXP', name: 'Zona de expedición', type: 'expedicion', description: 'Pedidos preparados a la espera de carga.', x: 900, y: 680, w: 660, h: 180 },
  { id: 'Z-MDE', code: 'MDE', name: 'Muelles de descarga', type: 'muelles_entrada', description: 'Cuatro muelles de descarga (M1-M4) con fuelles de abrigo para entradas.', x: 40, y: 880, w: 520, h: 70 },
  { id: 'Z-MCA', code: 'MCA', name: 'Muelles de carga', type: 'muelles_salida', description: 'Cuatro muelles de carga (M5-M8) para salidas.', x: 900, y: 880, w: 660, h: 70 },
]

export const pad2 = (n: number) => String(n).padStart(2, '0')

export function locationCode(zone: string, aisle: number, module: number, level: number) {
  return `${zone}-${pad2(aisle)}-${pad2(module)}-${pad2(level)}`
}

/** Pasillo → zona de almacenamiento. Los pasillos 01-02 están junto al picking (alta rotación). */
export function zoneForAisle(aisle: number): string {
  if (aisle <= 2) return 'A'
  if (aisle <= 4) return 'B'
  if (aisle === 5) return 'C'
  return 'D'
}

export function sizeClassForLevel(level: number): 'S' | 'M' | 'L' {
  return level === 1 ? 'L' : level === 4 ? 'S' : 'M'
}

export interface AisleGeometry {
  aisle: number
  /** x central del pasillo */
  cx: number
  top: number
  bottom: number
  leftRackX: number
  rightRackX: number
  rackW: number
}

const RACK_W = 46
const AISLE_W = 48
const RACK_TOP = 215
const MODULE_H = 78
const MODULE_GAP = 4

export function aisleGeometry(aisle: number): AisleGeometry {
  // Pasillo 01 es el más cercano al picking (derecha). El 06 está en la zona C (izquierda).
  const zoneA = zonesLayout.find((z) => z.code === 'A')!
  const zoneB = zonesLayout.find((z) => z.code === 'B')!
  const zoneC = zonesLayout.find((z) => z.code === 'C')!
  const zoneD = zonesLayout.find((z) => z.code === 'D')!
  const pitch = RACK_W * 2 + AISLE_W + 18
  let cx: number
  if (aisle <= 2) {
    cx = zoneA.x + zoneA.w - 24 - RACK_W - AISLE_W / 2 - (aisle - 1) * pitch
  } else if (aisle <= 4) {
    cx = zoneB.x + zoneB.w - 24 - RACK_W - AISLE_W / 2 - (aisle - 3) * pitch
  } else if (aisle === 5) {
    cx = zoneC.x + zoneC.w / 2
  } else {
    cx = zoneD.x + zoneD.w / 2
  }
  return {
    aisle,
    cx,
    top: RACK_TOP - 30,
    bottom: RACK_TOP + MODULES_PER_SIDE * (MODULE_H + MODULE_GAP) + 10,
    leftRackX: cx - AISLE_W / 2 - RACK_W,
    rightRackX: cx + AISLE_W / 2,
    rackW: RACK_W,
  }
}

export const CORRIDOR_TOP_Y = RACK_TOP - 32
export const CORRIDOR_BOTTOM_Y = RACK_TOP + MODULES_PER_SIDE * (MODULE_H + MODULE_GAP) + 14

function rackLocations(): Location[] {
  const out: Location[] = []
  for (let aisle = 1; aisle <= AISLES; aisle++) {
    const g = aisleGeometry(aisle)
    const zoneCode = zoneForAisle(aisle)
    for (let module = 1; module <= MODULES_PER_SIDE * 2; module++) {
      const isLeft = module % 2 === 1
      const row = Math.ceil(module / 2) - 1
      const rackX = isLeft ? g.leftRackX : g.rightRackX
      const moduleY = RACK_TOP + row * (MODULE_H + MODULE_GAP)
      const levelH = (MODULE_H - 6) / LEVELS
      for (let level = 1; level <= LEVELS; level++) {
        // Nivel 1 abajo (suelo); se dibuja de abajo a arriba dentro del módulo
        const y = moduleY + 3 + (LEVELS - level) * levelH
        const code = locationCode(zoneCode, aisle, module, level)
        const capacity = zoneCode === 'A' ? (level === 1 ? 160 : 120) : zoneCode === 'B' ? (level === 1 ? 200 : 150) : level === 1 ? 120 : 80
        out.push({
          id: `L-${code}`,
          code,
          zoneId: `Z-${zoneCode}`,
          aisle,
          module,
          level,
          kind: 'estanteria',
          capacity,
          maxWeightKg: level === 1 ? 1200 : 800,
          sizeClass: sizeClassForLevel(level),
          blocked: false,
          x: rackX,
          y,
          w: g.rackW,
          h: levelH - 1,
          accessX: g.cx,
          accessY: moduleY + MODULE_H / 2,
        })
      }
    }
  }
  return out
}

function floorLocations(): Location[] {
  const out: Location[] = []
  const add = (zoneCode: string, zoneId: string, idx: number, x: number, y: number, w: number, h: number, capacity: number, kind: Location['kind'], aisle = 0, module = idx) => {
    const code = `${zoneCode}-${pad2(aisle)}-${pad2(module)}-01`
    out.push({ id: `L-${code}`, code, zoneId, aisle, module, level: 1, kind, capacity, sizeClass: 'L', blocked: false, x, y, w, h, accessX: x + w / 2, accessY: y - 10 })
  }
  // Recepción: 6 huecos de suelo
  for (let i = 1; i <= 6; i++) add('REC', 'Z-REC', i, 60 + (i - 1) * 82, 725, 70, 110, 400, 'suelo')
  // Control de calidad: 3 huecos
  for (let i = 1; i <= 3; i++) add('QC', 'Z-QC', i, 600 + (i - 1) * 72, 725, 60, 110, 300, 'suelo')
  // Picking: 2 pasillos de estanterías dinámicas (PCK-01-xx) con 1 nivel por módulo
  for (let col = 0; col < 2; col++) {
    for (let m = 1; m <= 5; m++) {
      const code = `PCK-01-${pad2(col * 5 + m)}-01`
      out.push({ id: `L-${code}`, code, zoneId: 'Z-PCK', aisle: 1, module: col * 5 + m, level: 1, kind: 'estanteria', capacity: 60, sizeClass: 'M', blocked: false, x: 1095 + col * 110, y: 215 + (m - 1) * 82, w: 70, h: 74, accessX: 1185, accessY: 215 + (m - 1) * 82 + 37 })
    }
  }
  // Consolidación: 4 mesas de embalaje
  for (let i = 1; i <= 4; i++) add('CON', 'Z-CON', i, 1345, 215 + (i - 1) * 100, 190, 80, 250, 'estacion')
  // Expedición: 8 huecos de suelo por pedido preparado
  for (let i = 1; i <= 8; i++) add('EXP', 'Z-EXP', i, 920 + (i - 1) * 80, 725, 68, 110, 400, 'suelo')
  // Devoluciones: 3 huecos
  for (let i = 1; i <= 3; i++) add('DEV', 'Z-DEV', i, 60 + (i - 1) * 92, 60, 80, 65, 200, 'suelo')
  // Auxiliar: 3 huecos (palets vacíos, obsoletos)
  for (let i = 1; i <= 3; i++) add('AUX', 'Z-AUX', i, 380 + (i - 1) * 92, 60, 80, 65, 300, 'suelo')
  // Cámara de congelación: 4 jaulas sobre suelo
  for (let i = 1; i <= 4; i++) add('CNG', 'Z-CNG', i, 700 + (i - 1) * 85, 60, 75, 65, 150, 'suelo')
  // Muelles
  for (let i = 1; i <= 4; i++) add('MDE', 'Z-MDE', i, 60 + (i - 1) * 125, 890, 100, 50, 500, 'muelle')
  for (let i = 5; i <= 8; i++) add('MCA', 'Z-MCA', i, 930 + (i - 5) * 160, 890, 110, 50, 500, 'muelle')
  return out
}

export function buildLocations(): Location[] {
  return [...rackLocations(), ...floorLocations()]
}

/** Ubicación de consolidación por defecto donde se deposita la mercancía recogida en picking. */
export const STAGING_LOCATION_ID = 'L-CON-00-01-01'
/** Ubicación de cuarentena por defecto para control de calidad. */
export const QC_LOCATION_ID = 'L-QC-00-01-01'
/** Ubicación por defecto de recepción de devoluciones. */
export const RETURNS_LOCATION_ID = 'L-DEV-00-01-01'
/** Ubicación auxiliar para mercancía dañada u obsoleta. */
export const AUX_LOCATION_ID = 'L-AUX-00-02-01'

/** Punto de inicio de las rutas de picking (entrada de la zona de picking). */
export const PICKING_START = { x: 1185, y: CORRIDOR_BOTTOM_Y }

/**
 * Orden de recorrido recomendado (serpentina por pasillos): pasillo 01 primero (junto a picking),
 * dentro de cada pasillo se recorren los módulos en sentido alterno para reducir desplazamientos.
 */
export function pickingSortKey(loc: Location): number {
  if (loc.kind !== 'estanteria' || !STORAGE_RACK_ZONES.includes(loc.zoneId)) return 1_000_000 + loc.x
  const row = Math.ceil(loc.module / 2)
  const dir = loc.aisle % 2 === 1 ? 1 : -1
  const rowKey = dir === 1 ? row : MODULES_PER_SIDE + 1 - row
  return loc.aisle * 1000 + rowKey * 10 + (loc.module % 2)
}

export const STORAGE_RACK_ZONES = ['Z-A', 'Z-B', 'Z-C', 'Z-D']

export interface RoutePoint { x: number; y: number }

/** Construye la polilínea de la ruta siguiendo los pasillos. */
export function buildRoute(locations: Location[], start: RoutePoint = PICKING_START, returnToStart = true): RoutePoint[] {
  const pts: RoutePoint[] = [{ ...start }]
  let cur = { ...start }
  const goto = (p: RoutePoint) => {
    if (p.x !== cur.x || p.y !== cur.y) {
      pts.push(p)
      cur = p
    }
  }
  for (const loc of locations) {
    const ax = loc.accessX
    const ay = loc.accessY
    if (loc.kind === 'estanteria' && loc.aisle > 0 && STORAGE_RACK_ZONES.includes(loc.zoneId)) {
      if (Math.abs(cur.x - ax) > 1) {
        // Cambiar de pasillo por el corredor más cercano
        const corridorY = Math.abs(cur.y - CORRIDOR_TOP_Y) < Math.abs(cur.y - CORRIDOR_BOTTOM_Y) ? CORRIDOR_TOP_Y : CORRIDOR_BOTTOM_Y
        goto({ x: cur.x, y: corridorY })
        goto({ x: ax, y: corridorY })
      }
      goto({ x: ax, y: ay })
    } else {
      goto({ x: cur.x, y: CORRIDOR_BOTTOM_Y })
      goto({ x: ax, y: CORRIDOR_BOTTOM_Y })
      goto({ x: ax, y: ay })
    }
  }
  if (returnToStart) {
    goto({ x: cur.x, y: CORRIDOR_BOTTOM_Y })
    goto({ x: start.x, y: CORRIDOR_BOTTOM_Y })
    goto({ x: start.x, y: start.y })
  }
  return pts
}

/** Ruta entre dos ubicaciones cualesquiera siguiendo los corredores. */
export function routeBetween(a: Location, b: Location): RoutePoint[] {
  return buildRoute([b], { x: a.accessX, y: a.accessY }, false)
}

/** Longitud aproximada de una ruta en metros (1 unidad del plano ≈ 0,05 m → 1600 uds = 80 m). */
export function routeLength(pts: RoutePoint[]): number {
  let d = 0
  for (let i = 1; i < pts.length; i++) d += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
  return Math.round(d * 0.05)
}
