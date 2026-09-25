/* FLUX, Kling, Seedance and Runway through fal.ai: images synchronously,
 * video through the queue. */
const config = require('../config');
const assets = require('../assets');

const H = () => ({ Authorization: `Key ${config.keys.fal}`, 'content-type': 'application/json' });
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function fail(r, what) {
  let msg = `${what} failed (${r.status})`;
  try { const j = await r.json(); msg = j.detail?.[0]?.msg || j.detail || j.message || msg; } catch { /* keep msg */ }
  throw Object.assign(new Error(String(msg)), { status: 502 });
}

async function generateImage({ model, prompt, size }) {
  const image_size = size === '1024x1536' ? 'portrait_4_3' : size === '1536x1024' ? 'landscape_4_3' : 'square_hd';
  const r = await fetch(`https://fal.run/${model.upstream}`, { method: 'POST', headers: H(), body: JSON.stringify({ prompt, image_size, num_images: 1 }) });
  if (!r.ok) await fail(r, 'Image generation');
  const j = await r.json();
  const url = j.images?.[0]?.url || j.image?.url;
  if (!url) throw Object.assign(new Error('The model returned no image'), { status: 502 });
  return assets.saveFromUrl(url);
}

async function generateVideo({ model, prompt, seconds, aspect }) {
  const r = await fetch(`https://queue.fal.run/${model.upstream}`, { method: 'POST', headers: H(), body: JSON.stringify({ prompt, duration: String(seconds), aspect_ratio: aspect || '16:9' }) });
  if (!r.ok) await fail(r, 'Video generation');
  const q = await r.json();
  for (let i = 0; i < 180; i++) {
    await sleep(4000);
    const s = await fetch(q.status_url, { headers: H() });
    if (!s.ok) await fail(s, 'Video status');
    const st = await s.json();
    if (st.status === 'COMPLETED') {
      const res = await fetch(q.response_url, { headers: H() });
      if (!res.ok) await fail(res, 'Video result');
      const j = await res.json();
      const url = j.video?.url;
      if (!url) throw Object.assign(new Error('The model returned no video'), { status: 502 });
      return assets.saveFromUrl(url);
    }
    if (st.status === 'FAILED') throw Object.assign(new Error('Video generation failed'), { status: 502 });
  }
  throw Object.assign(new Error('Video generation timed out'), { status: 504 });
}

module.exports = { generateImage, generateVideo };
