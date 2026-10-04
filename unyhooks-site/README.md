# UnyHooks — site

Static site for **UnyHooks**, a chat app for building Uniswap V4 hooks on Robinhood Chain: you
describe what a pool should do, UnyHooks writes the hook, and you deploy it from your own wallet.

No build step, no dependencies. Plain HTML, CSS and vanilla JS.

## Structure

```
index.html   landing: hero, how it works, what you can build, trust, $UHOOKS, FAQ, closing call
docs.html    docs: sidebar, one article per hash (#quickstart, #hooks…), on-this-page rail, search
app.html     sign in: connect MetaMask or Phantom and sign one message
config.js    links, X handle, token address and network details: the only file to edit
styles.css   the design system (palette, type, buttons, cards, the doorway scene)
docs.css     docs furniture only
app.css      sign-in layout only
app.js       shared: links from config, sticky nav, menu, typing prompt, copy CA, scroll reveal
docs.js      docs routing, table of contents, previous/next and search
signin.js    wallet discovery (EIP-6963 + fallbacks) and the sign-in message (EIP-4361)
```

## Run it

```bash
python3 -m http.server 8000     # then open http://localhost:8000
```

Opening `index.html` straight from disk works for the landing and docs. Wallet sign-in needs the
page served over http(s), since wallets do not inject into `file://` pages.

## Before going live

Everything below is in `config.js`:

- **`CONTRACT`** — empty until the token exists. While it is empty the page reads "Announced at
  launch" and the copy and explorer buttons stay off.
- **`NETWORK`** — chain id, RPC, explorer and PoolManager for Robinhood Chain. Empty fields show
  as "—" in the docs; with `chainId` set, sign-in asks the wallet to switch chains.
- **`APP_URL`** — points at `app.html` now. Swap it for the real app's URL when there is one; the
  footer then shows its host name.
- **`X_HANDLE`** — `UnyHooks` is a placeholder until the account exists.

Sign-in has **no backend yet**: the signature is kept in `sessionStorage` for the tab and is not
verified. Once the workspace exists, send the message and signature to the server, verify them
there and issue the session from that.

The docs describe the product as it is meant to work (chat, in-browser compile, address mining,
pools). Check each page against the real app before launch.

## Design

A blush-white ground, near-black display type and one hot pink. The pink is the brand: the mark,
the primary button, the word that lands each headline, and the glow behind the panels.

| Token | Value | Role |
| --- | --- | --- |
| `--pink` / `--pink-grad` | `#EC1586` / `#E5127D → #FF7CC2` | mark, primary button, headline accent |
| `--pink-soft` / `--pink-line` | `#FFE6F2` / `#FBCDE3` | chat bubble, tags, active states |
| `--bg` / `--bg-tint` / `--card` | `#FFF9FC` / `#FFF2F8` / `#FFFFFF` | page, tinted band, cards |
| `--ink` / `--prose` / `--muted` | `#0F0B12` / `#5D5563` / `#8E8494` | headings, body, labels |
| `--ok` | `#0C9F6B` | "Compiles" and "Live" badges only |

Type: **Inter** for everything, **JetBrains Mono** for addresses and code.

The mark is a U whose right stem curls into a hook, drawn once as an SVG `<symbol>` per page.
The hero picture (a doorway onto a pink sky with the mark pressed into the wall) is pure CSS,
with no images.

## Motion

The hero prompt types through a few example requests; sections rise in once on scroll. With
`prefers-reduced-motion` the prompt stays still on its first line and nothing animates. The
hidden state for the scroll reveal only applies once the script has run, so the page still
renders complete without JS.

UnyHooks is an independent project and is not affiliated with Uniswap Labs or Robinhood.
