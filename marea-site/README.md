# MAREA — site

Landing page for **MAREA**, a two-sided quoting desk, set under the sea. Its mascots are
a pair of seahorses: **Bid** (him, cobalt) and **Ask** (her, gold).

No build step, no dependencies, no image files. Plain HTML, CSS and vanilla JS; every
picture on the page is drawn in code.

## Structure

```
index.html    nav, hero with the couple, live console mock, venue marquee, how it works,
              quoting, venues (scene + cards), FAQ, closing call and footer
styles.css    design system (dark-blue accent tokens at the top), layout, responsive rules
seahorse.js   builds the two seahorses as SVG from a spine curve (body, rings, fin, head)
ocean.js      the background: water gradient, three procedurally generated reef layers
              (rocks, staghorn, sea fans, brain coral, sponges, anemones, kelp, sand life),
              a canvas of fish, schools, marine snow and bubbles, and a WebGL layer for
              sun shafts and caustics
app.js        characters, rising hearts, console simulation, marquee, code tabs, FAQ,
              scroll reveal, mobile menu and the venues scene
```

## Run it

```bash
python3 -m http.server 8000     # then open http://localhost:8000
```

Deploy by dropping the folder on any static host.

## Retint

All accents come from the `--accent-*` variables at the top of `styles.css`. The seahorse
colours live in `PALETTES` in `seahorse.js`.

## Notes

- Scrolling is a dive: the water darkens and the reef settles lower while there is text to
  read, then rises again for the closing section.
- Fish swerve away from the pointer.
- Without WebGL the light layer falls back to CSS shafts; with `prefers-reduced-motion`
  everything is drawn once and stays still.
- Links (`#`), the X account and the API host (`api.marea.example`) are placeholders.
