/* A small JSON store. One file, written through a short debounce, loaded once
 * at start. Collections are plain objects keyed by id. Enough for accounts,
 * chats, deposits and library items; swap for a database when the file gets
 * big (every access goes through get/put/del/all, so it is one module). */
const fs = require('fs');
const path = require('path');
const config = require('./config');

const FILE = path.join(config.dataDir, 'seekr.json');
const COLLECTIONS = ['accounts', 'chats', 'library', 'files', 'deposits', 'nonces', 'shares', 'usage', 'codes'];

let db = null;
let timer = null;

function load() {
  if (db) return db;
  try {
    db = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    db = {};
  }
  for (const c of COLLECTIONS) db[c] = db[c] || {};
  return db;
}

function flush() {
  timer = null;
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, FILE);
  } catch (e) {
    console.error('store: could not write', e.message);
  }
}

function save() {
  if (!timer) timer = setTimeout(flush, 250);
}

module.exports = {
  get(col, id) { return load()[col][id] || null; },
  put(col, id, value) { load()[col][id] = value; save(); return value; },
  del(col, id) { delete load()[col][id]; save(); },
  all(col) { return Object.values(load()[col]); },
  find(col, pred) { return Object.values(load()[col]).filter(pred); },
  flushNow: flush
};

process.on('SIGTERM', () => { if (timer) flush(); process.exit(0); });
process.on('SIGINT', () => { if (timer) flush(); process.exit(0); });
