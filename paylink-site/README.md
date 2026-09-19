# PayLink, version 1.1

Static site for **PayLink**: launch a coin on Pons and point its creator fees at any PayPal
address. Every trade pays real dollars into that account, and the person getting paid
never holds a wallet.

Rebuilt from the reference screenshots, page for page, with one change: the accent is orange
instead of green.

No build step, no dependencies. Plain HTML, CSS and vanilla JS.

## Structure

```
index.html     home: hero, who can be paid, why PayPal, tokens and merchants, what PYUSD does,
               the fee flow, the calculator, three steps, straight answers, the notice
launch.html    the launch form
link.html      link a token you already launched
explore.html   every linked token, with a filter (the top bar search lands here)
fees.html      what PayLink charges, the platform address, every transfer
proof.html     the seven live checks, fees sitting in the escrow, the contracts touched
docs.html      how it works, finding your PYUSD address, what can go wrong, contracts
styles.css     the design system (palette, type, shell, cards) and the responsive rules
app.js         stamps the sidebar and top bar on every page; theme, Ctrl K search,
               the calculator, the wallet button, the scroll reveal
chain.js       the chain layer: JSON-RPC client, keccak-256, ABI encoder and decoder,
               wallet helpers, Blockscout lookups. No dependencies, no keys. window.PL
live.js        launch, link, proof and fees talking to the chain through chain.js
favicon.svg    the link mark
assets/        the merchant marks that are images
```

## Run it

Open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 8000     # then open http://localhost:8000
```

## Design

A near-black app shell: a fixed sidebar, a top bar with search, and one reading column of cards.

| Token | Value | Role |
| --- | --- | --- |
| `bg` | `#0A0A0A` | page ground |
| `card` | `#121212` | every card |
| `surface` | `#1B1B1B` | active nav item, icon squares |
| `line` | `#222222` | every border |
| `accent` | `#FF8A1F` | the orange: the primary action, money, active state |
| `blue` | `#5B8CFF` | the 80% branch, the "a friend" pill |
| `violet` | `#9A7BFF` | the "a group" pill |
| `warn` | `#F0B23A` | the 20% branch, the notice, the "taken so far" figure |

Type: **Inter** for everything, **JetBrains Mono** for addresses, figures and labels. The
light palette deepens the orange so small accent text still clears 4.5:1 on the paper ground.

## What is real and what is not

Everything on chain happens from the visitor's browser, with no server in between.

- **Launch** checks that Robinhood Chain (4663) answers and that the factory has code, reads
  the factory ABI from Blockscout, picks the function that takes a name and an address,
  maps the form onto its arguments (name, ticker, fee recipient, USDG as the pair), shows
  the exact call, then hands it to the wallet. The wallet switches to Robinhood Chain if
  it has to. If the factory is not verified on Blockscout, the page says so and stops.
- **Link** reads the token, finds the factory's fee recipient setter and getter, shows the
  current recipient, and sends the change from the connected wallet.
- **Live proof** runs seven checks against the two chains, Across and Blockscout, and
  lists USDG arriving in the escrow.
- **Fees** reads the platform address's USDG balance and every transfer into it.

What does not exist: the payout worker. Nothing here claims fees from the escrow, bridges
them or sends PYUSD. A launch made here points its fees at the address you typed, and that
address is paid directly by the Pons escrow only if someone claims. The function matching
is by name and signature, so read the call the page shows before you sign it.

The factory and escrow addresses came from the reference screenshots and have not been
verified from this environment, which cannot reach the chain. The page verifies them at
runtime and refuses to build a transaction if they do not check out.
