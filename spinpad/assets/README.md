# Logos

Drop a file in here and the matching cell wears it. There is nothing to edit.

`config.js` already points every cell at `assets/<ticker>.png`, in lower case. Each colour's four
were chosen to look like that colour, so they read as a set on the wheel:

```
RED                             YELLOW
assets/tsla.png     Tesla       assets/amzn.png     Amazon
assets/ko.png       Coca-Cola   assets/snap.png     Snapchat
assets/nflx.png     Netflix     assets/msft.png     Microsoft
assets/yt.png       YouTube     assets/mcd.png      McDonald's

GREEN                           BLUE
assets/nvda.png     Nvidia      assets/meta.png     Meta
assets/spot.png     Spotify     assets/wmt.png      Walmart
assets/usdg.png     USDG        assets/skype.png    Skype
assets/sbux.png     Starbucks   assets/intc.png     Intel
```

**A missing file costs nothing.** The cell falls back to a drawn abstract mark, silently, so the
board looks finished whether you add one logo or all sixteen. Nothing ships in this folder.

Prefer an SVG? Point at it in `config.js`:

```js
'rightFoot.red': { name: 'Tesla', ticker: 'TSLA', glyph: 'bolt', logo: 'assets/tsla.svg' },
```

A URL works too, if you would rather not host them: `logo: 'https://example.com/tsla.svg'`.

## What makes one read well

The marks sit on coloured circles between 24px and 34px across.

- **A silhouette beats a full-colour logo.** At 22px on a red circle, a detailed mark turns to mush;
  a single-colour shape stays legible.
- **White or very light**, because the circle underneath is saturated. The drawn marks it replaces
  use `currentColor`, which is already the circle's contrast colour.
- **Square and centred.** The page draws it into a square box, so a wide wordmark gets squeezed —
  crop to the symbol rather than the full lockup.
- **SVG or a transparent PNG.** A white rectangle around the mark will be very visible on the circle.

## One thing worth being sure about

These are other companies' trademarks, and here they would sit on a tradeable token named after
them that those companies have nothing to do with. Using a logo to illustrate an article and using
it to label a financial product are not the same thing. This folder is empty so that adding them
stays a deliberate decision rather than a default.
