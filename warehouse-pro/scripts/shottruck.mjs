import { chromium } from 'playwright-core'
const OUT = '/tmp/claude-0/-home-user-launch/7610294d-d0c7-5499-a3e4-99de0c331e1f/scratchpad/shots'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://localhost:4173/#/mapa?loc=L-MDE-00-01-01'); await page.waitForTimeout(1500)
const svg = await page.locator('svg[role=application]').boundingBox()
await page.mouse.move(svg.x + svg.width * 0.08, svg.y + svg.height * 0.6)
for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, -200); await page.waitForTimeout(50) }
await page.waitForTimeout(500)
await page.screenshot({ path: `${OUT}/truck-3d.png` })
await page.keyboard.press('v'); await page.waitForTimeout(800)
await page.screenshot({ path: `${OUT}/truck-2d.png` })
await browser.close()
