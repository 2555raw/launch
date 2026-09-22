# RENTA — site

Static landing page for **RENTA**: a share of the rent from nine apartment buildings
in seven European cities, held through one vault token called `vRENTA`.

Built as a mid-dark navy reading of the DEED layout — same mechanics, same section
order, same plain-English voice, different palette, different continent.

No build step, no dependencies. Plain HTML, CSS and vanilla JS.

## Structure

```
index.html   the whole page: hero, how it works, the claim panel, the portfolio
             and the map of Europe, The Roll, the dashboard chart, the deposit
             calculator, FAQ, closing call and footer
styles.css   the design system (palette, type, layout) and the responsive rules
app.js       nav, scroll reveal, count-ups, FAQ accordion, the map-to-building
             hover link, the deposit calculator and the share-price chart
```

## Run it

```bash
python3 -m http.server 8000     # then open http://localhost:8000
```

Or open `index.html` directly. Deploy by dropping the folder on any static host.

## Design

**Navy is the ground, azure is the money.** Five blues carry the entire page —
`--navy-900` through `--navy-600` — and a cool off-white (`--cream`) for the
panels that need to break the dark. Bright azure `#63D6F2` is the only accent,
and it is reserved: share prices, rent figures, the step numbers, the primary
button, the map pins, the chart line. Nothing decorative is ever allowed to be
azure, because the moment the accent spreads it stops meaning "money".

The four claim pills step through tints of the same azure (`--accent-1` → 
`--accent`) so the last line lands hardest.

Type is Figtree for everything and JetBrains Mono for every figure — prices,
addresses, table cells, map labels — so numbers stay in tabular columns and
never reflow as they animate.

## The map

The dot-matrix map of Europe in the portfolio section is generated, not drawn.
`world-atlas@2` 1:50m country polygons were rasterised onto a square lattice
(74 columns, equirectangular projection scaled by `cos 48°`, clipped to
10.5°W–30.5°E and 35°N–61°N) with a point-in-polygon test per lattice point.
Dots within 34 units of a portfolio city are painted a step brighter, so each
city reads as a lit cluster rather than a lone pin. The result is baked into
`index.html` as two `<path>` elements — one for land, one for the lit clusters —
which is why the page ships no map library and makes no requests for tiles.

City labels are hand-placed (anchor and offset per city) because automatic
placement collided Madrid with Valencia and Kraków with its own pin.

Hovering a building in the list lights its city on the map, and hovering a city
lights every building it holds.

## The numbers

Every figure on the page comes from one table in `app.js` (`CLOSES`), so the
calculator, the chart, the copy and The Roll can never disagree:

| | |
|---|---|
| Share price after six closes | €1.025393 |
| — of which rent kept | €0.021871 per share |
| — of which the curve tax | €0.003522 per share |
| vRENTA in issue | 11,050,000 |
| What the vault holds | €11,330,593 (€10,900,000 of buildings + €430,593 cash) |
| Kept in August | €40,620, which is the sum of the nine buildings' net rent |

A €10,000 deposit on 1 March is therefore worth €10,253.93 — €218.71 of rent and
€35.22 of curve tax. The portfolio table, the props footer and the FAQ all quote
those same totals.

The share-price chart is one series, so it carries no legend: the card title
names it, the last point is directly labelled, and hover gives a crosshair and
the month behind the point. The Roll above it is the chart's table view.

## Not real

This is a demonstration build. There is no wallet connector — the *Connect wallet*
buttons raise a toast saying so — no contracts, and no buildings. Every address,
price and close is invented.
