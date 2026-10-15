import { MAP_H, MAP_W, type Location } from '@/domain'
import type { ViewBox } from './useViewBox'

export type MapMode = '2d' | '3d'

const COS = 0.8660254
const SIN = 0.5
const CX = MAP_W / 2, CY = MAP_H / 2
let A = 0 // ángulo de giro del almacén (radianes)
let cosA = 1, sinA = 0

/** Fija el ángulo de giro (grados) usado por todas las proyecciones siguientes. */
export function setAngle(deg: number) {
  A = (deg * Math.PI) / 180
  cosA = Math.cos(A)
  sinA = Math.sin(A)
}
export const getAngle = () => (A * 180) / Math.PI

const rot = (x: number, y: number) => { const dx = x - CX, dy = y - CY; return { xr: CX + dx * cosA - dy * sinA, yr: CY + dx * sinA + dy * cosA } }

/** Proyección isométrica con giro: coordenadas del plano (x, y) y altura z → pantalla. */
export const iso = (x: number, y: number, z = 0) => { const { xr, yr } = rot(x, y); return { X: (xr - yr) * COS, Y: (xr + yr) * SIN - z } }

export const BOUNDS: Record<MapMode, ViewBox & { zoom?: number }> = {
  '2d': { x: -20, y: -20, w: MAP_W + 40, h: MAP_H + 40 },
  '3d': { x: -900, y: -90, w: 2340, h: 1400, zoom: 1.28 },
}

export function project(mode: MapMode, x: number, y: number, z = 0) {
  if (mode === '2d') return { X: x, Y: y }
  return iso(x, y, z)
}

export function centerOf(mode: MapMode, loc: Location) {
  return project(mode, loc.x + loc.w / 2, loc.y + loc.h / 2, mode === '3d' ? 8 : 0)
}

export const pts = (p: { X: number; Y: number }[]) => p.map((q) => `${q.X.toFixed(1)},${q.Y.toFixed(1)}`).join(' ')

export interface Face { points: string; f: number }

/** Normal (nx, ny) de una cara vertical girada: visible si apunta hacia la cámara (+x, +y). */
function visible(nx: number, ny: number) {
  const rx = nx * cosA - ny * sinA, ry = nx * sinA + ny * cosA
  return { vis: rx + ry > 0.001, f: rx >= ry ? 0.8 : 0.62 }
}

/** Caras visibles de una caja (x, y, w, d, h) apoyada a altura z0: laterales (de atrás a delante) y tapa. */
export function boxFaces(x: number, y: number, w: number, d: number, h: number, z0 = 0): { sides: Face[]; top: string } {
  const sides: Face[] = []
  const candidates: [number, number, [number, number][]][] = [
    [0, -1, [[x, y], [x + w, y]]],
    [1, 0, [[x + w, y], [x + w, y + d]]],
    [0, 1, [[x, y + d], [x + w, y + d]]],
    [-1, 0, [[x, y], [x, y + d]]],
  ]
  for (const [nx, ny, [[ax, ay], [bx, by]]] of candidates) {
    const v = visible(nx, ny)
    if (!v.vis) continue
    sides.push({ points: pts([iso(ax, ay, z0), iso(bx, by, z0), iso(bx, by, z0 + h), iso(ax, ay, z0 + h)]), f: v.f })
  }
  return { sides, top: pts([iso(x, y, z0 + h), iso(x + w, y, z0 + h), iso(x + w, y + d, z0 + h), iso(x, y + d, z0 + h)]) }
}

/** Una pared exterior es "de fondo" (y se dibuja alta) cuando su normal exterior apunta lejos de la cámara. */
export const isBackWall = (nx: number, ny: number) => !visible(nx, ny).vis

export const floorPoly = (x: number, y: number, w: number, d: number, z = 0) => pts([iso(x, y, z), iso(x + w, y, z), iso(x + w, y + d, z), iso(x, y + d, z)])

/** Profundidad para el orden de pintado (mayor = más cerca de la cámara). */
export function depthOf(x: number, y: number, w: number, d: number) {
  let m = -Infinity
  for (const [px, py] of [[x, y], [x + w, y], [x, y + d], [x + w, y + d]]) { const { xr, yr } = rot(px, py); m = Math.max(m, xr + yr) }
  return m
}

/** Oscurece o aclara un color (hex o rgb()) por un factor. */
export function shade(color: string, f: number): string {
  if (color.startsWith('url(')) return f < 1 ? '#fca5a5' : '#fecaca'
  let r = 0, g = 0, b = 0
  if (color.startsWith('#')) {
    const v = color.slice(1)
    r = parseInt(v.slice(0, 2), 16); g = parseInt(v.slice(2, 4), 16); b = parseInt(v.slice(4, 6), 16)
  } else {
    const m = color.match(/\d+/g)
    if (!m) return color
    ;[r, g, b] = m.map(Number)
  }
  const k = (c: number) => Math.max(0, Math.min(255, Math.round(c * f)))
  return `rgb(${k(r)},${k(g)},${k(b)})`
}
