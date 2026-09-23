# Spinpad — a launchpad where the underlying asset is drawn, not chosen

A token launchpad built around one rule: **nothing launches until the dial has been spun, and the
colour it stops on sets the asset the token is paired with.**

| Colour | Underlying asset | Ticker |
| --- | --- | --- |
| Blue | Meta | `META` |
| Red | Tesla | `TSLA` |
| Green | Nvidia | `NVDA` |
| Yellow | Amazon | `AMZN` |

One spin per launch. It cannot be repeated, and the pairing cannot be edited afterwards.

No build step, no dependencies. Plain HTML, CSS and vanilla JS.

## Structure

```
index.html   the page: pinned nav and contract bars, hero, launch ticker, the coin
             board, the pad (details -> spin -> launch, then the spin record),
             how it works, proof, FAQ and footer
styles.css   the design system: the ground, the mat under the pad, the four reserved
             colours, type, components and the responsive rules
app.js       the dial, the three-step machine, the board and its cards, the metrics
             and local storage
```

## Running it

Open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 8000     # then open http://localhost:8000
```

Deploy by dropping the folder on any static host (Netlify, Vercel, GitHub Pages, S3, Cloudflare
Pages).

### On Railway

`server.js` is the whole server: no dependencies, reads the file off disk and hands it back with
the right content type. It is the same shape as the one in `archive-2011/`, because the job is the
same. Railway passes `PORT` in; 8080 is the fallback, because that is what a generated domain
points at otherwise.

The service is configured with **root directory `/spinpad`** and **start command `node server.js`**,
which is the part worth writing down: a service pointed at the repository root finds no
`package.json` and the build fails before it reaches anything. HTML is served `no-cache` so a
redeploy shows up immediately, everything else gets an hour.

## Where the rule lives

That a token cannot be launched without a spin is not a note in the interface. It is enforced in
three independent places in `app.js`, deliberately.

1. **The control ships disabled.** `#launch` carries `disabled` in the markup.
2. **The step machine gates it.** `setStep(n)` recomputes what is reachable at each step: step one
   is the form, step two is the dial, and `#launch` only opens on `n === 3 && flow.spin`.
3. **`launch()` re-checks before it writes.** Missing spin, draft or step and it reports,
   re-synchronises the controls and returns. Setting `disabled = false` from a console and clicking
   produces nothing — there is a regression check for exactly that.

The moment the arrow stops, `resolveSpin()` writes the asset into the form's underlying-asset field,
the preview sphere and the launch summary at once, and marks the field locked. There is nothing to
choose and nothing to confirm: the draw fills it in.

One id collision was worth the bug it caused. The launch *section* and the launch *button* both
carried `id="launch"`, so `getElementById` returned the section, `disabled` was set on a `<section>`
where it means nothing, and the button — which ships disabled in the markup — could never open. The
button is `#launchBtn` now, and the checks below cover it.

The second spin is closed the same way: `doSpin()` returns early once `flow.spin` exists, so
calling it by hand does not change the colour already drawn.

**Discarding is not re-rolling.** Discard clears the entire draft — name, ticker, supply,
description and the spin — and returns to step one. *Back to details* exists only before the spin;
the moment the needle moves, it is gone.

## The dial

Sixteen sectors of 22.5°: four quadrants (right hand, right foot, left foot, left hand, clockwise
from twelve) holding four colours each. The colour order rotates one place per quadrant so no two
neighbouring quadrants open on the same colour.

- **The colour governs**: it sets the underlying asset, and it is the only thing that changes the
  token.
- **The quadrant is recorded**: it goes into the spin record as part of the outcome and affects no
  parameter.

The sector comes from `crypto.getRandomValues`, not `Math.random`. A `Uint32` is taken modulo 16,
and since 2^32 is a multiple of 16 there is no modulo bias: each colour holds exactly four sectors,
an expected 25%. Measured over 80,000 draws: green 24.68%, yellow 25.34%, blue 25.20%, red 24.77%.

The needle turns five to seven full rotations plus the offset needed to land on the chosen sector,
with a random margin inside the sector so it never stops at the same point twice. The outcome
resolves on `transitionend`, with a `setTimeout` behind it: a tab backgrounded mid-spin never fires
the transition, and without the fallback the spin would hang.

