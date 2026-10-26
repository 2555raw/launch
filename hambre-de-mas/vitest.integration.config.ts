import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Pruebas contra una base de datos real (Supabase local). Necesitan
// DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL y las claves (ver README).
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)), 'server-only': fileURLToPath(new URL('./tests/support/empty.ts', import.meta.url)) } },
  test: { include: ['tests/integration/**/*.test.ts'], environment: 'node', testTimeout: 30_000, hookTimeout: 60_000, fileParallelism: false },
})
