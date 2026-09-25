/* OpenAI and the providers that speak its API: DeepSeek, xAI, OpenRouter.
 * Chat streams over SSE; OpenAI also serves images, speech and transcription. */
const config = require('../config');
const assets = require('../assets');

const BASES = {
  openai: 'https://api.openai.com/v1',
  deepseek: 'https://api.deepseek.com/v1',
  xai: 'https://api.x.ai/v1',
  openrouter: 'https://openrouter.ai/api/v1'
};

function headers(provider, extra = {}) {
  const h = { Authorization: `Bearer ${config.keys[provider]}`, ...extra };
  if (provider === 'openrouter') { h['HTTP-Referer'] = config.publicUrl || 'https://wondr.website'; h['X-Title'] = 'wondr'; }
  return h;
}

async function fail(r, what) {
  let msg = `${what} failed (${r.status})`;
  try { const j = await r.json(); msg = j.error?.message || j.message || msg; } catch { /* keep msg */ }
  throw Object.assign(new Error(msg), { status: 502 });
}

/* Stream an OpenAI-style chat completion from any compatible endpoint. */
async function streamFrom(url, hdrs, body, onText, signal) {
  const r = await fetch(url, { method: 'POST', headers: { ...hdrs, 'content-type': 'application/json' }, body: JSON.stringify({ ...body, stream: true }), signal });
  if (!r.ok) await fail(r, 'Chat');
  let text = '';
  let usage = null;
  let finish = null;
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') continue;
      let j;
      try { j = JSON.parse(data); } catch { continue; }
      const delta = j.choices?.[0]?.delta?.content;
      if (delta) { text += delta; onText(delta); }
      if (j.choices?.[0]?.finish_reason) finish = j.choices[0].finish_reason;
      if (j.usage) usage = { inTokens: j.usage.prompt_tokens, outTokens: j.usage.completion_tokens };
    }
  }
  if (!usage) usage = { inTokens: Math.ceil(JSON.stringify(body.messages).length / 4), outTokens: Math.ceil(text.length / 4) };
  return { text, usage, finish };
}

const toMessages = (messages, system) => [...(system ? [{ role: 'system', content: system }] : []), ...messages.map((m) => ({ role: m.role, content: m.content }))];

async function streamChat({ model, messages, system, onText, signal }) {
  const provider = model.provider;
  return streamFrom(`${BASES[provider]}/chat/completions`, headers(provider), { model: model.upstream, stream_options: { include_usage: true }, messages: toMessages(messages, system) }, onText, signal);
}

async function generateImage({ model, prompt, size }) {
  const r = await fetch(`${BASES.openai}/images/generations`, {
    method: 'POST', headers: headers('openai', { 'content-type': 'application/json' }),
    body: JSON.stringify({ model: model.upstream, prompt, n: 1, size: size || '1024x1024' })
  });
  if (!r.ok) await fail(r, 'Image generation');
  const j = await r.json();
  const d = j.data[0];
  if (d.b64_json) return assets.save(Buffer.from(d.b64_json, 'base64'), 'image/png');
  return assets.saveFromUrl(d.url);
}

async function speak({ model, text, voice }) {
  const r = await fetch(`${BASES.openai}/audio/speech`, {
    method: 'POST', headers: headers('openai', { 'content-type': 'application/json' }),
    body: JSON.stringify({ model: model.upstream, input: text, voice: voice || 'alloy', response_format: 'mp3' })
  });
  if (!r.ok) await fail(r, 'Speech');
  return assets.save(Buffer.from(await r.arrayBuffer()), 'audio/mpeg');
}

async function transcribe({ model, audio, mime }) {
  const form = new FormData();
  form.append('model', model.upstream);
  form.append('file', new Blob([audio], { type: mime }), 'audio' + ({ 'audio/webm': '.webm', 'audio/mp4': '.m4a', 'audio/mpeg': '.mp3', 'audio/wav': '.wav' }[mime] || '.webm'));
  const r = await fetch(`${BASES.openai}/audio/transcriptions`, { method: 'POST', headers: headers('openai'), body: form });
  if (!r.ok) await fail(r, 'Transcription');
  const j = await r.json();
  return { text: j.text || '' };
}

module.exports = { streamChat, generateImage, speak, transcribe, streamFrom, toMessages };
