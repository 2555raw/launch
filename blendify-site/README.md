# Blendify — site

Static site for Blendify, an on-chain index protocol: pick three to five tokens, tokenized stocks
or real-world assets, set the weights, and trade the basket as one position.

No build step, no dependencies. Plain HTML, CSS and vanilla JS.

## Structure

```
index.html      the app-style landing page: tape, hero, stats, live-index board, builder, FAQ
docs.html       the docs page: sticky sidebar + reading column
article.html    the plain-language explainer
styles.css      the design system (palette, type, layout) — shared by all three pages
docs.css        docs furniture only
article.css     article furniture only
app.js          tape, board (filter/sort/search), builder, section navigation
assets/         logo marks (light is the one in use; dark is kept as a spare)
```

## Run it

Open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 8000     # then open http://localhost:8000
```

Deploy by dropping the folder on any static host (Netlify, Vercel, GitHub Pages, S3, Cloudflare Pages).

## Design

Dark and white, no third color. The ground is near-black, cards sit one step above it, and white is
the only accent — primary buttons and active states invert to white-on-black. The type carries the
personality instead of color:

| Token | Value | Role |
| --- | --- | --- |
| `--bg` / `--bg-alt` | `#08080A` / `#0B0B0E` | page ground, footer and tape |
| `--card` / `--card-hi` / `--surface` | `#101014` / `#16161B` / `#17171C` | cards, hover state, tracks |
| `--ink` / `--muted` / `--dim` | `#FFFFFF` / `#8E8E99` / `#5A5A64` | text, secondary text, micro-labels |
| `--line` / `--line-hi` | `#1E1E25` / `#2C2C35` | borders, hover borders |
| `--up` / `--down` | `#6EE7A0` / `#FF7A7A` | the only colored things on the page: 24h deltas |

Type: **Silkscreen** for the wordmark and headlines (the blocky display face), **JetBrains Mono** for
every label, number, button and ticker, **Inter** for prose. Micro-labels use the `.bl-label` class —
10.5px mono, uppercase, `0.16em` tracking — above every number on the page.

The deltas are the one exception to dark-and-white. Drop `--up` / `--down` to `var(--ink)` and
`var(--muted)` if you want the board fully monochrome.

## Interactive parts (`app.js`)

- **Ticker tape** — supported assets with sample prices. It scrolls horizontally by overflow and
  never animates on its own.
- **Live-index board** — filter tabs (all / spot only / leveraged), sort (newest, total value, 24h
  change, legs) and search by ticker or name, all client-side over the `INDEXES` array.
- **Builder** — tap an asset to add or drop it, three minimum and five maximum; weights split evenly
  and the running-cost panel updates with them.
- **Navigation** — `data-scroll="<id>"` on any element scrolls to that section, offset for the
  sticky nav.

## Animations

One fade-up on scroll, driven by native CSS scroll-driven animations (`animation-timeline: view()`),
so there is no observer code. Browsers without support land on the end state, so content is always
visible. Nothing loops and nothing marquees.

## Before going live

- **The board is sample data.** `TAPE` and `INDEXES` at the top of `app.js` are illustrative
  placeholders for layout, and the page says so under the grid. Wire both to the indexer, and drop
  the note once they are real.
- `[your fee schedule]` appears in the FAQ on `index.html` and twice in the fees table on
  `docs.html` — replace with real trading fees.
- Legal links in the footer (`#risk`, `#privacy`, `#terms`, `#fees`) are still anchors — point them
  at real pages.
- The hero curve is illustrative artwork, not a live feed; the "sample" label is there on purpose.
- The X link points at `https://x.com/useBlendify`.
