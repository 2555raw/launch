/**
 * Capa de datos. La interfaz WarehouseRepository permite sustituir el almacenamiento local
 * (IndexedDB) por una API REST + PostgreSQL sin tocar la interfaz ni el dominio.
 */
import type { WarehouseState } from '@/domain'

export interface WarehouseRepository {
  load(): Promise<WarehouseState | null>
  save(state: WarehouseState): Promise<void>
  clear(): Promise<void>
  readonly kind: string
}

const DB_NAME = 'warehouse-pro'
const STORE = 'snapshots'
const KEY = 'current'

export class IndexedDbRepository implements WarehouseRepository {
  readonly kind = 'IndexedDB'
  private dbPromise: Promise<import('idb').IDBPDatabase> | null = null

  private async db() {
    if (!this.dbPromise) {
      const { openDB } = await import('idb')
      this.dbPromise = openDB(DB_NAME, 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
        },
      })
    }
    return this.dbPromise
  }

  async load() {
    const db = await this.db()
    const value = await db.get(STORE, KEY)
    return (value as WarehouseState | undefined) ?? null
  }

  async save(state: WarehouseState) {
    const db = await this.db()
    // Una única transacción: el snapshot se sustituye de forma atómica.
    const tx = db.transaction(STORE, 'readwrite')
    await tx.store.put(state, KEY)
    await tx.done
  }

  async clear() {
    const db = await this.db()
    await db.delete(STORE, KEY)
  }
}

export class LocalStorageRepository implements WarehouseRepository {
  readonly kind = 'localStorage'
  private key = 'warehouse-pro:state'
  async load() {
    try {
      const raw = localStorage.getItem(this.key)
      return raw ? (JSON.parse(raw) as WarehouseState) : null
    } catch {
      return null
    }
  }
  async save(state: WarehouseState) {
    localStorage.setItem(this.key, JSON.stringify(state))
  }
  async clear() {
    localStorage.removeItem(this.key)
  }
}

export class MemoryRepository implements WarehouseRepository {
  readonly kind = 'memoria'
  private state: WarehouseState | null = null
  async load() { return this.state }
  async save(state: WarehouseState) { this.state = structuredClone(state) }
  async clear() { this.state = null }
}

export function createRepository(): WarehouseRepository {
  if (typeof indexedDB !== 'undefined') return new IndexedDbRepository()
  if (typeof localStorage !== 'undefined') return new LocalStorageRepository()
  return new MemoryRepository()
}
