# Cusp — vaults page

Static page for **Cusp**, a fictional protocol running managed liquidity vaults for
tokenized stocks: deposit USDG, the vault keeps one concentrated position per
USDG / Stock Token pool centred on the oracle price, and the trading fees compound
inside the vault.

It is a design study built after `usevertex.xyz/vaults` — same kind of page and the
same mechanics, rebuilt from scratch with its own name, palette, mark and layout.
Not a copy of their markup: the original could not be loaded from this environment,
so nothing was lifted from it.

No build step, no dependencies. Plain HTML, CSS and vanilla JS.

## Structure

```
index.html    chain strip, nav, page head, your positions, filter toolbar, vault
              list, mechanics, fee split, safeguards, FAQ, contracts, footer,
              deposit drawer
swap.html     the swap page: dark band, the route competition, the swap card
terms.html    terms of use
risk.html     risk disclosure
privacy.html  privacy notice
styles.css    the design system (palette, type, layout) and the responsive rules
legal.css     the reading column the three legal pages add on top of it
swap.css      the swap page's own design system — it shares nothing with the above
wallet.js     the demo wallet, shared by every page
logos.js      the brand marks, shared by the vault list and the token pickers
app.js        the VAULTS data, deposits and redemptions, list rendering,
              search / filter / sort, the drawer, theme and the menu
swap.js       the tokens, the four aggregators, quoting and the swap itself
legal.js      theme, menu and the contents list for the legal pages
```

Every link on every page lands somewhere real — there are no `#` placeholders left.

## Run it

Open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 8000     # then open http://localhost:8000
```

Deploy by dropping the folder on any static host (Netlify, Vercel, GitHub Pages, S3,
Cloudflare Pages).

## Design

**One accent, and it is a calm warm magenta.** `#DA6A98` — hue 336, held back from
neon on purpose. It only ever means money: fee APR, the primary action, the
compounding 70% of the fee split, the live figures, the vault tickers. Nothing else
on the page is allowed to be magenta, which is what keeps it readable as a signal.

**The ground is pulled from the same hue, not from grey.** `#100D12` is a
plum-neutral black, and every card, line and muted text steps up from it on that
same family. With no competing colour in the page, the magenta never has to fight
anything.

Status is the single exception, and it is deliberately quiet: a sage dot for *in
range*, amber for *rebalancing*, rose for *paused*. They are dots, not a second
accent.

| Token | Dark | Light | Role |
| --- | --- | --- | --- |
| `--bg` / `--bg-alt` | `#100D12` / `#15111A` | `#FAF6F8` / `#F2EBF0` | page ground and the alternating bands |
| `--card` / `--card-hi` / `--surface` | `#1A151F` / `#211A27` / `#2A2231` | `#FFFFFF` / `#FCF6FA` / `#F0E6EE` | rows, hover state, tracks |
| `--ink` / `--prose` / `--muted` / `--dim` | `#F6F0F4` / `#D3C7D1` / `#A0929E` / `#776B76` | `#1F1720` / `#4A3C48` / `#6F6069` / `#92838C` | headings, body copy, secondary, micro-labels |
| `--line` / `--line-hi` | `#241E2A` / `#362D3E` | `#EADFE7` / `#D9C7D4` | borders and hover borders |
| `--accent-fill` | `#DA6A98` | `#DA6A98` | button and bar fills, in both themes |
| `--accent` | `#DA6A98` | `#A83B6C` | accent **text**: APR, figures, links |
| `--ok` / `--warn` / `--down` | `#86C7A4` / `#E2B172` / `#DD8189` | `#3E8A65` / `#9A6A1C` / `#B04C55` | in range, rebalancing, paused and negative moves |

The two accent tokens exist for contrast, not for taste. Dark ink on `#DA6A98`
clears 5.5:1, so the fill stays the same in both themes; but `#DA6A98` as small text
on the near-white ground only reaches about 2.9:1, so accent type in the light theme
drops to `#A83B6C`.

Tokens live on `:root`, not on `.cs` — the deposit drawer and its scrim sit outside
that wrapper and need the same palette.

Type: **Inter** for everything, **JetBrains Mono** for every figure, address and
label. Micro-labels use `.cs-label` — 10.5px mono, uppercase, `0.16em` tracking.

## Layout

The page is deliberately off-centre. The head runs two columns — copy on the left,
four figures stacked on the right — instead of a centred hero. The nav keeps the
brand at the left edge, floats the sections in a pill in the middle and puts the
wallet at the right. Below the list, every band is label-left / content-right, with
the label sticky so it holds while the content scrolls past it. The alt bands are
full-bleed but their content still lines up with the 1200px container, via
`padding-inline: calc(var(--gut) + max(0px, (100vw - var(--wrap)) / 2))`.

## The brand marks

Each row carries the real mark of the company behind the pool, inlined as SVG —
no network call, no build step, nothing to load at runtime.

- Eight come from **Simple Icons** (the SVG files are CC0).
- **AMZN** and **MSFT** come from **Font Awesome Free** (icons under CC BY 4.0),
  which is why they carry a different viewBox; Simple Icons does not ship those two.
- **COIN** is drawn in `app.js`: Simple Icons ships Coinbase as a wordmark, which is
  mud at 18px, so the symbol — a circle with a rounded square knocked out, on
  `fill-rule="evenodd"` — is written out by hand.

Every logo is the trademark of its owner. They are here to identify the stock
behind each pool and for no other purpose; a real deployment needs its own check on
that, tokenized equity being what it is.

