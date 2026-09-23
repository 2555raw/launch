/* The launch path, driven by a fake wallet.
 *
 * The page is served by the real server.js and given a test config whose token
 * addresses resolve, so the pad gets past its own verification gate. Then the
 * exact bytes it hands the wallet are checked: that a deployment is a create
 * with the compiled bytecode and the encoded draw, and that a pool is an
 * approval followed by addLiquidity with the right router, amounts and slippage.
 *
 * Nothing is broadcast. Needs Playwright:
 *   CHROME_PATH=/path/to/chrome node test/launch.test.js
 */
const path = require('path');
const { spawn } = require('child_process');

let passed = 0;
const fails = [];
const ok = (name, cond, detail) => {
  if (cond) { passed++; console.log('  ok   ' + name); }
  else { fails.push(name + (detail ? ' — ' + detail : '')); console.log('  FAIL ' + name + (detail ? ' — ' + detail : '')); }
};

const PORT = 8123;
const TOKEN = '0x1111111111111111111111111111111111111111';
const ROUTER = '0x2222222222222222222222222222222222222222';
const WETH = '0x3333333333333333333333333333333333333333';
const COIN = '0x4444444444444444444444444444444444444444';
const ME = '0x00000000000000000000000000000000000000c0';

/* squares are themes and carry no address; one quote token does the pairing */
const testConfig = `window.SPINPAD_CONFIG = (() => {
  const t = (name, ticker, glyph) => ({ name, ticker, glyph, logo: '' });
  const fam = (family, blurb, a, b, c, d) => ({ family, blurb, bid: a, ask: b, short: c, long: d });
  return {
    chain: { id: 8453, hex: '0x2105', name: 'Base', currency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
             rpc: ['https://example.invalid'], explorer: 'https://example.invalid' },
    router: { address: '${ROUTER}', kind: 'uniswap-v2', weth: '${WETH}' },
    quote: { name: 'Wrapped Ether', ticker: 'TEST', address: '${TOKEN}', decimals: 18 },
    assets: {
      green:  fam('Stables', 'x', t('Test Token','TEST','grid'), t('Test Token','TEST','bars'), t('Test Token','TEST','orbit'), t('Test Token','TEST','chevron')),
      blue:   fam('Ether',   'x', t('Test Token','TEST','delta'), t('Test Token','TEST','tiles'), t('Test Token','TEST','wave'), t('Test Token','TEST','play')),
      yellow: fam('Bitcoin', 'x', t('Test Token','TEST','arc'), t('Test Token','TEST','loop'), t('Test Token','TEST','stack'), t('Test Token','TEST','arrowbox')),
      red:    fam('Natives', 'x', t('Test Token','TEST','bolt'), t('Test Token','TEST','spark'), t('Test Token','TEST','rail'), t('Test Token','TEST','waves')),
    },
    liquidity: { supplyShare: 0.8, slippageBps: 100, deadlineMinutes: 20 },
  };
})();`;

const wallet = `
window.__sent = [];
const abiString = (s) => {
  const hex = Buffer_toHex(s);
  return '0x' + (32).toString(16).padStart(64,'0') + s.length.toString(16).padStart(64,'0') + hex.padEnd(Math.ceil(hex.length/64)*64, '0');
};
function Buffer_toHex(s) { return [...new TextEncoder().encode(s)].map(b => b.toString(16).padStart(2,'0')).join(''); }
window.ethereum = {
  _h: {},
  on(ev, fn) { this._h[ev] = fn; },
  async request({ method, params }) {
    window.__sent.push({ method, params: params || [] });
    switch (method) {
      case 'eth_requestAccounts': return ['${ME}'];
      case 'eth_chainId': return '0x2105';
      case 'eth_getCode': return '0x6001';
      case 'eth_call': {
        const d = (params[0].data || '');
        if (d.startsWith('0x95d89b41')) return abiString('TEST');                       // symbol()
        if (d.startsWith('0x313ce567')) return '0x' + (18).toString(16).padStart(64,'0'); // decimals()
        if (d.startsWith('0xad5c4648')) return '0x' + '${WETH}'.slice(2).padStart(64,'0'); // WETH()
        if (d.startsWith('0xc45a0155')) return '0x' + '${WETH}'.slice(2).padStart(64,'0'); // factory()
        return '0x';
      }
      case 'eth_sendTransaction': return '0x' + 'ab'.repeat(32);
      case 'eth_getTransactionReceipt': return { blockNumber: '0x1', status: '0x1', contractAddress: '${COIN}' };
      default: return null;
    }
  },
};`;

