/* Claude, through the official SDK. Streams text back and returns the usage
 * the API reports so the charge is exact. */
const Anthropic = require('@anthropic-ai/sdk').default || require('@anthropic-ai/sdk');
const config = require('../config');

let client = null;
const getClient = () => client || (client = new Anthropic({ apiKey: config.keys.anthropic }));

/* Haiku 4.5 still takes the old thinking shape; every other Claude here is 4.6+ */
const supportsAdaptive = (upstream) => !/haiku-4-5/.test(upstream);

async function streamChat({ model, messages, system, onText, signal, web }) {
  const params = {
    model: model.upstream,
    max_tokens: 16000,
    system: system || undefined,
    messages: messages.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }))
  };
  if (supportsAdaptive(model.upstream)) params.thinking = { type: 'adaptive' };
  /* the globe in the composer: let Claude search when the question needs it */
  if (web && supportsAdaptive(model.upstream)) params.tools = [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5 }];

  const stream = getClient().messages.stream(params, { signal });
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') onText(event.delta.text);
  }
  const final = await stream.finalMessage();
  const text = final.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  const refused = final.stop_reason === 'refusal';
  return {
    text: refused && !text ? 'Claude declined this request.' : text,
    usage: { inTokens: final.usage.input_tokens, outTokens: final.usage.output_tokens },
    finish: final.stop_reason
  };
}

module.exports = { streamChat };
