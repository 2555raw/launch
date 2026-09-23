# Spinpad — a launchpad where a wheel picks the pairing

**Nothing launches until the wheel has been spun, and where it stops decides what the coin is
paired with.** The result is then written into the token's own contract, at construction, with no
function anywhere that can change it afterwards.

The wheel gives two coordinates, and it takes both to name a cell. A **body position** — left hand,
right hand, left foot, right foot — and a **colour** — red, yellow, green, blue. Four by four is
sixteen cells, sixteen assets, one to a cell, each drawn one time in sixteen. Left hand on yellow is
Amazon; left hand on red is Tesla; left hand on green is Nvidia; right foot on blue is Coinbase.

**All sixteen are pair tokens a launch can really name**, which is the constraint that picked them:
they are on the list of 63 stock tokens Pons v2 accepts as the `pairToken` argument of a launch, on
Robinhood Chain. Red is Tesla, Netflix, AMD and Reddit; yellow is Amazon, Snapchat, Microsoft and
Cloudflare; green is Nvidia, Shopify, Apple and Roblox; blue is Meta, Google, Intel and Coinbase. A
check pins each colour's four as a set, so moving one somewhere else is a deliberate edit rather
than a slip.

Colour could not be matched to brand the way an invented set can be. Of those 63, checked by hue
against every mark in `simple-icons`, exactly two are green: Nvidia and Shopify. The set skews hard
to blue — Meta, Google, Intel, Coinbase, Boeing, Dell, Ford, Pfizer, IBM — and 33 of the 63 have no
published mark at all, including the ones that are green in real life (Bloom Energy, Constellation).
So green takes the two real greens plus Apple and Roblox, whose marks are black and read on any
ground. Red and yellow do line up.

**That table lives in exactly one place: `config.js`.** The wheel, the board, the asset desk, the
result screen and the value encoded into the constructor are all read out of the same object, so they cannot drift apart. Changing a pairing is changing one line.

**Two things are kept apart, on purpose.** The **pairing** is a name: the cell the wheel lands on is
written into the contract as text. There is no oracle, nothing tracks a share price, and none of
those companies have anything to do with it. The **pool** is a real token: a company is not an
ERC-20, so every pool is opened against the one `quote` token in `config.js`, whose address is
verified against the chain before the pad will touch it.

Naming a tradeable token after a listed company is a real-world risk rather than a styling choice —
other people's trademarks, and regulators who take an interest in anything that looks like a bet on
a share. `config.js` is one file and the names are all in it, which is where that decision lives.

One spin per launch. It cannot be repeated, and the pairing cannot be edited afterwards. There is
no reroll, and that is the product rather than a missing feature.

## This deploys real contracts

Launching calls `eth_sendTransaction` on **Base mainnet** from the connected wallet. It costs gas,
it is permanent, and there is no undo. Opening the first pool moves real funds. The page says so
before it lets anyone in, and it is the first thing to understand about the rest of this document.

**What a coin is actually paired with is one token, not sixteen.** The names on the board go into
the contract as text. The pool opens against `quote` in `config.js`, and that is the only address
the pad needs to move money.

That one is filled in: **WETH on Base, `0x4200000000000000000000000000000000000006`.** It was not
written from memory. It came out of the `@uniswap/default-token-list` package — Uniswap Labs
Default, v22.21.0 — and the WETH9 map in `@uniswap/sdk-core` independently agrees on the same forty
characters. Every logo CDN is refused by the network this was built on, but the npm registry is not,
and a published package is a source you can check rather than a thing a model remembers.

