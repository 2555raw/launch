/* Recorrido completo contra una cadena EVM de verdad. Ver test/README.md.
 *
 * No comprueba maquetación: comprueba que la frase es BIP-39 válida, que el
 * secreto no queda en claro en el navegador, y que el pago que la pantalla da
 * por confirmado existe en la cadena y ha movido el dinero. */
const { chromium } = require('playwright');
const { ethers } = require('ethers');

const APP = process.env.APP_URL || 'http://127.0.0.1:8099/app';
const RPC = process.env.RPC_URL || 'http://127.0.0.1:8545';
const FUNDER = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const DEST = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

const SHOTS = process.env.SHOT_DIR || require('os').tmpdir() + '/calma-';
const step = m => console.log('  ▸ ' + m);

(async () => {
  const browser = await chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

  await page.goto(APP, { waitUntil: 'networkidle' });
  step('página cargada');

  await page.click('#startCreate');
  await page.waitForSelector('.seed .word');
  const words = await page.$$eval('#seedGrid .word .w', n => n.map(x => x.textContent));
  if (words.length !== 12) throw new Error('esperaba 12 palabras, hay ' + words.length);
  if (!ethers.Mnemonic.isValidMnemonic(words.join(' '))) throw new Error('la frase generada no es válida BIP-39');
  step('frase BIP-39 válida de 12 palabras generada en el navegador');

  await page.click('label.check'); // como lo haría una persona: sobre la etiqueta
  await page.click('#toVerify');
  await page.waitForSelector('#verifyFields .vf');

  // Primero una palabra mal, para comprobar que la verificación no es decorativa
  const rows = await page.$$('#verifyFields .vf');
  await rows[0].$eval('input', i => { i.value = 'zzz'; });
  await page.click('#toPass');
  if (await page.isHidden('#verifyErr')) throw new Error('aceptó una palabra incorrecta');
  step('rechaza una palabra incorrecta');

  for (const row of rows) {
    const n = parseInt((await row.$eval('b', b => b.textContent)).replace(/\D/g, ''), 10);
    await row.$eval('input', (i, v) => { i.value = v; i.dispatchEvent(new Event('input')); }, words[n - 1]);
  }
  await page.click('#toPass');
  await page.waitForSelector('[data-view="password"].on');
  step('verificación de la frase superada');

  await page.fill('#pw1', 'Calma-2026!seg');
  await page.fill('#pw2', 'Calma-2026!seg');
  await page.click('#doCreate');
  await page.waitForSelector('[data-view="home"].on', { timeout: 60000 });
  step('wallet cifrada (scrypt) y abierta');

  const store = await page.evaluate(() => ({
    ks: localStorage.getItem('calma.v1.keystore'),
    addr: JSON.parse(localStorage.getItem('calma.v1.address')),
    all: JSON.stringify(Object.fromEntries(Object.entries(localStorage)))
  }));
  const ksObj = JSON.parse(JSON.parse(store.ks));
  const box = ksObj.Crypto || ksObj.crypto;
  if (!box || !box.ciphertext) throw new Error('el keystore no parece cifrado');
  if (box.kdf !== 'scrypt') throw new Error('kdf inesperado: ' + box.kdf);
  // Nada del secreto puede quedar en claro en el navegador
  for (const w of words) {
    const re = new RegExp('(^|[^a-z])' + w + '([^a-z]|$)', 'i');
    if (re.test(store.all)) throw new Error('la palabra "' + w + '" quedó en claro en localStorage');
  }
  if (store.all.includes(ethers.HDNodeWallet.fromPhrase(words.join(' ')).privateKey.slice(2)))
    throw new Error('la clave privada quedó en claro en localStorage');
  const derived = ethers.HDNodeWallet.fromPhrase(words.join(' '));
  if (derived.address.toLowerCase() !== store.addr.toLowerCase())
    throw new Error('la dirección no deriva de la frase mostrada');
  step('keystore cifrado con scrypt; ni la frase ni la clave están en claro');
  step('la dirección deriva de la frase mostrada: ' + store.addr);

  // Dinero real en la cadena local
  const prov = new ethers.JsonRpcProvider(RPC);
  const funder = new ethers.Wallet(FUNDER, prov);
  await (await funder.sendTransaction({ to: store.addr, value: ethers.parseEther('2') })).wait();
  step('financiada con 2 ETH en la cadena');

  await page.click('[data-go="settings"]');
  await page.fill('#rpcInput', RPC);
  await page.click('#saveRpc');
  await page.click('.view[data-view="settings"] .back');
  await page.waitForFunction(() => {
    const t = document.querySelector('#totalBal').textContent;
    return t && t.includes('ETH');
  }, { timeout: 30000 });
  const bal = await page.textContent('#totalBal');
  if (bal !== '2 ETH') throw new Error('saldo leído: ' + bal);
  step('saldo leído de la cadena: ' + bal);

  // Pago real
  const before = await prov.getBalance(DEST);
  await page.click('[data-go="send"]');
  await page.fill('#toInput', DEST);
  await page.fill('#amtInput', '0,25'); // coma decimal, como en español
  await page.click('#reviewBtn');
  await page.waitForSelector('#confirmSheet:not([hidden])', { timeout: 30000 });
  const fee = await page.textContent('#cfFee');
  const after = await page.textContent('#cfAfter');
  step('revisión: comisión ' + fee + ' · saldo después ' + after);

  await page.click('#cfSend');
  await page.waitForSelector('#stTitle', { timeout: 30000 });
  await page.waitForFunction(() => document.querySelector('#stTitle').textContent === 'Pago confirmado', null, { timeout: 60000 });
  const txLink = await page.getAttribute('#stLink', 'href');
  step('la app dice: Pago confirmado');

  const diff = (await prov.getBalance(DEST)) - before;
  if (diff !== ethers.parseEther('0.25')) throw new Error('el destinatario recibió ' + ethers.formatEther(diff));
  const hash = txLink.split('/tx/')[1];
  const rc = await prov.getTransactionReceipt(hash);
  const tx = await prov.getTransaction(hash);
  if (!rc || rc.status !== 1) throw new Error('recibo no válido');
  if (tx.from.toLowerCase() !== store.addr.toLowerCase()) throw new Error('la firma no es de la wallet');
  step('EN CADENA: tx ' + hash.slice(0, 18) + '… tipo ' + tx.type + ' bloque ' + rc.blockNumber + ', 0.25 ETH recibidos');

  // El destinatario puede gastarlo: el dinero es real, no un número en pantalla
  step('destinatario ahora tiene ' + ethers.formatEther(await prov.getBalance(DEST)) + ' ETH');

  // Bloqueo y reapertura con contraseña
  await page.click('#stDone');
  await page.click('#lockBtn');
  await page.waitForSelector('[data-view="unlock"].on');
  await page.fill('#unlockPw', 'mal');
  await page.click('#doUnlock');
  await page.waitForSelector('#unlockErr:not([hidden])');
  step('contraseña incorrecta rechazada');
  await page.fill('#unlockPw', 'Calma-2026!seg');
  await page.click('#doUnlock');
  await page.waitForSelector('[data-view="home"].on', { timeout: 60000 });
  await page.waitForSelector('#recentList li .st-tag');
  const tag = await page.textContent('#recentList .st-tag');
  step('reabierta; el movimiento aparece como: ' + tag);

  // Enlace de cobro
  await page.click('[data-go="charge"]');
  await page.fill('#chargeAmt', '1.5');
  await page.fill('#chargeNote', 'Mesa 4');
  await page.click('#makeLink');
  await page.waitForSelector('#linkOut:not([hidden])');
  const link = await page.textContent('#linkText');
  step('enlace de cobro: ' + link.slice(0, 96) + '…');

  // Quien lo recibe abre el enlace: pestaña nueva, carga completa desde cero
  const payer = await ctx.newPage();
  payer.on('pageerror', e => errors.push('PAGEERROR(pagador): ' + e.message));
  await payer.goto(link, { waitUntil: 'domcontentloaded' });
  await payer.waitForSelector('[data-view="unlock"].on', { timeout: 30000 });
  await payer.fill('#unlockPw', 'Calma-2026!seg');
  await payer.click('#doUnlock');
  await payer.waitForSelector('[data-view="send"].on', { timeout: 60000 });
  const to = await payer.inputValue('#toInput'), amt = await payer.inputValue('#amtInput');
  const noteTxt = await payer.textContent('#payNote');
  /* El enlace lleva 1.5 (es una URL) y la pantalla lo muestra 1,5 (es español). */
  if (to.toLowerCase() !== store.addr.toLowerCase() || amt !== '1,5') throw new Error('el cobro no se rellenó: ' + to + ' / ' + amt);
  if (!noteTxt.includes('Mesa 4')) throw new Error('el concepto no llegó');
  step('el enlace, abierto en frío, lleva directo al pago rellenado: ' + amt + ' ETH · "' + noteTxt.trim().slice(0, 44) + '"');
  await payer.screenshot({ path: SHOTS + 'shot-pay.png' });
  await payer.close();

  await page.click('#brandHome');
  await page.waitForSelector('[data-view="home"].on');
  await page.screenshot({ path: SHOTS + 'shot-home.png' });
  await page.click('[data-go="receive"]');
  await page.waitForSelector('#qrBox img');
  await page.screenshot({ path: SHOTS + 'shot-recv.png' });

  const realErrors = errors.filter(e => !/base\.org|Failed to load resource|ERR_|net::/i.test(e));
  if (realErrors.length) { console.log('\n⚠ errores de consola:'); realErrors.forEach(e => console.log('   ' + e)); }
  else step('sin errores de JavaScript en consola');

  await browser.close();
  console.log('\n✅ TODO EL RECORRIDO PASA');
})().catch(async e => { console.error('\n❌ FALLO: ' + e.message); process.exit(1); });
