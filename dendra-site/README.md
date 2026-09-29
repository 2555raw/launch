# Dendra — site

Static site for **Dendra**, a token launchpad for the Bittensor economy: launch a token paired
with TAO or subnet alpha, on Robinhood Chain (bonding curve → pool) or Bittensor EVM (locked
pool from block one).

No build step, no dependencies. Plain HTML, CSS and vanilla JS.

## Structure

```
index.html     landing: floating nav, hero + composer, partner strip, steps, markets grid,
               ticker lookup and subnet face-off panels, bento, theses rail, FAQ, footer
launch.html    launch form: network choice, token details, live terms summary, confirmation
docs.html      guide with a sticky table of contents
styles.css     the design system and every page's layout
app.js         all behaviour; each block checks its elements exist, so one file serves all pages
assets/        great-wall.png: pixel-art Great Wall of China by day (hero and panels);
               fund.svg; src/ holds the code that paints the pixel art
assets/logos/  partner marks for the hero strip (see below)
```

## Run it

```bash
python3 -m http.server 8000     # then open http://localhost:8000
```

## Design

Black ground, near-black cards, white as the primary action. **Instrument Serif** for display
headings (with an italic word), **Inter** for everything else, **JetBrains Mono** for labels and
figures. One orange, `#FF5B26`, marks the logo node and anything live or filling. The logo is a
dendrite: a stem branching from a single node.

## Pixel art background

The hero and the two feature panels use one original pixel-art scene: the Great Wall of China by
day, climbing three ranges of misty mountains, with watchtowers on the crests. It is painted pixel
by pixel in `assets/src/paint.html` (seeded, so the output is stable) at 640×360, and the site
scales it up with `image-rendering: pixelated`. The same file also holds two New York skylines
(`paintNight`, `paintDay`) from an earlier version. To tweak and re-export:

```bash
node assets/src/render.mjs     # needs playwright; set CHROMIUM=/path/to/chrome to use a local one
```

## Partner logos

`assets/logos/` holds the official marks of MetaMask, Rabby, Coinbase, OKX, Uniswap, Base,
Robinhood and USDC, taken unmodified from [`@web3icons/core`](https://www.npmjs.com/package/@web3icons/core)
(MIT), except OKX, whose fill is switched from black to white so it shows on the dark strip.

- The package has no Bittensor logo, so the strip shows a plain τ glyph. To use the real mark,
  drop the SVG from Bittensor's brand kit into `assets/logos/bittensor.svg` and swap the
  `<i class="dn-tau">τ</i>` in `index.html` for an `<img>`.
- Showing a partner's logo is normally fine to say "works with", but check each brand's
  guidelines before going live.

## Before going live

- **Every figure is sample data**: `MARKETS`, `SUBNETS` and `THESES` in `app.js`, the indexer
  table in `docs.html`.
- The wallet button, the composer, the chat panels and the launch form are mocks: nothing touches
  a chain. Wire them to the real contracts and indexer.
- Fees, minimums and the audit status in the FAQ, the launch page and the docs are placeholders;
  confirm them against the contracts.
- Footer links such as `#portfolio`, `#x` are still anchors.
