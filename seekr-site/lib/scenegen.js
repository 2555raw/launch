/* One-off: generate the photographic tea-room scenes (day, then the same room at
 * night) with an OpenRouter image model. Each image is kept on the data volume,
 * a web-sized JPEG is made from it and served at /art/gen/<name>.jpg, and a small
 * thumbnail is printed to the log so it can be reviewed from outside. Runs only
 * when SCENE_GEN=1, and never generates an image that already exists. */
const fs = require('fs'); const path = require('path');
const jpeg = require('jpeg-js'); const { PNG } = require('pngjs');
const config = require('./config');

const DIR = path.join(config.dataDir, 'scenegen');
const DAY = 'Photorealistic interior architectural photograph, wide-angle, straight one-point perspective, camera at seated eye level. A traditional Chinese tea room in a wooden pavilion: dark polished wooden pillars and ceiling beams, a warm light wooden plank floor, carved wooden lattice sliding doors with rice paper along both side walls. The whole back wall is open: its sliding doors are pushed aside, framing a calm misty lake with Guilin karst mountains and green tea terraces in soft morning light. In the centre of the room stands a low dark rosewood tea table with a Yixing clay teapot, small white porcelain tea cups and a wooden tea tray, a faint wisp of steam. Serene, quiet, natural daylight, soft shadows, high detail, sharp, 16:9. No people, no text, no watermark.';
const NIGHT = 'Edit this photograph into the same room at night. Keep exactly the same room, camera position, framing, pillars, floor and table. Close all the lattice sliding doors on the back wall so the view is hidden: their rice paper glows faintly with cool blue moonlight, with the soft shadow of a tree branch on the paper. Remove the tea set from the table. Hang one round red Chinese paper lantern with gold caps and a red tassel just above the table, glowing warm orange, casting warm light on the table, the floor and the nearby wood; the rest of the room is dark and blue. Photorealistic, same style, 16:9. No people, no text.';

const decode = (buf) => (buf[0] === 0x89 ? PNG.sync.read(buf) : jpeg.decode(buf, { useTArray: true, maxMemoryUsageInMB: 1024 }));

/* area-average resize, good for shrinking */
function shrink(img, W) {
  const H = Math.round(img.height * W / img.width), out = Buffer.alloc(W * H * 4), sx = img.width / W, sy = img.height / H;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx)), y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
    let r = 0, g = 0, b = 0, n = 0;
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { const i = (yy * img.width + xx) * 4; r += img.data[i]; g += img.data[i + 1]; b += img.data[i + 2]; n++; }
    const o = (y * W + x) * 4; out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = 255;
  }
  return { width: W, height: H, data: out };
}

async function pickModel(H) {
  const r = await fetch('https://openrouter.ai/api/v1/models', { headers: H }); const j = await r.json();
  const img = (j.data || []).filter((m) => (m.architecture?.output_modalities || []).includes('image'));
  const m = img.find((x) => /gemini-3-pro-image$/.test(x.id)) || img.find((x) => /gemini.*image/.test(x.id)) || img[0];
  return m && m.id;
}

async function gen(H, model, text, imageUrl) {
  const content = [{ type: 'text', text }]; if (imageUrl) content.push({ type: 'image_url', image_url: { url: imageUrl } });
  const call = async (image_config) => {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { ...H, 'content-type': 'application/json' }, body: JSON.stringify({ model, messages: [{ role: 'user', content }], modalities: ['image', 'text'], image_config }) });
    const j = await r.json(); const url = j.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!url) throw new Error('no image: ' + JSON.stringify(j).slice(0, 300));
    return url;
  };
  try { return await call({ aspect_ratio: '16:9', image_size: '2K' }); } catch (e) { console.log('scenegen: retry without size (' + e.message.slice(0, 120) + ')'); return call({ aspect_ratio: '16:9' }); }
}

/* keep the original, make the web JPEG, print a thumbnail */
function keep(name, dataUrl) {
  const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
  const ext = buf[0] === 0x89 ? 'png' : 'jpg';
  fs.writeFileSync(path.join(DIR, `${name}.${ext}`), buf);
  return buf;
}
function publish(name, buf) {
  const img = decode(buf);
  const web = img.width > 2400 ? shrink(img, 2400) : img;
  fs.writeFileSync(path.join(DIR, `${name}-web.jpg`), jpeg.encode(web, 84).data);
  const th = jpeg.encode(shrink(img, 320), 62).data.toString('base64');
  const N = 6000, n = Math.ceil(th.length / N);
  console.log(`SCENEINFO ${name} ${img.width}x${img.height} ${buf.length} web ${fs.statSync(path.join(DIR, `${name}-web.jpg`)).size} thumb ${th.length}`);
  for (let i = 0; i < n; i++) console.log(`SCENETHUMB ${name} ${i + 1}/${n} ${th.slice(i * N, (i + 1) * N)}`);
}
const have = (name) => ['png', 'jpg'].map((e) => path.join(DIR, `${name}.${e}`)).find((f) => fs.existsSync(f));

async function run() {
  if (process.env.SCENE_GEN !== '1' || !config.keys.openrouter) return;
  fs.mkdirSync(DIR, { recursive: true });
  /* the first run saved data URLs; turn them into files */
  for (const w of ['day', 'night']) { const t = path.join(DIR, `${w}.txt`); if (fs.existsSync(t) && !have(`lite-${w}`)) keep(`lite-${w}`, fs.readFileSync(t, 'utf8')); }
  const H = { Authorization: `Bearer ${config.keys.openrouter}`, 'HTTP-Referer': config.publicUrl || 'https://seekr.website', 'X-Title': 'wondr' };
  try {
    const tag = process.env.SCENE_TAG || 'pro';
    if (!have(`${tag}-day`) || !have(`${tag}-night`)) {
      const model = process.env.SCENE_MODEL || await pickModel(H);
      console.log('scenegen: using ' + model);
      if (!have(`${tag}-day`)) keep(`${tag}-day`, await gen(H, model, DAY));
      if (!have(`${tag}-night`)) { const d = fs.readFileSync(have(`${tag}-day`)); keep(`${tag}-night`, await gen(H, model, NIGHT, `data:image/${d[0] === 0x89 ? 'png' : 'jpeg'};base64,${d.toString('base64')}`)); }
    }
    for (const f of fs.readdirSync(DIR)) { const m = f.match(/^([a-z0-9]+-(?:day|night))\.(png|jpg)$/); if (m) publish(m[1], fs.readFileSync(path.join(DIR, f))); }
    console.log('scenegen: done');
  } catch (e) { console.log('scenegen failed: ' + e.message); }
}

/* GET /art/gen/<name>.jpg */
function serve(name) {
  if (!/^[a-z0-9]+-(?:day|night)-web\.jpg$/.test(name)) return null;
  const f = path.join(DIR, name); return fs.existsSync(f) ? f : null;
}
module.exports = { run, serve };
