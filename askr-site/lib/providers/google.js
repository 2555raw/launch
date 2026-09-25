/* Gemini (chat), Nano Banana (images) and Veo (video) over the Gemini API. */
const config = require('../config');
const assets = require('../assets');

const BASE = 'https://generativelanguage.googleapis.com/v1beta';
const key = () => config.keys.google;

async function fail(r, what) {
  let msg = `${what} failed (${r.status})`;
  try { const j = await r.json(); msg = j.error?.message || msg; } catch { /* keep msg */ }
  throw Object.assign(new Error(msg), { status: 502 });
}

const toContents = (messages) => messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));

async function streamChat({ model, messages, system, onText, signal }) {
  const body = { contents: toContents(messages) };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  const r = await fetch(`${BASE}/models/${model.upstream}:streamGenerateContent?alt=sse&key=${key()}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal
  });
  if (!r.ok) await fail(r, 'Chat');
  let text = '';
  let usage = null;
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
      let j;
      try { j = JSON.parse(line.slice(5)); } catch { continue; }
      const parts = j.candidates?.[0]?.content?.parts || [];
      for (const p of parts) if (p.text) { text += p.text; onText(p.text); }
      if (j.usageMetadata) usage = { inTokens: j.usageMetadata.promptTokenCount || 0, outTokens: j.usageMetadata.candidatesTokenCount || 0 };
    }
  }
  if (!usage) usage = { inTokens: Math.ceil(JSON.stringify(body).length / 4), outTokens: Math.ceil(text.length / 4) };
  return { text, usage, finish: 'stop' };
}

async function generateImage({ model, prompt }) {
  const r = await fetch(`${BASE}/models/${model.upstream}:generateContent?key=${key()}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE', 'TEXT'] } })
  });
  if (!r.ok) await fail(r, 'Image generation');
  const j = await r.json();
  const part = (j.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData);
  if (!part) throw Object.assign(new Error('The model returned no image'), { status: 502 });
  return assets.save(Buffer.from(part.inlineData.data, 'base64'), part.inlineData.mimeType || 'image/png');
}

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function generateVideo({ model, prompt, seconds, aspect }) {
  const r = await fetch(`${BASE}/models/${model.upstream}:predictLongRunning?key=${key()}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ instances: [{ prompt }], parameters: { durationSeconds: seconds, aspectRatio: aspect || '16:9' } })
  });
  if (!r.ok) await fail(r, 'Video generation');
  const op = await r.json();
  for (let i = 0; i < 120; i++) {
    await sleep(5000);
    const s = await fetch(`${BASE}/${op.name}?key=${key()}`);
    if (!s.ok) await fail(s, 'Video status');
    const j = await s.json();
    if (j.error) throw Object.assign(new Error(j.error.message || 'Video generation failed'), { status: 502 });
    if (j.done) {
      const uri = j.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
      if (!uri) throw Object.assign(new Error('The model returned no video'), { status: 502 });
      return assets.saveFromUrl(uri, { 'x-goog-api-key': key() });
    }
  }
  throw Object.assign(new Error('Video generation timed out'), { status: 504 });
}

module.exports = { streamChat, generateImage, generateVideo };