To pair against something else, replace four lines. From the same list, on Base: USDC (6 decimals)
`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, USDbC (6) `0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA`,
cbBTC (8) `0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf`, DAI (18)
`0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb`, EURC (6)
`0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42`. It has to be a plain ERC-20: `addLiquidity` computes
the amounts before it transfers, so a fee-on-transfer or rebasing token leaves the pool wrong.

**The router is still empty, and for a different reason.** No package publishes a V2 router address
for Base — `@uniswap/v2-sdk` ships one factory and it is Ethereum mainnet's. There was nothing to
copy from a source, so nothing was written. Fill `router.address` and `router.weth` from the
router's own deployment page. Until then the pad deploys coins and pools stay off, which is the
right way round.

Whatever is in there, the pad checks against the live chain on connect: `symbol()` and `decimals()`
on the quote token, `WETH()` and `factory()` on the router, and it refuses anything that disagrees.
Deploying a coin needs neither — the pairing is a name, so the sixteen cells carry no address at all.

Aerodrome is the large DEX on Base and is **not** a drop-in: it is Solidly-style and its
`addLiquidity` takes a `stable` flag this pad does not send.

**And not a tokenized share either.** This is the question the board's sixteen names invite, so:
tokenized US equities do exist as ERC-20s on Base — Dinari's dShares, whose official SDK lists
`eip155:8453` among its chains. They still cannot be the quote token here, because they are
permissioned. That same SDK is built around KYC — document types, statuses, managed checks — so only
approved wallets may hold the token, and a Uniswap V2 pair is an anonymous contract with no KYC:
`addLiquidity`'s `transferFrom` into the pair reverts. A permissionless pool against a permissioned
token is not a thing. (Backed Finance's xStocks — AAPLx, TSLAx, GOOGLx — are Solana SPL tokens, so
they are not candidates on an EVM chain at all.)

That is why the sixteen are names and the pool is WETH. Not a shortcut around the hard version — the
only shape that works. A pad that really paired against Tesla would need every buyer to clear an
issuer's KYC, at which point it is a broker rather than a launchpad.

### Logos

`config.js` already points every cell at `assets/<ticker>.png`, so there is nothing to wire: drop
`tsla.png` into `assets/` and Tesla's cell wears it. A missing file costs nothing — the drawn mark
and the logo are stacked in the same box and the image only becomes visible once it has actually
loaded, so a cell with no file simply keeps its drawn mark. `assets/README.md` has the full list of
filenames, grouped by colour.

All sixteen ship, so every disc on the board is white with its colour as a ring.

They come from two places. Eight are pictures — bitmaps, trimmed and scaled to 128px. The other
eight are vectors rendered from the `simple-icons` package: official single-colour marks in each
brand's own hex, which on a white disc reads better than a photograph of a logo and needs no
trimming or keying at all. The package is not a dependency; it was used once to write the files.

The `load` listener is on the document in the capture phase, because `load` on an `<img>` does not
bubble and the disc is one level further out than the `<span>` an inline `onload` can reach.

An `onerror` handler was the obvious way to do the fallback, and it did not work: sixteen missing
files left sixteen broken images across the board. Making the fallback the default state rather
than a recovery from one is why there is a check for it.

The bitmaps were deliberately **not** chroma-keyed. Several came on a white field, and knocking
near-white out to alpha leaves a white fringe on every anti-aliased edge — the pixels between the
mark and the field are neither, and a threshold cannot tell which way they go. The white disc makes
a white field disappear anyway.

Trimming reads the top-left pixel, which is what makes a logo on a coloured card work: Snapchat
loses its yellow border down to the ghost and Microsoft loses its grey one down to the four squares.
A mark on a *dark* field is the case that does not work — trimmed, it still carries dark corners
into a white disc — and none of the bitmaps are one.

No build step for the site, and no dependencies at runtime. Plain HTML, CSS and vanilla JS, plus one
generated file holding the compiled contract.

## Structure

```
index.html            the page: the door, floating nav, hero, ticker, the
                      board, the pad, how it works, the asset desk, proof,
                      FAQ and footer
config.js             the chain, the router, the quote token and THE PAIRING
                      TABLE — position + colour → asset, sixteen lines
chain.js              wallet, encoding, on-chain verification, deploy, pool
app.js                the wheel, the board, the stage machine, the proof list,
                      the metrics and local storage
styles.css            the design system
server.js             the static server Railway runs — no dependencies
contract/
  SpinpadCoin.sol     the ERC-20 that carries its own pairing
  build.js            compiles it (needs solc; not a dependency of the site)
  spinpad-coin.js     generated: bytecode + ABI, the only thing the page loads
test/
  contract.test.js    deploys the shipped creation code in a local EVM
  launch.test.js      drives the real launch path with a fake wallet
  rule.test.js        the rule, the table and the layout, in a real browser
