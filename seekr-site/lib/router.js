/* Picks who serves a model:
 *   live — the model's own provider, when its key is set
 *   free — a real free model (lib/providers/free.js), when it can do the job
 *   demo — a labelled simulation, only when the free tier is switched off
 * A free call that fails says the free model is busy; it never falls back to a
 * simulated answer. */
const config = require('./config');
const demo = require('./providers/demo');
const free = require('./providers/free');
const openrouter = require('./openrouter');

const live = {
  anthropic: () => require('./providers/anthropic'),
  openai: () => require('./providers/openaiCompat'),
  deepseek: () => require('./providers/openaiCompat'),
  xai: () => require('./providers/openaiCompat'),
  openrouter: () => require('./providers/openaiCompat'),
  google: () => require('./providers/google'),
  fal: () => require('./providers/fal'),
  elevenlabs: () => require('./providers/elevenlabs')
};

const freeOn = () => (process.env.FREE_TIER || 'on').toLowerCase() !== 'off';

/* The free tier, and nothing pretending to be it: when the free service cannot
 * answer (after its own retries) the user gets a plain "busy" message, never a
 * simulated answer that has nothing to do with the question. */
const BUSY = {
  streamChat: 'The free model is busy right now. Try again in a few seconds.',
  generateImage: 'The free image model is busy right now. Try again in a few seconds.',
  speak: 'The free voice model is busy right now. Try again in a few seconds.'
};
function freeOnly() {
  const wrap = (name) => async (args) => {
    try {
      const out = await free[name](args);
      return { ...out, tier: 'free' };
    } catch (e) {
      if (args.signal?.aborted) throw e;
      console.warn(`free ${name} failed: ${e.message}`);
      throw Object.assign(new Error(BUSY[name]), { status: 503, cause: e });
    }
  };
  return {
    streamChat: wrap('streamChat'),
    generateImage: wrap('generateImage'),
    speak: wrap('speak'),
    generateVideo: async (args) => ({ ...(await demo.generateVideo(args)), tier: 'demo' }),
    transcribe: async (args) => ({ ...(await demo.transcribe(args)), tier: 'demo' })
  };
}

/* the model's own provider key first, then OpenRouter with the exact same model */
const isLive = (model) => config.isLive(model.provider) || openrouter.viaOpenRouter(model);
function viaOR(model) {
  const oc = require('./providers/openaiCompat');
  const as = (m) => ({ ...m, provider: 'openrouter', upstream: m.orSlug });
  return { streamChat: async (args) => ({ ...(await oc.streamChat({ ...args, model: as(args.model) })), servedBy: model.orSlug + ' (OpenRouter)' }) };
}

function resolve(model) {
  if (config.isLive(model.provider)) return { impl: live[model.provider](), live: true, tier: 'live' };
  if (openrouter.viaOpenRouter(model)) return { impl: viaOR(model), live: true, tier: 'live' };
  const kindOk = { chat: 'chat', image: 'image', tts: 'tts' }[model.kind];
  if (freeOn() && kindOk) return { impl: freeOnly(), live: false, tier: 'free' };
  if (config.demoAllowed()) return { impl: demo, live: false, tier: 'demo' };
  throw Object.assign(new Error(`${model.vendor} is not configured on this server (set ${demo.keyName(model.provider)})`), { status: 503 });
}

module.exports = { resolve, free, isLive, openrouter };
