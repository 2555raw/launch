import { expect, test } from '@playwright/test'

test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: 'hdm_consent', value: encodeURIComponent(JSON.stringify({ v: 1, analytics: false, at: 'e2e' })), url: 'http://localhost:3000' },
  ])
})

test('el panel de ayuda responde dudas y ofrece el email', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '¿Necesitas ayuda?' }).click()
  const panel = page.getByRole('dialog', { name: 'Ayuda' })
  await expect(panel.getByText('¿Cómo podemos ayudarte?')).toBeVisible()
  await expect(panel.getByRole('link', { name: /Escríbenos un email/ })).toHaveAttribute('href', 'mailto:HambreDeMas@gmail.com')

  await panel.getByRole('button', { name: 'Pregúntale a nuestro asistente' }).click()
  await panel.getByLabel('Tu pregunta').fill('¿Cuánto cuesta el envío?')
  await panel.getByRole('button', { name: 'Enviar' }).click()
  // Sin ANTHROPIC_API_KEY responde con la pregunta frecuente; con clave, con IA
  await expect(panel.getByText(/4,95/)).toBeVisible({ timeout: 30_000 })

  await page.keyboard.press('Escape')
  await expect(panel).toBeHidden()
})
