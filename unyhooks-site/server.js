/* Serves the UnyHooks site, plus the builder's AI chat at POST /api/chat.
 *
 * The chat never writes Solidity. Claude reads the request and fills in the
 * settings of one of the four tested recipes in builder.js (or none); the
 * server checks every value against the recipe's rules before the page sees
 * it, and the page generates the contract from its own templates. Without
 * ANTHROPIC_API_KEY the endpoint answers 503 and the page falls back to its
 * built-in reader.
 *
 *   ANTHROPIC_API_KEY   enables the chat
 *   UNYHOOKS_MODEL      defaults to claude-opus-5-5
 *   ALLOW_ORIGIN        another origin allowed to call /api/chat (optional)
 *   PORT                Railway sets it; 8080 otherwise */

const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const B = require('./builder.js');

const ROOT = __dirname;
const PORT = process.env.PORT || 8080;
const MODEL = process.env.UNYHOOKS_MODEL || 'claude-opus-5-5';
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || '';

let client = null;
if (process.env.ANTHROPIC_API_KEY) {
  const Anthropic = require('@anthropic-ai/sdk');
  client = new Anthropic();
}

/* ---------- static files ---------- */

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};
// Text is sent compressed (Brotli, else gzip) when the browser accepts it.
// Static files are compressed once and kept, keyed by path and mtime.
const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.json', '.svg', '.txt']);
const packed = new Map();
function encodingFor(req) {
  const acc = String(req.headers['accept-encoding'] || '');
  return /\bbr\b/.test(acc) ? 'br' : /\bgzip\b/.test(acc) ? 'gzip' : null;
}
function compress(buf, enc) {
  return enc === 'br'
    ? zlib.brotliCompressSync(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: buf.length } })
    : zlib.gzipSync(buf, { level: 9 });
}
function sendBody(req, res, status, headers, body, ext, cacheKey) {
  const enc = COMPRESSIBLE.has(ext) && body.length > 1024 ? encodingFor(req) : null;
  if (enc) {
    let out;
    if (cacheKey) {
      const key = `${enc}:${cacheKey}`;
      out = packed.get(key);
      if (!out) { out = compress(Buffer.from(body), enc); packed.set(key, out); }
    } else {
      out = compress(Buffer.from(body), enc);
    }
    headers = { ...headers, 'content-encoding': enc, 'content-length': out.length };
    body = out;
  }
  if (COMPRESSIBLE.has(ext)) headers = { ...headers, vary: 'Accept-Encoding' };
  res.writeHead(status, headers);
  res.end(body);
}

// Only the site itself is public: not the server, the scripts or installed packages.
const PRIVATE = /^\/(node_modules|scripts|\.)|^\/(server\.js|package(-lock)?\.json|README\.md)$/;

function serveFile(req, res) {
  let rel;
  try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (_) { rel = '/'; }
  // Short links to a hook's public page: /h/0x… serves hook.html, with a <base>
  // so its relative links still point at the site root.
  const short = rel.match(/^\/h\/(0x[0-9a-fA-F]{40})\/?$/);
  if (short) {
    return fs.readFile(path.join(ROOT, 'hook.html'), 'utf8', (err, html) => {
      if (err) return send(res, 404, 'text/plain; charset=utf-8', 'Not found');
      const page = absoluteMeta(html.replace('<head>', `<head>\n  <base href="/">\n  <meta property="og:url" content="h/${short[1]}">`), req);
      sendBody(req, res, 200, { 'content-type': TYPES['.html'], 'cache-control': 'no-cache', 'x-content-type-options': 'nosniff' }, page, '.html');
    });
  }
  if (rel === '/' || rel.endsWith('/')) rel += 'index.html';
  if (PRIVATE.test(rel) || rel.split('/').some((part) => part.startsWith('.'))) return send(res, 404, 'text/plain; charset=utf-8', 'Not found');

  const file = path.join(ROOT, path.normalize(rel));
  if (!file.startsWith(ROOT + path.sep)) return send(res, 403, 'text/plain; charset=utf-8', 'Forbidden');

  fs.stat(file, (serr, st) => fs.readFile(file, (err, body) => {
    if (err || serr) return send(res, 404, 'text/plain; charset=utf-8', 'Not found');
    const ext = path.extname(file).toLowerCase();
    // HTML is rewritten per request (absolute share-card URLs), so it is not cached
    if (ext === '.html') body = absoluteMeta(body.toString('utf8'), req);
    sendBody(req, res, 200, {
      'content-type': TYPES[ext] || 'application/octet-stream',
      'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
      'x-content-type-options': 'nosniff'
    }, body, ext, ext === '.html' ? null : `${file}:${st.mtimeMs}`);
  }));
}

