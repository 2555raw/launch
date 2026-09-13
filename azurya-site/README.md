# Beyga

Marketing site and interface prototype for **Beyga**, a Uniswap v4 hook that reprices a
pool at a corporate action so a stock split does not cost the liquidity providers.

**Nothing here is deployed on mainnet.** There is no token, no sale, and no audit. The only
real transaction the interface can send is an ETH → WETH wrap on Base Sepolia. Every other
quote on the app screen is simulated and labelled as such in the UI.

## The brand

Beyga is named for *sable*, the sand colour — so the page is built on beige rather than
decorated with it. The ground is beige, the cards are the paper laid on it, and the accent
is a darker reading of the same colour. The mark is three wind ripples in sand, which is
also the ground texture, tiled.

The light theme is the real one. Dark is the same sand at night: warm browns, never grey.
The accent picker in the corner carries four readings of the beige, each with a light and a
dark set, because an accent that reads on cream is invisible on brown and the other way
round.

## What this repository is

One static page. No framework, no build step, no bundler. `public/index.html` is the whole
site — markup, styles and behaviour in a single file — served by Caddy from a container.

```
public/
  index.html    the entire site
  favicon.svg   the ripple mark
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
under `beyga-legal-v1`. Clear site data to see it again.

## Running it locally

Anything that serves a directory over HTTP will do. With Docker:

```bash
docker build -t beyga .
docker run --rm -p 8080:8080 beyga
```

Then open <http://localhost:8080>.

Opening `public/index.html` from the filesystem mostly works, but `file://` blocks the
chart's market-data request, so the chart falls back to its simulated series.

## Deploying

Railway builds the `Dockerfile` and serves `public/` through Caddy. Set the service's
Root Directory to `/azurya-site`, push, and Railway redeploys on its own.

The directory keeps the name `azurya-site` on purpose. It is what the Railway service's
Root Directory points at, and renaming it here would take the deploy down until somebody
went and changed that setting too. The brand has moved on four times inside it; the path
has not.

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
