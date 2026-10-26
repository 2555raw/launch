import 'server-only'
import { cache } from 'react'
import { isSupabaseConfigured } from '@/lib/env'
import { createDemoCatalog } from './demo-repository'
import type { CatalogRepository } from './repository'
import { createSupabaseCatalog } from './supabase-repository'

/**
 * Devuelve el catálogo de Supabase si está configurado; si no, el de
 * demostración en memoria (solo lectura).
 */
export const getCatalog = cache((): CatalogRepository => {
  return isSupabaseConfigured() ? createSupabaseCatalog() : createDemoCatalog()
})

export const isDemoMode = () => !isSupabaseConfigured()

export type { CatalogRepository, ProductPage } from './repository'
