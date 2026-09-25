/* The model catalog: what you can run, who serves it, and what it costs.
 *
 * Prices are the provider's own price in USD (per 1M tokens, per image, per
 * second of video, per 1M characters of speech, per minute of audio). The
 * list price shown on the site is that number times config.markup; the
 * $WONDR holder price is 5% of the list price. Both are computed in credits.js
 * so the numbers live in exactly one place.
 *
 * `upstream` is the id the provider is called with. Change it here (or with
 * MODEL_UPSTREAM_OVERRIDES='{"gpt-6-sol":"gpt-6"}') when a provider renames
 * something; nothing else needs to move. */

const CATEGORIES = [
  { id: 'chat', tag: 'TEXT', title: 'Chat & research', blurb: 'Ask, research and reason over long context.' },
  { id: 'code', tag: 'CODE', title: 'Code & websites', blurb: 'Write, refactor and ship code, from a function to a whole site.' },
  { id: 'image', tag: 'IMAGE', title: 'Image generation', blurb: 'Generate and edit images from a prompt or a reference.' },
  { id: 'video', tag: 'VIDEO', title: 'Video generation', blurb: 'Turn a prompt or a still into a clip.' },
  { id: 'audio', tag: 'AUDIO', title: 'Voice & audio', blurb: 'Speak text aloud and turn speech back into text.' }
];

/* kind: chat | image | video | tts | stt
   price: { in, out } per 1M tokens · { image } per image · { second } per second
          { mchars } per 1M characters · { minute } per minute of audio */
