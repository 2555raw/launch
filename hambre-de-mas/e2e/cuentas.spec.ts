import { expect, test } from '@playwright/test'

const email = `e2e-${Date.now()}@example.com`

test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: 'hdm_consent', value: encodeURIComponent(JSON.stringify({ v: 1, analytics: false, at: 'e2e' })), url: 'http://localhost:3000' },
  ])
})

test('las zonas privadas piden iniciar sesión', async ({ page }) => {
  await page.goto('/cuenta/pedidos')
  await expect(page).toHaveURL(/\/cuenta\/acceder\?next=%2Fcuenta%2Fpedidos/)
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/cuenta\/acceder/)
})

test('registro, perfil, direcciones y cierre de sesión', async ({ page }) => {
  await page.goto('/cuenta/registro')
  await page.getByLabel('Nombre y apellidos').fill('Marta E2E')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Contraseña').fill('una-contraseña-larga')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Crear cuenta' }).click()

  await expect(page.getByRole('heading', { name: 'Hola, Marta.' })).toBeVisible()

  await page.getByRole('link', { name: 'Direcciones' }).first().click()
  await expect(page.getByRole('heading', { name: 'Direcciones de envío' })).toBeVisible()
  await page.getByLabel('Nombre y apellidos').fill('Marta E2E')
  await page.getByLabel('Dirección', { exact: true }).fill('Calle Luna 5')
  await page.getByLabel('Código postal').fill('08001')
  await page.getByLabel('Ciudad').fill('Barcelona')
  await page.getByLabel('Provincia').fill('Barcelona')
  await page.getByRole('button', { name: 'Guardar dirección' }).click()
  await expect(page.getByText('Calle Luna 5')).toBeVisible()

  // Un cliente normal no entra en el panel
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Zona solo para el equipo.' })).toBeVisible()

  await page.goto('/cuenta')
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL('http://localhost:3000/')
  await page.goto('/cuenta')
  await expect(page).toHaveURL(/\/cuenta\/acceder/)
})

test('acceso con contraseña incorrecta', async ({ page }) => {
  await page.goto('/cuenta/acceder')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Contraseña').fill('incorrecta')
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await expect(page.getByText('Email o contraseña incorrectos.')).toBeVisible()
})
