# Warp

A market of index perpetuals. You bundle three to five assets — stocks, metals,
crypto or ETFs — into a fixed-weight basket, list it as an index with its own
symbol, and anyone can take a long or short side on it with up to 5x, settled in
USDG. Whoever lists an index keeps 30% of the fees every position on it pays.

No build step: HTML, CSS and native ES modules, the same as the rest of this
repository.

## The rule that governs the project

**No price in this application is real, and the application says so out loud.**

Warp is a paper market. Every asset price comes from the simulator in
`js/market.js`, not from a market data provider. That is why the notice sits in
the header of every screen and in the footer of every screen, and not in the
small print: a number that looks like a quote and is not one does more damage
than an empty slot.

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

**One file, no server.** `dist/warp.html` is the whole application inlined into
a single file. Download it and double-click it: it opens straight from the
filesystem, needs nothing installed, and resolves real logos because the browser
is not sandboxed. Rebuild it after changing any source file with:

```bash
node warp-app/build.mjs
```

**A local server**, which is how you work on the multi-file source:

```bash
python3 -m http.server 8000      # then open http://localhost:8000/warp-app/
```

**Any static host.** Copy the folder as it is; there is nothing to compile.

There is no key to configure and no account to create. It starts with 10,000
USDG of paper balance and nine indices already listed by the house demo
account. The **Reset account** button in the sidebar returns everything to its
opening state.

## Testing

```bash
node warp-app/test/engine.test.mjs
```

It checks, without a browser, what cannot be wrong: that a basket starts at its
base, that the legs' contributions add up to the index's change, that the
balance reconciles after opening, closing and claiming, and that every limit
(legs, leverage, minimum margin, balance, duplicate symbol) rejects what it is
supposed to reject.

## The marks: the real logo and the real colour

Rule: **always the entity's real mark, never one drawn, generated or
approximated.**

A company, an ETF or a coin has a logo of its own. Every row in the registry
carries its official domain (`nvidia.com`, `lvmh.com`, `ethereum.org`) and
`js/logos.js` resolves the logo from that domain at runtime against a chain of
resolvers. No logo is copied into the repository, so none can go stale or
diverge between screens.

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

The X icon in the sidebar is interface chrome, not an asset's mark: **it has no
link yet**, so it is not a link. It is a button that says there is no
destination, rather than an anchor that goes nowhere.

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
build.mjs               inlines everything into dist/warp.html, openable with no server
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
