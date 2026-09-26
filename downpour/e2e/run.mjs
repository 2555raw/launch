/* End-to-end run of the whole site in a real browser, against a local chain.
 *
 *   npm run dev:chain -- --no-web      # terminal 1: anvil + deploy + seed
 *   VITE_ALLOW_LOCAL=1 npm run build && npx vite preview --port 4173   # terminal 2
 *   npm run e2e                        # terminal 3
 *
 * A test wallet is injected into the page the way a browser extension would be
 * (EIP-6963), backed by one of anvil's unlocked dev accounts, so every live-mode
 * flow signs and lands real transactions. Then the same flows run again in the
 * playground. Screenshots go to $SHOTS (default e2e/shots). */
import { mkdirSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:4173';
const RPC = process.env.RPC || 'http://127.0.0.1:8545';
const OUT = process.env.SHOTS || 'e2e/shots';
const ACCOUNT = '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955'; // anvil dev account #7
mkdirSync(OUT, { recursive: true });

function testWallet({ rpc, account }) {
  let id = 1;
  const listeners = {};
  async function call(method, params) {
    const r = await fetch(rpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: id++, method, params }) });
    const j = await r.json();
    if (j.error) {
      const e = new Error(j.error.message);
      e.code = j.error.code;
      e.data = j.error.data;
      throw e;
    }
    return j.result;
  }
  const provider = {
    async request({ method, params }) {
      switch (method) {
        case 'eth_requestAccounts':
        case 'eth_accounts':
          return [account];
        case 'eth_chainId':
          return '0x7a69';
        case 'wallet_switchEthereumChain':
        case 'wallet_addEthereumChain':
          return null;
        case 'eth_sendTransaction':
          return call('eth_sendTransaction', [{ ...params[0], from: account }]);
        default:
          return call(method, params ?? []);
      }
    },
    on(ev, fn) {
      (listeners[ev] ||= []).push(fn);
    },
    removeListener(ev, fn) {
      listeners[ev] = (listeners[ev] || []).filter((f) => f !== fn);
    },
  };
  const icon =
    'data:image/svg+xml;base64,' +
    btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#ffe066"/><path d="M18 5 9 18h6l-2 9 10-14h-6z" fill="#1b1500"/></svg>');
  const info = { uuid: '6f7b1b64-5f38-4cb3-9a7c-0d0f00000007', name: 'Test Wallet', icon, rdns: 'dev.downpour.testwallet' };
  const announce = () => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: Object.freeze({ info, provider }) }));
  window.addEventListener('eip6963:requestProvider', announce);
  announce();
}

const results = [];
async function step(name, fn) {
  const t = Date.now();
  try {
    await fn();
    results.push([true, name, Date.now() - t]);
    console.log(`  ✓ ${name} (${Date.now() - t}ms)`);
  } catch (e) {
    results.push([false, name, Date.now() - t, e.message]);
    console.log(`  ✗ ${name}: ${e.message.split('\n')[0]}`);
  }
}

async function waitToast(page, title, timeout = 30_000) {
  const done = page.locator('.toast.done', { hasText: title });
  const failed = page.locator('.toast.error', { hasText: title });
  const r = await Promise.race([
    done.first().waitFor({ timeout }).then(() => 'done'),
    failed.first().waitFor({ timeout }).then(() => 'error'),
  ]);
  if (r === 'error') throw new Error(`toast error: ${await failed.first().innerText()}`);
}

const shot = (page, name, full = false) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });

const launchOpts = existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {};
const browser = await chromium.launch(launchOpts);
const errors = [];

async function newPage(viewport = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport });
  await ctx.addInitScript(testWallet, { rpc: RPC, account: ACCOUNT });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|ERR_|net::/.test(m.text())) errors.push(`[console] ${m.text()}`);
  });
  return page;
}

const page = await newPage();
let lisbon = '';
// Unique per run, so the test can run again on the same chain.
const tag = String(Date.now()).slice(-4);
const TICKER = `LISB${tag}`;
const NAME = `Lisbon Drizzle ${tag}`;

