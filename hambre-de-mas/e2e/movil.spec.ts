import { expect, test } from '@playwright/test'

test('banner de cookies con rechazo al mismo nivel', async ({ page }) => {
  await page.goto('/')
  const banner = page.getByRole('dialog', { name: 'Usamos cookies' })
  await expect(banner).toBeVisible()
  await banner.getByRole('button', { name: 'Rechazar' }).click()
  await expect(banner).toBeHidden()
  await page.reload()
  await expect(banner).toBeHidden()
})

test('menú móvil y cesta en pantalla pequeña', async ({ page, context }) => {
  await context.addCookies([
    { name: 'hdm_consent', value: encodeURIComponent(JSON.stringify({ v: 1, analytics: false, at: 'e2e' })), url: 'http://localhost:3000' },
  ])
  await page.goto('/')
  await page.getByRole('button', { name: 'Abrir menú' }).click()
  await page.getByRole('navigation', { name: 'Menú móvil' }).getByRole('link', { name: 'Primer bocado' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Primer bocado')
  await page.getByRole('link', { name: /Kit Wraps crujientes/ }).click()
  await page.getByRole('button', { name: 'Añadir a la cesta' }).click()
  await expect(page.getByRole('dialog', { name: /Tu cesta/ })).toBeVisible()
})
