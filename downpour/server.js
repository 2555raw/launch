/* Serves the built site (dist/) as a single-page app.
 *
 * Files are read off disk with the right content type; any path that is not a
 * file gets index.html so /board, /coin/0x… and the rest work on a reload.
 * Hashed assets are cached for a year, index.html never. Railway sets PORT; 8080
 * is what its generated domain points at when it does not. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');
const PORT = process.env.PORT || 8080;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
};

function send(res, file, status = 200) {
  fs.readFile(file, (err, body) => {
    if (err) {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' }).end('Could not read the site. Run npm run build first.');
      return;
    }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(status, {
      'content-type': TYPES[ext] || 'application/octet-stream',
      'cache-control': file.includes(`${path.sep}assets${path.sep}`)
        ? 'public, max-age=31536000, immutable'
        : file.includes(`${path.sep}earth${path.sep}`)
          ? 'public, max-age=86400'
          : 'no-cache',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin',
    });
    res.end(body);
  });
}

http
  .createServer((req, res) => {
    let rel;
    try {
      rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    } catch {
      res.writeHead(400).end('Bad request');
      return;
    }
    const file = path.join(ROOT, path.normalize(rel));
    if (!file.startsWith(ROOT)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    fs.stat(file, (err, st) => {
      if (!err && st.isFile()) return send(res, file);
      // a missing asset is a real 404; anything else is a page of the app
      if (path.extname(rel)) {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found');
        return;
      }
      send(res, path.join(ROOT, 'index.html'));
    });
  })
  .listen(PORT, () => console.log(`Starmint on :${PORT}`));
