# Bonded — site

Static site for **Bonded**, a launchpad where a new token is paired ("bonded") with a tokenized
stock from its first block: one pool, liquidity locked at deploy, price quoted in the share instead
of in ETH. Same mechanics as the stock-paired launchpads already out there (pairpop, Levity, PAIR);
different face, and every screen those sites have.

No build step, no dependencies. Plain HTML, CSS and vanilla JS.

## Structure

```
index.html       the landing: the falls (hero), proof strip, how it works, why a stock, the stocks
                 table, live pairs, verify, FAQ, closing call
board.html       Pairs: every pair, with tabs (all / new / trending / top), stock chips, search and
                 sort; table on desktop, cards on mobile; reads ?stock= and ?q=
pair.html        one pair: price in its stock, chart (1H / 24H / 7D), stats, about, live trades,
                 and the buy / sell panel with quote, impact, fee and min received; reads ?t=
live.html        Live launches: a real-time feed of launches, buys and sells, plus "just bonded"
stocks.html      Stocks: every stock you can bond to, with a detail panel per stock; reads ?s=
launch.html      the three-step launch: pick the stock, name the token, review and sign
playground.html  My playground: your launches, creator fees, and your positions
docs.html        the docs: bonds, launching, trading, fees, what is locked, contracts, integrate
styles.css       the design system (palette, type, layout, the scene) and the responsive rules
app.js           CONFIG, sample data, the adapter, the falls, and the behaviour of every page
server.js        a dependency-free static server for Railway (PORT, /health, extensionless paths)
package.json     the start script Railway runs
```

## Run it

Open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 8000     # then open http://localhost:8000
```

Deploy by dropping the folder on any static host (Netlify, Vercel, GitHub Pages, S3, Cloudflare
Pages), or on Railway with this folder as the root directory: it runs `node server.js`.

## The idea

The layout is the one that works for this category: a huge centred headline, one black button,
the contract address under it, two floating navigation pills, and a scene around the copy that
people can play with. The scene is where Bonded differs.

**Fish instead of balloons.** Each tokenized stock is a fish, in its company's colour, with the
company's logo on its side. Behind it: a sky with sun rays and drifting clouds, two cliffs, and the
water itself in layers (a sheet, two speeds of streaks, a lip at the top, mist and spray where it
lands), warped by an SVG turbulence filter so it never repeats exactly. Two waterfalls run down the sides of the hero into a pond along the bottom. A fish falls
down one of the falls, lands with a splash, swims slowly for about six seconds, sinks, and comes
back over the top to fall again. Grab one with the mouse or a finger: drop it in the pond and it
swims, drop it in the air and it falls. Click one and the headline reprices in that stock and the
launch button carries it. `Pause motion` freezes the scene, `Reset` reshuffles it.

A balloon pops and floats away; a fish keeps swimming. That is the whole pitch, and it is why the
falls replace the balloons rather than restyle them.

## Design

A pale sky, always. (A dark token set is kept in the stylesheet under `html[data-theme="dark"]`, unused; there is no switch.) Two roles keep their colours across the whole site:

- **Gold `#F0B35B` is the stock**: the stock tags, the active tile, the "Trade" button, the stock
  side of every quote.
- **Ion cyan `#5DE1FF` is the new token**: the token side, "new" badges, links, the active step.
- The primary button is ink, like the reference sites.
- Green and red are reserved for market direction and for Buy / Sell.
- Each fish is painted in its company's colour (NVIDIA green, Tesla red, Amazon orange, Robinhood
  lime, and so on) and carries the company's real logo on a white badge. Nine of the marks come from
  the `simple-icons` package, embedded as paths in `LOGOS` in `app.js`; Amazon, Microsoft and the
  S&P are drawn by hand there. **These are registered trademarks.** Using them on a launchpad is a
  choice the owner of the site makes, not the site; swap a badge for its ticker by deleting its
  `LOGOS` entry.

| Token | Light | Dark (unused) | Role |
| --- | --- | --- | --- |
| `--bg` / `--bg-alt` | `#EEF5FC` / `#E3EEF9` | `#0A0C10` / `#0E1117` | page ground and bands |
| `--card` / `--surface` | `#FFFFFF` / `#E6EEF7` | `#12161E` / `#1D232F` | cards, tracks |
| `--ink` / `--prose` / `--muted` / `--dim` | `#131720` / `#3A4353` / `#6B7688` / `#98A2B3` | `#F2F5F9` / `#C3CAD6` / `#8B95A7` / `#5F6878` | text levels |
| `--gold-text` / `--ion-text` | `#9A6410` / `#0083A6` | `#F0B35B` / `#5DE1FF` | the two roles as small text |
| `--water-1..3` | `#9CCBEF` `#5EA7DF` `#3C86C4` | `#163A5C` `#10304F` `#0B2239` | the falls and the pond |

Type: **Space Grotesk** for display, **Inter** for body, **JetBrains Mono** for figures, tickers and
labels. Prices are shares per token with the leading zeros compressed (`0.0₅42` = `0.0000042`), and
the USD reference next to them.

## Wiring the chain

The pages never touch data directly. Everything goes through `Bonded.adapter` and `CONFIG`, both
at the top of `app.js`.

