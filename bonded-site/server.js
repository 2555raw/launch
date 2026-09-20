/* Serves the LilyPad site as static files.
 *
 * No dependencies: read the file off disk, hand it back with the right content
 * type, send index.html for the root and answer /health for Railway. Railway
 * sets PORT; 8080 is what its generated domain points at when it does not. */
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
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

http.createServer((req, res) => {
  let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (rel === '/health') { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('ok'); return; }
  if (rel === '/' || rel.endsWith('/')) rel += 'index.html';
  /* /board and /launch without the extension */
  if (!path.extname(rel)) rel += '.html';

  const file = path.join(ROOT, path.normalize(rel));
  if (!file.startsWith(ROOT)) { res.writeHead(403).end('Forbidden'); return; }

  fs.readFile(file, (err, body) => {
    if (err) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('404 — nothing on this pad');
      return;
    }
    if (path.extname(file) === '.html') {
      /* share cards need absolute URLs, and a pair page should be titled after its coin */
      const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
      const proto = req.headers['x-forwarded-proto'] || 'https';
      let html = body.toString('utf8').replace(/content="\/og\.png"/g, `content="${proto}://${host}/og.png"`);
      const t = new URL(req.url, 'http://x').searchParams.get('t');
      if (path.basename(file) === 'pair.html' && t && /^[A-Za-z0-9]{1,12}$/.test(t)) {
        const ticker = t.toUpperCase();
        const title = `$${ticker} on LilyPad`;
        const desc = `Trade $${ticker}, a coin paired with a tokenized stock on Robinhood Chain.`;
        html = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
          .replace(/(property="og:title" content=")[^"]*/, `$1${title}`).replace(/(name="twitter:title" content=")[^"]*/, `$1${title}`)
          .replace(/(property="og:description" content=")[^"]*/, `$1${desc}`).replace(/(name="twitter:description" content=")[^"]*/, `$1${desc}`);
      }
      body = Buffer.from(html, 'utf8');
    }
    res.writeHead(200, {
      'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      /* the page, its styles and its script are revalidated on every load, so a
         deploy is live the moment it lands; pictures and fonts keep their cache */
      'cache-control': ['.html', '.css', '.js'].includes(path.extname(file)) ? 'no-cache' : 'public, max-age=3600'
    });
    res.end(body);
  });
}).listen(PORT, () => console.log(`LilyPad on :${PORT}`));
