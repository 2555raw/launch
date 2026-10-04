# UnyHooks — site

Static site for **UnyHooks**, a chat app for building Uniswap V4 hooks on Robinhood Chain: you
describe what a pool should do, UnyHooks writes the hook, and you deploy it from your own wallet.

No build step, no dependencies. Plain HTML, CSS and vanilla JS.

## Structure

```
index.html   landing: hero with a "what should your pool do?" box, how it works, recipes,
             trust, $UHOOKS, FAQ, closing call
build.html   the builder: describe a hook, adjust settings, read/copy/download the contract
             and its Foundry deploy script
docs.html    docs: sidebar, one article per hash (#quickstart, #hooks…), on-this-page rail, search
app.html     sign in: connect MetaMask or Phantom and sign one message
config.js    links, X handle, token address and network details: the only file to edit
styles.css   the design system (palette, type, buttons, cards, the doorway scene)
docs.css     docs furniture only
app.css      sign-in layout only
build.css    builder layout and code view
app.js       shared: links from config, sticky nav, menu, typing prompt, copy CA, scroll reveal
docs.js      docs routing, table of contents, previous/next and search
signin.js    wallet discovery (EIP-6963 + fallbacks) and the sign-in message (EIP-4361)
builder.js   the hook writer, no DOM: understand(text) and generate(recipe, settings);
             also loads in Node for the checks below
build.js     builder page: conversation, settings form, code view, copy, download
scripts/check-hooks.js   compiles every template and deploy script against Uniswap V4
scripts/hook-tests/      deploys each template next to a real PoolManager and swaps through it
```

## The builder

Four recipes, each a Solidity template on top of v4-periphery's `BaseHook`:

| Recipe | Contract | Hook calls | What it does |
| --- | --- | --- | --- |
| Fee on every swap | `SwapFeeHook` | `afterSwap` + return delta | takes a % of the unspecified side and sends it to a fixed wallet |
| Dynamic fees | `DynamicFeeHook` | `afterInitialize`, `beforeSwap` | fee between a floor and ceiling, scaled by the tick move in a window |
| Launch protection | `LaunchGuardHook` | `afterInitialize`, `beforeSwap` | for N minutes: cap per buy, exact-input only, cooldown per `tx.origin` |
| Trading hours | `TradingHoursHook` | `beforeSwap` | swaps only inside a UTC window, optionally weekdays only |

The "chat" is a rules-based reader (`understand()` in `builder.js`): it picks the recipe from
keywords and pulls out percentages, addresses, durations, amounts and times. It is not an AI
model; anything it cannot place gets an answer listing what it can build.

### Checks

```bash
# compile every template and deploy script (solc, v4-core, v4-periphery, forge-std)
npm i --no-save solc @uniswap/v4-core @uniswap/v4-periphery
node scripts/check-hooks.js

# behaviour: 32 checks on a local chain with Uniswap's own PoolManager and test routers
cd scripts/hook-tests && npm install && npm test
```

The behaviour tests check, among others: the fee is exactly 1% on exact-input and exact-output
swaps in both directions; dynamic fees sit at the floor when calm, hit the ceiling after a big
move and drop back after the window; launch protection refuses oversized buys, exact-output
buys and repeat buys inside the cooldown while leaving sells alone; trading hours open and
close at the right minute, including windows past midnight and weekends.

## Run it

```bash
python3 -m http.server 8000     # then open http://localhost:8000
```

Opening `index.html` straight from disk works for the landing and docs. Wallet sign-in needs the
page served over http(s), since wallets do not inject into `file://` pages.

## Before going live

Everything below is in `config.js`:

- **`CONTRACT`** — empty until the token exists. While it is empty the page reads "Announced at
  launch" and the copy and explorer buttons stay off.
- **`NETWORK`** — chain id, RPC, explorer and PoolManager for Robinhood Chain. Empty fields show
  as "—" in the docs; with `chainId` set, sign-in asks the wallet to switch chains.
- **`APP_URL`** — points at `build.html`, the builder. Swap it for the real app's URL if it moves;
  the footer then shows its host name. `SIGNIN_URL` is the wallet sign-in page.
- **`X_HANDLE`** — `UnyHooks` is a placeholder until the account exists.

Sign-in has **no backend yet**: the signature is kept in `sessionStorage` for the tab and is not
verified. Once the workspace exists, send the message and signature to the server, verify them
there and issue the session from that.

The docs describe the product as it is meant to work (chat, in-browser compile, address mining,
pools). Check each page against the real app before launch.

## Design

A blush-white ground, near-black display type and one hot pink. The pink is the brand: the mark,
the primary button, the word that lands each headline, and the glow behind the panels.

| Token | Value | Role |
| --- | --- | --- |
| `--pink` / `--pink-grad` | `#EC1586` / `#E5127D → #FF7CC2` | mark, primary button, headline accent |
| `--pink-soft` / `--pink-line` | `#FFE6F2` / `#FBCDE3` | chat bubble, tags, active states |
| `--bg` / `--bg-tint` / `--card` | `#FFF9FC` / `#FFF2F8` / `#FFFFFF` | page, tinted band, cards |
| `--ink` / `--prose` / `--muted` | `#0F0B12` / `#5D5563` / `#8E8494` | headings, body, labels |
| `--ok` | `#0C9F6B` | "Compiles" and "Live" badges only |

Type: **Inter** for everything, **JetBrains Mono** for addresses and code.

The mark is a U whose right stem curls into a hook, drawn once as an SVG `<symbol>` per page.
The hero picture (a doorway onto a pink sky with the mark pressed into the wall) is pure CSS,
with no images.

## Motion

The hero prompt types through a few example requests; sections rise in once on scroll. With
`prefers-reduced-motion` the prompt stays still on its first line and nothing animates. The
hidden state for the scroll reveal only applies once the script has run, so the page still
renders complete without JS.

UnyHooks is an independent project and is not affiliated with Uniswap Labs or Robinhood.
