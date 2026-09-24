# Logos

Drop a file in here and the matching cell wears it. There is nothing to edit.

`config.js` already points every cell at `assets/<ticker>.png`, in lower case. Each colour's four
were chosen to look like that colour, so they read as a set on the wheel:

```
RED                             YELLOW
assets/tsla.png     Tesla       assets/amzn.png     Amazon
assets/lulu.png     Lululemon   assets/snap.png     Snapchat
assets/gme.png      GameStop    assets/msft.png     Microsoft
assets/net.png      Netflix     assets/gld.png      Gold

GREEN                           BLUE
assets/nvda.png     Nvidia      assets/meta.png     Meta
assets/shop.png     Shopify     assets/intc.png     Intel
assets/bull.png     BULL        assets/f.png        Ford
assets/inda.png     India       assets/coin.png     Coinbase
```

All sixteen exist now. `gme.png` took three goes and the first two are the useful part: the mark cut
off Pons's dark tile has a white "Game" that vanishes into a white disc, and inverting somebody's
wordmark is not using their mark, it is drawing a different one. The file that worked came on a
white field, which is the field this folder asks for — nothing is keyed out of it, because the disc
is white and the field simply disappears into it.

`inda.png` and `gld.png` are drawn rather than lifted. A national flag and a gold bar are nobody's
trademark — the Indian flag's proportions, colours and twenty-four spokes are published, and a gold
bar is a tapered box — so the honest thing was to draw them properly instead of cutting up a
photograph. The photographs available were a waving flag and a watermarked stock image, and at the
28px a cell actually draws, a photo of a waving flag is three smears. `gold.js` and `flag.js` in the
scratchpad wrote them; neither is a dependency of anything.

All sixteen ship. `bull.png` and `lulu.png` were cut out of a screenshot of Pons's token
grid: those tiles sit on one flat dark navy, so the background keys out by colour distance rather
than by luminance — a luminance key eats a dark mark along with the ground, which is exactly what
happened to the Netflix N on the first attempt. Every pixel that survives has the navy divided back
out of it, or the mark ships with a dark halo the moment it lands on a white disc. `f.png` and the
vector marks came from the `simple-icons` package, which is not a dependency of anything; it was
used once to write the files. The rest are bitmaps, trimmed and scaled.

`net.png` is a copy of `nflx.png` from an earlier set — the same Netflix mark under the ticker Pons
lists it by, and a far better file than anything that could be cut out of a 40px tile.

Files from earlier sets are still here and unreferenced: `aapl`, `amd`, `googl`, `ko`, `mcd`, `nflx`,
`rblx`, `rddt`, `sbux`, `skype`, `spot`, `usdg`, `wmt`, `yt`. Nothing loads them; delete them whenever.

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
