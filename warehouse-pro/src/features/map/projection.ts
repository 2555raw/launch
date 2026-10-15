import { MAP_H, MAP_W, type Location } from '@/domain'
import type { ViewBox } from './useViewBox'

export type MapMode = '2d' | '3d'

const COS = 0.8660254
const SIN = 0.5

/** Proyección isométrica: coordenadas del plano (x, y) y altura z → pantalla. */
export const iso = (x: number, y: number, z = 0) => ({ X: (x - y) * COS, Y: (x + y) * SIN - z })

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

/** Caras de una caja (x, y, w, d, h) apoyada a altura z0. */
export function boxFaces(x: number, y: number, w: number, d: number, h: number, z0 = 0) {
  return {
    top: pts([iso(x, y, z0 + h), iso(x + w, y, z0 + h), iso(x + w, y + d, z0 + h), iso(x, y + d, z0 + h)]),
    east: pts([iso(x + w, y, z0), iso(x + w, y + d, z0), iso(x + w, y + d, z0 + h), iso(x + w, y, z0 + h)]),
    south: pts([iso(x, y + d, z0), iso(x + w, y + d, z0), iso(x + w, y + d, z0 + h), iso(x, y + d, z0 + h)]),
  }
}

export const floorPoly = (x: number, y: number, w: number, d: number, z = 0) => pts([iso(x, y, z), iso(x + w, y, z), iso(x + w, y + d, z), iso(x, y + d, z)])

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
