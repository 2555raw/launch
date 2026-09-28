# Starmint

A star-themed token launchpad where every coin is paired with a currency.

You pick one of 149 currencies when you launch (euros, yen, naira, pesos, gold,
bitcoin, zcash…) and the coin trades in it for as long as it exists: buys are paid in
it, sells pay out in it, the price is quoted in it and fees are collected in it.
The pairing is shown everywhere as a badge, coin on the left and currency on the
right, e.g. `PULSAR / € EUR`.

The sky behind the pages is deep space rendered on the GPU (WebGL2): layered
starfields that twinkle, faint wisps of nebula, a galaxy band with dust lanes and a far
spiral galaxy. Along the bottom is the real Earth, opening on the Caribbean and the
Atlantic, from NASA's public-domain Blue
Marble day map, the city lights of Earth at Night and topography (prepared by
`scripts/build-earth-images.mjs`), with the coastlines (Natural Earth, rasterized by
`scripts/build-earth.mjs`) for the sea's sheen, and clouds with cyclones and two
hurricanes (rendered once by `scripts/build-earth-clouds.mjs` from the shader in
`web/src/storm/earthgen.ts`: generated in the browser, a shader that long took some
Windows GPU drivers minutes to compile and crashed Chrome and Brave). It turns slowly in daylight under a thin glowing
atmosphere, with the real city lights (from NASA's night map, its moonlit ground
removed) wherever it is night. A slim 3D satellite (a flat body with silver foil and one
long solar array) comes up over the planet's edge now and then, orbits along just inside
the horizon and leaves off the side of the screen, its array flashing when it catches
the sun.

