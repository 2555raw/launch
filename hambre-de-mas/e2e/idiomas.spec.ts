import { expect, test } from '@playwright/test'

test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: 'hdm_consent', value: encodeURIComponent(JSON.stringify({ v: 1, analytics: false, at: 'e2e' })), url: 'http://localhost:3000' },
  ])
})

test('cambiar a inglés y volver a español', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Cocina lo que te')
  await expect(page.locator('html')).toHaveAttribute('lang', 'es')

  await page.getByRole('button', { name: 'Switch to English' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Cook what you crave')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')

  // El catálogo también llega traducido y la preferencia se mantiene al navegar
  await page.goto('/producto/kit-ramen-casero')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Homemade ramen kit')
  await expect(page.getByRole('button', { name: 'Add to bag' })).toBeVisible()
  await page.goto('/receta/kit-ramen-casero')
  await expect(page.getByRole('heading', { name: 'Step by step' })).toBeVisible()

  await page.getByRole('button', { name: 'Cambiar a español' }).click()
  await expect(page.getByRole('heading', { name: 'Paso a paso' })).toBeVisible()
})

test('la primera visita usa el idioma del navegador', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'en-US' })
  const page = await context.newPage()
  await page.goto('http://localhost:3000/tienda')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('All kits.')
  await context.close()
})
