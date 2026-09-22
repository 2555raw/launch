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

The map of Europe in the portfolio section is generated, not drawn. `world-atlas@2`
1:50m country polygons are projected (equirectangular, x scaled by `cos 48°`, framed
to 10.5°W–30.5°E and 35°N–61°N), simplified with Douglas-Peucker at a 1.1px tolerance
measured in final screen pixels, and written out as one `<path>` per country. That is
why the page ships no map library and makes no request for tiles: 43 countries in
about 55KB of path data, borders and all.

Three layers, in order of importance:

1. **Countries**, filled a step above the sea with a lighter border — the five the
   vault owns in (Portugal, Spain, Germany, the Netherlands, Poland) are filled a
   step lighter again.
2. **Capitals**, as small dim dots with small labels, purely as reference.
3. **The seven cities the vault owns in**, as azure pins with larger labels.

Labels are placed by a greedy solver rather than by hand: holdings claim their
position first, then capitals try eight candidate offsets each and take the first
that collides with nothing already on the map. A capital whose name will not fit
anywhere keeps its dot and loses its label, which currently happens to exactly one.

Hovering a building in the list lights its pin **and its whole country**; hovering a
city on the map lights every building it holds.

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
