# Logos

Drop a file in here and the matching cell wears it. There is nothing to edit.

`config.js` already points every cell at `assets/<ticker>.png`, in lower case. Each colour's four
were chosen to look like that colour, so they read as a set on the wheel:

```
RED                             YELLOW
assets/tsla.png     Tesla       assets/amzn.png     Amazon
assets/nflx.png     Netflix     assets/snap.png     Snapchat
assets/amd.png      AMD         assets/msft.png     Microsoft
assets/rddt.png     Reddit      assets/net.png      Cloudflare

GREEN                           BLUE
assets/nvda.png     Nvidia      assets/meta.png     Meta
assets/shop.png     Shopify     assets/googl.png    Google
assets/aapl.png     Apple       assets/intc.png     Intel
assets/rblx.png     Roblox      assets/coin.png     Coinbase
```

All sixteen ship. Eight are bitmaps, trimmed and scaled; eight were rendered from the
`simple-icons` package — official single-colour marks in each brand's own hex. That package is not a
dependency of anything; it was used once to write the files. `amd.png` came from `simple-icons@9`,
which still carries AMD.

Files from the previous set are still in this folder and unreferenced: `ko`, `yt`, `mcd`, `spot`,
`sbux`, `usdg`, `skype`, `wmt`. Nothing loads them; delete them whenever.

**A missing file costs nothing.** The cell falls back to a drawn abstract mark, silently, so the
board looks finished whether you add one logo or all sixteen.

Prefer an SVG? Point at it in `config.js`:

```js
'rightFoot.red': { name: 'Tesla', ticker: 'TSLA', glyph: 'bolt', logo: 'assets/tsla.svg' },
```

A URL works too, if you would rather not host them: `logo: 'https://example.com/tsla.svg'`.

## What makes one read well

**A cell with a logo gets a white disc**, with its colour as a ring around it — so the logo can be
in its own colours and does not have to fight a saturated background. That changes what makes a
good file:

- **Its own colours, not a silhouette.** The disc is white, so Tesla's red and Coca-Cola's script
  land exactly as they should.
- **Transparent, or on a white field.** Both work: a white field disappears into the disc.
- **A coloured card is fine too**, as long as it is the cell's own colour — Snapchat's yellow and
  Microsoft's grey both get trimmed back to the mark, and what is left reads as the brand. A mark on
  a *dark* field is the one that does not work: trimmed, it still carries dark corners into a white
  disc.
- **Crop to the mark.** The file is drawn into a box 76% wide and 64% tall, so a wide wordmark has
  room, but a full lockup with a tagline will still come out tiny.
- **Do not chroma-key a white background to transparency.** The anti-aliased pixels between the
  mark and the field are neither, and a threshold leaves a white fringe on every edge. Leave the
  white in; the disc is white.
- **PNG or SVG.** 128px square is plenty; the largest it is ever drawn is about 47px.

## One thing worth being sure about

These are other companies' trademarks, and here they would sit on a tradeable token named after
them that those companies have nothing to do with. Using a logo to illustrate an article and using
it to label a financial product are not the same thing. This folder is empty so that adding them
stays a deliberate decision rather than a default.
