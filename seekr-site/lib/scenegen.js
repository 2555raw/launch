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
/* a second model looks at each generated photo and says what is in it, so it can be checked from the log */
async function describe(H, name, buf) {
  const f = path.join(DIR, `${name}.check.txt`); if (fs.existsSync(f)) { console.log(`SCENECHECK ${name}: ${fs.readFileSync(f, 'utf8')}`); return; }
  const url = `data:image/${buf[0] === 0x89 ? 'png' : 'jpeg'};base64,${buf.toString('base64')}`;
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { ...H, 'content-type': 'application/json' }, body: JSON.stringify({ model: process.env.SCENE_VISION || 'google/gemini-3.7-flash', messages: [{ role: 'user', content: [{ type: 'text', text: 'Look at this photo and answer in one short line each: 1) day or night; 2) are the sliding doors on the back wall open (showing the landscape) or closed; 3) what is on or above the table; 4) any text, watermark, warped geometry or other artifacts; 5) how realistic it looks from 1 to 10.' }, { type: 'image_url', image_url: { url } }] }] }) });
  const j = await r.json(); const t = (j.choices?.[0]?.message?.content || JSON.stringify(j).slice(0, 200)).replace(/\s+/g, ' ').trim();
  fs.writeFileSync(f, t); console.log(`SCENECHECK ${name}: ${t}`);
}
/* ---------- what is where in the photos, for the animated background (printed to the log) ---------- */
function grid(img, W, Hh, box = [0, 0, 1, 1]) {
  const [u0, v0, u1, v1] = box, X0 = u0 * img.width, Y0 = v0 * img.height, sx = (u1 - u0) * img.width / W, sy = (v1 - v0) * img.height / Hh, out = [];
  for (let y = 0; y < Hh; y++) { const row = []; for (let x = 0; x < W; x++) {
    let r = 0, g = 0, b = 0, n = 0;
    for (let yy = Math.floor(Y0 + y * sy); yy < Math.floor(Y0 + (y + 1) * sy); yy += 2) for (let xx = Math.floor(X0 + x * sx); xx < Math.floor(X0 + (x + 1) * sx); xx += 2) { const i = (yy * img.width + xx) * 4; r += img.data[i]; g += img.data[i + 1]; b += img.data[i + 2]; n++; }
    row.push([r / n, g / n, b / n]); } out.push(row); }
  return out;
}
const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
function ascii(tag, img, W, Hh, box) {
  const g = grid(img, W, Hh, box), L = g.flat().map(lum), lo = Math.min(...L), hi = Math.max(...L), ramp = ' .:-=+*#%@';
  console.log(`SCENEASCII ${tag} ${W}x${Hh} box ${box ? box.join(',') : 'full'} lum ${lo.toFixed(0)}..${hi.toFixed(0)}`);
  g.forEach((row, y) => console.log(`SCENEASCII ${tag} ${String(y).padStart(2, '0')} |${row.map((c) => ramp[Math.min(9, Math.floor((lum(c) - lo) / (hi - lo + 1e-6) * 10))]).join('')}|`));
}
/* luminance (0-99) and tint (b = blue, r = warm, n = neutral) along a row */
function line(tag, img, v, n = 150) {
  const y = Math.round(v * (img.height - 1)), cells = [];
  for (let k = 0; k < n; k++) { const x0 = Math.round((k + .5) / n * img.width); let r = 0, g = 0, b = 0, c = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const i = (Math.min(img.height - 1, Math.max(0, y + dy)) * img.width + Math.min(img.width - 1, Math.max(0, x0 + dx))) * 4; r += img.data[i]; g += img.data[i + 1]; b += img.data[i + 2]; c++; } r /= c; g /= c; b /= c; cells.push(String(Math.min(99, Math.round(lum([r, g, b]) / 2.56))).padStart(2, '0') + (b > r + 10 ? 'b' : r > b + 10 ? 'r' : 'n')); }
  console.log(`SCENELINE ${tag} v=${v} ${cells.join(' ')}`);
}
async function boxes(H, name, prompt) {
  const f = path.join(DIR, `${name}.boxes.json`); if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8');
  const url = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(DIR, `${name}-web.jpg`)).toString('base64');
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { ...H, 'content-type': 'application/json' }, body: JSON.stringify({ model: process.env.SCENE_VISION || 'google/gemini-3.7-flash', temperature: 0, messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url } }] }] }) });
  const j = await r.json(); const t = j.choices?.[0]?.message?.content || JSON.stringify(j).slice(0, 300); const m = t.match(/\{[\s\S]*\}/);
  const out = (m ? m[0] : t).replace(/\s+/g, ' '); fs.writeFileSync(f, out); return out;
}
const BOX = 'All values are integers from 0 to 1000, normalized to the image height (y) and width (x). Reply with JSON only, no markdown.';
async function analyze(H) {
  const dayF = have('pro-day'), nightF = have('pro-night'); if (!dayF || !nightF) return;
  console.log('SCENEBOXES day ' + await boxes(H, 'pro-day', 'Photo of a tea room by day. Detect these and return JSON: {"cups": [[ymin,xmin,ymax,xmax], ...] every small porcelain tea cup, "teapot": [ymin,xmin,ymax,xmax] the clay teapot with spout and handle, "spout_tip": [y,x] the opening at the tip of the teapot spout, "lid": [y,x] the top of the teapot lid, "tray": [ymin,xmin,ymax,xmax] the tea tray, "steam": [[ymin,xmin,ymax,xmax], ...] any visible steam}. ' + BOX));
  console.log('SCENEBOXES night ' + await boxes(H, 'pro-night', 'Photo of a tea room at night. Detect these and return JSON: {"lantern": [ymin,xmin,ymax,xmax] the red paper lantern including its gold caps and tassel, "cord_top": [y,x] where the lantern cord meets the ceiling or the top edge, "panels": [[ymin,xmin,ymax,xmax], ...] every glowing translucent paper panel of the sliding doors (the paper between the wooden frames) on the back wall and on the side walls, "shadow_area": [ymin,xmin,ymax,xmax] the area covered by tree branch shadows, "pillars": [[ymin,xmin,ymax,xmax], ...] the large wooden pillars, "table": [ymin,xmin,ymax,xmax]}. ' + BOX));
  const day = decode(fs.readFileSync(dayF)), night = decode(fs.readFileSync(nightF));
  ascii('night', night, 150, 42);
  for (const v of [0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75]) line('night', night, v);
  ascii('day-tea', day, 120, 40, [0.36, 0.58, 0.66, 0.84]);
  /* small JPEGs, printed once */
  const flag = path.join(DIR, 'peek.done');
  if (!fs.existsSync(flag)) {
    const peek = (tag, img, w, q) => { const b64 = jpeg.encode(shrink(img, w), q).data.toString('base64'), N = 6000, n = Math.ceil(b64.length / N); console.log(`SCENEPEEK ${tag} len ${b64.length} parts ${n}`); for (let i = 0; i < n; i++) console.log(`SCENEPEEK ${tag} ${i + 1}/${n} ${b64.slice(i * N, (i + 1) * N)}`); };
    peek('night', night, 480, 55);
    const crop = (img, [u0, v0, u1, v1]) => { const X0 = Math.round(u0 * img.width), Y0 = Math.round(v0 * img.height), w = Math.round((u1 - u0) * img.width), h = Math.round((v1 - v0) * img.height), d = Buffer.alloc(w * h * 4); for (let y = 0; y < h; y++) img.data.copy ? Buffer.from(img.data.buffer, img.data.byteOffset + ((Y0 + y) * img.width + X0) * 4, w * 4).copy(d, y * w * 4) : null; return { width: w, height: h, data: d }; };
    peek('day-tea', crop(day, [0.36, 0.58, 0.66, 0.84]), 412, 60);
    fs.writeFileSync(flag, '1');
  }
}
const have = (name) => ['png', 'jpg'].map((e) => path.join(DIR, `${name}.${e}`)).find((f) => fs.existsSync(f));

