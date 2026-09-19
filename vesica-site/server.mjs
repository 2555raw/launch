/* The static server behind vesica.site.

   No dependencies on purpose: the site is HTML, CSS and a handful of scripts,
   so the server that hands them over should be readable in one screen and
   should never need an install to boot.
*/

import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join, extname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.PORT) || 8080;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

/* Everything revalidates, nothing is trusted blind.

   This used to hold markup at `no-cache` and everything else for a day, on
   the reasoning that only the HTML changes between deploys. That was wrong
   twice over. The scripts and stylesheets are not content-addressed — there
   is no hash in `home.js` — so a deploy that changes one reaches nobody who
   has already visited until their day is up. Worse, fresh HTML then runs
   against a stale script, which is how a page half-updates.

   `no-cache` does not mean do not store it; it means ask first. Paired with
   an ETag the answer is usually a 304 with no body, so the bandwidth saving
   survives and the correctness comes back. */
const cacheFor = () => 'no-cache';

/* Weak, because it is derived from the file's size and mtime rather than its
   bytes: enough to tell two deploys apart without hashing every file on
   every request. */
const etagFor = st => `W/"${st.size.toString(36)}-${Math.floor(st.mtimeMs).toString(36)}"`;

async function resolve(urlPath) {
  // strip the query, decode, and refuse anything that climbs out of ROOT
  let p = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const full = normalize(join(ROOT, p));
  if (!full.startsWith(ROOT.endsWith(sep) ? ROOT : ROOT + sep)) return null;

  try {
    const s = await stat(full);
    if (s.isDirectory()) return resolve(p.replace(/\/?$/, '/'));
    return { full, size: s.size, etag: etagFor(s) };
  } catch {
    // a bare name is allowed to mean the page: /docs serves docs.html
    if (!extname(full)) {
      try {
        const alt = full + '.html';
        const s = await stat(alt);
        if (s.isFile()) return { full: alt, size: s.size, etag: etagFor(s) };
      } catch { /* falls through to the 404 */ }
    }
    return null;
  }
}

const server = createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'allow': 'GET, HEAD' });
    return res.end();
  }

  const hit = await resolve(req.url || '/');

  if (!hit) {
    const nf = await resolve('/404.html');
    res.writeHead(404, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-cache',
    });
    if (req.method === 'HEAD') return res.end();
    return nf ? createReadStream(nf.full).pipe(res) : res.end('Not found');
  }

  const ext = extname(hit.full).toLowerCase();

  // it already has this exact file: say so and send nothing
  if (req.headers['if-none-match'] === hit.etag) {
    res.writeHead(304, { 'etag': hit.etag, 'cache-control': cacheFor() });
    return res.end();
  }

  res.writeHead(200, {
    'content-type': TYPES[ext] || 'application/octet-stream',
    'content-length': hit.size,
    'cache-control': cacheFor(),
    'etag': hit.etag,
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
  });
  if (req.method === 'HEAD') return res.end();
  createReadStream(hit.full).pipe(res);
});

/* No host: Node then takes every interface it has, which is :: where IPv6
   exists and 0.0.0.0 where it does not. Naming '::' outright fails outright on
   a stack without it. */
server.listen(PORT, () => console.log(`vesica-site on :${PORT}`));