**1. Fill in `CONFIG`:** chain, explorer base URL, creation fee, swap fee and creator share (as text
and as rates), factory and protocol-token addresses, and the lock / factory / X links. Every
element with `data-cfg="…"` or `data-cfg-href="…"` prints the matching value.

**2. Replace the adapter.** Define `window.BONDED_ADAPTER` in a script tag *before* `app.js`, or edit
`mockAdapter` in place:

```js
window.BONDED_ADAPTER = {
  async stats()             { return { pairs, volumeUsd, lockedUsd }; },
  async stocks()            { return [{ sym, name, price, pairs, z, color, change }]; },   // price in USD
  async pairs()             { return [{ name, ticker, stock, mcap, volume, change, holders, createdAt, address, desc, creator, image, x, site }]; },
  async pair(ticker)        { return { ...pair, liquidityUsd, series, trades }; },
  async connect()           { return { address }; },
  async createPair(payload) { return { txHash, tokenAddress, pairAddress }; },   // the factory call
  async quote({ ticker, side, amount })          { return { out, priceImpact, fee, feeUnit }; },
  async swap({ ticker, side, amount, wallet })   { return { txHash, trade }; },  // the router call
  async holdings(address)   { return [{ ticker, amount }]; },
  async launched(address)   { return [ticker]; },
  subscribe(onEvent)        { /* onEvent({ kind: 'launch'|'buy'|'sell', pair, amountStock, amountToken, wallet, ts }) */ return unsubscribe; },
};
```

`mcap`, `volume` and `liquidityUsd` are USD; `change` is a 24h percentage; `createdAt` and `ts` are
millisecond timestamps; `series` is prices in shares per token, oldest first (the pair page shows
the last 8 / 24 / all points as 1H / 24H / 7D); `trades` is newest first. Buy amounts are in the
stock token, sell amounts in the token. The mock keeps a constant-product pool implied by the
market cap, so quotes and impact behave like a real pool.

The mock `connect()` already calls `window.ethereum.request({ method: 'eth_requestAccounts' })`
when a wallet extension is present, and falls back to a demo address otherwise. The connection is
remembered for the tab in `sessionStorage`, so it survives page changes.

**What the mock remembers.** Pairs you launch and positions you buy are kept in `localStorage`
(`bonded-launched`, `bonded-holdings`), so the whole loop works in a browser without a chain:
launch → the pair page → buy and sell → My playground → the board and the live feed. Clear site
data to reset it.

## Interactive parts (`app.js`)

- **The falls** (`falls()`): a `requestAnimationFrame` loop over the twelve fish with four states
  (fall, swim, sink, rise) plus drag. Positions are written as CSS custom properties on each fish,
  transforms do the rest. The loop pauses when the hero is off screen or the tab is hidden, and
  under `prefers-reduced-motion` the fish sit in the pond, still clickable.
- **Navigation** — two pills; the left one drops its links below on mobile. `data-scroll="<id>"`
  scrolls with the nav height taken out; hash links from other pages land correctly.
- **Pairs board** — filters compose: tab × stock chip × search, then sort. Column headers sort and
  flip on a second click. Rows open the pair page. New launches from the feed appear live.
- **Pair page** — chart from `series`, trades from `trades` plus live ones from `subscribe`, and the
  trade panel: Buy / Sell tabs, quick amounts (stock amounts to buy, percentages of your holding to
  sell), quote with impact, fee and min received, holding line, inline errors. A swap updates the
  price, market cap, volume, holders, your holding and the trades table, and shows a toast.
- **Live launches** — the feed is seeded from recent trade history so it is never empty, then
  `subscribe` prepends events (capped at 60). "Just bonded" re-renders on each launch event.
- **Stocks** — tiles plus a detail panel with pairs, volume, liquidity, busiest pairs, and buttons
  to launch on or filter by that stock. The URL follows the selection.
- **Launch** — three panels, validation (name length, ticker 2 to 8 alphanumerics, not a stock
  symbol, not already bonded, https image, non-negative first buy), live preview, wallet connect,
  `createPair`, then a link straight to the new pair page.
- **My playground** — connect card, then summary tiles (positions value, pairs held, launched,
  creator fees), launched pairs with a claim button, and a positions table with Trade links.
- **Docs** — sticky sidebar with the active section marked.

## Before going live

- **Every number is sample data**: stats, stock prices, pairs, trades, the live feed, creator fees.
  The footer says so until the adapter is wired.
- `CONFIG` is placeholder: zero addresses, `#` links, `Base` as the chain and `0.002 ETH` as the fee.
- The trust claims (liquidity locked with no withdraw path, fixed supply, no mint, ownership
  renounced, verified source) describe the intended contract. Confirm each one against the deployed
  factory before publishing; delete any that does not hold. The docs page repeats them.
- The FAQ and docs notes on securities are plain-language notes, not legal advice.
- The name is still open. "Bonded" was chosen for the chemical-bond metaphor of the first draft;
  with the falls and the fish, names in the water family (Pond, Shoal, Koi, Cascade) fit the scene
  better. Check domain and trademark collisions in crypto before committing to any of them.
