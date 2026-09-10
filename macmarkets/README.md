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
- **Browsing.** Segmented control and sidebar filters (stocks, crypto, ETFs,
  commodities), search, sortable table, click any card or row to load it.
- **Live quotes.** Prices move continuously and cells flash green or red.
- **X icon** in the menu bar, the sidebar, the dock and the footer.
- **Light and dark appearance,** toggled from the menu bar or the dock and
  remembered between visits. Follows the system setting on a first visit.

## Run it

    python3 -m http.server 4174 --directory macmarkets

Then open <http://localhost:4174>.

## Files

- `index.html` — desktop, window and the terms sheet.
- `styles.css` — design tokens at the top, then chrome, window, dock, modal.
- `app.js` — dependency-free: data, charts, filters, live ticks, terms gate.

## Notes

- Every price, chart and statistic is generated in the browser. Company names
  are real, the numbers are not, and the page says so in the footer.
- All motion is disabled under `prefers-reduced-motion`.
