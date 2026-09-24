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

/* Cells are names and carry no address; one quote token does the pairing. The
   sixteen names are distinct so the encoded draw can be pinned to one of them. */
const testConfig = `window.TWISTR_CONFIG = (() => {
  const positions = [
    { id: 'leftHand',  label: 'Left hand',  short: 'L HAND', limb: 'hand' },
    { id: 'rightHand', label: 'Right hand', short: 'R HAND', limb: 'hand' },
    { id: 'leftFoot',  label: 'Left foot',  short: 'L FOOT', limb: 'foot' },
    { id: 'rightFoot', label: 'Right foot', short: 'R FOOT', limb: 'foot' },
  ];
  const colours = [
    { id: 'red', label: 'Red', hex: '#E4322B' }, { id: 'yellow', label: 'Yellow', hex: '#FDD208' },
    { id: 'green', label: 'Green', hex: '#2FA84F' }, { id: 'blue', label: 'Blue', hex: '#1B75BC' },
  ];
  const glyphs = ['grid','bars','orbit','chevron','delta','tiles','wave','play','arc','loop','stack','arrowbox','bolt','spark','rail','waves'];
  const pairings = {};
  let n = 0;
  positions.forEach((p) => colours.forEach((c) => {
    n += 1;
    // zero-padded so no name is a prefix of another: the check below looks for
    // one name's bytes and must not find them inside a longer one
    const tag = String(n).padStart(2, '0');
    pairings[p.id + '.' + c.id] = { name: 'Testcorp-' + tag, ticker: 'TC' + tag, glyph: glyphs[n - 1], logo: '' };
  }));
  return {
    chain: { id: 8453, hex: '0x2105', name: 'Base', currency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
             rpc: ['https://example.invalid'], explorer: 'https://example.invalid' },
    router: { address: '${ROUTER}', kind: 'uniswap-v2', weth: '${WETH}' },
    quote: { name: 'Wrapped Ether', ticker: 'TEST', address: '${TOKEN}', decimals: 18 },
    positions, colours, pairings,
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
        if (d.startsWith('0xdd62ed3e')) return '0x' + (0).toString(16).padStart(64,'0');      // allowance()
        if (d.startsWith('0xad5c4648')) return '0x' + '${WETH}'.slice(2).padStart(64,'0'); // WETH()
        if (d.startsWith('0xc45a0155')) return '0x' + '${WETH}'.slice(2).padStart(64,'0'); // factory()
        return '0x';
      }
      case 'eth_estimateGas': return '0x' + (1234567).toString(16);
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
  ok('the pad reports itself ready', (await page.locator('.sp-verify-head').textContent()).startsWith('Ready to launch'));
  ok('both the pair token and the router verify',
    (await page.locator('.sp-verify-list .is-bad').count()) === 0);

  console.log('\nlaunching');
  await page.fill('#fName', 'Northwind Capital');
  await page.fill('#fTicker', 'NWND');
  await page.fill('#fSupply', '1000000');
  await page.click('#toSpin');
  await page.waitForTimeout(200);

  ok('nothing was sent before the spin',
    (await page.evaluate(() => window.__sent.filter((s) => s.method === 'eth_sendTransaction').length)) === 0);

  await page.click('#spin');
  await page.waitForFunction(() => document.getElementById('pad').dataset.step === '3', null, { timeout: 14000 });
  await page.waitForTimeout(300);

  // what the result screen says it landed on, which is what must reach the chain
  const drew = (await page.locator('#resColor').textContent()).trim();
  const combo = (await page.locator('#resLimb').textContent()).trim();
  ok('the result names a pairing', drew.length > 0 && /·/.test(combo), drew + ' / ' + combo);
  ok('launch is still shut on the result', await page.locator('#launchBtn').isDisabled());
  ok('and still nothing has been sent',
    (await page.evaluate(() => window.__sent.filter((s) => s.method === 'eth_sendTransaction').length)) === 0);

  await page.click('#toLaunch');
  await page.waitForTimeout(300);
  ok('the confirmation shows the same pairing',
    (await page.locator('#sumRows').textContent()).includes(drew));

  await page.click('#launchBtn');
  await page.waitForTimeout(1500);

  /* The node is asked what it costs before the wallet is opened. A deployment
     that would revert then arrives as an error this page can explain, rather
     than as "could not simulate this request" in the wallet with a Confirm
     (unsafe) button under it. */
  const est = await page.evaluate(() => window.__sent.filter((s) => s.method === 'eth_estimateGas'));
  ok('the deployment is estimated before the wallet is opened', est.length === 1,
    est.length + ' estimates');
  const sentGas = await page.evaluate(() =>
    (window.__sent.find((s) => s.method === 'eth_sendTransaction').params[0] || {}).gas);
  ok('and the send carries a gas limit above that estimate',
    !!sentGas && BigInt(sentGas) > 1234567n, String(sentGas));
  ok('and it is the same bytes that get sent',
    est.length === 1 && est[0].params[0].data
      === (await page.evaluate(() => window.__sent.find((s) => s.method === 'eth_sendTransaction').params[0].data)));

  const txs = await page.evaluate(() => window.__sent.filter((s) => s.method === 'eth_sendTransaction'));
  ok('exactly one transaction for a deployment', txs.length === 1, txs.length + ' sent');

  if (txs.length) {
    const tx = txs[0].params[0];
    const bytecode = await page.evaluate(() => window.TWISTR_COIN.bytecode);
    ok('it is a create, with no "to"', tx.to === undefined || tx.to === null);
    ok('it is sent from the connected account', String(tx.from).toLowerCase() === ME);
    ok('it starts with the compiled bytecode', String(tx.data).startsWith(bytecode));
    const args = String(tx.data).slice(bytecode.length);
    ok('the constructor args are whole words', args.length % 64 === 0, args.length + ' hex chars');
    /* The rule, in bytes: the asset the result screen showed is the asset in
       the constructor, and no other cell's name is anywhere near it. */
    ok('the pairing shown is the pairing encoded',
      args.includes(Buffer.from(drew, 'utf8').toString('hex')),
      '"' + drew + '" not found in the encoded args');
    const others = await page.evaluate((shown) => Object.keys(window.TWISTR_CONFIG.pairings)
      .map((k) => window.TWISTR_CONFIG.pairings[k].name).filter((n) => n !== shown), drew);
    ok('and no other cell\u2019s name got in',
      !others.some((n) => args.includes(Buffer.from(n, 'utf8').toString('hex'))));
    ok('the colour and position it landed on are in there too',
      combo.split(' \u00b7 ').every((part) => args.includes(
        Buffer.from(part[0] + part.slice(1).toLowerCase(), 'utf8').toString('hex'))),
      combo);
    ok('the coin name is in the args',
      args.includes(Buffer.from('Northwind Capital', 'utf8').toString('hex')));
  }

  ok('the record is shown', await page.locator('#ticket').isVisible());
  ok('the launch is in the proof list', (await page.locator('.sp-launch').count()) === 1);
  ok('the row carries the pairing it landed on',
    (await page.locator('.sp-launch-pair').first().textContent()).includes(drew));
  ok('and the transaction that made it',
    (await page.locator('.sp-launch-tx a').first().getAttribute('href')).length > 0);
  ok('the record links to the contract',
    (await page.locator('#tkRows a').first().getAttribute('href')).includes(COIN));
  ok('the pad is on its last step', await page.getAttribute('#pad', 'data-step') === '5');
  ok('the launch control closed behind it', await page.locator('#launchBtn').isDisabled());

  // the terminal step, probed the way someone would
  await page.evaluate(() => { const b = document.getElementById('launchBtn'); b.disabled = false; b.click(); });
  await page.waitForTimeout(600);
  ok('a forced second launch mints nothing from one spin',
    (await page.locator('.sp-launch').count()) === 1
    && (await page.evaluate(() => window.__sent.filter((s) => s.method === 'eth_sendTransaction').length)) === 1);

  console.log('\nthe pool');
  await page.fill('#poolAmount', '0.05');
  await page.click('#poolBtn');
  await page.waitForTimeout(1500);

  const after = await page.evaluate(() => window.__sent.filter((s) => s.method === 'eth_sendTransaction'));
  ok('three more transactions: two approvals and the liquidity', after.length === 4,
    after.length + ' in total');

  if (after.length === 4) {
    const coinAppr = after[1].params[0];
    const quoteAppr = after[2].params[0];
    const liq = after[3].params[0];

    /* The whole point of this block: addLiquidity pulls BOTH sides with
       transferFrom, so both tokens need an allowance. An earlier version
       approved only the coin and this test asserted three transactions, which
       locked the bug in — the pool could never have opened. */
    ok('the coin is approved', String(coinAppr.to).toLowerCase() === COIN
      && String(coinAppr.data).startsWith('0x095ea7b3'));
    ok('and so is the quote token', String(quoteAppr.to).toLowerCase() === TOKEN
      && String(quoteAppr.data).startsWith('0x095ea7b3'));
    ok('both approvals name the router',
      String(coinAppr.data).includes(ROUTER.slice(2).toLowerCase())
      && String(quoteAppr.data).includes(ROUTER.slice(2).toLowerCase()));

    // neither approval is unlimited: exactly what the pool is about to use
    const approved = (tx) => BigInt('0x' + String(tx.data).slice(10).match(/.{64}/g)[1]);
    ok('the coin approval is for the exact amount', approved(coinAppr) === 800000n * 10n ** 18n,
      approved(coinAppr).toString());
    ok('the quote approval is for the exact amount', approved(quoteAppr) === 50000000000000000n,
      approved(quoteAppr).toString());

    ok('the liquidity goes to the router', String(liq.to).toLowerCase() === ROUTER);
    ok('it calls addLiquidity', String(liq.data).startsWith('0xe8e33700'));
    ok('with the coin and the quote token as the pair',
      String(liq.data).includes(COIN.slice(2).toLowerCase()) && String(liq.data).includes(TOKEN.slice(2).toLowerCase()));

    const words = String(liq.data).slice(10).match(/.{64}/g);
    const coinAmount = BigInt('0x' + words[2]);
    const tokenAmount = BigInt('0x' + words[3]);
    ok('the coin side is the configured share of supply', coinAmount === 800000n * 10n ** 18n, coinAmount.toString());
    ok('the token side is what was typed', tokenAmount === 50000000000000000n, tokenAmount.toString());
    ok('the minimums sit 1% under', BigInt('0x' + words[4]) === (coinAmount * 9900n) / 10000n
      && BigInt('0x' + words[5]) === (tokenAmount * 9900n) / 10000n);
    ok('the recipient is the connected account', words[6].endsWith(ME.slice(2)));
    ok('the deadline is in the future', BigInt('0x' + words[7]) > BigInt(Math.floor(Date.now() / 1000)));
  }

  // an amount too small to survive the token's decimals must be refused, not sent as zero
  const beforeDust = await page.evaluate(() => window.__sent.filter((s) => s.method === 'eth_sendTransaction').length);
  await page.fill('#poolAmount', '0.0000000000000000001');
  await page.evaluate(() => { document.getElementById('poolBtn').disabled = false; });
  await page.click('#poolBtn');
  await page.waitForTimeout(400);
  ok('an amount that rounds to nothing is refused',
    (await page.evaluate(() => window.__sent.filter((s) => s.method === 'eth_sendTransaction').length)) === beforeDust
    && /rounds to nothing/.test(await page.locator('#poolNote').textContent()));

  ok('no console errors along the way', errors.length === 0, errors.slice(0, 2).join(' / '));

  await browser.close();
  server.kill();

  console.log('\n' + passed + ' passed, ' + fails.length + ' failed');
  if (fails.length) { fails.forEach((f) => console.log('  - ' + f)); process.exit(1); }
})();
