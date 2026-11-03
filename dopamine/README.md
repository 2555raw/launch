# DOPA-PERP

A one-page guide to dopamine, styled as a black-and-white perp-DEX trading terminal in the style of Hyperliquid (not affiliated), opening with the moodboard collage.

What's on the page:

- **Hero**: the "do·pa·mine" dictionary entry, corrected. Dopamine is made mostly in the midbrain (VTA and substantia nigra), not the hypothalamus.
- **Terminal**: a live simulator. Each habit opens a long on your dopamine at a set leverage. Cheap hits (scrolling, gambling, sugar, notifications) spike, then crash below baseline and raise tolerance. Sunlight, workouts, cold and deep work trade at 1–3×. Fall under 55 and you get liquidated. Sleep closes everything and pays down tolerance.
- **Pathways**: the four dopamine pathways as markets. Pick a row to trace its route on the MRI.
- **Signal lab**: a reward-prediction-error demo (Rescorla–Wagner, after Schultz 1997). Watch the burst move from the reward to the cue as it's learned.
- **Fix it**: a daily checklist with evidence ratings, saved in the browser.

Static files only: `index.html`, `styles.css`, `app.js` and the six photos in `img/` (cropped from the original moodboard collage, grayscale). No build, no dependencies.

```bash
cd dopamine && python3 -m http.server 8000
```

Educational only. Not medical or financial advice.
