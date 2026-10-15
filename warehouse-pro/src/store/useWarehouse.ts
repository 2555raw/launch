import { create } from 'zustand'
import { DomainError, STATE_VERSION, buildDemoState, emptyState, type WarehouseState } from '@/domain'
import { MemoryRepository, createRepository, type WarehouseRepository } from '@/data/repository'

export interface Toast { id: number; kind: 'success' | 'error' | 'info' | 'warning'; title: string; message?: string }

type Operation = (state: WarehouseState) => WarehouseState

interface WarehouseStore {
  state: WarehouseState | null
  loading: boolean
  saving: boolean
  lastSavedAt: string | null
  repoKind: string
  toasts: Toast[]
  init(): Promise<void>
  /** Ejecuta una operación de dominio de forma atómica, persiste y notifica. */
  dispatch(op: Operation, success?: string): { ok: true; state: WarehouseState } | { ok: false; error: DomainError }
  resetDemo(): Promise<void>
  clearAll(): Promise<void>
  notify(kind: Toast['kind'], title: string, message?: string): void
  dismissToast(id: number): void
}

let repo: WarehouseRepository = createRepository()
let saveTimer: ReturnType<typeof setTimeout> | null = null
let pending: WarehouseState | null = null
let toastSeq = 0

export const useWarehouse = create<WarehouseStore>((set, get) => {
  const flush = async () => {
    const s = pending
    pending = null
    if (!s) return
    set({ saving: true })
    try {
      await repo.save(s)
      set({ saving: false, lastSavedAt: new Date().toISOString() })
    } catch (e) {
      set({ saving: false })
      get().notify('error', 'No se pudo guardar', e instanceof Error ? e.message : String(e))
    }
  }
  const schedule = (s: WarehouseState) => {
    pending = s
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(flush, 120)
  }
  return {
    state: null,
    loading: true,
    saving: false,
    lastSavedAt: null,
    repoKind: repo.kind,
    toasts: [],
    async init() {
      set({ loading: true })
      try {
        let s = await repo.load()
        if (!s || s.version !== STATE_VERSION) {
          s = buildDemoState()
          await repo.save(s)
        }
        set({ state: s, loading: false, repoKind: repo.kind })
      } catch (e) {
        // Si IndexedDB falla (modo privado, etc.) se degrada a memoria
        repo = new MemoryRepository()
        const s = buildDemoState()
        set({ state: s, loading: false, repoKind: repo.kind })
        get().notify('warning', 'Persistencia no disponible', `Los datos no se guardarán entre recargas. ${e instanceof Error ? e.message : ''}`)
      }
    },
    dispatch(op, success) {
      const current = get().state
      if (!current) return { ok: false, error: new DomainError('NOT_READY', 'La aplicación aún se está cargando.') }
      try {
        const next = op(current)
        set({ state: next })
        schedule(next)
        if (success) get().notify('success', success)
        return { ok: true, state: next }
      } catch (e) {
        const err = e instanceof DomainError ? e : new DomainError('UNEXPECTED', e instanceof Error ? e.message : String(e))
        get().notify('error', 'Operación rechazada', err.message)
        return { ok: false, error: err }
      }
    },
    async resetDemo() {
      const s = buildDemoState()
      set({ state: s })
      await repo.save(s)
      set({ lastSavedAt: new Date().toISOString() })
      get().notify('success', 'Almacén de demostración restaurado')
    },
    async clearAll() {
      const s = emptyState()
      set({ state: s })
      await repo.save(s)
      get().notify('info', 'Almacén vaciado', 'Se ha creado un almacén sin productos ni movimientos.')
    },
    notify(kind, title, message) {
      const id = ++toastSeq
      set({ toasts: [...get().toasts, { id, kind, title, message }] })
      setTimeout(() => get().dismissToast(id), kind === 'error' ? 7000 : 4000)
    },
    dismissToast(id) {
      set({ toasts: get().toasts.filter((t) => t.id !== id) })
    },
  }
})

/** Hook de conveniencia: estado garantizado (solo usar bajo el guard de carga). */
export const useState$ = () => useWarehouse((s) => s.state!)
