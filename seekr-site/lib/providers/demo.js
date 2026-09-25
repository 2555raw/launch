/* Demo mode: what runs when a provider has no key. Every reply says so.
 * Chat streams a simulated answer, images and clips are drawn locally as
 * SVG, speech is synthesised as a tone sequence, so the whole product can be
 * exercised end to end: credits are still charged at the model's price. */
const crypto = require('crypto');
const assets = require('../assets');

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
const hash = (s) => crypto.createHash('sha1').update(s).digest();
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function answerFor(model, messages, mode) {
  const last = messages[messages.length - 1]?.content || '';
  const short = last.length > 140 ? last.slice(0, 140) + '…' : last;
  const head = `**Demo mode.** ${model.vendor} has no API key on this server and the free tier did not answer, so this is a simulated reply from *${model.name}*. Add \`${keyName(model.provider)}\` to go live.\n\n`;
  if (mode === 'code') {
    return head + `You asked for: "${short}"\n\nHere is the shape of an answer a code model would return:\n\n\`\`\`html\n<!doctype html>\n<html lang="en">\n  <head><meta charset="utf-8"><title>Demo</title></head>\n  <body>\n    <main>\n      <h1>${esc(short) || 'Hello'}</h1>\n      <p>Generated in demo mode by ${model.name}.</p>\n    </main>\n  </body>\n</html>\n\`\`\`\n\nWith a key set, the same request goes to ${model.vendor} and the real code comes back here.`;
  }
  return head + `You asked: "${short}"\n\nWhat a real answer would do:\n\n1. Read the whole conversation (${messages.length} message${messages.length === 1 ? '' : 's'}) for context.\n2. Reason over it with ${model.name}${model.context ? ` and up to ${(model.context / 1000).toLocaleString()}K tokens of context` : ''}.\n3. Stream the answer back token by token, then charge exactly the tokens used.\n\nThe balance, the allowance, the library and the history all work in demo mode. Only the intelligence is simulated.`;
}

function keyName(p) {
  return { anthropic: 'ANTHROPIC_API_KEY', openai: 'OPENAI_API_KEY', google: 'GOOGLE_API_KEY', deepseek: 'DEEPSEEK_API_KEY', xai: 'XAI_API_KEY', openrouter: 'OPENROUTER_API_KEY', fal: 'FAL_KEY', elevenlabs: 'ELEVENLABS_API_KEY' }[p] || 'the provider key';
}

async function streamChat({ model, messages, onText, signal, mode }) {
  const text = answerFor(model, messages, mode);
  const words = text.split(/(\s+)/);
  let out = '';
  for (const w of words) {
    if (signal?.aborted) break;
    out += w;
    onText(w);
    if (w.trim()) await sleep(12 + Math.random() * 20);
  }
  const inTokens = Math.ceil(messages.reduce((n, m) => n + m.content.length, 0) / 4) + 40;
  return { text: out, usage: { inTokens, outTokens: Math.ceil(out.length / 4) }, finish: 'stop', demo: true };
}

