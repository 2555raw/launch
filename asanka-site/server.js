/* Serves the Asanka store and Asanka Pad as a static site.
 *
 * Plain files and no dependencies, so this is the whole server: read the file off
 * disk, send it back with the right content type, and serve index.html for the
 * root. Railway sets PORT; 8080 is what its generated domain points at otherwise. */
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
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

// the server itself and the package file are not part of the site
const HIDDEN = new Set(['/server.js', '/package.json']);

http.createServer((req, res) => {
  let rel;
  try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (_) { rel = '/'; }
  if (rel === '/' || rel.endsWith('/')) rel += 'index.html';
  if (rel === '/launchpad') rel = '/launchpad.html';

  /* keep the request inside the directory, whatever it asks for */
  const file = path.join(ROOT, path.normalize(rel));
  if (!file.startsWith(ROOT + path.sep) || HIDDEN.has(rel)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('404 — nothing here');
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
}).listen(PORT, () => console.log(`Asanka on :${PORT}`));
