import { defineConfig, devices } from '@playwright/test'

/**
 * Pruebas de extremo a extremo. Necesitan:
 *  - la tienda en marcha con Supabase (npm run dev o npm start) en BASE_URL,
 *  - el Stripe falso de pruebas (lo arranca esta configuración).
 * En .env.local: STRIPE_SECRET_KEY=sk_test_..., STRIPE_WEBHOOK_SECRET=whsec_test_local
 * y STRIPE_API_BASE_URL=http://localhost:12111 (ver README).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    locale: 'es-ES',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : undefined,
  },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'] }, testIgnore: /movil\.spec\.ts/ },
    { name: 'movil', use: { ...devices['Pixel 7'] }, testMatch: /movil\.spec\.ts/ },
  ],
  webServer: [
    {
      command: 'node tests/support/fake-stripe.mjs',
      url: 'http://localhost:12111/health',
      reuseExistingServer: true,
      env: { STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET ?? 'whsec_test_local' },
    },
  ],
})
