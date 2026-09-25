/* The free tier: real models with no provider key, through Pollinations.
 * Used for any model whose own provider has no key on this server.
 *   chat   — an open or small model, streamed in the OpenAI format
 *   images — FLUX
 *   speech — an OpenAI voice model
 * POLLINATIONS_API_KEY (optional) lifts the anonymous rate limits.
 * Each capability tries the endpoints in order and remembers the one that
 * answered; a failure surfaces to the router, which falls back to demo. */
const assets = require('../assets');
const { streamFrom, toMessages } = require('./openaiCompat');

const KEY = process.env.POLLINATIONS_API_KEY || '';
const REF = 'seekr';
const auth = () => (KEY ? { Authorization: `Bearer ${KEY}` } : {});

const TEXT = [
  { url: 'https://gen.pollinations.ai/v1/chat/completions', needsKey: true },
  { url: 'https://text.pollinations.ai/openai' }
];
const IMAGE = [
  (p, w, h, seed) => ({ url: `https://gen.pollinations.ai/image/${encodeURIComponent(p)}?model=flux&width=${w}&height=${h}&seed=${seed}&nologo=true`, needsKey: true }),
  (p, w, h, seed) => ({ url: `https://image.pollinations.ai/prompt/${encodeURIComponent(p)}?model=flux&width=${w}&height=${h}&seed=${seed}&nologo=true&referrer=${REF}` })
];
const usable = (e) => !e.needsKey || KEY;

let textAt = 0;
let imageAt = 0;
const status = { text: null, image: null, speech: null, textModel: null };

/* The anonymous tier serves one model today (openai-fast; "openai" is an alias).
 * Other names answer 404 without a key, so every request uses these two. */
const FREE_MODELS = (process.env.FREE_MODELS || 'openai-fast,openai').split(',');

/* The anonymous tier allows about one request at a time per address and answers
 * 502/429 to the rest, so calls go through a queue and retry a failed start. */
let queue = Promise.resolve();
function queued(fn) {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}
const sleep = (ms, signal) => new Promise((res, rej) => { const t = setTimeout(res, ms); signal?.addEventListener('abort', () => { clearTimeout(t); rej(new Error('aborted')); }, { once: true }); });

function streamChat(args) { return queued(() => streamChatNow(args)); }

async function streamChatNow({ messages, system, onText, signal }) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
  if (attempt) await sleep(1500 * attempt, signal);
  for (let e = textAt; e < TEXT.length; e++) {
    if (!usable(TEXT[e])) continue;
    for (const m of FREE_MODELS) {
      let emitted = false;
      try {
        const out = await streamFrom(TEXT[e].url, { ...auth(), Referer: `https://${REF}.app` }, { model: m, referrer: REF, messages: toMessages(messages, system) }, (t) => { emitted = true; onText(t); }, signal);
        if (!out.text.trim()) throw new Error('Empty reply');
        textAt = e; status.text = true; status.textModel = m;
        return { ...out, servedBy: `${m} (free)` };
      } catch (err) {
        lastErr = err;
        if (emitted || signal?.aborted) throw err; // half an answer already went out: do not start another
      }
    }
  }
  }
  status.text = false;
  throw lastErr || new Error('Free chat is unavailable');
}

function generateImage(args) { return queued(() => generateImageNow(args)); }
async function generateImageNow({ prompt, size }) {
  const [w, h] = (size || '1024x1024').split('x').map(Number);
  let lastErr;
  /* the free service drops a request now and then: three tries, a fresh seed each, before demo */
  for (let attempt = 0; attempt < 3; attempt++) {
  if (attempt) await new Promise((r) => setTimeout(r, 1500 * attempt));
  const seed = Math.floor(Math.random() * 1e9);
  for (let e = imageAt; e < IMAGE.length; e++) {
    const ep = IMAGE[e](prompt, w, h, seed);
    if (!usable(ep)) continue;
    try {
      const r = await fetch(ep.url, { headers: auth(), signal: AbortSignal.timeout(120000) });
      const mime = (r.headers.get('content-type') || '').split(';')[0];
      if (!r.ok || !mime.startsWith('image/')) throw new Error(`Image service answered ${r.status}`);
      const saved = assets.save(Buffer.from(await r.arrayBuffer()), mime);
      imageAt = e; status.image = true;
      return { ...saved, servedBy: 'flux (free)' };
    } catch (err) { lastErr = err; }
  }
  }
  status.image = false;
  throw lastErr || new Error('Free images are unavailable');
}

