import type { WarehouseState } from './types'

let seq = 0
export function newId(prefix = 'id'): string {
  seq += 1
  const rand = Math.random().toString(36).slice(2, 8)
  return `${prefix}_${Date.now().toString(36)}${seq.toString(36)}${rand}`
}

/** Genera un número de documento secuencial y legible (p. ej. PED-000012). */
export function nextNumber(state: WarehouseState, key: string, prefix: string): [string, WarehouseState] {
  const current = (state.counters[key] ?? 0) + 1
  const number = `${prefix}-${String(current).padStart(6, '0')}`
  return [number, { ...state, counters: { ...state.counters, [key]: current } }]
}

export const nowIso = () => new Date().toISOString()
