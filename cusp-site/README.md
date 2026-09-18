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
tokens.css    the palette, the type and the shared primitives — loaded first everywhere
styles.css    the vaults page's layout
legal.css     the reading column the three legal pages add on top of it
swap.css      the swap page's own furniture
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

One palette for the whole site, in `tokens.css`, modelled on `usevertex.xyz`: a
warm grey ground, a dark navy band across the top of every page, white cards,
and mint as the state colour. Nothing below `tokens.css` redefines a colour, so
changing one there changes it everywhere.

**Two accents, and they never swap jobs.** Dark navy `#3D3B4E` is the primary
action — the button you press, the band, the toast. Mint `#C6F3DA` and its green
`#1D9E68` are the live state — what is selected, active, best, in range. A
deposit button is navy; the filter you picked is mint; the APR you are earning is
green.

| Token | Value | Role |
| --- | --- | --- |
| `--band` / `--band-hi` | `#3D3B4E` / `#4A4860` | the dark band, primary buttons, toasts |
| `--bg` / `--head` | `#ECECEA` / `#F5F5F3` | the page ground and the lighter bands |
| `--card` | `#FFFFFF` | rows, cards, inputs |
| `--ink` / `--muted` / `--dim` | `#2B2937` / `#6E6D79` / `#9A98A4` | headings, body copy, micro-labels |
| `--line` / `--line-2` | `#E3E3DF` / `#EEEEEA` | borders, and the lighter rules inside a card |
| `--mint` / `--mint-line` / `--mint-pill` | `#C6F3DA` / `#96E0B8` / `#ADEFC9` | selected, active, held, best |
| `--green` / `--green-deep` | `#1D9E68` / `#14714A` | accent text: APR, links, the winning route |
| `--warn` / `--down` | `#B4802A` / `#C24B45` | rebalancing, paused, a price that fell |

**Light only.** The site this follows has no dark theme, so neither does this one;
the switch that used to be in the nav is gone rather than left switching between
two palettes that no longer exist.

Type is **Schibsted Grotesk** throughout, the closest thing on Google Fonts to the
grotesque the reference uses — the real one could not be read, the site being
unreachable from where this was built. There is no monospace anywhere: figures are
set in the same family, as they are on the reference.

Figures are *not* tabular. This family gives the comma a full-width slot under
`font-variant-numeric: tabular-nums`, and `$29 , 555` is worse than a column that
sits a pixel off.

Sizes are in px because they were measured off screenshots of the reference, and
rounding them into rems would have lost the thing being matched.

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
- **Nav** — the burger drops the sections below the bar under 1080px; an
  `IntersectionObserver` marks the active one.

## The swap page

`swap.html` follows `usevertex.xyz/trade/swap` closely: the dark band with its
dashed grid, the hatched strip under it, the three mode tiles, the swap card and
the route competition beside it, and the two content widths — 1160px for the
header, 900px for the cards.

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
