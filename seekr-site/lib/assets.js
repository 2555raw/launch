/* Generated files (images, clips, audio, uploads) live on disk under
 * DATA_DIR/assets and are served at /assets/<id>. The JSON store only holds
 * the reference. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');

const DIR = path.join(config.dataDir, 'assets');
const EXT = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/svg+xml': '.svg', 'video/mp4': '.mp4', 'video/webm': '.webm', 'audio/mpeg': '.mp3', 'audio/wav': '.wav', 'audio/webm': '.webm', 'audio/mp4': '.m4a', 'text/plain': '.txt', 'application/pdf': '.pdf', 'application/json': '.json' };
const MIME = Object.fromEntries(Object.entries(EXT).map(([m, e]) => [e, m]));

function save(buffer, mime) {
  fs.mkdirSync(DIR, { recursive: true });
  const id = crypto.randomBytes(9).toString('base64url') + (EXT[mime] || '');
  fs.writeFileSync(path.join(DIR, id), buffer);
  return { id, url: '/assets/' + id, mime, bytes: buffer.length };
}

async function saveFromUrl(url, headers = {}) {
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`Could not fetch generated file (${r.status})`);
  const mime = (r.headers.get('content-type') || 'application/octet-stream').split(';')[0];
  return save(Buffer.from(await r.arrayBuffer()), mime);
}

function resolve(id) {
  const safe = path.basename(id);
  const file = path.join(DIR, safe);
  if (!fs.existsSync(file)) return null;
  return { file, mime: MIME[path.extname(safe)] || 'application/octet-stream' };
}

module.exports = { save, saveFromUrl, resolve, DIR };
