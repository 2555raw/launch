# Markets — a macOS-style desktop for stocks & assets

A standalone static site: a fake macOS desktop (menu bar, window with traffic
lights, dock) that shows stocks, crypto, ETFs and commodities at a glance.
It shares nothing with the other folders in this repository.

## What is in it

- **Terms & Conditions gate.** A macOS-style sheet opens on first visit; the
  desktop only animates in once the box is ticked and *Accept* is pressed.
  Acceptance is remembered in `localStorage`, and the dock's document icon (or
  the File / Window / Help menus) reopens the sheet at any time.
- **Entrance animation.** Menu bar drops in, the window scales up, the dock
  rises, cards stagger in and the chart line draws itself.
- **Charts.** A big area chart with a hover crosshair and tooltip, plus a
  sparkline on every card and table row. Ranges: 1D / 1W / 1M / 1Y.
- **A view per asset class.** Each tab is its own screen: its own heading and
  description, its own figures in the strip above the cards and in the sidebar,
  its own accent, and its own featured chart. Pressing a tab again steps to the
  next asset in that class, starting from its biggest mover. Tabs are linkable
  (`#crypto`, `#commodity`, ...).
- **Browsing.** Search, sortable table, click any card or row to load it.
- **Session clock.** The sidebar says which phase the day is in (pre-market,
  regular session, after hours, weekend), how long is left, and fills a bar as
  the session runs, all on the viewer's own clock.
- **Heatmap.** Every asset as a tile in the sidebar, tinted by how far it moved
  today and clickable to load its chart.
- **Live quotes.** Prices move continuously and cells flash green or red.
- **Wallet.** A menu bar status item next to the battery and a dock app both open a sheet that talks to
  any EIP-1193 browser wallet: it reads the address, the chain and the native
  balance, shows them with a generated avatar, and copies or disconnects. It
  never proposes a transaction, and it restores an already-granted connection
  without prompting. With no wallet installed the sheet says so plainly.
- **Working menu bar.** Markets, File, View, Window and Help are real menus:
  refresh quotes, copy the shown quote or the whole table as CSV, print, switch
  appearance, jump between classes and ranges, open the wallet, the terms, the
  about sheet or the game. Every item names its keyboard shortcut, and the
  shortcuts work on the page (1–5, ], /, D, R, C, W, T, G, ?, Esc).
- **Ticker Drop.** A falling-block puzzle in its own window, opened from the
  dock or the Window menu. Each piece is a position: the blocks carry a ticker
  and take their colour from the asset class, a ghost shows where it lands, and
  filling a row books P&L that scales with the level. Arrow keys, space to drop,
  P to pause, and on-screen buttons at phone width.
- **X icon** in the menu bar, the sidebar, the dock and the footer.
- **Light and dark appearance,** toggled from the menu bar or the dock and
  remembered between visits. Follows the system setting on a first visit.

## Run it

    python3 -m http.server 4174 --directory macmarkets

Then open <http://localhost:4174>.

## Publish it

`artifact.html` is a generated single-file build of the same site, for hosting
somewhere that serves one page. Rebuild it after editing any source file:

    python3 macmarkets/build-artifact.py

It inlines the stylesheet and the script, settles the appearance before the
first paint, and mirrors the light palette into a `prefers-color-scheme` block
for hosts that do not stamp a theme on the page.

## Files

- `index.html` — desktop, window and the terms sheet.
- `artifact.html` — generated bundle, do not edit by hand.
- `styles.css` — design tokens at the top, then chrome, window, dock, modal.
- `app.js` — dependency-free: data, charts, filters, live ticks, terms gate.

## Notes

- Every price, chart and statistic is generated in the browser. Company names
  are real, the numbers are not, and the page says so in the footer.
- All motion is disabled under `prefers-reduced-motion`.
