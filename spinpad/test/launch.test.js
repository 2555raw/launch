/* The launch path, driven by a fake wallet.
 *
 * The page is served by the real server.js and given a test config whose token
 * addresses resolve, so the pad gets past its own verification gate. Then the
 * exact bytes it hands the wallet are checked: that a deployment is a create
 * with the compiled bytecode and the encoded draw, and that a pool is an
 * approval followed by addLiquidity with the right router, amounts and slippage.
 *
 * It runs the pool twice: once against a quote token that is not the router's
 * WETH (two approvals, addLiquidity) and once against one that is, which is the
 * shipped config (one approval, addLiquidityETH, ether as value).
 *
 * Nothing is broadcast. Needs Playwright:
 *   CHROME_PATH=/path/to/chrome node test/launch.test.js
 */
const fs = require('fs');
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
const FACTORY = '0x5555555555555555555555555555555555555555';
const PAIR = '0x6666666666666666666666666666666666666666';
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
    router: { address: '${ROUTER}', kind: 'uniswap-v2', weth: '${WETH}', factory: '${FACTORY}' },
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
        if (d.startsWith('0xc45a0155')) return '0x' + '${FACTORY}'.slice(2).padStart(64,'0'); // factory()
        if (d.startsWith('0xe6a43905')) return '0x' + '${PAIR}'.slice(2).padStart(64,'0'); // getPair()
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

  /* Every line the status area shows during the launch, in order. Reading it
     once at the end is no good: by then a later step has overwritten it. */
  await page.evaluate(() => {
    window.__said = [];
    const el = document.getElementById('status');
    window.__said.push(el.textContent);
    new MutationObserver(() => window.__said.push(el.textContent))
      .observe(el, { childList: true, characterData: true, subtree: true });
  });

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

  /* The wallet's red "cannot simulate" box is the most alarming thing a person
     sees in this whole flow, and it is usually wrong about a bare contract
     creation — there is no transfer for a balance-change preview to describe.
     The node's gas estimate is the thing that actually answers it, and it used
     to go to console.warn where nobody would ever see it. */
  const said = await page.evaluate(() => window.__said || []);
  const priced = said.findIndex((t) => /priced the deployment/.test(t));
  const sent = said.findIndex((t) => /^Sent\./.test(t));
  ok('the node’s price is said at all', priced >= 0, said.join(' | ').slice(0, 300));
  ok('and it is said BEFORE the transaction goes out, which is when the wallet is open',
    priced >= 0 && sent >= 0 && priced < sent, `priced at ${priced}, sent at ${sent}`);
  ok('it tells the person the deployment executes, so a wallet warning is the wallet',
    said.some((t) => /so it executes/.test(t) && /that is the wallet/.test(t)),
    said.find((t) => /priced/.test(t)) || '');

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

  /* ── the same pool, paid in ether ────────────────────────────────────────
     Everything above runs against a quote token that is NOT the router's WETH,
     which is the two-approval path. The SHIPPED config is the other case —
     quote and router WETH are the same address — so without this the branch the
     product actually takes would have no test at all. Same walk, one changed
     line of config, and the assertion is that the bytes are addLiquidityETH
     with the ether carried as value rather than pulled with transferFrom. */
  console.log('\nthe pool, paid in ether');

  const etherConfig = testConfig.replace(
    "address: '" + TOKEN + "', decimals: 18",
    "address: '" + WETH + "', decimals: 18");
  ok('the ether config really does quote in the router’s WETH',
    etherConfig !== testConfig && etherConfig.includes(WETH + "', decimals: 18"));

  const page2 = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const errors2 = [];
  page2.on('pageerror', (e) => errors2.push(e.message));
  page2.on('console', (m) => { if (m.type() === 'error' && !/ERR_CERT|net::/.test(m.text())) errors2.push(m.text()); });
  await page2.route('**/config.js', (route) =>
    route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: etherConfig }));
  await page2.addInitScript(wallet);

  await page2.goto('http://127.0.0.1:' + PORT + '/');
  await page2.waitForTimeout(700);
  await page2.check('#gateAgree');
  await page2.click('#gateGo');
  await page2.waitForTimeout(250);
  await page2.click('#connect');
  await page2.waitForTimeout(1200);
  ok('it still verifies with WETH as the quote',
    (await page2.locator('.sp-verify-list .is-bad').count()) === 0);

  await page2.fill('#fName', 'Northwind Capital');
  await page2.fill('#fTicker', 'NWND');
  await page2.fill('#fSupply', '1000000');
  /* The whole point of this block: liquidity typed on the FORM, before the
     spin, and never touching the pool panel afterwards. A launched coin with
     no pool is a token nobody can buy. */
  await page2.fill('#fLiq', '0.05');
  await page2.click('#toSpin');
  await page2.click('#spin');
  await page2.waitForFunction(() => document.getElementById('pad').dataset.step === '3', null, { timeout: 14000 });
  await page2.waitForTimeout(300);
  await page2.click('#toLaunch');
  await page2.waitForTimeout(200);
  await page2.evaluate(() => { window.__sumBefore = document.getElementById('sumRows').textContent; });
  await page2.click('#launchBtn');
  await page2.waitForFunction(() => document.getElementById('pad').dataset.step === '5', null, { timeout: 14000 });
  await page2.waitForTimeout(400);

  /* The label has to change with the path. Someone told to supply "WETH" goes
     off to wrap ether they do not have; the whole point of this branch is that
     they do not need to. */
  ok('the pool field asks for ether, not WETH',
    (await page2.locator('#poolAssetB').textContent()).trim() === 'ETH');
  /* By now the pool is already open, so the panel reports that rather than
     offering to do it — which is the visible proof that liquidity was part of
     the launch and not a step left to the person. */
  ok('and by the time the record is up, the pool is already reported open',
    /Pool open/.test(await page2.locator('#poolNote').textContent()),
    await page2.locator('#poolNote').textContent());
  ok('the pool button is shut, because there is nothing left to do',
    await page2.locator('#poolBtn').isDisabled());

  /* No click. The liquidity was part of launching, so by the time the record
     is on screen the pool has already been opened. */
  await page2.waitForTimeout(1800);

  const sent2 = await page2.evaluate(() => window.__sent.filter((s) => s.method === 'eth_sendTransaction'));
  ok('the pool opened from the launch itself, with nothing else pressed',
    sent2.length === 3, sent2.length + ' transactions in total');
  ok('and the summary warned it would, before the wallet ever opened',
    (await page2.evaluate(() => window.__sumBefore || '')).includes('0.05'),
    await page2.evaluate(() => window.__sumBefore || ''));

  if (sent2.length === 3) {
    const appr = sent2[1].params[0];
    const liq = sent2[2].params[0];

    ok('the one approval is the coin, not the quote token',
      String(appr.to).toLowerCase() === COIN && String(appr.data).startsWith('0x095ea7b3')
      && String(appr.data).includes(ROUTER.slice(2).toLowerCase()));

    ok('the liquidity goes to the router', String(liq.to).toLowerCase() === ROUTER);
    ok('it calls addLiquidityETH', String(liq.data).startsWith('0xf305d719'),
      String(liq.data).slice(0, 10));

    /* The ether rides as value. If this were missing the router would wrap
       nothing, and addLiquidityETH would revert — or worse, open a pool with
       one side empty. */
    ok('the ether is carried as value', BigInt(liq.value || '0x0') === 50000000000000000n,
      String(liq.value));

    const w = String(liq.data).slice(10).match(/.{64}/g);
    ok('the token argument is the coin', w[0].endsWith(COIN.slice(2)));
    ok('the coin side is the configured share of supply',
      BigInt('0x' + w[1]) === 800000n * 10n ** 18n, BigInt('0x' + w[1]).toString());
    ok('both minimums sit 1% under',
      BigInt('0x' + w[2]) === (800000n * 10n ** 18n * 9900n) / 10000n
      && BigInt('0x' + w[3]) === (50000000000000000n * 9900n) / 10000n);
    ok('the recipient is the connected account', w[4].endsWith(ME.slice(2)));
    ok('the deadline is in the future', BigInt('0x' + w[5]) > BigInt(Math.floor(Date.now() / 1000)));

    /* Six arguments and no more: a stray word here is a different function. */
    ok('there are exactly six arguments', w.length === 6, String(w.length));
  }

  /* The board has to say the coin got a pool. That is the one thing the list
     can tell you that the explorer link cannot without a click. */
  ok('the board now shows a live pool for it',
    (await page2.locator('.sp-launch-pool a').count()) === 1);
  ok('and it links to the pair the factory named',
    ((await page2.locator('.sp-launch-pool a').first().getAttribute('href')) || '').includes(PAIR.slice(2)));

  ok('no console errors on the ether path', errors2.length === 0, errors2.slice(0, 2).join(' / '));

  /* ── the board reads launches nobody here made ───────────────────────────
     The board used to be whatever localStorage remembered, which is not the
     same thing as what has been launched. Every coin emits Paired in its
     constructor, so this walks the fake node's logs and asserts a coin THIS
     BROWSER NEVER LAUNCHED lands on the board with the right draw.

     The log data below is not hand-rolled: it is the exact output of viem's
     encodeAbiParameters for ('string,string,string,string,address'), pasted in.
     That makes this a check of the decoder against a reference encoder, which
     is the only way to be sure four dynamic strings are being read at the right
     offsets — the layout is easy to get plausibly wrong. */
  console.log('\nreading the chain');

  const OTHER = '0x7777777777777777777777777777777777777777';
  const PAIRED_TOPIC = '0x97e37329ad6278899cda0351f48aa595e149ae986230bfbd2856809790d94390';
  const LOG_DATA = '0x'
    + '00000000000000000000000000000000000000000000000000000000000000a0'
    + '00000000000000000000000000000000000000000000000000000000000000e0'
    + '0000000000000000000000000000000000000000000000000000000000000120'
    + '0000000000000000000000000000000000000000000000000000000000000160'
    + '00000000000000000000000000000000000000000000000000000000000000c0'
    + '000000000000000000000000000000000000000000000000000000000000000b'
    + '54657374636f72702d3037000000000000000000000000000000000000000000'
    + '0000000000000000000000000000000000000000000000000000000000000004'
    + '5443303700000000000000000000000000000000000000000000000000000000'
    + '0000000000000000000000000000000000000000000000000000000000000003'
    + '5265640000000000000000000000000000000000000000000000000000000000'
    + '0000000000000000000000000000000000000000000000000000000000000009'
    + '4c6566742068616e640000000000000000000000000000000000000000000000';

  const nodeWallet = wallet.replace(
    "      case 'eth_estimateGas':",
    [
      "      case 'eth_blockNumber': return '0x2710';",   // 10000
      "      case 'eth_getBlockByNumber': return { timestamp: '0x66000000' };",
      "      case 'eth_getLogs': {",
      "        const from = parseInt(params[0].fromBlock, 16);",
      "        const to = parseInt(params[0].toBlock, 16);",
      "        if (params[0].topics[0] !== '" + PAIRED_TOPIC + "') return [];",
      "        if (9900 < from || 9900 > to) return [];",
      "        return [{ address: '" + OTHER + "', blockNumber: '0x26ac',",
      "                  transactionHash: '0x' + 'cd'.repeat(32), data: '" + LOG_DATA + "' }];",
      "      }",
      "      case 'eth_estimateGas':",
    ].join('\n'));

  /* Answer the coin's own getters for that address, so the row is built from
     what the contract says rather than from the log alone. */
  const nodeWallet2 = nodeWallet.replace(
    "        if (d.startsWith('0x95d89b41')) return abiString('TEST');",
    [
      "        if (String(params[0].to).toLowerCase() === '" + OTHER + "') {",
      "          if (d.startsWith('0x06fdde03')) return abiString('Somebody Else Coin');",
      "          if (d.startsWith('0x95d89b41')) return abiString('SELSE');",
      "          if (d.startsWith('0x18160ddd')) return '0x' + (7n * 10n ** 23n).toString(16).padStart(64,'0');",
      "          if (d.startsWith('0x39191d7b')) return abiString('Testcorp-07');",
      "          if (d.startsWith('0xbcc49b0c')) return abiString('TC07');",
      "          if (d.startsWith('0x3dbc0610')) return abiString('Red');",
      "          if (d.startsWith('0x09218e91')) return abiString('Left hand');",
      "        }",
      "        if (d.startsWith('0x95d89b41')) return abiString('TEST');",
    ].join('\n'));

  ok('the fake node was actually rewired', nodeWallet2 !== wallet
    && nodeWallet2.includes('eth_getLogs') && nodeWallet2.includes('SELSE'));

  const page3 = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  const errors3 = [];
  page3.on('pageerror', (e) => errors3.push(e.message));
  page3.on('console', (m) => { if (m.type() === 'error' && !/ERR_CERT|net::/.test(m.text())) errors3.push(m.text()); });
  await page3.route('**/config.js', (route) =>
    route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: testConfig }));
  await page3.addInitScript(nodeWallet2);

  await page3.goto('http://127.0.0.1:' + PORT + '/');
  await page3.waitForTimeout(700);
  await page3.check('#gateAgree');
  await page3.click('#gateGo');
  await page3.waitForTimeout(250);

  ok('the board starts empty in a browser that has launched nothing',
    (await page3.locator('.sp-launch').count()) === 0);

  await page3.click('#connect');
  await page3.waitForTimeout(900);
  await page3.click('#scanBtn');
  await page3.waitForTimeout(2500);

  ok('a coin this browser never launched is on the board',
    (await page3.locator('.sp-launch').count()) === 1,
    await page3.locator('#scanNote').textContent());

  /* Everything below reads that row. If the scan found nothing the checks above
     already said so, and asking for the text of a row that is not there just
     hangs until Playwright's timeout — one loud crash instead of a list of what
     actually failed. */
  if ((await page3.locator('.sp-launch').count()) !== 1) {
    ok('the row checks could run', false, 'no row on the board, so the rest were skipped');
  } else {
  const row = page3.locator('.sp-launch').first();
  ok('it shows the name the contract gave, not the one in the log',
    /Somebody Else Coin/.test(await row.textContent()));
  ok('and its ticker', /SELSE/.test(await row.textContent()));

  /* The four strings out of the log data, at four different offsets. If the
     decoder read them at the wrong tails this is where it shows. */
  ok('the pairing decoded out of the log is right',
    /Testcorp-07/.test(await row.textContent()), await row.textContent());
  /* And it says WHERE that name came from. This test config maps red-plus-left-
     hand to Testcorp-01, while the contract says Testcorp-07 — exactly the
     disagreement a coin from a different build of the pairing table would
     cause. An earlier version of the board silently showed Testcorp-01, the
     name this page's table would have given it, with nothing on screen to say
     the contract disagreed. It says so now. */
  ok('and it says the name is the contract’s, not this table’s',
    /as written in the contract/.test(await row.textContent()),
    (await row.textContent()).replace(/\s+/g, ' '));

  ok('the row carries the colour decoded out of the log',
    (await row.getAttribute('data-color')) === 'red');

  /* The colour filter is built from the decoded colour, so it is a second,
     independent read of the same field. */
  await page3.click('.sp-chip[data-filter="blue"]');
  await page3.waitForTimeout(200);
  ok('filtering to another colour drops it',
    (await page3.locator('.sp-launch').count()) === 0);
  await page3.click('.sp-chip[data-filter="red"]');
  await page3.waitForTimeout(200);
  ok('and filtering to red brings it back',
    (await page3.locator('.sp-launch').count()) === 1);
  await page3.click('.sp-chip[data-filter="all"]');
  await page3.waitForTimeout(200);

  /* The position, read straight off the contract by the lookup rather than out
     of the log, which also exercises readDraw. */
  await page3.fill('#lookup', OTHER);
  await page3.click('#lookupBtn');
  await page3.waitForTimeout(900);
  ok('looking the same coin up reads the draw off the contract',
    /Testcorp-07, from red on the left hand/i.test(await page3.locator('#lookupNote').textContent()),
    await page3.locator('#lookupNote').textContent());
  ok('and looking it up does not add a second row',
    (await page3.locator('.sp-launch').count()) === 1);
  }

  ok('the count says where the rows came from',
    /read from Base/.test(await page3.locator('#count').textContent()),
    await page3.locator('#count').textContent());
  ok('and the scan says how far back it looked',
    /Looked back .* and found 1 coin/.test(await page3.locator('#scanNote').textContent()),
    await page3.locator('#scanNote').textContent());

  /* Scanning twice must not double the board. The scan walks a window at a
     time and windows overlap on a re-press; keying by address is what stops
     the same coin arriving twice. */
  await page3.click('#scanBtn');
  await page3.waitForTimeout(2000);
  ok('scanning again does not duplicate it',
    (await page3.locator('.sp-launch').count()) === 1);

  /* The lookup is the way in when a wallet will not forward a log query, and
     the way to check one specific coin. */
  await page3.fill('#lookup', 'not-an-address');
  await page3.click('#lookupBtn');
  await page3.waitForTimeout(300);
  ok('the lookup refuses something that is not an address',
    /not a contract address/.test(await page3.locator('#lookupNote').textContent()));

  ok('no console errors while reading the chain', errors3.length === 0, errors3.slice(0, 2).join(' / '));

  /* ── the shipped config, not a stub ──────────────────────────────────────
     Every check above runs against a test config. These read the real file,
     because the ether path is only taken when the SHIPPED quote and the SHIPPED
     router WETH are the same address — and nothing else would notice if a later
     edit changed one and not the other. */
  console.log('\nthe shipped config');
  const shipped = fs.readFileSync(path.join(__dirname, '..', 'config.js'), 'utf8');
  const field = (obj, key) => {
    const block = shipped.slice(shipped.indexOf(obj + ': {'));
    const m = block.slice(0, block.indexOf('},')).match(new RegExp(key + ":\\s*'(0x[0-9a-fA-F]{40})'"));
    return m ? m[1].toLowerCase() : null;
  };
  const rAddr = field('router', 'address');
  const rWeth = field('router', 'weth');
  const rFactory = field('router', 'factory');
  const qAddr = field('quote', 'address');

  ok('a router is configured', !!rAddr, String(rAddr));
  ok('with the factory the pad checks it against', !!rFactory, String(rFactory));
  ok('the router WETH and the quote token are the same address, so pools take ether',
    !!rWeth && rWeth === qAddr, rWeth + ' vs ' + qAddr);
  ok('the router, its factory and the quote are three different contracts',
    new Set([rAddr, rFactory, qAddr]).size === 3);

  await page2.close();
  await page3.close();
  await browser.close();
  server.kill();

  console.log('\n' + passed + ' passed, ' + fails.length + ' failed');
  if (fails.length) { fails.forEach((f) => console.log('  - ' + f)); process.exit(1); }
})();
