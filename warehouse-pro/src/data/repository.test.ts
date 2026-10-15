import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { IndexedDbRepository } from './repository'
import { buildDemoState } from '@/domain'

describe('persistencia IndexedDB', () => {
  it('13. guarda y recupera el estado completo (simula recarga de página)', async () => {
    const repo = new IndexedDbRepository()
    const state = buildDemoState()
    await repo.save(state)
    const reloaded = await new IndexedDbRepository().load()
    expect(reloaded).not.toBeNull()
    expect(Object.keys(reloaded!.products).length).toBe(Object.keys(state.products).length)
    expect(reloaded!.updatedAt).toBe(state.updatedAt)
    expect(Object.keys(reloaded!.stock).length).toBe(Object.keys(state.stock).length)
    await repo.clear()
    expect(await repo.load()).toBeNull()
  })
})