Each entry carries two colours, because one is never enough across two themes:
`c` is the brand's own hex, used on the light theme, and `d` is the same mark
lifted enough to survive the dark ground — Apple's black and Palantir's near-black
simply vanish there, and Robinhood's chartreuse does the same on white. The pair is
handed to CSS as `--brand` / `--brand-dk` on each badge.

The badge itself went neutral when the logos landed: surface fill, plain border, no
magenta. The accent is money, and a brand mark is not money.

## The Cusp mark

A lens: two arcs meeting at a point top and bottom, with a dot at the centre. Those
two meeting points are the cusps — there is not a straight line anywhere in it, and
the favicon sits on a circle rather than a rounded square, so nothing about the mark
is square.

One path, one circle, `currentColor`, no fills to theme. It holds at 76px, at 24px
in the nav and at 16px, and the favicon is the same SVG inlined in a `data:` URI.

It replaced an angular chevron, which read as rigid next to a palette this soft.

## Interactive parts (`app.js`)

- **The list** — `VAULTS` is the only source of truth, and every figure on the page
  is derived from it: the four tiles at the top, the rows, the drawer. Search
  matches ticker or name, the chips filter by state (`new` is anything under 30
  days), the select sorts by APR, TVL, 24h fees or ticker. Rows are `<details>`, so
  expanding one needs no script; the buttons inside a `<summary>` stop their own
  click so the row does not toggle under them.
- **The demo wallet** — *play money, kept in this browser.* Connect and you get a
  random address and 25,000 USDG that exist nowhere else; nothing is signed and no
  chain is touched. The chip copies the address, and its menu shows the balance,
  what is deposited and how many vaults you hold, with a reset and a disconnect.
- **Deposits and redemptions actually move** — a deposit takes USDG off the
  balance, mints shares at the vault's share price, lifts that vault's TVL and its
  depositor count, and shows up as a badge on the row and a card under *Your
  positions*. Redeeming reverses all of it. The totals at the top of the page move
  with each one, because they are computed rather than typed.
- **The rules hold in the mock too** — a deposit is refused past the balance or past
  the vault's cap, a paused vault takes no deposits, and **a paused vault still
  redeems**, which is exactly what the FAQ and the terms promise. Share price is
  `1 + apr × age / 365`, so it is at least consistent with the vault it belongs to.
- **State survives a reload** — positions live in `localStorage` under `cusp-demo`,
  and the TVL each one sits in is rebuilt from them on load, so nothing drifts.
- **Deposit drawer** — two modes, deposit and withdraw, with a Max that fills in the
  balance, the room under the cap or the whole position. Closes on the scrim, the ✕
  or Escape.
- **Theme** — dark by default, with a switch and `localStorage` memory, wrapped in
  `try/catch` so a browser that blocks storage still renders.
- **Nav** — the burger drops the sections below the bar under 1080px; an
  `IntersectionObserver` marks the active one.

## The swap page

`swap.html` deliberately does **not** share the design system above. It follows
`usevertex.xyz/trade/swap`, which is the page it was asked to follow: the warm grey
ground, the dark band with its dashed grid, the hatched strip under it, the mint
accent, the white cards, and the two content widths — 1160px for the header, 900px
for everything else.

Type is **Schibsted Grotesk**, the closest thing on Google Fonts to the grotesque
that page uses; the real one could not be read, because the site is unreachable from
where this was built. Sizes are in px because they were measured off a screenshot,
and rounding them into rems would have lost the thing being matched.

What is *not* borrowed is the branding. The name, the mark and the four aggregators
are this project's own — Kestrel, Zeroth, Nordway and Lattice are invented, because
naming real routers would claim integrations that do not exist.

It works the same way the vault page does. Pick a pair, type an amount, and four
routers quote it with their own spread, their own gas and a little jitter, so
**Refresh** means something. The best one wins, drives the minimum received at your
slippage, and the swap moves the shared demo wallet's balances — swap ETH for USDG
here and the vaults page sees the USDG.

## The legal pages

Three of them: **terms**, **risk** and **privacy**. Same shell as the vaults page —
same nav, same footer, same tokens — with a sticky contents list on the left and the
prose on the right, which is the label-left / content-right rhythm the vaults page
already uses for its sections.

The copy is placeholder, and every page says so in a banner at the top: Cusp is not
a real protocol and none of this has been near a lawyer. It is written to show what
belongs on each page rather than to be lifted. Two parts are accurate about *this*
build and worth keeping: the privacy page's account of what is stored (`cusp-theme`,
`cusp-demo`, nothing else, no cookies, no analytics) and its note that Google Fonts
is the one external request the site makes — which is the thing to fix, by
self-hosting the two fonts, before any real launch.

## Animation

One entrance on scroll (`.cs-rise`), driven by an `IntersectionObserver` and scoped
to the `.cs-js` class the script adds — with no JS, or with
`prefers-reduced-motion`, the page renders complete on the first paint. Nothing
loops.

## Before going live

- **Every figure is sample data.** The ten vaults, the TVL, the APRs, the depositor
  counts and the contract addresses are invented; the footer says so.
- The tickers and their logos are real companies used as placeholder pool names,
  and the marks are their trademarks. Anything shipping for real needs its own list
  and the legal review that comes with tokenized equity.
- "Connect wallet", the deposit button and the footer links are inert.
- The fee split (70 / 20 / 10) and the name **Cusp** are placeholders — swap both
  before this is anything but a mock.
