# Salmya

Marketing site and interface prototype for **Salmya**, a Uniswap v4 hook that reprices a
pool at a corporate action so a stock split does not cost the liquidity providers.

**Nothing here is deployed on mainnet.** There is no token, no sale, and no audit. The only
real transaction the interface can send is an ETH → WETH wrap on Base Sepolia. Every other
quote on the app screen is simulated and labelled as such in the UI.

## The brand

Salmya is named for *salmon*, the colour — so the page is built on salmon rather than
decorated with it. The ground is a salmon wash, the cards are the paper laid on it, and the
accent is a deeper reading of the same colour. The mark is a salmon cut out of a disc: the
fish is the hole rather than the shape, so one filled path with an even-odd rule carries it
everywhere, from the 13px separator in the ticker to the watermark behind the hero.

The light theme is the real one. Dark is the same salmon after dusk: warm charcoal, never
grey. The accent picker in the corner carries four readings of the salmon, each with a light
and a dark set, because an accent that reads on a pale wash disappears on charcoal and the
other way round.

Every colour pair on the page was checked against WCAG before it shipped: body text clears
7:1 on its ground, and nothing that carries meaning sits below 4.5:1.

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
under `salmya-legal-v1`. Clear site data to see it again.

## Running it locally

Anything that serves a directory over HTTP will do. With Docker:

```bash
docker build -t salmya .
docker run --rm -p 8080:8080 salmya
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

No environment variables are required to serve the site. The `Caddyfile` reads `PORT` if
the platform sets it and falls back to 8080, which is the port the service's domains
already target.

## Announcing the contract address

The registry on the page asks `/api/token`, and Caddy answers it out of the environment.
Announcing an address is therefore a variable change, not a deploy:

| Variable | Example |
| --- | --- |
| `TOKEN_CA` | `0x0000000000000000000000000000000000000000` |
| `TOKEN_SYMBOL` | `SLM` |
| `TOKEN_CHAIN` | `Base` |
| `TOKEN_EXPLORER` | `https://basescan.org/token/0x0000...` |

Set them on the Railway service and the registry fills in on the next request. Clear
`TOKEN_CA` and it goes back to reading **not deployed** - the page needs both `announced`
and a non-empty address before it shows anything, so an unset variable is the off switch.

This matters beyond convenience: the page promises the address appears in that registry
first, and nowhere else before it. Anything that makes announcing slower than posting
makes that promise harder to keep.

## Third-party requests

The page makes exactly two requests off its own origin, both documented in the privacy
notice inside the site:

- **Google Fonts** — Familjen Grotesk, Public Sans, DM Mono.
- **Binance public API** — candles for the price chart. Failure is handled: the chart
  falls back to a deterministic simulated series and relabels itself.

There is no analytics, no tracking, and the site sets no cookies.

## Licence

No licence granted. All rights reserved.
