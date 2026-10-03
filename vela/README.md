# AnyChain — launchpad

Launch tokens from your own wallet and follow their P&L in one dashboard.

| Launchpad | Chain | How AnyChain launches |
| --- | --- | --- |
| **pump.fun** | Solana | Image + metadata to IPFS (Pinata), create transaction from PumpPortal's local API, signed by your wallet and a fresh mint key |
| **Pons** | Robinhood Chain (chain 4663) | Calls Pons' own contracts from your wallet: `PonsV2LaunchFactory.launchToken` (0.0005 ETH fee, read from the contract) or `PonsV2LaunchAndBuy.launchAndBuy` when you add a first buy, with slippage protection from a simulated quote. Optional logo goes to IPFS. Creator fee 0–10 % |
| **Base** | Base | Deploys `contracts/VelaToken.sol` from your wallet |
| **BNB Chain** | BNB Chain | Same contract |

AnyChain never holds a key. The wallet (Phantom / Solflare / Backpack for Solana, MetaMask / Rabby / any
injected wallet for EVM) signs every launch and every sale. The one key AnyChain generates is the mint
keypair of a new pump.fun token: it co-signs its own creation and is then thrown away.

The site opens on a landing page: hero with the launchpad logos and **Launch a coin**; trending tokens
from DexScreener on Solana, Robinhood Chain, Base and BNB Chain with live market data; *How it works*;
one card per launchpad; what the
dashboard does after a launch; a closing call to action and the footer. Every launch button on the landing page opens the app; the
launch form itself opens from **Create Launch** inside it, as a three-step wizard (launchpad → coin → launch).
The app lives at `#dashboard`.

## Run it

```bash
cd vela
PINATA_JWT=<your Pinata JWT> SOLANA_RPC_URL=<your RPC URL> npm start   # http://localhost:8080
```

No dependencies; Node 18 or newer.

| Variable | Needed for | Default |
| --- | --- | --- |
| `PINATA_JWT` | optional: token images and metadata go to IPFS. Free key at pinata.cloud → API Keys → JWT | none — files are then stored on the server (the Railway volume) and served from `/media` |
| `DATA_DIR` | where self-hosted media is kept | the Railway volume mount, else `./data` |
| `PUBLIC_URL` | base URL written into self-hosted metadata | `https://$RAILWAY_PUBLIC_DOMAIN` |
| `SOLANA_RPC_URL` | Solana balances, sending transactions | `https://api.mainnet-beta.solana.com` (heavily rate-limited — use Helius, QuickNode, Triton…) |
| `SESSION_SECRET` | signs sync sessions | generated once and kept on the volume |
| `PORT` | | `8080` |

Opening `index.html` straight from disk shows the interface but nothing works: the status bar reads
"AnyChain server offline". Launches need the server.

## What is real

