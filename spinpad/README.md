# Spinpad — a launchpad where a spinner picks the pairing

**Nothing launches until the board has been spun, and where the arrow stops decides what the coin is
paired with.** The draw is then written into the token's own contract, at construction, with no
function anywhere that can change it afterwards.

Where the arrow stops gives two coordinates, and it takes both to name an asset. The **colour**
picks one of four families; the **quadrant** picks which of the four tokens inside it. Sixteen dots
on the board, sixteen tokens, one to a dot — so a red dot on the bid hand and a red dot on the short
leg are different coins. A pairs trade has two legs and two sides, which is where the quadrant names
come from.

One spin per launch. It cannot be repeated, and the pairing cannot be edited afterwards.

## This deploys real contracts

Launching calls `eth_sendTransaction` on **Base mainnet** from the connected wallet. It costs gas,
it is permanent, and there is no undo. Opening the first pool moves real funds. The page says so
before it lets anyone in, and it is the first thing to understand about the rest of this document.

**No address in `config.js` is filled in.** They were left empty on purpose: this was built in an
environment with no route to Base, so nothing could be checked against the chain, and an address
written from memory into a tool that moves money is how someone's liquidity ends up somewhere it
cannot be recovered from. Fill them from a source you trust, and the pad will check them for you —
on connect it calls `symbol()` and `decimals()` on every one and refuses to launch against anything
whose answers do not match. The router has to answer like a Uniswap V2 router, and its `WETH()` has
to match the config, or pools stay off.

No build step for the site, and no dependencies at runtime. Plain HTML, CSS and vanilla JS, plus one
generated file holding the compiled contract.

## Structure

```
index.html            the page: the door, pinned nav, hero, ticker, the coin board,
                      how it works, the asset desk, the playground, the pad and
                      the spin record, proof, FAQ and footer
config.js             the chain, the router and the sixteen tokens. Addresses are
                      empty until someone fills them; nothing else needs editing
chain.js              wallet, encoding, on-chain verification, deploy, pool
app.js                the board, the step machine, the mat and its figure, the
                      cards, the metrics and local storage
styles.css            the design system
server.js             the static server Railway runs — no dependencies
contract/
  SpinpadCoin.sol     the ERC-20 that carries its own draw
  build.js            compiles it (needs solc; not a dependency of the site)
  spinpad-coin.js     generated: bytecode + ABI, the only thing the page loads
test/
  contract.test.js    deploys the shipped creation code in a local EVM
  launch.test.js      drives the real launch path with a fake wallet
  rule.test.js        the rule, in a real browser
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
   produces nothing.
4. **Minting closes the flow.** A successful launch moves to a terminal step where every control
   is shut, so one spin can only ever produce one coin. Without it, a second click re-mints the
   same draft — from one spin, with a duplicate ticker the form itself refuses to accept.

Every one of those is held down by a check in `test/rule.test.js`, including the console attacks.

The moment the arrow stops, `resolveSpin()` reads both coordinates, looks the asset up in the same
table the board is drawn from, and writes it into the form's underlying-asset field, the preview
sphere, the launch summary and the figure on the mat at once, marking the field locked. There is
nothing to choose and nothing to confirm: the draw fills it in.

## Checks

```bash
npm i --no-save playwright solc @ethereumjs/evm @ethereumjs/util ethereum-cryptography
CHROME_PATH=/path/to/chrome npm test
```

None of those are dependencies of the site. It ships no runtime dependencies at all.

### The chain, checked without a chain

`test/contract.test.js` does not test a copy of the encoder. It loads `chain.js` exactly as the page
loads it, builds the creation code the pad would send, and **deploys that in a local EVM**, then
reads every field back: name, symbol, supply, decimals, the creator's balance, and all four fields
of the draw. It also recomputes every function selector in `chain.js` from the signature written
beside it, and asserts the ABI exposes no writable function beyond `approve`, `transfer` and
`transferFrom` — nothing that could rewrite a draw.

`test/launch.test.js` serves the page with the real `server.js`, injects a fake EIP-1193 wallet and
a test config whose addresses resolve, and then checks **the exact bytes the pad hands the wallet**:
that a deployment is a create with no `to`, starting with the compiled bytecode and carrying the
encoded draw; that a pool is an approval to the router followed by `addLiquidity` with the right
pair, the configured share of supply, the amount that was typed, minimums 1% under each side, the
connected account as recipient and a deadline in the future. Nothing is broadcast.

The contract was compiled for `evmVersion: paris` on purpose: Shanghai and later emit `PUSH0`, which
is not accepted on every chain a token might be deployed to, and the saving is a handful of gas.
That was not a guess — the local EVM rejected the Shanghai build with `invalid opcode`.

`test/rule.test.js` runs the whole rule in a real browser and the server in a real process. It is
not a unit test of the internals; it goes at the product the way someone trying to cheat it would.

- The launch control ships disabled, and forcing it open from a console and clicking mints nothing.
- An invalid draft never reaches the spin; the asset field is empty until the arrow stops.
- After the draw, the asset appears in the form, the preview, the summary and the figure on the mat,
  and the spin is spent with no way back to the details.
- Calling the spin again from a console does not change what was drawn.
- One spin mints one coin: a second launch, with the control forced open again, mints nothing.
- **The dot under the needle is the asset reported.** The test rebuilds the board's table itself
  from first principles, reads the needle's resting angle out of the computed transform, and works
  out which dot that is — so if `app.js` and the page ever disagree about what the arrow is
  pointing at, this fails.
- The mat is a control: tapping a circle moves that limb, and onto the right asset.
- The nav links are focusable, and nothing logs to the console along the way.
- The server survives a malformed escape (`/%`) and a NUL byte (`/a%00b`) — both throw
  synchronously in Node and would otherwise take the process down — and keeps serving afterwards.

Playwright is deliberately **not** a dependency: the site itself ships none, and nothing in the
deploy path installs anything.

One id collision was worth the bug it caused. The launch *section* and the launch *button* both
carried `id="launch"`, so `getElementById` returned the section, `disabled` was set on a `<section>`
where it means nothing, and the button — which ships disabled in the markup — could never open. The
button is `#launchBtn` now, and the checks below cover it.

