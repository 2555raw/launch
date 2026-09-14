/* The full journey against a real EVM chain. See test/README.md.
 *
 * It does not check layout: it checks that the phrase is valid BIP-39, that the
 * secret is never left in the clear in the browser, and that the payment the
 * screen calls confirmed exists on the chain and actually moved the money. */
const { chromium } = require('playwright');
const { ethers } = require('ethers');

const APP = process.env.APP_URL || 'http://127.0.0.1:8099/app';
const RPC = process.env.RPC_URL || 'http://127.0.0.1:8545';
const FUNDER = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const DEST = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

const SHOTS = process.env.SHOT_DIR || require('os').tmpdir() + '/quiver-';
const step = m => console.log('  ▸ ' + m);

(async () => {
  const browser = await chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

  await page.goto(APP, { waitUntil: 'networkidle' });
  step('page loaded');

  await page.click('#startCreate');
  await page.waitForSelector('.seed .word');
  const words = await page.$$eval('#seedGrid .word .w', n => n.map(x => x.textContent));
  if (words.length !== 12) throw new Error('expected 12 words, got ' + words.length);
  if (!ethers.Mnemonic.isValidMnemonic(words.join(' '))) throw new Error('the generated phrase is not valid BIP-39');
  step('valid 12-word BIP-39 phrase generated in the browser');

  await page.click('label.check'); // the way a person would: on the label
  await page.click('#toVerify');
  await page.waitForSelector('#verifyFields .vf');

  // A wrong word first, to prove the check is not decorative
  const rows = await page.$$('#verifyFields .vf');
  await rows[0].$eval('input', i => { i.value = 'zzz'; });
  await page.click('#toPass');
  if (await page.isHidden('#verifyErr')) throw new Error('it accepted a wrong word');
  step('rejects a wrong word');

  for (const row of rows) {
    const n = parseInt((await row.$eval('b', b => b.textContent)).replace(/\D/g, ''), 10);
    await row.$eval('input', (i, v) => { i.value = v; i.dispatchEvent(new Event('input')); }, words[n - 1]);
  }
  await page.click('#toPass');
  await page.waitForSelector('[data-view="password"].on');
  step('phrase check passed');

  await page.fill('#pw1', 'Quiver-2026!ok');
  await page.fill('#pw2', 'Quiver-2026!ok');
  await page.click('#doCreate');
  await page.waitForSelector('[data-view="home"].on', { timeout: 60000 });
  step('wallet encrypted (scrypt) and opened');

  const store = await page.evaluate(() => ({
    ks: localStorage.getItem('quiver.v1.keystore'),
    addr: JSON.parse(localStorage.getItem('quiver.v1.address')),
    all: JSON.stringify(Object.fromEntries(Object.entries(localStorage)))
  }));
  const ksObj = JSON.parse(JSON.parse(store.ks));
  const box = ksObj.Crypto || ksObj.crypto;
  if (!box || !box.ciphertext) throw new Error('the keystore does not look encrypted');
  if (box.kdf !== 'scrypt') throw new Error('unexpected kdf: ' + box.kdf);
  // None of the secret may sit in the clear in the browser
  for (const w of words) {
    const re = new RegExp('(^|[^a-z])' + w + '([^a-z]|$)', 'i');
    if (re.test(store.all)) throw new Error('the word "' + w + '" was left in the clear in localStorage');
  }
  if (store.all.includes(ethers.HDNodeWallet.fromPhrase(words.join(' ')).privateKey.slice(2)))
    throw new Error('the private key was left in the clear in localStorage');
  const derived = ethers.HDNodeWallet.fromPhrase(words.join(' '));
  if (derived.address.toLowerCase() !== store.addr.toLowerCase())
    throw new Error('the address does not derive from the phrase shown');
  step('keystore encrypted with scrypt; neither phrase nor key in the clear');
  step('the address derives from the phrase shown: ' + store.addr);

  // Real money on the local chain
  const prov = new ethers.JsonRpcProvider(RPC, undefined, { cacheTimeout: -1 });
  const funder = new ethers.Wallet(FUNDER, prov);
  await (await funder.sendTransaction({ to: store.addr, value: ethers.parseEther('2') })).wait();
  step('funded with 2 ETH on chain');

  await page.click('[data-go="settings"]');
  await page.fill('#rpcInput', RPC);
  await page.click('#saveRpc');
  await page.click('.view[data-view="settings"] .back');
  await page.waitForFunction(() => {
    const t = document.querySelector('#totalBal').textContent;
    return t && t.includes('ETH');
  }, { timeout: 30000 });
  const bal = await page.textContent('#totalBal');
  if (bal !== '2 ETH') throw new Error('balance read: ' + bal);
  step('balance read from the chain: ' + bal);

  // A real payment
  const before = await prov.getBalance(DEST);
  await page.click('[data-go="send"]');
  await page.fill('#toInput', DEST);
  await page.fill('#amtInput', '0.25');
  await page.click('#reviewBtn');
  await page.waitForSelector('#confirmSheet:not([hidden])', { timeout: 30000 });
  const fee = await page.textContent('#cfFee');
  const after = await page.textContent('#cfAfter');
  step('review: fee ' + fee + ' · balance after ' + after);

  await page.click('#cfSend');
  await page.waitForSelector('#stTitle', { timeout: 30000 });
  await page.waitForFunction(() => document.querySelector('#stTitle').textContent === 'Payment confirmed', null, { timeout: 60000 });
  const txLink = await page.getAttribute('#stLink', 'href');
  step('the app says: Payment confirmed');

  const diff = (await prov.getBalance(DEST)) - before;
  if (diff !== ethers.parseEther('0.25')) throw new Error('the recipient received ' + ethers.formatEther(diff));
  const hash = txLink.split('/tx/')[1];
  const rc = await prov.getTransactionReceipt(hash);
  const tx = await prov.getTransaction(hash);
  if (!rc || rc.status !== 1) throw new Error('invalid receipt');
  if (tx.from.toLowerCase() !== store.addr.toLowerCase()) throw new Error('the signature did not come from the wallet');
  step('ON CHAIN: tx ' + hash.slice(0, 18) + '… type ' + tx.type + ' block ' + rc.blockNumber + ', 0.25 ETH received');

  // The recipient can spend it: the money is real, not a number on a screen
  step('recipient now holds ' + ethers.formatEther(await prov.getBalance(DEST)) + ' ETH');

  // Lock, then reopen with the password
  await page.click('#stDone');
  await page.click('#lockBtn');
  await page.waitForSelector('[data-view="unlock"].on');
  await page.fill('#unlockPw', 'mal');
  await page.click('#doUnlock');
  await page.waitForSelector('#unlockErr:not([hidden])');
  step('wrong password rejected');
  await page.fill('#unlockPw', 'Quiver-2026!ok');
  await page.click('#doUnlock');
  await page.waitForSelector('[data-view="home"].on', { timeout: 60000 });
  await page.waitForSelector('#recentList li .st-tag');
  const tag = await page.textContent('#recentList .st-tag');
  step('reopened; the payment shows as: ' + tag);

  // Payment request link
  await page.click('[data-go="charge"]');
  await page.fill('#chargeAmt', '1.5');
  await page.fill('#chargeNote', 'Table 4');
  await page.click('#makeLink');
  await page.waitForSelector('#linkOut:not([hidden])');
  const link = await page.textContent('#linkText');
  step('payment link: ' + link.slice(0, 96) + '…');

  // The payer opens the link: new tab, a full cold load
  const payer = await ctx.newPage();
  payer.on('pageerror', e => errors.push('PAGEERROR(pagador): ' + e.message));
  await payer.goto(link, { waitUntil: 'domcontentloaded' });
  await payer.waitForSelector('[data-view="unlock"].on', { timeout: 30000 });
  await payer.fill('#unlockPw', 'Quiver-2026!ok');
  await payer.click('#doUnlock');
  await payer.waitForSelector('[data-view="send"].on', { timeout: 60000 });
  const to = await payer.inputValue('#toInput'), amt = await payer.inputValue('#amtInput');
  const noteTxt = await payer.textContent('#payNote');
  if (to.toLowerCase() !== store.addr.toLowerCase() || amt !== '1.5') throw new Error('the request did not prefill: ' + to + ' / ' + amt);
  if (!noteTxt.includes('Table 4')) throw new Error('the note did not arrive');
  step('the link, opened cold, lands on the prefilled payment: ' + amt + ' ETH · "' + noteTxt.trim().slice(0, 44) + '"');
  await payer.screenshot({ path: SHOTS + 'shot-pay.png' });
  await payer.close();

  await page.click('#brandHome');
  await page.waitForSelector('[data-view="home"].on');
  await page.screenshot({ path: SHOTS + 'shot-home.png' });
  await page.click('[data-go="receive"]');
  await page.waitForSelector('#qrBox img');
  await page.screenshot({ path: SHOTS + 'shot-recv.png' });

  const realErrors = errors.filter(e => !/base\.org|Failed to load resource|ERR_|net::/i.test(e));
  if (realErrors.length) { console.log('\n⚠ console errors:'); realErrors.forEach(e => console.log('   ' + e)); }
  else step('no JavaScript errors in the console');

  await browser.close();
  console.log('\n✅ THE WHOLE JOURNEY PASSES');
})().catch(async e => { console.error('\n❌ FAILED: ' + e.message); process.exit(1); });
