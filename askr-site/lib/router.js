/* Picks the implementation for a model: the live provider when its key is
 * set, demo otherwise (unless DEMO_MODE=off, which makes it an error). */
const config = require('./config');
const demo = require('./providers/demo');

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

function resolve(model) {
  if (config.isLive(model.provider)) return { impl: live[model.provider](), live: true };
  if (config.demoAllowed()) return { impl: demo, live: false };
  throw Object.assign(new Error(`${model.vendor} is not configured on this server (set ${demo.keyName(model.provider)})`), { status: 503 });
}

module.exports = { resolve };