console.log(`live mode against ${RPC}`);
await step('home renders coins from the chain', async () => {
  await page.goto(BASE + '/');
  await page.locator('.coin-card').first().waitFor({ timeout: 20_000 });
  await page.waitForTimeout(1200);
  await shot(page, '01-hero');
  await page.mouse.click(260, 560);
  await page.waitForTimeout(70);
  await shot(page, '01b-lightning');
  await page.waitForTimeout(600);
  await shot(page, '02-home-full', true);
});

await step('connect the injected wallet', async () => {
  await page.locator('button.nav-connect').click();
  await page.locator('.wallet-row', { hasText: 'Test Wallet' }).click();
  await page.locator('.acct-btn').waitFor();
});

await step('faucet: test EUR and USD from the desk', async () => {
  await page.goto(BASE + '/desk?code=EUR');
  await page.getByRole('button', { name: 'Get test EUR' }).click();
  await waitToast(page, 'Faucet: test EUR');
  await page.goto(BASE + '/desk?code=USD');
  await page.getByRole('button', { name: 'Get test USD' }).click();
  await waitToast(page, 'Faucet: test USD');
  await page.goto(BASE + '/desk');
  await page.locator('.desk-card').first().waitFor();
  await shot(page, '03-desk');
});

await step('launch a coin paired with EUR, with a first buy', async () => {
  await page.goto(BASE + '/launch');
  await page.locator('#name').fill(NAME);
  await page.locator('#ticker').fill(TICKER.toLowerCase());
  await page.locator('.cur-picker-btn', { hasText: 'EUR' }).waitFor();
  await page.locator('#desc').fill('Soft rain on the tram lines, priced in euros.');
  await page.locator('#first').fill('25');
  await shot(page, '04-launch');
  await page.getByRole('button', { name: 'Launch the coin' }).click();
  await waitToast(page, `Launch ${TICKER} / EUR`);
  await page.waitForURL(/\/coin\/0x/);
  lisbon = page.url().split('/coin/')[1];
  await page.locator('.coin-head h1', { hasText: NAME }).waitFor();
  await page.locator('.pair-cur', { hasText: 'EUR' }).first().waitFor();
});

await step('buy and sell on the coin page', async () => {
  await page.locator('.trade-panel .big-input input').fill('10');
  await page.getByRole('button', { name: `Buy ${TICKER}` }).click();
  await waitToast(page, `Buy ${TICKER} with EUR`);
  await page.locator('.trade-panel .tabs button', { hasText: 'Sell' }).click();
  await page.locator('.trade-panel .quick .chip', { hasText: '50%' }).click();
  await page.getByRole('button', { name: `Sell ${TICKER}` }).click();
  await waitToast(page, `Sell ${TICKER} for EUR`);
  await page.waitForTimeout(800);
  await shot(page, '05-coin', true);
});

await step('swap USD into a coin priced in another currency', async () => {
  await page.goto(BASE + '/swap');
  await page.locator('.swap-box .big-input input').first().fill('20');
  await page.locator('.route').waitFor();
  await shot(page, '06-swap');
  await page.locator('.swap-card button.btn-primary').click();
  await waitToast(page, 'Swap USD →');
});

await step('swap coin to coin across currencies (new EUR coin → DRIZZLE/JPY)', async () => {
  await page.goto(BASE + `/swap?in=${lisbon}`);
  await page.locator('.token-btn').nth(1).click();
  await page.locator('.modal input').fill('DRIZZLE');
  await page.locator('.token-row', { hasText: 'DRIZZLE' }).first().click();
  await page.locator('.swap-box').first().getByRole('button', { name: 'Max' }).click();
  await page.locator('.route', { hasText: 'desk' }).waitFor();
  await page.locator('.swap-card button.btn-primary').click();
  await waitToast(page, `Swap ${TICKER} → DRIZZLE`);
  // Max spent the exact balance: nothing left behind
  await page.goto(BASE + `/coin/${lisbon}`);
  await page.locator('.trade-panel .tabs button', { hasText: 'Sell' }).click();
  await page.locator('.trade-panel button.link', { hasText: 'Balance 0' }).waitFor();
});

