/* Serves Spinpad as a static site.
 *
 * Four files and no dependencies, so this is the whole server: read the file
 * off disk, hand it back with the right content type, and send index.html for
 * the root. Railway sets PORT; everything else is a default. Same shape as the
 * server in archive-2011/, because the job is the same. */
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
/* Railway passes PORT in; 8080 is what its generated domain points at when it
   does not, so that is the fallback rather than the usual 3000. */
const PORT = process.env.PORT || 8080;

/* The three files the page is made of have to be current or the page is wrong;
   everything else is content that may as well sit in the cache for a few
   minutes. */
const PAGE = new Set(['.html', '.css', '.js']);
const cacheFor = (ext) => (PAGE.has(ext) ? 'no-cache' : 'public, max-age=300');

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

const bad = (res, code, msg) => {
  res.writeHead(code, { 'content-type': 'text/plain; charset=utf-8' });
  res.end(msg);
};

http.createServer((req, res) => {
  /* Two ways a request can throw synchronously and take the process with it:
     a malformed escape (/%) makes decodeURIComponent throw URIError, and a NUL
     byte makes fs.readFile throw rather than call back, so the 404 branch below
     never runs. Both are a plain bad request, not a crash. */
  let rel;
  try {
    rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  } catch (e) {
    bad(res, 400, '400 — bad path');
    return;
  }
  if (rel.includes('\0')) {
    bad(res, 400, '400 — bad path');
    return;
  }
  if (rel === '/' || rel.endsWith('/')) rel += 'index.html';

  /* Keep the request inside the directory, whatever it asks for.
     The separator matters: a bare startsWith(ROOT) also accepts a sibling
     directory whose name merely begins with it. Nothing can reach that today —
     pathname always starts with a slash, so normalize() eats the ..  before
     join() ever runs — but the guard should hold on its own rather than because
     of how its input happens to be built. */
  const file = path.resolve(ROOT, '.' + path.normalize(rel));
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) {
    bad(res, 403, '403 — forbidden');
    return;
  }

  fs.readFile(file, (err, body) => {
    if (err) {
      bad(res, 404, '404 — nothing here');
      return;
    }

    /* Every file gets an ETag off its own bytes, and the page's own three files
       revalidate rather than sit in the browser for an hour.
       
       They used to be `max-age=3600` while index.html was `no-cache`, which is
       the worst of both: a redeploy changed all three, the browser fetched the
       new HTML and kept the old stylesheet and the old script for up to an
       hour. The page that came back was the new markup wearing the previous
       release's CSS — a redesign that had shipped and could not be seen.

       Revalidating is not the same as not caching. The browser still asks, but
       an unchanged file comes back as a 304 with no body. Logos keep five
       minutes because there are sixteen of them and they change rarely, and an
       ETag still catches one that has been replaced. */
    const ext = path.extname(file).toLowerCase();
    const etag = '"' + crypto.createHash('sha1').update(body).digest('base64').slice(0, 22) + '"';
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, { etag, 'cache-control': cacheFor(ext) });
      res.end();
      return;
    }
    res.writeHead(200, {
      'content-type': TYPES[ext] || 'application/octet-stream',
      'cache-control': cacheFor(ext),
      etag
    });
    res.end(body);
  });
}).listen(PORT, () => console.log(`Spinpad on :${PORT}`));
