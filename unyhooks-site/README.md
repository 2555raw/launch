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
             three deploy steps (connect, deploy hook, create pool)
docs.html    docs: sidebar, one article per hash (#quickstart, #hooks…), on-this-page rail, search
app.html     sign in: connect MetaMask or Phantom and sign one message
config.js    links, token, network and contract addresses: the only file to edit

builder.js   the hook writer, no DOM: understand(text), generate(recipe, settings), highlight();
             also loads in Node for the checks
build.js     builder page: conversation (AI first, built-in reader as fallback), settings, code view
deploy.js    deploy steps: compile, mine the hook address, dry-run, deploy, create the pool
wallet.js    wallet discovery (EIP-6963 + fallbacks), connect, switch to Robinhood Chain
compile-worker.js   solc 0.8.26 (WebAssembly, from jsDelivr) in a worker
vendor/v4-sources.json   the Uniswap V4 files the templates import, for the in-browser compiler
token.js     live $UHOOKS market panel (DexScreener, GeckoTerminal, Blockscout)
demo.js      the demo window on the landing page
app.js       shared: links from config, sticky nav, menu, typing prompt, copy CA, scroll reveal
docs.js      docs routing, table of contents, previous/next and search
signin.js    sign-in message (EIP-4361) for app.html
styles.css / build.css / docs.css / app.css   design system and per-page layout

server.js    serves the site, POST /api/chat (Claude), absolute og:image URLs, /healthz
og.png       the 1200×630 link-preview image
media/       unyhooks-demo.mp4 (1080p, 36 s) and unyhooks-demo.gif, for posting

scripts/check-hooks.js         compiles every template and deploy script against Uniswap V4
scripts/bundle-v4-sources.js   rebuilds vendor/v4-sources.json
scripts/hook-tests/            contract behaviour, browser deploy end to end, mainnet simulation
scripts/server-tests/          the chat endpoint against a stand-in API
scripts/site-tests/            builder page, market panel, AI chat in a browser
scripts/media/                 the demo video and the social card, and their sources
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
converted exactly to `sqrtPriceX96`. The last step links to Uniswap's new-position page with the
pair, fee and hook filled in. Hooks deployed from a browser are remembered there, so a reload
keeps the pool step.

## Robinhood Chain

In `config.js`, each checked against the chain itself:

| | |
| --- | --- |
| Chain ID | 4663 |
| RPC | `https://rpc.mainnet.chain.robinhood.com` |
| Explorer | `https://robinhoodchain.blockscout.com` |
| PoolManager | `0x8366a39cc670b4001a1121b8f6a443a643e40951` (Uniswap's v4 deployments page) |
| StateView | `0xf3334192d15450cdd385c8b70e03f9a6bd9e673b` |
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
on mainnet the real PoolManager accepts every recipe's pool.

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

A blush-white ground, near-black display type and one hot pink. The pink is the brand: the mark,
the primary button, the word that lands each headline, and the glow behind the panels.

| Token | Value | Role |
| --- | --- | --- |
| `--pink` / `--pink-grad` | `#EC1586` / `#E5127D → #FF7CC2` | mark, primary button, headline accent |
| `--pink-soft` / `--pink-line` | `#FFE6F2` / `#FBCDE3` | chat bubble, tags, active states |
| `--bg` / `--bg-tint` / `--card` | `#FFF9FC` / `#FFF2F8` / `#FFFFFF` | page, tinted band, cards |
| `--ink` / `--prose` / `--muted` | `#0F0B12` / `#5D5563` / `#8E8494` | headings, body, labels |
| `--ok` | `#0C9F6B` | "Compiles", "Live", done steps, price up |

Type: **Inter** for everything, **JetBrains Mono** for addresses and code. The mark is a U whose
right stem curls into a hook, drawn once as an SVG `<symbol>` per page. The hero picture is pure
CSS.

## Motion

The hero prompt types through example requests, the demo window plays the builder back while it
is on screen, and sections rise in once on scroll. With `prefers-reduced-motion` nothing moves:
the prompt shows its first line and the demo its finished first scene. The scroll-reveal hidden
state only applies once the script has run, so the page renders complete without JS.

UnyHooks is an independent project and is not affiliated with Uniswap Labs or Robinhood.
