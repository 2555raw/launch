# UnyHooks — site

**UnyHooks** lets people build Uniswap V4 hooks on Robinhood Chain by describing them: say what
the pool should do, read the contract, deploy it from your own wallet and create the pool.

The site is plain HTML, CSS and vanilla JS. One small Node server (`server.js`) serves it and
adds the AI side of the chat; without it everything else still works on any static host.

## Structure

```
index.html   landing: hero with a "what should your pool do?" box, live demo, how it works,
             recipes, trust, $UHOOKS with live market data, FAQ, closing call
build.html   the builder: chat, settings, the contract and its Foundry script, and the
             four steps (connect, deploy hook, create pool, add liquidity)
launch.html  launch a token in one signature: token, protected pool, liquidity and a lock
hook.html    a hook's public page (hook.html?a=0x…, or /h/0x… with server.js): what it does,
             published source, token check, locked liquidity, live price, buy and share
hooks.html   My hooks: hooks and pools from this browser, live price and liquidity, published
             source, follow a hook by address, add a pool by ID, create pools, add liquidity,
             lock positions, collect locked fees, take positions back after the date
docs.html    docs: sidebar, one article per hash (#quickstart, #hooks…), on-this-page rail, search
app.html     sign in: connect MetaMask or Phantom and sign one message
config.js    links, token, network and contract addresses: the only file to edit

builder.js   the hook writer, no DOM: understand(text), generate(recipe, settings), highlight();
             also loads in Node for the checks
build.js     builder page: conversation (AI first, built-in reader as fallback), settings, code view
deploy.js    builder steps: compile, mine the hook address, dry-run, deploy, publish the source,
             create the pool, then the liquidity form
chain.js     shared: wallet session, chain reads, pool lookup by ID, error messages, links,
             the list of hooks this browser follows, pool creation, Sourcify publishing
liquidity.js the add-liquidity form: full or custom range, Permit2 approvals, PositionManager mint
pool-math.js Uniswap V4 math in BigInt: TickMath, LiquidityAmounts, amount deltas, prices
launch-kit.js  the token, LiquidityLock and UnyLaunch sources, their code hashes, and the
             launch planner (addresses, mined hook salt, price, liquidity); no DOM
launch.js    the launch page
hook.js      the public hook page
hooks.js     My hooks page
wallet.js    wallet discovery (EIP-6963 + fallbacks), connect, switch to Robinhood Chain
compile-worker.js   solc 0.8.26 (WebAssembly, from jsDelivr) in a worker
vendor/v4-sources.json   the Uniswap V4 files the templates import, for the in-browser compiler
token.js     live $UHOOKS market panel (DexScreener, GeckoTerminal, Blockscout)
demo.js      the demo window on the landing page
app.js       shared: links from config, sticky nav, menu, typing prompt, copy CA, scroll reveal
landing.js   the landing's moving parts: ship's log ticker, the rope and its hook, the cannon
docs.js      docs routing, table of contents, previous/next and search
signin.js    sign-in message (EIP-4361) for app.html
styles.css / build.css / docs.css / app.css / hooks.css / launch.css / hook.css
             design system and per-page layout

server.js    serves the site, POST /api/chat (Claude), absolute og:image URLs, /healthz
og.png       the 1200×630 link-preview image
media/       videos for posting: unyhooks-launch.mp4 (1080p, 31 s), unyhooks-launch-vertical.mp4
             (1080×1920), unyhooks-checks.mp4 (1080×1080, 16 s), unyhooks-launch.gif,
             unyhooks-demo.mp4 / .gif (the builder); tweets.md: posts and a thread, EN and ES

scripts/check-hooks.js         compiles every template and deploy script against Uniswap V4
scripts/bundle-v4-sources.js   rebuilds vendor/v4-sources.json
scripts/hook-tests/            contract behaviour, browser deploy end to end, mainnet simulation
scripts/server-tests/          the chat endpoint against a stand-in API
scripts/site-tests/            builder page, market panel, AI chat in a browser
scripts/media/                 the videos and the social card, and their sources
                               (record-launch.js renders launch-video.html frame by frame)
```

## Run it

```bash
npm install                      # once, for the AI chat
ANTHROPIC_API_KEY=… npm start    # http://localhost:8080, AI chat on
npm start                        # same, chat uses the built-in reader
```

Or serve the folder with any static host (`python3 -m http.server 8000`): everything works except
the AI chat, which quietly falls back to the built-in reader. Wallets need http(s), not `file://`.

