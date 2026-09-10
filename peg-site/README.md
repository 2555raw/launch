# Peg site

Static landing page for **Peg**, an on-chain trading terminal for stable pairs.
Standalone project: no shared code, assets or build with the other folders in
this repository.

## Files

- `index.html` — the whole page: nav, hero, ticker, product cards, market table,
  steps, stats band, FAQ, CTA and footer.
- `styles.css` — dark palette with a mint accent, custom properties at the top.
- `app.js` — no dependencies: sticky nav, mobile menu, scroll reveals, stat
  counters, the hero sparkline and the market table. Prices are simulated in the
  browser (a small random walk); swap `markets` in `app.js` for a real feed.

## Run it

Any static server works, for example:

    python3 -m http.server 4173 --directory peg-site

Then open http://localhost:4173.

## Notes

- Fonts come from Google Fonts (Inter + JetBrains Mono); everything else is local.
- The email form is front-end only and posts nowhere.
- All motion is disabled under `prefers-reduced-motion`.
