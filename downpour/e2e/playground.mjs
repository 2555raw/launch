/* Smoke test for a production build with no chain behind it: the site must open
 * in the playground and every flow must work with a wallet that only lends its
 * address (a test wallet injected the way an extension would be), and survive a reload.
 *
 *   npm run build && PORT=8090 npm start      # terminal 1
 *   BASE=http://localhost:8090 npm run e2e:playground */
import { existsSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:8090';
const OUT = process.env.SHOTS || 'e2e/shots';
mkdirSync(OUT, { recursive: true });

// a wallet with an address and nothing else: the playground never asks it to sign
function testWallet({ account }) {
  const provider = {
    async request({ method }) {
      if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [account];
      if (method === 'eth_chainId') return '0x1';
      throw new Error(`the test wallet does not do ${method}`);
    },
    on() {},
    removeListener() {},
  };
  const info = { uuid: '6f7b1b64-5f38-4cb3-9a7c-0d0f00000008', name: 'Test Wallet', icon: '', rdns: 'dev.starmint.testwallet' };
  const announce = () => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: Object.freeze({ info, provider }) }));
  window.addEventListener('eip6963:requestProvider', announce);
  announce();
}

const browser = await chromium.launch(existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
const errors = [];
const fail = (msg) => {
  throw new Error(msg);
};

// the notice on arrival: "I do not accept" leaves for Pons, "Accept and enter" is remembered
{
  const fresh = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await fresh.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(BASE + '/board');
  await p.locator('.gate', { hasText: 'Before you enter' }).waitFor({ timeout: 15_000 });
  const away = await p.locator('.gate-no').getAttribute('href');
  if (away !== 'https://www.ponsfamily.com/launchpad') fail(`"I do not accept" goes to ${away}`);
  await p.getByRole('button', { name: 'Accept and enter' }).click();
  await p.locator('.gate').waitFor({ state: 'detached' });
  await p.locator('.seg button', { hasText: 'On the curve' }).click();
  await p.reload();
  await p.locator('.coin-card').first().waitFor({ timeout: 15_000 });
  if (await p.locator('.gate').count()) fail('the notice came back after accepting it');
  await fresh.close();
  console.log('  ✓ the notice on arrival, accepted once');
}

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(testWallet, { account: '0x90F79bf6EB2c4f870365E785982E1f101E93b906' });
await ctx.addInitScript(() => localStorage.setItem('starmint:entered', '1'));
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(e.message));

const done = (title) => page.locator('.toast.done', { hasText: title }).first().waitFor({ timeout: 15_000 });

await page.goto(BASE + '/');
await page.locator('.coin-card').first().waitFor({ timeout: 15_000 });
await page.locator('button.nav-connect').click();
await page.locator('.modal', { hasText: 'In the playground' }).waitFor();
console.log('  ✓ opens in the playground with the opening coins');

await page.locator('.wallet-row', { hasText: 'Test Wallet' }).click();
await page.locator('.acct-btn').waitFor();
console.log('  ✓ connect a wallet');

await page.goto(BASE + '/launch');
await page.locator('#name').fill('Havana Hurricane');
await page.locator('#ticker').fill('HAVANA');
await page.locator('.cur-picker-btn').click();
await page.locator('.modal input').fill('MXN');
await page.locator('.token-row', { hasText: 'Mexican Peso' }).first().click();
await page.locator('#first').fill('500');
await page.getByRole('button', { name: 'Launch the coin' }).click();
await done('Launch HAVANA / MXN');
await page.waitForURL(/\/coin\/0x/);
const url = page.url();
console.log('  ✓ launch HAVANA / MXN');

await page.locator('.trade-panel .big-input input').fill('800');
await page.getByRole('button', { name: 'Buy HAVANA' }).click();
await done('Buy HAVANA with MXN');
await page.locator('.trade-panel .tabs button', { hasText: 'Sell' }).click();
await page.locator('.trade-panel .quick .chip', { hasText: '100%' }).click();
await page.getByRole('button', { name: 'Sell HAVANA' }).click();
await done('Sell HAVANA for MXN');
console.log('  ✓ buy, then sell 100%');

// a comma is a decimal point too (phones in Spain only have the comma): 0,5 USD is half a dollar
await page.goto(BASE + '/swap');
await page.locator('.swap-card .token-btn').nth(1).waitFor();
await page.locator('[aria-label="Amount to pay"]').fill('0,5');
await page.locator('.swap-box .small.muted', { hasText: '≈ $0.5' }).first().waitFor();
await page.getByRole('button', { name: 'Swap', exact: true }).click();
await done('Swap USD →');
console.log('  ✓ swap 0,5 USD');

await page.goto(BASE + '/desk?code=NGN');
await page.getByRole('button', { name: 'Get test NGN' }).click();
await done('Faucet: test NGN');
console.log('  ✓ faucet');

await page.goto(BASE + '/portfolio');
await page.getByRole('button', { name: 'Claim' }).first().click();
await done('fees');
console.log('  ✓ claim creator fees');

await page.reload();
await page.goto(url);
await page.locator('.coin-head h1', { hasText: 'Havana Hurricane' }).waitFor();
console.log('  ✓ the coin survives a reload');

await page.goto(BASE + '/proof');
await page.locator('.verdict').waitFor({ timeout: 15_000 });
if (!(await page.locator('.verdict.ok').count())) fail(`proof failed: ${await page.locator('.verdict').innerText()}`);
await page.screenshot({ path: `${OUT}/playground-proof.png` });
console.log('  ✓ proof holds');

await browser.close();
if (errors.length) {
  console.log('browser errors:\n  ' + errors.join('\n  '));
  process.exit(1);
}
console.log('playground: all good');
