/* OpenRouter as the door to every chat model whose own provider has no key.
 * The public model list is read at boot and every six hours; each catalog chat
 * model is matched to its exact OpenRouter model (same name, same version, never
 * a different one) and takes OpenRouter's real price, so the list price and the
 * bill always sit above what the call costs. Models with no exact match stay on
 * the free tier. */
const config = require('./config');
const catalog = require('./catalog');

const VENDOR = { Anthropic: 'anthropic', OpenAI: 'openai', Google: 'google', DeepSeek: 'deepseek', xAI: 'x-ai', Meta: 'meta-llama', Alibaba: 'qwen', Mistral: 'mistralai', NVIDIA: 'nvidia' };
const tokens = (s) => String(s).toLowerCase().replace(/^[a-z0-9-]+\//, '').replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
const status = { at: 0, mapped: {}, missing: [], error: null };

function match(model, list) {
  if (model.provider === 'openrouter') { const x = list.find((o) => o.id === model.upstream); if (x) return x; }
  const pre = VENDOR[model.vendor];
  if (!pre) return null;
  const want = tokens(model.name);
  let best = null, bestExtra = 1e9;
  for (const o of list) {
    if (!o.id.startsWith(pre + '/') || /:(free|beta|extended|thinking|online)$/.test(o.id)) continue;
    const have = tokens(o.id);
    const left = [...have];
    if (!want.every((t) => { const i = left.indexOf(t); if (i < 0) return false; left.splice(i, 1); return true; })) continue;
    if (left.some((t) => /^\d{1,5}$/.test(t))) continue;          /* another version number: a different model */
    if (left.length < bestExtra) { best = o; bestExtra = left.length; }
  }
  return best;
}

async function refresh() {
  if (!config.keys.openrouter) return status;
  try {
    const r = await fetch('https://openrouter.ai/api/v1/models', { signal: AbortSignal.timeout(20000) });
    const list = (await r.json()).data || [];
    status.mapped = {}; status.missing = [];
    for (const m of catalog.MODELS) {
      if (m.kind !== 'chat' || config.isLive(m.provider) && m.provider !== 'openrouter') continue;
      const o = match(m, list);
      const pin = Number(o && o.pricing && o.pricing.prompt), pout = Number(o && o.pricing && o.pricing.completion);
      if (!o || !(pin >= 0) || !(pout > 0)) { m.via = null; status.missing.push(m.id); continue; }
      m.via = 'openrouter'; m.orSlug = o.id;
      m.price = { ...m.price, in: pin * 1e6, out: pout * 1e6 };
      if (o.context_length) m.context = o.context_length;
      status.mapped[m.id] = o.id;
    }
    status.at = Date.now(); status.error = null;
  } catch (e) { status.error = e.message; }
  return status;
}

const viaOpenRouter = (model) => Boolean(config.keys.openrouter && model.via === 'openrouter' && model.orSlug);

/* at boot: is the key good, how much is left, and does a real call go through (a few tokens, a fraction of a cent) */
async function check() {
  const H = { Authorization: `Bearer ${config.keys.openrouter}`, 'content-type': 'application/json', 'HTTP-Referer': config.publicUrl || 'https://wondr.website', 'X-Title': 'seekr' };
  const out = [];
  try {
    const k = (await (await fetch('https://openrouter.ai/api/v1/key', { headers: H, signal: AbortSignal.timeout(15000) })).json()).data || {};
    out.push(`key ok, used $${Number(k.usage || 0).toFixed(4)}${k.limit != null ? ` of a $${k.limit} limit` : ', no limit set on the key'}${k.is_free_tier ? ', free tier' : ''}`);
  } catch (e) { out.push('key check failed: ' + e.message); }
  try {
    const r = await fetch('https://openrouter.ai/api/v1/credits', { headers: H, signal: AbortSignal.timeout(15000) });
    if (r.ok) { const c = (await r.json()).data || {}; out.push(`account credits $${(Number(c.total_credits || 0) - Number(c.total_usage || 0)).toFixed(2)} left`); }
  } catch { /* optional */ }
  const cheap = catalog.MODELS.filter((m) => m.via === 'openrouter').sort((a, b) => a.price.out - b.price.out)[0];
  if (cheap) {
    try {
      const r = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: H, signal: AbortSignal.timeout(30000), body: JSON.stringify({ model: cheap.orSlug, max_tokens: 5, messages: [{ role: 'user', content: 'Reply with the single word: ready' }] }) });
      const j = await r.json();
      out.push(r.ok ? `test call ${cheap.orSlug}: "${String(j.choices?.[0]?.message?.content || '').trim().slice(0, 20)}"` : `test call ${cheap.orSlug} FAILED (${r.status}): ${j.error?.message || ''}`);
    } catch (e) { out.push('test call failed: ' + e.message); }
  }
  return out.join(' · ');
}

function start() {
  if (!config.keys.openrouter) return Promise.resolve(status);
  setInterval(refresh, 6 * 60 * 60 * 1000).unref();
  return refresh().then(async (st) => { st.check = await check(); return st; });
}

module.exports = { start, refresh, viaOpenRouter, status, match };
