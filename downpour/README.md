# Starmint

A star-themed token launchpad where every coin is paired with a currency.

You pick one of 147 currencies when you launch (euros, yen, naira, pesos, gold,
bitcoin…) and the coin trades in it for as long as it exists: buys are paid in
it, sells pay out in it, the price is quoted in it and fees are collected in it.
The pairing is shown everywhere as a badge, coin on the left and currency on the
right, e.g. `PULSAR / € EUR`.

The sky behind the pages is deep space rendered on the GPU (WebGL2): layered
starfields that twinkle, drifting nebulae, a galaxy band with dust lanes, a far
spiral galaxy and the limb of a planet with a glowing atmosphere. Every currency is
a star: a glowing orb in the currency's colour with a halo, diffraction spikes and
its sign on the face. Stars are born with a flare, drift slowly upward and fade
out; tap one and it bursts into sparks with a shockwave. Shooting stars cross the
sky on their own (a meteor shower, or now and then when calm), bloomed and lighting
the nebula they pass; tap the empty sky to send one through that point. Resolution
drops by itself on slow devices, browsers without WebGL2 get a 2D version (also
reachable with `?storm2d`), and nothing moves under `prefers-reduced-motion`.

## What works

| | |
|---|---|
| **Swap** | Anything for anything: currency ↔ currency through the desk, currency ↔ coin through the coin's market, coin ↔ coin across currencies (sell, convert, buy) in one transaction. Shows the route, price impact, fees, minimum received. |
| **Board** | Every coin, filterable by currency, sortable by activity, market cap, volume or progress. |
| **Coin page** | Price chart, buy/sell, curve progress, backing, holders, fills. |
| **Launch** | Name, ticker, currency, picture, links, optional first buy. The market opens in the same transaction. |
| **Currency desk** | All 147 currencies with their USD rate, coins and backing per currency, conversion, and a faucet for test currencies. |
| **Portfolio** | Your coins, currencies, launches, and creator fees to claim. |
| **Proof** | Recomputes, for every market, that its reserves add up and its backing covers selling every coin back at once; in live mode also that the contract really holds the money. |
| **Verify** | Checks from the browser, against any RPC, that a coin is genuinely the pad's and its pairing is what the badge says (the same checks as `scripts/verify.mjs`). |
| **Connect wallet** | Every browser wallet via EIP-6963 (MetaMask, Rabby, Coinbase, Phantom, OKX, Brave, Trust…), deep links into wallet apps on phones, and a guest mode for the playground. |

## Two modes

- **Playground** (the default until contracts are deployed): the whole pad simulated
  in the browser with the same integer math as the contracts. Connecting gives an
  address $1,000 of every currency; nothing is signed and no real money moves. A
  small crowd of bots trades so the board is alive; state is kept in localStorage.
- **Live**: the contracts on a chain, signed with the visitor's wallet. It switches
  on by itself once `npm run deploy` has written a deployment for a chain, and the
  pill under the nav toggles between the two.

## How the pad works

- **Coin**: 1,000,000,000 units, minted to the pad. Every coin is a 44-byte clone
  of one implementation, which is how Verify recognises the pad's coins.
- **Curve**: 800M coins sell on `x · y = k` over virtual reserves. The virtual
  token reserve is `S² / (S − L)`, which makes the curve's last price equal the
  pool's first price. The virtual currency reserve is set at launch from the
  desk's rate, so a full curve raises the same dollar amount in every currency
  ($12,000 by default).
- **Graduation**: when the curve sells out, its backing and the 200M coins held
  back become a constant-product pool with no LP tokens and no owner. Trading
  continues there.
- **Fees**: 1% per trade, half to the creator and half to the protocol, in the
  coin's currency, claimable any time. Buys in the first 15 seconds pay an extra
  snipe tax that falls from 20% to zero; the creator's first buy is exempt.
