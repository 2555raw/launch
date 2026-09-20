# Bonded — site

Static site for **Bonded**, a launchpad where a new token is paired ("bonded") with a tokenized
stock from its first block: one pool, liquidity locked at deploy, price quoted in the share instead
of in ETH. Same mechanics as the stock-paired launchpads already out there; different face.

No build step, no dependencies. Plain HTML, CSS and vanilla JS.

## Structure

```
index.html   the landing: status strip, hero with the molecule and a live pair card, proof strip,
             how it works, why a stock, the table of stocks, live pairs, verify, FAQ, closing call
board.html   every pair: tabs (all / new / trending / top), stock chips, search, sort, table on
             desktop and cards on mobile; reads ?stock= and ?q= from the URL
launch.html  the three-step launch: pick the stock, name the token, review and sign, with a live
             preview of the pair card; reads ?stock= from the URL
styles.css   the design system (palette, type, layout) and the responsive rules, shared by all three
app.js       CONFIG, sample data, the adapter, and the behaviour of the three pages
server.js    a dependency-free static server for Railway (PORT, /health, extensionless /board and /launch)
package.json the start script Railway runs
```

## Run it

Open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 8000     # then open http://localhost:8000
```

Deploy by dropping the folder on any static host (Netlify, Vercel, GitHub Pages, S3, Cloudflare
Pages), or on Railway with this folder as the root directory: it runs `node server.js`.

## The idea

The metaphor is a **chemical bond**. Two atoms share electrons; a stock and a new token share a
pool. It is the one metaphor that explains the product on its own, and it is the reason for the
name: a bond is a pair, a bond is what locks the liquidity, and "bonded" is what your token is.

It replaces the floating-balloon look of the reference site on purpose. A balloon pops, deflates
and drifts away, which in crypto reads as bubble, rug and pump; a bond is the opposite claim.

## Design

Graphite lab ground, two element colours, one gradient.

- **Gold `#F0B35B` is the stock.** The heavy element, the real-world asset. It appears on the
  big atom, the stock tags, the element tiles when selected, the step numbers and the "Trade"
  button.
- **Ion cyan `#5DE1FF` is the new token.** The light element, the thing you launch. It appears on
  the small atom, the primary button, links, the "new" badge and the active step.
- **The bond** is the only gradient on the page: gold to cyan, on the line between the atoms and on
  the top rule of the closing card.
- Everything else is neutral, so the two roles stay legible at a glance. Green and red are reserved
  for market direction.

| Token | Dark | Light | Role |
| --- | --- | --- | --- |
| `--bg` / `--bg-alt` | `#0A0C10` / `#0E1117` | `#F5F7FB` / `#ECF0F6` | page ground and alternating bands |
| `--card` / `--card-hi` / `--surface` | `#12161E` / `#171C26` / `#1D232F` | `#FFFFFF` / `#F7F9FC` / `#E6EBF3` | cards, hover, tracks |
| `--ink` / `--prose` / `--muted` / `--dim` | `#F2F5F9` / `#C3CAD6` / `#8B95A7` / `#5F6878` | `#131720` / `#3A4353` / `#6B7688` / `#98A2B3` | text levels |
| `--gold` / `--gold-text` | `#F0B35B` | `#F0B35B` / `#9A6410` | the stock |
| `--ion` / `--ion-text` | `#5DE1FF` | `#5DE1FF` / `#0083A6` | the token |
| `--up` / `--down` | `#3DDC97` / `#FF6B7A` | `#14935F` / `#D6303F` | market direction |

The `-text` variants exist for contrast: gold and cyan as fills are fine in both themes, but as
small text on the light ground they fall below 4.5:1, so type drops to the darker pair.

Type: **Space Grotesk** for display, **Inter** for body, **JetBrains Mono** for figures, tickers and
labels. Micro-labels use `.bd-label` — 10.5px mono, uppercase, `0.16em` tracking.

Stocks are shown as **element tiles** (symbol, name, price, number of pairs, an atomic number in
the corner) rather than as brand logos. Tickers are not trademarks; logos are, and logos also make
a launchpad look like a fan site.

