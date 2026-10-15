import { chromium } from 'playwright-core'
const OUT = '/tmp/claude-0/-home-user-launch/7610294d-d0c7-5499-a3e4-99de0c331e1f/scratchpad/shots'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto('http://localhost:4173/#/mapa'); await page.waitForTimeout(1200)
await page.screenshot({ path: `${OUT}/3d-01-mapa.png` })
// zoom in around the racks
const svg = await page.locator('svg[role=application]').boundingBox()
await page.mouse.move(svg.x + svg.width * 0.5, svg.y + svg.height * 0.5)
for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, -200); await page.waitForTimeout(60) }
await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}/3d-02-zoom.png` })
// select a location
const locs = await page.$$eval('g[data-loc]', (els) => els.map((e) => e.dataset.loc))
const target = locs.find((l) => l.startsWith('L-A-01-03-'))
const el = page.locator(`g[data-loc="${target}"]`).first()
const bb = await el.boundingBox()
if (bb) { await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2) }
await page.waitForTimeout(500)
await page.screenshot({ path: `${OUT}/3d-03-seleccion.png` })
await page.selectOption('select[aria-label="Capa de color"]', 'familia'); await page.waitForTimeout(300)
await page.screenshot({ path: `${OUT}/3d-04-familia.png` })
console.log('errors', errors)
await browser.close()