(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); }
  catch (e) { console.log('skipped: playwright is not installed'); return; }

  const server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore',
  });
  await new Promise((r) => setTimeout(r, 700));

  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_CERT|net::/.test(m.text())) errors.push(m.text()); });

  await page.route('**/config.js', (route) =>
    route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: testConfig }));
  await page.addInitScript(wallet);

  console.log('\nconnecting');
  await page.goto('http://127.0.0.1:' + PORT + '/');
  await page.waitForTimeout(700);
  await page.check('#gateAgree');
  await page.click('#gateGo');
  await page.waitForTimeout(250);

  await page.click('#connect');
  await page.waitForTimeout(1200);
  ok('the wallet shows as connected', (await page.locator('#connect').textContent()).includes('0x0000'));
  ok('the pad reports itself ready', (await page.locator('.lv-verify-head').textContent()).startsWith('Ready to launch'));
  ok('both the pair token and the router verify',
    (await page.locator('.lv-verify-list .is-bad').count()) === 0);

  console.log('\nlaunching');
  await page.fill('#fName', 'Northwind Capital');
  await page.fill('#fTicker', 'NWND');
  await page.fill('#fSupply', '1000000');
  await page.click('#toSpin');
  await page.waitForTimeout(200);

  ok('nothing was sent before the spin',
    (await page.evaluate(() => window.__sent.filter((s) => s.method === 'eth_sendTransaction').length)) === 0);

  await page.click('#spin');
  await page.waitForFunction(() => !document.getElementById('launchBtn').disabled, null, { timeout: 12000 });
  await page.waitForTimeout(250);
  const drew = (await page.locator('#assetName').textContent()).trim();

  await page.click('#launchBtn');
  await page.waitForTimeout(1500);

  const txs = await page.evaluate(() => window.__sent.filter((s) => s.method === 'eth_sendTransaction'));
  ok('exactly one transaction for a deployment', txs.length === 1, txs.length + ' sent');

  if (txs.length) {
    const tx = txs[0].params[0];
    const bytecode = await page.evaluate(() => window.SPINPAD_COIN.bytecode);
    ok('it is a create, with no "to"', tx.to === undefined || tx.to === null);
    ok('it is sent from the connected account', String(tx.from).toLowerCase() === ME);
    ok('it starts with the compiled bytecode', String(tx.data).startsWith(bytecode));
    const args = String(tx.data).slice(bytecode.length);
    ok('the constructor args are whole words', args.length % 64 === 0, args.length + ' hex chars');
    ok('the drawn theme is in the args',
      args.includes(Buffer.from(drew.split(' \u00b7 ')[0], 'utf8').toString('hex')),
      'theme "' + drew + '" not found in the encoded args');
    ok('the coin name is in the args',
      args.includes(Buffer.from('Northwind Capital', 'utf8').toString('hex')));
  }

  ok('the record is shown', await page.locator('#ticket').isVisible());
  ok('the coin is on the board', (await page.locator('.lv-coin').count()) === 1);
  ok('the card links to the contract',
    (await page.locator('.lv-coin-facts a').first().getAttribute('href')).includes(COIN));
  ok('the launch control closed behind it', await page.locator('#launchBtn').isDisabled());
  ok('the draw reached the form', drew.length > 0);

  console.log('\nthe pool');
  await page.fill('#poolAmount', '0.05');
  await page.click('#poolBtn');
  await page.waitForTimeout(1500);

  const after = await page.evaluate(() => window.__sent.filter((s) => s.method === 'eth_sendTransaction'));
  ok('two more transactions: an approval and the liquidity', after.length === 3, after.length + ' in total');
  if (after.length === 3) {
    const appr = after[1].params[0];
    const liq = after[2].params[0];
    ok('the approval goes to the coin', String(appr.to).toLowerCase() === COIN);
    ok('and approves the router', String(appr.data).includes(ROUTER.slice(2).toLowerCase()));
    ok('the liquidity goes to the router', String(liq.to).toLowerCase() === ROUTER);
    ok('it calls addLiquidity', String(liq.data).startsWith('0xe8e33700'));
    ok('with the coin and the drawn token as the pair',
      String(liq.data).includes(COIN.slice(2).toLowerCase()) && String(liq.data).includes(TOKEN.slice(2).toLowerCase()));

    // 80% of a million at 18 decimals, and a floor 1% under each side
    const words = String(liq.data).slice(10).match(/.{64}/g);
    const coinAmount = BigInt('0x' + words[2]);
    const tokenAmount = BigInt('0x' + words[3]);
    ok('the coin side is the configured share of supply',
      coinAmount === 800000n * 10n ** 18n, coinAmount.toString());
    ok('the token side is what was typed', tokenAmount === 50000000000000000n, tokenAmount.toString());
    ok('the minimums sit 1% under', BigInt('0x' + words[4]) === (coinAmount * 9900n) / 10000n
      && BigInt('0x' + words[5]) === (tokenAmount * 9900n) / 10000n);
    ok('the recipient is the connected account', words[6].endsWith(ME.slice(2)));
    ok('the deadline is in the future', BigInt('0x' + words[7]) > BigInt(Math.floor(Date.now() / 1000)));
  }

  ok('no console errors along the way', errors.length === 0, errors.slice(0, 2).join(' / '));

  await browser.close();
  server.kill();

  console.log('\n' + passed + ' passed, ' + fails.length + ' failed');
  if (fails.length) { fails.forEach((f) => console.log('  - ' + f)); process.exit(1); }
})();
