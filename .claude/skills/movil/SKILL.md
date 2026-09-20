---
name: movil
description: Phone pass on MarbleRush. Drives the site at phone sizes in a real browser, finds anything that overflows, overlaps, is too small to tap or unreadable, fixes it and ships.
---

# /movil

From `marble-royale/`. Start a demo server (`DEMO_MODE=1 ADMIN_KEY=test123 ROUND_MS=400000 PORT=8233 DATA_DIR=/tmp/movil node server.js &`) and drive it with Playwright (chromium at `/opt/pw-browsers`, flags `--no-sandbox --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`).

Sizes: 390x844 (iPhone), 430x932 (large phone), 360x740 (small Android), 820x1180 (tablet).

On each size, for every screen (home, lobby, countdown, race, results, launch, fair) and for the winners and wallet modals:

- No horizontal scroll: `document.documentElement.scrollWidth <= window.innerWidth + 1`.
- Nothing spills out of its card: for each `.glass`, no child's right edge past the card's right edge.
- Every button and link is at least 40 pixels tall and 40 wide.
- No text under 11 pixels, and nothing clipped by `overflow: hidden`.
- The dock is reachable and does not cover the content it sits on.
- Screenshot every screen and look at each one.

Fix what you find in `public/styles.css`, preferring to let rows wrap rather than shrink. Re-run until every check is clean, then follow `/deploy`.

Report: sizes checked, defects found, defects fixed, screenshots taken.
