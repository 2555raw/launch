# Mauvya

Marketing site and interface prototype for **Mauvya**, a Uniswap v4 hook that reprices a
pool at a corporate action so a stock split does not cost the liquidity providers.

**Nothing here is deployed on mainnet.** There is no token, no sale, and no audit. The only
real transaction the interface can send is an ETH → WETH wrap on Base Sepolia. Every other
quote on the app screen is simulated and labelled as such in the UI.

## What this repository is

One static page. No framework, no build step, no bundler. `public/index.html` is the whole
site — markup, styles and behaviour in a single file — served by Caddy from a container.

```
public/
  index.html    the entire site
  favicon.svg   the split mark
Caddyfile       server config, reads $PORT from Railway
Dockerfile      caddy:2.8-alpine + the two files above
railway.json    tells Railway to use the Dockerfile
announce.py     writes public/api/token, which is the whole of going live
video/          the films: capture, title cards, soundtrack, cut
```

## Announcing the contract address

```bash
python3 announce.py 0x…                 # symbol MAU on Base by default
python3 announce.py 0x… --symbol MAU --chain Base --explorer https://…
python3 announce.py --clear             # back to "nothing is live yet"
```

That writes `public/api/token`. The page reads it on load: the registry turns
live, the address appears in full in the bar and one click selects it, and the
app's token list stops being the only place it shows. Until that file exists
the request 404s and the page stays as it is, with the bar reading "not
deployed" and the registry saying so in full.

Nothing validates that the address is the right contract. `announce.py` checks
the shape and copies it character for character; checking it is the contract
you deployed is yours to do on the explorer.

The page has three views behind hash routes:

| Route      | What it is                                             |
| ---------- | ------------------------------------------------------ |
| `#`        | the landing page                                        |
| `#/trade`  | the swap interface, live on Base Sepolia for ETH ↔ WETH |
| `#/docs`   | the protocol note                                       |

A terms and privacy gate blocks first entry and records the answer in `localStorage`
under `mauvya-legal-v1`. Clear site data to see it again.

## Running it locally

Anything that serves a directory over HTTP will do. With Docker:

```bash
docker build -t mauvya .
docker run --rm -p 8080:8080 mauvya
```

Then open <http://localhost:8080>.

Opening `public/index.html` from the filesystem mostly works, but `file://` blocks the
chart's market-data request, so the chart falls back to its simulated series.

## Deploying

Railway builds the `Dockerfile` and serves `public/` through Caddy. Set the service's
Root Directory to `/mauvya-site`, push, and Railway redeploys on its own.

No environment variables are required. The `Caddyfile` reads `PORT` if the platform sets
it and falls back to 8080, which is the port the service's domains already target.

## Third-party requests

The page makes exactly two requests off its own origin, both documented in the privacy
notice inside the site:

- **Google Fonts** — Instrument Serif, Chivo, Karla, Azeret Mono.
- **Binance public API** — candles for the price chart. Failure is handled: the chart
  falls back to a deterministic simulated series and relabels itself.

There is no analytics, no tracking, and the site sets no cookies.

## Licence

No licence granted. All rights reserved.