const MODELS = [
  /* ---- Anthropic ---- */
  { id: 'claude-opus-5-5', name: 'Claude Opus 5.5', vendor: 'Anthropic', provider: 'anthropic', kind: 'chat', upstream: 'claude-opus-5-5', price: { in: 4, out: 20 }, cats: ['chat', 'code'], context: 1000000, rec: ['code'], badge: 'new' },
  { id: 'claude-opus-5', name: 'Claude Opus 5', vendor: 'Anthropic', provider: 'anthropic', kind: 'chat', upstream: 'claude-opus-5', price: { in: 5, out: 25 }, cats: ['chat', 'code'], context: 1000000 },
  { id: 'claude-sonnet-5', name: 'Claude Sonnet 5', vendor: 'Anthropic', provider: 'anthropic', kind: 'chat', upstream: 'claude-sonnet-5', price: { in: 2, out: 10 }, cats: ['chat', 'code'], context: 1000000, default: true },
  { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', vendor: 'Anthropic', provider: 'anthropic', kind: 'chat', upstream: 'claude-haiku-4-5', price: { in: 1, out: 5 }, cats: ['chat', 'code'], context: 200000 },

  /* ---- OpenAI ---- */
  { id: 'gpt-6-sol', name: 'GPT-6 Sol', vendor: 'OpenAI', provider: 'openai', kind: 'chat', upstream: 'gpt-6-sol', price: { in: 2, out: 10 }, cats: ['chat', 'code'], context: 1000000, badge: 'new' },
  { id: 'gpt-5.4', name: 'GPT-5.4', vendor: 'OpenAI', provider: 'openai', kind: 'chat', upstream: 'gpt-5.4', price: { in: 1.25, out: 10 }, cats: ['chat', 'code'], context: 400000 },
  { id: 'gpt-5-mini', name: 'GPT-5 mini', vendor: 'OpenAI', provider: 'openai', kind: 'chat', upstream: 'gpt-5-mini', price: { in: 0.25, out: 2 }, cats: ['chat', 'code'], context: 400000 },
  { id: 'gpt-image-2', name: 'GPT Image 2', vendor: 'OpenAI', provider: 'openai', kind: 'image', upstream: 'gpt-image-2', price: { image: 0.04 }, cats: ['image'] },
  { id: 'gpt-4o-mini-tts', name: 'GPT-4o mini TTS', vendor: 'OpenAI', provider: 'openai', kind: 'tts', upstream: 'gpt-4o-mini-tts', price: { mchars: 12 }, cats: ['audio'], rec: ['audio'] },
  { id: 'gpt-4o-transcribe', name: 'GPT-4o Transcribe', vendor: 'OpenAI', provider: 'openai', kind: 'stt', upstream: 'gpt-4o-transcribe', price: { minute: 0.006 }, cats: ['audio'] },

  /* ---- Google ---- */
  { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', vendor: 'Google', provider: 'google', kind: 'chat', upstream: 'gemini-3.7-flash', price: { in: 0.3, out: 2.5 }, cats: ['chat', 'code'], context: 1000000, rec: ['chat'] },
  { id: 'gemini-3.7-pro', name: 'Gemini 3.7 Pro', vendor: 'Google', provider: 'google', kind: 'chat', upstream: 'gemini-3.7-pro', price: { in: 2, out: 12 }, cats: ['chat', 'code'], context: 1000000 },
  { id: 'nano-banana-2-lite', name: 'Nano Banana 2 Lite', vendor: 'Google', provider: 'google', kind: 'image', upstream: 'gemini-3.5-flash-lite-image', price: { image: 0.04 }, cats: ['image'], rec: ['image'] },
  { id: 'nano-banana-2', name: 'Nano Banana 2', vendor: 'Google', provider: 'google', kind: 'image', upstream: 'gemini-3.5-flash-image', price: { image: 0.08 }, cats: ['image'] },
  { id: 'veo-4', name: 'Veo 4', vendor: 'Google', provider: 'google', kind: 'video', upstream: 'veo-4.0-generate-preview', price: { second: 0.4 }, cats: ['video'] },

  /* ---- DeepSeek ---- */
  { id: 'deepseek-v4', name: 'DeepSeek V4', vendor: 'DeepSeek', provider: 'deepseek', kind: 'chat', upstream: 'deepseek-chat', price: { in: 0.27, out: 1.1 }, cats: ['chat', 'code'], context: 128000 },
  { id: 'deepseek-r2', name: 'DeepSeek R2', vendor: 'DeepSeek', provider: 'deepseek', kind: 'chat', upstream: 'deepseek-reasoner', price: { in: 0.55, out: 2.19 }, cats: ['chat', 'code'], context: 128000 },

  /* ---- xAI ---- */
  { id: 'grok-4.6', name: 'Grok 4.6', vendor: 'xAI', provider: 'xai', kind: 'chat', upstream: 'grok-4.6', price: { in: 3, out: 15 }, cats: ['chat', 'code'], context: 256000, rec: ['chat'] },
  { id: 'grok-4.6-fast', name: 'Grok 4.6 Fast', vendor: 'xAI', provider: 'xai', kind: 'chat', upstream: 'grok-4.6-fast', price: { in: 0.2, out: 0.5 }, cats: ['chat', 'code'], context: 2000000 },

  /* ---- Open models via OpenRouter ---- */
  { id: 'llama-4-maverick', name: 'Llama 4 Maverick', vendor: 'Meta', provider: 'openrouter', kind: 'chat', upstream: 'meta-llama/llama-4-maverick', price: { in: 0.15, out: 0.6 }, cats: ['chat', 'code'], context: 1000000 },
  { id: 'qwen3-coder', name: 'Qwen3 Coder', vendor: 'Alibaba', provider: 'openrouter', kind: 'chat', upstream: 'qwen/qwen3-coder', price: { in: 0.2, out: 0.8 }, cats: ['code'], context: 256000 },
  { id: 'mistral-large-3', name: 'Mistral Large 3', vendor: 'Mistral', provider: 'openrouter', kind: 'chat', upstream: 'mistralai/mistral-large-3', price: { in: 0.5, out: 1.5 }, cats: ['chat', 'code'], context: 256000 },
  { id: 'nemotron-ultra', name: 'Nemotron Ultra', vendor: 'NVIDIA', provider: 'openrouter', kind: 'chat', upstream: 'nvidia/llama-3.1-nemotron-ultra-253b-v1', price: { in: 0.6, out: 1.8 }, cats: ['chat'], context: 128000 },

  /* ---- Images & video via fal ---- */
  { id: 'flux-2-pro', name: 'FLUX.2 Pro', vendor: 'Black Forest Labs', provider: 'fal', kind: 'image', upstream: 'fal-ai/flux-2-pro', price: { image: 0.05 }, cats: ['image'], rec: ['image'] },
  { id: 'flux-schnell', name: 'FLUX.1 Schnell', vendor: 'Black Forest Labs', provider: 'fal', kind: 'image', upstream: 'fal-ai/flux/schnell', price: { image: 0.003 }, cats: ['image'] },
  { id: 'kling-3', name: 'Kling 3.0', vendor: 'Kuaishou', provider: 'fal', kind: 'video', upstream: 'fal-ai/kling-video/v3/standard/text-to-video', price: { second: 0.07 }, cats: ['video'], rec: ['video'] },
  { id: 'seedance-2-pro', name: 'Seedance 2 Pro', vendor: 'ByteDance', provider: 'fal', kind: 'video', upstream: 'fal-ai/bytedance/seedance/v2/pro/text-to-video', price: { second: 0.06 }, cats: ['video'], rec: ['video'] },
  { id: 'runway-gen-5', name: 'Runway Gen-5', vendor: 'Runway', provider: 'fal', kind: 'video', upstream: 'fal-ai/runway/gen5/text-to-video', price: { second: 0.1 }, cats: ['video'] },

  /* ---- Voice via ElevenLabs ---- */
  { id: 'eleven-v3', name: 'Eleven v3', vendor: 'ElevenLabs', provider: 'elevenlabs', kind: 'tts', upstream: 'eleven_v3', price: { mchars: 30 }, cats: ['audio'] }
];

/* per-provider upstream overrides from the environment */
try {
  const o = JSON.parse(process.env.MODEL_UPSTREAM_OVERRIDES || '{}');
  for (const m of MODELS) if (o[m.id]) m.upstream = o[m.id];
} catch { /* ignore malformed overrides */ }

const byId = new Map(MODELS.map((m) => [m.id, m]));

module.exports = {
  CATEGORIES,
  MODELS,
  get: (id) => byId.get(id),
  defaultChat: () => MODELS.find((m) => m.default) || MODELS.find((m) => m.kind === 'chat'),
  forCategory: (cat) => MODELS.filter((m) => m.cats.includes(cat)),
  recommended: (cat) => MODELS.filter((m) => (m.rec || []).includes(cat))
};
