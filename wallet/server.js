/* Serves Quiver as a static site.
 *
 * A wallet is a page that handles private keys, so the server is not just a
 * `readFile`: the headers below are part of the product's security. The most
 * important is the CSP — script-src 'self' means no outside script can run on
 * this page even if someone manages to inject a tag, which is exactly how keys
 * get stolen. That is why ethers is vendored in public/vendor, not on a CDN. */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'public');
const PORT = process.env.PORT || 8080;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

/* connect-src has to allow https: because the user can point at any RPC node
   from Settings; localhost is in there for anyone running their own node on the
   same machine. Everything else stays shut. */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src https: http://localhost:* http://127.0.0.1:*",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "object-src 'none'"
].join('; ');

const SECURITY = {
  'content-security-policy': CSP,
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin'
};

http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET, HEAD' }).end();
    return;
  }

  let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  /* /app is the wallet and / is the landing page. The wallet gets its own clean
     path because payment links are built on it and end up pasted into chats and
     invoices, where a ".html" is just noise. */
  if (rel === '/app' || rel === '/app/') rel = '/app.html';
  else if (rel === '/' || rel.endsWith('/')) rel += 'index.html';

  const file = path.join(ROOT, path.normalize(rel));
  if (!file.startsWith(ROOT + path.sep) && file !== ROOT) {
    res.writeHead(403, SECURITY).end('Forbidden');
    return;
  }

  fs.readFile(file, (err, body) => {
    if (err) {
      /* An unknown path returns the app: payment links live in the hash, but
         this way a hand-typed /pay does not break either. */
      fs.readFile(path.join(ROOT, 'index.html'), (e2, home) => {
        if (e2) { res.writeHead(404, SECURITY).end('404'); return; }
        res.writeHead(404, Object.assign({}, SECURITY, {
          'content-type': TYPES['.html'], 'cache-control': 'no-store'
        }));
        res.end(home);
      });
      return;
    }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, Object.assign({}, SECURITY, {
      'content-type': TYPES[ext] || 'application/octet-stream',
      /* HTML is never cached so a deploy lands immediately; ethers is frozen at
         one version and can be cached freely. */
      'cache-control': ext === '.html' ? 'no-store' : 'public, max-age=86400'
    }));
    res.end(req.method === 'HEAD' ? undefined : body);
  });
}).listen(PORT, () => console.log(`Quiver listening on :${PORT}`));
