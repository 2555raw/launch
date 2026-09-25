/* One-off: generate the photographic tea-room scenes (day, then the same room at
 * night) with an OpenRouter image model, save them to the data volume and print
 * them to the log in chunks so they can be pulled into the repo. Runs only when
 * SCENE_GEN=1; remove the variable afterwards. */
const fs = require('fs'); const path = require('path');
const config = require('./config');

const DAY = 'Photorealistic interior architectural photograph, wide-angle, straight one-point perspective, camera at seated eye level. A traditional Chinese tea room in a wooden pavilion: dark polished wooden pillars and ceiling beams, a warm light wooden plank floor, carved wooden lattice sliding doors with rice paper along both side walls. The whole back wall is open: its sliding doors are pushed aside, framing a calm misty lake with Guilin karst mountains and green tea terraces in soft morning light. In the centre of the room stands a low dark rosewood tea table with a Yixing clay teapot, small white porcelain tea cups and a wooden tea tray, a faint wisp of steam. Serene, quiet, natural daylight, soft shadows, high detail, sharp, 16:9. No people, no text, no watermark.';
const NIGHT = 'Edit this photograph into the same room at night. Keep exactly the same room, camera position, framing, pillars, floor and table. Close all the lattice sliding doors on the back wall so the view is hidden: their rice paper glows faintly with cool blue moonlight, with the soft shadow of a tree branch on the paper. Remove the tea set from the table. Hang one round red Chinese paper lantern with gold caps and a red tassel just above the table, glowing warm orange, casting warm light on the table, the floor and the nearby wood; the rest of the room is dark and blue. Photorealistic, same style, 16:9. No people, no text.';

async function pickModel(H) {
  const r = await fetch('https://openrouter.ai/api/v1/models', { headers: H }); const j = await r.json();
  const img = (j.data || []).filter((m) => (m.architecture?.output_modalities || []).includes('image'));
  console.log('scenegen: image models ' + img.map((m) => m.id).join(', '));
  const pref = [/gemini.*image/i, /image/i];
  for (const p of pref) { const m = img.find((x) => p.test(x.id) && (x.architecture?.input_modalities || []).includes('image')); if (m) return m.id; }
  return img[0] && img[0].id;
}

async function gen(H, model, text, imageUrl) {
  const content = [{ type: 'text', text }]; if (imageUrl) content.push({ type: 'image_url', image_url: { url: imageUrl } });
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { ...H, 'content-type': 'application/json' }, body: JSON.stringify({ model, messages: [{ role: 'user', content }], modalities: ['image', 'text'], image_config: { aspect_ratio: '16:9' } }) });
  const j = await r.json();
  const url = j.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url) throw new Error('no image: ' + JSON.stringify(j).slice(0, 400));
  return url;
}

function dump(name, dataUrl) {
  const b64 = dataUrl.split(',')[1]; const N = 6000, n = Math.ceil(b64.length / N);
  console.log(`SCENEMETA ${name} ${dataUrl.slice(5, dataUrl.indexOf(';'))} ${b64.length} ${n}`);
  for (let i = 0; i < n; i++) console.log(`SCENEB64 ${name} ${String(i).padStart(4, '0')} ${b64.slice(i * N, (i + 1) * N)}`);
}

async function run() {
  if (process.env.SCENE_GEN !== '1' || !config.keys.openrouter) return;
  const H = { Authorization: `Bearer ${config.keys.openrouter}`, 'HTTP-Referer': config.publicUrl || 'https://seekr.website', 'X-Title': 'wondr' };
  const dir = path.join(config.dataDir, 'scenegen'); fs.mkdirSync(dir, { recursive: true });
  try {
    const model = process.env.SCENE_MODEL || await pickModel(H);
    console.log('scenegen: using ' + model);
    const day = await gen(H, model, DAY); fs.writeFileSync(path.join(dir, 'day.txt'), day); dump('day', day);
    const night = await gen(H, model, NIGHT, day); fs.writeFileSync(path.join(dir, 'night.txt'), night); dump('night', night);
    console.log('scenegen: done');
  } catch (e) { console.log('scenegen failed: ' + e.message); }
}
module.exports = { run };
