# Perpix

A market of index perpetuals. You bundle three to five assets — stocks, metals,
crypto or ETFs — into a fixed-weight basket, list it as an index with its own
symbol, and anyone can take a long or short side on it with up to 5x, settled in
USDG. Whoever lists an index keeps 30% of the fees every position on it pays.

No build step: HTML, CSS and native ES modules, the same as the rest of this
repository.

## The rule that governs the project

**No price in this application is real, and the application says so out loud.**

Perpix is a paper market. Every asset price comes from the simulator in
`js/market.js`, not from a market data provider. That is why the notice sits in
the header of every screen and in the footer of every screen, and not in the
small print: a number that looks like a quote and is not one does more damage
than an empty slot.

It says so in the terms you have to accept before the application starts, and
in the footer of every screen. It does not also say it in a header badge and a
banner across the dashboard, which is where it used to say it: four times is
not more honest than twice, it is just noise on top of the thing you are
reading.

The distinction the whole codebase keeps is this:

- **Simulated**: price, change, volume and depth. These are simulator figures.
  The interface marks them `sim.` where a column has room.
- **Real, within the limits of the application**: your positions, your balance,
  the fees you have paid, the fees you have generated as a creator, and the
  indices you have listed. That happened because you did it, so it persists in
  the browser and can be audited.

None of this is investment advice.

## Opening it

Three ways, in order of least ceremony.

**One file, no server.** `dist/perpix.html` is the whole application inlined into
a single file. Download it and double-click it: it opens straight from the
filesystem, needs nothing installed, and resolves real logos because the browser
is not sandboxed. Rebuild it after changing any source file with:

```bash
node perpix-app/build.mjs
```

**A local server**, which is how you work on the multi-file source:

```bash
python3 -m http.server 8000      # then open http://localhost:8000/perpix-app/
```

**Any static host.** Copy the folder as it is; there is nothing to compile.

There is no key to configure and no account to create. It starts with 10,000
USDG of paper balance and nine indices already listed by the house demo
account. The **Reset account** button in the sidebar returns everything to its
opening state.

## Testing

```bash
node perpix-app/test/engine.test.mjs
```

It checks, without a browser, what cannot be wrong: that a basket starts at its
base, that the legs' contributions add up to the index's change, that the
balance reconciles after opening, closing and claiming, and that every limit
(legs, leverage, minimum margin, balance, duplicate symbol) rejects what it is
supposed to reject.

## The two themes

Light, dark, or whatever the viewer's machine says — three modes, not two, and
the third is the default, because it is the answer most people have already
given somewhere else and asking again is rude. The button sits in the header and
says the state it is in, including which way the system currently resolves.

The light theme is the original design: a white ground on which the only colour
with weight is the brand's. The dark one keeps that idea rather than inverting
it — the ground goes to a blue-biased near-black, hairlines and the accent lift
until they read on it, and the tile a logo sits on stays white, because most
logos are drawn dark on nothing and a dark tile would swallow them.

Every colour is a token declared on bare `:root` first, so no token can exist
only inside a media query, which is the classic way a themed page ends up
rendering one theme's text on the other theme's ground. Four states, in cascade
order: `:root` is the complete light palette; `prefers-color-scheme: dark` is
the viewer's system, unless they chose light here; `[data-theme]` is the choice
of a host this page is embedded in; `[data-px-theme]` is the choice made in this
application, and it wins. The attribute is `data-px-theme` and not `data-theme`
on purpose: an embedding host stamps `data-theme` itself, and two writers on one
attribute fight, so this application reads the host's attribute and writes its
own.

Canvas is not in the cascade, so a theme change repaints the view and the charts
read their colours from the tokens as they draw.

The ink over a brand colour is chosen by measuring both candidates and taking
the better one, not by a luminance threshold. A single threshold gets mid-tones
wrong in either direction: gold sat just under it and took white ink at 2.1:1,
which is unreadable. Measured, the worst symbol tile in the registry is 4.5:1.

## The clock

Perpix keeps one clock and it is New York's, real time, ticking every second in
the header. A market has a single wall clock, not one per viewer: two people
looking at the same funding window have to be looking at the same hour. New York
is the hour the assets themselves keep — most of the registry lists on the NYSE
or the NASDAQ — so it is the market's time rather than a viewer's.

The zone is named (`America/New_York`) rather than computed from an offset, so
daylight saving is handled by the platform's own timezone data and is right
twice a year without anyone remembering the dates; the header says which offset
is in force. It reads in 24 hours, because a trading clock sits in a column next
to other figures and AM/PM both changes width and leaves noon ambiguous.
Listing dates and timestamps read on that same clock, so nothing in the
interface is in a second zone. Moving the market to another city is two lines in
`js/format.js` and nothing else.