- **Currency desk**: the allow-list of currencies, each with a rate in units per
  USD, and a counter that converts between them (0.10% fee). On test networks it
  mints test currencies (`tEUR`, `tJPY`…); on a production chain you list real
  stablecoins instead and it pays conversions from a reserve.
- **Keeper**: posts a new rate only when two independent FX feeds agree within
  0.5% and the rate has drifted at least 0.1%. The desk refuses any single post
  that moves a rate more than 20%.

## Layout

```
contracts/   Solidity (Foundry): Coin, TestCurrency, CurrencyDesk, Launchpad, Router + tests
scripts/     deploy, seed, keeper, verify, dev (local chain), build-artifacts
shared/      currencies.json (the 147 currencies and reference rates), artifacts.json (ABIs + bytecode)
web/         the site: Vite + React + TypeScript + viem; web/src/storm is the WebGL sky
e2e/         browser tests (Playwright) for live and playground modes
server.js    serves dist/ as a single-page app (Railway)
```

## Run it

```bash
cd downpour   # the project folder
npm install
npm run dev            # http://localhost:5173, opens in the playground
```

With a real local chain (needs [Foundry](https://getfoundry.sh) for `anvil`):

```bash
npm run dev:chain      # anvil + deploy + seed 16 coins + site, in one command
```

To use MetaMask against it, add the network `http://127.0.0.1:8545` (chain id
31337) and import one of anvil's well-known development keys. Those keys are
public: never send real funds to them.

## Tests

```bash
npm run contracts:setup   # once: fetches forge-std
npm run contracts:test    # unit, fuzz and invariant tests (30 tests)

# browser, live mode against a local chain
npm run dev:chain -- --no-web
VITE_ALLOW_LOCAL=1 npm run build && npx vite preview --port 4173
npm run e2e

# browser, production build with no chain
npm run build && PORT=8090 npm start
BASE=http://localhost:8090 npm run e2e:playground
```

## Deploy the contracts

```bash
RPC_URL=https://sepolia.base.org \
PRIVATE_KEY=0x... \
CHAIN_NAME="Base Sepolia" EXPLORER=https://sepolia.basescan.org \
npm run deploy
```

This deploys the desk with every currency in `shared/currencies.json` as a test
currency, the launchpad and the router, makes the deployer the keeper, and
writes `deployments/<chainId>.json` plus `web/src/generated/deployments.json`.
Commit that file and rebuild the site: it opens in live mode on that chain.
Tunables (fees, snipe tax, curve size, faucet) are environment variables,
listed at the top of `scripts/deploy.mjs`. Then optionally:

```bash
npm run seed -- --light                                   # a few demo coins from the deployer
RPC_URL=... PRIVATE_KEY=<keeper key> npm run keeper       # keep the rates current
node scripts/verify.mjs --rpc <url> --pad <launchpad>     # check every coin
```

The site knows Robinhood Chain, Base, Sepolia and their testnets
(`web/src/config/chains.ts`); any other EVM chain works through `deploy.mjs`.

**These contracts are tested, not audited.** A deployment that holds real money
should be audited first, and on a production chain the desk should list real
stablecoins (`CurrencyDesk.listCurrency`) rather than mint test ones.

## Host the site

It is live at https://downpour-production.up.railway.app (Railway service
`downpour`, root directory `downpour`, deploying this branch on every push; the
service and folder keep the project's first name). To
set up another one, point a Railway service at this repository with root
directory `downpour`; it runs `npm run build` and `node server.js` (the server
answers on `PORT`, or 8080).
Any static host works too, as long as unknown paths fall back to `index.html`.

## Make it yours

- `web/src/config/site.ts`: name, tagline, and the platform token's contract
  address (the bar under the nav says "not launched yet" until you fill it in).
- `shared/currencies.json`: which currencies exist, with reference rates.
- `VITE_DEFAULT_MODE` (`auto` | `live` | `playground`) and `VITE_DEFAULT_CHAIN`
  at build time choose what visitors see first.