// Social cards need absolute URLs. The pages say og.png; the server knows its host.
function absoluteMeta(html, req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (!host) return html;
  const proto = (req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
  const base = `${proto}://${host}`;
  return html
    .replace(/(<meta (?:property|name)="(?:og:image|twitter:image)" content=")(?!https?:)([^"]+)"/g, (_, a, p) => `${a}${base}/${p.replace(/^\//, '')}"`)
    .replace(/(<meta property="og:url" content=")(?!https?:)([^"]*)"/g, (_, a, p) => `${a}${base}/${p.replace(/^\//, '')}"`);
}

function send(res, status, type, body, extra = {}) {
  res.writeHead(status, { 'content-type': type, ...extra });
  res.end(body);
}
const json = (res, status, obj, extra) => send(res, status, 'application/json; charset=utf-8', JSON.stringify(obj), extra);

/* ---------- rate limit ---------- */

// Per address: 12 requests a minute and 150 a day. In memory, so it resets on restart.
const hits = new Map();
function allowed(ip) {
  const now = Date.now();
  const h = hits.get(ip) || { minute: [], day: [] };
  h.minute = h.minute.filter((t) => now - t < 60_000);
  h.day = h.day.filter((t) => now - t < 86_400_000);
  if (h.minute.length >= 12 || h.day.length >= 150) { hits.set(ip, h); return false; }
  h.minute.push(now);
  h.day.push(now);
  hits.set(ip, h);
  if (hits.size > 10_000) hits.clear();
  return true;
}

/* ---------- the chat ---------- */

const fieldLines = Object.entries(B.RECIPES).map(([key, r]) => {
  const fields = r.fields.map((f) => {
    const range = f.type === 'number' ? ` (${f.min} to ${f.max}${f.unit ? ` ${f.unit}` : ''}, default ${f.value})` : '';
    const kind = f.type === 'address' ? ' (an 0x address, 40 hex characters)' : f.type === 'time' ? ' (HH:MM, 24-hour, UTC)' : f.type === 'checkbox' ? ' (true/false)' : '';
    return `    - ${f.key}: ${f.label}${kind}${range}`;
  }).join('\n');
  return `  ${key}: ${r.title}. ${r.blurb}\n${fields}`;
}).join('\n');

const SYSTEM = `You are the assistant inside UnyHooks, a site where people build Uniswap V4 hooks on Robinhood Chain by describing them.

You never write code. You choose one of these recipes and fill in its settings; the site writes the contract from a tested template:

${fieldLines}

How to answer:
- Pick the recipe that matches what the person wants. If they are adjusting the current hook ("make it 2%"), keep its recipe.
- Fill only the settings the person stated or clearly implied. Leave every other setting null; the site keeps the current value or the default.
- Percentages are plain numbers: 1% is 1, not 0.01. Durations go in the unit of the field: one hour of launch protection is windowMinutes 60.
- For "US market hours", use open 13:30, close 20:00, weekdaysOnly true, and say this is 9:30 to 16:00 New York time in summer.
- Never invent an address. If a recipe needs one (the fee recipient, the launched token) and the person did not give it, leave it null and ask for it in your reply.
- If what they ask for is none of the four recipes (minting, a new token, anything off-chain, anything unrelated), set recipe to null and say plainly what the site can build today.
- reply: two or three short sentences in the same language the person wrote in. Say what you set, ask for anything missing. Plain text, no markdown, no code.`;

const nullable = (schema) => ({ anyOf: [schema, { type: 'null' }] });
const FIELD_SCHEMA = {
  number: nullable({ type: 'number' }),
  address: nullable({ type: 'string' }),
  time: nullable({ type: 'string' }),
  checkbox: nullable({ type: 'boolean' })
};
const allFields = {};
for (const r of Object.values(B.RECIPES)) for (const f of r.fields) allFields[f.key] = FIELD_SCHEMA[f.type];

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['recipe', 'settings', 'reply'],
  properties: {
    recipe: nullable({ type: 'string', enum: Object.keys(B.RECIPES) }),
    settings: { type: 'object', additionalProperties: false, required: Object.keys(allFields), properties: allFields },
    reply: { type: 'string' }
  }
};

// Keeps only values that fit the recipe; anything else is dropped, never guessed.
function clean(recipe, proposed, current) {
  const fields = B.RECIPES[recipe].fields;
  const base = current && current.recipe === recipe ? { ...B.defaults(recipe), ...current.settings } : B.defaults(recipe);
  const out = { ...base };
  for (const f of fields) {
    const v = proposed ? proposed[f.key] : null;
    if (v === null || v === undefined) continue;
    if (f.type === 'number' && typeof v === 'number' && Number.isFinite(v) && v >= f.min && v <= f.max) out[f.key] = v;
    if (f.type === 'address' && B.isAddress(v)) out[f.key] = v.trim();
    if (f.type === 'time' && /^([01]?\d|2[0-3]):[0-5]\d$/.test(v)) out[f.key] = v;
    if (f.type === 'checkbox' && typeof v === 'boolean') out[f.key] = v;
  }
  return out;
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      // Past the limit, keep draining the upload but stop storing it.
      if (size > limit) { reject(Object.assign(new Error('too large'), { tooLarge: true })); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function chat(req, res, cors) {
  if (!client) return json(res, 503, { error: 'ai_unavailable' }, cors);
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  if (!allowed(ip)) return json(res, 429, { error: 'rate_limited' }, cors);

  let input;
  try {
    input = JSON.parse(await readBody(req, 8_000));
  } catch (err) {
    return json(res, err.tooLarge ? 413 : 400, { error: err.tooLarge ? 'too_large' : 'bad_request' }, { ...cors, connection: 'close' });
  }
  const text = typeof input.text === 'string' ? input.text.trim().slice(0, 1_500) : '';
  if (!text) return json(res, 400, { error: 'empty' }, cors);
  const current = input.current && B.RECIPES[input.current.recipe]
    ? { recipe: input.current.recipe, settings: clean(input.current.recipe, input.current.settings, null) }
    : null;

  const context = current
    ? `The hook on screen now: ${current.recipe}, with settings ${JSON.stringify(current.settings)}.`
    : 'No hook on screen yet.';

  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
      cache_control: { type: 'ephemeral' },
      system: SYSTEM,
      messages: [{ role: 'user', content: `${context}\n\nThe person wrote:\n${text}` }]
    });

    if (response.stop_reason === 'refusal') {
      return json(res, 200, { source: 'ai', recipe: null, reply: 'I can only help set up one of the four hooks this site builds: a fee on every swap, dynamic fees, launch protection or trading hours.' }, cors);
    }
    const block = response.content.find((b) => b.type === 'text');
    const parsed = block ? JSON.parse(block.text) : null;
    if (!parsed || typeof parsed.reply !== 'string') throw new Error('no structured answer');

    const recipe = B.RECIPES[parsed.recipe] ? parsed.recipe : null;
    if (!recipe) return json(res, 200, { source: 'ai', recipe: null, reply: parsed.reply.slice(0, 800) }, cors);
    const settings = clean(recipe, parsed.settings, current);
    return json(res, 200, {
      source: 'ai',
      recipe,
      settings,
      reply: parsed.reply.slice(0, 800),
      missing: B.generate(recipe, settings).problems
    }, cors);
  } catch (err) {
    console.error('chat failed:', err && (err.status || ''), err && err.message);
    return json(res, 502, { error: 'ai_failed' }, cors);
  }
}

/* ---------- server ---------- */

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const origin = req.headers.origin;
  const cors = ALLOW_ORIGIN && origin === ALLOW_ORIGIN
    ? { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'content-type', vary: 'Origin' }
    : {};

  if (url.pathname === '/api/chat') {
    if (req.method === 'OPTIONS') return send(res, 204, 'text/plain', '', cors);
    if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' }, cors);
    return chat(req, res, cors);
  }
  if (url.pathname === '/healthz') return json(res, 200, { ok: true, ai: !!client });
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'text/plain; charset=utf-8', 'Method not allowed');
  return serveFile(req, res);
});

if (require.main === module) {
  server.listen(PORT, () => console.log(`UnyHooks on :${PORT} (AI chat ${client ? `on, ${MODEL}` : 'off: set ANTHROPIC_API_KEY'})`));
}

module.exports = { server, clean, OUTPUT_SCHEMA, SYSTEM };
