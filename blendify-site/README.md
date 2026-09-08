# Tricker — site

Static site for Tricker: pick three to five of the assets everyone already watches, set the weights,
and trade the whole thing as one position. A basket is called a **bag** throughout the site (an
on-chain index, in the technical sense — the docs anchor that once).

No build step, no dependencies. Plain HTML, CSS and vanilla JS.

## Structure

```
index.html      the market page: tape, hero, stats, live-bag board, builder, FAQ
docs.html       the docs page: sticky sidebar + reading column
article.html    the plain-language explainer
styles.css      the design system (palette, type, layout) — shared by all three pages
docs.css        docs furniture only
article.css     article furniture only
app.js          assets and their icons, tape, board (filter/sort/search), builder, navigation
assets/         the slash mark as a square avatar, dark and light, plus avatar-source.html,
                the page they are rendered from; the dark one is also the favicon
```

## Run it

Open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 8000     # then open http://localhost:8000
```

Deploy by dropping the folder on any static host (Netlify, Vercel, GitHub Pages, S3, Cloudflare Pages).

## Design

A matte grey ground, heavy display type, and one loud move: every ticker is set in neon white.
Colour on the page belongs to the assets themselves — each carries its own brand hue in its icon,
and nothing else competes with it.

| Token | Value | Role |
| --- | --- | --- |
| `--bg` / `--bg-alt` | `#35353B` / `#2E2E34` | page ground, footer and tape |
| `--card` / `--card-hi` / `--surface` | `#3C3C44` / `#45454E` / `#2B2B31` | cards, hover state, tracks |
| `--ink` / `--muted` / `--dim` | `#FFFFFF` / `#B7B4C0` / `#918E9B` | text, secondary text, micro-labels |
| `--line` / `--line-hi` | `#4B4B55` / `#5F5F6B` | borders, hover borders |
| `--neon` + `--neon-glow` | white + a two-stop glow | tickers only, via `.bl-neon` |
| `--up` / `--down` | `#5BE38B` / `#FF6B6B` | 24h deltas |

Type: **Archivo Black** for the wordmark and every headline, **Space Grotesk** for prose,
**JetBrains Mono** for numbers, tickers and labels. Micro-labels use `.bl-label` — 10.5px mono,
uppercase, `0.16em` tracking — above every number on the page.

## Assets and their icons (`app.js`)

`ASSETS` is the single source of truth: 19 entries, each with a display name, its brand colour, a
sample price and its icon. Icons are **drawn in code, not fetched** — a 24×24 glyph or shape tinted
with the asset's own colour:

- Crypto uses its Unicode currency glyph (`₿`, `Ξ`, `◎`, `Ð`, `₳`).
- Everything else is a small drawing of the thing itself — a chip, a car, a phone, a monitor, a
  parcel, a magnifier, a speech bubble, a play button, a bar of gold, a droplet of crude.

They are deliberately not company logos: a logo is someone else's trademark, and a hand-drawn set
stays consistent across the board. Adding an asset means one entry in `ASSETS` plus its ticker in
`TAPE`, `CATALOG` or a bag's `legs`.

## Interactive parts (`app.js`)

- **Ticker tape** — the assets with sample prices. Scrolls horizontally by overflow, never animates.
- **Live-bag board** — filter tabs (all / spot only / leveraged), sort (newest, total value, 24h
  change, legs) and search, which matches bag names, tickers and the assets inside them.
- **Builder** — tap an asset to add or drop it, three minimum and five maximum; weights split evenly,
  each bar filling in that asset's colour, and the running-cost panel follows.
- **Navigation** — `data-scroll="<id>"` on any element scrolls to that section, offset for the nav.

## Animations

One fade-up on scroll via native CSS scroll-driven animations (`animation-timeline: view()`), so
there is no observer code. Browsers without support land on the end state. Nothing loops.

## Before going live

- **The board is sample data.** `ASSETS` prices and the `BAGS` array are illustrative placeholders,
  and the page says so under the grid. Wire both to the indexer, then drop the note.
- `[your fee schedule]` appears in the FAQ on `index.html` and twice in the fees table on `docs.html`.
- Legal links in the footer (`#risk`, `#privacy`, `#terms`, `#fees`) are still anchors.
- The X handle `@useTricker` is a placeholder.
- The hero curve is illustrative artwork, not a live feed; the "sample" label is there on purpose.
