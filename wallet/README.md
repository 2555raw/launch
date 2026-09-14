# Quiver — self-custody wallet

A wallet that lives entirely in the browser of whoever opens it. The key is
generated there, encrypted there and signed there; the server only ever hands
out static files and never sees a secret. Payments go to real EVM chains and
settle for real.

## What it does

- **Create a wallet** — a 12-word BIP-39 phrase generated with
  `crypto.getRandomValues`, with three words checked back before you can go on.
- **Import** — a 12/24-word phrase, or a private key.
- **Encrypted on disk** — a standard keystore JSON (scrypt + AES-128-CTR) in
  `localStorage`. Neither the phrase nor the key is ever stored in the clear.
- **Pay** — the network coin and ERC-20s (USDC/USDT), with a fee estimate, a
  review screen, and the receipt followed on chain.
- **Top up from another wallet** — MetaMask, Coinbase Wallet, Phantom, Rainbow
  or anything else installed, discovered over **EIP-6963**. Quiver never sees
  that wallet's keys; it asks, the other wallet signs.
- **Receive** — address and an `ethereum:` QR carrying the chain id.
- **Request** — a link (and QR) that opens the payer's app with the payment
  already filled in.
- **Networks** — Base, Polygon, Arbitrum, Optimism, Ethereum, plus two test
  chains. A custom RPC can be set per network.
- **Auto-lock** after five minutes idle.

## Plans

Classic is free and always will be: self-custody, every network, unlimited
payments. Gold ($3/month) and Platinum ($9/month) add software features — card
face, saved payees, named payment requests, CSV export, and on Platinum several
accounts derived from the same phrase.

A month is **one USDC transfer on chain** to the address in `TREASURY`
(`public/app.js`, top of the file). Set it to an address you control; until you
do, the upgrade buttons say so rather than pretending to charge.

Nothing auto-renews and no card is stored. The entitlement is proved by the
transaction itself: on every unlock the stored hash is re-fetched and its
Transfer log checked for sender, recipient and amount, so a plan cannot be
granted by editing `localStorage` — only by a payment that actually happened.

The perks are deliberately things the software can deliver. A paid tier here
never raises a limit, unlocks your own money, or buys priority on a network:
none of that would be ours to sell.

## Security decisions

- **ethers is vendored** in `public/vendor`, not loaded from a CDN. A
  third-party script on a page that handles private keys is an open door:
  whoever controls the CDN controls the keys.
- **CSP with `script-src 'self'`** (see `server.js`), plus
  `frame-ancestors 'none'`, `nosniff`, `no-referrer` and a tight
  `Permissions-Policy`.
- **`connect-src`** allows `https:` (the user picks their RPC node) and
  `localhost` (for anyone running their own). Nothing else.
- The decrypted key lives in memory only and is wiped on lock.

## Structure

- `public/index.html` — the landing page.
- `public/app.html` + `app.js` — the wallet, served at `/app`.
- `public/vendor/` — ethers and the QR generator, frozen here on purpose.
- `server.js` — static files and security headers.
- `test/` — the full journey against a real chain (see `test/README.md`).

## Running it locally

```sh
cd wallet
npm start           # http://localhost:8080
```

Nothing to install: `server.js` uses only Node's own modules.

## How it has been checked

Against a local EVM chain pinned to id 8453, the browser creates the wallet,
encrypts it, signs a payment, and the test verifies **on the chain** that the
transaction exists and the recipient received the exact amount. A second test
announces its own EIP-6963 provider — the same interface the real wallets use —
and proves the top-up path moves real funds into the generated address. Both
also check that neither the phrase nor the private key is left in the clear in
the browser.

```sh
npm test
```

## Deploying

A static site with a minimal Node server; `server.js` listens on `$PORT`.

On Railway the service must point at this directory (**Root Directory:
`/wallet`**). Without that, the detector analyses the repository root — which
holds several projects and no `package.json` — and the build fails before it
starts. `railway.json` pins the rest: start command, healthcheck and restart
policy, so the deploy does not depend on autodetection guessing right.

## Trying it without risking money

Pick **Base Sepolia** in the network menu and get test ETH from a faucet. It is
a real chain, with the same blocks and the same signatures, but its coin is
worth nothing: it is there to prove a payment works end to end before any money
moves.

## What this is not

Not a debit card and not a payment issuer. Spending at shops on a Visa or
Mastercard needs a licensed issuer, BIN sponsorship and KYC — that is a
contract, not code. Here, payments are blockchain transfers between addresses.

Not a bank, and not insured. No deposit protection scheme covers this, because
there is no deposit: you are holding your own money.

Quiver is independent. It is not affiliated with, endorsed by or connected to
any wallet, exchange, brokerage or network it interoperates with or names.
