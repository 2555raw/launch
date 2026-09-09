# Legalization?

A school research project on drug policy: thirteen substances, a three tier
regulatory model, and the case for and against regulating each one.

Everything lives in `index.html`. There is no build step, no framework and no
external image: the pixel art, the side effect animations and the falling
background are all drawn in the page with canvas.

## Run it locally

    node server.js

Then open http://localhost:8080

Opening `index.html` directly in a browser also works.

## Deploy

The server listens on `process.env.PORT`, falling back to 8080.

- **Railway**: point the service at this folder (Settings > Root Directory =
  `legalization-site`). The start command is `node server.js`.
- **GitHub Pages / Netlify / Vercel**: no server needed. Publish this folder
  as static files; `index.html` is the whole site.

## Collecting poll answers

The poll in section 05 stores each visitor's choice in their browser and never
shows a tally. To gather answers when self hosted, set `POLL_ENDPOINT` near the
top of the poll script in `index.html` to a form endpoint that accepts JSON.

## Note

Educational material. It describes substances, risks and policy. It explains
nothing about producing anything and does not encourage use.
