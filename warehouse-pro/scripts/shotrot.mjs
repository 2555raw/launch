import { chromium } from 'playwright-core'
const OUT = '/tmp/claude-0/-home-user-launch/7610294d-d0c7-5499-a3e4-99de0c331e1f/scratchpad/shots'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []; page.on('pageerror', (e) => errors.push(String(e)))
await page.goto('http://localhost:4173/#/mapa'); await page.waitForTimeout(1200)
for (const [i, key] of [['a', null], ['b', 'e'], ['c', 'e'], ['d', 'e'], ['e', 'e']]) { if (key) { await page.keyboard.press(key); await page.waitForTimeout(700) } await page.screenshot({ path: `${OUT}/rot-${i}.png` }) }
console.log('errors', errors)
await browser.close()