```

## The flow

Five screens, one at a time, because the flow is the interface:

1. **Create** — name, ticker, supply, an optional line of description and an optional image link,
   with what is being made beside it: a preview sphere carrying the ticker, and a launch summary
   that follows the draft as it is typed. The pairing slot says *Decided by the wheel · You cannot
   pick this*, the sphere is the only one on the site with no colour, and the summary's pairing,
   colour and position rows all read *Decided by the wheel*. The preview is the one place the rule
   is visible as an absence rather than a sentence.

   That summary and the one on the confirmation are rendered from a single list of rows, because
   two copies of it are two chances for the screen someone reads to disagree with the screen that
   launches. A check compares the two panels row for row.

   Every field carries a line saying what it will be used for, and above the button there is a note
   about the wallet that changes with the wallet's state: none in the browser, present but not
   connected, connected, connected on the wrong network. **It is deliberately not a blocker.** A
   wallet is needed to launch, not to spin, and asking someone to sign something before they have
   even seen the wheel is asking for a signature to look at a website. Its button is the header's
   button rather than a second path to a wallet.
2. **Spin** — the wheel, large and centred, and one button. *Let the wheel decide. One spin, one
   pairing.*
3. **Result** — `YOU LANDED ON / LEFT FOOT · BLUE`, then `PAIRING / Intel`, then `PAIRING LOCKED`.
   There is no reroll control on this screen, and a check asserts there is no button on it whose
   label offers one.
4. **Launch** — the confirmation: everything that is about to be deployed, including the pairing and
   the exact combination that produced it, and the one control that sends the transaction.
5. **Done** — the record, with the contract and the transaction on the explorer, and the optional
   first pool.

The image link is local to this browser: it is shown on the proof row and never uploaded, never
stored on chain. Only `https://` is accepted — an `http://` image is blocked on an https page
anyway, and a `javascript:` or `data:` URL there would be an injection with extra steps.

## Where the rule lives

That a coin cannot be launched without a spin, paired with anything other than what the wheel gave,
is not a note in the interface. It is enforced in four independent places in `app.js`, deliberately.

1. **The control ships disabled.** `#launchBtn` carries `disabled` in the markup.
2. **The stage machine gates it.** `setStep(n)` recomputes what is reachable at each stage;
   `#launchBtn` only opens on `n === 4 && flow.spin`.
3. **`launch()` re-checks before it writes.** Missing spin, draft or stage and it reports,
   re-synchronises the controls and returns. Setting `disabled = false` from a console and clicking
   produces nothing.
4. **Launching closes the flow.** A successful launch moves to a terminal stage where every control
   is shut, so one spin can only ever produce one coin. Without it, a second click re-launches the
   same draft — from one spin, with a duplicate ticker the form itself refuses to accept.

And the pairing itself has one writer. `flow.spin` is assigned in exactly one function,
`resolveSpin()`, and guarded against a second assignment. Every screen downstream — the result, the
confirmation, the constructor arguments, the stored record — reads that object. **The pairing shown
and the pairing launched are the same value by construction, not by agreement**, and there is no
control anywhere that writes to it.

One id collision was worth the bug it caused. The launch *section* and the launch *button* both
carried `id="launch"`, so `getElementById` returned the section, `disabled` was set on a `<section>`
where it means nothing, and the button — which ships disabled in the markup — could never open. The
button is `#launchBtn` now.

**Discarding is not rerolling.** Discard clears the entire draft — name, ticker, supply, description
and the spin — and returns to the first screen. *Back to details* exists only before the spin; the
moment the arrow moves, it is gone.

## The wheel

Sixteen nodes spaced 22.5° apart. Each position owns a quarter of the wheel, and the colour order
steps round by one from quarter to quarter, so no two neighbouring quarters open on the same colour
and every (position, colour) pair sits on the wheel exactly once.

The corner labels are written from the table by JavaScript rather than typed into the markup: which
quarter a position owns is decided by its index in `config.js`, and a label that disagreed with the
geometry would be a lie about where the arrow is pointing. A check asserts quarter 0 is labelled
top-right, and so on round.

The node comes from `crypto.getRandomValues`, not `Math.random`. A `Uint32` is taken modulo 16, and
since 2^32 is a multiple of 16 there is no modulo bias: each asset is drawn 6.25% of the time and
each colour 25%.

The arrow turns five to seven full rotations plus the offset needed to land on the chosen node, with
a random margin inside the node's slice so it never stops at the same point twice. The outcome
resolves on `transitionend`, with a `setTimeout` behind it: a tab backgrounded mid-spin never fires
the transition, and without the fallback the spin would hang.

## Design

Editorial rather than crypto: a lot of white, one strong typeface, hairline rules and almost no
chrome. The interface is black on white.