## The terms gate

Nothing runs before the terms are accepted: no routing, no clock, no heartbeat.
The gate is not a banner over a working application, it is the application not
having started. Declining gets a real screen rather than being ignored until the
button is pressed again, and the acceptance is stored with the version it
accepted, so changing the text asks again instead of assuming an old yes covers
a new one. `Terms of use` in the footer reopens the same text afterwards — one
source, so the two cannot drift.

A second notice, about storage, arrives about thirty seconds in. Stacking it on
the terms would make two walls to get through before seeing anything, and a
notice about what an application stores means more once it has stored
something. It says what actually happens rather than the easy copy: Perpix sets
no cookies, has no analytics and no third parties, and the only thing kept is
the local storage the account lives in. Which means there is no non-essential
category to switch off, so it says that too instead of offering a toggle that
controls nothing.

The five clauses say the things that actually matter about this application: the
money is not money, the prices are not prices, the data never leaves the
browser, the logos belong to other people, and there is no warranty. There is no
clause in there padding the length.

## The marks: the real logo and the real colour

Rule: **always the entity's real mark, never one drawn, generated or
approximated.**

There are three tiers, in this order:

1. **The full-colour logo resolved at runtime** from the entity's own official
   domain. Every row in the registry carries that domain (`nvidia.com`,
   `lvmh.com`, `ethereum.org`) and `js/logos.js` resolves the logo from it
   against a chain of resolvers. No logo is copied into the repository, so none
   can go stale. This is the entity's current mark, so when it loads it wins.
2. **The official mark embedded in `js/marks.js`**, for 44 of the assets. Tier 1
   needs the network, and two places do not have it: a page opened from the
   filesystem with no connection, and a sandboxed host that blocks external
   images. A runtime-only system falls back to a monogram there, and a monogram
   is not the mark. The embedded one paints on the first frame and stays if the
   network never answers.
3. **The asset's own official symbol on its brand colour**, for the fourteen no
   set carries: ASML, PepsiCo, Eli Lilly, Johnson & Johnson, ExxonMobil,
   Iberdrola, LVMH, Novo Nordisk, the five ETFs and USDG. None of them has a
   logo published under a licence that allows embedding — in several cases
   because the owner had it removed from the sets that used to carry it — so
   what stands in is the ticker they actually trade under. That is a real
   identifier, not a drawing, and it gets exactly the treatment a metal's
   chemical symbol gets, so the two read as one system rather than as a mark and
   a failure. The real logo still resolves at runtime in a browser with a
   connection. What these never do is borrow another entity's logo.

Tier 2 is generated, not hand-assembled: `node perpix-app/tools/build-marks.mjs`
pulls five published icon sets from npm, takes only the mapped icons, and writes
`js/marks.js` with the set, version and licence each mark came from. Four of
them — Disney, Walmart, Santander and BBVA — come from a CC BY-SA 4.0 set,
which asks for attribution; it is given in the generated file, here, and in the
application on each asset's page. The other forty-four are CC0. Where a mark
belongs to a brand of the listed entity rather than the entity itself — Google
for Alphabet, Chase for JPMorgan Chase, Zara for Inditex — the entry records the
brand and the asset's page names it, instead of quietly passing one identity off
as another. The marks remain the trademarks of their owners; the terms say so.

Tier 1 only replaces tier 2 when what arrives is at least 32 pixels: a 16-pixel
favicon is not an upgrade over a clean embedded vector.

A metal has no logo because it is not a company. Its mark is **its official
chemical symbol written in the real colour of the metal**: Au in gold, Cu in
copper, Li in the grey of lithium. That is not a drawing, it is the notation the
industry itself uses. Its page also names the market that prices it (LBMA, LME,
LPPM), which does have a logo of its own.

Every asset also carries **its real brand colour**, the one the entity uses.
That colour is not decoration: it is what identifies its band in a basket's
composition bar, its slice in the weight wheel, its line on a chart and its
symbol pill. That is why the application's ground is white and stays white: on
white, the only colour with weight is the brand's.

Every screen builds a mark by calling `markEl()`, and only that function. That
is why an asset cannot show one mark in the search box and another in a basket.

The monogram paints on the first frame and the logo loads over it, so a slot is
never blank while the network answers. If no resolver answers, what is left is
the monogram in the brand colour. Never another entity's logo, never an emoji.