## Design

The chrome is a floating-pad layout: two pinned pills over an atmospheric light
ground, an oversized centred hero with the asset spheres drifting behind it,
tinted product cards, and a two-column pad.

**The mat appears in one place only — the pad.** Four columns of dots in the
board's own order, green, yellow, blue, red, sit under the launch section and
nowhere else, with a wash over them so the form and the summary stay comfortable
to read. Everywhere else the ground is plain: one soft light in the top right and
a long cool wash below it. The board belongs where the board is played.

**The four colours are reserved: they only ever mean the four assets.** Every
piece of chrome — buttons, links, chips, the nav, the dial's hub — is ink on
white. A blue progress bar on a Tesla coin would quietly break the only code the
product has, so each card's curve, sphere and tint take the colour of the asset
it drew.

Each colour carries two tokens, `--c` (the colour) and `--on` (what reads on top
of it). Yellow `#FDD208` against white sits at 1.4:1, so text on yellow drops to
ink while the other three take white.

Type: **Plus Jakarta Sans** throughout — 800 for display, 400–700 for text — with
**JetBrains Mono** for the contract line, tickers, supplies and prices.

### The spinner

The dial is drawn the way the board is printed: a square face with the four limbs
named in its corners, a ring of sixteen equal sectors, an open hub, and a black
arrow turning over it. It is SVG generated at runtime from the same `SECTORS`
table the outcome is read from, so what the arrow points at and what the app
reports cannot drift apart — there is a check for that, comparing the needle's
final angle against the colour named in the result.

### The distribution chart

Four horizontal bars in fixed asset order, never reordered by rank, with a dashed
rule at the 25% each colour is expected to draw.

Running the four fills through a palette validator returns a pass on colourblind
separation — the worst adjacent pair, yellow against green, holds ΔE 18.4 under
protanopia — but a contrast warning: against white, green reaches 3.0:1 and yellow
only 1.4:1, both under the 3:1 floor for a mark that has to be findable. Those
fills are not free to change, because the colour *is* the data. So the relief is
built in instead, and it is not optional:

- every bar carries a visible ink label with its share and its count, so no value
  is encoded in colour alone;
- each fill takes a hairline ink ring, which keeps the light ones visible against
  the surface;
- the reference rule sits above the fills with a white edge behind the dashes, so
  it stays readable where a bar runs past it.

Card sparklines are ink lines over a tinted area, not coloured lines: a 1px mark
in yellow or green on white would fail the same floor with no label to rescue it.

## The data

- **Every figure is generated.** Market caps, replies, curve progress and the combined total are
  illustrative; the board, the metrics and the footer all say so.
- Launches live in `localStorage` under `spinpad.coins.v1`, capped at 60. Reads and writes are
  wrapped in `try/catch`: a browser that blocks storage still runs, just in memory.
- The first five launches are samples, tagged `SAMPLE` on the board. They are seeded once, when the
  key is absent — clearing the record leaves it cleared.
- Card sparklines are deterministic: each one is a seeded random walk keyed on the coin's id, so a
  card looks the same across re-renders instead of twitching every time the board redraws.
- The board re-renders each minute so relative timestamps do not freeze on a tab left open.

## Before this becomes real

- **There is no chain, no contract and no money.** This is a complete simulation of the mechanic,
  not a launchpad. The seam for a real backend is `launch()`: today it builds the token object and
  unshifts it into the array. The spin record it produces — colour, quadrant, timestamp, id — is
  exactly what would need to be signed and stored alongside the token for the rule to be auditable
  rather than a promise the interface makes.
- Meta, Tesla, Nvidia and Amazon appear here as labels in a demonstration. Pairing a token with the
  price of a listed security carries significant regulatory consequences in most jurisdictions, and
  that has to be resolved before anything ships, not after.
- The colour-dial mechanic is an homage to the floor game of the same idea. **Twister is a
  trademark of Hasbro** and this project is not affiliated with it, which is why the product is
  called Spinpad and the trademark appears nowhere in the interface.
