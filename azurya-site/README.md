# Azurya

Marketing site and interface prototype for **Azurya**, a Uniswap v4 hook that reprices a
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
  favicon.svg   the droplet mark
Caddyfile       server config, reads $PORT from Railway
Dockerfile      caddy:2.8-alpine + the two files above
railway.json    tells Railway to use the Dockerfile
```

The page has three views behind hash routes:

| Route      | What it is                                             |
| ---------- | ------------------------------------------------------ |
| `#`        | the landing page                                        |
| `#/trade`  | the swap interface, live on Base Sepolia for ETH ↔ WETH |
| `#/docs`   | the protocol note                                       |

A terms and privacy gate blocks first entry and records the answer in `localStorage`
under `azurya-legal-v1`. Clear site data to see it again.

## Running it locally

Anything that serves a directory over HTTP will do. With Docker:

```bash
docker build -t azurya .
docker run --rm -p 8080:8080 azurya
```

Then open <http://localhost:8080>.

Opening `public/index.html` from the filesystem mostly works, but `file://` blocks the
chart's market-data request, so the chart falls back to its simulated series.

## Deploying

Railway builds the `Dockerfile` and serves `public/` through Caddy. Set the service's
Root Directory to `/azurya-site`, push, and Railway redeploys on its own.

No environment variables are required. The `Caddyfile` reads `PORT` if the platform sets
it and falls back to 8080, which is the port the service's domains already target.

## Third-party requests

The page makes exactly two requests off its own origin, both documented in the privacy
notice inside the site:

- **Google Fonts** — Familjen Grotesk, Public Sans, DM Mono.
- **Binance public API** — candles for the price chart. Failure is handled: the chart
  falls back to a deterministic simulated series and relabels itself.

There is no analytics, no tracking, and the site sets no cookies.

## Licence

No licence granted. All rights reserved.
