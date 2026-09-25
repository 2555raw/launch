/* Text to speech with ElevenLabs. */
const config = require('../config');
const assets = require('../assets');

const DEFAULT_VOICE = process.env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb';

async function speak({ model, text, voice }) {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice || DEFAULT_VOICE}?output_format=mp3_44100_128`, {
    method: 'POST', headers: { 'xi-api-key': config.keys.elevenlabs, 'content-type': 'application/json' },
    body: JSON.stringify({ text, model_id: model.upstream })
  });
  if (!r.ok) {
    let msg = `Speech failed (${r.status})`;
    try { const j = await r.json(); msg = j.detail?.message || msg; } catch { /* keep msg */ }
    throw Object.assign(new Error(msg), { status: 502 });
  }
  return assets.save(Buffer.from(await r.arrayBuffer()), 'audio/mpeg');
}

module.exports = { speak };
