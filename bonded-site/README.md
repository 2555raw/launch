# Bonded — site

Static site for **Bonded**, a launchpad where a new token is paired ("bonded") with a tokenized
stock from its first block: one pool, liquidity locked at deploy, price quoted in the share instead
of in ETH. Same mechanics as the stock-paired launchpads already out there (pairpop, Levity, PAIR);
different face, and every screen those sites have.

No build step, no dependencies. Plain HTML, CSS and vanilla JS.

## Structure

```
index.html       the landing: the pond (hero), pick a pair, how it works, why a stock, verify, FAQ
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
server.js        a dependency-free static server for Railway (PORT, /health, extensionless paths,
                 no-cache on html/css/js so a deploy is live at once)
package.json     the start script Railway runs
```

The pages load `styles.css?v=N` and `app.js?v=N`. Bump `N` in all eight pages when you change
either file, so browsers that cached the old copy pick up the new one.

## Run it

Open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 8000     # then open http://localhost:8000
```

Deploy by dropping the folder on any static host (Netlify, Vercel, GitHub Pages, S3, Cloudflare
Pages), or on Railway with this folder as the root directory: it runs `node server.js`.

## The idea

The layout is the one that works for this category: a huge centred headline in Poppins, one black
button, the floating navigation pill with the contract bar under it (ticker, address, Copy, the
chain chip), a one-line bridge ("A coin can start with a joke…") into the pairs, and a scene behind the whole page that people can play with, the
way Levity floats its sky and small balloons through the entire scroll.

**A pond behind everything.** A fixed layer under every page draws a green pond: layered water,
two drifting sheets of caustic light, a shimmer warped by an SVG turbulence filter, cloud
reflections crossing slowly, reeds swaying on both banks, lily pads (SVG, veined, some with a pink
lotus) that drift and turn, duckweed around them, motes on the surface and a ring somewhere every
second or so. Content sits straight on it in white cards.

**Frogs, and flies.** Each tokenized stock is a frog, seen from above, in its company's colour with
the company's logo as a large mark on its back (the four-colour Google G, the Microsoft squares,
the white Apple, and so on, the same marks the reference site puts on its balloons). The twelve big ones live in the hero: they sit, pick a spot (one time in five
a lily pad), turn, hop in an arc, squash on landing, keep out of the copy, and can be grabbed and
dropped anywhere; click one and the headline reprices in that stock. Small ones hop about on the
pond behind every page. Flies buzz over the water, and any frog with a fly in reach shoots its
tongue out, eats it and gulps; the fly comes back somewhere else a few seconds later.
`Pause motion` freezes the whole pond, `Reset` reshuffles the hero.

## Design

Green water under white cards, always. (A dark token set is kept in the stylesheet under `html[data-theme="dark"]`, unused; there is no switch.) Two roles keep their colours across the whole site:

- **Gold `#F0B35B` is the stock**: the stock tags, the active tile, the "Trade" button, the stock
  side of every quote.
- **Ion cyan `#5DE1FF` is the new token**: the token side, "new" badges, links, the active step.
- The primary button is ink, like the reference sites.
- Green and red are reserved for market direction and for Buy / Sell.
- The ground is the pond, in greens (`#A9D7C8` → `#5E9D8A`), never blue. Cards are white with a
  soft shadow; section labels get a white pill so they read on the water.
- Each frog is painted in its company's colour (NVIDIA green, Tesla red, Amazon orange, Robinhood
  lime, pale grey for Google and Microsoft so their colour marks read, and so on) and carries the
  company's logo as a mark on its back, light on dark skins and dark on light ones (`mark` in
  `LOGOS` overrides the guess; `color` keeps a multi-colour mark as is). Twelve of the marks come
  from the `simple-icons` package, embedded as paths in `LOGOS` in `app.js`; Google, Amazon,
  Microsoft and the S&P are drawn by hand there. **These are registered trademarks.** Using them on a launchpad is a
  choice the owner of the site makes, not the site; swap a badge for its ticker by deleting its
  `LOGOS` entry.

| Token | Light | Dark (unused) | Role |
| --- | --- | --- | --- |
| `--bg` / `--bg-alt` | `#FFFFFF` / `#F6F8FB` | `#0A0C10` / `#0E1117` | page ground and bands |
| `--card` / `--surface` | `#FFFFFF` / `#EEF2F7` | `#12161E` / `#1D232F` | cards, tracks |
| `--ink` / `--prose` / `--muted` / `--dim` | `#131720` / `#3A4353` / `#6B7688` / `#98A2B3` | `#F2F5F9` / `#C3CAD6` / `#8B95A7` / `#5F6878` | text levels |
| `--gold-text` / `--ion-text` | `#9A6410` / `#0083A6` | `#F0B35B` / `#5DE1FF` | the two roles as small text |

Type: **Poppins** for the navigation bar and the footer name (after the reference), **Space Grotesk**
for display, **Inter** for body, **JetBrains Mono** for figures, tickers and labels. Prices are shares per token with the leading zeros compressed (`0.0₅42` = `0.0000042`), and
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

- **The frogs** (`frogs()`): a `requestAnimationFrame` loop over the twelve frogs. Each is idle
  (a countdown), hopping (an eased move from A to B with height `sin(πt)`, written to `--h`, which
  scales the frog up and pushes its shadow out) or being dragged. Targets are picked inside the
  hero, outside the copy's rectangle, with a clear straight path, not on top of another frog, and
  one time in five on a lily pad. Leg kicks, the landing squash, blinking and the throat are CSS
  animations keyed to the state classes. The loop pauses when the hero is off screen or the tab is
  hidden; under `prefers-reduced-motion` the frogs sit still, still clickable.
- **The pond** (`lake`): built by the script on every page and prepended to `.bd`, so the eight
  pages share it without markup. Pad positions come from a fixed seed, so moving between pages does
  not reshuffle them. It owns the flies (`lake.flies`, `lake.nearestFly`, `lake.eat`) and the little
  frogs; `tongue()` draws a strike in any container. `Pause motion` in the hero pauses it all.
- **Quality pass**: `/impeccable` (a project skill in `.claude/skills/impeccable/`) parses the
  scripts, cross-checks ids and links, and drives every page and the launch → trade → playground
  loop in Chromium. Run it before a deploy.
- **Navigation** — two pills; the left one drops its links below on mobile. `data-scroll="<id>"`
  scrolls with the nav height taken out; hash links from other pages land correctly.
- **Pair cards** (`pairTile`) — the reference's card shape with the frog kept: the stock's frog on a
  pale panel with its colour glowing behind it, ticker and age in the corners; name with an "On the
  board" pill, "TICKER · priced in <stock>", a bar with the price in the stock and the share of
  supply held, and the 24h line with its change. Used on the home ("Pick a pair", right under the
  hero), the board on phones, live launches and the playground.
- **How it works** — three steps illustrated with the frogs themselves (`illus` in the home block):
  four frogs with one chosen, the coin's card being typed, a frog bonded to a coin under LOCKED.
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
- **My playground** — connect card, then summary tiles (positions value, pairs held, launched,
  creator fees), launched pairs with a claim button, and a positions table with Trade links.
- **Docs** — sticky sidebar with the active section marked.

Selecting text highlights in the pond's green (`::selection`).

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
