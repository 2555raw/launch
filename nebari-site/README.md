# Nebari — site

**Nebari** (根張り, the root spread of a bonsai) is a launchpad on Robinhood Chain: launch a
token that trades against any Robinhood stock token, ETH, USDG or any token you paste, with
the liquidity locked forever at launch and half of every swap fee paid to the holders in the
pair asset. Every token gets a sakura bonsai grown from its own address that fills out with
volume.

It is a working dapp, not a mock-up. The pages read the factory contract over the public RPC
and write through the user's own wallet. Nothing runs on a server: plain HTML, CSS and JS,
with ethers.js vendored in.

```
index.html     landing page: hero, about, how it works, pick your pair (real logos), numbers, FAQ
launch.html    the launch form: name, symbol, pair, start price → one transaction
explore.html   the garden: every launched token with its bonsai and live figures
token.html     one token: bonsai, price, market cap, volume, trade box, claim box
claim.html     everything you hold and what you can claim on each token
docs.html      the spec, the addresses, how to deploy
config.js      network, contract addresses, quick-pick assets
web3.js        wallet connection (EIP-1193 / EIP-6963), contracts, pool reads, maths
bonsai.js      the procedural bonsai and the petals
chrome.js      header, footer, wallet button, logos with fallbacks, background
styles.css     black on white with pink details, like the logo
contracts/     Solidity sources, compile script, deploy script, end-to-end test
vendor/        ethers.umd.min.js (6.17)
assets/logos/  drop <symbol>.png here to override an asset's logo
server.js      optional static server for Railway (`npm start`)
```

## Run it

```bash
python3 -m http.server 8000     # or: npm start (port 8080)
```

Open `http://localhost:8000`. The site works in read-only mode until the contracts are
deployed; the launch, trade and claim buttons say so.

## Make it live with real money

1. Check `config.js`: the PoolManager address must match the Uniswap v4 deployment for
   Robinhood Chain (4663) on the Uniswap deployments page, and each quick-pick address must
   match Robinhood's contract list. The site also checks every pick's symbol on-chain.
2. Deploy the contracts with your own key (see `contracts/README.md`):
   `PRIVATE_KEY=0x… TREASURY=0x… PROTOCOL_BPS=1000 npm run deploy -- --write`
3. Commit `config.js` and publish the folder on any static host, or point Railway at it
   (`npm start`).

The protocol share (`PROTOCOL_BPS`, 10% by default) goes to the treasury address on every
fee collection. Holders always get 50%; the creator gets the rest.

## Asset logos

Quick picks show the asset's real logo: a file in `assets/logos/`, else the icon of the
asset's own site, else a monogram. Robinhood stock tokens use the company's site icon.
