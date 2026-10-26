'use client'
import { createBrowserClient } from '@supabase/ssr'
import { supabaseAnonKey, supabaseUrl } from '@/lib/env'

export function createSupabaseBrowserClient() {
  const url = supabaseUrl()
  const key = supabaseAnonKey()
  if (!url || !key) throw new Error('Supabase no está configurado')
  return createBrowserClient(url, key)
}
