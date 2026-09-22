# RENTA — site

Static site for **RENTA**: a share of the rent from ten apartment buildings in eight
European cities, held through one vault token, `vRENTA`.

Built as a mid-dark navy reading of the DEED layout — same mechanics, same section
order, same plain-English voice, different palette, different continent — and then
taken further: every figure on it is computed from published monthly ledgers, the
map steps into each city by district, a wallet connects, and the whole thing ships in
English and Chinese with no build step and no third-party request.

```bash
npm run data      # rebuild every figure from the Rolls (see below)
npm run serve     # http://localhost:8000
npm test          # 60-odd checks, needs Chromium (CHROME=/path/to/chrome)
```

## Structure

```
index.html / docs.html        the landing page and the documentation
zh/index.html / zh/docs.html  the same two pages in Chinese — GENERATED, do not edit
styles.css, docs.css          the design system and the docs layout
app.js                        nav, reveal, count-ups, FAQ, the map, the city view,
                              the calculator and the share-price chart
wallet.js, gate.js, config.js the wallet connection, the eligibility gate, and the
                              one file to edit when the vault goes live
map.svg                       56 countries, drawn from real polygons (cached image)
og.png, sitemap.xml, robots.txt, 404.html

rolls/                        the six monthly Rolls (CSV) and hashes.json
data/                         buildings.json (the facts), and the GENERATED
                              vault.js/json, facades.js, cities.js
contracts/                    Vault.sol, RollRegistry.sol and their ABIs
i18n/                         the English → Chinese dictionaries (see i18n/README.md)
data/geo/                     real district boundaries per city (see data/geo/SOURCES.md)
scripts/                      the generators (next section)
test/                         the test suite and its static server
fonts/                        Figtree and JetBrains Mono, self-hosted
```

## The pipeline: from the Rolls to the page

Nothing on the page is typed in. The chain is:

```
rolls/*.csv ──recompute.js──▶ data/vault.json ──render-static.js──▶ index.html, docs.html
     ▲                             │
make-rolls.js (demo only)          └──▶ app.js (chart, calculator, city cards)
data/buildings.json ──facades.js──▶ data/facades.js   (a façade per building)
                    ──cities.js───▶ data/cities.js    (a district map per city)
```

- **`scripts/recompute.js`** reads every Roll, checks its SHA-256 against
  `rolls/hashes.json`, checks that each header's `previous_roll` is the hash of the
  Roll before it, recomputes the closing price from the lines — `opening + (Σ collected
  − Σ costs) / shares + Σ curve tax / shares` — to six decimals, and checks the share
  movements. Then it writes `data/vault.js`. `--check` verifies only and exits 1 on any
  mismatch; a Roll with one edited cent fails on both the hash and the price.
- **`scripts/render-static.js`** writes the figures into regions marked
  `<!-- data:key --> … <!-- /data:key -->` in both pages. The pages are right with JavaScript off, and can never
  disagree with the Rolls. The notes under The Roll (the biggest invoice, a lease that
  ended, each purchase) are told from the data too.
- **`scripts/make-rolls.js`** is the demonstration's only invented input: it writes
  the six Rolls deterministically (fixed-seed PRNG) — a rent roll per apartment,
  costs by invoice, deposits and redemptions by wallet, purchases as they happened.
  A live vault replaces this script with real ledgers and nothing downstream changes.
- **`scripts/translate.js --lang zh`** builds `zh/` from the English pages and the
  dictionaries in `i18n/`, longest phrase first, and reports any text node that still
  reads as English (`--check` fails the tests if one does). `render-static.js` then
  fills the data regions in Chinese words and formats; `app.js`, `wallet.js` and
  `gate.js` read their strings from a table keyed by the page's `lang`. The switch
  in the nav goes both ways.

## The map, and the cities

The map of Europe is generated, not drawn: `world-atlas@2` 1:50m country polygons,
projected (equirectangular, x scaled by `cos 48°`, framed 21°W–59.7°E by
35°N–62°N, 2:1), simplified with Douglas-Peucker at 1.1px of final screen pixels,
and written to `map.svg` — one `<path>` per country, ~66KB, loaded as an `<img>`
and cached. An inline overlay in the same frame carries only what needs to react:
the six owned countries (transparent until a building is hovered), the capitals as
reference, and the pins in a blue of their own (`--pin`, not the azure money accent),
each sending out a ring every few seconds. Labels are placed by a greedy solver.

Click a pin, or a building in the table, and the city opens. `scripts/cities.js`
draws each one from its real district boundaries where they are on disk
(`data/geo/`, five cities so far: Lisbon's freguesias, Madrid's barrios, Barcelona's
barris, Leipzig's Ortsteile, Rotterdam's gebieden), projected, simplified to a pixel,
with each building placed by point-in-polygon so its district is whatever the
boundary file says. Where no file exists (Turin, Kraków, Terrassa — `SOURCES.md`
says why) the city is a schematic: real district centres, Voronoi cells between
them, and the panel says so. Either way: the building's district lit, the building
at its true coordinates, a scale bar, and a card per building with its façade.
Terrassa is twenty kilometres from Barcelona, eight pixels on the big map, so it
rides Barcelona's pin there and has its own city view, linked from Barcelona's.

`scripts/facades.js` draws an elevation per building from its facts — floors,
apartments per floor, a roof for its era — as the thumbnail in the table and on the
cards. There are no photographs because there are no buildings.

## The wallet and the contracts

`wallet.js` finds injected wallets through EIP-6963 (falling back to
`window.ethereum`), connects with EIP-1193, moves the wallet to the vault's chain
(adding it if unknown), and — with a vault address in `config.js` — reads your
vRENTA balance, the share price and what the vault holds straight from the contract
with hand-encoded ABI calls. No library. With no address configured it connects and
says plainly that nothing is deployed on that chain.

Before the first connection, `gate.js` asks for three confirmations — residence in
an eligible jurisdiction, the risks read, that this is a security — with the
jurisdictions from `config.js`, and links to the identity-check provider when one
is configured. The answer stays in that browser.

`contracts/Vault.sol` is an ERC-4626 with three additions: a curve on `redeem`
(3% on day one, straight line to zero on day ninety, and the difference stays in the
vault), a `close` the operator calls once a month that sets the buildings' carrying
value and writes the Roll's hash to `RollRegistry.sol` in the same transaction, and
a queue for redemptions the reserve cannot cover, settled at the next close. It
compiles clean with solc 0.8.37 and it is **not audited**: it is the reference source
for the mechanism the docs describe, not something to deploy with money.

## Design

**Navy is the ground, azure is the money, a second blue is the map.** Five navies
(`--navy-900` … `--navy-600`) carry the page, a warm off-white (`--cream`) the panels
that break the dark. Azure `#63D6F2` is reserved for money — prices, rent, the step
numbers, the primary button, the chart line — and never spreads; the four claim
pills step through a ramp under it that reads as four steps on the warm ground. The
map pins take `--pin`, so a place is never confused with a figure.

Type is Figtree for everything and JetBrains Mono for every figure that sits in a
column, served from `fonts/` so no request leaves the site. Small secondary text
clears 4.5:1 on every surface it sits on; nothing pressable is under 40px; the
heading outline has no jumps; the map pins and the buildings are keyboard-reachable
and the city view and the gate are dialogs with focus handling and Escape.

## Not real

This is a demonstration build. The buildings, the tenants, the wallets in the
movements, the addresses in the docs and every close are invented by
`make-rolls.js` to show how the mechanism reads. Nothing is deployed.