await step('portfolio shows the launch and claims creator fees', async () => {
  await page.goto(BASE + '/portfolio');
  await page.locator('.panel', { hasText: 'Coins you launched' }).locator('.pair-coin', { hasText: TICKER }).waitFor();
  const claim = page.getByRole('button', { name: 'Claim' }).first();
  await claim.waitFor();
  await shot(page, '07-portfolio', true);
  await claim.click();
  await waitToast(page, 'fees');
});

await step('proof: every market is backed', async () => {
  await page.goto(BASE + '/proof');
  await page.locator('.verdict.ok').waitFor({ timeout: 15_000 });
  await page.locator('.kv', { hasText: 'pad holds' }).first().waitFor({ timeout: 15_000 });
  await shot(page, '08-proof', true);
});

await step('verify: every check passes for the new coin', async () => {
  await page.goto(BASE + `/verify?coin=${lisbon}`);
  await page.getByRole('button', { name: 'Run the checks' }).click();
  await page.locator('.verdict.ok').waitFor({ timeout: 20_000 });
  const marks = await page.locator('.check-mark.ok').count();
  if (marks < 7) throw new Error(`only ${marks} checks passed`);
  await shot(page, '09-verify', true);
});

await step('board filters by currency', async () => {
  await page.goto(BASE + '/board?currency=EUR');
  await page.locator('.coin-card', { hasText: NAME }).waitFor();
  await shot(page, '10-board');
});

await step('how it works and FAQ render', async () => {
  await page.goto(BASE + '/how-it-works');
  await page.locator('.part').first().waitFor();
  await shot(page, '11-how', true);
  await page.goto(BASE + '/faq');
  await page.locator('.faq-item').first().waitFor();
});

console.log('playground mode');
await step('switch to the playground', async () => {
  await page.goto(BASE + '/');
  await page.locator('.mode-pill').click();
  await page.locator('.mode-menu button', { hasText: 'Playground' }).click();
  await page.locator('.mode-pill.playground').waitFor();
  await page.locator('.coin-card').first().waitFor();
});

await step('playground: launch, buy, swap', async () => {
  await page.goto(BASE + '/launch');
  await page.locator('.cur-picker-btn').click();
  await page.locator('.modal input').fill('JPY');
  await page.locator('.token-row', { hasText: 'Japanese Yen' }).first().click();
  await page.locator('#name').fill('Kyoto Mist');
  await page.locator('#ticker').fill('KYOTO');
  await page.locator('#first').fill('3000');
  await page.getByRole('button', { name: 'Launch the coin' }).click();
  await waitToast(page, 'Launch KYOTO / JPY');
  await page.waitForURL(/\/coin\/0x/);
  await page.locator('.trade-panel .big-input input').fill('5000');
  await page.getByRole('button', { name: 'Buy KYOTO' }).click();
  await waitToast(page, 'Buy KYOTO with JPY');
  await page.goto(BASE + '/swap');
  await page.locator('.swap-box .big-input input').first().fill('15');
  await page.locator('.route').waitFor();
  await page.locator('.swap-card button.btn-primary').click();
  await waitToast(page, 'Swap USD →');
  await shot(page, '12-playground-swap');
});

await step('mobile layout', async () => {
  const m = await newPage({ width: 390, height: 844 });
  await m.goto(BASE + '/');
  await m.locator('.coin-card').first().waitFor({ timeout: 20_000 });
  await m.waitForTimeout(800);
  await shot(m, '13-mobile-home');
  await m.locator('.menu-btn').click();
  await m.locator('.sheet').waitFor();
  await shot(m, '14-mobile-menu');
  await m.goto(BASE + '/swap');
  await m.locator('.swap-card').waitFor();
  await shot(m, '15-mobile-swap', true);
});

await browser.close();

const failed = results.filter((r) => !r[0]);
console.log(`\n${results.length - failed.length}/${results.length} steps passed`);
if (errors.length) {
  console.log(`\nbrowser errors (${errors.length}):`);
  [...new Set(errors)].slice(0, 20).forEach((e) => console.log('  ' + e));
}
process.exit(failed.length || errors.length ? 1 : 0);
