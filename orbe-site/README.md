# ORBE — site

Static landing page for **ORBE** (placeholder name): one panel that compares prices across
several networks. Dark theme with dark-blue accents and original cat mascots.

No build step, no dependencies. Plain HTML, CSS and vanilla JS.

## Structure

```
index.html   the whole page: cat sprite, nav, hero with live-price panel, stats,
             how it works, venues, features, FAQ, closing call and footer
styles.css   palette (tokens on :root — change --blue to recolour), type, layout, responsive rules
app.js       mobile menu, anchor navigation, active section, scroll reveal, price mockup
```

The cats are SVG symbols at the top of `index.html` (`#cat`, `#cat-wink`, `#cat-happy`,
`#cat-cool`, `#cat-sleep`) and are placed with `<svg><use href="#cat"/></svg>`.

## Run it

```bash
python3 -m http.server 8000     # then open http://localhost:8000
```