- **Wallets**: connected through the browser extension; balances read on-chain (Solana through the
  server's RPC, Robinhood Chain through its public RPC, Base / BNB through publicnode.com).
- **Launches**: real transactions. Each one is recorded in this browser (localStorage) with its
  address, transaction, what it cost (the wallet's balance before minus after, in USD at launch) and
  the wallet that owns the dev tokens.
- **P&L** = dev tokens held × DexScreener price + what you sold − what the launch cost. It is
  refreshed every minute while AnyChain is open; each change is stored as an event, and the charts are
  the running sum of those events. A token DexScreener hasn't indexed yet counts at its cost only.
- **AnyChain fee**: 1% of the dev buy on pump.fun launches, added as a SOL transfer to AnyChain's wallet
  (`FEE` in `chain.js`) inside the launch transaction, so the wallet shows it before signing. It is shown
  under the dev buy in the form and in the Terms. EVM launches carry no fee until `FEE.evm` is set.
- **Wallet safety checks**: every Solana transaction is simulated on AnyChain's RPC before the wallet
  is asked to sign, so one that would fail (not enough SOL, slippage) stops with a clear message instead
  of reaching Phantom, whose simulation shows "This dApp could be malicious" for failing transactions.
  Trades and sells, signed only by the wallet, go through `signAndSendTransaction`; the pump.fun create
  is signed by the wallet first and by the mint key after, as Phantom asks for multi-signer transactions.
- **Buy / Sell** any token from its launch panel or from the Tracker (*Trade*): Solana through Jupiter
  (every DEX and the pump.fun curve; PumpPortal as fallback), Robinhood Chain / Base / BNB Chain through
  the KyberSwap aggregator (Pons curves included), with slippage protection and the ERC-20 approval when
  selling. Cost of buys and proceeds of sells are measured from the wallet and booked on the launch.
- **Status bar**: SOL, BNB and ETH prices from CoinGecko, and what a transfer costs on Base right now (gas price × 21k gas × ETH), cached 30 s. **Tracker**: DexScreener, cached 15 s.
- **P&L calendar** (calendar icon on *Total P&L*): daily P&L and launches per day, monthly and yearly views,
  positive streaks, and *Save as image* for a PNG of the month.
- **Base / BNB Chain logos**: an ERC-20 has no on-chain logo, so the one you pick is stored with the launch
  and shown in AnyChain; explorers and DEXs take their own logo submissions.
- **Price chart** in each launch's panel (DexScreener embed) once the token has a market.
- **Sign in with your wallet** (My Wallets or the wallet menu): Solana wallets that support it use Sign In
  With Solana (the wallet shows "Sign in to anychain.website"; the server checks the domain, wallet and nonce);
  others sign a free one-time message,
  the server checks it (ed25519 / secp256k1) and returns a 30-day session; launches, tracked tokens and
  activity are then stored per wallet on the server volume and merged on every device you sign in on.
- **Installable**: web app manifest, icons and a service worker (offline shell) — "Add to Home Screen".
- **Terms and Risk disclosure**, linked from the landing and the status bar; accepting them is required
  before the first launch.
- **Launched here** (sidebar, and *Launched on AnyChain* on the landing page): every token launched from
  AnyChain by anyone, verified on-chain, with market cap, 24h change, liquidity, creator and a Track button.
  Kept in `DATA_DIR/anychain-launches.json`; launches made before the list existed are added from the
  synced accounts at start-up.
- **Import**: add a token launched elsewhere so its P&L is tracked; give its cost if you know it.

Clearing the browser's site data forgets the launch list (the tokens stay on-chain; import them again).

## Files

```
index.html          the shell: sidebar, dashboard, wallets, sites, tracker, archived, status bar
styles.css          theme tokens (9 themes) and layout
app.js              state, rendering, charts, launch / import / sell flows, Customize
chain.js            window.VelaChain — wallets, RPC reads, pump.fun and EVM launch, sell
erc20.js            compiled VelaToken (ABI + bytecode)
contracts/VelaToken.sol   fixed-supply ERC-20: all minted to the deployer, no owner, no mint, no tax
scripts/compile.js  rebuilds erc20.js: npm i --no-save solc@0.8.24 && node scripts/compile.js
vendor/             @solana/web3.js 1.99.0 and ethers 6.17.0 browser builds, unmodified from npm
img/                launchpad and coin logos (pump.fun, Pons, Robinhood, Base, BNB, SOL, ETH, ARC), 64 px, from CoinGecko
img/hero/           the large transparent logos floating on the landing page (official SVGs where they exist)
server.js           static files + /api (below)
```

### Server API

| Route | Does |
| --- | --- |
| `GET /api/health` | which features are configured |
| `GET /api/prices` | SOL / ETH / BNB / ARC in USD, and Base's cost per transfer (Base has no token; gas is paid in ETH) |
| `POST /api/sol-rpc` | Solana JSON-RPC, only the methods the page uses |
| `POST /api/ipfs` | image (data URL, ≤ 4 MB) + metadata: IPFS via Pinata, else stored on the server; 20 uploads / hour / IP, 400 MB cap |
| `GET /media/<sha256>.<ext>` | self-hosted token images and metadata (content-addressed, immutable) |
| `POST /api/pump/create` | unsigned pump.fun create transaction from PumpPortal |
| `POST /api/pump/sell` | unsigned sell transaction (a % of the wallet's tokens) |
| `POST /api/sol/swap` | Solana buy/sell transaction from Jupiter |
| `POST /api/sol/trade` | the same from PumpPortal (fallback) |
| `GET /api/evm/quote`, `POST /api/evm/build` | best route and calldata from KyberSwap on Robinhood Chain, Base, BNB Chain |
| `POST /api/auth/nonce`, `POST /api/auth/verify` | wallet sign-in (one-time message, signature check, session token) |
| `GET /api/account`, `PUT /api/account` | the signed-in wallet's synced data |
| `GET /api/token/:addrs` | DexScreener market data, up to 30 addresses |
| `POST /api/launches` | report a launch made in AnyChain; the server reads the transaction on-chain and lists the token only if that transaction created it (pump.fun Create, Pons mint from the factory/router, or the ERC-20 deployment) |
| `GET /api/launches` | every token launched from AnyChain, newest first, with DexScreener market data |
| `GET /api/trending` | trending tokens (DexScreener boosts + profiles) on the four chains, cached 60 s |

Only the page's own files are served; `server.js`, `contracts/` and `scripts/` are not.

## Brand

Monochrome: pure black and white, big tight headlines (800, -3 to -5 % tracking), the pixel asterisk
mark in white, and a night sky: a light from above, faint stars and a planet's horizon under the headline. Colour is reserved for P&L (green / red) and the chains' own logos.
`brand/` holds the X profile picture, the headers and the GIF.

## Customize

Settings (status bar) opens **Customize**: nine themes — Default, Dark, Legacy, Emerald, Midnight,
Light, Light Blue, Light Rose, Custom — a primary colour that overrides any of them, corner radius,
font, density, sidebar side, status bar and chart layout. Export / Import save the look as JSON. The
look is applied before first paint, so a light theme doesn't flash dark.

Chart colours are tokens too. P&L marks use `--accent-fill`; light themes darken `--accent` for
figures so small text still clears 4.5:1. The four chain colours are a validated categorical set,
separately stepped for dark and light surfaces, always shown with their names.

## Tested

- `VelaToken` compiled with solc 0.8.24 and deployed through the full UI (MetaMask-style provider
  on a local chain): the contract holds the right name, symbol and supply.
- pump.fun: the PumpPortal create transaction for a funded mainnet wallet **simulates successfully**
  (CreateV2 and the dev buy); through the UI with a test wallet the flow reaches mainnet and is
  rejected only for having no SOL.
- Pons: both paths (launch, and launch + first buy) driven through the UI with a wallet that forwards to
  Robinhood Chain mainnet; the exact transaction the wallet would sign **executes successfully** in an
  `eth_call` simulation (it is not broadcast).
- Not tested with real funds. Make your first launch a small one.

## Before you share it

- Serve it over HTTPS: the clipboard and some wallets only work on a secure origin (localhost counts as one).
- `/api/ipfs` uploads with your Pinata key for anyone who can reach the server. Add rate limiting or
  auth if the server is public.
- Launching a token costs real money and cannot be undone.
