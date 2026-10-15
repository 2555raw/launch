// Pruebas end-to-end con Chromium: navegación, arrastrar y soltar en el plano, persistencia tras recarga.
import { chromium } from 'playwright-core'
const BASE = process.env.BASE ?? 'http://localhost:4173/'
const OUT = process.env.OUT ?? './e2e-shots'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-ES' })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
const results = []
const check = (name, ok, info = '') => { results.push({ name, ok, info }); console.log(`${ok ? '✓' : '✗'} ${name} ${info}`) }
const go = async (hash) => { await page.goto(BASE + '#/' + hash); await page.waitForTimeout(600) }

await go('dashboard')
await page.waitForSelector('text=Referencias SKU', { timeout: 15000 })
await page.screenshot({ path: `${OUT}/01-dashboard.png` })
check('Dashboard carga con datos de demostración', await page.locator('text=Datos de demostración').count() > 0)

// Mapa: seleccionar una ubicación con stock y arrastrarla a otra
await go('mapa')
await page.waitForSelector('svg[role=application]')
await page.screenshot({ path: `${OUT}/02-mapa.png` })
// Buscar la ubicación A-01-02-01 del seed (puede estar vacía): usamos la primera estantería con stock por su título
const locs = await page.$$eval('rect[data-loc]', (els) => els.map((e) => ({ id: e.dataset.loc, title: e.querySelector('title')?.textContent ?? '' })))
const withStock = locs.filter((l) => /· (\d+)\/(\d+)/.test(l.title) && !/· 0\//.test(l.title) && /Parcial/.test(l.title) && l.id.startsWith('L-A-'))
check('Hay ubicaciones parcialmente ocupadas en zona A', withStock.length > 0, `${withStock.length}`)
const src = withStock[0]
await page.click(`rect[data-loc="${src.id}"]`)
await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}/03-mapa-seleccion.png` })
const panelCode = await page.locator('h2.font-mono').first().textContent()
check('El panel lateral muestra la ubicación seleccionada', panelCode?.trim() === src.id.replace('L-', ''), panelCode ?? '')
// SKU y cantidad del primer producto del panel
const sku = (await page.locator('aside li .font-mono').first().textContent())?.trim().split(' ')[0]
const qtyBefore = Number((await page.locator('aside li .text-base.font-bold').first().textContent())?.replace(/\D/g, ''))
// Destino: una ubicación libre de la zona A, nivel 1 (tamaño L admite todo)
const freeA = locs.filter((l) => /Libre/.test(l.title) && /^L-A-\d\d-\d\d-01$/.test(l.id) && l.id !== src.id)
const dst = freeA[0]
check('Hay una ubicación libre de destino en zona A nivel 1', !!dst, dst?.id ?? '')
const sb = await page.locator(`rect[data-loc="${src.id}"]`).boundingBox()
const db = await page.locator(`rect[data-loc="${dst.id}"]`).boundingBox()
await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2)
await page.mouse.down()
for (let i = 1; i <= 12; i++) { await page.mouse.move(sb.x + (db.x - sb.x) * (i / 12) + sb.width / 2, sb.y + (db.y - sb.y) * (i / 12) + sb.height / 2); await page.waitForTimeout(30) }
await page.screenshot({ path: `${OUT}/04-mapa-arrastre.png` })
await page.mouse.up()
await page.waitForSelector('text=Confirmar movimiento de mercancía', { timeout: 5000 })
await page.screenshot({ path: `${OUT}/05-mapa-confirmacion.png` })
const moveQty = Math.min(3, qtyBefore)
await page.fill('input[type=number]', String(moveQty))
await page.click('button:has-text("Confirmar traslado")')
await page.waitForTimeout(600)
check('Toast de movimiento registrado', await page.locator('text=Movimiento registrado').count() > 0)
// El panel ahora muestra el destino
const panelAfter = await page.locator('h2.font-mono').first().textContent()
check('Tras soltar, el panel muestra el destino', panelAfter?.trim() === dst.id.replace('L-', ''), panelAfter ?? '')
const dstQty = Number((await page.locator('aside li .text-base.font-bold').first().textContent())?.replace(/\D/g, ''))
check('El destino tiene la cantidad movida', dstQty === moveQty, `${dstQty} === ${moveQty}`)
await page.click(`rect[data-loc="${src.id}"]`)
await page.waitForTimeout(300)
const srcQty = Number((await page.locator('aside li .text-base.font-bold').first().textContent())?.replace(/\D/g, ''))
check('El origen conserva el resto', srcQty === qtyBefore - moveQty, `${srcQty} === ${qtyBefore - moveQty}`)
await page.screenshot({ path: `${OUT}/06-mapa-tras-mover.png` })

// Persistencia: recargar y comprobar
await page.reload()
await page.waitForSelector('svg[role=application]')
await page.waitForTimeout(800)
await page.click(`rect[data-loc="${dst.id}"]`)
await page.waitForTimeout(300)
const dstQtyReload = Number((await page.locator('aside li .text-base.font-bold').first().textContent())?.replace(/\D/g, ''))
check('Tras recargar, el destino conserva el stock (IndexedDB)', dstQtyReload === moveQty, `${dstQtyReload}`)

// Historial refleja el movimiento
await go('historial')
await page.waitForTimeout(500)
check('El historial muestra la transferencia', await page.locator(`text=${dst.id.replace('L-', '')}`).count() > 0)
await page.screenshot({ path: `${OUT}/07-historial.png` })

// Resto de pantallas
for (const [hash, name] of [['inventario', '08-inventario'], ['recepcion', '09-recepcion'], ['ubicaciones', '10-ubicaciones'], ['pedidos', '11-pedidos'], ['expediciones', '12-expediciones'], ['transferencias', '13-transferencias'], ['devoluciones', '14-devoluciones'], ['informes', '15-informes'], ['configuracion', '16-configuracion']]) {
  await go(hash); await page.waitForTimeout(700); await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: hash === 'informes' })
}
// Flujo de pedido: abrir el primero pendiente y ver ruta
await go('pedidos')
await page.click('text=En cola')
await page.click('tbody tr >> nth=0')
await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}/17-pedido-detalle.png` })
await page.click('button:has-text("Ver ruta en el plano")')
await page.waitForTimeout(800)
await page.screenshot({ path: `${OUT}/18-mapa-ruta.png` })
check('La ruta de picking se dibuja en el plano', await page.locator('path.route-path').count() > 0)
// Flujo en U y comparación
await page.click('button:has-text("Flujo en U")')
await page.waitForTimeout(300)
await page.screenshot({ path: `${OUT}/19-mapa-flujo-u.png` })
await page.click('button:has-text("Comparar flujos")')
await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}/20-flujos-comparacion.png` })
await page.keyboard.press('Escape')
// Idioma: cambiar a inglés y chino
await page.selectOption('select[aria-label="Idioma"]', 'en')
await page.waitForTimeout(400)
await go('dashboard'); await page.waitForTimeout(500)
await page.screenshot({ path: `${OUT}/21-dashboard-en.png` })
await page.selectOption('header select', 'zh')
await page.waitForTimeout(500)
await page.screenshot({ path: `${OUT}/22-dashboard-zh.png` })
await page.selectOption('header select', 'es')
// Móvil
await page.setViewportSize({ width: 390, height: 844 })
await go('mapa'); await page.waitForTimeout(600)
await page.screenshot({ path: `${OUT}/23-mapa-movil.png` })
await go('dashboard'); await page.waitForTimeout(600)
await page.screenshot({ path: `${OUT}/24-dashboard-movil.png` })

check('Sin errores de consola/página', errors.length === 0, errors.slice(0, 3).join(' | '))
await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} comprobaciones correctas`)
process.exit(failed.length ? 1 : 0)