async function speak({ text, voice }) {
  const url = `https://text.pollinations.ai/${encodeURIComponent(text.slice(0, 1500))}?model=openai-audio&voice=${encodeURIComponent(voice || 'alloy')}&referrer=${REF}`;
  const r = await fetch(url, { headers: auth(), signal: AbortSignal.timeout(90000) });
  const mime = (r.headers.get('content-type') || '').split(';')[0];
  if (!r.ok || !mime.startsWith('audio/')) { status.speech = false; throw new Error(`Speech service answered ${r.status}`); }
  status.speech = true;
  return { ...assets.save(Buffer.from(await r.arrayBuffer()), mime === 'audio/mp3' ? 'audio/mpeg' : mime), servedBy: 'openai-audio (free)' };
}

/* one small call per capability at boot, so the logs say what works from here */
async function probe() {
  const results = [];
  try {
    const out = await streamChat({ model: { vendor: 'OpenAI' }, messages: [{ role: 'user', content: 'Reply with the single word: ready' }], onText: () => {}, signal: AbortSignal.timeout(30000) });
    results.push(`chat ok (${status.textModel}: "${out.text.trim().slice(0, 20)}")`);
  } catch (e) { results.push(`chat FAILED (${e.message})`); }
  try {
    const img = await generateImage({ prompt: 'a small blue flower', size: '256x256' });
    results.push(`images ok (${img.bytes} bytes)`);
  } catch (e) { results.push(`images FAILED (${e.message})`); }
  return results.join(' · ');
}


/* FREE_DIAG=1: at boot, run a small battery through the free models and log
 * the answers, to judge which free model follows instructions best. */
async function diag(systems) {
  const log = (k, v) => console.log(`diag ${k}: ${String(v).replace(/\s+/g, ' ').slice(0, 400)}`);
  try {
    const r = await fetch('https://text.pollinations.ai/models', { signal: AbortSignal.timeout(15000) });
    const list = await r.json();
    log('models', list.map((m) => `${m.name}${m.tier ? '[' + m.tier + ']' : ''}`).join(', '));
  } catch (e) { log('models', 'failed ' + e.message); }
  const tests = [
    ['es', systems.ask, [{ role: 'user', content: 'Escríbeme exactamente 3 ideas de nombres para una cafetería en Madrid, en una lista numerada, sin nada más.' }]],
    ['code', systems.code, [{ role: 'user', content: 'Make a single HTML page with one red button that says Hola and turns blue when clicked.' }]],
    ['memory', systems.ask, [{ role: 'user', content: 'My name is Lucia.' }, { role: 'assistant', content: 'Nice to meet you, Lucia!' }, { role: 'user', content: 'What is my name? Answer with just the name.' }]]
  ];
  for (const model of (process.env.FREE_DIAG_MODELS || 'openai,openai-fast,openai-large,mistral,deepseek,qwen-coder,llama,gemini').split(',')) {
    for (const [name, system, messages] of tests) {
      const t0 = Date.now();
      try {
        const out = await streamFrom(TEXT[1].url, { Referer: `https://${REF}.app` }, { model, referrer: REF, messages: toMessages(messages, system) }, () => {}, AbortSignal.timeout(60000));
        log(`${model}/${name} ${Date.now() - t0}ms`, out.text || '(empty)');
      } catch (e) { log(`${model}/${name}`, 'FAILED ' + e.message); }
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  for (const [p, sz] of [['a red sports car parked on a sunny beach, photo', '1024x1024']]) {
    try { const img = await generateImage({ prompt: p, size: sz }); log('image', `${img.bytes} bytes ${img.mime || ''}`); } catch (e) { log('image', 'FAILED ' + e.message); }
  }
}

module.exports = { streamChat, generateImage, speak, probe, diag, status, supports: { chat: true, image: true, tts: true } };
