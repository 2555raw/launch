// Offline support: the app's own files are kept on the device so the console,
// the vault and the verify page open without a connection. Everything is
// fetched fresh when online, so a new release never mixes with old files; the
// saved copy is used only when the network fails. Chain reads and the films
// are never cached. server.js stamps each release into the cache name.
const CACHE = "obscura-__BUILD__";
const CORE = [
  "./", "index.html", "console.html", "verify.html", "terms.html", "declined.html",
  "styles.css", "manifest.webmanifest",
  "js/site.js", "js/terms.js", "js/wallet.js", "js/home.js", "js/console.js", "js/verify.js",
  "js/obscura.js", "js/proof.js", "js/kinds.js", "js/solana.js", "js/check.js", "js/anchor.js",
  "js/share.js", "js/card.js", "js/mark.js",
  "assets/vendor/ethers.min.js", "assets/vendor/qrcode.mjs", "assets/vendor/noble-ed25519.mjs",
  "assets/fonts/host-grotesk-latin.woff2", "assets/fonts/jetbrains-mono-latin.woff2",
  "assets/favicon.svg", "assets/logo.svg", "assets/icons/icon-192.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.includes("/assets/video/") || req.headers.has("range")) return;

  e.respondWith(fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true })
    .then((hit) => hit || (req.mode === "navigate" ? caches.match("index.html") : Response.error()))));
});