### Deploying on Railway

Point a service at this folder (`unyhooks-site/`). Railway runs `npm start` and sets `PORT`.
Add `ANTHROPIC_API_KEY` as a variable to turn the AI chat on. `/healthz` reports whether it is on.

## The builder

Four recipes, each a Solidity template on top of v4-periphery's `BaseHook`:

| Recipe | Contract | Hook calls | What it does |
| --- | --- | --- | --- |
| Fee on every swap | `SwapFeeHook` | `afterSwap` + return delta | takes a % of the unspecified side and sends it to a fixed wallet |
| Dynamic fees | `DynamicFeeHook` | `afterInitialize`, `beforeSwap` | fee between a floor and ceiling, scaled by the tick move in a window |
| Launch protection | `LaunchGuardHook` | `afterInitialize`, `beforeSwap` | for N minutes: cap per buy, exact-input only, cooldown per `tx.origin` |
| Trading hours | `TradingHoursHook` | `beforeSwap` | swaps only inside a UTC window, optionally weekdays only |

**The chat.** With `server.js` and an API key, each request goes to Claude (`claude-opus-5-5`,
low effort, structured output). Claude only picks a recipe and fills its settings, or says what
the site can build; it never writes code. The server keeps only values that pass the recipe's
rules and merges them into the hook on screen. Replies come back in the person's language. On
a refusal, Anthropic's server-side fallback (`fallbacks: "default"`) retries on another model.
Without the server, `understand()` in `builder.js` reads keywords, percentages, addresses,
durations, amounts and times.

**Deploying.** The hook on screen is compiled in the browser with solc 0.8.26 (same compiler and
settings as the tests). Its constructor arguments are encoded, and CREATE2 salts are tried until
the address's low 14 bits equal the hook's permission flags and nothing is deployed there yet
(about 16,000 tries). The deployment is dry-run with `eth_call`, then sent through the standard
CREATE2 deployer (`0x4e59b448…956C`): one signature. The pool is created with
`PoolManager.initialize` from the pair, fee tier (or the dynamic-fee flag) and a starting price,
converted exactly to `sqrtPriceX96`. Hooks deployed from a browser are remembered there and
listed on My hooks.

**Publishing the source.** Right after a deploy, the exact standard-JSON input the hook was
compiled from goes to Sourcify (`/v2/verify/4663/<address>`, with the creation transaction),
which recompiles it and matches it against the chain. Sourcify supports Robinhood Chain and
already holds Uniswap's own contracts there; the explorer's API sits behind a bot challenge,
so it is not called directly. On failure the page offers a retry and the file to upload by hand.

**Adding liquidity.** Through Uniswap's PositionManager, the same positions the Uniswap app
shows. Type one amount and the other follows from the pool price and the range (full, or
between two prices). ERC-20s go through Permit2: `approve(Permit2)` once per token, then
`Permit2.approve(PositionManager)` for 30 days; the deposit is `modifyLiquidities` with
`MINT_POSITION` + `SETTLE_PAIR`, plus `SWEEP` to return unused ETH. Liquidity is computed with
ports of Uniswap's own `TickMath` and `LiquidityAmounts` (`pool-math.js`), a hair under what
the amounts allow, and dry-run before signing.

## Launching a token

`launch.html` sends one transaction that creates `UnyLaunch` (launch-kit.js). Its constructor:
creates `UnyToken` (fixed supply minted to itself, no owner), creates the `LaunchGuardHook` with
CREATE2 at a mined address carrying its permission bits, initializes the token/ETH pool, creates
a `LiquidityLock` if asked, mints a full-range position to the lock (or to the creator) through
the PositionManager with Permit2, sends the rest of the supply and any unused ETH back, and emits
`Launched(creator, token, hook, poolId, tokenId, lock)`. About 2.7M gas.

Every address is known before signing: the launcher is the creator's next CREATE address, the
token is the launcher's first, so the hook's constructor argument and its address follow; the
page mines the salt and dry-runs the whole launch. If the wallet sends another transaction first,
the hook's address no longer carries its bits and the launch reverts, creating nothing.

**Locks.** `LiquidityLock` holds positions until `unlockAt` (`type(uint256).max` = forever).
Anyone can send the fees to the owner (`collectFees`); the owner can only move the date later
(`extend`) and take positions back after it (`withdraw`). Positions sent with `safeTransferFrom`
announce themselves with `Locked(poolId, tokenId, owner, unlockAt)`. From My hooks, locking an
existing position is two signatures: deploy a lock through the CREATE2 deployer, move the position.

