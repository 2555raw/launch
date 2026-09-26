/* Smoke test for a production build with no chain behind it: the site must open
 * in the playground and every flow must work as a guest, and survive a reload.
 *
 *   npm run build && PORT=8090 npm start      # terminal 1
 *   BASE=http://localhost:8090 npm run e2e:playground */
import { existsSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:8090';
const OUT = process.env.SHOTS || 'e2e/shots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

const done = (title) => page.locator('.toast.done', { hasText: title }).first().waitFor({ timeout: 15_000 });
const fail = (msg) => {
  throw new Error(msg);
};

await page.goto(BASE + '/');
await page.locator('.mode-pill.playground').waitFor({ timeout: 15_000 });
await page.locator('.coin-card').first().waitFor();
console.log('  ✓ opens in the playground with the opening coins');

await page.locator('button.nav-connect').click();
await page.locator('.wallet-row.guest').click();
await page.locator('.acct-btn').waitFor();
console.log('  ✓ guest connect');

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