The second spin is closed the same way: `doSpin()` returns early once `flow.spin` exists, so
calling it by hand does not change the colour already drawn.

**Discarding is not re-rolling.** Discard clears the entire draft — name, ticker, supply,
description and the spin — and returns to step one. *Back to details* exists only before the spin;
the moment the needle moves, it is gone.

## The board

Sixteen dots spaced 22.5° apart, in four quadrants of four (bid hand, ask hand, short leg, long leg,
clockwise from twelve). Every quadrant carries all four colours, so each (colour, quadrant) pair —
and therefore each asset — appears exactly once around the board. The colour order rotates one place
per quadrant so no two neighbouring quadrants open on the same colour.

The dot comes from `crypto.getRandomValues`, not `Math.random`. A `Uint32` is taken modulo 16, and
since 2^32 is a multiple of 16 there is no modulo bias: each asset is drawn 6.25% of the time and
each colour family 25%. Measured over 80,000 draws of the colour: green 24.68%, yellow 25.34%,
blue 25.20%, red 24.77%.

### The mat

The playground is the board laid flat on the floor: four rows, one per hand and foot, by four
colour columns, under the spinner's own crosshair. It is the pairing table with the perspective of
the game it came from. Tap a circle and that limb walks onto it, **or drag a hand or a foot along
its row** — the drag asks the document what is under the pointer rather than mapping coordinates,
because the floor is rotated in 3D and hit testing is the only cheap way to get that right. A drop
outside the limb's own row leaves it where it was. When the arrow resolves, the figure moves by
itself, so the draw is something you watch rather than read.

Nothing in the playground launches anything, which is why it is not in the pad.

The circles are drawn inside cell-sized buttons rather than being buttons themselves. Under the
floor's rotation a circle's own box projects to a trapezoid whose centre can land outside it, so a
tap aimed at the middle of the mark would miss — that was a real bug, caught by clicking the mat in
a browser, not a theoretical one. The figure measures the laid-out positions of the circles with
`offsetLeft`/`offsetTop` rather than computing them: the floor is rotated in 3D, so a client rect
would come back projected and the limbs would land beside the dots instead of on them.

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

**The four colours are reserved: each one always means the same family.** Every
piece of chrome — buttons, links, chips, the nav, the board's hub — is ink on
white. A blue progress bar on a Motion coin would quietly break the only code the
product has, so each card's curve, sphere and tint take the colour of the family
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

The distribution chart stays at four bars, one per family, rather than sixteen: a
sixteen-bar chart of a handful of launches would be mostly empty, and the family
share is the number that says whether the board is flat.

## The door

The first visit is gated on reading what this is. It says, in as many words, that there is no
chain, no contract and no money; that the asset is drawn rather than chosen; that Meta, Tesla,
Nvidia and Amazon are labels on a demo with no connection to it; that every figure was invented;
and that pairing a real token to a listed share is a serious regulated act in most of the world.
Getting in needs a deliberate tick, not a dismissal — Escape is refused — and the answer is
remembered under `spinpad.gate.v1`. If storage is blocked it asks again, which is the right way
round for a disclaimer.

## The data

- Launches are kept in `localStorage` under `spinpad.coins.v2` so the board has something to show;
  the chain holds the real record, and every card links to it. Reads and writes are wrapped in
  `try/catch`, so a browser that blocks storage still runs.
- There are no seeded sample coins. A pad that deploys for real has no business showing invented
  ones, and there are no invented prices, caps or curves anywhere on the page any more.
- Coming back to the tab blooms the coloured ground in again — the mat under the playground and the
  assets behind the hero. Decoration, so it is skipped under `prefers-reduced-motion`.

## Before the first real launch

1. **Fill in `config.js`** — the router, its `WETH()`, and the sixteen token addresses with their
   decimals. Take them from each token's own site or a verified contract page, not from a search
   result and not from this file.
2. **Connect and read the panel.** The pad checks every address against the live chain and tells
   you, one by one, what answered and what did not. Squares that did not verify cannot be launched
   against.
3. **Launch one coin with a small supply first**, and look at it on the explorer before opening any
   pool. The deployment and the pool are separate transactions precisely so this is possible.
4. **Understand what a first pool is.** A new pair with thin liquidity is trivially easy for anyone
   to drain, and the pad does not lock, vest or protect anything. It opens a pool; that is all.

Nothing here is an investment, an offer or advice, and no outcome is promised — the pairing is
decided by a spinner. The tokens on the board are third-party ERC-20s, named only to identify what
a pool would pair against; naming one implies no relationship with or endorsement by its issuer.
The colour-dial mechanic is an homage to the floor game of the same idea; **Twister is a trademark
of Hasbro** and this project is not affiliated with it.
