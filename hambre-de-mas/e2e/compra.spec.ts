import { expect, test } from '@playwright/test'

test.beforeEach(async ({ context }) => {
  // Oculta el banner de cookies (su propio test está más abajo).
  await context.addCookies([
    { name: 'hdm_consent', value: encodeURIComponent(JSON.stringify({ v: 1, analytics: false, at: 'e2e' })), url: 'http://localhost:3000' },
  ])
})

test('compra completa como invitado: buscar, añadir, código, pagar y confirmar', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Cocina lo que te')

  // Buscador
  await page.getByRole('button', { name: 'Buscar en la tienda' }).click()
  await page.getByLabel('Buscar kits').fill('ramen')
  await page.locator('header').getByRole('link', { name: /Kit Ramen casero/ }).click()
  await expect(page).toHaveURL(/\/producto\/kit-ramen-casero/)

  // Variante y cantidad
  await page.getByText('4 personas').click()
  await expect(page.getByText('59,00 €').first()).toBeVisible()
  await page.getByText('2 personas').click()
  await page.getByRole('button', { name: 'Añadir una unidad' }).click()
  await page.getByRole('button', { name: 'Añadir a la cesta' }).click()

  // Panel de la cesta
  const drawer = page.getByRole('dialog', { name: /Tu cesta/ })
  await expect(drawer).toBeVisible()
  await expect(drawer.getByText('Kit Ramen casero')).toBeVisible()
  await expect(page.getByRole('button', { name: /Cesta, 2 productos/ })).toBeVisible()
  await drawer.getByRole('link', { name: 'Ver cesta' }).click()

  // Cesta con código promocional validado en el servidor
  await expect(page.getByRole('heading', { name: 'Revisa tu cesta.' })).toBeVisible()
  await page.getByRole('button', { name: '¿Tienes un código promocional?' }).click()
  await page.getByLabel('Código promocional').fill('bienvenida10')
  await page.getByRole('button', { name: 'Aplicar' }).click()
  await expect(page.getByText('Descuento (BIENVENIDA10)')).toBeVisible()
  await expect(page.getByText('63,00 €').first()).toBeVisible()
  await page.getByRole('link', { name: 'Tramitar pedido' }).click()

  // Checkout
  await expect(page.getByRole('heading', { name: 'Finalizar compra.' })).toBeVisible()
  await page.getByLabel('Email', { exact: true }).fill('e2e-invitado@example.com')
  await page.getByLabel('Nombre y apellidos').fill('Prueba E2E')
  await page.getByLabel('Dirección', { exact: true }).fill('Calle de Prueba 1')
  await page.getByLabel('Código postal').fill('28013')
  await page.getByLabel('Ciudad').fill('Madrid')
  await page.getByLabel('Provincia').selectOption('Madrid')

  // Sin aceptar las condiciones no deja pagar
  await page.getByRole('button', { name: /Pagar 63,00/ }).click()
  await expect(page.getByText('Tienes que aceptar las condiciones de compra').first()).toBeVisible()
  await page.getByRole('checkbox', { name: /condiciones de compra/ }).check()
  await page.getByRole('button', { name: /Pagar 63,00/ }).click()

  // Página de pago (Stripe falso de pruebas)
  await expect(page.getByRole('heading', { name: 'Pagar 63,00 €' })).toBeVisible()
  await page.locator('#pagar').click()

  // Confirmación
  await expect(page.getByRole('heading', { name: '¡A cocinar!' })).toBeVisible()
  await expect(page.getByText(/HDM-\d{6} está confirmado/)).toBeVisible()
  await expect(page.getByRole('button', { name: /Cesta, 0 productos/ })).toBeVisible()
})

test('si el código postal es de Canarias lo explica antes de pagar', async ({ page }) => {
  await page.goto('/producto/kit-bowl-arcoiris')
  await page.getByRole('button', { name: 'Comprar ahora' }).click()
  await expect(page).toHaveURL(/\/checkout/)
  await page.getByLabel('Email', { exact: true }).fill('canarias@example.com')
  await page.getByLabel('Nombre y apellidos').fill('Prueba')
  await page.getByLabel('Dirección', { exact: true }).fill('Calle 1')
  await page.getByLabel('Código postal').fill('35001')
  await page.getByLabel('Ciudad').fill('Las Palmas')
  await page.getByLabel('Provincia').selectOption({ index: 1 })
  await page.getByRole('checkbox', { name: /condiciones de compra/ }).check()
  await page.getByRole('button', { name: /^Pagar/ }).click()
  await expect(page.getByText('De momento solo enviamos a la Península y Baleares').first()).toBeVisible()
})

test('volver desde el pago cancela el pedido y conserva la cesta', async ({ page }) => {
  await page.goto('/producto/kit-tacos-al-pastor')
  await page.getByRole('button', { name: 'Comprar ahora' }).click()
  await page.getByLabel('Email', { exact: true }).fill('cancela@example.com')
  await page.getByLabel('Nombre y apellidos').fill('Prueba Cancelar')
  await page.getByLabel('Dirección', { exact: true }).fill('Calle 2')
  await page.getByLabel('Código postal').fill('46001')
  await page.getByLabel('Ciudad').fill('Valencia')
  await page.getByLabel('Provincia').selectOption('Valencia')
  await page.getByRole('checkbox', { name: /condiciones de compra/ }).check()
  await page.getByRole('button', { name: /^Pagar/ }).click()
  await page.locator('#cancelar').click()
  await expect(page.getByRole('heading', { name: 'No pasa nada.' })).toBeVisible()
  await page.getByRole('link', { name: 'Volver a la cesta' }).click()
  await expect(page.getByText('Kit Tacos al pastor').first()).toBeVisible()
})

test('filtros del catálogo por URL', async ({ page }) => {
  await page.goto('/tienda')
  await page.getByText('Vegano', { exact: true }).first().click()
  await expect(page).toHaveURL(/dieta=vegano/)
  await expect(page.getByRole('link', { name: /Kit Bowl arcoíris/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Kit Ramen casero/ })).toHaveCount(0)
  await page.getByLabel('Ordenar por').selectOption('precio-desc')
  await expect(page).toHaveURL(/orden=precio-desc/)
})
