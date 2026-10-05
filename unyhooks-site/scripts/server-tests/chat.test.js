/* The AI chat endpoint against a stand-in for the Claude API: what the server
   sends, how it cleans the answer, and its limits. No real API calls.

     node scripts/server-tests/chat.test.js   (from unyhooks-site/, after npm install) */
const http = require('http');
let last = null; let nextReply = null; let nextStatus = 200;
const mock = http.createServer((req, res) => {
  let b = ''; req.on('data', (c) => b += c); req.on('end', () => {
    last = { url: req.url, headers: req.headers, body: JSON.parse(b || '{}') };
    res.writeHead(nextStatus, { 'content-type': 'application/json', 'request-id': 'req_test' });
    if (nextStatus !== 200) return res.end(JSON.stringify({ type: 'error', error: { type: 'api_error', message: 'boom' } }));
    res.end(JSON.stringify({ id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', stop_reason: nextReply.stop || 'end_turn', stop_sequence: null,
      content: nextReply.stop === 'refusal' ? [] : [{ type: 'text', text: JSON.stringify(nextReply.json) }], usage: { input_tokens: 10, output_tokens: 10 } }));
  });
}).listen(9911);

process.env.ANTHROPIC_API_KEY = 'test-key';
process.env.ANTHROPIC_BASE_URL = 'http://localhost:9911';
process.env.PORT = '9912';
const { server } = require('../../server.js');
server.listen(9912);

const res = []; const ok = (n, c, x = '') => res.push(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  — ' + x : ''}`);
const post = async (body, headers = {}) => { const r = await fetch('http://localhost:9912/api/chat', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) }); return { status: r.status, json: await r.json().catch(() => null) }; };
const nul = { feePercent: null, recipient: null, floorPercent: null, ceilingPercent: null, fullMovePercent: null, windowMinutes: null, token: null, maxBuy: null, cooldownSeconds: null, pairDecimals: null, open: null, close: null, weekdaysOnly: null };

(async () => {
  nextReply = { json: { recipe: 'fee', settings: { ...nul, feePercent: 2, recipient: '0x1111111111111111111111111111111111111111' }, reply: 'Listo: 2% de cada swap a tu wallet.' } };
  let r = await post({ text: 'quiero cobrar 2% de cada swap a 0x1111111111111111111111111111111111111111' });
  ok('fee request maps to recipe + settings', r.status === 200 && r.json.recipe === 'fee' && r.json.settings.feePercent === 2 && r.json.missing.length === 0, JSON.stringify(r.json));
  ok('reply passes through in the user language', r.json.reply.startsWith('Listo'));
  ok('request goes to the beta messages endpoint', last.url.startsWith('/v1/messages'), last.url);
  ok('model is claude-opus-5-5', last.body.model === 'claude-opus-5-5');
  ok('fallback beta header sent', String(last.headers['anthropic-beta']).includes('server-side-fallback-2026-07-01'), last.headers['anthropic-beta']);
  ok('fallbacks: "default" in body', last.body.fallbacks === 'default');
  ok('structured output schema sent', last.body.output_config && last.body.output_config.format.type === 'json_schema' && last.body.output_config.effort === 'low');
  ok('no betas field leaks into the body', !('betas' in last.body));
  ok('system prompt lists the recipes', /fee: Fee on every swap/.test(last.body.system) && /hours: Trading hours/.test(last.body.system));
  ok('no thinking param (adaptive by default on Opus 5.5)', !('thinking' in last.body));

  // out-of-range and junk values get dropped, missing address reported
  nextReply = { json: { recipe: 'fee', settings: { ...nul, feePercent: 75, recipient: 'my wallet' }, reply: 'ok' } };
  r = await post({ text: 'take 75%' });
  ok('out-of-range fee dropped, default kept', r.json.settings.feePercent === 1, String(r.json.settings.feePercent));
  ok('non-address dropped and reported missing', r.json.settings.recipient === '' && r.json.missing.some((m) => /wallet/.test(m)));

  // adjusting the current hook keeps other settings
  nextReply = { json: { recipe: 'dynamic', settings: { ...nul, ceilingPercent: 2 }, reply: 'Raised the ceiling.' } };
  r = await post({ text: 'make the max 2%', current: { recipe: 'dynamic', settings: { floorPercent: 0.1, ceilingPercent: 1, fullMovePercent: 3, windowMinutes: 10 } } });
  ok('edits keep the rest of the current hook', r.json.settings.floorPercent === 0.1 && r.json.settings.ceilingPercent === 2 && r.json.settings.windowMinutes === 10, JSON.stringify(r.json.settings));
  ok('current hook is described to the model', /The hook on screen now: dynamic/.test(last.body.messages[0].content));

  // fields from another recipe are ignored
  nextReply = { json: { recipe: 'hours', settings: { ...nul, open: '9:00', close: '25:00', feePercent: 3 }, reply: 'ok' } };
  r = await post({ text: 'open at 9' });
  ok('invalid time dropped, valid kept, foreign fields ignored', r.json.settings.open === '9:00' && r.json.settings.close === '20:00' && !('feePercent' in r.json.settings), JSON.stringify(r.json.settings));

  // not buildable
  nextReply = { json: { recipe: null, settings: nul, reply: 'Hoy puedo construir cuatro tipos de hook.' } };
  r = await post({ text: 'make me a memecoin' });
  ok('unbuildable request returns only a reply', r.json.recipe === null && !r.json.settings && r.json.reply.startsWith('Hoy'));

  // refusal
  nextReply = { stop: 'refusal', json: null };
  r = await post({ text: 'something' });
  ok('refusal answered politely, no crash', r.status === 200 && r.json.recipe === null && r.json.reply.length > 10);

  // upstream error
  nextStatus = 500;
  r = await post({ text: 'fee 1%' });
  ok('upstream error → 502 so the page falls back', r.status === 502, String(r.status));
  nextStatus = 200;

  // bad input
  r = await post({});
  ok('empty text → 400', r.status === 400);
  const big = await fetch('http://localhost:9912/api/chat', { method: 'POST', body: 'x'.repeat(20000) });
  ok('oversized body refused', big.status === 400 || big.status === 413, String(big.status));
  const get = await fetch('http://localhost:9912/api/chat');
  ok('GET /api/chat → 405', get.status === 405);

  // rate limit
  nextReply = { json: { recipe: null, settings: nul, reply: 'x' } };
  let limited = false;
  for (let i = 0; i < 15; i++) { const x = await post({ text: 'hi' }, { 'x-forwarded-for': '9.9.9.9' }); if (x.status === 429) { limited = true; break; } }
  ok('rate limit kicks in', limited);

  // static + privacy
  const st = async (p) => (await fetch('http://localhost:9912' + p)).status;
  ok('site pages served', (await st('/')) === 200 && (await st('/build.html')) === 200 && (await st('/vendor/v4-sources.json')) === 200);
  ok('server source, packages and scripts not served', (await st('/server.js')) === 404 && (await st('/package.json')) === 404 && (await st('/node_modules/@anthropic-ai/sdk/package.json')) === 404 && (await st('/scripts/check-hooks.js')) === 404 && (await st('/.gitignore')) === 404);
  ok('path traversal blocked', (await st('/..%2f..%2fetc/passwd')) !== 200);
  const hz = await (await fetch('http://localhost:9912/healthz')).json();
  ok('healthz reports AI on', hz.ai === true);

  console.log(res.join('\n'));
  process.exit(0);
})();
