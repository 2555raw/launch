import { chromium } from 'playwright-core'
import { readFileSync } from 'node:fs'
const [,, input, output, size = '1024'] = process.argv
const svg = readFileSync(input, 'utf8')
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: +size, height: +size } })
await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace(/width="\d+" height="\d+"/, `width="${size}" height="${size}"`)}</body></html>`)
await page.screenshot({ path: output, omitBackground: true })
await browser.close()
console.log('written', output)
