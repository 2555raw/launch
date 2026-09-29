# Dendra — site

Static landing page for **Dendra**, a token launchpad for the Bittensor economy: launch a token
paired with TAO or subnet alpha, on a bonding curve from the first block, graduating to a pool.

No build step, no dependencies. Plain HTML, CSS and vanilla JS.

## Structure

```
index.html   the whole page: nav, hero with the launch composer, networks & wallets,
             how it works, markets (table + subnet face-off), features, creators, FAQ,
             closing call and footer
styles.css   the design system (palette, type, layout) and the responsive rules
app.js       theme, mobile menu, anchor navigation, composer preview, markets filter,
             subnet face-off, thesis cards and scroll reveal
```

## Run it

```bash
python3 -m http.server 8000     # then open http://localhost:8000
```

Deploy by dropping the folder on any static host (Netlify, Vercel, GitHub Pages, Railway, S3).

## Design

Graphite ground with one signal orange, `#FF5B26`. The orange only marks things that move: the
primary action, the curve fill, the leading bar in the face-off. Type is **Space Grotesk** with
**IBM Plex Mono** for tickers, figures and labels. The hero art is a set of concentric rings and
spokes; the logo is a dendrite, a stem branching from a single node.

Dark by default, with a light theme behind the switch in the nav (remembered in `localStorage`,
wrapped in `try/catch`).

## Before going live

- **Every figure is sample data**: `MARKETS`, `SUBNETS` and `THESES` in `app.js`. Swap them for
  reads from the chain or an indexer.
- The composer is a mock: submitting it only shows a note. Wire it to the real deploy flow.
- The deploy cost (~0.02 TAO), the 1% trade fee and the audit status in the FAQ are placeholders.
- Networks and wallets are listed as text only; confirm each integration before publishing, and
  don't add third-party logos without checking their brand guidelines.
- Footer links (`#docs`, `#terms`, …) are still anchors.
