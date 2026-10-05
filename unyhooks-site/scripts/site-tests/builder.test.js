/* The builder page in a browser: hand-off from the landing, examples, typed
   requests, settings, tabs, copy, download, persistence, mobile.
   Serve the site on :8765 first (python3 -m http.server 8765). */
const { chromium } = require('playwright');
const B = 'http://localhost:8765/';
const res = []; const ok = (n, c, x = '') => res.push(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  — ' + x : ''}`);
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ignoreHTTPSErrors: true, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
  const errs = []; const watch = p => { p.on('pageerror', e => errs.push(e.message)); p.on('response', r => { if (r.url().startsWith(B) && r.status() >= 400 && !r.url().endsWith('/api/chat')) errs.push('404 ' + r.url()); }); };
  let p = await ctx.newPage(); watch(p); await p.setViewportSize({ width: 1440, height: 900 });

  // landing hand-off
  await p.goto(B + 'index.html', { waitUntil: 'networkidle' });
  await p.fill('#try-input', 'Send 2% of every swap to 0xAbCdEf0123456789abcdef0123456789ABCDEF01');
  await p.click('#try button[type=submit]'); await p.waitForURL('**/build.html'); await p.waitForTimeout(300);
  ok('landing: typed request opens the builder', p.url().endsWith('build.html'));
  ok('builder: picks up the request as a chat message', (await p.textContent('.bd-me .bd-bubble')).includes('Send 2%'));
  ok('builder: understands fee + address', (await p.textContent('#thread')).includes('fee on every swap'));
  ok('builder: code has FEE_BPS = 200', (await p.textContent('#code')).includes('FEE_BPS = 200'));
  ok('builder: status Ready to deploy', (await p.textContent('#status')) === 'Ready to deploy');
  ok('builder: settings show the address', (await p.inputValue('[data-key=recipient]')) === '0xAbCdEf0123456789abcdef0123456789ABCDEF01');

  // examples
  await p.click('.bd-example >> nth=1'); await p.waitForTimeout(200);
  ok('example: dynamic fee selected', await p.$eval('[data-recipe=dynamic]', e => e.classList.contains('is-active')));
  ok('example: floor/ceiling parsed', (await p.textContent('#code')).includes('MIN_FEE = 500') && (await p.textContent('#code')).includes('MAX_FEE = 10000'));
  await p.click('.bd-example >> nth=2'); await p.waitForTimeout(200);
  ok('example: launch selected and asks for the token', (await p.textContent('#thread')).includes("Add your token's address"));
  ok('example: launch status needs details', (await p.textContent('#status')) === 'Needs details');
  ok('example: launch shows cap and cooldown', (await p.textContent('#code')).includes('MAX_BUY = 500_000_000_000_000_000') && (await p.textContent('#code')).includes('COOLDOWN = 30 seconds'));
  await p.fill('[data-key=token]', '0x2222222222222222222222222222222222222222'); await p.waitForTimeout(150);
  ok('editing a field updates status', (await p.textContent('#status')) === 'Ready to deploy');
  await p.click('.bd-example >> nth=3'); await p.waitForTimeout(200);
  ok('example: market hours', (await p.textContent('#code')).includes('OPEN_MINUTE = 810') && (await p.textContent('#code')).includes('WEEKDAYS_ONLY = true'));
  await p.uncheck('[data-key=weekdaysOnly]'); await p.waitForTimeout(150);
  ok('checkbox updates code', (await p.textContent('#code')).includes('WEEKDAYS_ONLY = false'));

  // typed requests
  const ask = async t => { await p.fill('#prompt', t); await p.press('#prompt', 'Enter'); await p.waitForTimeout(200); };
  await ask('open from 9am to 5pm every day');
  ok('typed: hours 09:00-17:00', (await p.textContent('#code')).includes('OPEN_MINUTE = 540') && (await p.textContent('#code')).includes('CLOSE_MINUTE = 1020'));
  await ask('make me a sandwich');
  ok('typed: unknown request explains options', (await p.textContent('.bd-msg:last-child')).includes("couldn't tell"));
  await ask('take a 0.5% tax on trades');
  ok('typed: tax → fee 0.5%', (await p.textContent('#code')).includes('FEE_BPS = 50'));

  // bad values
  await p.fill('[data-key=feePercent]', '50'); await p.waitForTimeout(150);
  ok('bad value flagged', (await p.textContent('#problems')).includes('between 0.01 and 10'));
  ok('bad value still renders clamped code', (await p.textContent('#code')).includes('FEE_BPS = 1000'));
  await p.fill('[data-key=feePercent]', '1');

  // tabs, copy, download
  await p.click('#tab-script'); await p.waitForTimeout(100);
  ok('deploy script tab', (await p.textContent('#filename')) === 'script/DeploySwapFeeHook.s.sol' && (await p.textContent('#code')).includes('HookMiner.find'));
  await p.click('#copy'); await p.waitForTimeout(100);
  ok('copy copies the shown file', (await p.evaluate(() => navigator.clipboard.readText())).includes('contract DeploySwapFeeHook'));
  await p.click('#tab-hook');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#download')]);
  ok('download gives the .sol', dl.suggestedFilename() === 'SwapFeeHook.sol');
  const fs = require('fs'); const path = await dl.path(); const src = fs.readFileSync(path, 'utf8');
  ok('downloaded file is the hook', src.includes('contract SwapFeeHook is BaseHook'));

  // persistence
  await p.reload({ waitUntil: 'networkidle' });
  ok('reload keeps the hook', (await p.textContent('#code')).includes('FEE_BPS = 50') || (await p.textContent('#code')).includes('FEE_BPS = 100'));
  ok('wallet chip links to sign-in', (await p.getAttribute('#wallet', 'href')) === 'app.html');

  // landing chips
  await p.goto(B + 'index.html'); await p.click('[data-idea] >> nth=1'); await p.waitForURL('**/build.html'); await p.waitForTimeout(300);
  ok('landing idea chip opens builder with launch hook', await p.$eval('[data-recipe=launch]', e => e.classList.contains('is-active')));
  ok('Launch app button goes to builder', (await (await ctx.newPage()).goto(B + 'index.html').then(async r => { const pp = ctx.pages().at(-1); return pp.getAttribute('.uh-nav [data-link=app]', 'href'); })) === 'build.html');

  // signed-in chip + sign-in page links
  p = await ctx.newPage(); watch(p);
  await p.goto(B + 'app.html'); 
  ok('sign-in page offers builder without wallet', (await p.getAttribute('.ap-skip a', 'href')) === 'build.html');
  await p.evaluate(() => sessionStorage.setItem('unyhooks-session', JSON.stringify({ address: '0x1234567890abcdef1234567890abcdef12345678' })));
  await p.goto(B + 'build.html', { waitUntil: 'networkidle' });
  ok('builder shows signed-in wallet', (await p.textContent('#wallet')).includes('0x1234…5678'));

  // mobile
  p = await ctx.newPage(); watch(p); await p.setViewportSize({ width: 390, height: 844 });
  await p.goto(B + 'build.html', { waitUntil: 'networkidle' });
  ok('mobile builder: no sideways scroll', (await p.evaluate(() => document.documentElement.scrollWidth)) <= 390);
  await p.goto(B + 'index.html', { waitUntil: 'networkidle' });
  ok('mobile landing: no sideways scroll', (await p.evaluate(() => document.documentElement.scrollWidth)) <= 390);

  ok('no JS errors / 404s', errs.length === 0, errs.join(' | '));
  console.log(res.join('\n')); await b.close();
})();
