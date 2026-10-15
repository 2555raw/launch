// Graba escenas de la aplicación para el vídeo promocional.
import { chromium } from 'playwright-core'
import { rename } from 'node:fs/promises'
const OUT = '/tmp/claude-0/-home-user-launch/7610294d-d0c7-5499-a3e4-99de0c331e1f/scratchpad/video/rec'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] })
const W = 1280, H = 720
async function scene(name, fn) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: OUT, size: { width: W, height: H } }, locale: 'es-ES' })
  const page = await ctx.newPage()
  await page.goto('http://localhost:4173/#/dashboard'); await page.waitForTimeout(600)
  // asegurar puesto jefe y 3D
  await page.evaluate(() => { try { localStorage.setItem('warehouse-pro:map-mode', '3d') } catch {} })
  await fn(page)
  const video = page.video()
  await ctx.close()
  const p = await video.path()
  await rename(p, `${OUT}/${name}.webm`)
  console.log('scene', name)
}
const smoothMove = async (page, x1, y1, x2, y2, steps = 24, delay = 28) => { for (let i = 1; i <= steps; i++) { await page.mouse.move(x1 + (x2 - x1) * i / steps, y1 + (y2 - y1) * i / steps); await page.waitForTimeout(delay) } }

await scene('dashboard', async (page) => {
  await page.goto('http://localhost:4173/#/dashboard'); await page.waitForTimeout(1400)
  for (let i = 0; i < 24; i++) { await page.mouse.wheel(0, 28); await page.waitForTimeout(70) }
  await page.waitForTimeout(1200)
})
await scene('mapa', async (page) => {
  await page.goto('http://localhost:4173/#/mapa'); await page.waitForTimeout(1200)
  await page.keyboard.press('r'); await page.waitForTimeout(9000)
})
await scene('seleccion', async (page) => {
  await page.goto('http://localhost:4173/#/mapa'); await page.waitForTimeout(1000)
  const bb = await page.locator('svg[role=application]').boundingBox()
  await page.mouse.move(bb.x + bb.width * 0.52, bb.y + bb.height * 0.5)
  for (let i = 0; i < 7; i++) { await page.mouse.wheel(0, -160); await page.waitForTimeout(140) }
  await page.waitForTimeout(500)
  const locs = await page.$$eval('[data-loc]', (els) => els.map((e) => e.dataset.loc))
  const target = locs.find((l) => l.startsWith('L-A-01-03-'))
  const tb = await page.locator(`[data-loc="${target}"]`).first().boundingBox()
  await smoothMove(page, bb.x + bb.width * 0.52, bb.y + bb.height * 0.5, tb.x + tb.width / 2, tb.y + tb.height / 2, 20)
  await page.mouse.click(tb.x + tb.width / 2, tb.y + tb.height / 2); await page.waitForTimeout(2200)
  await page.selectOption('select[aria-label="Capa de color"]', 'familia'); await page.waitForTimeout(1500)
})
await scene('mover', async (page) => {
  await page.goto('http://localhost:4173/#/mapa'); await page.waitForTimeout(1000)
  const bb = await page.locator('svg[role=application]').boundingBox()
  await page.mouse.move(bb.x + bb.width * 0.52, bb.y + bb.height * 0.5)
  for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, -160); await page.waitForTimeout(100) }
  await page.waitForTimeout(400)
  const all = await page.$$eval('[data-loc]', (els) => els.map((e) => ({ id: e.dataset.loc, title: e.querySelector('title')?.textContent ?? '' })))
  const src = all.find((l) => l.id.startsWith('L-A-01-') && /Parcial/.test(l.title))
  const dst = all.find((l) => /Libre/.test(l.title) && /^L-A-02-\d\d-01$/.test(l.id))
  const sb = await page.locator(`[data-loc="${src.id}"]`).first().boundingBox()
  const db = await page.locator(`[data-loc="${dst.id}"]`).first().boundingBox()
  await smoothMove(page, bb.x + bb.width * 0.52, bb.y + bb.height * 0.5, sb.x + sb.width / 2, sb.y + sb.height / 2, 16)
  await page.waitForTimeout(300); await page.mouse.down()
  await smoothMove(page, sb.x + sb.width / 2, sb.y + sb.height / 2, db.x + db.width / 2, db.y + db.height / 2, 40, 35)
  await page.waitForTimeout(500); await page.mouse.up(); await page.waitForTimeout(900)
  const input = page.locator('input[type=number]').first()
  await input.fill(''); await page.waitForTimeout(200); await input.type('5', { delay: 120 }); await page.waitForTimeout(600)
  await page.click('button:has-text("Confirmar traslado")'); await page.waitForTimeout(2200)
})
await scene('picking', async (page) => {
  await page.goto('http://localhost:4173/#/pedidos'); await page.waitForTimeout(900)
  await page.click('tbody tr >> nth=0'); await page.waitForTimeout(1600)
  await page.click('button:has-text("Recoger todo")').catch(() => {}); await page.waitForTimeout(1600)
  await page.keyboard.press('Escape'); await page.waitForTimeout(300)
  await page.goto('http://localhost:4173/#/recepcion'); await page.waitForTimeout(1300)
  await page.goto('http://localhost:4173/#/expediciones'); await page.waitForTimeout(1800)
})
await scene('puestos', async (page) => {
  await page.goto('http://localhost:4173/#/dashboard'); await page.waitForTimeout(800)
  await page.selectOption('select[aria-label="Puesto de trabajo"]', 'preparador'); await page.waitForTimeout(1500)
  await page.selectOption('select[aria-label="Puesto de trabajo"]', 'recepcion'); await page.waitForTimeout(1500)
  await page.selectOption('select[aria-label="Puesto de trabajo"]', 'expedicion'); await page.waitForTimeout(1500)
  await page.selectOption('select[aria-label="Puesto de trabajo"]', 'jefe'); await page.waitForTimeout(600)
})
await scene('informes', async (page) => {
  await page.goto('http://localhost:4173/#/informes'); await page.waitForTimeout(1600)
  for (let i = 0; i < 14; i++) { await page.mouse.wheel(0, 30); await page.waitForTimeout(80) }
  await page.waitForTimeout(800)
  await page.goto('http://localhost:4173/#/historial'); await page.waitForTimeout(1600)
})
await browser.close()