With `logoToken` configured, the paid logo provider is used, which has better
coverage and resolution. Without a token the fallbacks are used, which resolve
by domain with no key.

The X icon in the sidebar is interface chrome, not an asset's mark. It links to
[@usePerpix](https://x.com/usePerpix), and opens in a new tab.

## How an index works

An index is a **fixed-weight** basket. On listing it freezes each leg's price as
a reference and the basket starts at base 100. From that moment it is worth:

```
V(t) = 100 · Σᵢ wᵢ · Pᵢ(t) / Pᵢ(t₀)
```

It never rebalances, so today's basket is exactly the one that listed, and its
chart measures exactly what it has done since. The **contribution** column on
its page decomposes that change leg by leg: each leg's move times its weight,
so the contributions add up to the index's change.

The references live in the index itself (`refs`), not in the feed. That is why
listing a new index does not rewrite the history of an existing one.

## How a position works

The rules live in `VENUE` (`js/config.js`), in one place, so that what the
trading panel promises and what the engine applies are the same rule:

| Rule | Value |
| --- | --- |
| Legs per index | 3 to 5 |
| Leverage | 1x to 5x |
| Fee | 0.05% of notional, on opening and on closing |
| To the index's creator | 30% of that fee |
| Maintenance margin | 0.5% |
| Funding | 0.01% base per 8 h, scaled by the imbalance between longs and shorts, capped at 0.075% |

The liquidation price comes from `liquidationPrice()`, and the form's warning
and the real liquidation come from that same function: they cannot disagree.
Funding accrues over time at the rate in force and is already netted off the
result each position shows.

A position with no margin left is liquidated by the rule, not because someone is
watching the screen: the heartbeat in `js/app.js` runs `liquidationSweep()`
every five seconds. On a liquidation the margin is lost and no closing fee is
charged.

## Architecture

```
index.html              the shell: sidebar, search, the simulated notice, views
styles.css              design system (tokens on :root, white ground, components)
js/registry.js          IDENTITY: symbol, name, class, sector, brand colour, domain
js/marks.js             GENERATED: the official mark of 44 assets, embedded
js/terms.js             the terms, the gate on entry, and the copy in the footer
js/theme.js             light, dark or system, and the repaint a theme change needs
js/config.js            VENUE (the market's rules) and the logo resolver chain
js/logos.js             the mark system described above
js/market.js            the price simulator and the basket mathematics
js/store.js             wallet, listed indices, positions, history; one key, one event
js/engine.js            list, validate, open, close, fund, liquidate, claim fees
js/format.js            formatting and the NA sentinel, so "no data" never looks like a zero
js/chart.js             canvas charts: series with crosshair, minimal line, weight wheel
js/search.js            search tolerant of typos, accents and trade names
js/ui/components.js     reusable pieces (identity, cards, tables, figures, notices)
js/views.js             the screens
js/app.js               routing, search, clock and the heartbeat that liquidates
build.mjs               inlines everything into dist/perpix.html, openable with no server
tools/build-marks.mjs   regenerates js/marks.js from four CC0 icon sets on npm
test/engine.test.mjs    the market's rules, checked without a browser
```

### Why the simulator is a sum of waves and not a random walk

An asset's price at an instant is a sum of waves of different scales, with phase
and amplitude seeded from its symbol. That gives three properties a random walk
does not:

- **it is reproducible**: the same seed gives the same market on every reload and
  in every tab, so a position opened yesterday still makes sense today;
- **it is continuous**: there are no jumps between reloads;
- **it can be evaluated at any instant in constant time**, so a chart's history
  does not have to be stored: it is computed.

The seed is changed in `config.seed`.

### Plugging in a real provider

`js/market.js` ends in `setFeed()`. The application never calls the simulator
directly: it calls `spot`, `changePct`, `series` and `volume24h` through `feed`.
A real provider is plugged in by replacing them and setting
`isSimulated: false`, and at that point the header and footer notices stop
saying the price is simulated, because it will not be. Nothing else in the
application changes.

### Adding an asset

One row in `js/registry.js` with symbol, legal name, short name, class, sector,
real brand colour and official domain — or, if it is a metal, its chemical
symbol and its market. One reference level in `REF` in `js/market.js`, which is
where price lives. It shows up on its own in the search box, in its asset tab,
in the basket builder, and with its mark on every screen.

## What is missing

- Limit and stop orders: today there is only a market order.
- Closing part of a position: today a close is the whole thing.
- Optional rebalancing of a basket: today fixed weight is the only mode, and it
  is what makes an index auditable without storing history.
- The history keeps the last two hundred closed trades and drops the rest.