**The four colours belong to the mechanic.** A colour on this page always means a colour on the
wheel — never a mood, a status, a gradient or a chart. Everything else, every button, link, chip,
rule and label, is ink on white. That is the only rule the palette has and everything else follows
from it. There are no gradients, no sparklines, no invented figures and no dashboard.

Each colour carries two tokens, `--c` (the colour) and `--on` (what reads on top of it). Yellow
`#FDD208` against white sits at 1.4:1, so text on yellow drops to ink while the other three take
white.

Type: **Plus Jakarta Sans** throughout — 700–800 for display, 400–600 for text — with **JetBrains
Mono** for tickers, supplies, hashes and timestamps.

The nav is a floating panel rather than a bar welded to the window: it sits in the same 1200px
column as the rest of the page, so its edges line up with the content under it and the page visibly
runs behind it. On a phone it becomes a card — a 999px radius around a stacked menu reads as a
mistake — and the last link drops its rule so it does not cut across the rounded corner.

**The hero is one screen and nothing of the next one.** Its floor is the window less the nav's
height and the gap the nav floats by, because the nav sits in normal flow above it — without
subtracting both, the first screen is a nav plus a full viewport and the board peeks in at the
bottom. It is `dvh` rather than `svh`: `svh` is the window with the browser's chrome showing, so
when the chrome retracts an `svh` hero stops short and the board slides into view, which is the
exact gap being closed. And it is a `min-height`, not a `height`: on a phone the copy and the wheel
together are taller than the window, and a fixed height would either squash them or spill them out
of a section that clips — taller than one screen also means the next section is not visible, which
is the same answer by another route.

A short window is where that breaks, and it took a second pass. The hero grows past its own floor to
fit the copy, and the two controls pinned to its bottom edge end up below the fold — visible only to
someone who has already scrolled, which is the one group that does not need them. Under 880px of
height the wheel takes a height cap and the headline steps down so the content fits inside the floor
instead of pushing past it. Under 860px of width, where the hero stacks and is taller than the
window whatever happens, the scroll cue goes away (the half-visible wheel says the same thing) and
the motion control stops being pinned and sits under the buttons. Six window sizes are checked, tall
and short and narrow, for a board that stays off screen and a motion control that does not.

The hero is one headline and one object: the wheel, which tilts a little under the cursor and names
the pairing under whichever node you point at. It is SVG generated at runtime from the same
`SECTORS` table the outcome is read from, and its sixteen nodes are lit the same way the drifting
spheres behind it are, from one source in the top left — two objects in one room rather than a flat
diagram next to a rendering.

Both wheels build their gradients with ids carrying their own element's id. Two SVGs in one document
sharing gradient ids is invalid, and it fails silently: the second wheel simply paints itself with
the first one's fills, which looks right until the two wheels differ. There is a check.

### The drifting sixteen

Behind the hero, every asset on the board floats once, each on a disc of its own colour, over a very
faint wash of the four. It is built from the pairing table like everything else, so the first thing
anyone sees cannot advertise a pairing the wheel will not give — a check counts sixteen chips, four
per colour, no asset twice.

Four things about it are decisions rather than defaults:

- **The slots are written out, not randomised.** Random placement stacks two discs on top of each
  other about as often as not, and drops one behind the headline where it fights the only words on
  the page. The near, solid discs hold the margins; the faint ones fill the middle distance.
- **Depth is size and opacity, never blur.** A blurred element that animates repaints every frame,
  and sixteen of them is how a landing page starts dropping frames on a laptop.
- **They are lit, not coloured in.** Each one is a body gradient from one source in the top left, a
  terminator and a ground bounce as inset shadows, a rim where the edge catches light from behind,
  a cast shadow underneath, and a single gloss layer over the top. That last one is what makes the
  white label read as printed on the sphere rather than stuck in front of it — it passes over both.
  The shading is written in `em` and the sphere's font-size is its own diameter, so one set of
  numbers holds at 38px and at 94px; a highlight in fixed pixels is a pinprick on the big ones and
  a wash on the small. The three extra colours per sphere are mixed in JavaScript from the one hex
  in `config.js`, so they cannot drift away from it.
- **Two elements per chip.** The outer one places it and plays the arrival once; the inner one
  floats for ever. One element cannot do both — the second animation would replace the first.
