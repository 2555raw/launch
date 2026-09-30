/* Serves Yuelong as a static site.
 *
 * No dependencies: read the file off disk, send it with the right content type,
 * index.html for the root, and a /health endpoint for Railway's healthcheck.
 * Railway sets PORT; 8080 is the fallback its generated domain points at. */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = process.env.PORT || 8080;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

/* only what the site needs is public: not the server, the README or the painting sources */
const PRIVATE = /^\/(server\.js|package\.json|README\.md|assets\/src\/)/;

http.createServer((req, res) => {
  let rel;
  try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); }
  catch (_) { res.writeHead(400).end('Bad request'); return; }

  if (rel === '/health') { res.writeHead(200, { 'content-type': 'text/plain' }).end('ok'); return; }
  if (rel === '/' || rel.endsWith('/')) rel += 'index.html';
  if (PRIVATE.test(rel)) { res.writeHead(404).end('Not found'); return; }

  /* keep the request inside the directory, whatever it asks for */
  const file = path.join(ROOT, path.normalize(rel));
  if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403).end('Forbidden'); return; }

  fs.readFile(file, (err, body) => {
    if (err) {
      fs.readFile(path.join(ROOT, 'index.html'), (e2, home) => {
        res.writeHead(e2 ? 404 : 404, { 'content-type': 'text/html; charset=utf-8' });
        res.end(e2 ? 'Not found' : home);
      });
      return;
    }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'content-type': TYPES[ext] || 'application/octet-stream',
      'cache-control': ext === '.html' ? 'no-cache' : ext === '.woff2' ? 'public, max-age=31536000, immutable' : 'public, max-age=3600',
      'x-content-type-options': 'nosniff'
    });
    res.end(body);
  });
}).listen(PORT, () => console.log(`Yuelong on :${PORT}`));
