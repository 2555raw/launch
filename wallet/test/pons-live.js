/* Launching a coin through Pons, on a chain, from the interface.
 *
 * Pons is deployed on Robinhood Chain mainnet only, so a real launch costs
 * real money and cannot be undone. This puts a stand-in factory at Pons's
 * actual address on a local chain running Robinhood's chain id, and then does
 * the whole thing for real: a wallet in one tap, funded, the form filled, the
 * button pressed, a transaction mined. Afterwards it reads back out of the
 * contract what it was actually handed.
 *
 * The stand-in is not a yes-machine. Its launch config id 0 is retired and id
 * 1 is live, so a wallet that assumed 0 would launch against a dead curve and
 * this test would catch it. It also demands the exact launch fee, since the
 * real factory reverts when msg.value is not equal to it.
 *
 * What it proves: the wiring, the discovery, the encoding, the fee and the
 * fields. What it cannot prove: that the real Pons behaves like its source.
 *
 *   npx hardhat node --port 8545        (with chainId 4663)
 *   PORT=8099 npm start
 *   S=<scratch> node test/pons-mock.js  (compiles the stand-in)
 *   node test/pons-live.js
 */
const { chromium } = require('playwright');
const { ethers } = require('ethers');
const mock = require(process.env.PONS_MOCK || './pons-mock.json');
const RPC = 'http://127.0.0.1:8545';
const FACTORY = '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e';
const FUNDER = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

(async () => {
  const b = await chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  const ctx = await b.newContext({ viewport: { width: 430, height: 940 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  let fail = 0;

  await page.goto('http://127.0.0.1:8099/app#/launch', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.click('#quickGoLaunch');                    // one-tap wallet
  await page.waitForTimeout(2200);
  const me = await page.evaluate(() => JSON.parse(localStorage.getItem('ward.v1.address')));
  console.log('1. wallet:', me);

  // fund it and point the wallet at the local chain
  const p = new ethers.JsonRpcProvider(RPC);
  await (await new ethers.Wallet(FUNDER, p).sendTransaction({ to: me, value: ethers.parseEther('2') })).wait();
  await page.evaluate(rpc => {
    const pr = JSON.parse(localStorage.getItem('ward.v1.prefs') || 'null') || {};
    pr.chainId = 4663; pr.rpc = pr.rpc || {}; pr.rpc[4663] = rpc;
    pr.accounts = pr.accounts || [{ i: 0 }]; pr.active = pr.active || 0;
    localStorage.setItem('ward.v1.prefs', JSON.stringify(pr));
  }, RPC);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await page.evaluate(() => { location.hash = '#/launch'; });
  await page.waitForTimeout(1200);

  const st = await page.evaluate(() => ({
    net: document.querySelector('#netName').textContent.trim(),
    form: !document.querySelector('#launchForm').hidden,
    noCfg: !document.querySelector('#launchNoConfig').hidden
  }));
  console.log('2. red:', st.net, '| formulario:', st.form, '| aviso "sin configurar":', st.noCfg);
  if (!st.form) { console.log('   el formulario deberia estar abierto en Robinhood'); fail++; }
  if (st.noCfg) { console.log('   Pons no necesita configuracion nuestra'); fail++; }

  await page.fill('#lcName', 'Proxima');
  await page.fill('#lcSym', 'pxm');
  await page.fill('#lcDesc', 'Una moneda de prueba, lanzada desde la propia web.');
  await page.fill('#lcUri', 'https://proxima.io/logo.png');
  await page.fill('#lcX', 'x.com/proxima');
  await page.click('.note.danger .check span');
  await page.waitForTimeout(300);
  const off = await page.$eval('#lcGo', x => x.disabled);
  console.log('3. boton habilitado:', !off);
  if (off) { console.log('   el boton sigue cerrado'); fail++; }

  await page.click('#lcGo');
  await page.waitForTimeout(6000);

  // read back what the contract actually received
  const c = new ethers.Contract(FACTORY, mock.abi, p);
  const got = {
    name: await c.lastName(), symbol: await c.lastSymbol(), desc: await c.lastDesc(),
    logo: await c.lastLogo(), twitter: await c.lastTwitter(), creator: await c.lastCreator(),
    value: await c.lastValue(), configId: await c.lastConfigId(), pair: await c.lastPair(),
    economics: await c.lastEconomics()
  };
  console.log('4. el contrato recibio:');
  console.log('   name=' + got.name + '  symbol=' + got.symbol);
  console.log('   desc=' + JSON.stringify(got.desc.slice(0, 40)));
  console.log('   logo=' + got.logo + '  twitter=' + got.twitter);
  console.log('   creator=' + got.creator);
  console.log('   fee pagada=' + got.value + '  configId=' + got.configId + '  pair=' + got.pair);

  if (got.name !== 'Proxima') { console.log('   nombre incorrecto'); fail++; }
  if (got.symbol !== 'PXM') { console.log('   simbolo no normalizado'); fail++; }
  if (!got.desc.startsWith('Una moneda')) { console.log('   descripcion incorrecta'); fail++; }
  if (got.logo !== 'https://proxima.io/logo.png') { console.log('   logo incorrecto'); fail++; }
  if (got.twitter !== 'x.com/proxima') { console.log('   twitter incorrecto'); fail++; }
  if (got.creator.toLowerCase() !== me.toLowerCase()) { console.log('   el creador no es el wallet'); fail++; }
  if (got.value !== 1234567n) { console.log('   comision exacta no pagada'); fail++; }
  if (got.configId !== 1n) { console.log('   USO LA CONFIGURACION RETIRADA (id 0) EN VEZ DE LA VIVA'); fail++; }
  if (got.pair !== '0x0000000000000000000000000000000000000000') { console.log('   par incorrecto'); fail++; }
  const want = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(['uint256','address'],[1n,'0x0000000000000000000000000000000000000000']));
  if (got.economics !== want) { console.log('   economics no fijadas desde preview'); fail++; }

  const sheet = await page.evaluate(() => {
    const s = document.querySelector('#statusSheet');
    return s && !s.hidden ? s.innerText.split('\n').filter(Boolean)[0] : null;
  });
  console.log('5. la pantalla dice:', JSON.stringify(sheet));

  const real = errs.filter(e => !/Failed to load|net::ERR/i.test(e));
  if (real.length) { console.log('errores:', real.slice(0, 3)); fail++; }
  console.log(fail ? `\n${fail} problemas` : '\nuna moneda lanzada desde la web, en cadena, con todo en su campo');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
