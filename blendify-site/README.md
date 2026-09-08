# Blendify — landing page

Static landing page for Blendify, an on-chain index protocol: pick three to five tokens,
tokenized stocks or real-world assets, set the weights, and trade the basket as one asset.

No build step, no dependencies. Plain HTML, CSS and vanilla JS.

## Structure

```
index.html                 all the markup, one page
styles.css                 the whole design system (palette, layout, animations)
app.js                     builder, trade sizing, calculators, nav, cursor trail
assets/blend-logo.png      logo mark (dark, kept as the favicon)
assets/blend-logo-light.png  logo mark (light — used everywhere on the grey ground)
```

## Run it

Open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 8000     # then open http://localhost:8000
```

Deploy by dropping the folder on any static host (Netlify, Vercel, GitHub Pages, S3, Cloudflare Pages).

## Palette

Matte grey ground, pink and purple accents. All colors live in one place — the `.bl-root`
block at the top of `styles.css`:

| Token | Value | Role |
| --- | --- | --- |
| `--bg` / `--bg-alt` / `--surface` | `#2C2B31` / `#26252B` / `#38373F` | matte grey backgrounds |
| `--card` | `#33323A` | cards, panels, the hero chart plate |
| `--ink` | `#F5F2F8` | text on the grey |
| `--muted` | `#A8A2B4` | secondary text |
| `--line` | `#48464F` | borders |
| `--yellow` | `#FF5FC7` | pink accent (buttons, highlights, statement band) |
| `--red` | `#7C5CFF` | violet secondary |
| `--green` | `#A16BFF` | purple tertiary |

The variable names are historical (they carried over from earlier palettes); the values are what
matter. Change `--yellow` and the whole page re-tints. Anything sitting *on* an accent uses
`#1B1A1F` rather than white — the pink is bright enough that dark text reads better on it.

The same three accents are repeated in `app.js` (`PINK`, `PURPLE`, `VIOLET`) for the parts
rendered by script, and inline in the SVG illustrations in `index.html` — keep them in sync if
you change the palette.

## Type

`Sora` for display (600/700/800 — headings, buttons, numbers, the logo) and `Inter` for body
copy, both from Google Fonts. Headings run at 800 with tight tracking, so the type carries as
much of the contrast as the color does.

## Interactive parts (`app.js`)

- **Index builder** — tap an asset to add or drop it, three minimum and five maximum; weights
  split evenly across the basket.
- **Trade sizing** — 0.5 / 2 / 10 ETH split across a sample 40/35/25 index. Pure arithmetic on
  the weights, no price feed.
- **Calculators** — gas savings (sample assumption: ~$1.25 of gas per avoided swap, monthly
  rebalance) and position sizing (sample 0.05 ETH collateral; liquidation excludes funding and fees).
  Both are illustrative, labelled as such on the page.
- **Navigation** — the sub-nav and the buttons scroll to sections by id; sections carry
  `scroll-margin-top` so the sticky header doesn't cover the headline.
- **Cursor trail** — pink sparks that follow the pointer, disabled on touch devices and
  under `prefers-reduced-motion`.

## Animations

Scroll reveals use native CSS scroll-driven animations (`animation-timeline: view()`), so there is
no observer code. In browsers without support the animations resolve to their end state, so the
content is always visible. Hover choreography lives in the "hover choreography" block in
`styles.css`.

## Before going live

- `[your fee schedule]` in the FAQ — replace with real trading fees.
- The three trader cards in *Built by traders* use bracketed placeholders for handle, wallet and
  quote. Fill them with real, attributable quotes or drop the section.
- The X link points at `https://x.com/useBlendify`. Legal links in the footer (`#risk`,
  `#privacy`, `#terms`, `#fees`) are still anchors — point them at real pages.
- The hero chart is illustrative artwork, not a live feed. Wire it to real data before implying
  otherwise; the "blended price, illustrative" label is there on purpose.
