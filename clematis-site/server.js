/* Serves Clematis: the static page, plus /api/stats (see market-stats.js).
 *
 * Everything that moves money happens in the visitor's browser and wallet: quotes
 * are read from the Robinhood Chain RPC and swaps are signed by the wallet, so
 * this server only hands out files. Railway sets PORT; 8080 is the fallback its
 * generated domain points at. */
const http = require('http');
const fs = require('fs');
const path = require('path');

const { startStats } = require('./market-stats');

const ROOT = __dirname;
/* 24h prices and volume, rebuilt from on-chain swaps every 10 minutes */
const stats = startStats(path.join(ROOT, 'tokens.js'));
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
const PRIVATE = /^\/(scripts|node_modules)\/|^\/(server\.js|market-stats\.js|package\.json|README\.md)$/;

http.createServer((req, res) => {
  let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);

  if (rel === '/api/stats') {
    const { data, error } = stats();
    res.writeHead(data ? 200 : 503, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=60'
    });
    res.end(JSON.stringify(data || { pending: true, error }));
    return;
  }
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
}).listen(PORT, () => console.log(`Clematis on :${PORT}`));
