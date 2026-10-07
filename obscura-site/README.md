# Obscura — site

Landing page, console and verifier for **Obscura**, private bonds cloaked in the browser.
White, quiet design: ink on paper, one blue accent for anything live or verified.

No build step, no dependencies. Plain HTML, CSS and ES modules.

## Structure

```
index.html      landing: hero (vault drawing + live receipt), wallets, the leak, films, demo,
                deposit-box band, $OBX, FAQ, closing, footer
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
js/console.js   console state (localStorage), the four tabs, wallet-backed sealing, backups
js/proof.js     proof of funds: read balance, sign, verify signature and balance onchain
js/share.js     proof link and QR code
js/verify.js    the verify page
assets/         fonts, drawings (img/*.svg), wallet logos, films (mp4 + webm + poster)
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

- Drawings: made for this site as SVG (`assets/img/vault.svg`, inlined in the hero so it can animate, and `assets/img/boxes.svg`).
- Vendored: `assets/vendor/ethers.min.js` (ethers 6.17, MIT) to check signatures, `assets/vendor/qrcode.mjs`
  (qrcode-generator 2.0.4, MIT) for QR codes.
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
- **Back it with a wallet** — the console reads the connected wallet's balance of the native coin
  (ETH, POL, BNB) or a listed token (USDC, USDT, DAI, WETH, WBTC) on Ethereum, Base, Arbitrum,
  Optimism, Polygon or BNB Chain mainnet (Sepolia is offered as a test network, and proofs from it are
  marked as testnet). The console can ask the wallet to switch network. The wallet signs a
  plain-text statement naming the bond, the address, the chain, the block and the amount
  (`js/proof.js`). The verifier recovers the signer and asks a public node for that address's
  balance at that exact block. The verifier also checks that the bond names the coin or token and the
  chain the wallet signed for.
- **Share** — a proof link (`verify.html#obx1_…`) and its QR code. The receipt rides after the `#`,
  which browsers never send to a server; opening the link verifies on the reader's device.
- **Expiry** — a bond can carry a validity date (1 hour to 30 days). It is hashed with the asset and named in
  the wallet's signed statement, so it cannot be extended; Verify shows an expired proof as expired.
- **Link previews** — Open Graph and Twitter cards (`assets/og-home.jpg`, `assets/og-verify.jpg`, drawn from
  `tools/og.html` by `tools/render-og.mjs`). `server.js` fills in `__ORIGIN__` with the address each request
  arrived on, so previews keep working on any domain.
- **Backup** — the vault exports as an `obxbak1_…` file sealed with AES-256-GCM under a passphrase;
  the console reminds the holder while any bond is not in a backup.
- **Prove** — the verifier recomputes the hash and compares it to a commitment they expect.
  The answer is true or false.
- **Anchor** (optional) — with a connected EVM wallet on a supported mainnet, sends a 0-value
  transaction to yourself with the 32-byte seal code as calldata (`js/anchor.js`); you pay only the
  network fee. The console waits for the block and links the transaction on the chain's explorer.
  Proof links carry the anchor, and Verify looks the transaction up, checks that its data is exactly
  the seal code and that it succeeded, and shows the block and time.

Nothing is sent to a server. The token and the bond NFT contract are described on the landing page
but are not deployed, so the page shows no contract address.

## Live deploy

Served from Railway, project `protective-nature`, service `launch`, at
https://launch-production-c4cd.up.railway.app — source `2555raw/launch`, branch
`claude/keen-allen-lgtl9w`, root directory `/obscura-site`, start `node server.js`, healthcheck `/health`.
That service previously ran Propello (branch `claude/gifted-allen-3obxjy`, root `/propello-site`) with
no public domain; pointing the source and root back restores it.

Chain reads go to free public nodes listed per chain in `js/proof.js` (`CHAINS[*].rpcs`); each was
checked to keep full history and to accept requests from a browser page. They are tried in order, so a
busy node falls through to the next. If none can answer for the proof's block, Verify checks the
current balance and says so. Adding a paid node (Alchemy, Infura, QuickNode) to the front of a list
makes the checks faster and steadier under load.

## Run it

ES modules need to be served over HTTP (opening the file directly will not load them):

```bash
cd obscura-site
python3 -m http.server 8000     # then open http://localhost:8000
npm test                        # crypto core tests (Node 20+)
```

Deploy by dropping the folder on any static host (Netlify, Vercel, GitHub Pages, Cloudflare Pages).
