# Obscura — site

Landing page, console and verifier for **Obscura**, private bonds cloaked in the browser.
White, quiet design: ink on paper, one blue accent for anything live or verified.

No build step, no dependencies. Plain HTML, CSS and ES modules.

## Structure

```
index.html      landing: hero, the leak, what you hold, how it works (live demo), $OBX, closing, footer
console.html    the app: Cloak, Vault, Transfer, Receive
verify.html     paste a receipt, get one bit back
styles.css      design system and responsive rules
js/obscura.js   the crypto core (Web Crypto API, also runs in Node)
js/site.js      nav drawer, active section, scroll reveal, toast, copy
js/home.js      hero hash ticker and the cloak demo
js/console.js   console state (localStorage) and the four tabs
test/           node:test suite for the crypto core
```

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
- **Anchor** (optional) — with an injected EVM wallet, sends a 0-value transaction to yourself with
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
