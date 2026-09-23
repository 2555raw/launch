# Logos

Drop a file in here and the matching square wears it. There is nothing to edit.

`config.js` already points every square at `assets/<ticker>.png`, in lower case:

```
assets/tsla.png     Tesla          assets/meta.png     Meta
assets/nvda.png     Nvidia         assets/nflx.png     Netflix
assets/amd.png      AMD            assets/spot.png     Spotify
assets/avgo.png     Broadcom       assets/googl.png    Alphabet
assets/tsm.png      TSMC           assets/rivn.png     Rivian
assets/amzn.png     Amazon         assets/uber.png     Uber
assets/shop.png     Shopify        assets/f.png        Ford
assets/wmt.png      Walmart        assets/cpng.png     Coupang
```

**A missing file costs nothing.** The square falls back to a drawn abstract mark, silently, so the
board looks finished whether you add one logo or all sixteen. Nothing ships in this folder.

Prefer an SVG? Point at it in `config.js`:

```js
bid: { name: 'Tesla', ticker: 'TSLA', glyph: 'bolt', logo: 'assets/tsla.svg' },
```

A URL works too, if you would rather not host them: `logo: 'https://example.com/tsla.svg'`.

## What makes one read well

The marks sit on coloured spheres between 18px and 34px across.

- **A silhouette beats a full-colour logo.** At 22px on a red circle, a detailed mark turns to mush;
  a single-colour shape stays legible.
- **White or very light**, because the sphere underneath is saturated. The drawn marks it replaces
  use `currentColor`, which is already the sphere's contrast colour.
- **Square and centred.** The page draws it into a square box, so a wide wordmark gets squeezed —
  crop to the symbol rather than the full lockup.
- **SVG or a transparent PNG.** A white rectangle around the mark will be very visible on the sphere.

## One thing worth being sure about

These are other companies' trademarks, and here they would sit on a tradeable token named after
them that those companies have nothing to do with. Using a logo to illustrate an article and using
it to label a financial product are not the same thing. This folder is empty so that adding them
stays a deliberate decision rather than a default.
