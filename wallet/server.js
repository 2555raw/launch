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
const crypto = require('crypto');

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
  /* https: rather than 'self' because the launched-coins list shows each coin's
     own picture, and that URL is chosen by whoever launched it. It is the one
     place this site loads something from a host it does not control, and the
     storage notice says so rather than claiming otherwise. */
  "img-src 'self' data: https:",
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

const stampCache = new Map();
function versionOf(name) {
  const full = path.join(ROOT, name);
  let st;
  try { st = fs.statSync(full); } catch { return null; }
  const key = name + ':' + st.mtimeMs + ':' + st.size;
  if (stampCache.has(key)) return stampCache.get(key);
  let v = null;
  try {
    v = crypto.createHash('sha1').update(fs.readFileSync(full)).digest('hex').slice(0, 10);
  } catch { /* unreadable: leave the reference alone */ }
  stampCache.clear();          // one entry is all that is ever wanted per file
  stampCache.set(key, v);
  return v;
}

/* Rewrites src="app.js" to src="app.js?v=<hash>" for local files only. Anything
   already carrying a query, and anything absolute, is left as it is. */
function stamp(html) {
  return html.replace(/\b(src|href)="([A-Za-z0-9._\/-]+\.(?:js|css))"/g, (whole, attr, name) => {
    const v = versionOf(name);
    return v ? `${attr}="${name}?v=${v}"` : whole;
  });
}

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
  /* The money-in page. It is not linked from anywhere and it holds nothing
     until an address is typed into it, but it should still never turn up in a
     search result, so it is served with noindex below. */
  else if (rel === '/dev' || rel === '/dev/') rel = '/dev.html';
  else if (rel === '/' || rel.endsWith('/')) rel += 'index.html';
  const unlisted = rel === '/dev.html';

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
    /* Revalidation asks the browser to check; it does not force it to, and a
       browser that answers from its own cache anyway ends up running yesterday's
       script against today's markup — a button that is drawn but has nothing
       listening to it. The HTML is never cached, so stamping each local script
       and stylesheet with a hash of its own contents settles it: a changed file
       changes its URL, and the old URL is simply not asked for any more. */
    if (ext === '.html') body = Buffer.from(stamp(body.toString('utf8')), 'utf8');
    /* Caching, learnt the hard way: a long max-age on the stylesheet meant a
       deploy shipped new HTML to browsers still holding yesterday's CSS, and the
       page rendered half-styled for a day. Only /vendor is safe to freeze — it
       is pinned to one library version and never edited in place. Everything
       else revalidates, which costs one cheap 304 and can never go stale. */
    const frozen = rel.startsWith('/vendor/');
    const etag = '"' + crypto.createHash('sha1').update(body).digest('base64').slice(0, 22) + '"';

    if (!frozen && req.headers['if-none-match'] === etag) {
      res.writeHead(304, Object.assign({}, SECURITY, { etag, 'cache-control': 'no-cache' }));
      res.end();
      return;
    }

    res.writeHead(200, Object.assign({}, SECURITY, {
      'content-type': TYPES[ext] || 'application/octet-stream',
      etag,
      'cache-control': ext === '.html' ? 'no-store'
        : frozen ? 'public, max-age=31536000, immutable'
        : 'no-cache'
    }, unlisted ? { 'x-robots-tag': 'noindex, nofollow, noarchive' } : null));
    res.end(req.method === 'HEAD' ? undefined : body);
  });
}).listen(PORT, () => console.log(`Ward listening on :${PORT}`));