Prices are shown as **shares per token**, with the leading zeros compressed the way trading UIs do
it (`0.0₅42` means `0.0000042`), and the USD reference next to them.

## Wiring the chain

The pages never touch data directly. Everything goes through `Bonded.adapter`, an object with five
async methods, and `CONFIG`, a block of protocol facts at the top of `app.js`.

**1. Fill in `CONFIG`:** chain name, explorer base URL, creation fee, swap fee and creator share,
factory and protocol-token addresses, and the docs / X / lock / factory links. Every element with
`data-cfg="…"` or `data-cfg-href="…"` prints the matching value.

**2. Replace the adapter.** Define `window.BONDED_ADAPTER` in a script tag *before* `app.js` (or
edit `mockAdapter` in place). The shape:

```js
window.BONDED_ADAPTER = {
  async stats()   { return { pairs, volumeUsd, lockedUsd }; },
  async stocks()  { return [{ sym, name, price, pairs, z }]; },          // price in USD
  async pairs()   { return [{ name, ticker, stock, mcap, volume, change, holders, createdAt, address }]; },
  async connect() { return { address }; },                              // wallet
  async createPair({ stock, name, ticker, desc, image, buy, x, site, supply, creator }) {
    return { txHash, tokenAddress, pairAddress };                        // the factory call
  },
};
```

`mcap` and `volume` are USD, `change` is a 24h percentage, `createdAt` is a millisecond timestamp.
The pages derive the price in shares from `mcap / CONFIG.supply / stock.price`; if your protocol
exposes the pool price directly, return it as an extra field and swap the two one-line helpers
`priceUsd` and `priceShares`.

The mock `connect()` already calls `window.ethereum.request({ method: 'eth_requestAccounts' })`
when a wallet extension is present, and falls back to a demo address when it is not. The mock
`createPair()` waits a moment and returns fabricated addresses; that is where the factory call
goes.

The "Trade" button on the board links to the pair address on the explorer. Point it at your swap
route when you have one.

## Interactive parts (`app.js`)

- **Theme** — dark by default, switch with `localStorage` memory (wrapped in `try/catch`).
- **Navigation** — `data-scroll="<id>"` scrolls to a section with the nav height taken out; an
  `IntersectionObserver` marks the active link; hash links from other pages land correctly.
- **Hero** — clicking a stock tile in "Pick your element" re-labels the big atom, the headline and
  the closing line, and swaps the floating pair card to the busiest pair on that stock.
- **Board** — filters compose: tab × stock chip × search, then sort. Column headers sort too and
  flip direction on a second click. Below 900px the table becomes the same cards as the home.
- **Launch** — three panels and a stepper. Step 2 validates (name length, ticker 2 to 8
  alphanumerics, not a stock symbol, https image, non-negative first buy) and shows all problems at
  once. The preview card and the molecule follow the form live. The deploy button connects the
  wallet if needed, then calls `adapter.createPair`; errors surface inline, success shows the
  addresses and the explorer link.

## Animation

Electrons orbit the atoms and the bond pulses, on CSS only and only under
`prefers-reduced-motion: no-preference`. Sections rise once on scroll (`.bd-rise`), scoped to
`.bd-js` so the page renders complete without JavaScript.

## Before going live

- **Every number is sample data**: the strip, the proof grid, the stock prices, the pairs and the
  element counts. The footer says so until the adapter is wired.
- `CONFIG` is placeholder: zero addresses, `#` links, `Base` as the chain and `0.002 ETH` as the fee.
- The trust claims (liquidity locked with no withdraw path, fixed supply, no mint, ownership
  renounced, verified source) describe the intended contract. Confirm each one against the deployed
  factory before publishing; delete any that does not hold.
- The FAQ answer on securities is a plain-language note, not legal advice. Have it reviewed.
- Check name and domain availability (`bonded.fun`, `bonded.trade`) and search for trademark
  collisions in crypto before committing to the name.