- **Every chip carries a zone.** A layout tuned for two columns has nothing to say about one: on a
  phone the hero is nearly twice as tall, every percentage lands somewhere else, and a disc that sat
  in the gap between the copy and the wheel ends up on the headline. Narrow screens keep the six
  edge chips, at half size and quieter, and drop the rest.

There is a **Pause motion** control, and it is not a nicety: sixteen things moving indefinitely is
exactly what a pause control is for. A check presses it and asserts the animation actually stops,
that it resumes, and that the label and `aria-pressed` follow. Under `prefers-reduced-motion` the
chips arrive and then hold still.

A stage's `display` is declared next to the rule that reveals it, never on its `.sp-stage-*` class.
Those class rules sit lower in the file, and a `display` on one of them beats
`.sp-stage { display: none }` — which leaves that stage on screen at every step. That happened; the
comment in `styles.css` is there so it does not happen again.

### The distribution chart

Four horizontal bars in fixed colour order, never reordered by rank, with a dashed rule at the 25%
each colour is expected to draw.

Running the four fills through a palette validator returns a pass on colourblind separation — the
worst adjacent pair, yellow against green, holds ΔE 18.4 under protanopia — but a contrast warning:
against white, green reaches 3.0:1 and yellow only 1.4:1, both under the 3:1 floor for a mark that
has to be findable. Those fills are not free to change, because the colour *is* the data. So the
relief is built in instead, and it is not optional:

- every bar carries a visible ink label with its share and its count, so no value is encoded in
  colour alone;
- each fill takes a hairline ink ring, which keeps the light ones visible against the surface;
- the reference rule sits above the fills with a white edge behind the dashes, so it stays readable
  where a bar runs past it.

It stays at four bars rather than sixteen: a sixteen-bar chart of a handful of launches would be
mostly empty, and the colour share is the number that says whether the wheel is flat.

## The door

The first visit is gated on reading what this is: that launching deploys a real ERC-20 on Base and
costs gas from your own address, with no undo and no support desk; that you do not pick the pairing
and a wheel does, once; that opening a pool moves real funds and a new pool with thin liquidity is
trivially easy for anyone to drain; and that nothing here is an investment and nobody is advising
you. Getting in needs a deliberate tick, not a dismissal — Escape is refused — and the answer is
remembered under `spinpad.gate.v1`. If storage is blocked it asks again, which is the right way
round for a disclaimer.

## The data

- Launches are kept in `localStorage` under `spinpad.coins.v4` so the proof list has something to
  show; the chain holds the real record, and every row links to its transaction. Reads and writes
  are wrapped in `try/catch`, so a browser that blocks storage still runs. The key moves whenever
  the record's shape changes, rather than the reader guessing about an older one.
- **Proof shows real launches only.** There are no seeded coins, no invented prices, caps, curves or
  holder counts anywhere on the page. Before the first launch the list is empty and says so.

## Running it

