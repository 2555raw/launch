import { chromium } from 'playwright-core'
const OUT = '/tmp/claude-0/-home-user-launch/7610294d-d0c7-5499-a3e4-99de0c331e1f/scratchpad/shots'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []; page.on('pageerror', (e) => errors.push(String(e)))
await page.goto('http://localhost:4173/#/dashboard'); await page.waitForTimeout(1200)
for (const r of ['preparador', 'recepcion', 'expedicion']) {
  await page.selectOption('select[aria-label="Puesto de trabajo"]', r); await page.waitForTimeout(600)
  await page.goto('http://localhost:4173/#/dashboard'); await page.waitForTimeout(700)
  await page.screenshot({ path: `${OUT}/role-${r}.png` })
}
await page.goto('http://localhost:4173/#/configuracion'); await page.waitForTimeout(600)
await page.screenshot({ path: `${OUT}/role-restricted.png` })
await page.selectOption('select[aria-label="Puesto de trabajo"]', 'jefe'); await page.waitForTimeout(400)
console.log('errors', errors)
await browser.close()