async function run() {
  if (process.env.SCENE_GEN !== '1' || !config.keys.openrouter) return;
  fs.mkdirSync(DIR, { recursive: true });
  /* the first run saved data URLs; turn them into files */
  for (const w of ['day', 'night']) { const t = path.join(DIR, `${w}.txt`); if (fs.existsSync(t) && !have(`lite-${w}`)) keep(`lite-${w}`, fs.readFileSync(t, 'utf8')); }
  const H = { Authorization: `Bearer ${config.keys.openrouter}`, 'HTTP-Referer': config.publicUrl || 'https://wondr.website', 'X-Title': 'wondr' };
  try {
    const tag = process.env.SCENE_TAG || 'pro';
    if (!have(`${tag}-day`) || !have(`${tag}-night`)) {
      const model = process.env.SCENE_MODEL || await pickModel(H);
      console.log('scenegen: using ' + model);
      if (!have(`${tag}-day`)) keep(`${tag}-day`, await gen(H, model, DAY));
      if (!have(`${tag}-night`)) { const d = fs.readFileSync(have(`${tag}-day`)); keep(`${tag}-night`, await gen(H, model, NIGHT, `data:image/${d[0] === 0x89 ? 'png' : 'jpeg'};base64,${d.toString('base64')}`)); }
    }
    for (const f of fs.readdirSync(DIR)) { const m = f.match(/^([a-z0-9]+-(?:day|night))\.(png|jpg)$/); if (!m) continue; const buf = fs.readFileSync(path.join(DIR, f)); if (!fs.existsSync(path.join(DIR, `${m[1]}-web.jpg`))) publish(m[1], buf); if (m[1].startsWith('pro-')) await describe(H, m[1], buf).catch((e) => console.log(`SCENECHECK ${m[1]} failed: ${e.message}`)); }
    await analyze(H).catch((e) => console.log('SCENEANALYSIS failed: ' + e.message));
    console.log('scenegen: done');
  } catch (e) { console.log('scenegen failed: ' + e.message); }
}

/* GET /art/gen/<name>.jpg */
function serve(name) {
  if (!/^[a-z0-9]+-(?:day|night)-web\.jpg$/.test(name)) return null;
  const f = path.join(DIR, name); if (fs.existsSync(f)) return f;
  /* the painted room stands in if the volume ever loses the photos */
  const fb = path.join(__dirname, '..', 'public', 'art', `room-${name.includes('-night-') ? 'night' : 'day'}.jpg`);
  return fs.existsSync(fb) ? fb : null;
}
module.exports = { run, serve };
