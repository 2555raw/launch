# RENTA — site

Static landing page for **RENTA**: a share of the rent from ten apartment buildings
in eight European cities, held through one vault token called `vRENTA`.

Built as a mid-dark navy reading of the DEED layout — same mechanics, same section
order, same plain-English voice, different palette, different continent.

No build step, no dependencies. Plain HTML, CSS and vanilla JS.

## Structure

```
index.html   the landing page: hero, how it works, the claim panel, the portfolio
             with the full-bleed map of Europe and the buildings table, The Roll,
             the dashboard chart, the deposit calculator, FAQ, closing call, footer
docs.html    the documentation: a sticky sidebar and one column of prose —
             using the vault, The Roll, building on it, legal
styles.css   the design system (palette, type, layout) and the responsive rules
docs.css     the light-ground layout and prose styles for the docs page
app.js       nav, scroll reveal, count-ups, FAQ accordion, the map-to-building
             hover link, the deposit calculator and the share-price chart
docs.js      the docs sidebar following the heading you are reading
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

The light panels are a *warm* off-white (`--cream`, `#F3F2EC`) on purpose: a cool
off-white swallowed the pale azure tints. On the warm ground the four claim pills step
through a ramp (`--accent-1` → `--accent-4`) whose steps are far enough apart to read
as four steps, and whose last one goes deeper than the accent so the closing line
lands hardest.

Type is Figtree for everything and JetBrains Mono for every figure that sits in a
column — prices, table cells, map labels, the stat tiles — so numbers stay tabular
and never reflow as they animate. A figure quoted *inside a sentence* ("From
**100 EURG**") stays in the sans, bold: the mono only ships at 400, 500 and 700,
and a weight the font does not have is a smear the browser invents.

## The map

The map of Europe in the portfolio section is generated, not drawn. `world-atlas@2`
1:50m country polygons are projected (equirectangular, x scaled by `cos 48°`, framed
to 16.2°W–51.4°E and 37.4°N–60°N), simplified with Douglas-Peucker at a 1.1px tolerance
measured in final screen pixels, and written out as one `<path>` per country. That is
why the page ships no map library and makes no request for tiles: 56 countries in
about 63KB of path data, borders and all.

It runs full-bleed, edge to edge, at the reference's proportion rather than
Europe's: the frame is 16.2°W–51.4°E by 37.4°N–60°N, which is 2:1, so it
stands 719px tall on a 1440px screen instead of the 960px a square Europe would
take. Scandinavia north of Oslo and the strip of North Africa are the price.
On a phone the frame goes 4:3 and, anchored left with `xMinYMid slice`, keeps
Lisbon to Kraków; the capitals step aside and the pins grow (through the CSS `r`
property) so the cities stay legible.

Three layers, in order of importance:

1. **Countries**, filled a step above the sea with a lighter border — the six the
   vault owns in (Portugal, Spain, Italy, Germany, the Netherlands, Poland) are
   filled a step lighter again.
2. **Capitals**, as small dim dots with small labels, purely as reference.
3. **The cities the vault owns in**, as pins in a blue of their own (`--pin`, not
   the azure money accent) with larger labels, each sending out a ring every few
   seconds, staggered so the map never pulses in unison. Terrassa is twenty
   kilometres from Barcelona — eight pixels at this scale — so it rides Barcelona's
   pin rather than drawing a second one on top of it.

Labels are placed by a greedy solver rather than by hand: holdings claim their
position first, then capitals try eight candidate offsets each and take the first
that collides with nothing already on the map. A capital whose name will not fit
anywhere keeps its dot and loses its label, which currently happens to two.

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
| Kept in August | €40,620, which is the sum of the ten buildings' net rent |

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
