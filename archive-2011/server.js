/* Serves ARCHIVE 2011 as a static site.
 *
 * The piece is six files and no dependencies, so this is the whole server: read
 * the file off disk, hand it back with the right content type, and send
 * index.html for the root. Railway sets PORT; everything else is a default. */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = process.env.PORT || 3000;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

http.createServer((req, res) => {
  let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (rel === '/' || rel.endsWith('/')) rel += 'index.html';

  /* keep the request inside the directory, whatever it asks for */
  const file = path.join(ROOT, path.normalize(rel));
  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.readFile(file, (err, body) => {
    if (err) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('404 — nothing here');
      return;
    }
    res.writeHead(200, {
      'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'cache-control': path.extname(file) === '.html' ? 'no-cache' : 'public, max-age=3600'
    });
    res.end(body);
  });
}).listen(PORT, () => console.log(`ARCHIVE 2011 on :${PORT}`));
