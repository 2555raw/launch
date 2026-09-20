// impeccable — the quality pass. See SKILL.md for what each check means.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';

const folder = path.resolve(process.argv[2] || 'bonded-site');
const problems = [];
const note = (s) => problems.push(s);
const files = fs.readdirSync(folder);
const pages = files.filter(f => f.endsWith('.html'));
const html = Object.fromEntries(pages.map(p => [p, fs.readFileSync(path.join(folder, p), 'utf8')]));
const counts = { pages: pages.length, ids: 0, links: 0, flows: 0 };

// 1. scripts parse
for (const f of files.filter(f => f.endsWith('.js'))) {
  try { execFileSync('node', ['--check', path.join(folder, f)], { stdio: 'pipe' }); }
  catch (e) { note(`${f} does not parse: ${String(e.stderr).split('\n')[0]}`); }
}

// 2. ids the script reaches
const app = fs.existsSync(path.join(folder, 'app.js')) ? fs.readFileSync(path.join(folder, 'app.js'), 'utf8') : '';
const idsIn = (src) => new Set([...src.matchAll(/(?<!\$)\$\('#([\w-]+)'\)|getElementById\('([\w-]+)'\)|(?<!\$)\$\('#([\w-]+)\s/g)].map(m => m[1] || m[2] || m[3]));
const pageBlocks = [...app.matchAll(/if \(page === '(\w+)'\) \{([\s\S]*?)\n  \}\n/g)];
const pageKey = Object.fromEntries(pages.map(p => [p, (html[p].match(/data-page="(\w+)"/) || [])[1]]));
const hasId = (p, id) => new RegExp(`id="${id}"`).test(html[p]);
for (const [, key, body] of pageBlocks) {
  const owner = pages.filter(p => pageKey[p] === key);
  for (const id of idsIn(body)) {
    counts.ids++;
    // ids created by the script itself at runtime are declared in innerHTML strings
    if (body.includes(`id="${id}"`)) continue;
    if (!owner.some(p => hasId(p, id))) note(`app.js (${key}) reaches #${id}, which ${owner.join(', ') || 'no page'} does not have`);
  }
}
const shared = app.slice(0, pageBlocks.length ? app.indexOf(pageBlocks[0][0]) : app.length);
for (const id of idsIn(shared)) {
  counts.ids++;
  if (['fish-label', 'scene', 'hero', 'motion', 'reset', 'hero-launch', 'toast'].includes(id)) { if (!pages.some(p => hasId(p, id))) note(`shared code reaches #${id}, which no page has`); continue; }
  if (!pages.every(p => hasId(p, id))) note(`shared code reaches #${id}; missing in ${pages.filter(p => !hasId(p, id)).join(', ')}`);
}
for (const p of pages) {
  for (const [, id] of html[p].matchAll(/data-scroll="([\w-]+)"/g)) { counts.ids++; if (!hasId(p, id)) note(`${p}: data-scroll="${id}" has no #${id} on that page`); }
  for (const [, id] of html[p].matchAll(/href="#([\w-]+)"/g)) { counts.ids++; if (!hasId(p, id)) note(`${p}: href="#${id}" has no #${id} on that page`); }
  for (const [, target, id] of html[p].matchAll(/href="([\w.-]+\.html)#([\w-]+)"/g)) { counts.ids++; if (!html[target] || !hasId(target, id)) note(`${p}: link to ${target}#${id}, which does not exist`); }
}

// 3. local links land
for (const p of pages) {
  for (const [, url] of html[p].matchAll(/(?<![\w-])(?:href|src)="([^"#][^"]*)"/g)) {
    if (/^(https?:|mailto:|data:|\/\/)/.test(url)) continue;
    counts.links++;
    const file = url.split(/[?#]/)[0];
    if (file && !fs.existsSync(path.join(folder, file))) note(`${p}: ${url} is not a file in ${path.basename(folder)}`);
  }
}

// 4. nav reaches every page
for (const p of pages) {
  if (p === 'index.html') continue;
  const linked = pages.some(q => q !== p && new RegExp(`href="${p}[#?"]`).test(html[q])) || app.includes(`'${p}`) || p === 'live.html';
  if (!linked) note(`${p} is linked from no other page`);
}

// 5. one asset version
const versions = new Set(pages.flatMap(p => [...html[p].matchAll(/(?:styles\.css|app\.js)\?v=(\w+)/g)].map(m => m[1])));
if (versions.size !== 1) note(`asset version query differs across pages: ${[...versions].join(', ') || 'none'}`);

// 6 + 7 + 8. server and browser (the site's server takes PORT; we pick a free one)
const port = await new Promise((resolve) => { const srv = http.createServer(); srv.listen(0, () => { const p = srv.address().port; srv.close(() => resolve(p)); }); });
const { spawn } = await import('node:child_process');
const proc = spawn('node', ['server.js'], { cwd: folder, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 500));
const base = `http://localhost:${port}`;
const get = (p) => new Promise((resolve, reject) => http.get(base + p, res => { let b = ''; res.on('data', d => b += d); res.on('end', () => resolve({ status: res.statusCode, body: b, headers: res.headers })); }).on('error', reject));
try {
  if ((await get('/health')).body !== 'ok') note('/health does not answer ok');
  if ((await get('/board')).status !== 200) note('/board without the extension does not answer 200');
  const climb = await get('/..%2f..%2fetc%2fpasswd'); if (climb.status === 200 && climb.body.includes('root:')) note('the server serves files outside its folder');
  for (const f of ['/', '/styles.css', '/app.js']) { const h = (await get(f)).headers['cache-control'] || ''; if (!/no-cache/.test(h)) note(`${f} is cached (${h || 'no header'}); a deploy would be hidden behind it`); }

  let chromium;
  try { ({ chromium } = await import('playwright')); }
  catch {
    // ESM ignores NODE_PATH; PLAYWRIGHT_DIR names a node_modules that has it
    try { const { createRequire } = await import('node:module'); ({ chromium } = createRequire(path.join(process.env.PLAYWRIGHT_DIR || '/nonexistent', 'x.js'))('playwright')); }
    catch { note('playwright is not resolvable; browser checks skipped (see SKILL.md)'); }
  }
  if (chromium) {
    const exe = process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium';
    const b = await chromium.launch(fs.existsSync(exe) ? { executablePath: exe } : {});
    for (const p of pages) for (const w of [1440, 390]) {
      const ctx = await b.newContext({ viewport: { width: w, height: 900 } }); const page = await ctx.newPage();
      const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/font|CERT|net::ERR/i.test(m.text())) errs.push(m.text()); });
      const url = p === 'pair.html' ? p + '?t=ROBO' : p;
      await page.goto(`${base}/${url}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(400);
      const r = await page.evaluate(() => ({ over: document.documentElement.scrollWidth - document.documentElement.clientWidth, main: !!document.querySelector('main') }));
      if (errs.length) note(`${p} @${w}: ${errs.join(' | ')}`);
      if (r.over > 0) note(`${p} @${w}: horizontal scroll of ${r.over}px`);
      if (!r.main) note(`${p} @${w}: no <main>`);
      await ctx.close();
    }
    // the loop
    try {
      const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); const pg = await ctx.newPage();
      const errs = []; pg.on('pageerror', e => errs.push(e.message));
      const T = 'IMP' + Math.floor(Math.random() * 900 + 100);
      await pg.goto(`${base}/launch.html?stock=TSLA`, { waitUntil: 'networkidle' });
      await pg.fill('#f-name', 'Impeccable Run'); await pg.fill('#f-ticker', T); await pg.fill('#f-buy', '0.2');
      await pg.click('#deploy'); await pg.waitForSelector('#done-wrap:not([hidden])', { timeout: 9000 });
      await pg.click('#done-open'); await pg.waitForLoadState('networkidle'); await pg.waitForTimeout(400);
      const title = await pg.textContent('.bd-pp-title'); if (!title.includes('Impeccable Run')) note('after launching, the pair page does not show the new pair');
      const hold0 = await pg.textContent('#hold'); if (!/\d/.test(hold0) || hold0.startsWith('0 ')) note('the first buy left no position');
      await pg.fill('#amt', '0.05'); await pg.waitForTimeout(150); await pg.click('#go'); await pg.waitForTimeout(1300);
      await pg.click('#trade [data-side="sell"]'); await pg.click('#quick button[data-pct="50"]'); await pg.waitForTimeout(150); await pg.click('#go'); await pg.waitForTimeout(1300);
      await pg.goto(`${base}/playground.html`, { waitUntil: 'networkidle' }); await pg.waitForTimeout(400);
      const launched = await pg.locator('.bd-pairs .bd-pair').count(), rows = await pg.locator('.bd-trades tbody tr').count();
      if (launched < 1) note('playground shows no launched pair'); if (rows < 1) note('playground shows no position');
      await pg.goto(`${base}/board.html?q=${T}`, { waitUntil: 'networkidle' }); await pg.waitForTimeout(300);
      if (await pg.locator('#rows tr').count() < 1) note('the board search does not find the new pair');
      await pg.goto(`${base}/live.html`, { waitUntil: 'networkidle' }); await pg.waitForTimeout(300);
      if (!(await pg.textContent('#fresh')).includes('Impeccable Run')) note('the live page does not list the new pair under just bonded');
      if (errs.length) note(`loop: ${errs.join(' | ')}`);
      counts.flows = 1; await ctx.close();
    } catch (e) { note(`loop failed: ${e.message.split('\n')[0]}`); }
    await b.close();
  }
} finally { proc.kill(); }

if (problems.length) { console.log('impeccable: ' + problems.length + ' problem(s)\n- ' + problems.join('\n- ')); process.exit(1); }
console.log(`impeccable: clean · ${counts.pages} pages · ${counts.ids} ids · ${counts.links} links · ${counts.flows} flow`);
