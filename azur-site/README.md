# AZUR — site

Static landing page for **AZUR**, a mobile app for trading with an AI co-pilot. Dark
ground, electric-blue accent (`--blue #2f7bff`, `--blue-hi #5aa2ff`).

No build step, no dependencies. Plain HTML, CSS and vanilla JS.

## Structure

```
index.html   hero (floating ticker pills, three phone mockups), "Watch everything"
             feed + alert burst, "Trade as fast as you think" chat + prompt bubbles,
             agent workspace hub, "Powered by" row and footer
styles.css   palette, type, layout, animations and the responsive rules
app.js       seeded charts and sparklines, feed marquee, cycling prompt bubbles,
             and the curved connectors in the workspace hub
```

## Run it

```bash
python3 -m http.server 8000     # then open http://localhost:8000
```

## Placeholders to replace

All names, accounts, figures and partner wordmarks are made up. Swap in the real brand
name, store links, social links, contact email and partner logos (with permission)
before launch.

## Pages

```
index.html     landing page
docs.html      getting-started docs: sidebar with search (Ctrl/Cmd+K), phone screens,
               "On this page" index that follows the scroll   (docs.css, docs.js)
privacy.html   privacy policy draft   } page.css
terms.html     terms of use draft     }
server.js      tiny Node server for Railway; /docs, /privacy, /terms work without .html,
               /health answers "ok"
```

Deploy on Railway with root directory `/azur-site` and start command `node server.js`.
