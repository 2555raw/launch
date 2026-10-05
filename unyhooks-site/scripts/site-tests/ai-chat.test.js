/* The builder chat through server.js, with a stand-in for the Claude API.
   Run from unyhooks-site/ after npm install. */
const http = require('http');
const { chromium } = require('playwright');
let reply = null; let calls = 0;
http.createServer((req, res) => { let b = ''; req.on('data', c => b += c); req.on('end', () => { calls++;
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ id: 'm', type: 'message', role: 'assistant', model: 'claude-opus-5-5', stop_reason: 'end_turn', stop_sequence: null, content: [{ type: 'text', text: JSON.stringify(reply) }], usage: { input_tokens: 1, output_tokens: 1 } })); }); }).listen(9921);
process.env.ANTHROPIC_API_KEY = 'k'; process.env.ANTHROPIC_BASE_URL = 'http://localhost:9921';
const { server } = require('../../server.js'); server.listen(9922);
const nul = { feePercent: null, recipient: null, floorPercent: null, ceilingPercent: null, fullMovePercent: null, windowMinutes: null, token: null, maxBuy: null, cooldownSeconds: null, pairDecimals: null, open: null, close: null, weekdaysOnly: null };
const out = []; const ok = (n, c, x = '') => out.push(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  — ' + x : ''}`);
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ignoreHTTPSErrors: true })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:9922/build.html', { waitUntil: 'networkidle' });
  await p.evaluate(() => localStorage.clear());
  reply = { recipe: 'launch', settings: { ...nul, windowMinutes: 120, maxBuy: 1, cooldownSeconds: 60 }, reply: 'Protección para las dos primeras horas: compras de hasta 1 ETH y un minuto entre compras. ¿Cuál es la dirección de tu token?' };
  await p.fill('#prompt', 'protege mi lanzamiento 2 horas, máximo 1 ETH por compra y un minuto entre compras');
  await p.press('#prompt', 'Enter');
  await p.waitForFunction(() => document.querySelectorAll('.bd-ai').length >= 2 && !document.querySelector('.bd-typing'));
  ok('AI reply shown in Spanish', (await p.textContent('.bd-msg:last-child')).includes('Protección para las dos primeras horas'));
  ok('launch recipe applied from AI', await p.$eval('[data-recipe=launch]', e => e.classList.contains('is-active')));
  ok('AI settings in the code', (await p.textContent('#code')).includes('LAUNCH_WINDOW = 120 minutes') && (await p.textContent('#code')).includes('COOLDOWN = 60 seconds'));
  ok('missing token still flagged', (await p.textContent('.bd-msg:last-child')).includes("token's address"));
  reply = { recipe: null, settings: nul, reply: 'Hoy puedo construir cuatro tipos de hook.' };
  await p.fill('#prompt', 'hazme una NFT'); await p.press('#prompt', 'Enter');
  await p.waitForFunction(() => /cuatro tipos/.test(document.querySelector('.bd-msg:last-child').textContent));
  ok('unbuildable request: AI explanation only, hook unchanged', await p.$eval('[data-recipe=launch]', e => e.classList.contains('is-active')));
  ok('the model was actually asked', calls === 2, String(calls));
  // server down mid-visit → rules
  server.close(); 
  ok('no page errors', errs.length === 0, errs.join('|'));
  console.log(out.join('\n')); await b.close(); process.exit(0);
})();
