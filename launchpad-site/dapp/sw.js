/* Sol Bite service worker: the page itself is always fetched from the network
   (falling back to the last copy when offline), photos, logos and icons are
   cached after first use, and the API is never cached. */
const VERSION = 'solbite-v2';
const SHELL = ['/', '/icons/icon-192.png', '/manifest.webmanifest'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url); if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname === '/sw.js' || url.pathname.startsWith('/admin')) return;
  const isAsset = /^\/(photos|logos|icons|uploads)\//.test(url.pathname);
  if (isAsset) { e.respondWith(caches.open(VERSION).then(async (c) => { const hit = await c.match(req); if (hit) return hit; const r = await fetch(req); if (r.ok) c.put(req, r.clone()); return r; })); return; }
  // pages: network first, cache as fallback (offline shows the last page you had, with your saved gift cards)
  e.respondWith(caches.open(VERSION).then(async (c) => { try { const r = await fetch(req); if (r.ok && (req.mode === 'navigate' || url.pathname === '/')) c.put(req, r.clone()); return r; } catch { return (await c.match(req)) || (await c.match('/')) || Response.error(); } }));
});
