/* Serves Meadow as a static site.
 *
 * Everything that moves money happens in the visitor's browser and wallet: quotes
 * are read from the Robinhood Chain RPC and swaps are signed by the wallet, so
 * this server only hands out files. Railway sets PORT; 8080 is the fallback its
 * generated domain points at. */
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
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

/* scripts/ and server files stay private; only the page and its assets are served */
const PRIVATE = /^\/(scripts|node_modules)\/|^\/(server\.js|package\.json|README\.md)$/;

http.createServer((req, res) => {
  let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (rel === '/' || rel.endsWith('/')) rel += 'index.html';

  const file = path.join(ROOT, path.normalize(rel));
  if (!file.startsWith(ROOT + path.sep) || PRIVATE.test(rel)) {
    res.writeHead(404).end('Not found');
    return;
  }

  fs.readFile(file, (err, body) => {
    if (err) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('404 — nothing here');
      return;
    }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'content-type': TYPES[ext] || 'application/octet-stream',
      'cache-control': ext === '.html' || file.endsWith('tokens.js') || file.endsWith('app.js') ? 'no-cache' : 'public, max-age=86400',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin',
      'x-frame-options': 'DENY'
    });
    res.end(body);
  });
}).listen(PORT, () => console.log(`Meadow on :${PORT}`));