Every currency is a star, drawn like a real one (a white core, a halo in the
currency's colour, diffraction spikes) with its sign beside it like a star chart.
Stars are born with a flare, drift slowly upward and fade out; tap one and it flares up
for a moment and fades, like a real star going out. The top bars are translucent glass
over the sky.
Shooting stars streak across the top of the sky on their own, over the planet and
away from it. The sky starts once the page has drawn its content, so text never waits for
it. Resolution drops by itself on slow devices, browsers without WebGL2 get a 2D
version (also reachable with `?storm2d`), and so do machines that draw WebGL in software
(no GPU, or a blocked one), where the WebGL sky would crawl at a frame a second
(`?stormgl` keeps it anyway). If the GPU drops the WebGL sky, the 2D one takes over on
the spot, and if a visit ended with the WebGL sky on screen without the page closing (a
driver crash that took the browser with it), the next visits get the 2D sky for three
days (`starmint:sky` in localStorage). Nothing moves under `prefers-reduced-motion`.

## What works

| | |
|---|---|
| **Swap** | Anything for anything: currency ↔ currency through the desk, currency ↔ coin through the coin's market, coin ↔ coin across currencies (sell, convert, buy) in one transaction. Shows the route, price impact, fees, minimum received. |
| **Board** | Every coin, filterable by currency, sortable by activity, market cap, volume or progress. |
| **Coin page** | Price chart, buy/sell, curve progress, backing, holders, fills. |
| **Launch** | Name, ticker, currency, picture, links, optional first buy. The market opens in the same transaction. |
| **Currency desk** | All 149 currencies with their USD rate, coins and backing per currency, conversion, and a faucet for test currencies. |
| **Portfolio** | Your coins, currencies, launches, and creator fees to claim. |
| **Proof** | Recomputes, for every market, that its reserves add up and its backing covers selling every coin back at once; in live mode also that the contract really holds the money. |
| **Verify** | Checks from the browser, against any RPC, that a coin is genuinely the pad's and its pairing is what the badge says (the same checks as `scripts/verify.mjs`). |
| **Connect wallet** | MetaMask, Coinbase Wallet and Phantom first, with their own icons: connected straight away when installed, opened in their app on phones, or linked to their download page. Any other browser wallet (EIP-6963: Rabby, OKX, Brave, Trust…) is listed after them. The icons are from @web3icons/core (MIT); the marks belong to their makers. |
| **Zcash** | New: ZEC is on the desk (its reference rate is about $1,550, late September 2026), so a coin can be priced in zcash. The home page gives it a band next to the currencies, with the coins priced in ZEC, and ZEC is among the popular currencies and the swap's shortcuts. The playground opens two ZEC coins, SHIELD and ZODIAC; a playground saved before gets ZEC, its starting balance and those two coins on its next visit. The ZEC mark is from @web3icons/core (MIT). |

## Two modes

- **Playground** (the default until contracts are deployed): the whole pad simulated
  in the browser with the same integer math as the contracts. Connecting gives an
  address $1,000 of every currency; nothing is signed and no real money moves. A
  small crowd of bots trades so the board is alive; state is kept in localStorage.
- **Live**: the contracts on a chain, signed with the visitor's wallet. It switches
  on by itself once a deployment for a chain is in `web/src/generated/deployments.json`
  (from `npm run deploy` or the `/deploy` page). There is no switch on the page:
  `VITE_DEFAULT_MODE=playground|live|auto` sets the mode, a browser keeps the last one
  it used (`starmint:mode` in localStorage), and `?mode=live` or `?mode=playground` in
  the address picks one for that browser (to try a deployment before visitors see it).

## How the pad works

- **Coin**: 1,000,000,000 units, minted to the pad. Every coin is a 44-byte clone
  of one implementation, which is how Verify recognises the pad's coins.
- **Curve**: 800M coins sell on `x · y = k` over virtual reserves. The virtual
  token reserve is `S² / (S − L)`, which makes the curve's last price equal the
  pool's first price. The virtual currency reserve is set at launch from the
  desk's rate, so a full curve raises the same dollar amount in every currency
  ($12,000 by default).
- **Graduation**: when the curve sells out, its backing and the 200M coins held
  back open the coin's Uniswap V2 pool with its currency, at the curve's last
  price, and the liquidity tokens go to `0x…dEaD`, so nobody can ever withdraw it.
  The pair is created with the coin, and the coin refuses transfers to it until
  then, so nobody can seed the pool early at a price of their own (currency sent to
  the empty pair goes to the treasury). From then on it is an ordinary Uniswap
  pair: DexScreener, GeckoTerminal, Axiom and the like list it with its liquidity
  and its currency, the pad keeps buying and selling it for its users through the
  pair, and the site reads the pair's swaps, wherever they came from, into the
  coin's chart and fills. On Robinhood Chain mainnet it uses Uniswap's own factory
  (`shared/uniswap.json`); elsewhere the deploy puts up a copy of Uniswap's
  (`contracts/uniswap/`, GPL-3.0, from its npm package).
- **Fees**: 1% per trade on the curve, half to the creator and half to the
  protocol, in the coin's currency, claimable any time. Buys in the first 15
  seconds pay an extra snipe tax that falls from 20% to zero; the creator's first
  buy is exempt. After graduation the pad takes nothing; the pool keeps Uniswap's
  0.3%.
- **Currency desk**: the allow-list of currencies, each with a rate in units per
  USD, and a counter that converts between them (0.10% fee). On test networks it
  mints test currencies (`tEUR`, `tJPY`…). On mainnet it lists tokens that trade
  there (`listCurrency`: USDG as USD, WETH as ETH), since there are no euro or yen
  tokens on Robinhood Chain to pair with, and the site can still show prices in any
  of the currencies; with no reserve it converts nothing.
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
npm run contracts:test    # unit, fuzz and invariant tests (40 tests), against Uniswap's own V2 bytecode

# browser, live mode against a local chain
npm run dev:chain -- --no-web
VITE_ALLOW_LOCAL=1 npm run build && npx vite preview --port 4173
npm run e2e

# browser, production build with no chain
npm run build && PORT=8090 npm start
BASE=http://localhost:8090 npm run e2e:playground
```

## Deploy the contracts

From the browser, with no private key handed to anything: open `/deploy` on the site
(not linked from the menu), connect the owner's wallet and press Deploy. It deploys the
desk with every currency as a test currency, the launchpad and the router to Robinhood
Chain's testnet (`?chain=<id>` for another test network the site knows, a local node
included), makes the owner the keeper, and prints the deployment record to add to
`web/src/generated/deployments.json`. That takes 13 transactions, each confirmed in the
wallet; progress is saved and read back from the chain, so a closed tab or a rejected
transaction carries on where it stopped.

From a terminal:

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
answers on `PORT`, or 8080). The server sends the pages with anti-framing headers
(`X-Frame-Options: DENY`, `frame-ancestors 'none'`, so no other site can wrap the page to
trick a wallet click) and HSTS, and sends visits to the Railway-generated address on to
`CANONICAL_HOST` (`starmint.website`; set it empty to turn the redirect off).
Any static host works too, as long as unknown paths fall back to `index.html`.

## Make it yours

- `web/src/components/EntryGate.tsx`: the notice on arrival (the risks, legal age, no
  restricted jurisdiction). "Accept and enter" is remembered in the browser
  (`starmint:entered` in localStorage); "I do not accept" goes to `LEAVE_TO` (Pons's
  launchpad). The page behind is inert until then.
- `web/src/config/site.ts`: name, tagline, the platform token's contract
  address (the bar under the nav with its contract address only shows once you fill it in),
  and `ecosystem`, the row of logos on the home page under the intro (Robinhood Chain,
  Chainlink, USDG, Uniswap, Pons; an empty list hides it). Their files are in
  `web/public/eco/`: Robinhood Chain, Chainlink and Uniswap from @web3icons/core (MIT); USDG
  is the token mark from Global Dollar's brand page (globaldollar.com/brand), unchanged;
  Pons is the mark from its public repository (ReptilianHQ/ponsfamily), lifted off its white
  background. The marks belong to their owners, and the row doesn't say they endorse
  Starmint.
- `web/public/brand/`: the logo, six rounded arms around a hexagon with six drops
  circling them. `mark.svg` (white) and `mark-black.svg` are the mark alone on a
  transparent background, with 1024 px PNGs; `logo.svg` is the mark on a black disc
  (also `favicon.svg`, and the phone icon on a black square), with PNGs at 512 and
  1024 px for X, listings and the like. `token.svg` is the $SMNT token image (a coin
  with a star). `x-pfp.png` (1000×1000, the mark alone) and `x-header.jpg` (1500×500,
  the site's sky with its currency stars) are the X profile picture and header;
  `x-pfp-sky.png`, `x-pfp-purple.png`, `x-pfp-blue.png` and `x-pfp-navy.png` are the same mark,
  same size and place, on the site's starfield (no planet): as it is, then tinted violet,
  royal blue and navy, stars left white;
  `x-header-2.jpg` is the same sky with seven coin tiles on an orbit above the Earth,
  each star in its currency's colour; `x-header-3.jpg` is a night field under the Milky
  Way with the currency stars, and the mark built of cumulus on the planet. Its
  photographic parts come from open sources: the Milky Way from the three.js example cube
  map (MIT repository), the Earth's cloud cover from NASA's Blue Marble (public domain,
  via turban/webgl-earth), and the cumulus puff from pmndrs/drei-assets (MIT).
  `starmint-teaser.mp4` (30 s) and `starmint-teaser-2.mp4` (46 s) are 1080p promo
  videos built from the site's own screens; `starmint-teaser-35.mp4` is the second one cut
  to 35 s on one unbroken run of the song (four identical bars of its drop play twice,
  and it fades out at the end), with every cut on the song's beat; `starmint.gif` (800 px, 20 fps, looping) and
  `starmint-3s.mp4` (720p) are 3 seconds of the home page with the sky moving: two
  shooting stars, the planet with its hurricane, the currency in the headline changing.
  `starmint-soon.mp4` (3 s, 1080p) is a "Soon" teaser: a phone drops in over the Earth
  with a coin's market cap counting up and its chart drawing, currency chips round it,
  then the mark, the name and SOON on the sound's hit; `x-header-4.jpg` is the matching
  X header (the mark and name, the phone over the planet, currency chips).
  `starmint-soon.gif` is that teaser as a GIF (720 px, 20 fps, under 5 MB for X).
  `starmint-30.mp4` is the site teaser at 30 s on the whole song, untouched, every cut on
  its beat: the drop on "question", the break on "and we thought", the star on a downbeat
  of the second drop, the song's own fade to close.
  `x-header-5.jpg` is the planet sky with the hurricane and twelve of the site's currency
  stars, drawn by the site's own WebGL sky at 1.5 times their size so the signs still read
  when X shows the header small; the corner the profile picture covers is left empty.
- `shared/currencies.json`: which currencies exist, with reference rates.
- `VITE_DEFAULT_MODE` (`auto` | `live` | `playground`) and `VITE_DEFAULT_CHAIN`
  at build time choose what visitors see first.