**Telling real from lookalike.** The token's and the lock's runtime code carry no immutables, so
every copy has the same code hash (`CODEHASH` in launch-kit.js, checked by `launch.test.js`). The
public page trusts a lock only if its code hash matches and the PositionManager says it holds
the position, and calls a token clean only if its code hash matches.

## Robinhood Chain

In `config.js`, each checked against the chain itself:

| | |
| --- | --- |
| Chain ID | 4663 |
| RPC | `https://rpc.mainnet.chain.robinhood.com` |
| Explorer | `https://robinhoodchain.blockscout.com` |
| PoolManager | `0x8366a39cc670b4001a1121b8f6a443a643e40951` (Uniswap's v4 deployments page) |
| StateView | `0xf3334192d15450cdd385c8b70e03f9a6bd9e673b` |
| PositionManager | `0x58daec3116aae6d93017baaea7749052e8a04fa7` |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| CREATE2 deployer | `0x4e59b44847b379578588920cA78FbF26c0B4956C` |
| USDG / WETH | `0x5fc5…d168` / `0x0Bd7…AD73` (docs.robinhood.com/chain/contracts) |

The Uniswap app links use `chain=robinhood` and `NATIVE` for ETH, read from the app's own chain
list and link builder.

## Checks

```bash
# every template and deploy script compiles (solc, v4-core, v4-periphery, forge-std)
npm i --no-save solc @uniswap/v4-core @uniswap/v4-periphery
node scripts/check-hooks.js

cd scripts/hook-tests && npm install
npm test             # 32 behaviour checks with Uniswap's PoolManager and test routers
npm run mainnet      # every recipe's deploy and pool creation, simulated on Robinhood Chain mainnet
npm run node         # then, with the site served on :8765:
npm run e2e          # 25 checks: the builder deploys from a browser wallet, then liquidity and swaps
node e2e-app.js      # 28 checks on Robinhood Chain's own contract code (copied from mainnet):
                     # deploy, source publishing, pool, liquidity (full and custom range), My hooks
npm run launch       # 39 checks: the one-transaction launch, protection, the lock (fees, dates,
                     # withdrawals), standalone locks, code hashes
node e2e-launch.js   # 45 checks in a browser: launch page, Sourcify, public page, locking from
                     # My hooks, collecting fees, taking a position back

node scripts/server-tests/chat.test.js     # 26 checks on /api/chat (after npm install)
node scripts/site-tests/builder.test.js    # needs playwright and the site on :8765
node scripts/site-tests/market.test.js
node scripts/site-tests/ai-chat.test.js
```

What they establish: the fee is exactly 1% on exact-input and exact-output swaps in both
directions; dynamic fees sit at the floor when calm, hit the ceiling after a big move and drop
back; launch protection refuses oversized, exact-output and too-frequent buys and leaves sells
alone; trading hours open and close at the right minute, past midnight and on weekends. The
browser deploys each recipe and creates its pool, swaps through the new pool pay the fee, and
on mainnet the real PoolManager accepts every recipe's pool. `e2e-app.js` copies the runtime code
of the PoolManager, PositionManager, StateView, Permit2 and CREATE2 deployer from mainnet to the
same addresses on a local chain, so the pages run with their real configuration: the source
sent to Sourcify recompiles to the deployed bytes, deposits mint real positions (unused ETH
comes back), and a swap afterwards pays the hook's fee.

`e2e` uses a local chain with Uniswap's PoolManager rather than a fork: Robinhood Chain's public
RPC keeps very little history, so a fork loses its state within a minute or two. `mainnet`
covers the real contracts with `eth_call` and state overrides, sending nothing.

## Before going live

In `config.js`:

- **`CONTRACT`** — the $UHOOKS address. Empty: "Announced at launch", copy and explorer off,
  market panel hidden. Set: the market panel appears with live data.
- **`X_HANDLE`** — `UnyHooks` is a placeholder until the account exists.
- **`BUY_URL`** — optional; by default "Buy" opens the Uniswap app on Robinhood Chain.

Elsewhere:

- **Link previews** need absolute image URLs. `server.js` rewrites `og.png` to the full URL of
  whatever host it is on. On a static host, change `content="og.png"` in each page's `og:image`
  and `twitter:image` to the full URL.
- **Sign-in** (`app.html`) keeps the signed message in the tab only; nothing verifies it on a
  server yet. Deploying does not depend on it.
- **Generated hooks are not audited.** The page says so next to every deploy.

## Design

The pirate edition: a night sea, brass and parchment, after the editorial dark style of
dynamichooks.com. The gold is the brand: the hook, the primary button, the word that lands each
headline, the glow on the water. Parchment sections read like a captain's chart.

| Token | Value | Role |
| --- | --- | --- |
| `--pink` / `--pink-grad` | `#E8B04B` / `#FBE7B0 → #E8B04B → #B57A1F` | the accent (the name is historical): mark, primary button, headline word |
| `--bg` / `--card` / `--card-2` | `#070B14` / `#0F182B` / `#0B1323` | night sea, panels, wells |
| `--ink` / `--prose` / `--muted` | `#F3EAD7` / `#BDB29C` / `#8D8576` | headings, body, labels |
| `--parch` / `--parch-ink` | `#F2E4C4` / `#24180A` | chart sections |
| `--ok` / `--red` | `#5FD3A6` / `#E5624B` | live, locked, done / cannon fire, refusals |

Trading: `swap.js` puts a buy/sell panel on a token's public page when its pool pairs it
with ETH. It quotes through Uniswap's Quoter, swaps through the Universal Router
(`V4_SWAP` with `SWAP_EXACT_IN_SINGLE`, `SETTLE_ALL`, `TAKE_ALL`), dry-runs before the
wallet signs, and explains hook refusals (launch cap, cooldown) in words. Sales go through
Permit2. Covered by `scripts/hook-tests/e2e-swap.js` against Robinhood Chain's own router
and quoter code.

The server compresses text (Brotli or gzip) and the landing loads its 3D after first paint.

3D: `scene3d.js` (built from `src/scene3d.js` with three.js, `npm run build:3d`) draws three
WebGL scenes on top of their 2D drawings: the hero's night sea (Gerstner swell, the moon and
its glitter, a galleon on the horizon) with a captain's hook rising half out of the water where the `.uh-orb`
box sits (polished steel hook, brass ferrule, leather cup with a brass band and rivets), the $UHOOKS doubloon turning in studio light, a broadside of two cast-iron cannons on a
gun deck (planked bulwark with open ports, breeching ropes, shot stacked in pyramids, a
bucket, a cask, a coiled rope, the mainmast and its shrouds, moonlight shadows and a
hanging lantern) that fire as their block scrolls into view (fuse sparks, muzzle flash, recoil, smoke,
the ball over the sea, and a shake of the page), and the sea under the closing call
with the ship sailing across. A scene only draws while its canvas is on screen; the 2D
drawing stays without WebGL, and with reduced motion one still frame is drawn.

