# Vela — launchpad

Launch tokens from your own wallet and follow their P&L in one dashboard.

| Site | Chain | How Vela launches |
| --- | --- | --- |
| **pump.fun** | Solana | Image + metadata to IPFS (Pinata), create transaction from PumpPortal's local API, signed by your wallet and a fresh mint key |
| **Robinhood** | Robinhood Chain (Ethereum L2, chain 4663) | Deploys `contracts/VelaToken.sol` from your wallet; Vela adds the network to the wallet if it is missing |
| **Base** | Base | Same contract |
| **BNB Chain** | BNB Chain | Same contract |
| bonk.fun | Solana | Not offered: PumpPortal only creates bonk.fun tokens from its custodial Lightning wallet, and Vela only launches from your own wallet |
| four.meme | BNB Chain | Not offered: no public creation API |

Vela never holds a key. The wallet (Phantom / Solflare / Backpack for Solana, MetaMask / Rabby / any
injected wallet for EVM) signs every launch and every sale. The one key Vela generates is the mint
keypair of a new pump.fun token: it co-signs its own creation and is then thrown away.

## Run it

```bash
cd vela
PINATA_JWT=<your Pinata JWT> SOLANA_RPC_URL=<your RPC URL> npm start   # http://localhost:8080
```

No dependencies; Node 18 or newer.

| Variable | Needed for | Default |
| --- | --- | --- |
| `PINATA_JWT` | pump.fun launches (token image and metadata go to IPFS). Free key at pinata.cloud → API Keys → JWT | none — pump.fun is switched off without it |
| `SOLANA_RPC_URL` | Solana balances, sending transactions | `https://api.mainnet-beta.solana.com` (heavily rate-limited — use Helius, QuickNode, Triton…) |
| `PORT` | | `8080` |

Opening `index.html` straight from disk shows the interface but nothing works: the status bar reads
"Vela server offline". Launches need the server.

## What is real

- **Wallets**: connected through the browser extension; balances read on-chain (Solana through the
  server's RPC, Robinhood Chain through its public RPC, Base / BNB through publicnode.com).
- **Launches**: real transactions. Each one is recorded in this browser (localStorage) with its
  address, transaction, what it cost (the wallet's balance before minus after, in USD at launch) and
  the wallet that owns the dev tokens.
- **P&L** = dev tokens held × DexScreener price + what you sold − what the launch cost. It is
  refreshed every minute while Vela is open; each change is stored as an event, and the charts are
  the running sum of those events. A token DexScreener hasn't indexed yet counts at its cost only.
- **Sell**: pump.fun tokens can be sold 25 / 50 / 100 % from the launch's panel (PumpPortal, `pool:
  auto`, so it still works after migration). What the sale returned is measured from the wallet.
- **Prices** (status bar): SOL, ETH, BNB and ARC (AI Rig Complex) from CoinGecko, cached 30 s. **Tracker**: DexScreener, cached 15 s.
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
img/                site and coin logos (pump.fun, Robinhood, Base, BNB, SOL, ETH, ARC), 64 px, from CoinGecko
server.js           static files + /api (below)
```

### Server API

| Route | Does |
| --- | --- |
| `GET /api/health` | which features are configured |
| `GET /api/prices` | SOL / ETH / BNB in USD |
| `POST /api/sol-rpc` | Solana JSON-RPC, only the methods the page uses |
| `POST /api/ipfs` | image (data URL, ≤ 4 MB) + metadata to Pinata, returns the metadata URI |
| `POST /api/pump/create` | unsigned pump.fun create transaction from PumpPortal |
| `POST /api/pump/sell` | unsigned sell transaction (a % of the wallet's tokens) |
| `GET /api/token/:addrs` | DexScreener market data, up to 30 addresses |

Only the page's own files are served; `server.js`, `contracts/` and `scripts/` are not.

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
- Not tested with real funds. Make your first launch a small one.

## Before you share it

- Serve it over HTTPS: the clipboard and some wallets only work on a secure origin (localhost counts as one).
- `/api/ipfs` uploads with your Pinata key for anyone who can reach the server. Add rate limiting or
  auth if the server is public.
- Launching a token costs real money and cannot be undone.
