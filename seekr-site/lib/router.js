/* Picks who serves a model:
 *   live — the model's own provider, when its key is set
 *   free — a real free model (lib/providers/free.js), when it can do the job
 *   demo — a labelled simulation, if both of the above are unavailable
 * A free call that fails before sending anything falls through to demo, so
 * the product always answers. */
const config = require('./config');
const demo = require('./providers/demo');
const free = require('./providers/free');

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

/* wrap each method: try free, fall back to demo when free gives nothing */
function freeThenDemo() {
  const wrap = (name) => async (args) => {
    let emitted = false;
    const a = name === 'streamChat' ? { ...args, onText: (t) => { emitted = true; args.onText(t); } } : args;
    try {
      const out = await free[name](a);
      return { ...out, tier: 'free' };
    } catch (e) {
      if (emitted || args.signal?.aborted) throw e;
      console.warn(`free ${name} failed, using demo: ${e.message}`);
      const out = await demo[name](args);
      return { ...out, tier: 'demo' };
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

function resolve(model) {
  if (config.isLive(model.provider)) return { impl: live[model.provider](), live: true, tier: 'live' };
  const kindOk = { chat: 'chat', image: 'image', tts: 'tts' }[model.kind];
  if (freeOn() && kindOk) return { impl: freeThenDemo(), live: false, tier: 'free' };
  if (config.demoAllowed()) return { impl: demo, live: false, tier: 'demo' };
  throw Object.assign(new Error(`${model.vendor} is not configured on this server (set ${demo.keyName(model.provider)})`), { status: 503 });
}

module.exports = { resolve, free };