Open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 8000     # then open http://localhost:8000
```

Deploy by dropping the folder on any static host (Netlify, Vercel, GitHub Pages, S3, Cloudflare
Pages).

### On Railway

`server.js` is the whole server: no dependencies, reads the file off disk and hands it back with the
right content type. Railway passes `PORT` in; 8080 is the fallback, because that is what a generated
domain points at otherwise.

The service is configured with **root directory `/spinpad`** and **start command `node server.js`**,
which is the part worth writing down: a service pointed at the repository root finds no
`package.json` and the build fails before it reaches anything. HTML is served `no-cache` so a
redeploy shows up immediately, everything else gets an hour.

## Checks

```bash
npm i --no-save playwright solc @ethereumjs/evm @ethereumjs/util ethereum-cryptography
CHROME_PATH=/path/to/chrome npm test
```

None of those are dependencies of the site. It ships no runtime dependencies at all, and nothing in
the deploy path installs anything.

185 checks across three suites.

### The chain, checked without a chain

`test/contract.test.js` does not test a copy of the encoder. It loads `chain.js` exactly as the page
loads it, builds the creation code the pad would send, and **deploys that in a local EVM**, then
reads every field back: name, symbol, supply, decimals, the creator's balance, and all the fields of
the draw. It also recomputes every function selector in `chain.js` from the signature written beside
it, and asserts the ABI exposes no writable function beyond `approve`, `transfer` and `transferFrom`
— nothing that could rewrite a pairing.

The contract was compiled for `evmVersion: paris` on purpose: Shanghai and later emit `PUSH0`, which
is not accepted on every chain a token might be deployed to, and the saving is a handful of gas.
That was not a guess — the local EVM rejected the Shanghai build with `invalid opcode`.

`test/launch.test.js` serves the page with the real `server.js`, injects a fake EIP-1193 wallet and
a test config whose addresses resolve, and then checks **the exact bytes the pad hands the wallet**:

- a deployment is a create with no `to`, starting with the compiled bytecode;
- **the asset the result screen showed is the asset in the constructor**, and no other cell's name
  appears anywhere in the encoded arguments — the sixteen test names are zero-padded so none is a
  prefix of another and a partial match cannot pass this;
- the colour and the position it landed on are in there too;
- a forced second launch after the first sends nothing;
- a pool is **two** approvals — the coin and the quote token, each for exactly the amount about to
  be used and never unlimited — followed by `addLiquidity` with the right pair, the configured share
  of supply, the amount that was typed, minimums 1% under each side, the connected account as
  recipient and a deadline in the future.

Nothing is broadcast.

That test used to assert three transactions, and that was the bug: V2's `addLiquidity` pulls **both**
sides with `transferFrom`, so approving only the coin makes the liquidity call revert with
`TRANSFER_FROM_FAILED` — the pool could never have opened. The test agreed with the code instead of
with the router, which is the worst way for a test to be green. It asserts four now, and removing
either approval fails it.

### The rule, the table and the layout, in a browser

`test/rule.test.js` runs the whole product in a real browser and the server in a real process. It is
not a unit test of the internals; it goes at the product the way someone trying to cheat it would.

- **The table is one table.** Sixteen pairings, no cell missing, no asset twice, and the four
  mappings named in the brief are asserted by hand.
- The launch control ships disabled, and forcing it open from a console and clicking launches
  nothing.
- An invalid draft never reaches the spin, a `javascript:` image link is refused, and the pairing
  slot is empty until the wheel stops.
- **The node the wheel marked is the one the arrow is over.** The test rebuilds the wheel's geometry
  itself from the axes in `config.js`, reads the arrow's resting rotation, resolves it to a cell, and
  then measures the marked node off the drawing and compares its bearing from the centre with where
  the arrow stopped. If `app.js` ever draws the nodes in a different order from the one it reads the
  result from, this fails.
- **What the result screen says is what the confirmation says**, down to no other cell's name
  appearing anywhere on it.
- Calling the spin again from a console changes nothing and does not move the pad.
- Nothing on the result screen is a control that offers another spin.
- A logo that loaded sits on a white disc with the colour as a ring. And because every cell now
  ships one, the fallback is probed directly: a cell pointed at a file that does not exist stays
  coloured, shows no broken image and keeps its drawn mark. Without that, the old check —
  "cells with no logo equals sixteen minus cells with one" — passes as 0 === 0 and proves nothing.
- The proof list is empty rather than invented.
- **No sideways scroll at 1440, 1024, 768 or 390px**, the nav collapses to a menu on a phone, and
  the menu opens and closes again when something is picked.
- The nav links are focusable, and nothing logs to the console along the way.
- The server survives a malformed escape (`/%`) and a NUL byte (`/a%00b`) — both throw synchronously
  in Node and would otherwise take the process down — and keeps serving afterwards.

## Before the first real launch

1. **Fill in the router** — two addresses, `router.address` and its `WETH()`. The `quote` token is
   already WETH on Base. Take the router from its own deployment page, not from a search result and
   not from this file. The sixteen cells are names and carry no address.
2. **Connect and read the panel.** The pad calls `symbol()` and `decimals()` on the quote token and
   checks the router answers like a V2 router. If either fails, deploying still works and pools stay
   off.
3. **Launch one coin with a small supply first**, and look at it on the explorer before opening any
   pool. The deployment and the pool are separate transactions precisely so this is possible.
4. **Understand what a first pool is.** A new pair with thin liquidity is trivially easy for anyone
   to drain, and the pad does not lock, vest or protect anything. It opens a pool; that is all.

Nothing here is an investment, an offer or advice, and no outcome is promised — the pairing is
decided by a wheel. Asset names are written into the coin as a label and imply no relationship with,
or endorsement by, those companies; nothing tracks a share price. The colour-and-position mechanic
is an homage to the floor game of the same idea; **Twister is a trademark of Hasbro** and this
project is not affiliated with it.
