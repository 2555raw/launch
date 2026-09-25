# seekr — site 1.1

seekr, modelled on heyaskr.ai: the landing page, the `/ask` app and the API
behind it, with **blue** as the accent instead of red and a header painted as
a **blue sky with clouds over a green field of flowers** in place of the red
planet. Everything on the page is wired to the server: live prices, the model
catalog, accounts, credits, streamed chat, image / video / speech generation,
crypto deposits, swaps into real-world assets, and the $SEEKR holder allowance.

```
seekr-site/
  server.js            HTTP server: static pages, /assets, and the JSON API
  lib/
    config.js          every environment variable, with defaults
    catalog.js         the models: vendor, provider, upstream id, price
    credits.js         list price, credits, the holder allowance, debit/credit
    auth.js            accounts without email: access keys and wallet sign-in
    store.js           JSON store (accounts, chats, library, files, deposits, usage)
    assets.js          generated files on disk, served at /assets/<id>
    router.js          live provider when its key is set, demo otherwise
    markets.js         crypto tickers (CoinGecko) and the $SEEKR price (DexScreener)
    chain.js           $SEEKR holdings, deposit verification (ETH/USDT, SOL, BTC)
    providers/         anthropic, openaiCompat (OpenAI, DeepSeek, xAI, OpenRouter),
                       google (Gemini, Nano Banana, Veo), fal (FLUX, Kling, Seedance,
                       Runway), elevenlabs, demo
  public/
    index.html         the landing page            landing.js
    ask.html           the app                     app.js
    pricing / calculator / token / developers / community .html + .js
    styles.css         the design system (dark + light)
    shared.js          API client, formatting, vendor marks, theme, nav
    art/scene-day.jpg  the header by day: sun, cumulus, a meadow of flowers
    art/scene-night.jpg the same meadow by night: moon, stars, the milky way
    fx.js              night only: twinkling stars across the sky, shooting stars
    (both scenes are rendered by scripts/make-scene.js)
    art/og.jpg         the social card, same scene (og.png is the lossless source)
```

## Run it

```bash
npm install
npm start            # http://localhost:8080
```

With no keys it runs in **demo mode**: every model answers with a clearly
labelled simulated reply (chat streams, images and clips are drawn locally,
speech is synthesised), new accounts start with 1,000 credits and the account
page has a "simulate a deposit" button. Everything else — balances, the
allowance, the library, history, sharing — is real. Copy `.env.example` to
`.env` (or set the variables on Railway), add a provider key, and that
provider goes live; the rest stay in demo until they have keys. `DEMO_MODE=off`
turns the simulation off entirely.

## What works

**Landing** — the $SEEKR pill and the crypto ticker refresh every minute;
the live prices card and the "What are you making?" tabs read the catalog;
the FAQ, the dropdown, the mobile menu and every link go somewhere.

**Accounts** — no email. *Create an access key* gives you a key that *is*
the account (shown once; copy it from the account page later). *Continue
with wallet* signs a message with any injected EVM wallet (no transaction)
and maps the address to an account. Linking a wallet to a key account is on
the account page.

**Ask / Code** — streamed chat over server-sent events with any chat model in
the picker (⌘K). Attach files (text is read in full), speak a prompt (mic →
transcription), toggle the globe to let Claude search the web, and *listen*
to any answer (text to speech). Code mode renders HTML answers in a live
preview. Every reply shows its exact cost in credits.

**Images / Video** — one request per render, saved to the Library with the
prompt, the model and the cost. **Library, Files, History, Collab** — the
sidebar views. Collab shares a chat as a read-only link.

**Credits** — `$1 = 1,000 credits`. List price is the provider's price × 1.055.
Chat is charged on the token counts the provider reports; images per image;
video per second; speech per character; transcription per minute.

**$SEEKR** — link a wallet and the server reads the balance on Robinhood Chain
(`ROBINHOOD_RPC_URL` + `SEEKR_TOKEN_ADDRESS`). Holders pay **5%** of list
inside a daily allowance of **1,000 credits per 0.01% of supply, up to
25,000**, reset 00:00 UTC; ≥ 0.5% flags early access, ≥ 1% priority routing.

**Deposits** — set a treasury address per chain and the account page shows
it; the user pastes the transaction id and the server verifies it on chain
(ETH or USDT to the treasury on Ethereum; SOL; BTC via mempool.space), converts
at the live rate and credits the balance once.

## Swap

`/swap` swaps any token to any token, on one chain or across chains (EVM
chains and Solana), routed by LI.FI across DEXs and bridges. MetaMask,
Coinbase Wallet, Rabby and Phantom's EVM side connect through EIP-6963;
Phantom signs Solana routes. On phones without an injected wallet the page
offers "Open in app" links for MetaMask, Coinbase Wallet and Phantom. The
server only relays read-only calls (`/api/swap/*`: chains, tokens, quotes,
status, balances); every transaction is signed in the user's wallet, and
ERC-20 approvals are for the exact amount. A "Real-world assets" shelf lists
tokenized gold, treasuries and xStocks that LI.FI can route to.

## Deploy on Railway

Point a service at this folder, set the variables from `.env.example`, and
mount a volume at `/data` with `DATA_DIR=/data` so the store and generated
files survive deploys. The server listens on `PORT` (8080 when unset).

## Notes

- Model **upstream ids** live in `lib/catalog.js`. Anthropic ids follow the
  current API; the others follow the names the original site shows. If a
  provider names a model differently, override it with
  `MODEL_UPSTREAM_OVERRIDES` or edit the row.
- Vendor marks in the logo strip are simple monochrome glyphs, not the
  vendors' trademarks.
- `npm run art` re-renders both header scenes from `scripts/make-scene.js`
  (seeded, so the output is stable). The site opens in day mode; the sun/moon
  button switches to night and remembers the choice.
- The Ask mode opens a skills panel (look things up, write, learn, fix,
  health, translate, money, brainstorm, summarise, shop). Each skill adds its
  own instructions to the chat; the list lives in `lib/skills.js`.