/* a picture drawn from the prompt: a sky, a field, and the words */
function scene(prompt, w, h, animated) {
  const b = hash(prompt);
  const hue = b[0] % 360;
  const flowers = [];
  for (let i = 0; i < 28; i++) {
    const x = (b[(i * 3) % 20] / 255) * w;
    const y = h * 0.62 + (b[(i * 3 + 1) % 20] / 255) * h * 0.34;
    const r = 3 + (b[(i * 3 + 2) % 20] / 255) * 6;
    const c = ['#fff', '#ffd84a', '#ff8fb1', '#c7a6ff', '#ffb46b'][i % 5];
    flowers.push(`<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><line x1="0" y1="0" x2="0" y2="${(r * 3).toFixed(1)}" stroke="#2f7a2f" stroke-width="1.5"/><circle r="${r}" fill="${c}" opacity=".95"/><circle r="${(r * .4).toFixed(1)}" fill="#f6c700"/></g>`);
  }
  const cloud = (x, y, s, d) => `<g opacity=".92" transform="translate(${x} ${y}) scale(${s})">${animated ? `<animateTransform attributeName="transform" type="translate" from="${x - 200} ${y}" to="${x + 200} ${y}" dur="${d}s" repeatCount="indefinite" additive="replace"/>` : ''}<ellipse cx="0" cy="0" rx="70" ry="28" fill="#fff"/><ellipse cx="-40" cy="8" rx="45" ry="22" fill="#fff"/><ellipse cx="45" cy="6" rx="50" ry="24" fill="#fff"/><ellipse cx="10" cy="-16" rx="40" ry="26" fill="#fff"/></g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${205 + (hue % 20)} 90% 55%)"/><stop offset="1" stop-color="hsl(200 95% 82%)"/></linearGradient>
<linearGradient id="hill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fd15a"/><stop offset="1" stop-color="#3f9a3a"/></linearGradient></defs>
<rect width="${w}" height="${h}" fill="url(#sky)"/>
<circle cx="${w * 0.82}" cy="${h * 0.2}" r="${h * 0.09}" fill="#fff6b0" opacity=".95"/>
${cloud(w * 0.2, h * 0.18, 1, 40)}${cloud(w * 0.55, h * 0.3, .7, 55)}${cloud(w * 0.85, h * 0.4, .55, 70)}
<path d="M0 ${h * 0.7} C ${w * 0.25} ${h * 0.55}, ${w * 0.5} ${h * 0.8}, ${w} ${h * 0.62} L ${w} ${h} L 0 ${h} Z" fill="#5cb548"/>
<path d="M0 ${h * 0.78} C ${w * 0.3} ${h * 0.68}, ${w * 0.6} ${h * 0.9}, ${w} ${h * 0.74} L ${w} ${h} L 0 ${h} Z" fill="url(#hill)"/>
${flowers.join('')}
<text x="${w / 2}" y="${h * 0.5}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="${Math.max(14, w / 32)}" font-weight="700" fill="#0b2a4a" opacity=".85">${esc(prompt.slice(0, 48))}</text>
<text x="${w / 2}" y="${h * 0.5 + w / 28}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="${Math.max(10, w / 70)}" fill="#0b2a4a" opacity=".7">demo render — set a provider key for the real model</text>
</svg>`;
}

async function generateImage({ prompt, size }) {
  await sleep(800);
  const [w, h] = (size || '1024x1024').split('x').map(Number);
  return { ...assets.save(Buffer.from(scene(prompt, w, h, false)), 'image/svg+xml'), demo: true };
}

async function generateVideo({ prompt, seconds }) {
  await sleep(1500);
  return { ...assets.save(Buffer.from(scene(prompt, 1280, 720, true)), 'image/svg+xml'), demo: true, seconds };
}

/* a WAV of short tones, one per syllable-ish chunk */
async function speak({ text }) {
  const rate = 16000;
  const chunks = text.split(/\s+/).filter(Boolean).slice(0, 80);
  const dur = 0.12;
  const total = Math.max(1, chunks.length) * (dur + 0.04);
  const n = Math.floor(rate * total);
  const pcm = Buffer.alloc(n * 2);
  let t0 = 0;
  for (const c of chunks) {
    const f = 180 + (hash(c)[0] % 160);
    const start = Math.floor(t0 * rate);
    const len = Math.floor(dur * rate);
    for (let i = 0; i < len && start + i < n; i++) {
      const env = Math.sin((Math.PI * i) / len);
      const v = Math.sin((2 * Math.PI * f * i) / rate) * 0.4 * env + Math.sin((2 * Math.PI * f * 2 * i) / rate) * 0.1 * env;
      pcm.writeInt16LE(Math.round(v * 32767), (start + i) * 2);
    }
    t0 += dur + 0.04;
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVE', 8);
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24); header.writeUInt32LE(rate * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
  return { ...assets.save(Buffer.concat([header, pcm]), 'audio/wav'), demo: true };
}

async function transcribe({ audio }) {
  await sleep(600);
  return { text: `(demo) Received ${(audio.length / 1024).toFixed(1)} KB of audio. Set OPENAI_API_KEY and the real transcript appears here.`, demo: true };
}

module.exports = { streamChat, generateImage, generateVideo, speak, transcribe, keyName };
