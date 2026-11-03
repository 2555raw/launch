/* Serves the Almoner landing page. No dependencies.
 *   PORT   Railway sets it; 8080 otherwise */
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = __dirname;
const PORT = process.env.PORT || 8080;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8'
};
const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.json', '.svg', '.txt']);
// Only the page and its images are public, never the server or package files.
const PRIVATE = /^\/(server\.js|package(-lock)?\.json|README\.md|node_modules)/;

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', ...headers });
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
  let rel;
  try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (_) { rel = '/'; }
  if (rel === '/healthz') return send(res, 200, '{"ok":true}', { 'content-type': 'application/json' });
  if (rel === '/' || rel.endsWith('/')) rel += 'index.html';
  if (PRIVATE.test(rel) || rel.split('/').some((p) => p.startsWith('.'))) return send(res, 404, 'Not found');

  const file = path.join(ROOT, path.normalize(rel));
  if (!file.startsWith(ROOT + path.sep)) return send(res, 403, 'Forbidden');

  fs.readFile(file, (err, body) => {
    // Unknown page paths fall back to the landing page so shared links never dead-end.
    if (err) {
      if (path.extname(rel)) return send(res, 404, 'Not found');
      return fs.readFile(path.join(ROOT, 'index.html'), (e2, html) => (e2 ? send(res, 404, 'Not found') : reply('.html', html)));
    }
    reply(path.extname(file).toLowerCase(), body);
  });

  function reply(ext, body) {
    const headers = {
      'content-type': TYPES[ext] || 'application/octet-stream',
      'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=86400',
      'x-content-type-options': 'nosniff'
    };
    const acc = String(req.headers['accept-encoding'] || '');
    if (COMPRESSIBLE.has(ext) && body.length > 1024 && /\b(br|gzip)\b/.test(acc)) {
      const br = /\bbr\b/.test(acc);
      body = br ? zlib.brotliCompressSync(body) : zlib.gzipSync(body);
      headers['content-encoding'] = br ? 'br' : 'gzip';
      headers.vary = 'Accept-Encoding';
    }
    headers['content-length'] = body.length;
    res.writeHead(200, headers);
    res.end(req.method === 'HEAD' ? undefined : body);
  }
});

server.listen(PORT, () => console.log(`Almoner on :${PORT}`));

// Railway stops the old container with SIGTERM on every redeploy: close cleanly so it is not reported as a crash.
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => {
  server.close(() => process.exit(0));
  if (server.closeIdleConnections) server.closeIdleConnections();
  setTimeout(() => process.exit(0), 3000).unref();
});