Type: **Zilla Slab** for headlines (the last words in gold, same face), **Source Serif 4**
for text, **Pirata One** for the wordmark, **Geist Mono** for addresses and code. Labels are
plain sentence case. Every page's title is just "UnyHooks". The hero carries a "Built on
Uniswap V4" badge with Uniswap's mark (`uniswap.png`, from Uniswap's own interface repo);
the 3D doubloon has the hook and $UHOOKS on its front and the same mark struck on its back. The landing's hero is a porthole on a night
sea (moon, a ship riding the swell, a compass rose), the rail down the left is a rope the
hook is let down as you scroll, the "map" section is parchment with rhumb lines and an X on
the lock date, and a ship crosses the closing section. The mark is a pirate's hook on its cuff, drawn once as an SVG
`<symbol>` per page (`#uh-mark`, 64×80). The landing's ship, sea, cannon and doubloon are inline
SVG; the line icons (anchor, skull, cannon, chest…) are a sprite at the top of `index.html`.

## Motion

The hero ship bobs, the waves roll, cannon ports flash, the hook floats; a rope runs down the
left edge with a knot per section and the hook slides down it as the page scrolls; the ship's
log ticker scrolls; the cannon in the launch section fires while it is on screen (`landing.js`).
The demo window plays the builder back while it is visible, and sections rise in once. With
`prefers-reduced-motion` nothing moves. The scroll-reveal hidden state only applies once the
script has run, so the page renders complete without JS.

UnyHooks is an independent project and is not affiliated with Uniswap Labs or Robinhood.
