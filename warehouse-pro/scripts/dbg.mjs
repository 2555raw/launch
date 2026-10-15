import { chromium } from 'playwright-core'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://localhost:4173/#/mapa'); await page.waitForTimeout(1000)
await page.keyboard.press('e'); await page.waitForTimeout(700); await page.keyboard.press('e'); await page.waitForTimeout(900)
const info = await page.evaluate(() => {
  const g = document.querySelectorAll('[data-loc="L-MDE-00-01-01"]')
  const polys = [...g[0].querySelectorAll('polygon')].map((p) => p.getAttribute('points').slice(0, 80))
  const texts = [...document.querySelectorAll('svg[role=application] text')].filter((t) => t.textContent === 'M1').length
  return { groups: g.length, polys, m1texts: texts, total: document.querySelectorAll('svg[role=application] polygon').length }
})
console.log(JSON.stringify(info, null, 1))
await browser.close()
