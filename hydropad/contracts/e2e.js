/* End-to-end through a wallet: a real browser, a real EVM node answering as
 * Robinhood Testnet (46630), and an injected EIP-1193 wallet that signs with a
 * local key. Walks the path a visitor actually takes on a network nothing has
 * been deployed to yet: connect → the launch opens the launcher → pair → buy →
 * sell → claim. Also checks that the network chips really ask the wallet to
 * switch, rather than telling the visitor to do it themselves. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const CHAIN = Number(process.env.CHAIN_ID || 46630);

const WALLET_SHIM = chainHex => `
window.__rpc = async (method, params = []) => {
  const r = await fetch('http://127.0.0.1:8545', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
  });
  const j = await r.json();
  if (j.error) { const e = new Error(j.error.message); e.code = j.error.code; e.data = j.error.data; throw e; }
  return j.result;
};
window.__switches = [];
window.__added = [];
window.ethereum = {
  isMetaMask: true,
  _acct: null,
  /* Kept in sessionStorage so it survives the navigations the run makes: the
   * shim is re-injected on every page load. */
  get _chain() { try { return sessionStorage.getItem('__chain') || '${chainHex}'; } catch (e) { return '${chainHex}'; } },
  set _chain(v) { try { sessionStorage.setItem('__chain', v); } catch (e) {} },
  on() {}, removeListener() {},
  async request({ method, params = [] }) {
    if (method === 'eth_requestAccounts' || method === 'eth_accounts') {
      if (method === 'eth_accounts' && !this._acct) return [];
      const accts = await window.__rpc('eth_accounts');
      this._acct = accts[0];
      return [this._acct];
    }
    if (method === 'eth_chainId') return this._chain;
    /* A wallet that has never seen the chain answers 4902, which is what sends
     * the page down the add-then-switch path. This one has only ever seen the
     * chain the node is on. */
    if (method === 'wallet_switchEthereumChain') {
      const want = params[0].chainId;
      window.__switches.push(want);
      if (want !== this._chain && !window.__added.includes(want)) {
        const e = new Error('Unrecognized chain ID'); e.code = 4902; throw e;
      }
      return null;
    }
    if (method === 'wallet_addEthereumChain') {
      window.__added.push(params[0].chainId);
      window.__addedParams = params[0];
      return null;
    }
    if (method === 'eth_sendTransaction') {
      return window.__rpc('eth_sendTransaction', params);
    }
    return window.__rpc(method, params);
  },
};
`;

const log = [];
(async () => {
  // CHROMIUM_PATH points at a browser Playwright did not download itself.
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const p = await b.newPage({ viewport: { width: 1360, height: 950 } });
  p.on('pageerror', e => log.push('PAGEERROR ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/CERT|favicon|fonts/.test(m.text())) log.push('CONSOLE ' + m.text()); });
  await p.addInitScript(WALLET_SHIM('0x' + CHAIN.toString(16)));
  // Serve ethers and skip the font CSS from disk, so the run does not depend on
  // reaching a CDN. The page loads the same build in a browser.
  const umd = path.join(__dirname, '..', 'node_modules', 'ethers', 'dist', 'ethers.umd.min.js');
  await p.route('https://cdnjs.cloudflare.com/**', route =>
    fs.existsSync(umd)
      ? route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(umd, 'utf8') })
      : route.continue());
  await p.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));

  const base = 'http://127.0.0.1:8080/';
  const step = async (name, fn) => { process.stdout.write(name + ' … '); await fn(); console.log('ok'); };

  await step('the pages read the wallet\'s network', async () => {
    await p.goto(base + 'index.html', { waitUntil: 'networkidle' });
    await p.waitForSelector('#stat-chain');
    const name = (await p.textContent('#stat-chain')).trim();
    if (name !== 'Robinhood Testnet') throw new Error('read ' + name + ', not Robinhood Testnet');
  });

  await step('connect wallet', async () => {
    await p.click('#connect');
    await p.waitForFunction(() => document.querySelector('#connect')?.textContent.startsWith('0x'), null, { timeout: 15000 });
  });

  await step('nothing deployed yet, so the launch says it opens one', async () => {
    await p.goto(base + 'launch.html', { waitUntil: 'networkidle' });
    await p.waitForSelector('#f-blocked');
    const said = await p.textContent('#f-blocked');
    if (!/first to launch on Robinhood Testnet/.test(said)) throw new Error('unexpected notice: ' + said.trim());
    const label = (await p.textContent('#f-submit')).trim();
    if (label !== 'Open Hydropad on Robinhood Testnet') throw new Error('button reads ' + label);
  });

  await step('the docs really ask the wallet to switch', async () => {
    /* The launch form no longer picks a network — coins launch on Robinhood
     * Chain and nowhere else — so the switch lives in the docs, beside the
     * facts a wallet needs. */
    await p.goto(base + 'docs.html', { waitUntil: 'networkidle' });
    await p.click('#networks [data-switch="4663"]');
    await p.waitForFunction(() => window.__switches.includes('0x1237'), null, { timeout: 15000 });
    const added = await p.evaluate(() => window.__addedParams);
    if (!added || added.chainId !== '0x1237') throw new Error('no add for Robinhood Chain');
    if (added.rpcUrls[0] !== 'https://rpc.mainnet.chain.robinhood.com') throw new Error('wrong rpc: ' + added.rpcUrls[0]);
    if (added.nativeCurrency.symbol !== 'ETH') throw new Error('wrong gas token');
    console.log('   wallet was asked to add', added.chainName, added.chainId, added.rpcUrls[0]);
  });

  await step('only natural reserves are on offer', async () => {
    await p.goto(base + 'launch.html', { waitUntil: 'networkidle' });
    const classes = await p.locator('#f-classes [data-class]').evaluateAll(
      els => els.map(e => e.dataset.class));
    if (classes.includes('Desalination')) throw new Error('a plant is not a natural reserve');
    /* Every source the form offers has to be a named place with coordinates. */
    for (const cls of classes) {
      await p.click(`[data-class="${cls}"]`);
      const opts = await p.locator('#f-source option').evaluateAll(els => els.map(e => e.value));
      const bad = await p.evaluate(ts => ts.filter(t => {
        const w = WATER.find(x => x.t === t);
        return !w || !Array.isArray(w.g) || w.c === 'Desalination';
      }), opts);
      if (bad.length) throw new Error(cls + ' offers ' + bad.join(', '));
    }
    console.log('   pairable classes:', classes.join(', '));
  });

  await step('launching anywhere but Robinhood is refused', async () => {
    await p.evaluate(() => sessionStorage.setItem('__chain', '0x2105'));  // Base
    await p.goto(base + 'launch.html', { waitUntil: 'networkidle' });
    await p.waitForSelector('#f-blocked');
    const said = await p.textContent('#f-blocked');
    if (!/launched on Robinhood Chain, not on Base/.test(said)) throw new Error('unexpected: ' + said.trim());
    if (!(await p.locator('#f-submit').isDisabled())) throw new Error('the button is still live on Base');
    await p.evaluate(c => sessionStorage.setItem('__chain', c), '0x' + CHAIN.toString(16));
  });

  await step('the launch deploys the launcher, then pairs against it', async () => {
    await p.goto(base + 'launch.html', { waitUntil: 'networkidle' });
    await p.fill('#f-name', 'Dead Pool');
    await p.fill('#f-symbol', 'pool');
    await p.selectOption('#f-source', 'MEAD');
    await p.fill('#f-firstbuy', '0.5');
    await p.click('button[type=submit]');
    await p.waitForURL(/token\.html\?addr=0x/, { timeout: 60000 });
    await p.waitForSelector('#buy-btn', { timeout: 30000 });
  });
  const launcher = await p.evaluate(c => localStorage.getItem('hydropad.launcher.' + c), CHAIN);
  if (!launcher) throw new Error('no launcher remembered for chain ' + CHAIN);
  console.log('   launcher:', launcher);
  const tokenAddr = new URL(p.url()).searchParams.get('addr');
  console.log('   token:', tokenAddr);
  await step('the chrome catches up with the launcher it just deployed', async () => {
    await p.waitForFunction(() => !/not here/.test(document.querySelector('#chain-btn')?.textContent || ''),
      null, { timeout: 15000 });
    const pill = (await p.textContent('#chain-btn')).replace(/\s+/g, ' ').trim();
    if (!/Robinhood Testnet/.test(pill)) throw new Error('pill reads ' + pill);
    console.log('   pill:', pill);
  });

  const capAfterLaunch = await p.textContent('.summary .line b');
  console.log('   market cap:', capAfterLaunch.trim());

  await step('buy on the curve', async () => {
    const before = await p.textContent('.panel-head h3');
    await p.fill('#buy-amount', '0.4');
    await p.click('#buy-btn');
    await p.waitForFunction(prev => document.querySelector('.panel-head h3')?.textContent !== prev, before, { timeout: 60000 });
  });
  console.log('   price now:', (await p.textContent('.panel-head h3')).trim().split(' ')[0]);
  console.log('   balance:', (await p.locator('.panel .panel-foot .mono').last().textContent()).trim());

  await step('chart drew from chain logs', async () => {
    const svg = await p.locator('svg.chart').count();
    if (!svg) throw new Error('no chart rendered');
  });

  await step('sell back into the curve', async () => {
    const raised = await p.locator('.summary .line').nth(1).textContent();
    await p.fill('#sell-amount', '100000000');
    await p.click('#sell-btn');
    await p.waitForFunction(prev => document.querySelectorAll('.summary .line')[1]?.textContent !== prev, raised, { timeout: 90000 });
  });
  console.log('   raised after sell:', (await p.locator('.summary .line').nth(1).textContent()).replace('raised',''));

  await step('creator claims the vault', async () => {
    await p.waitForSelector('#claim-btn');
    console.log('\n   vault before claim:', (await p.textContent('#claim-btn')).trim());
    await p.click('#claim-btn');
    await p.waitForFunction(() => {
      const t = document.querySelector('#claim-btn')?.textContent || '';
      return /Claim vault/.test(t) && /\(0 /.test(t);
    }, null, { timeout: 90000 });
    console.log('   vault after claim:', (await p.textContent('#claim-btn')).trim());
  });

  await p.screenshot({ path: 'e2e-token.png' });

  await step('launches table lists it', async () => {
    await p.goto(base + 'launches.html', { waitUntil: 'networkidle' });
    await p.waitForSelector('#launch-rows tr td .asset', { timeout: 30000 });
    const rows = await p.locator('#launch-rows tr').count();
    if (rows !== 1) throw new Error('expected 1 row, got ' + rows);
  });
  await p.screenshot({ path: 'e2e-launches.png' });

  await step('markets page shows the pairing', async () => {
    await p.goto(base + 'index.html', { waitUntil: 'networkidle' });
    await p.waitForSelector('#recent tr .asset', { timeout: 30000 });
  });
  await p.screenshot({ path: 'e2e-markets.png' });

  console.log('\nerrors:', log.length ? log : 'none');
  await b.close();
})().catch(async e => { console.error('\nFAILED:', e.message); console.log('errors:', log); process.exit(1); });
