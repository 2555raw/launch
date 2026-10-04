# Obscura — site

Landing page, console and verifier for **Obscura**, private bonds cloaked in the browser.
White, quiet design: ink on paper, one blue accent for anything live or verified.

No build step, no dependencies. Plain HTML, CSS and ES modules.

## Structure

```
index.html      landing: hero (vault photo + live receipt), wallets, the leak, films, demo,
                photo band, $OBX, FAQ, closing, footer
console.html    the app: Cloak, Vault, Transfer, Receive
verify.html     paste a receipt, get one bit back
terms.html      Terms of Use and Privacy (template: have a lawyer review it)
declined.html   where Decline on the terms gate leads
styles.css      design system: Host Grotesk + JetBrains Mono (self-hosted), paper/steel/ink, one blue
js/obscura.js   the crypto core (Web Crypto API, also runs in Node)
js/terms.js     terms gate shown on first visit; acceptance remembered per browser
js/wallet.js    wallet connection: EIP-6963 discovery, real logos, install links, mobile deep links
js/site.js      nav, scroll reveal, toast, copy
js/home.js      live hero receipt, film player with chapters, cloak demo
js/console.js   console state (localStorage) and the four tabs
assets/         fonts, photos, wallet logos, films (mp4 + webm + poster)
tools/          scenes.html (film source) and render-videos.mjs (renders the films)
test/           node:test suite for the crypto core
```

## Things to replace before launch

- Product name and ticker: "Obscura" and "$OBX" are placeholders.
- X link: points to https://x.com until an account exists (nav and footer, every page).
- terms.html is a template.

## Films

The three explainer films are authored as an HTML scene (`tools/scenes.html`) where every frame
is a function of time, then rendered at 30 fps and encoded to H.264 MP4 and VP9 WebM:

```bash
npm i -D playwright
python3 -m http.server 8765 &
node tools/render-videos.mjs            # needs ffmpeg with libx264 and libvpx
```

Edit the captions or timings in `scenes.html` and re-run to regenerate.

## Credits

- Photos: public domain, no attribution required (source recorded inside each image file).
- Wallet logos are the wallets' own marks (taken from RainbowKit, MIT), shown only as connection options.
- Fonts: Host Grotesk and JetBrains Mono, SIL Open Font License.

## The tech

- **Cloak** — `commitment = SHA-256(canonical asset JSON || salt[16] || key[32])`, with a fresh
  random salt and key per bond. The receipt (asset, salt, key, commitment) is encoded as `obx1_…`.
- **Hold** — receipts live in `localStorage` (`obscura.vault.v1`). Export / import a JSON backup.
- **Transfer** — the receipt is sealed with AES-256-GCM under a key from PBKDF2-SHA-256
  (310,000 rounds, random salt) into an `obxpkg1_…` package. The sender's bond is marked as sent.
- **Receive** — opens the package, checks the receipt inside, then re-cloaks the asset under a
  new salt and key; the new bond records the commitment it replaces.
- **Prove** — the verifier recomputes the hash and compares it to a commitment they expect.
  The answer is true or false.
- **Anchor** (optional) — with a connected EVM wallet, sends a 0-value transaction to yourself with
  the 32-byte commitment as calldata.

Nothing is sent to a server. The token and the bond NFT contract are described on the landing page
but are not deployed, so the page shows no contract address.

## Run it

ES modules need to be served over HTTP (opening the file directly will not load them):

```bash
cd obscura-site
python3 -m http.server 8000     # then open http://localhost:8000
npm test                        # crypto core tests (Node 20+)
```

Deploy by dropping the folder on any static host (Netlify, Vercel, GitHub Pages, Cloudflare Pages).
