# What is checked, and how

Every file here drives the real pages in a real browser. None of them stubs
anything: the assertions are against what the page computed and printed.

Install once, serve the site, then run them:

    npm install                       # playwright-core, and a browser
    npm run serve &                   # the site on 127.0.0.1:8931
    npm test                          # all ten, in order
    node invariants.mjs               # or one at a time

`npm install` pulls playwright-core but not a browser. Point it at one you
have with `PLAYWRIGHT_BROWSERS_PATH`, or change the `executablePath` at the
top of each file; they all launch Chromium the same way.

`fontroute.mjs` fulfils Google Fonts from a local mirror, because this
browser cannot verify the egress proxy's certificate and a silent fallback to
a system font makes every screenshot a lie about the type. Point `DIR` at a
mirror of your own, or drop the `useLocalFonts(page)` call if the network is
open where you run it.

| file | what it holds the site to |
| --- | --- |
| `invariants.mjs` | what a deposit is *supposed* to do: the USDG leaves, shares = amount ÷ share price, the vault's TVL and depositor count rise, the protocol TVL rises by the same, no entry fee is taken. Then: holding earns at the vault's own APR and a paused vault earns nothing; redeeming returns shares × share price and closes the position cleanly; a reload rebuilds the TVL from the positions without doubling it; the desk and the vault list are one wallet; disconnecting puts every vault back as it was. |
| `invariants2.mjs` | the cap actually refuses (with the vault's room, not the wallet's balance, as the reason), and accepts exactly what fits; the drawer's promise equals the deposit's delivery — half swapped, the shares quoted, the price used; the printed figures are the rounding of the real ones; "withdraw everything" pays out every position. |
| `roundtrip.mjs` | 144 deposit-and-redeem round trips across every vault that takes deposits, at eight sizes chosen to make the share count round both ways at four places. No overshoot, no dust, nothing lost. |
| `swaptest.mjs` | the desk end to end: quoting, the four routers ranked, the winner matching the selected route, balances moving by exactly the quote, Max landing on zero, the flip, an overspend refused, slippage driving the minimum, and a stock leg priced off the real quote. |
| `vaulttest.mjs` | the list: twenty rows, search, the five filters, sorting, the stats header, connect, the drawer's two sides, the position row, a paused vault refusing deposits, the contracts list. |
| `menus.mjs` | the nav dropdowns: open, close, switch between them, a click outside, Escape. |
| `misc.mjs` | the docs TOC and its scroll spy, a contracts row opening its vault and prefilling the search, the quick trade quoting from a page that is not the desk, the legal pages' contents lists, the footer's status bar and cube field. |
| `wallettest.mjs` | the wallet's two halves, against a stubbed EIP-1193 provider that throws on any method but the three read-only ones: with no wallet it falls back to the demo exactly as before; with one that approves it takes the real address, the real network and the real native balance while the play money stays play money; with one that declines it carries on; and the swap desk does the same. Nothing is ever signed or sent, and the stub proves it by refusing to answer anything else. |
| `allinks.mjs` | every `href` on every page resolves to something that exists — 189 targets. |
| `sweep.mjs` | at 1919 and 390: no horizontal scroll, and no text the colour of its own background. |

Two things worth knowing about the numbers they check.

The share price runs on a **compressed clock** — a second is an hour in the
vault — because at a real one a 31% APR moves the fourth decimal about once a
minute and nothing on screen would ever change. The positions panel says so.

Every price, vault, router and balance is **sample data**. The arithmetic
between them is not, which is what these files are for.
